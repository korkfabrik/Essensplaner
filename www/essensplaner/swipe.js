/* Wischgesten auf Gerichte (Touch und Maus). Nach rechts: gekocht. Nach links: halb = verschieben, ganz = löschen.
   Die Karte folgt dem Finger, der Hintergrund zeigt die Aktion. Aktion beim Loslassen. */
(function (global) {
  'use strict';
  var START = 10;          // Pixel, bevor die Richtung festgelegt wird
  var RIGHT_AT = 0.33;     // Anteil der Breite für "gekocht"
  var MOVE_AT = 0.25;      // Anteil für "verschieben"
  var DELETE_AT = 0.6;     // Anteil für "löschen"
  var h = {};
  var row = null, card = null, bg = null;
  var startX = 0, startY = 0, dx = 0, tracking = false, locked = false, step = '', suppress = false;

  function width() { return (row && row.offsetWidth) || 360; }
  function stepFor(d) {
    var w = width();
    if (d > 0) return d > w * RIGHT_AT ? 'right' : '';
    if (-d > w * DELETE_AT) return 'delete';
    if (-d > w * MOVE_AT) return 'move';
    return '';
  }
  var CHECK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
  var CAL = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var TRASH = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

  function paint(d, s) {
    row.classList.toggle('dir-right', d > 0);
    row.classList.toggle('dir-left', d < 0);
    row.setAttribute('data-step', s);
    var cooked = row.getAttribute('data-cooked') === 'true';
    if (d > 0) bg.innerHTML = '<span class="sb">' + CHECK + '<b>' + (cooked ? 'Noch offen' : 'Gekocht') + '</b></span>';
    else if (d < 0) bg.innerHTML = '<span class="sb">' + (s === 'delete' ? TRASH + '<b>Löschen</b>' : CAL + '<b>Verschieben</b>') + '</span>';
    else bg.innerHTML = '';
  }
  function springBack() {
    if (!card) return;
    card.classList.remove('dragging');
    card.style.transform = '';
    card.style.opacity = '';
    var r = row;
    setTimeout(function () { if (r && !r.classList.contains('swiping')) { r.classList.remove('dir-right', 'dir-left'); r.removeAttribute('data-step'); } }, 350);
  }
  function reset() { if (row) row.classList.remove('swiping'); tracking = false; locked = false; dx = 0; step = ''; }

  function down(e) {
    if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var r = e.target.closest && e.target.closest('.swipe');
    if (!r || (e.target.closest('button, a, input, select, textarea'))) return;
    row = r; card = r.querySelector('.ecard'); bg = r.querySelector('.swipe-bg');
    if (!card || !bg) { row = null; return; }
    startX = e.clientX; startY = e.clientY; dx = 0; tracking = true; locked = false; step = '';
  }
  function move(e) {
    if (!tracking) return;
    var mx = e.clientX - startX, my = e.clientY - startY;
    if (!locked) {
      if (Math.abs(mx) > START && Math.abs(mx) > Math.abs(my) * 1.5) {
        locked = true;
        row.classList.add('swiping');
        card.classList.add('dragging');
        try { row.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
      } else if (Math.abs(my) > START) { tracking = false; return; } else return;
    }
    dx = mx;
    var d = dx > 0 ? (h.onRight ? dx : 0) : (h.onLeftHalf || h.onLeftFull ? dx : 0);
    var s = stepFor(d);
    card.style.transform = 'translateX(' + d + 'px)';
    card.style.opacity = String(Math.max(0.82, 1 - Math.abs(d) / (width() * 3)));
    paint(d, s);
    if (s !== step) {
      step = s;
      if (s) { try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* ignorieren */ } }
    }
    dx = d;
  }
  function up(e) {
    if (!tracking) return;
    var wasLocked = locked, d = dx, s = stepFor(d), r = row, uid = r && r.getAttribute('data-uid');
    reset();
    if (!wasLocked) return;
    suppress = true; setTimeout(function () { suppress = false; }, 80);
    try { if (r.hasPointerCapture && r.hasPointerCapture(e.pointerId)) r.releasePointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
    var run = function (fn) { Promise.resolve().then(function () { return fn(uid); }).catch(function () {}); };
    if (s === 'right' && h.onRight) { springBack(); run(h.onRight); }
    else if (s === 'move' && h.onLeftHalf) { springBack(); run(h.onLeftHalf); }
    else if (s === 'delete' && h.onLeftFull) {
      card.classList.remove('dragging');
      card.style.transform = 'translateX(-110%)';
      card.style.opacity = '0';
      setTimeout(function () { run(h.onLeftFull); }, 160);
    } else springBack();
  }
  function cancel() { if (locked) springBack(); reset(); }

  global.EPSwipe = {
    init: function (handlers) {
      h = handlers || {};
      document.addEventListener('pointerdown', down);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', cancel);
      // Nach einer Wischgeste darf der Klick nichts zusätzlich auslösen
      document.addEventListener('click', function (e) {
        if (suppress) { e.stopImmediatePropagation(); e.preventDefault(); }
      }, true);
    },
    STEPS: { RIGHT_AT: RIGHT_AT, MOVE_AT: MOVE_AT, DELETE_AT: DELETE_AT }
  };
})(window);
