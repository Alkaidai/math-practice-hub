import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, getTopics, addAttempt, getAllowedSubjectSlugs } from '../../lib/storage';
import { difficultyLabel } from '../../lib/ui-utils';
import { getRecommendedDifficulty } from '../../lib/adaptive';
import type { Question } from '../../lib/types';
import { Timer, CheckCircle2, XCircle, Play, Square } from 'lucide-react';

const TIMED_DURATION_SECONDS = 300; // 5 minutes

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

  const loadQuestions = useCallback(async () => {
    const [allQ, topics, slugs] = await Promise.all([
      loadQuestionBank(),
      getTopics({ activeOnly: true }),
      userId ? getAllowedSubjectSlugs(userId) : Promise.resolve([]),
    ]);
    const filtered = allQ.filter(q => q.status !== 'draft' && slugs.includes(q.subject));
    setQuestions(shuffleArray(filtered).slice(0, 50));
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

    // Auto-advance after 1s
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
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto bg-card rounded-xl shadow-sm p-8 text-center space-y-4">
        <Timer className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Treino Cronometrado</h2>
        <p className="text-sm text-muted-foreground">
          Resolva o máximo de questões em <strong>5 minutos</strong>. As questões serão sorteadas aleatoriamente.
        </p>
        <button
          onClick={startTimer}
          disabled={questions.length === 0}
          className="flex items-center gap-2 mx-auto rounded-xl bg-primary text-primary-foreground font-bold text-base px-8 py-3 hover:brightness-110 transition-all shadow-md disabled:opacity-40"
        >
          <Play className="h-5 w-5" /> Iniciar Treino
        </button>
        {questions.length === 0 && <p className="text-xs text-muted-foreground">Carregando questões...</p>}
      </div>
    );
  }

  // Result phase
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
          <button onClick={() => { loadQuestions(); setPhase('setup'); }}
            className="rounded-xl bg-primary text-primary-foreground font-bold text-sm px-6 py-2.5 hover:brightness-110 transition-all">
            Treinar novamente
          </button>
        </div>
      </div>
    );
  }

  // Active phase
  const q = questions[currentIdx];
  if (!q) { finishTraining(); return null; }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Timer bar */}
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
            <button onClick={finishTraining} className="rounded-lg text-xs border border-border px-3 py-1 hover:bg-muted transition-all flex items-center gap-1">
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

      {/* Question */}
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
