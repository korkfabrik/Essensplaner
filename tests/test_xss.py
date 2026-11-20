"""Angriffstest: Schadtext (HTML, Event-Handler, javascript:-Links) in allen Feldern aus Home Assistant.
Erwartung: nichts wird ausgeführt, kein eingeschleustes Element landet im DOM. Ende: "LECKS: 0"."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start, load_state

_st = load_state()
recipes, events = _st['recipes'], _st['events']
P='"><img src=x onerror="window.__xss=(window.__xss||0)+1">\'><svg onload="window.__xss=1">'
import copy
for r_ in recipes:
    d=json.loads(r_['description']); r_['summary']=r_['summary']+P
    for z in d.get('zutaten',[]): z['name']=z['name']+P; z['einheit']=P
    d['kategorie']=d['kategorie']+P if hash(r_['uid'])%2 else d['kategorie']; d['kueche']=P; d['tags']=[P]; d['notiz']=P; d['rezept_url']='javascript:window.__xss=1'
    d['aufwand']=P if r_['uid']=='g3' else d.get('aufwand'); d['dauer_min']=P if r_['uid']=='g4' else d.get('dauer_min'); d['bewertung']=P if r_['uid']=='g5' else 3
    r_['description']=json.dumps(d)
for i,e in enumerate(events):
    d=json.loads(e['description']); d['notiz']=P; d['portionen']=P if i%5==0 else d.get('portionen',4)
    if i%7==0: d.pop('gericht_uid',None); e['summary']=e['summary']+P
    e['description']=json.dumps(d)
events.append({'uid':'x1"><img src=x>','summary':'Frei'+P,'start':'2026-11-16T18:00:00','end':'2026-11-16T19:00:00','description':json.dumps({'slot':P,'status':'geplant','notiz':P})})
events.append({'uid':'x2','summary':'Kurz','start':'"><b id=x>','end':'2026-11-16','description':'{}'})
events.append({'uid':'x3','summary':'Text'+P,'start':'2026-11-15T18:00:00','end':'2026-11-15T19:00:00','description':P})
CFG={'v':1,'kategorien':[{'key':'fleisch','label':'Fleisch'+P},{'key':'veg'+P,'label':P}],'kuechen':[{'key':'deutsch','label':P}],'einheiten':['g',P],'slots':[{'key':'mittag','label':'Mittag'+P,'start':'12:00','ende':'13:00','aktiv':True},{'key':'abend','label':'Abend','start':'18:00','ende':'19:00','aktiv':True}],'standard_portionen':4,'vorrat_nie':[P],'vorrat_opt':[P]}
def _patch(js):
    js = js.replace("attributes:{friendly_name:'Einkaufsliste'}", "attributes:{friendly_name:'Eink<img src=x onerror=window.__xss=1>'}")
    return js.replace("{uid:'b3',summary:'Milch'", "{uid:'b3',summary:'Milch<img src=x onerror=window.__xss=1>'")

with start({'recipes': recipes, 'events': events, 'config': CFG}, patch=_patch) as T:
    pg, U, errs = T.pg, T.U, T.errs
    bad=[]
    def chk(step):
        r=pg.evaluate("({x:window.__xss||0,n:document.querySelectorAll('img[src=\"x\"],svg[onload],b#x,[onerror]').length,js:document.querySelectorAll('a[href^=\"javascript\"]').length})")
        if r['x'] or r['n'] or r['js']: bad.append((step,r))
        print(('OK   ' if not (r['x'] or r['n'] or r['js']) else 'LECK ')+step, '' if not (r['x'] or r['n'] or r['js']) else r)
    J=lambda js: pg.evaluate(js)
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000); chk('Woche 5 Tage'); print('Schadtext als Text sichtbar (Woche):',pg.evaluate("(document.querySelector('#main').textContent.match(/onerror=/g)||[]).length"))
    J("document.querySelector('[data-a=wmodetoggle]').click()"); pg.wait_for_timeout(300); chk('Woche 7 Tage')
    J("document.querySelector('[data-a=weeknext]').click()"); pg.wait_for_timeout(300); chk('nächste Woche')
    J("document.querySelector('[data-a=wtoday]').click()"); pg.wait_for_timeout(300)
    J("(document.querySelector('.slotbtn')||{click(){}}).click()"); pg.wait_for_timeout(400); chk('Picker mit Vorschlägen')
    J("(()=>{const q=document.getElementById('pq'); if(q){q.value='<img src=x onerror=window.__xss=1>\"'; q.dispatchEvent(new Event('input',{bubbles:true}));}})()"); pg.wait_for_timeout(300); chk('Picker Suchtext')
    J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(300)
    for i in range(J("document.querySelectorAll('[data-a=entry]').length")):
        J("document.querySelectorAll('[data-a=entry]')[%d].click()"%i); pg.wait_for_timeout(250); chk('Eintrag-Fenster %d'%i)
        J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(200)
        if i>=5: break
    for i in range(min(3,J("document.querySelectorAll('.ecard .zut').length"))):
        J("document.querySelectorAll('.ecard .zut')[%d].click()"%i); pg.wait_for_timeout(300); chk('Rezeptdetail aus Woche %d'%i)
        J("(document.querySelector('.sheet [data-a=editrecipe]')||{click(){}}).click()"); pg.wait_for_timeout(300); chk('Rezeptformular %d'%i)
        J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(200)
    J("(document.querySelector('.hdr [data-a=shop]')||{click(){}}).click()"); pg.wait_for_timeout(800); chk('Einkaufsliste')
    J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(200)
    pg.goto(U+'#rezepte'); pg.wait_for_timeout(600); chk('Rezeptliste'); print('Schadtext als Text sichtbar (Rezepte):',pg.evaluate("(document.querySelector('#main').textContent.match(/onerror=/g)||[]).length"))
    for i in [0,3,4,5]:
        J("document.querySelectorAll('[data-a=rdetail]')[%d].click()"%i); pg.wait_for_timeout(300); chk('Rezeptdetail %d'%i)
        J("(document.querySelector('.sheet [data-a=editrecipe]')||{click(){}}).click()"); pg.wait_for_timeout(300); chk('Rezeptformular Liste %d'%i)
        J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(200)
    pg.goto(U+'#auswertung'); pg.wait_for_timeout(600); chk('Auswertung')
    for n_ in ['','verbindung','planung','rezeptdaten','einkauf','daten','darstellung']:
        pg.goto(U+'#einstellungen'+('/'+n_ if n_ else '')); pg.wait_for_timeout(500); chk('Einstellungen '+(n_ or 'Start'))
    pg.goto(U+'#einstellungen/verbindung'); pg.wait_for_timeout(400)
    J("(document.querySelector('[data-a=testconn]')||{click(){}}).click()"); pg.wait_for_timeout(900); chk('Verbindungstest')
    pg.goto(U+'#einstellungen/daten'); pg.wait_for_timeout(400)
    for kind,payload in [('impgerichte',{'gerichte':[{'name':'Imp'+P,'kategorie':P,'kueche':P,'zutaten':[{'name':P,'einheit':P,'menge':P}],'tags':[P]}]}),('impplan',{'termine':[{'datum':'2026-11-20','mahlzeit':P,'gericht':'X'+P,'notiz':P},{'datum':P,'gericht':P},{'datum':'2026-11-21','gericht':'Y'+P}]})]:
        J("document.querySelector('[data-a=%s]').click()"%kind); pg.wait_for_timeout(400)
        pg.evaluate("(t)=>{const a=document.querySelector('.sheet textarea'); a.value=t; a.dispatchEvent(new Event('input',{bubbles:true}));}",json.dumps(payload))
        J("(document.querySelector('[data-a=impcheck]')||{click(){}}).click()"); pg.wait_for_timeout(600); chk('Import-Vorschau '+kind)
        J("(document.querySelector('[data-a=closesheet]')||{click(){}}).click()"); pg.wait_for_timeout(300)
    print('JS-Fehler:',errs[:6]); print('LECKS:',len(bad))
    T.ok('Keine Lecks', not bad, bad[:3])
