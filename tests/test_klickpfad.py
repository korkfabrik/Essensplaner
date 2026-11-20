"""Breiter Klicktest durch alle Bereiche: planen, frei eintragen, bearbeiten, gekocht, eingekauft, verschieben, Einkaufsliste, Rezepte, Auswertung, Einstellungen, Export."""
import os, sys, datetime as dt, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, ctx, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.ctx, T.sent
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000)
    ok('Woche rendert',J("document.querySelectorAll('.dayhead').length")>=5)
    J("document.querySelector('[data-a=wmodetoggle]').click()"); pg.wait_for_timeout(300)
    ok('Wochenmodus 7 Tage',J("document.querySelectorAll('.dayhead').length")==7)
    J("document.querySelector('[data-a=weeknext]').click()"); pg.wait_for_timeout(300)
    ok('Blättern + Heute-Knopf',J("!!document.querySelector('[data-a=wtoday]')"))
    J("document.querySelector('[data-a=wtoday]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=wmodetoggle]').click()"); pg.wait_for_timeout(300)
    ok('Zurück auf 5 Tage',J("document.querySelectorAll('.dayhead').length")>=5)
    # Planen mit Rezept
    n0=sent('calendar/event/create')
    J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
    ok('Picker offen, Fokus Suche',J("document.activeElement&&document.activeElement.id==='pq'"))
    pg.fill('#pq','Chili'); pg.wait_for_timeout(200)
    J("document.querySelector('#plist [data-a=pickrecipe]').click()"); pg.wait_for_timeout(700)
    ok('Rezept eingeplant',sent('calendar/event/create')==n0+1)
    # Frei
    J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
    pg.fill('#pq','Essen bei Oma'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    ok('Freier Eintrag per Enter',sent('calendar/event/create')==n0+2)
    # Eintrag bearbeiten
    n1=sent('calendar/event/update')
    J("document.querySelector('[data-a=entry][data-uid=w0]').click()"); pg.wait_for_timeout(400)
    ok('Eintrag-Fenster',J("!!document.getElementById('e_date')"))
    pg.select_option('#e_slot','mittag'); pg.fill('#e_note','Test'); J("document.querySelector('[data-a=entrysave]').click()"); pg.wait_for_timeout(600)
    ok('Eintrag gespeichert',sent('calendar/event/update')==n1+1, J("JSON.stringify((window.__sent||[]).filter(m=>m.type==='calendar/event/update').slice(-1)[0].event.description)"))
    # Kochen / Einkaufen
    J("document.querySelector('.chkbox').click()"); pg.wait_for_timeout(600)
    ok('Gekocht umschalten',sent('calendar/event/update')==n1+2)
    J("document.querySelector('.buybox')&&document.querySelector('.buybox').click()"); pg.wait_for_timeout(600)
    ok('Eingekauft umschalten',sent('calendar/event/update')==n1+3)
    # Löschen
    J("document.querySelector('[data-a=entry][data-uid=w0]').click()"); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=entrydel]').click()"); pg.wait_for_timeout(500)
    ok('Löschen zeigt Rückgängig',J("document.getElementById('toast').textContent.indexOf('Rückgängig')>=0"))
    pg.wait_for_timeout(6800)
    ok('Löschen nach Wartezeit gesendet',sent('calendar/event/delete')>=1)
    # Rezepte
    pg.goto(U+'#rezepte'); pg.wait_for_timeout(600)
    nr=J("document.querySelectorAll('[data-a=rdetail]').length"); ok('Rezeptliste',nr>=40,nr)
    pg.fill('#rq','lachs'); pg.wait_for_timeout(300)
    ok('Rezeptsuche',0<J("document.querySelectorAll('[data-a=rdetail]').length")<nr)
    J("document.querySelector('[data-a=rdetail]').click()"); pg.wait_for_timeout(400)
    ok('Rezeptdetail',J("!!document.querySelector('.sheet [data-a=editrecipe]')"))
    J("document.querySelector('.sheet [data-a=editrecipe]').click()"); pg.wait_for_timeout(400)
    ok('Rezept bearbeiten',J("!!document.getElementById('f_name')"))
    a0=sent('update_item')
    J("document.querySelector('[data-a=saverecipe]').click()"); pg.wait_for_timeout(700)
    ok('Rezept speichern',sent('update_item')>a0)
    J("document.querySelector('[data-a=newrecipe]')&&document.querySelector('[data-a=newrecipe]').click()"); pg.wait_for_timeout(400)
    pg.fill('#f_name','Testgericht Neu'); 
    a1=sent('add_item'); J("document.querySelector('[data-a=saverecipe]').click()"); pg.wait_for_timeout(700)
    ok('Neues Rezept',sent('add_item')>a1)
    # Auswertung
    pg.goto(U+'#auswertung'); pg.wait_for_timeout(600)
    ok('Auswertung',J("document.querySelector('#main').textContent.length")>200)
    # Einstellungen
    for pgname in ['verbindung','planung','rezeptdaten','einkauf','daten','darstellung']:
        pg.goto(U+'#einstellungen/'+pgname); pg.wait_for_timeout(400)
        ok('Einstellungen '+pgname,J("document.querySelector('#main').textContent.length")>100)
    pg.goto(U+'#einstellungen/daten'); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=expplan]').click()"); pg.wait_for_timeout(500)
    ok('Export Plan mit eingekauft',J("(document.querySelector('.sheet textarea')||{}).value||''").find('eingekauft')>=0)
    ok('Keine JS-Fehler',not errs,errs[:5])
