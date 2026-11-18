(function () {
  var app = document.getElementById('app');
  function setLang(l) {
    app.setAttribute('data-lang', l); app.setAttribute('lang', l); app.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('guide-lang', l); } catch (e) {}
  }
  var start = location.hash === '#en' ? 'en' : location.hash === '#ar' ? 'ar' : null;
  if (!start) { try { start = localStorage.getItem('guide-lang'); } catch (e) {} }
  setLang(start === 'en' ? 'en' : 'ar');
  document.getElementById('lang').addEventListener('click', function () { setLang(app.getAttribute('data-lang') === 'ar' ? 'en' : 'ar'); });

  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var who = c.getAttribute('data-who');
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      var shown = 0;
      document.querySelectorAll('.feature').forEach(function (f) {
        var ok = who === 'all' || f.getAttribute('data-who').split(' ').indexOf(who) >= 0;
        f.hidden = !ok; if (ok) shown++;
      });
      document.querySelectorAll('section.group').forEach(function (s) { s.hidden = !s.querySelector('.feature:not([hidden])'); });
      document.getElementById('empty').style.display = shown ? 'none' : 'block';
    });
  });

  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  document.querySelectorAll('.shot').forEach(function (b) {
    b.addEventListener('click', function () {
      close();
      box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      var img = document.createElement('img'); img.src = b.getAttribute('data-src'); img.alt = b.getAttribute('aria-label');
      var x = document.createElement('button'); x.type = 'button'; x.textContent = app.getAttribute('data-lang') === 'ar' ? 'إغلاق' : 'Close';
      box.appendChild(img); box.appendChild(x); document.body.appendChild(box);
      box.addEventListener('click', close); x.focus();
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
