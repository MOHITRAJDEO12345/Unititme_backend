import { supabase } from '../config/supabase';

async function cleanup() {
  console.log('⏳ Clearing tables via Supabase API...');
  
  try {
    const tables = [
      'student_enrollments', 
      'teacher_subjects', 
      'master_timetable', 
      'students', 
      'infrastructure', 
      'faculty', 
      'courses'
    ];
    
    for (const table of tables) {
      console.log(`Clearing ${table}...`);

      const primaryColumn: Record<string, string> = {
        student_enrollments: 'id',
        teacher_subjects: 'id',
        master_timetable: 'id',
        students: 'student_id',
        infrastructure: 'room_id',
        faculty: 'teacher_id',
        courses: 'course_id'
      };

      const key = primaryColumn[table] || 'id';
      const marker = key === 'id' ? '00000000-0000-0000-0000-000000000000' : 'FORCE_DELETE';
      const { error } = await supabase.from(table).delete().neq(key, marker);
      if (error) throw new Error(`${table}: ${error.message}`);

      console.log(`✅ ${table} cleared.`);
    }
    
    console.log('🎉 Database cleanup attempt finished.');

  } catch (err: any) {
    console.error('❌ Cleanup failed:', err.message);
  }
}

cleanup();
