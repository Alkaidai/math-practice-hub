import { AlertCircle, RefreshCw, LogIn, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/** Centralized loading state */
export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 animate-fade-in py-8 justify-center">
      <Loader2 className="h-5 w-5 text-primary animate-spin" />
      <p className="text-body text-muted-foreground">{message}</p>
    </div>
  );
}

/** Centralized empty state */
export function EmptyState({ icon: Icon = Inbox, title, description }: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border animate-fade-in">
      <Icon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      {title && <p className="text-body font-medium text-foreground mb-1">{title}</p>}
      <p className="text-body text-muted-foreground">{description ?? 'Nenhum dado disponível.'}</p>
    </div>
  );
}

/** Centralized error state with session handling */
export function ScreenErrorState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { logout } = useAuth();

  if (error === 'session_expired') {
    return (
      <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-3 animate-fade-in">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-body font-semibold text-foreground">Sua sessão expirou</p>
        <p className="text-caption text-muted-foreground">Faça login novamente para continuar.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl text-caption font-semibold border border-border px-4 py-2 hover:bg-muted transition-all active:scale-[0.98]">
            <RefreshCw className="h-4 w-4" />Tentar novamente
          </button>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl text-caption font-semibold bg-primary text-primary-foreground px-5 py-2 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]">
            <LogIn className="h-4 w-4" />Entrar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center space-y-3 animate-fade-in">
      <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
      <p className="text-body font-medium text-foreground">
        {error || 'Não foi possível carregar os dados. Verifique sua conexão.'}
      </p>
      <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl text-caption font-semibold bg-primary text-primary-foreground px-5 py-2 hover:bg-primary-light transition-all shadow-colored active:scale-[0.98]">
        <RefreshCw className="h-4 w-4" />Tentar novamente
      </button>
    </div>
  );
}
