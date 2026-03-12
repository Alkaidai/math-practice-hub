import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAttempts, getNotebook, getStudentDashboardMeta, getTopics,
  loadQuestionBank, getDiagnosticResult, getAllowedSubjectSlugs,
  getDailyStudyStats, getAverageTimePerQuestion,
} from '../../lib/storage';
import { cachedFetch, CACHE_KEYS } from '../../lib/cache';
import { subjectLabel, difficultyLabel, formatDate } from '../../lib/ui-utils';
import { DiagnosticReport } from './DiagnosticReport';
import { StudyPlan } from './StudyPlan';
import { EvolutionChart } from './EvolutionChart';
import { Achievements } from './Achievements';
import { DailyMissions } from './DailyMissions';
import { StudyTrail } from './StudyTrail';
import { LoadingTimeout } from './LoadingTimeout';
import { DiagnosticAssessment } from './DiagnosticAssessment';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { getRecommendedDifficulty, getRecommendedTopic } from '../../lib/adaptive';
import { acquireRefreshLock, releaseRefreshLock } from '../../lib/refreshLock';
import type { Question, Attempt, DashboardMeta } from '../../lib/types';
import { Target, TrendingUp, Flame, AlertCircle, Stethoscope, Clock, BookOpen, Timer, Play } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

// ─── Types ───

interface WeakTopic {
  topicId: string;
  label: string;
  total: number;
  errors: number;
  errorRate: number;
}

interface Phase1Data {
  answered: number;
  correct: number;
  rate: number;
  pendingCount: number;
  masteredCount: number;
  totalReviewed: number;
  meta: DashboardMeta;
  allAttempts: Attempt[];
  studyTodaySeconds: number;
  questionsToday: number;
}

interface Phase2Data {
  weakTopics: WeakTopic[];
  wrongLatest: Attempt[];
  questions: Map<string, Question>;
  allQuestions: Question[];
  allTopics: { id: string; name: string; subject: string; grade: string; status: string }[];
  diagnosticResult: any | null;
  diagnosticAccuracy: number;
  nextTopic: { topicId: string; topicName: string; count: number; recommendedDifficulty: string } | null;
  hasDiagnostic: boolean;
  recommendedDifficulty: string;
  avgTimePerQuestion: number;
}

// ─── Helpers ───

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

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-20 w-full" />
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

// ─── Phase 2 computation (pure function) ───

function computePhase2(
  attempts: Attempt[],
  allQuestions: Question[],
  allTopics: { id: string; name: string; subject: string; grade: string; status: string }[],
  diagnosticResult: any | null,
  avgTimePerQuestion: number,
): Phase2Data {
  const questions = new Map(allQuestions.map(q => [q.id, q]));
  const topicMap = new Map(allTopics.map(t => [t.id, t.name]));

  // Weak topics aggregation
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

  // Adaptive recommendation
  const qMap = new Map(allQuestions.map(q => [q.id, { topicId: q.topicId, difficulty: q.difficulty, status: q.status }]));
  const recommended = getRecommendedTopic(attempts, qMap, topicMap);
  let nextTopic: Phase2Data['nextTopic'] = null;
  if (recommended) {
    const recDiff = getRecommendedDifficulty(attempts, recommended.topicId, qMap);
    nextTopic = { topicId: recommended.topicId, topicName: recommended.topicName, count: recommended.availableQuestions, recommendedDifficulty: recDiff };
  } else if (weakTopics.length > 0) {
    const top = weakTopics[0];
    const availableQ = allQuestions.filter(q => q.topicId === top.topicId && q.status !== 'draft').length;
    const recDiff = getRecommendedDifficulty(attempts, top.topicId, qMap);
    nextTopic = { topicId: top.topicId, topicName: top.label, count: availableQ, recommendedDifficulty: recDiff };
  }

  const globalDifficulty = getRecommendedDifficulty(attempts, undefined, qMap);
  const diagAccuracy = diagnosticResult ? (diagnosticResult.accuracy_rate ?? diagnosticResult.accuracyRate ?? 0) : 0;

  return {
    weakTopics,
    wrongLatest,
    questions,
    allQuestions,
    allTopics,
    diagnosticResult,
    diagnosticAccuracy: diagAccuracy,
    nextTopic,
    hasDiagnostic: !!diagnosticResult,
    recommendedDifficulty: globalDifficulty,
    avgTimePerQuestion,
  };
}

// ─── Main Component ───

export function StudentDashboard({ onNavigateQuestions, onRefazer, onStartTopic }: {
  onNavigateQuestions: () => void;
  onRefazer: (questionId: string) => void;
  onStartTopic: (topicId: string, difficulty?: string) => void;
}) {
  const { user, waitForAuthReady } = useAuth();
  const userId = user?.username ?? '';

  const [phase1, setPhase1] = useState<Phase1Data | null>(null);
  const [phase2, setPhase2] = useState<Phase2Data | null>(null);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);
  const [phase1Loading, setPhase1Loading] = useState(true);
  const [phase2Loading, setPhase2Loading] = useState(true);
  const [showDiagnosticNow, setShowDiagnosticNow] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadIdRef = useRef(0);
  const isInitialLoadRef = useRef(true); // true until first successful phase1

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const stale = () => !mountedRef.current || loadId !== loadIdRef.current;

    console.log(`[Dashboard] load() called (loadId=${loadId})`);

    // Wait for auth to be ready (no-op if gate is already resolved)
    try {
      console.log('[Dashboard] waitForAuthReady entered');
      await waitForAuthReady();
      console.log('[Dashboard] waitForAuthReady resolved ✅');
    } catch {
      console.warn('[Dashboard] waitForAuthReady failed');
    }
    if (stale()) { console.log('[Dashboard] stale after auth wait, aborting'); return; }

    // ─── PHASE 1: Essential data (4 queries, max concurrency = 4) ───
    const isRefresh = !isInitialLoadRef.current; // already have data?
    const hasPreviousData = phase1 !== null;

    if (!isRefresh) {
      setPhase1Loading(true);
    }
    setPhase1Error(null);
    setRefreshWarning(null);

    // Safety timeout: if Phase 1 takes >25s, force-exit loading
    const safetyTimer = setTimeout(() => {
      if (stale()) return;
      console.error('[Dashboard] ⚠️ PHASE 1 SAFETY TIMEOUT (25s)');
      releaseRefreshLock();
      if (hasPreviousData) {
        console.log('[Dashboard] preserving previous data after safety timeout');
        setRefreshWarning('Não foi possível atualizar os dados. Mostrando última versão.');
        setPhase1Loading(false);
      } else {
        setPhase1Loading(false);
        setPhase2Loading(false);
        setPhase1Error('Não foi possível carregar os dados. Verifique sua conexão.');
      }
    }, 25_000);

    try {
      console.log('[Dashboard] Phase 1 started — 4 essential queries');
      acquireRefreshLock();
      console.log('[Dashboard] 🔒 refresh lock acquired');
      const t0 = Date.now();

      const QUERY_TIMEOUT = 15_000; // 15s per individual query

      const timedQuery = <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<{ name: string; value: T; ok: boolean }> => {
        const start = Date.now();
        console.log(`[Dashboard][Phase1] ⏱ ${name} — START`);
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            console.error(`[Dashboard][Phase1] ⏰ ${name} — TIMEOUT after ${QUERY_TIMEOUT}ms, using fallback`);
            resolve({ name, value: fallback, ok: false });
          }, QUERY_TIMEOUT);

          fn()
            .then((result) => {
              clearTimeout(timer);
              console.log(`[Dashboard][Phase1] ✅ ${name} — OK in ${Date.now() - start}ms`);
              resolve({ name, value: result, ok: true });
            })
            .catch((err: any) => {
              clearTimeout(timer);
              console.error(`[Dashboard][Phase1] ❌ ${name} — FAIL in ${Date.now() - start}ms:`, err?.message);
              resolve({ name, value: fallback, ok: false });
            });
        });
      };

      const defaultMeta: DashboardMeta = { streak: 0, lastAttemptDate: null, lastFilters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' } };

      const [attemptsR, notebookR, metaR, dailyR] = await Promise.all([
        timedQuery('getAttempts', () => getAttempts(userId), [] as Attempt[]),
        timedQuery('getNotebook', () => getNotebook(userId), []),
        timedQuery('getStudentDashboardMeta', () => getStudentDashboardMeta(userId), defaultMeta),
        timedQuery('getDailyStudyStats', () => getDailyStudyStats(userId), null),
      ]);

      const allOk = [attemptsR, notebookR, metaR, dailyR].every(r => r.ok);
      const anyOk = [attemptsR, notebookR, metaR, dailyR].some(r => r.ok);
      const failedNames = [attemptsR, notebookR, metaR, dailyR].filter(r => !r.ok).map(r => r.name);
      console.log(`[Dashboard] Phase 1 done in ${Date.now() - t0}ms — ${allOk ? 'ALL OK ✅' : `⚠️ fallback used for: ${failedNames.join(', ')}`}`);

      releaseRefreshLock();
      console.log('[Dashboard] 🔓 refresh lock released');

      clearTimeout(safetyTimer);
      if (stale()) return;

      // ─── Stale-while-revalidate: if refresh failed, preserve previous data ───
      if (!allOk && hasPreviousData && !anyOk) {
        console.log('[Dashboard] ⚡ all queries failed on refresh — preserving previous phase1 snapshot');
        setRefreshWarning('Não foi possível atualizar os dados. Mostrando última versão.');
        setPhase1Loading(false);
        return; // keep existing phase1 & phase2 intact
      }

      // If it's a refresh with partial failure, use previous values for failed queries
      const attempts = attemptsR.ok ? attemptsR.value : (hasPreviousData ? phase1!.allAttempts : attemptsR.value);
      const notebook = notebookR.ok ? notebookR.value : (hasPreviousData ? (() => { console.log('[Dashboard] skipping empty fallback for notebook — using previous data'); return null; })() : notebookR.value);
      const meta = metaR.ok ? metaR.value : (hasPreviousData ? phase1!.meta : metaR.value);
      const dailyStats = dailyR.ok ? dailyR.value : (hasPreviousData ? { totalSeconds: phase1!.studyTodaySeconds, questionsAnswered: phase1!.questionsToday } : dailyR.value);

      // For notebook, if we're reusing previous data, reuse the counts
      const usePreviousNotebook = !notebookR.ok && hasPreviousData;
      const answered = attempts.length;
      const correct = attempts.filter(a => a.isCorrect).length;
      const rate = answered ? Math.round((correct / answered) * 100) : 0;
      const pendingCount = usePreviousNotebook ? phase1!.pendingCount : (notebook ? notebook.filter((i: any) => i.status === 'pending').length : 0);
      const masteredCount = usePreviousNotebook ? phase1!.masteredCount : (notebook ? notebook.filter((i: any) => i.status === 'mastered').length : 0);
      const totalReviewed = usePreviousNotebook ? phase1!.totalReviewed : (notebook ? notebook.length : 0);

      setPhase1({
        answered, correct, rate, pendingCount, masteredCount, totalReviewed,
        meta,
        allAttempts: attempts,
        studyTodaySeconds: dailyStats?.totalSeconds ?? 0,
        questionsToday: dailyStats?.questionsAnswered ?? 0,
      });
      isInitialLoadRef.current = false;
      setPhase1Loading(false);
      if (!allOk) {
        console.warn(`[Dashboard] Phase 1 partial — failed: ${failedNames.join(', ')}. Using previous data for failed queries.`);
        setRefreshWarning('Alguns dados podem estar desatualizados.');
      }
      console.log('[Dashboard] Phase 1 done ✅ — rendering main UI');

      // ─── PHASE 2: Secondary data (5 queries, cached where possible) ───
      console.log('[Dashboard] Phase 2 started — secondary/cached queries');

      // Group into 2 batches to limit concurrency
      // Batch A: cached data (topics + questions + slugs) — likely instant from cache
      const [allTopics, allQuestions, allowedSlugs] = await Promise.all([
        cachedFetch(CACHE_KEYS.TOPICS, () => getTopics({ activeOnly: true })),
        cachedFetch(CACHE_KEYS.QUESTION_BANK, () => loadQuestionBank()),
        cachedFetch(CACHE_KEYS.ALLOWED_SLUGS(userId), () => getAllowedSubjectSlugs(userId)),
      ]);

      if (stale()) return;

      // Batch B: remaining user-specific data (2 queries)
      const [diagResult, avgTime] = await Promise.all([
        getDiagnosticResult(userId),
        getAverageTimePerQuestion(userId),
      ]);

      if (stale()) return;

      // Filter by allowed subjects
      const filteredTopics = allTopics.filter((t: any) => allowedSlugs.includes(t.subject));
      const filteredQuestions = allQuestions.filter((q: any) => allowedSlugs.includes(q.subject));

      const p2 = computePhase2(attempts, filteredQuestions, filteredTopics as any, diagResult, avgTime);
      setPhase2(p2);
      setPhase2Loading(false);
      console.log('[Dashboard] Phase 2 done ✅');

    } catch (err: any) {
      releaseRefreshLock();
      clearTimeout(safetyTimer);
      if (stale()) return;
      console.error('[Dashboard] ❌ Load error:', err?.message);
      if (hasPreviousData) {
        console.log('[Dashboard] partial refresh failed, preserving current UI');
        setRefreshWarning('Ocorreu um erro ao atualizar. Mostrando última versão.');
        setPhase1Loading(false);
      } else {
        setPhase1Error(err?.message === 'TIMEOUT'
          ? 'Não foi possível carregar os dados. Verifique sua conexão.'
          : 'Ocorreu um erro ao carregar os dados.');
        setPhase1Loading(false);
        setPhase2Loading(false);
      }
    }
  }, [userId, waitForAuthReady]);

  useEffect(() => { load(); }, [load]);
  useVisibilityRefresh(load, 60_000); // only dashboard refreshes on tab return (60s threshold)

  // ─── Render states ───

  if (phase1Error) return <LoadingTimeout error={phase1Error} onRetry={load} />;
  if (phase1Loading || !phase1) return <p className="text-muted-foreground">Carregando painel...</p>;

  if (showDiagnosticNow) {
    return (
      <div className="max-w-3xl mx-auto">
        <DiagnosticAssessment onComplete={() => { setShowDiagnosticNow(false); load(); }} />
      </div>
    );
  }

  const hasData = phase1.answered > 0;
  const hasDiagnostic = phase2?.hasDiagnostic ?? false;

  return (
    <div className="space-y-6">
      {/* Diagnostic CTA - only if not done yet */}
      {!phase2Loading && !hasDiagnostic && (
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

      {/* Stats Cards — Phase 1 data (always available) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Respondidas" value={String(phase1.answered)} color="bg-primary" />
        <StatCard icon={TrendingUp} label="Acertos" value={`${phase1.rate}%`} color="bg-success" />
        <StatCard icon={Flame} label="Sequência" value={`${phase1.meta.streak} dia${phase1.meta.streak === 1 ? '' : 's'}`} color="bg-gold" />
        <StatCard icon={AlertCircle} label="Pendências" value={String(phase1.pendingCount)} color="bg-destructive" />
      </div>

      {/* Today's Study Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Estudo hoje" value={formatStudyTime(phase1.studyTodaySeconds)} color="bg-[hsl(var(--primary))]" />
        <StatCard icon={BookOpen} label="Questões hoje" value={String(phase1.questionsToday)} color="bg-[hsl(var(--accent))]" />
        {phase2 ? (
          <StatCard icon={Timer} label="Tempo médio/questão" value={phase2.avgTimePerQuestion > 0 ? `${phase2.avgTimePerQuestion}s` : '—'} color="bg-[hsl(var(--muted-foreground))]" />
        ) : (
          <div className="bg-card rounded-xl shadow-sm p-5"><Skeleton className="h-10 w-full" /></div>
        )}
        <StatCard icon={Flame} label="Dias estudando" value={`${phase1.meta.streak} dia${phase1.meta.streak === 1 ? '' : 's'}`} color="bg-gold" />
      </div>

      {/* CONTINUAR TREINO - Primary CTA (Phase 2 dependent) */}
      {phase2Loading ? (
        <div className="bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20 rounded-xl p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : phase2?.nextTopic ? (
        <div className="bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20 rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Próximo passo recomendado</p>
              <p className="text-lg font-bold text-foreground">{phase2.nextTopic.topicName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {phase2.nextTopic.count} exercícios · Nível: <span className="font-semibold capitalize">{difficultyLabel(phase2.nextTopic.recommendedDifficulty)}</span>
              </p>
            </div>
            <button
              onClick={() => onStartTopic(phase2.nextTopic!.topicId, phase2.nextTopic!.recommendedDifficulty)}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold text-base px-8 py-3 hover:brightness-110 transition-all shadow-md"
            >
              <Play className="h-5 w-5" />
              CONTINUAR TREINO
            </button>
          </div>
        </div>
      ) : !hasData ? (
        <div className="bg-card rounded-xl shadow-sm p-6 text-center">
          <p className="text-muted-foreground mb-3">Comece respondendo questões para ver seu progresso!</p>
          <button onClick={onNavigateQuestions} className="flex items-center gap-2 mx-auto rounded-xl bg-primary text-primary-foreground font-bold text-base px-8 py-3 hover:brightness-110 transition-all shadow-md">
            <Play className="h-5 w-5" />
            COMEÇAR A TREINAR
          </button>
        </div>
      ) : null}

      {/* Study Trail — Phase 1 data */}
      <StudyTrail
        hasDiagnostic={hasDiagnostic}
        diagnosticAccuracy={phase2?.diagnosticAccuracy ?? 0}
        attempts={phase1.allAttempts}
        pendingNotebookCount={phase1.pendingCount}
      />

      {/* Daily Missions */}
      <DailyMissions />

      {/* Phase 2 dependent sections */}
      {phase2Loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : phase2 ? (
        <>
          {/* Diagnostic Report */}
          {phase2.hasDiagnostic && <DiagnosticReport diagnosticResult={phase2.diagnosticResult} attempts={phase1.allAttempts} />}

          {/* Study Plan */}
          <StudyPlan
            attempts={phase1.allAttempts}
            questions={phase2.allQuestions}
            topics={phase2.allTopics as any}
            diagnosticResult={phase2.diagnosticResult}
            onStartTopic={onStartTopic}
          />

          {/* Evolution Chart */}
          <EvolutionChart attempts={phase1.allAttempts} />

          {hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Notebook Summary */}
              <div className="bg-card rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">📓 Caderno de Erros</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-destructive/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-xl font-bold text-destructive">{phase1.pendingCount}</p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Dominados</p>
                    <p className="text-xl font-bold text-success">{phase1.masteredCount}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-foreground">{phase1.totalReviewed}</p>
                  </div>
                </div>
              </div>

              {/* Weak Topics */}
              <div className="bg-card rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Tópicos Fracos (Top 5)</h3>
                {phase2.weakTopics.length > 0 ? (
                  <div className="space-y-2.5">
                    {phase2.weakTopics.map((t, i) => (
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
                  {phase2.wrongLatest.length > 0 ? phase2.wrongLatest.map(a => {
                    const q = phase2.questions.get(a.questionId);
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
          <Achievements attempts={phase1.allAttempts} streak={phase1.meta.streak} />
        </>
      ) : null}
    </div>
  );
}
