import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, loadQuestionBank, getTopics, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, formatDate } from '../../lib/ui-utils';
import { LoadingState, ScreenErrorState, EmptyState } from './ScreenStates';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import type { Attempt, Question } from '../../lib/types';
import { History, CheckCircle2, XCircle, Filter } from 'lucide-react';

export function StudentHistory() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map());
  const [topicNames, setTopicNames] = useState<Map<string, string>>(new Map());
  const [filterSubject, setFilterSubject] = useState('');
  const [filterCorrect, setFilterCorrect] = useState<'' | 'correct' | 'wrong'>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const { loading, error, execute } = useLoadWithTimeout();

  const load = useCallback(async () => {
    await execute(async () => {
      const [att, qs, topics, slugs] = await Promise.all([
        getAttempts(userId),
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        getAllowedSubjectSlugs(userId),
      ]);
      const filteredQs = qs.filter(q => slugs.includes(q.subject));
      setQuestions(new Map(filteredQs.map(q => [q.id, q])));
      setTopicNames(new Map(topics.map(t => [t.id, t.name])));
      setAttempts(att.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()));
      setSubjects([...new Set(filteredQs.map(q => q.subject))]);
    });
  }, [userId, execute]);

  useEffect(() => { load(); }, [load]);
  // MVP: useVisibilityRefresh DISABLED — no auto-reload on tab focus

  if (loading) return <LoadingState message="Carregando histórico..." />;
  if (error) return <ScreenErrorState error={error} onRetry={load} />;
  if (attempts.length === 0) return <EmptyState icon={History} title="Nenhuma tentativa ainda" description="Comece resolvendo questões para ver seu histórico aqui." />;

  const filtered = attempts.filter(a => {
    const q = questions.get(a.questionId);
    if (!q) return false;
    if (filterSubject && q.subject !== filterSubject) return false;
    if (filterCorrect === 'correct' && !a.isCorrect) return false;
    if (filterCorrect === 'wrong' && a.isCorrect) return false;
    return true;
  });

  const total = filtered.length;
  const correct = filtered.filter(a => a.isCorrect).length;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-primary-soft rounded-xl p-4 text-center">
          <p className="text-caption text-muted-foreground">Total</p>
          <p className="text-h2 font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-success-soft rounded-xl p-4 text-center">
          <p className="text-caption text-muted-foreground">Acertos</p>
          <p className="text-h2 font-bold text-success">{correct}</p>
        </div>
        <div className="bg-gold-soft rounded-xl p-4 text-center">
          <p className="text-caption text-muted-foreground">Taxa</p>
          <p className="text-h2 font-bold text-foreground">{rate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="text-caption border border-border rounded-lg px-3 py-1.5 bg-card text-foreground">
          <option value="">Todas disciplinas</option>
          {subjects.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}
        </select>
        <select value={filterCorrect} onChange={e => setFilterCorrect(e.target.value as any)} className="text-caption border border-border rounded-lg px-3 py-1.5 bg-card text-foreground">
          <option value="">Todos</option>
          <option value="correct">Acertos</option>
          <option value="wrong">Erros</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-border">
          {filtered.slice(0, 100).map(a => {
            const q = questions.get(a.questionId);
            if (!q) return null;
            return (
              <div key={a.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${a.isCorrect ? 'bg-success-soft' : 'bg-destructive-soft'}`}>
                  {a.isCorrect ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-foreground line-clamp-2">{q.statement.slice(0, 120)}{q.statement.length > 120 ? '...' : ''}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-caption text-muted-foreground">{formatDate(a.answeredAt)}</span>
                    <span className="text-caption text-muted-foreground">·</span>
                    <span className="text-caption text-muted-foreground">{subjectLabel(q.subject)}</span>
                    {q.topicId && topicNames.get(q.topicId) && (
                      <>
                        <span className="text-caption text-muted-foreground">·</span>
                        <span className="text-caption text-muted-foreground">{topicNames.get(q.topicId)}</span>
                      </>
                    )}
                    <span className="text-caption text-muted-foreground">·</span>
                    <span className="text-caption text-muted-foreground">{difficultyLabel(q.difficulty)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length > 100 && (
          <div className="p-3 text-center border-t border-border">
            <p className="text-caption text-muted-foreground">Mostrando 100 de {filtered.length} tentativas</p>
          </div>
        )}
      </div>
    </div>
  );
}
