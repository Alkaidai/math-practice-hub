import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-3">
      <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
      <p className="text-sm text-foreground font-medium">
        {message || 'Ocorreu um erro ao carregar os dados.'}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground px-5 py-2 hover:brightness-110 transition-all"
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
