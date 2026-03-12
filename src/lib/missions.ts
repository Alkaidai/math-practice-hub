import { supabase } from '@/integrations/supabase/client';

export interface DailyMission {
  id: number;
  userId: string;
  date: string;
  missionType: 'answer_questions' | 'study_minutes' | 'correct_streak';
  targetValue: number;
  currentValue: number;
  completed: boolean;
  completedAt: string | null;
}

const MISSION_TEMPLATES = [
  { type: 'answer_questions' as const, label: 'Resolver questões', target: 10, emoji: '📝' },
  { type: 'study_minutes' as const, label: 'Estudar minutos', target: 15, emoji: '⏱️' },
  { type: 'correct_streak' as const, label: 'Acertar seguidas', target: 5, emoji: '🎯' },
];

export function getMissionLabel(type: string): string {
  return MISSION_TEMPLATES.find(m => m.type === type)?.label ?? type;
}

export function getMissionEmoji(type: string): string {
  return MISSION_TEMPLATES.find(m => m.type === type)?.emoji ?? '📋';
}

function rowToMission(row: any): DailyMission {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    missionType: row.mission_type,
    targetValue: row.target_value,
    currentValue: row.current_value,
    completed: row.completed,
    completedAt: row.completed_at,
  };
}

/** Get or generate today's missions for a user */
export async function getDailyMissions(userId: string): Promise<DailyMission[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);

  if (data && data.length > 0) {
    return data.map(rowToMission);
  }

  // Generate new missions for today
  const missions = MISSION_TEMPLATES.map(t => ({
    user_id: userId,
    date: today,
    mission_type: t.type,
    target_value: t.target,
    current_value: 0,
    completed: false,
  }));

  const { data: inserted } = await supabase
    .from('daily_missions')
    .upsert(missions as any, { onConflict: 'user_id,date,mission_type' })
    .select();

  return (inserted ?? []).map(rowToMission);
}

/** Update mission progress after answering a question */
export async function updateMissionProgress(
  userId: string,
  event: { questionsAnswered?: number; studyMinutes?: number; correctStreak?: number }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: missions } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('completed', false);

  if (!missions || missions.length === 0) return;

  for (const m of missions) {
    let increment = 0;
    if (m.mission_type === 'answer_questions' && event.questionsAnswered) {
      increment = event.questionsAnswered;
    } else if (m.mission_type === 'study_minutes' && event.studyMinutes) {
      increment = event.studyMinutes;
    } else if (m.mission_type === 'correct_streak' && event.correctStreak) {
      // For streak, we set the value directly (max)
      const newVal = Math.max(m.current_value, event.correctStreak);
      const completed = newVal >= m.target_value;
      await (supabase.from('daily_missions') as any)
        .update({
          current_value: newVal,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', m.id);
      continue;
    }

    if (increment > 0) {
      const newVal = m.current_value + increment;
      const completed = newVal >= m.target_value;
      await (supabase.from('daily_missions') as any)
        .update({
          current_value: newVal,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', m.id);
    }
  }
}
