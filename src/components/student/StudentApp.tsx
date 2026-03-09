import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { initStorageFromSeeds } from '../../lib/storage';
import { LoginForm } from './LoginForm';
import { StudentDashboard } from './StudentDashboard';
import { QuestionsList } from './QuestionsList';
import { StudentNotebook } from './StudentNotebook';
import { roleLabel } from '../../lib/ui-utils';

type Tab = 'dashboard' | 'questions' | 'notebook';

export function StudentApp() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [targetQuestion, setTargetQuestion] = useState<string | null>(null);

  useEffect(() => {
    initStorageFromSeeds();
  }, []);

  const handleRefazer = (questionId: string) => {
    setTargetQuestion(questionId);
    setTab('questions');
    setTimeout(() => {
      document.getElementById(`question-${questionId}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-heading text-sm font-bold text-foreground tracking-tight">
          <span className="text-primary">CX</span> Cadê o Xis
        </h1>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <a href="/admin" className="font-heading text-xs text-primary border border-primary px-2 py-0.5 hover:bg-primary hover:text-primary-foreground">
              Administrador
            </a>
          )}
          {user ? (
            <>
              <span className="font-heading text-xs text-muted-foreground">
                {user.username} ({roleLabel(user.role)})
              </span>
              <button onClick={logout} className="font-heading text-xs text-destructive border border-destructive px-2 py-0.5 hover:bg-destructive hover:text-destructive-foreground">
                Sair
              </button>
            </>
          ) : (
            <span className="font-heading text-xs text-muted-foreground">Visitante</span>
          )}
        </div>
      </header>

      <main className="max-w-[1160px] mx-auto px-4 py-5">
        {!user ? (
          <LoginForm />
        ) : (
          <>
            {/* Navigation */}
            <nav className="flex gap-1 mb-4 border-b border-border pb-1">
              {([['dashboard', 'Painel'], ['questions', 'Questões'], ['notebook', 'Caderno de erros']] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`font-heading text-xs px-3 py-1.5 border-b-2 ${tab === key ? 'border-primary text-foreground font-bold' : 'border-transparent text-muted-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'dashboard' && <StudentDashboard onNavigateQuestions={() => setTab('questions')} onRefazer={handleRefazer} />}
            {tab === 'questions' && <QuestionsList initialQuestionId={targetQuestion} />}
            {tab === 'notebook' && <StudentNotebook onRefazer={handleRefazer} />}
          </>
        )}
      </main>
    </div>
  );
}
