import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  error: string | null;
  onRetry: () => void;
  loadingMessage?: string;
}

export function LoadingTimeout({ error, onRetry, loadingMessage }: Props) {
  const { logout } = useAuth();

  if (error === 'session_expired') {
    return (
      <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm font-semibold text-foreground">Sua sessão expirou</p>
        <p className="text-xs text-muted-foreground">Faça login novamente para continuar.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg text-sm font-medium border border-border px-4 py-2 hover:bg-muted transition-all">
            <RefreshCw className="h-4 w-4" />Tentar novamente
          </button>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground px-5 py-2 hover:brightness-110 transition-all">
            <LogIn className="h-4 w-4" />Entrar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-3">
      <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
      <p className="text-sm font-medium text-foreground">
        {error || loadingMessage || 'Não foi possível carregar os dados.'}
      </p>
      <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground px-5 py-2 hover:brightness-110 transition-all">
        <RefreshCw className="h-4 w-4" />Tentar novamente
      </button>
    </div>
  );
}
