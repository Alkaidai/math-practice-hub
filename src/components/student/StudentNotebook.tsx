import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getNotebook, loadQuestionBank, getTopics, upsertNotebookItem } from '../../lib/storage';
import { subjectLabel, difficultyLabel, subjectCode, difficultyCode, statusLabel } from '../../lib/ui-utils';
import { GRADES, SUBJECTS_MAP, DIFFICULTIES_MAP } from '../../lib/constants';
import type { Question, Topic, NotebookItem } from '../../lib/types';

export function StudentNotebook({ onRefazer }: { onRefazer: (questionId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [filters, setFilters] = useState({ grade: '', subject: '', difficulty: '', topicId: '', status: '' });
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [notebookItems, setNotebookItems] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [questions, topics, notebook] = await Promise.all([
      loadQuestionBank(),
      getTopics({ activeOnly: true }),
      getNotebook(userId),
    ]);
    setAllQuestions(questions);
    setAllTopics(topics);
    setNotebookItems(notebook);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

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
      return true;
    });
  }, [notebookItems, filters, questionsMap]);

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card p-3">
        <h3 className="font-heading text-xs font-bold text-foreground uppercase tracking-wide mb-2">CADERNO DE ERROS</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filters.grade} onChange={e => setFilters(f => ({ ...f, grade: e.target.value }))} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas as séries</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas disciplinas</option>
            {Object.entries(SUBJECTS_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.difficulty} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value }))} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todas dificuldades</option>
            {Object.entries(DIFFICULTIES_MAP).map(([code, label]) => <option key={code} value={label}>{label}</option>)}
          </select>
          <select value={filters.topicId} onChange={e => setFilters(f => ({ ...f, topicId: e.target.value }))} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todos os tópicos</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border border-border bg-card px-2 py-1.5 font-heading text-xs text-foreground">
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="mastered">Dominado</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="font-body text-muted-foreground">Nenhum item com os filtros atuais.</p>
      ) : (
        <div className="space-y-3">
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

  const handleSave = async (mastered: boolean) => {
    await upsertNotebookItem(userId, q.id, { whatIErred, ruleInsight, ...(mastered ? { status: 'mastered' } : {}) });
    onSave();
  };

  return (
    <article className="border border-border bg-card p-4">
      <h4 className="font-body text-sm font-semibold text-foreground">{q.statement}</h4>
      <p className="font-heading text-xs text-muted-foreground mt-1">
        {q.grade} · {subjectLabel(q.subject)} · {difficultyLabel(q.difficulty)} · Status: {statusLabel(item.status)}
      </p>
      <label className="font-heading text-xs text-muted-foreground block mt-2">O que eu errei?</label>
      <textarea value={whatIErred} onChange={e => setWhatIErred(e.target.value)} className="w-full border border-border bg-background p-2 font-body text-sm min-h-[40px]" />
      <label className="font-heading text-xs text-muted-foreground block mt-1">Regra / insight</label>
      <textarea value={ruleInsight} onChange={e => setRuleInsight(e.target.value)} className="w-full border border-border bg-background p-2 font-body text-sm min-h-[40px]" />
      <div className="flex gap-2 mt-2">
        <button onClick={() => handleSave(false)} className="font-heading text-xs text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">Salvar</button>
        <button onClick={onRefazer} className="font-heading text-xs text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-primary-foreground">Refazer</button>
        <button onClick={() => handleSave(true)} className="font-heading text-xs bg-primary text-primary-foreground px-3 py-1 border border-primary">Dominado</button>
      </div>
    </article>
  );
}
