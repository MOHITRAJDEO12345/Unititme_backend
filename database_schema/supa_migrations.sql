-- Supabase Core Migrations for Eduniketan Allocation Engine

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    uid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100),
    specialization_id VARCHAR(100),
    minor_id VARCHAR(100), -- Used heavily for cluster grouping
    pathway_id VARCHAR(100), -- Core pathway isolation
    is_byod BOOLEAN DEFAULT FALSE,
    residence_type VARCHAR(50), -- E.g. 'Hostel' vs 'Day Scholar'
    backlog_courses TEXT[] DEFAULT '{}'::TEXT[]
);

-- 2. Infrastructure (Rooms/Blocks) Table
CREATE TABLE IF NOT EXISTS infrastructure (
    room_id VARCHAR(100) PRIMARY KEY,
    block_id VARCHAR(100) NOT NULL,
    capacity_lecture INT NOT NULL,
    room_type VARCHAR(50) DEFAULT 'Theory', -- E.g., 'Lab', 'Theory'
    is_byod_ready BOOLEAN DEFAULT FALSE,
    connected_blocks TEXT[] DEFAULT '{}'::TEXT[], -- The LPU adjacent block math array
    latitude DECIMAL,
    longitude DECIMAL
);

-- 3. Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    teacher_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    department_id VARCHAR(100),
    expertise_tags TEXT[] DEFAULT '{}'::TEXT[],
    max_teaching_hours_day INT DEFAULT 6,
    forbidden_slots TEXT[] DEFAULT '{}'::TEXT[],
    travel_tolerance_mins INT DEFAULT 0
);

-- 4. Courses Table
CREATE TABLE IF NOT EXISTS courses (
    course_id VARCHAR(100) PRIMARY KEY,
    course_name VARCHAR(255),
    credit_hours INT,
    course_type VARCHAR(50), -- E.g. 'Lecture', 'Lab'
    required_equipment TEXT[] DEFAULT '{}'::TEXT[],
    session_duration_minutes INT DEFAULT 90
);

-- 6. Teacher-Subject Mapping
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id VARCHAR(100) REFERENCES faculty(teacher_id),
    course_id VARCHAR(100) REFERENCES courses(course_id),
    UNIQUE(teacher_id, course_id)
);

-- 7. Student Enrollment Mapping
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(student_id),
    course_id VARCHAR(100) REFERENCES courses(course_id),
    semester VARCHAR(50),
    UNIQUE(student_id, course_id)
);

-- 5. Master Timetable (Final Solver Output)
CREATE TABLE IF NOT EXISTS master_timetable (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_code VARCHAR(100) NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    time_slot VARCHAR(100) NOT NULL,
    room_id VARCHAR(100) REFERENCES infrastructure(room_id),
    instructor_name VARCHAR(255),
    student_ids TEXT[] DEFAULT '{}'::TEXT[] -- List of students in this section
);


