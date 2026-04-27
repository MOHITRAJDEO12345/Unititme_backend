import multer from 'multer';
import * as xlsx from 'xlsx';
import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const upload = multer({ storage: multer.memoryStorage() });

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

export const setupDataRoutes = (app: any) => {
  app.post('/api/data/import', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      console.log('--- Import Started ---');
      if (!req.file) throw new Error('No file in request');
      console.log('File size:', req.file.size);
      
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      console.log('Sheets found:', workbook.SheetNames);
      
      const results: any = {};

      for (const sheetName of workbook.SheetNames) {
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (data.length === 0) continue;

        console.log(`Processing ${data.length} rows from sheet: ${sheetName}`);
        console.log(`Sample data from ${sheetName}:`, JSON.stringify(data[0]));

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

      res.json({ 
        success: true, 
        message: 'Import complete!',
        details: results
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: `Error parsing spreadsheet: ${err.message}` });
    }
  });
};

async function ingestStudents(data: any[]) {
  const mapped = data.map(s => ({
    student_id: s.StudentID || s.student_id,
    name: s.StudentName || s.name,
    program: s.Program || s.program || 'BTECH',
    specialization_id: s.specialization_id || s.Batch,
    minor_id: s.minor_id,
    pathway_id: s.pathway_id,
    is_byod: String(s.IsBYOD || s.is_byod).toLowerCase() === 'true',
    residence_type: s.residence_type,
    backlog_courses: parseStringArray(s.backlog_courses)
  }));

  console.log('Mapped student[0]:', JSON.stringify(mapped[0]));

  const { error } = await supabase.from('students').upsert(mapped, { onConflict: 'student_id' });
  if (error) throw error;
  return mapped.length;
}

async function ingestInfrastructure(data: any[]) {
  const mapped = data.map(r => ({
    room_id: r.FullRoomNumber || r.room_id,
    block_id: String(r.Building || r.block_id),
    capacity_lecture: Number(r.Capacity || r.capacity_lecture),
    room_type: r.Type || r.room_type,
    is_byod_ready: String(r.IsBYOD || r.is_byod_ready).toLowerCase() === 'true',
    connected_blocks: parseStringArray(r.connected_blocks),
    latitude: r.Latitude ? Number(r.Latitude) : null,
    longitude: r.Longitude ? Number(r.Longitude) : null
  }));

  const { error } = await supabase.from('infrastructure').upsert(mapped, { onConflict: 'room_id' });
  if (error) throw error;
  return mapped.length;
}

async function ingestFaculty(data: any[]) {
  const mapped = data.map(f => ({
    teacher_id: f.TeacherID || f.teacher_id,
    name: f.TeacherName || f.name,
    department_id: f.department_id || 'GENERAL',
    expertise_tags: parseStringArray(f.expertise_tags || f.expertise),
    max_teaching_hours_day: Number(f.max_teaching_hours_day || 6),
    forbidden_slots: parseStringArray(f.forbidden_slots),
    travel_tolerance_mins: Number(f.travel_tolerance_mins || 0)
  }));

  const { error } = await supabase.from('faculty').upsert(mapped, { onConflict: 'teacher_id' });
  if (error) throw error;
  return mapped.length;
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

  const { error } = await supabase.from('courses').upsert(mapped, { onConflict: 'course_id' });
  if (error) throw error;
  return mapped.length;
}

async function ingestEnrollments(data: any[]) {
  const mapped = data.map(e => ({
    student_id: String(e.StudentID || e.student_id),
    course_id: String(e.Subject || e.course_id),
    semester: String(e.semester || 'Sem-1')
  }));

  const { error } = await supabase.from('student_enrollments').upsert(mapped, { onConflict: 'student_id, course_id' });
  if (error) throw error;
  return mapped.length;
}

async function ingestTeacherSubjects(data: any[]) {
  const mapped = data.map(ts => ({
    teacher_id: String(ts.TeacherID || ts.teacher_id),
    course_id: String(ts.SubjectCode || ts.course_id)
  }));

  const { error } = await supabase.from('teacher_subjects').upsert(mapped, { onConflict: 'teacher_id, course_id' });
  if (error) throw error;
  return mapped.length;
}
