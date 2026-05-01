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

    // Clear Storage Bucket
    console.log('--- Cleaning up Storage Bucket ---');
    const { data: files, error: listError } = await supabase.storage
        .from('institutional-data')
        .list('uploads');

    if (!listError && files && files.length > 0) {
        const paths = files.map(f => `uploads/${f.name}`);
        const { error: deleteError } = await supabase.storage
            .from('institutional-data')
            .remove(paths);
        
        if (deleteError) {
            console.error('Storage cleanup failed:', deleteError.message);
        } else {
            console.log(`Deleted ${paths.length} files from storage.`);
        }
    } else {
        console.log('No files found in storage uploads/ folder.');
    }

    console.log('--- Cleanup complete ---');
}

cleanup();
