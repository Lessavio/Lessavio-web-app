export interface SessionState<User> {ready:boolean;user:User|null;error:string}
/** Invalidate the old native notification context before adopting any auth result, including errors. */
export class SessionTransitions<User> {
 private generation=0;
 private active=true;
 private deactivate:()=>Promise<void>;
 private publish:(state:SessionState<User>)=>void;
 constructor(deactivate:()=>Promise<void>,publish:(state:SessionState<User>)=>void){this.deactivate=deactivate;this.publish=publish;}
 async change(user:User|null,error=''){
  if(!this.active)return;
  const generation=++this.generation;
  this.publish({ready:false,user:null,error:''});
  try{await this.deactivate();if(this.active&&generation===this.generation)this.publish({ready:true,user,error});}
  catch{if(this.active&&generation===this.generation)this.publish({ready:true,user:null,error:'Не удалось переключить рабочее пространство. Попробуйте снова.'});}
 }
 dispose(){this.active=false;++this.generation;}
}
