import { supabase } from '../config/supabase';
import { RoomData, StudentData, CourseData, TravelTimeData } from '../translators/xmlGenerator';

export async function fetchRooms(): Promise<RoomData[]> {
  const { data, error } = await supabase
    .from('infrastructure')
    .select('*');

  if (error) throw error;

  return data.map(r => ({
    id: r.room_id,
    building: r.block_id,
    roomNumber: r.room_id,
    capacity: r.capacity_lecture,
    type: r.room_type,
    features: r.is_byod_ready ? ['BYOD_READY'] : []
  }));
}

export async function fetchStudents(): Promise<StudentData[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*');

  if (error) throw error;

  return data.map(s => ({
    externalId: s.student_id,
    name: s.name,
    major: s.specialization_id || 'GENERAL',
    minor: s.minor_id,
    byod: s.is_byod
  }));
}

export async function fetchTravelTimes(): Promise<TravelTimeData[]> {
  const { data, error } = await supabase
    .from('infrastructure')
    .select('block_id, connected_blocks');

  if (error) throw error;

  // This is a naive expansion, ideally we have a dedicated table for travel matrix
  // For now, mapping LPU Connected_Blocks Rule
  const travels: TravelTimeData[] = [];
  data.forEach((r: any) => {
    r.connected_blocks?.forEach((adj: string) => {
      travels.push({ block1: r.block_id, block2: adj, isAdjacent: true });
    });
  });

  return travels;
}

export async function fetchCourses(): Promise<CourseData[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*');

  if (error) throw error;

  // For simplicity, generate 2 sections per course for now (1 Lecture, 1 Lab)
  // In real use, sections might be in a separate table
  return data.map(c => ({
    id: c.course_id,
    subject: c.course_id.substring(0, 3).toUpperCase(),
    courseNumber: c.course_id.substring(3),
    sections: [
      { id: `${c.course_id}-L1`, capacity: 60, type: 'Lecture', minutesPerWeek: c.session_duration_minutes },
      { id: `${c.course_id}-P1`, capacity: 30, type: 'Lab', minutesPerWeek: c.session_duration_minutes }
    ]
  }));
}

export async function fetchStats() {
  const [students, infrastructure, courses] = await Promise.all([
    supabase.from('students').select('student_id', { count: 'exact', head: true }),
    supabase.from('infrastructure').select('room_id', { count: 'exact', head: true }),
    supabase.from('courses').select('course_id', { count: 'exact', head: true })
  ]);

  return {
    totalStudents: students.count || 0,
    totalRooms: infrastructure.count || 0,
    totalCourses: courses.count || 0,
    solverStatus: 'IDLE',
    lastGenerated: new Date().toISOString()
  };
}
