/**
 * 아이폰 사진(HEIC·HEIF)을 JPEG로 바꾼다.
 *
 * Safari·iOS 앱(WKWebView)은 HEIC를 그대로 열지만, 크롬·안드로이드·윈도우 브라우저는 못 연다.
 * 그래서 "이 브라우저가 못 여는 HEIC"일 때만 vendor/heic-to.js(LGPL-3.0, 약 3.2MB, 최신 libheif)를 그때 불러와 바꾼다.
 * (처음 넣었던 heic2any는 libheif가 오래돼 요즘 아이폰 사진에서 ERR_LIBHEIF format not supported 가 났다.)
 * 평소에는 이 큰 파일을 받지 않는다.
 *
 *   const ready = await HeicFix.prepare(file);   // HEIC가 아니거나 그냥 열리면 file 그대로
 */
(function (global) {
  const LIB = 'vendor/heic-to.js';
  let loading = null;

  function isHeic(file) {
    return !!file && (/heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || ''));
  }

  /** 이 브라우저가 그대로 열 수 있는지 */
  function canOpen(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(true); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });
  }

  function loadLib() {
    if (global.HeicTo) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIB;
        s.onload = () => resolve();
        s.onerror = () => { loading = null; reject(new Error('HEIC 변환 도구를 불러오지 못했어요')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  async function prepare(file) {
    if (!isHeic(file)) return file;
    if (await canOpen(file)) return file;
    await loadLib();
    const out = await global.HeicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
    const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
    // 찍은 시각(파일 수정 시각)은 원본 것을 그대로 둔다
    try { return new File([out], name, { type: 'image/jpeg', lastModified: file.lastModified }); }
    catch (e) { return out; }
  }

  global.HeicFix = { isHeic, prepare };
})(window);
