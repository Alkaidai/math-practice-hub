import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setLoading(false);
      }
    });

    // Check URL hash for recovery type
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    supabase.auth.getSession().then(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Senha atualizada com sucesso!');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm w-full p-6">
          {message ? (
            <div className="border border-primary bg-primary/5 p-4">
              <p className="font-heading text-sm text-primary">{message}</p>
            </div>
          ) : (
            <div className="border border-border bg-card p-4 space-y-2">
              <p className="font-body text-sm text-muted-foreground">
                Link de recuperação inválido ou expirado.
              </p>
              <a href="/" className="font-heading text-sm text-primary">← Voltar ao login</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <form onSubmit={handleSubmit} className="max-w-sm w-full border border-border bg-card p-6 space-y-3">
        <h2 className="font-heading text-lg font-bold text-foreground">🔒 Nova Senha</h2>
        <p className="font-body text-sm text-muted-foreground">Digite sua nova senha abaixo.</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Nova senha"
          required
          minLength={6}
          className="w-full border border-border bg-background px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirmar nova senha"
          required
          className="w-full border border-border bg-background px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <button type="submit" className="w-full bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-2 border border-primary hover:opacity-90">
          Atualizar senha
        </button>
        {error && <p className="text-destructive font-heading text-sm">{error}</p>}
        {message && <p className="text-primary font-heading text-sm">{message}</p>}
      </form>
    </div>
  );
}
