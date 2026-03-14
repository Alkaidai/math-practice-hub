import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getNotebook, getStudentDashboardMeta, getTopics, loadQuestionBank, getDiagnosticResult, getAllowedSubjectSlugs, getDailyStudyStats, getAverageTimePerQuestion } from '../../lib/storage';
import { subjectLabel, difficultyLabel, formatDate } from '../../lib/ui-utils';
import { DiagnosticReport } from './DiagnosticReport';
import { StudyPlan } from './StudyPlan';
import { EvolutionChart } from './EvolutionChart';
// MVP: Achievements, DailyMissions, StudyTrail hidden (not deleted)
// import { Achievements } from './Achievements';
// import { DailyMissions } from './DailyMissions';
// import { StudyTrail } from './StudyTrail';
import { LoadingState, ScreenErrorState } from './ScreenStates';
import { DiagnosticAssessment } from './DiagnosticAssessment';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { getRecommendedDifficulty, getRecommendedTopic } from '../../lib/adaptive';
import type { Question, Attempt, DashboardMeta } from '../../lib/types';
import { Target, TrendingUp, Flame, AlertCircle, Stethoscope, Clock, BookOpen, Timer, Play } from 'lucide-react';
import { Progress } from '../ui/progress';

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
  allQuestions: Question[];
  allTopics: { id: string; name: string; subject: string; grade: string; status: string }[];
  allAttempts: Attempt[];
  diagnosticResult: any | null;
  diagnosticAccuracy: number;
  nextTopic: { topicId: string; topicName: string; count: number; recommendedDifficulty: string } | null;
  hasDiagnostic: boolean;
  recommendedDifficulty: string;
  studyTodaySeconds: number;
  questionsToday: number;
  avgTimePerQuestion: number;
}

const STAT_CONFIGS = [
  { key: 'answered', icon: Target, label: 'Exercícios resolvidos', colorClass: 'bg-primary text-primary-foreground', softBg: 'bg-primary-soft' },
  { key: 'streak', icon: Flame, label: 'Sequência', colorClass: 'bg-gold text-gold-foreground', softBg: 'bg-gold-soft' },
  { key: 'rate', icon: TrendingUp, label: '% de acertos', colorClass: 'bg-success text-success-foreground', softBg: 'bg-success-soft' },
  { key: 'study', icon: Clock, label: 'Estudo hoje', colorClass: 'bg-info text-info-foreground', softBg: 'bg-info-soft' },
] as const;

function StatCard({ icon: Icon, label, value, subValue, colorClass, softBg }: {
  icon: React.ElementType; label: string; value: string; subValue?: string; colorClass: string; softBg: string;
}) {
  return (
    <div className={`${softBg} rounded-xl p-4 flex items-start gap-3 transition-all hover:shadow-sm`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} shadow-xs`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-h2 font-bold text-foreground mt-0.5 leading-tight">{value}</p>
        {subValue && <p className="text-caption text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  );
}

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

export function StudentDashboard({ onNavigateQuestions, onRefazer, onStartTopic }: {
  onNavigateQuestions: () => void;
  onRefazer: (questionId: string) => void;
  onStartTopic: (topicId: string, difficulty?: string) => void;
}) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [data, setData] = useState<DashboardData | null>(null);
  const { loading, error, execute } = useLoadWithTimeout();
  const [showDiagnosticNow, setShowDiagnosticNow] = useState(false);

  const load = useCallback(async () => {
    await execute(async () => {
      const [attempts, notebook, meta, allQuestions, topics, diag, allowedSlugs, dailyStats, avgTime] = await Promise.all([
        getAttempts(userId),
        getNotebook(userId),
        getStudentDashboardMeta(userId),
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        getDiagnosticResult(userId),
        getAllowedSubjectSlugs(userId),
        getDailyStudyStats(userId),
        getAverageTimePerQuestion(userId),
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

      const qMap = new Map(filteredQuestions.map(q => [q.id, { topicId: q.topicId, difficulty: q.difficulty, status: q.status }]));

      const recommended = getRecommendedTopic(attempts, qMap, topicMap);
      let nextTopic: DashboardData['nextTopic'] = null;
      if (recommended) {
        const recDiff = getRecommendedDifficulty(attempts, recommended.topicId, qMap);
        nextTopic = { topicId: recommended.topicId, topicName: recommended.topicName, count: recommended.availableQuestions, recommendedDifficulty: recDiff };
      } else if (weakTopics.length > 0) {
        const top = weakTopics[0];
        const availableQ = filteredQuestions.filter(q => q.topicId === top.topicId && q.status !== 'draft').length;
        const recDiff = getRecommendedDifficulty(attempts, top.topicId, qMap);
        nextTopic = { topicId: top.topicId, topicName: top.label, count: availableQ, recommendedDifficulty: recDiff };
      }

      const globalDifficulty = getRecommendedDifficulty(attempts, undefined, qMap);

      const diagAccuracy = diag ? ((diag as any).accuracy_rate ?? (diag as any).accuracyRate ?? 0) : 0;

      setData({
        answered, correct, rate, pendingCount, masteredCount, totalReviewed, meta, weakTopics, wrongLatest, questions,
        allQuestions: filteredQuestions, allTopics: filteredTopics, allAttempts: attempts,
        diagnosticResult: diag, diagnosticAccuracy: diagAccuracy,
        nextTopic, hasDiagnostic: !!diag,
        studyTodaySeconds: dailyStats?.totalSeconds ?? 0,
        questionsToday: dailyStats?.questionsAnswered ?? 0,
        avgTimePerQuestion: avgTime,
        recommendedDifficulty: globalDifficulty,
      });
    });
  }, [userId, execute]);

  useEffect(() => { load(); }, [load]);
  useVisibilityRefresh(load);

  if (error) return <ScreenErrorState error={error} onRetry={load} />;
  if (loading || !data) return <LoadingState message="Carregando painel..." />;

  if (showDiagnosticNow) {
    return (
      <div className="max-w-3xl mx-auto">
        <DiagnosticAssessment onComplete={() => { setShowDiagnosticNow(false); load(); }} />
      </div>
    );
  }

  const hasData = data.answered > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Diagnostic CTA */}
      {!data.hasDiagnostic && (
        <div className="bg-primary-soft border border-primary/20 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-body font-semibold text-foreground flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Diagnóstico Inicial
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              Descubra seus pontos fortes e fracos para um plano personalizado.
            </p>
          </div>
          <button
            onClick={() => setShowDiagnosticNow(true)}
            className="shrink-0 rounded-xl bg-primary text-primary-foreground font-semibold text-body px-6 py-2.5 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]"
          >
            Iniciar diagnóstico
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Exercícios resolvidos" value={String(data.answered)} subValue={`${data.questionsToday} hoje`} colorClass="bg-primary text-primary-foreground" softBg="bg-primary-soft" />
        <StatCard icon={Flame} label="Sequência" value={`${data.meta.streak} dia${data.meta.streak === 1 ? '' : 's'}`} subValue="Meta 5 dias" colorClass="bg-gold text-gold-foreground" softBg="bg-gold-soft" />
        <StatCard icon={TrendingUp} label="% de acertos" value={`${data.rate}%`} subValue={data.rate < 50 ? `Suba para 50%` : 'Continue assim!'} colorClass="bg-success text-success-foreground" softBg="bg-success-soft" />
        <StatCard icon={Clock} label="Estudo hoje" value={formatStudyTime(data.studyTodaySeconds)} subValue="Meta 20 min" colorClass="bg-info text-info-foreground" softBg="bg-info-soft" />
      </div>

      {/* CONTINUAR TREINO */}
      {data.nextTopic && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <p className="text-overline text-muted-foreground mb-1 uppercase tracking-wider">Próximo tópico recomendado:</p>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-h2 font-bold text-foreground">{data.nextTopic.topicName}</p>
              <p className="text-caption text-muted-foreground mt-1">
                {data.nextTopic.count} exercícios · Nível: <span className="font-semibold capitalize">{difficultyLabel(data.nextTopic.recommendedDifficulty)}</span>
              </p>
            </div>
            <button
              onClick={() => onStartTopic(data.nextTopic!.topicId, data.nextTopic!.recommendedDifficulty)}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold text-body-lg px-8 py-3.5 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]"
            >
              <Play className="h-5 w-5" />
              CONTINUAR TREINO
            </button>
          </div>
        </div>
      )}

      {!hasData && !data.nextTopic && (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
          <p className="text-body text-muted-foreground mb-4">Comece respondendo questões para ver seu progresso!</p>
          <button onClick={onNavigateQuestions} className="flex items-center gap-2 mx-auto rounded-xl bg-primary text-primary-foreground font-bold text-body px-8 py-3 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]">
            <Play className="h-5 w-5" />
            COMEÇAR A TREINAR
          </button>
        </div>
      )}

      {/* Study Trail */}
      <StudyTrail
        hasDiagnostic={data.hasDiagnostic}
        diagnosticAccuracy={data.diagnosticAccuracy}
        attempts={data.allAttempts}
        pendingNotebookCount={data.pendingCount}
      />

      {/* Daily Missions */}
      <DailyMissions />

      {/* Diagnostic Report */}
      {data.hasDiagnostic && <DiagnosticReport diagnosticResult={data.diagnosticResult} attempts={data.allAttempts} />}

      {/* Study Plan */}
      <StudyPlan
        attempts={data.allAttempts}
        questions={data.allQuestions}
        topics={data.allTopics as any}
        diagnosticResult={data.diagnosticResult}
        onStartTopic={onStartTopic}
      />

      {/* Evolution Chart */}
      <EvolutionChart attempts={data.allAttempts} />

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notebook Summary */}
          <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
            <h3 className="text-body font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Caderno de Erros
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-destructive-soft p-3 text-center">
                <p className="text-caption text-muted-foreground">Pendentes</p>
                <p className="text-h2 font-bold text-destructive">{data.pendingCount}</p>
              </div>
              <div className="rounded-xl bg-success-soft p-3 text-center">
                <p className="text-caption text-muted-foreground">Dominados</p>
                <p className="text-h2 font-bold text-success">{data.masteredCount}</p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-caption text-muted-foreground">Total</p>
                <p className="text-h2 font-bold text-foreground">{data.totalReviewed}</p>
              </div>
            </div>
          </div>

          {/* Weak Topics */}
          <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
            <h3 className="text-body font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Tópicos Fracos (Top 5)
            </h3>
            {data.weakTopics.length > 0 ? (
              <div className="space-y-2.5">
                {data.weakTopics.map((t, i) => (
                  <div key={t.topicId} className="flex items-center justify-between group">
                    <div className="flex-1 min-w-0">
                      <p className="text-body text-foreground truncate">
                        <span className="text-caption text-muted-foreground mr-1 font-mono">{i + 1}.</span> {t.label}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={100 - t.errorRate} className="h-1.5 flex-1 max-w-[120px]" indicatorClassName={t.errorRate > 60 ? 'bg-destructive' : t.errorRate > 30 ? 'bg-gold' : 'bg-success'} />
                        <p className="text-caption text-muted-foreground">Erro {t.errorRate}%</p>
                      </div>
                    </div>
                    <button onClick={() => onStartTopic(t.topicId)} className="text-caption text-primary font-semibold hover:underline ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Treinar</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body text-muted-foreground">Sem dados suficientes.</p>
            )}
          </div>

          {/* Recent Errors */}
          <div className="bg-card rounded-xl shadow-sm p-5 lg:col-span-2 border border-border">
            <h3 className="text-body font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Revisar Erros (Últimas 5)
            </h3>
            <div className="space-y-3">
              {data.wrongLatest.length > 0 ? data.wrongLatest.map(a => {
                const q = data.questions.get(a.questionId);
                if (!q) return null;
                return (
                  <div key={a.id} className="flex items-start justify-between gap-3 pb-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-body text-foreground">{q.statement.slice(0, 95)}{q.statement.length > 95 ? '...' : ''}</p>
                      <p className="text-caption text-muted-foreground mt-0.5">{formatDate(a.answeredAt)} · {q.grade} · {subjectLabel(q.subject)}</p>
                    </div>
                    <button onClick={() => onRefazer(q.id)} className="shrink-0 rounded-lg text-caption font-semibold text-primary border border-primary/30 px-3 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all active:scale-[0.98]">
                      Refazer
                    </button>
                  </div>
                );
              }) : (
                <p className="text-body text-muted-foreground">Nenhuma questão errada até agora.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      <Achievements attempts={data.allAttempts} streak={data.meta.streak} />
    </div>
  );
}
