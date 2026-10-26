import { hasConflict, type Lesson } from '../../../domain/workspace.ts';
import { calendarDate, validateRecurrenceRule, RecurrenceError, type WeeklySlot, type RecurrenceRule } from './recurrenceRule.ts';
export { RecurrenceError, type WeeklySlot, type RecurrenceRule } from './recurrenceRule.ts';
export interface Occurrence { startsAt: string; localDate: string; localTime: string; weekday: number }
export interface SeriesDraft { studentId: string; duration: number; price: number; notes: string; rule: RecurrenceRule }
const DAY=86400000;
function zonedParts(stamp:number,formatter:Intl.DateTimeFormat):number {
 const parts=Object.fromEntries(formatter.formatToParts(stamp).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
}
/** Find UTC instants by actual zone offsets on both sides of a possible DST change. */
function wallTime(date:string,time:string,formatter:Intl.DateTimeFormat):string {
 const wall=Date.parse(`${date}T${time}:00Z`);
 const offsets=new Set([-36,-12,0,12,36].map(hours=>{const sample=wall+hours*3600000;return zonedParts(sample,formatter)-sample;}));
 const matches=[...offsets].map(offset=>wall-offset).filter(candidate=>zonedParts(candidate,formatter)===wall);
 if(matches.length===0)throw new RecurrenceError('Время {date} {time} не существует из-за перевода часов',{date,time});
 if(matches.length>1)throw new RecurrenceError('Время {date} {time} неоднозначно из-за перевода часов',{date,time});
 return new Date(matches[0]).toISOString();
}
export function generateOccurrences(rule:RecurrenceRule):Occurrence[] {
 validateRecurrenceRule(rule);
 const start=calendarDate(rule.startDate),end=calendarDate(rule.endDate);
 let formatter:Intl.DateTimeFormat;
 try{formatter=new Intl.DateTimeFormat('en-GB',{timeZone:rule.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{throw new RecurrenceError('Некорректный часовой пояс');}
 const monday=start-((new Date(start).getUTCDay()+6)%7)*DAY;
 const result:Occurrence[]=[];
 for(let stamp=start;stamp<=end;stamp+=DAY){
  if(Math.floor((stamp-monday)/(7*DAY))%rule.intervalWeeks!==0)continue;
  const weekday=((new Date(stamp).getUTCDay()+6)%7)+1;
  const slot=rule.slots.find(item=>item.weekday===weekday);if(!slot)continue;
  const date=new Date(stamp).toISOString().slice(0,10);
  result.push({startsAt:wallTime(date,slot.time,formatter),localDate:date,localTime:slot.time,weekday});
 }
 if(!result.length)throw new RecurrenceError('В выбранном периоде нет занятий. Измените дни или даты.');
 return result;
}
export function seriesConflicts(occurrences:Occurrence[],existing:Lesson[],duration:number):{occurrence:Occurrence;lesson:Lesson}[]{
 let prefix='$series-preview$';
 while(existing.some(lesson=>lesson.id.startsWith(prefix)))prefix+='$';
 const candidates:Lesson[]=[];const conflicts:{occurrence:Occurrence;lesson:Lesson}[]=[];
 occurrences.forEach((occurrence,index)=>{
  const candidate:Lesson={id:`${prefix}${index}`,studentId:'',startsAt:occurrence.startsAt,duration,price:0,status:'scheduled',notes:''};
  const overlap=[...existing,...candidates].find(lesson=>hasConflict([lesson],candidate));
  if(overlap)conflicts.push({occurrence,lesson:overlap});
  candidates.push(candidate);
 });
 return conflicts;
}
export function createSeriesLessons(draft:SeriesDraft,existing:Lesson[],id:()=>string=()=>crypto.randomUUID()):Lesson[]{
 if(!draft.studentId||!Number.isInteger(draft.duration)||draft.duration<15||draft.duration>480||!Number.isSafeInteger(draft.price)||draft.price<0||draft.notes.length>10000)throw new RecurrenceError('Некорректные данные занятия');
 const occurrences=generateOccurrences(draft.rule);
 if(seriesConflicts(occurrences,existing,draft.duration).length)throw new RecurrenceError('Есть пересечения с расписанием. Измените дни или время.');
 const seriesId=id();
 return occurrences.map(occurrence=>({id:id(),seriesId,seriesRule:draft.rule,studentId:draft.studentId,startsAt:occurrence.startsAt,duration:draft.duration,price:draft.price,notes:draft.notes,status:'scheduled'}));
}

export function cancelUpcomingSeries(lessons:Lesson[],seriesId:string,now=Date.now()):Lesson[]{
 return lessons.map(lesson=>lesson.seriesId===seriesId&&lesson.status==='scheduled'&&Date.parse(lesson.startsAt)>=now?{...lesson,status:'cancelled'}:lesson);
}
