/* Erscheinungsbild (Gerät, Hell, Dunkel) und Akzentfarbe, wie in der Merker-App: gespeichert wird nur der Farbton.
   Sättigung und Helligkeit legt die App fest, damit alles in Hell und Dunkel lesbar bleibt.
   Läuft früh im <head>, damit beim Start nichts aufblitzt. */
(function (global) {
  'use strict';
  var THEME_KEY = 'essensplaner_theme';
  var ACCENT_KEY = 'essensplaner_accent';
  var LEGACY_CUSTOM_KEY = 'essensplaner_accent_custom';

  // Farbtöne zur Auswahl. hue null = Standard (Terrakotta). swatch = Farbton für die Anzeige.
  var PRESETS = [
    { hue: null, label: 'Standard', swatch: 16 },
    { hue: 160, label: 'Grün' },
    { hue: 190, label: 'Türkis' },
    { hue: 225, label: 'Blau' },
    { hue: 275, label: 'Violett' },
    { hue: 335, label: 'Rosa' },
    { hue: 38, label: 'Orange' },
    { hue: 80, label: 'Oliv' }
  ];
  // a = Fläche von Knöpfen, t = Text in Akzentfarbe, s = zarter Hintergrund, b = Rand, o = Schrift auf der Fläche
  var DEFAULT = {
    light: { a: '#B8461F', t: '#A23A17', s: '#FDEEE8', b: '#F3C5B3', o: '#FFFFFF' },
    dark: { a: '#E8825A', t: '#F4A585', s: '#3A2118', b: '#6B3A28', o: '#2B0F04' }
  };
  // Schriften zur Auswahl (lokal als woff2 im App-Ordner). Standard: Figtree.
  var FONT_KEY = 'essensplaner_font';
  var FONTS = [
    { key: 'figtree', label: 'Figtree', css: 'Figtree' },
    { key: 'archivo', label: 'Archivo', css: 'Archivo' },
    { key: 'space-grotesk', label: 'Space Grotesk', css: '"Space Grotesk"' },
    { key: 'work-sans', label: 'Work Sans', css: '"Work Sans"' },
    { key: 'dm-sans', label: 'DM Sans', css: '"DM Sans"' },
    { key: 'manrope', label: 'Manrope', css: 'Manrope' },
    { key: 'bricolage-grotesque', label: 'Bricolage Grotesque', css: '"Bricolage Grotesque"' },
    { key: 'inter', label: 'Inter', css: 'Inter' },
    { key: 'system', label: 'System', css: '' }
  ];
  var SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var LEGACY = { terrakotta: null, salbei: 150, beere: 335, ocker: 40, pflaume: 265, ozean: 225 };

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    function f(n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return '#' + [f(0), f(8), f(4)].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function relLum(hex) {
    var c = hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var l1 = relLum(a), l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // Farbton (0 bis 360) einer Farbe "#rrggbb". Grau hat keinen Farbton, dann 215 wie in Merker.
  function hexToHue(value) {
    if (!/^#?[0-9a-fA-F]{6}$/.test(value || '')) return 215;
    var hsl = rgbToHsl.apply(null, hexToRgb(value));
    if (hsl[1] === 0) return 215;
    return Math.round(hsl[0] * 360) % 360;
  }
  function hueToHex(hue) { return hslToHex((((hue % 360) + 360) % 360) / 360, 0.65, 0.5); }

  function derive(hex) {
    var hsl = rgbToHsl.apply(null, hexToRgb(hex));
    var h = hsl[0], s = Math.min(hsl[1], 0.92), l = hsl[2];
    // Hell: Fläche mit weißer Schrift (mind. 4,5:1), Text in Akzentfarbe auf Weiß (mind. 6:1)
    var la = Math.min(l, 0.56), a = hslToHex(h, s, la);
    while (contrast(a, '#FFFFFF') < 4.5 && la > 0.03) { la -= 0.02; a = hslToHex(h, s, la); }
    var lt = Math.max(0.03, la - 0.05), t = hslToHex(h, s, lt);
    while (contrast(t, '#FFFFFF') < 6 && lt > 0.02) { lt -= 0.02; t = hslToHex(h, s, lt); }
    var light = { a: a, t: t, s: hslToHex(h, Math.min(s, 0.75), 0.95), b: hslToHex(h, Math.min(s, 0.6), 0.85), o: '#FFFFFF' };
    // Dunkel: helle Fläche mit dunkler Schrift, Text in Akzentfarbe auf dunklem Grund (mind. 4,5:1)
    var sd = Math.min(s, 0.8), ld = Math.min(Math.max(l, 0.62), 0.78);
    var od = hslToHex(h, Math.min(s, 0.6), 0.07), ad = hslToHex(h, sd, ld);
    while (contrast(ad, od) < 4.5 && ld < 0.97) { ld += 0.02; ad = hslToHex(h, sd, ld); }
    var lt2 = Math.min(0.97, Math.max(ld + 0.1, 0.76)), td = hslToHex(h, Math.min(s, 0.85), lt2);
    while (contrast(td, '#1C1F26') < 4.5 && lt2 < 0.98) { lt2 += 0.02; td = hslToHex(h, Math.min(s, 0.85), lt2); }
    var dark = { a: ad, t: td, s: hslToHex(h, Math.min(s, 0.5), 0.17), b: hslToHex(h, Math.min(s, 0.45), 0.3), o: od };
    return { light: light, dark: dark };
  }
  function colorsFor(hue) { return hue == null ? DEFAULT : derive(hueToHex(hue)); }

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, v) { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch (e) { /* ignorieren */ } }
  function getTheme() { var v = read(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'auto'; }
  function isDark() {
    var t = getTheme();
    return t === 'dark' || (t === 'auto' && !!global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  /* Gewählter Farbton (Zahl) oder null für Standard. Ältere Speicherstände (Namen, eigene Hexfarbe) werden umgerechnet. */
  function getAccent() {
    var raw = read(ACCENT_KEY);
    if (raw == null) return null;
    try { var v = JSON.parse(raw); if (typeof v === 'number' && isFinite(v)) return ((v % 360) + 360) % 360; } catch (e) { /* weiter */ }
    if (raw === 'custom') { var hex = read(LEGACY_CUSTOM_KEY); return hex ? hexToHue(hex) : null; }
    return Object.prototype.hasOwnProperty.call(LEGACY, raw) ? LEGACY[raw] : null;
  }

  function getFont() {
    var v = read(FONT_KEY);
    return FONTS.some(function (f) { return f.key === v; }) ? v : 'figtree';
  }
  function fontStack(key) {
    var f = FONTS.filter(function (x) { return x.key === key; })[0] || FONTS[0];
    return (f.css ? f.css + ', ' : '') + SYSTEM_STACK;
  }

  function apply() {
    var root = document.documentElement;
    root.style.setProperty('--font', fontStack(getFont()));
    var t = getTheme();
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    var pair = colorsFor(getAccent());
    var c = isDark() ? pair.dark : pair.light;
    var st = root.style;
    st.setProperty('--accent', c.a);
    st.setProperty('--accent-text', c.t);
    st.setProperty('--accent-soft', c.s);
    st.setProperty('--accent-border', c.b);
    st.setProperty('--on-accent', c.o);
    // Farbe der Systemleisten: bei festem Erscheinungsbild für beide Meta-Einträge gleich
    var metas = document.querySelectorAll('meta[name=theme-color]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.getAttribute('data-orig')) m.setAttribute('data-orig', m.getAttribute('content') || '');
      m.setAttribute('content', t === 'auto' ? m.getAttribute('data-orig') : (t === 'dark' ? '#161513' : '#FBFAF7'));
    }
  }

  global.EPTheme = {
    PRESETS: PRESETS,
    FONTS: FONTS,
    getFont: getFont,
    fontStack: fontStack,
    setFont: function (k) { write(FONT_KEY, k === 'figtree' ? null : k); apply(); },
    getTheme: getTheme,
    getAccent: getAccent,
    isDark: isDark,
    setTheme: function (v) { write(THEME_KEY, v === 'light' || v === 'dark' ? v : null); apply(); },
    setAccent: function (hue) {
      write(LEGACY_CUSTOM_KEY, null);
      write(ACCENT_KEY, hue == null || !isFinite(hue) ? null : JSON.stringify(Math.round(((hue % 360) + 360) % 360)));
      apply();
    },
    hexToHue: hexToHue,
    hueToHex: hueToHex,
    derive: derive,
    contrast: contrast,
    apply: apply
  };
  apply();
  if (global.matchMedia) {
    var mq = global.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  }
})(window);
