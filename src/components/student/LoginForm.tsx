import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = login(username.trim(), password.trim());
    if (!result) {
      setError('Usuário ou senha inválidos.');
      return;
    }
    setError('');
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <h2 className="font-heading text-lg font-bold text-foreground">Login</h2>
      <input
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Usuário"
        required
        className="border border-border bg-card px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Senha"
        required
        className="border border-border bg-card px-3 py-2 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-2 border border-primary hover:opacity-90"
      >
        Entrar
      </button>
      {error && <p className="text-destructive font-heading text-sm font-semibold">{error}</p>}
    </form>
  );
}
