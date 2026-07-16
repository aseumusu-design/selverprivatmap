import { loginWithGoogle, onAuth } from "../firebase/auth.js";
import { toast } from "./toast.js";

const btn = document.getElementById("google-signin-btn");
const err = document.getElementById("login-error");
const nextUrl = new URLSearchParams(location.search).get("next") || "/home.html";

onAuth((u) => { if (u) location.href = nextUrl; });

btn?.addEventListener("click", async () => {
  err.textContent = ""; btn.disabled = true; btn.classList.add("loading");
  try {
    await loginWithGoogle();
    toast("Login berhasil", "success");
    setTimeout(() => location.href = nextUrl, 400);
  } catch (e) {
    err.textContent = e.message; toast("Login gagal", "error");
  } finally { btn.disabled = false; btn.classList.remove("loading"); }
});
