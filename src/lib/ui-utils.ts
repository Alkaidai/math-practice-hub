import { SUBJECTS_MAP, SUBJECTS_REVERSE, DIFFICULTIES_MAP, DIFFICULTIES_REVERSE, STATUS_LABELS, ROLE_LABELS } from './constants';

export const subjectLabel = (code: string): string => SUBJECTS_MAP[code] ?? code;
export const subjectCode = (labelOrCode: string): string => SUBJECTS_REVERSE[labelOrCode] ?? labelOrCode;
export const difficultyLabel = (code: string): string => DIFFICULTIES_MAP[code] ?? code;
export const difficultyCode = (labelOrCode: string): string => DIFFICULTIES_REVERSE[labelOrCode] ?? labelOrCode;
export const statusLabel = (value: string): string => STATUS_LABELS[value] ?? value;
export const roleLabel = (value: string): string => ROLE_LABELS[value] ?? value;

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
