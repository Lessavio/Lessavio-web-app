import type { Workspace } from '../../../domain/workspace.ts';
import { zonedDate } from '../../calendar/model/planning.ts';
export function isValidMonth(value:unknown):value is string {return typeof value==='string'&&/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);}
export function shiftMonth(month:string,delta:number):string {
 if(!isValidMonth(month)||!Number.isInteger(delta))return month;
 const date=new Date(`${month}-15T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+delta);
 if(!Number.isFinite(date.getTime()))return month;
 const next=date.toISOString().slice(0,7);return isValidMonth(next)?next:month;
}
export function financialSummary(w:Workspace,month:string,timeZone:string){
 if(!isValidMonth(month))throw new Error('Некорректный месяц');
 const period=(stamp:string)=>zonedDate(stamp,timeZone).slice(0,7);
 const rows=w.students.map(student=>{
  const lessons=w.lessons.filter(l=>l.studentId===student.id),payments=w.payments.filter(p=>p.studentId===student.id);
  const completed=lessons.filter(l=>l.status==='completed'&&period(l.startsAt)===month);
  const earned=completed.reduce((n,l)=>n+l.price,0),received=payments.filter(p=>period(p.paidAt)===month).reduce((n,p)=>n+p.amount,0);
  const balance=payments.filter(p=>period(p.paidAt)<=month).reduce((n,p)=>n+p.amount,0)-lessons.filter(l=>l.status==='completed'&&period(l.startsAt)<=month).reduce((n,l)=>n+l.price,0);
  const planned=lessons.filter(l=>l.status==='scheduled'&&period(l.startsAt)===month).reduce((n,l)=>n+l.price,0);
  return {student,earned,received,balance,planned,count:completed.length};
 });
 return {rows:rows.filter(r=>r.earned||r.received||r.balance||r.planned||r.count),earned:rows.reduce((n,r)=>n+r.earned,0),received:rows.reduce((n,r)=>n+r.received,0),debt:rows.reduce((n,r)=>n+Math.max(0,-r.balance),0),credit:rows.reduce((n,r)=>n+Math.max(0,r.balance),0),planned:rows.reduce((n,r)=>n+r.planned,0)};
}
