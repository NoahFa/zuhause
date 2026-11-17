// Prüfung des Dokumentenscanners mit einer festen Sammlung schwieriger Fotos (künstlich erzeugt, keine echten Dokumente):
// schräg auf Holztisch, Schatten, Querformat, langer Kassenbon, heller Tisch, Blatt füllt das ganze Bild, unscharf, zu dunkel,
// farbiger Impfpass. Geprüft werden Ecken-Erkennung, Qualitätswarnung, Texterkennung (lokales Tesseract), Dokumentart/Ordner-
// Vorschläge, der komplette Speichern-Ablauf mit Folgeaktionen und die Warteschlange ohne Internet.
//
// Aufruf:  node tests/scanner-check.cjs [ausgabeordner-für-fotos]
// Voraussetzung: Playwright mit Chromium (in Claude-Cloud-Umgebungen vorinstalliert).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (out) fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); });
});

let failures = 0;
const check = (ok, label, detail = '') => { console.log(`${ok ? 'OK  ' : 'FEHLER'}  ${label}${detail ? ` – ${detail}` : ''}`); if (!ok) failures++; };

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port, browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/supabase\.co|regioit|open-meteo|fussball|jsdelivr/, r => r.abort());
  await page.goto(`http://127.0.0.1:${port}/?preview=calendar`); await page.waitForTimeout(1000);

  // ---------- Bildfälle ----------
  const results = await page.evaluate(async () => {
    const S = window.ZuhauseScanner;
    function make(w, h, background, paper, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = background; x.fillRect(0, 0, w, h);
      if (paper) { x.save(); x.beginPath(); paper.quad.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fillStyle = paper.color || '#eeeae0'; x.fill(); x.clip(); draw?.(x); x.restore(); } else draw?.(x);
      return c;
    }
    const lines = (x, list, left, top, step, font = '42px sans-serif', skew = [1, 0, 0, 1]) => { x.setTransform(skew[0], skew[1], skew[2], skew[3], 0, 0); x.fillStyle = '#1d1d1d'; x.font = font; list.forEach((t, i) => x.fillText(t, left, top + i * step)); x.setTransform(1, 0, 0, 1, 0, 0); };
    const invoice = ['RECHNUNG Nr. 2026-118', 'Tierarztpraxis Beispiel', 'Datum: 03.11.2026', 'Untersuchung 30,00 EUR', 'Gesamt 30,00 EUR', 'Zahlbar bis 17.11.2026'];
    const wood = (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#6b4a2f'); g.addColorStop(1, '#3e2a1a'); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    const cases = [];
    // 1 schräg auf Holztisch
    { const quad = [[260, 240], [1260, 330], [1330, 1760], [170, 1640]]; const c = make(1500, 2000, '#000', null); const x = c.getContext('2d'); wood(x, 1500, 2000);
      x.save(); x.beginPath(); quad.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fillStyle = '#eeeae0'; x.fill(); x.clip(); lines(x, invoice, 330, 420, 130, 'bold 52px sans-serif', [1, .09, -.055, 1]); x.restore();
      cases.push({ name: 'Schräg auf Holztisch', c, quad, ocr: /tierarztpraxis/i }); }
    // 2 Schatten über halbem Blatt
    { const quad = [[200, 200], [1300, 200], [1300, 1760], [200, 1760]]; const c = make(1500, 2000, '#4d4a45', { quad }, x => { lines(x, invoice, 280, 360, 130, 'bold 52px sans-serif'); const g = x.createLinearGradient(0, 0, 1500, 0); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 1500, 2000); });
      cases.push({ name: 'Schatten auf dem Blatt', c, quad, ocr: /gesamt/i }); }
    // 3 Querformat
    { const quad = [[150, 220], [1850, 260], [1830, 1290], [170, 1260]]; const c = make(2000, 1500, '#2f3b46', { quad }, x => lines(x, ['Mietvertrag', 'Kündigungsfrist 3 Monate'], 260, 450, 140, 'bold 64px sans-serif'));
      cases.push({ name: 'Querformat', c, quad, ocr: /mietvertrag/i }); }
    // 4 langer Kassenbon
    { const quad = [[450, 60], [750, 60], [750, 1540], [450, 1540]]; const c = make(1200, 1600, '#2b2b2b', { quad, color: '#fff' }, x => lines(x, Array.from({ length: 26 }, (_, i) => `Artikel ${i} 1,99`), 470, 120, 52, '24px monospace'));
      cases.push({ name: 'Langer Kassenbon', c, quad }); }
    // 5 heller Tisch
    { const quad = [[150, 120], [1080, 180], [1040, 1500], [110, 1450]]; const c = make(1200, 1600, '#cfcac0', { quad, color: '#fbfbf8' }, x => lines(x, invoice, 200, 300, 110));
      cases.push({ name: 'Heller Tisch', c, quad }); }
    // 6 Blatt füllt das ganze Bild (nichts abschneiden!)
    { const c = make(1200, 1600, '#f2f0ea', null, x => lines(x, invoice, 120, 200, 110));
      cases.push({ name: 'Blatt füllt ganzes Bild', c, quad: [[0, 0], [1199, 0], [1199, 1599], [0, 1599]] }); }
    // 7 farbiger Impfpass auf dunklem Tisch
    { const quad = [[300, 300], [1200, 330], [1180, 1500], [280, 1470]]; const c = make(1500, 1800, '#262626', { quad, color: '#dbe6f5' }, x => { lines(x, ['Heimtierausweis', 'Tollwut', 'Impfung 03.11.2026'], 360, 480, 120, 'bold 50px sans-serif'); x.fillStyle = 'rgba(30,80,200,.5)'; x.beginPath(); x.arc(900, 1100, 120, 0, 7); x.fill(); });
      cases.push({ name: 'Farbiger Impfpass', c, quad, ocr: /tollwut/i }); }
    // 8 unscharf, 9 zu dunkel
    { const c = make(1200, 1600, '#555', null, x => { x.filter = 'blur(7px)'; x.fillStyle = '#eee'; x.fillRect(200, 200, 800, 1100); lines(x, invoice, 260, 400, 110); }); cases.push({ name: 'Unscharf', c, expectBlurry: true }); }
    { const c = make(1200, 1600, '#111', { quad: [[200, 200], [1000, 200], [1000, 1300], [200, 1300]], color: '#3a3936' }); cases.push({ name: 'Zu dunkel', c, expectDark: true }); }

    const res = [];
    for (const k of cases) {
      const found = S.detectCorners(k.c), q = S.quality(k.c);
      let error = null;
      if (k.quad) error = Math.max(...found.corners.map(([x, y], i) => Math.hypot(x * (k.c.width - 1) - k.quad[i][0], y * (k.c.height - 1) - k.quad[i][1]) / Math.hypot(k.c.width, k.c.height)));
      let text = '';
      if (k.ocr) { const flat = S.enhance(S.warp(k.c, found.corners), 'document'); text = (await S.recognise(flat)).text; }
      const flat = S.warp(k.c, found.corners);
      res.push({ name: k.name, error, ocrOk: k.ocr ? k.ocr.test(text) : null, text: text.slice(0, 60).replace(/\s+/g, ' '), blurry: q.blurry, dark: q.dark, expectBlurry: !!k.expectBlurry, expectDark: !!k.expectDark, preview: flat.width > 900 ? null : null, size: [flat.width, flat.height], img: S.enhance(flat, 'document').toDataURL('image/jpeg', .6) });
    }
    return res;
  });
  for (const r of results) {
    if (r.error !== null) check(r.error < 0.03, `Ecken: ${r.name}`, `Abweichung ${(r.error * 100).toFixed(1)} % der Bilddiagonale`);
    if (r.ocrOk !== null) check(r.ocrOk, `Texterkennung: ${r.name}`, r.text);
    if (r.expectBlurry) check(r.blurry, `Warnung unscharf: ${r.name}`);
    if (r.expectDark) check(r.dark, `Warnung zu dunkel: ${r.name}`);
    if (!r.expectBlurry && !r.expectDark) check(!r.blurry && !r.dark, `Keine Fehlwarnung: ${r.name}`);
    if (out) fs.writeFileSync(path.join(out, `${r.name.replace(/[^\wäöü]+/gi, '-')}.jpg`), Buffer.from(r.img.split(',')[1], 'base64'));
  }

  // ---------- Dokumentart, Absender, Beträge ----------
  const analysed = await page.evaluate(() => {
    const A = window.ZuhauseScanAnalyse, cats = ['Versicherungen', 'Verträge', 'Rechnungen', 'Steuerunterlagen', 'Sonstige Dokumente'];
    return {
      vet: A.analyse('RECHNUNG Nr. 4711\nTierarztpraxis Muster\nDatum: 12.11.2026\nImpfung Lou 45,00 EUR\nGesamt 75,00 EUR\nZahlbar bis 26.11.2026', cats),
      receipt: A.analyse('REWE Markt GmbH\nBANANEN 1,99\nMILCH 1,29\nSUMME EUR 3,28\nGeg. EC-Karte 3,28\nDatum 15.11.26\nBon-Nr 1234', cats),
      contract: A.analyse('Stadtwerke Beispiel GmbH\nIhr Stromvertrag\nVertragslaufzeit bis 31.12.2027\nKündigungsfrist 1 Monat\nDatum 01.11.2026', cats),
      payslip: A.analyse('Kauler Hof GmbH\nVerdienstabrechnung Oktober 2026\nBrutto 603,00\nAuszahlungsbetrag 603,00 EUR', cats),
      diy: A.analyse('HORNBACH Baumarkt AG\nSchrauben 6,49\nSilikon 8,99\nSumme 15,48 EUR\nKartenzahlung\n14.11.2026', cats),
      days: A.analyse('Rechnung\nMalerbetrieb Beispiel\nRechnungsdatum 10.11.2026\nBetrag 120,00 €\nZahlbar innerhalb von 14 Tagen', cats),
      learned: A.analyse('Kassenbon\nREWE Markt GmbH\nSumme 3,28 EUR', cats, { 'rewe markt': { folder: 'Noah', category: 'Rechnungen' } }),
    };
  });
  const a = analysed;
  check(a.vet.kind === 'invoice' && a.vet.vaccination && a.vet.folder === 'Lou' && a.vet.total === 75 && a.vet.due === '2026-11-26', 'Tierarzt-Rechnung: Rechnung, Ordner Lou, 75 €, fällig 26.11.', JSON.stringify([a.vet.kind, a.vet.folder, a.vet.total, a.vet.due]));
  check(a.receipt.kind === 'receipt' && a.receipt.total === 3.28 && a.receipt.docDate === '2026-11-15', 'Kassenbon: Betrag und Datum', JSON.stringify([a.receipt.kind, a.receipt.total, a.receipt.docDate]));
  check(a.contract.kind === 'contract' && a.contract.category === 'Verträge' && a.contract.reminder === '2027-11-16', 'Vertrag: Erinnerung vor Kündigungsfrist', JSON.stringify([a.contract.kind, a.contract.reminder]));
  check(a.payslip.kind === 'payslip' && a.payslip.folder === 'Charleen' && a.payslip.total === 603, 'Lohnabrechnung: Charleen, Auszahlung 603 €', JSON.stringify([a.payslip.kind, a.payslip.folder, a.payslip.total]));
  check(a.diy.diy && a.diy.total === 15.48, 'Baumarkt-Beleg: als Material erkannt', JSON.stringify([a.diy.diy, a.diy.total]));
  check(a.days.due === '2026-11-24' && a.days.total === 120, 'Zahlungsziel „innerhalb von 14 Tagen“', JSON.stringify([a.days.due, a.days.total]));
  check(a.learned.folder === 'Noah' && a.learned.learned, 'Gelernter Absender bestimmt den Ordner');

  // ---------- Kompletter Ablauf mit Folgeaktionen, danach ohne Internet ----------
  const photo = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1500; c.height = 2000; const x = c.getContext('2d'); x.fillStyle = '#4a3523'; x.fillRect(0, 0, 1500, 2000); x.fillStyle = '#eeeae0'; x.fillRect(220, 220, 1060, 1500); x.fillStyle = '#222'; x.font = 'bold 56px sans-serif'; ['RECHNUNG Nr. 4711', 'Tierarztpraxis Muster', 'Datum: 12.11.2026', 'Impfung Lou 45,00 EUR', 'Gesamt 75,00 EUR', 'Zahlbar bis 26.11.2026'].forEach((t, i) => x.fillText(t, 300, 400 + i * 140)); return c.toDataURL('image/jpeg', .9); });
  const tmp = path.join(require('node:os').tmpdir(), `scan-check-${process.pid}.jpg`); fs.writeFileSync(tmp, Buffer.from(photo.split(',')[1], 'base64'));
  async function scanOnce() {
    await page.evaluate(() => go('documents')); await page.waitForTimeout(200);
    const chooser = page.waitForEvent('filechooser'); await page.click('#multiScan'); await (await chooser).setFiles(tmp);
    await page.waitForSelector('[data-sc-accept]'); await page.click('[data-sc-accept]'); await page.click('[data-sc-next]');
    await page.waitForSelector('.scanner-action', { timeout: 60000 });
  }
  await scanOnce();
  const fields = await page.evaluate(() => ['name', 'folder', 'category'].map(n => document.querySelector(`#scannerDialog [name=${n}]`).value));
  check(fields[1] === 'Lou' && /Rechnung Tierarztpraxis Muster/.test(fields[0]), 'Vorschlag im Scanner: Name und Ordner', fields.join(' | '));
  await page.check('[data-sc-action=task]'); await page.check('[data-sc-action=lou]');
  await page.evaluate(() => { window.__uploads = []; window.uploadDocument = async file => { window.__uploads.push({ name: file.name, size: file.size, meta: window.__pendingDocumentMeta }); return 'pfad'; }; cloudReady = true; });
  await page.click('[data-sc-save]'); await page.waitForFunction(() => window.__uploads.length === 1, null, { timeout: 60000 });
  const flow = await page.evaluate(() => ({ upload: window.__uploads[0], task: state.householdTasks[0], lou: (state.lou?.care || []).find(x => /impf/i.test(x.title)), rule: state.scanRules?.['tierarztpraxis muster'] }));
  check(flow.upload.size > 10000 && flow.upload.size < 2_000_000, 'PDF-Größe einer Seite', `${Math.round(flow.upload.size / 1024)} KB`);
  check(flow.upload.meta.originalFiles.length === 1 && flow.upload.meta.thumb, 'Originalfoto und Vorschaubild werden mitgesichert');
  check(/RECHNUNG/i.test(flow.upload.meta.ocrText), 'Erkannter Text wird mitgespeichert');
  check(flow.task?.dueOn === '2026-11-26' && /bezahlen/.test(flow.task.title), 'Folgeaktion: Aufgabe „bezahlen“ mit Fälligkeit', flow.task?.title);
  check(flow.lou?.lastDone === '2026-11-12', 'Folgeaktion: Lous Impfung eingetragen');
  check(flow.rule?.folder === 'Lou', 'Absender wurde gelernt');

  await scanOnce();
  await page.evaluate(() => { cloudReady = false; });
  await page.click('[data-sc-save]'); await page.waitForFunction(() => !document.querySelector('#scannerDialog').open, null, { timeout: 60000 });
  const queued = await page.evaluate(async () => (await window.ZuhauseScanner.queueAll()).length);
  check(queued === 1, 'Ohne Internet: Scan wartet auf dem Handy');
  await page.evaluate(async () => { cloudReady = true; currentHousehold = currentHousehold || { id: 'test' }; await window.ZuhauseScanner.flushQueue(true); });
  const after = await page.evaluate(async () => ({ left: (await window.ZuhauseScanner.queueAll()).length, uploads: window.__uploads.length }));
  check(after.left === 0 && after.uploads === 2, 'Wieder online: wartender Scan wird hochgeladen', JSON.stringify(after));

  check(!errors.length, 'Keine Skriptfehler', errors.join(' | '));
  fs.rmSync(tmp, { force: true });
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlle Scanner-Prüfungen bestanden.');
  process.exit(failures ? 1 : 0);
});
