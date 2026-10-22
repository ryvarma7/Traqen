/**
 * The limits the learning-plan form is held to.
 *
 * They live here, apart from the schema, because two ends need them: the
 * server validates against them, and the form holds the inputs to them. A
 * limit that lives in only one place is a limit the other end finds out
 * about by failing — and a bare "invalid input" is a poor way to learn that
 * a pasted syllabus was too long.
 *
 * The specifications box is the generous one. A plan is often specified in
 * full — a syllabus, a book outline, a brief — and 20,000 words is about
 * 120,000 characters, which is roughly 30,000 tokens. That is a large but
 * survivable share of the outline call's context; it is also why the
 * counter sits under the box, so the learner can see how much of their
 * brief actually went in.
 */
export const LEARNING_PLAN_LIMITS = {
  /** "What do you want to learn?" — the course's subject, in a paragraph. */
  topic: 2_000,
  /** "Specifications and suggestions" — 20,000 words. */
  specs: 120_000,
  /** "Time frame" — e.g. "6 weeks", "3 months", "exam-ready". */
  timeframe: 500,
} as const;
