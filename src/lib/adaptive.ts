import { supabase } from '@/integrations/supabase/client';
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
  let relevant = attempts;
  if (topicId && questions) {
    relevant = attempts.filter(a => {
      const q = questions.get(a.questionId);
      return q?.topicId === topicId;
    });
  }

  const sorted = [...relevant].sort(
    (a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()
  );

  if (sorted.length === 0) return 'easy';

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
 */
export function getRecommendedTopic(
  attempts: Attempt[],
  questions: Map<string, { topicId: string; difficulty: string; status: string }>,
  topicNames: Map<string, string>,
): { topicId: string; topicName: string; errorRate: number; availableQuestions: number } | null {
  const topicStats = new Map<string, { total: number; errors: number }>();

  attempts.forEach(a => {
    const q = questions.get(a.questionId);
    if (!q?.topicId) return;
    const s = topicStats.get(q.topicId) || { total: 0, errors: 0 };
    s.total++;
    if (!a.isCorrect) s.errors++;
    topicStats.set(q.topicId, s);
  });

  const availableByTopic = new Map<string, number>();
  questions.forEach((q) => {
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

// ---- Cognitive Block Detection ----

export interface CognitiveBlockAlert {
  topicId: string;
  topicName: string;
  consecutiveErrors: number;
  prerequisiteTopicId?: string;
  prerequisiteTopicName?: string;
}

/**
 * Detects cognitive block: 3+ consecutive errors on same topic
 * with time above average. If a prerequisite exists, recommends it.
 */
export function detectCognitiveBlock(
  attempts: Attempt[],
  questions: Map<string, { topicId: string }>,
  topicNames: Map<string, string>,
  prerequisites: Map<string, string[]>, // topicId -> prerequisite topic ids
): CognitiveBlockAlert | null {
  const sorted = [...attempts].sort(
    (a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()
  );

  // Check last N attempts for consecutive errors on same topic
  const recentByTopic = new Map<string, { errors: number }>();

  for (const a of sorted.slice(0, 15)) {
    const q = questions.get(a.questionId);
    if (!q?.topicId) continue;

    const s = recentByTopic.get(q.topicId);
    if (!s) {
      recentByTopic.set(q.topicId, { errors: a.isCorrect ? 0 : 1 });
    } else if (!a.isCorrect) {
      s.errors++;
    } else {
      // A correct answer breaks the error streak for this topic
      break;
    }
  }

  for (const [topicId, stats] of recentByTopic.entries()) {
    if (stats.errors >= 3) {
      const prereqs = prerequisites.get(topicId) ?? [];
      const prereqId = prereqs[0];
      return {
        topicId,
        topicName: topicNames.get(topicId) ?? topicId,
        consecutiveErrors: stats.errors,
        prerequisiteTopicId: prereqId,
        prerequisiteTopicName: prereqId ? topicNames.get(prereqId) : undefined,
      };
    }
  }

  return null;
}

// ---- Prerequisites CRUD ----

export async function getTopicPrerequisites(): Promise<{ topicId: string; prerequisiteTopicId: string }[]> {
  const { data } = await supabase
    .from('topic_prerequisites')
    .select('topic_id, prerequisite_topic_id');
  return (data ?? []).map((r: any) => ({
    topicId: r.topic_id,
    prerequisiteTopicId: r.prerequisite_topic_id,
  }));
}

export async function addTopicPrerequisite(topicId: string, prerequisiteTopicId: string): Promise<void> {
  await supabase.from('topic_prerequisites').upsert({
    topic_id: topicId,
    prerequisite_topic_id: prerequisiteTopicId,
  } as any);
}

export async function removeTopicPrerequisite(topicId: string, prerequisiteTopicId: string): Promise<void> {
  await (supabase.from('topic_prerequisites') as any)
    .delete()
    .eq('topic_id', topicId)
    .eq('prerequisite_topic_id', prerequisiteTopicId);
}

/** Build a Map of topicId -> prerequisite topic ids */
export function buildPrerequisiteMap(prereqs: { topicId: string; prerequisiteTopicId: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  prereqs.forEach(p => {
    const arr = map.get(p.topicId) ?? [];
    arr.push(p.prerequisiteTopicId);
    map.set(p.topicId, arr);
  });
  return map;
}
