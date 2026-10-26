import { useState } from 'react';
import type { Lesson, Workspace } from '../../../domain/workspace';
import { editableSeries, inferSeriesDraft, seriesOccurrenceFilter, type SeriesScope } from '../model/planning';
import { RecurrenceError, type SeriesDraft } from '../model/recurrence';
import { translator, type Language } from '../../../shared/i18n/index';
import { Select } from '../../../shared/ui/Select';
import { SeriesEditor } from './SeriesEditor';
export function SeriesEdit({lesson,workspace,language,busy,error,onClose,onSave}:{lesson:Lesson;workspace:Workspace;language:Language;busy:boolean;error:string;onClose:()=>void;onSave:(draft:SeriesDraft,scope:SeriesScope)=>Promise<void>}){
 const t=translator(language),[scope,setScope]=useState<SeriesScope>('future'),[now]=useState(()=>Date.now());
 const control=<div className="series-scope"><Select label={t('Какие занятия изменить')} value={scope} disabled={busy} emptyLabel={t('Ничего не найдено')} options={[{value:'future',label:t('Только будущие занятия')},{value:'scheduled',label:t('Все запланированные занятия')}]} onChange={value=>setScope(value as SeriesScope)}/><p className="muted">{t('Проведённые и отменённые занятия, а также оплаты сохранятся. Новое расписание заменит выбранную запланированную часть серии.')}</p></div>;
 let draft:SeriesDraft;
 try{draft=inferSeriesDraft(lesson,workspace.lessons,workspace.profile!.timeZone,scope,now);}catch(e){return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true"><h2>{t('Изменить серию')}</h2>{control}<div className="error">{e instanceof RecurrenceError?t(e.message,e.values):e instanceof Error?t(e.message):String(e)}</div><button disabled={busy} onClick={onClose}>{t('Закрыть')}</button></section></div>;}
 const ids=new Set(editableSeries(workspace.lessons,lesson.seriesId!,scope,now).map(l=>l.id));
 const students=workspace.students.filter(s=>!s.archived||s.id===lesson.studentId);
 return <SeriesEditor key={scope} occurrenceFilter={seriesOccurrenceFilter(workspace.lessons,lesson.seriesId!,scope,now,draft.rule.timeZone)} editing scopeControl={control} initialDraft={draft} students={students} lessons={workspace.lessons.filter(l=>!ids.has(l.id))} language={language} timeZone={draft.rule.timeZone} currency={workspace.profile!.currency} busy={busy} error={error} onClose={onClose} onSingle={onClose} onSave={draft=>onSave(draft,scope)}/>;
}
