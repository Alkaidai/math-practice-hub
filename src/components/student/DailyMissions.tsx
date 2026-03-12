import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDailyMissions, getMissionLabel, getMissionEmoji, type DailyMission } from '../../lib/missions';
import { Progress } from '../ui/progress';
import { CheckCircle2 } from 'lucide-react';

export function DailyMissions() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const m = await getDailyMissions(userId);
    setMissions(m);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading || missions.length === 0) return null;

  const completedCount = missions.filter(m => m.completed).length;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">🎯 Missões do Dia</h3>
        <span className="text-xs text-muted-foreground">{completedCount}/{missions.length} concluídas</span>
      </div>
      <div className="space-y-3">
        {missions.map(m => {
          const progress = Math.min(100, Math.round((m.currentValue / m.targetValue) * 100));
          return (
            <div key={m.id} className={`rounded-lg p-3 ${m.completed ? 'bg-success/5 border border-success/20' : 'bg-muted/50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getMissionEmoji(m.missionType)}</span>
                  <span className={`text-sm font-medium ${m.completed ? 'text-success line-through' : 'text-foreground'}`}>
                    {getMissionLabel(m.missionType)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {m.currentValue}/{m.targetValue}
                  </span>
                  {m.completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                </div>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
