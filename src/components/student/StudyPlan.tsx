import { useMemo } from 'react';
import { Progress } from '../ui/progress';
import type { Topic, Question, Attempt } from '../../lib/types';
import { BookOpen, ArrowRight } from 'lucide-react';

interface TopicProgress {
  topicId: string;
  topicName: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  progress: number;
}

interface StudyPlanProps {
  attempts: Attempt[];
  questions: Question[];
  topics: Topic[];
  diagnosticResult: any | null;
  onStartTopic: (topicId: string) => void;
}

export function StudyPlan({ attempts, questions, topics, diagnosticResult, onStartTopic }: StudyPlanProps) {
  const topicProgress = useMemo(() => {
    const topicMap = new Map(topics.map(t => [t.id, t.name]));
    const questionMap = new Map(questions.map(q => [q.id, q]));

    const publishedByTopic = new Map<string, number>();
    questions.filter(q => q.status !== 'draft').forEach(q => {
      if (q.topicId) publishedByTopic.set(q.topicId, (publishedByTopic.get(q.topicId) ?? 0) + 1);
    });

    const attemptsByTopic = new Map<string, { answered: number; correct: number }>();
    attempts.forEach(a => {
      const q = questionMap.get(a.questionId);
      if (!q?.topicId) return;
      const prev = attemptsByTopic.get(q.topicId) ?? { answered: 0, correct: 0 };
      prev.answered += 1;
      if (a.isCorrect) prev.correct += 1;
      attemptsByTopic.set(q.topicId, prev);
    });

    let weakTopicIds: string[] = [];
    if (diagnosticResult) {
      const d = diagnosticResult as any;
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
      weakTopicIds = topics.filter(t => (publishedByTopic.get(t.id) ?? 0) > 0).map(t => t.id).slice(0, 5);
    }

    return weakTopicIds.map(tid => {
      const stats = attemptsByTopic.get(tid) ?? { answered: 0, correct: 0 };
      const totalQ = publishedByTopic.get(tid) ?? 0;
      const prog = totalQ > 0 ? Math.min(100, Math.round((stats.correct / totalQ) * 100)) : 0;
      return {
        topicId: tid, topicName: topicMap.get(tid) ?? tid,
        totalQuestions: totalQ, answered: stats.answered, correct: stats.correct,
        progress: prog,
      };
    });
  }, [attempts, questions, topics, diagnosticResult]);

  if (topicProgress.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm p-5 border border-border">
      <h3 className="text-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        Plano de Estudo Recomendado
      </h3>
      <div className="space-y-3">
        {topicProgress.map((tp, i) => (
          <div key={tp.topicId} className="rounded-xl bg-muted/50 p-4 hover:bg-muted transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-body font-medium text-foreground">
                <span className="text-caption text-muted-foreground font-mono mr-1">{i + 1}.</span> {tp.topicName}
              </p>
              <span className="text-caption text-muted-foreground">
                {tp.correct}/{tp.totalQuestions} acertos
              </span>
            </div>
            <Progress value={tp.progress} className="h-2 mb-2" indicatorClassName={tp.progress >= 70 ? 'bg-success' : tp.progress >= 40 ? 'bg-gold' : 'bg-destructive'} />
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted-foreground">
                {tp.progress}% · {tp.totalQuestions} exercícios
              </span>
              <button
                onClick={() => onStartTopic(tp.topicId)}
                className="rounded-lg text-caption font-semibold bg-primary text-primary-foreground px-4 py-1.5 hover:bg-primary-light transition-all flex items-center gap-1 active:scale-[0.98]"
              >
                Treinar <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
