"""Freier Eintrag im Plan: "Zu Gericht machen", neues Gericht anlegen, Eintrag ist danach verknüpft."""
import os, sys, datetime as dt, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, ctx, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.ctx, T.sent
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000)
    J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
    pg.fill('#pq','Essen bei Oma'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    found=False
    n=J("document.querySelectorAll('[data-a=entry]').length")
    for k in range(n):
        J("document.querySelectorAll('[data-a=entry]')[%d].click()"%k); pg.wait_for_timeout(250)
        if J("!!document.querySelector('[data-a=entrytorecipe]')"): found=True; break
        J("document.querySelector('[data-a=closesheet]').click()"); pg.wait_for_timeout(250)
    ok('Knopf bei freiem Eintrag',found)
    nm=J("document.querySelector('#e_name').value")
    J("document.querySelector('[data-a=entrytorecipe]').click()"); pg.wait_for_timeout(300)
    ok('Auswahl mit drei Wegen',J("!!document.querySelector('[data-a=freenew]') && !!document.querySelector('[data-a=freelinkpick]') && !!document.querySelector('[data-a=freeign]')"))
    J("document.querySelector('[data-a=freenew]').click()"); pg.wait_for_timeout(300)
    ok('Formular mit Namen',J("document.querySelector('#f_name').value")==nm,nm)
    pg.screenshot(path=os.path.join(OUT,'torecipe.png'))
    J("document.querySelector('[data-a=saverecipe]').click()"); pg.wait_for_timeout(1500)
    J("[...document.querySelectorAll('.ecard')].find(e=>e.textContent.includes(%s)).querySelector('[data-a=entry]').click()"%repr(nm)); pg.wait_for_timeout(400)
    ok('Eintrag zeigt jetzt Rezept anzeigen',J("!!document.querySelector('.sheet [data-a=rdetail]')") and not J("!!document.querySelector('.sheet [data-a=entrytorecipe]')"))
    ok('Eintrag jetzt verknüpft',J("[...document.querySelectorAll('.ecard')].some(e=>e.textContent.includes(%s))"%repr(nm)))
    ok('Keine JS-Fehler',not errs,errs[:5])
