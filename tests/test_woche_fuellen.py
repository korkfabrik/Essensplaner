"""Woche füllen: Vorschau, keine Dopplungen, Würfeln, Tag auslassen, Übernehmen, Alles rückgängig."""
import os, sys, datetime as dt, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, ctx, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.ctx, T.sent
    pg.goto(U+'#woche'); pg.wait_for_timeout(1000)
    ok('Füllen-Knopf da',J("!!document.querySelector('[data-a=fillopen]')"))
    J("document.querySelector('[data-a=fillopen]').click()"); pg.wait_for_timeout(500)
    n0=J("document.querySelectorAll('.fillrow').length")
    names=J("[...document.querySelectorAll('.fillrow .fn b')].map(b=>b.textContent)")
    ok('Vorschau hat Zeilen',n0>=2,names)
    ok('Keine doppelten Gerichte',len(set(names))==len(names),names)
    pg.screenshot(path=os.path.join(OUT,'fill180.png'))
    before=names[0]
    J("document.querySelector('[data-a=fillroll]').click()"); pg.wait_for_timeout(300)
    after=J("document.querySelector('.fillrow .fn b').textContent")
    ok('Würfeln tauscht',after!=before,(before,after))
    J("document.querySelector('[data-a=filldrop]').click()"); pg.wait_for_timeout(300)
    ok('Tag auslassen',J("document.querySelectorAll('.fillrow').length")==n0-1)
    cnt0=J("document.querySelectorAll('.ecard').length")
    J("document.querySelector('[data-a=fillok]').click()"); pg.wait_for_timeout(1500)
    cnt1=J("document.querySelectorAll('.ecard').length")
    ok('Übernommen',cnt1==cnt0+n0-1,(cnt0,cnt1))
    pg.screenshot(path=os.path.join(OUT,'fill180b.png'))
    J("document.querySelector('#toast button').click()"); pg.wait_for_timeout(1500)
    cnt2=J("document.querySelectorAll('.ecard').length")
    ok('Alles rückgängig',cnt2==cnt0,(cnt0,cnt2))
    ok('Keine JS-Fehler',not errs,errs[:5])
