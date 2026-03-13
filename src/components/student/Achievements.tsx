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

      let maxConsecutive = 0;
      let currentConsecutive = 0;
      const sorted = [...attempts].sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime());
      sorted.forEach(a => {
        if (a.isCorrect) { currentConsecutive++; maxConsecutive = Math.max(maxConsecutive, currentConsecutive); }
        else currentConsecutive = 0;
      });

      const all: Achievement[] = [
        { id: 'first_correct', icon: '✨', title: 'Primeiro acerto', description: 'Acertou a primeira questão', unlocked: correct >= 1 },
        { id: 'first10', icon: '🎯', title: 'Primeiros passos', description: '10 exercícios resolvidos', unlocked: total >= 10 },
        { id: 'fifty', icon: '💪', title: 'Dedicado', description: '50 exercícios resolvidos', unlocked: total >= 50 },
        { id: 'hundred', icon: '🏆', title: 'Centurião', description: '100 exercícios resolvidos', unlocked: total >= 100 },
        { id: 'streak7', icon: '🔥', title: 'Consistente', description: '7 dias seguidos', unlocked: streak >= 7 },
        { id: 'consec10', icon: '⚡', title: 'Imbatível', description: '10 acertos seguidos', unlocked: maxConsecutive >= 10 },
      ];

      setAchievements(all);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;

  const unlocked = achievements.filter(a => a.unlocked);

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">🏅 Conquistas ({unlocked.length}/{achievements.length})</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {achievements.map(a => (
          <div key={a.id} className={`rounded-xl p-4 text-center transition-all ${a.unlocked ? 'bg-gold/10 border border-gold/30' : 'bg-muted opacity-50'}`}>
            <span className="text-3xl">{a.icon}</span>
            <p className="text-sm font-semibold text-foreground mt-2">{a.title}</p>
            <p className="text-xs text-muted-foreground">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
