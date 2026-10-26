import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace,saveWorkspace,copyGuestWorkspace} from './browserDatabase.ts';
import {emptyWorkspace} from '../../domain/workspace.ts';
test('saved workspace survives new reads and accounts remain isolated',async()=>{
 const w=emptyWorkspace();w.profile={name:'Tutor',currency:'UAH',timeZone:'Europe/Kyiv'};
 await saveWorkspace('guest',w);
 assert.deepEqual(await loadWorkspace('guest'),w);
 assert.equal((await loadWorkspace('firebase:demo:other')).profile,null);
 await copyGuestWorkspace('firebase:demo:copy');
 assert.deepEqual(await loadWorkspace('firebase:demo:copy'),w);
 await assert.rejects(copyGuestWorkspace('firebase:demo:copy'));
 assert.deepEqual(await loadWorkspace('guest'),w);
});
test('invalid data cannot replace a workspace',async()=>{
 const w=emptyWorkspace();await saveWorkspace('valid',w);
 await assert.rejects(saveWorkspace('valid',{...w,version:99} as never));
 assert.deepEqual(await loadWorkspace('valid'),w);
});
