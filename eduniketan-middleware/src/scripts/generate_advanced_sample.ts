import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const BUILDINGS = ['25', '26', '27', '28', '38', '36', '34', '33', '37'];
const BATCHES = ['BTECH-2021', 'BTECH-2022', 'BTECH-2023', 'BTECH-2024'];
const SUBJECTS = [
  { id: 'CSE101', name: 'Intro to Programming' },
  { id: 'CSE202', name: 'Data Structures' },
  { id: 'MTH101', name: 'Calculus I' },
  { id: 'PHY102', name: 'Physics' },
  { id: 'ENG101', name: 'English' }
];

async function generateAdvancedSample() {
  const wb = xlsx.utils.book_new();

  // 1. Building-Batch Affinity
  const affinityData = BATCHES.map((batch, idx) => ({
    Batch: batch,
    PrimaryBuilding: BUILDINGS[idx % BUILDINGS.length],
    Year: 2021 + idx,
    Semester: idx % 2 === 0 ? 'Odd' : 'Even'
  }));
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(affinityData), 'Building-Batch Affinity');

  // 2. Teacher-Subject Matrix
  const teachers = [
    { id: 'T001', name: 'Dr. Sharma', subjects: ['CSE101', 'CSE202'] },
    { id: 'T002', name: 'Prof. Verma', subjects: ['MTH101'] },
    { id: 'T003', name: 'Dr. Iyer', subjects: ['PHY102', 'MTH101'] },
    { id: 'T004', name: 'Mr. Gupta', subjects: ['ENG101'] },
    { id: 'T005', name: 'Dr. Kaur', subjects: ['CSE202'] }
  ];
  
  const teacherMatrix = teachers.flatMap(t => t.subjects.map(subj => ({
    TeacherID: t.id,
    TeacherName: t.name,
    SubjectCode: subj,
    CanTeachMultiple: t.subjects.length > 1 ? 'Yes' : 'No'
  })));
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(teacherMatrix), 'Teachers-Subjects');

  // 3. Students & Subjects (Enrollment)
  const studentEnrollment: any[] = [];
  for (let i = 1; i <= 200; i++) {
    const studentBatch = BATCHES[i % BATCHES.length];
    const studentId = `STU${String(i).padStart(4, '0')}`;
    const name = `Student ${i}`;
    
    // Assign 2 subjects to each student
    const s1 = SUBJECTS[i % SUBJECTS.length];
    const s2 = SUBJECTS[(i + 1) % SUBJECTS.length];

    studentEnrollment.push({
      StudentID: studentId,
      StudentName: name,
      Batch: studentBatch,
      Subject: s1.id,
      SubjectName: s1.name,
    });
    studentEnrollment.push({
      StudentID: studentId,
      StudentName: name,
      Batch: studentBatch,
      Subject: s2.id,
      SubjectName: s2.name,
    });
  }
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(studentEnrollment), 'Student Enrollment');

  // 4. Infrastructure (Rooms - Highly Specific LPU structural Rules)
  const rooms: any[] = [];
  BUILDINGS.forEach(bId => {
    const startFloor = bId === '37' ? 6 : 1;
    const maxFloor = 9;
    const roomsPerFloor = 12;

    for (let f = startFloor; f <= maxFloor; f++) {
      for (let r = 1; r <= roomsPerFloor; r++) {
        const roomNo = `${f}${String(r).padStart(2, '0')}`; // e.g. 510, 912
        rooms.push({
            FullRoomNumber: `${bId}-${roomNo}`,
            Building: bId,
            Floor: f,
            RoomSequence: r,
            Capacity: r % 4 === 0 ? 120 : (r % 2 === 0 ? 60 : 30),
            Type: r % 4 === 0 ? 'Auditorium' : 'Classroom',
            IsBYOD: r % 3 === 0 ? 'True' : 'False'
        });
      }
    }
  });
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rooms), 'Infrastructure');

  const outputPath = path.join(process.cwd(), 'refined_advanced_sample.xlsx');
  xlsx.writeFile(wb, outputPath);
  console.log(`✅ Refined advanced sample generated at: ${outputPath}`);
}

generateAdvancedSample();

