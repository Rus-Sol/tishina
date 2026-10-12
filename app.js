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

  /* ---------- Хранилище: Telegram CloudStorage, вне Telegram — localStorage ---------- */
  const useCloud = inTelegram && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9');
  const KEYS = ['start', 'why', 'top', 'note', 'sessions', 'watched', 'base1', 'base7'];
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
          // что не успело уйти в облако (например, практика в авиарежиме) — берём с телефона
          resolve(Object.fromEntries(KEYS.map((k) => [k, pend.includes(k) || values[k] == null || values[k] === '' ? local[k] : safeParse(values[k])])));
        });
      });
    },
    local() {
      const out = {};
      KEYS.forEach((k) => { try { out[k] = safeParse(localStorage.getItem('t_' + k)); } catch (e) { out[k] = null; } });
      return out;
    },
    save(key, value) {
      const raw = JSON.stringify(value);
      try { localStorage.setItem('t_' + key, raw); } catch (e) { /* приватный режим — живём в памяти */ }
      if (!useCloud) return;
      Store.setPending([...Store.pending(), key]);
      tg.CloudStorage.setItem(key, raw.slice(0, 4096), (err, ok) => {
        if (!err && ok) Store.setPending(Store.pending().filter((k) => k !== key));
      });
    },
    flush() {
      if (!useCloud || !navigator.onLine) return;
      Store.pending().forEach((k) => {
        let raw = null; try { raw = localStorage.getItem('t_' + k); } catch (e) { /* нет */ }
        if (raw == null) return;
        tg.CloudStorage.setItem(k, raw.slice(0, 4096), (err, ok) => { if (!err && ok) Store.setPending(Store.pending().filter((x) => x !== k)); });
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
  const S = { start: null, why: [], top: [], note: '', sessions: [], watched: [], base1: '', base7: '' };
  const view = { tab: 'today', sub: null, practice: { step: 'setup', min: 10, before: null, after: null, startAt: 0, endAt: 0 }, faqTopic: 'Все', faqQuery: '', faqOpen: null, whyStep: 'intro', whyG: 0, whyR: 0, whyWin: {}, howto: false, howI: 0, howDone: false };
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

  function toast(text) {
    $toast.textContent = text;
    $toast.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('is-on'), 1600);
  }
  function open(url) { if (inTelegram && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url); else window.open(url, '_blank'); }

  /* ---------- Звоночек: мягкий синтез, без файлов ---------- */
  let audio = null;
  function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
  function bell() {
    if (!audio) return;
    const now = audio.currentTime;
    const out = audio.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.42, now + 0.015);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 7);
    out.connect(audio.destination);
    [[392, 1], [392 * 2.76, 0.32], [392 * 5.4, 0.1], [392 * 8.93, 0.035]].forEach(([f, a], i) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.value = a;
      o.detune.value = i ? 3 : 0;
      o.connect(g).connect(out); o.start(now); o.stop(now + 7.2);
    });
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
  const allWhy = () => D.why.flatMap((g) => g.items.map(([id, t, src, proof, when]) => ({ id, t, src, proof, when, group: g.title, gid: g.id })));
  const qbar = (k, n) => `<div class="qbar" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < k ? 'is-on' : ''}"></i>`).join('')}</div>`;
  const whyById = (id) => allWhy().find((x) => x.id === id);
  const mainIds = () => (S.top.length ? S.top : S.why);
  const plural = (n, one, few, many) => { const m10 = n % 10; const m100 = n % 100; if (m10 === 1 && m100 !== 11) return one; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few; return many; };

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
        <div class="hstep__img">${s.img ? `<img src="${s.img}" alt="${esc(s.alt)}" loading="lazy">` : `${daisyOutline('hstep__daisy')}<span class="hstep__alt">${esc(s.alt)}</span>`}<b class="hstep__n num">${i + 1}</b></div>
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
        <div class="practice-card__min num">${view.practice.min}<small>минут в тишине</small></div>
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

      <div class="section-gap"></div>
      <div class="shell"><div class="core list" style="padding:6px 16px">
        <button class="row" data-url="${D.course.chatUrl}">
          <span class="row__day row__day--icon">${I.chat}</span>
          <span class="row__body"><span class="row__t">Рустем и чат</span><span class="row__s">Спросить, поделиться, держать серию вместе</span></span>
          <span class="row__state">${I.arrow}</span>
        </button>
      </div></div>`;
  }

  function screenCourse() {
    const day = courseDay();
    return `
      <span class="eyebrow"><span class="dot"></span>Курс</span>
      <h1 class="title">7 дней тишины</h1>
      <p class="lead">8 коротких видео и по 10 минут практики в день. Новое видео приходит каждый день, а если хочется быстрее — следующее открывается сразу после предыдущего.</p>
      <div class="shell"><div class="core list" style="padding:6px 16px">${videoRows(day)}</div></div>
      <p class="sub" style="margin:18px 4px 0">Дни 8–14 — без новых видео: держим серию вместе в чате.</p>`;
  }

  function screenLesson(id) {
    const v = D.videos.find((x) => x.id === Number(id));
    const done = S.watched.includes(v.id);
    return `
      <span class="eyebrow"><span class="dot"></span>Видео ${v.id} · день ${v.day}</span>
      <h1 class="title">${v.title}</h1>
      <p class="lead num">${v.min} минут</p>
      <div class="shell"><div class="core" style="padding:8px">
        <button class="video__frame" style="margin:0;width:100%;border:0" data-sendvideo="${v.id}" aria-label="Прислать видео в чат">${daisyOutline('video__daisy')}<span class="chip video__soon">Прислать видео в чат</span><span class="video__play">${I.play}</span></button>
      </div></div>
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
      <div class="howstep__img${s.img ? ' has-img' : ''}">${s.img ? `<img src="${s.img}" alt="${esc(s.alt)}">` : daisyOutline('hstep__daisy')}<b class="hstep__n num">${i + 1}</b></div>
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
        <div class="dur" role="group" aria-label="Длительность">${[5, 10, 15, 20].map((m) => `<button class="num" data-min="${m}" aria-pressed="${p.min === m}">${m} мин</button>`).join('')}</div>
        ${why ? `<p class="sub" style="max-width:320px;margin:0 auto">Ты садишься, чтобы: <b style="color:var(--ink)">${why.t.toLowerCase()}</b></p>` : ''}
        <div>${btn('Начать', 'data-step="before"', 'btn--accent')}</div>
        <p class="sub" style="max-width:320px;margin:0 auto">Можно включить авиарежим — таймер и звоночек работают без сети.</p>
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
        <div class="clock-sub" id="clock-sub">${p.step === 'bell' ? 'Звоночек. Хочешь — посиди ещё.' : 'Ушёл в мысли — заметил и вернулся'}</div></div>
        <div>${p.step === 'bell' ? btn('Завершить', 'data-step="after"', 'btn--accent') : '<button class="ghost" data-step="after">Закончить раньше</button>'}</div>
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

  function screenAnswers() {
    const topics = ['Все', ...new Set(D.faq.map((f) => f.t))];
    const q = view.faqQuery.trim().toLowerCase();
    const list = D.faq.map((f, i) => ({ ...f, i })).filter((f) => (view.faqTopic === 'Все' || f.t === view.faqTopic) && (!q || (f.q + ' ' + f.a).toLowerCase().includes(q)));
    return `
      <span class="eyebrow"><span class="dot"></span>Ответы</span>
      <h1 class="title">Что спрашивают новички</h1>
      <p class="lead">Коротко и по делу. Не нашёл ответ — напиши Рустему.</p>
      <label class="search">${I.search}<input id="faq-search" type="search" placeholder="Например: засыпаю, спина, слёзы" value="${esc(view.faqQuery)}" aria-label="Поиск по ответам"></label>
      <div class="chips" role="group" aria-label="Темы">${topics.map((t) => `<button data-topic="${t}" aria-pressed="${view.faqTopic === t}">${t}</button>`).join('')}</div>
      <div class="section-gap"></div>
      <div class="shell"><div class="core" style="padding:4px 18px" id="faq-list">
        ${list.length ? list.map((f) => `<div class="qa${view.faqOpen === f.i ? ' is-open' : ''}"><button class="qa__q" data-qa="${f.i}" aria-expanded="${view.faqOpen === f.i}"><span>${f.q}</span>${I.plus}</button><div class="qa__a"><div><p>${f.a}</p></div></div></div>`).join('') : '<div class="empty">Ничего не нашлось. Спроси в чате — ответим.</div>'}
      </div></div>
      <div class="contacts" style="margin-top:18px"><button class="chip press" data-url="${D.course.authorUrl}" style="padding:12px 16px;font-size:14px">Задать свой вопрос</button></div>`;
  }

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
        <p class="sub" style="margin:0">Сколько раз ты сбился со счёта выдохов за минуту проверки. В первый день и на седьмой — сравни: чем меньше, тем лучше.</p>
        <div class="baseline">
          <label>День 1<input class="num" inputmode="numeric" maxlength="3" data-base="base1" value="${esc(S.base1 || '')}" placeholder="—"></label>
          <label>День 7<input class="num" inputmode="numeric" maxlength="3" data-base="base7" value="${esc(S.base7 || '')}" placeholder="—"></label>
        </div>
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
    view.whyStep = c.length <= TOP ? 'note' : 'top';
  }
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
    else if (st === 'note') { if (whyCands().length > TOP) view.whyStep = 'top'; else if (S.why.length > WHY_LIST) lastR(); else lastG(); }
  }
  const whyItem = (x, attr, on, icon, meta = true) => `<button class="item${attr === 'data-why' ? '' : ' item--top'}${on ? ' is-on' : ''}" ${attr}="${attr === 'data-win' ? `${x.gid}:${x.id}` : x.id}" aria-pressed="${on}">
      <span class="item__body"><span class="item__t">${x.t}</span><span class="item__p">${x.proof}</span>
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
      ${btn('Дальше', `data-whystep="note" ${S.top.length === TOP ? '' : 'disabled'}`, 'btn--full btn--accent')}
      ${backLink}`;
    }
    if (st === 'note') return `
      <span class="eyebrow"><span class="dot"></span>Последний шаг</span>
      <h1 class="title">Почему это важно именно тебе?</h1>
      <p class="lead">Одна строка про самое главное. Её видишь только ты и Рустем.</p>
      <textarea class="note" id="why-note" maxlength="300" placeholder="Например: хочу перестать срываться на сына — он этого не заслужил.">${esc(S.note || '')}</textarea>
      <div class="section-gap"></div>
      ${btn('Готово', 'data-whydone="1"', 'btn--full btn--accent')}
      ${backLink}`;
    if (st === 'done') {
      const top = S.top.map(whyById).filter(Boolean);
      return `
      <span class="eyebrow"><span class="dot"></span>Моё зачем</span>
      <h1 class="title">Ты садишься, чтобы…</h1>
      <div class="shell"><div class="core why-chosen"><ul>${top.map((x) => `<li>${I.star}<span>${x.t}<span class="item__p">${x.proof}</span></span></li>`).join('')}</ul>${S.note ? `<p class="sub" style="margin:4px 0 0">«${esc(S.note)}»</p>` : ''}</div></div>
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
    const running = view.tab === 'practice' && !view.sub && ['run', 'bell'].includes(view.practice.step);
    const howto = view.tab === 'practice' && !view.sub && ['setup', 'before'].includes(view.practice.step) && !S.sessions.length && !view.howDone;
    $dock.classList.toggle('is-hidden', running || howto || !!view.sub);
    $dock.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === view.tab && !view.sub));
    setBack(!!view.sub);
  }

  /* ---------- Практика: таймер ---------- */
  let ticker = null;
  function startRun() {
    const p = view.practice;
    unlockAudio(); bell();
    p.startAt = Date.now(); p.endAt = p.startAt + p.min * 60000; p.step = 'run';
    if (inTelegram) { try { tg.enableClosingConfirmation(); } catch (e) { /* старый клиент */ } }
    render(true);
    clearInterval(ticker);
    ticker = setInterval(() => {
      const left = p.endAt - Date.now();
      const $c = document.getElementById('clock');
      if (p.step === 'run' && left <= 0) { p.step = 'bell'; bell(); haptic.ok(); render(); return; }
      if ($c) $c.textContent = p.step === 'bell' ? `+${fmt(-left)}` : fmt(Math.max(0, left));
    }, 250);
  }
  function stopRun() {
    clearInterval(ticker);
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
    if (d.min) { haptic.tap(); view.practice.min = Number(d.min); return render(); }
    if (d.step) {
      haptic.soft();
      if (d.step === 'after' && ['run', 'bell'].includes(view.practice.step)) stopRun();
      view.practice.step = d.step; return render(true);
    }
    if (d.before) { haptic.tap(); view.practice.before = Number(d.before); return setTimeout(startRun, 180); }
    if (d.after) { haptic.tap(); view.practice.after = Number(d.after); render(); return setTimeout(() => { finishPractice(); render(true); }, 220); }
    if (d.watch) {
      const id = Number(d.watch);
      if (!S.watched.includes(id)) { S.watched.push(id); Store.save('watched', S.watched); Sync.push('watched', { n: id }, `w-${id}`); haptic.ok(); toast(id < 7 ? 'Следующее видео открыто' : 'Отмечено'); }
      return render();
    }
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
    if (d.qa) {
      const i = Number(d.qa); view.faqOpen = view.faqOpen === i ? null : i; haptic.tap();
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
    if (d.whydone) { Store.save('note', S.note); Store.save('top', S.top); Sync.push('why', { top: S.top, why: S.why, note: S.note }, 'why'); haptic.ok(); toast('Сохранено'); view.whyStep = 'done'; return render(true); }
  });

  function updateWhy() {
    document.querySelectorAll('[data-why]').forEach((b) => { const on = S.why.includes(b.dataset.why); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    document.querySelectorAll('[data-top]').forEach((b) => { const on = S.top.includes(b.dataset.top); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    const n = document.getElementById('why-n'); if (n) n.textContent = S.why.length;
    const t = document.getElementById('top-n'); if (t) t.textContent = S.top.length;
    document.querySelectorAll('.counter__dots i').forEach((dot, i) => dot.classList.toggle('is-on', i < S.top.length));
    document.querySelectorAll('[data-whystep="note"]').forEach((b) => { b.disabled = S.top.length !== TOP; });
  }

  let noteTimer = null;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'faq-search') {
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
  });

  document.addEventListener('visibilitychange', () => {
    const p = view.practice;
    if (!document.hidden && p.step === 'run' && Date.now() >= p.endAt) { p.step = 'bell'; render(); }
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
    if (!S.start) { S.start = Date.now(); Store.save('start', S.start); }
    lastPetals = S.sessions.length;
    Store.flush();
    window.addEventListener('online', () => { Store.flush(); Sync.flush(); });
    Sync.push('open', {}, `open-${dayKey(Date.now())}`);
    const qs = new URLSearchParams(location.search);
    if ([5, 10, 15, 20].includes(Number(qs.get('min')))) view.practice.min = Number(qs.get('min'));
    const startTab = qs.get('tab') || (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || 'today';
    if (startTab === 'why') { view.sub = { name: 'why' }; } else if (['today', 'course', 'practice', 'answers', 'path'].includes(startTab)) view.tab = startTab;
    render(true);
  }
  boot();
})();
