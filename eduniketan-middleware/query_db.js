const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/run/media/anon/endeavouros/home/anon/Pictures/ums_timetable/eduniketan-middleware/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
  const { count: teacherCount } = await supabase.from('faculty').select('*', { count: 'exact', head: true });
  const { count: enrollmentCount } = await supabase.from('student_enrollment').select('*', { count: 'exact', head: true });
  console.log(`Students: ${studentCount}, Teachers: ${teacherCount}, Enrollments: ${enrollmentCount}`);
}
run();
