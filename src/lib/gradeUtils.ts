import type { Assessment, SubjectKey, ComponentType, ExType } from './types';
import { SUBJECT_MAP, EX_BREAKDOWN, NUM_TERMS, SUBJECTS } from './types';

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
