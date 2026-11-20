"""CSP-Test mit echtem Server (aiohttp, echter WebSocket, Pfad /local/essensplaner/ wie in HA).
Prüft: keine CSP-Verstöße, Service Worker registriert, eingeschleustes Inline-Skript und fremde Verbindung werden blockiert.
Braucht: pip install aiohttp. Port 8765."""
import asyncio, json, threading
from aiohttp import web
from playwright.sync_api import sync_playwright
import os
ROOT=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','www','essensplaner'))
got={'ws':0,'auth':0}
async def ws(request):
    w=web.WebSocketResponse(); await w.prepare(request); got['ws']+=1
    await w.send_json({'type':'auth_required'})
    async for m in w:
        d=json.loads(m.data)
        if d.get('type')=='auth': got['auth']+=1; await w.send_json({'type':'auth_ok'})
        elif d.get('type')=='get_states': await w.send_json({'id':d['id'],'type':'result','success':True,'result':[]})
        elif d.get('type')=='todo/item/subscribe':
            await w.send_json({'id':d['id'],'type':'result','success':True,'result':None}); await w.send_json({'id':d['id'],'type':'event','event':{'items':[]}})
        elif d.get('type')=='todo/item/list': await w.send_json({'id':d['id'],'type':'result','success':True,'result':{'items':[]}})
        else: await w.send_json({'id':d.get('id'),'type':'result','success':True,'result':None})
    return w
async def cal(request): return web.json_response([])
def run(loop):
    asyncio.set_event_loop(loop)
    app=web.Application(); app.router.add_get('/api/websocket',ws); app.router.add_get('/api/calendars/{e}',cal); app.router.add_static('/local/essensplaner/',ROOT)
    r=web.AppRunner(app); loop.run_until_complete(r.setup()); loop.run_until_complete(web.TCPSite(r,'127.0.0.1',8765).start()); loop.run_forever()
loop=asyncio.new_event_loop(); threading.Thread(target=run,args=(loop,),daemon=True).start()
import time; time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844})
    ctx.add_init_script("localStorage.setItem('essensplaner_auth',JSON.stringify({access_token:'x',refresh_token:'y',expires:Date.now()+3600000}));window.__v=[];document.addEventListener('securitypolicyviolation',e=>window.__v.push(e.violatedDirective+' '+e.blockedURI));")
    pg=ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    U='http://localhost:8765/local/essensplaner/index.html'
    for h in ['#woche','#rezepte','#auswertung','#einstellungen','#einstellungen/darstellung','#einstellungen/verbindung']:
        pg.goto(U+h); pg.wait_for_timeout(900)
    pg.goto(U+'#woche'); pg.wait_for_timeout(600)
    print('WS-Verbindungen:',got,'Verstöße:',pg.evaluate('window.__v'),'Fehler:',errs[:5])
    print('Wochenplan sichtbar:',pg.evaluate("document.querySelectorAll('.dayhead').length"),'SW aktiv:',pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
    pg.wait_for_timeout(2500); print('SW später:',pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r?(r.active?'aktiv':'registriert'):'keine')"),'Verstöße:',pg.evaluate('window.__v')); print('Schrift:',pg.evaluate("document.fonts.check('16px Figtree')"))
    v0 = pg.evaluate('window.__v')
    # Gegenprobe: eingeschleustes Inline-Skript und fremde Verbindung müssen blockiert werden
    pg.evaluate("(()=>{const d=document.createElement('div'); d.innerHTML='<img src=x onerror=\"window.__pwn=1\">'; document.body.appendChild(d);})()"); pg.wait_for_timeout(400)
    r=pg.evaluate("fetch('https://example.com/').then(()=>'durchgelassen').catch(()=> 'blockiert')")
    print('Inline-Handler ausgeführt:',pg.evaluate('window.__pwn||0'),'| Fremde Verbindung:',r)
    ok = not v0 and not pg.evaluate('window.__pwn||0') and r == 'blockiert'
    b.close()
    print('ERGEBNIS:', 'OK' if ok else 'FEHLER')
    import sys; sys.exit(0 if ok else 1)
