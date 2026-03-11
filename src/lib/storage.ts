import { supabase } from '@/integrations/supabase/client';
import type {
  Question, Topic, Lesson, Attempt, NotebookItem,
  Report, TrainingPlan, User, AuthUser, Comment, Reply,
  DashboardMeta, QuestionFilters, CommentStatusType, SubjectItem
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Helper to map profile row -> User ----
function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name ?? '',
    email: row.email ?? '',
    password: row.password ?? '',
    role: row.role,
    status: row.status,
    gradeLevel: row.grade_level,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count ?? 0,
    authUserId: row.auth_user_id ?? null,
    rankingVisible: row.ranking_visible !== false,
    planType: row.plan_type ?? 'free',
    paymentSource: row.payment_source ?? null,
  };
}

// ---- Subjects ----

export async function getSubjects(options: { activeOnly?: boolean } = {}): Promise<SubjectItem[]> {
  let query = supabase.from('subjects').select('*').order('created_at', { ascending: true });
  if (options.activeOnly) query = query.eq('status', 'active');
  const { data } = await query;
  if (!data) return [];
  return (data as any[]).map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createSubject(subject: Partial<SubjectItem>): Promise<SubjectItem> {
  const slug = subject.slug || subject.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
  const row = {
    id: subject.id || `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: subject.name ?? '',
    slug,
    status: subject.status ?? 'active',
  };
  await supabase.from('subjects').insert(row);
  return { ...row, createdAt: new Date().toISOString() } as SubjectItem;
}

export async function updateSubject(id: string, patch: Partial<SubjectItem>): Promise<SubjectItem | null> {
  const update: any = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.slug !== undefined) update.slug = patch.slug;
  if (patch.status !== undefined) update.status = patch.status;
  const { data } = await supabase.from('subjects').update(update).eq('id', id).select().single();
  if (!data) return null;
  const r = data as any;
  return { id: r.id, name: r.name, slug: r.slug, status: r.status, createdAt: r.created_at };
}

export async function deleteSubject(id: string): Promise<void> {
  await supabase.from('subjects').delete().eq('id', id);
}

// ---- User Subject Access ----

export async function getUserSubjectAccess(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_subject_access')
    .select('subject_slug')
    .eq('user_id', userId);
  if (!data) return [];
  return (data as any[]).map(r => r.subject_slug);
}

export async function setUserSubjectAccess(userId: string, slugs: string[]): Promise<void> {
  await supabase.from('user_subject_access').delete().eq('user_id', userId);
  if (slugs.length > 0) {
    const rows = slugs.map(slug => ({ user_id: userId, subject_slug: slug }));
    await supabase.from('user_subject_access').insert(rows);
  }
}

/**
 * Returns subject slugs this student is allowed to see.
 * If no entries in user_subject_access → all active subjects.
 * Otherwise intersection of active subjects & access list.
 */
export async function getAllowedSubjectSlugs(userId: string): Promise<string[]> {
  const [activeSubjects, accessList] = await Promise.all([
    getSubjects({ activeOnly: true }),
    getUserSubjectAccess(userId),
  ]);
  const activeSlugs = activeSubjects.map(s => s.slug);
  if (accessList.length === 0) return activeSlugs;
  return activeSlugs.filter(s => accessList.includes(s));
}

// ---- Users / Profiles ----

export async function loadUsers(): Promise<User[]> {
  const { data } = await supabase.from('profiles').select('*');
  if (!data) return [];
  return data.map(rowToUser);
}

export async function saveUsers(users: User[]): Promise<User[]> {
  return users;
}

export async function upsertUser(userPatch: Partial<User>): Promise<User> {
  const row: any = {
    username: userPatch.username,
    password: userPatch.password ?? '',
    role: userPatch.role ?? 'student',
    status: userPatch.status ?? 'active',
    grade_level: userPatch.gradeLevel ?? null,
    name: userPatch.name ?? '',
    email: userPatch.email ?? '',
  };
  if (userPatch.id) row.id = userPatch.id;
  else row.id = newId('usr');

  const { data } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'username' })
    .select()
    .single();

  return rowToUser(data ?? row);
}

export async function getUsersByRole(role: string): Promise<User[]> {
  const { data } = await supabase.from('profiles').select('*').eq('role', role);
  if (!data) return [];
  return data.map(rowToUser);
}

export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  // Use Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .single();

  if (!profile) return null;
  const row = profile as any;
  if (row.status === 'blocked') {
    await supabase.auth.signOut();
    return null;
  }

  // Update login count
  const newCount = (row.login_count ?? 0) + 1;
  await supabase.from('profiles').update({ last_login_at: nowIso(), login_count: newCount } as any).eq('id', row.id);

  return { id: row.id, username: row.username, email: row.email ?? email, role: row.role, gradeLevel: row.grade_level };
}

export async function getProfileByAuthId(authUserId: string): Promise<AuthUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();
  if (!data) return null;
  const row = data as any;
  return { id: row.id, username: row.username, email: row.email ?? '', role: row.role, gradeLevel: row.grade_level };
}

export async function resetDiagnostic(userId: string): Promise<void> {
  await supabase.from('diagnostic_results').delete().eq('user_id', userId);
}

export async function toggleUserStatus(userId: string): Promise<void> {
  const { data } = await supabase.from('profiles').select('status').eq('id', userId).single();
  if (!data) return;
  const newStatus = (data as any).status === 'active' ? 'blocked' : 'active';
  await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('qb_currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem('qb_currentUser', JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem('qb_currentUser');
  supabase.auth.signOut();
}

// ---- Questions ----

async function loadCommentsForQuestions(questionIds: string[]): Promise<Map<string, Comment[]>> {
  const map = new Map<string, Comment[]>();
  if (!questionIds.length) return map;

  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .in('question_id', questionIds);

  if (!comments || !comments.length) return map;

  const commentIds = comments.map((c: any) => c.id);
  const { data: replies } = await supabase
    .from('replies')
    .select('*')
    .in('comment_id', commentIds);

  const repliesMap = new Map<string, Reply[]>();
  (replies ?? []).forEach((r: any) => {
    const arr = repliesMap.get(r.comment_id) ?? [];
    arr.push({ id: r.id, author: { username: r.author_username, role: r.author_role }, createdAt: r.created_at, text: r.text });
    repliesMap.set(r.comment_id, arr);
  });

  comments.forEach((c: any) => {
    const arr = map.get(c.question_id) ?? [];
    arr.push({
      id: c.id,
      author: { username: c.author_username, role: c.author_role },
      createdAt: c.created_at,
      text: c.text,
      status: c.status as CommentStatusType,
      replies: repliesMap.get(c.id) ?? [],
    });
    map.set(c.question_id, arr);
  });

  return map;
}

// Simple in-memory cache for question bank
let _questionCache: { data: Question[]; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

export async function loadQuestionBank(options: { withComments?: boolean; forceRefresh?: boolean } = {}): Promise<Question[]> {
  const { withComments = false, forceRefresh = false } = options;

  // Use cache for reads without comments
  if (!withComments && !forceRefresh && _questionCache && Date.now() - _questionCache.ts < CACHE_TTL) {
    return _questionCache.data;
  }

  const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
  if (!data) return [];

  let commentsMap = new Map<string, Comment[]>();
  if (withComments) {
    const questionIds = data.map((q: any) => q.id);
    commentsMap = await loadCommentsForQuestions(questionIds);
  }

  const result = data.map((row: any) => ({
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    difficulty: row.difficulty,
    topicId: row.topic_id ?? '',
    statement: row.statement,
    options: Array.isArray(row.options) ? row.options : JSON.parse(row.options ?? '[]'),
    correctIndex: row.correct_index,
    explanation: row.explanation,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: commentsMap.get(row.id) ?? [],
    imageUrl: row.image_url ?? null,
    imageAlt: row.image_alt ?? null,
  }));

  if (!withComments) {
    _questionCache = { data: result, ts: Date.now() };
  }

  return result;
}

export function invalidateQuestionCache() {
  _questionCache = null;
}

export async function saveQuestionBank(bank: Question[]): Promise<Question[]> {
  const rows = bank.map(q => ({
    id: q.id,
    grade: q.grade,
    subject: q.subject,
    difficulty: q.difficulty,
    topic_id: q.topicId || null,
    statement: q.statement,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    status: q.status,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    image_url: q.imageUrl ?? null,
    image_alt: q.imageAlt ?? null,
  }));

  await supabase.from('questions').upsert(rows);
  invalidateQuestionCache();
  return bank;
}

export async function saveQuestionsBulk(questions: Partial<Question>[]): Promise<Question[]> {
  const rows = (Array.isArray(questions) ? questions : []).map(q => ({
    id: q.id ?? newId('q'),
    grade: q.grade ?? '7EF',
    subject: q.subject ?? 'math',
    difficulty: q.difficulty ?? 'easy',
    topic_id: q.topicId || null,
    statement: q.statement ?? '',
    options: q.options ?? [],
    correct_index: q.correctIndex ?? 0,
    explanation: q.explanation ?? '',
    status: q.status ?? 'published',
    created_at: q.createdAt ?? nowIso(),
    updated_at: q.updatedAt ?? nowIso(),
    image_url: q.imageUrl ?? null,
    image_alt: q.imageAlt ?? null,
  }));

  const { data } = await supabase.from('questions').upsert(rows).select();
  invalidateQuestionCache();
  return (data ?? []).map((row: any) => ({
    id: row.id, grade: row.grade, subject: row.subject, difficulty: row.difficulty,
    topicId: row.topic_id ?? '', statement: row.statement,
    options: Array.isArray(row.options) ? row.options : JSON.parse(row.options ?? '[]'),
    correctIndex: row.correct_index, explanation: row.explanation, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, comments: [],
    imageUrl: row.image_url ?? null, imageAlt: row.image_alt ?? null,
  }));
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const { data } = await supabase.from('questions').select('*').eq('id', id).single();
  if (!data) return null;
  const row = data as any;
  const commentsMap = await loadCommentsForQuestions([row.id]);
  return {
    id: row.id, grade: row.grade, subject: row.subject, difficulty: row.difficulty,
    topicId: row.topic_id ?? '', statement: row.statement,
    options: Array.isArray(row.options) ? row.options : JSON.parse(row.options ?? '[]'),
    correctIndex: row.correct_index, explanation: row.explanation, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
    comments: commentsMap.get(row.id) ?? [],
    imageUrl: row.image_url ?? null, imageAlt: row.image_alt ?? null,
  };
}

export async function deleteQuestion(id: string): Promise<void> {
  await supabase.from('questions').delete().eq('id', id);
  invalidateQuestionCache();
}

// ---- Topics ----

export async function getTopics(options: { activeOnly?: boolean } = {}): Promise<Topic[]> {
  let query = supabase.from('topics').select('*');
  if (options.activeOnly) query = query.eq('status', 'active');
  const { data } = await query;
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id, name: row.name, label: row.label,
    subject: row.subject, grade: row.grade, status: row.status,
  }));
}

export async function saveTopicsBank(topics: Topic[]): Promise<void> {
  await supabase.from('topics').upsert(topics.map(t => ({
    id: t.id, name: t.name, label: t.label ?? t.name,
    subject: t.subject, grade: t.grade, status: t.status,
  })));
}

export async function createTopic(topic: Partial<Topic>): Promise<Topic> {
  const row = {
    id: topic.id ?? newId('topic'),
    name: topic.name ?? '',
    label: topic.label ?? topic.name ?? '',
    subject: topic.subject ?? '',
    grade: topic.grade ?? 'all',
    status: topic.status ?? 'active',
  };
  await supabase.from('topics').insert(row);
  return row as Topic;
}

export async function updateTopic(id: string, patch: Partial<Topic>): Promise<Topic | null> {
  const update: any = {};
  if (patch.name !== undefined) { update.name = patch.name; update.label = patch.name; }
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.grade !== undefined) update.grade = patch.grade;
  if (patch.status !== undefined) update.status = patch.status;

  const { data } = await supabase.from('topics').update(update).eq('id', id).select().single();
  if (!data) return null;
  const row = data as any;
  return { id: row.id, name: row.name, label: row.label, subject: row.subject, grade: row.grade, status: row.status };
}

export async function toggleTopicStatus(id: string): Promise<Topic | null> {
  const { data: current } = await supabase.from('topics').select('status').eq('id', id).single();
  if (!current) return null;
  const newStatus = (current as any).status === 'active' ? 'inactive' : 'active';
  return updateTopic(id, { status: newStatus as any });
}

export async function deleteTopic(id: string): Promise<void> {
  await supabase.from('topics').delete().eq('id', id);
}

// ---- Comments ----

export async function addComment(questionId: string, comment: Partial<Comment>): Promise<Comment | null> {
  const row = {
    id: newId('cmt'),
    question_id: questionId,
    author_username: comment.author?.username ?? 'anônimo',
    author_role: comment.author?.role ?? 'student',
    text: comment.text ?? '',
    status: 'open',
  };
  const { data } = await supabase.from('comments').insert(row).select().single();
  if (!data) return null;
  const d = data as any;
  return {
    id: d.id, author: { username: d.author_username, role: d.author_role },
    createdAt: d.created_at, text: d.text, status: d.status, replies: [],
  };
}

export async function addReply(questionId: string, commentId: string, reply: Partial<Reply>): Promise<Comment | null> {
  const row = {
    id: newId('rep'),
    comment_id: commentId,
    author_username: reply.author?.username ?? 'admin',
    author_role: reply.author?.role ?? 'admin',
    text: reply.text ?? '',
  };
  await supabase.from('replies').insert(row);
  await supabase.from('comments').update({ status: 'answered' }).eq('id', commentId);

  const { data: c } = await supabase.from('comments').select('*').eq('id', commentId).single();
  if (!c) return null;
  const cd = c as any;
  const { data: replies } = await supabase.from('replies').select('*').eq('comment_id', commentId);
  return {
    id: cd.id, author: { username: cd.author_username, role: cd.author_role },
    createdAt: cd.created_at, text: cd.text, status: cd.status,
    replies: (replies ?? []).map((r: any) => ({
      id: r.id, author: { username: r.author_username, role: r.author_role },
      createdAt: r.created_at, text: r.text,
    })),
  };
}

export async function setCommentStatus(questionId: string, commentId: string, status: CommentStatusType): Promise<Comment | null> {
  await supabase.from('comments').update({ status }).eq('id', commentId);
  return null;
}

// ---- Attempts ----

export async function getAttempts(userId?: string): Promise<Attempt[]> {
  let query = supabase.from('attempts').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query;
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id, userId: row.user_id, questionId: row.question_id,
    selectedIndex: row.selected_index, isCorrect: row.is_correct,
    answeredAt: row.answered_at,
  }));
}

export async function addAttempt(attempt: Partial<Attempt> & { topicId?: string }): Promise<Attempt> {
  const row: any = {
    user_id: attempt.userId ?? '',
    question_id: attempt.questionId ?? '',
    selected_index: attempt.selectedIndex ?? -1,
    is_correct: attempt.isCorrect ?? false,
    answered_at: attempt.answeredAt ?? nowIso(),
    topic_id: attempt.topicId ?? null,
  };
  const { data } = await supabase.from('attempts').insert(row).select().single();
  const d = (data ?? row) as any;

  await updateUserStreak(attempt.userId ?? '', attempt.answeredAt);

  return {
    id: d.id ?? Date.now(), userId: d.user_id, questionId: d.question_id,
    selectedIndex: d.selected_index, isCorrect: d.is_correct, answeredAt: d.answered_at,
  };
}

// ---- Notebook ----

export async function getNotebook(userId?: string): Promise<NotebookItem[]> {
  let query = supabase.from('notebook_items').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query;
  if (!data) return [];
  return data.map((row: any) => ({
    userId: row.user_id, questionId: row.question_id,
    grade: row.grade, subject: row.subject, difficulty: row.difficulty, topicId: row.topic_id,
    status: row.status, whatIErred: row.what_i_erred, ruleInsight: row.rule_insight,
    updatedAt: row.updated_at,
  }));
}

export async function upsertNotebookItem(userId: string, questionId: string, patch: Partial<NotebookItem> = {}): Promise<NotebookItem> {
  const { data: q } = await supabase.from('questions').select('grade, subject, difficulty, topic_id').eq('id', questionId).single();
  const qMeta = q ? { grade: (q as any).grade, subject: (q as any).subject, difficulty: (q as any).difficulty, topic_id: (q as any).topic_id } : {};

  const row: any = {
    user_id: userId,
    question_id: questionId,
    grade: patch.grade ?? qMeta.grade ?? null,
    subject: patch.subject ?? qMeta.subject ?? null,
    difficulty: patch.difficulty ?? qMeta.difficulty ?? null,
    topic_id: patch.topicId ?? qMeta.topic_id ?? null,
    status: patch.status ?? 'pending',
    what_i_erred: patch.whatIErred ?? '',
    rule_insight: patch.ruleInsight ?? '',
    updated_at: nowIso(),
  };

  const { data } = await supabase
    .from('notebook_items')
    .upsert(row, { onConflict: 'user_id,question_id' })
    .select()
    .single();

  const d = (data ?? row) as any;
  return {
    userId: d.user_id, questionId: d.question_id,
    grade: d.grade, subject: d.subject, difficulty: d.difficulty, topicId: d.topic_id,
    status: d.status, whatIErred: d.what_i_erred, ruleInsight: d.rule_insight,
    updatedAt: d.updated_at,
  };
}

// ---- Reports ----

export async function getReports(): Promise<Report[]> {
  const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id, questionId: row.question_id,
    questionMeta: row.question_meta ?? { grade: '', subject: '', topic: '', difficulty: '', preview: '' },
    type: row.type, message: row.message, createdAt: row.created_at,
    createdBy: row.created_by ?? { username: '', role: 'student' },
    status: row.status, adminNote: row.admin_note,
    resolvedAt: row.resolved_at, resolvedBy: row.resolved_by,
  }));
}

export async function addReport(report: Partial<Report>): Promise<Report> {
  const row = {
    id: newId('rep'),
    question_id: report.questionId ?? '',
    question_meta: report.questionMeta ?? {},
    type: report.type ?? 'outro',
    message: report.message ?? '',
    created_by: report.createdBy ?? { username: '', role: 'student' },
    status: 'open',
    admin_note: '',
  };
  await supabase.from('reports').insert(row);
  return {
    id: row.id, questionId: row.question_id, questionMeta: row.question_meta as any,
    type: row.type, message: row.message, createdAt: nowIso(),
    createdBy: row.created_by as any, status: 'open', adminNote: '',
    resolvedAt: null, resolvedBy: null,
  };
}

export async function updateReport(reportId: string, patch: Partial<Report>): Promise<Report | null> {
  const update: any = {};
  if (patch.status) update.status = patch.status;
  if (patch.adminNote !== undefined) update.admin_note = patch.adminNote;
  if (patch.resolvedAt !== undefined) update.resolved_at = patch.resolvedAt;
  if (patch.resolvedBy !== undefined) update.resolved_by = patch.resolvedBy;

  await supabase.from('reports').update(update).eq('id', reportId);
  return null;
}

export async function setReportStatus(reportId: string, status: string, adminNote = '', resolvedBy: { username: string; role: string } | null = null): Promise<Report | null> {
  const update: any = { status, admin_note: adminNote };
  if (status === 'resolved' || status === 'ignored') {
    update.resolved_at = nowIso();
    update.resolved_by = resolvedBy;
  }
  if (status === 'open') {
    update.resolved_at = null;
    update.resolved_by = null;
  }
  await supabase.from('reports').update(update).eq('id', reportId);
  return null;
}

// ---- Training Plans ----

export async function getTrainingPlans(userId: string): Promise<TrainingPlan[]> {
  const { data } = await supabase.from('training_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id, createdAt: row.created_at, topic: row.topic,
    qty: row.qty, distribution: row.distribution ?? { easy: 0, medium: 0, hard: 0 },
    questionIds: row.question_ids ?? [],
  }));
}

export async function addTrainingPlan(userId: string, plan: Partial<TrainingPlan>): Promise<TrainingPlan> {
  const row = {
    id: plan.id ?? newId('tp'),
    user_id: userId,
    topic: plan.topic ?? '',
    qty: plan.qty ?? 0,
    distribution: plan.distribution ?? { easy: 0, medium: 0, hard: 0 },
    question_ids: plan.questionIds ?? [],
  };
  await supabase.from('training_plans').insert(row);
  return {
    id: row.id, createdAt: nowIso(), topic: row.topic,
    qty: row.qty, distribution: row.distribution, questionIds: row.question_ids,
  };
}

export async function getTrainingPlanById(planId: string): Promise<(TrainingPlan & { userId: string }) | null> {
  const { data } = await supabase.from('training_plans').select('*').eq('id', planId).single();
  if (!data) return null;
  const row = data as any;
  return {
    userId: row.user_id, id: row.id, createdAt: row.created_at, topic: row.topic,
    qty: row.qty, distribution: row.distribution, questionIds: row.question_ids,
  };
}

// ---- Lessons ----

export async function getLessons(options: { visibleOnly?: boolean } = {}): Promise<Lesson[]> {
  let query = supabase.from('lessons').select('*');
  if (options.visibleOnly) query = query.eq('visibility', 'visible');
  const { data } = await query;
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id, title: row.title, url: row.url,
    topic: row.topic, subject: row.subject, grade: row.grade,
    visibility: row.visibility ?? 'coming_soon',
  }));
}

export async function saveLessons(lessons: Lesson[]): Promise<Lesson[]> {
  await supabase.from('lessons').upsert(lessons.map(l => ({
    id: l.id, title: l.title, url: l.url,
    topic: l.topic, subject: l.subject, grade: l.grade,
  })));
  return lessons;
}

export async function saveLesson(lesson: Partial<Lesson>): Promise<Lesson> {
  const row = {
    id: lesson.id ?? newId('lesson'),
    title: lesson.title ?? '',
    url: lesson.url ?? '',
    topic: lesson.topic ?? '',
    subject: lesson.subject ?? '',
    grade: lesson.grade ?? '',
  };
  await supabase.from('lessons').insert(row);
  return row as Lesson;
}

export async function updateLesson(lessonId: string, patch: Partial<Lesson>): Promise<Lesson | null> {
  const update: any = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.url !== undefined) update.url = patch.url;
  if (patch.topic !== undefined) update.topic = patch.topic;
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.grade !== undefined) update.grade = patch.grade;

  const { data } = await supabase.from('lessons').update(update).eq('id', lessonId).select().single();
  if (!data) return null;
  const row = data as any;
  return { id: row.id, title: row.title, url: row.url, topic: row.topic, subject: row.subject, grade: row.grade };
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await supabase.from('lessons').delete().eq('id', lessonId);
}

// ---- Dashboard Meta ----

function toDateOnly(value: string | null): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function dayDiff(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const f = new Date(`${from}T00:00:00.000Z`).getTime();
  const t = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((t - f) / 86400000);
}

async function updateUserStreak(userId: string, answeredAt?: string): Promise<void> {
  if (!userId) return;
  const { data: existing } = await supabase.from('dashboard_meta').select('*').eq('user_id', userId).maybeSingle();

  const current = existing
    ? { streak: (existing as any).streak ?? 0, lastAttemptDate: (existing as any).last_attempt_date }
    : { streak: 0, lastAttemptDate: null };

  const today = toDateOnly(answeredAt ?? nowIso());
  const last = toDateOnly(current.lastAttemptDate);
  if (!today) return;

  const diff = dayDiff(last, today);
  let newStreak = current.streak;
  if (diff === 0) {
    // same day, no change
  } else if (diff === 1) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  await supabase.from('dashboard_meta').upsert({
    user_id: userId,
    streak: newStreak,
    last_attempt_date: today,
    last_filters: existing ? (existing as any).last_filters : { grade: '', subject: '', difficulty: '', topicId: '', search: '' },
  } as any);
}

export async function getStudentDashboardMeta(userId: string): Promise<DashboardMeta> {
  const empty: DashboardMeta = { streak: 0, lastAttemptDate: null, lastFilters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' } };
  if (!userId) return empty;
  const { data } = await supabase.from('dashboard_meta').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return empty;
  const row = data as any;
  return {
    streak: row.streak ?? 0,
    lastAttemptDate: row.last_attempt_date,
    lastFilters: row.last_filters ?? empty.lastFilters,
  };
}

export async function saveStudentDashboardMeta(userId: string, patch: Partial<DashboardMeta> = {}): Promise<DashboardMeta> {
  const current = await getStudentDashboardMeta(userId);
  const next: DashboardMeta = {
    streak: patch.streak ?? current.streak,
    lastAttemptDate: patch.lastAttemptDate ?? current.lastAttemptDate,
    lastFilters: patch.lastFilters ?? current.lastFilters,
  };

  await supabase.from('dashboard_meta').upsert({
    user_id: userId,
    streak: next.streak,
    last_attempt_date: next.lastAttemptDate,
    last_filters: next.lastFilters as any,
  } as any);

  return next;
}

// ---- App Settings ----

export async function getAppSetting(key: string): Promise<string> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return '';
  const val = (data as any).value;
  return typeof val === 'string' ? val : JSON.stringify(val);
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await supabase.from('app_settings').upsert({ key, value: JSON.stringify(value) as any, updated_at: nowIso() } as any);
}

export async function getAllAppSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('*');
  if (!data) return {};
  const result: Record<string, string> = {};
  (data as any[]).forEach(row => {
    const val = row.value;
    result[row.key] = typeof val === 'string' ? val : JSON.stringify(val);
  });
  return result;
}

// ---- Ranking (optimized with RPC) ----

export async function getRanking(): Promise<{ userId: string; username: string; total: number; correct: number; rate: number; streak: number }[]> {
  const { data, error } = await supabase.rpc('get_ranking');
  if (error || !data) {
    // Fallback to old method if RPC fails
    const [attempts, users, metas] = await Promise.all([
      getAttempts(),
      loadUsers(),
      supabase.from('dashboard_meta').select('*'),
    ]);
    const userMap = new Map(users.map(u => [u.username, u]));
    const streakMap = new Map<string, number>();
    ((metas.data ?? []) as any[]).forEach(m => streakMap.set(m.user_id, m.streak ?? 0));
    const agg = new Map<string, { total: number; correct: number }>();
    attempts.forEach(a => {
      const prev = agg.get(a.userId) ?? { total: 0, correct: 0 };
      prev.total += 1;
      if (a.isCorrect) prev.correct += 1;
      agg.set(a.userId, prev);
    });
    return [...agg.entries()]
      .filter(([uid]) => userMap.has(uid) && userMap.get(uid)!.role === 'student' && userMap.get(uid)!.rankingVisible !== false)
      .map(([uid, stats]) => ({
        userId: uid, username: uid,
        total: stats.total, correct: stats.correct,
        rate: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
        streak: streakMap.get(uid) ?? 0,
      }))
      .sort((a, b) => b.correct - a.correct || b.rate - a.rate || b.streak - a.streak);
  }

  return (data as any[]).map(r => ({
    userId: r.user_id,
    username: r.username,
    total: Number(r.total),
    correct: Number(r.correct),
    rate: r.rate,
    streak: r.streak,
  }));
}

// ---- Diagnostic ----

export async function getDiagnosticResult(userId: string): Promise<any | null> {
  const { data } = await supabase.from('diagnostic_results').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  return data;
}

export async function saveDiagnosticResult(userId: string, result: any): Promise<void> {
  await supabase.from('diagnostic_results').upsert({
    user_id: userId,
    completed_at: nowIso(),
    total_questions: result.totalQuestions,
    correct_answers: result.correctAnswers,
    accuracy_rate: result.accuracyRate,
    topic_breakdown: result.topicBreakdown,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    recommended_plan: result.recommendedPlan,
  } as any);
}

export async function getAllDiagnosticResults(): Promise<any[]> {
  const { data } = await supabase.from('diagnostic_results').select('*').order('completed_at', { ascending: false });
  return (data ?? []) as any[];
}

// ---- Init (no-op with DB) ----

export async function initStorageFromSeeds(): Promise<void> {
  // Data is already in the database, no seeding needed
}

export async function resetToSeed(): Promise<void> {
  // no-op
}
