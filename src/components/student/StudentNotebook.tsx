import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getNotebook, loadQuestionBank, getTopics, upsertNotebookItem, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { cachedFetch, CACHE_KEYS } from '../../lib/cache';
import { CheckCircle2, Search, CalendarClock } from 'lucide-react';
import type { Question, Topic, NotebookItem } from '../../lib/types';

const REVIEW_INTERVALS = [3, 7, 15]; // days

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
  const { loading, error: loadError, execute } = useLoadWithTimeout();

  const loadData = useCallback(async () => {
    await execute(async () => {
      const [questions, topics, allowedSlugs] = await Promise.all([
        cachedFetch(CACHE_KEYS.QUESTION_BANK, () => loadQuestionBank()),
        cachedFetch(CACHE_KEYS.TOPICS, () => getTopics({ activeOnly: true })),
        cachedFetch(CACHE_KEYS.ALLOWED_SLUGS(userId), () => getAllowedSubjectSlugs(userId)),
      ]);
      const notebook = await getNotebook(userId);
      setAllQuestions(questions.filter((q: any) => allowedSlugs.includes(q.subject)));
      setAllTopics(topics.filter((t: any) => allowedSlugs.includes(t.subject)));
      setNotebookItems(notebook);
    });
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);

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

  if (loadError) return <LoadingTimeout error={loadError} onRetry={loadData} />;
  if (loading) return <p className="text-muted-foreground">Carregando caderno de erros...</p>;

  const pending = items.filter(i => i.status === 'pending');
  const mastered = items.filter(i => i.status === 'mastered');

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <button
          onClick={() => setFilters(f => ({ ...f, reviewDue: !f.reviewDue }))}
          className={`bg-card rounded-xl shadow-sm p-4 text-center transition-all border-2 ${filters.reviewDue ? 'border-primary' : 'border-transparent'}`}
        >
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Revisão hoje
          </p>
          <p className={`text-2xl font-bold ${dueCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{dueCount}</p>
        </button>
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
    <article className={`bg-card rounded-xl shadow-sm p-5 ${due ? 'ring-2 ring-primary/40' : ''}`}>
      {due && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
          <CalendarClock className="h-3.5 w-3.5" />
          Revisão programada — hora de revisar!
        </div>
      )}
      <h4 className="text-sm font-medium text-foreground">{q.statement}</h4>
      <p className="text-xs text-muted-foreground mt-1">
        {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · Status: {statusLabel(item.status)}
        {item.nextReviewAt && !due && (
          <span className="ml-2 text-primary/70">· Próxima revisão: {formatReviewDate(item.nextReviewAt)}</span>
        )}
        {item.reviewCount > 0 && (
          <span className="ml-2">· {item.reviewCount}x revisado</span>
        )}
      </p>

      <label className="text-xs text-muted-foreground block mt-3 mb-1">O que eu errei?</label>
      <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" />

      <label className="text-xs text-muted-foreground block mt-2 mb-1">Regra / insight</label>
      <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" />

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="rounded-lg text-xs font-medium text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onRefazer} className="rounded-lg text-xs font-medium text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">
          Refazer
        </button>
        {item.status === 'pending' && (
          <>
            <button onClick={scheduleReview} disabled={saving}
              className="rounded-lg text-xs font-medium text-foreground border border-border px-4 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Revisar em {nextInterval}d
            </button>
            <button onClick={() => handleSave(true)} disabled={saving}
              className="rounded-lg text-xs font-medium bg-success text-success-foreground px-4 py-1.5 hover:brightness-110 transition-all disabled:opacity-50">
              ✓ Dominado
            </button>
          </>
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
