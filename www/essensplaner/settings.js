/* Einstellungen im Stil der Merker-App: Statuskarte, große Menüzeilen, Unterseiten mit Abschnitten.
   Wird von app.js mit EPSettings.init(kontext) angebunden. */
(function (global) {
  'use strict';

  const PAGES = ['verbindung', 'planung', 'rezeptdaten', 'einkauf', 'daten', 'darstellung'];
  const TITLES = { verbindung: 'Listen und Kalender', planung: 'Mahlzeiten', rezeptdaten: 'Rezeptdaten', einkauf: 'Einkaufsliste', daten: 'Export und Import', darstellung: 'Darstellung' };
  const TH = global.EPTheme;
  const THEMES = [['auto', 'Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']];

  /* Material-Symbole (Apache 2.0), wie in der Merker-App */
  const MI = {
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z',
    chevron: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
    lists: 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z',
    palette: 'M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
    logout: 'm17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z',
    sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    tag: 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
    swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
  };
  const mi = (n, size) => '<svg width="' + (size || 24) + '" height="' + (size || 24) + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + MI[n] + '"/></svg>';
  const lc = (s) => String(s || '').trim().toLowerCase();

  global.EPSettings = {
    init(X) {
      const esc = X.esc;

      /* ----- Bausteine ----- */
      function menuRow(o) {
        return '<button class="menu-row press' + (o.danger ? ' is-danger' : (o.action ? ' is-action' : '')) + '" type="button" data-a="' + o.a + '"' + (o.p ? ' data-p="' + o.p + '"' : '') + '>' +
          '<span class="menu-icon" aria-hidden="true">' + mi(o.icon, 22) + '</span>' +
          '<span class="menu-text"><span class="menu-title">' + esc(o.title) + '</span>' + (o.summary ? '<span class="menu-summary">' + esc(o.summary) + '</span>' : '') + '</span>' +
          (o.chevron ? '<span class="menu-chevron" aria-hidden="true">' + mi('chevron', 24) + '</span>' : '') + '</button>';
      }
      const section = (title, inner) => '<section class="settings-section"><h2 class="section-title">' + esc(title) + '</h2><div class="menu-group menu-body">' + inner + '</div></section>';
      const shell = (page, inner) => '<div class="set-wrap"><div class="set-hdr has-back"><button class="back-btn press" type="button" data-a="setback" aria-label="Zurück">' + mi('back', 24) + '</button><h1 class="title">' + esc(TITLES[page]) + '</h1></div>' + inner + '</div>';
      const field = (label, attrs) => '<label class="set-field"><span>' + esc(label) + '</span><input class="field-input" ' + attrs + '></label>';
      const note = (t) => '<p class="set-note">' + esc(t) + '</p>';
      function switchRow(title, hint, attrs, checked) {
        return '<label class="switch-row set-switch"><span class="set-switch-text"><span>' + esc(title) + '</span>' + (hint ? '<span class="set-hint">' + esc(hint) + '</span>' : '') + '</span>' +
          '<input type="checkbox" role="switch" class="switch" aria-label="' + esc(title) + '" ' + attrs + (checked ? ' checked' : '') + '></label>';
      }

      /* ----- Übersicht ----- */
      function overview() {
        const S = X.S;
        const c = S.config;
        const cls = S.conn === 'online' ? 'online' : (S.conn === 'connecting' ? 'connecting' : 'offline');
        const meals = c.slots.filter((s) => s.aktiv).map((s) => s.label).join(' + ') || 'keine';
        const hueName = (h) => { const p = TH.PRESETS.find((x) => x.hue === h); return p ? p.label : 'Eigene Farbe'; };
        const themeName = (THEMES.find((t) => t[0] === TH.getTheme()) || THEMES[0])[1] + ' · ' + hueName(TH.getAccent());
        return '<div class="set-wrap"><div class="set-hdr"><h1 class="title">Einstellungen</h1></div>' +
          '<div class="settings-status status-' + cls + '"><span class="status-dot" aria-hidden="true"></span><dl class="status-facts">' +
          '<dt>Status</dt><dd><b id="st_conn">' + esc(X.connText()) + '</b></dd>' +
          '<dt>Home Assistant</dt><dd>' + esc(X.HASS.replace(/^https?:\/\//, '')) + '</dd>' +
          '<dt>App-Version</dt><dd>' + esc(X.VERSION) + '</dd>' +
          (S.fromSnap && S.snapT ? '<dt>Offline-Stand</dt><dd>' + esc(X.standText(S.snapT)) + '</dd>' : '') +
          '</dl></div>' +
          '<div class="menu-group">' +
          menuRow({ a: 'setpage', p: 'verbindung', icon: 'lists', chevron: true, title: TITLES.verbindung, summary: S.settings.todo + ' · ' + S.settings.calendar }) +
          menuRow({ a: 'setpage', p: 'planung', icon: 'schedule', chevron: true, title: TITLES.planung, summary: meals + ' · ' + c.standard_portionen + ' Portionen' }) +
          menuRow({ a: 'setpage', p: 'rezeptdaten', icon: 'tag', chevron: true, title: TITLES.rezeptdaten, summary: c.kategorien.length + ' Kategorien · ' + c.kuechen.length + ' Küchen · ' + c.einheiten.length + ' Einheiten' }) +
          menuRow({ a: 'setpage', p: 'einkauf', icon: 'cart', chevron: true, title: TITLES.einkauf, summary: (c.vorrat_nie || []).length + ' nie drauf · ' + (c.vorrat_opt || []).length + ' nur optional' }) +
          menuRow({ a: 'setpage', p: 'daten', icon: 'swap', chevron: true, title: TITLES.daten, summary: 'Gerichte und Plan als Text oder Datei' }) +
          menuRow({ a: 'setpage', p: 'darstellung', icon: 'palette', chevron: true, title: TITLES.darstellung, summary: themeName }) +
          '</div>' +
          '<div class="menu-group">' +
          menuRow({ a: 'reload', icon: 'sync', title: 'Daten neu laden', summary: 'Neu aus Home Assistant holen' }) +
          menuRow({ a: 'hardreload', icon: 'refresh', action: true, title: 'Cache leeren', summary: 'App frisch neu laden' }) +
          menuRow({ a: 'logout', icon: 'logout', danger: true, title: 'Abmelden', summary: 'Daten auf diesem Gerät löschen' }) +
          '</div></div>';
      }

      /* ----- Seite: Listen und Kalender ----- */
      function pageVerbindung() {
        const s = X.S.settings;
        const a = 'type="text" autocapitalize="off" spellcheck="false"';
        // Auswahlliste der vorhandenen Entitäten, sortiert nach Namen. "Andere ID eingeben" blendet ein Textfeld ein.
        const pick = (id, label, pre, cur, allowNone) => {
          const names = X.S.entityNames || {};
          const list = X.S.entities.filter((e) => e.indexOf(pre) === 0)
            .sort((x, y) => (names[x] || x).localeCompare(names[y] || y, 'de'));
          const known = list.indexOf(cur) >= 0 || (allowNone && !cur);
          const opt = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
          const opts = (allowNone ? opt('', 'Keine', !cur) : '') +
            list.map((e) => opt(e, names[e] ? names[e] + ' (' + e + ')' : e, e === cur)).join('') +
            opt('__custom', 'Andere ID eingeben …', !known);
          return '<label class="set-field"><span>' + esc(label) + '</span><select class="field-input" data-pickfor="' + id + '">' + opts + '</select></label>' +
            '<label class="set-field ent-custom' + (known ? ' is-hidden' : '') + '"><span>Entitäts-ID</span><input class="field-input" ' + a + ' id="' + id + '" placeholder="' + pre + '…" value="' + esc(cur || '') + '"></label>';
        };
        return shell('verbindung',
          section('Entitäten in Home Assistant',
            pick('s_todo', 'Rezepte (To-do-Liste)', 'todo.', s.todo) +
            pick('s_cal', 'Essensplan (Kalender)', 'calendar.', s.calendar) +
            pick('s_cfg', 'Gemeinsame Einstellungen (To-do-Liste)', 'todo.', s.config) +
            pick('s_bring', 'Einkaufsliste (optional)', 'todo.', s.bring || '', true) +
            note('Rezepte und Config liegen in Local To-do, der Plan in Local Calendar. Die Einkaufsliste kann jede To-do-Liste sein. Fehlende Listen lassen sich beim Testen anlegen.')) +
          section('Prüfen',
            '<div class="actions"><button class="btn press" type="button" data-a="testconn">Testen</button><button class="btn primary press" type="button" data-a="savesettings">Speichern</button></div>' +
            '<div id="testout" class="testout"></div>'));
      }

      /* ----- Seite: Mahlzeiten ----- */
      function pagePlanung() {
        const c = X.S.config;
        const slots = c.slots.map((sl, i) => section(sl.label,
          switchRow('In der Woche anzeigen', 'Gibt der Mahlzeit einen eigenen Platz im Wochenplan', 'data-cfg="slot" data-i="' + i + '" data-f="aktiv"', sl.aktiv) +
          field('Name', 'type="text" maxlength="30" data-cfg="slot" data-i="' + i + '" data-f="label" value="' + esc(sl.label) + '"') +
          '<div class="grid2 set-grid">' +
          field('Von', 'type="time" data-cfg="slot" data-i="' + i + '" data-f="start" value="' + esc(sl.start) + '"') +
          field('Bis', 'type="time" data-cfg="slot" data-i="' + i + '" data-f="ende" value="' + esc(sl.ende) + '"') +
          '</div>')).join('');
        return shell('planung', slots + section('Standard-Portionen',
          field('Portionen', 'type="number" inputmode="numeric" min="1" max="30" data-cfg="port" value="' + esc(c.standard_portionen) + '"') +
          note('Vorgabe für neue Rezepte und Einträge im Plan.')));
      }

      /* ----- Seite: Rezeptdaten ----- */
      function listEditor(name, items, placeholder) {
        const rows = items.map((it) =>
          '<div class="edit-row"><input class="field-input" type="text" maxlength="40" aria-label="Name" value="' + esc(it.label) + '" data-cfg="item" data-list="' + name + '" data-key="' + esc(it.key) + '">' +
          '<button class="icon-btn press" type="button" data-a="cfgdel" data-list="' + name + '" data-key="' + esc(it.key) + '" aria-label="' + esc(it.label) + ' entfernen">' + mi('del', 22) + '</button></div>').join('');
        return rows + addRow(name, placeholder);
      }
      function addRow(name, placeholder) {
        return '<div class="edit-row"><input class="field-input" type="text" maxlength="40" id="add_' + name + '" placeholder="' + esc(placeholder) + '" data-enter="#addbtn_' + name + '">' +
          '<button class="icon-btn press is-add" type="button" id="addbtn_' + name + '" data-a="cfgadd" data-list="' + name + '" aria-label="Hinzufügen">' + mi('add', 24) + '</button></div>';
      }
      function pageRezeptdaten() {
        const c = X.S.config;
        const chips = '<div class="unit-chips">' + c.einheiten.map((u) =>
          '<span class="unit-chip"><span>' + esc(u) + '</span><button type="button" data-a="cfgdel" data-list="einheiten" data-key="' + esc(u) + '" aria-label="' + esc(u) + ' entfernen">' + mi('close', 16) + '</button></span>').join('') + '</div>';
        return shell('rezeptdaten',
          section('Kategorien', listEditor('kategorien', c.kategorien, 'Neue Kategorie') + note('Umbenennen ändert nur den Namen. Rezepte behalten ihre Zuordnung.')) +
          section('Küchen', listEditor('kuechen', c.kuechen, 'Neue Küche')) +
          section('Einheiten', chips + addRow('einheiten', 'Neue Einheit, z. B. scheibe') + note('Einheiten für die Zutaten im Rezeptformular.')));
      }

      /* ----- Seite: Einkaufsliste (Grundvorrat) ----- */
      function strChips(list) {
        return '<div class="unit-chips">' + (X.S.config[list] || []).map((u) =>
          '<span class="unit-chip"><span>' + esc(u) + '</span><button type="button" data-a="cfgdel" data-list="' + list + '" data-key="' + esc(u) + '" aria-label="' + esc(u) + ' entfernen">' + mi('close', 16) + '</button></span>').join('') + '</div>';
      }
      function pageEinkauf() {
        return shell('einkauf',
          section('Nie auf die Einkaufsliste', strChips('vorrat_nie') + addRow('vorrat_nie', 'Neu, z. B. Senf') +
            note('Immer im Haus. Erscheint gar nicht in der Auswahl. Gilt auch für Wörter, die so enden, z. B. Öl für Olivenöl oder Pulver für Paprikapulver.')) +
          section('Nur optional', strChips('vorrat_opt') + addRow('vorrat_opt', 'Neu, z. B. Reis') +
            note('Hält länger. Erscheint in der Auswahl, ist aber nicht vorausgewählt. Gilt auch für Wörter, die so beginnen, z. B. Knoblauch für Knoblauchzehe.')));
      }

      /* ----- Seite: Darstellung ----- */
      function pageDarstellung() {
        const cur = TH.getTheme();
        const hue = TH.getAccent();
        const isPreset = TH.PRESETS.some((p) => p.hue === hue);
        const start = isPreset ? 215 : hue;
        const swatches = TH.PRESETS.map((p) =>
          '<button class="swatch" type="button" data-a="setaccent" data-hue="' + (p.hue == null ? '' : p.hue) + '" style="--lh:' + (p.hue == null ? p.swatch : p.hue) + '" title="' + esc(p.label) + '" aria-label="' + esc(p.label) + '" aria-pressed="' + (hue === p.hue) + '"></button>').join('');
        const custom = '<button class="swatch swatch-custom' + (isPreset ? '' : ' is-set') + '" type="button" data-a="customswatch" title="Eigene Farbe" aria-label="Eigene Farbe" aria-pressed="' + (!isPreset) + '"' + (isPreset ? '' : ' style="--lh:' + hue + '"') + '></button>';
        const panel = '<div class="hue-panel" id="hue_panel" hidden>' +
          '<div class="hue-row"><span class="hue-preview" id="hue_preview" style="--lh:' + start + '"></span><input type="range" min="0" max="360" step="1" class="hue-slider" id="hue_slider" aria-label="Farbton" value="' + start + '"></div>' +
          '<div class="hue-row"><label for="hue_hex">Hexcode</label><input type="text" class="hex-input" id="hue_hex" maxlength="7" spellcheck="false" autocapitalize="off" value="' + TH.hueToHex(start) + '"></div>' +
          '<p class="hue-note">Der Farbton wird übernommen. Sättigung und Helligkeit passt die App selbst an.</p></div>';
        return shell('darstellung',
          section('Akzentfarbe', '<div class="color-choices"><div class="swatch-row" role="group" aria-label="Akzentfarbe">' + swatches + custom + '</div>' + panel + '</div>') +
          section('Erscheinungsbild',
            '<div class="seg-bar" role="group" aria-label="Erscheinungsbild">' + THEMES.map((t) =>
              '<button class="seg-btn press" type="button" data-a="settheme" data-t="' + t[0] + '" aria-pressed="' + (t[0] === cur) + '">' + t[1] + '</button>').join('') + '</div>' +
            note('Gerät folgt der Einstellung deines Telefons.')) +
          section('Schrift',
            '<div class="font-list" role="group" aria-label="Schrift">' + TH.FONTS.map((f) =>
              '<button class="font-opt press" type="button" data-a="setfont" data-f="' + f.key + '" aria-pressed="' + (f.key === TH.getFont()) + '" style="font-family:' + TH.fontStack(f.key).replace(/"/g, "'") + '"><b>' + esc(f.label) + '</b><span>Spaghetti Bolognese 0123456789</span></button>').join('') + '</div>' +
            note('Wirkt sofort in der ganzen App.')));
      }

      /* ----- Seite: Export und Import ----- */
      function pageDaten() {
        return shell('daten',
          section('Gerichte',
            '<div class="actions"><button class="btn press" type="button" data-a="expgerichte">Exportieren</button><button class="btn press" type="button" data-a="impgerichte">Importieren</button></div>' +
            note('Der Export enthält alle Gerichte als Text im JSON-Format, auch zum Weitergeben an eine KI. Importieren ergänzt und aktualisiert Gerichte, es löscht nichts.')) +
          section('Plan',
            '<label class="set-field"><span>Zeitraum für den Export</span><select class="field-input" id="exp_scope"><option value="alle">Alle geladenen Termine</option><option value="zukunft">Ab heute</option><option value="gekocht">Nur gekochte</option></select></label>' +
            '<div class="actions"><button class="btn press" type="button" data-a="expplan">Exportieren</button><button class="btn press" type="button" data-a="impplan">Importieren</button></div>' +
            note('Termine werden über ihre ID oder über Datum, Mahlzeit und Name erkannt, Gerichte über ihre ID oder den Namen.')));
      }

      function view() {
        const p = X.S.page;
        if (p === 'verbindung') return pageVerbindung();
        if (p === 'planung') return pagePlanung();
        if (p === 'rezeptdaten') return pageRezeptdaten();
        if (p === 'einkauf') return pageEinkauf();
        if (p === 'daten') return pageDaten();
        if (p === 'darstellung') return pageDarstellung();
        return overview();
      }

      async function addItem(list) {
        const input = document.getElementById('add_' + list);
        const label = (input && input.value || '').trim();
        if (!label) { if (input) input.focus(); return; }
        const ok = await X.patchConfig((c) => {
          if (list === 'vorrat_nie' || list === 'vorrat_opt') {
            if (!Array.isArray(c[list])) c[list] = [];
            if (c[list].some((x) => lc(x) === lc(label))) { X.toast('Steht schon in der Liste', true); return false; }
            c[list].push(label);
          } else if (list === 'einheiten') {
            const u = label.toLowerCase().replace(/\s+/g, '');
            if (c.einheiten.indexOf(u) >= 0) { X.toast('Diese Einheit gibt es schon', true); return false; }
            c.einheiten.push(u);
          } else {
            if (c[list].some((x) => lc(x.label) === lc(label))) { X.toast('Diesen Namen gibt es schon', true); return false; }
            const base = X.slugify(label) || 'eintrag';
            let key = base;
            let n = 2;
            while (c[list].some((x) => x.key === key)) key = base + '-' + (n++);
            c[list].push({ key: key, label: label });
          }
          return true;
        });
        if (ok) X.render();
      }

      async function delItem(list, key) {
        const S = X.S;
        const c = S.config;
        const strList = list === 'vorrat_nie' || list === 'vorrat_opt';
        if (!strList && c[list].length <= 1) { X.toast('Mindestens ein Eintrag muss bleiben', true); return; }
        let used;
        let label = key;
        if (strList) used = 0;
        else if (list === 'einheiten') used = S.recipes.filter((r) => r.zutaten.some((z) => z.einheit === key)).length;
        else {
          const field = list === 'kategorien' ? 'kategorie' : 'kueche';
          used = S.recipes.filter((r) => r[field] === key).length;
          const it = c[list].find((x) => x.key === key);
          if (it) label = it.label;
        }
        if (used) {
          const ok = await X.confirmSheet({
            title: '„' + label + '“ entfernen?',
            hint: used + (used === 1 ? ' Rezept nutzt' : ' Rezepte nutzen') + ' das noch. Der Wert bleibt dort gespeichert, steht aber nicht mehr zur Auswahl.',
            label: 'Entfernen'
          });
          if (!ok) return;
        }
        const done = await X.patchConfig((cc) => { cc[list] = cc[list].filter((x) => (list === 'einheiten' || strList ? x : x.key) !== key); });
        if (done) X.render();
      }

      /* Änderung an einem Feld der Config-Seiten, wird sofort gespeichert */
      function onChange(t) {
        if (t.dataset && t.dataset.pickfor) {
          const inp = byId(t.dataset.pickfor);
          if (!inp) return true;
          const wrap = inp.closest('.ent-custom');
          if (t.value === '__custom') { wrap.classList.remove('is-hidden'); inp.focus(); }
          else { inp.value = t.value; wrap.classList.add('is-hidden'); }
          return true;
        }
        if (t.id === 'imp_file') {
          const f = t.files && t.files[0];
          if (f) {
            const fr = new FileReader();
            fr.onload = () => { const ta = byId('imp_text'); if (ta) { ta.value = String(fr.result || ''); X.toast('Datei geladen. Jetzt Prüfen tippen.'); } };
            fr.readAsText(f);
          }
          return true;
        }
        if (t.id === 'hue_hex') { t.value = TH.hueToHex(+byId('hue_slider').value); t.classList.remove('invalid'); return true; }
        const cfg = t.dataset && t.dataset.cfg;
        if (!cfg) return false;
        let p;
        if (cfg === 'slot') {
          const i = +t.dataset.i;
          const f = t.dataset.f;
          const v = f === 'aktiv' ? t.checked : t.value.trim();
          p = X.patchConfig((c) => {
            const sl = c.slots[i];
            if (!sl) return false;
            if (f === 'label' && !v) return false;
            if ((f === 'start' || f === 'ende') && !/^\d\d:\d\d$/.test(v)) return false;
            sl[f] = v;
            return true;
          });
        } else if (cfg === 'port') {
          const n = Math.round(+t.value);
          p = X.patchConfig((c) => { if (!(n >= 1 && n <= 30)) return false; c.standard_portionen = n; return true; });
        } else if (cfg === 'item') {
          const list = t.dataset.list;
          const key = t.dataset.key;
          const label = t.value.trim();
          p = X.patchConfig((c) => {
            const it = c[list].find((x) => x.key === key);
            if (!it || !label) return false;
            if (c[list].some((x) => x.key !== key && lc(x.label) === lc(label))) { X.toast('Diesen Namen gibt es schon', true); return false; }
            it.label = label;
            return true;
          });
        } else return false;
        p.then((ok) => { if (!ok) X.render(); });
        return true;
      }

      /* ----- Export und Import: Fenster ----- */
      const TR = X.transfer;
      const byId = (id) => document.getElementById(id);
      const fileName = (kind) => 'essensplaner-' + kind + '-' + X.ymd(new Date()) + '.json';
      function exportSheet(kind) {
        const text = kind === 'gerichte' ? TR.exportRecipes() : TR.exportPlan((byId('exp_scope') || {}).value || 'alle');
        const count = kind === 'gerichte' ? X.S.recipes.length : JSON.parse(text).termine.length;
        X.S.sheet = { type: 'xfer', kind: kind, text: text };
        X.showSheet(kind === 'gerichte' ? 'Gerichte exportieren' : 'Plan exportieren',
          '<p class="set-note" style="margin:0 4px">' + count + (kind === 'gerichte' ? ' Gerichte' : ' Termine') + '. Kopiere den Text oder speichere ihn als Datei und gib ihn einer KI. Das Ergebnis kannst du hier wieder importieren.</p>' +
          '<textarea id="exp_text" class="field-input mono" readonly rows="8">' + esc(text) + '</textarea>' +
          '<div class="actions"><button class="btn press" type="button" data-a="copytext">Kopieren</button><button class="btn primary press" type="button" data-a="savetext">Als Datei speichern</button></div>');
      }
      async function copyText() {
        const text = X.S.sheet && X.S.sheet.text;
        try { if (navigator.clipboard && global.isSecureContext) { await navigator.clipboard.writeText(text); X.toast('Kopiert'); return; } } catch (e) { /* weiter */ }
        const ta = byId('exp_text');
        if (ta) { ta.focus(); ta.select(); try { if (document.execCommand('copy')) { X.toast('Kopiert'); return; } } catch (e) { /* weiter */ } }
        X.toast('Kopieren nicht möglich. Der Text ist markiert, bitte lange drücken und kopieren.', true);
      }
      function saveText() {
        const sh = X.S.sheet;
        if (!sh || !sh.text) return;
        const blob = new Blob([sh.text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName(sh.kind);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        X.toast('Datei wird gespeichert');
      }
      function importSheet(kind) {
        X.S.sheet = { type: 'xfer', kind: kind, plan: null };
        X.showSheet(kind === 'gerichte' ? 'Gerichte importieren' : 'Plan importieren',
          '<p class="set-note" style="margin:0 4px">Füge den JSON-Text ein oder wähle eine Datei. Antworten einer KI mit Erklärtext oder Codeblock sind in Ordnung. Tipp: Exportiere vorher eine Sicherung.</p>' +
          '<textarea id="imp_text" class="field-input mono" rows="8" placeholder="JSON hier einfügen"></textarea>' +
          '<label class="btn press">Datei wählen<input type="file" id="imp_file" accept=".json,application/json,text/plain" hidden></label>' +
          '<button class="btn primary wide press" type="button" data-a="impcheck">Prüfen</button>');
      }
      const fmtDay = (d) => { const x = X.parseYmd(d); return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][x.getDay()] + ' ' + x.getDate() + '.' + (x.getMonth() + 1) + '.'; };
      function previewSheet(plan) {
        const c = plan.counts;
        const n = c.new + c.update;
        const badge = { new: ['Neu', 'b-new'], update: ['Geändert', 'b-upd'], skip: ['Übersprungen', 'b-skip'] };
        const rows = plan.items.filter((i) => i.status !== 'same').slice(0, 60).map((i) => {
          const b = badge[i.status];
          let sub = '';
          if (i.status === 'skip') sub = i.reason;
          else if (plan.kind === 'gerichte') sub = i.rename ? 'war: ' + i.oldName : (i.matchedBy === 'name' ? 'erkannt am Namen' : '');
          else sub = fmtDay(i.date) + ' · ' + X.slotLabel(i.slot) + (i.linked ? '' : ' · frei');
          return '<div class="pv-row"><span class="pv-badge ' + b[1] + '">' + b[0] + '</span><span class="pv-text"><b>' + esc(i.name) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></div>';
        }).join('');
        const more = plan.items.filter((i) => i.status !== 'same').length - 60;
        const u = plan.unknown || { kat: [], kue: [], ein: [] };
        const unk = u.kat.map((o) => 'Kategorie ' + o.label).concat(u.kue.map((o) => 'Küche ' + o.label), u.ein.map((e) => 'Einheit ' + e));
        X.showSheet(plan.kind === 'gerichte' ? 'Import prüfen: Gerichte' : 'Import prüfen: Plan',
          '<p><b>' + c.new + '</b> neu · <b>' + c.update + '</b> geändert · <b>' + c.same + '</b> unverändert · <b>' + c.skip + '</b> übersprungen</p>' +
          (plan.kind === 'plan' ? '<p class="set-note" style="margin:0 4px">' + plan.linked + ' mit einem Gericht verknüpft, ' + plan.free + ' freie Einträge</p>' : '') +
          (plan.warnings.length ? '<ul class="pv-warn">' + plan.warnings.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
          (unk.length ? '<label class="chk"><input type="checkbox" id="imp_addunknown" checked> In den Einstellungen anlegen: ' + esc(unk.join(', ')) + '</label>' : '') +
          (rows ? '<div class="pv-list">' + rows + (more > 0 ? '<p class="set-note">… und ' + more + ' weitere</p>' : '') + '</div>' : '<p class="set-note">Es gibt nichts zu importieren.</p>') +
          '<button class="btn primary wide press" type="button" data-a="impapply"' + (n ? '' : ' disabled') + '>Importieren (' + n + ')</button>' +
          '<button class="btn wide press" type="button" data-a="closesheet">Abbrechen</button>');
      }
      function checkImport() {
        const sh = X.S.sheet;
        const r = X.EPTransfer.parseJsonLoose((byId('imp_text') || {}).value);
        if (!r.ok) { X.toast(r.error, true); return; }
        const fmt = r.data && r.data.format;
        if (sh.kind === 'gerichte' && fmt === 'essensplaner-plan') { X.toast('Das ist ein Plan-Export. Bitte unter „Plan“ importieren.', true); return; }
        if (sh.kind === 'plan' && fmt === 'essensplaner-gerichte') { X.toast('Das ist ein Gerichte-Export. Bitte unter „Gerichte“ importieren.', true); return; }
        const plan = sh.kind === 'gerichte' ? TR.planRecipeImport(r.data) : TR.planPlanImport(r.data);
        if (plan.error) { X.toast(plan.error, true); return; }
        sh.plan = plan;
        previewSheet(plan);
      }
      async function applyImport() {
        const sh = X.S.sheet;
        const plan = sh && sh.plan;
        if (!plan || !X.needOnline()) return;
        const progress = (i, total) => X.toast('Importiere … ' + i + ' von ' + total, { duration: 30000 });
        const res = plan.kind === 'gerichte'
          ? await TR.applyRecipes(plan, { addUnknown: !!(byId('imp_addunknown') && byId('imp_addunknown').checked) }, progress)
          : await TR.applyPlan(plan, progress);
        X.closeSheet();
        X.render();
        if (res.failed.length) X.toast(res.done + ' importiert, ' + res.failed.length + ' fehlgeschlagen: ' + res.failed[0].name + ' (' + res.failed[0].error + ')', true);
        else X.toast('Import fertig: ' + plan.counts.new + ' neu, ' + plan.counts.update + ' geändert');
      }

      const actions = {
        expgerichte: () => exportSheet('gerichte'),
        expplan: () => exportSheet('plan'),
        impgerichte: () => importSheet('gerichte'),
        impplan: () => importSheet('plan'),
        copytext: () => copyText(),
        savetext: () => saveText(),
        impcheck: () => checkImport(),
        impapply: () => applyImport(),
        setaccent: (el) => { TH.setAccent(el.dataset.hue === '' ? null : +el.dataset.hue); X.render(); },
        customswatch: () => {
          const panel = byId('hue_panel');
          if (!panel) return;
          panel.hidden = !panel.hidden;
          if (!panel.hidden) applyHue(+byId('hue_slider').value);
        },
        setpage: (el) => { location.hash = 'einstellungen/' + el.dataset.p; },
        setback: () => { if (X.S.prevHash === '#einstellungen') history.back(); else location.hash = 'einstellungen'; },
        setfont: (el) => { TH.setFont(el.dataset.f); X.render(); },
        settheme: (el) => { TH.setTheme(el.dataset.t); X.render(); },
        cfgadd: (el) => addItem(el.dataset.list),
        cfgdel: (el) => delItem(el.dataset.list, el.dataset.key)
      };

      /* Eigene Farbe: wirkt sofort beim Ziehen und beim Tippen des Hexcodes, ohne die Seite neu aufzubauen */
      function applyHue(hue, from) {
        TH.setAccent(hue);
        const sl = byId('hue_slider');
        const hx = byId('hue_hex');
        const pv = byId('hue_preview');
        if (pv) pv.style.setProperty('--lh', hue);
        if (sl && from !== 'slider') sl.value = String(hue);
        if (hx && from !== 'hex') hx.value = TH.hueToHex(hue);
        if (hx) hx.classList.remove('invalid');
        document.querySelectorAll('.swatch-row .swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains('swatch-custom'))));
        const cs = document.querySelector('.swatch-custom');
        if (cs) { cs.style.setProperty('--lh', hue); cs.classList.add('is-set'); }
      }
      function onInput(t) {
        if (t.id === 'hue_slider') { applyHue(Number(t.value), 'slider'); return true; }
        if (t.id === 'hue_hex') {
          const text = t.value.trim();
          if (/^#?[0-9a-f]{6}$/i.test(text)) applyHue(TH.hexToHue(text), 'hex');
          else t.classList.toggle('invalid', text.length >= 6);
          return true;
        }
        return false;
      }
      return { view: view, actions: actions, onChange: onChange, onInput: onInput, PAGES: PAGES };
    }
  };
})(window);
