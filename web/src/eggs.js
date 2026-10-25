// 🥚 Easter eggs. Shh, don't tell anyone.

export function toast(text, ms = 3500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-out'), ms - 400);
  setTimeout(() => el.remove(), ms);
}

// Emoji rain (balls, confetti, etc.).
export function rain(symbols = ['⚽'], count = 40) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'raindrop';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = 18 + Math.random() * 26 + 'px';
    el.style.animationDuration = 2 + Math.random() * 2.5 + 's';
    el.style.animationDelay = Math.random() * 1.2 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

export const confetti = () => rain(['🎉', '🎊', '✨', '🏆', '⚽'], 60);

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const WORDS = {
  siuu: () => {
    toast('SIUUUUUU! 🐐');
    document.body.classList.add('siuu');
    setTimeout(() => document.body.classList.remove('siuu'), 1200);
  },
  var: () => toast('📺 VAR перевіряє... Гол зараховано. Мабуть.'),
  gol: () => rain(['⚽', '🥅'], 30),
  гол: () => rain(['⚽', '🥅'], 30),
  shevchenko: () => toast('🇺🇦 2004, Золотий мʼяч. Пам’ятаємо.'),
  шева: () => toast('🇺🇦 2004, Золотий мʼяч. Пам’ятаємо.'),
};

export function installGlobalEggs() {
  let konamiPos = 0;
  let typed = '';
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiPos = key === KONAMI[konamiPos] ? konamiPos + 1 : key === KONAMI[0] ? 1 : 0;
    if (konamiPos === KONAMI.length) {
      konamiPos = 0;
      rain(['⚽'], 80);
      toast('🎮 Чит-код активовано: +0 балів. Але як приємно!');
    }
    if (key.length === 1) {
      typed = (typed + key).slice(-12);
      for (const [w, fn] of Object.entries(WORDS)) if (typed.endsWith(w)) { typed = ''; fn(); }
    }
  };
  window.addEventListener('keydown', onKey);
  console.log(
    '%c⚽ Шукаєш баги? Знайдеш — отримаєш +1 бал (якщо адмін буде в настрої).',
    'font-size:14px;color:#1a7f37;font-weight:bold'
  );
  return () => window.removeEventListener('keydown', onKey);
}

// Fun reactions to predictions.
export function predictionQuip(h, a) {
  if (h === 0 && a === 0) return 'Ставка 0:0 прийнята. Не засніть на матчі 😴';
  if ((h === 7 && a === 1) || (h === 1 && a === 7)) return 'Мінейрасо?! Сміливо. Бразилія досі плаче 🇧🇷😭';
  if (h + a >= 10) return 'Це футбол чи гандбол? 🤾';
  if (h === a && h >= 3) return 'Нічия-феєрверк! Захисники у відпустці 🏖️';
  if (Math.abs(h - a) >= 5) return 'Розгром! Хтось буде звільнений 📉';
  return null;
}

export const QUOTES = [
  '«Футбол — проста гра: 22 людини ганяються за мʼячем, а в кінці завжди виграють німці». — Г. Лінекер',
  '«Деякі люди вважають, що футбол — це питання життя і смерті. Все набагато серйозніше». — Б. Шенклі',
  '«Команда — це не набір зірок, а одна зірка». — В. Лобановський',
  '«Якщо ти не можеш виграти, зроби так, щоб не програв». — Й. Кройф',
  '«Мʼяч круглий, гра триває 90 хвилин». — С. Гербергер',
  'Ставки на поінти — це як ставки на гроші, тільки без грошей. І без ставок. 🤷',
  'Порада дня: ставте на перемогу тієї команди, яка заб’є більше.',
];

const NIGHT_QUIPS = [
  'Не спиться? Аналізуєш склад на завтра? 🦉',
  'Третя ночі — найкращий час для точних прогнозів. Мабуть.',
];
export function nightQuip() {
  const h = new Date().getHours();
  return h >= 1 && h < 5 ? NIGHT_QUIPS[Math.floor(Math.random() * NIGHT_QUIPS.length)] : null;
}

export function famousNameQuip(name) {
  const n = name.toLowerCase();
  if (/messi|мессі|leo/.test(n)) return 'Лео, ти? Тоді ставки на Аргентину заборонені 🐐';
  if (/ronaldo|роналду|cr7/.test(n)) return 'SIUUU! Ласкаво просимо, Кріштіану 🐐';
  if (/shevchenko|шевченко|sheva/.test(n)) return 'Андрію Миколайовичу, яка честь! 🇺🇦';
  return null;
}
