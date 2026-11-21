"""Ablage (Gerichte ohne Tag): ablegen auf drei Wegen, per Chip und beim Planen zuordnen, belegte Plätze, entfernen und rückgängig."""
import os, sys, datetime as dt, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, ctx, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.ctx, T.sent
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000)
    ok('Leiste anfangs weg',not J("!!document.querySelector('.abl:not(.empty)')"))
    # 1) Beim Planen: Haken "Eingekauft, Tag später"
    J("document.querySelector('.slotbtn[data-d=\"2026-11-16\"]').click()"); pg.wait_for_timeout(400)
    pg.fill('#pq','Bandnudeln'); pg.wait_for_timeout(200); pg.check('#pablage')
    J("document.querySelector('#plist [data-a=pickrecipe]').click()"); pg.wait_for_timeout(900)
    ok('In Ablage gelegt (Leiste da)',J("document.querySelectorAll('.abl-chip:not(.add)').length")==1, J("document.getElementById('toast').textContent"))
    # 2) Plus-Chip: freies Gericht
    J("document.querySelector('[data-a=abadd]').click()"); pg.wait_for_timeout(400)
    pg.fill('#pq','Fertigpizza'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    ok('Plus-Chip legt freies Gericht ab',J("document.querySelectorAll('.abl-chip:not(.add)').length")==2)
    # 3) Aus Plan verschieben nach Ablage (Chili ist eingekauft)
    bx=J("(()=>{const r=document.querySelector('.swipe[data-uid=w1] .ecard').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    x0=bx[0]+bx[2]*0.7; y0=bx[1]+bx[3]*0.5; pg.mouse.move(x0,y0); pg.mouse.down()
    for k in range(1,16): pg.mouse.move(x0-k*9, y0); pg.wait_for_timeout(16)
    pg.mouse.up(); pg.wait_for_timeout(600)
    ok('Belegt markiert',J("document.querySelectorAll('.mvslot.taken').length")>0)
    pg.screenshot(path=os.path.join(OUT,'move171.png'))
    J("document.querySelector('[data-a=moveablage]').click()"); pg.wait_for_timeout(1000)
    ok('Aus Plan in Ablage',J("document.querySelectorAll('.abl-chip:not(.add)').length")==3 and not J("!!document.querySelector('.swipe[data-uid=w1]')"))
    pg.screenshot(path=os.path.join(OUT,'abl-woche.png'))
    # 4) Chip antippen -> Tagesauswahl
    J("document.querySelector('.abl-chip').click()"); pg.wait_for_timeout(400)
    ok('Belegt beim Einplanen',J("document.querySelectorAll('.mvslot.taken').length")>0)
    ok('Chip öffnet Tagesauswahl',J("document.querySelectorAll('[data-a=abto]').length")>=5, J("(document.querySelector('.sheet h2')||{}).textContent"))
    pg.screenshot(path=os.path.join(OUT,'abl-assign.png'))
    J("document.querySelector('[data-a=abto][data-d=\"2026-11-17\"][data-slot=abend]').click()"); pg.wait_for_timeout(1200)
    ev=J("(()=>{const c=[...document.querySelectorAll('.ecard h2')].map(h=>h.textContent); return c})()")
    ok('Zugeordnet auf Dienstag',any('Bandnudeln' in x for x in ev) and J("document.querySelectorAll('.abl-chip:not(.add)').length")==2, ev)
    ok('Zugeordnetes Gericht ist eingekauft',J("(()=>{const h=[...document.querySelectorAll('.ecard')].find(c=>c.textContent.indexOf('Bandnudeln')>=0); return !!h.querySelector('.buybox.on')})()"))
    # 5) Picker zeigt Ablage oben
    J("document.querySelector('.slotbtn[data-d=\"2026-11-16\"]').click()"); pg.wait_for_timeout(500)
    ok('Picker: Ablage oben',J("document.querySelectorAll('#plist [data-a=pickablage]').length")==2 and J("document.querySelector('#plist').firstElementChild.className")=='plist-sec')
    pg.screenshot(path=os.path.join(OUT,'abl-picker.png'))
    J("document.querySelector('#plist [data-a=pickablage]').click()"); pg.wait_for_timeout(1200)
    ok('Aus Picker zugeordnet',J("document.querySelectorAll('.abl-chip:not(.add)').length")==1)
    # 6) Entfernen + Rückgängig
    J("document.querySelector('.abl-chip').click()"); pg.wait_for_timeout(400)
    J("document.querySelector('[data-a=abdel]').click()"); pg.wait_for_timeout(900)
    ok('Entfernt, Leiste weg',not J("!!document.querySelector('.abl:not(.empty)')"))
    J("document.querySelector('#toast button').click()"); pg.wait_for_timeout(900)
    ok('Rückgängig stellt wieder her',J("document.querySelectorAll('.abl-chip:not(.add)').length")==1)
    ok('Keine JS-Fehler',not errs,errs[:5])
