import { useState, useEffect, useCallback } from 'react';
import { getRanking, getAppSetting } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';

export function StudentRanking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const { loading, error: loadError, execute } = useLoadWithTimeout();

  const load = useCallback(async () => {
    await execute(async () => {
      const vis = await getAppSetting('ranking_visible');
      if (vis === 'true') {
        setVisible(true);
        setRanking(await getRanking());
      } else {
        setVisible(false);
      }
    });
  }, [execute]);

  useEffect(() => { load(); }, [load]);
  useVisibilityRefresh(load);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (loadError) return <LoadingTimeout error={loadError} onRetry={load} />;
  if (!visible) return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center">
      <p className="text-muted-foreground">O ranking está desativado no momento.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {ranking.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center">
          <p className="text-muted-foreground">Nenhum dado de ranking ainda.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {['#', 'Aluno', 'Respondidas', 'Acertos', '% Acerto', 'Sequência'].map(h => (
                    <th key={h} className="text-xs font-semibold text-left px-4 py-3 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.userId} className={`border-t border-border ${r.userId === user?.username ? 'bg-primary/5' : 'hover:bg-muted/50'} transition-colors`}>
                    <td className="px-4 py-3 font-bold text-sm">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">
                      {r.username}{r.userId === user?.username ? ' (você)' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.total}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.correct}</td>
                    <td className="px-4 py-3 text-sm font-medium">{r.rate}%</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.streak} dia{r.streak === 1 ? '' : 's'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
