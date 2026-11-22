// countdown.js - đồng hồ đếm ngược tới một mốc thời gian
const p2 = (n) => String(n).padStart(2, '0');
export function startCountdown(el, targetIso, { onEnd } = {}) {
  const end = new Date(targetIso).getTime();
  const tick = () => {
    let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    el.innerHTML = `${d ? `<small>${d} ngày</small>` : ''}<b>${p2(h)}</b>:<b>${p2(m)}</b>:<b>${p2(sec)}</b>`;
    if (end - Date.now() <= 0) { clearInterval(timer); onEnd?.(); }
  };
  const timer = setInterval(tick, 1000);
  tick();
  return () => clearInterval(timer);
}
