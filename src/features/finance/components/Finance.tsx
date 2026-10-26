import { useState } from 'react';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import type { Workspace } from '../../../domain/workspace';
import { financialSummary, isValidMonth, shiftMonth } from '../model/finance';
import { zonedDate } from '../../calendar/model/planning';
import { locales, translator, type Language } from '../../../shared/i18n/index';
export function Finance({workspace,language,onStudent}:{workspace:Workspace;language:Language;onStudent:(id:string)=>void}){
 const t=translator(language),locale=locales[language],zone=workspace.profile!.timeZone;
 const [month,setMonth]=useState(()=>zonedDate(new Date().toISOString(),zone).slice(0,7));
 const summary=financialSummary(workspace,month,zone);
 const money=(n:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:workspace.profile!.currency}).format(n/100);
 const shift=(delta:number)=>setMonth(current=>shiftMonth(current,delta));
 return <><div className="finance-period"><button aria-label={t('Предыдущий месяц')} onClick={()=>shift(-1)}><ChevronLeft size={17}/></button><label><span>{t('Месяц')}</span><input aria-label={t('Месяц')} type="month" min="0001-01" max="9999-12" required value={month} onChange={e=>{if(isValidMonth(e.target.value))setMonth(e.target.value);}}/></label><button aria-label={t('Следующий месяц')} onClick={()=>shift(1)}><ChevronRight size={17}/></button><span className="muted">{zone}</span></div>
 <div className="stats finance-stats">{[[t('Поступило оплат'),summary.received],[t('Проведено на сумму'),summary.earned],[t('Задолженность на конец месяца'),summary.debt],[t('Предоплата на конец месяца'),summary.credit]].map(([label,amount])=><div className="stat" key={label}><Wallet/><span>{label}</span><strong>{money(Number(amount))}</strong></div>)}</div>
 <section className="card"><div className="section-heading"><div><h2>{new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00:00`))}</h2><p className="muted">{t('Задолженность и предоплата учитывают всю историю до конца выбранного месяца.')}</p></div></div><div className="finance-table-wrap"><table className="finance-table"><thead><tr>{['Ученик','Проведено','Проведено на сумму','Поступило оплат','Запланировано на сумму','Баланс'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{summary.rows.map(row=><tr key={row.student.id}><td><button className="text-button" onClick={()=>onStudent(row.student.id)}>{row.student.name}</button>{row.student.archived&&<small>{t('Архив')}</small>}</td><td>{row.count}</td><td>{money(row.earned)}</td><td>{money(row.received)}</td><td>{money(row.planned)}</td><td className={row.balance<0?'negative':'positive'}>{money(row.balance)}</td></tr>)}</tbody></table>{!summary.rows.length&&<div className="empty"><Wallet size={30}/><p>{t('В этом месяце пока нет финансовых записей.')}</p></div>}</div></section><p className="muted finance-explanation">{t('Оплаты — фактические поступления. Стоимость проведённых занятий учитывается по дате урока. Минус в балансе — долг, плюс — предоплата.')}</p></>;
}
