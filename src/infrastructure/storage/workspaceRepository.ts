import type { Language } from '../../shared/i18n/index';
import { validateWorkspace, type Workspace } from '../../domain/workspace';
import { loadWorkspace, saveWorkspace } from './browserDatabase';
export { copyGuestWorkspace } from './browserDatabase';
export const native = false;
export interface WorkspaceRepository {
 load:()=>Promise<Workspace>;
 save:(workspace:Workspace)=>Promise<void>;
 exportBackup:(language:Language)=>Promise<boolean>;
 readBackup:(language:Language)=>Promise<Workspace|null>;
}
export function createRepository(scope:string):WorkspaceRepository {
 return {
  load:()=>loadWorkspace(scope),
  save:workspace=>saveWorkspace(scope,workspace),
  async exportBackup(){
   const workspace=await loadWorkspace(scope);
   const url=URL.createObjectURL(new Blob([JSON.stringify(workspace,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download=`lessavio-backup-${new Date().toISOString().slice(0,10)}.json`;
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
  },
  async readBackup(){
   return new Promise((resolve,reject)=>{
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.addEventListener('cancel',()=>{input.remove();resolve(null);},{once:true});
    input.addEventListener('change',()=>{void (async()=>{try{const file=input.files?.[0];if(!file){resolve(null);return;}if(file.size>25*1024*1024)throw new Error('Backup exceeds 25 MB');const data:unknown=JSON.parse(await file.text());validateWorkspace(data);resolve(data);}catch(error){reject(error);}finally{input.remove();}})();},{once:true});
    input.hidden=true;document.body.append(input);input.click();
   });
  },
 };
}
export async function deactivateWorkspace(){}
