export type UserRole = 'admin' | 'student';
export type UserStatus = 'active' | 'blocked';
export type QuestionStatus = 'published' | 'draft';
export type TopicStatus = 'active' | 'inactive';
export type CommentStatusType = 'open' | 'answered' | 'hidden';
export type NotebookStatus = 'pending' | 'mastered';
export type ReportStatus = 'open' | 'resolved' | 'ignored';
export type Grade = '7EF' | '8EF' | '9EF' | '1EM';
export type Subject = 'math' | 'physics';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  gradeLevel: Grade | null;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  gradeLevel: Grade | null;
}

export interface Reply {
  id: string;
  author: { username: string; role: string };
  createdAt: string;
  text: string;
}

export interface Comment {
  id: string;
  author: { username: string; role: string };
  createdAt: string;
  text: string;
  status: CommentStatusType;
  replies: Reply[];
}

export interface Question {
  id: string;
  grade: string;
  subject: string;
  difficulty: string;
  topicId: string;
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

export interface Topic {
  id: string;
  name: string;
  label: string;
  subject: string;
  grade: string;
  status: TopicStatus;
}

export interface Lesson {
  id: string;
  title: string;
  url: string;
  topic: string;
  subject: string;
  grade: string;
}

export interface Attempt {
  id: number;
  userId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

export interface NotebookItem {
  userId: string;
  questionId: string;
  grade: string | null;
  subject: string | null;
  difficulty: string | null;
  topicId: string | null;
  status: NotebookStatus;
  whatIErred: string;
  ruleInsight: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  questionId: string;
  questionMeta: {
    grade: string;
    subject: string;
    topic: string;
    difficulty: string;
    preview: string;
  };
  type: string;
  message: string;
  createdAt: string;
  createdBy: { username: string; role: string };
  status: ReportStatus;
  adminNote: string;
  resolvedAt: string | null;
  resolvedBy: { username: string; role: string } | null;
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  topic: string;
  qty: number;
  distribution: { easy: number; medium: number; hard: number };
  questionIds: string[];
}

export interface DashboardMeta {
  streak: number;
  lastAttemptDate: string | null;
  lastFilters: QuestionFilters;
}

export interface QuestionFilters {
  grade: string;
  subject: string;
  difficulty: string;
  topicId: string;
  search: string;
}
