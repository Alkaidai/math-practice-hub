import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDiagnosticResult, getAttempts, getNotebook } from '../../lib/storage';

interface TrailStep {
  icon: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  detail: string;
}

export function StudyTrail() {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [steps, setSteps] = useState<TrailStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [diag, attempts, notebook] = await Promise.all([
        getDiagnosticResult(userId),
        getAttempts(userId),
        getNotebook(userId),
      ]);

      const hasDiag = !!diag;
      const hasAttempts = attempts.length > 0;
      const pendingNotebook = notebook.filter(n => n.status === 'pending').length;

      const trail: TrailStep[] = [
        {
          icon: '🎯',
          label: 'Diagnóstico',
          status: hasDiag ? 'done' : 'current',
          detail: hasDiag ? `Concluído · ${(diag as any).accuracy_rate ?? (diag as any).accuracyRate ?? 0}% de acerto` : 'Realize o diagnóstico inicial',
        },
        {
          icon: '📚',
          label: 'Tópicos recomendados',
          status: hasDiag ? (hasAttempts ? 'done' : 'current') : 'pending',
          detail: hasDiag ? 'Plano de estudo gerado' : 'Disponível após o diagnóstico',
        },
        {
          icon: '✏️',
          label: 'Exercícios',
          status: hasAttempts ? 'done' : 'pending',
          detail: hasAttempts ? `${attempts.length} exercícios respondidos` : 'Resolva os exercícios recomendados',
        },
        {
          icon: '📓',
          label: 'Revisão',
          status: pendingNotebook > 0 ? 'current' : (hasAttempts ? 'done' : 'pending'),
          detail: pendingNotebook > 0 ? `${pendingNotebook} erros pendentes para revisar` : 'Revise seus erros no caderno',
        },
      ];

      setSteps(trail);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase mb-3">🗺️ Trilha de Estudo</h3>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 flex items-center justify-center text-lg border-2 ${
                step.status === 'done' ? 'border-green-500 bg-green-500/10' :
                step.status === 'current' ? 'border-primary bg-primary/10' :
                'border-border bg-muted'
              }`}>
                {step.icon}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 ${step.status === 'done' ? 'bg-green-500' : 'bg-border'}`} />
              )}
            </div>
            <div className="pb-3">
              <p className={`font-heading text-xs font-bold ${step.status === 'done' ? 'text-green-600' : step.status === 'current' ? 'text-primary' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              <p className="font-heading text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
