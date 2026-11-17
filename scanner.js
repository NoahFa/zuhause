// Dokumentenscanner (Plan „Dokumentenscanner perfektionieren“, Phase 1):
// Seite für Seite mit der iPhone-Kamera fotografieren → vier Ecken automatisch finden (mit dem Finger verschiebbar)
// → entzerren, drehen, Bildmodus (Dokument/Farbe/Original) → Seitenübersicht → durchsuchbares PDF speichern.
// Alles läuft auf dem Handy; Texterkennung (Tesseract) und PDF (jsPDF) liegen unter vendor/.
(() => {
  'use strict';
  const h = escapeHtml;
  const VENDOR = new URL('vendor/', document.baseURI).href;
  const WORK_SIDE = 2200;      // längste Seite der Arbeitskopie (Speicher am iPhone schonen)
  const DETECT_SIDE = 480;     // Größe für die Ecken-Erkennung
  const A4 = 297 / 210;
  const uid = () => crypto.randomUUID();

  // ---------- Hilfen ----------
  const scripts = new Map();
  function loadScript(url) {
    if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = () => { scripts.delete(url); reject(new Error('Skript nicht geladen')); }; document.head.append(s); }));
    return scripts.get(url);
  }
  function canvasOf(width, height) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(width)); c.height = Math.max(1, Math.round(height)); return c; }
  function scaled(source, maxSide) {
    const w = source.width, h2 = source.height, f = Math.min(1, maxSide / Math.max(w, h2));
    const c = canvasOf(w * f, h2 * f); const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, c.width, c.height); return c;
  }
  async function loadImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const c = scaled(bitmap, WORK_SIDE); bitmap.close?.(); return c;
  }
  function grayData(canvas) {
    const { width, height } = canvas, data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const g = new Float32Array(width * height); for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    return { g, width, height };
  }
  function boxBlur(src, width, height, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) { let sum = 0; const row = y * width; for (let x = -r; x <= r; x++) sum += src[row + Math.min(width - 1, Math.max(0, x))]; for (let x = 0; x < width; x++) { tmp[row + x] = sum / (2 * r + 1); sum += src[row + Math.min(width - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < width; x++) { let sum = 0; for (let y = -r; y <= r; y++) sum += tmp[Math.min(height - 1, Math.max(0, y)) * width + x]; for (let y = 0; y < height; y++) { out[y * width + x] = sum / (2 * r + 1); sum += tmp[Math.min(height - 1, y + r + 1) * width + x] - tmp[Math.max(0, y - r) * width + x]; } }
    return out;
  }
  function otsu(values) {
    const hist = new Array(256).fill(0); values.forEach(v => hist[Math.max(0, Math.min(255, v | 0))]++);
    const total = values.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, threshold = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; threshold = t; } }
    return threshold;
  }

  // ---------- Ecken finden ----------
  // Papier hebt sich fast immer hell vom Untergrund ab: Schwellwert (Otsu) → zusammenhängende Fläche um die Bildmitte →
  // äußerste Punkte in den vier Diagonalrichtungen. Ist das Ergebnis unplausibel, gilt die ganze Seite (nichts abschneiden).
  function detectCorners(canvas) {
    const small = scaled(canvas, DETECT_SIDE), { g, width, height } = grayData(small), blurred = boxBlur(g, width, height, 2);
    const t = otsu(blurred); let mask = new Uint8Array(blurred.length); for (let i = 0; i < mask.length; i++) mask[i] = blurred[i] > t ? 1 : 0;
    const centre = Math.floor(height / 2) * width + Math.floor(width / 2);
    if (!mask[centre]) for (let i = 0; i < mask.length; i++) mask[i] = 1 - mask[i];
    // Fläche, die die Bildmitte enthält (Flutfüllung)
    const seen = new Uint8Array(mask.length), stack = [centre]; seen[centre] = 1; let area = 0;
    let tl = null, tr = null, br = null, bl = null, minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
    while (stack.length) {
      const i = stack.pop(), x = i % width, y = (i - x) / width; area++;
      const s = x + y, d = x - y;
      if (s < minS) { minS = s; tl = [x, y]; } if (s > maxS) { maxS = s; br = [x, y]; } if (d > maxD) { maxD = d; tr = [x, y]; } if (d < minD) { minD = d; bl = [x, y]; }
      for (const n of [i - 1, i + 1, i - width, i + width]) { if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue; const nx = n % width; if (Math.abs(nx - x) > 1) continue; seen[n] = 1; stack.push(n); }
    }
    const full = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const ratio = area / (width * height);
    if (!tl || ratio < 0.12 || ratio > 0.985) return { corners: full, sure: false };
    const quad = [tl, tr, br, bl];
    const polyArea = Math.abs(quad.reduce((s, p, k) => { const q = quad[(k + 1) % 4]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
    const convex = quad.every((p, k) => { const a = quad[(k + 3) % 4], c = quad[(k + 1) % 4]; return (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]) > 0; });
    if (!convex || polyArea < area * 0.75 || polyArea < width * height * 0.1) return { corners: full, sure: false };
    // etwas Luft nach außen, damit kein Rand des Blattes verloren geht
    const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
    const corners = quad.map(([x, y]) => [Math.min(1, Math.max(0, (x + (x - cx) * 0.01) / (width - 1))), Math.min(1, Math.max(0, (y + (y - cy) * 0.01) / (height - 1)))]);
    return { corners, sure: true };
  }

  // ---------- Qualität ----------
  function quality(canvas) {
    const small = scaled(canvas, 640), { g, width, height } = grayData(small);
    let mean = 0, sum = 0, sum2 = 0, n = 0; for (let i = 0; i < g.length; i++) mean += g[i]; mean /= g.length;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) { const i = y * width + x, lap = g[i - 1] + g[i + 1] + g[i - width] + g[i + width] - 4 * g[i]; sum += lap; sum2 += lap * lap; n++; }
    const variance = sum2 / n - (sum / n) ** 2;
    return { blurry: variance < 55, dark: mean < 75, sharpness: Math.round(variance), brightness: Math.round(mean) };
  }

  // ---------- Entzerren ----------
  // Homographie Ziel-Rechteck → Quell-Viereck (8 Unbekannte, Gauß-Verfahren), dann Rückwärts-Abtastung mit bilinearer Interpolation.
  function homography(from, to) {
    const A = [], b = [];
    for (let k = 0; k < 4; k++) { const [x, y] = from[k], [u, v] = to[k]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (let col = 0; col < 8; col++) {
      let pivot = col; for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      [A[col], A[pivot]] = [A[pivot], A[col]]; [b[col], b[pivot]] = [b[pivot], b[col]];
      for (let r = 0; r < 8; r++) { if (r === col) continue; const f = A[r][col] / A[col][col]; for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c]; b[r] -= f * b[col]; }
    }
    return b.map((v, k) => v / A[k][k]).concat(1);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function warp(source, cornersNorm) {
    const W = source.width, H = source.height, q = cornersNorm.map(([x, y]) => [x * (W - 1), y * (H - 1)]);
    let outW = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, outH = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    // fast DIN A4? Dann genau A4-Verhältnis (hoch oder quer)
    const r = outH / outW; if (Math.abs(r - A4) / A4 < 0.04) outH = outW * A4; else if (Math.abs(1 / r - A4) / A4 < 0.04) outW = outH * A4;
    const f = Math.min(1, WORK_SIDE / Math.max(outW, outH)); outW = Math.max(50, Math.round(outW * f)); outH = Math.max(50, Math.round(outH * f));
    const m = homography([[0, 0], [outW - 1, 0], [outW - 1, outH - 1], [0, outH - 1]], q);
    const src = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const out = canvasOf(outW, outH), octx = out.getContext('2d'), img = octx.createImageData(outW, outH), dst = img.data;
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const w = m[6] * x + m[7] * y + m[8], sx = (m[0] * x + m[1] * y + m[2]) / w, sy = (m[3] * x + m[4] * y + m[5]) / w;
      const x0 = Math.max(0, Math.min(W - 2, Math.floor(sx))), y0 = Math.max(0, Math.min(H - 2, Math.floor(sy))), fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0));
      const p00 = (y0 * W + x0) * 4, p10 = p00 + 4, p01 = p00 + W * 4, p11 = p01 + 4, d = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) dst[d + c] = (src[p00 + c] * (1 - fx) + src[p10 + c] * fx) * (1 - fy) + (src[p01 + c] * (1 - fx) + src[p11 + c] * fx) * fy;
      dst[d + 3] = 255;
    }
    octx.putImageData(img, 0, 0); return out;
  }
  function rotate(canvas, quarterTurns) {
    const t = ((quarterTurns % 4) + 4) % 4; if (!t) return canvas;
    const out = t % 2 ? canvasOf(canvas.height, canvas.width) : canvasOf(canvas.width, canvas.height), ctx = out.getContext('2d');
    ctx.translate(out.width / 2, out.height / 2); ctx.rotate(t * Math.PI / 2); ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); return out;
  }

  // ---------- Bildmodus ----------
  // „Dokument“: Beleuchtung ausgleichen (Schatten weg), heller Hintergrund, kräftiger Text – in Graustufen, damit nichts verloren geht.
  // „Farbe“: Beleuchtung ausgleichen, Farben bleiben (Stempel, Impfpass, Ausweise). „Original“: nur entzerrt.
  function enhance(canvas, mode) {
    if (mode === 'original') return canvas;
    const { width, height } = canvas, ctx = canvas.getContext('2d', { willReadFrequently: true }), img = ctx.getImageData(0, 0, width, height), d = img.data;
    const smallW = Math.max(8, Math.round(width / 16)), smallH = Math.max(8, Math.round(height / 16)), small = canvasOf(smallW, smallH);
    small.getContext('2d').drawImage(canvas, 0, 0, smallW, smallH);
    const { g } = grayData(small);
    // Hintergrund = helle Umgebung: Maximum-Filter (Text verschwindet), dann weichzeichnen
    const maxed = new Float32Array(g.length), R = 2;
    for (let y = 0; y < smallH; y++) for (let x = 0; x < smallW; x++) { let m = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = Math.min(smallH - 1, Math.max(0, y + dy)), xx = Math.min(smallW - 1, Math.max(0, x + dx)); m = Math.max(m, g[yy * smallW + xx]); } maxed[y * smallW + x] = m; }
    const bg = boxBlur(maxed, smallW, smallH, 2);
    const bgAt = (x, y) => { const sx = Math.min(smallW - 1.001, x / width * smallW), sy = Math.min(smallH - 1.001, y / height * smallH), x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0; const a = bg[y0 * smallW + x0], b = bg[y0 * smallW + Math.min(smallW - 1, x0 + 1)], c = bg[Math.min(smallH - 1, y0 + 1) * smallW + x0], e = bg[Math.min(smallH - 1, y0 + 1) * smallW + Math.min(smallW - 1, x0 + 1)]; return Math.max(40, (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy); };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, factor = 245 / bgAt(x, y);
      if (mode === 'document') {
        let v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * factor;
        v = v >= 235 ? 255 : Math.max(0, (v - 25) * 255 / 210); v = 255 * Math.pow(v / 255, 1.35);
        d[i] = d[i + 1] = d[i + 2] = Math.min(255, v);
      } else for (let c = 0; c < 3; c++) { const v = d[i + c] * factor; d[i + c] = v >= 250 ? 255 : Math.min(255, Math.max(0, (v - 10) * 255 / 240)); }
    }
    const out = canvasOf(width, height); out.getContext('2d').putImageData(img, 0, 0); return out;
  }
  function processPage(page) {
    const flat = warp(page.source, page.corners);
    page.result = rotate(enhance(flat, page.mode), page.rotation);
    page.thumb = scaled(page.result, 360).toDataURL('image/jpeg', 0.8);
  }

  // ---------- Texterkennung ----------
  let ocrWorker = null, ocrProgress = null;
  async function worker() {
    if (!ocrWorker) ocrWorker = (async () => {
      await loadScript(VENDOR + 'tesseract/tesseract.min.js');
      return window.Tesseract.createWorker('deu', 1, { workerPath: VENDOR + 'tesseract/worker.min.js', corePath: VENDOR + 'tesseract/', langPath: VENDOR + 'tesseract/lang', gzip: true, logger: m => ocrProgress?.(m) });
    })().catch(error => { ocrWorker = null; throw error; });
    return ocrWorker;
  }
  async function recognise(canvas, onProgress) {
    try { ocrProgress = onProgress; const w = await worker(); const { data } = await w.recognize(canvas); return { text: data.text || '', words: (data.words || []).filter(word => word.confidence > 35 && word.text.trim()) }; }
    catch { return { text: '', words: [] }; } finally { ocrProgress = null; }
  }

  // ---------- Oberfläche ----------
  let pages = [], context = {}, editIndex = -1, view = 'pages';
  function dialog() {
    let d = document.querySelector('#scannerDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'scannerDialog'; d.className = 'scanner-dialog'; document.body.append(d); d.addEventListener('cancel', event => { event.preventDefault(); close(); }); }
    return d;
  }
  function pickFiles(multiple) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    if (multiple) input.multiple = true; else input.capture = 'environment';
    input.addEventListener('change', async () => { const files = [...(input.files || [])]; if (!files.length) return; for (const file of files) await addPage(file, files.length === 1); if (files.length > 1) { view = 'pages'; render(); } });
    input.click();
  }
  async function addPage(file, edit = true) {
    const d = dialog(); d.querySelector('.scanner-busy')?.removeAttribute('hidden');
    try {
      const source = await loadImage(file), found = detectCorners(source);
      const page = { id: uid(), file, source, corners: found.corners, sure: found.sure, mode: 'document', rotation: 0, quality: quality(source) };
      processPage(page); pages.push(page); analysis = null;
      if (edit) { editIndex = pages.length - 1; view = 'edit'; } render();
    } catch { toast('Das Foto konnte nicht gelesen werden'); render(); }
  }
  function close() {
    if (pages.length && !confirm('Scan verwerfen? Die aufgenommenen Seiten gehen verloren.')) return;
    pages = []; analysis = null; ocrRun++; editIndex = -1; view = 'pages'; dialog().close();
  }
  function open(options = {}) {
    context = { folder: options.folder || document.querySelector('#documentFolder')?.value || 'Gemeinsam', fixedFolder: !!options.folder, category: options.category || document.querySelector('#documentCategory')?.value || '', name: options.name || '', actions: options.actions || [], orderId: options.orderId || null, onSaved: options.onSaved };
    analysis = null; ocrRun++; pages = []; editIndex = -1; view = 'pages'; render(); dialog().showModal();
    if (options.startCamera !== false) setTimeout(() => pickFiles(false), 60);
  }

  function render() {
    const d = dialog();
    if (view === 'edit' && pages[editIndex]) return renderEdit(d, pages[editIndex]);
    if (view === 'save') return renderSave(d);
    d.innerHTML = `<div class="scanner-head"><button class="scanner-text" data-sc-close>Abbrechen</button><strong>Dokument scannen</strong><span>${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'}</span></div>
      <div class="scanner-pages">${pages.map((p, i) => `<figure class="scanner-page"><button class="scanner-thumb" data-sc-edit="${i}" aria-label="Seite ${i + 1} bearbeiten"><img src="${p.thumb}" alt=""></button><figcaption><b>${i + 1}</b>${p.quality.blurry ? '<span class="scanner-warn">unscharf?</span>' : ''}<span class="scanner-page-actions"><button data-sc-move="${i}:-1" ${i ? '' : 'disabled'} aria-label="Nach vorne">◀</button><button data-sc-move="${i}:1" ${i < pages.length - 1 ? '' : 'disabled'} aria-label="Nach hinten">▶</button><button data-sc-delete="${i}" aria-label="Seite löschen">×</button></span></figcaption></figure>`).join('')}
        <button class="scanner-add" data-sc-camera><span>📷</span>${pages.length ? 'Nächste Seite' : 'Erste Seite fotografieren'}</button></div>
      <div class="scanner-busy" hidden>Foto wird vorbereitet …</div>
      <div class="scanner-foot"><button class="secondary" data-sc-photos>Aus Fotos wählen</button><button class="primary" data-sc-next ${pages.length ? '' : 'disabled'}>Weiter: Speichern</button></div>`;
  }

  function renderEdit(d, page) {
    d.innerHTML = `<div class="scanner-head"><button class="scanner-text" data-sc-retake>Neu aufnehmen</button><strong>Seite ${editIndex + 1}</strong><button class="scanner-text strong" data-sc-accept>Übernehmen ✓</button></div>
      ${page.quality.blurry || page.quality.dark ? `<p class="scanner-hint warn">${page.quality.blurry ? 'Das Foto wirkt unscharf.' : 'Das Foto ist recht dunkel.'} Lieber noch einmal aufnehmen?</p>` : `<p class="scanner-hint">${page.sure ? 'Ecken erkannt – bei Bedarf mit dem Finger verschieben.' : 'Ränder nicht sicher erkannt – ziehe die Ecken an die Blattecken.'}</p>`}
      <div class="scanner-stage"><canvas class="scanner-photo"></canvas><canvas class="scanner-lines"></canvas>${page.corners.map((_, k) => `<button class="scanner-handle" data-corner="${k}" aria-label="Ecke ${k + 1}"></button>`).join('')}<canvas class="scanner-loupe" width="120" height="120" hidden></canvas></div>
      <div class="scanner-tools"><div class="scanner-modes" role="group" aria-label="Bildmodus">${[['document', 'Dokument'], ['color', 'Farbe'], ['original', 'Original']].map(([k, l]) => `<button data-sc-mode="${k}" class="${page.mode === k ? 'active' : ''}" aria-pressed="${page.mode === k}">${l}</button>`).join('')}</div>
        <div class="scanner-row"><button class="secondary" data-sc-rotate>↻ Drehen${page.rotation ? ` (${page.rotation * 90}°)` : ''}</button><button class="secondary" data-sc-full>Ganze Seite</button><button class="secondary" data-sc-preview>Vorschau</button></div></div>`;
    const stage = d.querySelector('.scanner-stage'), photo = d.querySelector('.scanner-photo'), lines = d.querySelector('.scanner-lines'), loupe = d.querySelector('.scanner-loupe');
    const maxW = Math.min(window.innerWidth - 32, 760), maxH = Math.max(260, window.innerHeight - 330), f = Math.min(maxW / page.source.width, maxH / page.source.height);
    const W = Math.round(page.source.width * f), H = Math.round(page.source.height * f);
    for (const c of [photo, lines]) { c.width = W; c.height = H; c.style.width = `${W}px`; c.style.height = `${H}px`; }
    stage.style.width = `${W}px`; stage.style.height = `${H}px`;
    photo.getContext('2d').drawImage(page.source, 0, 0, W, H);
    const draw = () => {
      const ctx = lines.getContext('2d'); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(32,37,31,.35)'; ctx.beginPath(); ctx.rect(0, 0, W, H); page.corners.forEach(([x, y], k) => k ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)); ctx.closePath(); ctx.fill('evenodd');
      ctx.strokeStyle = '#7fd19b'; ctx.lineWidth = 2.5; ctx.beginPath(); page.corners.forEach(([x, y], k) => k ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)); ctx.closePath(); ctx.stroke();
      d.querySelectorAll('.scanner-handle').forEach(hd => { const [x, y] = page.corners[+hd.dataset.corner]; hd.style.left = `${x * W}px`; hd.style.top = `${y * H}px`; });
    };
    draw();
    d.querySelectorAll('.scanner-handle').forEach(handle => {
      handle.addEventListener('pointerdown', event => {
        event.preventDefault(); handle.setPointerCapture(event.pointerId); const k = +handle.dataset.corner, rect = stage.getBoundingClientRect(); loupe.hidden = false;
        const move = e => {
          const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / W)), y = Math.min(1, Math.max(0, (e.clientY - rect.top) / H)); page.corners[k] = [x, y]; page.sure = true; draw();
          // Lupe: vergrößerter Ausschnitt über dem Finger
          const lctx = loupe.getContext('2d'), zoom = 3, size = 120; lctx.clearRect(0, 0, size, size); lctx.save(); lctx.beginPath(); lctx.arc(60, 60, 58, 0, Math.PI * 2); lctx.clip();
          lctx.drawImage(photo, x * W - size / zoom / 2, y * H - size / zoom / 2, size / zoom, size / zoom, 0, 0, size, size); lctx.strokeStyle = '#7fd19b'; lctx.lineWidth = 2; lctx.beginPath(); lctx.moveTo(60, 48); lctx.lineTo(60, 72); lctx.moveTo(48, 60); lctx.lineTo(72, 60); lctx.stroke(); lctx.restore();
          loupe.style.left = `${Math.min(W - 120, Math.max(0, x * W - 60))}px`; loupe.style.top = `${y * H > 150 ? y * H - 150 : y * H + 30}px`;
        };
        const up = () => { loupe.hidden = true; handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up); move(event);
      });
    });
  }

  // ---------- Speichern mit Vorschlägen (Phase 2) ----------
  const A = () => window.ZuhauseScanAnalyse;
  const euro = n => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const ocrKey = page => `${page.corners.flat().map(v => v.toFixed(3)).join(',')}|${page.rotation}`;
  let analysis = null, ocrRun = 0;
  function ocrCanvasOf(page) { return page.mode === 'document' ? page.result : rotate(enhance(warp(page.source, page.corners), 'document'), page.rotation); }
  async function ocrAll(progress) {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]; if (page.ocr && page.ocrKey === ocrKey(page)) continue;
      progress?.(`Seite ${i + 1} von ${pages.length}: Text wird gelesen …`);
      page.ocr = await recognise(ocrCanvasOf(page), m => { if (m.status === 'recognizing text') progress?.(`Seite ${i + 1} von ${pages.length}: Text wird gelesen … ${Math.round(m.progress * 100)} %`); }); page.ocrKey = ocrKey(page);
    }
    return pages.map(p => p.ocr?.text || '').join('\n');
  }
  function openOrders() { return (state.noahJobs?.orders || []).filter(o => o.status === 'open'); }
  function plusDays(days) { const t = new Date(); t.setDate(t.getDate() + days); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }

  // Mögliche Folgeaktionen zum erkannten Dokument – nur mit Häkchen (vorausgewählt nur, wenn aus einem Bereich heraus gescannt)
  function suggestions(a) {
    const list = [], who = a.sender || a.label, preset = context.actions || [];
    const on = key => preset.includes(key);
    if (a.kind === 'invoice' || (a.due && a.kind !== 'receipt')) list.push({ key: 'task', checked: on('task'), title: 'Aufgabe „bezahlen“ anlegen', fields: `<input name="taskTitle" value="${h(`${who} bezahlen${a.total ? ` (${euro(a.total)})` : ''}`)}" aria-label="Titel der Aufgabe"><input name="taskDue" type="date" value="${a.due || plusDays(14)}" aria-label="Fällig am">` });
    if (a.kind === 'receipt' || on('expense')) list.push({ key: 'expense', checked: on('expense'), title: 'Als Ausgabe ins Budget', fields: `<input name="expenseTitle" value="${h(a.sender || 'Einkauf')}" aria-label="Wofür"><input name="expenseAmount" inputmode="decimal" value="${a.total ? String(a.total.toFixed(2)).replace('.', ',') : ''}" placeholder="Betrag in €" aria-label="Betrag"><input name="expenseDate" type="date" value="${a.docDate || plusDays(0)}" aria-label="Datum"><select name="expenseCategory" aria-label="Bereich">${['Gemeinsamer Haushalt', 'Persönlich', 'Nebengewerbe', 'Noch unklar'].map(c => `<option ${c === (a.diy ? 'Nebengewerbe' : 'Gemeinsamer Haushalt') ? 'selected' : ''}>${c}</option>`).join('')}</select>` });
    if (a.reminder) list.push({ key: 'reminder', checked: on('reminder'), title: 'Erinnerung im Kalender', note: a.reminderNote, fields: `<input name="reminderTitle" value="${h(`${who}: Vertrag prüfen / kündigen?`)}" aria-label="Titel"><input name="reminderDate" type="date" value="${a.reminder}" aria-label="Datum">` });
    if (a.vaccination || on('lou')) list.push({ key: 'lou', checked: on('lou'), title: 'Bei Lou: Impfung erledigt', fields: `<input name="louDate" type="date" value="${a.docDate || plusDays(0)}" aria-label="Geimpft am">` });
    const orders = openOrders();
    if (orders.length && (a.diy || on('material'))) list.push({ key: 'material', checked: on('material'), title: 'Als Material in Nebenjob-Auftrag', fields: `<select name="materialOrder" aria-label="Auftrag">${orders.map(o => `<option value="${h(o.id)}" ${o.id === context.orderId ? 'selected' : ''}>${h(o.title || 'Auftrag')}</option>`).join('')}</select><input name="materialName" value="${h(`${a.sender || 'Material'}${a.docDate ? ` ${A().german(a.docDate)}` : ''}`)}" aria-label="Bezeichnung"><input name="materialPrice" inputmode="decimal" value="${a.total ? String(a.total.toFixed(2)).replace('.', ',') : ''}" placeholder="Preis in €" aria-label="Preis">` });
    if (a.kind === 'payslip' || on('payslip')) list.push({ key: 'payslip', checked: on('payslip'), title: 'Danach Charleens Nebenjob öffnen', note: a.total ? `Auszahlung laut Abrechnung: ${euro(a.total)} – Stunden dort vergleichen.` : 'Stunden mit der Abrechnung vergleichen.', fields: '' });
    return list;
  }
  function renderSuggestions(d) {
    const box = d.querySelector('.scanner-suggest'); if (!box || !analysis) return;
    const list = suggestions(analysis);
    box.innerHTML = `${analysis.kind !== 'other' || analysis.sender ? `<p class="scanner-found">Erkannt: <b>${h(analysis.label)}</b>${analysis.sender ? ` von ${h(analysis.sender)}` : ''}${analysis.docDate ? ` · ${h(A().german(analysis.docDate))}` : ''}${analysis.total ? ` · ${h(euro(analysis.total))}` : ''}${analysis.learned ? ' · <span>Ordner gemerkt</span>' : ''}</p>` : '<p class="scanner-found">Kein bekannter Dokumenttyp erkannt – bitte Name und Ordner selbst wählen.</p>'}
      ${list.length ? `<p class="scanner-sub">Gleich mit erledigen?</p>${list.map(s => `<div class="scanner-action"><label><input type="checkbox" data-sc-action="${s.key}" ${s.checked ? 'checked' : ''}><span>${h(s.title)}</span></label>${s.note ? `<small>${h(s.note)}</small>` : ''}${s.fields ? `<div class="scanner-action-fields">${s.fields}</div>` : ''}</div>`).join('')}` : ''}`;
  }
  function fillFields(d) {
    if (!analysis) return;
    const set = (name, value) => { const el = d.querySelector(`[name=${name}]`); if (!el || el.dataset.touched || !value) return; if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === value)) return; el.value = value; el.classList.add('scanner-suggested'); };
    set('name', analysis.name); if (!context.fixedFolder) set('folder', analysis.folder); set('category', analysis.category);
  }

  function renderSave(d) {
    const categories = state.customCategories?.documents || ['Sonstige Dokumente'];
    const folderOptions = ['Gemeinsam', 'Noah', 'Charleen', 'Lou'].map(f => `<option ${f === context.folder ? 'selected' : ''}>${f}</option>`).join('');
    d.innerHTML = `<div class="scanner-head"><button class="scanner-text" data-sc-back>← Seiten</button><strong>Speichern</strong><span>${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'}</span></div>
      <div class="scanner-save"><div class="scanner-save-thumbs">${pages.slice(0, 4).map(p => `<img src="${p.thumb}" alt="">`).join('')}</div>
        <p class="scanner-progress" aria-live="polite"></p>
        <label class="ws-field"><span>Name</span><input name="name" maxlength="120" value="${h(context.name || '')}" placeholder="z. B. Rechnung Tierarzt November"></label>
        <label class="ws-field"><span>Ordner</span><select name="folder">${folderOptions}</select></label>
        <label class="ws-field"><span>Kategorie</span><select name="category">${categories.map(c => `<option ${c === context.category ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label>
        <div class="scanner-suggest"></div></div>
      <div class="scanner-foot"><button class="secondary" data-sc-back>Zurück</button><button class="primary" data-sc-save>PDF speichern</button></div>`;
    d.querySelectorAll('.scanner-save > label input, .scanner-save > label select').forEach(el => el.addEventListener('input', () => { el.dataset.touched = '1'; el.classList.remove('scanner-suggested'); }));
    if (analysis) { fillFields(d); renderSuggestions(d); return; }
    const run = ++ocrRun, progress = d.querySelector('.scanner-progress');
    ocrAll(text => { if (run === ocrRun) progress.textContent = text; }).then(text => {
      if (run !== ocrRun || view !== 'save') return;
      analysis = A()?.analyse(text, state.customCategories?.documents || [], state.scanRules || {}) || null;
      progress.textContent = ''; fillFields(d); renderSuggestions(d);
    });
  }

  function runActions(d, a, meta) {
    const done = [], value = name => d.querySelector(`[name=${name}]`)?.value?.trim() || '';
    const checked = key => d.querySelector(`[data-sc-action="${key}"]`)?.checked;
    const amount = name => { let s = value(name).replace(/[\s€]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) && n > 0 ? n : 0; };
    if (checked('task')) { const due = value('taskDue') || plusDays(14); state.householdTasks.unshift({ id: crypto.randomUUID(), seriesId: null, title: value('taskTitle') || 'Rechnung bezahlen', description: `Dokument: ${meta.name}`, person: 'Gemeinsam', dueOn: due, due, recurrenceAnchor: due, done: false, completedAt: null, recurrence: 'none', recurrenceInterval: 1, recurrenceUnit: 'weeks', alternate: false, createdAt: new Date().toISOString() }); done.push('Aufgabe'); }
    if (checked('expense') && amount('expenseAmount')) { const category = value('expenseCategory') || 'Gemeinsamer Haushalt'; state.expenses.unshift({ id: crypto.randomUUID(), title: value('expenseTitle') || 'Einkauf', store: value('expenseTitle'), date: value('expenseDate') || plusDays(0), amount: amount('expenseAmount'), person: 'Gemeinsam', category, receipt: true, review: ['Nebengewerbe', 'Noch unklar'].includes(category), receiptOcrText: meta.ocrText.slice(0, 4000), createdAt: new Date().toISOString(), icon: '▣' }); done.push('Ausgabe'); }
    if (checked('lou')) {
      if (!state.lou || typeof state.lou !== 'object') state.lou = {}; if (!Array.isArray(state.lou.care)) state.lou.care = [];
      const date = value('louDate') || plusDays(0); let item = state.lou.care.find(x => /impf/i.test(x.title));
      if (!item) { item = { id: crypto.randomUUID(), title: 'Impfung auffrischen', every: 1, unit: 'years', nextDue: date, lastDone: null, history: [] }; state.lou.care.push(item); }
      item.lastDone = date; item.history = [date, ...(item.history || []).filter(x => x !== date)].slice(0, 10); item.nextDue = window.ZuhauseLou?.addInterval?.(date, item.every, item.unit) || date; done.push('Lou');
    }
    if (checked('material')) { const order = (state.noahJobs?.orders || []).find(o => o.id === value('materialOrder')); if (order) { (order.materials ||= []).push({ id: crypto.randomUUID(), name: value('materialName') || 'Material', qty: 1, unit: '', price: amount('materialPrice') }); done.push('Material'); } }
    if (done.length) { persist(); try { renderAll(); } catch {} window.ZuhauseLou?.render?.(); window.ZuhauseNoahJobs?.render?.(); window.ZuhauseFeatures?.refresh?.(); }
    if (checked('reminder')) setTimeout(() => {
      window.ZuhauseCalendar?.openCreate?.(value('reminderDate') || plusDays(330)); const form = document.querySelector('#calendarEventForm'); if (!form) return;
      form.elements.title.value = value('reminderTitle'); form.elements.allDay.checked = true; form.elements.allDay.dispatchEvent(new Event('change', { bubbles: true }));
      if (form.elements.notes) form.elements.notes.value = `${a?.reminderNote || ''}\nDokument: ${meta.name}`.trim();
    }, 150);
    if (checked('payslip')) { go('study'); setTimeout(() => document.querySelector('[data-ch-tab=job]')?.click(), 100); }
    return done;
  }

  async function save() {
    const d = dialog(), name = d.querySelector('[name=name]').value.trim(), folder = d.querySelector('[name=folder]').value, category = d.querySelector('[name=category]').value, progress = d.querySelector('.scanner-progress');
    d.querySelectorAll('button, input, select').forEach(b => { b.disabled = true; });
    try {
      ocrRun++; const text = await ocrAll(t => { progress.textContent = t; });
      progress.textContent = 'PDF wird erstellt …';
      await loadScript(VENDOR + 'jspdf.umd.min.js');
      const { jsPDF } = window.jspdf; let pdf = null;
      for (const page of pages) {
        const canvas = page.result, words = page.ocr?.words || [];
        // Seitenformat: A4 (hoch/quer) oder passend zum Blatt (z. B. lange Kassenbons)
        const ratio = canvas.height / canvas.width, a4 = Math.abs(ratio - A4) / A4 < 0.02, a4q = Math.abs(1 / ratio - A4) / A4 < 0.02;
        const pw = a4 ? 210 : a4q ? 297 : 210, ph = a4 ? 297 : a4q ? 210 : Math.min(5000, 210 * ratio);
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: pw > ph ? 'landscape' : 'portrait', compress: true }); else pdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', page.mode === 'document' ? 0.8 : 0.85), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
        // unsichtbare Textebene: macht das PDF durchsuchbar und den Text markierbar
        const sx = pw / canvas.width, sy = ph / canvas.height;
        for (const word of words) { const { x0, y0, x1, y1 } = word.bbox, height = (y1 - y0) * sy; if (height <= 0) continue; pdf.setFontSize(Math.max(2, height * 2.6)); try { pdf.text(word.text, x0 * sx, y1 * sy, { renderingMode: 'invisible', maxWidth: (x1 - x0) * sx * 1.2 }); } catch {} }
      }
      progress.textContent = 'Wird gespeichert …';
      const finalName = name || `Scan ${new Date().toLocaleDateString('de-DE')}`;
      const blob = pdf.output('blob'), fileName = `${finalName.replace(/[^\wäöüÄÖÜß .-]+/g, '-')}.pdf`;
      const thumb = await window.ZuhauseDocuments?.imageThumb?.(pages[0].result);
      const meta = { folder, category, ocrText: text.trim(), name: finalName, originalFiles: pages.map(p => p.file), thumb };
      window.__pendingDocumentMeta = meta;
      const saved = await uploadDocument(new File([blob], fileName, { type: 'application/pdf' }));
      if (!saved) throw new Error('Upload fehlgeschlagen');
      if (analysis?.senderKey) { A()?.learn(analysis.senderKey, folder, category); persist(); }
      const a = analysis, actions = runActions(d, a, meta), callback = context.onSaved;
      pages = []; analysis = null; d.close();
      toast(actions.length ? `Gespeichert · ${actions.join(', ')} angelegt` : 'Dokument gespeichert'); callback?.({ name: finalName, folder, category, text });
    } catch { progress.textContent = 'Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.'; d.querySelectorAll('button, input, select').forEach(b => { b.disabled = false; }); }
  }

  document.addEventListener('click', event => {
    const b = event.target.closest('#scannerDialog button'); if (!b || b.disabled) return; const ds = b.dataset;
    if ('scClose' in ds) close();
    if ('scCamera' in ds) pickFiles(false);
    if ('scPhotos' in ds) pickFiles(true);
    if ('scEdit' in ds) { editIndex = +ds.scEdit; view = 'edit'; render(); }
    if ('scMove' in ds) { const [i, step] = ds.scMove.split(':').map(Number); const j = i + step; if (pages[j]) { [pages[i], pages[j]] = [pages[j], pages[i]]; render(); } }
    if ('scDelete' in ds) { pages.splice(+ds.scDelete, 1); analysis = null; render(); }
    if ('scNext' in ds) { view = 'save'; render(); }
    if ('scBack' in ds) { view = 'pages'; render(); }
    if ('scSave' in ds) save();
    const page = pages[editIndex];
    if (!page || view !== 'edit') return;
    if ('scRetake' in ds) { pages.splice(editIndex, 1); view = 'pages'; render(); pickFiles(false); }
    if ('scAccept' in ds) { processPage(page); analysis = null; view = 'pages'; render(); }
    if ('scMode' in ds) { page.mode = ds.scMode; renderEdit(dialog(), page); }
    if ('scRotate' in ds) { page.rotation = (page.rotation + 1) % 4; renderEdit(dialog(), page); }
    if ('scFull' in ds) { page.corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; renderEdit(dialog(), page); }
    if ('scPreview' in ds) { processPage(page); const w = window.open(); if (w) { w.document.title = 'Vorschau'; const img = w.document.createElement('img'); img.src = page.result.toDataURL('image/jpeg', 0.85); img.style.maxWidth = '100%'; w.document.body.append(img); } }
  });

  // Bisherige Scan-Knöpfe (Dokumente-Seite) öffnen den neuen Scanner – vor deren alten Klick-Verhalten abgefangen
  document.addEventListener('click', event => {
    const button = event.target.closest('#multiScan, #scanDocument'); if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation(); open();
  }, true);
  // „Dokument scannen“ aus einem Bereich heraus (Lou, Charleen, Nebenjob-Auftrag): Ordner und Aktion vorausgewählt
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-scan-here]'); if (!button) return;
    event.preventDefault(); const ds = button.dataset;
    open({ folder: ds.scanFolder, actions: (ds.scanActions || '').split(',').filter(Boolean), orderId: ds.scanOrder || null });
  });
  window.ZuhauseScanner = { open, detectCorners, warp, enhance, quality, recognise };
})();
