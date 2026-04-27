import * as xlsx from 'xlsx';
import * as path from 'path';

const BUILDINGS = ['25', '26', '27', '28', '38', '36', '34', '33', '37', '12', '13', '14', '15', '41', '42'];
const BATCHES = ['BTECH-2023', 'BTECH-2024', 'BTECH-2025', 'BTECH-2026'];
const BATCH_PREFIXES = [123, 124, 125, 126];
const SPECIALIZATIONS = [
  'Fullstack Web Development', 
  'AI and Machine Learning', 
  'Cloud Computing', 
  'Cybersecurity', 
  'Data Science',
  'Internet of Things (IoT)',
  'Robotics and Automation',
  'Game Design and Development',
  'AR/VR Systems',
  'Blockchain Technology',
  'UI/UX Design',
  'Mobile App Development'
];
const MINORS = [
  'Web Dev', 
  'Deep Learning', 
  'DevOps', 
  'Blockchain', 
  'Business Analytics',
  'Finance',
  'Marketing',
  'Digital Media',
  'Robotics',
  'Psychology',
  'Entrepreneurship',
  'Cyber Ethics'
];
const PATHWAYS = [
  'Corporate Pathway', 
  'Research Pathway', 
  'Entrepreneurship Pathway', 
  'Higher Education Pathway', 
  'Government Jobs Pathway', 
  'Defense Services Pathway',
  'Study Abroad Pathway'
];
const CURRENT_YEAR = 2026;

type SubjectType = 'Theory' | 'Lab';

type Subject = {
  id: string;
  name: string;
  credit: number;
  type: SubjectType;
};

const SUBJECTS: Subject[] = [
  // Semester 1 & 2 (Core Engineering)
  { id: 'MTH101', name: 'Calculus I', credit: 4, type: 'Theory' },
  { id: 'PHY102', name: 'Engineering Physics', credit: 3, type: 'Theory' },
  { id: 'ENG101', name: 'Communication Skills', credit: 2, type: 'Theory' },
  { id: 'CSE101', name: 'Intro to Programming', credit: 4, type: 'Theory' },
  { id: 'CSL201', name: 'Programming Lab', credit: 2, type: 'Lab' },
  { id: 'MEE101', name: 'Engineering Graphics', credit: 2, type: 'Lab' },
  { id: 'MTH201', name: 'Discrete Mathematics', credit: 3, type: 'Theory' },
  { id: 'CSE202', name: 'Data Structures', credit: 4, type: 'Theory' },
  { id: 'CSE204', name: 'Object Oriented Programming', credit: 4, type: 'Theory' },
  { id: 'EEE101', name: 'Basic Electronics', credit: 3, type: 'Theory' },
  { id: 'HUM101', name: 'Professional Ethics', credit: 2, type: 'Theory' },
  { id: 'CSL202', name: 'OOP Lab', credit: 2, type: 'Lab' },

  // Semester 3 & 4 (Core CSE)
  { id: 'CSE203', name: 'Design and Analysis of Algorithms', credit: 3, type: 'Theory' },
  { id: 'CSE205', name: 'Computer Organization', credit: 3, type: 'Theory' },
  { id: 'CSE206', name: 'Probability and Statistics', credit: 3, type: 'Theory' },
  { id: 'MTH202', name: 'Linear Algebra', credit: 3, type: 'Theory' },
  { id: 'CSL301', name: 'Data Structures Lab', credit: 2, type: 'Lab' },
  { id: 'CSE301', name: 'Operating Systems', credit: 4, type: 'Theory' },
  { id: 'CSE302', name: 'Database Management Systems', credit: 4, type: 'Theory' },
  { id: 'CSE303', name: 'Computer Networks', credit: 3, type: 'Theory' },
  { id: 'CSE304', name: 'Software Engineering', credit: 3, type: 'Theory' },
  { id: 'CSL302', name: 'DBMS Lab', credit: 2, type: 'Lab' },
  { id: 'CSE305', name: 'Formal Languages and Automata', credit: 3, type: 'Theory' },

  // Semester 5 & 6 (Advanced CSE)
  { id: 'CSE401', name: 'Theory of Computation', credit: 3, type: 'Theory' },
  { id: 'CSE402', name: 'Compiler Design', credit: 3, type: 'Theory' },
  { id: 'CSE403', name: 'Web Technologies', credit: 3, type: 'Theory' },
  { id: 'OE501', name: 'Open Elective I', credit: 3, type: 'Theory' },
  { id: 'INT501', name: 'Industry Interface I', credit: 2, type: 'Theory' },
  { id: 'CSE451', name: 'Distributed Systems', credit: 3, type: 'Theory' },
  { id: 'CSE452', name: 'Information Security', credit: 3, type: 'Theory' },
  { id: 'CSE453', name: 'Mobile Computing', credit: 3, type: 'Theory' },
  { id: 'OE601', name: 'Open Elective II', credit: 3, type: 'Theory' },
  { id: 'INT601', name: 'Industry Interface II', credit: 2, type: 'Theory' },
  { id: 'CSL401', name: 'Web Technologies Lab', credit: 2, type: 'Lab' },

  // Semester 7 & 8 (Final Year)
  { id: 'PRJ701', name: 'Capstone Project I', credit: 4, type: 'Lab' },
  { id: 'EL701', name: 'Department Elective I', credit: 3, type: 'Theory' },
  { id: 'EL702', name: 'Department Elective II', credit: 3, type: 'Theory' },
  { id: 'IND701', name: 'Industrial Training', credit: 2, type: 'Lab' },
  { id: 'PRJ801', name: 'Capstone Project II', credit: 6, type: 'Lab' },
  { id: 'EL801', name: 'Department Elective III', credit: 3, type: 'Theory' },
  { id: 'EL802', name: 'Department Elective IV', credit: 3, type: 'Theory' },
  { id: 'SEM801', name: 'Seminar', credit: 1, type: 'Theory' },

  // Specialization Courses: Fullstack
  { id: 'FSE501', name: 'Frontend Engineering', credit: 3, type: 'Theory' },
  { id: 'FSE601', name: 'Backend Engineering', credit: 3, type: 'Theory' },
  { id: 'FSE701', name: 'Fullstack System Design', credit: 3, type: 'Theory' },
  { id: 'FSE801', name: 'Scalable Web Platforms', credit: 3, type: 'Theory' },

  // Specialization Courses: AI/ML
  { id: 'AIM501', name: 'Machine Learning', credit: 3, type: 'Theory' },
  { id: 'AIM601', name: 'Deep Learning Systems', credit: 3, type: 'Theory' },
  { id: 'AIM701', name: 'MLOps', credit: 3, type: 'Theory' },
  { id: 'AIM801', name: 'Applied AI Studio', credit: 3, type: 'Theory' },

  // Specialization Courses: Cloud
  { id: 'CLD501', name: 'Cloud Fundamentals', credit: 3, type: 'Theory' },
  { id: 'CLD601', name: 'Cloud Native Architecture', credit: 3, type: 'Theory' },
  { id: 'CLD701', name: 'Site Reliability Engineering', credit: 3, type: 'Theory' },
  { id: 'CLD801', name: 'Cloud Security and Governance', credit: 3, type: 'Theory' },

  // Specialization Courses: Cybersecurity
  { id: 'CYB501', name: 'Cyber Security Fundamentals', credit: 3, type: 'Theory' },
  { id: 'CYB601', name: 'Ethical Hacking', credit: 3, type: 'Theory' },
  { id: 'CYB701', name: 'Digital Forensics', credit: 3, type: 'Theory' },
  { id: 'CYB801', name: 'Security Operations Center', credit: 3, type: 'Theory' },

  // Specialization Courses: Data Science
  { id: 'DSE501', name: 'Data Warehousing', credit: 3, type: 'Theory' },
  { id: 'DSE601', name: 'Big Data Processing', credit: 3, type: 'Theory' },
  { id: 'DSE701', name: 'Data Visualization', credit: 3, type: 'Theory' },
  { id: 'DSE801', name: 'Advanced Analytics Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: IoT
  { id: 'IOT501', name: 'IoT Architectures', credit: 3, type: 'Theory' },
  { id: 'IOT601', name: 'Sensors and Actuators', credit: 3, type: 'Theory' },
  { id: 'IOT701', name: 'Edge Computing', credit: 3, type: 'Theory' },
  { id: 'IOT801', name: 'IoT Security Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: Robotics
  { id: 'ROB501', name: 'Introduction to Robotics', credit: 3, type: 'Theory' },
  { id: 'ROB601', name: 'Robot Kinematics', credit: 3, type: 'Theory' },
  { id: 'ROB701', name: 'Control Systems', credit: 3, type: 'Theory' },
  { id: 'ROB801', name: 'Autonomous Systems Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: Game Dev
  { id: 'GAM501', name: 'Game Engine Architecture', credit: 3, type: 'Theory' },
  { id: 'GAM601', name: '3D Modeling for Games', credit: 3, type: 'Theory' },
  { id: 'GAM701', name: 'Multiplayer Game Design', credit: 3, type: 'Theory' },
  { id: 'GAM801', name: 'Game Publishing Studio', credit: 3, type: 'Lab' },

  // Specialization Courses: AR/VR
  { id: 'ARR501', name: 'Computer Vision for AR', credit: 3, type: 'Theory' },
  { id: 'ARR601', name: 'Virtual Reality Environments', credit: 3, type: 'Theory' },
  { id: 'ARR701', name: 'Human-Computer Interaction', credit: 3, type: 'Theory' },
  { id: 'ARR801', name: 'Immersive Experience Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: Blockchain
  { id: 'BCT501', name: 'Blockchain Fundamentals', credit: 3, type: 'Theory' },
  { id: 'BCT601', name: 'Smart Contracts with Solidity', credit: 3, type: 'Theory' },
  { id: 'BCT701', name: 'DeFi Systems', credit: 3, type: 'Theory' },
  { id: 'BCT801', name: 'DApp Development Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: UI/UX
  { id: 'UIX501', name: 'Design Thinking', credit: 3, type: 'Theory' },
  { id: 'UIX601', name: 'User Research Methods', credit: 3, type: 'Theory' },
  { id: 'UIX701', name: 'Interaction Design', credit: 3, type: 'Theory' },
  { id: 'UIX801', name: 'UI/UX Portfolio Lab', credit: 3, type: 'Lab' },

  // Specialization Courses: Mobile
  { id: 'MOB501', name: 'Android App Development', credit: 3, type: 'Theory' },
  { id: 'MOB601', name: 'iOS App Development', credit: 3, type: 'Theory' },
  { id: 'MOB701', name: 'Cross-Platform Frameworks', credit: 3, type: 'Theory' },
  { id: 'MOB801', name: 'Mobile System Design Lab', credit: 3, type: 'Lab' },

  // Minor Courses
  { id: 'MWD301', name: 'Web Development Minor I', credit: 2, type: 'Theory' },
  { id: 'MWD401', name: 'Web Development Minor II', credit: 2, type: 'Lab' },
  { id: 'MDL301', name: 'Deep Learning Minor I', credit: 2, type: 'Theory' },
  { id: 'MDL401', name: 'Deep Learning Minor II', credit: 2, type: 'Lab' },
  { id: 'MDO301', name: 'DevOps Minor I', credit: 2, type: 'Theory' },
  { id: 'MDO401', name: 'DevOps Minor II', credit: 2, type: 'Lab' },
  { id: 'MBC301', name: 'Blockchain Minor I', credit: 2, type: 'Theory' },
  { id: 'MBC401', name: 'Blockchain Minor II', credit: 2, type: 'Lab' },
  { id: 'MBA301', name: 'Business Analytics Minor I', credit: 2, type: 'Theory' },
  { id: 'MBA401', name: 'Business Analytics Minor II', credit: 2, type: 'Lab' },
  { id: 'MFN301', name: 'Financial Markets Minor I', credit: 2, type: 'Theory' },
  { id: 'MFN401', name: 'Personal Finance Minor II', credit: 2, type: 'Lab' },
  { id: 'MMK301', name: 'Digital Marketing Minor I', credit: 2, type: 'Theory' },
  { id: 'MMK401', name: 'Consumer Behavior Minor II', credit: 2, type: 'Lab' },
  { id: 'MED301', name: 'New Media Design Minor I', credit: 2, type: 'Theory' },
  { id: 'MED401', name: 'Video Production Minor II', credit: 2, type: 'Lab' },
  { id: 'MRB301', name: 'Robotics Minor I', credit: 2, type: 'Theory' },
  { id: 'MRB401', name: 'Sensors Lab Minor II', credit: 2, type: 'Lab' },
  { id: 'MPS301', name: 'Social Psychology Minor I', credit: 2, type: 'Theory' },
  { id: 'MPS401', name: 'Cognitive Science Minor II', credit: 2, type: 'Lab' },
  { id: 'MET301', name: 'Startup Fundamentals Minor I', credit: 2, type: 'Theory' },
  { id: 'MET401', name: 'Business Model Lab Minor II', credit: 2, type: 'Lab' },
  { id: 'MCE301', name: 'Ethics in Tech Minor I', credit: 2, type: 'Theory' },
  { id: 'MCE401', name: 'Privacy Laws Minor II', credit: 2, type: 'Lab' }
];

const CORE_BY_SEMESTER: Record<number, string[]> = {
  1: ['MTH101', 'PHY102', 'ENG101', 'CSE101', 'CSL201', 'MEE101'],
  2: ['MTH201', 'CSE202', 'CSE204', 'EEE101', 'HUM101', 'CSL202'],
  3: ['CSE203', 'CSE205', 'CSE206', 'MTH202', 'CSL301'],
  4: ['CSE301', 'CSE302', 'CSE303', 'CSE304', 'CSL302', 'CSE305'],
  5: ['CSE401', 'CSE402', 'CSE403', 'OE501', 'INT501', 'CSL401'],
  6: ['CSE451', 'CSE452', 'CSE453', 'OE601', 'INT601'],
  7: ['PRJ701', 'EL701', 'EL702', 'IND701'],
  8: ['PRJ801', 'EL801', 'EL802', 'SEM801']
};

const SPECIALIZATION_BY_SEMESTER: Record<string, Record<number, string>> = {
  'Fullstack Web Development': { 5: 'FSE501', 6: 'FSE601', 7: 'FSE701', 8: 'FSE801' },
  'AI and Machine Learning': { 5: 'AIM501', 6: 'AIM601', 7: 'AIM701', 8: 'AIM801' },
  'Cloud Computing': { 5: 'CLD501', 6: 'CLD601', 7: 'CLD701', 8: 'CLD801' },
  Cybersecurity: { 5: 'CYB501', 6: 'CYB601', 7: 'CYB701', 8: 'CYB801' },
  'Data Science': { 5: 'DSE501', 6: 'DSE601', 7: 'DSE701', 8: 'DSE801' },
  'Internet of Things (IoT)': { 5: 'IOT501', 6: 'IOT601', 7: 'IOT701', 8: 'IOT801' },
  'Robotics and Automation': { 5: 'ROB501', 6: 'ROB601', 7: 'ROB701', 8: 'ROB801' },
  'Game Design and Development': { 5: 'GAM501', 6: 'GAM601', 7: 'GAM701', 8: 'GAM801' },
  'AR/VR Systems': { 5: 'ARR501', 6: 'ARR601', 7: 'ARR701', 8: 'ARR801' },
  'Blockchain Technology': { 5: 'BCT501', 6: 'BCT601', 7: 'BCT701', 8: 'BCT801' },
  'UI/UX Design': { 5: 'UIX501', 6: 'UIX601', 7: 'UIX701', 8: 'UIX801' },
  'Mobile App Development': { 5: 'MOB501', 6: 'MOB601', 7: 'MOB701', 8: 'MOB801' }
};

const MINOR_BY_SEMESTER: Record<string, Record<number, string>> = {
  'Web Dev': { 3: 'MWD301', 4: 'MWD401' },
  'Deep Learning': { 3: 'MDL301', 4: 'MDL401' },
  DevOps: { 3: 'MDO301', 4: 'MDO401' },
  Blockchain: { 3: 'MBC301', 4: 'MBC401' },
  'Business Analytics': { 3: 'MBA301', 4: 'MBA401' },
  Finance: { 3: 'MFN301', 4: 'MFN401' },
  Marketing: { 3: 'MMK301', 4: 'MMK401' },
  'Digital Media': { 3: 'MED301', 4: 'MED401' },
  Robotics: { 3: 'MRB301', 4: 'MRB401' },
  Psychology: { 3: 'MPS301', 4: 'MPS401' },
  Entrepreneurship: { 3: 'MET301', 4: 'MET401' },
  'Cyber Ethics': { 3: 'MCE301', 4: 'MCE401' }
};

function getSemesterFromBatch(batchYear: number): number {
  const sem = (CURRENT_YEAR - batchYear) * 2 + 1;
  return Math.max(1, Math.min(8, sem));
}

function uniqueCourseList(courses: string[]): string[] {
  return [...new Set(courses)];
}

function getStudentCoursesForSemester(semester: number, specialization: string, minor: string, targetCount: number): string[] {
  const courses: string[] = [];
  courses.push(...(CORE_BY_SEMESTER[semester] || []));

  const specializationCourse = SPECIALIZATION_BY_SEMESTER[specialization]?.[semester];
  if (specializationCourse) courses.push(specializationCourse);

  const minorCourse = MINOR_BY_SEMESTER[minor]?.[semester];
  if (minorCourse) courses.push(minorCourse);

  if (courses.length < targetCount) {
    const previousSemester = Math.max(1, semester - 1);
    const nextSemester = Math.min(8, semester + 1);
    courses.push(...(CORE_BY_SEMESTER[previousSemester] || []).slice(0, 2));
    courses.push(...(CORE_BY_SEMESTER[nextSemester] || []).slice(0, 2));
  }

  return uniqueCourseList(courses).slice(0, targetCount);
}

function buildCoreCourseSet(): Set<string> {
  const set = new Set<string>();
  for (const sem of Object.keys(CORE_BY_SEMESTER)) {
    for (const c of CORE_BY_SEMESTER[Number(sem)] || []) set.add(c);
  }
  return set;
}

function buildSpecializationCourseSet(): Set<string> {
  const set = new Set<string>();
  for (const spec of Object.keys(SPECIALIZATION_BY_SEMESTER)) {
    for (const sem of Object.keys(SPECIALIZATION_BY_SEMESTER[spec])) {
      set.add(SPECIALIZATION_BY_SEMESTER[spec][Number(sem)]);
    }
  }
  return set;
}

function buildMinorCourseSet(): Set<string> {
  const set = new Set<string>();
  for (const minor of Object.keys(MINOR_BY_SEMESTER)) {
    for (const sem of Object.keys(MINOR_BY_SEMESTER[minor])) {
      set.add(MINOR_BY_SEMESTER[minor][Number(sem)]);
    }
  }
  return set;
}

async function generateAdvancedSample() {
  const wb = xlsx.utils.book_new();
  const coreCourseSet = buildCoreCourseSet();
  const specializationCourseSet = buildSpecializationCourseSet();
  const minorCourseSet = buildMinorCourseSet();

  console.log('Generating 40,000 students...');

  // 1. Students Sheet
  const students: any[] = [];
  for (let i = 1; i <= 40000; i++) {
    const bucket = (i - 1) % BATCH_PREFIXES.length;
    const prefix = BATCH_PREFIXES[bucket];
    const batch = BATCHES[bucket];
    const suffix = String(i).padStart(6, '0');
    const specialization = SPECIALIZATIONS[(i - 1) % SPECIALIZATIONS.length];
    const minor = MINORS[(i - 1) % MINORS.length];
    const pathway = PATHWAYS[(i - 1) % PATHWAYS.length];
    const batchYear = Number(batch.replace('BTECH-', ''));
    const currentSemester = getSemesterFromBatch(batchYear);
    const coreGroupId = `CORE-${batchYear}-SEM${currentSemester}-MINOR-${minor.replace(/\s+/g, '_').toUpperCase()}`;
    const specializationGroupId = `SPEC-${batchYear}-SEM${currentSemester}-${specialization.replace(/\//g, '_').replace(/\s+/g, '_').toUpperCase()}`;
    const isByod = i % 3 === 0 ? 'True' : 'False';
    students.push({
      StudentID: `${prefix}${suffix}`,
      StudentName: `Student Name ${i}`,
      Program: 'BTECH',
      Branch: 'Computer Science and Engineering',
      Batch_Year: String(batchYear),
      Batch: batch,
      semester: currentSemester,
      specialization_id: specialization,
      minor_id: minor,
      core_group_id: coreGroupId,
      specialization_group_id: specializationGroupId,
      pathway_id: pathway,
      residence_type: i % 2 === 0 ? 'Hostel' : 'Day Scholar',
      backlog_courses: i % 100 === 0 ? 'MTH101' : (i % 250 === 0 ? 'CSE202' : ''),
      IsBYOD: isByod
    });
  }
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(students), 'students');

  console.log('Generating infrastructure...');

  // 2. Infrastructure Sheet
  const rooms: any[] = [];
  const neighborsByBuilding = BUILDINGS.reduce((acc, building, idx) => {
    const neighbors: string[] = [];
    if (idx > 0) neighbors.push(BUILDINGS[idx - 1]);
    if (idx < BUILDINGS.length - 1) neighbors.push(BUILDINGS[idx + 1]);
    acc[building] = neighbors;
    return acc;
  }, {} as Record<string, string[]>);

  BUILDINGS.forEach(bId => {
    const startFloor = 1;
    const endFloor = 9;
    for (let f = startFloor; f <= endFloor; f++) {
      for (let r = 1; r <= 30; r++) { // Increased rooms per floor
        const roomType = r % 4 === 0 ? 'Lab' : 'Classroom';
        const isByodReady = roomType === 'Lab' || r % 3 === 0 ? 'True' : 'False';
        rooms.push({
          FullRoomNumber: `${bId}-${f}${String(r).padStart(2, '0')}`,
          Building: bId,
          Capacity: r % 6 === 0 ? 180 : (r % 3 === 0 ? 120 : (r % 2 === 0 ? 60 : 30)),
          Type: roomType,
          IsBYOD: isByodReady,
          connected_blocks: neighborsByBuilding[bId].join(','),
          Latitude: Number(`31.${bId}${f}${String(r).padStart(2, '0')}`),
          Longitude: Number(`75.${bId}${f}${String(r).padStart(2, '0')}`)
        });
      }
    }
  });
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rooms), 'infrastructure');

  console.log('Generating faculty...');

  // 3. Faculty Sheet
  const faculty: any[] = [];
  for (let i = 1; i <= 450; i++) { // Increased faculty for 40k students and strict constraints
    const s1 = SUBJECTS[(i - 1) % SUBJECTS.length];
    const s2 = SUBJECTS[i % SUBJECTS.length];
    faculty.push({
      TeacherID: String(50000 + i),
      TeacherName: `Professor Name ${i}`,
      department_id: 'CSE',
      expertise: s1.name,
      expertise_tags: `${s1.id},${s2.id}`,
      max_teaching_hours_day: 6,
      forbidden_slots: JSON.stringify([]),
      travel_tolerance_mins: i % 3 === 0 ? 15 : (i % 5 === 0 ? 10 : 5)
    });
  }
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(faculty), 'faculty');

  console.log('Generating courses...');

  // 4. Courses Sheet
  const courses = SUBJECTS.map(s => ({
    Subject: s.id,
    SubjectName: s.name,
    credit_hours: s.credit,
    course_type: s.type,
    required_equipment: s.type === 'Lab' ? JSON.stringify(['COMPUTER_LAB']) : JSON.stringify([]),
    session_duration_minutes: s.type === 'Lab' ? 120 : 60
  }));
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(courses), 'courses');

  console.log('Generating enrollment (this may take a while for 40k students)...');

  // 5. Student Enrollment Sheet
  const enrollments: any[] = [];
  students.forEach((s, idx) => {
    const count = 7 + (idx % 2); // 7-8 subjects per student for CSE
    const currentSemester = Number(s.semester);
    const courseList = getStudentCoursesForSemester(currentSemester, s.specialization_id, s.minor_id, count);
    for (const courseId of courseList) {
      let courseBucket = 'Core';
      let groupingId = s.core_group_id;
      if (specializationCourseSet.has(courseId)) {
        courseBucket = 'Specialization';
        groupingId = s.specialization_group_id;
      } else if (minorCourseSet.has(courseId)) {
        courseBucket = 'Minor';
        groupingId = `MINOR-${s.Batch_Year}-SEM${currentSemester}-${s.minor_id.replace(/\s+/g, '_').toUpperCase()}`;
      } else if (!coreCourseSet.has(courseId)) {
        courseBucket = 'Elective';
        groupingId = `EL-${s.Batch_Year}-SEM${currentSemester}-${s.pathway_id.replace(/\s+/g, '_').toUpperCase()}`;
      }

      enrollments.push({
        StudentID: s.StudentID,
        Subject: courseId,
        semester: `Sem-${currentSemester}`,
        course_bucket: courseBucket,
        grouping_id: groupingId
      });
    }
    if (idx % 5000 === 0) console.log(`Processed ${idx} students...`);
  });
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(enrollments), 'student_enrollment');

  // 6. Curriculum Map Sheet
  const curriculumMap: any[] = [];
  for (let sem = 1; sem <= 8; sem++) {
    for (const c of CORE_BY_SEMESTER[sem] || []) {
      curriculumMap.push({ semester: sem, bucket: 'Core', specialization_id: 'ALL', minor_id: 'ALL', course_id: c });
    }
    for (const spec of SPECIALIZATIONS) {
      const specCourse = SPECIALIZATION_BY_SEMESTER[spec]?.[sem];
      if (specCourse) {
        curriculumMap.push({ semester: sem, bucket: 'Specialization', specialization_id: spec, minor_id: 'ALL', course_id: specCourse });
      }
    }
    for (const minor of MINORS) {
      const minorCourse = MINOR_BY_SEMESTER[minor]?.[sem];
      if (minorCourse) {
        curriculumMap.push({ semester: sem, bucket: 'Minor', specialization_id: 'ALL', minor_id: minor, course_id: minorCourse });
      }
    }
  }
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(curriculumMap), 'curriculum_map');

  // 10. Teachers-Subjects Mapping
  const ts: any[] = [];
  faculty.forEach((f, idx) => {
    const s1 = SUBJECTS[idx % SUBJECTS.length].id;
    const s2 = SUBJECTS[(idx + 1) % SUBJECTS.length].id;
    const s3 = SUBJECTS[(idx + 2) % SUBJECTS.length].id;
    ts.push({ TeacherID: f.TeacherID, SubjectCode: s1 });
    ts.push({ TeacherID: f.TeacherID, SubjectCode: s2 });
    ts.push({ TeacherID: f.TeacherID, SubjectCode: s3 });
  });
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(ts), 'teacher_subjects');

  const outputPath = path.join(process.cwd(), 'lpu_production_large_sample.xlsx');
  xlsx.writeFile(wb, outputPath);
  console.log(`✅ Large-scale production sample generated at: ${outputPath}`);
}

generateAdvancedSample();
