// No user-provided fields are accepted by this API. Keep the event/screen allowlists finite.
export const analyticsEvents=['app_opened','onboarding_completed','student_created','student_updated','lesson_created','lesson_updated','lesson_completed','lesson_rescheduled','series_created','series_updated','series_cancelled','payment_recorded','payment_deleted','backup_exported','backup_restored'] as const;
export type AnalyticsEvent=typeof analyticsEvents[number];
export const analyticsScreens=['today','calendar','students','finance','settings'] as const;
export type AnalyticsScreen=typeof analyticsScreens[number];
export type AnalyticsStatus='off'|'starting'|'enabled'|'unsupported'|'error';
export interface AnalyticsContext {platform:'desktop'|'web';operating_system:'macos'|'windows'|'linux'|'other';app_version:string;ui_language:'en'|'ru'|'uk'}
export interface AnalyticsTransport {emit:(event:string,params:Record<string,string>)=>void}
export const analyticsConsentKey=(scope:string)=>`lessavio:analytics-consent:v1:${scope}`;
export function hasAnalyticsConsent(value:string|null){return value==='granted';}
export class ConsentAnalytics {
 private generation=0;
 private scope='';
 private granted=false;
 private transport:AnalyticsTransport|null=null;
 private screen:AnalyticsScreen|null=null;
 private launchSent=false;
 private pending:AnalyticsEvent[]=[];
 private context:AnalyticsContext;
 private listeners=new Set<()=>void>();
 private status:AnalyticsStatus='off';
 private load:(current:()=>boolean)=>Promise<AnalyticsTransport|null>;
 private stop:()=>void;
 constructor(context:AnalyticsContext,load:(current:()=>boolean)=>Promise<AnalyticsTransport|null>,stop:()=>void){this.context=context;this.load=load;this.stop=stop;}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 getStatus=()=>this.status;
 private publish(status:AnalyticsStatus){this.status=status;this.listeners.forEach(listener=>listener());}
 async activate(scope:string,granted:boolean){
  const generation=++this.generation;this.stop();this.scope=scope;this.granted=granted;this.transport=null;this.pending=[];this.screen=null;
  if(!granted){this.publish('off');return;}
  this.publish('starting');
  const current=()=>this.granted&&this.scope===scope&&this.generation===generation;
  try{
   const transport=await this.load(current);
   if(!current())return;
   if(!transport){this.stop();this.publish('unsupported');return;}
   this.transport=transport;this.publish('enabled');
   if(!this.launchSent){this.send('app_opened');this.launchSent=true;}
   if(this.screen)this.send('screen_view',{screen_name:this.screen});
   for(const event of this.pending)this.send(event);
   this.pending=[];
  }catch{if(current()){this.stop();this.pending=[];this.publish('error');}}
 }
 deactivate(scope?:string){if(scope&&scope!==this.scope)return;++this.generation;this.granted=false;this.transport=null;this.pending=[];this.stop();this.publish('off');}
 setLanguage(scope:string,language:AnalyticsContext['ui_language']){if(scope===this.scope&&['en','ru','uk'].includes(language))this.context={...this.context,ui_language:language};}
 setScreen(scope:string,screen:AnalyticsScreen){if(scope!==this.scope||!analyticsScreens.includes(screen)||this.screen===screen)return;this.screen=screen;if(this.granted&&this.status==='enabled')this.send('screen_view',{screen_name:screen});}
 track(scope:string,event:AnalyticsEvent){
  if(scope!==this.scope||!this.granted||!analyticsEvents.includes(event)||event==='app_opened')return;
  if(this.status==='starting'){if(this.pending.length<20)this.pending.push(event);return;}
  if(this.status==='enabled')this.send(event);
 }
 private send(event:string,extra:Record<string,string>={}){try{this.transport?.emit(event,{platform:this.context.platform,operating_system:this.context.operating_system,app_version:this.context.app_version,ui_language:this.context.ui_language,...extra});}catch{/* Analytics must never interrupt local work. */}}
}
