import * as XLSX from 'xlsx';
import * as path from 'path';
import { supabase } from '../config/supabase';

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
        // fallback to comma-separated
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

async function importProductionData() {
  const filePath = path.join(__dirname, '../../lpu_production_large_sample.xlsx');
  console.log(`Reading: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);

  // 1. Students
  const studentSheet = XLSX.utils.sheet_to_json(workbook.Sheets['students']);
  console.log(`Importing ${studentSheet.length} students...`);
  const mappedStudents = studentSheet.map((s: any) => ({
    student_id: String(s.StudentID),
    name: s.StudentName,
    program: s.Program || 'BTECH',
    specialization_id: s.specialization_id || s.Batch,
    minor_id: s.minor_id,
    pathway_id: s.pathway_id,
    is_byod: s.IsBYOD === 'True' || s.IsBYOD === true,
    residence_type: s.residence_type,
    backlog_courses: parseStringArray(s.backlog_courses)
  }));

  // 2. Faculty
  const facultySheet = XLSX.utils.sheet_to_json(workbook.Sheets['faculty']);
  console.log(`Importing ${facultySheet.length} faculty...`);
  const mappedFaculty = facultySheet.map((f: any) => ({
    teacher_id: String(f.TeacherID),
    name: f.TeacherName,
    department_id: f.department_id || 'GENERAL',
    expertise_tags: parseStringArray(f.expertise_tags || f.expertise),
    max_teaching_hours_day: Number(f.max_teaching_hours_day || 6),
    forbidden_slots: parseStringArray(f.forbidden_slots),
    travel_tolerance_mins: Number(f.travel_tolerance_mins || 0)
  }));

  // 3. Infrastructure
  const infraSheet = XLSX.utils.sheet_to_json(workbook.Sheets['infrastructure']);
  console.log(`Importing ${infraSheet.length} rooms...`);
  const mappedInfra = infraSheet.map((r: any) => ({
    room_id: String(r.FullRoomNumber),
    block_id: String(r.Building),
    capacity_lecture: Number(r.Capacity),
    room_type: r.Type,
    is_byod_ready: r.IsBYOD === 'True' || r.IsBYOD === true,
    connected_blocks: parseStringArray(r.connected_blocks),
    latitude: r.Latitude ? Number(r.Latitude) : null,
    longitude: r.Longitude ? Number(r.Longitude) : null
  }));

  // 4. Courses
  const courseSheet = XLSX.utils.sheet_to_json(workbook.Sheets['courses']);
  console.log(`Importing ${courseSheet.length} courses...`);
  const mappedCourses = courseSheet.map((c: any) => ({
    course_id: c.Subject,
    course_name: c.SubjectName,
    credit_hours: Number(c.credit_hours),
    course_type: c.course_type || 'Theory',
    required_equipment: parseStringArray(c.required_equipment),
    session_duration_minutes: Number(c.session_duration_minutes)
  }));

  // 5. Enrollments
  const enrollSheet = XLSX.utils.sheet_to_json(workbook.Sheets['student_enrollment']);
  console.log(`Importing ${enrollSheet.length} enrollments...`);
  const mappedEnroll = enrollSheet.map((e: any) => ({
    student_id: String(e.StudentID),
    course_id: e.Subject,
    semester: String(e.semester || 'Sem-1')
  }));

  // 6. Teacher Subjects
  const tsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['teacher_subjects']);
  console.log(`Importing ${tsSheet.length} teacher assignments...`);
  const mappedTS = tsSheet.map((ts: any) => ({
    teacher_id: String(ts.TeacherID),
    course_id: ts.SubjectCode
  }));

  // Chunked upsert helper for large datasets
  const CHUNK_SIZE = 2000;
  async function chunkedUpsert(table: string, data: any[], conflictKey: string) {
    console.log(`  Upserting ${data.length} rows to ${table} in chunks of ${CHUNK_SIZE}...`);
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictKey });
      if (error) throw new Error(`${table} chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
      const progress = Math.min(100, Math.round(((i + chunk.length) / data.length) * 100));
      console.log(`  ${table}: ${i + chunk.length}/${data.length} (${progress}%)`);
    }
    console.log(`  ✅ ${table} complete.`);
  }

  await chunkedUpsert('students', mappedStudents, 'student_id');
  await chunkedUpsert('faculty', mappedFaculty, 'teacher_id');
  await chunkedUpsert('infrastructure', mappedInfra, 'room_id');
  await chunkedUpsert('courses', mappedCourses, 'course_id');
  await chunkedUpsert('student_enrollments', mappedEnroll, 'student_id,course_id');
  await chunkedUpsert('teacher_subjects', mappedTS, 'teacher_id,course_id');

  console.log('✅ Production Data Ingested Successfully!');
}

importProductionData().catch(console.error);
