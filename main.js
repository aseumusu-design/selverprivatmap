import { auth, db, ref, onValue, push, set, update, serverTimestamp } from "../firebase/init.js";
import { onAuth, loginWithGoogle, logout } from "../firebase/auth.js";
import { toast } from "./toast.js";

const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = (s) => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const grid = document.getElementById("product-grid");
const loginBtn = document.getElementById("google-login-btn");
const userBadge = document.getElementById("user-badge");
const userEmailEl = document.getElementById("user-email");
const userAvatarEl = document.getElementById("user-avatar");
const logoutBtn = document.getElementById("user-logout");
document.getElementById("year").textContent = new Date().getFullYear();

let currentUser = null;
let products = {};

onAuth((user) => {
  currentUser = user;
  if (user) {
    loginBtn.style.display = "none";
    userBadge.style.display = "flex";
    userEmailEl.textContent = user.email || user.displayName || "";
    if (user.photoURL) userAvatarEl.src = user.photoURL;
  } else {
    loginBtn.style.display = "inline-flex";
    userBadge.style.display = "none";
  }
});

loginBtn?.addEventListener("click", async () => {
  loginBtn.disabled = true; loginBtn.textContent = "Memuat...";
  try { await loginWithGoogle(); toast("Login berhasil", "success"); }
  catch (e) { toast("Login gagal: " + e.message, "error"); }
  finally { loginBtn.disabled = false; loginBtn.innerHTML = loginBtn.dataset.orig || "Login Google"; }
});
if (loginBtn) loginBtn.dataset.orig = loginBtn.innerHTML;
logoutBtn?.addEventListener("click", async () => { await logout(); toast("Berhasil keluar"); });

function render(list) {
  const arr = list ? Object.entries(list).map(([id, v]) => ({ id, ...v })) : [];
  if (!arr.length) { grid.innerHTML = '<div class="empty">Belum ada produk.</div>'; return; }
  grid.innerHTML = arr.map(p => `
    <article class="card">
      <div class="card-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='assets/logo.png';this.style.objectFit='contain';this.style.padding='40px'"/></div>
      <div class="card-body">
        <h3 class="card-name">${esc(p.name)}</h3>
        <p class="card-desc">${esc(p.desc || "")}</p>
        <div class="card-foot">
          <span class="card-price">${rupiah(p.price)}</span>
          <button class="btn btn-primary btn-sm" data-id="${p.id}">Pesan Sekarang</button>
        </div>
      </div>
    </article>`).join("");
  grid.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => checkout(btn.dataset.id));
  });
}

async function checkout(pid) {
  const p = products[pid]; if (!p) return;
  if (!currentUser) { try { await loginWithGoogle(); } catch { return; } }
  const uid = currentUser.uid;
  const orderId = "A2-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const roomId = uid + "_" + orderId;

  const order = {
    orderId, roomId, uid,
    buyerName: currentUser.displayName || "",
    buyerEmail: currentUser.email || "",
    buyerPhoto: currentUser.photoURL || "",
    productId: pid, productName: p.name, productMap: p.map || p.name,
    productImage: p.image || "", price: Number(p.price) || 0,
    status: "waiting_payment", createdAt: serverTimestamp()
  };
  try {
    await set(ref(db, `orders/${orderId}`), order);
    await set(ref(db, `rooms/${roomId}`), {
      orderId, uid, buyerName: order.buyerName, buyerEmail: order.buyerEmail,
      buyerPhoto: order.buyerPhoto, productName: p.name, price: order.price,
      status: "waiting_payment", createdAt: serverTimestamp(),
      lastMessage: "Pesanan baru", lastMessageAt: serverTimestamp(), unreadAdmin: 1
    });
    const sysMsg =
`Halo kak 😊

Pesanan Anda sudah kami terima.

📦 Produk : ${p.name}
🗺️ Map : ${p.map || p.name}
💰 Harga : ${rupiah(p.price)}

⏳ Pembayaran Anda sedang diproses 😊🙏`;
    await push(ref(db, `messages/${roomId}`), {
      sender: "system", senderName: "🤖 Sistem", text: sysMsg,
      type: "system", createdAt: serverTimestamp(), read: false
    });
    toast("Pesanan dibuat, mengarahkan ke chat...", "success");
    setTimeout(() => { window.location.href = `pages/chat.html?room=${encodeURIComponent(roomId)}`; }, 600);
  } catch (e) {
    toast("Gagal buat pesanan: " + e.message, "error");
  }
}

onValue(ref(db, "products"), (snap) => {
  products = snap.val() || {};
  render(products);
}, (err) => {
  grid.innerHTML = '<div class="empty">Gagal memuat produk. Cek Firebase Rules.</div>';
  console.error(err);
});
