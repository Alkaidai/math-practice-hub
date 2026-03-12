import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttempts, getTopics, getSubjects, loadQuestionBank, getAllowedSubjectSlugs } from '../../lib/storage';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { cachedFetch, CACHE_KEYS } from '../../lib/cache';
import { CheckCircle2, Lock, Play, Circle, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Progress } from '../ui/progress';
import type { Topic, Attempt } from '../../lib/types';

interface TrailNode {
  topicId: string;
  topicName: string;
  total: number;
  correct: number;
  rate: number;
  available: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
}

interface Trail {
  subjectSlug: string;
  subjectName: string;
  nodes: TrailNode[];
  completedCount: number;
  totalCount: number;
  overallRate: number;
}

function getNodeStatus(total: number, rate: number, available: number, prevCompleted: boolean, isFirst: boolean): TrailNode['status'] {
  if (available === 0) return 'locked';
  if (total === 0) return (isFirst || prevCompleted) ? 'available' : 'locked';
  if (rate >= 70 && total >= 3) return 'completed';
  return 'in_progress';
}

function NodeIcon({ status }: { status: TrailNode['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <div className="w-12 h-12 rounded-full bg-success/15 border-2 border-success flex items-center justify-center shadow-sm">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
      );
    case 'in_progress':
      return (
        <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center shadow-sm animate-pulse">
          <Play className="h-5 w-5 text-primary ml-0.5" />
        </div>
      );
    case 'available':
      return (
        <div className="w-12 h-12 rounded-full bg-card border-2 border-primary/40 flex items-center justify-center shadow-sm">
          <Circle className="h-5 w-5 text-primary/60" />
        </div>
      );
    case 'locked':
      return (
        <div className="w-12 h-12 rounded-full bg-muted border-2 border-border flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground/50" />
        </div>
      );
  }
}

function TrailNodeCard({ node, index, isLast, onStart }: {
  node: TrailNode; index: number; isLast: boolean; onStart?: (topicId: string) => void;
}) {
  const canStart = node.status === 'available' || node.status === 'in_progress';

  return (
    <div className="flex items-stretch gap-4">
      {/* Vertical connector */}
      <div className="flex flex-col items-center w-12 shrink-0">
        <NodeIcon status={node.status} />
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[2rem] ${
            node.status === 'completed' ? 'bg-success/40' : 'bg-border'
          }`} />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 rounded-xl p-4 mb-3 transition-all ${
          node.status === 'completed' ? 'bg-success/5 border border-success/20' :
          node.status === 'in_progress' ? 'bg-primary/5 border border-primary/20' :
          node.status === 'available' ? 'bg-card border border-border hover:border-primary/30' :
          'bg-muted/50 border border-border/50 opacity-60'
        } ${canStart ? 'cursor-pointer hover:shadow-sm' : ''}`}
        onClick={() => canStart && onStart?.(node.topicId)}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-mono text-muted-foreground shrink-0">{String(index + 1).padStart(2, '0')}</span>
            <p className={`text-sm font-medium truncate ${
              node.status === 'locked' ? 'text-muted-foreground' : 'text-foreground'
            }`}>{node.topicName}</p>
          </div>
          {node.status === 'completed' && <Star className="h-4 w-4 text-gold shrink-0" />}
        </div>

        {node.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Progress value={node.rate} className="h-1.5 flex-1" />
              <span className={`text-xs font-semibold shrink-0 ${
                node.rate >= 70 ? 'text-success' : node.rate >= 40 ? 'text-gold' : 'text-destructive'
              }`}>{node.rate}%</span>
            </div>
            <p className="text-xs text-muted-foreground">{node.correct}/{node.total} acertos · {node.available} questões</p>
          </div>
        )}

        {node.total === 0 && node.status !== 'locked' && (
          <p className="text-xs text-muted-foreground">{node.available} questões disponíveis</p>
        )}

        {canStart && (
          <button
            onClick={(e) => { e.stopPropagation(); onStart?.(node.topicId); }}
            className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <Play className="h-3 w-3" />
            {node.status === 'in_progress' ? 'Continuar' : 'Começar'}
          </button>
        )}
      </div>
    </div>
  );
}

function TrailSection({ trail, onStart }: { trail: Trail; onStart?: (topicId: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const pct = trail.totalCount > 0 ? Math.round((trail.completedCount / trail.totalCount) * 100) : 0;

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{trail.subjectName.charAt(0)}</span>
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-foreground">{trail.subjectName}</h3>
            <p className="text-xs text-muted-foreground">
              {trail.completedCount}/{trail.totalCount} módulos · {pct}% concluído
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 hidden sm:block">
            <Progress value={pct} className="h-2" />
          </div>
          <span className="text-sm font-semibold text-primary">{pct}%</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {trail.nodes.map((node, i) => (
            <TrailNodeCard
              key={node.topicId}
              node={node}
              index={i}
              isLast={i === trail.nodes.length - 1}
              onStart={onStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LearningTrails({ onStartTopic }: { onStartTopic?: (topicId: string) => void }) {
  const { user } = useAuth();
  const userId = user?.username ?? '';
  const [trails, setTrails] = useState<Trail[]>([]);
  const { loading, error: loadError, execute } = useLoadWithTimeout();

  const load = useCallback(async () => {
    await execute(async () => {
      const [attempts, topics, subjects, questions, allowedSlugs] = await Promise.all([
        getAttempts(userId),
        getTopics({ activeOnly: true }),
        getSubjects({ activeOnly: true }),
        loadQuestionBank(),
        getAllowedSubjectSlugs(userId),
      ]);

      const filteredTopics = topics.filter(t => allowedSlugs.includes(t.subject));
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

      const groupMap = new Map<string, Topic[]>();
      filteredTopics.forEach(t => {
        const arr = groupMap.get(t.subject) ?? [];
        arr.push(t);
        groupMap.set(t.subject, arr);
      });

      const result: Trail[] = [...groupMap.entries()]
        .map(([slug, topicList]) => {
          const nodes: TrailNode[] = [];
          topicList.forEach((t, i) => {
            const stats = statsByTopic.get(t.id) ?? { total: 0, correct: 0 };
            const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            const available = availableByTopic.get(t.id) ?? 0;
            const prevCompleted = i > 0 && nodes[i - 1]?.status === 'completed';
            const status = getNodeStatus(stats.total, rate, available, prevCompleted, i === 0);

            nodes.push({
              topicId: t.id, topicName: t.name,
              total: stats.total, correct: stats.correct, rate, available, status,
            });
          });

          const completedCount = nodes.filter(n => n.status === 'completed').length;
          const withData = nodes.filter(n => n.total > 0);
          const overallRate = withData.length > 0
            ? Math.round(withData.reduce((s, n) => s + n.rate, 0) / withData.length)
            : 0;

          return {
            subjectSlug: slug,
            subjectName: subjectMap.get(slug) ?? slug,
            nodes, completedCount, totalCount: nodes.length, overallRate,
          };
        })
        .filter(t => t.nodes.length > 0);

      setTrails(result);
    });
  }, [userId, execute]);

  useEffect(() => { load(); }, [load]);
  useVisibilityRefresh(load, 60_000); // refresh after 1min hidden

  if (loadError) return <LoadingTimeout error={loadError} onRetry={load} />;
  if (loading) return <p className="text-muted-foreground">Carregando trilhas...</p>;

  if (trails.length === 0) return (
    <div className="bg-card rounded-xl shadow-sm p-8 text-center">
      <p className="text-muted-foreground">Nenhuma trilha disponível.</p>
    </div>
  );

  const totalModules = trails.reduce((s, t) => s + t.totalCount, 0);
  const completedModules = trails.reduce((s, t) => s + t.completedCount, 0);
  const globalPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Global progress */}
      <div className="bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Progresso Geral</h2>
            <p className="text-sm text-muted-foreground">{completedModules} de {totalModules} módulos concluídos</p>
          </div>
          <span className="text-3xl font-extrabold text-primary">{globalPct}%</span>
        </div>
        <Progress value={globalPct} className="h-3" />
      </div>

      {/* Trail sections */}
      {trails.map(trail => (
        <TrailSection key={trail.subjectSlug} trail={trail} onStart={onStartTopic} />
      ))}
    </div>
  );
}
