import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, getTopics, addAttempt, getAllowedSubjectSlugs } from '../../lib/storage';
import { difficultyLabel } from '../../lib/ui-utils';
import { getRecommendedDifficulty } from '../../lib/adaptive';
import type { Question } from '../../lib/types';
import { Timer, CheckCircle2, XCircle, Play, Square, Target, Zap, Clock } from 'lucide-react';
import { Progress } from '../ui/progress';

const TIMED_DURATION_SECONDS = 300;

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
  const statsRef = useRef({ correct: 0, total: 0, startTime: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const [allQ, topics, slugs] = await Promise.all([
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        userId ? getAllowedSubjectSlugs(userId) : Promise.resolve([]),
      ]);
      const filtered = allQ.filter(q => q.status !== 'draft' && slugs.includes(q.subject));
      setQuestions(shuffleArray(filtered).slice(0, 50));
    } catch { /* handled by empty state */ }
    setLoadingQuestions(false);
  }, [userId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const startTimer = () => {
    statsRef.current = { correct: 0, total: 0, startTime: Date.now() };
    setCurrentIdx(0);
    setSelectedIndex(null);
    setAnswered(false);
    setSecondsLeft(TIMED_DURATION_SECONDS);
    setPhase('active');

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          finishTraining();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishTraining = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const { correct, total, startTime } = statsRef.current;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    setResult({
      totalAnswered: total,
      totalCorrect: correct,
      rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgTimeSeconds: total > 0 ? Math.round(elapsed / total) : 0,
    });
    setPhase('result');
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleAnswer = async (idx: number) => {
    if (answered || !user) return;
    const q = questions[currentIdx];
    if (!q) return;
    const isCorrect = idx === q.correctIndex;
    setSelectedIndex(idx);
    setAnswered(true);

    statsRef.current.total++;
    if (isCorrect) statsRef.current.correct++;

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

    setTimeout(() => {
      if (currentIdx + 1 >= questions.length) {
        finishTraining();
      } else {
        setCurrentIdx(i => i + 1);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 800);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-6 border border-border">
          <div className="w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mx-auto">
            <Timer className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-h2 font-bold text-foreground">Treino Cronometrado</h2>
            <p className="text-body text-muted-foreground mt-2">
              Resolva o máximo de questões em <strong className="text-foreground">5 minutos</strong>. As questões serão sorteadas aleatoriamente.
            </p>
          </div>
          <button
            onClick={startTimer}
            disabled={loadingQuestions || questions.length === 0}
            className="flex items-center gap-2 mx-auto rounded-xl bg-primary text-primary-foreground font-bold text-body px-8 py-3 hover:bg-primary-light transition-all shadow-colored disabled:opacity-40 active:scale-[0.98]"
          >
            <Play className="h-5 w-5" /> {loadingQuestions ? 'Carregando...' : 'Iniciar Treino'}
          </button>
          {!loadingQuestions && questions.length === 0 && (
            <p className="text-caption text-muted-foreground">Nenhuma questão disponível no momento.</p>
          )}
          {loadingQuestions && <p className="text-caption text-muted-foreground">Carregando questões...</p>}
        </div>
      </div>
    );
  }

  // Result phase
  if (phase === 'result' && result) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-6 border border-border">
          <div className="w-16 h-16 rounded-2xl bg-gold-soft flex items-center justify-center mx-auto">
            <Zap className="h-8 w-8 text-gold" />
          </div>
          <h2 className="text-h2 font-bold text-foreground">Resultado do Treino</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-xl p-4">
              <p className="text-caption text-muted-foreground">Questões</p>
              <p className="text-h1 font-bold text-foreground">{result.totalAnswered}</p>
            </div>
            <div className="bg-success-soft rounded-xl p-4">
              <p className="text-caption text-muted-foreground">Acertos</p>
              <p className="text-h1 font-bold text-success">{result.rate}%</p>
            </div>
            <div className="bg-primary-soft rounded-xl p-4">
              <p className="text-caption text-muted-foreground">Corretas</p>
              <p className="text-h1 font-bold text-primary">{result.totalCorrect}</p>
            </div>
            <div className="bg-gold-soft rounded-xl p-4">
              <p className="text-caption text-muted-foreground">Tempo médio</p>
              <p className="text-h1 font-bold text-gold">{result.avgTimeSeconds}s</p>
            </div>
          </div>
          <button onClick={() => { loadQuestions(); setPhase('setup'); }}
            className="rounded-xl bg-primary text-primary-foreground font-bold text-body px-8 py-3 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]">
            Treinar novamente
          </button>
        </div>
      </div>
    );
  }

  // Active phase
  const q = questions[currentIdx];
  if (!q) { finishTraining(); return null; }

  const progressPct = (secondsLeft / TIMED_DURATION_SECONDS) * 100;
  const isUrgent = secondsLeft <= 30;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Timer bar */}
      <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Timer className={`h-5 w-5 ${isUrgent ? 'text-destructive status-pulse' : 'text-primary'}`} />
            <span className={`text-h2 font-bold font-mono ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
              {formatTime(secondsLeft)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-caption text-muted-foreground">
              <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {statsRef.current.total}</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {statsRef.current.correct}</span>
            </div>
            <button onClick={finishTraining} className="rounded-lg text-caption font-semibold border border-border px-3 py-1.5 hover:bg-muted transition-all flex items-center gap-1 active:scale-[0.98]">
              <Square className="h-3 w-3" /> Encerrar
            </button>
          </div>
        </div>
        <Progress value={progressPct} className="h-2" indicatorClassName={isUrgent ? 'bg-destructive' : 'bg-primary'} />
      </div>

      {/* Question */}
      <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
        <p className="text-caption text-muted-foreground mb-3 uppercase tracking-wide">
          Questão {currentIdx + 1} · {difficultyLabel(q.difficulty)}
        </p>
        {q.imageUrl && (
          <div className="mt-2 mb-4">
            <img src={q.imageUrl} alt={q.imageAlt || 'Imagem da questão'} className="max-w-full rounded-lg border border-border" />
          </div>
        )}
        <p className="text-body text-foreground leading-relaxed mb-5">{q.statement}</p>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isSelected = selectedIndex === i;
            const isCorrect = i === q.correctIndex;
            let optClass = 'border-border hover:border-primary/50 hover:bg-primary-soft cursor-pointer';
            if (answered) {
              if (isCorrect) optClass = 'border-success bg-success-soft';
              else if (isSelected && !isCorrect) optClass = 'border-destructive bg-destructive-soft';
              else optClass = 'border-border opacity-50';
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`w-full text-left rounded-xl border-2 p-3.5 text-body transition-all flex items-center gap-3 ${optClass}`}
              >
                <span className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-caption font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
