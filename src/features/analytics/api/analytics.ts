import { ConsentAnalytics, analyticsConsentKey, hasAnalyticsConsent, type AnalyticsScreen } from '../model/analyticsPolicy';
import { firebaseApp, firebaseConfig } from '../../../infrastructure/firebase/client';
import { native } from '../../../infrastructure/storage/workspaceRepository';
import { version } from '../../../../package.json';
import type { Analytics } from 'firebase/analytics';
let instance:Analytics|null=null;
let sdk:typeof import('firebase/analytics')|null=null;
const measurementId=firebaseConfig.measurementId;
// Disable synchronously, even if a previously requested SDK initialization is still pending.
function stop(){
 (window as unknown as Record<string,unknown>)[`ga-disable-${measurementId}`]=true;
 if(sdk){sdk.setConsent({analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});if(instance)sdk.setAnalyticsCollectionEnabled(instance,false);}
}
const os=/Windows/i.test(navigator.userAgent)?'windows':/Mac/i.test(navigator.userAgent)?'macos':/Linux/i.test(navigator.userAgent)?'linux':'other';
export const analytics=new ConsentAnalytics({platform:native?'desktop':'web',operating_system:os,app_version:version,ui_language:'en'},async current=>{
 // Local development never sends analytics, including when using the Auth emulator.
 if(import.meta.env.DEV)return current()?{emit:()=>{}}:null;
 if(!/^G-[A-Z0-9]+$/.test(measurementId))return null;
 const module=await import('firebase/analytics');
 if(!current()||!await module.isSupported())return null;
 if(!current())return null;
 sdk=module;
 module.setConsent({analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 (window as unknown as Record<string,unknown>)[`ga-disable-${measurementId}`]=false;
 if(!instance)instance=module.initializeAnalytics(firebaseApp(),{config:{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:'none',page_title:'Lessavio',page_referrer:'',page_location:`https://${firebaseConfig.authDomain}/app`}});
 module.setAnalyticsCollectionEnabled(instance,true);
 // Do not enqueue app events inside gtag before it is ready: consent may be withdrawn meanwhile.
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([module.getGoogleAnalyticsClientId(instance),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Analytics initialization timed out')),15000);})]);}finally{clearTimeout(timeout);}
 if(!current())return null;
 const active=instance;
 return {emit:(event,params)=>module.logEvent(active,event,params)};
},stop);
export function readAnalyticsConsent(scope:string){try{return hasAnalyticsConsent(localStorage.getItem(analyticsConsentKey(scope)));}catch{return false;}}
export function activateAnalytics(scope:string,language:'ru'|'uk'|'en'){
 const pending=analytics.activate(scope,readAnalyticsConsent(scope));analytics.setLanguage(scope,language);return pending;
}
export function updateAnalyticsConsent(scope:string,enabled:boolean,language:'ru'|'uk'|'en',screen:AnalyticsScreen){
 // Persist the decision before enabling any network collection. Fail closed if storage is unavailable.
 if(!enabled)analytics.deactivate(scope);
 try{localStorage.setItem(analyticsConsentKey(scope),enabled?'granted':'denied');}catch(error){analytics.deactivate(scope);throw error;}
 const pending=analytics.activate(scope,enabled);analytics.setLanguage(scope,language);analytics.setScreen(scope,screen);return pending;
}
export const analyticsDevelopment=import.meta.env.DEV;
