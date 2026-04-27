import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

function generateSampleData() {
    console.log('Generating large sample data...');

    // 1. Students (1000 records)
    const students = [];
    const specializations = ['Fullstack', 'AI/ML', 'Cloud Computing', 'Cybersecurity', 'Data Science'];
    const minors = ['Web Dev', 'Deep Learning', 'DevOps', 'Blockchain', 'Tableau'];
    const residences = ['Hostel', 'Day Scholar'];

    for (let i = 1; i <= 1000; i++) {
        students.push({
            student_id: `LPU${40000 + i}`,
            name: `Student Name ${i}`,
            program: 'B.Tech CSE',
            specialization_id: specializations[i % specializations.length],
            minor_id: minors[i % minors.length],
            pathway_id: `P${(i % 10) + 1}`,
            is_byod: i % 3 === 0,
            residence_type: residences[i % residences.length],
            backlog_courses: ''
        });
    }

    // 2. Infrastructure (200 records)
    const infrastructure = [];
    const roomTypes = ['Theory', 'Lab'];
    for (let i = 1; i <= 200; i++) {
        infrastructure.push({
            room_id: `R${100 + i}`,
            block_id: `Block ${30 + (i % 10)}`,
            capacity_lecture: 40 + (i % 40),
            room_type: roomTypes[i % roomTypes.length],
            is_byod_ready: i % 5 === 0,
            connected_blocks: `Block ${30 + ((i + 1) % 10)}`
        });
    }

    // 3. Faculty (100 records)
    const faculty = [];
    for (let i = 1; i <= 100; i++) {
        faculty.push({
            teacher_id: `FAC${1000 + i}`,
            department_id: 'CSE',
            expertise_tags: specializations[i % specializations.length],
            max_teaching_hours_day: 6,
            forbidden_slots: '[]',
            travel_tolerance_mins: 5
        });
    }

    // 4. Courses (50 records)
    const courses = [];
    for (let i = 1; i <= 50; i++) {
        courses.push({
            course_id: `CSE${100 + i}`,
            credit_hours: (i % 4) + 1,
            course_type: roomTypes[i % roomTypes.length],
            required_equipment: '[]',
            session_duration_minutes: 50
        });
    }

    const wb = xlsx.utils.book_new();
    
    const ws_students = xlsx.utils.json_to_sheet(students);
    xlsx.utils.book_append_sheet(wb, ws_students, "Students");

    const ws_infrastructure = xlsx.utils.json_to_sheet(infrastructure);
    xlsx.utils.book_append_sheet(wb, ws_infrastructure, "Infrastructure");

    const ws_faculty = xlsx.utils.json_to_sheet(faculty);
    xlsx.utils.book_append_sheet(wb, ws_faculty, "Faculty");

    const ws_courses = xlsx.utils.json_to_sheet(courses);
    xlsx.utils.book_append_sheet(wb, ws_courses, "Courses");

    const outputPath = path.resolve(__dirname, '../../large_sample_data.xlsx');
    xlsx.writeFile(wb, outputPath);

    console.log(`✅ Sample data generated at: ${outputPath}`);
}

generateSampleData();
