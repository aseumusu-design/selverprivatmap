// Firebase Modular SDK v11 (ES Modules via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, push, onValue, onChildAdded, onChildChanged,
  onChildRemoved, remove, serverTimestamp, query, orderByChild, orderByKey,
  limitToLast, onDisconnect
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { firebaseConfigPromise, ADMIN_EMAILS } from "./config.js";

const firebaseConfig = await firebaseConfigPromise;
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Persist session across reloads
setPersistence(auth, browserLocalPersistence).catch(() => {});

export {
  ref, set, get, update, push, onValue, onChildAdded, onChildChanged, onChildRemoved,
  remove, serverTimestamp, query, orderByChild, orderByKey, limitToLast, onDisconnect,
  signInWithPopup, signOut, onAuthStateChanged, ADMIN_EMAILS
};
