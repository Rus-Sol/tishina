/* Поиск по «Ответам»: слова → основы (обрезаем окончания), синонимы людей, опечатки — через Fuse.js по словарю основ.
   Работает и в браузере (window.TSearch), и в Node (тест app/test_search.js). */
(function (root) {
  // Группы слов, которыми люди называют одно и то же (из 867 вопросов и комментариев, research/08, разведка 13.10)
  const SYN = [
    'засыпаю сплю сон уснул уснула вырубает клонит сонливость отключаюсь проваливаюсь дремлю',
    'мысли думаю голова ум кипит скачут поток диалог шум отвлекаюсь отвлекаться',
    'ноги затекают немеют онемели мурашки колени',
    'спина поясница сутулюсь горблюсь осанка',
    'болит больно ноет боль',
    'слезы плачу плакать рыдаю',
    'страх страшно боюсь ужас пугает',
    'паника паническая атака приступ',
    'тревога тревожно тревожность беспокойство волнуюсь нервничаю нервы',
    'злость злюсь гнев бешусь раздражение раздражаюсь агрессия',
    'обида обижаюсь обиды',
    'срываюсь сорвался взрываюсь кричу ору',
    'близкие муж жена дети ребенок родители семья',
    'лень неохота лениво откладываю сопротивление мотивация',
    'пропустил пропуск забыл пропускать',
    'получилось получается правильно верно работает признаки',
    'результат эффект изменения толк польза',
    'дыхание дышать дышу вдох выдох воздух',
    'задыхаюсь одышка удушье воздуха',
    'чешется зуд почесать',
    'шевелиться подвинуться ерзаю дергаюсь двигаться',
    'музыка песни мантры звуки наушники',
    'шум шумно соседи дрель ремонт сверлят стучат',
    'телефон смартфон уведомления авиарежим',
    'лежа лежать кровать постель',
    'утро утром проснулся',
    'вечер вечером ночь перед сном',
    'минут время длительность долго',
    'раз часто частота',
    'видео урок ролик',
    'таймер звоночек звонок колокольчик',
    'зачем цель мотивация',
    'ромашка лепестки путь прогресс серия',
    'секта религия вера бог эзотерика',
    'бессонница уснуть',
    'курить сигареты курение зависимость тяга алкоголь',
    'психолог психотерапевт врач лекарства таблетки антидепрессанты',
    'глаза веки взгляд',
    'руки ладони пальцы',
    'зеваю зевота зевать',
    'болею заболел заболела болезнь простыл простуда температура',
    'умру умереть смерть',
    'тепло покалывание вибрация гул звон пульсация ощущения',
  ];
  const STOP = new Set('как что это я мне меня мой моя мои у в во на и а но ли же не ни бы то ты тебе вы мы он она они так там тут при по за из от до для с со к ко о об про или если можно нужно надо всё все еще уже очень просто когда где почему зачем какой какая какие каких делать сделать быть есть был была свой своя этот эта эти чтобы чем тоже только вот ну да нет так ли много сильно стал стало стала стали никакого никакой никак'.split(' ').filter((w) => w !== 'зачем'));
  const ENDINGS = ['иями', 'ями', 'ами', 'ость', 'остью', 'ениями', 'ения', 'ение', 'ании', 'ание', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'иях', 'ешь', 'ишь', 'ете', 'ите', 'ет', 'ит', 'ут', 'ют', 'ат', 'ят', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ла', 'ли', 'ло', 'ть', 'ю', 'у', 'а', 'я', 'ы', 'и', 'е', 'о', 'ь', 'й'];
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/-/g, ' ');
  function stem(w) {
    let s = w.replace(/(ся|сь)$/, '');
    for (const e of ENDINGS) if (s.length - e.length >= 3 && s.endsWith(e)) { s = s.slice(0, -e.length); break; }
    return s.slice(0, 7);
  }
  // слова, которые есть почти в каждом вопросе: почти не влияют на выбор ответа
  const WEAK = new Set('медитация медитации медитировать медитирую помедитировать медитирую практика практики практике время'.split(' ').map((w) => stem(w)));
  const words = (s) => norm(s).split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const stems = (s) => [...new Set(words(s).map(stem))];

  function build(faq) {
    const Fuse = root.Fuse || (typeof require === 'function' ? require('./vendor/fuse.min.js') : null);
    const synOf = new Map();
    SYN.forEach((g) => { const st = stems(g); st.forEach((s) => synOf.set(s, [...new Set([...(synOf.get(s) || []), ...st])])); });
    const docs = faq.map((f, i) => ({ i, q: new Set(stems(f.q)), k: new Set(stems(f.k || '')), a: new Set(stems(f.a)), t: new Set(stems(f.t)) }));
    const vocab = [...new Set(docs.flatMap((d) => [...d.q, ...d.k, ...d.a, ...d.t]).concat([...synOf.keys()]))];
    const fuse = Fuse ? new Fuse(vocab, { includeScore: true, threshold: 0.34, minMatchCharLength: 3 }) : null;
    return { faq, docs, synOf, fuse };
  }

  // Насколько основа из запроса совпадает с основой документа: 1 — точно, 0.85 — одна начинается с другой
  function sim(a, b) {
    if (a === b) return 1;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    return s.length >= 4 && l.startsWith(s) ? 0.85 : 0;
  }

  function query(ix, text) {
    let q = stems(text);
    if (!q.length) return [];
    const strong = q.filter((s) => !WEAK.has(s));
    const weakW = (s) => (strong.length && WEAK.has(s) ? 0 : 1); // при сильных словах «медитация», «практика» не считаем
    // каждое слово запроса: само + синонимы (0.8) + похожие по написанию — опечатки (до 0.7)
    const expanded = q.map((s) => {
      const tw = weakW(s);
      const alts = new Map([[s, 1]]);
      (ix.synOf.get(s) || []).forEach((x) => { if (!alts.has(x)) alts.set(x, 0.7); });
      if (ix.fuse && s.length >= 4) ix.fuse.search(s, { limit: 4 }).filter((r) => !WEAK.has(r.item) && r.item[0] === s[0] && Math.abs(r.item.length - s.length) <= 2 && r.score <= 0.3).forEach((r) => { const w = 0.7 * (1 - r.score); if (w > (alts.get(r.item) || 0)) alts.set(r.item, w); (ix.synOf.get(r.item) || []).forEach((x) => { if (!alts.has(x)) alts.set(x, w * 0.8); }); });
      alts.forEach((v, k) => alts.set(k, v * tw));
      alts.weak = tw < 1;
      return alts;
    });
    const nStrong = expanded.filter((a) => !a.weak).length || expanded.length;
    const W = { q: 3, k: 2.2, t: 1.2, a: 1 };
    const res = ix.docs.map((d) => {
      let score = 0; let hit = 0; const marks = new Set();
      expanded.forEach((alts) => {
        let best = 0;
        alts.forEach((aw, alt) => {
          ['q', 'k', 't', 'a'].forEach((f) => d[f].forEach((ds) => { const m = sim(alt, ds) * aw * W[f]; if (m > best) best = m; if (m > 0 && f === 'q' && !alts.weak) marks.add(ds); }));
        });
        if (best > 0 && (!alts.weak || nStrong === expanded.length)) hit += 1;
        score += best;
      });
      // все слова запроса нашлись — бонус; ответы из «Частых» чуть выше при равенстве
      score *= (Math.min(hit, nStrong) / nStrong) ** 0.9;
      if (ix.faq[d.i].pop) score *= 1.05;
      return { i: d.i, score, marks: [...marks] };
    }).filter((r) => r.score >= 0.75).sort((a, b) => b.score - a.score);
    // всё, что намного слабее лучшего ответа, — шум
    return res.length ? res.filter((r) => r.score >= res[0].score * 0.45) : res;
  }

  // Подсветка: слова вопроса, чьи основы совпали с запросом
  function mark(text, marks, esc) {
    if (!marks || !marks.length) return esc(text);
    return text.split(/(\s+)/).map((w) => { const s = stem(norm(w).trim()); return s && marks.some((m) => sim(m, s) > 0) ? `<mark>${esc(w)}</mark>` : esc(w); }).join('');
  }

  const api = { build, query, mark, stems };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TSearch = api;
}(typeof window !== 'undefined' ? window : globalThis));
