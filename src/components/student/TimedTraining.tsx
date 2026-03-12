import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, addAttempt, getAllowedSubjectSlugs } from '../../lib/storage';
import { difficultyLabel } from '../../lib/ui-utils';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { cachedFetch, CACHE_KEYS } from '../../lib/cache';
import type { Question } from '../../lib/types';
import { Timer, CheckCircle2, XCircle, Play, Square, RefreshCw } from 'lucide-react';

const TIMED_DURATION_SECONDS = 300; // 5 minutes
const MAX_TIMED_QUESTIONS = 50;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface TimedResult {
  totalAnswered: number;
  totalCorrect: number;
  rate: number;
  avgTimeSeconds: number;
}

export function TimedTraining({ onQuestionAnswered }: { onQuestionAnswered?: () => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [phase, setPhase] = useState<'setup' | 'active' | 'result'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMED_DURATION_SECONDS);
  const [result, setResult] = useState<TimedResult | null>(null);
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false);

  const { loading: loadingQuestions, error: loadError, execute } = useLoadWithTimeout();

  const statsRef = useRef({ correct: 0, total: 0, startTime: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const clearRunningTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const finishTraining = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearRunningTimers();
    const { correct, total, startTime } = statsRef.current;
    const elapsed = startTime > 0 ? Math.round((Date.now() - startTime) / 1000) : 0;
    setResult({
      totalAnswered: total,
      totalCorrect: correct,
      rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgTimeSeconds: total > 0 ? Math.round(elapsed / total) : 0,
    });
    setPhase('result');
  }, [clearRunningTimers]);

  const loadQuestions = useCallback(async () => {
    setLoadedAtLeastOnce(false);

    await execute(async () => {
      const [allQuestions, allowedSlugs] = await Promise.all([
        loadQuestionBank(),
        userId ? getAllowedSubjectSlugs(userId) : Promise.resolve([]),
      ]);

      const filtered = allQuestions.filter(
        (q) => q.status !== 'draft' && allowedSlugs.includes(q.subject)
      );

      setQuestions(shuffleArray(filtered).slice(0, MAX_TIMED_QUESTIONS));
      setLoadedAtLeastOnce(true);
    });
  }, [userId, execute]);

  useEffect(() => {
    finishedRef.current = false;
    clearRunningTimers();
    setPhase('setup');
    setResult(null);
    setCurrentIdx(0);
    setSelectedIndex(null);
    setAnswered(false);
    setSecondsLeft(TIMED_DURATION_SECONDS);
    statsRef.current = { correct: 0, total: 0, startTime: 0 };
    loadQuestions();

    return () => {
      clearRunningTimers();
    };
  }, [loadQuestions, clearRunningTimers]);

  useVisibilityRefresh(loadQuestions, 120_000); // refresh after 2min hidden

  const startTimer = useCallback(() => {
    if (loadingQuestions || !!loadError || questions.length === 0) return;

    finishedRef.current = false;
    clearRunningTimers();
    statsRef.current = { correct: 0, total: 0, startTime: Date.now() };
    setCurrentIdx(0);
    setSelectedIndex(null);
    setAnswered(false);
    setSecondsLeft(TIMED_DURATION_SECONDS);
    setResult(null);
    setPhase('active');

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finishTraining();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [questions.length, loadingQuestions, loadError, finishTraining, clearRunningTimers]);

  const handleAnswer = async (idx: number) => {
    if (answered || !user) return;

    const q = questions[currentIdx];
    if (!q) return;

    const isCorrect = idx === q.correctIndex;
    setSelectedIndex(idx);
    setAnswered(true);

    statsRef.current.total += 1;
    if (isCorrect) statsRef.current.correct += 1;

    try {
      await addAttempt({
        userId: user.username,
        questionId: q.id,
        selectedIndex: idx,
        isCorrect,
        answeredAt: new Date().toISOString(),
        topicId: q.topicId,
        timeSpentSeconds: 0,
        possibleGuess: false,
        difficultyDetected: false,
        attemptNumber: 1,
      });
      onQuestionAnswered?.();
    } catch (error) {
      console.error('[TimedTraining] erro ao salvar tentativa:', error);
    } finally {
      if (finishedRef.current) return;
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = setTimeout(() => {
        if (finishedRef.current) return;
        if (currentIdx + 1 >= questions.length) {
          finishTraining();
        } else {
          setCurrentIdx((i) => i + 1);
          setSelectedIndex(null);
          setAnswered(false);
        }
      }, 800);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (phase === 'setup') {
    if (loadError) return <LoadingTimeout error={loadError} onRetry={loadQuestions} />;

    const noQuestions = loadedAtLeastOnce && !loadingQuestions && questions.length === 0;

    return (
      <div className="max-w-lg mx-auto bg-card rounded-xl shadow-sm p-8 text-center space-y-4">
        <Timer className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Treino Cronometrado</h2>
        <p className="text-sm text-muted-foreground">
          Resolva o máximo de questões em <strong>5 minutos</strong>. As questões serão sorteadas aleatoriamente.
        </p>

        <button
          onClick={startTimer}
          disabled={loadingQuestions || questions.length === 0}
          className="flex items-center gap-2 mx-auto rounded-xl bg-primary text-primary-foreground font-bold text-base px-8 py-3 hover:brightness-110 transition-all shadow-md disabled:opacity-40"
        >
          <Play className="h-5 w-5" /> Iniciar Treino
        </button>

        {loadingQuestions && <p className="text-xs text-muted-foreground">Carregando questões...</p>}

        {noQuestions && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">Nenhuma questão disponível para iniciar o treino.</p>
            <button
              onClick={loadQuestions}
              className="inline-flex items-center gap-2 rounded-lg text-xs border border-border px-3 py-1.5 hover:bg-muted transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="max-w-lg mx-auto bg-card rounded-xl shadow-sm p-8 text-center space-y-6">
        <h2 className="text-xl font-bold text-foreground">⏱️ Resultado do Treino</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Questões</p>
            <p className="text-2xl font-bold text-foreground">{result.totalAnswered}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Acertos</p>
            <p className="text-2xl font-bold text-success">{result.rate}%</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Corretas</p>
            <p className="text-2xl font-bold text-primary">{result.totalCorrect}</p>
          </div>
          <div className="bg-gold/10 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Tempo médio</p>
            <p className="text-2xl font-bold text-gold">{result.avgTimeSeconds}s</p>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setResult(null);
              setPhase('setup');
              loadQuestions();
            }}
            className="rounded-xl bg-primary text-primary-foreground font-bold text-sm px-6 py-2.5 hover:brightness-110 transition-all"
          >
            Treinar novamente
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) {
    return (
      <div className="max-w-lg mx-auto bg-card rounded-xl shadow-sm p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Não há questões disponíveis para este treino.</p>
        <button
          onClick={() => {
            setPhase('setup');
            loadQuestions();
          }}
          className="inline-flex items-center gap-2 rounded-lg text-sm border border-border px-4 py-2 hover:bg-muted transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Recarregar questões
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-card rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Timer className={`h-5 w-5 ${secondsLeft <= 30 ? 'text-destructive animate-pulse' : 'text-primary'}`} />
            <span className={`text-lg font-bold ${secondsLeft <= 30 ? 'text-destructive' : 'text-foreground'}`}>
              {formatTime(secondsLeft)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {statsRef.current.total} respondidas · {statsRef.current.correct} corretas
            </span>
            <button
              onClick={finishTraining}
              className="rounded-lg text-xs border border-border px-3 py-1 hover:bg-muted transition-all flex items-center gap-1"
            >
              <Square className="h-3 w-3" /> Encerrar
            </button>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${secondsLeft <= 30 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${(secondsLeft / TIMED_DURATION_SECONDS) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm p-6">
        <p className="text-xs text-muted-foreground mb-3">
          Questão {currentIdx + 1} · {difficultyLabel(q.difficulty)}
        </p>
        <p className="text-sm text-foreground leading-relaxed mb-4">{q.statement}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isSelected = selectedIndex === i;
            const isCorrect = i === q.correctIndex;
            let optClass = 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer';
            if (answered) {
              if (isCorrect) optClass = 'border-success bg-success/10';
              else if (isSelected && !isCorrect) optClass = 'border-destructive bg-destructive/10';
              else optClass = 'border-border opacity-50';
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-all flex items-center gap-2 ${optClass}`}
              >
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {answered && isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                {answered && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
