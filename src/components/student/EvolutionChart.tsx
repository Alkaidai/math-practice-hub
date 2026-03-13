import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts } from '../../lib/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WeekData {
  label: string;
  rate: number;
  total: number;
}

export function EvolutionChart() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [data, setData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const attempts = await getAttempts(userId);
      if (attempts.length === 0) { setLoading(false); return; }

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

      const chartData: WeekData[] = [...weeks.entries()].map(([key, stats]) => ({
        label: new Date(key).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        rate: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
      }));

      setData(chartData);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;
  if (data.length < 2) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">📈 Evolução ao Longo do Tempo</h3>
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
                borderRadius: '8px',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number) => [`${value}%`, 'Acerto']}
            />
            <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
