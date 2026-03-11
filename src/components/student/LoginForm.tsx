import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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
      <div className="bg-card rounded-xl shadow-lg p-8 space-y-4">
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm text-primary font-semibold">📧 Email enviado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Verifique sua caixa de entrada para redefinir sua senha.
          </p>
        </div>
        <button
          onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
          className="text-sm text-primary hover:underline"
        >
          ← Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          CADÊ <span className="text-primary">o</span> XIS
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {mode === 'login' ? 'Entre na sua conta para continuar' : 'Recupere sua senha'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        {mode === 'login' && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
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
          className="w-full rounded-lg bg-gold text-gold-foreground font-semibold text-sm px-4 py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link de recuperação'}
        </button>

        {error && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); }}
          className="text-sm text-primary hover:underline block mx-auto"
        >
          {mode === 'login' ? 'Esqueci minha senha' : '← Voltar ao login'}
        </button>
      </form>
    </div>
  );
}
