import { emptyWorkspace, validateWorkspace, type Workspace } from '../../domain/workspace.ts';

const databaseName = 'lessavio-web';
function openDatabase(): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => { request.result.createObjectStore('workspaces'); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Close other Lessavio tabs and try again.'));
 });
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value:T)=>void) => void): Promise<T> {
 const database = await openDatabase();
 try {
  return await new Promise<T>((resolve, reject) => {
   const tx = database.transaction('workspaces', mode);
   let value:T;
   tx.oncomplete = () => resolve(value);
   tx.onerror = () => reject(tx.error);
   tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
   try { work(tx.objectStore('workspaces'), result => { value = result; }); }
   catch(error) { tx.abort(); reject(error); }
  });
 } finally { database.close(); }
}
export async function loadWorkspace(scope:string):Promise<Workspace> {
 const value = await transaction<unknown>('readonly',(store,result)=>{
  const request=store.get(scope);request.onsuccess=()=>result(request.result);
 });
 if(value===undefined)return emptyWorkspace();
 validateWorkspace(value);return value;
}
export async function saveWorkspace(scope:string,workspace:Workspace):Promise<void> {
 validateWorkspace(workspace);
 await transaction<void>('readwrite',store=>{store.put(workspace,scope);});
}
export async function copyGuestWorkspace(scope:string):Promise<void> {
 if(scope==='guest')throw new Error('Select an account workspace first.');
 await transaction<void>('readwrite',store=>{
  const source=store.get('guest');const target=store.get(scope);
  target.onsuccess=()=>{
   const current=target.result;
   if(current!==undefined){validateWorkspace(current);if(current.profile||current.students.length||current.lessons.length||current.payments.length){store.transaction.abort();return;}}
   if(source.result!==undefined){validateWorkspace(source.result);store.put(source.result,scope);}
  };
 });
}
