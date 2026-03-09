import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getNotebook, getStudentDashboardMeta, getTopics, loadQuestionBank } from '../../lib/storage';
import { subjectLabel, difficultyLabel, formatDate } from '../../lib/ui-utils';

interface WeakTopic {
  topicId: string;
  label: string;
  total: number;
  errors: number;
  errorRate: number;
}

export function StudentDashboard({ onNavigateQuestions, onRefazer }: { onNavigateQuestions: () => void; onRefazer: (questionId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const data = useMemo(() => {
    const attempts = getAttempts(userId);
    const answered = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    const rate = answered ? Math.round((correct / answered) * 100) : 0;
    const notebook = getNotebook(userId);
    const pendingCount = notebook.filter(i => i.status === 'pending').length;
    const meta = getStudentDashboardMeta(userId);
    const questions = new Map(loadQuestionBank().map(q => [q.id, q]));
    const topicMap = new Map(getTopics().map(t => [t.id, t.name]));

    // Weak topics
    const agg = new Map<string, { topicId: string; label: string; total: number; errors: number }>();
    attempts.forEach(a => {
      const q = questions.get(a.questionId);
      if (!q?.topicId) return;
      const prev = agg.get(q.topicId) ?? { topicId: q.topicId, label: topicMap.get(q.topicId) ?? q.topicId, total: 0, errors: 0 };
      prev.total += 1;
      if (!a.isCorrect) prev.errors += 1;
      agg.set(q.topicId, prev);
    });

    const weakTopics: WeakTopic[] = [...agg.values()]
      .filter(x => x.total > 0)
      .map(x => ({ ...x, errorRate: Math.round((x.errors / x.total) * 100) }))
      .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
      .slice(0, 5);

    // Recent wrong
    const wrongLatest = attempts
      .filter(a => !a.isCorrect)
      .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
      .slice(0, 10);

    // Recent history
    const recent = [...attempts]
      .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
      .slice(0, 20);

    return { answered, correct, rate, pendingCount, meta, weakTopics, wrongLatest, recent, questions };
  }, [userId]);

  const hasData = data.answered > 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Respondidas', String(data.answered)],
          ['Acertos', `${data.rate}%`],
          ['Sequência', `${data.meta.streak} dia${data.meta.streak === 1 ? '' : 's'}`],
          ['Pendências', String(data.pendingCount)],
        ].map(([label, value]) => (
          <div key={label} className="border border-border bg-card p-3">
            <p className="font-heading text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="font-heading text-xl font-bold text-foreground mt-1">{value}</p>
          </div>
        ))}
      </div>

      {!hasData && data.pendingCount === 0 && (
        <div className="border border-border bg-card p-4">
          <p className="font-body text-muted-foreground">Comece respondendo questões.</p>
          <button onClick={onNavigateQuestions} className="mt-2 font-heading text-sm font-semibold text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">
            Ir para questões
          </button>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Weak Topics */}
          <div className="border border-border bg-card p-4">
            <h3 className="font-heading text-sm font-bold text-foreground mb-2">TÓPICOS FRACOS (TOP 5)</h3>
            {data.weakTopics.length > 0 ? (
              <div className="space-y-2">
                {data.weakTopics.map((t, i) => (
                  <div key={t.topicId} className="border-b border-border pb-2 last:border-0">
                    <p className="font-body text-sm"><span className="font-heading text-xs text-muted-foreground">{i + 1}.</span> {t.label}</p>
                    <p className="font-heading text-xs text-muted-foreground">Erro {t.errorRate}% ({t.errors}/{t.total})</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">Sem dados suficientes.</p>
            )}
          </div>

          {/* Recent wrong */}
          <div className="border border-border bg-card p-4">
            <h3 className="font-heading text-sm font-bold text-foreground mb-2">REVISAR ERROS (ÚLTIMAS 10)</h3>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {data.wrongLatest.length > 0 ? data.wrongLatest.map(a => {
                const q = data.questions.get(a.questionId);
                if (!q) return null;
                return (
                  <div key={a.id} className="border-b border-border pb-2 last:border-0">
                    <p className="font-body text-sm">{q.statement.slice(0, 95)}{q.statement.length > 95 ? '...' : ''}</p>
                    <p className="font-heading text-xs text-muted-foreground">{formatDate(a.answeredAt)} · {q.grade} · {subjectLabel(q.subject)}</p>
                    <button onClick={() => onRefazer(q.id)} className="font-heading text-xs text-primary border border-primary px-2 py-0.5 mt-1 hover:bg-primary hover:text-primary-foreground">
                      Refazer
                    </button>
                  </div>
                );
              }) : (
                <p className="font-body text-sm text-muted-foreground">Nenhuma questão errada até agora.</p>
              )}
            </div>
          </div>

          {/* Recent history */}
          <div className="border border-border bg-card p-4 md:col-span-2">
            <h3 className="font-heading text-sm font-bold text-foreground mb-2">HISTÓRICO RECENTE</h3>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {data.recent.length > 0 ? data.recent.map(a => {
                const q = data.questions.get(a.questionId);
                return (
                  <div key={a.id} className="flex gap-2 items-start border-b border-border py-1 last:border-0">
                    <span className="text-sm">{a.isCorrect ? '✅' : '❌'}</span>
                    <div>
                      <p className="font-body text-sm">{q?.statement?.slice(0, 90) ?? 'Questão removida'}{(q?.statement?.length ?? 0) > 90 ? '...' : ''}</p>
                      <p className="font-heading text-xs text-muted-foreground">{formatDate(a.answeredAt)} · {q?.grade ?? '-'} · {subjectLabel(q?.subject ?? '-')}</p>
                    </div>
                  </div>
                );
              }) : (
                <p className="font-body text-sm text-muted-foreground">Sem tentativas recentes.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
