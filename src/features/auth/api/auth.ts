import { GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { firebaseApp, firebaseConfig as config } from '../../../infrastructure/firebase/client';
import { initializeAuth, connectAuthEmulator, indexedDBLocalPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, reload, onAuthStateChanged, type Auth, type User } from 'firebase/auth';
export type { User };
const env=import.meta.env;
export const firebaseProjectId=String(config.projectId);
export const authConfigured=Boolean(config.apiKey&&config.authDomain&&firebaseProjectId&&config.appId);
let auth:Auth|null=null;
export function firebaseAuth():Auth {
 if(!authConfigured)throw new Error('Firebase is not configured');
 if(!auth){
  const emulatorUrl=import.meta.env.DEV?env.VITE_FIREBASE_AUTH_EMULATOR_URL:undefined;
  if(emulatorUrl&&(!firebaseProjectId.startsWith('demo-')||!/^http:\/\/(127\.0\.0\.1|localhost):9099$/.test(emulatorUrl)))throw new Error('Use a demo project and loopback address for the Auth emulator');
  const app=firebaseApp();
  auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence],popupRedirectResolver:browserPopupRedirectResolver});
  if(emulatorUrl)connectAuthEmulator(auth,emulatorUrl,{disableWarnings:true});
 }
 return auth;
}
export function observeAuth(callback:(user:User|null)=>void,onError:(error:unknown)=>void){try{return onAuthStateChanged(firebaseAuth(),callback,onError);}catch(e){onError(e);return ()=>{};}}
export async function register(email:string,password:string,language:string){const a=firebaseAuth();a.languageCode=language;return (await createUserWithEmailAndPassword(a,email.trim(),password)).user;}
export async function login(email:string,password:string){return (await signInWithEmailAndPassword(firebaseAuth(),email.trim(),password)).user;}
export async function verifyEmail(language:string,user?:User){const a=firebaseAuth();a.languageCode=language;const target=user??a.currentUser;if(!target)throw new Error('No signed-in user');await sendEmailVerification(target);}
export async function resetPassword(email:string,language:string){const a=firebaseAuth();a.languageCode=language;await sendPasswordResetEmail(a,email.trim());}
export async function refreshUser(){const a=firebaseAuth();if(a.currentUser)await reload(a.currentUser);return a.currentUser;}
export async function logout(){await signOut(firebaseAuth());}

export const googleConfigured=authConfigured;
export async function loginGoogle(language:string){
 const auth=firebaseAuth();auth.languageCode=language;
 return (await signInWithPopup(auth,new GoogleAuthProvider())).user;
}
export async function cancelGoogleLogin(){}
