import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getLessons, getTopics, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel } from '../../lib/ui-utils';
import { LoadingTimeout } from './LoadingTimeout';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { Search, PlayCircle, Clock } from 'lucide-react';
import type { Lesson, Topic } from '../../lib/types';

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes('youtube.com') && u.pathname.includes('/embed/')) {
      return url;
    }
  } catch { /* not a valid URL */ }
  return null;
}

export function StudentLessons() {
  const { user } = useAuth();
  const userId = user?.username ?? '';

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const { loading, error: loadError, execute } = useLoadWithTimeout();
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTopic, setFilterTopic] = useState('');

  const loadData = useCallback(async () => {
    await execute(async () => {
      const [allLessons, allTopics, allowedSlugs] = await Promise.all([
        getLessons(),
        getTopics({ activeOnly: true }),
        getAllowedSubjectSlugs(userId),
      ]);
      setLessons(allLessons.filter(l => allowedSlugs.includes(l.subject)));
      setTopics(allTopics.filter(t => allowedSlugs.includes(t.subject)));
    });
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);
  useVisibilityRefresh(loadData, 120_000); // refresh after 2min hidden (static data)

  const topicsMap = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics]);

  const subjects = useMemo(() => {
    const set = new Set(lessons.map(l => l.subject));
    return [...set];
  }, [lessons]);

  const filtered = useMemo(() => {
    let result = [...lessons];
    if (filterSubject) result = result.filter(l => l.subject === filterSubject);
    if (filterTopic) result = result.filter(l => l.topic === filterTopic);
    if (search) {
      const needle = search.toLowerCase();
      result = result.filter(l => {
        const topicName = topicsMap.get(l.topic)?.name ?? '';
        return l.title.toLowerCase().includes(needle) ||
          topicName.toLowerCase().includes(needle) ||
          subjectLabel(l.subject).toLowerCase().includes(needle);
      });
    }
    return result;
  }, [lessons, filterSubject, filterTopic, search, topicsMap]);

  const visibleLessons = filtered.filter(l => l.visibility === 'visible');
  const comingSoonLessons = filtered.filter(l => l.visibility === 'coming_soon');

  if (loadError) return <LoadingTimeout error={loadError} onRetry={loadData} />;
  if (loading) return <p className="text-muted-foreground">Carregando aulas...</p>;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar aulas por título ou tema..."
            className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas disciplinas</option>
            {subjects.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}
          </select>
          <select
            value={filterTopic}
            onChange={e => setFilterTopic(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos tópicos</option>
            {topics
              .filter(t => !filterSubject || t.subject === filterSubject)
              .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Visible lessons */}
      {visibleLessons.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-primary" />
            Aulas disponíveis ({visibleLessons.length})
          </h3>
          <div className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
            {visibleLessons.map(lesson => {
              const embedUrl = getYouTubeEmbedUrl(lesson.url);
              const topic = topicsMap.get(lesson.topic);
              return (
                <article key={lesson.id} className="bg-card rounded-xl shadow-sm overflow-hidden">
                  {embedUrl ? (
                    <div className="aspect-video">
                      <iframe
                        src={embedUrl}
                        title={lesson.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50">
                      <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        Abrir aula em nova aba ↗
                      </a>
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-foreground">{lesson.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {subjectLabel(lesson.subject)} · {lesson.grade}
                      {topic && ` · ${topic.name}`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Coming soon */}
      {comingSoonLessons.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Em breve ({comingSoonLessons.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comingSoonLessons.map(lesson => {
              const topic = topicsMap.get(lesson.topic);
              return (
                <div key={lesson.id} className="bg-card rounded-xl shadow-sm p-4 border border-dashed border-border opacity-70">
                  <h4 className="text-sm font-medium text-foreground">{lesson.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subjectLabel(lesson.subject)} · {lesson.grade}
                    {topic && ` · ${topic.name}`}
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    ⏳ Em breve
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhuma aula encontrada.</p>
      )}
    </div>
  );
}