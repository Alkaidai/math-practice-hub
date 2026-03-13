import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getLessons, getTopics, getAllowedSubjectSlugs } from '../../lib/storage';
import { subjectLabel } from '../../lib/ui-utils';
import { LoadingState, ScreenErrorState, EmptyState } from './ScreenStates';
import { useLoadWithTimeout } from '../../hooks/useLoadWithTimeout';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { Search, PlayCircle, Clock, ExternalLink } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const { error: loadError, execute } = useLoadWithTimeout();
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTopic, setFilterTopic] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try { await execute(async () => {
      const [allLessons, allTopics, allowedSlugs] = await Promise.all([
        getLessons(),
        getTopics({ activeOnly: true }),
        getAllowedSubjectSlugs(userId),
      ]);
      setLessons(allLessons.filter(l => allowedSlugs.includes(l.subject)));
      setTopics(allTopics.filter(t => allowedSlugs.includes(t.subject)));
    });
    } finally { setLoading(false); }
  }, [userId, execute]);

  useEffect(() => { loadData(); }, [loadData]);
  useVisibilityRefresh(loadData);

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

  if (loading) return <LoadingState message="Carregando aulas..." />;
  if (loadError) return <ScreenErrorState error={loadError} onRetry={loadData} />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3 border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar aulas por título ou tema..."
            className="w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2.5 text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
            className="rounded-xl border border-input bg-background px-3 py-2.5 text-body focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas disciplinas</option>
            {subjects.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}
          </select>
          <select
            value={filterTopic}
            onChange={e => setFilterTopic(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2.5 text-body focus:ring-2 focus:ring-primary/30"
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
          <h3 className="text-body font-semibold text-foreground flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-primary" />
            Aulas disponíveis ({visibleLessons.length})
          </h3>
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-4 pr-1">
            {visibleLessons.map(lesson => {
              const embedUrl = getYouTubeEmbedUrl(lesson.url);
              const topic = topicsMap.get(lesson.topic);
              return (
                <article key={lesson.id} className="bg-card rounded-xl shadow-sm overflow-hidden border border-border hover:shadow-md transition-shadow">
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
                    <div className="p-4 bg-muted/50 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-primary" />
                      <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="text-body text-primary hover:underline font-medium">
                        Abrir aula em nova aba
                      </a>
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="text-body font-medium text-foreground">{lesson.title}</h4>
                    <p className="text-caption text-muted-foreground mt-1">
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
          <h3 className="text-body font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Em breve ({comingSoonLessons.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comingSoonLessons.map(lesson => {
              const topic = topicsMap.get(lesson.topic);
              return (
                <div key={lesson.id} className="bg-card rounded-xl shadow-sm p-4 border border-dashed border-border opacity-70">
                  <h4 className="text-body font-medium text-foreground">{lesson.title}</h4>
                  <p className="text-caption text-muted-foreground mt-1">
                    {subjectLabel(lesson.subject)} · {lesson.grade}
                    {topic && ` · ${topic.name}`}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2 text-overline text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" /> Em breve
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
          <PlayCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-body text-muted-foreground">Nenhuma aula encontrada.</p>
        </div>
      )}
    </div>
  );
}
