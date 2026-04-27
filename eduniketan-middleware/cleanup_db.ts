import { supabase } from './src/config/supabase';

async function cleanup() {
    const tables = [
        'master_timetable',
        'student_enrollments', 
        'teacher_subjects', 
        'students', 
        'infrastructure', 
        'faculty', 
        'courses'
    ];
    console.log('--- Cleaning up database ---');
    for (const table of tables) {
        console.log(`Deleting all rows from ${table}...`);
        let query = supabase.from(table).delete();
        
        // Use a filter that matches all rows
        if (table === 'students' || table === 'student_enrollments') query = query.neq('student_id', '-1');
        else if (table === 'infrastructure') query = query.neq('room_id', '-1');
        else if (table === 'faculty' || table === 'teacher_subjects') query = query.neq('teacher_id', '-1');
        else if (table === 'courses') query = query.neq('course_id', '-1');
        else if (table === 'master_timetable') query = query.neq('course_code', '-1');

        const { error: err } = await query;
        if (err) {
            console.error(`Error cleaning ${table}:`, err.message);
        } else {
            console.log(`Successfully cleared ${table}`);
        }
    }
    console.log('--- Cleanup complete ---');
}

cleanup();
