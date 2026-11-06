/**
 * Firebase Initialisation — KEY TO KOCHI
 *
 * Config is loaded exclusively from Vite environment variables (VITE_FIREBASE_*).
 * These values are project identifiers, NOT secrets.
 * Firestore access is controlled entirely by Security Rules — not by hiding the config.
 *
 * Local dev:  set VITE_FIREBASE_* in your .env file (gitignored)
 * Production: set VITE_FIREBASE_* in Netlify → Site configuration → Environment variables
 */
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

function cleanEnv(val) {
  if (!val) return '';
  return String(val).trim().replace(/^["']+|[",']+$/g, '').trim();
}

const firebaseConfig = {
  apiKey:            cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain:        cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId:         cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket:     cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId:             cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID)
};

let app = null;
let db  = null;

try {
  if (!firebaseConfig.projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is not configured');
  }
  // Avoid duplicate app error on hot-reload
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db  = getFirestore(app);
  console.info('[KTK Firebase] Firestore connected — project:', firebaseConfig.projectId);
} catch (e) {
  console.warn('[KTK Firebase] Initialisation failed — running in localStorage-only mode.', e.message);
}

export { app, db };

/** Returns true if Firebase/Firestore is successfully initialised. */
export function isFirebaseReady() {
  return db !== null;
}

