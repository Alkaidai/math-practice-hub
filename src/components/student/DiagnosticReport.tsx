import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDiagnosticResult, getTopics, getAttempts } from '../../lib/storage';
import { Progress } from '../ui/progress';
import type { Topic } from '../../lib/types';

interface TopicBreakdown {
  topicId: string;
  topicName: string;
  total: number;
  correct: number;
  rate: number;
}

interface DiagResult {
  totalQuestions: number;
  correctAnswers: number;
  accuracyRate: number;
  topicBreakdown: TopicBreakdown[];
  strengths: string[];
  weaknesses: string[];
  recommendedPlan: { focusTopics: string[]; level: string };
}

export function DiagnosticReport() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [result, setResult] = useState<DiagResult | null>(null);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [raw, attempts] = await Promise.all([
        getDiagnosticResult(userId),
        getAttempts(userId),
      ]);
      if (raw) {
        const r = raw as any;
        setResult({
          totalQuestions: r.total_questions ?? r.totalQuestions ?? 0,
          correctAnswers: r.correct_answers ?? r.correctAnswers ?? 0,
          accuracyRate: r.accuracy_rate ?? r.accuracyRate ?? 0,
          topicBreakdown: (r.topic_breakdown ?? r.topicBreakdown ?? []) as TopicBreakdown[],
          strengths: (r.strengths ?? []) as string[],
          weaknesses: (r.weaknesses ?? []) as string[],
          recommendedPlan: (r.recommended_plan ?? r.recommendedPlan ?? { focusTopics: [], level: 'iniciante' }),
        });
      }
      if (attempts.length > 0) {
        const correct = attempts.filter(a => a.isCorrect).length;
        setCurrentRate(Math.round((correct / attempts.length) * 100));
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;
  if (!result) return null;

  const levelColor = result.recommendedPlan.level === 'avançado' ? 'text-green-600' : result.recommendedPlan.level === 'intermediário' ? 'text-yellow-600' : 'text-destructive';

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase mb-3">📊 Relatório do Diagnóstico</h3>
      
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

      <p className="font-heading text-xs font-bold mb-3">
        Nível identificado: <span className={`uppercase ${levelColor}`}>{result.recommendedPlan.level}</span>
      </p>

      {currentRate !== null && (
        <div className="border border-border p-3 mb-4">
          <p className="font-heading text-xs text-muted-foreground mb-1">Evolução desde o diagnóstico</p>
          <div className="flex items-center gap-3">
            <span className="font-heading text-sm text-muted-foreground">Diagnóstico: {result.accuracyRate}%</span>
            <span className="font-heading text-sm text-foreground">→</span>
            <span className={`font-heading text-sm font-bold ${currentRate > result.accuracyRate ? 'text-green-600' : 'text-foreground'}`}>
              Atual: {currentRate}%
            </span>
          </div>
          <Progress value={currentRate} className="h-2 mt-2" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.strengths.length > 0 && (
          <div className="border border-border p-3">
            <p className="font-heading text-xs font-bold text-green-600 mb-2">✅ Pontos fortes</p>
            <ul className="space-y-1">
              {result.strengths.slice(0, 5).map((s, i) => (
                <li key={i} className="font-body text-sm text-foreground">• {s}</li>
              ))}
            </ul>
          </div>
        )}
        {result.weaknesses.length > 0 && (
          <div className="border border-border p-3">
            <p className="font-heading text-xs font-bold text-destructive mb-2">⚠️ Pontos a melhorar</p>
            <ul className="space-y-1">
              {result.weaknesses.slice(0, 5).map((w, i) => (
                <li key={i} className="font-body text-sm text-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
