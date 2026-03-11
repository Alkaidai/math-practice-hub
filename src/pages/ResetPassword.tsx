import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) setIsRecovery(true);
    supabase.auth.getSession().then(() => setLoading(false));
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); }
    else { setMessage('Senha atualizada com sucesso!'); setTimeout(() => { window.location.href = '/'; }, 2000); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );

  if (!isRecovery) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-sm w-full p-6">
        {message ? (
          <div className="border border-primary bg-primary/5 p-4 rounded-lg">
            <p className="text-sm text-primary font-semibold">{message}</p>
          </div>
        ) : (
          <div className="border border-border bg-card p-4 space-y-2 rounded-lg">
            <p className="text-sm text-muted-foreground">Link de recuperação inválido ou expirado.</p>
            <a href="/" className="text-sm text-primary">← Voltar ao login</a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <form onSubmit={handleSubmit} className="max-w-sm w-full bg-card rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">🔒 Nova Senha</h2>
        <p className="text-sm text-muted-foreground">Digite sua nova senha abaixo.</p>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nova senha" required minLength={6}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmar nova senha" required
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button type="submit" className="w-full rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:brightness-110 transition-all">
          Atualizar senha
        </button>
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}
        {message && <p className="text-primary text-sm font-medium">{message}</p>}
      </form>
    </div>
  );
}
