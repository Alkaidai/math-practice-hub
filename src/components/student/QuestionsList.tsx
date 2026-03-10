import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, getTopics, getNotebook, addAttempt, upsertNotebookItem, addComment, addReport, getAttempts, saveStudentDashboardMeta, getLessons, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, optionLetter, formatDate, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import type { Question, QuestionFilters, Comment as CommentType, Topic, NotebookItem, Lesson } from '../../lib/types';

interface AnswerState {
  selectedIndex: number;
  isCorrect: boolean;
}

export function QuestionsList({ initialQuestionId, initialTopicId }: { initialQuestionId?: string | null; initialTopicId?: string | null }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [filters, setFilters] = useState<QuestionFilters>({ grade: '', subject: '', difficulty: '', topicId: initialTopicId ?? '', search: '' });
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [, setRefresh] = useState(0);
  const forceRefresh = useCallback(() => setRefresh(n => n + 1), []);

  // Async loaded data
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [allowedSlugs, setAllowedSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [topics, questions, notebook, lessons, slugs] = await Promise.all([
        getTopics({ activeOnly: true }),
        loadQuestionBank(),
        userId ? getNotebook(userId) : Promise.resolve([]),
        getLessons(),
        userId ? getAllowedSubjectSlugs(userId) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      // Filter topics & questions by allowed subjects
      const filteredTopics = topics.filter(t => slugs.includes(t.subject));
      const filteredQuestions = questions.filter(q => slugs.includes(q.subject));
      setAllTopics(filteredTopics);
      setAllQuestions(filteredQuestions);
      setNotebookItems(notebook);
      setAllLessons(lessons);
      setAllowedSlugs(slugs);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const topicMap = useMemo(() => new Map(allTopics.map(t => [t.id, t.name])), [allTopics]);

  const questions = useMemo(() => {
    let qs = allQuestions.filter(q => q.status !== 'draft');
    if (filters.grade) qs = qs.filter(q => q.grade === filters.grade);
    if (filters.subject) qs = qs.filter(q => q.subject === subjectCode(filters.subject));
    if (filters.difficulty) qs = qs.filter(q => q.difficulty === difficultyCode(filters.difficulty));
    if (filters.topicId) qs = qs.filter(q => q.topicId === filters.topicId);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      qs = qs.filter(q => `${q.statement} ${q.options.join(' ')}`.toLowerCase().includes(needle));
    }
    return qs;
  }, [filters, allQuestions]);

  const notebookMap = useMemo(() => new Map(notebookItems.map(n => [n.questionId, n])), [notebookItems]);

  const handleFilter = (key: keyof QuestionFilters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (userId) saveStudentDashboardMeta(userId, { lastFilters: next });
  };

  const handleConfirm = async (q: Question, selectedIndex: number) => {
    if (!user) return;
    const isCorrect = selectedIndex === q.correctIndex;
    setAnswers(prev => ({ ...prev, [q.id]: { selectedIndex, isCorrect } }));
    setActiveTab(prev => ({ ...prev, [q.id]: 'gabarito' }));
    await addAttempt({ userId: user.username, questionId: q.id, selectedIndex, isCorrect, answeredAt: new Date().toISOString(), topicId: q.topicId });
    if (!isCorrect) {
      const item = await upsertNotebookItem(user.username, q.id, { status: 'pending' });
      setNotebookItems(prev => {
        const idx = prev.findIndex(n => n.questionId === q.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = item; return next; }
        return [...prev, item];
      });
    }

    if (!isCorrect) {
      document.body.classList.add('error-flash');
      setTimeout(() => document.body.classList.remove('error-flash'), 200);
    }
  };

  const handleComment = async (questionId: string, text: string) => {
    if (!user || !text.trim()) return;
    await addComment(questionId, { author: { username: user.username, role: user.role }, text: text.trim(), status: 'open', replies: [] });
    // Reload questions to get updated comments
    const updated = await loadQuestionBank();
    setAllQuestions(updated);
  };

  const handleReport = async (q: Question, type: string, message: string) => {
    if (!user || !message.trim()) return;
    await addReport({
      questionId: q.id,
      questionMeta: { grade: q.grade, subject: q.subject, topic: topicMap.get(q.topicId) ?? q.topicId, difficulty: q.difficulty, preview: q.statement.slice(0, 120) },
      type, message: message.trim(),
      createdBy: { username: user.username, role: user.role },
      status: 'open',
    });
  };

  const lessonsForQuestion = (q: Question) => {
    const byTopic = allLessons.filter(l => l.topic === q.topicId);
    if (byTopic.length) return byTopic;
    const bySubject = allLessons.filter(l => l.subject === q.subject);
    if (bySubject.length) return bySubject;
    return allLessons.filter(l => l.grade === q.grade);
  };

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(5);

  // Update topic filter when navigating from study plan
  useEffect(() => {
    if (initialTopicId) setFilters(f => ({ ...f, topicId: initialTopicId }));
  }, [initialTopicId]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filters]);

  const totalPages = Math.max(1, Math.ceil(questions.length / perPage));
  const pagedQuestions = questions.slice(page * perPage, (page + 1) * perPage);

  if (loading) return <p className="font-body text-muted-foreground">Carregando questões...</p>;

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card p-3">
        <h3 className="font-heading text-xs font-bold text-foreground uppercase tracking-wide mb-2">FILTROS</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filters.grade} onChange={e => handleFilter('grade', e.target.value)} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas as séries</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.subject} onChange={e => handleFilter('subject', e.target.value)} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas as disciplinas</option>
            {Object.entries(SUBJECTS_MAP).filter(([code]) => allowedSlugs.includes(code)).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.difficulty} onChange={e => handleFilter('difficulty', e.target.value)} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas as dificuldades</option>
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.topicId} onChange={e => handleFilter('topicId', e.target.value)} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todos os tópicos</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={filters.search} onChange={e => handleFilter('search', e.target.value)} placeholder="Buscar" className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="font-body text-muted-foreground">Nenhuma questão encontrada com os filtros atuais.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="font-heading text-xs text-muted-foreground">
              {questions.length} questão(ões) · Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <span className="font-heading text-xs text-muted-foreground">Por página:</span>
              {[5, 10].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setPage(0); }} className={`font-heading text-xs px-2 py-0.5 border ${perPage === n ? 'border-primary text-primary font-bold' : 'border-border text-muted-foreground'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {pagedQuestions.map((q, idx) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={page * perPage + idx}
                answer={answers[q.id]}
                activeTab={activeTab[q.id] ?? 'gabarito'}
                notebookItem={notebookMap.get(q.id)}
                topicLabel={topicMap.get(q.topicId) ?? '—'}
                user={user}
                lessons={lessonsForQuestion(q)}
                onConfirm={(selectedIndex) => handleConfirm(q, selectedIndex)}
                onTabChange={(tab) => setActiveTab(prev => ({ ...prev, [q.id]: tab }))}
                onComment={(text) => handleComment(q.id, text)}
                onReport={(type, message) => handleReport(q, type, message)}
                onAddNotebook={async () => {
                  if (user) {
                    const item = await upsertNotebookItem(user.username, q.id, { status: 'pending' });
                    setNotebookItems(prev => [...prev.filter(n => n.questionId !== q.id), item]);
                    setActiveTab(prev => ({ ...prev, [q.id]: 'caderno' }));
                  }
                }}
                onSaveNotebook={async (whatIErred, ruleInsight, mastered) => {
                  if (user) {
                    const item = await upsertNotebookItem(user.username, q.id, { whatIErred, ruleInsight, ...(mastered ? { status: 'mastered' } : {}) });
                    setNotebookItems(prev => [...prev.filter(n => n.questionId !== q.id), item]);
                  }
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="font-heading text-xs border border-border px-3 py-1 disabled:opacity-40">
              ← Anterior
            </button>
            <span className="font-heading text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button disabled={page >= totalPages - 1} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="font-heading text-xs border border-border px-3 py-1 disabled:opacity-40">
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function QuestionCard({
  question: q, index, answer, activeTab, notebookItem, topicLabel, user, lessons,
  onConfirm, onTabChange, onComment, onReport, onAddNotebook, onSaveNotebook
}: {
  question: Question;
  index: number;
  answer?: AnswerState;
  activeTab: string;
  notebookItem?: any;
  topicLabel: string;
  user: any;
  lessons: any[];
  onConfirm: (selectedIndex: number) => void;
  onTabChange: (tab: string) => void;
  onComment: (text: string) => void;
  onReport: (type: string, message: string) => void;
  onAddNotebook: () => void;
  onSaveNotebook: (whatIErred: string, ruleInsight: string, mastered: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const locked = !!answer;

  const tabs = [
    { key: 'gabarito', label: 'Gabarito comentado', blocked: !answer },
    { key: 'aulas', label: 'Aulas' },
    { key: 'comentarios', label: 'Comentários' },
    { key: 'caderno', label: 'Caderno' },
    { key: 'erro', label: 'Notificar erro' },
  ];

  return (
    <article id={`question-${q.id}`} className="border border-border bg-card p-4">
      <header className="mb-3">
        <h3 className="font-body text-base font-semibold text-foreground">{index + 1}. {q.statement}</h3>
        <p className="font-heading text-xs text-muted-foreground mt-1">
          {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · {topicLabel}
        </p>
      </header>

      <div className="space-y-2 mb-3">
        {q.options.map((opt, i) => {
          let cls = 'border border-border p-2 flex items-center gap-2 cursor-pointer';
          if (locked && i === q.correctIndex) cls += ' border-success bg-success/5';
          if (locked && answer?.selectedIndex === i && !answer.isCorrect) cls += ' border-destructive bg-destructive/5';
          if (!locked && (answer?.selectedIndex === i || selected === i)) cls += ' border-primary bg-primary/5';

          return (
            <label key={i} className={cls}>
              <input type="radio" name={`opt_${q.id}`} value={i} checked={locked ? answer?.selectedIndex === i : selected === i} disabled={locked} onChange={() => setSelected(i)} className="accent-primary" />
              <span className="font-heading text-xs font-bold text-primary min-w-[24px]">({optionLetter(i)})</span>
              <span className="font-body text-sm">{opt}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button disabled={locked || selected === null} onClick={() => selected !== null && onConfirm(selected)} className="font-heading text-sm font-semibold bg-primary text-primary-foreground px-4 py-1.5 border border-primary disabled:opacity-40">Confirmar</button>
        {answer && (
          <span className={`font-heading text-sm font-bold ${answer.isCorrect ? 'text-success' : 'text-destructive'}`}>
            {answer.isCorrect ? '✅ Acertou' : '❌ Errou'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-1 mb-3">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { if (!tab.blocked) onTabChange(tab.key); }} className={`font-heading text-xs px-2 py-1 border-b-2 ${activeTab === tab.key ? 'border-primary text-foreground font-bold' : 'border-transparent text-muted-foreground'} ${tab.blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {tab.label}{tab.blocked ? ' 🔒' : ''}
          </button>
        ))}
      </div>

      <div className="border border-border p-3 bg-background">
        <TabPanel tab={activeTab} question={q} answer={answer} user={user} notebookItem={notebookItem} lessons={lessons} onComment={onComment} onReport={onReport} onAddNotebook={onAddNotebook} onSaveNotebook={onSaveNotebook} />
      </div>
    </article>
  );
}

function TabPanel({ tab, question: q, answer, user, notebookItem, lessons, onComment, onReport, onAddNotebook, onSaveNotebook }: {
  tab: string; question: Question; answer?: AnswerState; user: any; notebookItem?: any; lessons: any[];
  onComment: (text: string) => void; onReport: (type: string, message: string) => void;
  onAddNotebook: () => void; onSaveNotebook: (w: string, r: string, m: boolean) => void;
}) {
  const [commentText, setCommentText] = useState('');
  const [reportType, setReportType] = useState('enunciado');
  const [reportDesc, setReportDesc] = useState('');
  const [whatIErred, setWhatIErred] = useState(notebookItem?.whatIErred ?? '');
  const [ruleInsight, setRuleInsight] = useState(notebookItem?.ruleInsight ?? '');

  if (tab === 'gabarito') {
    if (!answer) return <p className="font-body text-sm text-muted-foreground">Responda a questão para liberar o gabarito comentado.</p>;
    return (
      <div className="space-y-2">
        <p className="font-body text-sm"><strong>Resposta correta:</strong> ({optionLetter(q.correctIndex)}) {q.options[q.correctIndex]}</p>
        <p className="font-body text-sm">{q.explanation}</p>
      </div>
    );
  }

  if (tab === 'aulas') {
    if (!lessons.length) return <p className="font-body text-sm text-muted-foreground">Ainda não há aulas cadastradas para este tópico.</p>;
    return (
      <div className="space-y-2">
        {lessons.map(l => (
          <div key={l.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <span className="font-body text-sm font-semibold">{l.title}</span>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-heading text-xs text-primary border border-primary px-2 py-0.5 hover:bg-primary hover:text-primary-foreground">Assistir</a>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'comentarios') {
    if (!user) return <p className="font-body text-sm text-muted-foreground">Faça login para visualizar e enviar comentários.</p>;
    const visibleComments = (q.comments ?? []).filter(c => c.status !== 'hidden');
    return (
      <div className="space-y-3">
        {visibleComments.length > 0 ? visibleComments.map(c => (
          <div key={c.id} className="border-b border-border pb-2 last:border-0">
            <p className="font-heading text-xs text-muted-foreground"><strong>{c.author.username}</strong> · {formatDate(c.createdAt)} · {statusLabel(c.status)}</p>
            <p className="font-body text-sm">{c.text}</p>
            {c.replies.map(r => (
              <div key={r.id} className="ml-4 mt-1 p-2 bg-muted">
                <p className="font-heading text-xs"><strong>{r.author.username}:</strong> {r.text} <span className="text-muted-foreground">{formatDate(r.createdAt)}</span></p>
              </div>
            ))}
          </div>
        )) : <p className="font-body text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
        <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Escreva seu comentário" className="w-full border border-border bg-card p-2 font-body text-sm min-h-[60px]" />
        <button onClick={() => { onComment(commentText); setCommentText(''); }} className="font-heading text-xs text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">Enviar comentário</button>
      </div>
    );
  }

  if (tab === 'caderno') {
    if (!user) return <p className="font-body text-sm text-muted-foreground">Faça login para usar o caderno.</p>;
    if (!notebookItem) {
      return (
        <div>
          <p className="font-body text-sm text-muted-foreground mb-2">Essa questão ainda não está no seu caderno.</p>
          <button onClick={onAddNotebook} className="font-heading text-xs text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">Adicionar ao caderno</button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <label className="font-heading text-xs text-muted-foreground block">O que eu errei?</label>
        <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full border border-border bg-card p-2 font-body text-sm min-h-[50px]" />
        <label className="font-heading text-xs text-muted-foreground block">Regra / insight</label>
        <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full border border-border bg-card p-2 font-body text-sm min-h-[50px]" />
        <div className="flex gap-2">
          <button onClick={() => onSaveNotebook(whatIErred, ruleInsight, false)} className="font-heading text-xs text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">Salvar</button>
          <button onClick={() => onSaveNotebook(whatIErred, ruleInsight, true)} className="font-heading text-xs bg-primary text-primary-foreground px-3 py-1 border border-primary">Marcar como dominado</button>
        </div>
      </div>
    );
  }

  if (tab === 'erro') {
    if (!user) return <p className="font-body text-sm text-muted-foreground">Faça login para notificar erro.</p>;
    return (
      <div className="space-y-2">
        <label className="font-heading text-xs text-muted-foreground block">Tipo do problema</label>
        <select value={reportType} onChange={e => setReportType(e.target.value)} className="border border-border bg-card px-2 py-1.5 font-heading text-xs">
          {['enunciado', 'gabarito', 'alternativas', 'explicacao', 'outro'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <label className="font-heading text-xs text-muted-foreground block">Descreva o problema</label>
        <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} placeholder="Descreva o problema" className="w-full border border-border bg-card p-2 font-body text-sm min-h-[50px]" />
        <button onClick={() => { onReport(reportType, reportDesc); setReportDesc(''); }} className="font-heading text-xs bg-destructive text-destructive-foreground px-3 py-1 border border-destructive">Enviar</button>
      </div>
    );
  }

  return null;
}
