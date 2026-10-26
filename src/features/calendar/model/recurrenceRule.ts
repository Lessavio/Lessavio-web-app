export interface WeeklySlot { weekday: number; time: string }
export interface RecurrenceRule { startDate: string; endDate: string; intervalWeeks: 1|2; timeZone: string; slots: WeeklySlot[] }
export class RecurrenceError extends Error {
 values:Record<string,string|number>;
 constructor(message:string,values:Record<string,string|number>={}){super(message);this.values=values;}
}
export function calendarDate(value:unknown):number {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new RecurrenceError('Укажите корректные даты периода');
 const stamp=Date.parse(`${value}T00:00:00Z`);
 if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value)throw new RecurrenceError('Укажите корректные даты периода');
 return stamp;
}
export function validateRecurrenceRule(value:unknown):asserts value is RecurrenceRule {
 if(!value||typeof value!=='object')throw new RecurrenceError('Некорректные данные занятия');
 const rule=value as RecurrenceRule;
 const start=calendarDate(rule.startDate),end=calendarDate(rule.endDate);
 if(end<start)throw new RecurrenceError('Дата окончания должна быть не раньше даты начала');
 if(end-start>366*86400000)throw new RecurrenceError('Выберите период не длиннее одного года');
 if(![1,2].includes(rule.intervalWeeks))throw new RecurrenceError('Некорректный интервал повторения');
 if(!Array.isArray(rule.slots)||!rule.slots.length||rule.slots.length>7)throw new RecurrenceError('Выберите хотя бы один день недели');
 const weekdays=new Set<number>();
 for(const slot of rule.slots){
  if(!slot||typeof slot!=='object'||!Number.isInteger(slot.weekday)||slot.weekday<1||slot.weekday>7||weekdays.has(slot.weekday)||typeof slot.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time))throw new RecurrenceError('Укажите корректное время для каждого дня');
  weekdays.add(slot.weekday);
 }
 try{if(typeof rule.timeZone!=='string'||!rule.timeZone||rule.timeZone.length>100)throw new Error();new Intl.DateTimeFormat('en',{timeZone:rule.timeZone}).format();}catch{throw new RecurrenceError('Некорректный часовой пояс');}
}
