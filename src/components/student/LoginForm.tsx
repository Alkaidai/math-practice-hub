import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (mode === 'forgot') {
      const result = await requestPasswordReset(email.trim());
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        setResetSent(true);
      }
      return;
    }

    const result = await login(email.trim(), password.trim());
    setSubmitting(false);
    if (!result) {
      setError('Email ou senha inválidos.');
      return;
    }
    setError('');
    onSuccess?.();
  };

  if (resetSent) {
    return (
      <div className="bg-card rounded-2xl shadow-lg p-8 space-y-4 border border-border">
        <div className="rounded-xl bg-primary-soft border border-primary/20 p-4">
          <p className="text-body text-primary font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email enviado!
          </p>
          <p className="text-body text-muted-foreground mt-1">
            Verifique sua caixa de entrada para redefinir sua senha.
          </p>
        </div>
        <button
          onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
          className="text-body text-primary hover:underline font-medium"
        >
          ← Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
      <div className="text-center mb-8">
        <h1 className="text-h1 font-extrabold tracking-tight text-foreground font-heading">
          CADÊ <span className="text-primary">●</span> XIS
        </h1>
        <p className="text-body text-muted-foreground mt-2">
          {mode === 'login' ? 'Entre na sua conta para continuar' : 'Recupere sua senha'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-caption font-medium text-muted-foreground mb-1.5 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        {mode === 'login' && (
          <div>
            <label className="text-caption font-medium text-muted-foreground mb-1.5 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-10 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary text-primary-foreground font-bold text-body px-4 py-3 hover:bg-primary-light transition-all shadow-colored disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <LogIn className="h-4 w-4" />
          {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link de recuperação'}
        </button>

        {error && (
          <div className="rounded-xl bg-destructive-soft border border-destructive/20 p-3">
            <p className="text-body text-destructive font-medium">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); }}
          className="text-body text-primary hover:underline block mx-auto font-medium"
        >
          {mode === 'login' ? 'Esqueci minha senha' : '← Voltar ao login'}
        </button>
      </form>
    </div>
  );
}
