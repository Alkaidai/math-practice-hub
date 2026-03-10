import { useState, useEffect, useMemo } from 'react';
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
}

function getDomainStatus(total: number, rate: number): TopicDomain['status'] {
  if (total === 0) return 'not_started';
  if (rate <= 40) return 'needs_study';
  if (rate <= 70) return 'developing';
  return 'mastered';
}

function statusLabel(status: TopicDomain['status']): string {
  switch (status) {
    case 'not_started': return 'Não iniciado';
    case 'needs_study': return 'Precisa estudar';
    case 'developing': return 'Em desenvolvimento';
    case 'mastered': return 'Dominado';
  }
}

function statusColor(status: TopicDomain['status']): string {
  switch (status) {
    case 'not_started': return 'text-muted-foreground';
    case 'needs_study': return 'text-destructive';
    case 'developing': return 'text-yellow-600';
    case 'mastered': return 'text-green-600';
  }
}

function statusIcon(status: TopicDomain['status']): string {
  switch (status) {
    case 'not_started': return '⬜';
    case 'needs_study': return '🔴';
    case 'developing': return '🟡';
    case 'mastered': return '🟢';
  }
}

function statusBorder(status: TopicDomain['status']): string {
  switch (status) {
    case 'not_started': return 'border-border';
    case 'needs_study': return 'border-destructive/50';
    case 'developing': return 'border-yellow-500/50';
    case 'mastered': return 'border-green-500/50';
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

      // Filter topics by allowed subjects (skip for admin viewing)
      const filteredTopics = externalUserId ? topics : topics.filter(t => allowedSlugs.includes(t.subject));
      const topicMap = new Map(filteredTopics.map(t => [t.id, t]));
      const subjectMap = new Map(subjects.map(s => [s.slug, s.name]));

      // Compute stats per topic from attempts
      const statsByTopic = new Map<string, { total: number; correct: number }>();
      attempts.forEach(a => {
        const q = questions.find(qq => qq.id === a.questionId);
        if (!q?.topicId) return;
        const prev = statsByTopic.get(q.topicId) ?? { total: 0, correct: 0 };
        prev.total += 1;
        if (a.isCorrect) prev.correct += 1;
        statsByTopic.set(q.topicId, prev);
      });

      // Build domain list
      const domains: TopicDomain[] = filteredTopics.map(t => {
        const stats = statsByTopic.get(t.id) ?? { total: 0, correct: 0 };
        const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          topicId: t.id,
          topicName: t.name,
          subjectSlug: t.subject,
          total: stats.total,
          correct: stats.correct,
          rate,
          status: getDomainStatus(stats.total, rate),
        };
      });

      // Group by subject
      const groupMap = new Map<string, TopicDomain[]>();
      domains.forEach(d => {
        const arr = groupMap.get(d.subjectSlug) ?? [];
        arr.push(d);
        groupMap.set(d.subjectSlug, arr);
      });

      const result: SubjectGroup[] = [...groupMap.entries()]
        .map(([slug, topics]) => ({
          subjectName: subjectMap.get(slug) ?? slug,
          topics: topics.sort((a, b) => a.rate - b.rate),
        }))
        .filter(g => g.topics.length > 0);

      setGroups(result);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;
  if (groups.length === 0) return null;

  const allTopics = groups.flatMap(g => g.topics);
  const mastered = allTopics.filter(t => t.status === 'mastered').length;
  const developing = allTopics.filter(t => t.status === 'developing').length;
  const needsStudy = allTopics.filter(t => t.status === 'needs_study').length;
  const notStarted = allTopics.filter(t => t.status === 'not_started').length;

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase mb-3">🗺️ Mapa de Conhecimento</h3>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="border border-green-500/30 bg-green-500/5 p-2 text-center">
          <p className="font-heading text-xs text-muted-foreground">Dominados</p>
          <p className="font-heading text-lg font-bold text-green-600">{mastered}</p>
        </div>
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-2 text-center">
          <p className="font-heading text-xs text-muted-foreground">Em desenv.</p>
          <p className="font-heading text-lg font-bold text-yellow-600">{developing}</p>
        </div>
        <div className="border border-destructive/30 bg-destructive/5 p-2 text-center">
          <p className="font-heading text-xs text-muted-foreground">Estudar</p>
          <p className="font-heading text-lg font-bold text-destructive">{needsStudy}</p>
        </div>
        <div className="border border-border p-2 text-center">
          <p className="font-heading text-xs text-muted-foreground">Não iniciados</p>
          <p className="font-heading text-lg font-bold text-muted-foreground">{notStarted}</p>
        </div>
      </div>

      {/* By subject */}
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.subjectName}>
            <p className="font-heading text-xs font-bold text-foreground uppercase mb-2">{group.subjectName}</p>
            <div className="space-y-1">
              {group.topics.map(t => (
                <div key={t.topicId} className={`flex items-center gap-3 border ${statusBorder(t.status)} p-2`}>
                  <span className="text-sm">{statusIcon(t.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{t.topicName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.total > 0 && (
                      <div className="w-16">
                        <Progress value={t.rate} className="h-1.5" />
                      </div>
                    )}
                    <span className={`font-heading text-xs font-bold whitespace-nowrap ${statusColor(t.status)}`}>
                      {t.total > 0 ? `${t.rate}%` : ''} {statusLabel(t.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
