import { getApp, getApps, initializeApp } from 'firebase/app';
const env=import.meta.env;
// VITE_* values are embedded in the distributed app; never use Admin SDK credentials here.
export const firebaseConfig={
 apiKey:env.VITE_FIREBASE_API_KEY||'',
 authDomain:env.VITE_FIREBASE_AUTH_DOMAIN||'',
 projectId:env.VITE_FIREBASE_PROJECT_ID||'',
 appId:env.VITE_FIREBASE_APP_ID||'',
 measurementId:env.VITE_FIREBASE_MEASUREMENT_ID||'',
};
export function firebaseApp(){return getApps().length?getApp():initializeApp(firebaseConfig);}
