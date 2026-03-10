import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="max-w-sm space-y-3">
        <div className="border border-primary bg-primary/5 p-4">
          <p className="font-heading text-sm text-primary font-bold">📧 Email enviado!</p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Verifique sua caixa de entrada para redefinir sua senha.
          </p>
        </div>
        <button
          onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
          className="font-heading text-xs text-primary"
        >
          ← Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <h2 className="font-heading text-lg font-bold text-foreground">
        {mode === 'login' ? 'Login' : '🔒 Recuperar Senha'}
      </h2>
      {mode === 'forgot' && (
        <p className="font-body text-sm text-muted-foreground">
          Digite seu email para receber o link de recuperação.
        </p>
      )}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="border border-border bg-card px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      {mode === 'login' && (
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha"
          required
          className="border border-border bg-card px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      )}
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-2 border border-primary hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link'}
      </button>
      {error && <p className="text-destructive font-heading text-sm font-semibold">{error}</p>}
      <button
        type="button"
        onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); }}
        className="font-heading text-xs text-primary self-start"
      >
        {mode === 'login' ? 'Esqueci minha senha' : '← Voltar ao login'}
      </button>
    </form>
  );
}
