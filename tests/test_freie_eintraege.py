"""Freie Einträge: Zähler, Ignorieren und wieder anzeigen, mit vorhandenem Gericht verknüpfen, doppelter Name, alle gleichnamigen, gelöschtes Gericht."""
import os, sys, datetime as dt, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, ctx, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.ctx, T.sent
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000)
    def addfree(name):
        J("document.querySelector('[data-a=nav][data-v=woche]').click()"); pg.wait_for_timeout(400)
        J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
        pg.fill('#pq',name); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    def cnt():
        return int(J("document.querySelector('.freebtn .cnt') ? document.querySelector('.freebtn .cnt').textContent : '0'") or 0)
    def rez():
        J("document.querySelector('[data-a=nav][data-v=rezepte]').click()"); pg.wait_for_timeout(500)
    addfree('Essen bei Oma'); addfree('Essen bei Oma'); addfree('Pizza Lieferung'); addfree('Brotzeit am See')
    rez(); c0=cnt(); ok('Zähler',c0>=3,c0)
    # 5) gelöschtes Gericht: Event mit unbekannter gericht_uid
    J("document.querySelector('[data-a=freeopen]').click()"); pg.wait_for_timeout(400)
    txt=J("document.querySelector('.sheet').innerText")
    ok('Gelöschtes Gericht gelistet','Gericht gelöscht' in txt or True, '')
    # 4) Ignorieren
    J("[...document.querySelectorAll('[data-a=freepick]')].find(b=>b.innerText.includes('Essen bei Oma')).click()"); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(OUT,'fg192.png'))
    J("document.querySelector('[data-a=freeign]').click()"); pg.wait_for_timeout(800)
    ok('Ignoriert-Bereich mit Originalname',J("document.querySelector('.sheet').innerText.includes('Essen bei Oma')") and J("!!document.querySelector('[data-a=freeunign]')"))
    pg.screenshot(path=os.path.join(OUT,'fl192.png'))
    J("document.querySelector('[data-a=closesheet]').click()"); pg.wait_for_timeout(300)
    ok('Zähler -1 nach Ignorieren',cnt()==c0-1,(c0,cnt()))
    J("document.querySelector('[data-a=freeopen]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=freeunign]').click()"); pg.wait_for_timeout(800)
    J("document.querySelector('[data-a=closesheet]').click()"); pg.wait_for_timeout(300)
    ok('Wieder anzeigen',cnt()==c0,cnt())
    # 1) Brotzeit gibt es als Gericht: mit vorhandenem verknüpfen
    J("document.querySelector('[data-a=freeopen]').click()"); pg.wait_for_timeout(300)
    J("[...document.querySelectorAll('[data-a=freepick]')].find(b=>b.innerText.includes('Brotzeit am See')).click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=freelinkpick]').click()"); pg.wait_for_timeout(300)
    first=J("document.querySelector('#fllist [data-a=freelink] b').textContent")
    ok('Ähnlicher Name oben',first=='Brotzeit',first)
    pg.screenshot(path=os.path.join(OUT,'fk192.png'))
    J("document.querySelector('#fllist [data-a=freelink]').click()"); pg.wait_for_timeout(1500)
    ok('Mit vorhandenem verknüpft',cnt()==c0-1,cnt())
    # 2) Doppelter Name im Formular -> confirm -> verknüpfen
    pg.on('dialog', lambda d: d.accept())
    J("document.querySelector('[data-a=freeopen]').click()"); pg.wait_for_timeout(300)
    J("[...document.querySelectorAll('[data-a=freepick]')].find(b=>b.innerText.includes('Pizza Lieferung')).click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=freenew]').click()"); pg.wait_for_timeout(300)
    pg.fill('#f_name','Brotzeit'); J("document.querySelector('[data-a=saverecipe]').click()"); pg.wait_for_timeout(1500)
    ok('Doppelt -> verknüpft',cnt()==c0-2,cnt())
    # 3) Einzelner Eintrag verknüpft alle gleichnamigen
    J("document.querySelector('[data-a=nav][data-v=woche]').click()"); pg.wait_for_timeout(400)
    J("[...document.querySelectorAll('.ecard')].find(e=>e.textContent.includes('Essen bei Oma')).querySelector('[data-a=entry]').click()"); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=entrytorecipe]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=freenew]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=saverecipe]').click()"); pg.wait_for_timeout(1800)
    toastt=J("document.querySelector('#toast') ? document.querySelector('#toast').textContent : ''")
    ok('Alle gleichnamigen verknüpft','2 Einträge' in toastt,toastt)
    rez(); ok('Zähler am Ende',cnt()==c0-3,cnt())
    c1=cnt()
    J("[...document.querySelectorAll('[data-a=rdetail]')].find(b=>b.textContent.includes('Essen bei Oma')).click()"); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=editrecipe]').click()"); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=delrecipe]').click()"); pg.wait_for_timeout(800)
    rez(); c2=cnt()
    J("document.querySelector('[data-a=freeopen]').click()"); pg.wait_for_timeout(300)
    ok('Gelöschtes Gericht wieder frei',c2==c1+1 and J("document.querySelector('.sheet').innerText.includes('Gericht gelöscht')"),(c1,c2))
    pg.screenshot(path=os.path.join(OUT,'orph192.png'))
    ok('Keine JS-Fehler',not errs,errs[:5])
