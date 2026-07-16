import {
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  ref, get, set, update, serverTimestamp, onDisconnect, ADMIN_EMAILS
} from "./init.js";

export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, googleProvider);
  await upsertUser(res.user);
  return res.user;
}

export async function logout() { await signOut(auth); }

export async function upsertUser(user) {
  if (!user) return;
  const uref = ref(db, `users/${user.uid}`);
  const snap = await get(uref);
  const base = {
    uid: user.uid,
    name: user.displayName || (user.email || "").split("@")[0],
    email: user.email || "",
    photoURL: user.photoURL || "",
    provider: user.providerData?.[0]?.providerId || "google.com",
    lastLogin: serverTimestamp()
  };
  if (!snap.exists()) {
    await set(uref, { ...base, createdAt: serverTimestamp(), role: "user" });
  } else {
    await update(uref, { lastLogin: base.lastLogin });
  }
  // Presence
  const pref = ref(db, `presence/${user.uid}`);
  await set(pref, { online: true, lastSeen: serverTimestamp() });
  onDisconnect(pref).set({ online: false, lastSeen: serverTimestamp() });
}

export async function isAdmin(user) {
  if (!user) return false;
  if (ADMIN_EMAILS.includes((user.email || "").toLowerCase())) return true;
  try {
    const s = await get(ref(db, `admins/${user.uid}`));
    if (s.exists() && s.val()) return true;
  } catch (_) {}
  try {
    const s = await get(ref(db, `users/${user.uid}/role`));
    return s.exists() && s.val() === "admin";
  } catch (_) { return false; }
}

// Guard: redirect if not authenticated. redirectTo defaults to login page.
export function requireAuth(redirect = "login.html") {
  return new Promise((resolve) => {
    const unsub = onAuth((user) => {
      unsub();
      if (!user) { window.location.href = redirect; return; }
      upsertUser(user).finally(() => resolve(user));
    });
  });
}
