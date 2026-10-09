(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WA = 'https://wa.me/2347068626727?text=';
  root.classList.add('js');

  /* ---------- Springs ----------
     Framer's duration springs (duration + bounce) have no cubic-bezier equivalent,
     so each one is sampled into a CSS linear() easing. */
  function spring(duration, bounce) {
    var w0 = (2 * Math.PI) / duration;
    var zeta = 1 - bounce;
    var pos = function (t) {
      if (zeta >= 1) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
      var wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    };
    var settle = duration;
    for (var t = duration * 4; t > 0; t -= 0.01) { if (Math.abs(1 - pos(t)) > 0.001) { settle = t + 0.01; break; } }
    var pts = [];
    for (var i = 0; i <= 40; i++) pts.push(i === 40 ? 1 : +pos((settle * i) / 40).toFixed(4));
    return { easing: 'linear(' + pts.join(', ') + ')', ms: Math.round(settle * 1000) };
  }
  if (window.CSS && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    var springs = { soft: spring(1.5, 0.2), flat: spring(1.5, 0), ui: spring(0.4, 0.2), btn: spring(0.6, 0), hero: spring(2, 0) };
    Object.keys(springs).forEach(function (k) {
      root.style.setProperty('--spring-' + k, springs[k].easing);
      root.style.setProperty('--spring-' + k + '-ms', springs[k].ms + 'ms');
    });
  }

  /* ---------- Word-by-word headings ---------- */
  document.querySelectorAll('[data-words]').forEach(function (el) {
    var i = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span');
        s.className = 'word';
        s.style.setProperty('--i', i++);
        s.textContent = part;
        frag.appendChild(s);
      });
      el.replaceChild(frag, node);
    });
  });

  /* ---------- Counters ----------
     Odometer: each digit is a 0-9 column that rolls up to its value over 2s. */
  document.querySelectorAll('[data-counter]').forEach(function (el) {
    var target = el.getAttribute('data-counter');
    el.setAttribute('aria-label', target);
    el.textContent = '';
    target.split('').forEach(function (d) {
      var col = document.createElement('span');
      col.className = 'counter__col';
      col.setAttribute('aria-hidden', 'true');
      col.dataset.digit = d;
      for (var n = 0; n <= 9; n++) { var s = document.createElement('span'); s.textContent = n; col.appendChild(s); }
      if (reduce) col.style.transform = 'translateY(-' + d + 'em)';
      el.appendChild(col);
    });
  });

  /* ---------- In-view triggers ---------- */
  function reveal(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-counter')) count(el);
  }
  var watched = document.querySelectorAll('[data-appear], [data-words], [data-counter]');
  if ('IntersectionObserver' in window && !reduce) {
    var observers = {};
    var observerFor = function (th) {
      if (!observers[th]) {
        observers[th] = new IntersectionObserver(function (entries, io) {
          entries.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
        }, { threshold: th });
      }
      return observers[th];
    };
    watched.forEach(function (el) {
      // Elements taller than the viewport can never reach a 0.5 ratio, so cap the threshold for them.
      var th = parseFloat(el.getAttribute('data-threshold') || '0.5');
      var h = el.getBoundingClientRect().height;
      if (h > window.innerHeight * 0.8) th = Math.min(th, 0.15);
      observerFor(th).observe(el);
    });
  } else {
    watched.forEach(reveal);
  }
  var heroBg = document.querySelector('[data-mount-zoom]');
  if (heroBg) requestAnimationFrame(function () { heroBg.classList.add('is-in'); });

  function count(el) {
    el.querySelectorAll('.counter__col').forEach(function (col) { col.style.transform = 'translateY(-' + col.dataset.digit + 'em)'; });
  }

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.1 });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  function goTo(target) {
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- Parallax + scroll-linked process cards ---------- */
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')).map(function (el) {
    var scale = parseFloat(el.getAttribute('data-parallax')) || 1.5;
    el.style.setProperty('--scale', scale);
    return { el: el, scale: scale };
  });
  var cards = Array.prototype.slice.call(document.querySelectorAll('.pcard[data-slide]'));
  function slideDistance() {
    var w = window.innerWidth;
    if (w < 810) return 0;
    return w < 1200 ? 100 : 300;
  }
  var ticking = false;
  function onFrame() {
    ticking = false;
    var vh = window.innerHeight;
    parallax.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      // 0 as the box enters at the bottom of the viewport, 1 as it leaves at the top.
      // The oversized image starts bottom-aligned and ends top-aligned.
      var progress = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
      p.el.style.setProperty('--py', (-(r.height * (p.scale - 1)) * (1 - progress)).toFixed(1) + 'px');
    });
    var dist = slideDistance();
    cards.forEach(function (card) {
      var r = card.getBoundingClientRect();
      // 0 with the card's top at the bottom of the viewport, 1 once the whole card has entered.
      var t = Math.min(Math.max((vh - r.top) / r.height, 0), 1);
      card.style.setProperty('--sx', (parseFloat(card.getAttribute('data-slide')) * dist * t).toFixed(1) + 'px');
    });
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }
  if (!reduce) {
    window.addEventListener('scroll', requestFrame, { passive: true });
    window.addEventListener('resize', requestFrame);
    onFrame();
  }

  /* ---------- Nav colours ----------
     The bar is transparent, so it reads the section sitting under it and picks light or purple ink. */
  var nav = document.getElementById('nav');
  var navZones = Array.prototype.slice.call(document.querySelectorAll('main > section, footer'));
  function tintNav() {
    var under = null;
    for (var i = 0; i < navZones.length; i++) {
      var r = navZones[i].getBoundingClientRect();
      if (r.top <= 34 && r.bottom > 34) { under = navZones[i]; break; }
    }
    nav.classList.toggle('is-on-light', !!under && under.getAttribute('data-nav') !== 'dark');
  }
  tintNav();
  window.addEventListener('scroll', tintNav, { passive: true });
  window.addEventListener('resize', tintNav);

  /* ---------- Menu ---------- */
  var menuBtn = document.getElementById('menu-btn');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) { e.preventDefault(); return; }
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      // Touch: first tap on a service card opens its price list, second tap follows the link.
      if (a.classList.contains('scard') && window.matchMedia('(hover: none)').matches && !a.classList.contains('is-open')) {
        document.querySelectorAll('.scard.is-open').forEach(function (c) { c.classList.remove('is-open'); });
        a.classList.add('is-open');
        return;
      }
      setMenu(false);
      goTo(target);
    });
  });

  /* ---------- FAQ: one open at a time ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.acc__item'));
  items.forEach(function (item) {
    var q = item.querySelector('.acc__q');
    q.addEventListener('click', function () {
      var open = !item.classList.contains('is-open');
      items.forEach(function (other) {
        other.classList.remove('is-open');
        other.querySelector('.acc__q').setAttribute('aria-expanded', 'false');
      });
      if (open) { item.classList.add('is-open'); q.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---------- Booking form ----------
     The Framer form posted to Framer's own inbox. With no backend here, the request is
     handed to WhatsApp, which is how the spa takes bookings. */
  var form = document.getElementById('booking-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.submit');
      var label = btn.querySelector('.submit__label');
      var d = new FormData(form);
      var msg = 'Hello Dot On Massage Therapy & Spa, I would like to book.\n' +
        'Name: ' + d.get('Name') + '\nEmail: ' + d.get('Email') + '\nPhone: ' + d.get('Phone') + '\nService: ' + d.get('Service');
      btn.classList.add('is-loading');
      setTimeout(function () {
        btn.classList.remove('is-loading');
        label.textContent = 'Thank you';
        window.open(WA + encodeURIComponent(msg), '_blank', 'noopener');
        form.reset();
        setTimeout(function () { label.textContent = 'Submit'; }, 4000);
      }, 600);
    });
  }

  /* ---------- Footer wordmark: scale the type until the word fills its container ---------- */
  var wordmark = document.getElementById('wordmark');
  function fitWordmark() {
    if (!wordmark) return;
    var inner = wordmark.firstElementChild;
    var size = parseFloat(getComputedStyle(wordmark).fontSize);
    var w = inner.getBoundingClientRect().width;
    if (!w) return;
    wordmark.style.setProperty('--wordmark-size', ((size * wordmark.clientWidth) / w).toFixed(2) + 'px');
  }
  fitWordmark();
  window.addEventListener('resize', fitWordmark);
  // The container can change width without a window resize (scrollbar, font swap), so watch it directly too.
  if (wordmark && 'ResizeObserver' in window) new ResizeObserver(fitWordmark).observe(wordmark);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWordmark);

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
