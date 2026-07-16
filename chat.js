import { auth, db, ref, onValue, push, set, update, remove, serverTimestamp, onChildAdded } from "../firebase/init.js";
import { requireAuth, logout } from "../firebase/auth.js";
import { toast, beep } from "./toast.js";

const params = new URLSearchParams(location.search);
const roomId = params.get("room");
if (!roomId) { alert("Room tidak ditemukan"); location.href = "/home.html"; }

const esc = (s) => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => t ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const listEl = document.getElementById("chat-messages");
const inputEl = document.getElementById("chat-input");
const sendBtn = document.getElementById("chat-send");
const proofBtn = document.getElementById("send-proof-btn");
const proofFile = document.getElementById("proof-file");
const headEl = document.getElementById("chat-head");
const backBtn = document.getElementById("chat-back");
const logoutBtn = document.getElementById("logout-btn");
const typingEl = document.getElementById("typing-indicator");

let me = null, room = null, isAdminUser = false;
const seen = new Set();

(async () => {
  me = await requireAuth("login.html");
  // Load room meta
  onValue(ref(db, `rooms/${roomId}`), (s) => {
    room = s.val();
    if (!room) return;
    if (room.uid !== me.uid) { /* only owner (admin allowed via rules) */ }
    renderHead();
  });
  // Mark read (user side) - reset user's unread
  update(ref(db, `rooms/${roomId}`), { unreadUser: 0 }).catch(()=>{});
  bindMessages();
  bindTyping();
})();

backBtn?.addEventListener("click", () => history.length > 1 ? history.back() : location.href = "/home.html");
logoutBtn?.addEventListener("click", async () => { await logout(); location.href = "login.html"; });

function renderHead() {
  if (!room) return;
  const statusMap = {
    waiting_payment: "🟡 Menunggu Pembayaran",
    waiting_proof: "🔵 Menunggu Bukti Pembayaran",
    verifying: "🟠 Sedang Diverifikasi",
    paid: "🟢 Pembayaran Berhasil",
    completed: "✅ Pesanan Selesai",
    rejected: "❌ Pembayaran Ditolak"
  };
  headEl.innerHTML = `
    <div class="ch-avatar"><img src="${esc(room.buyerPhoto || '../assets/logo.png')}" alt=""/></div>
    <div class="ch-meta">
      <div class="ch-title">Admin A2 Store</div>
      <div class="ch-sub">${esc(room.productName)} • ${rupiah(room.price)}</div>
      <div class="ch-status">${statusMap[room.status] || room.status}</div>
    </div>`;
}

function bindMessages() {
  onChildAdded(ref(db, `messages/${roomId}`), (snap) => {
    const m = { id: snap.key, ...snap.val() };
    if (seen.has(m.id)) return; seen.add(m.id);
    addBubble(m);
    // If not mine and not read, mark as read
    if (m.sender !== me.uid && m.sender !== "system" && !m.read) {
      update(ref(db, `messages/${roomId}/${m.id}`), { read: true });
    }
    if (m.sender !== me.uid && m.sender !== "system") beep();
    scrollBottom();
  });
}

function addBubble(m) {
  const wrap = document.createElement("div");
  const mine = m.sender === me.uid;
  const sys = m.type === "system" || m.sender === "system";
  wrap.className = "bubble " + (sys ? "sys" : (mine ? "me" : "them"));
  wrap.dataset.id = m.id;
  let body = "";
  if (m.type === "image" && m.url) body = `<img src="${esc(m.url)}" class="bubble-img" alt="image"/>`;
  else body = `<div class="bubble-text">${esc(m.text || "")}</div>`;
  wrap.innerHTML = `
    ${sys ? "" : `<div class="bubble-sender">${esc(m.senderName || "")}</div>`}
    ${body}
    <div class="bubble-foot">
      <span>${fmt(m.createdAt)}</span>
      ${mine ? `<span class="tick">${m.read ? "✓✓" : "✓"}</span>` : ""}
    </div>`;
  listEl.appendChild(wrap);
}

function scrollBottom() { listEl.scrollTop = listEl.scrollHeight; }

async function sendText(text) {
  if (!text.trim()) return;
  await push(ref(db, `messages/${roomId}`), {
    sender: me.uid, senderName: me.displayName || me.email, senderPhoto: me.photoURL || "",
    text, type: "text", createdAt: serverTimestamp(), read: false
  });
  await update(ref(db, `rooms/${roomId}`), {
    lastMessage: text.slice(0, 60), lastMessageAt: serverTimestamp(),
    unreadAdmin: (room?.unreadAdmin || 0) + 1
  });
}

sendBtn.addEventListener("click", async () => {
  const v = inputEl.value; inputEl.value = "";
  try { await sendText(v); } catch (e) { toast("Gagal kirim: " + e.message, "error"); }
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

// Bukti pembayaran via base64 (upload gambar, disimpan sebagai data URL agar tanpa Storage)
proofBtn?.addEventListener("click", () => proofFile.click());
proofFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  if (f.size > 900_000) { toast("Gambar terlalu besar (max ~900KB)", "error"); return; }
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  try {
    await push(ref(db, `messages/${roomId}`), {
      sender: me.uid, senderName: me.displayName || me.email,
      type: "image", url: dataUrl, caption: "Bukti pembayaran",
      createdAt: serverTimestamp(), read: false
    });
    await update(ref(db, `rooms/${roomId}`), { status: "verifying", lastMessage: "📷 Bukti pembayaran", lastMessageAt: serverTimestamp(), unreadAdmin: (room?.unreadAdmin || 0) + 1 });
    await update(ref(db, `orders/${room.orderId}`), { status: "verifying" });
    toast("Bukti terkirim", "success");
  } catch (err) { toast("Gagal: " + err.message, "error"); }
  proofFile.value = "";
});

// Typing indicator
let typingTimer;
inputEl.addEventListener("input", () => {
  set(ref(db, `typing/${roomId}/${me.uid}`), true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => set(ref(db, `typing/${roomId}/${me.uid}`), false), 1500);
});
function bindTyping() {
  onValue(ref(db, `typing/${roomId}`), (s) => {
    const v = s.val() || {};
    const others = Object.entries(v).filter(([uid, t]) => t && uid !== me.uid);
    typingEl.style.display = others.length ? "block" : "none";
  });
}
