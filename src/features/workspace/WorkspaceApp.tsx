import {WorkspaceNavigation} from './components/WorkspaceNavigation';
import type {WorkspaceView} from './model/types';
import {useBrowserReminders} from '../reminders/hooks/useBrowserReminders';
import { version } from '../../../package.json';
import { AnalyticsSettings } from '../analytics/components/AnalyticsSettings';
import { analytics, activateAnalytics } from '../analytics/api/analytics';
import type { AnalyticsEvent } from '../analytics/model/analyticsPolicy';
import { studentColors, studentColor, nextStudentColor, visibleLessons } from '../students/model/studentColors';
import { Calendar } from '../calendar/components/Calendar';
import { Finance } from '../finance/components/Finance';
import { SeriesEdit } from '../calendar/components/SeriesEdit';
import { Reminders } from '../reminders/components/Reminders';
import { moveLesson, replaceSeries, lessonForStudent, localLessonStart } from '../calendar/model/planning';
import { SeriesEditor } from '../calendar/components/SeriesEditor';
import { createSeriesLessons, cancelUpcomingSeries, RecurrenceError, type SeriesDraft } from '../calendar/model/recurrence';
import { kindMessages, MESSAGE_INTERVAL_MS } from './model/kindMessages';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, useId, isValidElement, cloneElement, type ReactElement } from 'react';
import { BookOpen, CalendarDays, Users, Settings, Plus, ArrowUpRight, ChevronLeft, ChevronRight, X, Check, Wallet, Download, Upload, Search, ShieldCheck, GraduationCap, Repeat2 } from 'lucide-react';
import { balance, emptyWorkspace, hasConflict, moneyInput, type Lesson, type Profile, type Student, type Workspace } from '../../domain/workspace';
import * as storage from '../../infrastructure/storage/workspaceRepository';
import { Select } from '../../shared/ui/Select';
import { DateTimePicker } from '../../shared/ui/DateTimePicker';
import { defaultLanguage, languages, locales, translator, type Language } from '../../shared/i18n/index';

type Modal = {kind:'editSeries'; lesson:Lesson} | {kind:'series'; studentId?:string} | {
    kind: 'student';
    student?: Student;
} | {
    kind: 'lesson';
    lesson?: Lesson;
} | {
    kind: 'payment';
    studentId: string;
} | null;
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
function FormField({ label, children }: {
    label: string;
    children: ReactNode;
}) { const id=useId(); const input=isValidElement(children)&&['input','textarea'].includes(String(children.type)); return <div className="field" role="group" aria-label={label}>{input?<label htmlFor={id}>{label}</label>:<span>{label}</span>}{input?cloneElement(children as ReactElement<{id?:string}>,{id}):children}</div>; }
export function WorkspaceApp({scope="guest",accountPanel}:{scope?:string;accountPanel?:(language:Language,busy:boolean)=>ReactNode}) {
    const repository=useMemo(()=>storage.createRepository(scope),[scope]);
    const [w, setW] = useState<Workspace>(emptyWorkspace), [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [view, setView] = useState<WorkspaceView>('today'), [modal, setModal] = useState<Modal>(null), [query, setQuery] = useState(''), [showArchived, setShowArchived] = useState(false), [notice, setNotice] = useState(''), [restoring, setRestoring] = useState<Workspace | null>(null);
    const lock = useRef(false);
    const [cancelSeries,setCancelSeries]=useState(false);
    useEffect(()=>setCancelSeries(false),[modal]);
    const [welcomeLanguage, setWelcomeLanguage] = useState<Language>(defaultLanguage);
    const language = w.profile ? w.profile.language ?? 'ru' : welcomeLanguage;
    useBrowserReminders(scope,w,language);
    const locale = locales[language];
    const t = translator(language);
    const errorText=(e:unknown)=>e instanceof RecurrenceError?t(e.message,e.values):e instanceof Error?e.message:String(e);
    useEffect(()=>{void activateAnalytics(scope,language);return ()=>analytics.deactivate(scope);},[scope]);
    useEffect(()=>{analytics.setLanguage(scope,language);analytics.setScreen(scope,view);},[scope,language,view]);
    const [messageIndex,setMessageIndex]=useState(()=>Math.floor(Math.random()*kindMessages.length));
    const hasProfile=Boolean(w.profile);
    useEffect(()=>{
        if(view!=='today'||!hasProfile)return;
        const timer=window.setInterval(()=>{
            setMessageIndex(previous=>(previous+1+Math.floor(Math.random()*(kindMessages.length-1)))%kindMessages.length);
        },MESSAGE_INTERVAL_MS);
        return ()=>window.clearInterval(timer);
    },[view,hasProfile]);
    useEffect(() => { document.documentElement.lang = language; }, [language]);
    const boot = () => { setLoading(true); setLoadFailed(false); setError(''); repository.load().then(setW).catch(e => { setLoadFailed(true); setError(errorText(e)); }).finally(() => setLoading(false)); };
    useEffect(boot, []);
    useEffect(() => { if (!notice)
        return; const id = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(id); }, [notice]);
    const money = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: w.profile?.currency ?? 'UAH', maximumFractionDigits: 2 }).format(n / 100);
    const time = (s: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: w.profile?.timeZone }).format(new Date(s));
    const day = (s: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: w.profile?.timeZone }).format(new Date(s));
    const dateKey = (s: string) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: w.profile?.timeZone }).format(new Date(s));
    const commit = async (next: Workspace,event?:AnalyticsEvent) => { if (lock.current)
        return false; lock.current = true; setBusy(true); setError(''); try {
        await repository.save(next);
        setW(next);
        if(event)analytics.track(scope,event);
        return true;
    }
    catch (e) {
        setError(errorText(e));
        return false;
    }
    finally {
        lock.current = false;
        setBusy(false);
    } };
    const student = (id: string) => w.students.find(s => s.id === id);
    const today = dateKey(new Date().toISOString());
    const scheduleLessons=visibleLessons(w.lessons,w.students);
    const todayLessons = scheduleLessons.filter(l => dateKey(l.startsAt) === today).sort((a, b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
    const active = w.students.filter(s => !s.archived);
    const debt = w.students.reduce((n, s) => n + Math.max(0, -balance(w, s.id)), 0);
    const upcoming = scheduleLessons.filter(l => l.status === 'scheduled' && Date.parse(l.startsAt) >= Date.now()).sort((a, b) => Date.parse(a.startsAt)-Date.parse(b.startsAt))[0];
    async function profileSubmit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const p: Profile = { name: field(f, 'name'), currency: field(f, 'currency') as Profile['currency'], timeZone: field(f, 'timeZone'), language, reminderMinutes:w.profile?.reminderMinutes??0 }; if (await commit({ ...w, profile: p },w.profile?undefined:'onboarding_completed'))
        setNotice(t("Настройки сохранены")); }
    async function submitModal(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!modal || modal.kind==='series'||modal.kind==='editSeries')
            return;
        const f = new FormData(e.currentTarget);
        try {
            let next = w;
            let event:AnalyticsEvent;
            if (modal.kind === 'student') {
                event=modal.student?'student_updated':'student_created';
                const s: Student = { id: modal.student?.id ?? crypto.randomUUID(), name: field(f, 'name'), subject: field(f, 'subject'), phone: field(f, 'phone'), price: moneyInput(field(f, 'price')), notes: field(f, 'notes'), color:field(f,'color')||modal.student?.color||nextStudentColor(w.students), archived: modal.student?.archived ?? false };
                next = { ...w, students: modal.student ? w.students.map(old => old.id === s.id ? s : old) : [...w.students, s] };
            }
            else if (modal.kind === 'lesson') {
                event=!modal.lesson?'lesson_created':field(f,'status')==='completed'&&modal.lesson.status!=='completed'?'lesson_completed':localLessonStart(field(f,'startsAt'),Intl.DateTimeFormat().resolvedOptions().timeZone,modal.lesson?.startsAt)!==modal.lesson.startsAt?'lesson_rescheduled':'lesson_updated';
                const l: Lesson = { ...(modal.lesson?lessonForStudent(modal.lesson,field(f,'studentId')):{}), id: modal.lesson?.id ?? crypto.randomUUID(), studentId: field(f, 'studentId'), startsAt: localLessonStart(field(f, 'startsAt'),Intl.DateTimeFormat().resolvedOptions().timeZone,modal.lesson?.startsAt), duration: Number(field(f, 'duration')), price: moneyInput(field(f, 'price')), status: field(f, 'status') as Lesson['status'], notes: field(f, 'notes') };
                if (hasConflict(w.lessons, l))
                    throw Error(t("В это время уже есть занятие. Выберите другое время."));
                next = { ...w, lessons: modal.lesson ? w.lessons.map(old => old.id === l.id ? l : old) : [...w.lessons, l] };
            }
            else {
                event='payment_recorded';
                const amount = moneyInput(field(f, 'amount'));
                if (amount <= 0)
                    throw Error(t("Сумма оплаты должна быть больше нуля"));
                next = { ...w, payments: [...w.payments, { id: crypto.randomUUID(), studentId: modal.studentId, amount, paidAt: new Date().toISOString() }] };
            }
            if (await commit(next,event)) {
                setModal(null);
                setNotice(t("Сохранено"));
            }
        }
        catch (e) {
            setError(errorText(e));
        }
    }
    const openLesson = () => { setError(''); if (!active.length) {
        setModal({ kind: 'student' });
        setNotice(t("Сначала добавьте ученика"));
    }
    else
        setModal({ kind: 'lesson' }); };
    const openSeries=()=>{setError('');if(!active.length){setModal({kind:'student'});setNotice(t('Сначала добавьте ученика'));}else setModal({kind:'series'});};
    const saveSeries=async(draft:SeriesDraft)=>{
        if(!active.some(student=>student.id===draft.studentId))throw Error(t('Сначала добавьте ученика'));
        const lessons=createSeriesLessons(draft,w.lessons);
        if(await commit({...w,lessons:[...w.lessons,...lessons]},'series_created')){setModal(null);setNotice(t('Создано занятий: {count}',{count:lessons.length}));}
    };
    const exportData = async () => { try {
        if (await repository.exportBackup(language)){
            analytics.track(scope,'backup_exported');
            setNotice(t("Резервная копия сохранена"));
        }
    }
    catch (e) {
        setError(errorText(e));
    } };
    const importData = async () => { try {
        const next = await repository.readBackup(language);
        if (next)
            setRestoring(next);
    }
    catch (e) {
        setError(errorText(e));
    } };
    const selectText={emptyLabel:t('Ничего не найдено'),searchLabel:t('Поиск…')};
    const zone= w.profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZones=[...new Set([zone,'Europe/Kyiv','Europe/Warsaw','Europe/Berlin','Europe/London','America/New_York',...(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):[])])];
    const languagePicker = <FormField label={t('Язык интерфейса')}><Select {...selectText} label={t('Язык интерфейса')} value={language} disabled={busy} options={languages.map(item=>({...item,description:t({ru:'Русский интерфейс',uk:'Украинский интерфейс',en:'Английский интерфейс'}[item.value])}))} onChange={next=>{if(w.profile)void commit({...w,profile:{...w.profile,language:next as Language}});else setWelcomeLanguage(next as Language);}}/><small className="muted">{t('Язык меняется сразу и сохраняется автоматически.')}</small></FormField>;
    const profileForm = (onboarding=false) => <form onSubmit={profileSubmit} className="profile-form">
      {languagePicker}
      <FormField label={t('Ваше имя')}><input name="name" defaultValue={w.profile?.name??''} required maxLength={100} placeholder={t('Как к вам обращаться?')} autoFocus={onboarding}/></FormField>
      <div className="form-row"><FormField label={t('Валюта')}><Select {...selectText} name="currency" label={t('Валюта')} defaultValue={w.profile?.currency??'UAH'} options={[{value:'UAH',label:t('Гривна · UAH')},{value:'EUR',label:t('Евро · EUR')},{value:'USD',label:t('Доллар · USD')}]}/></FormField>
      <FormField label={t('Часовой пояс')}><Select {...selectText} name="timeZone" label={t('Часовой пояс')} searchable defaultValue={zone} options={timeZones.map(value=>({value,label:value.replaceAll('_',' '),keywords:['Europe/Kyiv','Europe/Kiev'].includes(value)?'Kyiv Kiev Киев Київ':''}))}/></FormField></div>
      {w.profile&&<p className="muted">{t('Смена валюты меняет обозначение сумм, без конвертации.')}</p>}
      <button className="primary" disabled={busy}>{busy?t('Сохраняем…'):onboarding?t('Начать работу →'):t('Сохранить настройки')}</button>
    </form>;
    const errorBox = error && <div className="error" role="alert">{t(error)}<button aria-label={t("Закрыть ошибку")} onClick={() => setError('')}><X size={16}/></button></div>;
    if (loading)
        return <div className="splash">{t("Загружаем Lessavio…")}</div>;
    if (loadFailed)
        return <div className="onboard"><BookOpen size={38}/><h1>{t("Не удалось открыть данные")}</h1>{errorBox}<p className="muted">{t("Данные не изменены. Повторите попытку или проверьте доступ к папке приложения.")}</p><button onClick={boot}>{t("Попробовать снова")}</button></div>;
    if (!w.profile)
        return <div className="welcome"><div className="onboard"><div className="brand"><BookOpen /> Lessavio<span>web</span></div><div className="welcome-icon"><GraduationCap size={42}/></div><p className="eyebrow">{t("ВАШЕ ЛИЧНОЕ РАБОЧЕЕ ПРОСТРАНСТВО")}</p><h1>{t("Больше времени")}<br />{t("на преподавание.")}</h1><p className="muted">{t("Ученики, расписание и оплаты — в одном месте.")}<br />{t("Все данные остаются на вашем компьютере.")}</p>{errorBox}{accountPanel?.(language,busy)}{profileForm(true)}<div className="privacy"><ShieldCheck size={16}/>{" " + t(scope==='guest'?"Без регистрации. Работает без интернета.":"Учебные данные хранятся локально. Работает без интернета.")}</div></div><div className="welcome-aside"><span>{t("Меньше рутины.")}<br />{t("Больше ясности.")}</span><div className="sample"><CalendarDays /><strong>{t("Всё под контролем")}</strong><p>{t("Спокойный рабочий день начинается")}<br />{t("с понятного расписания.")}</p></div></div></div>;
    function lessonRows(items: Lesson[]) { return items.length ? <div className="lesson-list">{items.map(l => <div className={`lesson-row ${l.status === 'cancelled' ? 'cancelled' : ''}`} key={l.id}><div className="lesson-time"><strong>{time(l.startsAt)}</strong><small>{l.duration}{" " + t("мин")}</small></div><div className="lesson-stripe" style={{background:studentColor(student(l.studentId),w.students.findIndex(s=>s.id===l.studentId))}}/><button className="lesson-info" onClick={() => { setError(''); setModal({ kind: 'lesson', lesson: l }); }}><strong>{student(l.studentId)?.name}</strong><small>{student(l.studentId)?.subject || t("Индивидуальное занятие")} · {day(l.startsAt)}</small></button><span className={`pill ${l.status}`}>{l.status === 'completed' ? t("Проведено") : l.status === 'cancelled' ? t("Отменено") : t("Запланировано")}</span><strong className="lesson-price">{money(l.price)}</strong>{l.status === 'scheduled' && <button className="icon-button" disabled={busy} title={t("Отметить проведённым")} onClick={() => void commit({ ...w, lessons: w.lessons.map(x => x.id === l.id ? { ...x, status: 'completed' } : x) },'lesson_completed')}><Check size={18}/></button>}</div>)}</div> : <div className="empty"><CalendarDays size={32}/><h3>{t("Здесь пока свободно")}</h3><p>{t("Добавьте занятие, чтобы спланировать свой день.")}</p><button onClick={openLesson}><Plus size={16}/>{" " + t("Добавить занятие")}</button></div>; }
    return <div className="app"><WorkspaceNavigation view={view} language={language} name={w.profile.name} studentCount={active.length} onNavigate={setView}/><main><header><div className="breadcrumb">{t("Моё пространство") + " "}<span>/</span> {{ today: t("Сегодня"), calendar: t("Календарь"), students: t("Ученики"), finance:t('Финансы'), settings: t("Настройки") }[view]}</div><span className="offline"><i />{" " + t("Локальный режим")}</span></header><div className="content">{errorBox}<div className="page-heading"><div><p className="eyebrow">{view === 'today' ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: w.profile.timeZone }).format(new Date()) : t("LESSAVIO / ВАШЕ ПРОСТРАНСТВО")}</p><h1>{{ today: t('Хорошего дня, {name}', { name: w.profile.name.split(' ')[0] }), calendar: t("Ваше расписание"), students: t("Ваши ученики"), finance:t('Финансовая сводка'), settings: t("Настройки") }[view]}{view === 'today' && <span className="hello-dot">✳</span>}</h1><p className="muted">{{ today: t(kindMessages[messageIndex]), calendar: t("Планируйте занятия и оставляйте время для себя."), students: t("Прогресс начинается с внимания к каждому."), finance:t('Оплаты, проведённые занятия и баланс учеников.'), settings: t("Настройте пространство под себя.") }[view]}</p></div>{view !== 'settings' && view!=='finance' && <div className="page-actions">{view!=='students'&&<button onClick={openSeries}><Repeat2 size={17}/>{t('Регулярные занятия')}</button>}<button className="primary" onClick={view === 'students' ? () => { setError(''); setModal({ kind: 'student' }); } : openLesson}><Plus size={18}/>{view === 'students' ? t("Добавить ученика") : t("Добавить занятие")}</button></div>}</div>
 {view === 'today' && <><div className="stats"><div className="stat"><CalendarDays /><span>{t("Занятия сегодня")}</span><strong>{todayLessons.filter(l => l.status !== 'cancelled').length}<small>{t("занятий")}</small></strong><p>{todayLessons.filter(l => l.status === 'completed').length}{" " + t("уже проведено")}</p></div><div className="stat"><Users /><span>{t("Активные ученики")}</span><strong>{active.length}<small>{t("учеников")}</small></strong><p>{t("Ваше учебное сообщество")}</p></div><div className="stat"><Wallet /><span>{t("Ожидают оплаты")}</span><strong>{money(debt)}</strong><p>{t("За проведённые занятия")}</p></div></div><div className="dashboard-grid"><section className="card schedule"><div className="section-heading"><div><h2>{t("Расписание на сегодня")}</h2><p className="muted">{t("Один день — много маленьких побед")}</p></div><button className="text-button" onClick={() => setView('calendar')}>{t("Календарь") + " "}<ArrowUpRight size={16}/></button></div>{lessonRows(todayLessons)}</section><section className="next-card"><span className="eyebrow">{t("СЛЕДУЮЩЕЕ ЗАНЯТИЕ")}</span><div className="next-icon"><GraduationCap size={30}/></div>{upcoming ? <><h2>{student(upcoming.studentId)?.name}</h2><p>{student(upcoming.studentId)?.subject}</p><div className="next-time">{time(upcoming.startsAt)}<small>{day(upcoming.startsAt)} · {upcoming.duration}{" " + t("мин")}</small></div><button onClick={() => setModal({ kind: 'lesson', lesson: upcoming })}>{t("Открыть занятие") + " "}<ArrowUpRight size={16}/></button></> : <><h2>{t("Время для новых планов")}</h2><p>{t("Следующее занятие появится здесь, как только вы его добавите.")}</p><button onClick={openLesson}>{t("Запланировать") + " "}<Plus size={16}/></button></>}</section></div><div className="bottom-note"><ShieldCheck size={16}/>{" " + t("Все изменения сохраняются на этом компьютере.")}</div></>}
 {view==='calendar'&&<Calendar lessons={scheduleLessons} students={w.students} language={language} timeZone={w.profile.timeZone} busy={busy} onOpen={lesson=>setModal({kind:'lesson',lesson})} onMove={async(id,date,time)=>{const moved=moveLesson(w.lessons,id,date,time,w.profile!.timeZone);const saved=await commit({...w,lessons:w.lessons.map(l=>l.id===id?moved:l)},'lesson_rescheduled');if(saved)setNotice(t('Занятие перенесено'));return saved;}}/>}
 {view==='finance'&&<Finance workspace={w} language={language} onStudent={id=>{const student=w.students.find(s=>s.id===id);if(student)setModal({kind:'student',student});}}/>}
 {view === 'students' && <><div className="toolbar"><div className="search"><Search size={17}/><input aria-label={t("Поиск учеников")} placeholder={t("Найти ученика…")} value={query} onChange={e => setQuery(e.target.value)}/></div><label className="checkbox"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/>{" " + t("Показать архив")}</label></div><div className="student-grid">{w.students.filter(s => (showArchived || !s.archived) && `${s.name} ${s.subject}`.toLowerCase().includes(query.toLowerCase())).map(s => <article className="card student-card" key={s.id}><div className="student-top"><div className="avatar large" style={{background:`${studentColor(s,w.students.indexOf(s))}20`,color:studentColor(s,w.students.indexOf(s))}}>{s.name.slice(0, 1).toUpperCase()}</div><button className="text-button" onClick={() => { setError(''); setModal({ kind: 'student', student: s }); }}>{t("Изменить") + " "}<ArrowUpRight size={15}/></button></div><h2>{s.name}{s.archived && <span className="pill">{t("Архив")}</span>}</h2><p className="muted">{s.subject || t("Предмет не указан")}</p>{s.phone && <p>{s.phone}</p>}{s.notes && <p className="student-notes">{s.notes}</p>}<div className="student-meta"><span>{t("Стоимость занятия")}<strong>{money(s.price)}</strong></span><span>{t("Баланс")}<strong className={balance(w, s.id) < 0 ? 'negative' : 'positive'}>{money(balance(w, s.id))}</strong></span></div><small className="muted">{t("Минус — задолженность · плюс — предоплата")}</small><button className="payment-button" onClick={() => { setError(''); setModal({ kind: 'payment', studentId: s.id }); }}><Plus size={16}/>{" " + t("Записать оплату")}</button>{!s.archived&&<button className="payment-button" onClick={()=>{setError('');setModal({kind:'series',studentId:s.id});}}><Repeat2 size={16}/>{t('Регулярные занятия')}</button>}</article>)}</div>{!w.students.length && <div className="card empty"><Users size={34}/><h3>{t("Познакомимся с вашими учениками")}</h3><p>{t("Добавьте первого ученика, чтобы начать планировать занятия.")}</p><button onClick={() => setModal({ kind: 'student' })}>{t("Добавить ученика")}</button></div>}</>}
 {view === 'settings' && <div className="settings-grid">{accountPanel?.(language,busy)}<section className="card settings-card"><h2>{t("Личный профиль")}</h2><p className="muted">{t("Один репетитор — одно личное пространство.")}</p>{profileForm()}</section><section className="card settings-card"><div className="backup-icon"><ShieldCheck size={27}/></div><h2>{t("Ваши данные — у вас")}</h2><p className="muted">{t("База хранится в системной папке Lessavio. Обновления приложения сохраняют ваши данные.")}</p><div className="backup-info">{t("Сохраняйте резервную копию на другой диск, чтобы защитить данные при поломке компьютера. Копия содержит личные данные без шифрования.")}</div><button disabled={busy} onClick={() => void exportData()}><Download size={17}/>{" " + t("Сохранить резервную копию")}</button><button disabled={busy} onClick={() => void importData()}><Upload size={17}/>{" " + t("Восстановить из копии")}</button><p className="muted">Lessavio Web · {version}</p></section><AnalyticsSettings scope={scope} language={language} busy={busy}/><Reminders language={language} minutes={w.profile.reminderMinutes??0} busy={busy} onChange={minutes=>commit({...w,profile:{...w.profile!,reminderMinutes:minutes}})}/></div>}
 </div></main>{notice && <div className="toast" role="status"><Check size={17}/>{t(notice)}</div>}
 {modal?.kind==='editSeries'&&<SeriesEdit lesson={modal.lesson} workspace={w} language={language} busy={busy} error={error} onClose={()=>{setModal(null);setError('');}} onSave={async(draft,scope)=>{const lessons=replaceSeries(w.lessons,modal.lesson.seriesId!,draft,scope,Date.now());if(await commit({...w,lessons},'series_updated')){setModal(null);setNotice(t('Серия обновлена'));}}}/>}
 {modal?.kind==='series'&&<SeriesEditor students={active} lessons={w.lessons} language={language} timeZone={w.profile.timeZone} currency={w.profile.currency} busy={busy} initialStudentId={modal.studentId} error={error} onClose={()=>{setModal(null);setError('');}} onSingle={()=>{setModal({kind:'lesson'});setError('');}} onSave={saveSeries}/>}
 {modal && modal.kind!=='series' && modal.kind!=='editSeries' && <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="section-heading"><h2 id="modal-title">{modal.kind === 'student' ? (modal.student ? t("Карточка ученика") : t("Новый ученик")) : modal.kind === 'lesson' ? (modal.lesson ? t("Занятие") : t("Новое занятие")) : t("Записать оплату")}</h2><button aria-label={t("Закрыть")} disabled={busy} onClick={() => { setModal(null); setError(''); }}><X size={20}/></button></div>{errorBox}{modal.kind==='lesson'&&!modal.lesson&&<div className="lesson-mode"><button type="button" className="selected" aria-pressed="true"><CalendarDays size={16}/>{t('Разовое занятие')}</button><button type="button" onClick={()=>{setError('');setModal({kind:'series'});}}><Repeat2 size={16}/>{t('Регулярные занятия')}</button></div>}<form onSubmit={submitModal}>{modal.kind === 'student' ? <><FormField label={t("Имя ученика")}><input name="name" required maxLength={100} defaultValue={modal.student?.name} autoFocus/></FormField><div className="form-row"><FormField label={t("Предмет")}><input name="subject" maxLength={200} defaultValue={modal.student?.subject}/></FormField><FormField label={t("Стоимость занятия")}><input name="price" inputMode="decimal" required defaultValue={(modal.student?.price ?? 0) / 100}/></FormField></div><fieldset className="color-picker"><legend>{t('Цвет ученика')}</legend>{studentColors.map((color,index)=><label key={color} style={{background:color}}><input type="radio" name="color" value={color} aria-label={t('Цвет {number}',{number:index+1})} defaultChecked={color===(modal.student?studentColor(modal.student,w.students.indexOf(modal.student)):nextStudentColor(w.students))}/><Check size={18}/></label>)}</fieldset><FormField label={t("Телефон")}><input name="phone" maxLength={100} defaultValue={modal.student?.phone}/></FormField><FormField label={t("Заметки")}><textarea name="notes" maxLength={10000} defaultValue={modal.student?.notes}/></FormField>{modal.student && <button type="button" disabled={busy} onClick={async () => { if (await commit({ ...w, students: w.students.map(s => s.id === modal.student!.id ? { ...s, archived: !s.archived } : s) }))
        setModal(null); }}>{modal.student.archived ? t("Вернуть из архива") : t("Архивировать ученика")}</button>}</> : modal.kind === 'lesson' ? <><FormField label={t("Ученик")}><Select {...selectText} name="studentId" label={t('Ученик')} searchable defaultValue={modal.lesson?.studentId??active[0]?.id} options={w.students.filter(s=>!s.archived||s.id===modal.lesson?.studentId).map(s=>({value:s.id,label:s.name,description:[s.subject,money(s.price)].filter(Boolean).join(' · ')}))} onChange={(value,form)=>{const price=form?.elements.namedItem('price') as HTMLInputElement|null;if(price)price.value=String((student(value)?.price??0)/100);}}/></FormField><FormField label={t('Дата и время · {zone} (часовой пояс компьютера)', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}><DateTimePicker key={modal.lesson?.id??'new'} defaultValue={modal.lesson?.startsAt} language={language}/></FormField><div className="form-row"><FormField label={t("Длительность, мин")}><div className="duration-control"><input aria-label={t("Длительность, мин")} name="duration" type="number" min={15} max={480} required defaultValue={modal.lesson?.duration??60}/><div className="duration-presets">{[30,45,60,90].map(minutes=><button type="button" key={minutes} onClick={e=>{const input=e.currentTarget.form?.elements.namedItem('duration') as HTMLInputElement|null;if(input)input.value=String(minutes);}}>{minutes}</button>)}</div></div></FormField><FormField label={t("Стоимость")}><input name="price" inputMode="decimal" required defaultValue={(modal.lesson?.price ?? active[0]?.price ?? 0) / 100}/></FormField></div><FormField label={t("Статус")}><Select {...selectText} name="status" label={t('Статус')} defaultValue={modal.lesson?.status??'scheduled'} options={[{value:'scheduled',label:t('Запланировано'),description:t('Занятие ещё не проведено')},{value:'completed',label:t('Проведено'),description:t('Стоимость учитывается в балансе')},{value:'cancelled',label:t('Отменено'),description:t('Без списания стоимости')}]}/></FormField><FormField label={t("Заметки")}><textarea name="notes" maxLength={10000} defaultValue={modal.lesson?.notes}/></FormField>{modal.lesson?.seriesId&&<div className="series-membership"><button type="button" disabled={busy} onClick={()=>{setError('');setModal({kind:'editSeries',lesson:modal.lesson!});}}>{t('Изменить серию')}</button><Repeat2 size={16}/><p>{t('Это занятие входит в серию. Изменения сохранятся только для этой даты.')} {t('Если выбрать другого ученика, это занятие станет разовым.')}</p><button type="button" disabled={busy} onClick={()=>setCancelSeries(true)}>{t('Отменить будущие занятия серии')}</button>{cancelSeries&&<div className="series-cancel-confirm" role="alertdialog" aria-label={t('Отменить будущие занятия серии')}><p>{t('Отменить все будущие запланированные занятия этой серии? Проведённые занятия и оплаты сохранятся.')}</p><div className="modal-footer"><button type="button" disabled={busy} onClick={()=>setCancelSeries(false)}>{t('Назад')}</button><button type="button" className="primary" disabled={busy} onClick={async()=>{const seriesId=modal.lesson?.seriesId;if(!seriesId)return;if(await commit({...w,lessons:cancelUpcomingSeries(w.lessons,seriesId,Date.now())},'series_cancelled')){setModal(null);setNotice(t('Будущие занятия серии отменены'));}}}>{t('Подтвердить отмену')}</button></div></div>}</div>}</> : <><p className="muted">{student(modal.studentId)?.name}</p><FormField label={t('Сумма · {currency}', { currency: w.profile.currency })}><input name="amount" inputMode="decimal" required autoFocus/></FormField><p className="muted">{t("Оплата увеличит баланс ученика. Стоимость списывается за проведённые занятия.")}</p><div className="payment-history">{w.payments.filter(p => p.studentId === modal.studentId).sort((a, b) => Date.parse(b.paidAt)-Date.parse(a.paidAt)).map(p => <div key={p.id}><span>{day(p.paidAt)} · {money(p.amount)}</span><button type="button" disabled={busy} aria-label={t("Удалить ошибочную оплату")} onClick={() => { if (window.confirm(t("Удалить эту оплату?")))
        void commit({ ...w, payments: w.payments.filter(x => x.id !== p.id) },'payment_deleted'); }}><X size={14}/></button></div>)}</div></>}<div className="modal-footer"><button type="button" disabled={busy} onClick={() => { setModal(null); setError(''); }}>{t("Отмена")}</button><button className="primary" disabled={busy}>{busy ? t("Сохраняем…") : t("Сохранить")}</button></div></form></section></div>}
 {restoring && <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true"><h2>{t("Восстановить данные?")}</h2><p>{t('Текущие данные будут заменены: {students} учеников, {lessons} занятий. Сначала рекомендуем сохранить текущую резервную копию.', { students: restoring.students.length, lessons: restoring.lessons.length })}</p><div className="modal-footer"><button disabled={busy} onClick={() => setRestoring(null)}>{t("Отмена")}</button><button className="primary" disabled={busy} onClick={async () => { if (await commit(restoring,'backup_restored')) {
        setRestoring(null);
        setNotice(t("Данные восстановлены"));
    } }}>{t("Восстановить")}</button></div>{errorBox}</section></div>}
 </div>;
}
