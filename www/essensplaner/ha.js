/* Kleiner Home-Assistant-Client: WebSocket mit Auto-Reconnect plus REST-Zugriff.
   Der Zugriffstoken kommt aus einer Funktion (tokenFn), die ihn bei Bedarf erneuert. */
(function (global) {
  'use strict';

  class HAClient {
    constructor() {
      this.ws = null;
      this.nextId = 1;
      this.pending = new Map();
      this.subs = [];
      this.status = 'idle'; // idle | unconfigured | connecting | online | offline | auth_error
      this.url = '';
      this.tokenFn = null;
      this.listeners = [];
      this.retry = 0;
      this.timer = null;
      this.manual = false;
      this.readyPromise = null;
      this.onSubError = null;
      this.authRetried = false;
      this.forceRefresh = false;
    }

    onStatus(fn) { this.listeners.push(fn); }

    setStatus(s) {
      if (this.status === s) return;
      this.status = s;
      this.listeners.forEach((f) => { try { f(s); } catch (e) { console.error(e); } });
    }

    configure(url, tokenFn) {
      this.url = (url || '').trim().replace(/\/+$/, '');
      this.tokenFn = tokenFn || null;
    }

    connect() {
      if (!this.url || !this.tokenFn) { this.setStatus('unconfigured'); return Promise.resolve(false); }
      this.manual = false;
      clearTimeout(this.timer);
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1) && this.readyPromise) {
        return this.readyPromise;
      }
      this.setStatus('connecting');
      this.readyPromise = new Promise((resolve) => {
        let ws;
        try {
          ws = new WebSocket(this.url.replace(/^http/i, 'ws') + '/api/websocket');
        } catch (e) {
          this.setStatus('offline');
          this._schedule();
          resolve(false);
          return;
        }
        this.ws = ws;
        let settled = false;
        const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };

        ws.onmessage = (ev) => {
          let m;
          try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.type === 'auth_required') {
            const force = this.forceRefresh;
            this.forceRefresh = false;
            Promise.resolve().then(() => this.tokenFn(force)).then((token) => {
              if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'auth', access_token: token }));
            }).catch((e) => {
              if (e && e.authFailed) { this.manual = true; this.setStatus('auth_error'); }
              try { ws.close(); } catch (e2) { /* ignorieren */ }
              done(false);
            });
          } else if (m.type === 'auth_ok') {
            this.retry = 0;
            this.authRetried = false;
            this.setStatus('online');
            this.subs.forEach((s) => this._sendSub(s));
            done(true);
          } else if (m.type === 'auth_invalid') {
            if (!this.authRetried) {
              // Einmal mit frisch erneuertem Token neu verbinden
              this.authRetried = true;
              this.forceRefresh = true;
              this.retry = 0;
            } else {
              this.manual = true;
              this.setStatus('auth_error');
            }
            try { ws.close(); } catch (e) { /* ignorieren */ }
            done(false);
          } else if (m.type === 'result' || m.type === 'pong') {
            const p = this.pending.get(m.id);
            if (!p) return;
            this.pending.delete(m.id);
            if (m.type === 'pong' || m.success) p.resolve(m.result);
            else p.reject(new Error((m.error && m.error.message) || 'Unbekannter Fehler'));
          } else if (m.type === 'event') {
            this.subs.forEach((s) => { if (s.id === m.id) s.cb(m.event); });
          }
        };
        ws.onclose = () => {
          if (this.ws !== ws) return;
          this.pending.forEach((p) => p.reject(new Error('Verbindung getrennt')));
          this.pending.clear();
          if (!this.manual) { this.setStatus('offline'); this._schedule(); }
          done(false);
        };
        ws.onerror = () => { /* onclose folgt */ };
      });
      return this.readyPromise;
    }

    _schedule() {
      clearTimeout(this.timer);
      const wait = Math.min(30000, 2000 * Math.pow(2, this.retry++));
      this.timer = setTimeout(() => this.connect(), wait);
    }

    disconnect() {
      this.manual = true;
      clearTimeout(this.timer);
      this.subs = [];
      const ws = this.ws;
      this.ws = null;
      this.readyPromise = null;
      if (ws) { try { ws.close(); } catch (e) { /* ignorieren */ } }
      this.pending.forEach((p) => p.reject(new Error('Verbindung getrennt')));
      this.pending.clear();
      this.status = 'idle';
      this.authRetried = false;
    }

    /* Beim Zurückkehren in die App: Verbindung prüfen oder neu aufbauen. */
    ensure() {
      if (!this.url || !this.tokenFn || this.status === 'auth_error') return;
      if (this.status === 'online' && this.ws && this.ws.readyState === 1) {
        this.request({ type: 'ping' }, 4000).catch(() => {
          const ws = this.ws;
          this.readyPromise = null;
          if (ws) { try { ws.close(); } catch (e) { /* ignorieren */ } }
        });
      } else if (this.status !== 'connecting') {
        this.retry = 0;
        this.connect();
      }
    }

    request(msg, timeout) {
      return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== 1 || this.status !== 'online') {
          reject(new Error('Keine Verbindung zu Home Assistant'));
          return;
        }
        const id = this.nextId++;
        const t = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('Zeitüberschreitung bei der Anfrage'));
        }, timeout || 20000);
        this.pending.set(id, {
          resolve: (r) => { clearTimeout(t); resolve(r); },
          reject: (e) => { clearTimeout(t); reject(e); }
        });
        this.ws.send(JSON.stringify(Object.assign({}, msg, { id })));
      });
    }

    callService(domain, service, data, entityId) {
      const msg = { type: 'call_service', domain, service, service_data: data || {} };
      if (entityId) msg.target = { entity_id: entityId };
      return this.request(msg);
    }

    subscribe(msg, cb) {
      const s = { msg, cb, id: 0 };
      this.subs.push(s);
      if (this.status === 'online' && this.ws && this.ws.readyState === 1) this._sendSub(s);
      return () => { this.subs = this.subs.filter((x) => x !== s); };
    }

    _sendSub(s) {
      s.id = this.nextId++;
      const ws = this.ws;
      this.pending.set(s.id, {
        resolve: () => {},
        // Abbruch durch Verbindungsverlust meldet nichts, der Reconnect abonniert neu
        reject: (e) => { if (this.ws === ws && this.status === 'online' && this.onSubError) this.onSubError(e, s.msg); }
      });
      ws.send(JSON.stringify(Object.assign({}, s.msg, { id: s.id })));
    }

    async rest(path) {
      const token = await this.tokenFn(false);
      const r = await fetch(this.url + path, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' bei ' + path.split('?')[0]);
      return r.json();
    }

    async restPost(path, body) {
      const token = await this.tokenFn(false);
      const r = await fetch(this.url + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      let j = null;
      try { j = await r.json(); } catch (e) { /* keine JSON-Antwort */ }
      if (!r.ok) {
        const err = new Error((j && j.message) || ('HTTP ' + r.status + ' bei ' + path));
        err.status = r.status;
        throw err;
      }
      return j;
    }
  }

  global.HAClient = HAClient;
})(window);
