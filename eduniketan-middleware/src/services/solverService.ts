import { supabase } from '../config/supabase';
import { getSolverConstraints, type SolverConstraints } from './constraintService';

interface Section {
  id: string;
  sectionName: string;
  courseId: string;
  type: 'Lecture' | 'Lab';
  capacity: number;
  enrolledStudents: string[];
  sessionsPerWeek: number;
  semester: number;
  groupingId: string;
  requiresByod: boolean;
  teacherId?: string;
}

interface Room {
  id: string;
  building: string;
  capacity: number;
  type: string;
  isByodReady: boolean;
}

interface Assignment {
  course_code: string;
  section_name: string;
  time_slot: string;
  room_id: string;
  instructor_name: string;
  student_ids: string[];
}

interface TeacherRef {
  teacher_id: string;
  name: string;
  forbidden_slots?: string[];
}

interface SessionJob {
  id: number;
  section: Section;
  teacher: TeacherRef;
  compatibleRooms: Room[];
}

interface ScheduledSession {
  job: SessionJob;
  day: string;
  slot: string;
  room: Room;
}

export class SolverService {
  private rooms: Room[] = [];
  private sections: Section[] = [];
  private constraints: SolverConstraints | null = null;
  public status = {
    isSolving: false,
    progress: 0,
    message: 'Idle',
    currentTask: '',
    totalTasks: 0,
    processedTasks: 0
  };
  private readonly timeSlots = [
    '09:00 AM - 09:50 AM',
    '10:00 AM - 10:50 AM',
    '11:00 AM - 11:50 AM',
    '12:00 PM - 12:50 PM',
    '01:10 PM - 02:00 PM',
    '02:10 PM - 03:00 PM',
    '03:10 PM - 04:00 PM',
    '04:10 PM - 05:00 PM'
  ];
  private teachers: any[] = [];
  private teacherCourseMap: Record<string, string[]> = {}; // courseId -> teacherIds
  private readonly specializationPrefixes = ['FSE', 'AIM', 'CLD', 'CYB', 'DSE'];
  private readonly minorPrefixes = ['MWD', 'MDL', 'MDO', 'MBC', 'MBA'];
  private readonly pageSize = 1000;
  private readonly lpuDepartmentCode = 'K'; // user-requested: CSE style prefix like K23CS

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

  private extractBatchTokenFromGroupingId(groupingId: string): string {
    const m = String(groupingId).match(/-(\d{3})-SEM/i);
    return m ? m[1] : '126';
  }

  private stringHash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (h * 31 + value.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  private makeLpuSectionLabel(batchToken: string, seed: string, used: Set<string>): string {
    const year = String(batchToken).slice(-2).padStart(2, '0');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let idx = this.stringHash(seed) % (letters.length * letters.length);

    for (let tries = 0; tries < letters.length * letters.length; tries++) {
      const a = letters[Math.floor(idx / letters.length) % letters.length];
      const b = letters[idx % letters.length];
      const label = `${this.lpuDepartmentCode}${year}${a}${b}`;
      if (!used.has(label)) {
        used.add(label);
        return label;
      }
      idx = (idx + 1) % (letters.length * letters.length);
    }

    const fallback = `${this.lpuDepartmentCode}${year}ZZ`;
    used.add(fallback);
    return fallback;
  }

  private normalizeToken(value: string, fallback: string): string {
    return String(value || fallback)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/\//g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private buildGlobalTrack(student: any): string {
    const specialization = this.normalizeToken(student?.specialization_id, 'GENERAL');
    const minor = this.normalizeToken(student?.minor_id, 'GENERAL');
    const pathway = this.normalizeToken(student?.pathway_id, 'P0');
    // Keep specialization cohorts isolated from non-specialization cohorts.
    if (specialization !== 'GENERAL') return `SPEC-${specialization}-MINOR-${minor}-PATH-${pathway}`;
    return `NORMAL-MINOR-${minor}-PATH-${pathway}`;
  }

  private async getConstraints(): Promise<SolverConstraints> {
    if (!this.constraints) {
      this.constraints = await getSolverConstraints();
    }
    return this.constraints;
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
    // BTECH core grouping rule: same minor should stay together
    return `CORE-${batchToken}-SEM${semester}-MINOR-${minor}-PATH-${pathway}`;
  }

  private isForbiddenSlot(teacher: any, day: string, slot: string): boolean {
    const forbidden = Array.isArray(teacher?.forbidden_slots) ? teacher.forbidden_slots.map(String) : [];
    const full = `${day} ${slot}`;
    return forbidden.includes(full) || forbidden.includes(slot);
  }

  private getCompatibleRooms(section: Section): Room[] {
    return this.rooms
      .filter(r => {
        const roomType = String(r.type || '').toLowerCase();
        const isLabRoom = roomType.includes('lab');
        if (section.type === 'Lab' && !isLabRoom) return false;
        if (section.type === 'Lecture' && isLabRoom) return false;
        if (section.requiresByod && !r.isByodReady) return false;
        return r.capacity >= section.enrolledStudents.length;
      })
      .sort((a, b) => a.capacity - b.capacity);
  }

  private canUseTime(
    job: SessionJob,
    timeKey: string, // 'Day Slot'
    teacherOccupied: Set<string>,
    studentOccupied: Set<string>,
    day: string,
    slot: string,
    studentDailyLoad?: Map<string, number>,
    teacherDailyLoad?: Map<string, number>,
    studentLunchLoad?: Map<string, number>,
    teacherLunchLoad?: Map<string, number>,
    studentDailySlots?: Map<string, Set<number>>,
    ignoreForbidden = false
  ): boolean {
    if (!ignoreForbidden && this.isForbiddenSlot(job.teacher, day, slot)) return false;

    if (teacherOccupied.has(`${job.teacher.teacher_id}|${timeKey}`)) return false;

    for (const studentId of job.section.enrolledStudents) {
      if (studentOccupied.has(`${studentId}|${timeKey}`)) return false;
    }

    if (this.constraints) {
      const slotIndex = this.timeSlots.indexOf(slot);
      const isLunchSlot = this.constraints.lunchBreakSlots?.includes(slot);
      const totalLunchSlots = this.constraints.lunchBreakSlots?.length || 0;

      // Teacher daily limits
      const tDaily = teacherDailyLoad?.get(`${job.teacher.teacher_id}|${day}`) || 0;
      if (tDaily >= this.constraints.maxDailyTeacherHours) return false;

      // Teacher lunch limits
      if (this.constraints.mandatoryLunchBreak && isLunchSlot && totalLunchSlots > 0) {
        const tLunch = teacherLunchLoad?.get(`${job.teacher.teacher_id}|${day}`) || 0;
        if (tLunch + 1 >= totalLunchSlots) return false; // MUST leave at least 1 lunch slot free
      }

      for (const studentId of job.section.enrolledStudents) {
        // Student daily limits
        const sDaily = studentDailyLoad?.get(`${studentId}|${day}`) || 0;
        if (sDaily >= this.constraints.maxDailyStudentHours) return false;

        // Student lunch limits
        if (this.constraints.mandatoryLunchBreak && isLunchSlot && totalLunchSlots > 0) {
          const sLunch = studentLunchLoad?.get(`${studentId}|${day}`) || 0;
          if (sLunch + 1 >= totalLunchSlots) return false;
        }

        // Student Day Scholar Gap
        if (studentDailySlots && this.constraints.maxDayScholarGap > 0) {
          const slots = studentDailySlots.get(`${studentId}|${day}`);
          if (slots && slots.size > 0 && slotIndex !== -1) {
            let minSlot = slotIndex;
            let maxSlot = slotIndex;
            for (const s of slots) {
              if (s < minSlot) minSlot = s;
              if (s > maxSlot) maxSlot = s;
            }
            const span = maxSlot - minSlot + 1;
            const utilized = slots.size + 1;
            const gap = span - utilized;
            if (gap > this.constraints.maxDayScholarGap) return false;
          }
        }
      }
    }

    return true;
  }
  
  async loadData() {
    const constraints = await this.getConstraints();
    this.status.isSolving = true;
    this.status.progress = 0;
    this.status.message = 'Loading data from Supabase...';
    // 1. Fetch all required datasets (paginated; Supabase API row cap is 1000 per request)
    const [
      roomsData,
      facultyData,
      mappingData,
      coursesData,
      enrollmentsData,
      studentsData
    ] = await Promise.all([
      this.fetchAllRows('infrastructure', '*', 'room_id'),
      this.fetchAllRows('faculty', '*', 'teacher_id'),
      this.fetchAllRows('teacher_subjects', '*', 'teacher_id'),
      this.fetchAllRows('courses', '*', 'course_id'),
      this.fetchAllRows('student_enrollments', '*', 'student_id'),
      this.fetchAllRows('students', 'student_id, specialization_id, minor_id, pathway_id, is_byod', 'student_id')
    ]);

    this.rooms = (roomsData || []).map(r => ({
      id: r.room_id,
      building: r.block_id,
      capacity: r.capacity_lecture,
      type: r.room_type,
      isByodReady: r.is_byod_ready
    }));

    // 2. Faculty & mappings
    this.teachers = facultyData || [];
    this.teacherCourseMap = {};
    (mappingData || []).forEach(m => {
      if (!this.teacherCourseMap[m.course_id]) this.teacherCourseMap[m.course_id] = [];
      this.teacherCourseMap[m.course_id].push(m.teacher_id);
    });

    const studentsById: Record<string, any> = {};
    (studentsData || []).forEach(s => {
      studentsById[s.student_id] = s;
    });

    // 4. Build global student cohorts by semester + track + exact course-set
    // This gives "class sections" as a set of students with the same studied courses.
    const studentSemesterCourses = new Map<string, Set<string>>(); // student_id|SEMn -> course ids
    (enrollmentsData || []).forEach(e => {
      const semester = this.parseSemester(e.semester);
      const k = `${e.student_id}|SEM${semester}`;
      if (!studentSemesterCourses.has(k)) studentSemesterCourses.set(k, new Set<string>());
      studentSemesterCourses.get(k)!.add(String(e.course_id));
    });

    const studentSemesterCohort = new Map<string, string>(); // student_id|SEMn -> cohort id
    const trackCohortByStudentSemester = new Map<string, string>(); // anti-fragment fallback
    const cohortCounts = new Map<string, number>();
    for (const [studentSemesterKey, courses] of studentSemesterCourses.entries()) {
      const [studentId, semToken] = studentSemesterKey.split('|');
      const student = studentsById[studentId];
      const semester = Number(String(semToken).replace('SEM', '')) || 1;
      const batchToken = this.getBatchToken(studentId);
      const sortedCourses = Array.from(courses).sort();
      const track = this.buildGlobalTrack(student);
      const courseSignature = sortedCourses.join('|');
      const trackCohortId = `COHORT-${batchToken}-SEM${semester}-${track}`;
      const cohortId = constraints.cohortGranularity === 'track_only'
        ? trackCohortId
        : `${trackCohortId}-COURSES-${courseSignature}`;
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

    // 5. Group enrollments by course + semester + global cohort
    // Students with unique subjects naturally form additional small sections for those courses.
    const enrollmentGroups: Record<string, string[]> = {};
    const groupMeta: Record<string, { courseId: string; semester: number; groupingId: string; requiresByod: boolean }> = {};
    (enrollmentsData || []).forEach(e => {
      const student = studentsById[e.student_id];
      const semester = this.parseSemester(e.semester);
      const studentSemesterKey = `${e.student_id}|SEM${semester}`;
      const groupingId = studentSemesterCohort.get(studentSemesterKey) || `COHORT-${this.getBatchToken(e.student_id)}-SEM${semester}-FALLBACK`;
      const key = `${e.course_id}__SEM${semester}__${groupingId}`;

      if (!enrollmentGroups[key]) {
        enrollmentGroups[key] = [];
        groupMeta[key] = {
          courseId: e.course_id,
          semester,
          groupingId,
          requiresByod: false
        };
      }
      enrollmentGroups[key].push(e.student_id);
      if (student?.is_byod) groupMeta[key].requiresByod = true;
    });

    // 6. Build Sections using grouped cohorts
    const coursesById: Record<string, any> = {};
    (coursesData || []).forEach(c => {
      coursesById[c.course_id] = c;
    });

    const usedLpuSectionLabels = new Set<string>();
    const cohortChunkLabel = new Map<string, string>();

    this.sections = Object.keys(enrollmentGroups).flatMap((key) => {
      const meta = groupMeta[key];
      const course = coursesById[meta.courseId];
      if (!course) return [];

      const sectionType: 'Lecture' | 'Lab' = String(course.course_type || '').toLowerCase().includes('lab') ? 'Lab' : 'Lecture';
      const maxCapacity = sectionType === 'Lab' ? constraints.maxLabSectionSize : constraints.maxLectureSectionSize;
      const students = enrollmentGroups[key];
      const chunks: string[][] = [];
      for (let i = 0; i < students.length; i += maxCapacity) {
        chunks.push(students.slice(i, i + maxCapacity));
      }

      const sessions = Math.max(1, Number(course.credit_hours || 1));
      const batchToken = this.extractBatchTokenFromGroupingId(meta.groupingId);

      return chunks.map((chunk, idx) => {
        const cohortChunkKey = `${meta.groupingId}__P${idx + 1}`;
        let lpuLabel = cohortChunkLabel.get(cohortChunkKey);
        if (!lpuLabel) {
          lpuLabel = this.makeLpuSectionLabel(batchToken, cohortChunkKey, usedLpuSectionLabels);
          cohortChunkLabel.set(cohortChunkKey, lpuLabel);
        }
        // Keep internal id unique per course while preserving a global section label for UI/output.
        return {
          id: `${lpuLabel}-${meta.courseId}`,
          sectionName: lpuLabel,
          courseId: meta.courseId,
          type: sectionType,
          capacity: maxCapacity,
          enrolledStudents: chunk,
          sessionsPerWeek: sessions,
          semester: meta.semester,
          groupingId: meta.groupingId,
          requiresByod: meta.requiresByod
        };
      });
    });
  }

  async runSolver() {
    this.constraints = await getSolverConstraints();
    const constraints = await this.getConstraints();
    this.status.isSolving = true;
    this.status.progress = 5;
    this.status.message = 'Initialized Advanced Weekly Solver...';
    console.log(`Starting Advanced Weekly Solver...`);
    console.log(`- Sections: ${this.sections.length}`);
    console.log(`- Rooms: ${this.rooms.length}`);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const withSaturday = constraints.enableSaturdayMakeup ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : [...weekDays];
    const weekDayTimeKeys = weekDays.flatMap(day => this.timeSlots.map(slot => ({ day, slot, key: `${day} ${slot}` })));
    const withSaturdayTimeKeys = withSaturday.flatMap(day => this.timeSlots.map(slot => ({ day, slot, key: `${day} ${slot}` })));
    const maxTeacherSessionsPerWeek = constraints.maxTeacherSessionsPerWeek;
    const maxRoomCandidatesPerTime = constraints.maxRoomCandidatesPerTime;

    // Teacher assignment: prefer qualified teachers, but cap weekly teacher load.
    // If qualified pool is exhausted, use least-loaded faculty fallback to avoid unschedulable overflow.
    const teacherLoad = new Map<string, number>();
    const sectionTeacher = new Map<string, TeacherRef>();
    const sectionTeacherCandidates = new Map<string, TeacherRef[]>();
    const teacherById = new Map<string, any>(this.teachers.map(t => [t.teacher_id, t]));
    const toTeacherRef = (raw: any): TeacherRef => ({
      teacher_id: raw.teacher_id,
      name: raw.name || `Teacher-${raw.teacher_id}`,
      forbidden_slots: Array.isArray(raw.forbidden_slots) ? raw.forbidden_slots : []
    });
    const allTeacherRefs: TeacherRef[] = this.teachers
      .map(toTeacherRef)
      .filter((t, idx, arr) => arr.findIndex(x => x.teacher_id === t.teacher_id) === idx);
    const sectionsForTeacherAssignment = [...this.sections].sort((a, b) => b.sessionsPerWeek - a.sessionsPerWeek);
    for (const section of sectionsForTeacherAssignment) {
      const qualifiedTeacherIds = this.teacherCourseMap[section.courseId] || [];
      const qualifiedPool = qualifiedTeacherIds
        .map(id => teacherById.get(id))
        .filter(Boolean);
      const fallbackPool = this.teachers;
      if (qualifiedPool.length === 0 && fallbackPool.length === 0) continue;

      const chooseBest = (pool: any[], respectCapacity: boolean) => {
        return pool.reduce((acc: any, t: any) => {
          const load = teacherLoad.get(t.teacher_id) || 0;
          if (respectCapacity && load + section.sessionsPerWeek > maxTeacherSessionsPerWeek) return acc;
          if (!acc) return { t, load };
          return load < acc.load ? { t, load } : acc;
        }, null as any);
      };

      // Priority:
      // 1) qualified teacher within capacity
      // 2) any teacher within capacity
      // 3) qualified teacher even if overloaded
      // 4) any teacher even if overloaded
      const best =
        chooseBest(qualifiedPool, true) ||
        chooseBest(fallbackPool, true) ||
        chooseBest(qualifiedPool, false) ||
        chooseBest(fallbackPool, false);
      if (!best) continue;

      const teacher = toTeacherRef(best.t);
      teacherLoad.set(teacher.teacher_id, (teacherLoad.get(teacher.teacher_id) || 0) + section.sessionsPerWeek);
      sectionTeacher.set(section.id, teacher);

      const candidatePool = qualifiedPool.length > 0 ? qualifiedPool : fallbackPool;
      const candidateRefs = candidatePool
        .filter(Boolean)
        .map(toTeacherRef)
        .filter((t, idx, arr) => arr.findIndex(x => x.teacher_id === t.teacher_id) === idx);
      const orderedCandidates = candidateRefs.sort((a, b) => {
        if (a.teacher_id === teacher.teacher_id) return -1;
        if (b.teacher_id === teacher.teacher_id) return 1;
        return a.teacher_id.localeCompare(b.teacher_id);
      });
      sectionTeacherCandidates.set(section.id, orderedCandidates);
    }

    // Hardest-first section ordering
    const sectionDifficulty = (section: Section) => {
      const compatible = this.getCompatibleRooms(section).length;
      const scarcity = compatible > 0 ? Math.floor(200 / compatible) : 9999;
      return (section.sessionsPerWeek * section.enrolledStudents.length) + scarcity + (section.requiresByod ? 25 : 0) + (section.type === 'Lab' ? 15 : 0);
    };
    const sortedSections = [...this.sections].sort((a, b) => sectionDifficulty(b) - sectionDifficulty(a));

    // Expand into per-session jobs
    const jobs: SessionJob[] = [];
    let seq = 1;
    for (const section of sortedSections) {
      const teacher = sectionTeacher.get(section.id);
      if (!teacher) continue;
      const compatibleRooms = this.getCompatibleRooms(section);
      for (let i = 0; i < section.sessionsPerWeek; i++) {
        jobs.push({
          id: seq++,
          section,
          teacher,
          compatibleRooms
        });
      }
    }
    
    this.status.totalTasks = jobs.length;
    this.status.processedTasks = 0;
    this.status.message = `Scheduling ${jobs.length} sessions...`;

    const makeRng = (seed: number) => {
      let state = (seed >>> 0) || 1;
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    };

    const shuffledJobs = (input: SessionJob[], seed: number) => {
      const arr = [...input];
      const rand = makeRng(seed);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };

    const runAttempt = (attemptJobs: SessionJob[]) => {
      const roomOccupied = new Map<string, number>(); // room_id|day|slot -> jobId
      const teacherOccupied: Set<string> = new Set(); // teacher_id|day|slot
      const studentOccupied: Set<string> = new Set(); // student_id|day|slot
      const studentDailyLoad = new Map<string, number>();
      const teacherDailyLoad = new Map<string, number>();
      const studentLunchLoad = new Map<string, number>();
      const teacherLunchLoad = new Map<string, number>();
      const studentDailySlots = new Map<string, Set<number>>();

      const teacherJobAtTime = new Map<string, number>(); // teacher_id|day|slot -> jobId
      const studentJobsAtTime = new Map<string, Set<number>>(); // student_id|day|slot -> jobIds
      const scheduled = new Map<number, ScheduledSession>(); // jobId -> scheduled data
      const blockUsage = new Map<string, number>(); // building -> assignment count
      const jobsById = new Map<number, SessionJob>(attemptJobs.map(j => [j.id, j]));
      const teacherSessionLoad = new Map<string, number>(); // teacher_id -> placed sessions in this attempt

      const getTimeKeys = (days: string[]) => (days === weekDays ? weekDayTimeKeys : withSaturdayTimeKeys);
      const getOrderedTimeKeys = (job: SessionJob, days: string[]) => {
        const base = getTimeKeys(days);
        const compatibleLoadByTime = new Map<string, number>();
        for (const tk of base) {
          let load = 0;
          for (const room of job.compatibleRooms) {
            if (roomOccupied.has(`${room.id}|${tk.key}`)) load++;
          }
          compatibleLoadByTime.set(tk.key, load);
        }
        return [...base].sort((a, b) => {
          const aLoad = compatibleLoadByTime.get(a.key) || 0;
          const bLoad = compatibleLoadByTime.get(b.key) || 0;
          return aLoad - bLoad;
        });
      };

      const pickRoomCandidates = (compatibleRooms: Room[]): Room[] => {
        const limit = Math.max(1, maxRoomCandidatesPerTime);
        const compareRoom = (a: Room, b: Room) => {
          const aBlockLoad = blockUsage.get(a.building) || 0;
          const bBlockLoad = blockUsage.get(b.building) || 0;
          if (aBlockLoad !== bBlockLoad) return aBlockLoad - bBlockLoad;
          if (a.capacity !== b.capacity) return a.capacity - b.capacity;
          return a.id.localeCompare(b.id);
        };

        if (compatibleRooms.length <= limit) {
          return [...compatibleRooms].sort(compareRoom);
        }

        const best: Room[] = [];
        for (const room of compatibleRooms) {
          let i = 0;
          while (i < best.length && compareRoom(best[i], room) <= 0) i++;
          if (i >= limit) continue;
          best.splice(i, 0, room);
          if (best.length > limit) best.pop();
        }
        return best;
      };

      const pickRoomCandidatesForTime = (
        compatibleRooms: Room[],
        timeKey: string,
        includeOccupied: boolean
      ): Room[] => {
        const pool = includeOccupied
          ? compatibleRooms
          : compatibleRooms.filter(room => roomOccupied.get(`${room.id}|${timeKey}`) === undefined);
        return pickRoomCandidates(pool);
      };

      const reserve = (job: SessionJob, day: string, slot: string, room: Room) => {
        const timeKey = `${day} ${slot}`;
        const roomKey = `${room.id}|${timeKey}`;
        const teacherKey = `${job.teacher.teacher_id}|${timeKey}`;
        const slotIndex = this.timeSlots.indexOf(slot);
        const isLunch = constraints.lunchBreakSlots?.includes(slot);

        // Track usage
        roomOccupied.set(roomKey, job.id);
        teacherOccupied.add(teacherKey);
        teacherJobAtTime.set(teacherKey, job.id);
        
        const tDailyKey = `${job.teacher.teacher_id}|${day}`;
        teacherDailyLoad.set(tDailyKey, (teacherDailyLoad.get(tDailyKey) || 0) + 1);
        if (isLunch) teacherLunchLoad.set(tDailyKey, (teacherLunchLoad.get(tDailyKey) || 0) + 1);

        for (const sid of job.section.enrolledStudents) {
          studentOccupied.add(`${sid}|${timeKey}`);
          const sDailyKey = `${sid}|${day}`;
          studentDailyLoad.set(sDailyKey, (studentDailyLoad.get(sDailyKey) || 0) + 1);
          if (isLunch) studentLunchLoad.set(sDailyKey, (studentLunchLoad.get(sDailyKey) || 0) + 1);
          
          if (!studentDailySlots.has(sDailyKey)) studentDailySlots.set(sDailyKey, new Set());
          if (slotIndex !== -1) studentDailySlots.get(sDailyKey)!.add(slotIndex);

          let sJobs = studentJobsAtTime.get(`${sid}|${timeKey}`);
          if (!sJobs) {
            sJobs = new Set();
            studentJobsAtTime.set(`${sid}|${timeKey}`, sJobs);
          }
          sJobs.add(job.id);
        }
        blockUsage.set(room.building, (blockUsage.get(room.building) || 0) + 1);
        scheduled.set(job.id, { job, day, slot, room });
        teacherSessionLoad.set(job.teacher.teacher_id, (teacherSessionLoad.get(job.teacher.teacher_id) || 0) + 1);
        
        this.status.processedTasks++;
        this.status.progress = Math.round(5 + (this.status.processedTasks / this.status.totalTasks) * 90);
        if (this.status.processedTasks % 100 === 0) {
            this.status.message = `Scheduled ${this.status.processedTasks} / ${this.status.totalTasks} sessions...`;
        }
      };

      // Safe reserve: validates ALL constraints before placing. Returns false if any conflict.
      const safeReserve = (job: SessionJob, day: string, slot: string, room: Room): boolean => {
        const timeKey = `${day} ${slot}`;
        
        if (!this.canUseTime(job, timeKey, teacherOccupied, studentOccupied, day, slot, studentDailyLoad, teacherDailyLoad, studentLunchLoad, teacherLunchLoad, studentDailySlots, true)) return false;

        reserve(job, day, slot, room);
        return true;
      };

      const unreserve = (job: SessionJob) => {
        const current = scheduled.get(job.id);
        if (!current) return;
        const timeKey = `${current.day} ${current.slot}`;
        const roomKey = `${current.room.id}|${timeKey}`;
        const teacherKey = `${job.teacher.teacher_id}|${timeKey}`;
        const slotIndex = this.timeSlots.indexOf(current.slot);
        const isLunch = constraints.lunchBreakSlots?.includes(current.slot);

        roomOccupied.delete(roomKey);
        teacherOccupied.delete(teacherKey);
        teacherJobAtTime.delete(teacherKey);

        const tDailyKey = `${job.teacher.teacher_id}|${current.day}`;
        const tDailyCount = teacherDailyLoad.get(tDailyKey) || 0;
        if (tDailyCount <= 1) teacherDailyLoad.delete(tDailyKey);
        else teacherDailyLoad.set(tDailyKey, tDailyCount - 1);

        if (isLunch) {
          const tlCount = teacherLunchLoad.get(tDailyKey) || 0;
          if (tlCount <= 1) teacherLunchLoad.delete(tDailyKey);
          else teacherLunchLoad.set(tDailyKey, tlCount - 1);
        }

        for (const sid of job.section.enrolledStudents) {
          const studentKey = `${sid}|${timeKey}`;
          const sDailyKey = `${sid}|${current.day}`;
          
          const sCount = studentDailyLoad.get(sDailyKey) || 0;
          if (sCount <= 1) studentDailyLoad.delete(sDailyKey);
          else studentDailyLoad.set(sDailyKey, sCount - 1);

          if (isLunch) {
            const slCount = studentLunchLoad.get(sDailyKey) || 0;
            if (slCount <= 1) studentLunchLoad.delete(sDailyKey);
            else studentLunchLoad.set(sDailyKey, slCount - 1);
          }

          if (slotIndex !== -1) {
            const slots = studentDailySlots.get(sDailyKey);
            if (slots) slots.delete(slotIndex);
          }

          const sJobs = studentJobsAtTime.get(studentKey);
          if (sJobs) {
            sJobs.delete(job.id);
            if (sJobs.size === 0) {
              studentJobsAtTime.delete(studentKey);
              studentOccupied.delete(studentKey);
            }
          }
        }
        const currentCount = blockUsage.get(current.room.building) || 0;
        if (currentCount <= 1) blockUsage.delete(current.room.building);
        else blockUsage.set(current.room.building, currentCount - 1);
        scheduled.delete(job.id);
        const tCount = teacherSessionLoad.get(job.teacher.teacher_id) || 0;
        if (tCount <= 1) teacherSessionLoad.delete(job.teacher.teacher_id);
        else teacherSessionLoad.set(job.teacher.teacher_id, tCount - 1);
      };

      const tryPlaceWithConflictRelocation = (baseJob: SessionJob, teacherCandidates: TeacherRef[]): boolean => {
        const prioritizedTeachers = teacherCandidates.length > 0 ? teacherCandidates : [baseJob.teacher];
        const daySlots = withSaturdayTimeKeys;

        for (const teacher of prioritizedTeachers) {
          const candidateJob: SessionJob = { ...baseJob, teacher };

          for (const tk of daySlots) {
            const roomsForTime = pickRoomCandidatesForTime(candidateJob.compatibleRooms, tk.key, true);

            for (const room of roomsForTime) {
              const blockerIds = new Set<number>();
              const roomKey = `${room.id}|${tk.key}`;
              const roomBlocker = roomOccupied.get(roomKey);
              if (roomBlocker !== undefined) blockerIds.add(roomBlocker);

              const teacherKey = `${candidateJob.teacher.teacher_id}|${tk.key}`;
              const teacherBlocker = teacherJobAtTime.get(teacherKey);
              if (teacherBlocker !== undefined) blockerIds.add(teacherBlocker);

              for (const sid of candidateJob.section.enrolledStudents) {
                const jobs = studentJobsAtTime.get(`${sid}|${tk.key}`);
                if (!jobs) continue;
                for (const jid of jobs) blockerIds.add(jid);
                if (blockerIds.size > constraints.maxRelocationBlockers) break;
              }

              if (blockerIds.size > constraints.maxRelocationBlockers) continue; // bounded local repair only

              const snapshots: ScheduledSession[] = [];
              for (const blockerId of blockerIds) {
                const snap = scheduled.get(blockerId);
                if (snap) snapshots.push(snap);
              }

              for (const snap of snapshots) {
                unreserve(snap.job);
              }

              const relocated: SessionJob[] = [];
              let relocatedAll = true;
              for (const snap of snapshots) {
                const blockerJob = jobsById.get(snap.job.id) || snap.job;
                const moved = tryPlace(blockerJob, withSaturday, true, true);
                if (!moved) {
                  relocatedAll = false;
                  break;
                }
                relocated.push(blockerJob);
              }

              const canPlaceCandidate = relocatedAll && this.canUseTime(
                candidateJob,
                tk.key,
                teacherOccupied,
                studentOccupied,
                tk.day,
                tk.slot,
                studentDailyLoad,
                teacherDailyLoad,
                studentLunchLoad,
                teacherLunchLoad,
                studentDailySlots,
                true
              ) && (
                !constraints.enforceTeacherLoadInRepair ||
                (teacherSessionLoad.get(candidateJob.teacher.teacher_id) || 0) < maxTeacherSessionsPerWeek
              ) && roomOccupied.get(roomKey) === undefined;

              if (canPlaceCandidate) {
                if (!safeReserve(candidateJob, tk.day, tk.slot, room)) {
                  // safeReserve rejected — restore all relocated blockers
                  for (const placed of relocated) {
                    const placedSnap = scheduled.get(placed.id);
                    if (placedSnap) unreserve(placedSnap.job);
                  }
                  for (const snap of snapshots) {
                    reserve(snap.job, snap.day, snap.slot, snap.room);
                  }
                  continue;
                }
                return true;
              }

              const candidateSnapshot = scheduled.get(candidateJob.id);
              if (candidateSnapshot) unreserve(candidateSnapshot.job);
              for (const placed of relocated) {
                const placedSnap = scheduled.get(placed.id);
                if (placedSnap) unreserve(placedSnap.job);
              }
              for (const snap of snapshots) {
                reserve(snap.job, snap.day, snap.slot, snap.room);
              }
            }
          }
        }

        return false;
      };

      const buildEmergencyTeacherCandidates = (job: SessionJob): TeacherRef[] => {
        const preferred = sectionTeacherCandidates.get(job.section.id) || [];
        const qualified = (this.teacherCourseMap[job.section.courseId] || [])
          .map(id => teacherById.get(id))
          .filter(Boolean)
          .map(toTeacherRef);

        const pool = [
          ...preferred,
          ...qualified,
          ...allTeacherRefs
        ];

        return pool.filter((t, idx, arr) => arr.findIndex(x => x.teacher_id === t.teacher_id) === idx);
      };

      const tryPlaceWithFlexibleTeacher = (baseJob: SessionJob): boolean => {
        const teacherCandidates = buildEmergencyTeacherCandidates(baseJob);

        for (const tk of withSaturdayTimeKeys) {
          // Check student conflict — if ANY enrolled student is busy, skip this slot
          let studentConflict = false;
          for (const sid of baseJob.section.enrolledStudents) {
            if (studentOccupied.has(`${sid}|${tk.key}`)) {
              studentConflict = true;
              break;
            }
          }
          if (studentConflict) continue;

          // Get only genuinely free rooms (excludeOccupied = false)
          const roomsForTime = pickRoomCandidatesForTime(baseJob.compatibleRooms, tk.key, false);
          if (roomsForTime.length === 0) continue;

          for (const teacher of teacherCandidates) {
            const teacherKey = `${teacher.teacher_id}|${tk.key}`;
            if (teacherOccupied.has(teacherKey)) continue;

            // Double-check the room is truly free before reserving
            const roomKey = `${roomsForTime[0].id}|${tk.key}`;
            if (roomOccupied.has(roomKey)) continue;

            const candidateJob: SessionJob = { ...baseJob, teacher };
            if (!safeReserve(candidateJob, tk.day, tk.slot, roomsForTime[0])) continue;
            return true;
          }
        }

        return false;
      };

      const tryPlace = (job: SessionJob, days: string[], allowSwap: boolean, ignoreForbidden = false): boolean => {
        // choose least-loaded time keys first to balance timetable
        const timeKeys = getOrderedTimeKeys(job, days);

        for (const tk of timeKeys) {
          if (!this.canUseTime(job, tk.key, teacherOccupied, studentOccupied, tk.day, tk.slot, studentDailyLoad, teacherDailyLoad, studentLunchLoad, teacherLunchLoad, studentDailySlots, ignoreForbidden)) continue;
          if (constraints.enforceTeacherLoadInRepair) {
            const tCount = teacherSessionLoad.get(job.teacher.teacher_id) || 0;
            if (tCount >= maxTeacherSessionsPerWeek) continue;
          }

          const roomsForTime = pickRoomCandidatesForTime(job.compatibleRooms, tk.key, allowSwap);

          for (const room of roomsForTime) {
            const roomKey = `${room.id}|${tk.key}`;
            const blockerId = roomOccupied.get(roomKey);
            if (blockerId === undefined) {
              if (!safeReserve(job, tk.day, tk.slot, room)) continue;
              return true;
            }

            if (!allowSwap) continue;
            const blocker = scheduled.get(blockerId);
            if (!blocker) continue;

            // One-level relocation: move blocker elsewhere, then place current job
            const blockerJob = blocker.job;
            unreserve(blockerJob);
            const moved = tryPlace(blockerJob, withSaturday, false, ignoreForbidden);
            if (moved) {
              if (safeReserve(job, tk.day, tk.slot, room)) return true;
              // safeReserve failed — undo the blocker's move and restore it
              const movedSnap = scheduled.get(blockerJob.id);
              if (movedSnap) unreserve(movedSnap.job);
              reserve(blockerJob, blocker.day, blocker.slot, blocker.room);
              continue;
            }
            // rollback blocker
            reserve(blockerJob, blocker.day, blocker.slot, blocker.room);
          }
        }
        return false;
      };

      let conflictsAvoided = 0;
      const unresolved: SessionJob[] = [];

      // Pass 1: Weekdays only
      for (const job of attemptJobs) {
        const ok = tryPlace(job, weekDays, false);
        if (!ok) {
          unresolved.push(job);
          conflictsAvoided++;
        }
      }

      // Pass 2: allow Saturday as makeup
      const unresolvedAfterSaturday: SessionJob[] = [];
      for (const job of unresolved) {
        const ok = tryPlace(job, withSaturday, false);
        if (!ok) {
          unresolvedAfterSaturday.push(job);
          conflictsAvoided++;
        }
      }

      // Pass 3: one-step relocation/backtracking with Saturday
      const unresolvedFinal: SessionJob[] = [];
      for (const job of unresolvedAfterSaturday) {
        const ok = tryPlace(job, withSaturday, false);
        if (!ok) unresolvedFinal.push(job);
      }

      // Pass 4 (soft): treat forbidden slots as preferences for remaining unresolved jobs
      const unresolvedAfterSoftPass: SessionJob[] = [];
      for (const job of unresolvedFinal) {
        const ok = constraints.allowForbiddenSlotSoftening
          ? tryPlace(job, withSaturday, false, true)
          : false;
        if (!ok) unresolvedAfterSoftPass.push(job);
      }

      const skipExpensiveRepairPasses = true;
      let unresolvedAfterRelocation: SessionJob[] = [...unresolvedAfterSoftPass];

      if (!skipExpensiveRepairPasses) {
        // Pass 5: if a section is still unresolved, try reassigning that whole section
        // to other compatible teachers and re-place all its sessions.
        const unresolvedBySection = new Map<string, SessionJob[]>();
        for (const job of unresolvedAfterSoftPass) {
          const sid = job.section.id;
          if (!unresolvedBySection.has(sid)) unresolvedBySection.set(sid, []);
          unresolvedBySection.get(sid)!.push(job);
        }

        const sectionJobs = new Map<string, SessionJob[]>();
        for (const job of attemptJobs) {
          const sid = job.section.id;
          if (!sectionJobs.has(sid)) sectionJobs.set(sid, []);
          sectionJobs.get(sid)!.push(job);
        }

        const unresolvedAfterTeacherSwitch: SessionJob[] = [];
        let switchedSectionCount = 0;
        for (const [sectionId, failedJobs] of unresolvedBySection.entries()) {
          if (switchedSectionCount >= constraints.maxRepairSectionsPerAttempt) {
            unresolvedAfterTeacherSwitch.push(...failedJobs);
            continue;
          }
          switchedSectionCount++;
          const jobsOfSection = sectionJobs.get(sectionId) || [];
          const originalTeacherId = jobsOfSection[0]?.teacher.teacher_id;
          const candidates = (sectionTeacherCandidates.get(sectionId) || []).filter(t => t.teacher_id !== originalTeacherId);

          if (jobsOfSection.length === 0 || candidates.length === 0) {
            unresolvedAfterTeacherSwitch.push(...failedJobs);
            continue;
          }

          const scheduledSnapshots = jobsOfSection
            .map(j => scheduled.get(j.id))
            .filter((x): x is ScheduledSession => Boolean(x));

          // Remove any currently placed sessions for this section before trying a new teacher.
          for (const snapshot of scheduledSnapshots) {
            unreserve(snapshot.job);
          }

          const failedIds = new Set<number>(failedJobs.map(j => j.id));
          const orderedSectionJobs = [...jobsOfSection].sort((a, b) => {
            const aFailed = failedIds.has(a.id) ? 0 : 1;
            const bFailed = failedIds.has(b.id) ? 0 : 1;
            if (aFailed !== bFailed) return aFailed - bFailed;
            return a.id - b.id;
          });

          let reassigned = false;
          for (const candidate of candidates) {
            const newlyPlaced: SessionJob[] = [];
            let ok = true;

            for (const originalJob of orderedSectionJobs) {
              const candidateJob: SessionJob = {
                ...originalJob,
                teacher: candidate
              };
              const placed = tryPlace(candidateJob, withSaturday, true, true);
              if (!placed) {
                ok = false;
                break;
              }
              newlyPlaced.push(candidateJob);
            }

            if (ok) {
              reassigned = true;
              break;
            }

            // Rollback this candidate attempt.
            for (const placedJob of newlyPlaced) {
              unreserve(placedJob);
            }
          }

          if (!reassigned) {
            // Restore original placements if reassignment fails.
            for (const snapshot of scheduledSnapshots) {
              reserve(snapshot.job, snapshot.day, snapshot.slot, snapshot.room);
            }
            unresolvedAfterTeacherSwitch.push(...failedJobs);
          }
        }

        // Pass 6: bounded local repair by relocating conflicting sessions.
        unresolvedAfterRelocation = [];
        const unresolvedBySectionAfterSwitch = new Map<string, SessionJob[]>();
        for (const job of unresolvedAfterTeacherSwitch) {
          const sid = job.section.id;
          if (!unresolvedBySectionAfterSwitch.has(sid)) unresolvedBySectionAfterSwitch.set(sid, []);
          unresolvedBySectionAfterSwitch.get(sid)!.push(job);
        }
        let repairedSectionCount = 0;
        for (const [sid, jobsOfSection] of unresolvedBySectionAfterSwitch.entries()) {
          if (repairedSectionCount >= constraints.maxRepairSectionsPerAttempt) {
            unresolvedAfterRelocation.push(...jobsOfSection);
            continue;
          }
          repairedSectionCount++;
          const teacherCandidates = (sectionTeacherCandidates.get(sid) || []).slice(0, 6);
          let repairedAll = true;
          for (const job of jobsOfSection) {
            const repaired = tryPlaceWithConflictRelocation(job, teacherCandidates);
            if (!repaired) {
              repairedAll = false;
              break;
            }
          }
          if (!repairedAll) unresolvedAfterRelocation.push(...jobsOfSection);
        }
      }

      const unresolvedFinalGuaranteed: SessionJob[] = [];
      for (const job of unresolvedAfterRelocation) {
        const placed = tryPlaceWithFlexibleTeacher(job);
        if (!placed) unresolvedFinalGuaranteed.push(job);
      }

      return {
        scheduled,
        unresolved: unresolvedFinalGuaranteed,
        conflictsAvoided
      };
    };

    const attempts = 1;
    let best = runAttempt(jobs);
    for (let i = 1; i < attempts; i++) {
      const attempt = runAttempt(shuffledJobs(jobs, 101 + i * 9973));
      if (attempt.scheduled.size > best.scheduled.size) best = attempt;
      if (best.unresolved.length === 0) break;
    }

    for (const missed of best.unresolved) {
      console.warn(`⚠️ Failed to place session for section ${missed.section.id}`);
    }

    const assignments: Assignment[] = Array.from(best.scheduled.values()).map(({ job, day, slot, room }) => ({
      course_code: job.section.courseId,
      section_name: job.section.sectionName,
      time_slot: `${day} ${slot}`,
      room_id: room.id,
      instructor_name: job.teacher.name || 'Staff',
      student_ids: job.section.enrolledStudents
    }));

    const totalSessionsPlaced = assignments.length;
    console.log(`✅ Solver Finished.`);
    console.log(`- Sessions Placed: ${totalSessionsPlaced}`);
    console.log(`- Unplaced Sessions: ${best.unresolved.length}`);
    console.log(`- Conflicts Avoided: ${best.conflictsAvoided}`);

    // Persist Results
    // Use a column that exists (room_id) and a filter that matches all (not equal to 'FORCE_CLEAR')
    console.log('Finalizing: Persisting assignments to Database...');
    const { error: delError } = await supabase.from('master_timetable').delete().neq('room_id', 'FORCE_CLEAR');
    if (delError) console.error('Delete error:', delError);
    
    // Batch Insert (Chunked for Supabase limits)
    for (let i = 0; i < assignments.length; i += 500) {
      const chunk = assignments.slice(i, i + 500);
      const { error } = await supabase.from('master_timetable').insert(chunk);
      if (error) {
        console.error('Persistence error during insert:', error);
      } else {
        console.log(`Inserted batch of ${chunk.length} assignments.`);
      }
    }
    
    this.status.isSolving = false;
    this.status.progress = 100;
    this.status.message = 'Solver Completed Successfully!';
    return totalSessionsPlaced;
  }
}
