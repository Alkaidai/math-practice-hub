import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loadQuestionBank, getTopics, getNotebook, addAttempt, upsertNotebookItem, addComment, addReport, getAttempts, saveStudentDashboardMeta, getLessons, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, optionLetter, formatDate, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { useQuestionTimer } from '../../hooks/useQuestionTimer';
import type { Question, QuestionFilters, Comment as CommentType, Topic, NotebookItem, Lesson } from '../../lib/types';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnswerState {
  selectedIndex: number;
  isCorrect: boolean;
}

// Shuffle options and return new options array + mapping
function shuffleOptions(options: string[], correctIndex: number): { shuffled: string[]; newCorrectIndex: number; indexMap: number[] } {
  const indices = options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffled = indices.map(i => options[i]);
  const newCorrectIndex = indices.indexOf(correctIndex);
  return { shuffled, newCorrectIndex, indexMap: indices };
}

export function QuestionsList({ initialQuestionId, initialTopicId, initialDifficulty, onQuestionAnswered }: {
  initialQuestionId?: string | null;
  initialTopicId?: string | null;
  initialDifficulty?: string | null;
  onQuestionAnswered?: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const { startQuestion, stopQuestion, getAbandonedQuestions, clearAll } = useQuestionTimer();

  const [filters, setFilters] = useState<QuestionFilters>({ grade: '', subject: '', difficulty: initialDifficulty ?? '', topicId: initialTopicId ?? '', search: '' });
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [, setRefresh] = useState(0);
  const forceRefresh = useCallback(() => setRefresh(n => n + 1), []);

  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [allowedSlugs, setAllowedSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { error: loadError, execute } = useLoadWithTimeout();

  // Store shuffled options per question
  const [shuffledMap, setShuffledMap] = useState<Record<string, { options: string[]; correctIndex: number }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    await execute(async () => {
      const [topics, questions, notebook, lessons, slugs] = await Promise.all([
        getTopics({ activeOnly: true }),
        loadQuestionBank(),
        userId ? getNotebook(userId) : Promise.resolve([]),
        getLessons(),
        userId ? getAllowedSubjectSlugs(userId) : Promise.resolve([]),
      ]);
      const filteredTopics = topics.filter(t => slugs.includes(t.subject));
      const filteredQuestions = questions.filter(q => slugs.includes(q.subject));
      setAllTopics(filteredTopics);
      setAllQuestions(filteredQuestions);
      setNotebookItems(notebook);
      setAllLessons(lessons);
      setAllowedSlugs(slugs);

      const newShuffled: Record<string, { options: string[]; correctIndex: number }> = {};
      filteredQuestions.forEach(q => {
        const { shuffled, newCorrectIndex } = shuffleOptions(q.options, q.correctIndex);
        newShuffled[q.id] = { options: shuffled, correctIndex: newCorrectIndex };
      });
      setShuffledMap(newShuffled);
      setLoading(false);
    });
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);
  useVisibilityRefresh(loadData);

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
    const shuffled = shuffledMap[q.id];
    const isCorrect = shuffled ? selectedIndex === shuffled.correctIndex : selectedIndex === q.correctIndex;

    // Get timing data from question timer
    const timing = stopQuestion(q.id);

    // Calculate attempt number
    const { data: prevAttempts } = await supabase
      .from('attempts')
      .select('id')
      .eq('user_id', user.username)
      .eq('question_id', q.id);
    const attemptNumber = (prevAttempts?.length ?? 0) + 1;

    setAnswers(prev => ({ ...prev, [q.id]: { selectedIndex, isCorrect } }));
    setActiveTab(prev => ({ ...prev, [q.id]: 'gabarito' }));

    await addAttempt({
      userId: user.username,
      questionId: q.id,
      selectedIndex,
      isCorrect,
      answeredAt: new Date().toISOString(),
      topicId: q.topicId,
      timeSpentSeconds: timing.timeSpentSeconds,
      possibleGuess: timing.possibleGuess,
      difficultyDetected: timing.difficultyDetected,
      attemptNumber,
    });

    // Notify session tracker
    onQuestionAnswered?.();

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
      setTimeout(() => document.body.classList.remove('error-flash'), 300);
    }
  };

  const handleComment = async (questionId: string, text: string) => {
    if (!user || !text.trim()) return;
    await addComment(questionId, { author: { username: user.username, role: user.role }, text: text.trim(), status: 'open', replies: [] });
    const updated = await loadQuestionBank({ forceRefresh: true });
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

  useEffect(() => {
    if (initialTopicId) setFilters(f => ({ ...f, topicId: initialTopicId }));
  }, [initialTopicId]);

  useEffect(() => { setPage(0); }, [filters]);

  const totalPages = Math.max(1, Math.ceil(questions.length / perPage));
  const pagedQuestions = questions.slice(page * perPage, (page + 1) * perPage);

  if (loading) return <p className="text-muted-foreground">Carregando questões...</p>;
  if (loadError) return <LoadingTimeout error={loadError} onRetry={loadData} />;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Filtros</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filters.grade} onChange={e => handleFilter('grade', e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas séries</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.subject} onChange={e => handleFilter('subject', e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas disciplinas</option>
            {Object.entries(SUBJECTS_MAP).filter(([code]) => allowedSlugs.includes(code)).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.difficulty} onChange={e => handleFilter('difficulty', e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas dificuldades</option>
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.topicId} onChange={e => handleFilter('topicId', e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todos tópicos</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={filters.search} onChange={e => handleFilter('search', e.target.value)} placeholder="Buscar..." className="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center">
          <p className="text-muted-foreground">Nenhuma questão encontrada com os filtros atuais.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {questions.length} questão(ões) · Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Por página:</span>
              {[5, 10].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setPage(0); }} className={`text-xs px-3 py-1 rounded-lg transition-colors ${perPage === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Start timers for visible questions */}
          <QuestionsWithTimer
            questions={pagedQuestions}
            shuffledMap={shuffledMap}
            page={page}
            perPage={perPage}
            answers={answers}
            activeTab={activeTab}
            notebookMap={notebookMap}
            topicMap={topicMap}
            user={user}
            allLessons={allLessons}
            lessonsForQuestion={lessonsForQuestion}
            startQuestion={startQuestion}
            onConfirm={handleConfirm}
            onTabChange={(qId, tab) => setActiveTab(prev => ({ ...prev, [qId]: tab }))}
            onComment={handleComment}
            onReport={handleReport}
            onAddNotebook={async (qId) => {
              if (user) {
                const item = await upsertNotebookItem(user.username, qId, { status: 'pending' });
                setNotebookItems(prev => [...prev.filter(n => n.questionId !== qId), item]);
                setActiveTab(prev => ({ ...prev, [qId]: 'caderno' }));
              }
            }}
            onSaveNotebook={async (qId, whatIErred, ruleInsight) => {
              if (user) {
                const item = await upsertNotebookItem(user.username, qId, { whatIErred, ruleInsight });
                setNotebookItems(prev => [...prev.filter(n => n.questionId !== qId), item]);
              }
            }}
          />

          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 0} onClick={() => { setPage(page - 1); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg text-sm border border-border px-4 py-2 disabled:opacity-40 hover:bg-muted transition-colors">
              ← Anterior
            </button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button disabled={page >= totalPages - 1} onClick={() => { setPage(page + 1); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg text-sm border border-border px-4 py-2 disabled:opacity-40 hover:bg-muted transition-colors">
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function QuestionCard({
  question: q, shuffledOptions, shuffledCorrectIndex, index, answer, activeTab, notebookItem, topicLabel, user, lessons,
  onConfirm, onTabChange, onComment, onReport, onAddNotebook, onSaveNotebook
}: {
  question: Question;
  shuffledOptions: string[];
  shuffledCorrectIndex: number;
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
  onSaveNotebook: (whatIErred: string, ruleInsight: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const locked = !!answer;

  const tabs = [
    { key: 'gabarito', label: 'Gabarito', blocked: !answer },
    { key: 'aulas', label: 'Aulas' },
    { key: 'comentarios', label: 'Comentários' },
    { key: 'caderno', label: 'Caderno' },
    { key: 'erro', label: 'Reportar' },
  ];

  return (
    <article id={`question-${q.id}`} className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <header className="mb-4">
          <h3 className="text-base font-medium text-foreground leading-relaxed">{index + 1}. {q.statement}</h3>
          {q.imageUrl && (
            <div className="mt-3 mb-2">
              <img src={q.imageUrl} alt={q.imageAlt || 'Imagem da questão'} className="max-w-full max-h-80 rounded-xl border border-border object-contain mx-auto" loading="lazy" />
              {q.imageAlt && <p className="text-xs text-muted-foreground text-center mt-1">{q.imageAlt}</p>}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {[q.grade, subjectLabel(q.subject), difficultyLabel(q.difficulty), topicLabel].map((tag, i) => (
              <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">{tag}</span>
            ))}
          </div>
        </header>

        <div className="space-y-2 mb-4">
          {shuffledOptions.map((opt, i) => {
            let cls = 'rounded-lg border-2 p-3 flex items-center gap-3 cursor-pointer transition-all text-sm';
            if (locked && i === shuffledCorrectIndex) cls += ' border-success bg-success/5';
            else if (locked && answer?.selectedIndex === i && !answer.isCorrect) cls += ' border-destructive bg-destructive/5';
            else if (!locked && selected === i) cls += ' border-primary bg-primary/5';
            else cls += ' border-border hover:border-primary/40';

            return (
              <label key={i} className={cls}>
                <input type="radio" name={`opt_${q.id}`} value={i} checked={locked ? answer?.selectedIndex === i : selected === i} disabled={locked} onChange={() => setSelected(i)} className="sr-only" />
                <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                  {optionLetter(i)}
                </span>
                <span className="flex-1">{opt}</span>
                {locked && i === shuffledCorrectIndex && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                {locked && answer?.selectedIndex === i && !answer.isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button disabled={locked || selected === null} onClick={() => selected !== null && onConfirm(selected)} className="rounded-lg text-sm font-semibold bg-gold text-gold-foreground px-6 py-2 hover:brightness-110 transition-all disabled:opacity-40">
            Confirmar
          </button>
          {answer && (
            <span className={`text-sm font-bold flex items-center gap-1.5 ${answer.isCorrect ? 'text-success' : 'text-destructive'}`}>
              {answer.isCorrect ? <><CheckCircle2 className="h-4 w-4" /> Correto!</> : <><XCircle className="h-4 w-4" /> Incorreto</>}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-border">
        <div className="flex gap-0 px-5 bg-muted/30">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => { if (!tab.blocked) onTabChange(tab.key); }} className={`text-xs px-4 py-2.5 border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'} ${tab.blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
              {tab.label}{tab.blocked ? ' 🔒' : ''}
            </button>
          ))}
        </div>
        <div className="p-5 bg-muted/10">
          <TabPanel tab={activeTab} question={q} answer={answer} user={user} notebookItem={notebookItem} lessons={lessons}
            shuffledCorrectIndex={shuffledCorrectIndex} shuffledOptions={shuffledOptions}
            onComment={onComment} onReport={onReport} onAddNotebook={onAddNotebook} onSaveNotebook={onSaveNotebook} />
        </div>
      </div>
    </article>
  );
}

function TabPanel({ tab, question: q, answer, user, notebookItem, lessons, shuffledCorrectIndex, shuffledOptions, onComment, onReport, onAddNotebook, onSaveNotebook }: {
  tab: string; question: Question; answer?: AnswerState; user: any; notebookItem?: any; lessons: any[];
  shuffledCorrectIndex: number; shuffledOptions: string[];
  onComment: (text: string) => void; onReport: (type: string, message: string) => void;
  onAddNotebook: () => void; onSaveNotebook: (w: string, r: string) => void;
}) {
  const [commentText, setCommentText] = useState('');
  const [reportType, setReportType] = useState('enunciado');
  const [reportDesc, setReportDesc] = useState('');
  const [whatIErred, setWhatIErred] = useState(notebookItem?.whatIErred ?? '');
  const [ruleInsight, setRuleInsight] = useState(notebookItem?.ruleInsight ?? '');
  const [notebookSaving, setNotebookSaving] = useState(false);
  const [notebookSaved, setNotebookSaved] = useState(false);

  if (tab === 'gabarito') {
    if (!answer) return <p className="text-sm text-muted-foreground">Responda a questão para liberar o gabarito comentado.</p>;
    return (
      <div className="space-y-2">
        <p className="text-sm"><strong>Resposta correta:</strong> ({optionLetter(shuffledCorrectIndex)}) {shuffledOptions[shuffledCorrectIndex]}</p>
        <p className="text-sm text-muted-foreground">{q.explanation}</p>
      </div>
    );
  }

  if (tab === 'aulas') {
    if (!lessons.length) return <p className="text-sm text-muted-foreground">Ainda não há aulas cadastradas para este tópico.</p>;
    return (
      <div className="space-y-2">
        {lessons.map(l => (
          <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm font-medium">{l.title}</span>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg text-xs text-primary border border-primary/30 px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-colors">Assistir</a>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'comentarios') {
    if (!user) return <p className="text-sm text-muted-foreground">Faça login para comentar.</p>;
    const visibleComments = (q.comments ?? []).filter(c => c.status !== 'hidden');
    return (
      <div className="space-y-3">
        {visibleComments.length > 0 ? visibleComments.map(c => (
          <div key={c.id} className="pb-2 border-b border-border last:border-0">
            <p className="text-xs text-muted-foreground">{c.author.username} · {formatDate(c.createdAt)}</p>
            <p className="text-sm">{c.text}</p>
            {c.replies?.map(r => (
              <div key={r.id} className="ml-4 mt-1 pl-3 border-l-2 border-primary/20">
                <p className="text-xs text-muted-foreground">{r.author.username} · {formatDate(r.createdAt)}</p>
                <p className="text-sm">{r.text}</p>
              </div>
            ))}
          </div>
        )) : <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
        <div className="flex gap-2">
          <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Escreva um comentário..." className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={() => { onComment(commentText); setCommentText(''); }} className="rounded-lg text-xs bg-primary text-primary-foreground px-4 py-2 hover:brightness-110 transition-all">Enviar</button>
        </div>
      </div>
    );
  }

  if (tab === 'caderno') {
    const handleSaveNotebook = async () => {
      if (notebookSaving) return;
      setNotebookSaving(true);
      onSaveNotebook(whatIErred, ruleInsight);
      setNotebookSaving(false);
      setNotebookSaved(true);
      setTimeout(() => setNotebookSaved(false), 2000);
    };

    return (
      <div className="space-y-2">
        {notebookItem ? (
          <>
            <p className="text-xs text-muted-foreground">Status: {statusLabel(notebookItem.status)}</p>
            <label className="text-xs text-muted-foreground block">O que eu errei?</label>
            <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px]" />
            <label className="text-xs text-muted-foreground block">Regra / insight</label>
            <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[40px]" />
            {!notebookSaved ? (
              <div className="flex gap-2 mt-1">
                <button onClick={handleSaveNotebook} disabled={notebookSaving}
                  className="rounded-lg text-xs text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">
                  {notebookSaving ? 'Salvando...' : 'Salvar anotação'}
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-1 text-xs text-success font-medium mt-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Anotação salva!
              </p>
            )}
          </>
        ) : (
          <button onClick={onAddNotebook} className="rounded-lg text-xs text-primary border border-primary/30 px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">+ Adicionar ao caderno</button>
        )}
      </div>
    );
  }

  if (tab === 'erro') {
    return (
      <div className="space-y-2">
        <select value={reportType} onChange={e => setReportType(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="enunciado">Erro no enunciado</option>
          <option value="gabarito">Gabarito incorreto</option>
          <option value="formatacao">Problema de formatação</option>
          <option value="outro">Outro</option>
        </select>
        <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} placeholder="Descreva o problema..." className="w-full rounded-lg border border-input bg-background p-3 text-sm min-h-[60px]" />
        <button onClick={() => { onReport(reportType, reportDesc); setReportDesc(''); }} className="rounded-lg text-xs bg-destructive text-destructive-foreground px-4 py-1.5 hover:brightness-110 transition-all">Enviar relatório</button>
      </div>
    );
  }

  return null;
}

/** Wrapper that starts question timers when questions become visible */
function QuestionsWithTimer({
  questions, shuffledMap, page, perPage, answers, activeTab, notebookMap, topicMap, user, allLessons, lessonsForQuestion,
  startQuestion, onConfirm, onTabChange, onComment, onReport, onAddNotebook, onSaveNotebook,
}: {
  questions: Question[];
  shuffledMap: Record<string, { options: string[]; correctIndex: number }>;
  page: number;
  perPage: number;
  answers: Record<string, AnswerState>;
  activeTab: Record<string, string>;
  notebookMap: Map<string, NotebookItem>;
  topicMap: Map<string, string>;
  user: any;
  allLessons: Lesson[];
  lessonsForQuestion: (q: Question) => Lesson[];
  startQuestion: (id: string) => void;
  onConfirm: (q: Question, selectedIndex: number) => void;
  onTabChange: (qId: string, tab: string) => void;
  onComment: (qId: string, text: string) => void;
  onReport: (q: Question, type: string, message: string) => void;
  onAddNotebook: (qId: string) => void;
  onSaveNotebook: (qId: string, whatIErred: string, ruleInsight: string) => void;
}) {
  // Start timers for unanswered questions when they appear
  useEffect(() => {
    questions.forEach(q => {
      if (!answers[q.id]) {
        startQuestion(q.id);
      }
    });
  }, [questions.map(q => q.id).join(',')]);

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const sq = shuffledMap[q.id];
        return (
          <QuestionCard
            key={q.id}
            question={q}
            shuffledOptions={sq?.options ?? q.options}
            shuffledCorrectIndex={sq?.correctIndex ?? q.correctIndex}
            index={page * perPage + idx}
            answer={answers[q.id]}
            activeTab={activeTab[q.id] ?? 'gabarito'}
            notebookItem={notebookMap.get(q.id)}
            topicLabel={topicMap.get(q.topicId) ?? '—'}
            user={user}
            lessons={lessonsForQuestion(q)}
            onConfirm={(selectedIndex) => onConfirm(q, selectedIndex)}
            onTabChange={(tab) => onTabChange(q.id, tab)}
            onComment={(text) => onComment(q.id, text)}
            onReport={(type, message) => onReport(q, type, message)}
            onAddNotebook={() => onAddNotebook(q.id)}
            onSaveNotebook={(w, r) => onSaveNotebook(q.id, w, r)}
          />
        );
      })}
    </div>
  );
}
