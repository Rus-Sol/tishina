/* ТИШИНА — логика мини-приложения Telegram. Без сборки и библиотек: официальный telegram-web-app.js + этот файл. */
(() => {
  const D = window.T_DATA;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');
  const $app = document.getElementById('app');
  const $dock = document.getElementById('dock');
  const $toast = document.getElementById('toast');

  /* ---------- Иконки (тонкие линии) ---------- */
  const I = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3h0A2.5 2.5 0 0 1 5 13.5z"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="16.5" cy="8" r="2.4"/><path d="M15.5 13.3c2.6-.3 4.4 1.3 5 3.9"/></svg>',
    course: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/></svg>',
    flower: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="6.2" rx="2" ry="3.2"/><ellipse cx="12" cy="17.8" rx="2" ry="3.2"/><ellipse cx="6.2" cy="12" rx="3.2" ry="2"/><ellipse cx="17.8" cy="12" rx="3.2" ry="2"/></svg>',
    ask: '<svg viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0A2.5 2.5 0 0 1 5 13.5z"/><path d="M10 8.6a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9v.4"/></svg>',
    path: '<svg viewBox="0 0 24 24"><path d="M5 19c3.5 0 3.5-6 7-6s3.5-6 7-6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="7" r="1.6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
  };

  /* ---------- Хранилище: Telegram CloudStorage, вне Telegram — localStorage ----------
     В облаке одно значение — до 4096 символов. Длинное (история практик) делим на куски:
     в ключе лежит {"__chunks": n}, сами куски — в key__0 … key__{n-1}. Битое или неполное облако
     никогда не затирает данные: тогда берём копию с телефона. */
  const useCloud = inTelegram && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9');
  const KEYS = ['start', 'why', 'top', 'note', 'sessions', 'watched', 'base1', 'base7', 'reset', 'dur', 'locked', 'bsrc', 'remind', 'remindAt'];
  const CHUNK = 4000;
  const Store = {
    pending() { try { return JSON.parse(localStorage.getItem('t__pending') || '[]'); } catch (e) { return []; } },
    setPending(list) { try { localStorage.setItem('t__pending', JSON.stringify([...new Set(list)])); } catch (e) { /* нет хранилища */ } },
    load() {
      return new Promise((resolve) => {
        const local = Store.local();
        if (!useCloud) return resolve(local);
        tg.CloudStorage.getItems(KEYS, (err, values) => {
          if (err || !values) return resolve(local);
          const pend = Store.pending();
          const out = {}; const chunked = [];
          KEYS.forEach((k) => {
            // что не успело уйти в облако (например, практика в авиарежиме) — берём с телефона
            if (pend.includes(k) || values[k] == null || values[k] === '') { out[k] = local[k]; return; }
            const v = safeParse(values[k]);
            if (v && typeof v === 'object' && !Array.isArray(v) && v.__chunks > 0) chunked.push([k, v.__chunks]);
            else out[k] = Store.pick(k, v, local[k]);
          });
          if (!chunked.length) return resolve(out);
          const names = chunked.flatMap(([k, n]) => Array.from({ length: n }, (_, i) => `${k}__${i}`));
          tg.CloudStorage.getItems(names, (e2, parts) => {
            chunked.forEach(([k, n]) => {
              const raw = e2 || !parts ? '' : Array.from({ length: n }, (_, i) => parts[`${k}__${i}`] || '').join('');
              out[k] = Store.pick(k, safeParse(raw), local[k]);
            });
            resolve(out);
          });
        });
      });
    },
    // облако или телефон: битое облако — телефон; история практик только растёт — берём ту, где записей больше
    pick(k, cloud, local) {
      if (cloud == null) return local;
      if (k === 'sessions' && Array.isArray(cloud) && Array.isArray(local) && local.length > cloud.length) return local;
      return cloud;
    },
    local() {
      const out = {};
      KEYS.forEach((k) => { try { out[k] = safeParse(localStorage.getItem('t_' + k)); } catch (e) { out[k] = null; } });
      return out;
    },
    cloudSet(key, raw, done) {
      if (raw.length <= CHUNK) { tg.CloudStorage.setItem(key, raw, (err, ok) => done(!err && ok)); return; }
      const parts = [];
      for (let i = 0; i < raw.length; i += CHUNK) parts.push(raw.slice(i, i + CHUNK));
      let left = parts.length; let fail = false;
      // сначала куски, потом заголовок — пока куски не записаны, читается прежняя версия
      parts.forEach((part, i) => tg.CloudStorage.setItem(`${key}__${i}`, part, (err, ok) => {
        if (err || !ok) fail = true;
        left -= 1;
        if (left) return;
        if (fail) { done(false); return; }
        tg.CloudStorage.setItem(key, JSON.stringify({ __chunks: parts.length }), (e2, ok2) => done(!e2 && ok2));
      }));
    },
    save(key, value) {
      const raw = JSON.stringify(value);
      try { localStorage.setItem('t_' + key, raw); } catch (e) { /* приватный режим — живём в памяти */ }
      if (!useCloud) return;
      Store.setPending([...Store.pending(), key]);
      Store.cloudSet(key, raw, (ok) => { if (ok) Store.setPending(Store.pending().filter((k) => k !== key)); });
    },
    flush() {
      if (!useCloud || !navigator.onLine) return;
      Store.pending().forEach((k) => {
        let raw = null; try { raw = localStorage.getItem('t_' + k); } catch (e) { /* нет */ }
        if (raw == null) return;
        Store.cloudSet(k, raw, (ok) => { if (ok) Store.setPending(Store.pending().filter((x) => x !== k)); });
      });
    },
  };
  function safeParse(v) { if (v == null || v === '') return null; try { return JSON.parse(v); } catch (e) { return null; } }

  /* ---------- Связь с ботом: события уходят в n8n, без сети — ждут в очереди ---------- */
  const Sync = {
    queue() { try { return JSON.parse(localStorage.getItem('t__outbox') || '[]'); } catch (e) { return []; } },
    setQueue(list) { try { localStorage.setItem('t__outbox', JSON.stringify(list.slice(-50))); } catch (e) { /* нет хранилища */ } },
    push(type, data = {}, id = `${type}-${Date.now()}`) {
      if (!inTelegram || !tg.initData || !D.course.apiUrl) return;
      Sync.setQueue([...Sync.queue().filter((e) => e.id !== id), { id, type, t: Date.now(), ...data }]);
      Sync.flush();
    },
    flush() {
      const events = Sync.queue();
      if (!events.length || !navigator.onLine || Sync.busy) return Promise.resolve(false);
      Sync.busy = true;
      // text/plain — «простой» запрос без предварительного CORS-запроса
      return fetch(D.course.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ initData: tg.initData, tz: -new Date().getTimezoneOffset(), events }) })
        .then((r) => { if (r.ok) Sync.setQueue(Sync.queue().filter((e) => !events.some((x) => x.id === e.id))); return r.ok; })
        .catch(() => false)
        .finally(() => { Sync.busy = false; });
    },
  };

  /* ---------- Состояние ---------- */
  const S = { start: null, why: [], top: [], note: '', sessions: [], watched: [], base1: '', base7: '', reset: '', dur: null, locked: 0, bsrc: {}, remind: null, remindAt: 0 };
  const view = { tab: 'today', sub: null, practice: { step: 'setup', sec: 600, before: null, after: null, startAt: 0, endAt: 0 }, faqTopic: 'Все', faqQuery: '', faqOpen: null, whyStep: 'intro', whyG: 0, whyR: 0, whyWin: {}, howto: false, howI: 0, howDone: false };
  let lastPetals = 0;

  /* ---------- Даты ---------- */
  const DAY = 86400000;
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function courseDay() {
    const forced = Number(new URLSearchParams(location.search).get('day'));
    if (forced >= 1) return forced;
    return Math.max(1, Math.floor((startOf(Date.now()) - startOf(S.start)) / DAY) + 1);
  }
  function streak() {
    const days = new Set(S.sessions.map((s) => dayKey(s.t)));
    let n = 0; let t = startOf(Date.now());
    if (!days.has(dayKey(t))) t -= DAY; // серия не сгорает до конца сегодняшнего дня
    while (days.has(dayKey(t))) { n += 1; t -= DAY; }
    return n;
  }
  const practicedToday = () => S.sessions.some((s) => dayKey(s.t) === dayKey(Date.now()));

  /* ---------- Telegram: тема, кнопки, отклик ---------- */
  function applyTheme() {
    const dark = inTelegram ? tg.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (inTelegram) {
      try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); if (tg.setBottomBarColor) tg.setBottomBarColor(bg); } catch (e) { /* старые клиенты */ }
    }
  }
  const haptic = {
    tap() { if (inTelegram) tg.HapticFeedback.selectionChanged(); },
    soft() { if (inTelegram) tg.HapticFeedback.impactOccurred('soft'); },
    ok() { if (inTelegram) tg.HapticFeedback.notificationOccurred('success'); },
    warn() { if (inTelegram) tg.HapticFeedback.notificationOccurred('warning'); },
  };
  function setBack(show) {
    if (!inTelegram) return;
    if (show) tg.BackButton.show(); else tg.BackButton.hide();
  }
  if (inTelegram) tg.BackButton.onClick(() => go(view.tab));

  function toast(text, ms = 1600) {
    $toast.textContent = text;
    $toast.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('is-on'), ms);
  }
  function open(url) { if (inTelegram && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url); else if (inTelegram && tg.openLink) tg.openLink(url); else window.open(url, '_blank'); }

  /* ---------- Звоночек: мягкий синтез, без файлов ---------- */
  let audio = null;
  function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
  // Мягкий звоночек — как поющая чаша: плавная атака, тёплый тон, долгое затухание, лёгкое «дыхание» звука.
  // start — один тихий удар; end — два удара, второй тише: мягко выводит из практики.
  function strike(at, vol) {
    const f0 = 392;
    const out = audio.createGain();
    const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
    out.gain.value = vol;
    out.connect(lp).connect(audio.destination);
    // [множитель частоты, громкость, время затухания]: высокие обертоны гаснут быстрее — звук смягчается к концу
    [[1, 1, 13], [2.0, 0.16, 5], [2.76, 0.12, 3.5], [5.4, 0.03, 1.6]].forEach(([k, a, dec]) => {
      [[-0.3, 0.7], [0.3, 0.3]].forEach(([beat, share]) => { // два близких тона разной силы — мягкое «дыхание» звука, как у чаши
        const o = audio.createOscillator(); const g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f0 * k + beat;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(a * share, at + 0.09);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
        o.connect(g).connect(out); o.start(at); o.stop(at + dec + 0.1);
      });
    });
  }
  function bell(kind = 'start') {
    if (!audio) return;
    const now = audio.currentTime + 0.02;
    if (kind === 'end') { strike(now, 0.32); strike(now + 3.2, 0.2); } else strike(now, 0.26);
  }

  /* ---------- Ромашка внимания ---------- */
  function daisy({ total, on, size = 320, label = true, fresh = 0 }) {
    const c = size / 2; const r = size * 0.12; const len = size * 0.28; const w = Math.max(size * 0.045, (Math.PI * 2 * (r + len * 0.55)) / total * 0.42);
    let petals = '';
    for (let i = 0; i < total; i += 1) {
      const a = (i * 360) / total;
      const isOn = i < on; const isNew = isOn && i >= on - fresh;
      petals += `<ellipse class="petal${isOn ? ' is-on' : ''}${isNew ? ' is-new' : ''}" cx="${c}" cy="${c - r - len / 2 - 2}" rx="${w}" ry="${len / 2}" transform="rotate(${a} ${c} ${c})" style="${isNew ? `animation-delay:${(i - (on - fresh)) * 60}ms` : ''}"/>`;
    }
    const center = `<circle class="center" cx="${c}" cy="${c}" r="${r}"/>` + (label ? `<text x="${c}" y="${c + size * 0.03}" text-anchor="middle" font-size="${size * 0.085}">${on}</text>` : '');
    return `<svg class="daisy" viewBox="0 0 ${size} ${size}" role="img" aria-label="Ромашка внимания: ${on} лепестков">${petals}${center}</svg>`;
  }
  const daisyOutline = (cls) => `<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<ellipse cx="100" cy="52" rx="13" ry="34" transform="rotate(${i * 30} 100 100)"/>`).join('')}<circle cx="100" cy="100" r="16"/></svg>`;

  /* ---------- Хелперы разметки ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const btn = (text, attrs = '', cls = '') => `<button class="btn ${cls}" ${attrs}><span>${text}</span><span class="btn__icon">${I.arrow}</span></button>`;
  const allWhy = () => D.why.flatMap((g) => g.items.map(([id, t, src, proof, when, care]) => ({ id, t, src, proof, when, care, group: g.title, gid: g.id })));
  const proofHtml = (x) => `${x.proof}${x.care ? '<span class="item__care"> · не заменяет лечение</span>' : ''}`;
  const qbar = (k, n) => `<div class="qbar" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < k ? 'is-on' : ''}"></i>`).join('')}</div>`;
  const whyById = (id) => allWhy().find((x) => x.id === id);
  const mainIds = () => (S.top.length ? S.top : S.why);
  const plural = (n, one, few, many) => { const m10 = n % 10; const m100 = n % 100; if (m10 === 1 && m100 !== 11) return one; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few; return many; };

  /* ---------- Шаги практики: анимации-инструкции (что именно сделать) ---------- */
  const AV_PLANE = '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
  const AV_MOON = '<svg viewBox="0 0 24 24"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5z"/></svg>';
  const AV_BELL = '<svg viewBox="0 0 24 24"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
  const AV = {
    // Место: авиарежим и «не беспокоить» включаются, телефон переворачивается экраном вниз
    plane: () => `<div class="av av-plane" aria-hidden="true">
        <div class="av-phone"><div class="av-phone__in">
          <div class="av-phone__face">
            <div class="av-phone__bar"><span>7:00</span><span class="av-phone__air">${AV_PLANE}</span></div>
            <div class="av-row"><span class="av-ico">${AV_PLANE}</span><span class="av-row__t">Авиарежим</span><span class="av-tog"><i></i></span></div>
            <div class="av-row"><span class="av-ico">${AV_MOON}</span><span class="av-row__t">Не беспокоить</span><span class="av-tog av-tog--2"><i></i></span></div>
          </div>
          <div class="av-phone__back"><i></i></div>
        </div></div>
        <div class="av-cap"><span class="av-cap1">Авиарежим</span><span class="av-cap2">Экраном вниз</span></div>
      </div>`,
    // Вход: три глубоких вдоха по кругу, потом дыхание отпускаем
    breath: () => `<div class="av av-breath" aria-hidden="true">
        <div class="av-orb"><i></i></div>
        <div class="av-stack av-bw"><span class="av-in">Вдох</span><span class="av-out">Выдох</span><span class="av-rest">Теперь дыши как обычно</span></div>
        <div class="av-stack av-bn"><span class="av-n1">1 из 3</span><span class="av-n2">2 из 3</span><span class="av-n3">3 из 3</span></div>
      </div>`,
    // Звоночек: звенит → посиди пять секунд → медленно открой глаза
    bell: () => `<div class="av av-bell" aria-hidden="true">
        <div class="av-stack av-bc">
          <span class="av-bellbox"><i class="av-wave"></i><i class="av-wave av-wave--2"></i>${AV_BELL}</span>
          <span class="av-cd"><b>5</b><b>4</b><b>3</b><b>2</b><b>1</b></span>
          <span class="av-eye"><svg viewBox="0 0 120 60"><path d="M8 30Q60-12 112 30 60 72 8 30z"/><circle cx="60" cy="30" r="13"/></svg></span>
        </div>
        <div class="av-stack av-bt"><span class="av-t1">Звоночек</span><span class="av-t2">Не вскакивай. Посиди</span><span class="av-t3">Медленно открой глаза</span></div>
      </div>`,
  };
  // Картинка шага: анимация, фото (с подсказками-точками) или заглушка
  function stepVisual(s) {
    if (s.anim && AV[s.anim]) return AV[s.anim]();
    if (!s.img) return daisyOutline('hstep__daisy');
    const dots = (s.dots || []).map((p, i) => `<span class="av-dot" style="left:${p.x}%;top:${p.y}%;animation-delay:${i * 1.2}s"></span><span class="av-dlabel" style="left:${p.x + 5}%;top:${p.y}%">${p.t}</span>`).join('');
    return `<img src="${s.img}" alt="${esc(s.alt)}" loading="lazy">${dots}`;
  }

  /* ---------- Экраны ---------- */
  // Видео открывается в свой день или сразу, как посмотрел предыдущее — можно пройти курс быстрее
  const isLocked = (v, day) => v.day > day && v.id > 0 && !S.watched.includes(v.id - 1);

  // Строки списка видео — общие для главной и вкладки «Курс»
  function videoRows(day, marks = false) {
    return D.videos.map((v) => {
      const done = S.watched.includes(v.id);
      const locked = isLocked(v, day);
      const state = done ? I.check : locked ? I.lock : I.arrow;
      const mark = marks && !done && v.day === day ? `<span class="chip chip--accent row__mark">${day === 1 && v.id === 0 ? 'начни отсюда' : 'новое'}</span>` : '';
      return `<button class="row${done ? ' is-done' : ''}${locked ? ' is-locked' : ''}" ${locked ? 'aria-disabled="true"' : `data-go="lesson:${v.id}"`}>
        <span class="row__day num">${v.id}</span>
        <span class="row__body"><span class="row__t">${v.title}</span><span class="row__s">${locked ? `Откроется после видео ${v.id - 1}` : `День ${v.day} · ${v.min} мин`}${mark}</span></span>
        <span class="row__state">${state}</span>
      </button>`;
    }).join('');
  }

  function screenToday() {
    const day = Math.min(courseDay(), 7);
    const h = new Date().getHours();
    const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.first_name : '';
    const att = D.attitudes[(day - 1) % D.attitudes.length];
    const done = practicedToday();
    const st = streak();
    const why = mainIds().length ? whyById(mainIds()[(day - 1) % mainIds().length]) : null;
    const howOpen = view.howto;
    const rules = D.rules.filter((r) => r.day <= day);
    const rulesLeft = D.rules.length - rules.length;
    const firstTime = day === 1 && !S.watched.includes(1) && !S.sessions.length;

    const step = (s, i) => `<li class="hstep">
        <div class="hstep__img${s.img && !s.anim ? ' has-img' : ''}">${stepVisual(s)}<b class="hstep__n num">${i + 1}</b></div>
        <div class="hstep__t">${s.t}</div>
        <p class="hstep__do">${s.do}</p>
        <p class="hstep__why"><span>Зачем:</span> ${s.why}</p>
      </li>`;

    return `
      <div class="topbar">
        <span class="eyebrow"><span class="dot"></span>День ${day} из ${D.course.days}</span>
        <span class="streak">${st ? `<b class="num">${st}</b> ${plural(st, 'день', 'дня', 'дней')} подряд` : 'Первый шаг сегодня'}</span>
      </div>
      <h1 class="title">${greet}${name ? `, ${esc(name)}` : ''}</h1>
      <p class="lead attitude-line"><span class="muted">Установка дня:</span> <b>${att.word}.</b> ${att.line}</p>

      ${S.top.length ? '' : `<div class="shell shell--hl"><div class="core">
        <span class="chip chip--accent">Начни с этого · 3 минуты</span>
        <h2 class="h2" style="margin-top:14px">Выбери своё «зачем»</h2>
        <p class="sub" style="margin-bottom:18px">Короткий тест: что медитация может дать тебе. В конце выберешь три главных. С ясным «зачем» люди практикуют дольше.</p>
        ${btn(S.why.length ? 'Продолжить тест' : 'Пройти тест', 'data-go="why"', 'btn--full btn--accent')}
      </div></div>
      <div class="section-gap"></div>`}

      <div class="shell"><div class="core practice-card">
        <div class="practice-card__row">
          <span class="eyebrow" style="margin:0"><span class="dot"></span>Практика</span>
          ${done ? `<span class="chip chip--accent">${I.check} сегодня сделано</span>` : ''}
        </div>
        <div class="practice-card__min num">${durBig(view.practice.sec)}</div>
        ${why ? `<div><div class="why-now__k">Ты садишься, чтобы</div><div class="why-now__t">${esc(why.t.toLowerCase())}</div></div>` : ''}
        ${btn(done ? 'Сесть ещё раз' : 'Начать практику', 'data-start="1"', `btn--full${S.top.length ? ' btn--accent' : ''}`)}
        ${firstTime ? '<p class="sub" style="margin:-6px 2px 0">Первый раз? Сначала посмотри видео 0 и 1 ниже: там всё о том, как сесть и что делать.</p>' : ''}
      </div></div>

      <div class="label label--row"><span>Как делать практику · ${D.howto.length} шагов</span><button class="link" data-howto="1" aria-expanded="${howOpen}">${howOpen ? 'Свернуть' : 'Показать'}</button></div>
      ${howOpen ? `<ol class="howto">${D.howto.map(step).join('')}</ol>` : ''}
      ${rules.length ? `<div class="shell" style="margin-top:12px"><div class="core rules">
        <div class="rules__h"><span class="h2">Сверься с правилами</span><span class="chip num">${rules.length} из ${D.rules.length}</span></div>
        <ul>${rules.map((r) => `<li><span class="rules__i">${I.check}</span><span><b>${r.t}</b><span>${r.line}</span></span></li>`).join('')}</ul>
        ${rulesLeft ? `<p class="sub">Ещё ${rulesLeft} ${plural(rulesLeft, 'правило откроется', 'правила откроются', 'правил откроются')} в следующих уроках.</p>` : ''}
      </div></div>` : ''}

      <div class="label">Курс · ${D.videos.length} видео</div>
      <div class="shell"><div class="core list" style="padding:6px 16px">${videoRows(day, true)}</div></div>
`;
  }

  function screenCourse() {
    const day = courseDay();
    return `
      <span class="eyebrow"><span class="dot"></span>Курс</span>
      <h1 class="title">7 дней тишины</h1>
      <p class="lead">8 коротких видео и по 10 минут практики в день. Новое видео приходит каждый день, а если хочется быстрее — следующее открывается сразу после предыдущего.</p>
      <div class="shell"><div class="core list" style="padding:6px 16px">${videoRows(day)}</div></div>
      <p class="sub" style="margin:18px 4px 0">Дни 8–14 — без новых видео: держим серию, бот каждый день напомнит о практике.</p>`;
  }

  function markWatched(id) {
    if (S.watched.includes(id)) return;
    S.watched.push(id); Store.save('watched', S.watched); Sync.push('watched', { n: id }, `w-${id}`);
    haptic.ok(); toast(id < 7 ? 'Следующее видео открыто' : 'Отмечено');
  }
  /* Видео как на больших сервисах: просмотр засчитывается, когда реально посмотрено 80 % (перемотка не в счёт),
     а при следующем открытии видео продолжается с того места, где остановился. События video не всплывают — ловим на захвате. */
  const VP = { get(id) { try { return JSON.parse(localStorage.getItem(`t__vp${id}`) || '{}'); } catch (e) { return {}; } },
    set(id, v) { try { localStorage.setItem(`t__vp${id}`, JSON.stringify(v)); } catch (e) { /* нет хранилища */ } } };
  const vidOf = (e) => (e.target && e.target.dataset && e.target.dataset.vid != null ? Number(e.target.dataset.vid) : null);
  function watchedNow(id) {
    if (S.watched.includes(id)) return;
    markWatched(id);
    // без перерисовки: иначе плеер пересоздастся и видео остановится
    const b = document.querySelector(`[data-watch="${id}"]`);
    if (b) { b.disabled = true; b.textContent = 'Просмотрено'; }
  }
  document.addEventListener('loadedmetadata', (e) => {
    const id = vidOf(e); if (id == null) return;
    const v = e.target; const p = VP.get(id);
    if (p.pos > 10 && p.pos < v.duration - 20) v.currentTime = p.pos;
    v._last = v.currentTime;
  }, true);
  document.addEventListener('timeupdate', (e) => {
    const id = vidOf(e); if (id == null) return;
    const v = e.target; const step = v.currentTime - (v._last || 0); v._last = v.currentTime;
    const p = v._p || (v._p = VP.get(id));
    if (step > 0 && step < 1.5 * (v.playbackRate || 1) + 0.5) p.seen = (p.seen || 0) + step; // обычное воспроизведение; скачки перемотки не считаем
    p.pos = v.currentTime;
    if ((v._saved || 0) + 3 < Date.now() / 1000) { VP.set(id, p); v._saved = Date.now() / 1000; }
    if (v.duration && p.seen >= v.duration * 0.8) watchedNow(id);
  }, true);
  document.addEventListener('pause', (e) => { const id = vidOf(e); if (id != null && e.target._p) VP.set(id, e.target._p); }, true);
  document.addEventListener('ended', (e) => {
    const id = vidOf(e); if (id == null) return;
    const v = e.target; const p = v._p || VP.get(id); p.pos = 0; VP.set(id, p);
    if (v.duration && (p.seen || 0) >= v.duration * 0.8) watchedNow(id);
  }, true);

  function screenLesson(id) {
    const v = D.videos.find((x) => x.id === Number(id));
    const done = S.watched.includes(v.id);
    return `
      <span class="eyebrow"><span class="dot"></span>Видео ${v.id} · день ${v.day}</span>
      <h1 class="title">${v.title}</h1>
      <p class="lead num">${v.min} минут</p>
      <div class="shell"><div class="core" style="padding:8px">
        ${v.src
          ? `<video class="video__player" controls playsinline preload="metadata" poster="img/video${v.id}.jpg" src="${v.src}" data-vid="${v.id}"></video>`
          : `<button class="video__frame" style="margin:0;width:100%;border:0" data-sendvideo="${v.id}" aria-label="Прислать видео в чат">${daisyOutline('video__daisy')}<span class="chip video__soon">Прислать видео в чат</span><span class="video__play">${I.play}</span></button>`}
      </div></div>
      ${v.src ? `<button class="link video__alt" data-sendvideo="${v.id}">Не грузится? Прислать видео в чат</button>` : ''}
      <div class="section-gap"></div>
      <p class="lesson-about">${v.about}</p>
      <div class="section-gap"></div>
      <div class="stack">
        ${btn(done ? 'Просмотрено' : 'Посмотрел — дальше', `data-watch="${v.id}" ${done ? 'disabled' : ''}`, 'btn--full')}
        ${v.id >= 1 ? btn('Перейти к практике', 'data-tab="practice"', 'btn--full btn--accent') : ''}
      </div>`;
  }

  function scaleButtons(attr, value) {
    return `<div class="scale">${Array.from({ length: 10 }, (_, i) => `<button class="num" ${attr}="${i + 1}" aria-pressed="${value === i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="scale__ends"><span>неспокойно</span><span>очень спокойно</span></div>`;
  }

  // Перед первой практикой — 5 шагов по одному на экран. После хотя бы одной практики не показываем
  function screenHowto() {
    const i = view.howI; const s = D.howto[i]; const n = D.howto.length; const last = i === n - 1;
    return `
      ${qbar(i + 1, n)}
      <span class="eyebrow"><span class="dot"></span>Перед первой практикой · шаг ${i + 1} из ${n}</span>
      <div class="howstep__img${s.img && !s.anim ? ' has-img' : ''}">${stepVisual(s)}<b class="hstep__n num">${i + 1}</b></div>
      <h1 class="title">${s.t}</h1>
      <p class="lead" style="margin-bottom:10px">${s.do}</p>
      <p class="sub"><span class="muted">Зачем:</span> ${s.why}</p>
      <div class="section-gap"></div>
      ${btn(last ? 'Понятно, начинаем' : 'Дальше', 'data-hownext="1"', 'btn--full btn--accent')}
      <div class="howstep__nav">${i ? '<button class="ghost" data-howback="1">Назад</button>' : '<span></span>'}${last ? '' : '<button class="ghost" data-howskip="1">Пропустить</button>'}</div>`;
  }

  function screenPractice() {
    const p = view.practice;
    if (['setup', 'before'].includes(p.step) && !S.sessions.length && !view.howDone) return screenHowto();
    const why = mainIds().length ? whyById(mainIds()[(courseDay() - 1) % mainIds().length]) : null;
    if (p.step === 'setup') return `
      <div class="practice">
        <div><span class="eyebrow"><span class="dot"></span>Практика</span>
        <h1 class="title">Тишина и дыхание</h1>
        <p class="lead" style="margin:0 auto;max-width:340px">Дыши как обычно и наблюдай. Ушёл в мысли — заметил и вернулся. В конце прозвенит мягкий звоночек.</p></div>
        <div class="dur-wrap">
          <div class="dur" role="group" aria-label="Длительность"><span class="dur__pill" aria-hidden="true"></span>${PRESETS.map((m) => `<button class="num" data-min="${m}" aria-pressed="${p.sec === m * 60}">${m} мин</button>`).join('')}</div>
          <div class="picker" aria-label="Своё время: минуты и секунды">
            <div class="picker__band"></div>
            <div class="picker__col"><div class="wheel" data-wheel="m" tabindex="0" aria-label="Минуты">${Array.from({ length: 61 }, (_, i) => `<div class="wheel__i num">${i}</div>`).join('')}</div><span class="picker__u">мин</span></div>
            <div class="picker__col"><div class="wheel" data-wheel="s" tabindex="0" aria-label="Секунды">${Array.from({ length: 60 }, (_, i) => `<div class="wheel__i num">${i}</div>`).join('')}</div><span class="picker__u">сек</span></div>
          </div>
          <button class="ghost bell-try" data-belltry="1">${AV_BELL}<span>Послушать звоночек</span></button>
        </div>
        ${why ? `<p class="sub" style="max-width:320px;margin:0 auto">Ты садишься, чтобы: <b style="color:var(--ink)">${why.t.toLowerCase()}</b></p>` : ''}
        <div>${btn('Начать', 'data-step="before"', 'btn--accent')}</div>
        ${lockNote(`${S.locked ? 'В прошлый раз экран заблокировался, и звоночек не прозвенел. ' : ''}Положи телефон экраном вниз — экран сам притухнет, а звоночек прозвенит. Авиарежим можно.`)}
      </div>`;
    if (p.step === 'before') return `
      <div class="practice">
        <div><h1 class="title">Насколько ты спокоен сейчас?</h1><p class="lead" style="margin:0">Отметь честно — после практики сравним.</p></div>
        ${scaleButtons('data-before', p.before)}
        <button class="ghost" data-step="setup">Назад</button>
      </div>`;
    if (p.step === 'run' || p.step === 'bell') return `
      <div class="practice">
        <div class="breath"><div class="breath__ring"></div>${daisyOutline('breath__petals')}<div class="breath__core"></div></div>
        <div><div class="clock num" id="clock">${fmt(Math.max(0, p.endAt - Date.now()))}</div>
        <div class="clock-sub" id="clock-sub">${p.step === 'bell' ? (p.wasLocked ? 'Время вышло, пока экран был заблокирован или приложение свёрнуто, — поэтому звоночек был не слышен. Практика засчитается.' : 'Звоночек. Хочешь — посиди ещё.') : 'Ушёл в мысли — заметил и вернулся'}</div></div>
        <div>${p.step === 'bell' ? btn('Завершить', 'data-step="after"', 'btn--accent') : '<button class="ghost" data-step="after">Закончить раньше</button>'}</div>
        ${p.step === 'run' ? lockNote('Положи телефон экраном вниз. Экран сам притухнет, а звоночек прозвенит.') : ''}
      </div>`;
    if (p.step === 'after') return `
      <div class="practice">
        <div><h1 class="title">А сейчас?</h1><p class="lead" style="margin:0">Насколько ты спокоен после практики.</p></div>
        ${scaleButtons('data-after', p.after)}
      </div>`;
    const delta = (p.after || 0) - (p.before || 0);
    return `
      <div class="practice">
        <div><span class="eyebrow"><span class="dot"></span>Засчитано</span></div>
        <div class="daisy-wrap" style="padding:0">${daisy({ total: Math.max(14, S.sessions.length), on: S.sessions.length, size: 220, fresh: 1 })}</div>
        <div><div class="result-num num">${delta > 0 ? '+' : ''}${delta}</div>
        <p class="lead" style="margin:6px 0 0">${delta > 0 ? 'к спокойствию за одну практику' : delta === 0 ? 'Так тоже бывает. Практика засчитана' : 'Бывают и такие дни. Шаг всё равно сделан'}</p></div>
        <p class="sub" style="max-width:320px;margin:0 auto">Ещё один лепесток в твоей ромашке. Каждое «заметил и вернулся» — это подход.</p>
        ${dayQuestion()}
        <div>${btn('Готово', 'data-tab="today"')}</div>
      </div>`;
  }

  // Вопрос дня после практики: проверка навыка, который дал урок этого дня (день 1 — только «до/после»)
  const DAYQ = {
    2: { k: 'r', q: 'Сколько раз удалось «протрезветь» и вернуться? Примерно' },
    3: { k: 'w', q: 'Сколько раз хотелось пошевелиться, а получилось подождать? Примерно' },
    4: { k: 'm', q: 'Куда сегодня больше вело?', opts: ['в сон', 'в середине', 'в напряжение'] },
    6: { k: 'e', q: 'Приходили сегодня чувства?', opts: ['нет, было спокойно', 'да, получилось назвать и посмотреть', 'да, но утащило'] },
    5: { k: 'g', q: 'Что сегодня получилось? Можно несколько', multi: true, note: 'Хоть одно — практика удалась. Ни одного — тренировка всё равно была.',
      opts: ['заметить мысль и вернуться', 'мысль прошла мимо', 'отпустить напряжение', 'подождать, не почесаться', 'стало чуть тише'] },
  };
  function dayQuestion() {
    const day = courseDay();
    if (day < 2) return '';
    const dq = DAYQ[day] || DAYQ[2];
    const last = S.sessions[S.sessions.length - 1] || {};
    const on = (o) => (dq.multi ? (last[dq.k] || []).includes(o) : last[dq.k] === o);
    if (dq.opts) return `
        <div style="max-width:320px;margin:0 auto;text-align:left"><p class="sub" style="margin:0 0 8px">${dq.q}</p>
        <div class="chips chips--wrap" role="group" aria-label="${dq.q}">${dq.opts.map((o) => `<button data-dqpick="${o}" data-dqkey="${dq.k}"${dq.multi ? ' data-dqmulti="1"' : ''} aria-pressed="${on(o)}">${o}</button>`).join('')}</div>
        ${dq.note ? `<p class="sub" style="margin:8px 0 0">${dq.note}</p>` : ''}</div>`;
    return `
        <label class="baseline" style="grid-template-columns:1fr;max-width:280px;margin:0 auto;text-align:left">${dq.q}<input class="num" inputmode="numeric" maxlength="3" data-dqnum="${dq.k}" placeholder="—" value="${esc(last[dq.k] || '')}"></label>`;
  }

  /* ---------- Ответы: база с поиском (app/search.js + Fuse.js), «Спросить Рустема», запросы без ответа — боту ---------- */
  let faqIx = null;
  const faqIndex = () => (faqIx = faqIx || (window.TSearch ? window.TSearch.build(D.faq) : null));
  const GO_LABEL = { practice: 'Открыть практику', why: 'Пройти «Моё зачем»', path: 'Открыть «Мой путь»', course: 'Открыть курс', howto: 'Показать шаги практики' };
  const faqHits = (q) => { const ix = faqIndex(); return ix && q.length >= 2 ? window.TSearch.query(ix, q).slice(0, 8) : null; };
  const faqById = (id) => D.faq.findIndex((f) => f.id === id);
  const qaBlock = (h, body, cls = '') => `<div class="qa__b${cls}"><div class="qa__h">${h}</div>${body}</div>`;
  function qaBody(f) {
    const dos = [].concat(f.do || []);
    const doHtml = dos.length > 1 ? `<ol class="qa__ol">${dos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : dos.length ? `<p>${esc(dos[0])}</p>` : '';
    const see = (f.see || []).map(faqById).filter((j) => j >= 0);
    return `<p class="qa__short">${esc(f.short)}</p>
      ${f.why ? qaBlock('Почему так', `<p>${esc(f.why)}</p>`) : ''}
      ${dos.length ? qaBlock('Что делать', doHtml) : ''}
      ${(f.help || []).length ? `<details class="qa__help"><summary>Телефоны помощи</summary>${f.help.map(([w, n, t]) => `<p><span>${esc(w)}</span><b>${esc(n)}</b><small>${esc(t)}</small></p>`).join('')}</details>` : ''}
      ${f.story ? qaBlock('Из опыта Рустема', `<p>${esc(f.story)}</p>`, ' qa__b--story') : ''}
      ${f.sci ? qaBlock('Что говорит наука', `<p>${esc(f.sci[0])} <span class="qa__src">${esc(f.sci[1])}</span></p>`, ' qa__b--sci') : ''}
      ${(f.links || []).length ? `<div class="qa__links">${f.links.map(([t, u]) => `<button class="qa__link" data-url="${esc(u)}">${esc(t)} <span aria-hidden="true">↗</span></button>`).join('')}</div>` : ''}
      ${f.go ? `<button class="link qa__go" data-faqgo="${f.go}">${GO_LABEL[f.go]} ${I.arrow}</button>` : ''}
      ${see.length ? `<div class="qa__see"><div class="qa__h">Читай также</div>${see.map((j) => `<button class="qa__seebtn" data-see="${j}"><span>${esc(D.faq[j].q)}</span>${I.arrow}</button>`).join('')}</div>` : ''}`;
  }
  const qaRow = (f, i, marks) => `<div class="qa${view.faqOpen === i ? ' is-open' : ''}" id="qa-${i}"><button class="qa__q" data-qa="${i}" aria-expanded="${view.faqOpen === i}"><span>${marks ? window.TSearch.mark(f.q, marks, esc) : esc(f.q)}</span>${I.plus}</button><div class="qa__a"><div>${view.faqOpen === i ? qaBody(f) : ''}</div></div></div>`;
  const qaList = (rows) => `<div class="shell"><div class="core" style="padding:4px 18px">${rows.join('')}</div></div>`;
  function askBox(q, found) {
    const sent = view.faqAsked === q;
    if (found) return `<div class="ask ask--small">${sent ? '<span>Отправлено Рустему ✓</span>' : `<span>Не то?</span><button class="link" data-ask="1">Спросить Рустема ${I.arrow}</button>`}</div>`;
    return `<div class="shell"><div class="core ask">
      <span class="ask__i">${I.ask}</span>
      <h2 class="h2">Такого ответа пока нет</h2>
      <p class="sub">${sent ? 'Вопрос у Рустема. Ответ придёт в чат с ботом — обычно в течение дня.' : 'Отправь вопрос Рустему — он ответит в чат с ботом, обычно в течение дня.'}</p>
      ${sent ? '' : btn('Спросить Рустема', 'data-ask="1"', 'btn--full btn--accent')}
    </div></div>`;
  }

  function screenAnswers() {
    const q = view.faqQuery.trim();
    const hits = faqHits(q);
    const all = D.faq.map((f, i) => [f, i]);
    let body;
    if (hits) {
      const shown = new Set(hits.map((r) => r.i));
      const more = [...new Set(hits.slice(0, 3).flatMap((r) => (D.faq[r.i].see || []).map(faqById)))].filter((j) => j >= 0 && !shown.has(j)).slice(0, 3);
      const pop = all.filter(([f, i]) => f.pop && !shown.has(i)).slice(0, 3);
      body = hits.length
        ? `<div class="label">Нашлось: <span class="num">${hits.length}</span></div>${qaList(hits.map((r) => qaRow(D.faq[r.i], r.i, r.marks)))}${more.length ? `<div class="label">Возможно, тебе будет интересно</div>${qaList(more.map((j) => qaRow(D.faq[j], j)))}` : ''}${askBox(q, true)}`
        : `${askBox(q, false)}<div class="label">Частые вопросы</div>${qaList(pop.map(([f, i]) => qaRow(f, i)))}`;
    } else if (view.faqTopic === 'Все') {
      body = `<div class="label">Частые вопросы</div>${qaList(all.filter(([f]) => f.pop).map(([f, i]) => qaRow(f, i)))}`
        + D.faqTopics.map((t) => { const rows = all.filter(([f]) => f.t === t && !f.pop); return rows.length ? `<div class="label">${t}</div>${qaList(rows.map(([f, i]) => qaRow(f, i)))}` : ''; }).join('');
    } else {
      body = qaList(all.filter(([f]) => f.t === view.faqTopic).map(([f, i]) => qaRow(f, i)));
    }
    return `
      <span class="eyebrow"><span class="dot"></span>Ответы</span>
      <h1 class="title">Ответы на вопросы</h1>
      <p class="lead">${D.faq.length} ответов на то, что спрашивают новички. Пиши своими словами, поиск поймёт.</p>
      <label class="search">${I.search}<input id="faq-search" type="search" enterkeyhint="search" autocomplete="off" placeholder="Например: засыпаю, болит спина, мысли скачут" value="${esc(view.faqQuery)}" aria-label="Поиск по ответам"></label>
      ${q ? '' : `<div class="chips" role="group" aria-label="Темы">${['Все', ...D.faqTopics].map((t) => `<button data-topic="${t}" aria-pressed="${view.faqTopic === t}">${t}</button>`).join('')}</div>`}
      <div class="section-gap"></div>
      ${body}`;
  }

  // так же, как в боте: 2.5 — это кнопка «2–3 раза», 4 — «4 и больше»
  const baseLabel = (v) => ({ 0: 'ни разу', 1: '1 раз', 2.5: '2–3 раза', 4: '4 и больше' }[Number(v)] || `${v} ${plural(Number(v), 'раз', 'раза', 'раз')}`);
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  function screenPath() {
    const n = S.sessions.length;
    const total = Math.max(14, Math.ceil(n / 7) * 7);
    const fresh = Math.max(0, n - lastPetals); lastPetals = n;
    const minutes = S.sessions.reduce((s, x) => s + (x.m || 0), 0);
    const last = S.sessions.slice(-7);
    const chosen = mainIds().map(whyById).filter(Boolean);
    const extra = S.top.length ? S.why.filter((id) => !S.top.includes(id)).length : 0;
    return `
      <span class="eyebrow"><span class="dot"></span>Мой путь</span>
      <h1 class="title">Твоя ромашка внимания</h1>
      <p class="lead">Каждая практика — лепесток. Со временем ты возвращаешься быстрее, и лепестки становятся короче.</p>
      <div class="daisy-wrap">${daisy({ total, on: n, fresh })}</div>
      <p class="sub" style="text-align:center;margin:6px 0 24px"><span class="num">${n}</span> из <span class="num">${total}</span> ${plural(total, 'лепестка', 'лепестков', 'лепестков')}</p>

      <div class="stats">
        <div class="stat"><b class="num">${streak()}</b><span>${plural(streak(), 'день', 'дня', 'дней')} подряд</span></div>
        <div class="stat"><b class="num">${n}</b><span>${plural(n, 'практика', 'практики', 'практик')}</span></div>
        <div class="stat"><b class="num">${minutes}</b><span>минут тишины</span></div>
      </div>

      <div class="label">Спокойствие до и после</div>
      <div class="shell"><div class="core">
        ${last.length ? `<div class="bars">${last.map((s) => `<div class="bars__col"><div class="bars__pair"><span class="bars__b" style="height:${(s.b || 0) * 9.6}px"></span><span class="bars__a" style="height:${(s.a || 0) * 9.6}px"></span></div><span class="bars__d num">${new Date(s.t).getDate()}</span></div>`).join('')}</div>
        <div class="legend"><span><i style="background:var(--line)"></i>до</span><span><i style="background:var(--accent)"></i>после</span></div>` : '<p class="sub" style="margin:0">После первой практики здесь появятся твои цифры.</p>'}
      </div></div>

      <div class="label">Точка отсчёта</div>
      <div class="shell"><div class="core">
        <p class="sub" style="margin:0">Сколько раз ты сбился со счёта выдохов за минуту проверки в боте. В первый день и на седьмой — чем меньше, тем лучше.</p>
        <div class="baseline">
          ${['base1', 'base7'].map((k, i) => `<label>День ${i ? 7 : 1}${(S.bsrc || {})[k] ? `<span class="base-val">${baseLabel(S[k])}</span>` : `<input class="num" inputmode="numeric" maxlength="3" data-base="${k}" value="${esc(S[k] || '')}" placeholder="—">`}</label>`).join('')}
        </div>
      </div></div>

      <div class="label">Напоминание</div>
      <div class="shell"><div class="core remind">
        <label class="remind__row"><span>🔔 Бот напомнит в</span><input type="time" step="300" class="num" data-remind value="${hhmm(S.remind == null ? 540 : S.remind)}"></label>
        <p class="sub" style="margin:8px 0 0">Нажми на время, чтобы поменять.</p>
      </div></div>

      <div class="label">Моё зачем</div>
      <div class="shell"><div class="core why-chosen">
        ${chosen.length ? `<ul>${chosen.map((x) => `<li>${S.top.length ? I.star : I.heart}<span>${x.t}</span></li>`).join('')}</ul>${extra ? `<p class="sub" style="margin:2px 0 0">и ещё ${extra} отмечено</p>` : ''}${S.note ? `<p class="sub" style="margin:4px 0 0">«${esc(S.note)}»</p>` : ''}<button class="link" data-go="why">Изменить ${I.arrow}</button>` : `<p class="sub" style="margin:0 0 14px">Ты ещё не выбрал, зачем садишься.</p>${btn('Выбрать', 'data-go="why"', 'btn--full')}`}
      </div></div>`;
  }

  // «Моё зачем» — тест: сфера за сферой → если отмечено много, по одному лучшему в каждой сфере → 3 главных → строка → итог
  const TOP = 3; const WHY_LIST = 8;
  const whyRounds = () => D.why.filter((g) => g.items.filter(([id]) => S.why.includes(id)).length > 1);
  function whyCands() {
    const marked = allWhy().filter((x) => S.why.includes(x.id));
    if (marked.length <= WHY_LIST) return marked;
    return D.why.map((g) => { const m = marked.filter((x) => x.gid === g.id); return m.length > 1 ? whyById(view.whyWin[g.id]) : m[0]; }).filter(Boolean);
  }
  function whyToTop() {
    const c = whyCands().map((x) => x.id);
    S.top = c.length <= TOP ? c : S.top.filter((id) => c.includes(id));
    Store.save('top', S.top);
    if (c.length <= TOP) whyFinish(); else view.whyStep = 'top';
  }
  function whyFinish() { Store.save('top', S.top); Sync.push('why', { top: S.top, why: S.why }, 'why'); haptic.ok(); view.whyStep = 'done'; }
  function whyAfterGroups() {
    if (!S.why.length) { toast('Отметь хотя бы одно'); view.whyG = 0; return; }
    view.whyWin = {};
    if (S.why.length > WHY_LIST) { view.whyR = 0; view.whyStep = 'round'; } else whyToTop();
  }
  function whyBack() {
    const st = view.whyStep;
    const lastG = () => { view.whyStep = 'g'; view.whyG = D.why.length - 1; };
    const lastR = () => { view.whyStep = 'round'; view.whyR = whyRounds().length - 1; };
    if (st === 'g') { if (view.whyG > 0) view.whyG -= 1; else view.whyStep = 'intro'; }
    else if (st === 'round') { if (view.whyR > 0) view.whyR -= 1; else lastG(); }
    else if (st === 'top') { if (S.why.length > WHY_LIST) lastR(); else lastG(); }
  }
  const whyItem = (x, attr, on, icon, meta = true) => `<button class="item${attr === 'data-why' ? '' : ' item--top'}${on ? ' is-on' : ''}" ${attr}="${attr === 'data-win' ? `${x.gid}:${x.id}` : x.id}" aria-pressed="${on}">
      <span class="item__body"><span class="item__t">${x.t}</span><span class="item__p">${proofHtml(x)}</span>
      ${meta ? `<span class="item__m"><span class="chip src-${x.src}">${D.srcLabel[x.src]}</span><span class="chip">${x.when}</span></span>` : ''}</span>
      <span class="heart">${icon}</span></button>`;
  const backLink = '<div style="text-align:center;margin-top:8px"><button class="ghost" data-whyback="1">Назад</button></div>';

  function screenWhy() {
    const W = D.whyIntro; const st = view.whyStep; const n = D.why.length;
    if (st === 'g') {
      const g = D.why[view.whyG];
      const items = allWhy().filter((x) => x.gid === g.id);
      return `
      ${qbar(view.whyG + 1, n)}
      <span class="eyebrow"><span class="dot"></span>Вопрос ${view.whyG + 1} из ${n}</span>
      <h1 class="title">${g.title}</h1>
      <p class="lead">${W.ask} Отметь всё, что откликается.</p>
      <div class="shell"><div class="core" style="padding:2px 16px">${items.map((x) => whyItem(x, 'data-why', S.why.includes(x.id), I.heart)).join('')}</div></div>
      <div class="section-gap"></div>
      ${btn(view.whyG < n - 1 ? 'Дальше' : 'Готово — выбрать главное', 'data-whynext="1"', 'btn--full btn--accent')}
      <p class="sub" style="text-align:center;margin-top:10px">Отмечено всего: <span class="num" id="why-n">${S.why.length}</span></p>
      ${backLink}`;
    }
    if (st === 'round') {
      const rs = whyRounds(); const g = rs[Math.min(view.whyR, rs.length - 1)];
      const items = allWhy().filter((x) => x.gid === g.id && S.why.includes(x.id));
      return `
      ${qbar(view.whyR + 1, rs.length)}
      <span class="eyebrow"><span class="dot"></span>Почти готово · ${view.whyR + 1} из ${rs.length}</span>
      <h1 class="title">${g.title}: что важнее?</h1>
      <p class="lead">Ты отметил ${S.why.length} ${plural(S.why.length, 'пункт', 'пункта', 'пунктов')} — это хорошо. Теперь в каждой сфере выбери одно, самое важное. Остальные отметки сохранятся.</p>
      <div class="shell"><div class="core" style="padding:2px 16px">${items.map((x) => whyItem(x, 'data-win', view.whyWin[g.id] === x.id, I.star, false)).join('')}</div></div>
      ${backLink}`;
    }
    if (st === 'top') {
      const cands = whyCands();
      return `
      <span class="eyebrow"><span class="dot"></span>Почти готово</span>
      <h1 class="title">Выбери 3 самых главных</h1>
      <p class="lead">О них я буду напоминать перед практикой.</p>
      <div class="counter" id="why-counter"><span class="counter__n">Главных: <span class="num" id="top-n">${S.top.length}</span> из ${TOP}</span><span class="counter__dots">${Array.from({ length: TOP }, (_, i) => `<i class="${i < S.top.length ? 'is-on' : ''}"></i>`).join('')}</span></div>
      <div class="shell"><div class="core" style="padding:2px 16px">${cands.map((x) => whyItem(x, 'data-top', S.top.includes(x.id), I.star, false)).join('')}</div></div>
      <div class="section-gap"></div>
      ${btn('Готово', `data-whydone="1" ${S.top.length === TOP ? '' : 'disabled'}`, 'btn--full btn--accent')}
      ${backLink}`;
    }
    if (st === 'done') {
      const top = S.top.map(whyById).filter(Boolean);
      return `
      <span class="eyebrow"><span class="dot"></span>Моё зачем</span>
      <h1 class="title">Ты садишься, чтобы…</h1>
      <div class="shell"><div class="core why-chosen"><ul>${top.map((x) => `<li>${I.star}<span>${x.t}<span class="item__p">${proofHtml(x)}</span></span></li>`).join('')}</ul></div></div>
      <p class="sub" style="margin:14px 4px 0">Перед каждой практикой я напомню одно из них. Всего отмечено: <span class="num">${S.why.length}</span>.</p>
      <div class="section-gap"></div>
      ${btn('На главную', 'data-tab="today"', 'btn--full btn--accent')}
      <div style="text-align:center;margin-top:8px"><button class="ghost" data-whyg="0">Пройти тест заново</button></div>`;
    }
    return `
      <span class="eyebrow"><span class="dot"></span>Моё зачем · ${W.time}</span>
      <h1 class="title">${W.title}</h1>
      <p class="lead">${W.text}</p>
      <ol class="steps">${W.steps.map((x, i) => `<li><b class="num">${i + 1}</b><span>${x}</span></li>`).join('')}</ol>
      <div class="legend-src"><span class="chip src-r">Исследование — проверили учёные</span><span class="chip src-p">Пишут люди — из тысяч отзывов</span><span class="chip src-a">Опыт Рустема</span></div>
      ${btn(S.why.length ? 'Продолжить тест' : 'Начать тест', 'data-whyg="0"', 'btn--full btn--accent')}`;
  }

  /* ---------- Роутинг ---------- */
  const fmt = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function go(target) {
    const [name, param] = String(target).split(':');
    if (['today', 'course', 'practice', 'answers', 'path'].includes(name)) { view.tab = name; view.sub = null; }
    else { view.sub = { name, param }; if (name === 'why') view.whyStep = S.top.length ? 'done' : 'intro'; }
    if (name === 'practice' && ['done'].includes(view.practice.step)) view.practice.step = 'setup';
    render(true);
  }

  function render(scrollTop) {
    let html;
    if (view.sub && view.sub.name === 'lesson') html = screenLesson(view.sub.param);
    else if (view.sub && view.sub.name === 'why') html = screenWhy();
    else html = { today: screenToday, course: screenCourse, practice: screenPractice, answers: screenAnswers, path: screenPath }[view.tab]();
    $app.innerHTML = `<section class="screen">${html}</section>`;
    if (scrollTop) window.scrollTo(0, 0);
    initWheels();
    const running = view.tab === 'practice' && !view.sub && ['run', 'bell'].includes(view.practice.step);
    const howto = view.tab === 'practice' && !view.sub && ['setup', 'before'].includes(view.practice.step) && !S.sessions.length && !view.howDone;
    $dock.classList.toggle('is-hidden', running || howto || !!view.sub);
    $dock.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === view.tab && !view.sub));
    setBack(!!view.sub);
  }

  /* ---------- Длительность практики: 5/10/15/20 мин или своё время барабанами (мин + сек) ---------- */
  const PRESETS = [5, 10, 15, 20];
  const WHEEL_ROW = 40;
  const fmtDur = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const durBig = (sec) => (sec % 60 ? `${fmtDur(sec)}<small>в тишине</small>` : `${sec / 60}<small>${plural(sec / 60, 'минута', 'минуты', 'минут')} в тишине</small>`);
  function setDur(sec) { view.practice.sec = sec; S.dur = sec; Store.save('dur', sec); }
  let wheelLock = 0; // пока барабаны докручиваются к выбранному пресету — время не пересчитываем
  const wheelVal = (w) => Math.max(0, Math.min(w.children.length - 1, Math.round(w.scrollTop / WHEEL_ROW)));
  function syncPresets(instant) {
    const dur = document.querySelector('.dur'); if (!dur) return;
    let on = null;
    dur.querySelectorAll('[data-min]').forEach((b) => { const hit = Number(b.dataset.min) * 60 === view.practice.sec; b.setAttribute('aria-pressed', hit); if (hit) on = b; });
    const pill = dur.querySelector('.dur__pill');
    if (instant) pill.style.transition = 'none';
    if (on) { pill.style.width = `${on.offsetWidth}px`; pill.style.transform = `translateX(${on.offsetLeft}px)`; pill.style.opacity = 1; } else pill.style.opacity = 0;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  }
  function wheelsTo(sec) {
    const m = document.querySelector('[data-wheel="m"]'); const s = document.querySelector('[data-wheel="s"]');
    if (!m || !s) return;
    wheelLock = Date.now() + 900;
    m.scrollTo({ top: Math.floor(sec / 60) * WHEEL_ROW, behavior: 'smooth' });
    s.scrollTo({ top: (sec % 60) * WHEEL_ROW, behavior: 'smooth' });
  }
  function initWheels() {
    const ws = document.querySelectorAll('[data-wheel]');
    if (!ws.length) return;
    const [mw, sw] = [document.querySelector('[data-wheel="m"]'), document.querySelector('[data-wheel="s"]')];
    let t = null;
    ws.forEach((w) => {
      let last = -1;
      const mark = (i) => w.querySelectorAll('.wheel__i').forEach((el, j) => el.classList.toggle('is-on', j === i));
      w.scrollTop = (w === mw ? Math.floor(view.practice.sec / 60) : view.practice.sec % 60) * WHEEL_ROW;
      last = wheelVal(w); mark(last);
      w.addEventListener('scroll', () => {
        const i = wheelVal(w);
        if (i !== last) { last = i; mark(i); haptic.tap(); }
        if (Date.now() < wheelLock) return;
        // время применяется сразу — можно нажать «Начать», не дожидаясь остановки барабана
        view.practice.sec = Math.max(30, wheelVal(mw) * 60 + wheelVal(sw));
        syncPresets();
        clearTimeout(t);
        t = setTimeout(() => {
          if (wheelVal(mw) * 60 + wheelVal(sw) < 30) sw.scrollTo({ top: 30 * WHEEL_ROW, behavior: 'smooth' });
          setDur(view.practice.sec);
        }, 160);
      }, { passive: true });
      // стрелки на клавиатуре — для доступности
      w.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); w.scrollBy({ top: e.key === 'ArrowDown' ? WHEEL_ROW : -WHEEL_ROW, behavior: 'smooth' }); } });
    });
    syncPresets(true);
  }

  /* ---------- Экран во время практики: не гаснет (NoSleep.js) и притухает через 8 с; касание — ярче ---------- */
  const LOCK_ICON = '<svg viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M4 4l16 16"/></svg>';
  const lockNote = (text) => `<div class="lock-note" role="note"><span class="lock-note__i">${LOCK_ICON}</span><span><b>Не блокируй экран</b><span>${text}</span></span></div>`;
  const noSleep = window.NoSleep ? new window.NoSleep() : null;
  function awake(on) { try { if (!noSleep) return; if (on && !noSleep.isEnabled) noSleep.enable(); else if (!on && noSleep.isEnabled) noSleep.disable(); } catch (e) { /* не поддерживается */ } }
  let dimTimer = null;
  function dim(on) {
    clearTimeout(dimTimer);
    document.documentElement.classList.toggle('is-dim', on);
    if (inTelegram) { try { const c = on ? '#000000' : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); tg.setHeaderColor(c); tg.setBackgroundColor(c); if (tg.setBottomBarColor) tg.setBottomBarColor(c); } catch (e) { /* старый клиент */ } }
  }
  function dimSoon() { clearTimeout(dimTimer); dimTimer = setTimeout(() => { if (view.practice.step === 'run') dim(true); }, 8000); }
  // касание во время практики — экран ярче на 8 секунд
  document.addEventListener('pointerdown', () => { if (view.practice.step === 'run' && view.tab === 'practice') { dim(false); dimSoon(); } }, true);

  /* ---------- Практика: таймер ---------- */
  let ticker = null;
  function startRun() {
    const p = view.practice;
    unlockAudio(); bell('start');
    p.startAt = Date.now(); p.endAt = p.startAt + p.sec * 1000; p.step = 'run';
    p.wasLocked = false; awake(true); dimSoon();
    if (inTelegram) { try { tg.enableClosingConfirmation(); } catch (e) { /* старый клиент */ } }
    render(true);
    clearInterval(ticker);
    ticker = setInterval(() => {
      const left = p.endAt - Date.now();
      const $c = document.getElementById('clock');
      if (p.step === 'run' && left <= 0) { p.step = 'bell'; bell('end'); haptic.ok(); dim(false); render(); return; }
      if ($c) $c.textContent = p.step === 'bell' ? `+${fmt(-left)}` : fmt(Math.max(0, left));
    }, 250);
  }
  function stopRun() {
    clearInterval(ticker); awake(false); dim(false);
    if (inTelegram) { try { tg.disableClosingConfirmation(); } catch (e) { /* старый клиент */ } }
  }
  function finishPractice() {
    const p = view.practice;
    const minutes = Math.max(1, Math.round((Date.now() - p.startAt) / 60000));
    const t = Date.now();
    S.sessions.push({ t, m: minutes, b: p.before, a: p.after });
    Store.save('sessions', S.sessions);
    Sync.push('practice', { t, m: minutes, b: p.before, a: p.after }, `p-${t}`);
    p.step = 'done'; haptic.ok();
  }

  /* ---------- События ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-url]');
    if (!el) return;
    const d = el.dataset;
    if (d.tab) { haptic.tap(); if (d.tab === 'practice' && view.tab !== 'practice') view.practice.step = view.practice.step === 'done' ? 'setup' : view.practice.step; return go(d.tab); }
    if (d.go) { haptic.tap(); return go(d.go); }
    if (d.start) { haptic.soft(); view.practice.step = 'before'; return go('practice'); }
    if (d.howto) { haptic.tap(); view.howto = !view.howto; return render(); }
    if (d.hownext) { haptic.tap(); if (view.howI < D.howto.length - 1) view.howI += 1; else { view.howDone = true; haptic.ok(); } return render(true); }
    if (d.howback) { haptic.tap(); view.howI = Math.max(0, view.howI - 1); return render(true); }
    if (d.howskip) { haptic.tap(); view.howDone = true; return render(true); }
    if (d.url) { haptic.tap(); return open(d.url); }
    if (d.min) { haptic.soft(); setDur(Number(d.min) * 60); if (document.querySelector('[data-wheel]')) { syncPresets(); wheelsTo(view.practice.sec); return; } return render(); }
    if (d.belltry) { haptic.soft(); unlockAudio(); bell('end'); return; }
    if (d.step) {
      haptic.soft();
      if (d.step === 'after' && ['run', 'bell'].includes(view.practice.step)) stopRun();
      view.practice.step = d.step; return render(true);
    }
    if (d.before) { haptic.tap(); view.practice.before = Number(d.before); awake(true); return setTimeout(startRun, 180); }
    if (d.after) { haptic.tap(); view.practice.after = Number(d.after); render(); return setTimeout(() => { finishPractice(); render(true); }, 220); }
    if (d.watch) { markWatched(Number(d.watch)); return render(); }
    if (d.sendvideo) {
      haptic.soft();
      if (!inTelegram) return toast('Видео приходит в чат с ботом');
      Sync.push('send_video', { n: Number(d.sendvideo) });
      toast('Отправил видео в чат');
      return setTimeout(() => { try { tg.close(); } catch (err) { /* старый клиент */ } }, 900);
    }
    if (d.dqpick) {
      const last = S.sessions[S.sessions.length - 1];
      if (last) {
        if (d.dqmulti) { const a = last[d.dqkey] || []; const i = a.indexOf(d.dqpick); i >= 0 ? a.splice(i, 1) : a.push(d.dqpick); last[d.dqkey] = a; }
        else last[d.dqkey] = last[d.dqkey] === d.dqpick ? null : d.dqpick;
        Store.save('sessions', S.sessions);
        // ответы, на которые бот даёт подсказку (день 4 — сон/напряжение, день 6 — «утащило»)
        const hint = { 'в сон': 'sleep', 'в напряжение': 'tension', 'да, но утащило': 'swept' }[d.dqpick];
        if (hint && last[d.dqkey] === d.dqpick) Sync.push('answer', { q: d.dqkey, v: hint }, `a-${last.t}-${d.dqkey}`);
      }
      const v = (last || {})[d.dqkey];
      haptic.tap(); el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', Array.isArray(v) ? v.includes(b.dataset.dqpick) : b.dataset.dqpick === v));
      return;
    }
    if (d.topic) { haptic.tap(); view.faqTopic = d.topic; view.faqOpen = null; return render(); }
    if (d.faqgo) {
      haptic.tap();
      if (d.faqgo === 'howto') { view.howto = true; go('today'); const h = document.querySelector('.howto'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      return go(d.faqgo);
    }
    if (d.ask) {
      const q = view.faqQuery.trim();
      if (!q) return;
      if (!inTelegram) { toast('Спросить можно в чате с ботом', 2600); return; }
      Sync.push('ask', { q: q.slice(0, 500) }, `ask-${Date.now()}`);
      view.faqAsked = q; haptic.ok(); toast('Отправлено Рустему', 2200);
      return render();
    }
    if (d.see) {
      const j = Number(d.see); haptic.tap();
      view.faqQuery = ''; view.faqTopic = D.faq[j].t; view.faqOpen = j; render();
      const el = document.getElementById(`qa-${j}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (d.qa) {
      const i = Number(d.qa); view.faqOpen = view.faqOpen === i ? null : i; haptic.tap();
      document.querySelectorAll('.qa').forEach((q) => { const k = Number(q.querySelector('[data-qa]').dataset.qa); const box = q.querySelector('.qa__a > div'); if (k === view.faqOpen && !box.innerHTML.trim()) box.innerHTML = qaBody(D.faq[k]); });
      document.querySelectorAll('.qa').forEach((q) => { const b = q.querySelector('[data-qa]'); const on = Number(b.dataset.qa) === view.faqOpen; q.classList.toggle('is-open', on); b.setAttribute('aria-expanded', on); });
      return;
    }
    if (d.why) {
      const id = d.why; const i = S.why.indexOf(id);
      if (i >= 0) { S.why.splice(i, 1); const k = S.top.indexOf(id); if (k >= 0) { S.top.splice(k, 1); Store.save('top', S.top); } }
      else S.why.push(id);
      haptic.soft(); Store.save('why', S.why);
      return updateWhy();
    }
    if (d.top) {
      const id = d.top; const i = S.top.indexOf(id);
      if (i >= 0) S.top.splice(i, 1);
      else if (S.top.length >= 3) { haptic.warn(); const c = document.getElementById('why-counter'); c.classList.remove('is-shake'); void c.offsetWidth; c.classList.add('is-shake'); toast('Главных — до трёх'); return; }
      else S.top.push(id);
      haptic.soft(); Store.save('top', S.top);
      return updateWhy();
    }
    if (d.whyg) { haptic.tap(); view.whyG = Number(d.whyg); view.whyStep = 'g'; return render(true); }
    if (d.whynext) { haptic.tap(); if (view.whyG < D.why.length - 1) view.whyG += 1; else whyAfterGroups(); return render(true); }
    if (d.whyback) { haptic.tap(); whyBack(); return render(true); }
    if (d.win) {
      const [gid, id] = d.win.split(':'); view.whyWin[gid] = id; haptic.soft();
      document.querySelectorAll('[data-win]').forEach((b) => { const on = b.dataset.win === d.win; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
      return setTimeout(() => { if (view.whyR < whyRounds().length - 1) view.whyR += 1; else whyToTop(); render(true); }, 260);
    }
    if (d.whystep) { haptic.tap(); view.whyStep = d.whystep; return render(true); }
    if (d.whydone) { whyFinish(); return render(true); }
  });

  function updateWhy() {
    document.querySelectorAll('[data-why]').forEach((b) => { const on = S.why.includes(b.dataset.why); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    document.querySelectorAll('[data-top]').forEach((b) => { const on = S.top.includes(b.dataset.top); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    const n = document.getElementById('why-n'); if (n) n.textContent = S.why.length;
    const t = document.getElementById('top-n'); if (t) t.textContent = S.top.length;
    document.querySelectorAll('.counter__dots i').forEach((dot, i) => dot.classList.toggle('is-on', i < S.top.length));
    document.querySelectorAll('[data-whydone]').forEach((b) => { b.disabled = S.top.length !== TOP; });
  }

  let noteTimer = null;
  let faqMissTimer = null;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'faq-search') {
      // запрос без ответа (после паузы в наборе) — тихо боту: так видно, чего не хватает в базе
      clearTimeout(faqMissTimer);
      faqMissTimer = setTimeout(() => { const q = view.faqQuery.trim(); const h = faqHits(q); if (q.length >= 4 && h && !h.length) Sync.push('miss', { q: q.slice(0, 120) }, `miss-${q.toLowerCase()}`); }, 1800);
      view.faqQuery = e.target.value; const pos = e.target.selectionStart;
      render(); const s = document.getElementById('faq-search'); s.focus(); s.setSelectionRange(pos, pos);
      document.querySelectorAll('.screen > *').forEach((x) => { x.style.animation = 'none'; x.style.opacity = 1; x.style.transform = 'none'; });
    }
    if (e.target.id === 'why-note') { S.note = e.target.value; clearTimeout(noteTimer); noteTimer = setTimeout(() => { Store.save('note', S.note); toast('Сохранено'); }, 700); }
    if (e.target.dataset.dqnum) { e.target.value = e.target.value.replace(/\D/g, ''); const last = S.sessions[S.sessions.length - 1]; if (last) { last[e.target.dataset.dqnum] = Number(e.target.value) || null; Store.save('sessions', S.sessions); } }
    if (e.target.dataset.base) { const k = e.target.dataset.base; e.target.value = e.target.value.replace(/\D/g, ''); S[k] = e.target.value; Store.save(k, S[k]); }
  });
  // счёт выдохов уходит боту, когда человек закончил ввод (а не на каждую цифру)
  document.addEventListener('change', (e) => {
    const k = e.target.dataset.base;
    if (k && S[k] !== '') Sync.push(k, { v: Number(S[k]) }, `${k}-${S[k]}`);
    if (e.target.dataset.remind != null && /^\d{1,2}:\d{2}/.test(e.target.value)) {
      const [h, mi] = e.target.value.split(':').map(Number);
      S.remind = h * 60 + mi; S.remindAt = Date.now(); Store.save('remind', S.remind); Store.save('remindAt', S.remindAt);
      Sync.push('time', { h: S.remind / 60 }, `time-${S.remind}`);
      haptic.ok(); toast(`Буду напоминать в ${h}:${String(mi).padStart(2, '0')}`);
    }
  });

  document.addEventListener('visibilitychange', () => {
    const p = view.practice;
    if (document.hidden && p.step === 'run') { p.wasLocked = true; return; }
    if (document.hidden) return;
    if (p.step === 'run' && p.wasLocked) {
      // экран блокировали: запомним, чтобы в следующий раз подсказать заметнее
      S.locked = (Number(S.locked) || 0) + 1; Store.save('locked', S.locked);
      awake(true);
      if (Date.now() >= p.endAt) { p.step = 'bell'; dim(false); unlockAudio(); bell('end'); render(); }
      else { p.wasLocked = false; toast('Не блокируй экран и не сворачивай приложение — иначе звоночек не прозвенит', 4200); dim(false); dimSoon(); }
    } else if (p.step === 'run' && Date.now() >= p.endAt) { p.step = 'bell'; render(); }
  });

  /* ---------- Старт ---------- */
  async function boot() {
    if (inTelegram) {
      tg.ready(); tg.expand(); tg.onEvent('themeChanged', applyTheme);
      // свайп вниз не сворачивает приложение; на телефоне — полный экран
      try { if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes(); } catch (e) { /* старый клиент */ }
      try { if (['android', 'ios'].includes(tg.platform) && tg.isVersionAtLeast('8.0')) tg.requestFullscreen(); } catch (e) { /* старый клиент */ }
    }
    else window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    applyTheme();
    const saved = await Store.load();
    Object.keys(S).forEach((k) => { if (saved[k] != null) S[k] = saved[k]; });
    // «Начать заново» в боте: ссылка несёт метку reset — обнуляем данные один раз на метку
    const reset = new URLSearchParams(location.search).get('reset');
    if (reset && reset !== String(S.reset)) {
      Object.assign(S, { start: Date.now(), why: [], top: [], note: '', sessions: [], watched: [], base1: '', base7: '', reset });
      KEYS.forEach((k) => Store.save(k, S[k]));
    }
    if (!S.start) { S.start = Date.now(); Store.save('start', S.start); }
    // результат проверки из бота (ссылки бота несут b1/b7) — в «Точку отсчёта», без ручного ввода
    ['b1', 'b7'].forEach((p) => {
      const v = new URLSearchParams(location.search).get(p); const k = p === 'b1' ? 'base1' : 'base7';
      if (v != null && v !== '' && Number.isFinite(Number(v)) && (String(S[k]) !== v || !(S.bsrc || {})[k])) { S[k] = v; S.bsrc = { ...(S.bsrc || {}), [k]: 1 }; Store.save(k, v); Store.save('bsrc', S.bsrc); }
    });
    const rm = Number(new URLSearchParams(location.search).get('rm'));
    if (new URLSearchParams(location.search).has('rm') && rm >= 0 && rm < 1440 && Number(new URLSearchParams(location.search).get('rmt')) >= (S.remindAt || 0)) { S.remind = rm; Store.save('remind', rm); }
    // список «зачем» обновлялся: отметки пунктов, которых больше нет, убираем
    const known = new Set(allWhy().map((x) => x.id));
    ['why', 'top'].forEach((k) => { const v = (S[k] || []).filter((id) => known.has(id)); if (v.length !== (S[k] || []).length) { S[k] = v; Store.save(k, v); } });
    lastPetals = S.sessions.length;
    Store.flush();
    window.addEventListener('online', () => { Store.flush(); Sync.flush(); });
    Sync.push('open', {}, `open-${dayKey(Date.now())}`);
    const qs = new URLSearchParams(location.search);
    if (Number(S.dur) >= 10) view.practice.sec = Number(S.dur);
    if ([5, 10, 15, 20].includes(Number(qs.get('min')))) view.practice.sec = Number(qs.get('min')) * 60;
    const startTab = qs.get('tab') || (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || 'today';
    if (startTab === 'why') { view.sub = { name: 'why' }; } else if (['today', 'course', 'practice', 'answers', 'path'].includes(startTab)) view.tab = startTab;
    render(true);
  }
  boot();
})();
