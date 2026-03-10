import { useState, useEffect } from 'react';
import { getRanking, getAppSetting } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';

export function StudentRanking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const vis = await getAppSetting('ranking_visible');
      if (vis === 'true') {
        setVisible(true);
        setRanking(await getRanking());
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;
  if (!visible) return <p className="font-body text-muted-foreground">O ranking está desativado no momento.</p>;

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-sm font-bold uppercase">🏆 Ranking de Alunos</h2>
      {ranking.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">Nenhum dado de ranking ainda.</p>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                {['#', 'Aluno', 'Respondidas', 'Acertos', '% Acerto', 'Sequência'].map(h => (
                  <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.userId} className={`${r.userId === user?.username ? 'bg-primary/10' : ''} hover:bg-muted/50`}>
                  <td className="p-2 border border-border font-heading text-xs font-bold">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="p-2 border border-border font-heading text-xs font-bold">
                    {r.username}{r.userId === user?.username ? ' (você)' : ''}
                  </td>
                  <td className="p-2 border border-border font-heading text-xs">{r.total}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.correct}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.rate}%</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.streak} dia{r.streak === 1 ? '' : 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
