import { hasConflict, type Lesson } from '../../../domain/workspace.ts';
import { createSeriesLessons, generateOccurrences, RecurrenceError, type SeriesDraft, type RecurrenceRule } from './recurrence.ts';
export type SeriesScope='future'|'scheduled';
export function zonedDate(startsAt:string,timeZone:string):string {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(startsAt)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function zonedTime(startsAt:string,timeZone:string):string {return new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(startsAt));}
export function moveLesson(lessons:Lesson[],id:string,date:string,time:string,timeZone:string):Lesson {
 const lesson=lessons.find(l=>l.id===id);
 if(!lesson||lesson.status!=='scheduled')throw new Error('Переносить можно только запланированные занятия');
 const moved={...lesson,startsAt:localLessonStart(`${date}T${time}`,timeZone,lesson.startsAt)};
 if(hasConflict(lessons,moved))throw new Error('В это время уже есть занятие. Выберите другое время.');
 return moved;
}
export function editableSeries(lessons:Lesson[],seriesId:string,scope:SeriesScope,now:number):Lesson[]{return lessons.filter(l=>l.seriesId===seriesId&&l.status==='scheduled'&&(scope==='scheduled'||Date.parse(l.startsAt)>=now));}
export function inferSeriesDraft(selected:Lesson,lessons:Lesson[],timeZone:string,scope:SeriesScope,now:number):SeriesDraft {
 if(!selected.seriesId)throw new Error('Серия не найдена');
 const target=editableSeries(lessons,selected.seriesId,scope,now).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
 if(!target.length)throw new Error('Нет запланированных занятий для изменения');
 const saved=target.find(l=>l.seriesRule)?.seriesRule;
 timeZone=saved?.timeZone??timeZone;
 const counts=new Map<number,Map<string,number>>();
 for(const lesson of target){const date=zonedDate(lesson.startsAt,timeZone);const day=((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)+1;const time=zonedTime(lesson.startsAt,timeZone);if(!counts.has(day))counts.set(day,new Map());const map=counts.get(day)!;map.set(time,(map.get(time)??0)+1);}
 const slots=saved?.slots??[...counts].sort(([a],[b])=>a-b).map(([weekday,times])=>({weekday,time:[...times].sort((a,b)=>b[1]-a[1])[0][0]}));
 const nextSaved=saved?generateOccurrences(saved).find(o=>Date.parse(o.startsAt)>=now):undefined;
 const startDate=scope==='future'?(nextSaved?.localDate??zonedDate(target[0].startsAt,timeZone)):(saved?.startDate??zonedDate(target[0].startsAt,timeZone));
 const dates=target.map(l=>zonedDate(l.startsAt,timeZone));
 const perWeekday=slots.map(slot=>dates.filter(date=>((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)+1===slot.weekday));
 const gaps=perWeekday.flatMap(dates=>dates.slice(1).map((date,i)=>(Date.parse(date)-Date.parse(dates[i]))/86400000));
 return {studentId:selected.studentId,duration:target[0].duration,price:target[0].price,notes:target[0].notes,rule:{startDate,endDate:saved&&saved.endDate>dates.at(-1)!?saved.endDate:dates.at(-1)!,timeZone:saved?.timeZone??timeZone,intervalWeeks:saved?.intervalWeeks??(gaps.length&&gaps.every(gap=>gap%14===0)?2:1),slots}};
}
export function seriesOccurrenceFilter(lessons:Lesson[],seriesId:string,scope:SeriesScope,now:number,timeZone:string){
 const protectedDates=new Set(lessons.filter(l=>l.seriesId===seriesId&&(l.status!=='scheduled'||(scope==='future'&&Date.parse(l.startsAt)<now))).map(l=>zonedDate(l.startsAt,timeZone)));
 return (occurrence:{startsAt:string})=>(scope==='scheduled'||Date.parse(occurrence.startsAt)>=now)&&!protectedDates.has(zonedDate(occurrence.startsAt,timeZone));
}
export function replaceSeries(lessons:Lesson[],seriesId:string,draft:SeriesDraft,scope:SeriesScope,now:number,id:()=>string=()=>crypto.randomUUID()):Lesson[]{
 const target=editableSeries(lessons,seriesId,scope,now);if(!target.length)throw new Error('Нет запланированных занятий для изменения');
 if(target.some(l=>l.studentId!==draft.studentId))throw new Error('Ученик серии не может быть изменён');
 const ids=new Set(target.map(l=>l.id));const preserved=lessons.filter(l=>!ids.has(l.id));
 const candidates=createSeriesLessons(draft,[],id).filter(seriesOccurrenceFilter(lessons,seriesId,scope,now,draft.rule.timeZone)).map(l=>({...l,seriesId}));
 if(candidates.some(candidate=>hasConflict(preserved,candidate)))throw new RecurrenceError('Есть пересечения с расписанием. Измените дни или время.');
 if(!candidates.length)throw new RecurrenceError('В выбранном периоде нет занятий. Измените дни или даты.');
 return [...preserved,...candidates];
}

export function lessonForStudent(lesson:Lesson,studentId:string):Lesson {
 const updated={...lesson,studentId};
 if(lesson.studentId!==studentId){delete updated.seriesId;delete updated.seriesRule;}
 return updated;
}
export function localLessonStart(value:string,timeZone:string,original?:string):string {
 const match=/^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/.exec(value);
 if(!match)throw new RecurrenceError('Укажите корректную дату и время занятия');
 const [,date,time]=match;
 if(original&&`${zonedDate(original,timeZone)}T${zonedTime(original,timeZone)}`===value)return original;
 const weekday=((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)+1;
 return generateOccurrences({startDate:date,endDate:date,intervalWeeks:1,timeZone,slots:[{weekday,time}]})[0].startsAt;
}
