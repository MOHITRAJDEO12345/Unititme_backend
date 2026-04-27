import multer from 'multer';
import * as xlsx from 'xlsx';
import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const upload = multer({ storage: multer.memoryStorage() });

// In-memory status tracking
let importStatus = {
  isImporting: false,
  progress: 0,
  currentSheet: '',
  totalRows: 0,
  processedRows: 0,
  message: ''
};

function parseStringArray(input: any): string[] {
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
      } catch {
        // fall back to comma parsing
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

async function batchUpsert(table: string, data: any[], onConflict: string, batchSize: number = 1000) {
  importStatus.currentSheet = table;
  importStatus.totalRows = data.length;
  importStatus.processedRows = 0;
  
  console.log(`--- Starting Batch Upsert for ${table} (${data.length} rows) ---`);
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
       console.error(`Error in batch ${i / batchSize}:`, error.message);
       throw error;
    }
    
    importStatus.processedRows = Math.min(i + batchSize, data.length);
    // Rough calculation of overall progress (this is simplified as it's per sheet)
    importStatus.progress = Math.round((importStatus.processedRows / importStatus.totalRows) * 100);
    
    if (i % (batchSize * 5) === 0 || i + batchSize >= data.length) {
        console.log(`Processed ${importStatus.processedRows} / ${data.length} rows for ${table}`);
    }
  }
  return data.length;
}

export const setupDataRoutes = (app: any) => {
  // Status endpoint
  app.get('/api/data/import/status', (req: Request, res: Response) => {
    res.json(importStatus);
  });

  // Cleanup endpoint
  app.post('/api/data/cleanup', async (req: Request, res: Response) => {
    const tables = [
      'master_timetable',
      'student_enrollments', 
      'teacher_subjects', 
      'students', 
      'infrastructure', 
      'faculty', 
      'courses'
    ];
    
    console.log('--- API Cleanup Started ---');
    try {
      for (const table of tables) {
        let query = supabase.from(table).delete();
        if (table === 'students' || table === 'student_enrollments') query = query.neq('student_id', '-1');
        else if (table === 'infrastructure') query = query.neq('room_id', '-1');
        else if (table === 'faculty' || table === 'teacher_subjects') query = query.neq('teacher_id', '-1');
        else if (table === 'courses') query = query.neq('course_id', '-1');
        else if (table === 'master_timetable') query = query.neq('course_code', '-1');

        const { error } = await query;
        if (error) throw error;
      }
      res.json({ success: true, message: 'Database cleared successfully' });
    } catch (err: any) {
      console.error('Cleanup failed:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Import Endpoint (Non-blocking)
  app.post('/api/data/import', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file && !req.body.storagePath) {
      return res.status(400).json({ success: false, message: 'No file uploaded or storage path provided' });
    }

    if (importStatus.isImporting) {
      return res.status(400).json({ success: false, message: 'An import is already in progress' });
    }

    importStatus = {
      isImporting: true,
      progress: 0,
      currentSheet: 'Starting...',
      totalRows: 0,
      processedRows: 0,
      message: 'Processing file...'
    };

    // Run in background to prevent timeout
    (async () => {
      try {
        console.log('--- Background Import Started ---');
        let buffer: Buffer;

        if (req.body.storagePath) {
          console.log(`Downloading file from Supabase Storage: ${req.body.storagePath}`);
          const { data, error } = await supabase.storage
            .from('institutional-data')
            .download(req.body.storagePath);
          
          if (error) throw new Error(`Supabase Storage download failed: ${error.message}`);
          buffer = Buffer.from(await data.arrayBuffer());
        } else if (req.file) {
          buffer = req.file.buffer;
        } else {
          throw new Error('No file data provided');
        }

        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const results: any = {};

        for (const sheetName of workbook.SheetNames) {
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
          if (data.length === 0) continue;

          console.log(`Processing ${data.length} rows from sheet: ${sheetName}`);
          importStatus.message = `Processing ${sheetName}...`;

          switch (sheetName.toLowerCase()) {
            case 'students':
              results.students = await ingestStudents(data);
              break;
            case 'infrastructure':
              results.infrastructure = await ingestInfrastructure(data);
              break;
            case 'faculty':
              results.faculty = await ingestFaculty(data);
              break;
            case 'courses':
              results.courses = await ingestCourses(data);
              break;
            case 'student enrollment':
            case 'student_enrollment':
              results.enrollments = await ingestEnrollments(data);
              break;
            case 'teachers-subjects':
            case 'teacher_subjects':
              results.teacherSubjects = await ingestTeacherSubjects(data);
              break;
            default:
              console.log(`Skipping unknown sheet: ${sheetName}`);
          }
        }

        importStatus.isImporting = false;
        importStatus.progress = 100;
        importStatus.message = 'Import complete!';
        console.log('--- Background Import Finished ---');
      } catch (err: any) {
        console.error('Background Import Failed:', err);
        importStatus.isImporting = false;
        importStatus.message = `Error: ${err.message}`;
      }
    })();

    res.json({ 
      success: true, 
      message: 'Import started in background. Monitor progress in the dashboard.'
    });
  });
};

// ... (ingest functions remain the same)

async function ingestStudents(data: any[]) {
  const mapped = data.map(s => ({
    student_id: String(s.StudentID || s.student_id),
    name: s.StudentName || s.name,
    program: s.Program || s.program || 'BTECH',
    specialization_id: s.specialization_id || s.Batch,
    minor_id: s.minor_id,
    pathway_id: s.pathway_id,
    is_byod: String(s.IsBYOD || s.is_byod).toLowerCase() === 'true',
    residence_type: s.residence_type,
    backlog_courses: parseStringArray(s.backlog_courses)
  }));

  return await batchUpsert('students', mapped, 'student_id');
}

async function ingestInfrastructure(data: any[]) {
  const mapped = data.map(r => ({
    room_id: String(r.FullRoomNumber || r.room_id),
    block_id: String(r.Building || r.block_id),
    capacity_lecture: Number(r.Capacity || r.capacity_lecture),
    room_type: r.Type || r.room_type,
    is_byod_ready: String(r.IsBYOD || r.is_byod_ready).toLowerCase() === 'true',
    connected_blocks: parseStringArray(r.connected_blocks),
    latitude: r.Latitude ? Number(r.Latitude) : null,
    longitude: r.Longitude ? Number(r.Longitude) : null
  }));

  return await batchUpsert('infrastructure', mapped, 'room_id');
}

async function ingestFaculty(data: any[]) {
  const mapped = data.map(f => ({
    teacher_id: String(f.TeacherID || f.teacher_id),
    name: f.TeacherName || f.name,
    department_id: f.department_id || 'GENERAL',
    expertise_tags: parseStringArray(f.expertise_tags || f.expertise),
    max_teaching_hours_day: Number(f.max_teaching_hours_day || 6),
    forbidden_slots: parseStringArray(f.forbidden_slots),
    travel_tolerance_mins: Number(f.travel_tolerance_mins || 0)
  }));

  return await batchUpsert('faculty', mapped, 'teacher_id');
}

async function ingestCourses(data: any[]) {
  const mapped = data.map(c => ({
    course_id: String(c.Subject || c.course_id),
    course_name: c.name || c.SubjectName || c.course_name,
    credit_hours: Number(c.credit_hours || 0),
    course_type: c.course_type || 'Lecture',
    required_equipment: parseStringArray(c.required_equipment),
    session_duration_minutes: Number(c.session_duration_minutes || 50)
  }));

  return await batchUpsert('courses', mapped, 'course_id');
}

async function ingestEnrollments(data: any[]) {
  const mapped = data.map(e => ({
    student_id: String(e.StudentID || e.student_id),
    course_id: String(e.Subject || e.course_id),
    semester: String(e.semester || 'Sem-1')
  }));

  return await batchUpsert('student_enrollments', mapped, 'student_id, course_id');
}

async function ingestTeacherSubjects(data: any[]) {
  const mapped = data.map(ts => ({
    teacher_id: String(ts.TeacherID || ts.teacher_id),
    course_id: String(ts.SubjectCode || ts.course_id)
  }));

  return await batchUpsert('teacher_subjects', mapped, 'teacher_id, course_id');
}
