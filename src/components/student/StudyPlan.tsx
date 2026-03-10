import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDiagnosticResult, getAttempts, getTopics, loadQuestionBank, getAllowedSubjectSlugs } from '../../lib/storage';
import { Progress } from '../ui/progress';
import type { Topic, Question, Attempt } from '../../lib/types';

interface TopicProgress {
  topicId: string;
  topicName: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  progress: number;
  recommended: number;
}

export function StudyPlan({ onStartTopic }: { onStartTopic: (topicId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [diag, attempts, topics, questions, allowedSlugs] = await Promise.all([
        getDiagnosticResult(userId),
        getAttempts(userId),
        getTopics({ activeOnly: true }),
        loadQuestionBank(),
        getAllowedSubjectSlugs(userId),
      ]);

      const filteredTopics = topics.filter(t => allowedSlugs.includes(t.subject));
      const filteredQuestions = questions.filter(q => allowedSlugs.includes(q.subject));

      const topicMap = new Map(filteredTopics.map(t => [t.id, t.name]));
      const publishedByTopic = new Map<string, number>();
      filteredQuestions.filter(q => q.status !== 'draft').forEach(q => {
        if (q.topicId) publishedByTopic.set(q.topicId, (publishedByTopic.get(q.topicId) ?? 0) + 1);
      });

      const attemptsByTopic = new Map<string, { answered: number; correct: number }>();
      attempts.forEach(a => {
        const q = filteredQuestions.find(qq => qq.id === a.questionId);
        if (!q?.topicId) return;
        const prev = attemptsByTopic.get(q.topicId) ?? { answered: 0, correct: 0 };
        prev.answered += 1;
        if (a.isCorrect) prev.correct += 1;
        attemptsByTopic.set(q.topicId, prev);
      });

      let weakTopicIds: string[] = [];
      if (diag) {
        const d = diag as any;
        const breakdown = (d.topic_breakdown ?? d.topicBreakdown ?? []) as any[];
        weakTopicIds = breakdown
          .filter((b: any) => b.rate < 70)
          .sort((a: any, b: any) => a.rate - b.rate)
          .map((b: any) => b.topicId)
          .filter(Boolean);
      }

      if (weakTopicIds.length === 0) {
        weakTopicIds = [...attemptsByTopic.entries()]
          .filter(([, s]) => s.answered > 0)
          .map(([tid, s]) => ({ tid, rate: Math.round((s.correct / s.answered) * 100) }))
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 5)
          .map(x => x.tid);
      }

      if (weakTopicIds.length === 0) {
        weakTopicIds = filteredTopics.filter(t => (publishedByTopic.get(t.id) ?? 0) > 0).map(t => t.id).slice(0, 5);
      }

      const progress: TopicProgress[] = weakTopicIds.map(tid => {
        const stats = attemptsByTopic.get(tid) ?? { answered: 0, correct: 0 };
        const totalQ = publishedByTopic.get(tid) ?? 0;
        const recommended = Math.max(5, totalQ);
        const prog = totalQ > 0 ? Math.min(100, Math.round((stats.correct / totalQ) * 100)) : 0;
        return {
          topicId: tid, topicName: topicMap.get(tid) ?? tid,
          totalQuestions: totalQ, answered: stats.answered, correct: stats.correct,
          progress: prog, recommended,
        };
      });

      setTopicProgress(progress);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return null;
  if (topicProgress.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">📚 Plano de Estudo Recomendado</h3>
      <div className="space-y-3">
        {topicProgress.map((tp, i) => (
          <div key={tp.topicId} className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">
                {i + 1}. {tp.topicName}
              </p>
              <span className="text-xs text-muted-foreground">
                {tp.correct}/{tp.totalQuestions} acertos
              </span>
            </div>
            <Progress value={tp.progress} className="h-2 mb-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {tp.progress}% · {tp.totalQuestions} exercícios
              </span>
              <button
                onClick={() => onStartTopic(tp.topicId)}
                className="rounded-lg text-xs font-medium bg-primary text-primary-foreground px-4 py-1.5 hover:brightness-110 transition-all"
              >
                Treinar →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
