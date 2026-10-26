import {useEffect} from 'react';
import type {Workspace} from '../../../domain/workspace';
import {locales,type Language} from '../../../shared/i18n/index';
export function useBrowserReminders(scope:string,workspace:Workspace,language:Language){
 useEffect(()=>{
  if(typeof Notification==='undefined'||Notification.permission!=='granted'||!workspace.profile?.reminderMinutes)return;
  const minutes=workspace.profile.reminderMinutes;
  const tick=()=>{
   if(Notification.permission!=='granted')return;
   const now=Date.now();
   for(const lesson of workspace.lessons){
    const student=workspace.students.find(s=>s.id===lesson.studentId);
    const starts=Date.parse(lesson.startsAt);
    if(!student||student.archived||lesson.status!=='scheduled'||now>=starts||now<starts-minutes*60000)continue;
    const key=`lessavio:reminder:${scope}:${lesson.id}:${starts}:${minutes}`;
    try{
     if(localStorage.getItem(key))continue;
     new Notification('Lessavio',{body:`${student.name} · ${new Intl.DateTimeFormat(locales[language],{hour:'2-digit',minute:'2-digit',timeZone:workspace.profile?.timeZone}).format(starts)}`,tag:key});
     localStorage.setItem(key,'sent');
    }catch{/* Permission and platform delivery may change while the tab is open. */}
   }
  };
  tick();const timer=window.setInterval(tick,15000);
  return ()=>window.clearInterval(timer);
 },[scope,workspace,language]);
}
