import { GoogleSignIn } from '../features/auth/components/GoogleSignIn';
import { SessionTransitions } from '../features/auth/model/sessionTransitions';
import { useEffect, useState } from 'react';
import { BookOpen, ShieldCheck } from 'lucide-react';
import { WorkspaceApp } from '../features/workspace/WorkspaceApp';
import { Account } from '../features/auth/components/Account';
import { AuthDialog } from '../features/auth/components/AuthDialog';
import { Select } from '../shared/ui/Select';
import { authConfigured, firebaseProjectId, observeAuth, type User } from '../features/auth/api/auth';
import { accountScope, authErrorKey } from '../features/auth/model/authPolicy';
import { defaultLanguage, languages, translator, type Language } from '../shared/i18n/index';
import { deactivateWorkspace } from '../infrastructure/storage/workspaceRepository';
function guestPreference(){try{return localStorage.getItem('lessavio:continue-without-account')==='true';}catch{return false;}}
export function App(){
 const [session,setSession]=useState<{ready:boolean;user:User|null;error:string}>({ready:!authConfigured,user:null,error:''});
 const [guest,setGuest]=useState(guestPreference),[dialog,setDialog]=useState(false),[language,setLanguage]=useState<Language>(defaultLanguage),[dialogLanguage,setDialogLanguage]=useState<Language>(defaultLanguage),[generation,setGeneration]=useState(0);
 const [dialogMode,setDialogMode]=useState<'login'|'register'>('login'),[googleBusy,setGoogleBusy]=useState(false);
 const t=translator(language);
 useEffect(()=>{if(!session.user&&!guest)document.documentElement.lang=language;},[language,session.user,guest]);
 useEffect(()=>{
  if(!authConfigured)return;
  const transitions=new SessionTransitions<User>(deactivateWorkspace,setSession);
  const unsubscribe=observeAuth(user=>{void transitions.change(user);},error=>{void transitions.change(null,authErrorKey(error));});
  return ()=>{transitions.dispose();unsubscribe();};
 },[]);
 const scope=session.user?accountScope(firebaseProjectId,session.user.uid):'guest';
 function continueGuest(){try{localStorage.setItem('lessavio:continue-without-account','true');}catch{/* session-only guest choice */}setGuest(true);}
 function leave(){setGuest(false);try{localStorage.removeItem('lessavio:continue-without-account');}catch{} }
 if(!session.ready)return <div className="splash">{t('Проверяем вход…')}</div>;
 return <>{session.error&&(session.user||guest)&&<div className="session-warning" role="alert">{t(session.error)}</div>}{session.user||guest?<WorkspaceApp key={`${scope}:${generation}`} scope={scope} accountPanel={(currentLanguage,busy)=><Account scope={scope} user={session.user} language={currentLanguage} busy={busy} onLogin={()=>{setDialogMode('login');setDialogLanguage(currentLanguage);setDialog(true);}} onRefresh={user=>setSession({ready:true,user,error:''})} onCopied={()=>setGeneration(n=>n+1)} onLeave={leave}/>}/>:<div className="auth-welcome"><section className="card auth-welcome-card"><div className="brand"><BookOpen/>Lessavio<span>web</span></div><Select label={t('Язык интерфейса')} value={language} options={[...languages]} emptyLabel={t('Ничего не найдено')} onChange={value=>setLanguage(value as Language)}/><h1>{t('Ваше пространство для преподавания')}</h1><p className="muted">{t('Создайте аккаунт или продолжайте работать локально без регистрации.')}</p><GoogleSignIn language={language} onSuccess={()=>setDialog(false)} onBusy={setGoogleBusy}/><div className="auth-email-actions"><button className="primary" disabled={!authConfigured||googleBusy} onClick={()=>{setDialogMode('register');setDialogLanguage(language);setDialog(true);}}>{t('Создать аккаунт')}</button><button disabled={!authConfigured||googleBusy} onClick={()=>{setDialogMode('login');setDialogLanguage(language);setDialog(true);}}>{t('Войти')}</button></div><button disabled={googleBusy} onClick={continueGuest}>{t('Продолжить без аккаунта')}</button>{!authConfigured&&<p className="muted">{t('Вход пока не настроен. Вы можете работать без аккаунта.')}</p>}{session.error&&<div className="error" role="alert">{t(session.error)}</div>}<p className="auth-privacy muted"><ShieldCheck size={16}/>{t('Данные учеников остаются на устройстве. Аккаунт пока не включает облачную синхронизацию.')}</p></section></div>}{dialog&&<AuthDialog initialMode={dialogMode} language={dialogLanguage} onClose={()=>setDialog(false)} onSuccess={()=>setDialog(false)}/>}</>;
}
