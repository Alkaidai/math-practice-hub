import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, getTopics, addAttempt, saveDiagnosticResult, getDiagnosticResult, getAppSetting } from '../../lib/storage';
import { subjectLabel, difficultyLabel, optionLetter } from '../../lib/ui-utils';
import type { Question, Topic } from '../../lib/types';

interface DiagnosticState {
  status: 'checking' | 'not_needed' | 'ready' | 'in_progress' | 'completed';
}

export function DiagnosticAssessment({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [state, setState] = useState<DiagnosticState>({ status: 'checking' });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [selections, setSelections] = useState<Record<number, number>>({}); // questionIdx -> selectedOption
  const [answers, setAnswers] = useState<{ questionId: string; topicId: string; isCorrect: boolean }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const BLOCK_SIZE = 5;

  useEffect(() => {
    async function check() {
      const [enabled, existing] = await Promise.all([
        getAppSetting('diagnostic_enabled'),
        getDiagnosticResult(userId),
      ]);

      if (enabled !== 'true' || existing) {
        setState({ status: 'not_needed' });
        onComplete();
        return;
      }

      // Load questions distributed by topic
      const [allQ, allT] = await Promise.all([loadQuestionBank(), getTopics({ activeOnly: true })]);
      setTopics(allT);

      const published = allQ.filter(q => q.status !== 'draft');
      if (published.length < 10) {
        setState({ status: 'not_needed' });
        onComplete();
        return;
      }

      // Distribute by topic
      const byTopic = new Map<string, Question[]>();
      published.forEach(q => {
        const arr = byTopic.get(q.topicId) ?? [];
        arr.push(q);
        byTopic.set(q.topicId, arr);
      });

      const selected: Question[] = [];
      const topicIds = [...byTopic.keys()];
      const perTopic = Math.max(1, Math.floor(20 / topicIds.length));

      topicIds.forEach(tid => {
        const pool = byTopic.get(tid) ?? [];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        selected.push(...shuffled.slice(0, perTopic));
      });

      // Fill remaining slots randomly
      const usedIds = new Set(selected.map(q => q.id));
      const remaining = published.filter(q => !usedIds.has(q.id)).sort(() => Math.random() - 0.5);
      while (selected.length < 20 && remaining.length > 0) {
        selected.push(remaining.pop()!);
      }

      setQuestions(selected.slice(0, 20));
      setState({ status: 'ready' });
    }
    check();
  }, [userId]);

  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics]);

  const handleConfirm = async () => {
    if (selected === null) return;
    const q = questions[currentIdx];
    const isCorrect = selected === q.correctIndex;

    await addAttempt({ userId, questionId: q.id, selectedIndex: selected, isCorrect, answeredAt: new Date().toISOString(), topicId: q.topicId });

    const newAnswers = [...answers, { questionId: q.id, topicId: q.topicId, isCorrect }];
    setAnswers(newAnswers);
    setSelected(null);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Compute results
      const total = newAnswers.length;
      const correct = newAnswers.filter(a => a.isCorrect).length;
      const rate = Math.round((correct / total) * 100);

      const topicStats = new Map<string, { total: number; correct: number }>();
      newAnswers.forEach(a => {
        const prev = topicStats.get(a.topicId) ?? { total: 0, correct: 0 };
        prev.total += 1;
        if (a.isCorrect) prev.correct += 1;
        topicStats.set(a.topicId, prev);
      });

      const breakdown = [...topicStats.entries()].map(([tid, s]) => ({
        topicId: tid,
        topicName: topicMap.get(tid) ?? tid,
        total: s.total,
        correct: s.correct,
        rate: Math.round((s.correct / s.total) * 100),
      }));

      const strengths = breakdown.filter(b => b.rate >= 70).sort((a, b) => b.rate - a.rate);
      const weaknesses = breakdown.filter(b => b.rate < 70).sort((a, b) => a.rate - b.rate);

      const diagResult = {
        totalQuestions: total,
        correctAnswers: correct,
        accuracyRate: rate,
        topicBreakdown: breakdown,
        strengths: strengths.map(s => s.topicName),
        weaknesses: weaknesses.map(w => w.topicName),
        recommendedPlan: {
          focusTopics: weaknesses.slice(0, 3).map(w => w.topicName),
          level: rate >= 70 ? 'avançado' : rate >= 40 ? 'intermediário' : 'iniciante',
        },
      };

      await saveDiagnosticResult(userId, diagResult);
      setResult(diagResult);
      setShowResults(true);
      setState({ status: 'completed' });
    }
  };

  if (state.status === 'checking') return <p className="font-body text-muted-foreground">Verificando diagnóstico...</p>;
  if (state.status === 'not_needed') return null;

  if (showResults && result) {
    const resultsVisible = true; // will check setting
    return (
      <div className="space-y-4">
        <div className="border border-border bg-card p-4">
          <h2 className="font-heading text-sm font-bold uppercase mb-3">📊 Resultado do Diagnóstico</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="border border-border p-3 text-center">
              <p className="font-heading text-xs text-muted-foreground">Questões</p>
              <p className="font-heading text-xl font-bold text-foreground">{result.totalQuestions}</p>
            </div>
            <div className="border border-border p-3 text-center">
              <p className="font-heading text-xs text-muted-foreground">Acertos</p>
              <p className="font-heading text-xl font-bold text-foreground">{result.correctAnswers}</p>
            </div>
            <div className="border border-border p-3 text-center">
              <p className="font-heading text-xs text-muted-foreground">Aproveitamento</p>
              <p className="font-heading text-xl font-bold text-foreground">{result.accuracyRate}%</p>
            </div>
          </div>

          <div className="mb-3">
            <p className="font-heading text-xs font-bold mb-1">Nível identificado: <span className="text-primary uppercase">{result.recommendedPlan.level}</span></p>
          </div>

          {result.topicBreakdown.length > 0 && (
            <div className="mb-3">
              <h3 className="font-heading text-xs font-bold uppercase mb-2">Desempenho por tópico</h3>
              <div className="space-y-1">
                {result.topicBreakdown.map((t: any) => (
                  <div key={t.topicId} className="flex items-center gap-2 border-b border-border pb-1">
                    <span className="font-body text-sm flex-1">{t.topicName}</span>
                    <span className={`font-heading text-xs font-bold ${t.rate >= 70 ? 'text-green-600' : t.rate >= 40 ? 'text-yellow-600' : 'text-destructive'}`}>
                      {t.rate}% ({t.correct}/{t.total})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.strengths.length > 0 && (
            <div className="mb-2">
              <p className="font-heading text-xs font-bold text-green-600">✅ Pontos fortes: {result.strengths.join(', ')}</p>
            </div>
          )}
          {result.weaknesses.length > 0 && (
            <div className="mb-2">
              <p className="font-heading text-xs font-bold text-destructive">⚠️ Pontos a melhorar: {result.weaknesses.join(', ')}</p>
            </div>
          )}
          {result.recommendedPlan.focusTopics?.length > 0 && (
            <div className="mb-3">
              <p className="font-heading text-xs text-muted-foreground">📌 Recomendação: foque em {result.recommendedPlan.focusTopics.join(', ')}</p>
            </div>
          )}

          <button onClick={onComplete} className="font-heading text-sm bg-primary text-primary-foreground px-4 py-1.5 border border-primary">
            Continuar para o sistema
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'ready') {
    return (
      <div className="space-y-4">
        <div className="border border-border bg-card p-4 text-center">
          <h2 className="font-heading text-lg font-bold text-foreground mb-2">🎯 Diagnóstico Inicial</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">
            Responda {questions.length} questões para identificarmos seus pontos fortes e fracos.
            Isso nos ajudará a personalizar seu aprendizado.
          </p>
          <button onClick={() => setState({ status: 'in_progress' })} className="font-heading text-sm bg-primary text-primary-foreground px-6 py-2 border border-primary">
            Iniciar Diagnóstico
          </button>
        </div>
      </div>
    );
  }

  // In progress
  const q = questions[currentIdx];
  const progress = Math.round(((currentIdx) / questions.length) * 100);

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-heading text-sm font-bold uppercase">Diagnóstico</h2>
          <span className="font-heading text-xs text-muted-foreground">{currentIdx + 1}/{questions.length}</span>
        </div>
        <div className="w-full bg-muted h-2 mb-4">
          <div className="bg-primary h-2 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <h3 className="font-body text-base font-semibold text-foreground mb-2">{q.statement}</h3>
        <p className="font-heading text-xs text-muted-foreground mb-3">
          {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · {topicMap.get(q.topicId) ?? '—'}
        </p>

        <div className="space-y-2 mb-3">
          {q.options.map((opt, i) => (
            <label key={i} className={`border p-2 flex items-center gap-2 cursor-pointer ${selected === i ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input type="radio" checked={selected === i} onChange={() => setSelected(i)} className="accent-primary" />
              <span className="font-heading text-xs font-bold text-primary min-w-[24px]">({optionLetter(i)})</span>
              <span className="font-body text-sm">{opt}</span>
            </label>
          ))}
        </div>

        <button disabled={selected === null} onClick={handleConfirm} className="font-heading text-sm bg-primary text-primary-foreground px-4 py-1.5 border border-primary disabled:opacity-40">
          {currentIdx + 1 < questions.length ? 'Próxima' : 'Finalizar'}
        </button>
      </div>
    </div>
  );
}
