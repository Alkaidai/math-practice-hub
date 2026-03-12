import { CheckCircle2, Circle } from 'lucide-react';
import type { Attempt, NotebookItem } from '../../lib/types';

interface TrailStep {
  icon: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  detail: string;
}

interface StudyTrailProps {
  hasDiagnostic: boolean;
  diagnosticAccuracy?: number;
  attempts: Attempt[];
  pendingNotebookCount: number;
}

export function StudyTrail({ hasDiagnostic, diagnosticAccuracy, attempts, pendingNotebookCount }: StudyTrailProps) {
  const hasAttempts = attempts.length > 0;

  const steps: TrailStep[] = [
    {
      icon: '🎯', label: 'Diagnóstico',
      status: hasDiagnostic ? 'done' : 'current',
      detail: hasDiagnostic ? `Concluído · ${diagnosticAccuracy ?? 0}% de acerto` : 'Realize o diagnóstico inicial',
    },
    {
      icon: '📚', label: 'Tópicos recomendados',
      status: hasDiagnostic ? (hasAttempts ? 'done' : 'current') : 'pending',
      detail: hasDiagnostic ? 'Plano de estudo gerado' : 'Disponível após o diagnóstico',
    },
    {
      icon: '✏️', label: 'Exercícios',
      status: hasAttempts ? 'done' : 'pending',
      detail: hasAttempts ? `${attempts.length} exercícios respondidos` : 'Resolva os exercícios recomendados',
    },
    {
      icon: '📓', label: 'Revisão',
      status: pendingNotebookCount > 0 ? 'current' : (hasAttempts ? 'done' : 'pending'),
      detail: pendingNotebookCount > 0 ? `${pendingNotebookCount} erros pendentes para revisar` : 'Revise seus erros no caderno',
    },
  ];

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">🗺️ Trilha de Estudo</h3>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                step.status === 'done' ? 'bg-success/10 text-success' :
                step.status === 'current' ? 'bg-primary/10 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {step.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> :
                 <Circle className="h-5 w-5" />}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-8 ${step.status === 'done' ? 'bg-success/30' : 'bg-border'}`} />
              )}
            </div>
            <div className="pb-4 pt-1.5">
              <p className={`text-sm font-medium ${step.status === 'done' ? 'text-success' : step.status === 'current' ? 'text-primary' : 'text-muted-foreground'}`}>
                {step.icon} {step.label}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
