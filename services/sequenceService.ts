/**
 * sequenceService.ts — Pure helper functions for Follow-up Sequences.
 * No Supabase calls. Safe to use in useMemo, render, and unit tests.
 */

import { Sequence, ContactSequence, SequenceStep } from '../types';

/**
 * Returns the Date when a step fires for a given enrollment.
 * Time component is zeroed so comparisons are day-accurate regardless of enrollment time.
 */
export function getStepDueDate(step: SequenceStep, enrolledAt: string): Date {
  const base = new Date(enrolledAt);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + step.dayOffset);
  return base;
}

/**
 * Returns true if the step's due date is today or in the past.
 */
export function isStepDue(step: SequenceStep, enrolledAt: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getStepDueDate(step, enrolledAt) <= today;
}

/**
 * Returns how many days overdue a step is.
 * Positive = overdue, 0 = due today, negative = not yet due.
 */
export function stepDaysOverdue(step: SequenceStep, enrolledAt: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = getStepDueDate(step, enrolledAt);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns steps that are due (today or overdue) and not yet completed.
 * Sorted by dayOffset ascending (earliest due step first).
 */
export function getDueSteps(
  enrollment: ContactSequence,
  sequence: Sequence
): SequenceStep[] {
  const completedSet = new Set(enrollment.completedStepIds);
  return sequence.steps
    .filter(step => !completedSet.has(step.id) && isStepDue(step, enrollment.enrolledAt))
    .sort((a, b) => a.dayOffset - b.dayOffset);
}

/**
 * Returns the first not-yet-completed step regardless of due date.
 * Useful for "next step" preview in ContactModal.
 */
export function getNextStep(
  enrollment: ContactSequence,
  sequence: Sequence
): SequenceStep | null {
  const completedSet = new Set(enrollment.completedStepIds);
  const pending = sequence.steps
    .filter(step => !completedSet.has(step.id))
    .sort((a, b) => a.dayOffset - b.dayOffset);
  return pending[0] ?? null;
}

/**
 * Returns progress data for a contact's enrollment in a sequence.
 */
export function getSequenceProgress(
  enrollment: ContactSequence,
  sequence: Sequence
): { completed: number; total: number; percentComplete: number } {
  const total = sequence.steps.length;
  const completed = enrollment.completedStepIds.length;
  return {
    completed,
    total,
    percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/**
 * Returns true if all steps are completed.
 * Used to auto-transition status to 'completed' in the data service.
 */
export function isSequenceComplete(
  enrollment: ContactSequence,
  sequence: Sequence
): boolean {
  return sequence.steps.length > 0
    && enrollment.completedStepIds.length >= sequence.steps.length;
}
