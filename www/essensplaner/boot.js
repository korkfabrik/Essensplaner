/* Startschutz: läuft vor der App. Startet sie nicht, räumt er Service Worker und Cache
   der App auf und lädt einmal neu. Klappt auch das nicht, erscheint eine Meldung mit
   Knopf statt einer leeren Seite. Der Service Worker des HA-Frontends bleibt unberührt. */
(function () {
  var FLAG = 'essensplaner_recovered';
  var shown = false;
  var scope = location.pathname.replace(/[^/]*$/, '');
  var FILES = ['index.html', 'theme.js', 'version.js', 'boot.js', 'ha.js', 'swipe.js', 'transfer.js', 'settings.js', 'app.js', 'styles.css', 'manifest.json', 'sw.js'];

  function flag(v) {
    try {
      if (v === undefined) return sessionStorage.getItem(FLAG);
      if (v === null) sessionStorage.removeItem(FLAG); else sessionStorage.setItem(FLAG, v);
    } catch (e) { /* ignorieren */ }
    return null;
  }

  function reset() {
    var done = function () { location.replace(location.pathname + '?reload=' + Date.now()); };
    var p = Promise.resolve();
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      p = p.then(function () { return navigator.serviceWorker.getRegistrations(); }).then(function (regs) {
        return Promise.all(regs.filter(function (r) { return new URL(r.scope).pathname.indexOf(scope) === 0; })
          .map(function (r) { return r.unregister(); }));
      });
    }
    if (window.caches) {
      p = p.then(function () { return caches.keys(); }).then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf('essensplaner-') === 0; })
          .map(function (k) { return caches.delete(k); }));
      });
    }
    // Browser-Cache der App-Dateien auffrischen (HA liefert /local mit langer Cache-Dauer aus)
    p = p.then(function () {
      return Promise.all(FILES.map(function (f) { return fetch(f, { cache: 'reload' }).catch(function () {}); }));
    });
    p.then(done, done);
  }
  window.__epReset = reset;

  function showError(text) {
    if (shown) return;
    shown = true;
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;display:grid;place-content:center;gap:16px;padding:32px;text-align:center;font:16px system-ui,sans-serif;background:#F5F6F8;color:#111827;z-index:99';
    var p = document.createElement('p');
    p.textContent = 'Der Essensplaner konnte nicht starten. ' + (text || '') + (window.APP_VERSION ? ' (Version ' + window.APP_VERSION + ')' : '');
    var b = document.createElement('button');
    b.textContent = 'Zurücksetzen und neu laden';
    b.style.cssText = 'padding:14px 20px;border:0;border-radius:12px;background:#2563EB;color:#fff;font:inherit;font-weight:600';
    b.onclick = function () { flag(null); reset(); };
    var a = document.createElement('a');
    a.href = 'diag.html';
    a.textContent = 'Diagnose öffnen';
    a.style.cssText = 'color:#1D4ED8';
    box.appendChild(p); box.appendChild(b); box.appendChild(a);
    (document.body || document.documentElement).appendChild(box);
  }

  function failed(text) {
    if (window.__epReady || shown) return;
    if (flag() === null) { flag('1'); reset(); }
    else showError(text);
  }

  window.addEventListener('error', function (e) { failed(e && e.message); });
  window.addEventListener('unhandledrejection', function (e) { failed(e && e.reason && e.reason.message); });
  setTimeout(function () { failed('Keine Antwort nach 10 Sekunden.'); }, 10000);
  window.addEventListener('essensplaner-ready', function () { window.__epReady = true; flag(null); });
})();
