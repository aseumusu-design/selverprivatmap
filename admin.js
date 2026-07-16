import { auth, db, ref, onValue, push, set, update, remove, serverTimestamp, onChildAdded } from "../firebase/init.js";
import { requireAuth, isAdmin, logout } from "../firebase/auth.js";
import { toast, beep } from "./toast.js";

const esc = (s) => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => t ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const contactsEl = document.getElementById("contacts");
const searchEl = document.getElementById("search");
const chatBox = document.getElementById("chat-box");
const chatMsgs = document.getElementById("chat-messages");
const chatHead = document.getElementById("chat-head");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const attachFile = document.getElementById("attach-file");
const attachBtn = document.getElementById("attach-btn");
const qrisBtn = document.getElementById("qris-btn");
const acceptBtn = document.getElementById("accept-btn");
const rejectBtn = document.getElementById("reject-btn");
const completeBtn = document.getElementById("complete-btn");
const emptyEl = document.getElementById("chat-empty");
const logoutBtn = document.getElementById("logout-btn");

let me = null, rooms = {}, currentRoom = null, currentMsgs = [], seenMsg = new Set();

(async () => {
  me = await requireAuth("login.html");
  const admin = await isAdmin(me);
  if (!admin) {
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#fff">
      <h2>Akses ditolak</h2>
      <p>Akun ${esc(me.email)} bukan admin.</p>
      <p>Tambahkan node <code>admins/${esc(me.uid)}: true</code> di Realtime Database, atau isi email di <code>firebase/config.js</code>.</p>
      <p><a href="/home.html" style="color:#00e5ff">Kembali</a></p>
    </div>`;
    return;
  }
  loadRooms();
})();

logoutBtn?.addEventListener("click", async () => { await logout(); location.href = "login.html"; });

function loadRooms() {
  onValue(ref(db, "rooms"), (snap) => {
    rooms = snap.val() || {};
    renderContacts();
  });
}

function renderContacts() {
  const q = (searchEl.value || "").toLowerCase();
  const arr = Object.entries(rooms).map(([id, v]) => ({ id, ...v }))
    .filter(r => {
      if (!q) return true;
      return [r.buyerName, r.buyerEmail, r.uid, r.orderId].some(x => (x || "").toLowerCase().includes(q));
    })
    .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  if (!arr.length) { contactsEl.innerHTML = '<div class="empty" style="padding:20px">Belum ada chat.</div>'; return; }
  contactsEl.innerHTML = arr.map(r => `
    <div class="contact ${currentRoom === r.id ? 'active' : ''}" data-id="${r.id}">
      <img src="${esc(r.buyerPhoto || '../assets/logo.png')}" alt=""/>
      <div class="contact-body">
        <div class="contact-top">
          <strong>${esc(r.buyerName || 'Pembeli')}</strong>
          <small>${fmt(r.lastMessageAt)}</small>
        </div>
        <div class="contact-mid">${esc(r.buyerEmail || '')}</div>
        <div class="contact-bot">
          <span class="preview">${esc(r.lastMessage || '-')}</span>
          ${r.unreadAdmin ? `<span class="badge">${r.unreadAdmin}</span>` : ''}
        </div>
      </div>
    </div>`).join("");
  contactsEl.querySelectorAll(".contact").forEach(el => {
    el.addEventListener("click", () => openRoom(el.dataset.id));
  });
}
searchEl.addEventListener("input", renderContacts);

let msgUnsub = null;
function openRoom(id) {
  currentRoom = id; seenMsg.clear(); chatMsgs.innerHTML = "";
  emptyEl.style.display = "none"; chatBox.style.display = "flex";
  const r = rooms[id]; if (!r) return;
  const statusMap = {
    waiting_payment: "🟡 Menunggu Pembayaran", waiting_proof: "🔵 Menunggu Bukti",
    verifying: "🟠 Sedang Diverifikasi", paid: "🟢 Pembayaran Berhasil",
    completed: "✅ Selesai", rejected: "❌ Ditolak"
  };
  chatHead.innerHTML = `
    <img src="${esc(r.buyerPhoto || '../assets/logo.png')}" class="head-avatar"/>
    <div class="head-info">
      <strong>${esc(r.buyerName)}</strong>
      <small>${esc(r.buyerEmail)}</small>
      <small class="mono">UID: ${esc(r.uid)}</small>
      <small class="mono">Order: ${esc(r.orderId)} • ${esc(r.productName)} • ${rupiah(r.price)}</small>
      <span class="status">${statusMap[r.status] || r.status}</span>
    </div>`;
  update(ref(db, `rooms/${id}`), { unreadAdmin: 0 }).catch(()=>{});
  if (msgUnsub) msgUnsub();
  msgUnsub = onChildAdded(ref(db, `messages/${id}`), (snap) => {
    const m = { id: snap.key, ...snap.val() };
    if (seenMsg.has(m.id)) return; seenMsg.add(m.id);
    addBubble(m);
    if (m.sender !== me.uid && m.sender !== "system" && !m.read) {
      update(ref(db, `messages/${id}/${m.id}`), { read: true });
    }
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  });
  renderContacts();
}

function addBubble(m) {
  const wrap = document.createElement("div");
  const mine = m.sender === me.uid;
  const sys = m.type === "system" || m.sender === "system";
  wrap.className = "bubble " + (sys ? "sys" : (mine ? "me" : "them"));
  wrap.dataset.id = m.id;
  let body = m.type === "image" && m.url
    ? `<img src="${esc(m.url)}" class="bubble-img"/>`
    : `<div class="bubble-text">${esc(m.text || "")}</div>`;
  wrap.innerHTML = `
    ${sys ? "" : `<div class="bubble-sender">${esc(m.senderName || "")}</div>`}
    ${body}
    <div class="bubble-foot">
      <span>${fmt(m.createdAt)}</span>
      ${mine ? `<span class="tick">${m.read ? "✓✓" : "✓"}</span>` : ""}
      ${mine ? `<button class="del-msg" title="Hapus">🗑</button>` : ""}
    </div>`;
  wrap.querySelector(".del-msg")?.addEventListener("click", async () => {
    if (!confirm("Hapus pesan ini?")) return;
    await remove(ref(db, `messages/${currentRoom}/${m.id}`));
    wrap.remove();
  });
  chatMsgs.appendChild(wrap);
}

async function sendText(text, extra = {}) {
  if (!text.trim() && !extra.url) return;
  await push(ref(db, `messages/${currentRoom}`), {
    sender: me.uid, senderName: "Admin", text,
    type: extra.type || "text", url: extra.url || null,
    createdAt: serverTimestamp(), read: false
  });
  await update(ref(db, `rooms/${currentRoom}`), {
    lastMessage: (text || (extra.type === "image" ? "📷 Gambar" : "File")).slice(0, 60),
    lastMessageAt: serverTimestamp(),
    unreadUser: ((rooms[currentRoom]?.unreadUser) || 0) + 1
  });
}

sendBtn.addEventListener("click", async () => {
  const v = chatInput.value; chatInput.value = "";
  try { await sendText(v); } catch (e) { toast("Gagal: " + e.message, "error"); }
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

attachBtn?.addEventListener("click", () => attachFile.click());
attachFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  if (f.size > 900_000) { toast("File terlalu besar (max ~900KB)", "error"); return; }
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  try { await sendText("", { type: "image", url: dataUrl }); toast("Terkirim", "success"); }
  catch (err) { toast("Gagal: " + err.message, "error"); }
  attachFile.value = "";
});

qrisBtn?.addEventListener("click", async () => {
  if (!currentRoom) return;
  attachFile.onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    await sendText("QRIS Pembayaran", { type: "image", url: dataUrl });
    await push(ref(db, `messages/${currentRoom}`), {
      sender: "system", senderName: "🤖 Sistem", type: "system",
      text: "📲 Admin telah mengirimkan QRIS pembayaran.\n\nSilakan lakukan pembayaran sesuai nominal.\n\nSetelah selesai tekan tombol\n📷 Kirim Bukti Pembayaran.\n\nTerima kasih 😊🙏",
      createdAt: serverTimestamp(), read: false
    });
    await update(ref(db, `rooms/${currentRoom}`), { status: "waiting_proof" });
    await update(ref(db, `orders/${rooms[currentRoom].orderId}`), { status: "waiting_proof" });
    attachFile.onchange = null; attachFile.value = "";
    toast("QRIS terkirim", "success");
  };
  attachFile.click();
});

acceptBtn?.addEventListener("click", async () => {
  if (!currentRoom) return;
  await push(ref(db, `messages/${currentRoom}`), {
    sender: "system", senderName: "🤖 Sistem", type: "system",
    text: "Pembayaran berhasil diverifikasi. 🎉\n\nAdmin sedang menyiapkan Private Server Anda.\n\nMohon tunggu sebentar 😊",
    createdAt: serverTimestamp(), read: false
  });
  await update(ref(db, `rooms/${currentRoom}`), { status: "paid" });
  await update(ref(db, `orders/${rooms[currentRoom].orderId}`), { status: "paid" });
  toast("Pembayaran diterima", "success");
});

rejectBtn?.addEventListener("click", async () => {
  if (!currentRoom || !confirm("Tolak pembayaran ini?")) return;
  await push(ref(db, `messages/${currentRoom}`), {
    sender: "system", senderName: "🤖 Sistem", type: "system",
    text: "❌ Pembayaran ditolak. Silakan kirim bukti pembayaran yang valid.",
    createdAt: serverTimestamp(), read: false
  });
  await update(ref(db, `rooms/${currentRoom}`), { status: "rejected" });
  await update(ref(db, `orders/${rooms[currentRoom].orderId}`), { status: "rejected" });
});

completeBtn?.addEventListener("click", async () => {
  if (!currentRoom) return;
  await push(ref(db, `messages/${currentRoom}`), {
    sender: "system", senderName: "🤖 Sistem", type: "system",
    text: "Pesanan telah selesai.\n\nTerima kasih telah berbelanja 😊❤️",
    createdAt: serverTimestamp(), read: false
  });
  await update(ref(db, `rooms/${currentRoom}`), { status: "completed" });
  await update(ref(db, `orders/${rooms[currentRoom].orderId}`), { status: "completed" });
  toast("Pesanan selesai", "success");
});
