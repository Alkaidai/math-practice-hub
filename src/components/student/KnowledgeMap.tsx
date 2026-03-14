import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getTopics, getSubjects, loadQuestionBank, getAllowedSubjectSlugs } from '../../lib/storage';
import { Progress } from '../ui/progress';
import { LoadingState, ScreenErrorState, EmptyState } from './ScreenStates';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { AlertTriangle, CheckCircle2, BookOpen, Clock, ArrowRight } from 'lucide-react';
import type { Topic, Question, Attempt } from '../../lib/types';

interface TopicDomain {
  topicId: string;
  topicName: string;
  subjectSlug: string;
  total: number;
  correct: number;
  rate: number;
  available: number;
  status: 'not_started' | 'needs_study' | 'developing' | 'mastered';
}

interface SubjectGroup {
  subjectName: string;
  topics: TopicDomain[];
  averageRate: number;
}

function getDomainStatus(total: number, rate: number): TopicDomain['status'] {
  if (total === 0) return 'not_started';
  if (rate <= 40) return 'needs_study';
  if (rate <= 70) return 'developing';
  return 'mastered';
}

function statusConfig(status: TopicDomain['status']) {
  switch (status) {
    case 'not_started': return { label: 'Não iniciado', color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground/20', border: 'border-l-muted-foreground/20', icon: Clock, softBg: 'bg-muted' };
    case 'needs_study': return { label: 'Precisa estudar', color: 'text-destructive', bg: 'bg-destructive-soft', bar: 'bg-destructive', border: 'border-l-destructive', icon: AlertTriangle, softBg: 'bg-destructive-soft' };
    case 'developing': return { label: 'Em desenvolvimento', color: 'text-gold', bg: 'bg-gold-soft', bar: 'bg-gold', border: 'border-l-gold', icon: BookOpen, softBg: 'bg-gold-soft' };
    case 'mastered': return { label: 'Dominado', color: 'text-success', bg: 'bg-success-soft', bar: 'bg-success', border: 'border-l-success', icon: CheckCircle2, softBg: 'bg-success-soft' };
  }
}

export function KnowledgeMap({ userId: externalUserId, onStartTopic }: { userId?: string; onStartTopic?: (topicId: string) => void } = {}) {
  const { user } = useAuth();
  const userId = externalUserId ?? user?.username ?? '';
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const { loading, error: loadError, execute } = useLoadWithTimeout();
  const [sortBy, setSortBy] = useState<'priority' | 'name' | 'rate'>('priority');

  const load = useCallback(async () => {
    await execute(async () => {
      const [attempts, topics, subjects, questions, allowedSlugs] = await Promise.all([
        getAttempts(userId),
        getTopics({ activeOnly: true }),
        getSubjects({ activeOnly: true }),
        loadQuestionBank(),
        externalUserId ? Promise.resolve([]) : getAllowedSubjectSlugs(userId),
      ]);

      const filteredTopics = externalUserId ? topics : topics.filter(t => allowedSlugs.includes(t.subject));
      const subjectMap = new Map(subjects.map(s => [s.slug, s.name]));
      const questionMap = new Map(questions.map(q => [q.id, q]));

      const availableByTopic = new Map<string, number>();
      questions.forEach(q => {
        if (q.status !== 'draft' && q.topicId) {
          availableByTopic.set(q.topicId, (availableByTopic.get(q.topicId) ?? 0) + 1);
        }
      });

      const statsByTopic = new Map<string, { total: number; correct: number }>();
      attempts.forEach(a => {
        const q = questionMap.get(a.questionId);
        if (!q?.topicId) return;
        const prev = statsByTopic.get(q.topicId) ?? { total: 0, correct: 0 };
        prev.total += 1;
        if (a.isCorrect) prev.correct += 1;
        statsByTopic.set(q.topicId, prev);
      });

      const domains: TopicDomain[] = filteredTopics.map(t => {
        const stats = statsByTopic.get(t.id) ?? { total: 0, correct: 0 };
        const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          topicId: t.id, topicName: t.name, subjectSlug: t.subject,
          total: stats.total, correct: stats.correct, rate,
          available: availableByTopic.get(t.id) ?? 0,
          status: getDomainStatus(stats.total, rate),
        };
      });

      const groupMap = new Map<string, TopicDomain[]>();
      domains.forEach(d => {
        const arr = groupMap.get(d.subjectSlug) ?? [];
        arr.push(d);
        groupMap.set(d.subjectSlug, arr);
      });

      const result: SubjectGroup[] = [...groupMap.entries()]
        .map(([slug, topics]) => {
          const withData = topics.filter(t => t.total > 0);
          const avg = withData.length > 0 ? Math.round(withData.reduce((s, t) => s + t.rate, 0) / withData.length) : 0;
          return { subjectName: subjectMap.get(slug) ?? slug, topics, averageRate: avg };
        })
        .filter(g => g.topics.length > 0);

      setGroups(result);
    });
  }, [userId, execute, externalUserId]);

  useEffect(() => { load(); }, [load]);
  // MVP: useVisibilityRefresh DISABLED — no auto-reload on tab focus

  if (loading) return <LoadingState message="Carregando mapa de tópicos..." />;
  if (loadError) return <ScreenErrorState error={loadError} onRetry={load} />;
  if (groups.length === 0) return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
      <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-body text-muted-foreground">Nenhum tópico disponível ainda.</p>
    </div>
  );

  const allTopics = groups.flatMap(g => g.topics);
  const mastered = allTopics.filter(t => t.status === 'mastered').length;
  const developing = allTopics.filter(t => t.status === 'developing').length;
  const needsStudy = allTopics.filter(t => t.status === 'needs_study').length;
  const notStarted = allTopics.filter(t => t.status === 'not_started').length;

  const sortTopics = (topics: TopicDomain[]) => {
    const sorted = [...topics];
    if (sortBy === 'priority') {
      const order = { needs_study: 0, developing: 1, not_started: 2, mastered: 3 };
      sorted.sort((a, b) => order[a.status] - order[b.status] || a.rate - b.rate);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.topicName.localeCompare(b.topicName));
    } else {
      sorted.sort((a, b) => b.rate - a.rate);
    }
    return sorted;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Dominados', value: mastered, color: 'text-success', softBg: 'bg-success-soft', Icon: CheckCircle2 },
          { label: 'Em desenv.', value: developing, color: 'text-gold', softBg: 'bg-gold-soft', Icon: BookOpen },
          { label: 'Estudar', value: needsStudy, color: 'text-destructive', softBg: 'bg-destructive-soft', Icon: AlertTriangle },
          { label: 'Não iniciados', value: notStarted, color: 'text-muted-foreground', softBg: 'bg-muted', Icon: Clock },
        ].map(s => (
          <div key={s.label} className={`${s.softBg} rounded-xl p-4 text-center border border-border/50`}>
            <s.Icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-caption text-muted-foreground">{s.label}</p>
            <p className={`text-h2 font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-caption text-muted-foreground">Ordenar por:</span>
        {([['priority', 'Prioridade'], ['name', 'Nome'], ['rate', 'Taxa de acerto']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            className={`text-caption font-semibold px-3 py-1.5 rounded-lg transition-all ${sortBy === key ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* By subject */}
      {groups.map(group => (
        <div key={group.subjectName} className="bg-card rounded-xl shadow-sm p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h3 font-semibold text-foreground">{group.subjectName}</h3>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <Progress value={group.averageRate} className="h-2" />
              </div>
              <span className="text-body font-bold text-primary">{group.averageRate}%</span>
            </div>
          </div>
          <div className="space-y-2">
            {sortTopics(group.topics).map(t => {
              const config = statusConfig(t.status);
              const IconComp = config.icon;
              return (
                <div
                  key={t.topicId}
                  className={`rounded-xl border-l-4 ${config.border} ${config.bg} px-4 py-3 ${onStartTopic ? 'cursor-pointer hover:shadow-sm transition-all active:scale-[0.995]' : ''}`}
                  onClick={() => onStartTopic?.(t.topicId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconComp className={`h-4 w-4 shrink-0 ${config.color}`} />
                      <p className="text-body font-medium text-foreground truncate">{t.topicName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-caption text-muted-foreground font-mono">{t.total}/{t.available}</span>
                      <span className={`text-caption font-semibold ${config.color}`}>
                        {t.total > 0 ? `${t.rate}%` : ''} {config.label}
                      </span>
                      {onStartTopic && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                  {t.total > 0 && (
                    <Progress value={t.rate} className="h-1.5" indicatorClassName={config.bar} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
