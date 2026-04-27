import { supabase } from '../config/supabase';
import { getSolverConstraints } from './constraintService';

type ConflictDetail = {
  key: string;
  count: number;
  entries: {
    course_code: string;
    section_name: string;
    time_slot: string;
    room_id: string;
    instructor_name: string;
  }[];
};

type CapacityViolation = {
  section_name: string;
  room_id: string;
  room_capacity: number;
  student_count: number;
  time_slot: string;
};

type MismatchViolation = {
  section_name: string;
  course_code: string;
  course_type: string;
  room_id: string;
  room_type: string;
  time_slot: string;
};

type ByodViolation = {
  section_name: string;
  room_id: string;
  time_slot: string;
  byod_students: number;
};

export class ValidationService {
  private readonly specializationPrefixes = ['FSE', 'AIM', 'CLD', 'CYB', 'DSE'];
  private readonly minorPrefixes = ['MWD', 'MDL', 'MDO', 'MBC', 'MBA'];
  private readonly pageSize = 1000;

  private async fetchAllRows(table: string, columns: string, orderBy?: string): Promise<any[]> {
    const rows: any[] = [];
    let from = 0;
    const seen = new Set<string>();

    while (true) {
      let query: any = supabase.from(table).select(columns);
      if (orderBy) {
        query = query.order(orderBy, { ascending: true });
      }
      const { data, error } = await query.range(from, from + this.pageSize - 1);
      if (error) throw error;

      const batch = data || [];
      // Deduplicate in case of page-boundary overlaps
      for (const row of batch) {
        const rowId = row.id || `${from}_${rows.length}`;
        if (!seen.has(rowId)) {
          seen.add(rowId);
          rows.push(row);
        }
      }
      if (batch.length < this.pageSize) break;
      from += this.pageSize;
    }

    return rows;
  }

  private parseSemester(semesterRaw: any): number {
    const value = String(semesterRaw || '').trim();
    const match = value.match(/(\d+)/);
    if (!match) return 1;
    const sem = Number(match[1]);
    return Number.isNaN(sem) ? 1 : Math.max(1, Math.min(8, sem));
  }

  private getBatchToken(studentId: string): string {
    const m = String(studentId).match(/^(\d{3})/);
    return m ? m[1] : 'GEN';
  }

  private normalizeToken(value: string, fallback: string): string {
    return String(value || fallback)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/\//g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private getCourseBucket(courseId: string): 'Specialization' | 'Minor' | 'Core' {
    const prefix = String(courseId || '').slice(0, 3).toUpperCase();
    if (this.specializationPrefixes.includes(prefix)) return 'Specialization';
    if (this.minorPrefixes.includes(prefix)) return 'Minor';
    return 'Core';
  }

  private buildGroupingId(bucket: 'Specialization' | 'Minor' | 'Core', semester: number, student: any, studentId: string): string {
    const batchToken = this.getBatchToken(studentId);
    const specialization = this.normalizeToken(student?.specialization_id, 'GENERAL');
    const minor = this.normalizeToken(student?.minor_id, 'GENERAL');
    const pathway = this.normalizeToken(student?.pathway_id, 'P0');

    if (bucket === 'Specialization') return `SPEC-${batchToken}-SEM${semester}-${specialization}`;
    if (bucket === 'Minor') return `MINOR-${batchToken}-SEM${semester}-${minor}`;
    return `CORE-${batchToken}-SEM${semester}-MINOR-${minor}-PATH-${pathway}`;
  }

  private buildGlobalTrack(student: any): string {
    const specialization = this.normalizeToken(student?.specialization_id, 'GENERAL');
    const minor = this.normalizeToken(student?.minor_id, 'GENERAL');
    const pathway = this.normalizeToken(student?.pathway_id, 'P0');
    if (specialization !== 'GENERAL') return `SPEC-${specialization}-MINOR-${minor}-PATH-${pathway}`;
    return `NORMAL-MINOR-${minor}-PATH-${pathway}`;
  }

  private collectConflicts<T>(items: T[], keyBuilder: (item: T) => string): ConflictDetail[] {
    const bucket = new Map<string, T[]>();
    for (const item of items) {
      const key = keyBuilder(item);
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(item);
    }

    const conflicts: ConflictDetail[] = [];
    for (const [key, grouped] of bucket.entries()) {
      if (grouped.length <= 1) continue;
      conflicts.push({
        key,
        count: grouped.length,
        entries: (grouped as any[]).map((x: any) => ({
          course_code: x.course_code,
          section_name: x.section_name,
          time_slot: x.time_slot,
          room_id: x.room_id,
          instructor_name: x.instructor_name
        }))
      });
    }
    return conflicts;
  }

  async validate() {
    const constraints = await getSolverConstraints();
    const [
      assignments,
      rooms,
      courses,
      enrollments,
      students
    ] = await Promise.all([
      this.fetchAllRows('master_timetable', '*', 'id'),
      this.fetchAllRows('infrastructure', 'room_id, capacity_lecture, room_type, is_byod_ready', 'room_id'),
      this.fetchAllRows('courses', 'course_id, credit_hours, course_type', 'course_id'),
      this.fetchAllRows('student_enrollments', 'student_id, course_id, semester', 'student_id'),
      this.fetchAllRows('students', 'student_id, specialization_id, minor_id, pathway_id, is_byod', 'student_id')
    ]);

    const roomById: Record<string, any> = {};
    rooms.forEach(r => { roomById[r.room_id] = r; });

    const courseById: Record<string, any> = {};
    courses.forEach(c => { courseById[c.course_id] = c; });

    const studentById: Record<string, any> = {};
    students.forEach(s => { studentById[s.student_id] = s; });

    const roomConflicts = this.collectConflicts(assignments, (a: any) => `${a.time_slot}__${a.room_id}`);

    const teacherAssignments = assignments.filter((a: any) => String(a.instructor_name || '').trim().length > 0);
    const teacherConflicts = this.collectConflicts(teacherAssignments, (a: any) => `${a.time_slot}__${a.instructor_name}`);

    const studentTimePairs: any[] = [];
    for (const a of assignments) {
      const studentIds: string[] = Array.isArray(a.student_ids) ? a.student_ids : [];
      for (const sid of studentIds) {
        studentTimePairs.push({ ...a, student_id: sid });
      }
    }
    const studentConflicts = this.collectConflicts(studentTimePairs, (a: any) => `${a.time_slot}__${a.student_id}`);

    const capacityViolations: CapacityViolation[] = [];
    const typeMismatches: MismatchViolation[] = [];
    const byodViolations: ByodViolation[] = [];

    for (const a of assignments) {
      const room = roomById[a.room_id];
      const course = courseById[a.course_code];
      const studentIds: string[] = Array.isArray(a.student_ids) ? a.student_ids : [];
      const studentCount = studentIds.length;

      if (room && Number(room.capacity_lecture) < studentCount) {
        capacityViolations.push({
          section_name: a.section_name,
          room_id: a.room_id,
          room_capacity: Number(room.capacity_lecture),
          student_count: studentCount,
          time_slot: a.time_slot
        });
      }

      if (room && course) {
        const roomType = String(room.room_type || '').toLowerCase();
        const courseType = String(course.course_type || '').toLowerCase();
        const isLabRoom = roomType.includes('lab');
        const isLabCourse = courseType.includes('lab');
        if (isLabCourse !== isLabRoom) {
          typeMismatches.push({
            section_name: a.section_name,
            course_code: a.course_code,
            course_type: String(course.course_type || 'Theory'),
            room_id: a.room_id,
            room_type: String(room.room_type || 'Classroom'),
            time_slot: a.time_slot
          });
        }
      }

      if (room && !room.is_byod_ready) {
        const byodStudents = studentIds.filter((sid) => Boolean(studentById[sid]?.is_byod)).length;
        if (byodStudents > 0) {
          byodViolations.push({
            section_name: a.section_name,
            room_id: a.room_id,
            time_slot: a.time_slot,
            byod_students: byodStudents
          });
        }
      }
    }

    // Accuracy: expected sessions based on global cohorts + credit hours
    const enrollmentGroups: Record<string, string[]> = {};
    const groupMeta: Record<string, { courseId: string; semester: number }> = {};
    const studentSemesterCourses = new Map<string, Set<string>>();

    for (const e of enrollments) {
      const semester = this.parseSemester(e.semester);
      const key = `${e.student_id}|SEM${semester}`;
      if (!studentSemesterCourses.has(key)) studentSemesterCourses.set(key, new Set<string>());
      studentSemesterCourses.get(key)!.add(String(e.course_id));
    }

    const studentSemesterCohort = new Map<string, string>();
    const trackCohortByStudentSemester = new Map<string, string>();
    const cohortCounts = new Map<string, number>();
    for (const [studentSemesterKey, coursesSet] of studentSemesterCourses.entries()) {
      const [studentId, semToken] = studentSemesterKey.split('|');
      const semester = Number(String(semToken).replace('SEM', '')) || 1;
      const student = studentById[studentId];
      const track = this.buildGlobalTrack(student);
      const batchToken = this.getBatchToken(studentId);
      const coursesSignature = Array.from(coursesSet).sort().join('|');
      const trackCohortId = `COHORT-${batchToken}-SEM${semester}-${track}`;
      const cohortId = constraints.cohortGranularity === 'track_only'
        ? trackCohortId
        : `${trackCohortId}-COURSES-${coursesSignature}`;
      trackCohortByStudentSemester.set(studentSemesterKey, trackCohortId);
      studentSemesterCohort.set(studentSemesterKey, cohortId);
      cohortCounts.set(cohortId, (cohortCounts.get(cohortId) || 0) + 1);
    }

    if (constraints.cohortGranularity === 'exact_course_set' && constraints.minCourseSetCohortSize > 1) {
      for (const [studentSemesterKey, cohortId] of studentSemesterCohort.entries()) {
        const count = cohortCounts.get(cohortId) || 0;
        if (count >= constraints.minCourseSetCohortSize) continue;
        const merged = trackCohortByStudentSemester.get(studentSemesterKey);
        if (merged) studentSemesterCohort.set(studentSemesterKey, merged);
      }
    }

    for (const e of enrollments) {
      const semester = this.parseSemester(e.semester);
      const studentSemesterKey = `${e.student_id}|SEM${semester}`;
      const groupingId = studentSemesterCohort.get(studentSemesterKey) || `COHORT-${this.getBatchToken(e.student_id)}-SEM${semester}-FALLBACK`;
      const key = `${e.course_id}__SEM${semester}__${groupingId}`;
      if (!enrollmentGroups[key]) {
        enrollmentGroups[key] = [];
        groupMeta[key] = { courseId: e.course_id, semester };
      }
      enrollmentGroups[key].push(e.student_id);
    }

    let expectedSessions = 0;
    for (const key of Object.keys(enrollmentGroups)) {
      const meta = groupMeta[key];
      const course = courseById[meta.courseId];
      if (!course) continue;
      const isLab = String(course.course_type || '').toLowerCase().includes('lab');
      const maxCapacity = isLab ? constraints.maxLabSectionSize : constraints.maxLectureSectionSize;
      const groupedStudents = enrollmentGroups[key].length;
      const sectionCount = Math.max(1, Math.ceil(groupedStudents / maxCapacity));
      const sessionsPerWeek = Math.max(1, Number(course.credit_hours || 1));
      expectedSessions += sectionCount * sessionsPerWeek;
    }

    const actualSessions = assignments.length;
    const missingSessions = Math.max(0, expectedSessions - actualSessions);
    const extraSessions = Math.max(0, actualSessions - expectedSessions);
    const placementRate = expectedSessions > 0 ? Number(((actualSessions / expectedSessions) * 100).toFixed(2)) : 0;

    const hardConflictCount =
      roomConflicts.length +
      teacherConflicts.length +
      studentConflicts.length +
      capacityViolations.length +
      typeMismatches.length +
      byodViolations.length;

    return {
      status: hardConflictCount === 0 ? 'PASS' : 'FAIL',
      summary: {
        expected_sessions: expectedSessions,
        actual_sessions: actualSessions,
        missing_sessions: missingSessions,
        extra_sessions: extraSessions,
        placement_rate_percent: placementRate,
        hard_conflict_count: hardConflictCount
      },
      conflicts: {
        room_conflicts: roomConflicts,
        teacher_conflicts: teacherConflicts,
        student_conflicts: studentConflicts,
        capacity_violations: capacityViolations,
        room_type_mismatches: typeMismatches,
        byod_violations: byodViolations
      }
    };
  }
}
