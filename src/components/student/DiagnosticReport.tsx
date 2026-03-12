import { useMemo } from 'react';
import { Progress } from '../ui/progress';
import type { Attempt } from '../../lib/types';

interface DiagResult {
  totalQuestions: number;
  correctAnswers: number;
  accuracyRate: number;
  topicBreakdown: { topicId: string; topicName: string; total: number; correct: number; rate: number }[];
  strengths: string[];
  weaknesses: string[];
  recommendedPlan: { focusTopics: string[]; level: string };
}

interface DiagnosticReportProps {
  diagnosticResult: any;
  attempts: Attempt[];
}

export function DiagnosticReport({ diagnosticResult, attempts }: DiagnosticReportProps) {
  const result = useMemo<DiagResult | null>(() => {
    if (!diagnosticResult) return null;
    const r = diagnosticResult as any;
    return {
      totalQuestions: r.total_questions ?? r.totalQuestions ?? 0,
      correctAnswers: r.correct_answers ?? r.correctAnswers ?? 0,
      accuracyRate: r.accuracy_rate ?? r.accuracyRate ?? 0,
      topicBreakdown: (r.topic_breakdown ?? r.topicBreakdown ?? []) as any[],
      strengths: (r.strengths ?? []) as string[],
      weaknesses: (r.weaknesses ?? []) as string[],
      recommendedPlan: (r.recommended_plan ?? r.recommendedPlan ?? { focusTopics: [], level: 'iniciante' }),
    };
  }, [diagnosticResult]);

  const currentRate = useMemo(() => {
    if (attempts.length === 0) return null;
    const correct = attempts.filter(a => a.isCorrect).length;
    return Math.round((correct / attempts.length) * 100);
  }, [attempts]);

  if (!result) return null;

  const levelColor = result.recommendedPlan.level === 'avançado' ? 'text-success' : result.recommendedPlan.level === 'intermediário' ? 'text-gold' : 'text-destructive';

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">📊 Relatório do Diagnóstico</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Questões</p>
          <p className="text-xl font-bold text-foreground">{result.totalQuestions}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Acertos</p>
          <p className="text-xl font-bold text-foreground">{result.correctAnswers}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Aproveitamento</p>
          <p className="text-xl font-bold text-foreground">{result.accuracyRate}%</p>
        </div>
      </div>

      <p className="text-sm font-medium mb-4">
        Nível identificado: <span className={`font-bold uppercase ${levelColor}`}>{result.recommendedPlan.level}</span>
      </p>

      {currentRate !== null && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2">Evolução desde o diagnóstico</p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-muted-foreground">Diagnóstico: {result.accuracyRate}%</span>
            <span className="text-sm text-foreground">→</span>
            <span className={`text-sm font-bold ${currentRate > result.accuracyRate ? 'text-success' : 'text-foreground'}`}>
              Atual: {currentRate}%
            </span>
          </div>
          <Progress value={currentRate} className="h-2" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.strengths.length > 0 && (
          <div className="rounded-lg bg-success/5 border border-success/20 p-4">
            <p className="text-xs font-semibold text-success mb-2">✅ Pontos fortes</p>
            <ul className="space-y-1">
              {result.strengths.slice(0, 5).map((s, i) => (
                <li key={i} className="text-sm text-foreground">• {s}</li>
              ))}
            </ul>
          </div>
        )}
        {result.weaknesses.length > 0 && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4">
            <p className="text-xs font-semibold text-destructive mb-2">⚠️ Pontos a melhorar</p>
            <ul className="space-y-1">
              {result.weaknesses.slice(0, 5).map((w, i) => (
                <li key={i} className="text-sm text-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
