import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertTriangle, Brain, Clock, Target, TrendingUp, Users } from 'lucide-react';
import { StudentSelector, useStudentList } from './StudentSelector';

interface EngagementData {
  avgSessionSeconds: number;
  sessionsToday: number;
  activeToday: number;
  activeThisWeek: number;
  avgStudyPerStudent: number;
}

interface BehaviorData {
  avgTimePerQuestion: number;
  guessRate: number;
  abandonRate: number;
  totalAttempts: number;
  totalGuesses: number;
  totalAbandoned: number;
  topicErrorRates: { topicId: string; topicName: string; errorRate: number; total: number }[];
}

interface PedagogicalData {
  hardestTopics: { topicId: string; topicName: string; avgTime: number; errorRate: number }[];
  slowestQuestions: { questionId: string; preview: string; avgTime: number; attempts: number }[];
  mostRetriedQuestions: { questionId: string; preview: string; avgAttempts: number; totalUsers: number }[];
}

function StatCard({ label, value, icon: Icon, subtitle }: { label: string; value: string | number; icon: any; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function AdminAnalytics() {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [behavior, setBehavior] = useState<BehaviorData | null>(null);
  const [pedagogical, setPedagogical] = useState<PedagogicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');
  const students = useStudentList();

  useEffect(() => {
    loadAll();
  }, [selectedStudent]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadEngagement(), loadBehavior(), loadPedagogical()]);
    setLoading(false);
  }

  async function loadEngagement() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    let sessionsQ = supabase.from('user_sessions').select('duration_seconds, user_id').not('duration_seconds', 'is', null).gt('duration_seconds', 0);
    let todayQ = supabase.from('user_sessions').select('user_id').gte('start_time', today);
    let weekQ = supabase.from('user_sessions').select('user_id').gte('start_time', weekAgo);
    if (selectedStudent) {
      sessionsQ = sessionsQ.eq('user_id', selectedStudent);
      todayQ = todayQ.eq('user_id', selectedStudent);
      weekQ = weekQ.eq('user_id', selectedStudent);
    }

    const [sessionsRes, todaySessionsRes, weekSessionsRes] = await Promise.all([sessionsQ, todayQ, weekQ]);

    const sessions = sessionsRes.data ?? [];
    const totalDuration = sessions.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0);
    const avgSession = sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0;

    const uniqueStudents = new Set(sessions.map((r: any) => r.user_id));
    const avgStudy = uniqueStudents.size > 0 ? Math.round(totalDuration / uniqueStudents.size) : 0;

    const todayUsers = new Set((todaySessionsRes.data ?? []).map((r: any) => r.user_id));
    const weekUsers = new Set((weekSessionsRes.data ?? []).map((r: any) => r.user_id));

    setEngagement({
      avgSessionSeconds: avgSession,
      sessionsToday: (todaySessionsRes.data ?? []).length,
      activeToday: todayUsers.size,
      activeThisWeek: weekUsers.size,
      avgStudyPerStudent: avgStudy,
    });
  }

  async function loadBehavior() {
    let attemptsQ = supabase.from('attempts').select('topic_id, is_correct, possible_guess, question_abandoned, time_spent_seconds');
    if (selectedStudent) attemptsQ = attemptsQ.eq('user_id', selectedStudent);
    const [attemptsRes, topicsRes] = await Promise.all([
      attemptsQ,
      supabase.from('topics').select('id, name'),
    ]);

    const attempts = attemptsRes.data ?? [];
    const topicsMap = new Map((topicsRes.data ?? []).map((t: any) => [t.id, t.name]));
    const total = attempts.length;
    const guesses = attempts.filter((a: any) => a.possible_guess).length;
    const abandoned = attempts.filter((a: any) => a.question_abandoned).length;

    const withTime = attempts.filter((a: any) => (a.time_spent_seconds ?? 0) > 0);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((s: number, a: any) => s + a.time_spent_seconds, 0) / withTime.length)
      : 0;

    // Error rate by topic
    const topicStats = new Map<string, { errors: number; total: number }>();
    attempts.forEach((a: any) => {
      if (!a.topic_id) return;
      const s = topicStats.get(a.topic_id) || { errors: 0, total: 0 };
      s.total++;
      if (!a.is_correct) s.errors++;
      topicStats.set(a.topic_id, s);
    });

    const topicErrorRates = Array.from(topicStats.entries())
      .map(([topicId, s]) => ({
        topicId,
        topicName: topicsMap.get(topicId) ?? topicId,
        errorRate: Math.round((s.errors / s.total) * 100),
        total: s.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    setBehavior({
      avgTimePerQuestion: avgTime,
      guessRate: total > 0 ? Math.round((guesses / total) * 100) : 0,
      abandonRate: total > 0 ? Math.round((abandoned / total) * 100) : 0,
      totalAttempts: total,
      totalGuesses: guesses,
      totalAbandoned: abandoned,
      topicErrorRates,
    });
  }

  async function loadPedagogical() {
    const [attemptsRes, questionsRes, topicsRes] = await Promise.all([
      supabase.from('attempts').select('question_id, topic_id, is_correct, time_spent_seconds, attempt_number, user_id'),
      supabase.from('questions').select('id, statement').eq('status', 'published'),
      supabase.from('topics').select('id, name'),
    ]);

    const attempts = attemptsRes.data ?? [];
    const questionsMap = new Map((questionsRes.data ?? []).map((q: any) => [q.id, q.statement]));
    const topicsMap = new Map((topicsRes.data ?? []).map((t: any) => [t.id, t.name]));

    // Hardest topics (avg time + error rate)
    const topicAgg = new Map<string, { totalTime: number; count: number; errors: number }>();
    attempts.forEach((a: any) => {
      if (!a.topic_id) return;
      const s = topicAgg.get(a.topic_id) || { totalTime: 0, count: 0, errors: 0 };
      s.totalTime += a.time_spent_seconds ?? 0;
      s.count++;
      if (!a.is_correct) s.errors++;
      topicAgg.set(a.topic_id, s);
    });

    const hardestTopics = Array.from(topicAgg.entries())
      .filter(([, s]) => s.count >= 3)
      .map(([topicId, s]) => ({
        topicId,
        topicName: topicsMap.get(topicId) ?? topicId,
        avgTime: Math.round(s.totalTime / s.count),
        errorRate: Math.round((s.errors / s.count) * 100),
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    // Slowest questions
    const qTime = new Map<string, { total: number; count: number }>();
    attempts.forEach((a: any) => {
      if ((a.time_spent_seconds ?? 0) <= 0) return;
      const s = qTime.get(a.question_id) || { total: 0, count: 0 };
      s.total += a.time_spent_seconds;
      s.count++;
      qTime.set(a.question_id, s);
    });

    const slowestQuestions = Array.from(qTime.entries())
      .filter(([, s]) => s.count >= 2)
      .map(([qId, s]) => ({
        questionId: qId,
        preview: (questionsMap.get(qId) ?? '').slice(0, 80),
        avgTime: Math.round(s.total / s.count),
        attempts: s.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Most retried questions
    const qRetry = new Map<string, { maxAttempt: number; users: Set<string> }>();
    attempts.forEach((a: any) => {
      const s = qRetry.get(a.question_id) || { maxAttempt: 0, users: new Set() };
      s.maxAttempt = Math.max(s.maxAttempt, a.attempt_number ?? 1);
      s.users.add(a.user_id);
      qRetry.set(a.question_id, s);
    });

    const mostRetriedQuestions = Array.from(qRetry.entries())
      .filter(([, s]) => s.maxAttempt > 1)
      .map(([qId, s]) => ({
        questionId: qId,
        preview: (questionsMap.get(qId) ?? '').slice(0, 80),
        avgAttempts: s.maxAttempt,
        totalUsers: s.users.size,
      }))
      .sort((a, b) => b.avgAttempts - a.avgAttempts)
      .slice(0, 10);

    setPedagogical({ hardestTopics, slowestQuestions, mostRetriedQuestions });
  }

  if (loading) return <p className="font-body text-muted-foreground">Carregando análises...</p>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="engagement">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="behavior">Comportamento</TabsTrigger>
          <TabsTrigger value="pedagogical">Pedagógico</TabsTrigger>
        </TabsList>

        {/* ENGAGEMENT TAB */}
        <TabsContent value="engagement" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={Clock} label="Tempo médio/sessão" value={formatSeconds(engagement?.avgSessionSeconds ?? 0)} />
            <StatCard icon={TrendingUp} label="Sessões hoje" value={engagement?.sessionsToday ?? 0} />
            <StatCard icon={Users} label="Ativos hoje" value={engagement?.activeToday ?? 0} />
            <StatCard icon={Users} label="Ativos (7 dias)" value={engagement?.activeThisWeek ?? 0} />
            <StatCard icon={Activity} label="Estudo médio/aluno" value={formatSeconds(engagement?.avgStudyPerStudent ?? 0)} />
          </div>
        </TabsContent>

        {/* BEHAVIOR TAB */}
        <TabsContent value="behavior" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Clock} label="Tempo médio/questão" value={formatSeconds(behavior?.avgTimePerQuestion ?? 0)} />
            <StatCard
              icon={AlertTriangle}
              label="Taxa de chutes"
              value={`${behavior?.guessRate ?? 0}%`}
              subtitle={`${behavior?.totalGuesses ?? 0} de ${behavior?.totalAttempts ?? 0}`}
            />
            <StatCard
              icon={Target}
              label="Taxa de abandono"
              value={`${behavior?.abandonRate ?? 0}%`}
              subtitle={`${behavior?.totalAbandoned ?? 0} de ${behavior?.totalAttempts ?? 0}`}
            />
            <StatCard icon={Brain} label="Total tentativas" value={behavior?.totalAttempts ?? 0} />
          </div>

          {(behavior?.topicErrorRates?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase">Taxa de erro por tópico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        {['Tópico', 'Tentativas', 'Taxa de erro'].map(h => (
                          <th key={h} className="text-xs text-left p-2 border border-border font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {behavior!.topicErrorRates.map(t => (
                        <tr key={t.topicId} className="hover:bg-muted/50">
                          <td className="p-2 border border-border text-xs">{t.topicName}</td>
                          <td className="p-2 border border-border text-xs">{t.total}</td>
                          <td className="p-2 border border-border text-xs">
                            <span className={t.errorRate > 60 ? 'text-destructive font-bold' : ''}>{t.errorRate}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PEDAGOGICAL TAB */}
        <TabsContent value="pedagogical" className="space-y-4 mt-4">
          {/* Hardest topics */}
          {(pedagogical?.hardestTopics?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase">Tópicos com maior dificuldade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        {['Tópico', 'Tempo médio', 'Taxa de erro'].map(h => (
                          <th key={h} className="text-xs text-left p-2 border border-border font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pedagogical!.hardestTopics.map(t => (
                        <tr key={t.topicId} className="hover:bg-muted/50">
                          <td className="p-2 border border-border text-xs">{t.topicName}</td>
                          <td className="p-2 border border-border text-xs">{formatSeconds(t.avgTime)}</td>
                          <td className="p-2 border border-border text-xs">
                            <span className={t.errorRate > 60 ? 'text-destructive font-bold' : ''}>{t.errorRate}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slowest questions */}
          {(pedagogical?.slowestQuestions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase">Questões com maior tempo médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        {['Questão', 'Tempo médio', 'Tentativas'].map(h => (
                          <th key={h} className="text-xs text-left p-2 border border-border font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pedagogical!.slowestQuestions.map(q => (
                        <tr key={q.questionId} className="hover:bg-muted/50">
                          <td className="p-2 border border-border text-xs max-w-[300px] truncate">{q.preview || q.questionId}</td>
                          <td className="p-2 border border-border text-xs">{formatSeconds(q.avgTime)}</td>
                          <td className="p-2 border border-border text-xs">{q.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Most retried */}
          {(pedagogical?.mostRetriedQuestions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase">Questões com mais tentativas até acerto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        {['Questão', 'Máx. tentativas', 'Alunos'].map(h => (
                          <th key={h} className="text-xs text-left p-2 border border-border font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pedagogical!.mostRetriedQuestions.map(q => (
                        <tr key={q.questionId} className="hover:bg-muted/50">
                          <td className="p-2 border border-border text-xs max-w-[300px] truncate">{q.preview || q.questionId}</td>
                          <td className="p-2 border border-border text-xs">{q.avgAttempts}</td>
                          <td className="p-2 border border-border text-xs">{q.totalUsers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!pedagogical?.hardestTopics?.length && !pedagogical?.slowestQuestions?.length && !pedagogical?.mostRetriedQuestions?.length && (
            <p className="text-sm text-muted-foreground">Ainda não há dados pedagógicos suficientes para análise.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
