import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from '../student/LoginForm';
import { initStorageFromSeeds, resetToSeed, loadQuestionBank, saveQuestionBank, getTopics, getAttempts, loadUsers, getUsersByRole, getLessons, saveLesson, updateLesson, deleteLesson, getNotebook, getReports, setReportStatus, updateReport, addReply, setCommentStatus, getTrainingPlans, addTrainingPlan, upsertUser, createTopic, updateTopic, toggleTopicStatus, deleteTopic } from '../../lib/storage';
import { subjectLabel, difficultyLabel, statusLabel, formatDate, uid, subjectCode, difficultyCode } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import type { Question, Topic, Lesson, Report } from '../../lib/types';

type Panel = 'dashboard' | 'questions' | 'lessons' | 'cadastros' | 'users' | 'comments' | 'notebook' | 'reports' | 'import';

export function AdminApp() {
  const { user, logout } = useAuth();
  const [panel, setPanel] = useState<Panel>('dashboard');
  const [, setRefresh] = useState(0);
  const forceRefresh = useCallback(() => setRefresh(n => n + 1), []);

  useEffect(() => { initStorageFromSeeds(); }, []);

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
    { label: 'Conteúdo', items: [{ id: 'questions' as Panel, label: 'Questões' }, { id: 'lessons' as Panel, label: 'Aulas' }, { id: 'cadastros' as Panel, label: 'Tópicos' }, { id: 'import' as Panel, label: 'Importar' }] },
    { label: 'Pessoas', items: [{ id: 'users' as Panel, label: 'Usuários' }, { id: 'comments' as Panel, label: 'Comentários' }, { id: 'notebook' as Panel, label: 'Caderno' }] },
    { label: 'Qualidade', items: [{ id: 'reports' as Panel, label: 'Erros reportados' }] },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader user={user} onLogout={logout} />

      <main className="max-w-[1160px] mx-auto px-4 py-5">
        {/* Menu */}
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

        {panel === 'dashboard' && <AdminDashboard />}
        {panel === 'questions' && <AdminQuestions onRefresh={forceRefresh} />}
        {panel === 'lessons' && <AdminLessons onRefresh={forceRefresh} />}
        {panel === 'cadastros' && <AdminTopics onRefresh={forceRefresh} />}
        {panel === 'users' && <AdminUsers onRefresh={forceRefresh} />}
        {panel === 'comments' && <AdminComments onRefresh={forceRefresh} />}
        {panel === 'notebook' && <AdminNotebook />}
        {panel === 'reports' && <AdminReports onRefresh={forceRefresh} />}
        {panel === 'import' && <AdminImport onRefresh={forceRefresh} />}
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

function AdminDashboard() {
  const questions = loadQuestionBank();
  const attempts = getAttempts();
  const users = loadUsers();
  const published = questions.filter(q => q.status !== 'draft').length;
  const draft = questions.length - published;
  const activeUsers = new Set(attempts.map(a => a.userId).filter(Boolean)).size;
  const correct = attempts.filter(a => a.isCorrect).length;
  const globalRate = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

  const countBy = (arr: any[], picker: (item: any) => string) => {
    const map = new Map<string, number>();
    arr.forEach(item => {
      const key = picker(item) ?? '-';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
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

function AdminQuestions({ onRefresh }: { onRefresh: () => void }) {
  const topics = getTopics({ activeOnly: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    grade: '7EF', subject: 'math', difficulty: 'easy', topicId: topics[0]?.id ?? '', status: 'published',
    statement: '', options: ['', '', '', '', ''], correctLetter: '', explanation: '',
  });
  const [feedback, setFeedback] = useState('');
  const questions = loadQuestionBank();

  const resetForm = () => {
    setEditingId(null);
    setForm({ grade: '7EF', subject: 'math', difficulty: 'easy', topicId: topics[0]?.id ?? '', status: 'published', statement: '', options: ['', '', '', '', ''], correctLetter: '', explanation: '' });
    setFeedback('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.statement) { setFeedback('Enunciado é obrigatório.'); return; }
    if (form.options.some(o => !o)) { setFeedback('Preencha todas as alternativas.'); return; }
    if (!form.correctLetter) { setFeedback('Selecione a resposta correta.'); return; }

    const correctIndex = ['A','B','C','D','E'].indexOf(form.correctLetter);
    const bank = loadQuestionBank();
    const q: any = {
      id: editingId ?? uid('q'),
      grade: form.grade, subject: form.subject, difficulty: form.difficulty, topicId: form.topicId,
      statement: form.statement, options: form.options, correctIndex,
      explanation: form.explanation, status: form.status,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [],
    };

    if (editingId) {
      const existing = bank.find(x => x.id === editingId);
      if (existing) { q.createdAt = existing.createdAt; q.comments = existing.comments; }
      const idx = bank.findIndex(x => x.id === editingId);
      if (idx >= 0) bank[idx] = q;
    } else {
      bank.unshift(q);
    }
    saveQuestionBank(bank);
    setFeedback('Questão salva.');
    resetForm();
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

  const handleDelete = (id: string) => {
    saveQuestionBank(loadQuestionBank().filter(q => q.id !== id));
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-sm font-bold uppercase">Questões</h2>
        <div className="flex gap-2">
          <button onClick={resetForm} className="font-heading text-xs border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">Nova questão</button>
          <button onClick={() => { resetToSeed(); onRefresh(); }} className="font-heading text-xs text-destructive border border-destructive px-2 py-0.5">Reiniciar dados</button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <h3 className="font-heading text-xs font-bold">{editingId ? 'Editar questão' : 'Nova questão'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <select value={form.topicId} onChange={e => setForm(f => ({ ...f, topicId: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              {['Série','Disciplina','Dificuldade','Tópico','Enunciado','Status','Ações'].map(h => (
                <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map(q => (
              <tr key={q.id} className="hover:bg-muted/50">
                <td className="p-2 border border-border font-heading text-xs">{q.grade}</td>
                <td className="p-2 border border-border font-heading text-xs">{subjectLabel(q.subject)}</td>
                <td className="p-2 border border-border font-heading text-xs">{difficultyLabel(q.difficulty)}</td>
                <td className="p-2 border border-border font-heading text-xs">{getTopics().find(t => t.id === q.topicId)?.name ?? '-'}</td>
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

function AdminLessons({ onRefresh }: { onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', url: '', subject: 'math', grade: '7EF', topic: '' });
  const [feedback, setFeedback] = useState('');
  const topics = getTopics({ activeOnly: true });
  const lessons = getLessons();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.url || !form.topic) { setFeedback('Preencha todos os campos.'); return; }
    if (editingId) {
      updateLesson(editingId, { ...form, id: editingId });
      setFeedback('Aula atualizada.');
    } else {
      saveLesson({ ...form, id: uid('lesson') });
      setFeedback('Aula salva.');
    }
    setEditingId(null);
    setForm({ title: '', url: '', subject: 'math', grade: '7EF', topic: topics[0]?.id ?? '' });
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
                  <button onClick={() => { deleteLesson(l.id); onRefresh(); }} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminTopics({ onRefresh }: { onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', subject: 'math', grade: 'all', status: 'active' });
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState({ subject: 'all', status: 'all', search: '' });

  let topics = getTopics();
  if (filter.subject !== 'all') topics = topics.filter(t => t.subject === filter.subject);
  if (filter.status !== 'all') topics = topics.filter(t => t.status === filter.status);
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    topics = topics.filter(t => `${t.name} ${t.subject} ${t.grade}`.toLowerCase().includes(needle));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subject) { setFeedback('Preencha nome e disciplina.'); return; }
    if (editingId) {
      updateTopic(editingId, { name: form.name, subject: form.subject, grade: form.grade, status: form.status as any });
      setFeedback('Tópico atualizado.');
    } else {
      createTopic({ id: uid('topic'), name: form.name, subject: form.subject, grade: form.grade, status: form.status as any, label: form.name });
      setFeedback('Tópico criado.');
    }
    setEditingId(null);
    setForm({ name: '', subject: 'math', grade: 'all', status: 'active' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Tópicos/Assuntos</h2>
      <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do tópico" className="w-full border border-border bg-background px-2 py-1 font-body text-sm" required />
        <div className="grid grid-cols-3 gap-2">
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-background px-2 py-1 font-heading text-xs">
            {Object.entries(SUBJECTS_MAP).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
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
          {Object.entries(SUBJECTS_MAP).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
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
                  <button onClick={() => { toggleTopicStatus(t.id); onRefresh(); }} className="font-heading text-[10px] border border-border px-2 py-0.5">{t.status === 'active' ? 'Desativar' : 'Reativar'}</button>
                  <button onClick={() => { deleteTopic(t.id); onRefresh(); }} className="font-heading text-[10px] text-destructive border border-destructive px-2 py-0.5">Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminUsers({ onRefresh }: { onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'student', status: 'active', gradeLevel: '' });
  const [feedback, setFeedback] = useState('');
  const users = loadUsers().sort((a, b) => a.username.localeCompare(b.username));
  const selected = users.find(u => u.username === selectedId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { setFeedback('Obrigatório.'); return; }
    upsertUser({ username: form.username, password: form.password, role: form.role as any, status: form.status as any, gradeLevel: form.gradeLevel || null } as any);
    setFeedback('Salvo.');
    onRefresh();
  };

  const selectedAttempts = selectedId ? getAttempts(selectedId) : [];
  const answered = selectedAttempts.length;
  const correct = selectedAttempts.filter(a => a.isCorrect).length;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Usuários</h2>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
        <div className="space-y-3">
          <form onSubmit={handleSubmit} className="border border-border bg-card p-3 space-y-2">
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username" className="w-full border border-border bg-background px-2 py-1 font-heading text-xs" required />
            <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Senha" className="w-full border border-border bg-background px-2 py-1 font-heading text-xs" required />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              <option value="student">aluno</option><option value="admin">administrador</option>
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              <option value="active">ativo</option><option value="blocked">bloqueado</option>
            </select>
            <select value={form.gradeLevel} onChange={e => setForm(f => ({ ...f, gradeLevel: e.target.value }))} className="w-full border border-border bg-background px-2 py-1 font-heading text-xs">
              <option value="">Nenhuma</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button type="submit" className="font-heading text-xs bg-primary text-primary-foreground px-4 py-1.5 border border-primary w-full">Salvar</button>
            {feedback && <p className="font-heading text-xs text-primary">{feedback}</p>}
          </form>

          <div className="space-y-1">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedId(u.username);
                  setForm({ username: u.username, password: u.password, role: u.role, status: u.status, gradeLevel: u.gradeLevel ?? '' });
                }}
                className={`w-full text-left border p-2 ${selectedId === u.username ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
              >
                <p className="font-heading text-xs font-bold">{u.username}</p>
                <p className="font-heading text-[10px] text-muted-foreground">{u.role} · {u.status} · {u.gradeLevel ?? 'sem turma'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          {selected ? (
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold">Inspeção: {selected.username}</h3>
              <p className="font-heading text-xs text-muted-foreground">Turma: {selected.gradeLevel ?? 'sem turma'} · Status: {selected.status}</p>
              <p className="font-heading text-xs">Respondidas: {answered} | Acertos: {correct} | Aproveitamento: {rate}%</p>
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Selecione um usuário para inspecionar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminComments({ onRefresh }: { onRefresh: () => void }) {
  const [filter, setFilter] = useState('all');
  const [selectedThread, setSelectedThread] = useState<{ questionId: string; commentId: string } | null>(null);
  const [replyText, setReplyText] = useState('');

  const questions = loadQuestionBank();
  const rows: { question: Question; comment: any; topic: string }[] = [];
  const topicMap = new Map(getTopics().map(t => [t.id, t.name]));

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
                <button onClick={() => { if (replyText.trim() && selectedThread) { addReply(selectedThread.questionId, selectedThread.commentId, { author: { username: 'admin', role: 'admin' }, text: replyText.trim() }); setReplyText(''); onRefresh(); } }} className="font-heading text-xs bg-primary text-primary-foreground px-3 py-1 border border-primary">Responder</button>
                <button onClick={() => { if (selectedThread) { setCommentStatus(selectedThread.questionId, selectedThread.commentId, 'open'); onRefresh(); } }} className="font-heading text-xs border border-border px-3 py-1">Reabrir</button>
                <button onClick={() => { if (selectedThread) { setCommentStatus(selectedThread.questionId, selectedThread.commentId, 'hidden'); onRefresh(); } }} className="font-heading text-xs text-destructive border border-destructive px-3 py-1">Ocultar</button>
              </div>
            </div>
          ) : <p className="font-body text-sm text-muted-foreground">Selecione um comentário.</p>}
        </div>
      </div>
    </div>
  );
}

function AdminNotebook() {
  const [selectedUser, setSelectedUser] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const students = getUsersByRole('student').sort((a, b) => a.username.localeCompare(b.username));
  const questionsMap = new Map(loadQuestionBank().map(q => [q.id, q]));

  let items = selectedUser ? getNotebook(selectedUser) : [];
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

function AdminReports({ onRefresh }: { onRefresh: () => void }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();

  let reports = getReports();
  if (statusFilter !== 'all') reports = reports.filter(r => r.status === statusFilter);
  if (search) {
    const needle = search.toLowerCase();
    reports = reports.filter(r => `${r.type} ${r.message} ${r.questionMeta?.preview ?? ''} ${r.createdBy?.username ?? ''}`.toLowerCase().includes(needle));
  }

  const selected = reports.find(r => r.id === selectedId);

  const handleStatus = (id: string, status: string) => {
    setReportStatus(id, status, '', { username: user?.username ?? 'admin', role: 'admin' });
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
              {reports.map(r => (
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

function AdminImport({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">Importar</h2>
      <div className="border border-border bg-card p-4">
        <p className="font-body text-sm text-muted-foreground">
          Funcionalidade de importação JSON/CSV/PDF será migrada em breve. 
          Para importar questões agora, use o painel de questões para cadastrar manualmente.
        </p>
      </div>
    </div>
  );
}
