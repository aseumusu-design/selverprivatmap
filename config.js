/**
 * ============================================================
 *  FIREBASE CONFIG — ISI DI SINI SEBELUM DEPLOY
 * ============================================================
 *  Ambil dari Firebase Console → Project Settings → Your apps → Web app → SDK setup.
 *  File ini di-load langsung oleh browser (static hosting: Netlify / Vercel / GitHub Pages).
 *  Kunci Web API Firebase memang bersifat publik — keamanan diatur oleh
 *  Firebase Security Rules (RTDB & Storage) + Auth Domain whitelist.
 */
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
  measurementId: ""
};

export const firebaseConfigPromise = Promise.resolve(firebaseConfig);

// Email admin fallback (opsional). Tambahkan uid ke node admins/{uid}: true di RTDB untuk yang utama.
export const ADMIN_EMAILS = [];
