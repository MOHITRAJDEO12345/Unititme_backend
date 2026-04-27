import fs from 'fs/promises';
import path from 'path';

export type CohortGranularity = 'exact_course_set' | 'track_only';

export interface SolverConstraints {
  zeroBufferTransit: boolean;
  byodIsolation: boolean;
  buildingAffinityMode: 'batch' | 'department' | 'random';
  strictTeacherQualification: boolean;
  allowUnqualifiedTeacherFallback: boolean;
  maxLectureSectionSize: number;
  maxLabSectionSize: number;
  enableSaturdayMakeup: boolean;
  maxTeacherSessionsPerWeek: number;
  enforceTeacherLoadInRepair: boolean;
  maxRelocationBlockers: number;
  maxRoomCandidatesPerTime: number;
  maxRepairSectionsPerAttempt: number;
  allowForbiddenSlotSoftening: boolean;
  cohortGranularity: CohortGranularity;
  minCourseSetCohortSize: number;
  maxDailyStudentHours: number;
  maxDailyTeacherHours: number;
  mandatoryLunchBreak: boolean;
  lunchBreakSlots: string[];
  maxDayScholarGap: number;
}

const DEFAULT_CONSTRAINTS: SolverConstraints = {
  zeroBufferTransit: true,
  byodIsolation: true,
  buildingAffinityMode: 'batch',
  strictTeacherQualification: true,
  allowUnqualifiedTeacherFallback: false,
  maxLectureSectionSize: 71,
  maxLabSectionSize: 30,
  enableSaturdayMakeup: true,
  maxTeacherSessionsPerWeek: 48,
  enforceTeacherLoadInRepair: true,
  maxRelocationBlockers: 6,
  maxRoomCandidatesPerTime: 24,
  maxRepairSectionsPerAttempt: 25,
  allowForbiddenSlotSoftening: true,
  cohortGranularity: 'exact_course_set',
  minCourseSetCohortSize: 1,
  maxDailyStudentHours: 6,
  maxDailyTeacherHours: 6,
  mandatoryLunchBreak: true,
  lunchBreakSlots: ['12:00 PM - 12:50 PM', '01:10 PM - 02:00 PM', '02:10 PM - 03:00 PM'],
  maxDayScholarGap: 3
};

const CONSTRAINTS_PATH = path.resolve(__dirname, '../../data/solver_constraints.json');

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function sanitizeConstraints(input: Partial<SolverConstraints>): SolverConstraints {
  const strictTeacherQualification = asBool(
    input.strictTeacherQualification,
    DEFAULT_CONSTRAINTS.strictTeacherQualification
  );
  const allowUnqualifiedTeacherFallback = strictTeacherQualification
    ? false
    : asBool(input.allowUnqualifiedTeacherFallback, DEFAULT_CONSTRAINTS.allowUnqualifiedTeacherFallback);

  const cohortGranularity: CohortGranularity =
    input.cohortGranularity === 'track_only' || input.cohortGranularity === 'exact_course_set'
      ? input.cohortGranularity
      : DEFAULT_CONSTRAINTS.cohortGranularity;

  const buildingAffinityMode =
    input.buildingAffinityMode === 'department' ||
    input.buildingAffinityMode === 'random' ||
    input.buildingAffinityMode === 'batch'
      ? input.buildingAffinityMode
      : DEFAULT_CONSTRAINTS.buildingAffinityMode;

  return {
    zeroBufferTransit: asBool(input.zeroBufferTransit, DEFAULT_CONSTRAINTS.zeroBufferTransit),
    byodIsolation: asBool(input.byodIsolation, DEFAULT_CONSTRAINTS.byodIsolation),
    buildingAffinityMode,
    strictTeacherQualification,
    allowUnqualifiedTeacherFallback,
    maxLectureSectionSize: clampInt(input.maxLectureSectionSize, DEFAULT_CONSTRAINTS.maxLectureSectionSize, 10, 300),
    maxLabSectionSize: clampInt(input.maxLabSectionSize, DEFAULT_CONSTRAINTS.maxLabSectionSize, 10, 120),
    enableSaturdayMakeup: asBool(input.enableSaturdayMakeup, DEFAULT_CONSTRAINTS.enableSaturdayMakeup),
    maxTeacherSessionsPerWeek: clampInt(input.maxTeacherSessionsPerWeek, DEFAULT_CONSTRAINTS.maxTeacherSessionsPerWeek, 8, 72),
    enforceTeacherLoadInRepair: asBool(input.enforceTeacherLoadInRepair, DEFAULT_CONSTRAINTS.enforceTeacherLoadInRepair),
    maxRelocationBlockers: clampInt(input.maxRelocationBlockers, DEFAULT_CONSTRAINTS.maxRelocationBlockers, 1, 20),
    maxRoomCandidatesPerTime: clampInt(input.maxRoomCandidatesPerTime, DEFAULT_CONSTRAINTS.maxRoomCandidatesPerTime, 5, 200),
    maxRepairSectionsPerAttempt: clampInt(input.maxRepairSectionsPerAttempt, DEFAULT_CONSTRAINTS.maxRepairSectionsPerAttempt, 1, 200),
    allowForbiddenSlotSoftening: asBool(input.allowForbiddenSlotSoftening, DEFAULT_CONSTRAINTS.allowForbiddenSlotSoftening),
    cohortGranularity,
    minCourseSetCohortSize: clampInt(input.minCourseSetCohortSize, DEFAULT_CONSTRAINTS.minCourseSetCohortSize, 1, 100),
    maxDailyStudentHours: clampInt(input.maxDailyStudentHours, DEFAULT_CONSTRAINTS.maxDailyStudentHours, 1, 10),
    maxDailyTeacherHours: clampInt(input.maxDailyTeacherHours, DEFAULT_CONSTRAINTS.maxDailyTeacherHours, 1, 10),
    mandatoryLunchBreak: asBool(input.mandatoryLunchBreak, DEFAULT_CONSTRAINTS.mandatoryLunchBreak),
    lunchBreakSlots: Array.isArray(input.lunchBreakSlots) ? input.lunchBreakSlots.map(String) : DEFAULT_CONSTRAINTS.lunchBreakSlots,
    maxDayScholarGap: clampInt(input.maxDayScholarGap, DEFAULT_CONSTRAINTS.maxDayScholarGap, 0, 10)
  };
}

async function readStoredConstraints(): Promise<Partial<SolverConstraints>> {
  try {
    const raw = await fs.readFile(CONSTRAINTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConstraintsFile(constraints: SolverConstraints): Promise<void> {
  await fs.mkdir(path.dirname(CONSTRAINTS_PATH), { recursive: true });
  await fs.writeFile(CONSTRAINTS_PATH, JSON.stringify(constraints, null, 2), 'utf8');
}

export async function getSolverConstraints(): Promise<SolverConstraints> {
  const stored = await readStoredConstraints();
  const merged = sanitizeConstraints({ ...DEFAULT_CONSTRAINTS, ...stored });
  return merged;
}

export async function saveSolverConstraints(
  updates: Partial<SolverConstraints>
): Promise<SolverConstraints> {
  const current = await getSolverConstraints();
  const merged = sanitizeConstraints({ ...current, ...updates });
  await writeConstraintsFile(merged);
  return merged;
}
