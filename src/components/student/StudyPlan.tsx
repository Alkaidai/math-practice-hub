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
      const [diag, attempts, topics, questions] = await Promise.all([
        getDiagnosticResult(userId),
        getAttempts(userId),
        getTopics({ activeOnly: true }),
        loadQuestionBank(),
      ]);

      const topicMap = new Map(topics.map(t => [t.id, t.name]));
      const publishedByTopic = new Map<string, number>();
      questions.filter(q => q.status !== 'draft').forEach(q => {
        if (q.topicId) publishedByTopic.set(q.topicId, (publishedByTopic.get(q.topicId) ?? 0) + 1);
      });

      // Build attempt stats per topic
      const attemptsByTopic = new Map<string, { answered: number; correct: number }>();
      attempts.forEach(a => {
        const q = questions.find(qq => qq.id === a.questionId);
        if (!q?.topicId) return;
        const prev = attemptsByTopic.get(q.topicId) ?? { answered: 0, correct: 0 };
        prev.answered += 1;
        if (a.isCorrect) prev.correct += 1;
        attemptsByTopic.set(q.topicId, prev);
      });

      // Get weak topics from diagnostic or from attempt data
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

      // If no diagnostic, use topics with worst performance
      if (weakTopicIds.length === 0) {
        weakTopicIds = [...attemptsByTopic.entries()]
          .filter(([, s]) => s.answered > 0)
          .map(([tid, s]) => ({ tid, rate: Math.round((s.correct / s.answered) * 100) }))
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 5)
          .map(x => x.tid);
      }

      // If still nothing, show all topics with questions
      if (weakTopicIds.length === 0) {
        weakTopicIds = topics.filter(t => (publishedByTopic.get(t.id) ?? 0) > 0).map(t => t.id).slice(0, 5);
      }

      const progress: TopicProgress[] = weakTopicIds.map(tid => {
        const stats = attemptsByTopic.get(tid) ?? { answered: 0, correct: 0 };
        const totalQ = publishedByTopic.get(tid) ?? 0;
        const recommended = Math.max(5, totalQ);
        const prog = totalQ > 0 ? Math.min(100, Math.round((stats.correct / totalQ) * 100)) : 0;
        return {
          topicId: tid,
          topicName: topicMap.get(tid) ?? tid,
          totalQuestions: totalQ,
          answered: stats.answered,
          correct: stats.correct,
          progress: prog,
          recommended,
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
    <div className="border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase mb-3">📚 Plano de Estudo Recomendado</h3>
      <div className="space-y-3">
        {topicProgress.map((tp, i) => (
          <div key={tp.topicId} className="border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-heading text-xs font-bold text-foreground">
                {i + 1}. {tp.topicName}
              </p>
              <span className="font-heading text-xs text-muted-foreground">
                {tp.correct}/{tp.totalQuestions} acertos
              </span>
            </div>
            <Progress value={tp.progress} className="h-2 mb-2" />
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs text-muted-foreground">
                Progresso: {tp.progress}% · {tp.totalQuestions} exercícios disponíveis
              </span>
              <button
                onClick={() => onStartTopic(tp.topicId)}
                className="font-heading text-xs text-primary border border-primary px-2 py-0.5 hover:bg-primary hover:text-primary-foreground"
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
