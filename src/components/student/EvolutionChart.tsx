import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Attempt } from '../../lib/types';
import { TrendingUp } from 'lucide-react';

interface WeekData {
  label: string;
  rate: number;
  total: number;
}

interface EvolutionChartProps {
  attempts: Attempt[];
}

export function EvolutionChart({ attempts }: EvolutionChartProps) {
  const data = useMemo(() => {
    if (attempts.length === 0) return [];

    const sorted = [...attempts].sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime());
    const weeks = new Map<string, { total: number; correct: number }>();

    sorted.forEach(a => {
      const d = new Date(a.answeredAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const prev = weeks.get(key) ?? { total: 0, correct: 0 };
      prev.total += 1;
      if (a.isCorrect) prev.correct += 1;
      weeks.set(key, prev);
    });

    return [...weeks.entries()].map(([key, stats]) => ({
      label: new Date(key).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      rate: Math.round((stats.correct / stats.total) * 100),
      total: stats.total,
    }));
  }, [attempts]);

  if (data.length < 2) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
      <h3 className="text-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        Evolução ao Longo do Tempo
      </h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: 12,
                boxShadow: 'var(--shadow-lg)',
              }}
              formatter={(value: number) => [`${value}%`, 'Acerto']}
            />
            <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
