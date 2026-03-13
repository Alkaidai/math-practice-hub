import { CheckCircle2, Circle, ClipboardCheck, BookOpen, PenLine, RotateCw } from 'lucide-react';
import type { Attempt, NotebookItem } from '../../lib/types';

interface TrailStep {
  icon: React.ElementType;
  iconColor: string;
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
      icon: ClipboardCheck, iconColor: 'text-primary', label: 'Diagnóstico',
      status: hasDiagnostic ? 'done' : 'current',
      detail: hasDiagnostic ? `Concluído · ${diagnosticAccuracy ?? 0}% de acerto` : 'Realize o diagnóstico inicial',
    },
    {
      icon: BookOpen, iconColor: 'text-info', label: 'Tópicos recomendados',
      status: hasDiagnostic ? (hasAttempts ? 'done' : 'current') : 'pending',
      detail: hasDiagnostic ? 'Plano de estudo gerado' : 'Disponível após o diagnóstico',
    },
    {
      icon: PenLine, iconColor: 'text-gold', label: 'Exercícios',
      status: hasAttempts ? 'done' : 'pending',
      detail: hasAttempts ? `${attempts.length} exercícios respondidos` : 'Resolva os exercícios recomendados',
    },
    {
      icon: RotateCw, iconColor: 'text-success', label: 'Revisão',
      status: pendingNotebookCount > 0 ? 'current' : (hasAttempts ? 'done' : 'pending'),
      detail: pendingNotebookCount > 0 ? `${pendingNotebookCount} erros pendentes para revisar` : 'Revise seus erros no caderno',
    },
  ];

  return (
    <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
      <h3 className="text-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        Minha trilha de estudo
      </h3>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  step.status === 'done' ? 'bg-success-soft' :
                  step.status === 'current' ? 'bg-primary-soft' :
                  'bg-muted'
                }`}>
                  {step.status === 'done' ? <CheckCircle2 className="h-5 w-5 text-success" /> :
                   <StepIcon className={`h-5 w-5 ${step.status === 'current' ? step.iconColor : 'text-muted-foreground'}`} />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-8 ${step.status === 'done' ? 'bg-success/30' : 'bg-border'}`} />
                )}
              </div>
              <div className="pb-4 pt-2">
                <p className={`text-body font-medium ${step.status === 'done' ? 'text-success' : step.status === 'current' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
                <p className="text-caption text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
