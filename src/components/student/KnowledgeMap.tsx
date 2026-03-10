import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getTopics, getSubjects, loadQuestionBank, getAllowedSubjectSlugs } from '../../lib/storage';
import { Progress } from '../ui/progress';
import type { Topic, Question, Attempt } from '../../lib/types';

interface TopicDomain {
  topicId: string;
  topicName: string;
  subjectSlug: string;
  total: number;
  correct: number;
  rate: number;
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
    case 'not_started': return { label: 'Não iniciado', color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground/20', border: '' };
    case 'needs_study': return { label: 'Precisa estudar', color: 'text-destructive', bg: 'bg-destructive/5', bar: 'bg-destructive', border: 'border-l-destructive' };
    case 'developing': return { label: 'Em desenvolvimento', color: 'text-gold', bg: 'bg-gold/5', bar: 'bg-gold', border: 'border-l-gold' };
    case 'mastered': return { label: 'Dominado', color: 'text-success', bg: 'bg-success/5', bar: 'bg-success', border: 'border-l-success' };
  }
}

export function KnowledgeMap({ userId: externalUserId }: { userId?: string } = {}) {
  const { user } = useAuth();
  const userId = externalUserId ?? user?.username ?? '';
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [attempts, topics, subjects, questions, allowedSlugs] = await Promise.all([
        getAttempts(userId),
        getTopics({ activeOnly: true }),
        getSubjects({ activeOnly: true }),
        loadQuestionBank(),
        externalUserId ? Promise.resolve([]) : getAllowedSubjectSlugs(userId),
      ]);

      const filteredTopics = externalUserId ? topics : topics.filter(t => allowedSlugs.includes(t.subject));
      const subjectMap = new Map(subjects.map(s => [s.slug, s.name]));

      const statsByTopic = new Map<string, { total: number; correct: number }>();
      attempts.forEach(a => {
        const q = questions.find(qq => qq.id === a.questionId);
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
          return {
            subjectName: subjectMap.get(slug) ?? slug,
            topics: topics.sort((a, b) => b.rate - a.rate),
            averageRate: avg,
          };
        })
        .filter(g => g.topics.length > 0);

      setGroups(result);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (groups.length === 0) return null;

  const allTopics = groups.flatMap(g => g.topics);
  const mastered = allTopics.filter(t => t.status === 'mastered').length;
  const developing = allTopics.filter(t => t.status === 'developing').length;
  const needsStudy = allTopics.filter(t => t.status === 'needs_study').length;
  const notStarted = allTopics.filter(t => t.status === 'not_started').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Dominados', value: mastered, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Em desenv.', value: developing, color: 'text-gold', bg: 'bg-gold/10' },
          { label: 'Estudar', value: needsStudy, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Não iniciados', value: notStarted, color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* By subject */}
      {groups.map(group => (
        <div key={group.subjectName} className="bg-card rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">{group.subjectName}</h3>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <Progress value={group.averageRate} className="h-2" />
              </div>
              <span className="text-sm font-semibold text-primary">{group.averageRate}%</span>
            </div>
          </div>
          <div className="space-y-2">
            {group.topics.map(t => {
              const config = statusConfig(t.status);
              return (
                <div key={t.topicId} className={`rounded-lg border-l-4 ${config.border || 'border-l-transparent'} ${config.bg} px-4 py-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">{t.topicName}</p>
                    <span className={`text-xs font-semibold ${config.color}`}>
                      {t.total > 0 ? `${t.rate}%` : ''} {config.label}
                    </span>
                  </div>
                  {t.total > 0 && (
                    <div className="w-full bg-border/50 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${config.bar} transition-all`} style={{ width: `${t.rate}%` }} />
                    </div>
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
