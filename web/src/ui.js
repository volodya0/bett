export function toast(text, ms = 3500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-out'), ms - 400);
  setTimeout(() => el.remove(), ms);
}
