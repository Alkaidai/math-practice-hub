import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from '../student/LoginForm';
import { loadQuestionBank, saveQuestionBank, saveQuestionsBulk, deleteQuestion, getTopics, getAttempts, loadUsers, getUsersByRole, getLessons, saveLesson, updateLesson, deleteLesson, getNotebook, getReports, setReportStatus, updateReport, addReply, setCommentStatus, getTrainingPlans, addTrainingPlan, upsertUser, createTopic, updateTopic, toggleTopicStatus, deleteTopic, getRanking, getAppSetting, setAppSetting, getAllAppSettings, getAllDiagnosticResults, getDiagnosticResult, resetDiagnostic, toggleUserStatus, getSubjects, createSubject, updateSubject, deleteSubject, getUserSubjectAccess, setUserSubjectAccess } from '../../lib/storage';
import { subjectLabel, difficultyLabel, statusLabel, formatDate, uid, subjectCode, difficultyCode } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP, SUBJECTS_REVERSE, DIFFICULTIES_REVERSE } from '../../lib/constants';
import type { Question, Topic, Lesson, Report, User, Attempt, NotebookItem, SubjectItem } from '../../lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';

type Panel = 'dashboard' | 'questions' | 'lessons' | 'cadastros' | 'subjects' | 'users' | 'comments' | 'notebook' | 'reports' | 'import' | 'export' | 'ranking' | 'topic-stats' | 'settings';

export function AdminApp() {
  const { user, logout } = useAuth();
  const [panel, setPanel] = useState<Panel>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefresh = useCallback(() => setRefreshKey(n => n + 1), []);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader user={null} onLogout={() => {}} />
        <main className="max-w-[1160px] mx-auto px-4 py-5">
          <LoginForm onSuccess={() => window.location.reload()} />
        </main>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader user={user} onLogout={logout} />
        <main className="max-w-[1160px] mx-auto px-4 py-5">
          <div className="border border-destructive bg-destructive/5 p-4">
            <p className="font-heading text-sm text-destructive font-bold">Acesso negado.</p>
            <a href="/" className="font-heading text-xs text-primary">Voltar para área do aluno</a>
          </div>
        </main>
      </div>
    );
  }

  const menuGroups = [
    { label: null, items: [{ id: 'dashboard' as Panel, label: 'Painel' }] },
    { label: 'Conteúdo', items: [{ id: 'questions' as Panel, label: 'Questões' }, { id: 'subjects' as Panel, label: 'Disciplinas' }, { id: 'lessons' as Panel, label: 'Aulas' }, { id: 'cadastros' as Panel, label: 'Tópicos' }, { id: 'import' as Panel, label: 'Importar' }, { id: 'export' as Panel, label: 'Exportar' }] },
    { label: 'Análise', items: [{ id: 'ranking' as Panel, label: '🏆 Ranking' }, { id: 'topic-stats' as Panel, label: '📊 Tópicos' }] },
    { label: 'Pessoas', items: [{ id: 'users' as Panel, label: 'Usuários' }, { id: 'comments' as Panel, label: 'Comentários' }, { id: 'notebook' as Panel, label: 'Caderno' }] },
    { label: 'Sistema', items: [{ id: 'reports' as Panel, label: 'Erros' }, { id: 'settings' as Panel, label: '⚙️ Config' }] },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader user={user} onLogout={logout} />

      <main className="max-w-[1160px] mx-auto px-4 py-5">
        <nav className="flex flex-wrap items-center gap-2 mb-4">
          {menuGroups.map((group, gi) => (
            <div key={gi} className="inline-flex items-center gap-1 border border-border px-2 py-1 bg-card">
              {group.label && <span className="font-heading text-[10px] text-muted-foreground font-bold uppercase tracking-wider mr-1">{group.label}:</span>}
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setPanel(item.id); forceRefresh(); }}
                  className={`font-heading text-xs px-2 py-0.5 ${panel === item.id ? 'text-foreground font-bold border-b-2 border-primary' : 'text-muted-foreground'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {panel === 'dashboard' && <AdminDashboard key={refreshKey} />}
        {panel === 'questions' && <AdminQuestions key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'subjects' && <AdminSubjects key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'lessons' && <AdminLessons key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'cadastros' && <AdminTopics key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'users' && <AdminUsers key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'comments' && <AdminComments key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'notebook' && <AdminNotebook key={refreshKey} />}
        {panel === 'reports' && <AdminReports key={refreshKey} onRefresh={forceRefresh} />}
        {panel === 'import' && <AdminImport onRefresh={forceRefresh} />}
        {panel === 'export' && <AdminExport />}
        {panel === 'ranking' && <AdminRanking key={refreshKey} />}
        {panel === 'topic-stats' && <AdminTopicStats key={refreshKey} />}
        {panel === 'settings' && <AdminSettings key={refreshKey} />}
      </main>
    </div>
  );
}

function AdminHeader({ user, onLogout }: { user: any; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <h1 className="font-heading text-sm font-bold text-foreground tracking-tight">
        <span className="text-primary">CX</span> Admin
      </h1>
      <div className="flex items-center gap-3">
        <a href="/" className="font-heading text-xs text-muted-foreground border border-border px-2 py-0.5 hover:text-foreground">Área do Aluno</a>
        {user && (
          <>
            <span className="font-heading text-xs text-muted-foreground">{user.username} (admin)</span>
            <button onClick={onLogout} className="font-heading text-xs text-destructive border border-destructive px-2 py-0.5 hover:bg-destructive hover:text-destructive-foreground">Sair</button>
          </>
        )}
      </div>
    </header>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-card p-3">
      <p className="font-heading text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-heading text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============

function AdminDashboard() {
  const [data, setData] = useState<{ questions: Question[]; attempts: Attempt[]; users: User[] } | null>(null);

  useEffect(() => {
    Promise.all([loadQuestionBank(), getAttempts(), loadUsers()]).then(([questions, attempts, users]) => {
      setData({ questions, attempts, users });
    });
  }, []);

  if (!data) return <p className="font-body text-muted-foreground">Carregando...</p>;

  const { questions, attempts, users } = data;
  const published = questions.filter(q => q.status !== 'draft').length;
  const draft = questions.length - published;
  const activeUsers = new Set(attempts.map(a => a.userId).filter(Boolean)).size;
  const correct = attempts.filter(a => a.isCorrect).length;
  const globalRate = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

  const countBy = (arr: any[], picker: (item: any) => string) => {
    const map = new Map<string, number>();
    arr.forEach(item => { const key = picker(item) ?? '-'; map.set(key, (map.get(key) ?? 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total questões" value={questions.length} />
        <StatCard label="Publicadas" value={published} />
        <StatCard label="Rascunho" value={draft} />
        <StatCard label="Usuários" value={users.length} />
        <StatCard label="Ativos" value={activeUsers} />
        <StatCard label="Tentativas" value={attempts.length} />
        <StatCard label="% acerto global" value={`${globalRate}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-border bg-card p-3">
          <h3 className="font-heading text-xs font-bold uppercase mb-2">Por série</h3>
          {countBy(questions, q => q.grade).map(([k, v]) => (
            <p key={k} className="font-body text-sm">{k}: <strong>{v}</strong></p>
          ))}
        </div>
        <div className="border border-border bg-card p-3">
          <h3 className="font-heading text-xs font-bold uppercase mb-2">Por disciplina</h3>
          {countBy(questions, q => q.subject).map(([k, v]) => (
            <p key={k} className="font-body text-sm">{subjectLabel(k)}: <strong>{v}</strong></p>
          ))}
        </div>
        <div className="border border-border bg-card p-3">
          <h3 className="font-heading text-xs font-bold uppercase mb-2">Por dificuldade</h3>
          {countBy(questions, q => q.difficulty).map(([k, v]) => (
            <p key={k} className="font-body text-sm">{difficultyLabel(k)}: <strong>{v}</strong></p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN RANKING ============

function AdminRanking() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([getRanking(), getAllDiagnosticResults()]).then(([r, d]) => {
      setRanking(r);
      setDiagnostics(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">🏆 Ranking de Alunos</h2>

      {ranking.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">Nenhum dado de ranking ainda.</p>
      ) : (
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted z-10">
              <tr>
                {['#', 'Aluno', 'Respondidas', 'Acertos', '% Acerto', 'Sequência'].map(h => (
                  <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.userId} className="hover:bg-muted/50">
                  <td className="p-2 border border-border font-heading text-xs font-bold">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="p-2 border border-border font-heading text-xs font-bold">{r.username}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.total}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.correct}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.rate}%</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.streak} dia{r.streak === 1 ? '' : 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diagnostics.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-bold uppercase mt-4 mb-2">📊 Diagnósticos Realizados</h3>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {['Aluno', 'Data', 'Questões', 'Acertos', '% Acerto', 'Nível', 'Fraquezas'].map(h => (
                    <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((d: any) => (
                  <tr key={d.id} className="hover:bg-muted/50">
                    <td className="p-2 border border-border font-heading text-xs font-bold">{d.user_id}</td>
                    <td className="p-2 border border-border font-heading text-xs">{formatDate(d.completed_at)}</td>
                    <td className="p-2 border border-border font-heading text-xs">{d.total_questions}</td>
                    <td className="p-2 border border-border font-heading text-xs">{d.correct_answers}</td>
                    <td className="p-2 border border-border font-heading text-xs">{d.accuracy_rate}%</td>
                    <td className="p-2 border border-border font-heading text-xs">{(d.recommended_plan as any)?.level ?? '-'}</td>
                    <td className="p-2 border border-border font-body text-xs">{(d.weaknesses as any[])?.join(', ') || 'Nenhuma'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ADMIN TOPIC STATS ============

function AdminTopicStats() {
  const [data, setData] = useState<{ topics: Topic[]; attempts: Attempt[]; questions: Question[] } | null>(null);

  useEffect(() => {
    Promise.all([getTopics(), getAttempts(), loadQuestionBank()]).then(([topics, attempts, questions]) => {
      setData({ topics, attempts, questions });
    });
  }, []);

  if (!data) return <p className="font-body text-muted-foreground">Carregando...</p>;

  const { topics, attempts, questions } = data;
  const questionMap = new Map(questions.map(q => [q.id, q]));

  const stats = new Map<string, { total: number; correct: number; errors: number }>();
  attempts.forEach(a => {
    const q = questionMap.get(a.questionId);
    if (!q?.topicId) return;
    const prev = stats.get(q.topicId) ?? { total: 0, correct: 0, errors: 0 };
    prev.total += 1;
    if (a.isCorrect) prev.correct += 1;
    else prev.errors += 1;
    stats.set(q.topicId, prev);
  });

  const topicStats = topics.map(t => {
    const s = stats.get(t.id) ?? { total: 0, correct: 0, errors: 0 };
    return {
      ...t,
      total: s.total,
      correct: s.correct,
      errors: s.errors,
      rate: s.total ? Math.round((s.correct / s.total) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">📊 Estatísticas por Tópico</h2>

      {topicStats.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">Nenhum tópico encontrado.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total tópicos" value={topicStats.length} />
            <StatCard label="Com respostas" value={topicStats.filter(t => t.total > 0).length} />
            <StatCard label="Melhor tópico" value={topicStats.filter(t => t.total > 0).sort((a, b) => b.rate - a.rate)[0]?.name ?? '-'} />
            <StatCard label="Pior tópico" value={topicStats.filter(t => t.total > 0).sort((a, b) => a.rate - b.rate)[0]?.name ?? '-'} />
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {['Tópico', 'Disciplina', 'Respostas', 'Acertos', 'Erros', '% Acerto', 'Barra'].map(h => (
                    <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topicStats.map(t => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="p-2 border border-border font-heading text-xs font-bold">{t.name}</td>
                    <td className="p-2 border border-border font-heading text-xs">{subjectLabel(t.subject)}</td>
                    <td className="p-2 border border-border font-heading text-xs">{t.total}</td>
                    <td className="p-2 border border-border font-heading text-xs">{t.correct}</td>
                    <td className="p-2 border border-border font-heading text-xs">{t.errors}</td>
                    <td className="p-2 border border-border font-heading text-xs font-bold">{t.rate}%</td>
                    <td className="p-2 border border-border">
                      <div className="w-full bg-muted h-3 relative">
                        <div className="h-3 bg-primary transition-all" style={{ width: `${t.rate}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============ ADMIN SETTINGS ============

function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    Promise.all([getAllAppSettings(), loadQuestionBank()]).then(([s, q]) => {
      setSettings(s);
      setQuestionCount(q.filter(x => x.status !== 'draft').length);
      setLoading(false);
    });
  }, []);

  const toggle = async (key: string) => {
    const current = settings[key] === 'true';
    const newVal = current ? 'false' : 'true';
    await setAppSetting(key, newVal);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    setFeedback(`Configuração "${key}" alterada.`);
    setTimeout(() => setFeedback(''), 2000);
  };

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;

  const toggleItems = [
    { key: 'ranking_visible', label: 'Ranking visível para alunos', desc: 'Controla se os alunos podem ver o ranking na área deles.' },
    { key: 'diagnostic_enabled', label: 'Diagnóstico inicial ativado', desc: 'Habilita o diagnóstico automático para novos alunos.' },
    { key: 'diagnostic_mandatory', label: 'Diagnóstico obrigatório', desc: 'Se ativado, novos alunos devem completar o diagnóstico antes de acessar o sistema.' },
    { key: 'diagnostic_results_visible', label: 'Resultado do diagnóstico visível para aluno', desc: 'Controla se o aluno pode ver o resultado do seu diagnóstico.' },
    { key: 'public_signup_enabled', label: 'Cadastro público permitido', desc: 'Se ativado, qualquer pessoa pode se cadastrar. Se desativado, apenas admin pode criar alunos.' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">⚙️ Configurações do Sistema</h2>

      {questionCount < 20 && (
        <div className="border border-destructive bg-destructive/5 p-3">
          <p className="font-heading text-xs text-destructive font-bold">
            ⚠️ Apenas {questionCount} questões publicadas. O diagnóstico precisa de pelo menos 20 questões.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {toggleItems.map(item => (
          <div key={item.key} className="border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-heading text-sm font-bold text-foreground">{item.label}</p>
              <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${settings[item.key] === 'true' ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${settings[item.key] === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
    </div>
  );
}

// ============ ADMIN SUBJECTS ============

function AdminSubjects({ onRefresh }: { onRefresh: () => void }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', status: 'active' });
  const [feedback, setFeedback] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [s, t, q] = await Promise.all([getSubjects(), getTopics(), loadQuestionBank()]);
    setSubjects(s);
    setTopics(t);
    setQuestions(q);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFeedback('Nome é obrigatório.'); return; }

    if (editingId) {
      await updateSubject(editingId, { name: form.name.trim(), status: form.status as any });
      setFeedback('Disciplina atualizada.');
    } else {
      await createSubject({ name: form.name.trim(), status: form.status as any });
      setFeedback('Disciplina criada.');
    }
    setEditingId(null);
    setForm({ name: '', status: 'active' });
    await loadData();
    onRefresh();
  };

  const handleToggleStatus = async (id: string) => {
    const s = subjects.find(x => x.id === id);
    if (!s) return;
    await updateSubject(id, { status: s.status === 'active' ? 'inactive' : 'active' });
    await loadData();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await deleteSubject(id);
    setConfirmDeleteId(null);
    setFeedback('Disciplina excluída.');
    await loadData();
    onRefresh();
  };

  const getTopicCount = (subjectSlug: string) => topics.filter(t => t.subject === subjectSlug).length;
  const getQuestionCount = (subjectSlug: string) => questions.filter(q => q.subject === subjectSlug).length;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Disciplinas</h2>

      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <h3 className="font-heading text-xs font-bold">{editingId ? 'Editar disciplina' : '+ Nova disciplina'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nome da disciplina"
            className="border border-border bg-background px-2 py-1 font-body text-sm md:col-span-2"
            required
          />
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="border border-border bg-background px-2 py-1 font-heading text-xs"
          >
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary">
            {editingId ? 'Salvar alterações' : 'Criar disciplina'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', status: 'active' }); }} className="font-heading text-xs border border-border px-4 py-1.5 text-muted-foreground">
              Cancelar
            </button>
          )}
        </div>
        {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
      </form>

      {confirmDeleteId && (() => {
        const s = subjects.find(x => x.id === confirmDeleteId);
        if (!s) return null;
        const tc = getTopicCount(s.slug);
        const qc = getQuestionCount(s.slug);
        return (
          <div className="border border-destructive bg-destructive/5 p-4 space-y-2">
            <p className="font-heading text-sm text-destructive font-bold">
              ⚠️ Excluir disciplina "{s.name}"?
            </p>
            <p className="font-body text-xs text-muted-foreground">
              Esta disciplina possui <strong>{tc}</strong> tópico(s) e <strong>{qc}</strong> questão(ões) associadas.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(confirmDeleteId)} className="font-heading text-xs bg-destructive text-destructive-foreground px-4 py-1.5 border border-destructive">
                Sim, excluir
              </button>
              <button onClick={() => setConfirmDeleteId(null)} className="font-heading text-xs border border-border px-4 py-1.5">
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}

      {subjects.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">Nenhuma disciplina cadastrada. Crie a primeira acima.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              {['Nome', 'Slug', 'Status', 'Tópicos', 'Questões', 'Criação', 'Ações'].map(h => (
                <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => (
              <tr key={s.id} className="hover:bg-muted/50">
                <td className="p-2 border border-border font-heading text-xs font-bold">{s.name}</td>
                <td className="p-2 border border-border font-heading text-xs text-muted-foreground">{s.slug}</td>
                <td className="p-2 border border-border font-heading text-xs">
                  <span className={s.status === 'active' ? 'text-primary' : 'text-muted-foreground'}>{statusLabel(s.status)}</span>
                </td>
                <td className="p-2 border border-border font-heading text-xs">{getTopicCount(s.slug)}</td>
                <td className="p-2 border border-border font-heading text-xs">{getQuestionCount(s.slug)}</td>
                <td className="p-2 border border-border font-heading text-xs">{formatDate(s.createdAt)}</td>
                <td className="p-2 border border-border">
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(s.id); setForm({ name: s.name, status: s.status }); }}
                      className="font-heading text-[10px] border border-border px-2 py-0.5"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(s.id)}
                      className="font-heading text-[10px] border border-border px-2 py-0.5"
                    >
                      {s.status === 'active' ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============ ADMIN QUESTIONS (with bulk delete) ============

function AdminQuestions({ onRefresh }: { onRefresh: () => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjectsLocal] = useState<SubjectItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    grade: '7EF', subject: '', difficulty: 'easy', topicId: '', status: 'published',
    statement: '', options: ['', '', '', '', ''], correctLetter: '', explanation: '',
  });
  const [feedback, setFeedback] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    const [t, q, s] = await Promise.all([getTopics({ activeOnly: true }), loadQuestionBank(), getSubjects({ activeOnly: true })]);
    setTopics(t);
    setQuestions(q);
    setSubjectsLocal(s);
    if (t.length && !form.topicId) setForm(f => ({ ...f, topicId: t[0].id }));
    if (s.length && !form.subject) setForm(f => ({ ...f, subject: s[0].slug }));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ grade: '7EF', subject: 'math', difficulty: 'easy', topicId: topics[0]?.id ?? '', status: 'published', statement: '', options: ['', '', '', '', ''], correctLetter: '', explanation: '' });
    setFeedback('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.statement) { setFeedback('Enunciado é obrigatório.'); return; }
    if (form.options.some(o => !o)) { setFeedback('Preencha todas as alternativas.'); return; }
    if (!form.correctLetter) { setFeedback('Selecione a resposta correta.'); return; }

    const correctIndex = ['A','B','C','D','E'].indexOf(form.correctLetter);
    const q: any = {
      id: editingId ?? uid('q'),
      grade: form.grade, subject: form.subject, difficulty: form.difficulty, topicId: form.topicId,
      statement: form.statement, options: form.options, correctIndex,
      explanation: form.explanation, status: form.status,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [],
    };

    if (editingId) {
      const existing = questions.find(x => x.id === editingId);
      if (existing) { q.createdAt = existing.createdAt; q.comments = existing.comments; }
      const bank = questions.map(x => x.id === editingId ? q : x);
      await saveQuestionBank(bank);
    } else {
      await saveQuestionBank([q, ...questions]);
    }
    setFeedback('Questão salva.');
    resetForm();
    await loadData();
    onRefresh();
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      grade: q.grade, subject: q.subject, difficulty: q.difficulty, topicId: q.topicId,
      status: q.status, statement: q.statement,
      options: [...q.options, '', '', '', '', ''].slice(0, 5),
      correctLetter: ['A','B','C','D','E'][q.correctIndex] ?? '',
      explanation: q.explanation,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteQuestion(id);
    await loadData();
    onRefresh();
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteQuestion(id);
    }
    setSelectedIds(new Set());
    setConfirmDelete(false);
    setFeedback(`✅ ${selectedIds.size} questão(ões) excluída(s).`);
    await loadData();
    onRefresh();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map(q => q.id)));
    }
  };

  const allTopics = topics;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-sm font-bold uppercase">Questões</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="font-heading text-xs text-destructive border border-destructive px-2 py-0.5 hover:bg-destructive hover:text-destructive-foreground"
            >
              🗑 Excluir {selectedIds.size} selecionada(s)
            </button>
          )}
          <button onClick={resetForm} className="font-heading text-xs border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">Nova questão</button>
        </div>
      </div>

      {confirmDelete && (
        <div className="border border-destructive bg-destructive/5 p-4 space-y-2">
          <p className="font-heading text-sm text-destructive font-bold">
            ⚠️ Confirmar exclusão de {selectedIds.size} questão(ões)?
          </p>
          <p className="font-body text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} className="font-heading text-xs bg-destructive text-destructive-foreground px-4 py-1.5 border border-destructive">
              Sim, excluir
            </button>
            <button onClick={() => setConfirmDelete(false)} className="font-heading text-xs border border-border px-4 py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <h3 className="font-heading text-xs font-bold">{editingId ? 'Editar questão' : 'Nova questão'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {subjects.length > 0 
              ? subjects.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)
              : Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)
            }
          </select>
          <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <select value={form.topicId} onChange={e => setForm(f => ({ ...f, topicId: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            <option value="published">Publicado</option>
            <option value="draft">Rascunho</option>
          </select>
        </div>
        <textarea value={form.statement} onChange={e => setForm(f => ({ ...f, statement: e.target.value }))} placeholder="Enunciado" className="w-full border border-border bg-background p-2 font-body text-sm min-h-[60px]" required />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {['A','B','C','D','E'].map((letter, i) => (
            <input key={letter} value={form.options[i]} onChange={e => { const opts = [...form.options]; opts[i] = e.target.value; setForm(f => ({ ...f, options: opts })); }} placeholder={`${letter})`} className="border border-border bg-background px-2 py-1 font-body text-sm" required />
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select value={form.correctLetter} onChange={e => setForm(f => ({ ...f, correctLetter: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs" required>
            <option value="">Resposta correta</option>
            {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Explicação" className="flex-1 border border-border bg-background p-2 font-body text-sm min-h-[40px]" required />
        </div>
        <button type="submit" className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary">Salvar questão</button>
        {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
      </form>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="p-2 border border-border w-8">
                <Checkbox
                  checked={selectedIds.size === questions.length && questions.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {['Série','Disciplina','Dificuldade','Tópico','Enunciado','Status','Ações'].map(h => (
                <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map(q => (
              <tr key={q.id} className={`hover:bg-muted/50 ${selectedIds.has(q.id) ? 'bg-primary/5' : ''}`}>
                <td className="p-2 border border-border">
                  <Checkbox
                    checked={selectedIds.has(q.id)}
                    onCheckedChange={() => toggleSelect(q.id)}
                  />
                </td>
                <td className="p-2 border border-border font-heading text-xs">{q.grade}</td>
                <td className="p-2 border border-border font-heading text-xs">{subjectLabel(q.subject)}</td>
                <td className="p-2 border border-border font-heading text-xs">{difficultyLabel(q.difficulty)}</td>
                <td className="p-2 border border-border font-heading text-xs">{allTopics.find(t => t.id === q.topicId)?.name ?? '-'}</td>
                <td className="p-2 border border-border font-body text-xs">{q.statement.slice(0, 80)}{q.statement.length > 80 ? '...' : ''}</td>
                <td className="p-2 border border-border font-heading text-xs">{statusLabel(q.status)}</td>
                <td className="p-2 border border-border">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(q)} className="font-heading text-[10px] border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">Editar</button>
                    <button onClick={() => handleDelete(q.id)} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ ADMIN LESSONS ============

function AdminLessons({ onRefresh }: { onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', url: '', subject: 'math', grade: '7EF', topic: '' });
  const [feedback, setFeedback] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const loadData = useCallback(async () => {
    const [t, l] = await Promise.all([getTopics({ activeOnly: true }), getLessons()]);
    setTopics(t);
    setLessons(l);
    if (t.length && !form.topic) setForm(f => ({ ...f, topic: t[0].id }));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.url || !form.topic) { setFeedback('Preencha todos os campos.'); return; }
    if (editingId) {
      await updateLesson(editingId, { ...form, id: editingId });
      setFeedback('Aula atualizada.');
    } else {
      await saveLesson({ ...form, id: uid('lesson') });
      setFeedback('Aula salva.');
    }
    setEditingId(null);
    setForm({ title: '', url: '', subject: 'math', grade: '7EF', topic: topics[0]?.id ?? '' });
    await loadData();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Aulas</h2>
      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da aula" className="w-full border border-border bg-background px-2 py-1 font-body text-sm" required />
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="Link da aula" className="w-full border border-border bg-background px-2 py-1 font-body text-sm" required />
        <div className="grid grid-cols-3 gap-2">
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {Object.entries(SUBJECTS_MAP).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
          <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button type="submit" className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary">Salvar aula</button>
        {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
      </form>

      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-muted">
          {['Título','Disciplina','Série','Tópico','Ações'].map(h => <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>)}
        </tr></thead>
        <tbody>
          {lessons.map(l => (
            <tr key={l.id}>
              <td className="p-2 border border-border font-body text-xs">{l.title}</td>
              <td className="p-2 border border-border font-heading text-xs">{subjectLabel(l.subject)}</td>
              <td className="p-2 border border-border font-heading text-xs">{l.grade}</td>
              <td className="p-2 border border-border font-heading text-xs">{topics.find(t => t.id === l.topic)?.name ?? l.topic}</td>
              <td className="p-2 border border-border">
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(l.id); setForm({ title: l.title, url: l.url, subject: l.subject, grade: l.grade, topic: l.topic }); }} className="font-heading text-[10px] border border-border px-2 py-0.5">Editar</button>
                  <button onClick={async () => { await deleteLesson(l.id); await loadData(); onRefresh(); }} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ ADMIN TOPICS ============

function AdminTopics({ onRefresh }: { onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', grade: 'all', status: 'active' });
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState({ subject: 'all', status: 'all', search: '' });
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);

  const loadData = useCallback(async () => {
    const [t, s] = await Promise.all([getTopics(), getSubjects({ activeOnly: true })]);
    setAllTopics(t);
    setSubjectsList(s);
    if (s.length && !form.subject) setForm(f => ({ ...f, subject: s[0].slug }));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  let topics = allTopics;
  if (filter.subject !== 'all') topics = topics.filter(t => t.subject === filter.subject);
  if (filter.status !== 'all') topics = topics.filter(t => t.status === filter.status);
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    topics = topics.filter(t => `${t.name} ${t.subject} ${t.grade}`.toLowerCase().includes(needle));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subject) { setFeedback('Preencha nome e disciplina.'); return; }
    if (editingId) {
      await updateTopic(editingId, { name: form.name, subject: form.subject, grade: form.grade, status: form.status as any });
      setFeedback('Tópico atualizado.');
    } else {
      await createTopic({ id: uid('topic'), name: form.name, subject: form.subject, grade: form.grade, status: form.status as any, label: form.name });
      setFeedback('Tópico criado.');
    }
    setEditingId(null);
    setForm({ name: '', subject: 'math', grade: 'all', status: 'active' });
    await loadData();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Tópicos/Assuntos</h2>
      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do tópico" className="w-full border border-border bg-background px-2 py-1 font-body text-sm" required />
        <div className="grid grid-cols-3 gap-2">
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {subjectsList.length > 0
              ? subjectsList.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)
              : Object.entries(SUBJECTS_MAP).map(([c, l]) => <option key={c} value={c}>{l}</option>)
            }
          </select>
          <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            <option value="all">Todas</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
        <button type="submit" className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary">Salvar tópico</button>
        {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
      </form>

      <div className="flex gap-2">
        <select value={filter.subject} onChange={e => setFilter(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-card px-2 py-1 font-heading text-xs">
          <option value="all">Todas disciplinas</option>
          {subjectsList.length > 0
            ? subjectsList.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)
            : Object.entries(SUBJECTS_MAP).map(([c, l]) => <option key={c} value={c}>{l}</option>)
          }
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="border border-border bg-card px-2 py-1 font-heading text-xs">
          <option value="all">Todos status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
        <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} placeholder="Buscar" className="border border-border bg-card px-2 py-1 font-heading text-xs" />
      </div>

      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-muted">
          {['Nome','Disciplina','Série','Status','Ações'].map(h => <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>)}
        </tr></thead>
        <tbody>
          {topics.map(t => (
            <tr key={t.id}>
              <td className="p-2 border border-border font-body text-xs">{t.name}</td>
              <td className="p-2 border border-border font-heading text-xs">{subjectLabel(t.subject)}</td>
              <td className="p-2 border border-border font-heading text-xs">{t.grade}</td>
              <td className="p-2 border border-border font-heading text-xs">{statusLabel(t.status)}</td>
              <td className="p-2 border border-border">
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(t.id); setForm({ name: t.name, subject: t.subject, grade: t.grade, status: t.status }); }} className="font-heading text-[10px] border border-border px-2 py-0.5">Editar</button>
                  <button onClick={async () => { await toggleTopicStatus(t.id); await loadData(); onRefresh(); }} className="font-heading text-[10px] border border-border px-2 py-0.5">{t.status === 'active' ? 'Desativar' : 'Reativar'}</button>
                  <button onClick={async () => { await deleteTopic(t.id); await loadData(); onRefresh(); }} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ ADMIN USERS (improved with password reset, ranking toggle) ============

function AdminUsers({ onRefresh }: { onRefresh: () => void }) {
  const { user: adminUser } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', status: 'active', gradeLevel: '' });
  const [feedback, setFeedback] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [detailData, setDetailData] = useState<{
    attempts: Attempt[];
    notebook: NotebookItem[];
    diagnostic: any | null;
    dashMeta: any | null;
    topics: Topic[];
    questions: Question[];
  } | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetFeedback, setResetFeedback] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [userSubjectSlugs, setUserSubjectSlugs] = useState<string[]>([]);
  const [subjectAccessLoading, setSubjectAccessLoading] = useState(false);

  const loadData = useCallback(async () => {
    const u = await loadUsers();
    setUsers(u.sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadStudentDetail = useCallback(async (userId: string) => {
    const [attempts, notebook, diagnostic, topics, questions] = await Promise.all([
      getAttempts(userId),
      getNotebook(userId),
      getDiagnosticResult(userId),
      getTopics(),
      loadQuestionBank(),
    ]);
    const { data: dashMeta } = await supabase
      .from('dashboard_meta').select('*').eq('user_id', userId).maybeSingle();
    setDetailData({ attempts, notebook, diagnostic, dashMeta, topics, questions });
    setShowPanel(true);
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadStudentDetail(selectedId);
    } else {
      setDetailData(null);
      setShowPanel(false);
    }
  }, [selectedId, loadStudentDetail]);

  const selected = users.find(u => u.username === selectedId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setFeedback('Preencha nome, email e senha.'); return; }
    setCreating(true);
    setFeedback('');
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          gradeLevel: form.gradeLevel || null,
        },
      });
      if (res.error) throw new Error(res.error.message ?? 'Erro ao criar usuário');
      const result = res.data as any;
      if (result?.error) throw new Error(result.error);
      setFeedback('✅ Usuário criado com sucesso!');
      setForm({ name: '', email: '', password: '', role: 'student', status: 'active', gradeLevel: '' });
      await loadData();
      onRefresh();
    } catch (err: any) {
      setFeedback(`❌ ${err.message}`);
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!selected?.authUserId || !newPassword || newPassword.length < 6) {
      setResetFeedback('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setResettingPassword(true);
    setResetFeedback('');
    try {
      const res = await supabase.functions.invoke('reset-user-password', {
        body: { authUserId: selected.authUserId, newPassword },
      });
      if (res.error) throw new Error(res.error.message ?? 'Erro');
      const result = res.data as any;
      if (result?.error) throw new Error(result.error);
      setResetFeedback('✅ Senha redefinida com sucesso!');
      setNewPassword('');
    } catch (err: any) {
      setResetFeedback(`❌ ${err.message}`);
    }
    setResettingPassword(false);
  };

  const handleToggleRanking = async () => {
    if (!selected) return;
    const currentVal = (selected as any).rankingVisible !== false;
    await supabase.from('profiles').update({ ranking_visible: !currentVal } as any).eq('id', selected.id);
    await loadData();
    setFeedback('Participação no ranking alterada.');
  };

  const handleResetDiagnostic = async () => {
    if (!selected) return;
    await resetDiagnostic(selected.id);
    await loadStudentDetail(selected.username);
    setFeedback('Diagnóstico resetado.');
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    await toggleUserStatus(selected.id);
    await loadData();
    if (selectedId) await loadStudentDetail(selectedId);
    setFeedback('Status alterado.');
  };

  // Compute detail stats
  const attempts = detailData?.attempts ?? [];
  const notebook = detailData?.notebook ?? [];
  const diagnostic = detailData?.diagnostic;
  const topicsMap = new Map((detailData?.topics ?? []).map(t => [t.id, t.name]));
  const questionsMap = new Map((detailData?.questions ?? []).map(q => [q.id, q]));

  const answered = attempts.length;
  const correct = attempts.filter(a => a.isCorrect).length;
  const errors = answered - correct;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;

  const topicPerf = new Map<string, { total: number; correct: number }>();
  attempts.forEach(a => {
    const q = questionsMap.get(a.questionId);
    const tid = q?.topicId || 'sem-topico';
    const prev = topicPerf.get(tid) ?? { total: 0, correct: 0 };
    prev.total += 1;
    if (a.isCorrect) prev.correct += 1;
    topicPerf.set(tid, prev);
  });
  const topicPerfArr = [...topicPerf.entries()]
    .map(([tid, s]) => ({ topic: topicsMap.get(tid) ?? tid, ...s, rate: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => b.total - a.total);
  const strongTopics = topicPerfArr.filter(t => t.rate >= 70 && t.total >= 2);
  const weakTopics = topicPerfArr.filter(t => t.rate < 50 && t.total >= 2);

  const recentAttempts = [...attempts].sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()).slice(0, 10);
  const activeDays = new Set(attempts.map(a => a.answeredAt?.slice(0, 10))).size;
  const nbPending = notebook.filter(n => n.status === 'pending').length;
  const nbMastered = notebook.filter(n => n.status === 'mastered').length;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Usuários</h2>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
        <div className="space-y-3">
          <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
            <h3 className="font-heading text-xs font-bold">Criar novo usuário</h3>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" className="w-full border border-border bg-background px-2 py-1 font-heading text-xs" required />
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-full border border-border bg-background px-2 py-1 font-heading text-xs" required />
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Senha (mín. 6 caracteres)" className="w-full border border-border bg-background px-2 py-1 font-heading text-xs" required minLength={6} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              <option value="student">Aluno</option><option value="admin">Administrador</option>
            </select>
            <select value={form.gradeLevel} onChange={e => setForm(f => ({ ...f, gradeLevel: e.target.value }))} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              <option value="">Sem turma</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button type="submit" disabled={creating} className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary w-full disabled:opacity-50">
              {creating ? 'Criando...' : 'Criar usuário'}
            </button>
            {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
          </form>

          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.username)}
                className={`w-full text-left border p-2 ${selectedId === u.username ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
              >
                <p className="font-heading text-xs font-bold">{u.name || u.username}</p>
                <p className="font-heading text-[10px] text-muted-foreground">{u.email || u.username} · {u.role} · {u.status}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-4 overflow-y-auto max-h-[700px]">
          {selected && showPanel && detailData ? (
            <div className="space-y-4">
              {/* 1. Dados gerais */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">📋 Dados Gerais</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <MiniStat label="Nome" value={selected.name || selected.username} />
                  <MiniStat label="Email" value={selected.email || '-'} />
                  <MiniStat label="Username" value={selected.username} />
                  <MiniStat label="Status" value={selected.status === 'active' ? '🟢 Ativo' : '🔴 Bloqueado'} />
                  <MiniStat label="Série/Turma" value={selected.gradeLevel ?? 'Sem turma'} />
                  <MiniStat label="Conta criada" value={formatDate(selected.createdAt)} />
                  <MiniStat label="Último login" value={selected.lastLoginAt ? formatDate(selected.lastLoginAt) : 'Nunca'} />
                  <MiniStat label="Perfil" value={selected.role === 'admin' ? 'Administrador' : 'Aluno'} />
                  <MiniStat label="Ranking" value={(selected as any).rankingVisible !== false ? '✅ Participa' : '❌ Não participa'} />
                </div>
              </section>

              {/* 2. Engajamento */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">🔥 Engajamento</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <MiniStat label="Total de logins" value={selected.loginCount} />
                  <MiniStat label="Dias ativos" value={activeDays} />
                  <MiniStat label="Sequência atual" value={`${detailData.dashMeta?.streak ?? 0} dia(s)`} />
                  <MiniStat label="Última atividade" value={recentAttempts[0] ? formatDate(recentAttempts[0].answeredAt) : 'Nenhuma'} />
                </div>
              </section>

              {/* 3. Desempenho */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">📊 Desempenho</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <MiniStat label="Respondidas" value={answered} />
                  <MiniStat label="Acertos" value={correct} />
                  <MiniStat label="Erros" value={errors} />
                  <MiniStat label="% Acerto" value={`${rate}%`} />
                </div>
                {strongTopics.length > 0 && (
                  <div className="mt-2">
                    <p className="font-heading text-[10px] text-muted-foreground uppercase">Tópicos fortes:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {strongTopics.map(t => (
                        <span key={t.topic} className="font-heading text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5">
                          {t.topic} ({t.rate}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {weakTopics.length > 0 && (
                  <div className="mt-2">
                    <p className="font-heading text-[10px] text-muted-foreground uppercase">Tópicos fracos:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {weakTopics.map(t => (
                        <span key={t.topic} className="font-heading text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5">
                          {t.topic} ({t.rate}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 4. Diagnóstico */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">🩺 Diagnóstico</h3>
                {diagnostic ? (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <MiniStat label="Status" value="✅ Realizado" />
                      <MiniStat label="Data" value={formatDate(diagnostic.completed_at)} />
                      <MiniStat label="Nível" value={(diagnostic.recommended_plan as any)?.level ?? '-'} />
                      <MiniStat label="% Acerto" value={`${diagnostic.accuracy_rate}%`} />
                    </div>
                    {(diagnostic.weaknesses as any[])?.length > 0 && (
                      <p className="font-heading text-[10px] text-muted-foreground">
                        Fraquezas: {(diagnostic.weaknesses as any[]).join(', ')}
                      </p>
                    )}
                    {(diagnostic.recommended_plan as any)?.focusTopics && (
                      <p className="font-heading text-[10px] text-muted-foreground">
                        Recomendações: Focar em {(diagnostic.recommended_plan as any).focusTopics?.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-body text-xs text-muted-foreground">Diagnóstico não realizado.</p>
                )}
              </section>

              {/* 5. Revisão */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">📒 Revisão (Caderno de Erros)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Total itens" value={notebook.length} />
                  <MiniStat label="Pendentes" value={nbPending} />
                  <MiniStat label="Dominados" value={nbMastered} />
                </div>
              </section>

              {/* 6. Histórico recente */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">🕒 Histórico Recente</h3>
                {recentAttempts.length > 0 ? (
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {['Data', 'Questão', 'Tópico', 'Resultado'].map(h => (
                            <th key={h} className="font-heading text-[10px] text-left p-1.5 border border-border font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentAttempts.map((a, i) => {
                          const q = questionsMap.get(a.questionId);
                          return (
                            <tr key={i} className="hover:bg-muted/50">
                              <td className="p-1.5 border border-border font-heading text-[10px]">{formatDate(a.answeredAt)}</td>
                              <td className="p-1.5 border border-border font-body text-[10px]">{q?.statement?.slice(0, 40) ?? a.questionId}...</td>
                              <td className="p-1.5 border border-border font-heading text-[10px]">{topicsMap.get(q?.topicId ?? '') ?? '-'}</td>
                              <td className="p-1.5 border border-border font-heading text-[10px] font-bold">
                                {a.isCorrect ? <span className="text-primary">✅ Acertou</span> : <span className="text-destructive">❌ Errou</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="font-body text-xs text-muted-foreground">Sem atividade registrada.</p>
                )}
              </section>

              {/* 7. Redefinir Senha */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">🔐 Redefinir Senha</h3>
                {selected.authUserId ? (
                  <div className="flex gap-2 items-end">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nova senha (mín. 6)"
                      className="border border-border bg-background px-2 py-1 font-heading text-xs flex-1"
                      minLength={6}
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={resettingPassword || !newPassword}
                      className="font-heading text-xs bg-primary text-primary-foreground px-3 py-1 border border-primary disabled:opacity-50"
                    >
                      {resettingPassword ? 'Salvando...' : 'Redefinir'}
                    </button>
                  </div>
                ) : (
                  <p className="font-body text-xs text-muted-foreground">Usuário sem conta de autenticação vinculada.</p>
                )}
                {resetFeedback && <p className="font-heading text-xs mt-1">{resetFeedback}</p>}
              </section>

              {/* 8. Ações */}
              <section>
                <h3 className="font-heading text-xs font-bold uppercase text-primary mb-2">⚡ Ações</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleResetDiagnostic}
                    className="font-heading text-xs border border-border px-3 py-1.5 hover:bg-muted"
                  >
                    🔄 Resetar diagnóstico
                  </button>
                  <button
                    onClick={handleToggleStatus}
                    className={`font-heading text-xs border px-3 py-1.5 ${selected.status === 'active' ? 'border-destructive text-destructive hover:bg-destructive/10' : 'border-primary text-primary hover:bg-primary/10'}`}
                  >
                    {selected.status === 'active' ? '🚫 Bloquear aluno' : '✅ Ativar aluno'}
                  </button>
                  <button
                    onClick={handleToggleRanking}
                    className="font-heading text-xs border border-border px-3 py-1.5 hover:bg-muted"
                  >
                    {(selected as any).rankingVisible !== false ? '🏆 Remover do ranking' : '🏆 Incluir no ranking'}
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Selecione um usuário para ver o painel completo.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-background p-2">
      <p className="font-heading text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-sm font-bold text-foreground">{String(value)}</p>
    </div>
  );
}

// ============ ADMIN COMMENTS ============

function AdminComments({ onRefresh }: { onRefresh: () => void }) {
  const [filter, setFilter] = useState('all');
  const [selectedThread, setSelectedThread] = useState<{ questionId: string; commentId: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicMap, setTopicMap] = useState(new Map<string, string>());

  const loadData = useCallback(async () => {
    const [q, t] = await Promise.all([loadQuestionBank(), getTopics()]);
    setQuestions(q);
    setTopicMap(new Map(t.map(t => [t.id, t.name])));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const rows: { question: Question; comment: any; topic: string }[] = [];
  questions.forEach(q => {
    (q.comments ?? []).forEach(c => {
      if (filter !== 'all' && c.status !== filter) return;
      rows.push({ question: q, comment: c, topic: topicMap.get(q.topicId) ?? '-' });
    });
  });

  const selected = selectedThread ? (() => {
    const q = questions.find(x => x.id === selectedThread.questionId);
    const c = q?.comments.find(x => x.id === selectedThread.commentId);
    return q && c ? { question: q, comment: c } : null;
  })() : null;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Comentários</h2>
      <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-border bg-card px-2 py-1 font-heading text-xs">
        <option value="all">Todos</option>
        <option value="open">Em aberto</option>
        <option value="answered">Respondidos</option>
        <option value="hidden">Ocultos</option>
      </select>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {rows.length > 0 ? rows.map(({ question, comment, topic }) => (
            <button
              key={comment.id}
              onClick={() => setSelectedThread({ questionId: question.id, commentId: comment.id })}
              className={`w-full text-left border p-2 ${selectedThread?.commentId === comment.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
            >
              <p className="font-body text-xs font-semibold">{comment.text.slice(0, 60)}{comment.text.length > 60 ? '...' : ''}</p>
              <p className="font-heading text-[10px] text-muted-foreground">{comment.author.username} · {formatDate(comment.createdAt)} · {statusLabel(comment.status)}</p>
            </button>
          )) : <p className="font-body text-sm text-muted-foreground">Sem comentários.</p>}
        </div>

        <div className="border border-border bg-card p-3">
          {selected ? (
            <div className="space-y-2">
              <p className="font-body text-sm"><strong>{selected.comment.author.username}:</strong> {selected.comment.text}</p>
              <p className="font-heading text-xs text-muted-foreground">{formatDate(selected.comment.createdAt)} · {statusLabel(selected.comment.status)}</p>
              {selected.comment.replies.map((r: any) => (
                <div key={r.id} className="ml-4 p-2 bg-muted"><p className="font-heading text-xs"><strong>{r.author.username}:</strong> {r.text}</p></div>
              ))}
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Responder" className="w-full border border-border bg-background p-2 font-body text-sm min-h-[40px]" />
              <div className="flex gap-2">
                <button onClick={async () => { if (replyText.trim() && selectedThread) { await addReply(selectedThread.questionId, selectedThread.commentId, { author: { username: 'admin', role: 'admin' }, text: replyText.trim() }); setReplyText(''); await loadData(); onRefresh(); } }} className="font-heading text-xs bg-primary text-primary-foreground px-3 py-1 border border-primary">Responder</button>
                <button onClick={async () => { if (selectedThread) { await setCommentStatus(selectedThread.questionId, selectedThread.commentId, 'open'); await loadData(); onRefresh(); } }} className="font-heading text-xs border border-border px-3 py-1">Reabrir</button>
                <button onClick={async () => { if (selectedThread) { await setCommentStatus(selectedThread.questionId, selectedThread.commentId, 'hidden'); await loadData(); onRefresh(); } }} className="font-heading text-xs text-destructive border border-destructive px-3 py-1">Ocultar</button>
              </div>
            </div>
          ) : <p className="font-body text-sm text-muted-foreground">Selecione um comentário.</p>}
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN NOTEBOOK ============

function AdminNotebook() {
  const [selectedUser, setSelectedUser] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<User[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);

  useEffect(() => {
    Promise.all([getUsersByRole('student'), loadQuestionBank()]).then(([s, q]) => {
      setStudents(s.sort((a, b) => a.username.localeCompare(b.username)));
      setQuestions(q);
    });
  }, []);

  useEffect(() => {
    if (selectedUser) {
      getNotebook(selectedUser).then(setNotebookItems);
    } else {
      setNotebookItems([]);
    }
  }, [selectedUser]);

  const questionsMap = new Map(questions.map(q => [q.id, q]));
  let items = notebookItems;
  if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
  if (search) {
    const needle = search.toLowerCase();
    items = items.filter(i => {
      const q = questionsMap.get(i.questionId);
      return `${i.whatIErred} ${i.ruleInsight} ${q?.statement ?? ''}`.toLowerCase().includes(needle);
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Caderno (inspeção)</h2>
      <div className="flex gap-2">
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="border border-border bg-card px-2 py-1 font-heading text-xs">
          <option value="">Selecione aluno</option>
          {students.map(s => <option key={s.id} value={s.username}>{s.username} ({s.gradeLevel ?? 'sem turma'})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border bg-card px-2 py-1 font-heading text-xs">
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="mastered">Dominados</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar" className="border border-border bg-card px-2 py-1 font-heading text-xs" />
      </div>

      {items.length > 0 ? items.map(item => {
        const q = questionsMap.get(item.questionId);
        return (
          <div key={item.questionId} className="border border-border bg-card p-3">
            <p className="font-body text-sm font-semibold">{q?.statement ?? item.questionId}</p>
            <p className="font-heading text-xs text-muted-foreground">{q ? `${q.grade} · ${subjectLabel(q.subject)} · ${difficultyLabel(q.difficulty)}` : 'Questão removida'} · {statusLabel(item.status)}</p>
            {item.whatIErred && <p className="font-body text-xs mt-1"><strong>Erro:</strong> {item.whatIErred}</p>}
            {item.ruleInsight && <p className="font-body text-xs"><strong>Insight:</strong> {item.ruleInsight}</p>}
          </div>
        );
      }) : <p className="font-body text-sm text-muted-foreground">{selectedUser ? 'Nenhum item no caderno.' : 'Selecione um aluno.'}</p>}
    </div>
  );
}

// ============ ADMIN REPORTS ============

function AdminReports({ onRefresh }: { onRefresh: () => void }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);

  const loadData = useCallback(async () => {
    setReports(await getReports());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  let filtered = reports;
  if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
  if (search) {
    const needle = search.toLowerCase();
    filtered = filtered.filter(r => `${r.type} ${r.message} ${r.questionMeta?.preview ?? ''} ${r.createdBy?.username ?? ''}`.toLowerCase().includes(needle));
  }

  const selected = filtered.find(r => r.id === selectedId);

  const handleStatus = async (id: string, status: string) => {
    await setReportStatus(id, status, '', { username: user?.username ?? 'admin', role: 'admin' });
    await loadData();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Erros reportados</h2>
      <div className="flex gap-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border bg-card px-2 py-1 font-heading text-xs">
          <option value="all">Todos</option>
          <option value="open">Em aberto</option>
          <option value="resolved">Resolvidos</option>
          <option value="ignored">Ignorados</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar" className="border border-border bg-card px-2 py-1 font-heading text-xs" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-muted">
              {['Questão','Tipo','Usuário','Status','Ações'].map(h => <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={selectedId === r.id ? 'bg-primary/5' : ''}>
                  <td className="p-2 border border-border font-body text-xs">{(r.questionMeta?.preview ?? '').slice(0, 50)}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.type}</td>
                  <td className="p-2 border border-border font-heading text-xs">{r.createdBy?.username ?? '-'}</td>
                  <td className="p-2 border border-border font-heading text-xs">{statusLabel(r.status)}</td>
                  <td className="p-2 border border-border">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedId(r.id)} className="font-heading text-[10px] border border-border px-2 py-0.5">Ver</button>
                      <button onClick={() => handleStatus(r.id, 'resolved')} className="font-heading text-[10px] bg-primary text-primary-foreground px-2 py-0.5 border border-primary">Resolver</button>
                      <button onClick={() => handleStatus(r.id, 'ignored')} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Ignorar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-border bg-card p-3">
          {selected ? (
            <div className="space-y-2">
              <p className="font-heading text-xs"><strong>Status:</strong> {statusLabel(selected.status)}</p>
              <p className="font-heading text-xs"><strong>Tipo:</strong> {selected.type}</p>
              <p className="font-heading text-xs"><strong>Autor:</strong> {selected.createdBy?.username ?? '-'} · {formatDate(selected.createdAt)}</p>
              <p className="font-body text-sm"><strong>Mensagem:</strong> {selected.message}</p>
              <p className="font-body text-xs"><strong>Questão:</strong> {selected.questionMeta?.preview ?? ''}</p>
            </div>
          ) : <p className="font-body text-sm text-muted-foreground">Selecione um relatório.</p>}
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN EXPORT ============

function AdminExport() {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const exportCSV = async () => {
    setLoading(true);
    setFeedback('');
    try {
      const [questions, topics] = await Promise.all([loadQuestionBank(), getTopics({})]);
      const topicMap = new Map(topics.map(t => [t.id, t.name]));

      const headers = ['pergunta', 'a', 'b', 'c', 'd', 'e', 'correta', 'topico', 'explicacao', 'serie', 'disciplina', 'dificuldade', 'status'];
      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };

      const rows = questions.map(q => {
        const opts = q.options as string[];
        const correctLetter = ['A','B','C','D','E'][q.correctIndex] ?? '';
        return [
          escapeCSV(q.statement),
          ...opts.map(o => escapeCSV(o || '')),
          correctLetter,
          escapeCSV(topicMap.get(q.topicId) ?? q.topicId ?? ''),
          escapeCSV(q.explanation || ''),
          q.grade,
          subjectLabel(q.subject),
          difficultyLabel(q.difficulty),
          statusLabel(q.status),
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questoes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback(`✅ ${questions.length} questões exportadas com sucesso.`);
    } catch (err: any) {
      setFeedback(`❌ Erro: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-bold uppercase mb-3">📤 Exportar Questões (CSV)</h2>
        <p className="font-body text-sm text-muted-foreground mb-4">
          Exporte todas as questões do banco em formato CSV compatível com a importação.
        </p>
        <button onClick={exportCSV} disabled={loading} className="font-heading text-sm bg-primary text-primary-foreground px-4 py-1.5 border border-primary disabled:opacity-40">
          {loading ? 'Exportando...' : 'Baixar CSV'}
        </button>
        {feedback && <p className="font-heading text-xs mt-2">{feedback}</p>}
      </div>
    </div>
  );
}

// ============ ADMIN IMPORT ============

function AdminImport({ onRefresh }: { onRefresh: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');
  const [importing, setImporting] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [defaultGrade, setDefaultGrade] = useState('7EF');
  const [defaultSubject, setDefaultSubject] = useState('math');
  const [defaultDifficulty, setDefaultDifficulty] = useState('easy');

  useEffect(() => {
    getTopics({ activeOnly: true }).then(setTopics);
  }, []);

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQuotes) {
        if (ch === '\r') i++;
        row.push(current.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    if (row.some(c => c !== '')) rows.push(row);
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFeedback('');
    setPreview([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { setFeedback('CSV vazio ou sem dados.'); return; }

      const header = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      const colMap = {
        pergunta: header.findIndex(h => ['pergunta', 'enunciado', 'statement', 'questão', 'questao'].includes(h)),
        altA: header.findIndex(h => ['a', 'alternativa a', 'alt_a', 'opção a', 'opcao a', 'alternativa_a'].includes(h)),
        altB: header.findIndex(h => ['b', 'alternativa b', 'alt_b', 'opção b', 'opcao b', 'alternativa_b'].includes(h)),
        altC: header.findIndex(h => ['c', 'alternativa c', 'alt_c', 'opção c', 'opcao c', 'alternativa_c'].includes(h)),
        altD: header.findIndex(h => ['d', 'alternativa d', 'alt_d', 'opção d', 'opcao d', 'alternativa_d'].includes(h)),
        altE: header.findIndex(h => ['e', 'alternativa e', 'alt_e', 'opção e', 'opcao e', 'alternativa_e'].includes(h)),
        correta: header.findIndex(h => ['correta', 'resposta', 'correct', 'alternativa correta', 'resposta_correta'].includes(h)),
        topico: header.findIndex(h => ['tópico', 'topico', 'topic', 'tema'].includes(h)),
        explicacao: header.findIndex(h => ['explicação', 'explicacao', 'explanation', 'resolução', 'resolucao'].includes(h)),
        serie: header.findIndex(h => ['série', 'serie', 'grade', 'ano'].includes(h)),
        disciplina: header.findIndex(h => ['disciplina', 'matéria', 'materia', 'subject'].includes(h)),
        dificuldade: header.findIndex(h => ['dificuldade', 'difficulty', 'nivel', 'nível'].includes(h)),
      };

      if (colMap.pergunta === -1) {
        setFeedback(`Coluna "pergunta" não encontrada. Colunas detectadas: ${header.join(', ')}`);
        return;
      }

      const parsed = dataRows.map(row => {
        const get = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : '';
        const correctRaw = get(colMap.correta).toUpperCase().trim();
        const correctIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(correctRaw);

        const topicName = get(colMap.topico);
        const matchedTopic = topics.find(t =>
          t.name.toLowerCase() === topicName.toLowerCase() ||
          t.label.toLowerCase() === topicName.toLowerCase()
        );

        const gradeRaw = get(colMap.serie);
        const grade = GRADES.includes(gradeRaw as any) ? gradeRaw : defaultGrade;

        const subjRaw = get(colMap.disciplina);
        const subject = SUBJECTS_REVERSE[subjRaw] ?? (Object.keys(SUBJECTS_MAP).includes(subjRaw) ? subjRaw : defaultSubject);

        const diffRaw = get(colMap.dificuldade);
        const difficulty = DIFFICULTIES_REVERSE[diffRaw] ?? (Object.keys(DIFFICULTIES_MAP).includes(diffRaw) ? diffRaw : defaultDifficulty);

        return {
          statement: get(colMap.pergunta),
          options: [get(colMap.altA), get(colMap.altB), get(colMap.altC), get(colMap.altD), get(colMap.altE)],
          correctIndex,
          correctLetter: correctRaw,
          topicName,
          topicId: matchedTopic?.id ?? '',
          explanation: get(colMap.explicacao),
          grade,
          subject,
          difficulty,
          valid: !!get(colMap.pergunta) && correctIndex >= 0,
        };
      });

      setPreview(parsed);
      const valid = parsed.filter(p => p.valid).length;
      const invalid = parsed.length - valid;
      setFeedback(`${parsed.length} questões detectadas. ${valid} válidas, ${invalid} com problemas.`);
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleImport = async () => {
    const valid = preview.filter(p => p.valid);
    if (!valid.length) { setFeedback('Nenhuma questão válida para importar.'); return; }

    setImporting(true);
    try {
      const questions = valid.map(p => ({
        id: uid('q'),
        grade: p.grade,
        subject: p.subject,
        difficulty: p.difficulty,
        topicId: p.topicId,
        statement: p.statement,
        options: p.options,
        correctIndex: p.correctIndex,
        explanation: p.explanation,
        status: 'published' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: [],
      }));

      await saveQuestionsBulk(questions);
      setFeedback(`✅ ${valid.length} questões importadas com sucesso!`);
      setPreview([]);
      setFile(null);
      onRefresh();
    } catch (err) {
      setFeedback(`Erro ao importar: ${err}`);
    } finally {
      setImporting(false);
    }
  };

  const sampleCSV = `pergunta,a,b,c,d,e,correta,tópico,explicação\n"Quanto é 2+2?","3","4","5","6","7","B","Aritmética","2+2=4"\n"Qual a raiz de 9?","2","3","4","5","6","B","Raízes","√9=3"`;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Importar questões via CSV</h2>

      <div className="border border-border bg-card p-3 space-y-3">
        <div>
          <h3 className="font-heading text-xs font-bold mb-1">Formato esperado do CSV</h3>
          <p className="font-body text-xs text-muted-foreground mb-2">
            Colunas obrigatórias: <strong>pergunta, a, b, c, d, e, correta</strong>.
            Opcionais: <strong>tópico, explicação, série, disciplina, dificuldade</strong>.
          </p>
          <details className="text-xs">
            <summary className="font-heading cursor-pointer text-primary">Ver exemplo de CSV</summary>
            <pre className="mt-1 bg-muted p-2 font-mono text-[11px] overflow-x-auto whitespace-pre">{sampleCSV}</pre>
            <button
              onClick={() => {
                const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'modelo_questoes.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="mt-1 font-heading text-[10px] border border-primary text-primary px-2 py-0.5"
            >
              Baixar modelo CSV
            </button>
          </details>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="font-heading text-[10px] text-muted-foreground uppercase">Série padrão</label>
            <select value={defaultGrade} onChange={e => setDefaultGrade(e.target.value)} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="font-heading text-[10px] text-muted-foreground uppercase">Disciplina padrão</label>
            <select value={defaultSubject} onChange={e => setDefaultSubject(e.target.value)} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              {Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="font-heading text-[10px] text-muted-foreground uppercase">Dificuldade padrão</label>
            <select value={defaultDifficulty} onChange={e => setDefaultDifficulty(e.target.value)} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
        </div>

        <input type="file" accept=".csv" onChange={handleFile} className="font-heading text-xs" />
      </div>

      {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}

      {preview.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted sticky top-0">
                  {['#', 'Pergunta', 'Correta', 'Tópico', 'Série', 'Disciplina', 'Dific.', 'Status'].map(h => (
                    <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className={p.valid ? '' : 'bg-destructive/10'}>
                    <td className="p-2 border border-border font-heading text-xs">{i + 1}</td>
                    <td className="p-2 border border-border font-body text-xs">{p.statement.slice(0, 60)}</td>
                    <td className="p-2 border border-border font-heading text-xs">{p.correctLetter || '⚠️'}</td>
                    <td className="p-2 border border-border font-heading text-xs">{p.topicId ? '✅' : (p.topicName || '—')}</td>
                    <td className="p-2 border border-border font-heading text-xs">{p.grade}</td>
                    <td className="p-2 border border-border font-heading text-xs">{subjectLabel(p.subject)}</td>
                    <td className="p-2 border border-border font-heading text-xs">{difficultyLabel(p.difficulty)}</td>
                    <td className="p-2 border border-border font-heading text-xs">{p.valid ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !preview.some(p => p.valid)}
            className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary disabled:opacity-40"
          >
            {importing ? 'Importando...' : `Importar ${preview.filter(p => p.valid).length} questões válidas`}
          </button>
        </div>
      )}
    </div>
  );
}
