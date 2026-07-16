// Tiny toast + sound helpers
let container;
function ensure() {
  if (container) return container;
  container = document.createElement("div");
  container.className = "a2-toasts";
  document.body.appendChild(container);
  return container;
}
export function toast(msg, type = "info", ms = 3200) {
  const el = document.createElement("div");
  el.className = "a2-toast a2-toast-" + type;
  el.textContent = msg;
  ensure().appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, ms);
}
let audioCtx;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.15);
  } catch (_) {}
}
