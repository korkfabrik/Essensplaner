/* Export und Import von Gerichten und Plan als JSON. Gedacht auch für KIs: Export geben, Ergebnis wieder importieren.
   Die Planung (Vorschau) ist frei von Seiteneffekten. Geschrieben wird erst in apply*. */
(function (global) {
  'use strict';

  const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const UNIT_SYN = {
    gramm: 'g', gr: 'g', kilogramm: 'kg', kilo: 'kg', liter: 'l', milliliter: 'ml', stück: 'stk', stueck: 'stk', st: 'stk', stk: 'stk',
    esslöffel: 'el', essloeffel: 'el', teelöffel: 'tl', teeloeffel: 'tl', packung: 'pck', päckchen: 'pck', paeckchen: 'pck', pkg: 'pck', pck: 'pck',
    dosen: 'dose', bunde: 'bund', prisen: 'prise'
  };
  const AUFWAND_TXT = { einfach: 1, leicht: 1, mittel: 2, normal: 2, aufwendig: 3, 'aufwändig': 3, schwer: 3 };
  const STATUS_DONE = ['gekocht', 'erledigt', 'done', 'cooked'];

  /* Erkennt JSON auch in KI-Antworten mit Codeblock oder Begleittext */
  function parseJsonLoose(text) {
    let t = String(text || '').trim();
    if (!t) return { ok: false, error: 'Das Feld ist leer.' };
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    try { return { ok: true, data: JSON.parse(t) }; } catch (e1) {
      const starts = [t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0);
      const a = starts.length ? Math.min.apply(null, starts) : -1;
      const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (a >= 0 && b > a) {
        try { return { ok: true, data: JSON.parse(t.slice(a, b + 1)) }; } catch (e2) { return { ok: false, error: 'Kein gültiges JSON: ' + e2.message }; }
      }
      return { ok: false, error: 'Kein gültiges JSON: ' + e1.message };
    }
  }

  function init(X) {
    const S = X.S;
    const today = () => X.ymd(new Date());
    const has = (e, ks) => ks.find((k) => Object.prototype.hasOwnProperty.call(e, k));
    const parseNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')));

    function matchKey(v, list) {
      const x = lc(v);
      if (!x) return null;
      const hit = list.find((o) => lc(o.key) === x || lc(o.label) === x || X.slugify(o.label) === X.slugify(x));
      return hit ? hit.key : null;
    }
    function unitKnown(u) { const x = lc(u).replace(/\.$/, ''); return S.config.einheiten.indexOf(x) >= 0 || !!UNIT_SYN[x]; }
    function normUnit(u) {
      const x = lc(u).replace(/\.$/, '');
      if (!x) return { key: '' };
      if (S.config.einheiten.indexOf(x) >= 0) return { key: x };
      const syn = UNIT_SYN[x];
      if (syn) return S.config.einheiten.indexOf(syn) >= 0 ? { key: syn } : { key: syn, unknown: true };
      return { key: x.replace(/\s+/g, ''), unknown: true };
    }
    function normIngredient(z, unknown) {
      if (typeof z === 'string') {
        const m = z.trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÄÖÜäöüß.]+)?\s+(.+)$/);
        if (m) {
          if (m[2] && !unitKnown(m[2])) z = { menge: m[1], einheit: '', name: m[2] + ' ' + m[3] };
          else z = { menge: m[1], einheit: m[2], name: m[3] };
        } else z = { name: z.trim() };
      }
      if (!z || typeof z !== 'object') return null;
      const name = String(z.name || z.zutat || '').trim();
      if (!name) return null;
      let menge = parseNum(z.menge != null ? z.menge : z.amount);
      menge = menge > 0 ? Math.round(menge * 1000) / 1000 : 0;
      const u = normUnit(z.einheit != null ? z.einheit : z.unit);
      if (u.unknown) unknown.ein.add(u.key);
      const out = { name: name, menge: menge, einheit: u.key };
      if (z.optional === true || lc(z.optional) === 'true') out.optional = true;
      return out;
    }

    /* ---------- Gerichte ---------- */
    function recipeFields(r) {
      return { kategorie: r.kategorie, kueche: r.kueche, aufwand: r.aufwand, portionen: r.portionen, dauer_min: r.dauer, zutaten: r.zutaten, tags: r.tags, bewertung: r.bewertung, favorit: r.favorit, notiz: r.notiz, rezept_url: r.url };
    }
    function canon(o) {
      return JSON.stringify({
        kategorie: o.kategorie || '', kueche: o.kueche || '', aufwand: +o.aufwand || 0, portionen: +o.portionen || 0, dauer_min: +o.dauer_min || 0,
        zutaten: (o.zutaten || []).map((z) => ({ name: String(z.name), menge: +z.menge || 0, einheit: String(z.einheit || ''), optional: !!z.optional })),
        tags: o.tags || [], bewertung: +o.bewertung || 0, favorit: !!o.favorit, notiz: o.notiz || '', rezept_url: o.rezept_url || ''
      });
    }
    function normRecipe(e, unknown) {
      const name = String(e.name || e.titel || e.gericht || '').trim();
      if (!name) return { error: 'Name fehlt' };
      const f = {};
      const warns = [];
      let k;
      if ((k = has(e, ['kategorie', 'category']))) {
        const raw = String(e[k] || '').trim();
        if (!raw) f.kategorie = '';
        else { const key = matchKey(raw, S.config.kategorien); if (key != null) f.kategorie = key; else { f.kategorie = X.slugify(raw); unknown.kat.set(f.kategorie, raw); } }
      }
      if ((k = has(e, ['kueche', 'küche', 'kuche', 'cuisine']))) {
        const raw = String(e[k] || '').trim();
        if (!raw) f.kueche = '';
        else { const key = matchKey(raw, S.config.kuechen); if (key != null) f.kueche = key; else { f.kueche = X.slugify(raw); unknown.kue.set(f.kueche, raw); } }
      }
      if ((k = has(e, ['aufwand', 'effort']))) {
        let v = e[k];
        if (typeof v === 'string' && AUFWAND_TXT[lc(v)]) v = AUFWAND_TXT[lc(v)];
        v = Math.round(+v);
        f.aufwand = v >= 1 && v <= 3 ? v : 0;
      }
      if ((k = has(e, ['portionen', 'servings']))) { const v = Math.round(parseNum(e[k])); if (v >= 1 && v <= 99) f.portionen = v; }
      if ((k = has(e, ['dauer_min', 'dauer', 'minuten']))) { const v = Math.round(parseNum(e[k])); f.dauer_min = v >= 0 && v <= 1440 ? v : 0; }
      if ((k = has(e, ['zutaten', 'ingredients']))) f.zutaten = (Array.isArray(e[k]) ? e[k] : []).map((z) => normIngredient(z, unknown)).filter(Boolean);
      if ((k = has(e, ['tags']))) f.tags = (Array.isArray(e[k]) ? e[k] : String(e[k] || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
      if ((k = has(e, ['bewertung', 'rating']))) { const v = Math.round(parseNum(e[k])); f.bewertung = v >= 0 && v <= 5 ? v : 0; }
      if ((k = has(e, ['favorit', 'favorite']))) f.favorit = e[k] === true || ['true', 'ja'].indexOf(lc(e[k])) >= 0;
      if ((k = has(e, ['notiz', 'notizen', 'notes']))) f.notiz = String(e[k] || '').trim();
      if ((k = has(e, ['rezept_url', 'url', 'link']))) {
        const u = String(e[k] || '').trim();
        if (!u || X.safeUrl(u)) f.rezept_url = u; else warns.push('Link bei „' + name + '“ ignoriert (nur http und https erlaubt)');
      }
      return { name: name, f: f, warns: warns };
    }

    function exportRecipes() {
      const c = S.config;
      const list = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map((r) => ({
        id: r.uid, name: r.name, kategorie: r.kategorie, kueche: r.kueche, aufwand: r.aufwand, portionen: r.portionen, dauer_min: r.dauer,
        zutaten: r.zutaten.map((z) => ({ name: z.name, menge: +z.menge || 0, einheit: z.einheit || '', optional: !!z.optional })),
        tags: r.tags, bewertung: r.bewertung, favorit: r.favorit, notiz: r.notiz, rezept_url: r.url
      }));
      return JSON.stringify({
        _anleitung: 'Export der App Essensplaner. Bearbeite oder ergänze nur die Liste „gerichte“ und gib sie als gültiges JSON in genau dieser Struktur zurück. Bei vorhandenen Gerichten die „id“ unverändert lassen, neue Gerichte ohne „id“ anlegen. Erlaubte Werte stehen unter „erlaubt“. Neue Kategorien, Küchen oder Einheiten sind möglich, sie werden beim Import angelegt. Zutaten haben „name“, „menge“ (Zahl, 0 ohne Menge), „einheit“ und optional „optional“: true.',
        format: 'essensplaner-gerichte', version: 1, erstellt: today(),
        erlaubt: { kategorie: c.kategorien.map((o) => o.key), kueche: c.kuechen.map((o) => o.key), einheit: c.einheiten, aufwand: '1 einfach, 2 mittel, 3 aufwendig', bewertung: '0 bis 5' },
        gerichte: list
      }, null, 2);
    }

    function planRecipeImport(data) {
      const list = Array.isArray(data) ? data : (data && (data.gerichte || data.rezepte || data.recipes));
      if (!Array.isArray(list)) return { error: 'Keine Liste „gerichte“ gefunden.' };
      const unknown = { kat: new Map(), kue: new Map(), ein: new Set() };
      const byUid = new Map(S.recipes.map((r) => [r.uid, r]));
      const byName = new Map(S.recipes.map((r) => [lc(r.name), r]));
      const seen = new Set();
      const claimed = new Map();
      const items = [];
      list.forEach((e, i) => {
        if (!e || typeof e !== 'object') { items.push({ status: 'skip', name: '(Eintrag ' + (i + 1) + ')', reason: 'Kein Objekt' }); return; }
        const n = normRecipe(e, unknown);
        if (n.error) { items.push({ status: 'skip', name: '(Eintrag ' + (i + 1) + ')', reason: n.error }); return; }
        let target = e.id != null ? byUid.get(String(e.id)) : null;
        let matchedBy = target ? 'id' : '';
        if (!target) { target = byName.get(lc(n.name)); if (target) matchedBy = 'name'; }
        const key = target ? 'u:' + target.uid : 'n:' + lc(n.name);
        if (seen.has(key)) { items.push({ status: 'skip', name: n.name, reason: 'Kommt in der Datei doppelt vor' }); return; }
        seen.add(key);
        const finalName = lc(target && lc(n.name) === lc(target.name) ? target.name : n.name);
        if (claimed.has(finalName) && claimed.get(finalName) !== key) {
          items.push({ status: 'skip', name: n.name, reason: 'Der Name wird in der Datei schon von einem anderen Gericht verwendet' });
          return;
        }
        claimed.set(finalName, key);
        if (target) {
          if (lc(n.name) !== lc(target.name) && byName.get(lc(n.name)) && byName.get(lc(n.name)) !== target) {
            items.push({ status: 'skip', name: n.name, reason: 'Der Name gehört schon zu einem anderen Gericht' });
            return;
          }
          const before = recipeFields(target);
          const merged = Object.assign({}, before, n.f);
          // Am Namen erkannt heißt: gleicher Name, nur vielleicht anders geschrieben. Umbenannt wird nur über die ID.
          const renamed = matchedBy === 'id' && n.name !== target.name;
          if (canon(merged) === canon(before) && !renamed) { items.push({ status: 'same', name: target.name, uid: target.uid, matchedBy: matchedBy }); return; }
          const raw = Object.assign({}, target.legacy ? {} : target.raw, { v: 1 }, merged);
          items.push({ status: 'update', name: n.name, oldName: target.name, uid: target.uid, rename: renamed, raw: raw, matchedBy: matchedBy, warns: n.warns });
        } else {
          const raw = Object.assign({
            v: 1, kategorie: '', kueche: '', aufwand: 0, portionen: S.config.standard_portionen, dauer_min: 0, zutaten: [], tags: [],
            bewertung: 0, favorit: false, notiz: '', rezept_url: '', erstellt: today()
          }, n.f);
          items.push({ status: 'new', name: n.name, raw: raw, warns: n.warns });
        }
      });
      const counts = { new: 0, update: 0, same: 0, skip: 0 };
      items.forEach((i) => { counts[i.status]++; });
      const label = (raw) => raw.charAt(0).toUpperCase() + raw.slice(1);
      return {
        kind: 'gerichte', items: items, counts: counts,
        unknown: {
          kat: Array.from(unknown.kat, (p) => ({ key: p[0], label: label(p[1]) })),
          kue: Array.from(unknown.kue, (p) => ({ key: p[0], label: label(p[1]) })),
          ein: Array.from(unknown.ein)
        },
        warnings: [].concat.apply([], items.map((i) => i.warns || []))
      };
    }

    async function applyRecipes(plan, opts, progress) {
      const u = plan.unknown;
      if (opts && opts.addUnknown && (u.kat.length || u.kue.length || u.ein.length)) {
        await X.patchConfig((c) => {
          u.kat.forEach((o) => { if (!c.kategorien.some((x) => x.key === o.key)) c.kategorien.push({ key: o.key, label: o.label }); });
          u.kue.forEach((o) => { if (!c.kuechen.some((x) => x.key === o.key)) c.kuechen.push({ key: o.key, label: o.label }); });
          u.ein.forEach((e) => { if (c.einheiten.indexOf(e) < 0) c.einheiten.push(e); });
          return true;
        }, true);
      }
      const todo = plan.items.filter((i) => i.status === 'new' || i.status === 'update');
      const failed = [];
      let done = 0;
      for (const it of todo) {
        try { await X.writeRecipe({ uid: it.uid, name: it.name, raw: it.raw, rename: it.rename }); done++; }
        catch (e) { failed.push({ name: it.name, error: e.message }); }
        if (progress) progress(done + failed.length, todo.length);
      }
      await X.reloadRecipes();
      return { done: done, failed: failed };
    }

    /* ---------- Plan ---------- */
    function exportPlan(scope) {
      const t = today();
      let evs = S.events.slice();
      if (scope === 'zukunft') evs = evs.filter((e) => e.date >= t);
      else if (scope === 'gekocht') evs = evs.filter((e) => e.status === 'gekocht');
      evs.sort((a, b) => a.date.localeCompare(b.date) || X.slotIdx(a.slot) - X.slotIdx(b.slot));
      return JSON.stringify({
        _anleitung: 'Export des Plans der App Essensplaner. Bearbeite oder ergänze nur die Liste „termine“ und gib sie als gültiges JSON in genau dieser Struktur zurück. Bei vorhandenen Terminen die „id“ unverändert lassen, neue Termine ohne „id“ anlegen. „gericht“ ist der Name, „gericht_id“ verknüpft mit einem Gericht aus dem Gerichte-Export (fehlt sie, wird nach dem Namen gesucht, sonst entsteht ein freier Eintrag). „datum“ als JJJJ-MM-TT. „mahlzeit“ und „status“ siehe „erlaubt“.',
        format: 'essensplaner-plan', version: 1, erstellt: t,
        erlaubt: { mahlzeit: S.config.slots.map((s) => s.key), status: ['geplant', 'gekocht'] },
        termine: evs.map((e) => ({ id: e.uid, datum: e.date, mahlzeit: e.slot, gericht: X.entryName(e), gericht_id: e.gericht_uid, status: e.status, portionen: e.portionen, notiz: e.notiz, eingekauft: !!e.eingekauft }))
      }, null, 2);
    }

    function validDate(s) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const p = s.split('-').map(Number);
      const d = new Date(p[0], p[1] - 1, p[2]);
      return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
    }

    function planPlanImport(data) {
      const list = Array.isArray(data) ? data : (data && (data.termine || data.plan || data.events));
      if (!Array.isArray(list)) return { error: 'Keine Liste „termine“ gefunden.' };
      const rByUid = new Map(S.recipes.map((r) => [r.uid, r]));
      const rByName = new Map(S.recipes.map((r) => [lc(r.name), r]));
      const eByUid = new Map(S.events.map((e) => [e.uid, e]));
      const eBySig = new Map(S.events.map((e) => [e.date + '|' + e.slot + '|' + lc(X.entryName(e)), e]));
      const firstSlot = (S.config.slots.find((s) => s.aktiv) || S.config.slots[0]).key;
      const seen = new Set();
      const items = [];
      const notFound = new Set();
      let outside = 0;
      list.forEach((e, i) => {
        const label = '(Eintrag ' + (i + 1) + ')';
        if (!e || typeof e !== 'object') { items.push({ status: 'skip', name: label, reason: 'Kein Objekt' }); return; }
        const date = String(e.datum || e.date || '').trim();
        const name0 = String(e.gericht || e.name || '').trim();
        if (!validDate(date)) { items.push({ status: 'skip', name: name0 || label, date: date, reason: 'Datum fehlt oder ist ungültig (JJJJ-MM-TT)' }); return; }
        let slot = firstSlot;
        const slotRaw = e.mahlzeit != null ? e.mahlzeit : e.slot;
        if (slotRaw != null && String(slotRaw).trim() !== '') {
          const hit = S.config.slots.find((s) => lc(s.key) === lc(slotRaw) || lc(s.label) === lc(slotRaw));
          if (!hit) { items.push({ status: 'skip', name: name0 || label, date: date, reason: 'Unbekannte Mahlzeit „' + slotRaw + '“' }); return; }
          slot = hit.key;
        }
        const gid = e.gericht_id != null && e.gericht_id !== '' ? String(e.gericht_id) : '';
        const recipe = (gid && rByUid.get(gid)) || (name0 && rByName.get(lc(name0))) || null;
        if (!recipe && !name0) { items.push({ status: 'skip', name: label, date: date, reason: 'Weder Gericht noch Gericht-ID angegeben' }); return; }
        const name = recipe ? recipe.name : name0;
        const status = STATUS_DONE.indexOf(lc(e.status)) >= 0 ? 'gekocht' : 'geplant';
        let portionen = Math.round(parseNum(e.portionen));
        if (!(portionen >= 0)) portionen = recipe ? recipe.portionen : S.config.standard_portionen;
        const notiz = String(e.notiz || '').trim();
        const sig = date + '|' + slot + '|' + lc(name);
        let target = e.id != null && e.id !== '' ? eByUid.get(String(e.id)) : null;
        let matchedBy = target ? 'id' : '';
        if (!target) { target = eBySig.get(sig); if (target) matchedBy = 'datum'; }
        const key = target ? 'u:' + target.uid : 's:' + sig;
        if (seen.has(key)) { items.push({ status: 'skip', name: name, date: date, reason: 'Kommt in der Datei doppelt vor' }); return; }
        seen.add(key);
        const meta = { v: 1, gericht_uid: recipe ? recipe.uid : null, slot: slot, status: status, portionen: portionen, notiz: notiz };
        if (e.eingekauft !== undefined) meta.eingekauft = !!e.eingekauft;
        const linked = !!recipe;
        if (S.range && (date < S.range.start || date > S.range.end)) outside++;
        if (target) {
          const same = target.date === date && target.slot === slot && target.status === status && (target.gericht_uid || null) === meta.gericht_uid &&
            target.portionen === portionen && target.notiz === notiz && X.entryName(target) === name;
          if (same) { items.push({ status: 'same', name: name, date: date, slot: slot, uid: target.uid, linked: linked, matchedBy: matchedBy }); return; }
          items.push({ status: 'update', name: name, date: date, slot: slot, uid: target.uid, meta: Object.assign({}, target.meta, meta), linked: linked, matchedBy: matchedBy });
        } else {
          if (!recipe) notFound.add(name0 || gid);
          items.push({ status: 'new', name: name, date: date, slot: slot, meta: meta, linked: linked });
        }
      });
      const counts = { new: 0, update: 0, same: 0, skip: 0 };
      items.forEach((i) => { counts[i.status]++; });
      const ok = items.filter((i) => i.status !== 'skip');
      const warnings = [];
      if (notFound.size) warnings.push('Kein passendes Gericht gefunden, wird als freier Eintrag angelegt: ' + Array.from(notFound).slice(0, 8).join(', ') + (notFound.size > 8 ? ' …' : ''));
      if (outside) warnings.push(outside + ' Termine liegen außerhalb des geladenen Zeitraums. Dort werden schon vorhandene Termine nicht erkannt.');
      return {
        kind: 'plan', items: items, counts: counts, warnings: warnings,
        linked: ok.filter((i) => i.linked).length, free: ok.filter((i) => !i.linked).length
      };
    }

    async function applyPlan(plan, progress) {
      const todo = plan.items.filter((i) => i.status === 'new' || i.status === 'update');
      const failed = [];
      let done = 0;
      for (const it of todo) {
        try { await X.writeEvent({ uid: it.uid, date: it.date, slot: it.slot, name: it.name, meta: it.meta }); done++; }
        catch (e) { failed.push({ name: it.name, error: e.message }); }
        if (progress) progress(done + failed.length, todo.length);
      }
      await X.loadEvents();
      return { done: done, failed: failed };
    }

    return { exportRecipes, planRecipeImport, applyRecipes, exportPlan, planPlanImport, applyPlan };
  }

  global.EPTransfer = { init: init, parseJsonLoose: parseJsonLoose };
})(window);
