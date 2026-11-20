/* Essensplaner PWA: Rezepte in todo.*, Planung in calendar.*, Einstellungen in einer Config-Liste. */
(function () {
  'use strict';

  /* ---------- Bildschirmtastatur ----------
     Android/iOS verkleinern beim Öffnen der Tastatur oft nur den sichtbaren Bereich (visualViewport).
     Das Fenster (#sheet) richtet sich nach diesem Bereich, damit kurze Listen nicht unter der Tastatur landen. */
  (function trackViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const upd = () => {
      root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
      root.style.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    };
    vv.addEventListener('resize', upd);
    vv.addEventListener('scroll', upd);
    upd();
  })();

  /* ---------- Konstanten ---------- */
  const VERSION = window.APP_VERSION || '1.0.0';
  const LS_KEY = 'essensplaner_settings';
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MON_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const AUFWAND = { 1: 'einfach', 2: 'mittel', 3: 'aufwendig' };
  const VIEWS = { woche: 'woche', rezepte: 'rezepte', auswertung: 'auswertung', einstellungen: 'settings' };
  const SNAP_KEY = 'essensplaner_snapshot';
  const ABORT_TEXT = {
    already_configured: 'Eine Liste oder ein Kalender mit diesem Namen existiert in HA schon.',
    single_instance_allowed: 'Diese Integration erlaubt in HA nur einen Eintrag.'
  };
  const SET_PAGES = ['verbindung', 'planung', 'rezeptdaten', 'einkauf', 'daten', 'darstellung'];
  function parseHash() {
    const parts = location.hash.replace(/^#/, '').split('/');
    const view = VIEWS[parts[0]] || 'woche';
    return { view: view, page: view === 'settings' && SET_PAGES.indexOf(parts[1]) >= 0 ? parts[1] : null };
  }
  function viewFromHash() { return parseHash().view; }
  function hashOf(v) { return Object.keys(VIEWS).find((k) => VIEWS[k] === v) || 'woche'; }

  const DEFAULT_CONFIG = {
    v: 1,
    kategorien: [
      { key: 'fleisch', label: 'Fleisch' },
      { key: 'vegetarisch', label: 'Vegetarisch' },
      { key: 'fisch', label: 'Fisch' },
      { key: 'vegan', label: 'Vegan' }
    ],
    kuechen: [
      { key: 'deutsch', label: 'Deutsch' },
      { key: 'italienisch', label: 'Italienisch' },
      { key: 'asiatisch', label: 'Asiatisch' },
      { key: 'sonstige', label: 'Sonstige' }
    ],
    einheiten: ['g', 'kg', 'ml', 'l', 'stk', 'el', 'tl', 'prise', 'bund', 'dose', 'pck'],
    // Grundvorrat für die Einkaufsliste
    vorrat_nie: ['Salz', 'Pfeffer', 'Öl', 'Essig', 'Gewürz', 'Pulver', 'Muskat', 'Muskatnuss', 'Zimt', 'Kümmel', 'Oregano', 'Lorbeer', 'Chiliflocken', 'Kurkuma', 'Wasser'],
    vorrat_opt: ['Mehl', 'Zucker', 'Zwiebel', 'Knoblauch'],
    // Ablage: Gerichte ohne festen Tag (meist schon eingekauft). Einträge: { id, name, gericht_uid, portionen, eingekauft }
    ablage: [],
    frei_ignoriert: [],
    slots: [
      { key: 'mittag', label: 'Mittag', start: '12:00', ende: '13:00', aktiv: false },
      { key: 'abend', label: 'Abend', start: '18:00', ende: '19:00', aktiv: true }
    ],
    standard_portionen: 4
  };

  const DEFAULT_SETTINGS = {
    todo: 'todo.gerichte',
    calendar: 'calendar.essensplan',
    config: 'todo.essensplaner_config',
    bring: ''
  };

  const HASS = location.origin;
  const CLIENT_ID = HASS + '/';
  const REDIRECT_URI = HASS + location.pathname;
  const AUTH_KEY = 'essensplaner_auth';
  const STATE_KEY = 'essensplaner_oauth_state';

  /* ---------- Hilfsfunktionen ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
  const fmtNum = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
  const lc = (s) => String(s || '').trim().toLowerCase();
  const safeUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || '').trim());

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 864e5 + 1) / 7);
  }
  function localIso(d) {
    const off = -d.getTimezoneOffset();
    const a = Math.abs(off);
    return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      (off >= 0 ? '+' : '-') + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }
  function atTime(dateStr, hhmm) {
    const p = String(hhmm || '12:00').split(':').map(Number);
    const d = parseYmd(dateStr);
    d.setHours(p[0] || 0, p[1] || 0, 0, 0);
    return d;
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function rangeText(a, b) {
    if (a.getMonth() === b.getMonth()) return a.getDate() + '.–' + b.getDate() + '. ' + MON[a.getMonth()];
    return a.getDate() + '. ' + MON_S[a.getMonth()] + ' – ' + b.getDate() + '. ' + MON_S[b.getMonth()];
  }
  const dayLabel = (d) => {
    const t = ymd(new Date());
    if (d === t) return 'Heute';
    if (d === ymd(addDays(new Date(), 1))) return 'Morgen';
    if (d === ymd(addDays(new Date(), -1))) return 'Gestern';
    return WD_LONG[parseYmd(d).getDay()];
  };

  const ICONS = {
    left: '<path d="M15 18l-6-6 6-6"/>',
    swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    cart: '<path d="M3 4h2l2.4 11h11.2L21 8H6.2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M8 9h8M8 13h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    hat: '<path d="M6 14.5c-2.3-.6-3.6-2.8-2.9-5 .7-2.1 2.9-3.2 4.9-2.6C8.6 4.8 10.2 3.5 12 3.5s3.4 1.3 4 3.4c2-.6 4.2.5 4.9 2.6.7 2.2-.6 4.4-2.9 5"/><path d="M6 14.5V20h12v-5.5"/><path d="M6 17h12"/>',
    bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };
  const ic = (n, size) => '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
  const more = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

  /* ---------- Zustand ---------- */
  function loadSettings() {
    try {
      const s = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(LS_KEY) || '{}'));
      delete s.token;
      delete s.url;
      return s;
    }
    catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S.settings)); } catch (e) { toast('Einstellungen konnten nicht lokal gespeichert werden', true); }
  }

  const S = {
    settings: loadSettings(),
    auth: loadAuth(),
    conn: 'idle',
    recipes: [],
    recipesLoaded: false,
    config: clone(DEFAULT_CONFIG),
    configUid: null,
    events: [],
    eventsLoaded: false,
    range: null,
    view: viewFromHash(),
    page: parseHash().page,
    prevHash: '',
    curHash: location.hash,
    wmode: 'tage',
    anchor: null,
    rf: { q: '', kat: '', kueche: '', aufwand: '', fav: false, sort: 'name' },
    stats: { days: 90, sort: 'count' },
    sheet: null,
    entities: [],
    entityNames: {},
    subscribed: false,
    busy: false,
    settingsDirty: false,
    rawRecipes: [],
    rawEvents: [],
    fromSnap: false,
    snapT: 0,
    loggingIn: false
  };
  const ha = new HAClient();

  /* ---------- Anmeldung über Home Assistant (OAuth2, wie das HA-Frontend) ---------- */
  function loadAuth() {
    try { const a = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); return a && a.refresh_token ? a : null; }
    catch (e) { return null; }
  }
  function saveAuth() {
    try {
      if (S.auth) localStorage.setItem(AUTH_KEY, JSON.stringify(S.auth)); else localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* ignorieren */ }
  }
  function authError(msg) { const e = new Error(msg); e.authFailed = true; return e; }
  async function tokenRequest(params) {
    const r = await fetch(HASS + '/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
    if (r.status === 400 || r.status === 401 || r.status === 403) throw authError('Anmeldung ungültig oder abgelaufen');
    if (!r.ok) throw new Error('HTTP ' + r.status + ' bei der Anmeldung');
    return r.json();
  }
  let refreshing = null;
  /* Liefert einen gültigen Zugriffstoken und erneuert ihn kurz vor Ablauf über den Refresh-Token. */
  function getToken(force) {
    const a = S.auth;
    if (!a || !a.refresh_token) return Promise.reject(authError('Nicht angemeldet'));
    if (!force && a.access_token && a.expires - Date.now() > 60000) return Promise.resolve(a.access_token);
    if (!refreshing) {
      refreshing = tokenRequest({ grant_type: 'refresh_token', refresh_token: a.refresh_token, client_id: CLIENT_ID })
        .then((r) => {
          if (S.auth !== a) throw authError('Abgemeldet');
          a.access_token = r.access_token;
          a.expires = Date.now() + (r.expires_in || 1800) * 1000;
          saveAuth();
          return a.access_token;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  function randomState() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  function login() {
    const state = randomState();
    try { localStorage.setItem(STATE_KEY, state); } catch (e) { /* ignorieren */ }
    location.href = HASS + '/auth/authorize?response_type=code' +
      '&client_id=' + encodeURIComponent(CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
      '&state=' + encodeURIComponent(state);
  }
  /* Rückkehr von der HA-Anmeldeseite: Code gegen Tokens tauschen. */
  async function handleCallback() {
    const p = new URLSearchParams(location.search);
    if (p.has('reload')) {
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    const code = p.get('code');
    if (!code && !p.get('error')) return;
    let expected = null;
    try { expected = localStorage.getItem(STATE_KEY); localStorage.removeItem(STATE_KEY); } catch (e) { /* ignorieren */ }
    history.replaceState(null, '', location.pathname + location.hash);
    if (!code) { toast('Anmeldung abgebrochen', true); return; }
    if (!expected || p.get('state') !== expected) { toast('Anmeldung abgelehnt: Sicherheitsprüfung fehlgeschlagen. Bitte erneut anmelden.', true); return; }
    try {
      const r = await tokenRequest({ grant_type: 'authorization_code', code: code, client_id: CLIENT_ID });
      S.auth = { access_token: r.access_token, refresh_token: r.refresh_token, expires: Date.now() + (r.expires_in || 1800) * 1000 };
      saveAuth();
    } catch (e) { toast('Anmeldung fehlgeschlagen: ' + e.message, true); }
  }
  function clearLogin() {
    S.auth = null;
    saveAuth();
    ha.disconnect();
    S.subscribed = false;
    S.recipes = []; S.recipesLoaded = false; S.events = []; S.eventsLoaded = false; S.range = null;
    S.conn = 'unconfigured';
    S.fromSnap = false;
    if (pending) { clearTimeout(pending.timer); pending = null; }
    clearSnapshot();
    closeSheet();
  }
  async function logout() {
    const rt = S.auth && S.auth.refresh_token;
    clearLogin();
    render();
    if (rt) {
      try {
        await fetch(HASS + '/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: rt }).toString()
        });
      } catch (e) { /* lokal abgemeldet, Widerruf ist best effort */ }
    }
    toast('Abgemeldet');
  }

  /* ---------- Offline-Stand (letzter Stand mit Verbindung) ---------- */
  let snapTimer = null;
  const entKey = () => [S.settings.todo, S.settings.calendar, S.settings.config].join('|');
  function saveSnapshot() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      if (!S.auth) return;
      try {
        localStorage.setItem(SNAP_KEY, JSON.stringify({
          v: 1, t: Date.now(), ent: entKey(), config: S.config, configUid: S.configUid,
          recipes: S.rawRecipes, events: S.rawEvents, range: S.range
        }));
      } catch (e) { /* Speicher voll oder gesperrt: Offline-Stand fehlt dann */ }
    }, 300);
  }
  function loadSnapshot() {
    try {
      const d = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null');
      if (!d || d.v !== 1 || d.ent !== entKey()) return false;
      S.config = Object.assign(clone(DEFAULT_CONFIG), d.config || {});
      S.configUid = d.configUid || null;
      S.rawRecipes = Array.isArray(d.recipes) ? d.recipes : [];
      S.recipes = S.rawRecipes.map(parseRecipe);
      S.recipesLoaded = true;
      S.rawEvents = Array.isArray(d.events) ? d.events : [];
      S.events = S.rawEvents.map(parseEvent).filter((e) => e.date);
      S.eventsLoaded = true;
      S.range = d.range || null;
      S.snapT = d.t || 0;
      S.fromSnap = true;
      return true;
    } catch (e) { return false; }
  }
  function clearSnapshot() {
    clearTimeout(snapTimer);
    try { localStorage.removeItem(SNAP_KEY); } catch (e) { /* ignorieren */ }
  }
  function standText(t) {
    const d = new Date(t);
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const day = ymd(d);
    if (day === ymd(new Date())) return 'heute, ' + hm;
    if (day === ymd(addDays(new Date(), -1))) return 'gestern, ' + hm;
    return d.getDate() + '.' + (d.getMonth() + 1) + '., ' + hm;
  }

  /* ---------- Löschen mit Rückgängig: wird erst nach einigen Sekunden an HA geschickt ---------- */
  let pending = null;
  const isPendingDel = (uid) => !!(pending && pending.uid === uid);
  function commitPending() {
    if (!pending) return Promise.resolve();
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    return Promise.resolve().then(p.run)
      .catch((e) => { toast('Löschen fehlgeschlagen: ' + e.message, true); })
      .then(() => p.refresh().catch(() => {}))
      .then(() => softRender());
  }
  function scheduleDelete(o) {
    return commitPending().then(() => {
      pending = { uid: o.uid, run: o.run, refresh: o.refresh, restore: o.restore, timer: setTimeout(commitPending, 6000) };
      softRender();
      toast(o.label + ' gelöscht', {
        duration: 6000,
        action: 'Rückgängig',
        onAction: () => {
          if (!pending || pending.uid !== o.uid) return;
          clearTimeout(pending.timer);
          pending = null;
          o.restore();
          softRender();
          toast('Wiederhergestellt');
        }
      });
    });
  }

  /* ---------- Rezepte ---------- */
  function parseRecipe(it) {
    let raw = {};
    let legacy = false;
    const d = String(it.description || '').trim();
    if (d) {
      try {
        const j = JSON.parse(d);
        if (j && typeof j === 'object' && !Array.isArray(j)) raw = j; else legacy = true;
      } catch (e) { legacy = true; }
    }
    return {
      uid: it.uid,
      name: it.summary || '',
      desc: it.description || '',
      legacy: legacy,
      raw: raw,
      kategorie: raw.kategorie || '',
      kueche: raw.kueche || '',
      aufwand: +raw.aufwand || 0,
      portionen: +raw.portionen || 0,
      dauer: +raw.dauer_min || 0,
      zutaten: Array.isArray(raw.zutaten) ? raw.zutaten.filter((z) => z && z.name) : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      bewertung: +raw.bewertung || 0,
      favorit: !!raw.favorit,
      notiz: legacy ? d : (raw.notiz || ''),
      url: raw.rezept_url || ''
    };
  }
  const recipeById = (uid) => (uid ? S.recipes.find((r) => r.uid === uid) : null);
  const catLabel = (k) => { const c = S.config.kategorien.find((x) => x.key === k); return c ? c.label : (k || ''); };
  const kuecheLabel = (k) => { const c = S.config.kuechen.find((x) => x.key === k); return c ? c.label : (k || ''); };
  function chipClass(k) {
    if (k === 'fleisch') return 'chip chip-fleisch';
    if (k === 'vegetarisch' || k === 'vegan') return 'chip chip-vegi';
    if (k === 'fisch') return 'chip chip-fisch';
    return 'chip';
  }
  const chip = (k) => (k ? '<span class="' + chipClass(k) + '">' + esc(catLabel(k)) + '</span>' : '');
  const unitLabel = (u) => (u === 'stk' ? 'Stk' : (u || ''));

  /* ---------- Termine ---------- */
  const slotIdx = (k) => { const i = S.config.slots.findIndex((s) => s.key === k); return i < 0 ? 99 : i; };
  function slotOf(k) {
    return S.config.slots.find((s) => s.key === k) || { key: k, label: k, start: '18:00', ende: '19:00', aktiv: true };
  }
  function slotTimes(date, sl) {
    const s = atTime(date, sl.start);
    let e = atTime(date, sl.ende);
    if (e <= s) e = new Date(s.getTime() + 3600000);
    return [s, e];
  }
  function firstActiveSlot() {
    const a = S.config.slots.find((s) => s.aktiv);
    return (a || S.config.slots[0] || { key: 'abend' }).key;
  }
  function parseEvent(e) {
    let date = '';
    let hour = null;
    const st = e.start;
    if (typeof st === 'string') {
      if (st.length > 10) { const d = new Date(st); date = ymd(d); hour = d.getHours(); } else date = st;
    } else if (st && st.dateTime) {
      const d = new Date(st.dateTime); date = ymd(d); hour = d.getHours();
    } else if (st && st.date) {
      date = String(st.date).slice(0, 10);
    }
    let meta = {};
    const dsc = String(e.description || '').trim();
    if (dsc) {
      try { const j = JSON.parse(dsc); if (j && typeof j === 'object' && !Array.isArray(j)) meta = j; else meta = { notiz: dsc }; }
      catch (err) { meta = { notiz: dsc }; }
    }
    let slot = meta.slot;
    if (!slot) {
      if (hour == null) slot = firstActiveSlot();
      else {
        const sorted = S.config.slots.slice().sort((a, b) => parseInt(a.start, 10) - parseInt(b.start, 10));
        let pick = sorted[0];
        sorted.forEach((s) => { if (parseInt(s.start, 10) <= hour) pick = s; });
        slot = pick ? pick.key : 'abend';
      }
    }
    // Nur echte Datumswerte zulassen, alles andere wird verworfen (der Wert landet später in Formularfeldern)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '';
    return {
      uid: e.uid || '',
      summary: e.summary || '',
      date: date,
      slot: slot,
      status: meta.status === 'gekocht' ? 'gekocht' : 'geplant',
      gericht_uid: meta.gericht_uid || null,
      portionen: +meta.portionen || 0,
      notiz: meta.notiz || '',
      eingekauft: !!meta.eingekauft,
      meta: meta
    };
  }
  const entryName = (ev) => { const r = recipeById(ev.gericht_uid); return r ? r.name : ev.summary; };
  const eventsOn = (d, slot) => S.events
    .filter((e) => e.date === d && (!slot || e.slot === slot))
    .sort((a, b) => slotIdx(a.slot) - slotIdx(b.slot) || entryName(a).localeCompare(entryName(b), 'de'));
  function daySlots(d) {
    let keys = S.config.slots.filter((s) => s.aktiv).map((s) => s.key);
    if (!keys.length && S.config.slots.length) keys = [S.config.slots[0].key];
    eventsOn(d).forEach((e) => { if (keys.indexOf(e.slot) < 0) keys.push(e.slot); });
    return keys.sort((a, b) => slotIdx(a) - slotIdx(b));
  }
  function lastMap() {
    const m = {};
    const t = ymd(new Date());
    S.events.forEach((e) => {
      if (e.status !== 'gekocht' || !e.gericht_uid || e.date > t) return;
      if (!m[e.gericht_uid] || m[e.gericht_uid] < e.date) m[e.gericht_uid] = e.date;
    });
    return m;
  }
  function countMap(from, to) {
    const m = {};
    S.events.forEach((e) => {
      if (e.status !== 'gekocht' || !e.gericht_uid) return;
      if ((from && e.date < from) || (to && e.date > to)) return;
      m[e.gericht_uid] = (m[e.gericht_uid] || 0) + 1;
    });
    return m;
  }
  function agoText(d) {
    if (!d) return 'noch nicht gekocht';
    const n = daysBetween(d, ymd(new Date()));
    if (n <= 0) return 'heute gekocht';
    if (n === 1) return 'gestern gekocht';
    return 'zuletzt vor ' + n + ' Tagen';
  }

  /* ---------- Angezeigter Zeitraum: Heute + 5 Tage (Standard) oder Woche ---------- */
  const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const winLen = () => (S.wmode === 'woche' ? 7 : 5);
  function windowStart() {
    if (S.wmode === 'woche') return mondayOf(S.anchor ? parseYmd(S.anchor) : new Date());
    return S.anchor ? parseYmd(S.anchor) : startOfToday();
  }
  const visibleDays = () => { const st = windowStart(); return Array.from({ length: winLen() }, (_, i) => ymd(addDays(st, i))); };
  /* anchor = null heißt: aktuelles Fenster ab heute (bzw. aktuelle Woche) */
  function normalizeAnchor(d) {
    const cur = S.wmode === 'woche' ? mondayOf(new Date()) : startOfToday();
    return ymd(d) === ymd(cur) ? null : ymd(d);
  }
  function shiftWindow(dir) { S.anchor = normalizeAnchor(addDays(windowStart(), dir * winLen())); }

  /* ---------- Laden ---------- */
  async function loadEvents() {
    if (!S.settings.calendar) return;
    const today = new Date();
    const ws = windowStart();
    const start = new Date(Math.min(addDays(today, -365).getTime(), addDays(ws, -7).getTime()));
    const end = new Date(Math.max(addDays(today, 60).getTime(), addDays(ws, 14).getTime()));
    const q = '?start=' + encodeURIComponent(start.toISOString()) + '&end=' + encodeURIComponent(end.toISOString());
    const list = await ha.rest('/api/calendars/' + encodeURIComponent(S.settings.calendar) + q);
    S.rawEvents = Array.isArray(list) ? list : [];
    S.events = S.rawEvents.map(parseEvent).filter((e) => e.date && !isPendingDel(e.uid));
    S.range = { start: ymd(start), end: ymd(end) };
    S.eventsLoaded = true;
    S.fromSnap = false;
    saveSnapshot();
  }
  async function ensureRange() {
    const ws = ymd(addDays(windowStart(), -7));
    const we = ymd(addDays(windowStart(), 14));
    if (!S.range || ws < S.range.start || we > S.range.end) { await loadEvents(); }
  }
  async function loadConfig() {
    const r = await ha.request({ type: 'todo/item/list', entity_id: S.settings.config });
    const it = (r.items || []).find((i) => i.summary === 'config');
    if (!it) {
      await ha.callService('todo', 'add_item', { item: 'config', description: JSON.stringify(DEFAULT_CONFIG) }, S.settings.config);
      const r2 = await ha.request({ type: 'todo/item/list', entity_id: S.settings.config });
      const it2 = (r2.items || []).find((i) => i.summary === 'config');
      S.configUid = it2 ? it2.uid : null;
      S.config = clone(DEFAULT_CONFIG);
      return;
    }
    S.configUid = it.uid;
    let parsed = {};
    try { parsed = JSON.parse(it.description || '{}') || {}; } catch (e) { parsed = {}; }
    const c = Object.assign(clone(DEFAULT_CONFIG), parsed);
    ['kategorien', 'kuechen', 'einheiten', 'slots'].forEach((k) => { if (!Array.isArray(c[k]) || !c[k].length) c[k] = clone(DEFAULT_CONFIG[k]); });
    c.standard_portionen = +c.standard_portionen || 4;
    S.config = c;
  }
  async function loadEntities() {
    try {
      const st = await ha.request({ type: 'get_states' });
      const ents = st.filter((s) => /^(todo|calendar)\./.test(s.entity_id));
      S.entities = ents.map((s) => s.entity_id).sort();
      S.entityNames = {};
      ents.forEach((s) => { S.entityNames[s.entity_id] = (s.attributes && s.attributes.friendly_name) || ''; });
    } catch (e) { /* optional */ }
  }
  async function bootData() {
    try {
      if (!S.subscribed) {
        S.subscribed = true;
        ha.subscribe({ type: 'todo/item/subscribe', entity_id: S.settings.todo }, (ev) => {
          S.rawRecipes = (ev && ev.items) || [];
          S.recipes = S.rawRecipes.map(parseRecipe).filter((r) => !isPendingDel(r.uid));
          saveSnapshot();
          S.recipesLoaded = true;
          softRender();
          refreshSheetLists();
        });
      }
      await loadConfig();
      await loadEvents();
      loadEntities().then(() => softRender());
    } catch (e) {
      toast(e.message, true);
    }
    softRender();
  }

  function start() {
    S.subscribed = false;
    ha.disconnect();
    ha.configure(HASS, getToken);
    if (!S.auth) { S.conn = 'unconfigured'; render(); return; }
    ha.connect();
  }

  /* ---------- UI-Grundfunktionen ---------- */
  let toastTimer = null;
  /* toast(text), toast(text, true) für Fehler, toast(text, { action, onAction, duration }) mit Knopf */
  function toast(msg, opt) {
    if (opt === true) opt = { err: true };
    opt = opt || {};
    const t = $('#toast');
    t.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);
    if (opt.action) {
      const b = document.createElement('button');
      b.textContent = opt.action;
      b.addEventListener('click', () => { t.className = ''; clearTimeout(toastTimer); opt.onAction(); });
      t.appendChild(b);
    }
    t.className = 'show' + (opt.err ? ' err' : '') + (opt.action ? ' act' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, opt.duration || (opt.err ? 5000 : 2800));
  }
  function needOnline() {
    if (S.conn !== 'online') { toast('Keine Verbindung zu Home Assistant. Änderungen sind gesperrt.', true); return false; }
    return true;
  }
  function run(fn) {
    return Promise.resolve().then(fn).catch((e) => { console.error(e); toast((e && e.message) || 'Fehler', true); });
  }
  function showSheet(title, body) {
    const sh = $('#sheet');
    sh.innerHTML = '<div class="backdrop" data-a="closesheet"></div>' +
      '<section class="sheet' + (S.sheet && S.sheet.type ? ' sheet-' + S.sheet.type : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<header class="sheet-h"><h2>' + esc(title) + '</h2><button class="iconbtn plain" data-a="closesheet" aria-label="Schließen">' + ic('close') + '</button></header>' +
      '<div class="sheet-b">' + body + '</div></section>';
    if (sh.hidden) {
      // Eigener Verlaufseintrag, damit die Zurück-Geste das Sheet schließt statt die App zu verlassen
      try { history.pushState({ epSheet: true }, ''); sheetHist = true; } catch (e) { sheetHist = false; }
    }
    sh.hidden = false;
    document.body.classList.add('noscroll');
  }
  let sheetHist = false;
  let ignorePop = false;
  /* Rückfrage als Fenster, liefert true bei Bestätigung. Schließen auf anderem Weg zählt als Nein. */
  function confirmSheet(o) {
    return new Promise((resolve) => {
      S.sheet = { type: 'confirm', done: resolve };
      showSheet(o.title,
        (o.hint ? '<p class="set-note" style="margin:0 4px">' + esc(o.hint) + '</p>' : '') +
        '<div class="menu-group" style="margin:0"><button class="menu-row press is-danger" type="button" data-a="confirmyes"><span class="menu-text"><span class="menu-title">' + esc(o.label) + '</span></span></button></div>' +
        '<button class="btn wide" type="button" data-a="confirmno">Abbrechen</button>');
    });
  }
  function closeSheet(fromPop) {
    const sh = $('#sheet');
    if (S.sheet && S.sheet.type === 'confirm' && S.sheet.done) { const d = S.sheet.done; S.sheet.done = null; d(false); }
    const wasOpen = !sh.hidden;
    if (wasOpen && !fromPop && sheetHist) { ignorePop = true; history.back(); }
    sheetHist = false;
    sh.hidden = true;
    sh.innerHTML = '';
    S.sheet = null;
    document.body.classList.remove('noscroll');
  }
  function renderBanner() {
    const b = $('#banner');
    let msg = '';
    let err = false;
    if (S.auth) {
      const stand = S.fromSnap && S.snapT ? ' Stand: ' + standText(S.snapT) + '.' : '';
      if (S.conn === 'connecting') msg = 'Verbinde mit Home Assistant …' + stand;
      else if (S.conn === 'offline') { msg = 'Keine Verbindung zu Home Assistant.' + stand + ' Änderungen sind gesperrt.'; err = true; }
      else if (S.conn === 'auth_error') { msg = 'Anmeldung abgelaufen. Bitte neu anmelden.'; err = true; }
    }
    b.hidden = !msg;
    b.textContent = msg;
    const st = $('#st_conn');
    if (st) st.textContent = connText();
    b.className = 'banner' + (err ? ' err' : '');
  }
  function connText() {
    return { online: 'Verbunden', connecting: 'Verbindung wird aufgebaut', offline: 'Keine Verbindung', auth_error: 'Anmeldung abgelaufen' }[S.conn] || 'Nicht verbunden';
  }
  function navHtml() {
    const items = [['woche', 'Woche', 'cal'], ['rezepte', 'Rezepte', 'book'], ['auswertung', 'Auswertung', 'chart'], ['settings', 'Einstellungen', 'gear']];
    return items.map((i) => '<button data-a="nav" data-v="' + i[0] + '" class="' + (S.view === i[0] ? 'on' : '') + '"' +
      (S.view === i[0] ? ' aria-current="page"' : '') + '>' + ic(i[2], 22) + i[1] + '</button>').join('');
  }
  function render() {
    const main = $('#main');
    const top = main.scrollTop;
    let html = '';
    S.settingsDirty = false;
    if (!S.auth) html = viewLogin();
    else if (S.view === 'woche') html = viewWoche();
    else if (S.view === 'rezepte') html = viewRezepte();
    else if (S.view === 'auswertung') html = viewAuswertung();
    else html = viewSettings();
    main.innerHTML = html;
    main.scrollTop = top;
    $('#nav').innerHTML = S.auth ? navHtml() : '';
    $('#nav').hidden = !S.auth;
    renderBanner();
    if (S.auth && S.view === 'rezepte') updateRecipeList();
  }
  /* Aktualisierung im Hintergrund (Abo, Reconnect): lässt offene Eingaben und den Fokus in Ruhe. */
  function softRender() {
    if (!S.auth) { render(); return; }
    if (S.view === 'settings') { if (!S.settingsDirty) render(); return; }
    if (S.view === 'rezepte' && $('#rlist')) {
      updateRecipeList();
      const c = $('#rcount');
      if (c) c.textContent = S.recipes.length + ' Gerichte';
      return;
    }
    render();
  }
  function viewLogin() {
    return '<div class="page login">' +
      '<img src="icon-192.png" alt="" width="72" height="72">' +
      '<h1 class="title">Essensplaner</h1>' +
      '<p class="note-s">Melde dich mit deinem Home-Assistant-Konto an. Rezepte und Plan liegen in deinem Home Assistant.</p>' +
      (S.loggingIn ? '<p>Anmeldung läuft …</p>' : '<button class="btn primary wide" data-a="login">Mit Home Assistant anmelden</button>') +
      '<p class="note-s">Version ' + esc(VERSION) + '</p>' +
      '<button class="btn" data-a="hardreload">App neu laden</button></div>';
  }

  /* ---------- Ansicht: Woche ---------- */
  const CAT_CLASS = { fleisch: 'cat-fleisch', fisch: 'cat-fisch', vegetarisch: 'cat-vegi', vegan: 'cat-vegi' };
  /* Ein Gericht als Karte, die sich wischen lässt (swipe.js). Heute voll, andere Tage kompakt. */
  function entryCard(ev, multi, full) {
    const r = recipeById(ev.gericht_uid);
    const sl = slotOf(ev.slot);
    const cooked = ev.status === 'gekocht';
    const isToday = ev.date === ymd(new Date());
    const meta = [];
    if (r && r.kategorie) meta.push(chip(r.kategorie));
    if (r && r.dauer) meta.push('<span>' + r.dauer + ' min</span>');
    if (full && r && r.aufwand) meta.push('<span>Aufwand ' + AUFWAND[r.aufwand] + '</span>');
    const port = ev.portionen || (r && r.portionen);
    if (port) meta.push('<span>' + port + ' Portionen</span>');
    if (!r) meta.unshift('<span>Freier Eintrag</span>');
    let zut = '';
    if (full && r && r.zutaten.length) {
      const names = r.zutaten.map((z) => z.name);
      zut = names.slice(0, 8).join(', ') + (names.length > 8 ? ' …' : '');
    }
    // Gekochte Gerichte zeigen nur noch den Titel, damit die Ansicht kompakt bleibt
    if (cooked) { meta.length = 0; zut = ''; }
    const eyebrow = multi && !cooked ? esc(sl.label) : '';
    // Links: Kochmütze = gekocht, darunter Tasche = eingekauft (nur solange nicht gekocht)
    const box = '<div class="marks"><button type="button" class="chkbox' + (cooked ? ' on' : '') + '" data-a="cook" data-uid="' + esc(ev.uid) + '" role="checkbox" aria-checked="' + cooked + '" aria-label="' + esc(entryName(ev)) + ': ' + (cooked ? 'gekocht, antippen für offen' : 'nicht gekocht, antippen für gekocht') + '" title="Gekocht"><span class="cb">' + ic('hat', 20) + '</span></button>' +
      (cooked ? '' : '<button type="button" class="buybox' + (ev.eingekauft ? ' on' : '') + '" data-a="buy" data-uid="' + esc(ev.uid) + '" role="checkbox" aria-checked="' + !!ev.eingekauft + '" aria-label="' + esc(entryName(ev)) + ': ' + (ev.eingekauft ? 'eingekauft, antippen für nicht eingekauft' : 'nicht eingekauft, antippen für eingekauft') + '" title="Eingekauft"><span class="bb">' + ic('bag', 16) + '</span></button>') + '</div>';
    return '<div class="swipe' + (isToday ? ' today' : '') + '" data-uid="' + esc(ev.uid) + '" data-cooked="' + cooked + '"><div class="swipe-bg" aria-hidden="true"></div>' +
      '<article class="card ecard ' + (CAT_CLASS[r && r.kategorie] || 'cat-none') + (full ? '' : ' compact') + (cooked ? ' done' : '') + '">' +
      '<div class="crow">' + box + '<div class="ctext">' + (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : '') +
      '<h2>' + esc(entryName(ev)) + '</h2>' + (meta.length ? '<div class="meta">' + meta.join('') + '</div>' : '') + '</div>' +
      '<button class="iconbtn plain" data-a="entry" data-uid="' + esc(ev.uid) + '" aria-label="Optionen für ' + esc(entryName(ev)) + '">' + more + '</button></div>' +
      (zut ? '<p class="zut" data-a="rdetail" data-uid="' + esc(r.uid) + '" role="button" tabindex="0" aria-label="Gericht ' + esc(r.name) + ' öffnen">' + esc(zut) + '</p>' : '') + (ev.notiz && !cooked ? '<p class="note">' + esc(ev.notiz) + '</p>' : '') +
      '</article></div>';
  }

  /* Ein Tag: Kopfzeile (heute hervorgehoben) und darunter Gerichte oder Platz zum Planen */
  function dayBlock(d, multi) {
    const dt = parseYmd(d);
    const t = ymd(new Date());
    const near = d === t || d === ymd(addDays(new Date(), 1)) || d === ymd(addDays(new Date(), -1));
    let body = '';
    let empty = [];
    // Leere Mahlzeiten direkt hintereinander stehen nebeneinander in einer Zeile
    const flush = () => {
      if (!empty.length) return;
      body += empty.length > 1 ? '<div class="slotrow">' + empty.join('') + '</div>' : empty[0];
      empty = [];
    };
    const hdrMode = multi && daySlots(d).some((k) => eventsOn(d, k).length) && daySlots(d).some((k) => !eventsOn(d, k).length);
    let hdrBtns = '';
    daySlots(d).forEach((k) => {
      const list = eventsOn(d, k);
      if (hdrMode && !list.length) { hdrBtns += '<button class="slotbtn mini" data-a="pick" data-d="' + d + '" data-slot="' + esc(k) + '">' + ic('plus', 16) + esc(slotOf(k).label) + '</button>'; return; }
      if (list.length) { flush(); body += list.map((e) => entryCard(e, multi, d === t)).join(''); }
      else empty.push('<button class="slotbtn" data-a="pick" data-d="' + d + '" data-slot="' + esc(k) + '">' + ic('plus', 18) + (multi ? '<span>' + esc(slotOf(k).label) + '<span class="pl"> planen</span></span>' : 'Gericht planen') + '</button>');
    });
    flush();
    // Ist der ganze Tag leer, steht alles in einer schmalen Zeile: Datum links, Knöpfe rechts
    const allEmpty = multi && daySlots(d).every((k) => !eventsOn(d, k).length);
    return '<section class="daysec' + (allEmpty ? ' dayempty' : '') + '" data-day="' + d + '"><div class="dayhead' + (d === t ? ' today' : '') + '"' + (d === t ? ' aria-current="date"' : '') + '>' +
      '<span class="dl"><b>' + esc(dayLabel(d)) + '</b>' + (near ? '<em>' + esc(WD_LONG[dt.getDay()]) + '</em>' : '') + '</span>' +
      '<span class="dd">' + dt.getDate() + '. ' + MON_S[dt.getMonth()] + '</span>' + (hdrBtns ? '<span class="hdrbtns">' + hdrBtns + '</span>' : '') + '</div>' + body + '</section>';
  }

  function viewWoche() {
    const days = visibleDays();
    const first = parseYmd(days[0]);
    const last = parseYmd(days[days.length - 1]);
    const multi = S.config.slots.filter((x) => x.aktiv).length > 1;
    const sub = (S.wmode === 'woche' ? 'KW ' + isoWeek(first) + ' · ' : '') + rangeText(first, last);
    const hasEntries = S.eventsLoaded && days.some((d) => eventsOn(d).length > 0);
    return '<div class="page">' +
      '<div class="hdr"><h1 class="title">Wochenplan</h1><div class="hbtns">' +
      (S.settings.bring ? '<button class="iconbtn shopbtn" data-a="shop" aria-label="Zutaten auf die Einkaufsliste">' + ic('cart') + '</button>' : '') +
      '<button class="iconbtn" data-a="weekprev" aria-label="Zurück">' + ic('left') + '</button><button class="iconbtn" data-a="weeknext" aria-label="Weiter">' + ic('right') + '</button></div></div>' +
      '<div class="subrow"><span class="sub">' + esc(sub) + '</span><div class="hbtns">' +
      '<button class="modebtn press" type="button" data-a="fillopen">' + ic('spark', 15) + 'Füllen</button>' + (S.anchor ? '<button class="modebtn press" type="button" data-a="wtoday">Heute</button>' : '') +
      '<button class="modebtn press" type="button" data-a="wmodetoggle" aria-label="Ansicht wechseln, jetzt ' + (S.wmode === 'woche' ? 'Woche' : 'heute plus 4 Tage') + '">' + ic('swap', 15) + (S.wmode === 'woche' ? 'Woche' : '5 Tage') + '</button></div></div>' +
      ablageStrip() +
      (S.eventsLoaded ? '<div class="daylist">' + days.map((d) => dayBlock(d, multi)).join('') + '</div>' : '<div class="card"><p class="empty">Lade Plan …</p></div>') +
      (hasEntries ? '<p class="swipe-hint">Wischen: nach rechts gekocht, nach links verschieben, ganz nach links löschen</p>' : '') +
      '</div>';
  }

  /* ---------- Ansicht: Rezepte ---------- */
  const optList = (arr, sel, all) => (all ? '<option value="">' + all + '</option>' : '') +
    arr.map((o) => '<option value="' + esc(o.key) + '"' + (o.key === sel ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
    (sel && !arr.some((o) => o.key === sel) ? '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (entfernt)</option>' : '');

  function matchRecipe(r, q) {
    if (!q) return true;
    const hay = lc([r.name, r.tags.join(' '), r.zutaten.map((z) => z.name).join(' '), catLabel(r.kategorie), kuecheLabel(r.kueche)].join(' '));
    return q.split(/\s+/).every((w) => hay.indexOf(w) >= 0);
  }

  /* Freie Einträge, nach Name zusammengefasst: ohne Gericht oder mit gelöschtem Gericht. Plan und Ablage.
     Mit all=true auch die ignorierten Namen. */
  function freeGroups(all) {
    const m = {};
    const ign = S.config.frei_ignoriert || [];
    const lost = (uid) => !!uid && S.recipesLoaded && !recipeById(uid);
    const add = (name, date, kind, ref, orphan) => {
      const nm = String(name || '').trim();
      if (!nm) return;
      const k = lc(nm);
      if (!m[k]) m[k] = { key: k, name: nm, count: 0, last: '', evUids: [], ablIds: [], orphan: false };
      const g = m[k];
      g.count++;
      if (orphan) g.orphan = true;
      if (date && date > g.last) g.last = date;
      if (kind === 'ev') g.evUids.push(ref); else g.ablIds.push(ref);
    };
    S.events.forEach((e) => { if (!e.gericht_uid || lost(e.gericht_uid)) add(e.summary, e.date, 'ev', e.uid, !!e.gericht_uid); });
    ablage().forEach((a) => { if (!a.gericht_uid || lost(a.gericht_uid)) add(a.name, '', 'abl', a.id, !!a.gericht_uid); });
    return Object.keys(m).map((k) => m[k])
      .filter((g) => all || ign.indexOf(g.key) < 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  function freeInfo(g) {
    const dt = g.last ? parseYmd(g.last) : null;
    return g.count + ' Mal' + (dt ? ', zuletzt ' + dt.getDate() + '. ' + MON_S[dt.getMonth()] : '') + (g.ablIds.length ? ', Ablage' : '') + (g.orphan ? ', Gericht gelöscht' : '');
  }
  function openFreeList() {
    const gs = freeGroups();
    const ign = S.config.frei_ignoriert || [];
    const allG = freeGroups(true);
    S.sheet = { type: 'freelist' };
    showSheet('Freie Einträge',
      '<p class="set-note" style="margin:0 4px 8px">Einträge ohne Gericht. Tippe einen an, um ein Gericht daraus zu machen oder ihn mit einem vorhandenen zu verknüpfen. Es werden immer alle Einträge mit diesem Namen verknüpft.</p>' +
      (gs.length ? '<div class="menu-group" style="margin:0">' + gs.map((g) =>
        '<button class="menu-row press" type="button" data-a="freepick" data-k="' + esc(g.key) + '"><span class="menu-text"><span class="menu-title">' + esc(g.name) + '</span><span class="menu-summary">' + esc(freeInfo(g)) + '</span></span></button>').join('') + '</div>'
        : '<p class="empty">Keine freien Einträge.</p>') +
      (ign.length ? '<div class="plist-sec" style="margin-top:16px">Ignoriert</div><div class="menu-group" style="margin:0">' + ign.map((k) =>
        '<div class="menu-row"><span class="menu-text"><span class="menu-title">' + esc((allG.find((g) => g.key === k) || { name: k }).name) + '</span></span><button class="btn press" type="button" data-a="freeunign" data-k="' + esc(k) + '">Wieder anzeigen</button></div>').join('') + '</div>' : ''));
  }
  function openFreeGroup(key) {
    const g = freeGroups(true).find((x) => x.key === key);
    if (!g) { openFreeList(); return; }
    const ignored = (S.config.frei_ignoriert || []).indexOf(key) >= 0;
    S.sheet = { type: 'freegroup', key: key };
    showSheet('„' + g.name + '“',
      '<p class="set-note" style="margin:0 4px 10px">' + esc(freeInfo(g)) + '</p>' +
      '<div class="actions stack-actions">' +
      '<button class="btn primary press" type="button" data-a="freenew" data-k="' + esc(key) + '">' + ic('plus', 18) + 'Neues Gericht anlegen</button>' +
      '<button class="btn press" type="button" data-a="freelinkpick" data-k="' + esc(key) + '">Mit vorhandenem Gericht verknüpfen</button>' +
      (ignored ? '' : '<button class="btn press" type="button" data-a="freeign" data-k="' + esc(key) + '">Ignorieren, bleibt frei</button>') +
      '</div>');
  }
  function openFreeLink(key) {
    const g = freeGroups(true).find((x) => x.key === key);
    if (!g) return;
    S.sheet = { type: 'freelink', key: key };
    showSheet('Verknüpfen: ' + g.name,
      '<input id="flq" type="search" placeholder="Gericht suchen" autocomplete="off" enterkeyhint="done">' +
      '<div id="fllist" class="list" style="margin-top:10px"></div>');
    updateFreeLink();
    const q = $('#flq');
    if (q) q.addEventListener('input', updateFreeLink);
  }
  function updateFreeLink() {
    const sh = S.sheet;
    if (!sh || sh.type !== 'freelink' || !$('#fllist')) return;
    const raw = $('#flq') ? $('#flq').value : '';
    const g = freeGroups(true).find((x) => x.key === sh.key);
    // Ähnliche Namen zuerst
    const near = (r) => g && (lc(r.name).indexOf(g.key) >= 0 || g.key.indexOf(lc(r.name)) >= 0) ? 0 : 1;
    const list = S.recipes.filter((r) => matchRecipe(r, lc(raw))).sort((a, b) => near(a) - near(b) || a.name.localeCompare(b.name, 'de'));
    $('#fllist').innerHTML = list.map((r) => '<button class="row" type="button" data-a="freelink" data-k="' + esc(sh.key) + '" data-uid="' + esc(r.uid) + '"><span class="main"><b>' + esc(r.name) + '</b></span>' + chip(r.kategorie) + '</button>').join('') || '<div class="empty">Kein Gericht gefunden.</div>';
  }
  /* Alle Einträge einer Gruppe mit einem Gericht verknüpfen. Zählt mit, damit ein Abbruch sichtbar bleibt. */
  async function linkGroup(key, r) {
    const g = freeGroups(true).find((x) => x.key === key);
    if (!g || !r) return 0;
    let n = 0;
    const total = g.evUids.length + g.ablIds.length;
    for (const id of g.evUids) {
      const ev = S.events.find((e) => e.uid === id);
      if (!ev) continue;
      if (total > 4) toast('Verknüpfe ' + (n + 1) + ' von ' + total + ' …');
      await updateEntry(ev, { gericht_uid: r.uid, name: r.name });
      n++;
    }
    if (g.ablIds.length) {
      await patchConfig((c) => { (c.ablage || []).forEach((a) => { if (g.ablIds.indexOf(a.id) >= 0) { a.gericht_uid = r.uid; a.name = r.name; } }); }, true);
      n += g.ablIds.length;
    }
    // Ein ignorierter Name ist damit erledigt
    if ((S.config.frei_ignoriert || []).indexOf(key) >= 0) await patchConfig((c) => { c.frei_ignoriert = (c.frei_ignoriert || []).filter((k) => k !== key); }, true);
    await loadEvents();
    return n;
  }
  function viewRezepte() {
    const f = S.rf;
    const nFree = S.recipesLoaded ? freeGroups().length : 0;
    return '<div class="page">' +
      '<div class="hdr"><div><span class="sub" id="rcount">' + S.recipes.length + ' Gerichte</span><h1 class="title">Rezepte</h1></div>' +
      '<div class="hbtns">' + (nFree ? '<button class="modebtn press freebtn" type="button" data-a="freeopen" aria-label="Freie Einträge zu Gerichten machen">Frei<b class="cnt">' + nFree + '</b></button>' : '') +
      '<button class="iconbtn primary" data-a="newrecipe" aria-label="Neues Rezept">' + ic('plus') + '</button></div></div>' +
      '<div class="filters">' +
      '<input id="rq" type="search" placeholder="Suchen: Name, Zutat, Tag" autocomplete="off" value="' + esc(f.q) + '">' +
      '<div class="frow"><select id="flt_kat" aria-label="Kategorie">' + optList(S.config.kategorien, f.kat, 'Alle Kategorien') + '</select>' +
      '<select id="flt_kue" aria-label="Küche">' + optList(S.config.kuechen, f.kueche, 'Alle Küchen') + '</select></div>' +
      '<div class="frow"><select id="flt_auf" aria-label="Aufwand"><option value="">Aller Aufwand</option>' +
      [1, 2, 3].map((n) => '<option value="' + n + '"' + (String(f.aufwand) === String(n) ? ' selected' : '') + '>Aufwand ' + AUFWAND[n] + '</option>').join('') + '</select>' +
      '<select id="flt_sort" aria-label="Sortierung">' +
      [['name', 'Name'], ['ago', 'Länger nicht gekocht'], ['count', 'Häufig gekocht']].map((o) => '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<label class="chk"><input type="checkbox" id="flt_fav"' + (f.fav ? ' checked' : '') + '> Nur Favoriten</label>' +
      '</div><div id="rlist" class="list"></div></div>';
  }

  function recipeListHtml() {
    const f = S.rf;
    if (!S.recipesLoaded) return '<div class="empty">Lade Rezepte …</div>';
    const lm = lastMap();
    const cm = countMap(ymd(addDays(new Date(), -365)));
    const q = lc(f.q);
    const list = S.recipes.filter((r) => matchRecipe(r, q) &&
      (!f.kat || r.kategorie === f.kat) && (!f.kueche || r.kueche === f.kueche) &&
      (!f.aufwand || String(r.aufwand) === String(f.aufwand)) && (!f.fav || r.favorit));
    list.sort((a, b) => {
      if (f.sort === 'ago') return (lm[a.uid] || '').localeCompare(lm[b.uid] || '') || a.name.localeCompare(b.name, 'de');
      if (f.sort === 'count') return (cm[b.uid] || 0) - (cm[a.uid] || 0) || a.name.localeCompare(b.name, 'de');
      return a.name.localeCompare(b.name, 'de');
    });
    if (!list.length) return '<div class="empty">' + (S.recipes.length ? 'Keine Rezepte für diese Auswahl.' : 'Noch keine Rezepte. Tippe oben auf Plus, um das erste anzulegen.') + '</div>';
    return list.map((r) => '<button class="row" data-a="rdetail" data-uid="' + esc(r.uid) + '"><span class="main"><b>' + esc(r.name) + '</b><span class="sub">' +
      esc(agoText(lm[r.uid]) + (r.aufwand ? ' · Aufwand ' + AUFWAND[r.aufwand] : '')) + '</span></span>' +
      (r.favorit ? '<span class="star">' + ic('star', 18) + '</span>' : '') + chip(r.kategorie) + '</button>').join('');
  }
  function updateRecipeList() { const el = $('#rlist'); if (el) el.innerHTML = recipeListHtml(); }

  /* ---------- Ansicht: Auswertung ---------- */
  function bars(items, total) {
    if (!total) return '<p class="note-s">Im Zeitraum wurde noch nichts als gekocht markiert.</p>';
    return '<div class="bars">' + items.map((i) => {
      const pct = Math.round(i.n / total * 100);
      return '<div class="bar"><span>' + esc(i.label) + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span class="pct">' + pct + ' %</span></div>';
    }).join('') + '</div>';
  }

  function viewAuswertung() {
    const days = S.stats.days;
    const today = ymd(new Date());
    const from = ymd(addDays(new Date(), -days));
    const cooked = S.events.filter((e) => e.status === 'gekocht' && e.date >= from && e.date <= today);
    const lm = lastMap();
    const groups = {};
    cooked.forEach((e) => {
      const r = recipeById(e.gericht_uid);
      const key = r ? 'r:' + r.uid : 'n:' + lc(e.summary);
      if (!groups[key]) groups[key] = { name: r ? r.name : e.summary, n: 0, last: '', uid: r ? r.uid : null };
      groups[key].n++;
      if (e.date > groups[key].last) groups[key].last = e.date;
    });
    const rows = Object.keys(groups).map((k) => groups[k]);
    const so = S.stats.sort;
    rows.sort((a, b) => {
      if (so === 'name') return a.name.localeCompare(b.name, 'de');
      if (so === 'last') return b.last.localeCompare(a.last);
      return b.n - a.n || a.name.localeCompare(b.name, 'de');
    });
    const sb = (k, label) => '<button data-a="statsort" data-s="' + k + '" class="' + (so === k ? 'on' : '') + '">' + label + '</button>';

    const table = rows.length
      ? '<div><div class="stat-head">' + sb('name', 'Gericht') + sb('count', 'Anzahl') + sb('last', 'Zuletzt') + '</div><div class="statlist">' +
        rows.map((r) => '<div class="srow"><span class="n">' + esc(r.name) + '</span><span class="c">' + r.n + '×</span><span class="d">' + esc(r.last ? parseYmd(r.last).getDate() + '. ' + MON_S[parseYmd(r.last).getMonth()] + ' ' + parseYmd(r.last).getFullYear() : '') + '</span></div>').join('') +
        '</div></div>'
      : '<div class="list"><div class="empty">Im Zeitraum wurde noch nichts als gekocht markiert.</div></div>';

    const lang = S.recipes.filter((r) => !lm[r.uid] || daysBetween(lm[r.uid], today) > 30)
      .sort((a, b) => (lm[a.uid] || '').localeCompare(lm[b.uid] || '') || a.name.localeCompare(b.name, 'de')).slice(0, 10);
    const langHtml = lang.length
      ? '<div class="list">' + lang.map((r) => '<div class="row"><span class="main"><b>' + esc(r.name) + '</b><span class="sub">' + esc(agoText(lm[r.uid])) + '</span></span>' +
        '<button class="btn soft" data-a="plan" data-uid="' + esc(r.uid) + '" style="min-height:40px">Einplanen</button></div>').join('') + '</div>'
      : '<div class="list"><div class="empty">' + (S.recipes.length ? 'Alle Rezepte wurden in den letzten 30 Tagen gekocht.' : 'Noch keine Rezepte angelegt.') + '</div></div>';

    const katCount = {};
    const aufCount = {};
    let linked = 0;
    cooked.forEach((e) => {
      const r = recipeById(e.gericht_uid);
      const k = r && r.kategorie ? r.kategorie : '';
      katCount[k] = (katCount[k] || 0) + 1;
      if (r && r.aufwand) { aufCount[r.aufwand] = (aufCount[r.aufwand] || 0) + 1; linked++; }
    });
    const katItems = Object.keys(katCount).map((k) => ({ label: k ? catLabel(k) : 'Ohne Kategorie', n: katCount[k] })).sort((a, b) => b.n - a.n);
    const aufItems = [1, 2, 3].filter((n) => aufCount[n]).map((n) => ({ label: AUFWAND[n].charAt(0).toUpperCase() + AUFWAND[n].slice(1), n: aufCount[n] }));

    return '<div class="page">' +
      '<div class="hdr"><div><span class="sub">' + cooked.length + ' Mal gekocht</span><h1 class="title">Auswertung</h1></div></div>' +
      '<select id="st_days" aria-label="Zeitraum">' + [30, 90, 365].map((n) => '<option value="' + n + '"' + (n === days ? ' selected' : '') + '>Letzte ' + n + ' Tage</option>').join('') + '</select>' +
      '<h3 class="h3">Pro Gericht</h3>' + table +
      '<h3 class="h3">Lange nicht gekocht</h3>' + langHtml +
      '<h3 class="h3">Kategorien</h3><div class="card">' + bars(katItems, cooked.length) + '</div>' +
      '<h3 class="h3">Aufwand</h3><div class="card">' + bars(aufItems, linked) + '</div></div>';
  }

  /* ---------- Ansicht: Einstellungen (settings.js) ---------- */
  function viewSettings() { return SET.view(); }

  /* ---------- Termine schreiben ---------- */
  async function writeEvent(o) {
    const t = slotTimes(o.date, slotOf(o.slot));
    const event = { summary: o.name, dtstart: localIso(t[0]), dtend: localIso(t[1]), description: JSON.stringify(o.meta) };
    if (o.uid) await ha.request({ type: 'calendar/event/update', entity_id: S.settings.calendar, uid: o.uid, event: event });
    else await ha.request({ type: 'calendar/event/create', entity_id: S.settings.calendar, event: event });
  }
  async function writeRecipe(o) {
    const desc = JSON.stringify(o.raw);
    if (o.uid) {
      const d = { item: o.uid, description: desc };
      if (o.rename) d.rename = o.name;
      await ha.callService('todo', 'update_item', d, S.settings.todo);
    } else await ha.callService('todo', 'add_item', { item: o.name, description: desc }, S.settings.todo);
  }
  /* Gemeinsame Config in Home Assistant ändern. fn bekommt eine Kopie und liefert false zum Abbrechen. */
  let cfgChain = Promise.resolve();
  function patchConfig(fn, quiet) {
    if (!needOnline()) return Promise.resolve(false);
    cfgChain = cfgChain.then(async () => {
      const c = clone(S.config);
      if (fn(c) === false) return false;
      if (!c.kategorien.length || !c.kuechen.length || !c.einheiten.length) { toast('Mindestens ein Eintrag muss bleiben', true); return false; }
      if (!c.slots.some((x) => x.aktiv)) { toast('Mindestens eine Mahlzeit muss aktiv bleiben', true); return false; }
      const desc = JSON.stringify(c);
      if (S.configUid) await ha.callService('todo', 'update_item', { item: S.configUid, description: desc }, S.settings.config);
      else await ha.callService('todo', 'add_item', { item: 'config', description: desc }, S.settings.config);
      await loadConfig();
      saveSnapshot();
      if (!quiet) toast('Gespeichert');
      return true;
    }).catch((e) => { toast(e.message, true); return false; });
    return cfgChain;
  }
  async function createEntry(o) {
    if (!needOnline()) return false;
    const meta = { v: 1, gericht_uid: o.gericht_uid || null, slot: o.slot, status: o.status || 'geplant', portionen: o.portionen || S.config.standard_portionen, notiz: o.notiz || '' };
    if (o.eingekauft) meta.eingekauft = true;
    await writeEvent({ date: o.date, slot: o.slot, name: o.name, meta: meta });
    await loadEvents();
    render();
    return true;
  }
  async function updateEntry(ev, ch) {
    const date = ch.date || ev.date;
    const slot = ch.slot || ev.slot;
    const meta = Object.assign({}, ev.meta, {
      v: 1, gericht_uid: ch.gericht_uid !== undefined ? ch.gericht_uid : ev.gericht_uid, slot: slot,
      status: ch.status || ev.status,
      portionen: ch.portionen !== undefined ? ch.portionen : ev.portionen,
      notiz: ch.notiz !== undefined ? ch.notiz : ev.notiz,
      eingekauft: ch.eingekauft !== undefined ? !!ch.eingekauft : !!ev.eingekauft
    });
    await writeEvent({ uid: ev.uid, date: date, slot: slot, name: ch.name || entryName(ev), meta: meta });
  }
  async function swipeCook(uid) {
    if (S.busy) return;
    S.busy = true;
    try { await toggleCooked(uid); } finally { S.busy = false; }
  }
  async function removeEntry(ev) {
    if (!needOnline()) return;
    await scheduleDelete({
      uid: ev.uid,
      label: '„' + entryName(ev) + '“',
      run: () => ha.request({ type: 'calendar/event/delete', entity_id: S.settings.calendar, uid: ev.uid }),
      refresh: () => loadEvents(),
      restore: () => { if (!S.events.some((e) => e.uid === ev.uid)) S.events.push(ev); }
    });
    S.events = S.events.filter((e) => e.uid !== ev.uid);
    softRender();
  }
  async function moveEntryTo(ev, date, slot) {
    if (!needOnline() || !date) return;
    slot = slot || ev.slot;
    if (date === ev.date && slot === ev.slot) { toast('Liegt schon dort', true); return; }
    const old = { date: ev.date, slot: ev.slot };
    const dt = parseYmd(date);
    await updateEntry(ev, { date: date, slot: slot });
    await loadEvents();
    closeSheet();
    render();
    const multi = activeSlots().length > 1;
    toast('Verschoben auf ' + dayLabel(date) + ', ' + dt.getDate() + '. ' + MON_S[dt.getMonth()] + (multi ? ', ' + slotOf(slot).label : ''), {
      action: 'Rückgängig',
      onAction: () => run(async () => {
        const e2 = S.events.find((x) => x.uid === ev.uid);
        if (!e2 || !needOnline()) return;
        await updateEntry(e2, old);
        await loadEvents();
        render();
      })
    });
  }

  function activeSlots() {
    const a = S.config.slots.filter((s) => s.aktiv);
    return a.length ? a : S.config.slots.slice(0, 1);
  }

  function openMove(uid) {
    const ev = S.events.find((e) => e.uid === uid);
    if (!ev) return;
    S.sheet = { type: 'move', uid: uid };
    const slots = activeSlots();
    const multi = slots.length > 1;
    const rows = [];
    // Die nächsten Tage. Bei mehreren Mahlzeiten steht je Tag ein Knopf pro Mahlzeit, so geht auch Mittag nach Abend am selben Tag.
    for (let i = 0; rows.length < 5 && i < 30; i++) {
      const d = ymd(addDays(startOfToday(), i));
      if (d === ev.date && !multi) continue;
      const dt = parseYmd(d);
      const text = '<span class="menu-text"><span class="menu-title">' + esc(dayLabel(d)) + '</span><span class="menu-summary">' +
        esc((dayLabel(d) === WD_LONG[dt.getDay()] ? '' : WD_LONG[dt.getDay()] + ', ') + dt.getDate() + '. ' + MON[dt.getMonth()]) + '</span></span>';
      const taken = (sl) => S.events.some((x) => x.uid !== ev.uid && x.date === d && x.slot === sl);
      if (!multi) {
        const tk = taken(ev.slot);
        rows.push('<button class="menu-row press' + (tk ? ' taken' : '') + '" type="button" data-a="moveto" data-uid="' + esc(uid) + '" data-d="' + d + '">' + text + (tk ? '<span class="takenbadge">Belegt</span>' : '') + '</button>');
      } else {
        rows.push('<div class="menu-row move-row">' + text + '<span class="move-slots">' + slots.map((sl) => {
          const here = d === ev.date && sl.key === ev.slot;
          const tk = !here && taken(sl.key);
          return '<button class="mvslot press' + (tk ? ' taken' : '') + '" type="button" data-a="moveto" data-uid="' + esc(uid) + '" data-d="' + d + '" data-slot="' + esc(sl.key) + '"' + (here ? ' disabled aria-current="true"' : '') + '>' + esc(sl.label) + (tk ? '<small>belegt</small>' : '') + '</button>';
        }).join('') + '</span></div>');
      }
    }
    showSheet('„' + entryName(ev) + '“ verschieben',
      '<div class="menu-group" style="margin:0">' + rows.join('') + '</div>' +
      '<div class="' + (multi ? 'grid2' : '') + '"><div class="field"><label for="mv_date">Anderes Datum</label><input type="date" id="mv_date" value="' + ev.date + '"></div>' +
      (multi ? '<div class="field"><label for="mv_slot">Mahlzeit</label><select id="mv_slot">' + slots.map((sl) => '<option value="' + esc(sl.key) + '"' + (sl.key === ev.slot ? ' selected' : '') + '>' + esc(sl.label) + '</option>').join('') + '</select></div>' : '') + '</div>' +
      '<div class="actions move-actions"><button class="btn press" type="button" data-a="moveablage" data-uid="' + esc(uid) + '">Ohne Tag (Ablage)</button>' +
      '<button class="btn press" type="button" data-a="moveother" data-uid="' + esc(uid) + '">Dorthin verschieben</button></div>');
  }

  async function toggleBought(uid) {
    const ev = S.events.find((e) => e.uid === uid);
    if (!ev || !needOnline()) return;
    const next = !ev.eingekauft;
    ev.eingekauft = next;
    render();
    try {
      await updateEntry(ev, { eingekauft: next });
      await loadEvents();
      render();
      toast(next ? 'Als eingekauft markiert' : 'Nicht mehr als eingekauft markiert');
    } catch (e) {
      ev.eingekauft = !next;
      toast(e.message, true);
      render();
    }
  }
  async function toggleCooked(uid) {
    const ev = S.events.find((e) => e.uid === uid);
    if (!ev || !needOnline()) return;
    const prev = ev.status;
    const next = prev === 'gekocht' ? 'geplant' : 'gekocht';
    ev.status = next;
    render();
    try {
      await updateEntry(ev, { status: next });
      await loadEvents();
      render();
      toast(next === 'gekocht' ? 'Als gekocht markiert' : 'Wieder auf geplant gesetzt', {
        action: 'Rückgängig',
        onAction: () => { if (!S.busy) { S.busy = true; toggleCooked(uid).then(() => { S.busy = false; }); } }
      });
    } catch (e) {
      ev.status = prev;
      toast(e.message, true);
      try { await loadEvents(); } catch (e2) { /* ignorieren */ }
      render();
    }
  }

  /* Portionen: Knöpfe 1 bis 4 und dahinter ein kleines Feld für andere Zahlen */
  function portionsHtml(id, value) {
    const v = +value || 0;
    return '<div class="portions" id="' + id + '" data-value="' + (v || '') + '"><span class="plabel">Portionen</span>' +
      [1, 2, 3, 4].map((n) => '<button type="button" class="pbtn" data-a="portion" data-n="' + n + '" aria-pressed="' + (v === n) + '">' + n + '</button>').join('') +
      '<input class="pfree" type="number" inputmode="numeric" min="1" max="99" placeholder="…" aria-label="Andere Anzahl Portionen" value="' + (v > 4 ? v : '') + '"></div>';
  }
  function portionsValue(id) {
    const el = document.getElementById(id);
    const n = el ? parseInt(el.dataset.value, 10) : NaN;
    return n >= 1 ? n : null;
  }

  /* ---------- Sheet: Gericht wählen (Suche und freier Eintrag in einem Feld) ---------- */
  /* ---------- Ablage: Gerichte ohne festen Tag ---------- */
  const ablage = () => (Array.isArray(S.config.ablage) ? S.config.ablage : []);
  const ablageName = (a) => { const r = recipeById(a.gericht_uid); return r ? r.name : (a.name || ''); };
  function ablageAdd(o) {
    const item = { id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), name: o.name, gericht_uid: o.gericht_uid || null, portionen: o.portionen || S.config.standard_portionen, eingekauft: o.eingekauft !== false };
    if (o.notiz) item.notiz = o.notiz;
    return patchConfig((c) => { if (!Array.isArray(c.ablage)) c.ablage = []; c.ablage.push(item); }, true);
  }
  const ablageRemove = (id) => patchConfig((c) => { c.ablage = (c.ablage || []).filter((a) => a.id !== id); }, true);
  /* Gericht aus der Ablage einem Tag zuordnen: Termin anlegen, dann aus der Ablage nehmen */
  async function ablageAssign(id, date, slot) {
    const a = ablage().find((x) => x.id === id);
    if (!a || !needOnline() || !date) return;
    const ok = await createEntry({ date: date, slot: slot, name: ablageName(a), gericht_uid: a.gericht_uid, portionen: a.portionen, status: 'geplant', eingekauft: a.eingekauft, notiz: a.notiz });
    if (!ok) return;
    await ablageRemove(id);
    closeSheet();
    render();
    const dt = parseYmd(date);
    toast(ablageName(a) + ': ' + dayLabel(date) + ', ' + dt.getDate() + '. ' + MON_S[dt.getMonth()] + (activeSlots().length > 1 ? ', ' + slotOf(slot).label : ''));
  }
  /* Tagesauswahl für ein Gericht aus der Ablage */
  function openAssign(id) {
    const a = ablage().find((x) => x.id === id);
    if (!a) return;
    S.sheet = { type: 'assign', id: id };
    const slots = activeSlots();
    const multi = slots.length > 1;
    const rows = [];
    for (let i = 0; i < 5; i++) {
      const d = ymd(addDays(startOfToday(), i));
      const dt = parseYmd(d);
      const text = '<span class="menu-text"><span class="menu-title">' + esc(dayLabel(d)) + '</span><span class="menu-summary">' +
        esc((dayLabel(d) === WD_LONG[dt.getDay()] ? '' : WD_LONG[dt.getDay()] + ', ') + dt.getDate() + '. ' + MON[dt.getMonth()]) + '</span></span>';
      const taken = (k) => S.events.some((x) => x.date === d && x.slot === k);
      if (!multi) {
        const tk = taken(slots[0].key);
        rows.push('<button class="menu-row press' + (tk ? ' taken' : '') + '" type="button" data-a="abto" data-id="' + esc(id) + '" data-d="' + d + '" data-slot="' + esc(slots[0].key) + '">' + text + (tk ? '<span class="takenbadge">Belegt</span>' : '') + '</button>');
      } else rows.push('<div class="menu-row move-row">' + text + '<span class="move-slots">' + slots.map((sl) => {
        const tk = taken(sl.key);
        return '<button class="mvslot press' + (tk ? ' taken' : '') + '" type="button" data-a="abto" data-id="' + esc(id) + '" data-d="' + d + '" data-slot="' + esc(sl.key) + '">' + esc(sl.label) + (tk ? '<small>belegt</small>' : '') + '</button>';
      }).join('') + '</span></div>');
    }
    showSheet('„' + ablageName(a) + '“ einplanen',
      '<div class="menu-group" style="margin:0">' + rows.join('') + '</div>' +
      '<div class="' + (multi ? 'grid2' : '') + '"><div class="field"><label for="ab_date">Anderes Datum</label><input type="date" id="ab_date" value="' + ymd(new Date()) + '"></div>' +
      (multi ? '<div class="field"><label for="ab_slot">Mahlzeit</label><select id="ab_slot">' + slots.map((sl) => '<option value="' + esc(sl.key) + '">' + esc(sl.label) + '</option>').join('') + '</select></div>' : '') + '</div>' +
      '<div class="actions move-actions"><button class="btn danger press" type="button" data-a="abdel" data-id="' + esc(id) + '">Aus der Ablage entfernen</button>' +
      '<button class="btn press" type="button" data-a="abother" data-id="' + esc(id) + '">Auf dieses Datum</button></div>');
  }
  /* Leiste im Wochenplan: Gerichte ohne Tag als Chips */
  function ablageStrip() {
    const list = ablage();
    if (!list.length) return '<div class="abl empty"><span class="abl-lbl">Ablage ohne Tag</span><button type="button" class="abl-chip add press" data-a="abadd" aria-label="Gericht ohne Tag hinzufügen">' + ic('plus', 16) + 'Hinzufügen</button></div>';
    const allBought = list.every((a) => a.eingekauft);
    return '<div class="abl"><div class="abl-lbl"><span>' + (allBought ? 'Eingekauft, noch ohne Tag' : 'Noch ohne Tag') + '</span><b>' + list.length + '</b></div>' +
      '<div class="abl-strip">' + list.map((a) => '<button type="button" class="abl-chip press" data-a="abopen" data-id="' + esc(a.id) + '" aria-label="' + esc(ablageName(a)) + ' einem Tag zuordnen"><i class="' + (a.eingekauft ? 'on' : '') + '">' + ic('bag', 16) + '</i>' + esc(ablageName(a)) + '</button>').join('') +
      '<button type="button" class="abl-chip add press" data-a="abadd" aria-label="Gericht ohne Tag hinzufügen">' + ic('plus', 16) + '</button></div></div>';
  }

  function openPicker(date, slot, toAblage) {
    S.sheet = { type: 'picker', date: date, slot: slot, ablage: !!toAblage };
    const d = parseYmd(date);
    showSheet(toAblage ? 'Gericht ohne Tag' : WD[d.getDay()] + ' ' + d.getDate() + '. ' + MON_S[d.getMonth()] + ' · ' + slotOf(slot).label,
      '<input id="pq" type="search" placeholder="Gericht suchen oder neu eintippen" autocomplete="off" enterkeyhint="done">' +
      portionsHtml('pp', S.config.standard_portionen) +
      (toAblage ? '<p class="note-s">Das Gericht kommt als eingekauft in die Ablage. Den Tag wählst du später.</p>' :
        '<label class="chk"><input type="checkbox" id="pcooked"> Direkt als gekocht eintragen</label>' +
        '<label class="chk"><input type="checkbox" id="pablage"> Eingekauft, Tag später wählen</label>') +
      '<div id="plist" class="list"></div>');
    updatePicker();
    const q = $('#pq');
    if (q) q.focus();
  }
  /* Vorschläge für einen Tag: schon mal gekocht, aber lange her, passend zur Woche.
     Montag bis Donnerstag nur einfache Gerichte (Aufwand 1). */
  function suggestFor(date, opt) {
    opt = opt || {};
    const virt = opt.virt || [];
    const avoid = opt.avoid || {};
    const d = parseYmd(date);
    const wd = d.getDay();
    const simpleOnly = wd >= 1 && wd <= 4;
    const ws = addDays(d, -((wd + 6) % 7));
    const wsY = ymd(ws);
    const weY = ymd(addDays(ws, 6));
    const near = {};
    const cat = {};
    S.events.concat(virt).forEach((e) => {
      if (!e.gericht_uid) return;
      if (Math.abs(daysBetween(e.date, date)) <= 6) near[e.gericht_uid] = true;
      if ((e.date >= wsY && e.date <= weY) || Math.abs(daysBetween(e.date, date)) <= 4) {
        const r = recipeById(e.gericht_uid);
        if (r && r.kategorie) cat[r.kategorie] = (cat[r.kategorie] || 0) + 1;
      }
    });
    const lm = lastMap();
    const fleisch = cat.fleisch || 0;
    return S.recipes
      .filter((r) => !near[r.uid] && !avoid[r.uid] && (!simpleOnly || +r.aufwand === 1))
      .map((r) => {
        const last = lm[r.uid];
        const days = last ? daysBetween(last, date) : null;
        let sc = last ? Math.min(days, 180) : 15;
        if (last && days < 14) sc -= 100;
        const c = cat[r.kategorie] || 0;
        if (r.kategorie === 'fleisch') sc -= c >= 2 ? 80 : c * 20;
        else if (r.kategorie === 'fisch') sc -= c * 60;
        else if (r.kategorie === 'vegetarisch' || r.kategorie === 'vegan') sc += fleisch >= 2 ? 30 : 0;
        else sc -= c * 15;
        return { r: r, sc: sc };
      })
      .filter((x) => x.sc > -40)
      .sort((a, b) => b.sc - a.sc || a.r.name.localeCompare(b.r.name, 'de'))
      .reduce((out, x, i, all) => {
        // Abwechslung: jede weitere Wahl derselben Kategorie zählt weniger
        if (out.length >= 3 || i > 0) return out;
        const pool = all.slice();
        while (out.length < 3 && pool.length) {
          let best = 0;
          let bestSc = -Infinity;
          pool.forEach((y, j) => {
            const same = out.filter((o) => o.kategorie === y.r.kategorie).length;
            const v = y.sc - same * 45;
            if (v > bestSc) { bestSc = v; best = j; }
          });
          out.push(pool.splice(best, 1)[0].r);
        }
        return out;
      }, []);
  }

  /* ---------- Woche füllen (nur Abend, mit Vorschau und Rückgängig) ---------- */
  function fillSlot() {
    const sl = activeSlots();
    const ab = sl.find((x) => x.key === 'abend');
    return (ab || sl[sl.length - 1] || { key: 'abend' }).key;
  }
  function fillVirt(plan, skip) {
    return plan.filter((p, i) => i !== skip && p.gericht_uid).map((p) => ({ date: p.date, gericht_uid: p.gericht_uid }));
  }
  function buildFill() {
    const slot = fillSlot();
    const t = ymd(new Date());
    const free = visibleDays().filter((d) => d >= t && !eventsOn(d, slot).length);
    const plan = [];
    const abl = ablage().slice();
    free.forEach((d) => {
      if (abl.length) {
        const a = abl.shift();
        plan.push({ date: d, name: ablageName(a), gericht_uid: a.gericht_uid || null, ablageId: a.id, a: a });
        return;
      }
      const r = suggestFor(d, { virt: fillVirt(plan, -1) })[0];
      if (r) plan.push({ date: d, name: r.name, gericht_uid: r.uid, tried: [r.uid] });
    });
    return { slot: slot, plan: plan, free: free.length };
  }
  function openFill() {
    if (!needOnline()) return;
    const f = buildFill();
    if (!f.free) { toast('Alle Abende sind schon geplant'); return; }
    S.sheet = { type: 'fill', slot: f.slot, plan: f.plan };
    renderFill();
  }
  function renderFill() {
    const sh = S.sheet;
    const keep = document.querySelector('.sheet-b');
    const top = keep ? keep.scrollTop : 0;
    const multi = activeSlots().length > 1;
    const rows = sh.plan.map((p, i) => {
      const r = recipeById(p.gericht_uid);
      const dt = parseYmd(p.date);
      return '<div class="fillrow"><span class="fd"><b>' + esc(dayLabel(p.date)) + '</b><small>' + dt.getDate() + '. ' + MON_S[dt.getMonth()] + '</small></span>' +
        '<span class="fn"><b>' + esc(p.name) + (p.ablageId ? '<span class="ablbadge">eingekauft</span>' : '') + '</b><small>' + esc(r ? (catLabel(r.kategorie) + (r.aufwand ? ' · ' + AUFWAND[r.aufwand] : '')) : 'ohne Rezept') + '</small></span>' +
        (p.ablageId ? '' : '<button class="iconbtn plain" type="button" data-a="fillroll" data-i="' + i + '" aria-label="Anderes Gericht">' + ic('spark', 22) + '</button>') +
        '<button class="iconbtn plain" type="button" data-a="filldrop" data-i="' + i + '" aria-label="Tag auslassen">' + ic('close', 18) + '</button></div>';
    }).join('');
    showSheet('Woche füllen',
      '<p class="set-note" style="margin:0 4px 8px">Vorschlag für ' + (multi ? 'die freien ' + esc(slotOf(sh.slot).label) + '-Plätze' : 'die freien Tage') + '. Würfeln tauscht ein Gericht, das Kreuz lässt den Tag leer.</p>' +
      (rows ? '<div class="list fill-list">' + rows + '</div>' : '<p class="empty">Alles ausgelassen oder keine passenden Gerichte.</p>') +
      '<div class="actions move-actions"><button class="btn primary press" type="button" data-a="fillok"' + (sh.plan.length ? '' : ' disabled') + '>Übernehmen (' + sh.plan.length + ')</button></div>');
    const nb = document.querySelector('.sheet-b');
    if (nb) nb.scrollTop = top;
  }
  async function applyFill() {
    const sh = S.sheet;
    if (!sh || sh.type !== 'fill' || !sh.plan.length || !needOnline()) return;
    const runId = 'f' + Date.now().toString(36);
    const plan = sh.plan.slice();
    let n = 0;
    for (const p of plan) {
      const meta = { v: 1, gericht_uid: p.gericht_uid || null, slot: sh.slot, status: 'geplant', portionen: (p.a && p.a.portionen) || S.config.standard_portionen, notiz: (p.a && p.a.notiz) || '', auto: runId };
      if (p.ablageId && p.a.eingekauft) meta.eingekauft = true;
      await writeEvent({ date: p.date, slot: sh.slot, name: p.name, meta: meta });
      n++;
    }
    const ids = plan.filter((p) => p.ablageId).map((p) => p.ablageId);
    if (ids.length) await patchConfig((c) => { c.ablage = (c.ablage || []).filter((a) => ids.indexOf(a.id) < 0); }, true);
    await loadEvents();
    closeSheet();
    render();
    toast(n + (n === 1 ? ' Abend geplant' : ' Abende geplant'), { action: 'Alles rückgängig', duration: 15000, onAction: () => run(() => undoFill(runId, plan)) });
  }
  async function undoFill(runId, plan) {
    if (!needOnline()) return;
    const mine = S.events.filter((e) => e.meta && e.meta.auto === runId);
    for (const e of mine) await ha.request({ type: 'calendar/event/delete', entity_id: S.settings.calendar, uid: e.uid });
    const back = plan.filter((p) => p.ablageId).map((p) => p.a);
    if (back.length) await patchConfig((c) => { if (!Array.isArray(c.ablage)) c.ablage = []; back.forEach((a) => { if (!c.ablage.some((x) => x.id === a.id)) c.ablage.push(a); }); }, true);
    await loadEvents();
    render();
    toast('Rückgängig gemacht: ' + mine.length + (mine.length === 1 ? ' Eintrag' : ' Einträge'));
  }
  function updatePicker() {
    const sh = S.sheet;
    if (!sh || sh.type !== 'picker') return;
    const raw = $('#pq') ? $('#pq').value : '';
    const text = raw.trim();
    const lm = lastMap();
    const list = S.recipes.filter((r) => matchRecipe(r, lc(raw))).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const exact = text && S.recipes.some((r) => lc(r.name) === lc(text));
    let html = '';
    if (text && !exact) {
      html += '<button class="row free-row" type="button" data-a="pickfree"><span class="main"><b>„' + esc(text) + '“ eintragen</b><span class="sub">Als freien Eintrag ohne Rezept</span></span>' + ic('plus', 18) + '</button>';
    }
    const row = (r, sug) => '<button class="row' + (sug ? ' sug-row' : '') + '" type="button" data-a="pickrecipe" data-uid="' + esc(r.uid) + '"><span class="main"><b>' + esc(r.name) + (sug ? '<span class="sugbadge">Vorschlag</span>' : '') + '</b><span class="sub">' + esc(agoText(lm[r.uid])) + (r.aufwand ? ' · ' + AUFWAND[r.aufwand] : '') + '</span></span>' + chip(r.kategorie) + '</button>';
    // Ohne Suchtext stehen oben drei Vorschläge, der Rest folgt alphabetisch
    // Gerichte aus der Ablage stehen ganz oben (nicht, wenn gerade etwas in die Ablage gelegt wird)
    const abl = sh.ablage ? [] : ablage().filter((a) => !text || lc(ablageName(a)).indexOf(text) >= 0);
    if (abl.length) {
      html += '<div class="plist-sec">Eingekauft, noch ohne Tag</div>' + abl.map((a) => {
        const r = recipeById(a.gericht_uid);
        return '<button class="row abl-row" type="button" data-a="pickablage" data-id="' + esc(a.id) + '"><span class="main"><b>' + esc(ablageName(a)) + '<span class="ablbadge">' + (a.eingekauft ? 'eingekauft' : 'ohne Tag') + '</span></b><span class="sub">noch ohne Tag</span></span>' + (r ? chip(r.kategorie) : '') + '</button>';
      }).join('') + (text ? '' : '<div class="plist-sec">Vorschläge und alle Gerichte</div>');
    }
    const sugs = text || sh.ablage ? [] : suggestFor(sh.date);
    const sugIds = sugs.map((r) => r.uid);
    html += sugs.map((r) => row(r, true)).join('');
    html += list.filter((r) => sugIds.indexOf(r.uid) < 0).map((r) => row(r, false)).join('');
    if (!html) html = '<div class="empty">Noch keine Rezepte. Tippe einen Namen ein, um frei einzutragen.</div>';
    $('#plist').innerHTML = html;
  }
  function refreshSheetLists() { if (S.sheet && S.sheet.type === 'picker') updatePicker(); }

  /* ---------- Sheet: Einplanen aus Rezept ---------- */
  function openPlan(uid) {
    const r = recipeById(uid);
    if (!r) return;
    S.sheet = { type: 'plan', uid: uid };
    showSheet('Einplanen: ' + r.name,
      '<div class="grid2"><div class="field"><label for="p_date">Datum</label><input type="date" id="p_date" value="' + ymd(new Date()) + '"></div>' +
      '<div class="field"><label for="p_slot">Mahlzeit</label><select id="p_slot">' + S.config.slots.map((s) => '<option value="' + esc(s.key) + '"' + (s.key === firstActiveSlot() ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') + '</select></div></div>' +
      portionsHtml('pp', S.config.standard_portionen) +
      '<label class="chk"><input type="checkbox" id="p_cooked"> Direkt als gekocht eintragen</label>' +
      '<button class="btn primary wide" data-a="planok" data-uid="' + esc(uid) + '">Einplanen</button>');
  }

  /* ---------- Sheet: Eintrag bearbeiten ---------- */
  function openEntry(uid) {
    const ev = S.events.find((e) => e.uid === uid);
    if (!ev) return;
    S.sheet = { type: 'entry', uid: uid };
    const r = recipeById(ev.gericht_uid);
    showSheet(entryName(ev),
      (r ? '' : '<div class="field"><label for="e_name">Name</label><input type="text" id="e_name" maxlength="120" autocomplete="off" value="' + esc(entryName(ev)) + '"></div>') +
      '<div class="grid2"><div class="field"><label for="e_date">Datum</label><input type="date" id="e_date" value="' + ev.date + '"></div>' +
      '<div class="field"><label for="e_slot">Mahlzeit</label><select id="e_slot">' + S.config.slots.map((s) => '<option value="' + esc(s.key) + '"' + (s.key === ev.slot ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') + '</select></div></div>' +
      portionsHtml('ep', ev.portionen) +
      '<div class="field"><label for="e_note">Notiz</label><textarea id="e_note">' + esc(ev.notiz) + '</textarea></div>' +
      '<button class="btn primary wide" data-a="entrysave" data-uid="' + esc(uid) + '">Speichern</button>' +
      '<button class="btn wide" data-a="entrycook" data-uid="' + esc(uid) + '">' + (ev.status === 'gekocht' ? 'Wieder auf geplant setzen' : 'Als gekocht markieren') + '</button>' +
      (r ? '<button class="btn wide" data-a="rdetail" data-uid="' + esc(r.uid) + '">Rezept anzeigen</button>' : '<button class="btn wide" data-a="entrytorecipe" data-uid="' + esc(uid) + '">' + ic('plus', 18) + 'Zu Gericht machen</button>') +
      '<button class="btn danger wide" data-a="entrydel" data-uid="' + esc(uid) + '">' + ic('trash', 18) + 'Eintrag löschen</button>');
  }

  /* ---------- Sheet: Rezept ansehen ---------- */
  function openRecipeDetail(uid) {
    const r = recipeById(uid);
    if (!r) return;
    S.sheet = { type: 'rdetail', uid: uid };
    const lm = lastMap();
    const meta = [];
    if (r.kategorie) meta.push(chip(r.kategorie));
    if (r.kueche) meta.push('<span>' + esc(kuecheLabel(r.kueche)) + '</span>');
    if (r.aufwand) meta.push('<span>Aufwand ' + AUFWAND[r.aufwand] + '</span>');
    if (r.dauer) meta.push('<span>' + r.dauer + ' min</span>');
    if (r.portionen) meta.push('<span>' + r.portionen + ' Portionen</span>');
    if (r.bewertung) meta.push('<span>' + r.bewertung + ' von 5 Sternen</span>');
    showSheet(r.name,
      '<div class="detail-meta">' + meta.join('') + '</div>' +
      '<p class="note-s">' + esc(agoText(lm[r.uid])) + '</p>' +
      (r.zutaten.length ? '<div class="ing">' + r.zutaten.map((z) => '<div><span>' + esc(z.name) + (z.optional ? ' (optional)' : '') + '</span><span class="q">' + esc(+z.menge > 0 ? (fmtNum(+z.menge) + ' ' + unitLabel(z.einheit)).trim() : '') + '</span></div>').join('') + '</div>' : '<p class="note-s">Keine Zutaten hinterlegt.</p>') +
      (r.tags.length ? '<p class="note-s">Tags: ' + esc(r.tags.join(', ')) + '</p>' : '') +
      (r.notiz ? '<p>' + esc(r.notiz) + '</p>' : '') +
      (r.url ? (safeUrl(r.url) ? '<p><a href="' + esc(r.url.trim()) + '" target="_blank" rel="noopener noreferrer">Rezept öffnen</a></p>' : '<p class="note-s">Link (nicht geöffnet, da kein http/https): ' + esc(r.url) + '</p>') : '') +
      '<button class="btn primary wide" data-a="plan" data-uid="' + esc(uid) + '">Einplanen</button>' +
      '<button class="btn wide" data-a="editrecipe" data-uid="' + esc(uid) + '">Bearbeiten</button>');
  }

  /* ---------- Sheet: Rezept anlegen/bearbeiten ---------- */
  function unitOptions(sel) {
    const list = S.config.einheiten.slice();
    if (sel && list.indexOf(sel) < 0) list.push(sel);
    return '<option value=""></option>' + list.map((u) => '<option value="' + esc(u) + '"' + (u === sel ? ' selected' : '') + '>' + esc(unitLabel(u)) + '</option>').join('');
  }
  function zutatenHtml() {
    const z = S.sheet.zutaten;
    if (!z.length) return '<p class="note-s">Noch keine Zutaten.</p>';
    return z.map((x, i) =>
      '<div class="zblock" data-i="' + i + '"><div class="zrow"><input type="text" class="zn" placeholder="Zutat" value="' + esc(x.name) + '" aria-label="Zutat">' +
      '<input type="text" inputmode="decimal" class="zm" placeholder="Menge" value="' + esc(+x.menge > 0 ? String(x.menge).replace('.', ',') : '') + '" aria-label="Menge">' +
      '<select class="zu" aria-label="Einheit">' + unitOptions(x.einheit) + '</select></div>' +
      '<div class="zline"><label class="chk"><input type="checkbox" class="zo"' + (x.optional ? ' checked' : '') + '> optional</label><span>' +
      '<button class="mini" data-a="zup" data-i="' + i + '" aria-label="Nach oben"' + (i === 0 ? ' disabled' : '') + '>' + ic('up', 18) + '</button> ' +
      '<button class="mini" data-a="zdown" data-i="' + i + '" aria-label="Nach unten"' + (i === z.length - 1 ? ' disabled' : '') + '>' + ic('down', 18) + '</button> ' +
      '<button class="mini" data-a="zdel" data-i="' + i + '" aria-label="Zutat entfernen">' + ic('trash', 18) + '</button></span></div></div>').join('');
  }
  function readZutaten() {
    return Array.prototype.map.call(document.querySelectorAll('#zlist .zblock'), (b) => {
      const m = parseFloat(String($('.zm', b).value).replace(',', '.'));
      const z = { name: $('.zn', b).value.trim(), menge: isNaN(m) ? 0 : m, einheit: $('.zu', b).value };
      if ($('.zo', b).checked) z.optional = true;
      return z;
    });
  }
  function openRecipeForm(uid, pre) {
    const r = uid ? recipeById(uid) : null;
    const v = r || Object.assign({ name: '', kategorie: '', kueche: '', aufwand: 2, portionen: S.config.standard_portionen, dauer: 0, zutaten: [], tags: [], bewertung: 0, favorit: false, notiz: '', url: '', raw: {}, desc: '' }, pre || {});
    S.sheet = { type: 'rform', uid: uid || null, linkKey: (pre && pre.linkKey) || null, baseRaw: r && !r.legacy ? clone(r.raw) : {}, baseDesc: r ? r.desc : '', zutaten: clone(v.zutaten) };
    showSheet(r ? 'Rezept bearbeiten' : (pre && pre.linkKey ? 'Als Gericht speichern' : 'Neues Rezept'),
      (r && r.legacy ? '<p class="note-s">Dieser Eintrag hat noch kein Rezeptformat. Der vorhandene Text steht unter Notiz und wird beim Speichern ins Format übernommen.</p>' : '') +
      '<div class="field"><label for="f_name">Name</label><input type="text" id="f_name" maxlength="80" value="' + esc(v.name) + '"></div>' +
      '<div class="grid2"><div class="field"><label for="f_kat">Kategorie</label><select id="f_kat"><option value=""></option>' + optList(S.config.kategorien, v.kategorie, '') + '</select></div>' +
      '<div class="field"><label for="f_kue">Küche</label><select id="f_kue"><option value=""></option>' + optList(S.config.kuechen, v.kueche, '') + '</select></div></div>' +
      '<div class="grid3"><div class="field"><label for="f_auf">Aufwand</label><select id="f_auf"><option value="">keine Angabe</option>' + [1, 2, 3].map((n) => '<option value="' + n + '"' + (v.aufwand === n ? ' selected' : '') + '>' + AUFWAND[n] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="f_port">Portionen</label><input type="number" id="f_port" min="1" max="30" value="' + (v.portionen || '') + '"></div>' +
      '<div class="field"><label for="f_dauer">Minuten</label><input type="number" id="f_dauer" min="0" max="600" value="' + (v.dauer || '') + '"></div></div>' +
      '<span class="lbl">Zutaten</span><div id="zlist" style="display:flex;flex-direction:column;gap:8px">' + zutatenHtml() + '</div>' +
      '<button class="btn wide" data-a="zadd">' + ic('plus', 18) + 'Zutat hinzufügen</button>' +
      '<div class="grid2"><div class="field"><label for="f_bew">Bewertung</label><select id="f_bew">' + [0, 1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (v.bewertung === n ? ' selected' : '') + '>' + (n ? n + ' von 5' : 'nicht bewertet') + '</option>').join('') + '</select></div>' +
      '<label class="chk" style="align-self:end"><input type="checkbox" id="f_fav"' + (v.favorit ? ' checked' : '') + '> Favorit</label></div>' +
      '<div class="field"><label for="f_tags">Tags (mit Komma getrennt)</label><input type="text" id="f_tags" value="' + esc(v.tags.join(', ')) + '"></div>' +
      '<div class="field"><label for="f_url">Link zum Rezept</label><input type="url" id="f_url" value="' + esc(v.url) + '" autocapitalize="off"></div>' +
      '<div class="field"><label for="f_note">Notiz</label><textarea id="f_note">' + esc(v.notiz) + '</textarea></div>' +
      '<button class="btn primary wide" data-a="saverecipe">Speichern</button>' +
      (r ? '<button class="btn danger wide" data-a="delrecipe">' + ic('trash', 18) + 'Rezept löschen</button>' : ''));
  }
  async function reloadRecipes() {
    const r = await ha.request({ type: 'todo/item/list', entity_id: S.settings.todo });
    S.rawRecipes = r.items || [];
    S.recipes = S.rawRecipes.map(parseRecipe).filter((x) => !isPendingDel(x.uid));
    S.recipesLoaded = true;
    saveSnapshot();
  }
  async function saveRecipe() {
    if (!needOnline()) return;
    const sh = S.sheet;
    const name = $('#f_name').value.trim();
    if (!name) { toast('Bitte einen Namen eingeben', true); return; }
    const dup = S.recipes.find((r) => lc(r.name) === lc(name) && r.uid !== sh.uid);
    if (dup && !sh.uid && sh.linkKey) {
      // Gibt es das Gericht schon (z. B. nach einem Abbruch), wird stattdessen damit verknüpft
      if (!confirm('„' + dup.name + '“ gibt es schon. Die freien Einträge damit verknüpfen?')) return;
      const n = await linkGroup(sh.linkKey, dup);
      closeSheet(); render();
      toast(n + (n === 1 ? ' Eintrag' : ' Einträge') + ' mit „' + dup.name + '“ verknüpft');
      return;
    }
    if (dup) { toast('Ein Rezept mit diesem Namen gibt es schon', true); return; }
    const url = $('#f_url').value.trim();
    if (url && !safeUrl(url)) { toast('Der Link muss mit http:// oder https:// beginnen', true); return; }
    if (sh.uid) {
      const cur = recipeById(sh.uid);
      if (cur && cur.desc !== sh.baseDesc && !confirm('Dieses Rezept wurde inzwischen geändert. Trotzdem überschreiben?')) return;
    }
    const raw = Object.assign({}, sh.baseRaw, {
      v: 1,
      kategorie: $('#f_kat').value,
      kueche: $('#f_kue').value,
      aufwand: +$('#f_auf').value || 0,
      portionen: +$('#f_port').value || S.config.standard_portionen,
      dauer_min: +$('#f_dauer').value || 0,
      zutaten: readZutaten().filter((z) => z.name),
      tags: $('#f_tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      bewertung: +$('#f_bew').value || 0,
      favorit: $('#f_fav').checked,
      notiz: $('#f_note').value.trim(),
      rezept_url: url,
      erstellt: sh.baseRaw.erstellt || ymd(new Date())
    });
    const desc = JSON.stringify(raw);
    if (sh.uid) {
      const old = recipeById(sh.uid);
      const data = { item: sh.uid, description: desc };
      if (old && old.name !== name) data.rename = name;
      await ha.callService('todo', 'update_item', data, S.settings.todo);
    } else {
      await ha.callService('todo', 'add_item', { item: name, description: desc }, S.settings.todo);
    }
    await reloadRecipes();
    let linked = 0;
    if (!sh.uid && sh.linkKey) {
      const nr = S.recipes.find((x) => lc(x.name) === lc(name));
      if (nr) linked = await linkGroup(sh.linkKey, nr);
    }
    closeSheet();
    render();
    toast(!sh.uid && sh.linkKey ? 'Gericht angelegt, ' + linked + (linked === 1 ? ' Eintrag verknüpft' : ' Einträge verknüpft') : 'Rezept gespeichert');
  }

  /* ---------- Sheet: Einkaufsliste ---------- */
  function roundAmt(x, unit) {
    if (unit === 'g' || unit === 'ml') return Math.round(x);
    if (unit === 'stk') return Math.ceil(x - 1e-9);
    return Math.round(x * 10) / 10;
  }
  function aggregate(evs) {
    const map = {};
    evs.forEach((ev) => {
      const r = recipeById(ev.gericht_uid);
      if (!r) return;
      const f = ev.portionen > 0 && r.portionen > 0 ? ev.portionen / r.portionen : 1;
      r.zutaten.forEach((z) => {
        const unit = lc(z.einheit);
        const key = lc(z.name) + '|' + unit;
        if (!map[key]) map[key] = { name: String(z.name).trim(), unit: unit, amount: 0, optional: true, hasAmount: false };
        const a = map[key];
        if (+z.menge > 0) { a.amount += +z.menge * f; a.hasAmount = true; }
        if (!z.optional) a.optional = false;
      });
    });
    return Object.keys(map).map((k) => {
      const a = map[k];
      a.amount = roundAmt(a.amount, a.unit);
      return a;
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  // Namen vergleichbar machen: klein, ohne Mengenangaben und Sonderzeichen, einfache Mehrzahl-Endungen weg (Zwiebeln = Zwiebel)
  function shopKey(name) {
    return lc(name).replace(/\(.*?\)/g, ' ').replace(/[^a-zäöüß ]+/g, ' ').trim().split(/\s+/)
      .map((w) => w.replace(/(nen|en|n|e|s)$/, '')).filter(Boolean).join(' ');
  }
  async function openShopping(only) {
    if (!S.settings.bring) { toast('In den Einstellungen ist keine Einkaufsliste eingetragen', true); return; }
    if (!needOnline()) return;
    const today = ymd(new Date());
    const vis = visibleDays();
    const all = only ? [only] : S.events.filter((e) => e.status === 'geplant' && e.date >= today && vis.indexOf(e.date) >= 0);
    // Schon eingekaufte Gerichte nicht noch einmal auf die Liste setzen
    const evs = all.filter((e) => !e.eingekauft);
    const nBought = all.length - evs.length;
    const boughtNote = nBought ? '<p class="shop-note">' + ic('bag', 16) + nBought + (nBought === 1 ? ' Gericht ist schon eingekauft und fehlt hier.' : ' Gerichte sind schon eingekauft und fehlen hier.') + '</p>' : '';
    const dayKeys = Array.from(new Set(evs.map((e) => e.date))).sort();
    let bringNames = [];
    try {
      const r = await ha.request({ type: 'todo/item/list', entity_id: S.settings.bring });
      bringNames = (r.items || []).filter((i) => i.status === 'needs_action').map((i) => shopKey(i.summary));
    } catch (e) { toast('Einkaufsliste konnte nicht gelesen werden: ' + e.message, true); return; }
    S.sheet = { type: 'shop', evs: evs, bring: bringNames, items: [], only: !!only };
    if (only) {
      showSheet('Einkaufsliste · ' + only.name,
        '<div id="shopsum"></div><div id="shoplist" class="list"></div>' +
        '<button class="btn primary wide" data-a="shopsend">' + ic('cart', 18) + 'Auf die Einkaufsliste</button>');
      updateShopList();
      return;
    }
    if (!dayKeys.length && !only) {
      showSheet('Einkaufsliste', boughtNote + '<p class="empty">' + (nBought ? 'Alles Geplante ist schon eingekauft.' : 'In dieser Woche gibt es ab heute keine geplanten Gerichte.') + '</p>');
      return;
    }
    const multi = S.config.slots.filter((s) => s.aktiv).length > 1;
    showSheet('Einkaufsliste',
      boughtNote + '<span class="lbl">Tage</span><div class="list">' + dayKeys.map((d) => {
        const dt = parseYmd(d);
        const names = evs.filter((e) => e.date === d).map((e) => entryName(e) + (multi ? ' (' + slotOf(e.slot).label + ')' : '')).join(', ');
        return '<label class="shop-row"><input type="checkbox" class="sday" value="' + d + '" checked><span class="t">' + WD[dt.getDay()] + ' ' + dt.getDate() + '.<span class="hint">' + esc(names) + '</span></span></label>';
      }).join('') + '</div>' +
      '<span class="lbl">Zutaten</span><div id="shopsum"></div><div id="shoplist" class="list"></div>' +
      '<button class="btn primary wide" data-a="shopsend">' + ic('cart', 18) + 'Auf die Einkaufsliste</button>');
    updateShopList();
  }
  function updateShopList() {
    const sh = S.sheet;
    if (!sh || sh.type !== 'shop') return;
    const days = Array.prototype.map.call(document.querySelectorAll('.sday:checked'), (c) => c.value);
    // Grundvorrat: "nie" fällt raus, "optional" wird nicht vorausgewählt
    const nie = (S.config.vorrat_nie || []).map(shopKey).filter(Boolean);
    const opt = (S.config.vorrat_opt || []).map(shopKey).filter(Boolean);
    const words = (a) => shopKey(a.name).split(' ');
    sh.items = aggregate(sh.only ? sh.evs : sh.evs.filter((e) => days.indexOf(e.date) >= 0))
      .filter((a) => !words(a).some((w) => nie.some((n) => w.endsWith(n))))
      .map((a) => { if (words(a).some((w) => opt.some((o) => w.startsWith(o)))) { a.optional = true; a.vorrat = true; } return a; });
    const sum = $('#shopsum');
    const nOn = sh.items.filter((a) => sh.bring.indexOf(shopKey(a.name)) >= 0).length;
    if (sum) sum.innerHTML = nOn ? '<p class="shop-sum">' + ic('check', 16) + nOn + (nOn === 1 ? ' Zutat steht' : ' Zutaten stehen') + ' schon auf der Einkaufsliste</p>' : '';
    const el = $('#shoplist');
    if (!sh.items.length) { el.innerHTML = '<div class="empty">Keine Zutaten. Die gewählten Gerichte haben keine Zutatenliste.</div>'; return; }
    el.innerHTML = sh.items.map((a, i) => {
      const on = sh.bring.indexOf(shopKey(a.name)) >= 0;
      const q = a.hasAmount ? (fmtNum(a.amount) + ' ' + unitLabel(a.unit)).trim() : '';
      return '<label class="shop-row' + (on ? ' on-list' : '') + '"><input type="checkbox" class="sitem" data-k="' + i + '"' + (!a.optional && !on ? ' checked' : '') + '><span class="t">' + esc(a.name) +
        (on ? '<span class="onbadge">' + ic('check', 13) + 'schon drauf</span>' : (a.vorrat ? '<span class="hint">Vorrat prüfen</span>' : (a.optional ? '<span class="hint">optional</span>' : ''))) + '</span><span class="q">' + esc(q) + '</span></label>';
    }).join('');
  }
  async function sendShopping() {
    if (!needOnline()) return;
    const sh = S.sheet;
    const picks = Array.prototype.map.call(document.querySelectorAll('.sitem:checked'), (c) => sh.items[+c.dataset.k]);
    if (!picks.length) { toast('Keine Zutaten ausgewählt', true); return; }
    let n = 0;
    try {
      for (const a of picks) {
        const desc = a.hasAmount ? (fmtNum(a.amount) + ' ' + unitLabel(a.unit)).trim() : '';
        const data = { item: a.name };
        if (desc) data.description = desc;
        await ha.callService('todo', 'add_item', data, S.settings.bring);
        n++;
      }
    } catch (e) {
      toast(n + ' von ' + picks.length + ' gesendet. Fehler: ' + e.message, true);
      return;
    }
    // Beteiligte Gerichte als eingekauft markieren
    const days = Array.prototype.map.call(document.querySelectorAll('.sday:checked'), (c) => c.value);
    let used = sh.only ? sh.evs : sh.evs.filter((e) => days.indexOf(e.date) >= 0);
    used = used.map((e) => e.uid ? e : S.events.find((x) => !x.eingekauft && x.date === e.date && x.slot === e.slot && x.gericht_uid === e.gericht_uid)).filter(Boolean)
      .filter((e) => { const r = recipeById(e.gericht_uid); return r && r.zutaten.length; });
    closeSheet();
    try {
      for (const ev of used) await updateEntry(ev, { eingekauft: true });
      if (used.length) { await loadEvents(); render(); }
    } catch (e) { toast('Zutaten gesendet, Markierung fehlgeschlagen: ' + e.message, true); return; }
    toast(n + ' Zutaten auf die Einkaufsliste gesetzt' + (used.length ? ', Gericht' + (used.length === 1 ? '' : 'e') + ' als eingekauft markiert' : ''));
  }

  /* ---------- Einstellungen speichern ---------- */
  function readSettingsForm() {
    return {
      todo: $('#s_todo').value.trim(),
      calendar: $('#s_cal').value.trim(),
      config: $('#s_cfg').value.trim(),
      bring: $('#s_bring').value.trim()
    };
  }
  function nameFromId(id) {
    const o = String(id).split('.')[1] || '';
    return o.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  async function testConnection() {
    const out = $('#testout');
    const f = readSettingsForm();
    const head = [];
    const rows = [];
    const tail = [];
    const show = () => {
      out.innerHTML = head.concat(rows, tail).join('');
    };
    const line = (t) => '<div>' + esc(t) + '</div>';
    head.push(line('Verbinde mit ' + HASS + ' …')); show();
    const c = new HAClient();
    c.configure(HASS, getToken);
    const ok = await c.connect();
    if (!ok) {
      head[0] = line(c.status === 'auth_error' ? 'Fehler: Anmeldung abgelaufen. Bitte neu anmelden.' : 'Fehler: Keine Verbindung zu Home Assistant.');
      show(); c.disconnect(); return;
    }
    head[0] = line('Verbindung und Anmeldung: OK');
    try {
      const st = await c.request({ type: 'get_states' });
      const ids = {};
      st.forEach((x) => { ids[x.entity_id] = true; });
      const ents = [['Rezepte-Liste', f.todo, 'todo', 's_todo'], ['Kalender', f.calendar, 'calendar', 's_cal'], ['Config-Liste', f.config, 'todo', 's_cfg']];
      if (f.bring) ents.push(['Einkaufsliste', f.bring, 'bring', 's_bring']);
      ents.forEach((e) => {
        const label = e[0]; const id = e[1]; const kind = e[2]; const field = e[3];
        if (ids[id]) { rows.push('<div class="trow"><span>' + esc(label + ' ' + id) + '</span><b>OK</b></div>'); return; }
        const prefix = kind === 'calendar' ? 'calendar.' : 'todo.';
        let action;
        if (kind === 'bring') action = '<span class="note-s">To-do-Liste in HA prüfen</span>';
        else if (!/^[a-z_]+\.[a-z0-9_]+$/.test(id) || id.indexOf(prefix) !== 0) action = '<span class="note-s">Ungültige ID, muss mit ' + prefix + ' beginnen</span>';
        else action = '<button class="btn soft" data-a="createent" data-kind="' + kind + '" data-field="' + field + '">Anlegen</button>';
        rows.push('<div class="trow"><span>' + esc(label + ' ' + (id || '(leer)')) + ': nicht gefunden</span>' + action + '</div>');
      });
      show();
      if (ids[f.calendar]) {
        const ev = await c.rest('/api/calendars/' + encodeURIComponent(f.calendar) + '?start=' + encodeURIComponent(addDays(new Date(), -365).toISOString()) + '&end=' + encodeURIComponent(addDays(new Date(), 60).toISOString()));
        if (!ev.length) tail.push(line('Kalender-Abfrage per REST: OK, noch keine Termine (UID-Prüfung erst mit Terminen möglich)'));
        else tail.push(line('Kalender-Abfrage per REST: OK, UID ' + (ev[0].uid ? 'vorhanden' : 'FEHLT (Termine lassen sich nicht ändern)')));
      }
    } catch (e) { tail.push(line('Fehler: ' + e.message)); }
    show();
    c.disconnect();
  }

  /* Legt eine Local-To-do-Liste oder einen Local Calendar an, wie "Integration hinzufügen" in HA.
     Geht nur mit einem Admin-Konto. Liefert die tatsächlich vergebene Entitäts-ID. */
  async function createEntity(kind, wantedId) {
    const handler = kind === 'calendar' ? 'local_calendar' : 'local_todo';
    const name = nameFromId(wantedId);
    let step;
    try {
      step = await ha.restPost('/api/config/config_entries/flow', { handler: handler, show_advanced_options: false });
    } catch (e) {
      if (e.status === 401 || e.status === 403) throw new Error('Nur Admins können Listen und Kalender anlegen. Bitte einmal mit einem Admin-Konto anmelden oder in HA unter Geräte & Dienste anlegen.');
      throw e;
    }
    let guard = 0;
    while (step && step.type === 'form' && guard++ < 3) {
      if (step.errors && Object.keys(step.errors).length) {
        throw new Error('HA lehnt die Eingabe ab: ' + Object.keys(step.errors).map((k) => step.errors[k]).join(', '));
      }
      const data = {};
      (step.data_schema || []).forEach((fld) => {
        if (/name/.test(fld.name)) data[fld.name] = name;
        else if (fld.name === 'import') data[fld.name] = 'create_empty';
        else if (fld.default !== undefined) data[fld.name] = fld.default;
      });
      step = await ha.restPost('/api/config/config_entries/flow/' + encodeURIComponent(step.flow_id), data);
    }
    if (!step || step.type === 'abort') {
      const reason = step && step.reason;
      throw new Error(ABORT_TEXT[reason] || ('HA hat das Anlegen abgebrochen' + (reason ? ' (' + reason + ')' : '')));
    }
    if (step.type !== 'create_entry') throw new Error('Unerwartete Antwort von HA beim Anlegen (' + step.type + ')');
    const entryId = step.result && step.result.entry_id;
    const domain = kind === 'calendar' ? 'calendar' : 'todo';
    for (let i = 0; i < 10 && entryId; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const list = await ha.request({ type: 'config/entity_registry/list' });
        const hit = (list || []).find((x) => x.config_entry_id === entryId && x.entity_id.indexOf(domain + '.') === 0);
        if (hit) return hit.entity_id;
      } catch (e) { /* nochmal versuchen */ }
    }
    return domain + '.' + slugify(name).replace(/-/g, '_');
  }
  /* ---------- App neu laden: Service Worker und Cache dieser App leeren ---------- */
  async function hardReload() {
    toast('Lade App neu …');
    await commitPending();
    if (window.__epReset) window.__epReset();
    else location.reload();
  }

  /* ---------- Aktionen ---------- */
  const A = {
    nav: (el) => {
      const h = hashOf(el.dataset.v);
      if (location.hash === '#' + h) { S.view = el.dataset.v; render(); $('#main').scrollTop = 0; }
      else location.hash = h;
    },
    weekprev: () => run(async () => { shiftWindow(-1); render(); await ensureRange(); render(); }),
    weeknext: () => run(async () => { shiftWindow(1); render(); await ensureRange(); render(); }),
    wtoday: () => run(async () => { S.anchor = null; render(); await ensureRange(); render(); }),
    wmode: (el) => run(async () => {
      if (S.wmode === el.dataset.m) return;
      S.wmode = el.dataset.m;
      S.anchor = null;
      render();
      await ensureRange();
      render();
    }),
    pick: (el) => { if (needOnline()) openPicker(el.dataset.d, el.dataset.slot); },
    pickrecipe: (el) => run(async () => {
      const sh = S.sheet;
      const r = recipeById(el.dataset.uid);
      if (!r) return;
      const port = portionsValue('pp') || S.config.standard_portionen;
      if (sh.ablage || ($('#pablage') && $('#pablage').checked)) {
        const done = await ablageAdd({ name: r.name, gericht_uid: r.uid, portionen: port });
        if (done !== false) { closeSheet(); render(); toast(r.name + ' liegt in der Ablage'); }
        return;
      }
      const entry = { date: sh.date, slot: sh.slot, name: r.name, gericht_uid: r.uid, portionen: port, status: $('#pcooked').checked ? 'gekocht' : 'geplant' };
      const ok = await createEntry(entry);
      if (!ok) return;
      closeSheet();
      // Unauffälliger Hinweis mit Knopf, verschwindet von selbst. Nur bei geplanten Gerichten mit Zutaten.
      if (S.settings.bring && entry.status === 'geplant' && r.zutaten.length) {
        toast('Eingetragen: ' + r.name, { action: 'Zutaten einkaufen', duration: 6000, onAction: () => run(() => openShopping(entry)) });
      } else toast('Eingetragen: ' + r.name);
    }),
    pickfree: () => run(async () => {
      const sh = S.sheet;
      const name = ($('#pq').value || '').trim();
      if (!name) { toast('Bitte einen Namen eingeben', true); return; }
      if (sh.ablage || ($('#pablage') && $('#pablage').checked)) {
        const done = await ablageAdd({ name: name, gericht_uid: null, portionen: portionsValue('pp') || S.config.standard_portionen });
        if (done !== false) { closeSheet(); render(); toast(name + ' liegt in der Ablage'); }
        return;
      }
      const ok = await createEntry({ date: sh.date, slot: sh.slot, name: name, gericht_uid: null, portionen: portionsValue('pp') || S.config.standard_portionen, status: $('#pcooked').checked ? 'gekocht' : 'geplant' });
      if (ok) { closeSheet(); toast('Eingetragen: ' + name); }
    }),
    pickablage: (el) => run(() => { const sh = S.sheet; return ablageAssign(el.dataset.id, sh.date, sh.slot); }),
    abopen: (el) => { if (needOnline()) openAssign(el.dataset.id); },
    abadd: () => { if (needOnline()) openPicker(ymd(new Date()), activeSlots()[0].key, true); },
    abto: (el) => run(() => ablageAssign(el.dataset.id, el.dataset.d, el.dataset.slot)),
    abother: (el) => run(() => {
      const d = ($('#ab_date') || {}).value;
      if (!d) { toast('Bitte ein Datum wählen', true); return; }
      return ablageAssign(el.dataset.id, d, ($('#ab_slot') || {}).value || activeSlots()[0].key);
    }),
    abdel: (el) => run(async () => {
      const a = ablage().find((x) => x.id === el.dataset.id);
      if (!a) return;
      await ablageRemove(a.id);
      closeSheet();
      render();
      toast(ablageName(a) + ' aus der Ablage entfernt', { action: 'Rückgängig', onAction: () => run(async () => { await ablageAdd(a); render(); }) });
    }),
    moveablage: (el) => run(async () => {
      const ev = S.events.find((e) => e.uid === el.dataset.uid);
      if (!ev || !needOnline()) return;
      // Erst in die Ablage legen, dann den Termin löschen (so geht bei einem Fehler nichts verloren)
      const done = await ablageAdd({ name: entryName(ev), gericht_uid: ev.gericht_uid, portionen: ev.portionen, eingekauft: !!ev.eingekauft, notiz: ev.notiz });
      if (done === false) return;
      await ha.request({ type: 'calendar/event/delete', entity_id: S.settings.calendar, uid: ev.uid });
      await loadEvents();
      closeSheet();
      render();
      toast(entryName(ev) + ' liegt jetzt ohne Tag in der Ablage');
    }),
    cook: (el) => toggleCooked(el.dataset.uid),
    buy: (el) => toggleBought(el.dataset.uid),
    entry: (el) => openEntry(el.dataset.uid),
    entrytorecipe: (el) => {
      const ev = S.events.find((e) => e.uid === el.dataset.uid);
      if (!ev || !needOnline()) return;
      openFreeGroup(lc(String(ev.summary || '').trim()));
    },
    entrycook: (el) => { closeSheet(); return toggleCooked(el.dataset.uid); },
    entrysave: (el) => run(async () => {
      if (!needOnline()) return;
      const ev = S.events.find((e) => e.uid === el.dataset.uid);
      if (!ev) return;
      const date = $('#e_date').value;
      if (!date) { toast('Bitte ein Datum wählen', true); return; }
      const nameEl = $('#e_name');
      const name = nameEl ? nameEl.value.trim() : undefined;
      if (nameEl && !name) { toast('Bitte einen Namen eingeben', true); return; }
      await updateEntry(ev, { name: name, date: date, slot: $('#e_slot').value, portionen: portionsValue('ep') == null ? ev.portionen : portionsValue('ep'), notiz: $('#e_note').value.trim() });
      await loadEvents();
      closeSheet();
      render();
      toast('Gespeichert');
    }),
    entrydel: (el) => run(async () => {
      if (!needOnline()) return;
      const ev = S.events.find((e) => e.uid === el.dataset.uid);
      if (!ev) return;
      closeSheet();
      await removeEntry(ev);
    }),
    moveto: (el) => run(async () => { const ev = S.events.find((e) => e.uid === el.dataset.uid); if (ev) await moveEntryTo(ev, el.dataset.d, el.dataset.slot); }),
    moveother: (el) => run(async () => {
      const ev = S.events.find((e) => e.uid === el.dataset.uid);
      const d = ($('#mv_date') || {}).value;
      if (!d) { toast('Bitte ein Datum wählen', true); return; }
      if (ev) await moveEntryTo(ev, d, ($('#mv_slot') || {}).value);
    }),
    portion: (el) => {
      const box = el.closest('.portions');
      box.dataset.value = el.dataset.n;
      box.querySelectorAll('.pbtn').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      box.querySelector('.pfree').value = '';
    },
    wmodetoggle: () => run(async () => {
      S.wmode = S.wmode === 'woche' ? 'tage' : 'woche';
      S.anchor = null;
      render();
      await ensureRange();
      render();
    }),
    rdetail: (el) => openRecipeDetail(el.dataset.uid),
    plan: (el) => { if (needOnline()) openPlan(el.dataset.uid); },
    planok: (el) => run(async () => {
      const r = recipeById(el.dataset.uid);
      const date = $('#p_date').value;
      if (!r || !date) { toast('Bitte ein Datum wählen', true); return; }
      const ok = await createEntry({ date: date, slot: $('#p_slot').value, name: r.name, gericht_uid: r.uid, portionen: portionsValue('pp') || S.config.standard_portionen, status: $('#p_cooked').checked ? 'gekocht' : 'geplant' });
      if (ok) { const pd = parseYmd(date); closeSheet(); render(); toast('Eingeplant: ' + r.name + ', ' + WD[pd.getDay()] + ' ' + pd.getDate() + '. ' + MON_S[pd.getMonth()]); }
    }),
    freeopen: () => openFreeList(),
    freepick: (el) => openFreeGroup(el.dataset.k),
    freenew: (el) => {
      const g = freeGroups(true).find((x) => x.key === el.dataset.k);
      if (!g || !needOnline()) return;
      openRecipeForm(null, { name: g.name, linkKey: g.key });
    },
    freelinkpick: (el) => { if (needOnline()) openFreeLink(el.dataset.k); },
    freelink: (el) => run(async () => {
      const r = recipeById(el.dataset.uid);
      if (!r || !needOnline()) return;
      const n = await linkGroup(el.dataset.k, r);
      closeSheet(); render();
      toast(n + (n === 1 ? ' Eintrag' : ' Einträge') + ' mit „' + r.name + '“ verknüpft');
    }),
    freeign: (el) => run(async () => {
      const k = el.dataset.k;
      await patchConfig((c) => { c.frei_ignoriert = (c.frei_ignoriert || []).filter((x) => x !== k).concat(k); }, true);
      openFreeList(); render();
      toast('Wird nicht mehr als frei gezählt');
    }),
    freeunign: (el) => run(async () => {
      const k = el.dataset.k;
      await patchConfig((c) => { c.frei_ignoriert = (c.frei_ignoriert || []).filter((x) => x !== k); }, true);
      openFreeList(); render();
    }),
    newrecipe: () => { if (needOnline()) openRecipeForm(null); },
    editrecipe: (el) => { if (needOnline()) openRecipeForm(el.dataset.uid); },
    saverecipe: () => run(saveRecipe),
    delrecipe: () => run(async () => {
      if (!needOnline()) return;
      const r = recipeById(S.sheet && S.sheet.uid);
      if (!r) return;
      closeSheet();
      await scheduleDelete({
        uid: r.uid,
        label: '„' + r.name + '“',
        run: () => ha.callService('todo', 'remove_item', { item: [r.uid] }, S.settings.todo),
        refresh: () => reloadRecipes(),
        restore: () => { if (!S.recipes.some((x) => x.uid === r.uid)) S.recipes.push(r); }
      });
      S.recipes = S.recipes.filter((x) => x.uid !== r.uid);
      softRender();
    }),
    zadd: () => { S.sheet.zutaten = readZutaten(); S.sheet.zutaten.push({ name: '', menge: 0, einheit: 'g' }); $('#zlist').innerHTML = zutatenHtml(); },
    zdel: (el) => { S.sheet.zutaten = readZutaten(); S.sheet.zutaten.splice(+el.dataset.i, 1); $('#zlist').innerHTML = zutatenHtml(); },
    zup: (el) => { const z = readZutaten(); const i = +el.dataset.i; if (i > 0) { const t = z[i - 1]; z[i - 1] = z[i]; z[i] = t; } S.sheet.zutaten = z; $('#zlist').innerHTML = zutatenHtml(); },
    zdown: (el) => { const z = readZutaten(); const i = +el.dataset.i; if (i < z.length - 1) { const t = z[i + 1]; z[i + 1] = z[i]; z[i] = t; } S.sheet.zutaten = z; $('#zlist').innerHTML = zutatenHtml(); },
    statsort: (el) => { S.stats.sort = el.dataset.s; render(); },
    shop: () => run(openShopping),
    fillopen: () => run(openFill),
    fillok: () => applyFill(),
    fillroll: (el) => run(() => {
      const sh = S.sheet; const i = +el.dataset.i; const p = sh && sh.plan[i];
      if (!p) return;
      let avoid = {};
      (p.tried || []).forEach((u) => { avoid[u] = true; });
      sh.plan.forEach((q) => { if (q.gericht_uid) avoid[q.gericht_uid] = true; });
      let r = suggestFor(p.date, { virt: fillVirt(sh.plan, i), avoid: avoid })[0];
      if (!r) { p.tried = []; avoid = {}; sh.plan.forEach((q) => { if (q.gericht_uid) avoid[q.gericht_uid] = true; }); r = suggestFor(p.date, { virt: fillVirt(sh.plan, i), avoid: avoid })[0]; }
      if (!r) { toast('Kein anderes passendes Gericht'); return; }
      p.name = r.name; p.gericht_uid = r.uid; p.tried = (p.tried || []).concat(r.uid);
      renderFill();
    }),
    filldrop: (el) => run(() => { const sh = S.sheet; if (!sh || sh.type !== 'fill') return; sh.plan.splice(+el.dataset.i, 1); renderFill(); }),
    shopsend: () => run(sendShopping),
    savesettings: () => {
      const f = readSettingsForm();
      S.settings = Object.assign({}, S.settings, f);
      saveSettings();
      S.recipes = []; S.recipesLoaded = false; S.events = []; S.eventsLoaded = false; S.range = null;
      toast('Gespeichert, verbinde …');
      start();
      if (location.hash !== '#woche') location.hash = 'woche'; else { S.view = 'woche'; render(); }
    },
    testconn: () => run(testConnection),
    createent: (el) => run(async () => {
      if (!needOnline()) return;
      const input = $('#' + el.dataset.field);
      if (!input) return;
      el.textContent = 'Lege an …';
      const newId = await createEntity(el.dataset.kind, input.value.trim());
      input.value = newId;
      S.settingsDirty = true;
      await loadEntities();
      toast('Angelegt: ' + newId + '. Zum Übernehmen Speichern tippen.');
      await testConnection();
    }),
    reload: () => run(async () => {
      if (!needOnline()) return;
      await loadConfig(); await reloadRecipes(); await loadEvents(); render(); toast('Daten neu geladen');
    }),
    login: () => login(),
    hardreload: () => run(hardReload),
    logout: () => run(async () => {
      const ok = await confirmSheet({ title: 'Wirklich abmelden?', hint: 'Die gespeicherten Daten auf diesem Gerät werden gelöscht.', label: 'Abmelden' });
      if (ok) await logout();
    }),
    confirmyes: () => { const d = S.sheet && S.sheet.done; if (S.sheet) S.sheet.done = null; closeSheet(); if (d) d(true); },
    confirmno: () => closeSheet(),
    closesheet: () => closeSheet()
  };

  const TR = window.EPTransfer.init({
    S: S, ymd: ymd, slugify: slugify, safeUrl: safeUrl, entryName: entryName, slotIdx: slotIdx,
    writeRecipe: writeRecipe, writeEvent: writeEvent, reloadRecipes: reloadRecipes, loadEvents: loadEvents, patchConfig: patchConfig
  });
  const SET = window.EPSettings.init({
    S: S, ha: ha, HASS: HASS, VERSION: VERSION, esc: esc, clone: clone, slugify: slugify, ymd: ymd, parseYmd: parseYmd,
    toast: toast, needOnline: needOnline, render: render, loadConfig: loadConfig, saveSnapshot: saveSnapshot,
    connText: connText, standText: standText, confirmSheet: confirmSheet, patchConfig: patchConfig,
    showSheet: showSheet, closeSheet: closeSheet, transfer: TR, EPTransfer: window.EPTransfer, slotLabel: (k) => slotOf(k).label
  });
  Object.assign(A, SET.actions);

  /* Schreibende Aktionen laufen nacheinander, ein Doppeltipp löst nichts doppelt aus. */
  const MUTATING = ['fillok', 'freelink', 'freeign', 'freeunign', 'cook', 'buy', 'pickablage', 'abto', 'abother', 'abdel', 'moveablage', 'entrycook', 'pickrecipe', 'pickfree', 'entrysave', 'entrydel', 'planok', 'saverecipe', 'delrecipe', 'shopsend', 'createent', 'cfgadd', 'cfgdel', 'moveto', 'moveother', 'impapply'];
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const name = el.dataset.a;
    const fn = A[name];
    if (!fn) return;
    if (MUTATING.indexOf(name) < 0) { fn(el, e); return; }
    if (S.busy) return;
    S.busy = true;
    el.disabled = true;
    Promise.resolve().then(() => fn(el, e)).catch(() => {}).then(() => { S.busy = false; el.disabled = false; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.sheet) { closeSheet(); return; }
    if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); const b = $(e.target.dataset.enter); if (b) b.click(); return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'pq') { const b = $('#plist [data-a="pickfree"]') || $('#plist [data-a="pickrecipe"]'); if (b) { e.preventDefault(); b.click(); } return; }
  });
  const markDirty = (t) => { if (S.view === 'settings' && t.closest && t.closest('#main')) S.settingsDirty = true; };
  document.addEventListener('input', (e) => {
    markDirty(e.target);
    const id = e.target.id;
    if (SET.onInput(e.target)) return;
    if (e.target.classList && e.target.classList.contains('pfree')) {
      const box = e.target.closest('.portions');
      const n = parseInt(e.target.value, 10);
      box.querySelectorAll('.pbtn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      box.dataset.value = n >= 1 && n <= 99 ? String(n) : '';
    } else if (id === 'pq') updatePicker();
    else if (id === 'rq') { S.rf.q = e.target.value; updateRecipeList(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (SET.onChange(t)) return;
    markDirty(t);
    const id = t.id || '';
    if (id.indexOf('flt_') === 0) {
      const map = { flt_kat: 'kat', flt_kue: 'kueche', flt_auf: 'aufwand', flt_sort: 'sort' };
      if (id === 'flt_fav') S.rf.fav = t.checked; else S.rf[map[id]] = t.value;
      updateRecipeList();
    } else if (id === 'st_days') { S.stats.days = +t.value; render(); }
    else if (t.classList && t.classList.contains('sday')) updateShopList();
  });
  let swReg = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { commitPending(); return; }
    ha.ensure();
    if (swReg) swReg.update().catch(() => {});
    if (S.conn === 'online' && S.view !== 'settings' && !S.sheet) run(async () => { await loadEvents(); softRender(); });
  });
  window.addEventListener('online', () => ha.ensure());
  window.EPSwipe.init({
    onRight: (uid) => swipeCook(uid),
    onLeftHalf: (uid) => { if (needOnline()) openMove(uid); },
    onLeftFull: (uid) => {
      const ev = S.events.find((e) => e.uid === uid);
      if (!ev) return;
      if (!needOnline()) { render(); return; }
      return removeEntry(ev);
    }
  });
  window.addEventListener('hashchange', () => {
    const r = parseHash();
    S.prevHash = S.curHash;
    S.curHash = location.hash;
    if (!$('#sheet').hidden) closeSheet(true);
    if (r.view !== S.view || r.page !== S.page) { S.view = r.view; S.page = r.page; render(); $('#main').scrollTop = 0; }
  });
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (!$('#sheet').hidden) closeSheet(true);
  });

  /* ---------- Start ---------- */
  ha.onSubError = (e) => toast('Rezepte konnten nicht geladen werden: ' + e.message, true);
  ha.onStatus((st) => {
    S.conn = st;
    renderBanner();
    if (st === 'online') bootData();
    else if (st === 'auth_error') { clearLogin(); render(); toast('Anmeldung abgelaufen. Bitte neu anmelden.', true); }
    else softRender();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => { swReg = r; }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast('Neue Version installiert', { action: 'Neu laden', onAction: () => location.reload(), duration: 20000 });
    });
  }
  S.loggingIn = new URLSearchParams(location.search).has('code');
  if (S.auth) loadSnapshot();
  render();
  window.__epReady = true;
  window.dispatchEvent(new Event('essensplaner-ready'));
  handleCallback().then(() => {
    S.loggingIn = false;
    if (S.auth && !S.recipesLoaded) loadSnapshot();
    render();
    start();
  });
})();
