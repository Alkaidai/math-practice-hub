import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { StudentDashboard } from './StudentDashboard';
import { QuestionsList } from './QuestionsList';
import { TimedTraining } from './TimedTraining';
import { StudentNotebook } from './StudentNotebook';
import { StudentRanking } from './StudentRanking';
import { KnowledgeMap } from './KnowledgeMap';
import { StudentLessons } from './StudentLessons';
import { DiagnosticAssessment } from './DiagnosticAssessment';
import { ScrollToTop } from './ScrollToTop';
import { getDiagnosticResult, getAppSetting } from '../../lib/storage';
import { useSessionTracker } from '../../hooks/useSessionTracker';
import {
  SidebarProvider, SidebarTrigger, Sidebar, SidebarContent,
  SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, PenLine, Map, BookOpen, Trophy, LogOut, Shield, GraduationCap } from 'lucide-react';

type Tab = 'dashboard' | 'questions' | 'timed' | 'knowledgeMap' | 'notebook' | 'ranking' | 'lessons';

const NAV_ITEMS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { key: 'questions', label: 'Treinar', icon: PenLine },
  { key: 'lessons', label: 'Aulas', icon: GraduationCap },
  { key: 'knowledgeMap', label: 'Mapa de tópicos', icon: Map },
  { key: 'notebook', label: 'Caderno de erros', icon: BookOpen },
  { key: 'ranking', label: 'Ranking', icon: Trophy },
];

function StudentSidebar({ tab, setTab, user, onLogout }: {
  tab: Tab; setTab: (t: Tab) => void; user: any; onLogout: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 flex items-center gap-2">
        {!collapsed && <h1 className="text-lg font-extrabold tracking-tight text-sidebar-foreground">CADÊ <span className="text-sidebar-primary">o</span> XIS</h1>}
        {collapsed && <span className="text-sidebar-primary font-extrabold text-lg">X</span>}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton onClick={() => setTab(item.key)} isActive={tab === item.key} tooltip={item.label}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/admin"><Shield className="h-4 w-4" /><span>Admin</span></a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className={`p-3 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && <p className="text-xs text-sidebar-foreground/70 mb-2 truncate">{user?.username}</p>}
          <button onClick={onLogout} className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-3.5 w-3.5" />{!collapsed && <span>Sair</span>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function StudentApp() {
  const { user, loading: authLoading, error: authError, logout } = useAuth();
  const { recordActivity, recordQuestionAnswered } = useSessionTracker(user?.username ?? null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [targetQuestion, setTargetQuestion] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagChecked, setDiagChecked] = useState(false);
  // Key to force remount components on tab switch, clearing stale state
  const [tabKey, setTabKey] = useState(0);

  useEffect(() => {
    if (!user || user.role === 'admin') { setDiagChecked(true); return; }
    async function check() {
      try {
        const [enabled, mandatory, existing] = await Promise.all([
          getAppSetting('diagnostic_enabled'),
          getAppSetting('diagnostic_mandatory'),
          getDiagnosticResult(user!.username),
        ]);
        if (enabled === 'true' && mandatory === 'true' && !existing) setShowDiagnostic(true);
      } catch { /* continue */ }
      setDiagChecked(true);
    }
    check();
  }, [user]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setTopicFilter(null);
    setDifficultyFilter(null);
    setTabKey(k => k + 1);
  };

  const handleRefazer = (questionId: string) => {
    setTargetQuestion(questionId);
    setTopicFilter(null);
    setDifficultyFilter(null);
    setTab('questions');
    setTabKey(k => k + 1);
    setTimeout(() => {
      document.getElementById(`question-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleStartTopic = (topicId: string, difficulty?: string) => {
    setTargetQuestion(null);
    setTopicFilter(topicId);
    setDifficultyFilter(difficulty ?? null);
    setTab('questions');
    setTabKey(k => k + 1);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {authError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive font-medium">{authError}</p>
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );

  if (!diagChecked) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );

  if (showDiagnostic) return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <DiagnosticAssessment onComplete={() => setShowDiagnostic(false)} />
      </div>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <StudentSidebar tab={tab} setTab={handleTabChange} user={user} onLogout={logout} />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="h-14 flex items-center gap-4 border-b border-border bg-card px-4 shrink-0 z-20">
            <SidebarTrigger />
            <h2 className="text-sm font-semibold text-foreground">
              {NAV_ITEMS.find(n => n.key === tab)?.label ?? 'Painel'}
            </h2>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {tab === 'dashboard' && <StudentDashboard key={tabKey} onNavigateQuestions={() => handleTabChange('questions')} onRefazer={handleRefazer} onStartTopic={handleStartTopic} />}
            {tab === 'questions' && <QuestionsList key={tabKey} initialQuestionId={targetQuestion} initialTopicId={topicFilter} initialDifficulty={difficultyFilter} onQuestionAnswered={recordQuestionAnswered} />}
            {tab === 'knowledgeMap' && <KnowledgeMap key={tabKey} onStartTopic={handleStartTopic} />}
            {tab === 'lessons' && <StudentLessons key={tabKey} />}
            {tab === 'notebook' && <StudentNotebook key={tabKey} onRefazer={handleRefazer} />}
            {tab === 'ranking' && <StudentRanking key={tabKey} />}
          </main>
          <ScrollToTop />
        </div>
      </div>
    </SidebarProvider>
  );
}
