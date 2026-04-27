import { supabase } from './src/config/supabase';

async function checkCounts() {
    const tables = ['students', 'infrastructure', 'faculty', 'courses', 'student_enrollments', 'teacher_subjects'];
    console.log('--- Database Integrity Check ---');
    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else {
            console.log(`${table}: ${count} rows`);
        }
    }
}

checkCounts();
