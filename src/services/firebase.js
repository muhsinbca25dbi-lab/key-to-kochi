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

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID
};

let app = null;
let db  = null;

try {
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is not configured');
  }
  // Avoid duplicate app error on hot-reload
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db  = getFirestore(app);
  console.info('[KTK Firebase] Firestore connected — project:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
} catch (e) {
  console.warn('[KTK Firebase] Initialisation failed — running in localStorage-only mode.', e.message);
}

export { app, db };

/** Returns true if Firebase/Firestore is successfully initialised. */
export function isFirebaseReady() {
  return db !== null;
}

