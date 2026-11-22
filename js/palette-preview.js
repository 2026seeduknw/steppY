/**
 * 팔레트 미리보기 스위치 — css/palettes.css 참고.
 * ?palette=blue|green|mix 로 켜고 ?palette=off 로 끈다. 고른 값은 기억해서
 * 다른 화면으로 넘어가도 유지된다. 켜져 있을 때만 왼쪽 아래에 전환 버튼이 뜬다.
 * <head> 에서 동기로 실행돼야 첫 화면부터 깜빡임 없이 적용된다.
 */
(function () {
  var KEY = 'steppy.palettePreview';
  var LIST = ['blue', 'green', 'mix'];
  var LABEL = { blue: 'A · Blue Whale', green: 'B · Kombu', mix: 'C · Blue×Kombu' };
  var store = {
    get: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: function (v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} }
  };
  var q = null;
  try { q = new URLSearchParams(location.search).get('palette'); } catch (e) {}
  if (q === 'off') store.set(null);
  else if (LIST.indexOf(q) >= 0) store.set(q);
  var cur = store.get();
  if (LIST.indexOf(cur) < 0) return;
  document.documentElement.setAttribute('data-palette', cur);

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', '팔레트 시안 바꾸기');
    b.style.cssText = 'position:fixed;left:12px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:9999;' +
      'padding:6px 12px;border-radius:999px;border:0;font:600 12px/1.2 var(--font-body);' +
      'background:var(--key-500);color:var(--on-key);box-shadow:var(--shadow-float);opacity:.92';
    var paint = function () { b.textContent = '🎨 ' + LABEL[cur] + ' ↻'; };
    paint();
    b.addEventListener('click', function () {
      var i = LIST.indexOf(cur) + 1;
      if (i >= LIST.length) { store.set(null); document.documentElement.removeAttribute('data-palette'); b.remove(); return; }
      cur = LIST[i]; store.set(cur);
      document.documentElement.setAttribute('data-palette', cur);
      paint();
    });
    document.body.appendChild(b);
  });
})();
