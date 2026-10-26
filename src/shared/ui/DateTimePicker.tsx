import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock } from 'lucide-react';
import { locales, translator, type Language } from '../i18n/index';
const key=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function DateTimePicker({defaultValue,language,dateOnly=false,name='startsAt',onDateChange,ariaLabel}:{defaultValue?:string;language:Language;dateOnly?:boolean;name?:string;onDateChange?:(date:string)=>void;ariaLabel?:string}){
 const initial=new Date(defaultValue??Math.ceil(Date.now()/900000)*900000);
 const [date,setDate]=useState(key(initial)),[time,setTime]=useState(`${String(initial.getHours()).padStart(2,'0')}:${String(initial.getMinutes()).padStart(2,'0')}`);
 const [month,setMonth]=useState(new Date(initial.getFullYear(),initial.getMonth(),1)),[open,setOpen]=useState(false),[focused,setFocused]=useState(date);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),grid=useRef<HTMLDivElement>(null);
 const id=useId(),t=translator(language),locale=locales[language];
 const chosen=new Date(`${date}T12:00:00`);
 const first=new Date(month.getFullYear(),month.getMonth(),1),offset=(first.getDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(first.getFullYear(),first.getMonth(),i-offset+1));
 const today=key(new Date());
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const choose=(next:string)=>{setDate(next);onDateChange?.(next);close();};
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 useEffect(()=>{if(open)grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();},[open,focused,month]);
 const moveMonth=(amount:number)=>{const next=new Date(month.getFullYear(),month.getMonth()+amount,1);setMonth(next);setFocused(key(next));};
 function keyboard(e:KeyboardEvent<HTMLButtonElement>,day:Date){
  if(e.key==='Escape'){e.preventDefault();close();return;}
  const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();moveMonth((e.key==='PageUp'?-1:1)*(e.shiftKey?12:1));return;}
  const weekday=(day.getDay()+6)%7;
  const amount=e.key==='Home'?-weekday:e.key==='End'?6-weekday:delta[e.key];
  if(amount!==undefined){e.preventDefault();const next=new Date(day.getFullYear(),day.getMonth(),day.getDate()+amount);setFocused(key(next));setMonth(new Date(next.getFullYear(),next.getMonth(),1));}
 }
 const formatted=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(chosen);
 return <div ref={root} className="datetime-picker" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault();}}>
  <input type="hidden" name={name} value={dateOnly?date:`${date}T${time}`}/>
  <div className="datetime-row"><button ref={trigger} type="button" className="date-trigger" aria-label={ariaLabel??t('Выбрать дату')} aria-expanded={open} aria-haspopup="dialog" aria-controls={open?id:undefined} onClick={()=>{if(open){close();return;}setMonth(new Date(chosen.getFullYear(),chosen.getMonth(),1));setFocused(date);setOpen(true);}}><CalendarDays size={18}/><span>{formatted}</span></button>{!dateOnly&&<div className="time-field"><Clock size={17}/><input type="time" aria-label={t('Время начала')} value={time} required step={60} onChange={e=>setTime(e.target.value)}/></div>}</div>
  {open&&<div id={id} className="date-popover" role="dialog" aria-label={ariaLabel??t('Выбрать дату')} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
   <div className="date-navigation"><button type="button" aria-label={t('Предыдущий год')} onClick={()=>moveMonth(-12)}><ChevronsLeft size={16}/></button><button type="button" aria-label={t('Предыдущий месяц')} onClick={()=>moveMonth(-1)}><ChevronLeft size={17}/></button><strong aria-live="polite">{new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(month)}</strong><button type="button" aria-label={t('Следующий месяц')} onClick={()=>moveMonth(1)}><ChevronRight size={17}/></button><button type="button" aria-label={t('Следующий год')} onClick={()=>moveMonth(12)}><ChevronsRight size={16}/></button></div>
   <div className="date-grid" ref={grid} role="grid" aria-label={ariaLabel??t('Выбрать дату')}><div role="row" className="date-week">{Array.from({length:7},(_,i)=><span role="columnheader" key={i}>{new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2026,0,5+i))}</span>)}</div>{Array.from({length:6},(_,week)=><div role="row" className="date-week" key={week}>{days.slice(week*7,week*7+7).map(day=><div role="gridcell" key={key(day)} aria-selected={key(day)===date}><button type="button" data-date={key(day)} tabIndex={key(day)===focused?0:-1} aria-label={new Intl.DateTimeFormat(locale,{dateStyle:'full'}).format(day)} aria-current={key(day)===today?'date':undefined} className={`${key(day)===date?'selected':''} ${day.getMonth()!==month.getMonth()?'outside':''} ${key(day)===today?'is-today':''}`} onKeyDown={e=>keyboard(e,day)} onClick={()=>choose(key(day))}>{day.getDate()}</button></div>)}</div>)}</div>
   <div className="date-shortcuts"><button type="button" onClick={()=>choose(today)}>{t('Сегодня')}</button><button type="button" onClick={()=>{const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);choose(key(tomorrow));}}>{t('Завтра')}</button><button type="button" onClick={close}>{t('Закрыть')}</button></div>
  </div>}
  {!dateOnly&&<div className="time-shortcuts"><span>{t('Быстрое время')}</span>{['09:00','10:00','12:00','14:00','16:00','18:00'].map(value=><button type="button" key={value} aria-pressed={time===value} onClick={()=>setTime(value)}>{value}</button>)}</div>}

 </div>;
}
