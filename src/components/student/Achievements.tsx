import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getStudentDashboardMeta } from '../../lib/storage';

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function Achievements() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [attempts, meta] = await Promise.all([
        getAttempts(userId),
        getStudentDashboardMeta(userId),
      ]);

      const total = attempts.length;
      const correct = attempts.filter(a => a.isCorrect).length;
      const streak = meta.streak;

      // Calculate max consecutive correct
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      const sorted = [...attempts].sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime());
      sorted.forEach(a => {
        if (a.isCorrect) { currentConsecutive++; maxConsecutive = Math.max(maxConsecutive, currentConsecutive); }
        else currentConsecutive = 0;
      });

      const all: Achievement[] = [
        { id: 'first10', icon: '🎯', title: 'Primeiros passos', description: '10 exercícios resolvidos', unlocked: total >= 10 },
        { id: 'fifty', icon: '💪', title: 'Dedicado', description: '50 exercícios resolvidos', unlocked: total >= 50 },
        { id: 'hundred', icon: '🏆', title: 'Centurião', description: '100 exercícios resolvidos', unlocked: total >= 100 },
        { id: 'streak7', icon: '🔥', title: 'Consistente', description: '7 dias seguidos estudando', unlocked: streak >= 7 },
        { id: 'consec10', icon: '⚡', title: 'Imbatível', description: '10 acertos seguidos', unlocked: maxConsecutive >= 10 },
        { id: 'first_correct', icon: '✨', title: 'Primeiro acerto', description: 'Acertou a primeira questão', unlocked: correct >= 1 },
      ];

      setAchievements(all);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase mb-3">🏅 Conquistas ({unlocked.length}/{achievements.length})</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {achievements.map(a => (
          <div key={a.id} className={`border p-3 text-center ${a.unlocked ? 'border-primary bg-primary/5' : 'border-border opacity-40'}`}>
            <span className="text-2xl">{a.icon}</span>
            <p className="font-heading text-xs font-bold text-foreground mt-1">{a.title}</p>
            <p className="font-heading text-xs text-muted-foreground">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
