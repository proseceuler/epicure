import type { Assessment, SubjectKey, ComponentType, ExType } from './types';
import { SUBJECT_MAP, EX_BREAKDOWN, NUM_TERMS, SUBJECTS } from './types';

export const PASSING = 75;
export const DEFAULT_TARGET = 90;

export function componentPercentage(assessments: Assessment[], component: ComponentType, exType?: ExType): number {
  const filtered = exType
    ? assessments.filter((a) => a.component === component && a.ex_type === exType)
    : assessments.filter((a) => a.component === component);

  const totalScore = filtered.reduce((sum, a) => sum + Number(a.score), 0);
  const totalMax = filtered.reduce((sum, a) => sum + Number(a.max_score), 0);
  if (totalMax === 0) return 0;
  return (totalScore / totalMax) * 100;
}

export function exComponentPercentage(assessments: Assessment[], exType: ExType): number {
  const filtered = assessments.filter((a) => a.component === 'ex' && a.ex_type === exType);
  const totalScore = filtered.reduce((sum, a) => sum + Number(a.score), 0);
  const totalMax = filtered.reduce((sum, a) => sum + Number(a.max_score), 0);
  if (totalMax === 0) return 0;
  return (totalScore / totalMax) * 100;
}

export function computeTermGrade(subjectKey: SubjectKey, term: number, assessments: Assessment[]): number | null {
  const subject = SUBJECT_MAP[subjectKey];
  const tAssessments = assessments.filter((a) => a.subject_key === subjectKey && a.quarter === term);
  if (tAssessments.length === 0) return null;

  const wwPct = componentPercentage(tAssessments, 'ww');
  const ptPct = componentPercentage(tAssessments, 'pt');

  const st1Pct = exComponentPercentage(tAssessments, 'st1');
  const st2Pct = exComponentPercentage(tAssessments, 'st2');
  const tePct = exComponentPercentage(tAssessments, 'te');

  const hasEx = tAssessments.some((a) => a.component === 'ex');
  let exPct = 0;
  if (hasEx) {
    const st1Weighted = st1Pct * (EX_BREAKDOWN.st1 / 100);
    const st2Weighted = st2Pct * (EX_BREAKDOWN.st2 / 100);
    const teWeighted = tePct * (EX_BREAKDOWN.te / 100);
    exPct = st1Weighted + st2Weighted + teWeighted;
  }

  const hasWw = tAssessments.some((a) => a.component === 'ww');
  const hasPt = tAssessments.some((a) => a.component === 'pt');

  if (!hasWw && !hasPt && !hasEx) return null;

  const initialGrade =
    (hasWw ? (wwPct * subject.weights.ww) / 100 : 0) +
    (hasPt ? (ptPct * subject.weights.pt) / 100 : 0) +
    (hasEx ? (exPct * subject.weights.ex) / 100 : 0);

  return transmuteGrade(initialGrade);
}

export function transmuteGrade(initialGrade: number): number {
  if (initialGrade >= 96) return 100;
  if (initialGrade >= 90) return 97 + (initialGrade - 90) * 0.5;
  if (initialGrade >= 84) return 91 + (initialGrade - 84) * 1;
  if (initialGrade >= 78) return 85 + (initialGrade - 78) * 1;
  if (initialGrade >= 72) return 79 + (initialGrade - 72) * 1;
  if (initialGrade >= 66) return 73 + (initialGrade - 66) * 0.33;
  if (initialGrade >= 60) return 70 + (initialGrade - 60) * 0.5;
  return 60;
}

/** Smallest initial (pre-transmute) grade that maps to `target` after transmute. */
export function initialForTarget(target: number): number {
  if (target >= 100) return 96;
  if (target >= 97) return 90 + (target - 97) / 0.5;
  if (target >= 91) return 84 + (target - 91);
  if (target >= 85) return 78 + (target - 85);
  if (target >= 79) return 72 + (target - 79);
  if (target >= 73) return 66 + (target - 73) / 0.33;
  if (target >= 70) return 60 + (target - 70) / 0.5;
  return 0;
}

export type NeededOnRemaining = {
  alreadyMet: boolean;
  possible: boolean;
  needed: number | null;
  on: string;
  target: number;
  message: string;
};

type Slot = {
  key: string;
  label: string;
  /** How many initial-grade points 100% on this slot is worth. */
  weight: number;
  filled: boolean;
  pct: number;
};

function termSlots(subjectKey: SubjectKey, term: number, assessments: Assessment[]): Slot[] {
  const subject = SUBJECT_MAP[subjectKey];
  const items = assessments.filter((a) => a.subject_key === subjectKey && a.quarter === term);
  const exW = subject.weights.ex / 100;
  return [
    {
      key: 'te',
      label: 'Term Exam',
      weight: (EX_BREAKDOWN.te / 100) * exW,
      filled: items.some((a) => a.component === 'ex' && a.ex_type === 'te'),
      pct: exComponentPercentage(items, 'te'),
    },
    {
      key: 'st2',
      label: 'Summative Test 2',
      weight: (EX_BREAKDOWN.st2 / 100) * exW,
      filled: items.some((a) => a.component === 'ex' && a.ex_type === 'st2'),
      pct: exComponentPercentage(items, 'st2'),
    },
    {
      key: 'st1',
      label: 'Summative Test 1',
      weight: (EX_BREAKDOWN.st1 / 100) * exW,
      filled: items.some((a) => a.component === 'ex' && a.ex_type === 'st1'),
      pct: exComponentPercentage(items, 'st1'),
    },
    {
      key: 'ww',
      label: 'Written Works',
      weight: subject.weights.ww / 100,
      filled: items.some((a) => a.component === 'ww'),
      pct: componentPercentage(items, 'ww'),
    },
    {
      key: 'pt',
      label: 'Performance Tasks',
      weight: subject.weights.pt / 100,
      filled: items.some((a) => a.component === 'pt'),
      pct: componentPercentage(items, 'pt'),
    },
  ];
}

/**
 * What score is needed on the next empty bucket (Term Exam first) to hit `target`
 * after DepEd transmute. Falls back to an average across remaining weight.
 */
export function neededOnRemaining(
  subjectKey: SubjectKey,
  term: number,
  assessments: Assessment[],
  target = DEFAULT_TARGET,
): NeededOnRemaining {
  const want = initialForTarget(target);
  const slots = termSlots(subjectKey, term, assessments);
  const current = slots.reduce((sum, s) => sum + (s.filled ? s.pct * s.weight : 0), 0);
  const currentTransmuted = transmuteGrade(current);

  if (slots.every((s) => s.filled)) {
    if (currentTransmuted >= target) {
      return {
        alreadyMet: true,
        possible: true,
        needed: null,
        on: '',
        target,
        message: `Already at ${currentTransmuted.toFixed(1)} — target ${target} is met.`,
      };
    }
    return {
      alreadyMet: false,
      possible: false,
      needed: null,
      on: '',
      target,
      message: `All items are in. Sitting at ${currentTransmuted.toFixed(1)}; ${target} needs a higher recorded score.`,
    };
  }

  const empty = slots.filter((s) => !s.filled);
  const remainingWeight = empty.reduce((sum, s) => sum + s.weight, 0);
  const gap = want - current;

  if (gap <= 0) {
    return {
      alreadyMet: true,
      possible: true,
      needed: 0,
      on: empty[0]?.label ?? '',
      target,
      message: `Already on track for ${target} even before remaining items.`,
    };
  }

  if (remainingWeight <= 0) {
    return {
      alreadyMet: false,
      possible: false,
      needed: null,
      on: '',
      target,
      message: `Not enough remaining weight to reach ${target}.`,
    };
  }

  // Prefer a single empty slot that can carry the gap, Term Exam first.
  for (const slot of empty) {
    const needPct = gap / slot.weight;
    if (needPct <= 100.5) {
      const needed = Math.max(0, Math.min(100, Math.ceil(needPct)));
      return {
        alreadyMet: false,
        possible: true,
        needed,
        on: slot.label,
        target,
        message: `Need ${needed} on the ${slot.label} to reach ${target}.`,
      };
    }
  }

  const avg = gap / remainingWeight;
  if (avg <= 100.5) {
    const needed = Math.max(0, Math.min(100, Math.ceil(avg)));
    return {
      alreadyMet: false,
      possible: true,
      needed,
      on: 'remaining items',
      target,
      message: `Need about ${needed} average on remaining items to reach ${target}.`,
    };
  }

  return {
    alreadyMet: false,
    possible: false,
    needed: Math.ceil(avg),
    on: 'remaining items',
    target,
    message: `Need ${Math.ceil(avg)} average on remaining items — above 100, so ${target} is out of reach.`,
  };
}

export function gradeDescriptor(grade: number): { label: string; tone: 'high' | 'mid' | 'low' | 'fail' } {
  if (grade >= 90) return { label: 'Outstanding', tone: 'high' };
  if (grade >= 85) return { label: 'Very Satisfactory', tone: 'high' };
  if (grade >= 80) return { label: 'Satisfactory', tone: 'mid' };
  if (grade >= 75) return { label: 'Fairly Satisfactory', tone: 'mid' };
  return { label: 'Did Not Meet Expectations', tone: 'fail' };
}

export function computeFinalGrade(subjectKey: SubjectKey, assessments: Assessment[]): number | null {
  const terms: (number | null)[] = Array.from({ length: NUM_TERMS }, (_, i) =>
    computeTermGrade(subjectKey, i + 1, assessments)
  );
  const valid = terms.filter((q): q is number => q !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, g) => sum + g, 0) / valid.length;
}

export function computeGeneralAverage(assessments: Assessment[]): number | null {
  const finals = SUBJECTS
    .map((s) => computeFinalGrade(s.key, assessments))
    .filter((g): g is number => g !== null);
  if (finals.length === 0) return null;
  return finals.reduce((sum, g) => sum + g, 0) / finals.length;
}

export function gradeTone(grade: number | null): 'high' | 'mid' | 'low' | 'fail' | 'none' {
  if (grade === null) return 'none';
  if (grade >= 85) return 'high';
  if (grade >= 80) return 'mid';
  if (grade >= 75) return 'low';
  return 'fail';
}

export function termSeries(subjectKey: SubjectKey, assessments: Assessment[]): (number | null)[] {
  return Array.from({ length: NUM_TERMS }, (_, i) => computeTermGrade(subjectKey, i + 1, assessments));
}
