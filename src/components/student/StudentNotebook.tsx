import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getNotebook, loadQuestionBank, getTopics, upsertNotebookItem, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import { LoadingState, ScreenErrorState } from './ScreenStates';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { CheckCircle2, Search, CalendarClock, BookOpen, AlertCircle, RotateCw } from 'lucide-react';
import type { Question, Topic, NotebookItem } from '../../lib/types';

const REVIEW_INTERVALS = [3, 7, 15];

function getNextReviewDate(reviewCount: number): string {
  const days = REVIEW_INTERVALS[Math.min(reviewCount, REVIEW_INTERVALS.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isReviewDue(item: NotebookItem): boolean {
  if (item.status === 'mastered') return false;
  if (!item.nextReviewAt) return false;
  return new Date(item.nextReviewAt) <= new Date();
}

function formatReviewDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Revisão agora!';
  if (diff === 1) return 'Amanhã';
  return `Em ${diff} dias`;
}

export function StudentNotebook({ onRefazer }: { onRefazer: (questionId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [filters, setFilters] = useState({ grade: '', subject: '', difficulty: '', topicId: '', status: '', reviewDue: false });
  const [search, setSearch] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { error: loadError, execute } = useLoadWithTimeout();

  const loadData = useCallback(async () => {
    setLoading(true);
    try { await execute(async () => {
      const [questions, topics, notebook, allowedSlugs] = await Promise.all([
        loadQuestionBank(),
        getTopics({ activeOnly: true }),
        getNotebook(userId),
        getAllowedSubjectSlugs(userId),
      ]);
      setAllQuestions(questions.filter(q => allowedSlugs.includes(q.subject)));
      setAllTopics(topics.filter(t => allowedSlugs.includes(t.subject)));
      setNotebookItems(notebook);
    });
    } finally { setLoading(false); }
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);
  // MVP: useVisibilityRefresh DISABLED — no auto-reload on tab focus

  const questionsMap = useMemo(() => new Map(allQuestions.map(q => [q.id, q])), [allQuestions]);

  const dueCount = useMemo(() => notebookItems.filter(isReviewDue).length, [notebookItems]);

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
      if (filters.reviewDue && !isReviewDue(item)) return false;

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

  if (loading) return <LoadingState message="Carregando caderno de erros..." />;
  if (loadError) return <ScreenErrorState error={loadError} onRetry={loadData} />;

  const pending = items.filter(i => i.status === 'pending');
  const mastered = items.filter(i => i.status === 'mastered');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-destructive-soft rounded-xl p-4 text-center border border-destructive/10">
          <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
          <p className="text-caption text-muted-foreground">Pendentes</p>
          <p className="text-h2 font-bold text-destructive">{pending.length}</p>
        </div>
        <div className="bg-success-soft rounded-xl p-4 text-center border border-success/10">
          <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-caption text-muted-foreground">Dominados</p>
          <p className="text-h2 font-bold text-success">{mastered.length}</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <BookOpen className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-caption text-muted-foreground">Total</p>
          <p className="text-h2 font-bold text-foreground">{notebookItems.length}</p>
        </div>
        <button
          onClick={() => setFilters(f => ({ ...f, reviewDue: !f.reviewDue }))}
          className={`rounded-xl p-4 text-center transition-all border-2 ${filters.reviewDue ? 'border-primary bg-primary-soft' : 'border-transparent bg-info-soft'}`}
        >
          <CalendarClock className="h-5 w-5 text-info mx-auto mb-1" />
          <p className="text-caption text-muted-foreground">Revisão hoje</p>
          <p className={`text-h2 font-bold ${dueCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{dueCount}</p>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3 border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, tema, texto da questão..."
            className="w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2.5 text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <h3 className="text-overline text-muted-foreground uppercase tracking-wider">Filtros</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filters.grade} onChange={e => setFilters(f => ({ ...f, grade: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-body">
            <option value="">Todas séries</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-body">
            <option value="">Todas disciplinas</option>
            {Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.difficulty} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-body">
            <option value="">Todas dificuldades</option>
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.topicId} onChange={e => setFilters(f => ({ ...f, topicId: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-body">
            <option value="">Todos tópicos</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-body">
            <option value="">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="mastered">Dominado</option>
          </select>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-body text-muted-foreground">Nenhum item com os filtros atuais.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
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
  item: NotebookItem; question: Question; userId: string; onRefazer: () => void; onSave: () => void;
}) {
  const [whatIErred, setWhatIErred] = useState(item.whatIErred);
  const [ruleInsight, setRuleInsight] = useState(item.ruleInsight);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const due = isReviewDue(item);

  const handleSave = async (mastered: boolean) => {
    if (saving) return;
    setSaving(true);
    const patch: Partial<NotebookItem> = { whatIErred, ruleInsight };
    if (mastered) {
      patch.status = 'mastered';
      patch.nextReviewAt = null;
    }
    await upsertNotebookItem(userId, q.id, patch);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave();
  };

  const scheduleReview = async () => {
    if (saving) return;
    setSaving(true);
    const nextReview = getNextReviewDate(item.reviewCount);
    await upsertNotebookItem(userId, q.id, {
      whatIErred,
      ruleInsight,
      nextReviewAt: nextReview,
      reviewCount: item.reviewCount + 1,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave();
  };

  const nextInterval = REVIEW_INTERVALS[Math.min(item.reviewCount, REVIEW_INTERVALS.length - 1)];

  return (
    <article className={`bg-card rounded-xl shadow-sm p-5 border transition-all ${due ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
      {due && (
        <div className="flex items-center gap-1.5 text-caption font-semibold text-primary mb-2">
          <CalendarClock className="h-3.5 w-3.5" />
          Revisão programada — hora de revisar!
        </div>
      )}
      <h4 className="text-body font-medium text-foreground">{q.statement}</h4>
      <p className="text-caption text-muted-foreground mt-1">
        {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · Status: {statusLabel(item.status)}
        {item.nextReviewAt && !due && (
          <span className="ml-2 text-primary/70">· Próxima revisão: {formatReviewDate(item.nextReviewAt)}</span>
        )}
        {item.reviewCount > 0 && (
          <span className="ml-2">· {item.reviewCount}x revisado</span>
        )}
      </p>

      <label className="text-caption text-muted-foreground block mt-3 mb-1">O que eu errei?</label>
      <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-body min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />

      <label className="text-caption text-muted-foreground block mt-2 mb-1">Regra / insight</label>
      <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-body min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="rounded-lg text-caption font-semibold text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50 active:scale-[0.98]">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onRefazer} className="rounded-lg text-caption font-semibold text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1 active:scale-[0.98]">
          <RotateCw className="h-3 w-3" /> Refazer
        </button>
        {item.status === 'pending' && (
          <>
            <button onClick={scheduleReview} disabled={saving}
              className="rounded-lg text-caption font-semibold text-foreground border border-border px-4 py-1.5 hover:bg-muted transition-all disabled:opacity-50 flex items-center gap-1 active:scale-[0.98]">
              <CalendarClock className="h-3 w-3" />
              Revisar em {nextInterval}d
            </button>
            <button onClick={() => handleSave(true)} disabled={saving}
              className="rounded-lg text-caption font-semibold bg-success text-success-foreground px-4 py-1.5 hover:bg-success-light transition-all disabled:opacity-50 flex items-center gap-1 active:scale-[0.98]">
              <CheckCircle2 className="h-3 w-3" /> Dominado
            </button>
          </>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-caption text-success font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo!
          </span>
        )}
      </div>
    </article>
  );
}
