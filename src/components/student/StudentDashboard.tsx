import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getNotebook, getStudentDashboardMeta, getTopics, loadQuestionBank, getDiagnosticResult, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, formatDate } from '../../lib/ui-utils';
import { Progress } from '../ui/progress';
import { DiagnosticReport } from './DiagnosticReport';
import { StudyPlan } from './StudyPlan';
import { EvolutionChart } from './EvolutionChart';
import { Achievements } from './Achievements';
import { StudyTrail } from './StudyTrail';
import { LoadingTimeout } from './LoadingTimeout';
import { DiagnosticAssessment } from './DiagnosticAssessment';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import type { Question, Attempt, DashboardMeta } from '../../lib/types';
import { Target, TrendingUp, Flame, AlertCircle, Stethoscope } from 'lucide-react';

interface WeakTopic {
  topicId: string;
  label: string;
  total: number;
  errors: number;
  errorRate: number;
}

interface DashboardData {
  answered: number;
  correct: number;
  rate: number;
  pendingCount: number;
  masteredCount: number;
  totalReviewed: number;
  meta: DashboardMeta;
  weakTopics: WeakTopic[];
  wrongLatest: Attempt[];
  questions: Map<string, Question>;
  nextTopic: { topicId: string; topicName: string; count: number } | null;
  hasDiagnostic: boolean;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function StudentDashboard({ onNavigateQuestions, onRefazer, onStartTopic }: {
  onNavigateQuestions: () => void;
  onRefazer: (questionId: string) => void;
  onStartTopic: (topicId: string) => void;
}) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [data, setData] = useState<DashboardData | null>(null);
  const { loading, error, execute } = useLoadWithTimeout();
  const [showDiagnosticNow, setShowDiagnosticNow] = useState(false);

  const load = useCallback(async () => {
    await execute(async () => {
      const [attempts, notebook, meta, allQuestions, topics, diag, allowedSlugs] = await Promise.all([
        getAttempts(userId),
        getNotebook(userId),
        getStudentDashboardMeta(userId),
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        getDiagnosticResult(userId),
        getAllowedSubjectSlugs(userId),
      ]);

      const filteredTopics = topics.filter(t => allowedSlugs.includes(t.subject));
      const filteredQuestions = allQuestions.filter(q => allowedSlugs.includes(q.subject));

      const answered = attempts.length;
      const correct = attempts.filter(a => a.isCorrect).length;
      const rate = answered ? Math.round((correct / answered) * 100) : 0;
      const pendingCount = notebook.filter(i => i.status === 'pending').length;
      const masteredCount = notebook.filter(i => i.status === 'mastered').length;
      const totalReviewed = notebook.length;
      const questions = new Map(filteredQuestions.map(q => [q.id, q]));
      const topicMap = new Map(filteredTopics.map(t => [t.id, t.name]));

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

      const wrongLatest = attempts
        .filter(a => !a.isCorrect)
        .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
        .slice(0, 5);

      let nextTopic: DashboardData['nextTopic'] = null;
      if (weakTopics.length > 0) {
        const top = weakTopics[0];
        const availableQ = filteredQuestions.filter(q => q.topicId === top.topicId && q.status !== 'draft').length;
        nextTopic = { topicId: top.topicId, topicName: top.label, count: availableQ };
      }

      setData({ answered, correct, rate, pendingCount, masteredCount, totalReviewed, meta, weakTopics, wrongLatest, questions, nextTopic, hasDiagnostic: !!diag });
    });
  }, [userId, execute]);

  useEffect(() => { load(); }, [userId]);

  if (error) return <ErrorState message="Erro ao carregar o painel." onRetry={load} />;
  if (!data) return <p className="text-muted-foreground">Carregando painel...</p>;

  // Show diagnostic assessment inline
  if (showDiagnosticNow) {
    return (
      <div className="max-w-3xl mx-auto">
        <DiagnosticAssessment onComplete={() => { setShowDiagnosticNow(false); load(); }} />
      </div>
    );
  }

  const hasData = data.answered > 0;

  return (
    <div className="space-y-6">
      {/* Diagnostic CTA - only if not done yet */}
      {!data.hasDiagnostic && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Diagnóstico Inicial
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Descubra seus pontos fortes e fracos em matemática para um plano de estudo personalizado.
            </p>
          </div>
          <button
            onClick={() => setShowDiagnosticNow(true)}
            className="shrink-0 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 hover:brightness-110 transition-all"
          >
            Iniciar diagnóstico
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Respondidas" value={String(data.answered)} color="bg-primary" />
        <StatCard icon={TrendingUp} label="Acertos" value={`${data.rate}%`} color="bg-success" />
        <StatCard icon={Flame} label="Sequência" value={`${data.meta.streak} dia${data.meta.streak === 1 ? '' : 's'}`} color="bg-gold" />
        <StatCard icon={AlertCircle} label="Pendências" value={String(data.pendingCount)} color="bg-destructive" />
      </div>

      {/* Next Step */}
      {data.nextTopic && (
        <div className="bg-card rounded-xl shadow-sm border-l-4 border-l-gold p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Seu próximo passo</p>
          <p className="text-base font-bold text-foreground">Treinar {data.nextTopic.topicName}</p>
          <p className="text-xs text-muted-foreground mb-3">{data.nextTopic.count} exercícios disponíveis</p>
          <button onClick={() => onStartTopic(data.nextTopic!.topicId)} className="rounded-lg bg-gold text-gold-foreground font-semibold text-sm px-5 py-2 hover:brightness-110 transition-all">
            Treinar agora →
          </button>
        </div>
      )}

      {!hasData && !data.nextTopic && (
        <div className="bg-card rounded-xl shadow-sm p-6 text-center">
          <p className="text-muted-foreground mb-3">Comece respondendo questões para ver seu progresso!</p>
          <button onClick={onNavigateQuestions} className="rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 hover:brightness-110 transition-all">
            Ir para questões
          </button>
        </div>
      )}

      {/* Study Trail */}
      <StudyTrail />

      {/* Diagnostic Report - only if completed */}
      {data.hasDiagnostic && <DiagnosticReport />}

      {/* Study Plan */}
      <StudyPlan onStartTopic={onStartTopic} />

      {/* Evolution Chart */}
      <EvolutionChart />

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notebook Summary */}
          <div className="bg-card rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">📓 Caderno de Erros</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-destructive/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-destructive">{data.pendingCount}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">Dominados</p>
                <p className="text-xl font-bold text-success">{data.masteredCount}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-foreground">{data.totalReviewed}</p>
              </div>
            </div>
          </div>

          {/* Weak Topics */}
          <div className="bg-card rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tópicos Fracos (Top 5)</h3>
            {data.weakTopics.length > 0 ? (
              <div className="space-y-2.5">
                {data.weakTopics.map((t, i) => (
                  <div key={t.topicId} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="text-xs text-muted-foreground mr-1">{i + 1}.</span> {t.label}
                      </p>
                      <p className="text-xs text-muted-foreground">Erro {t.errorRate}% ({t.errors}/{t.total})</p>
                    </div>
                    <button onClick={() => onStartTopic(t.topicId)} className="text-xs text-primary font-medium hover:underline ml-2">Treinar</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
            )}
          </div>

          {/* Recent Errors */}
          <div className="bg-card rounded-xl shadow-sm p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-3">Revisar Erros (Últimas 5)</h3>
            <div className="space-y-3">
              {data.wrongLatest.length > 0 ? data.wrongLatest.map(a => {
                const q = data.questions.get(a.questionId);
                if (!q) return null;
                return (
                  <div key={a.id} className="flex items-start justify-between gap-3 pb-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{q.statement.slice(0, 95)}{q.statement.length > 95 ? '...' : ''}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.answeredAt)} · {q.grade} · {subjectLabel(q.subject)}</p>
                    </div>
                    <button onClick={() => onRefazer(q.id)} className="shrink-0 rounded-lg text-xs text-primary border border-primary/30 px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-colors">
                      Refazer
                    </button>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground">Nenhuma questão errada até agora. 🎉</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      <Achievements />
    </div>
  );
}
