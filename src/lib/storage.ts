import { STORAGE_KEYS, SEED_VERSION, SEED_USERS, GRADES } from './constants';
import type {
  Question, Topic, Lesson, Attempt, NotebookItem,
  Report, TrainingPlan, User, AuthUser, Comment, Reply,
  DashboardMeta, QuestionFilters, CommentStatusType
} from './types';
import questionsSeed from '../data/questions.seed.json';
import topicsSeed from '../data/topics.seed.json';
import lessonsSeed from '../data/lessons.seed.json';

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeReply(reply: Partial<Reply>): Reply {
  return {
    id: reply?.id ?? newId('rep'),
    author: { username: reply?.author?.username ?? 'admin', role: reply?.author?.role ?? 'admin' },
    createdAt: reply?.createdAt ?? nowIso(),
    text: String(reply?.text ?? '').trim(),
  };
}

function normalizeComment(comment: Partial<Comment>): Comment {
  return {
    id: comment?.id ?? newId('cmt'),
    author: { username: comment?.author?.username ?? 'anônimo', role: comment?.author?.role ?? 'student' },
    createdAt: comment?.createdAt ?? nowIso(),
    text: String(comment?.text ?? '').trim(),
    status: (['open', 'answered', 'hidden'] as CommentStatusType[]).includes(comment?.status as CommentStatusType)
      ? comment!.status as CommentStatusType
      : 'open',
    replies: Array.isArray(comment?.replies)
      ? comment!.replies.map(normalizeReply).filter(r => r.text)
      : [],
  };
}

function normalizeQuestion(question: Partial<Question>): Question {
  const createdAt = question?.createdAt ?? nowIso();
  return {
    id: String(question?.id ?? newId('q')),
    grade: question?.grade ?? '7EF',
    subject: question?.subject ?? 'math',
    difficulty: question?.difficulty ?? 'easy',
    topicId: question?.topicId ?? '',
    statement: String(question?.statement ?? '').trim(),
    options: Array.isArray(question?.options)
      ? question!.options.map(o => String(o ?? '').trim()).filter(Boolean)
      : [],
    correctIndex: Number.isInteger(question?.correctIndex) ? question!.correctIndex : 0,
    explanation: String(question?.explanation ?? '').trim(),
    status: question?.status === 'draft' ? 'draft' : 'published',
    createdAt,
    updatedAt: question?.updatedAt ?? createdAt,
    comments: Array.isArray(question?.comments) ? question!.comments.map(normalizeComment).filter(c => c.text) : [],
  };
}

function normalizeUser(user: Partial<User>): User {
  return {
    id: String(user?.id ?? newId('usr')),
    username: String(user?.username ?? '').trim(),
    password: String(user?.password ?? ''),
    role: user?.role === 'admin' ? 'admin' : 'student',
    status: user?.status === 'blocked' ? 'blocked' : 'active',
    gradeLevel: GRADES.includes(user?.gradeLevel as any) ? user!.gradeLevel! : null,
    createdAt: user?.createdAt ?? nowIso(),
    lastLoginAt: user?.lastLoginAt ?? null,
  };
}

function normalizeTopic(topic: any): Topic {
  const name = String(topic?.name ?? topic?.label ?? topic?.id ?? '').trim();
  const gradeFromLegacy = Array.isArray(topic?.grades) && topic.grades.length === 1 ? String(topic.grades[0]) : 'all';
  const grade = String(topic?.grade ?? gradeFromLegacy ?? 'all').trim() || 'all';
  return {
    id: String(topic?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')).trim(),
    name,
    label: name,
    subject: String(topic?.subject ?? '').trim(),
    grade,
    status: topic?.status === 'inactive' ? 'inactive' : 'active',
  };
}

function normalizeLesson(lesson: Partial<Lesson>): Lesson {
  return {
    id: String(lesson?.id ?? newId('lesson')),
    title: String(lesson?.title ?? '').trim(),
    url: String(lesson?.url ?? '').trim(),
    topic: String(lesson?.topic ?? '').trim(),
    subject: String(lesson?.subject ?? '').trim(),
    grade: String(lesson?.grade ?? '').trim(),
  };
}

function normalizeAttempt(attempt: Partial<Attempt>): Attempt {
  return {
    id: attempt?.id ?? Date.now(),
    userId: String(attempt?.userId ?? ''),
    questionId: String(attempt?.questionId ?? ''),
    selectedIndex: Number(attempt?.selectedIndex ?? -1),
    isCorrect: Boolean(attempt?.isCorrect),
    answeredAt: attempt?.answeredAt ?? nowIso(),
  };
}

function normalizeNotebookItem(item: Partial<NotebookItem>): NotebookItem {
  return {
    userId: String(item?.userId ?? ''),
    questionId: String(item?.questionId ?? ''),
    grade: item?.grade ? String(item.grade) : null,
    subject: item?.subject ? String(item.subject) : null,
    difficulty: item?.difficulty ? String(item.difficulty) : null,
    topicId: item?.topicId ? String(item.topicId) : null,
    status: item?.status === 'mastered' ? 'mastered' : 'pending',
    whatIErred: String(item?.whatIErred ?? ''),
    ruleInsight: String(item?.ruleInsight ?? ''),
    updatedAt: item?.updatedAt ?? nowIso(),
  };
}

function normalizeTrainingPlan(plan: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: String(plan?.id ?? newId('tp')),
    createdAt: plan?.createdAt ?? nowIso(),
    topic: String(plan?.topic ?? ''),
    qty: Number(plan?.qty ?? 0),
    distribution: {
      easy: Number(plan?.distribution?.easy ?? 0),
      medium: Number(plan?.distribution?.medium ?? 0),
      hard: Number(plan?.distribution?.hard ?? 0),
    },
    questionIds: Array.isArray(plan?.questionIds) ? plan!.questionIds.map(String) : [],
  };
}

function normalizeDashboardFilters(filters: Partial<QuestionFilters> = {}): QuestionFilters {
  return {
    grade: String(filters.grade ?? ''),
    subject: String(filters.subject ?? ''),
    difficulty: String(filters.difficulty ?? ''),
    topicId: String(filters.topicId ?? ''),
    search: String(filters.search ?? ''),
  };
}

function normalizeDashboardMeta(meta: Partial<DashboardMeta> = {}): DashboardMeta {
  return {
    streak: Number.isFinite(Number(meta.streak)) ? Math.max(0, Number(meta.streak)) : 0,
    lastAttemptDate: meta.lastAttemptDate ? String(meta.lastAttemptDate) : null,
    lastFilters: normalizeDashboardFilters(meta.lastFilters),
  };
}

// ---- Users ----

function ensureUsersSeeded(): void {
  const stored = parseJson<User[] | null>(localStorage.getItem(STORAGE_KEYS.users), null);
  if (Array.isArray(stored) && stored.length) return;
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(SEED_USERS.map(normalizeUser)));
}

export function loadUsers(): User[] {
  ensureUsersSeeded();
  const stored = parseJson<User[]>(localStorage.getItem(STORAGE_KEYS.users), []);
  return Array.isArray(stored) ? stored.map(normalizeUser).filter(u => u.username) : [];
}

export function saveUsers(users: User[]): User[] {
  const normalized = Array.isArray(users) ? users.map(normalizeUser).filter(u => u.username) : [];
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(normalized));
  return normalized;
}

export function upsertUser(userPatch: Partial<User>): User {
  const all = loadUsers();
  const index = all.findIndex(u => u.id === userPatch?.id || u.username === userPatch?.username);
  const merged = normalizeUser({ ...(index >= 0 ? all[index] : {}), ...userPatch });
  if (index >= 0) all[index] = merged;
  else all.push(merged);
  saveUsers(all);
  return merged;
}

export function getUsersByRole(role: string): User[] {
  return loadUsers().filter(u => u.role === role);
}

export function authenticate(username: string, password: string): AuthUser | null {
  const users = loadUsers();
  const found = users.find(u => u.username === username && u.password === password);
  if (!found || found.status === 'blocked') return null;
  found.lastLoginAt = nowIso();
  saveUsers(users);
  return { id: found.id, username: found.username, role: found.role, gradeLevel: found.gradeLevel };
}

export function getCurrentUser(): AuthUser | null {
  return parseJson<AuthUser | null>(localStorage.getItem(STORAGE_KEYS.currentUser), null);
}

export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

// ---- Questions ----

export function loadQuestionBank(): Question[] {
  const stored = parseJson<Question[]>(localStorage.getItem(STORAGE_KEYS.questionBank), []);
  return Array.isArray(stored) ? stored.map(normalizeQuestion) : [];
}

export function saveQuestionBank(bank: Question[]): Question[] {
  const normalized = Array.isArray(bank) ? bank.map(normalizeQuestion) : [];
  localStorage.setItem(STORAGE_KEYS.questionBank, JSON.stringify(normalized));
  return normalized;
}

export function saveQuestionsBulk(questions: Partial<Question>[]): Question[] {
  const current = loadQuestionBank();
  const usedIds = new Set(current.map(q => q.id));
  const normalized = (Array.isArray(questions) ? questions : []).map(q => {
    let id = String(q?.id ?? newId('q'));
    while (usedIds.has(id)) id = newId('q');
    usedIds.add(id);
    return { ...q, id } as Partial<Question>;
  });
  return saveQuestionBank([...normalized.map(normalizeQuestion), ...current]);
}

export function getQuestionById(id: string): Question | null {
  return loadQuestionBank().find(q => q.id === id) ?? null;
}

// ---- Topics ----

export function getTopics(options: { activeOnly?: boolean } = {}): Topic[] {
  const stored = parseJson<Topic[]>(localStorage.getItem(STORAGE_KEYS.topicsBank), []);
  const list = Array.isArray(stored) ? stored.map(normalizeTopic).filter(t => t.id && t.name) : [];
  if (options.activeOnly) return list.filter(t => t.status === 'active');
  return list;
}

export function saveTopicsBank(topics: Topic[]): void {
  const normalized = Array.isArray(topics) ? topics.map(normalizeTopic).filter(t => t.id && t.name) : [];
  localStorage.setItem(STORAGE_KEYS.topicsBank, JSON.stringify(normalized));
}

export function createTopic(topic: Partial<Topic>): Topic {
  const all = getTopics();
  const normalized = normalizeTopic(topic);
  all.push(normalized);
  saveTopicsBank(all);
  return normalized;
}

export function updateTopic(id: string, patch: Partial<Topic>): Topic | null {
  const all = getTopics();
  const index = all.findIndex(t => t.id === id);
  if (index < 0) return null;
  const updated = normalizeTopic({ ...all[index], ...patch, id });
  all[index] = updated;
  saveTopicsBank(all);
  return updated;
}

export function toggleTopicStatus(id: string): Topic | null {
  const topic = getTopics().find(t => t.id === id);
  if (!topic) return null;
  return updateTopic(id, { status: topic.status === 'active' ? 'inactive' : 'active' });
}

export function deleteTopic(id: string): void {
  saveTopicsBank(getTopics().filter(t => t.id !== id));
}

// ---- Comments ----

export function addComment(questionId: string, comment: Partial<Comment>): Comment | null {
  const bank = loadQuestionBank();
  const qIndex = bank.findIndex(q => q.id === questionId);
  if (qIndex < 0) return null;
  const normalized = normalizeComment(comment);
  bank[qIndex].comments = [...(bank[qIndex].comments ?? []), normalized];
  bank[qIndex].updatedAt = nowIso();
  saveQuestionBank(bank);
  return normalized;
}

export function addReply(questionId: string, commentId: string, reply: Partial<Reply>): Comment | null {
  const bank = loadQuestionBank();
  const question = bank.find(q => q.id === questionId);
  if (!question) return null;
  const comment = question.comments.find(c => c.id === commentId);
  if (!comment) return null;
  comment.replies.push(normalizeReply(reply));
  comment.status = 'answered';
  question.updatedAt = nowIso();
  saveQuestionBank(bank);
  return comment;
}

export function setCommentStatus(questionId: string, commentId: string, status: CommentStatusType): Comment | null {
  const bank = loadQuestionBank();
  const question = bank.find(q => q.id === questionId);
  if (!question) return null;
  const comment = question.comments.find(c => c.id === commentId);
  if (!comment) return null;
  comment.status = status;
  question.updatedAt = nowIso();
  saveQuestionBank(bank);
  return comment;
}

// ---- Attempts ----

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

function updateUserStreak(userId: string, answeredAt?: string): void {
  if (!userId) return;
  const map = parseJson<Record<string, DashboardMeta>>(localStorage.getItem(STORAGE_KEYS.dashboardMeta), {});
  const current = normalizeDashboardMeta(map[userId]);
  const today = toDateOnly(answeredAt ?? nowIso());
  const last = toDateOnly(current.lastAttemptDate);
  if (!today) return;
  const diff = dayDiff(last, today);
  if (diff === 0) {
    current.lastAttemptDate = today;
  } else if (diff === 1) {
    current.streak += 1;
    current.lastAttemptDate = today;
  } else {
    current.streak = 1;
    current.lastAttemptDate = today;
  }
  map[userId] = current;
  localStorage.setItem(STORAGE_KEYS.dashboardMeta, JSON.stringify(map));
}

export function getAttempts(userId?: string): Attempt[] {
  const stored = parseJson<Attempt[]>(localStorage.getItem(STORAGE_KEYS.attempts), []);
  const list = Array.isArray(stored) ? stored.map(normalizeAttempt) : [];
  if (!userId) return list;
  return list.filter(a => a.userId === userId);
}

export function addAttempt(attempt: Partial<Attempt>): Attempt {
  const list = getAttempts();
  const normalized = normalizeAttempt(attempt);
  list.push(normalized);
  localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(list));
  updateUserStreak(normalized.userId, normalized.answeredAt);
  return normalized;
}

// ---- Notebook ----

export function getNotebook(userId?: string): NotebookItem[] {
  const stored = parseJson<NotebookItem[]>(localStorage.getItem(STORAGE_KEYS.notebook), []);
  const list = Array.isArray(stored) ? stored.map(normalizeNotebookItem) : [];
  if (!userId) return list;
  return list.filter(i => i.userId === userId);
}

export function upsertNotebookItem(userId: string, questionId: string, patch: Partial<NotebookItem> = {}): NotebookItem {
  const all = getNotebook();
  const index = all.findIndex(i => i.userId === userId && i.questionId === questionId);
  const question = getQuestionById(questionId);
  const qMeta = question ? { grade: question.grade, subject: question.subject, difficulty: question.difficulty, topicId: question.topicId } : {};
  const next = normalizeNotebookItem({ userId, questionId, ...qMeta, ...(index >= 0 ? all[index] : {}), ...patch, updatedAt: nowIso() });
  if (index >= 0) all[index] = next;
  else all.push(next);
  localStorage.setItem(STORAGE_KEYS.notebook, JSON.stringify(all));
  return next;
}

// ---- Reports ----

export function getReports(): Report[] {
  const stored = parseJson<Report[]>(localStorage.getItem(STORAGE_KEYS.reports), []);
  return Array.isArray(stored) ? stored : [];
}

export function addReport(report: Partial<Report>): Report {
  const all = getReports();
  const normalized: Report = {
    id: report?.id ?? newId('rep'),
    questionId: String(report?.questionId ?? ''),
    questionMeta: {
      grade: String(report?.questionMeta?.grade ?? ''),
      subject: String(report?.questionMeta?.subject ?? ''),
      topic: String(report?.questionMeta?.topic ?? ''),
      difficulty: String(report?.questionMeta?.difficulty ?? ''),
      preview: String(report?.questionMeta?.preview ?? '').trim(),
    },
    type: String(report?.type ?? 'outro'),
    message: String(report?.message ?? '').trim(),
    createdAt: report?.createdAt ?? nowIso(),
    createdBy: {
      username: String(report?.createdBy?.username ?? ''),
      role: String(report?.createdBy?.role ?? 'student'),
    },
    status: (['open', 'resolved', 'ignored'] as const).includes(report?.status as any) ? report!.status as Report['status'] : 'open',
    adminNote: String(report?.adminNote ?? '').trim(),
    resolvedAt: report?.resolvedAt ?? null,
    resolvedBy: report?.resolvedBy ?? null,
  };
  all.unshift(normalized);
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(all));
  return normalized;
}

export function updateReport(reportId: string, patch: Partial<Report>): Report | null {
  const all = getReports();
  const index = all.findIndex(r => r.id === reportId);
  if (index < 0) return null;
  all[index] = { ...all[index], ...patch } as Report;
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(all));
  return all[index];
}

export function setReportStatus(reportId: string, status: string, adminNote = '', resolvedBy: { username: string; role: string } | null = null): Report | null {
  const patch: Partial<Report> = { status: status as Report['status'], adminNote };
  if (status === 'resolved' || status === 'ignored') {
    patch.resolvedAt = nowIso();
    patch.resolvedBy = resolvedBy;
  }
  if (status === 'open') {
    patch.resolvedAt = null;
    patch.resolvedBy = null;
  }
  return updateReport(reportId, patch);
}

// ---- Training Plans ----

export function getTrainingPlans(userId: string): TrainingPlan[] {
  const map = parseJson<Record<string, TrainingPlan[]>>(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  const plans = Array.isArray(map?.[userId]) ? map[userId] : [];
  return plans.map(normalizeTrainingPlan);
}

export function addTrainingPlan(userId: string, plan: Partial<TrainingPlan>): TrainingPlan {
  const map = parseJson<Record<string, TrainingPlan[]>>(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  const current = Array.isArray(map[userId]) ? map[userId] : [];
  const normalized = normalizeTrainingPlan(plan);
  map[userId] = [normalized, ...current];
  localStorage.setItem(STORAGE_KEYS.trainingPlans, JSON.stringify(map));
  return normalized;
}

export function getTrainingPlanById(planId: string): (TrainingPlan & { userId: string }) | null {
  const map = parseJson<Record<string, TrainingPlan[]>>(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  for (const [userId, plans] of Object.entries(map)) {
    const found = (Array.isArray(plans) ? plans : []).find(p => p.id === planId);
    if (found) return { userId, ...normalizeTrainingPlan(found) };
  }
  return null;
}

// ---- Lessons ----

export function getLessons(): Lesson[] {
  const stored = parseJson<Lesson[]>(localStorage.getItem(STORAGE_KEYS.lessons), []);
  return Array.isArray(stored) ? stored.map(normalizeLesson).filter(l => l.title && l.url && l.topic) : [];
}

export function saveLessons(lessons: Lesson[]): Lesson[] {
  const normalized = Array.isArray(lessons) ? lessons.map(normalizeLesson).filter(l => l.title && l.url && l.topic) : [];
  localStorage.setItem(STORAGE_KEYS.lessons, JSON.stringify(normalized));
  return normalized;
}

export function saveLesson(lesson: Partial<Lesson>): Lesson {
  const all = getLessons();
  const normalized = normalizeLesson(lesson);
  all.unshift(normalized);
  saveLessons(all);
  return normalized;
}

export function updateLesson(lessonId: string, patch: Partial<Lesson>): Lesson | null {
  const all = getLessons();
  const index = all.findIndex(l => l.id === lessonId);
  if (index < 0) return null;
  const updated = normalizeLesson({ ...all[index], ...patch, id: lessonId });
  all[index] = updated;
  saveLessons(all);
  return updated;
}

export function deleteLesson(lessonId: string): void {
  saveLessons(getLessons().filter(l => l.id !== lessonId));
}

// ---- Dashboard Meta ----

export function getStudentDashboardMeta(userId: string): DashboardMeta {
  if (!userId) return normalizeDashboardMeta({});
  const map = parseJson<Record<string, DashboardMeta>>(localStorage.getItem(STORAGE_KEYS.dashboardMeta), {});
  return normalizeDashboardMeta(map[userId]);
}

export function saveStudentDashboardMeta(userId: string, patch: Partial<DashboardMeta> = {}): DashboardMeta {
  if (!userId) return normalizeDashboardMeta({});
  const map = parseJson<Record<string, DashboardMeta>>(localStorage.getItem(STORAGE_KEYS.dashboardMeta), {});
  const current = normalizeDashboardMeta(map[userId]);
  const next = normalizeDashboardMeta({
    ...current,
    ...patch,
    lastFilters: patch.lastFilters ? normalizeDashboardFilters(patch.lastFilters) : current.lastFilters,
  });
  map[userId] = next;
  localStorage.setItem(STORAGE_KEYS.dashboardMeta, JSON.stringify(map));
  return next;
}

// ---- Init ----

export function initStorageFromSeeds(): void {
  ensureUsersSeeded();

  // Init topics
  const existingTopics = parseJson<Topic[] | null>(localStorage.getItem(STORAGE_KEYS.topicsBank), null);
  if (!Array.isArray(existingTopics) || !existingTopics.length) {
    saveTopicsBank((topicsSeed as any[]).map(normalizeTopic));
  }

  const shouldReset = localStorage.getItem(STORAGE_KEYS.version) !== SEED_VERSION;
  const hasBank = !!localStorage.getItem(STORAGE_KEYS.questionBank);
  const hasLessons = !!localStorage.getItem(STORAGE_KEYS.lessons);

  if (!shouldReset && hasBank && hasLessons) return;

  saveQuestionBank((questionsSeed as any[]).map(q => normalizeQuestion({ ...q, createdAt: nowIso(), updatedAt: nowIso() })));
  saveLessons((lessonsSeed as any[]).map(normalizeLesson));
  localStorage.setItem(STORAGE_KEYS.version, SEED_VERSION);
}

export function resetToSeed(): void {
  localStorage.removeItem(STORAGE_KEYS.questionBank);
  localStorage.removeItem(STORAGE_KEYS.topicsBank);
  localStorage.removeItem(STORAGE_KEYS.lessons);
  localStorage.removeItem(STORAGE_KEYS.version);
  initStorageFromSeeds();
}
