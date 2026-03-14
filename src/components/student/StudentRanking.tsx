import { useState, useEffect, useCallback } from 'react';
import { getRanking, getAppSetting } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState, ScreenErrorState } from './ScreenStates';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { Trophy, Medal, Award, User } from 'lucide-react';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-gold-soft flex items-center justify-center"><Trophy className="h-4 w-4 text-gold" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Medal className="h-4 w-4 text-muted-foreground" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-warning-soft flex items-center justify-center"><Award className="h-4 w-4 text-warning" /></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><span className="text-caption font-bold text-muted-foreground">{rank}</span></div>;
}

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
  // MVP: useVisibilityRefresh DISABLED — no auto-reload on tab focus

  if (loading) return <LoadingState message="Carregando ranking..." />;
  if (loadError) return <ScreenErrorState error={loadError} onRetry={load} />;
  if (!visible) return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
      <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-body text-muted-foreground">O ranking está desativado no momento.</p>
    </div>
  );

  // Find user's position
  const userIdx = ranking.findIndex(r => r.userId === user?.username);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* User position highlight */}
      {userIdx >= 0 && (
        <div className="bg-primary-soft border border-primary/20 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <User className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-overline text-muted-foreground uppercase">Sua posição</p>
            <p className="text-h1 font-bold text-foreground">{userIdx + 1}º</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-caption text-muted-foreground">Posição no total</p>
            <p className="text-body font-semibold text-foreground">{ranking[userIdx].total} questões</p>
          </div>
        </div>
      )}

      {ranking.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
          <p className="text-body text-muted-foreground">Nenhum dado de ranking ainda.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden border border-border">
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-body">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {['#', 'Aluno', 'Respondidas', 'Acertos', '% Acerto', 'Sequência'].map(h => (
                    <th key={h} className="text-caption font-semibold text-left px-4 py-3 text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.userId} className={`border-t border-border ${r.userId === user?.username ? 'bg-primary-soft' : 'hover:bg-muted/50'} transition-colors`}>
                    <td className="px-4 py-3">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.username}{r.userId === user?.username ? <span className="text-caption text-primary ml-1">(você)</span> : ''}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.total}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.correct}</td>
                    <td className="px-4 py-3 font-semibold">{r.rate}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.streak} dia{r.streak === 1 ? '' : 's'}</td>
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
