import { useMemo } from 'react';
import { Progress } from '../ui/progress';
import type { Attempt } from '../../lib/types';
import { BarChart3 } from 'lucide-react';

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
    <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
      <h3 className="text-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        Relatório do Diagnóstico
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-caption text-muted-foreground">Questões</p>
          <p className="text-h2 font-bold text-foreground">{result.totalQuestions}</p>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-caption text-muted-foreground">Acertos</p>
          <p className="text-h2 font-bold text-foreground">{result.correctAnswers}</p>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-caption text-muted-foreground">Aproveitamento</p>
          <p className="text-h2 font-bold text-foreground">{result.accuracyRate}%</p>
        </div>
      </div>

      <p className="text-body font-medium mb-4">
        Nível identificado: <span className={`font-bold uppercase ${levelColor}`}>{result.recommendedPlan.level}</span>
      </p>

      {currentRate !== null && (
        <div className="rounded-xl bg-primary-soft border border-primary/20 p-4 mb-4">
          <p className="text-caption text-muted-foreground mb-2">Evolução desde o diagnóstico</p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-body text-muted-foreground">Diagnóstico: {result.accuracyRate}%</span>
            <span className="text-body text-foreground">→</span>
            <span className={`text-body font-bold ${currentRate > result.accuracyRate ? 'text-success' : 'text-foreground'}`}>
              Atual: {currentRate}%
            </span>
          </div>
          <Progress value={currentRate} className="h-2" indicatorClassName={currentRate > result.accuracyRate ? 'bg-success' : ''} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.strengths.length > 0 && (
          <div className="rounded-xl bg-success-soft border border-success/20 p-4">
            <p className="text-caption font-semibold text-success mb-2 flex items-center gap-1">Pontos fortes</p>
            <ul className="space-y-1">
              {result.strengths.slice(0, 5).map((s, i) => (
                <li key={i} className="text-body text-foreground">• {s}</li>
              ))}
            </ul>
          </div>
        )}
        {result.weaknesses.length > 0 && (
          <div className="rounded-xl bg-destructive-soft border border-destructive/20 p-4">
            <p className="text-caption font-semibold text-destructive mb-2 flex items-center gap-1">Pontos a melhorar</p>
            <ul className="space-y-1">
              {result.weaknesses.slice(0, 5).map((w, i) => (
                <li key={i} className="text-body text-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
