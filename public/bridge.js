/*
 * Reyal Review Bridge. Loaded on a client's website only while that site is shown inside the Reyal review page.
 * It lets the review page pick an element, draw numbered pins on the page, list its sections and take a screenshot,
 * which a page on another address cannot do from outside. It talks only to the address it was loaded from.
 * Visitors who open the site normally never run any of this.
 */
(function () {
  'use strict';
  if (window.__rsBridge || window.parent === window) return;
  var me = document.currentScript;
  var PARENT;
  try { PARENT = new URL(me && me.src).origin; } catch (e) { return; }
  window.__rsBridge = true;

  var mode = 'browse';
  var pins = [];
  var sections = [];
  var hover = null;
  var selected = null;
  var layer = null;

  function post(msg) {
    msg.rs = 1;
    try { window.parent.postMessage(msg, PARENT); } catch (e) { /* parent gone */ }
  }

  // ---------- styles ----------
  var css = document.createElement('style');
  css.id = 'rs-style';
  css.textContent =
    '#rs-hover,#rs-selected{position:absolute;pointer-events:none;z-index:2147483640;box-sizing:border-box;border-radius:3px}' +
    '#rs-hover{border:2px solid #c4132f;background:rgba(196,19,47,.08)}' +
    '#rs-selected{border:2px solid #ffd308;background:rgba(255,211,8,.14)}' +
    '#rs-pins{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483641}' +
    '.rs-pin{position:absolute;display:grid;place-items:center;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;box-sizing:border-box;' +
    'font:800 12px/1 Poppins,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);cursor:pointer;color:#fff;background:#c4132f;border:2px solid #fff;animation:rs-pop .3s ease}' +
    '.rs-pin.done{background:#52525b}' +
    '.rs-pin.draft{background:#ffd308;color:#111;border:2px dashed #111}' +
    '.rs-pin.new{background:#ffd308;color:#111}' +
    '.rs-pin.sel{outline:3px solid rgba(255,211,8,.9);outline-offset:2px}' +
    '@keyframes rs-pop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}' +
    'html.rs-commenting,html.rs-commenting *{cursor:crosshair !important}';
  (document.head || document.documentElement).appendChild(css);

  function ui() {
    if (layer && layer.isConnected) return;
    layer = document.createElement('div');
    layer.id = 'rs-pins';
    (document.body || document.documentElement).appendChild(layer);
  }

  // ---------- finding the element under the pointer (the same idea as the studio's picker) ----------
  var LEAF = 'a, button, input, textarea, select, img, picture, video, canvas, svg, iframe, h1, h2, h3, h4, h5, h6, p, li, dt, dd, blockquote, figcaption, th, td, label, [role="button"], [role="img"]';
  var BLOCK = 'section, article, header, footer, nav, aside, form, figure, table, ul, ol, main';
  function sizeOk(el, w, h) { var r = el.getBoundingClientRect(); return r.width >= (w || 6) && r.height >= (h || 6); }
  function ownText(el) { return Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }); }
  function visualBox(el) {
    var cs = getComputedStyle(el);
    var bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    return bg || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
  }
  function meaningful(el) {
    if (!el || el.nodeType !== 1 || /^rs-/.test(el.id || '')) return false;
    if (['HTML', 'BODY', 'SCRIPT', 'STYLE', 'BR'].indexOf(el.tagName) >= 0) return false;
    if (!sizeOk(el)) return false;
    if (el.matches(LEAF) || el.matches(BLOCK) || ownText(el)) return true;
    return sizeOk(el, 24, 16) && visualBox(el);
  }
  function componentOf(el) {
    if (!el || !el.closest) return null;
    var svg = el.closest('svg');
    if (svg) el = svg;
    var control = el.closest('a, button, [role="button"], label');
    if (control && control !== el && sizeOk(control)) return control;
    var t = el;
    while (t && t.tagName !== 'BODY' && !meaningful(t)) t = t.parentElement;
    return t && t.tagName !== 'BODY' ? t : null;
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'); }
  function selectorOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'BODY' && parts.length < 7) {
      if (el.id && !/^rs-/.test(el.id)) { parts.unshift('#' + cssEsc(el.id)); break; }
      // Elementor gives every element a stable id of its own.
      var did = el.getAttribute('data-id');
      if (did && el.classList.contains('elementor-element') && /^[\w-]+$/.test(did)) { parts.unshift('[data-id="' + did + '"]'); break; }
      var s = el.tagName.toLowerCase();
      var cls = Array.prototype.filter.call(el.classList, function (c) { return /^[a-z][\w-]{1,30}$/i.test(c) && !/^(elementor-element-|e-con-)/.test(c); }).slice(0, 2);
      if (cls.length) s += '.' + cls.map(cssEsc).join('.');
      var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.tagName === el.tagName; }) : [];
      if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
      parts.unshift(s);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  function describe(el) {
    return (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  }

  function box(id) {
    var b = document.getElementById(id);
    if (!b) { b = document.createElement('div'); b.id = id; (document.body || document.documentElement).appendChild(b); }
    return b;
  }
  function placeBox(b, el) {
    var r = el.getBoundingClientRect();
    b.style.left = r.left + window.scrollX + 'px'; b.style.top = r.top + window.scrollY + 'px';
    b.style.width = r.width + 'px'; b.style.height = r.height + 'px'; b.style.display = 'block';
    return r;
  }

  // ---------- comment mode ----------
  var raf = 0;
  document.addEventListener('mousemove', function (e) {
    if (mode !== 'comment') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      var t = componentOf(e.target);
      if (t) { hover = t; placeBox(box('rs-hover'), t); } else { var h = document.getElementById('rs-hover'); if (h) h.style.display = 'none'; }
    });
  }, true);

  document.addEventListener('click', function (e) {
    if (mode === 'comment') {
      e.preventDefault(); e.stopPropagation();
      var t = componentOf(e.target) || e.target;
      if (!t || t === document.documentElement || t === document.body) return;
      selected = t;
      var r = placeBox(box('rs-selected'), t);
      var h = document.getElementById('rs-hover'); if (h) h.style.display = 'none';
      post({
        type: 'pick', selector: selectorOf(t), text: describe(t),
        rx: r.width ? (e.clientX - r.left) / r.width : 0.5, ry: r.height ? (e.clientY - r.top) / r.height : 0.5,
        x: e.pageX, y: e.pageY, vw: window.innerWidth, clientX: e.clientX, clientY: e.clientY,
        rect: { l: r.left, t: r.top, w: r.width, h: r.height }, href: location.href,
      });
      return;
    }
    // Browsing: a link to another website opens in a new tab, so the review page is never lost.
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && /^https?:$/.test(a.protocol) && a.origin !== location.origin && !e.defaultPrevented) {
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener');
    }
  }, true);

  // ---------- pins ----------
  var samePage = function (a, b) {
    try { var x = new URL(a), y = new URL(b); return x.origin === y.origin && x.pathname.replace(/\/+$/, '') === y.pathname.replace(/\/+$/, ''); } catch (e) { return false; }
  };
  function where(p) {
    var el = null;
    if (p.selector) { try { el = document.querySelector(p.selector); } catch (e) { el = null; } }
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + window.scrollX + (p.rx == null ? 0.5 : p.rx) * r.width, y: r.top + window.scrollY + (p.ry == null ? 0.5 : p.ry) * r.height };
    }
    return p.x != null && p.y != null ? { x: p.x, y: p.y } : null;
  }
  function drawPins() {
    ui();
    var seen = {};
    pins.forEach(function (p) {
      if (!samePage(p.href, location.href)) return;
      var pos = where(p);
      if (!pos) return;
      seen[p.id] = true;
      var n = layer.querySelector('[data-id="' + p.id + '"]');
      if (!n) {
        n = document.createElement('div'); n.className = 'rs-pin'; n.setAttribute('data-id', p.id); n.setAttribute('role', 'button');
        n.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); post({ type: 'pinclick', id: p.id }); }, true);
        layer.appendChild(n);
      }
      n.className = 'rs-pin ' + (p.kind || 'open') + (p.sel ? ' sel' : '');
      n.textContent = p.n;
      n.style.left = pos.x + 'px'; n.style.top = pos.y + 'px';
    });
    Array.prototype.slice.call(layer.children).forEach(function (n) { if (!seen[n.getAttribute('data-id')]) n.remove(); });
  }
  setInterval(function () { if (pins.length) drawPins(); }, 1000);
  window.addEventListener('resize', function () { if (pins.length) drawPins(); });

  // ---------- sections ----------
  function sectionName(el, i) {
    if ((el.tagName === 'HEADER' || el.tagName === 'FOOTER') && !el.getAttribute('aria-label')) return el.tagName === 'HEADER' ? 'Header' : 'Footer';
    var h = el.querySelector(':scope > h1, :scope > h2, :scope > h3');
    var name = el.getAttribute('data-section-title') || el.getAttribute('aria-label') || (h && h.textContent) ||
      Array.prototype.filter.call(el.classList, function (c) { return !/^(section|container|wrapper|row|elementor|e-con|e-parent|e-flex|e-con-full|elementor-section|elementor-top-section|elementor-element)/.test(c) && !/\d{3,}/.test(c); })[0] ||
      el.id || (el.querySelector('h1, h2, h3') || {}).textContent || 'Section ' + (i + 1);
    name = String(name).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  function findSections() {
    sections = Array.prototype.slice.call(document.querySelectorAll('section, header, footer, [role="region"], [data-section], main > [id], .e-con.e-parent'))
      .filter(function (el) { return !/^rs-/.test(el.id || '') && !el.closest('#rs-pins') && el.getBoundingClientRect().height > 0 && !el.parentElement.closest('section, .e-con.e-parent'); });
    if (!sections.length) sections = Array.prototype.slice.call(document.querySelectorAll('h1, h2'));
    return sections.map(function (el, i) { return { i: i, name: sectionName(el, i) }; });
  }

  // ---------- screenshot ----------
  var h2cLoading = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve();
    if (!h2cLoading) h2cLoading = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = PARENT + '/vendor/html2canvas.min.js'; s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
    return h2cLoading;
  }
  function capture(id, rect) {
    var timeout = new Promise(function (_, no) { setTimeout(function () { no(new Error('slow')); }, 9000); });
    var work = loadH2C().then(function () {
      var scale = Math.min(1, 900 / window.innerWidth);
      return window.html2canvas(document.documentElement, {
        x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
        windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
        scale: scale, useCORS: true, logging: false, backgroundColor: '#ffffff',
        ignoreElements: function (el) { return /^rs-/.test(el.id || '') || (el.classList && el.classList.contains('rs-pin')); },
      }).then(function (c) {
        if (rect) {
          var g = c.getContext('2d');
          g.lineWidth = Math.max(2, 3 * scale); g.strokeStyle = '#c4132f'; g.fillStyle = 'rgba(196,19,47,.10)';
          g.fillRect(rect.l * scale, rect.t * scale, rect.w * scale, rect.h * scale);
          g.strokeRect(rect.l * scale, rect.t * scale, rect.w * scale, rect.h * scale);
        }
        return c.toDataURL('image/jpeg', 0.7);
      });
    });
    Promise.race([work, timeout]).then(function (d) { post({ type: 'shot', id: id, dataUrl: d }); }, function () { post({ type: 'shot', id: id, dataUrl: null }); });
  }

  // ---------- messages from the review page ----------
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || e.origin !== PARENT || !e.data || e.data.rs !== 1) return;
    var m = e.data;
    if (m.type === 'mode') {
      mode = m.mode === 'comment' ? 'comment' : 'browse';
      document.documentElement.classList.toggle('rs-commenting', mode === 'comment');
      if (mode !== 'comment') { var h = document.getElementById('rs-hover'); if (h) h.style.display = 'none'; }
    } else if (m.type === 'pins') {
      pins = Array.isArray(m.items) ? m.items : [];
      drawPins();
    } else if (m.type === 'clear') {
      var s = document.getElementById('rs-selected'); if (s) s.style.display = 'none'; selected = null;
    } else if (m.type === 'section') {
      var t = sections[m.i];
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
    } else if (m.type === 'focus') {
      var p = pins.filter(function (x) { return x.id === m.id; })[0];
      var pos = p && where(p);
      if (pos) window.scrollTo({ top: Math.max(0, pos.y - window.innerHeight / 3), behavior: 'smooth' });
    } else if (m.type === 'capture') {
      capture(m.id, m.rect);
    } else if (m.type === 'ping') {
      hello();
    }
  });

  function hello() {
    post({ type: 'hello', href: location.href, title: document.title, vw: window.innerWidth, sections: findSections() });
  }
  function start() { ui(); hello(); setTimeout(hello, 1500); }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  window.addEventListener('popstate', function () { setTimeout(hello, 300); });
  window.addEventListener('hashchange', function () { setTimeout(hello, 300); });
})();
