import { visibleLessons, studentColor, studentColors, nextStudentColor } from '../features/students/model/studentColors.ts';
import { moveLesson, inferSeriesDraft, editableSeries, replaceSeries, zonedDate, zonedTime } from '../features/calendar/model/planning.ts';
import { financialSummary } from '../features/finance/model/finance.ts';
import { generateOccurrences, createSeriesLessons, seriesConflicts, cancelUpcomingSeries, type RecurrenceRule } from '../features/calendar/model/recurrence.ts';
import { defaultLanguage, translator, locales } from '../shared/i18n/index.ts';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { balance, emptyWorkspace, hasConflict, moneyInput, validateWorkspace, type Lesson } from '../domain/workspace.ts';
const lesson:Lesson={id:'l1',studentId:'s1',startsAt:'2026-10-23T10:00:00Z',duration:60,price:50000,status:'completed',notes:''};
test('money uses exact minor units and rejects invalid input',()=>{assert.equal(moneyInput('123,45'),12345);assert.equal(moneyInput('0.29'),29);for(const v of ['-1','1.234','NaN','1e5',''])assert.throws(()=>moneyInput(v));});
test('overlapping lessons blocked; adjacent and cancelled allowed',()=>{assert.equal(hasConflict([lesson],{...lesson,id:'l2',startsAt:'2026-10-23T10:30:00Z'}),true);assert.equal(hasConflict([lesson],{...lesson,id:'l2',startsAt:'2026-10-23T11:00:00Z'}),false);assert.equal(hasConflict([lesson],{...lesson,id:'l2',status:'cancelled'}),false);assert.equal(hasConflict([lesson],lesson),false);});
test('balance charges only completed lessons and includes prepayments',()=>{const w={...emptyWorkspace(),lessons:[lesson,{...lesson,id:'l2',status:'scheduled' as const},{...lesson,id:'l3',status:'cancelled' as const}],payments:[{id:'p',studentId:'s1',amount:30000,paidAt:lesson.startsAt}]};assert.equal(balance(w,'s1'),-20000);assert.equal(balance(w,'other'),0);});
test('backup validation rejects broken references, duplicates, currency and amounts',()=>{const w={...emptyWorkspace(),students:[{id:'s1',name:'Анна',subject:'English',phone:'',price:50000,notes:'',archived:false}],lessons:[lesson]};validateWorkspace(w);assert.throws(()=>validateWorkspace({...w,students:[]}));assert.throws(()=>validateWorkspace({...w,lessons:[lesson,lesson]}));assert.throws(()=>validateWorkspace({...w,students:[{...w.students[0],price:0.1}]}));assert.throws(()=>validateWorkspace({...w,profile:{name:'Tutor',currency:'BAD',timeZone:'Europe/Kyiv'}}));});


test('language preferences round-trip and legacy profiles remain valid',()=>{
 const profile={name:'Tutor',currency:'UAH' as const,timeZone:'Europe/Kyiv'};
 const legacy={...emptyWorkspace(),profile}; validateWorkspace(legacy);
 for(const language of ['ru','uk','en'] as const){
  const w=JSON.parse(JSON.stringify({...legacy,profile:{...profile,language}}));
  validateWorkspace(w); assert.equal(w.profile?.language,language);
 }
 assert.throws(()=>validateWorkspace({...legacy,profile:{...profile,language:'de'}}));
});

test('English first-run default, interpolation and localized date formatting',()=>{
 assert.equal(defaultLanguage,'en');
 assert.equal(translator('en')('Хорошего дня, {name}',{name:'Alex'}),'Have a good day, Alex');
 assert.equal(translator('uk')('Настройки'),'Налаштування');
 assert.equal(translator('ru')('Настройки'),'Настройки');
 assert.equal(translator('en')('Некорректный профиль'),'Invalid profile');
 assert.equal(translator('en')('Unexpected disk error'),'Unexpected disk error');
 const date=new Date('2026-10-23T12:00:00Z');
 assert.match(new Intl.DateTimeFormat(locales.en,{month:'long',timeZone:'UTC'}).format(date),/October/);
 assert.match(new Intl.DateTimeFormat(locales.uk,{month:'long',timeZone:'UTC'}).format(date),/жовтень/);
});
test('all dictionaries have matching keys and interpolation placeholders',()=>{
 const dictionaries=['ru','uk','en'].map(language=>JSON.parse(readFileSync(new URL(`../shared/i18n/locales/${language}.json`,import.meta.url),'utf8')) as Record<string,string>);
 const placeholders=(text:string)=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
 for(const dictionary of dictionaries){
  assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(dictionaries[0]).sort());
  for(const [key,value] of Object.entries(dictionary)){
   assert.ok(value.trim()); assert.deepEqual(placeholders(value),placeholders(key),key);
  }
 }
});

// Recurrence uses the tutor's selected IANA time zone, independently of the test machine.

const weeklyRule:RecurrenceRule={startDate:'2026-10-19',endDate:'2026-11-01',intervalWeeks:1,timeZone:'Europe/Kyiv',slots:[{weekday:1,time:'16:00'},{weekday:5,time:'18:00'},{weekday:6,time:'12:30'}]};
test('weekly lessons preserve different weekday times, inclusive boundaries, and DST',()=>{
 const occurrences=generateOccurrences(weeklyRule);
 assert.deepEqual(occurrences.map(o=>[o.localDate,o.localTime]),[['2026-10-19','16:00'],['2026-10-23','18:00'],['2026-10-24','12:30'],['2026-10-26','16:00'],['2026-10-30','18:00'],['2026-10-31','12:30']]);
 assert.equal(occurrences[0].startsAt,'2026-10-19T13:00:00.000Z');
 assert.equal(occurrences[3].startsAt,'2026-10-26T14:00:00.000Z');
 assert.equal(generateOccurrences({...weeklyRule,startDate:'2026-10-23',endDate:'2026-10-23'}).length,1);
});
test('biweekly schedule anchors to Monday of the start week',()=>{
 const occurrences=generateOccurrences({...weeklyRule,startDate:'2026-10-23',endDate:'2026-11-13',intervalWeeks:2});
 assert.deepEqual(occurrences.map(o=>o.localDate),['2026-10-23','2026-10-24','2026-11-02','2026-11-06','2026-11-07']);
});
test('recurrence rejects empty slots, invalid dates, times, duplicates and unbounded ranges',()=>{
 for(const change of [{slots:[]},{startDate:'2026-02-30'},{endDate:'2026-01-01'},{endDate:'2028-01-01'},{slots:[{weekday:1,time:'25:00'}]},{slots:[{weekday:1,time:'16:00'},{weekday:1,time:'18:00'}]},{timeZone:'Invalid/Zone'}])assert.throws(()=>generateOccurrences({...weeklyRule,...change}));
 assert.throws(()=>generateOccurrences({...weeklyRule,startDate:'2026-10-20',endDate:'2026-10-20'}));
});
test('DST gaps and ambiguities are explicit errors instead of silently changing lesson times',()=>{
 assert.throws(()=>generateOccurrences({...weeklyRule,timeZone:'America/New_York',startDate:'2026-03-08',endDate:'2026-03-08',slots:[{weekday:7,time:'02:30'}]}),/не существует/);
 assert.throws(()=>generateOccurrences({...weeklyRule,timeZone:'America/New_York',startDate:'2026-11-01',endDate:'2026-11-01',slots:[{weekday:7,time:'01:30'}]}),/неоднозначно/);
});
test('a conflicting series creates nothing; cancelled conflicts and adjacent lessons are allowed',()=>{
 const draft={studentId:'s1',duration:60,price:50000,notes:'Weekly',rule:weeklyRule};
 const existing={...lesson,startsAt:'2026-10-19T13:30:00.000Z'};
 const original=[existing];
 assert.equal(seriesConflicts(generateOccurrences(weeklyRule),original,60).length,1);
 assert.throws(()=>createSeriesLessons(draft,original),/пересечения/);
 assert.deepEqual(original,[existing]);
 assert.throws(()=>createSeriesLessons(draft,[{...existing,id:'$series-preview$0'}]),/пересечения/);
 assert.equal(createSeriesLessons(draft,[{...existing,status:'cancelled'}]).length,6);
 assert.equal(createSeriesLessons(draft,[{...existing,startsAt:'2026-10-19T14:00:00.000Z'}]).length,6);
});
test('overnight lessons within a series cannot overlap each other',()=>{
 const rule={...weeklyRule,slots:[{weekday:1,time:'23:30'},{weekday:2,time:'00:00'}]};
 assert.throws(()=>createSeriesLessons({studentId:'s1',duration:60,price:100,notes:'',rule},[]),/пересечения/);
});
test('series IDs, history and backward-compatible backups round-trip',()=>{
 let i=0;const lessons=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'Weekly',rule:weeklyRule},[],()=>`test-${i++}`);
 assert.equal(new Set(lessons.map(l=>l.seriesId)).size,1);assert.equal(new Set(lessons.map(l=>l.id)).size,6);
 const w={...emptyWorkspace(),students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false}],lessons};
 const restored=JSON.parse(JSON.stringify(w));validateWorkspace(restored);assert.equal(restored.lessons[0].seriesId,'test-0');
 validateWorkspace({...w,lessons:[lesson]});
 assert.throws(()=>validateWorkspace({...w,lessons:[{...lessons[0],seriesId:''}]}));
});

test('cancelling future occurrences keeps history, completed charges and other series intact',()=>{
 const lessons:Lesson[]=[
  {...lesson,id:'past',seriesId:'series',startsAt:'2026-10-01T10:00:00Z',status:'scheduled'},
  {...lesson,id:'future',seriesId:'series',startsAt:'2026-11-01T10:00:00Z',status:'scheduled'},
  {...lesson,id:'completed',seriesId:'series',startsAt:'2026-11-01T12:00:00Z',status:'completed'},
  {...lesson,id:'other',seriesId:'other',startsAt:'2026-11-02T10:00:00Z',status:'scheduled'}
 ];
 const result=cancelUpcomingSeries(lessons,'series',Date.parse('2026-10-23T00:00:00Z'));
 assert.deepEqual(result.map(l=>l.status),['scheduled','cancelled','completed','scheduled']);
 assert.equal(lessons[1].status,'scheduled');
 const w={...emptyWorkspace(),lessons};assert.equal(balance({...w,lessons:result},'s1'),balance(w,'s1'));
});


test('moving a lesson uses profile timezone, retains series membership, and protects completed lessons',()=>{
 const original={...lesson,status:'scheduled' as const,seriesId:'series',startsAt:'2026-10-23T13:00:00Z'};
 const moved=moveLesson([original],original.id,'2026-10-26','16:00','Europe/Kyiv');
 assert.equal(moved.startsAt,'2026-10-26T14:00:00.000Z');assert.equal(moved.seriesId,'series');assert.equal(original.startsAt,'2026-10-23T13:00:00Z');
 assert.throws(()=>moveLesson([lesson],lesson.id,'2026-10-26','16:00','Europe/Kyiv'),/только запланированные/);
 assert.throws(()=>moveLesson([original,{...original,id:'busy',startsAt:moved.startsAt}],original.id,'2026-10-26','16:00','Europe/Kyiv'),/уже есть/);
 assert.equal(zonedDate(moved.startsAt,'Europe/Kyiv'),'2026-10-26');assert.equal(zonedTime(moved.startsAt,'Europe/Kyiv'),'16:00');
});
test('series editing replaces only selected scheduled occurrences and preserves history and payments',()=>{
 let id=0;const created=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'',rule:weeklyRule},[],()=>`edit-${id++}`);
 const now=Date.parse('2026-10-25T00:00:00Z');
 const original=created.map((l,i)=>i===0?{...l,status:'completed' as const}:i===4?{...l,status:'cancelled' as const}:l);
 const draft=inferSeriesDraft(original[0],original,'Europe/Kyiv','future',now);
 draft.rule.slots=draft.rule.slots.map(s=>({...s,time:s.weekday===1?'19:00':s.time}));
 const updated=replaceSeries(original,original[0].seriesId!,draft,'future',now,()=>`new-${id++}`);
 assert.deepEqual(updated.find(l=>l.id===original[0].id),original[0]);
 assert.deepEqual(updated.find(l=>l.id===original[1].id),original[1]);
 assert.deepEqual(updated.find(l=>l.id===original[4].id),original[4]);
 assert.equal(updated.filter(l=>l.status==='scheduled'&&Date.parse(l.startsAt)>=now).some(l=>zonedTime(l.startsAt,'Europe/Kyiv')==='19:00'),true);
 assert.equal(original[3].startsAt,created[3].startsAt);
});
test('editing all scheduled lessons still protects completed and cancelled records; conflicts are atomic',()=>{
 let id=0;const original=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'',rule:weeklyRule},[],()=>`all-${id++}`);
 original[0].status='completed';original[1].status='cancelled';const now=Date.parse('2026-11-05T00:00:00Z');
 const draft=inferSeriesDraft(original[2],original,'Europe/Kyiv','scheduled',now);
 assert.equal(editableSeries(original,original[0].seriesId!,'future',now).length,0);
 const updated=replaceSeries(original,original[0].seriesId!,draft,'scheduled',now,()=>`allnew-${id++}`);
 assert.deepEqual(updated.find(l=>l.id===original[0].id),original[0]);assert.deepEqual(updated.find(l=>l.id===original[1].id),original[1]);
 const blocked=[...original,{...original[2],id:'outside',seriesId:undefined,startsAt:original[2].startsAt}];
 const snapshot=JSON.stringify(blocked);assert.throws(()=>replaceSeries(blocked,original[0].seriesId!,draft,'scheduled',now),/пересечения/);assert.equal(JSON.stringify(blocked),snapshot);
});
test('legacy biweekly series can be inferred without recurrence metadata',()=>{
 let id=0;const original=createSeriesLessons({studentId:'s1',duration:60,price:100,notes:'',rule:{...weeklyRule,endDate:'2026-12-01',intervalWeeks:2}},[],()=>`legacy-${id++}`).map(({seriesRule,...lesson})=>lesson);
 const draft=inferSeriesDraft(original[0],original,'Europe/Kyiv','scheduled',Date.parse('2026-10-20T00:00:00Z'));
 assert.equal(draft.rule.intervalWeeks,2);assert.deepEqual(draft.rule.slots,weeklyRule.slots);
});
test('financial summary separates month cash from lesson value and carries previous balances',()=>{
 const w={...emptyWorkspace(),students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false},{id:'s2',name:'Ben',subject:'',phone:'',price:50000,notes:'',archived:true}],lessons:[{...lesson,id:'sept',startsAt:'2026-09-10T12:00:00Z',price:50000},{...lesson,id:'oct',startsAt:'2026-10-10T12:00:00Z',price:30000},{...lesson,id:'future',startsAt:'2026-10-20T12:00:00Z',status:'scheduled' as const,price:20000},{...lesson,id:'cancel',status:'cancelled' as const,price:90000}],payments:[{id:'p1',studentId:'s1',amount:20000,paidAt:'2026-10-10T00:00:00Z'},{id:'p2',studentId:'s2',amount:40000,paidAt:'2026-09-01T00:00:00Z'},{id:'later',studentId:'s1',amount:100000,paidAt:'2026-11-01T12:00:00Z'}]};
 const summary=financialSummary(w,'2026-10','Europe/Kyiv');
 assert.equal(summary.received,20000);assert.equal(summary.earned,30000);assert.equal(summary.debt,60000);assert.equal(summary.credit,40000);assert.equal(summary.planned,20000);assert.equal(summary.rows.length,2);
 assert.equal(financialSummary(w,'2026-09','Europe/Kyiv').debt,50000);
});
test('finance month boundaries follow the profile time zone and reminder settings survive backups',()=>{
 const w={...emptyWorkspace(),profile:{name:'Tutor',currency:'UAH' as const,timeZone:'Europe/Kyiv',reminderMinutes:15},students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false}],lessons:[{...lesson,startsAt:'2026-09-30T22:30:00Z'}],payments:[]};
 assert.equal(financialSummary(w,'2026-10','Europe/Kyiv').earned,50000);assert.equal(financialSummary(w,'2026-09','Europe/Kyiv').earned,0);
 const backup=JSON.parse(JSON.stringify(w));validateWorkspace(backup);assert.equal(backup.profile!.reminderMinutes,15);
 assert.throws(()=>validateWorkspace({...w,profile:{...w.profile,reminderMinutes:7}}));
});

test('series edits do not recreate completed or cancelled dates inside the range',()=>{
 const rule:RecurrenceRule={startDate:'2026-11-02',endDate:'2026-11-23',intervalWeeks:1,timeZone:'UTC',slots:[{weekday:1,time:'16:00'}]};
 const draft={studentId:'s1',duration:60,price:50000,notes:'',rule};let sequence=0;
 const initial=createSeriesLessons(draft,[],()=>String(++sequence));
 initial[1].status='completed';initial[2].status='cancelled';
 const result=replaceSeries(initial,initial[0].seriesId!,{...draft,rule:{...rule,slots:[{weekday:1,time:'18:00'}]}},'scheduled',0,()=>String(++sequence));
 assert.equal(result.length,4);assert.equal(result.filter(l=>l.status==='scheduled').length,2);
 assert.equal(result.find(l=>l.id===initial[1].id)?.startsAt,initial[1].startsAt);
});

test('account scopes isolate projects, users and local guest data',async()=>{
 const {accountScope}=await import('../features/auth/model/authPolicy.ts');
 assert.notEqual(accountScope('demo-lessavio','alice'),accountScope('demo-lessavio','bob'));
 assert.notEqual(accountScope('project-a','alice'),accountScope('project-b','alice'));
 assert.notEqual(accountScope('demo-lessavio','alice'),'guest');
 assert.throws(()=>accountScope('project','../alice'));
 assert.throws(()=>accountScope('','alice'));
});
test('auth errors are localized without exposing provider details',async()=>{
 const {authErrorKey}=await import('../features/auth/model/authPolicy.ts');
 assert.equal(authErrorKey({code:'auth/wrong-password'}),authErrorKey({code:'auth/user-not-found'}));
 assert.equal(authErrorKey({code:'auth/network-request-failed'}),'Для этого действия нужен интернет');
 assert.equal(authErrorKey(new Error('secret server detail')),'Не удалось выполнить действие с аккаунтом. Попробуйте снова');
 for(const code of ['auth/invalid-email','auth/weak-password','auth/too-many-requests','auth/operation-not-allowed'])assert.notEqual(translator('en')(authErrorKey({code})),authErrorKey({code}));
});

test('analytics consent defaults to off and events cannot carry arbitrary personal fields',async()=>{
 const {ConsentAnalytics,hasAnalyticsConsent,analyticsConsentKey}=await import('../features/analytics/model/analyticsPolicy.ts');
 assert.equal(hasAnalyticsConsent(null),false);assert.equal(hasAnalyticsConsent('true'),false);assert.equal(hasAnalyticsConsent('granted'),true);
 assert.notEqual(analyticsConsentKey('guest'),analyticsConsentKey('firebase:project:alice'));
 const events:{name:string;params:Record<string,string>}[]=[];let loads=0;
 const context={platform:'desktop' as const,operating_system:'macos' as const,app_version:'0.5.0',ui_language:'en' as const,email:'private@example.test',notes:'Private note'};
 const service=new ConsentAnalytics(context,async()=>{loads++;return {emit:(name,params)=>events.push({name,params})};},()=>{});
 await service.activate('firebase:project:alice',false);service.track('firebase:project:alice','student_created');assert.equal(loads,0);assert.equal(events.length,0);
 await service.activate('firebase:project:alice',true);service.track('firebase:project:alice','payment_recorded');service.track('guest','payment_recorded');
 service.track('firebase:project:alice','private@example.test' as never);
 assert.deepEqual(events.map(e=>e.name),['app_opened','payment_recorded']);
 assert.equal(JSON.stringify(events).includes('private'),false);assert.equal(JSON.stringify(events).includes('alice'),false);
 service.deactivate();service.track('firebase:project:alice','student_created');assert.equal(events.length,2);
});
test('revoking consent during initialization drops queued events and prevents late startup',async()=>{
 const {ConsentAnalytics}=await import('../features/analytics/model/analyticsPolicy.ts');let ready!:(transport:import('../features/analytics/model/analyticsPolicy.ts').AnalyticsTransport)=>void;const names:string[]=[];
 const service=new ConsentAnalytics({platform:'web',operating_system:'other',app_version:'0.5.0',ui_language:'en'},()=>new Promise(resolve=>{ready=resolve;}),()=>{});
 const activation=service.activate('guest',true);service.track('guest','student_created');service.setScreen('guest','students');service.deactivate('guest');
 ready({emit:name=>names.push(name)});await activation;assert.deepEqual(names,[]);assert.equal(service.getStatus(),'off');
});
test('switching workspaces discards the previous analytics queue and stale initialization',async()=>{
 const {ConsentAnalytics}=await import('../features/analytics/model/analyticsPolicy.ts');type Transport=import('../features/analytics/model/analyticsPolicy.ts').AnalyticsTransport;
 const resolvers:((transport:Transport)=>void)[]=[];const names:string[]=[];
 const service=new ConsentAnalytics({platform:'desktop',operating_system:'windows',app_version:'0.5.0',ui_language:'en'},()=>new Promise(resolve=>resolvers.push(resolve)),()=>{});
 const first=service.activate('guest',true);service.track('guest','payment_recorded');
 const second=service.activate('firebase:p:bob',true);service.setScreen('firebase:p:bob','finance');service.track('firebase:p:bob','backup_exported');
 resolvers[1]({emit:name=>names.push(name)});await second;resolvers[0]({emit:name=>names.push('stale:'+name)});await first;
 assert.deepEqual(names,['app_opened','screen_view','backup_exported']);service.deactivate('guest');assert.equal(service.getStatus(),'enabled');
});
test('analytics failures and unsupported environments do not interrupt local work',async()=>{
 const {ConsentAnalytics}=await import('../features/analytics/model/analyticsPolicy.ts');
 const context={platform:'web' as const,operating_system:'linux' as const,app_version:'0.5.0',ui_language:'uk' as const};
 const unsupported=new ConsentAnalytics(context,async()=>null,()=>{});await unsupported.activate('guest',true);assert.equal(unsupported.getStatus(),'unsupported');
 const failed=new ConsentAnalytics(context,async()=>{throw Error('offline');},()=>{});await failed.activate('guest',true);assert.equal(failed.getStatus(),'error');
 const broken=new ConsentAnalytics(context,async()=>({emit:()=>{throw Error('blocked');}}),()=>{});await broken.activate('guest',true);assert.doesNotThrow(()=>broken.track('guest','backup_restored'));
});

test('backup validation rejects malformed recurrence rules and impossible timestamps',()=>{
 const w={...emptyWorkspace(),students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false}],lessons:[lesson]};
 for(const rule of [null,{...weeklyRule,startDate:'2026-02-30'},{...weeklyRule,endDate:'2026-01-01'},{...weeklyRule,endDate:'2028-12-31'},{...weeklyRule,timeZone:undefined},{...weeklyRule,slots:[null]}]){
  assert.throws(()=>validateWorkspace({...w,lessons:[{...lesson,seriesRule:rule}]}),/Некорректные данные занятия/);
 }
 for(const startsAt of ['2026-02-30T10:00:00Z','2026-10-23','2026-10-23T25:00:00Z','10/23/2026'])assert.throws(()=>validateWorkspace({...w,lessons:[{...lesson,startsAt}]}));
 validateWorkspace({...w,lessons:[{...lesson,startsAt:'2026-10-23T12:00:00+02:00'}]});
});
test('series editor retains the original range and biweekly phase after a single moved occurrence',()=>{
 const rule:RecurrenceRule={startDate:'2026-11-02',endDate:'2026-11-26',intervalWeeks:2,timeZone:'UTC',slots:[{weekday:1,time:'16:00'}]};let id=0;
 const initial=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'',rule},[],()=>String(++id));
 initial[0]=moveLesson(initial,initial[0].id,'2026-11-09','16:00','UTC');
 const draft=inferSeriesDraft(initial[0],initial,'UTC','scheduled',0);
 assert.equal(draft.rule.startDate,'2026-11-02');assert.equal(draft.rule.endDate,'2026-11-26');
 assert.deepEqual(generateOccurrences(draft.rule).map(o=>o.localDate),['2026-11-02','2026-11-16']);
 draft.rule.slots.push({weekday:3,time:'18:00'});
 assert.deepEqual(generateOccurrences(draft.rule).map(o=>o.localDate),['2026-11-02','2026-11-04','2026-11-16','2026-11-18']);
});
test('changing a single occurrence student detaches it without mutating its original series',async()=>{
 const {lessonForStudent}=await import('../features/calendar/model/planning.ts');
 const original={...lesson,seriesId:'series',seriesRule:weeklyRule};
 const changed=lessonForStudent(original,'s2');assert.equal(changed.studentId,'s2');assert.equal(changed.seriesId,undefined);assert.equal(changed.seriesRule,undefined);
 assert.equal(original.seriesId,'series');assert.equal(lessonForStudent(original,'s1').seriesId,'series');
});
test('single lessons reject DST gaps and ambiguities instead of silently shifting time',async()=>{
 const {localLessonStart}=await import('../features/calendar/model/planning.ts');
 assert.throws(()=>localLessonStart('2026-03-08T02:30','America/New_York'),/не существует/);
 assert.throws(()=>localLessonStart('2026-11-01T01:30','America/New_York'),/неоднозначно/);
 assert.equal(localLessonStart('2026-10-23T16:00','Europe/Kyiv'),'2026-10-23T13:00:00.000Z');
 assert.equal(localLessonStart('2026-11-01T01:30','America/New_York','2026-11-01T06:30:00Z'),'2026-11-01T06:30:00Z');
});
test('financial month navigation cannot overflow into invalid extended years',async()=>{
 const {isValidMonth,shiftMonth}=await import('../features/finance/model/finance.ts');
 assert.equal(isValidMonth('10000-01'),false);assert.equal(isValidMonth('0000-01'),false);
 assert.equal(shiftMonth('9999-12',1),'9999-12');assert.equal(shiftMonth('0001-01',-1),'0001-01');
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('invalid',1),'invalid');
});
test('auth failures also deactivate native data context; stale transitions cannot restore an old user',async()=>{
 const {SessionTransitions}=await import('../features/auth/model/sessionTransitions.ts');
 type State=import('../features/auth/model/sessionTransitions.ts').SessionState<string>;
 const ready:(()=>void)[]=[];const states:State[]=[];
 const transitions=new SessionTransitions<string>(()=>new Promise(resolve=>ready.push(resolve)),state=>states.push(state));
 const alice=transitions.change('alice');const failure=transitions.change(null,'Auth unavailable');
 ready[1]();await failure;ready[0]();await alice;
 assert.deepEqual(states.at(-1),{ready:true,user:null,error:'Auth unavailable'});
 const pending=transitions.change('bob');transitions.dispose();const count=states.length;ready[2]();await pending;await transitions.change('charlie');assert.equal(states.length,count);
});


test('archived students disappear from the schedule without deleting history or balances',()=>{
 const w=emptyWorkspace();
 w.students=[{id:'a',name:'Anna',subject:'',phone:'',price:100,notes:'',archived:false},{id:'b',name:'Bob',subject:'',phone:'',price:100,notes:'',archived:true}];
 w.lessons=[{id:'la',studentId:'a',startsAt:'2026-10-24T12:00:00Z',duration:60,price:100,status:'scheduled',notes:''},{id:'lb',studentId:'b',startsAt:'2026-10-24T14:00:00Z',duration:60,price:100,status:'completed',notes:''}];
 assert.deepEqual(visibleLessons(w.lessons,w.students).map(l=>l.id),['la']);
 assert.equal(w.lessons.length,2);assert.equal(balance(w,'b'),-100);
 w.students[1].archived=false;assert.equal(visibleLessons(w.lessons,w.students).length,2);
});
test('student colors survive backups, have safe defaults and reject CSS injection',()=>{
 const w=emptyWorkspace();
 w.students=[{id:'a',name:'Anna',subject:'',phone:'',price:0,notes:'',archived:false}];
 assert.equal(studentColor(w.students[0]),studentColors[0]);
 assert.notEqual(nextStudentColor(w.students),studentColors[0]);
 w.students[0].color=studentColors[3];validateWorkspace(w);
 assert.equal(studentColor(JSON.parse(JSON.stringify(w)).students[0]),studentColors[3]);
 w.students[0].color='url(https://example.com)';assert.throws(()=>validateWorkspace(w));
});


test('unauthorized OAuth domain is distinguished from an invalid Firebase key',async()=>{
 const {authErrorKey}=await import('../features/auth/model/authPolicy.ts');
 const domain=authErrorKey({code:'auth/unauthorized-domain'});
 assert.notEqual(domain,authErrorKey({code:'auth/invalid-api-key'}));
 for(const language of ['en','ru','uk'] as const){
  assert.match(translator(language)(domain),/localhost/);
  assert.match(translator(language)(domain),/Authorized domains/);
 }
});
