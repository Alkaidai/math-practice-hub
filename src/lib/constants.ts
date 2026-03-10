import type { Grade, User } from './types';

export const STORAGE_PREFIX = 'qb_';

export const STORAGE_KEYS = {
  currentUser: `${STORAGE_PREFIX}currentUser`,
  questionBank: `${STORAGE_PREFIX}questionBank`,
  topicsBank: `${STORAGE_PREFIX}topicsBank`,
  version: `${STORAGE_PREFIX}seedVersion`,
  attempts: 'bq_attempts',
  notebook: 'bq_notebook',
  reports: 'bq_reports',
  users: 'bq_users',
  trainingPlans: 'bq_trainingPlans',
  lessons: 'bq_lessons',
  adminSelectedStudentId: 'bq_admin_selectedStudentId',
  dashboardMeta: 'bq_student_dashboard_meta',
} as const;

export const SEED_VERSION = '2.0.0';

export const SEED_USERS: User[] = [
  {
    id: 'u_aluno',
    username: 'aluno',
    name: 'Aluno',
    email: '',
    password: 'aluno123',
    role: 'student',
    status: 'active',
    gradeLevel: '9EF',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null,
    loginCount: 0,
    authUserId: null,
    rankingVisible: true,
    planType: 'free',
    paymentSource: null,
  },
  {
    id: 'u_admin',
    username: 'admin',
    name: 'Admin',
    email: '',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    gradeLevel: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null,
    loginCount: 0,
    authUserId: null,
    rankingVisible: true,
  },
];

export const GRADES: Grade[] = ['7EF', '8EF', '9EF', '1EM'];

export const SUBJECTS_MAP: Record<string, string> = {
  math: 'Matemática',
  physics: 'Física',
};

export const SUBJECTS_REVERSE: Record<string, string> = {
  'Matemática': 'math',
  'Física': 'physics',
};

export const DIFFICULTIES_MAP: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Média',
  hard: 'Difícil',
};

export const DIFFICULTIES_REVERSE: Record<string, string> = {
  'Fácil': 'easy',
  'Média': 'medium',
  'Difícil': 'hard',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
  pending: 'Pendente',
  mastered: 'Dominado',
  open: 'Em aberto',
  answered: 'Respondido',
  hidden: 'Oculto',
  resolved: 'Resolvido',
  ignored: 'Ignorado',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'administrador',
  student: 'aluno',
};
