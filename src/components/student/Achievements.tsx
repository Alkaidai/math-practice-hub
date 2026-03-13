import type { Attempt } from '../../lib/types';
import { Sparkles, Target, Flame, Zap, Award, Crown } from 'lucide-react';

interface Achievement {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
  unlocked: boolean;
}

interface AchievementsProps {
  attempts: Attempt[];
  streak: number;
}

export function Achievements({ attempts, streak }: AchievementsProps) {
  const total = attempts.length;
  const correct = attempts.filter(a => a.isCorrect).length;

  let maxConsecutive = 0;
  let currentConsecutive = 0;
  const sorted = [...attempts].sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime());
  sorted.forEach(a => {
    if (a.isCorrect) { currentConsecutive++; maxConsecutive = Math.max(maxConsecutive, currentConsecutive); }
    else currentConsecutive = 0;
  });

  const achievements: Achievement[] = [
    { id: 'first_correct', icon: Sparkles, iconColor: 'text-gold', bgColor: 'bg-gold-soft', title: 'Primeiro acerto', description: 'Acertou a primeira questão', unlocked: correct >= 1 },
    { id: 'first10', icon: Target, iconColor: 'text-primary', bgColor: 'bg-primary-soft', title: 'Primeiros passos', description: '10 exercícios resolvidos', unlocked: total >= 10 },
    { id: 'fifty', icon: Zap, iconColor: 'text-warning', bgColor: 'bg-warning-soft', title: 'Dedicado', description: '50 exercícios resolvidos', unlocked: total >= 50 },
    { id: 'hundred', icon: Crown, iconColor: 'text-gold', bgColor: 'bg-gold-soft', title: 'Centurião', description: '100 exercícios resolvidos', unlocked: total >= 100 },
    { id: 'streak7', icon: Flame, iconColor: 'text-destructive', bgColor: 'bg-destructive-soft', title: 'Consistente', description: '7 dias seguidos', unlocked: streak >= 7 },
    { id: 'consec10', icon: Award, iconColor: 'text-success', bgColor: 'bg-success-soft', title: 'Imbatível', description: '10 acertos seguidos', unlocked: maxConsecutive >= 10 },
  ];

  const unlocked = achievements.filter(a => a.unlocked);

  return (
    <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
      <h3 className="text-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <Award className="h-4 w-4 text-gold" />
        Conquistas ({unlocked.length}/{achievements.length})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {achievements.map(a => {
          const Icon = a.icon;
          return (
            <div key={a.id} className={`rounded-xl p-4 text-center transition-all ${a.unlocked ? `${a.bgColor} border border-gold/20 shadow-xs` : 'bg-muted opacity-40'}`}>
              <div className="flex justify-center mb-2">
                <div className={`w-10 h-10 rounded-xl ${a.unlocked ? a.bgColor : 'bg-muted'} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${a.unlocked ? a.iconColor : 'text-muted-foreground'}`} />
                </div>
              </div>
              <p className="text-body font-semibold text-foreground">{a.title}</p>
              <p className="text-caption text-muted-foreground">{a.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
