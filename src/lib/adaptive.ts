import type { Attempt } from './types';

/**
 * Determines the recommended difficulty for the next questions based on
 * the student's recent performance on a given topic (or globally).
 *
 * Rules:
 * - 4+ consecutive correct → increase difficulty
 * - 3+ consecutive incorrect → decrease difficulty
 * - Otherwise → keep current level
 */

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

export function getRecommendedDifficulty(
  attempts: Attempt[],
  topicId?: string,
  questions?: Map<string, { topicId: string; difficulty: string }>
): 'easy' | 'medium' | 'hard' {
  // Filter by topic if provided
  let relevant = attempts;
  if (topicId && questions) {
    relevant = attempts.filter(a => {
      const q = questions.get(a.questionId);
      return q?.topicId === topicId;
    });
  }

  // Sort by most recent first
  const sorted = [...relevant].sort(
    (a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()
  );

  if (sorted.length === 0) return 'easy';

  // Count consecutive correct/incorrect from most recent
  let consecutiveCorrect = 0;
  let consecutiveIncorrect = 0;

  for (const a of sorted) {
    if (a.isCorrect) {
      if (consecutiveIncorrect > 0) break;
      consecutiveCorrect++;
    } else {
      if (consecutiveCorrect > 0) break;
      consecutiveIncorrect++;
    }
  }

  // Determine current average difficulty
  const recentDifficulties = sorted.slice(0, 10).map(a => {
    const q = questions?.get(a.questionId);
    return q?.difficulty ?? 'easy';
  });

  const avgIdx = recentDifficulties.reduce((sum, d) => {
    return sum + DIFFICULTY_LEVELS.indexOf(d as any);
  }, 0) / (recentDifficulties.length || 1);

  let currentLevel = Math.round(avgIdx);

  if (consecutiveCorrect >= 4) {
    currentLevel = Math.min(2, currentLevel + 1);
  } else if (consecutiveIncorrect >= 3) {
    currentLevel = Math.max(0, currentLevel - 1);
  }

  return DIFFICULTY_LEVELS[currentLevel];
}

/**
 * Finds the best topic to study next based on weakness analysis.
 * Returns topic with highest error rate that still has available questions.
 */
export function getRecommendedTopic(
  attempts: Attempt[],
  questions: Map<string, { topicId: string; difficulty: string; status: string }>,
  topicNames: Map<string, string>,
): { topicId: string; topicName: string; errorRate: number; availableQuestions: number } | null {
  const topicStats = new Map<string, { total: number; errors: number }>();
  const answeredQuestionIds = new Set(attempts.map(a => a.questionId));

  attempts.forEach(a => {
    const q = questions.get(a.questionId);
    if (!q?.topicId) return;
    const s = topicStats.get(q.topicId) || { total: 0, errors: 0 };
    s.total++;
    if (!a.isCorrect) s.errors++;
    topicStats.set(q.topicId, s);
  });

  // Count available (unanswered or incorrectly answered) questions per topic
  const availableByTopic = new Map<string, number>();
  questions.forEach((q, qId) => {
    if (q.status === 'draft' || !q.topicId) return;
    availableByTopic.set(q.topicId, (availableByTopic.get(q.topicId) ?? 0) + 1);
  });

  const candidates = Array.from(topicStats.entries())
    .filter(([tid]) => (availableByTopic.get(tid) ?? 0) > 0)
    .map(([tid, s]) => ({
      topicId: tid,
      topicName: topicNames.get(tid) ?? tid,
      errorRate: Math.round((s.errors / s.total) * 100),
      availableQuestions: availableByTopic.get(tid) ?? 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate);

  // If no weak topics, pick topic with most available questions that hasn't been attempted
  if (candidates.length === 0) {
    const unattempted = Array.from(availableByTopic.entries())
      .filter(([tid]) => !topicStats.has(tid))
      .map(([tid, count]) => ({
        topicId: tid,
        topicName: topicNames.get(tid) ?? tid,
        errorRate: 0,
        availableQuestions: count,
      }))
      .sort((a, b) => b.availableQuestions - a.availableQuestions);

    return unattempted[0] ?? null;
  }

  return candidates[0] ?? null;
}
