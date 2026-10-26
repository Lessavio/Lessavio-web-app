import { calendarDate, validateRecurrenceRule, type RecurrenceRule } from '../features/calendar/model/recurrenceRule.ts';
import type { Language } from '../shared/i18n/index';
export interface Profile { reminderMinutes?: number; language?: Language; name: string; currency: 'UAH' | 'EUR' | 'USD'; timeZone: string }
export interface Student { id: string; name: string; subject: string; phone: string; price: number; notes: string; archived: boolean; color?: string }
export interface Lesson { id: string; seriesId?: string; seriesRule?: RecurrenceRule; studentId: string; startsAt: string; duration: number; price: number; status: 'scheduled' | 'completed' | 'cancelled'; notes: string }
export interface Payment { id: string; studentId: string; amount: number; paidAt: string }
export interface Workspace { version: 1; profile: Profile | null; students: Student[]; lessons: Lesson[]; payments: Payment[] }
export const emptyWorkspace = (): Workspace => ({ version: 1, profile: null, students: [], lessons: [], payments: [] });
export function validateWorkspace(value: unknown): asserts value is Workspace {
  const w = value as Workspace;
  if (!w || w.version !== 1 || !Array.isArray(w.students) || !Array.isArray(w.lessons) || !Array.isArray(w.payments)) throw Error('Неподдерживаемый формат резервной копии');
  const text = (v: unknown, max = 10000) => typeof v === 'string' && v.length <= max;
  const money = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
  const date = (v: unknown) => {
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(v)||!Number.isFinite(Date.parse(v)))return false;
    try{calendarDate(v.slice(0,10));return true;}catch{return false;}
  };
  if (w.profile !== null) {
    if (!w.profile || !text(w.profile.name, 100) || !w.profile.name.trim() || !['UAH','EUR','USD'].includes(w.profile.currency) || !text(w.profile.timeZone,100) || !w.profile.timeZone || (w.profile.reminderMinutes !== undefined && ![0,5,10,15,30,60].includes(w.profile.reminderMinutes)) || (w.profile.language !== undefined && !['ru','uk','en'].includes(w.profile.language))) throw Error('Некорректный профиль');
    try { new Intl.DateTimeFormat('ru', {timeZone: w.profile.timeZone}).format(); } catch { throw Error('Некорректный часовой пояс'); }
  }
  const ids = new Set<string>();
  for (const s of w.students) {
    if (!s || !text(s.id,100) || !s.id || ids.has(s.id) || !text(s.name,100) || !s.name.trim() || !text(s.subject,200) || !text(s.phone,100) || !text(s.notes) || !money(s.price) || typeof s.archived !== 'boolean' || (s.color!==undefined && !/^#[0-9a-fA-F]{6}$/.test(s.color))) throw Error('Некорректные данные ученика');
    ids.add(s.id);
  }
  const lessonIds = new Set<string>();
  for (const l of w.lessons) {
    if (!l || !text(l.id,100) || !l.id || lessonIds.has(l.id) || !ids.has(l.studentId) || !date(l.startsAt) || !Number.isInteger(l.duration) || l.duration < 15 || l.duration > 480 || !money(l.price) || !['scheduled','completed','cancelled'].includes(l.status) || !text(l.notes) || (l.seriesId !== undefined && (!text(l.seriesId,100) || !l.seriesId))) throw Error('Некорректные данные занятия');
    if(l.seriesRule!==undefined){try{validateRecurrenceRule(l.seriesRule);}catch{throw Error('Некорректные данные занятия');}}
    lessonIds.add(l.id);
  }
  const paymentIds = new Set<string>();
  for (const p of w.payments) {
    if (!p || !text(p.id,100) || !p.id || paymentIds.has(p.id) || !ids.has(p.studentId) || !money(p.amount) || p.amount === 0 || !date(p.paidAt)) throw Error('Некорректные данные оплаты');
    paymentIds.add(p.id);
  }
}
export function hasConflict(lessons: Lesson[], candidate: Lesson): boolean {
  if (candidate.status === 'cancelled') return false;
  const start = Date.parse(candidate.startsAt), end = start + candidate.duration * 60000;
  return lessons.some(l => l.id !== candidate.id && l.status !== 'cancelled' && Date.parse(l.startsAt) < end && Date.parse(l.startsAt) + l.duration * 60000 > start);
}
export function balance(w: Workspace, studentId: string): number {
  return w.payments.filter(p=>p.studentId===studentId).reduce((n,p)=>n+p.amount,0) - w.lessons.filter(l=>l.studentId===studentId && l.status==='completed').reduce((n,l)=>n+l.price,0);
}
export function moneyInput(value: string): number {
  if (!/^\d{1,8}([.,]\d{1,2})?$/.test(value)) throw Error('Укажите сумму с точностью до копеек');
  return Math.round(Number(value.replace(',', '.')) * 100);
}
