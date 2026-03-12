import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getNotebook, loadQuestionBank, getTopics, upsertNotebookItem, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { CheckCircle2, Search } from 'lucide-react';
import type { Question, Topic, NotebookItem } from '../../lib/types';

export function StudentNotebook({ onRefazer }: { onRefazer: (questionId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [filters, setFilters] = useState({ grade: '', subject: '', difficulty: '', topicId: '', status: '' });
  const [search, setSearch] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { error: loadError, execute } = useLoadWithTimeout();

  const loadData = useCallback(async () => {
    setLoading(true);
    await execute(async () => {
      const [questions, topics, notebook, allowedSlugs] = await Promise.all([
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        getNotebook(userId),
        getAllowedSubjectSlugs(userId),
      ]);
      setAllQuestions(questions.filter(q => allowedSlugs.includes(q.subject)));
      setAllTopics(topics.filter(t => allowedSlugs.includes(t.subject)));
      setNotebookItems(notebook);
      setLoading(false);
    });
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);
  useVisibilityRefresh(loadData);

  const questionsMap = useMemo(() => new Map(allQuestions.map(q => [q.id, q])), [allQuestions]);

  const items = useMemo(() => {
    let notebook = [...notebookItems].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return notebook.filter(item => {
      const q = questionsMap.get(item.questionId);
      const grade = item.grade ?? q?.grade ?? '';
      const subject = item.subject ?? q?.subject ?? '';
      const difficulty = item.difficulty ?? q?.difficulty ?? '';
      const topicId = item.topicId ?? q?.topicId ?? '';

      if (filters.grade && grade !== filters.grade) return false;
      if (filters.subject && subject !== subjectCode(filters.subject)) return false;
      if (filters.difficulty && difficulty !== difficultyCode(filters.difficulty)) return false;
      if (filters.topicId && topicId !== filters.topicId) return false;
      if (filters.status && item.status !== filters.status) return false;

      // Search filter
      if (search) {
        const needle = search.toLowerCase();
        const topicName = allTopics.find(t => t.id === topicId)?.name ?? '';
        const statement = q?.statement ?? '';
        const qId = item.questionId ?? '';
        if (
          !qId.toLowerCase().includes(needle) &&
          !statement.toLowerCase().includes(needle) &&
          !topicName.toLowerCase().includes(needle) &&
          !subjectLabel(subject).toLowerCase().includes(needle)
        ) return false;
      }

      return true;
    });
  }, [notebookItems, filters, search, questionsMap, allTopics]);

  if (loading) return <p className="text-muted-foreground">Carregando caderno de erros...</p>;
  if (loadError) return <LoadingTimeout error={loadError} onRetry={loadData} />;

  const pending = items.filter(i => i.status === 'pending');
  const mastered = items.filter(i => i.status === 'mastered');

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-destructive">{pending.length}</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-muted-foreground">Dominados</p>
          <p className="text-2xl font-bold text-success">{mastered.length}</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground">{notebookItems.length}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, tema, texto da questão..."
            className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filters.grade} onChange={e => setFilters(f => ({ ...f, grade: e.target.value }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas séries</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas disciplinas</option>
            {Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.difficulty} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas dificuldades</option>
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.topicId} onChange={e => setFilters(f => ({ ...f, topicId: e.target.value }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todos tópicos</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="mastered">Dominado</option>
          </select>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum item com os filtros atuais.</p>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {items.map(item => {
            const q = questionsMap.get(item.questionId);
            if (!q) return null;
            return (
              <NotebookCard
                key={item.questionId}
                item={item}
                question={q}
                userId={userId}
                onRefazer={() => onRefazer(q.id)}
                onSave={loadData}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotebookCard({ item, question: q, userId, onRefazer, onSave }: {
  item: any; question: any; userId: string; onRefazer: () => void; onSave: () => void;
}) {
  const [whatIErred, setWhatIErred] = useState(item.whatIErred);
  const [ruleInsight, setRuleInsight] = useState(item.ruleInsight);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (mastered: boolean) => {
    if (saving) return;
    setSaving(true);
    await upsertNotebookItem(userId, q.id, { whatIErred, ruleInsight, ...(mastered ? { status: 'mastered' } : {}) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave();
  };

  return (
    <article className="bg-card rounded-xl shadow-sm p-5">
      <h4 className="text-sm font-medium text-foreground">{q.statement}</h4>
      <p className="text-xs text-muted-foreground mt-1">
        {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · Status: {statusLabel(item.status)}
      </p>

      <label className="text-xs text-muted-foreground block mt-3 mb-1">O que eu errei?</label>
      <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" />

      <label className="text-xs text-muted-foreground block mt-2 mb-1">Regra / insight</label>
      <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" />

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="rounded-lg text-xs font-medium text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onRefazer} className="rounded-lg text-xs font-medium text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">
          Refazer
        </button>
        {item.status === 'pending' && (
          <button onClick={() => handleSave(true)} disabled={saving}
            className="rounded-lg text-xs font-medium bg-success text-success-foreground px-4 py-1.5 hover:brightness-110 transition-all disabled:opacity-50">
            ✓ Dominado
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo!
          </span>
        )}
      </div>
    </article>
  );
}
