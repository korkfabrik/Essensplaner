"""Gemeinsamer Testaufbau: statischer Server für ../www/essensplaner, nachgebautes Home Assistant
(WebSocket und Kalender-REST im Browser ersetzt), Playwright-Chromium mit Handygröße 390x844.

Die Uhr im Browser steht fest auf Samstag, 14.11.2026, 12:00, passend zu den Testdaten.

Verwendung in einem Test:

    from harness import start
    with start() as T:
        pg, J, ok, errs, U, OUT = T.pg, T.J, T.ok, T.errs, T.U, T.OUT
        pg.goto(U + '#woche'); pg.wait_for_timeout(1000)
        ok('Etwas sichtbar', J("!!document.querySelector('.daysec')"))
"""
import contextlib
import datetime as dt
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', 'www', 'essensplaner'))
OUT = os.path.join(HERE, 'out')
FROZEN = dt.datetime(2026, 11, 14, 12, 0)


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def _serve():
    h = functools.partial(_Quiet, directory=ROOT)
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def fake_script(state=None, patch=None):
    """JS, das vor der App läuft und Home Assistant nachbildet. state: dict mit recipes, events, config."""
    if state is None:
        with open(os.path.join(HERE, 'fixtures', 'ha_state.json'), encoding='utf-8') as f:
            state = json.load(f)
    with open(os.path.join(HERE, 'fake_ha.js'), encoding='utf-8') as f:
        tpl = f.read()
    js = tpl.replace('__DATA__', json.dumps(state), 1)
    return patch(js) if patch else js


def load_state():
    with open(os.path.join(HERE, 'fixtures', 'ha_state.json'), encoding='utf-8') as f:
        return json.load(f)


class _T:
    pass


@contextlib.contextmanager
def start(state=None, viewport=(390, 844), dark=False, patch=None):
    """state: eigene HA-Daten statt fixtures/ha_state.json. patch: Funktion, die das Fake-JS verändert."""
    os.makedirs(OUT, exist_ok=True)
    srv = _serve()
    port = srv.server_address[1]
    results = []
    T = _T()
    T.OUT = OUT
    T.U = 'http://127.0.0.1:%d/index.html' % port
    T.errs = []
    T.results = results
    T.ok = lambda name, cond, info='': results.append((name, bool(cond), info))
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, device_scale_factor=2,
                            service_workers='block', color_scheme='dark' if dark else 'light')
        ctx.add_init_script(fake_script(state, patch))
        pg = ctx.new_page()
        pg.clock.install(time=FROZEN)
        pg.on('pageerror', lambda e: T.errs.append('PAGEERR ' + str(e)))
        pg.on('console', lambda m: T.errs.append(m.text) if m.type == 'error' else None)
        T.b, T.ctx, T.pg = b, ctx, pg
        T.J = lambda js: pg.evaluate(js)
        # Anzahl gesendeter Nachrichten an das nachgebaute HA, nach type oder Dienstname
        T.sent = lambda t: pg.evaluate("(t)=>(window.__sent||[]).filter(m=>m.type===t||(m.type==='call_service'&&m.service===t)).length", t)
        T.shot = lambda name: pg.screenshot(path=os.path.join(OUT, name))
        try:
            yield T
        finally:
            b.close()
            srv.shutdown()
    fails = [r for r in results if not r[1]]
    for n, c, i in results:
        print(('OK      ' if c else 'FEHLER  ') + n, '' if c else i)
    print('%d von %d OK' % (len(results) - len(fails), len(results)))
    if fails:
        sys.exit(1)
