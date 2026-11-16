// Oberflächen-Prüfung für die Prüf-Agenten: öffnet alle Seiten der App im Vorschau-Modus (ohne Anmeldung, ohne echte Daten),
// füllt Beispieldaten ein und prüft auf Handy (390 px), Tablet (768 px) und Desktop (1440 px):
// Skriptfehler, waagerechtes Überlaufen, zu kleine Tippflächen und abgeschnittene Elemente. Fotos landen im angegebenen Ordner.
//
// Aufruf:  node tests/ui-check.cjs <ausgabeordner> [breiten, z. B. 390,768,1440]
// Voraussetzung: Playwright mit Chromium (in Claude-Cloud-Umgebungen vorinstalliert).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'ui-check-ergebnis');
const widths = (process.argv[3] || '390,768,1440').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); });
});

// Seiten: [Name, Aktion im Browser]
const pages = [
  ['heute', "go('today')"], ['kalender-monat', "go('calendar')"], ['kalender-woche', "go('calendar'); document.querySelector('[data-calendar-view=week]').click()"],
  ['kalender-agenda', "go('calendar'); document.querySelector('[data-calendar-view=agenda]').click()"], ['haushalt', "go('household')"], ['finanzen', "go('finances')"],
  ['mehr', "go('more')"], ['dokumente', "go('documents')"], ['lou', "go('lou')"], ['noah', "go('noah')"],
  ['montage-auftrag', "go('montage')"], ['montage-auto', "go('montage'); document.querySelector('[data-montage-tab=van]').click()"],
  ['nebenjobs', "go('nebenjob')"], ['charleen-studium', "go('study')"], ['charleen-nebenjob', "go('study'); document.querySelector('[data-ch-tab=job]').click()"],
  ['charleen-caritas', "go('study'); document.querySelector('[data-ch-tab=work]').click()"], ['charleen-sparziele', "go('study'); document.querySelector('[data-ch-tab=savings]').click()"],
  ['charleen-aufgaben', "go('study'); document.querySelector('[data-ch-tab=notes]').click()"],
];

const demo = () => {
  const today = new Date(), iso = d => d.toISOString().slice(0, 10), plus = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  state.householdTasks = [{ id: 't1', title: 'Bad putzen', person: 'person1', dueOn: plus(-1), done: false, recurrence: 'weekly', alternate: true, seriesId: 's1' }, { id: 't2', title: 'Pflanzen gießen', person: 'Gemeinsam', dueOn: plus(2), done: false, recurrence: 'none' }];
  state.shopping = [{ id: 'e1', title: 'Milch', quantity: '2 ×', category: 'Kühlprodukte', done: false }, { id: 'e2', title: 'Bananen', quantity: '', category: 'Obst und Gemüse', done: true }];
  state.montageMaterials = [{ id: 'm1', name: 'Montageschaum', quantity: '6 Dosen', category: 'Abdichten', refill: true }];
  state.montageJobs = [{ id: 'j1', title: 'Fenster Müller', date: plus(1), address: 'Hauptstraße 5, Köln', status: 'draft', machines: [], materials: [], tasks: [{ id: 'a', title: 'Ausbauen', done: false }] }];
  state.lou = { care: [{ id: 'c1', title: 'Wurmkur', every: 3, unit: 'months', nextDue: plus(-2) }], profile: { vetName: 'Tierarzt', vetPhone: '0123', chip: '123' } };
  state.charleen = { modules: [{ id: 'mo', name: 'Embodiment', exams: [{ id: 'x', type: 'Präsentation', date: plus(20), status: 'open' }] }], job: { name: 'Kauler Hof', rate: 13.9, monthCap: 603, entries: [{ id: 's', date: plus(-1), start: '16:00', end: '23:30', pause: 0, tip: 12, rate: 13.9 }], adjustments: [] }, work: [{ id: 'w', title: 'Hilfeplan schreiben', dueOn: plus(-1), done: false }], savings: [{ id: 'g', name: 'Urlaub', target: 1200, deadline: plus(200), deposits: [{ id: 'd', date: iso(today), amount: 250 }] }] };
  state.noahJobs = { rate: 35, orders: [{ id: 'o', title: 'Terrassendach Becker', customer: 'Fam. Becker', status: 'open', times: [{ id: 'z', date: iso(today), start: '08:00', end: '12:00', pause: 15 }], materials: [{ id: 'mm', name: 'Schrauben', qty: 2, unit: 'Pack', price: 9.5 }] }] };
  state.studyItems = [{ id: 'n', title: 'Adventskalender', dueOn: '', done: false }];
  window.ZuhauseCalendar?.setExtraEvents?.('demo', [['shared', 'Essen bei Oma', 1], ['person1', 'Braukurs', 2], ['person2', 'Krankenhaus', 2]].map(([key, title, n], i) => ({ id: 'ev' + i, calendarKey: key, title, allDay: false, startDate: plus(n), endDate: plus(n), startTime: '18:00', endTime: '19:00', labelColor: 'calendar', revision: 1, readOnly: false, recurrence: null, participantKeys: [key], reminderMinutes: [] })));
  renderAll();
};

const audit = () => {
  const vw = innerWidth, issues = { ueberlauf: document.documentElement.scrollWidth > vw + 1, breiterAlsBildschirm: [], kleineTippflaechen: [], ohneBeschriftung: [] };
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && el.closest('.page.active, .topbar, .mobile-nav, .workspace-switch, dialog[open]'); };
  const label = el => (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.name || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
  document.querySelectorAll('.page.active *').forEach(el => { if (!visible(el)) return; const r = el.getBoundingClientRect(); if (r.right > vw + 2 && getComputedStyle(el).position !== 'fixed' && !el.closest('.calendar-filter-strip, .ws-tabs, [style*=overflow]')) issues.breiterAlsBildschirm.push(label(el)); });
  if (vw < 800) document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, label.check-row').forEach(el => { if (!visible(el)) return; const r = el.getBoundingClientRect(); if ((r.height < 36 || r.width < 36) && !el.closest('.cal-day')) issues.kleineTippflaechen.push(`${label(el)} (${Math.round(r.width)}×${Math.round(r.height)})`); });
  document.querySelectorAll('button, a[href]').forEach(el => { if (visible(el) && !label(el)) issues.ohneBeschriftung.push(el.outerHTML.slice(0, 80)); });
  for (const key of ['breiterAlsBildschirm', 'kleineTippflaechen', 'ohneBeschriftung']) issues[key] = [...new Set(issues[key])].slice(0, 12);
  return issues;
};

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, browser = await chromium.launch(), report = {};
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push(m.text()); });
    await page.route(/supabase\.co|regioit|open-meteo|fussball|jsdelivr|tessdata/, r => r.abort());
    await page.goto(`http://127.0.0.1:${port}/?preview=calendar`); await page.waitForTimeout(1200);
    await page.evaluate(demo); await page.waitForTimeout(300);
    for (const [name, action] of pages) {
      errors.length = 0;
      try { await page.evaluate(action); } catch (e) { errors.push(`Seite nicht erreichbar: ${e.message.split('\n')[0]}`); }
      await page.waitForTimeout(350); await page.evaluate(() => scrollTo(0, 0));
      const result = await page.evaluate(audit);
      await page.screenshot({ path: path.join(out, `${width}-${name}.png`), fullPage: true });
      report[`${width}px ${name}`] = { fehler: [...new Set(errors)], ...result };
    }
    await page.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(out, 'bericht.json'), JSON.stringify(report, null, 1));
  const problems = Object.entries(report).filter(([, r]) => r.fehler.length || r.ueberlauf || r.breiterAlsBildschirm.length || r.kleineTippflaechen.length || r.ohneBeschriftung.length);
  console.log(`Geprüft: ${Object.keys(report).length} Ansichten, Fotos und bericht.json in ${out}`);
  for (const [name, r] of problems) console.log(`\n${name}:` + (r.fehler.length ? `\n  Fehler: ${r.fehler.join(' | ')}` : '') + (r.ueberlauf ? '\n  Seite läuft waagerecht über' : '') + (r.breiterAlsBildschirm.length ? `\n  Breiter als der Bildschirm: ${r.breiterAlsBildschirm.join(' | ')}` : '') + (r.kleineTippflaechen.length ? `\n  Kleine Tippflächen: ${r.kleineTippflaechen.join(' | ')}` : '') + (r.ohneBeschriftung.length ? `\n  Ohne Beschriftung: ${r.ohneBeschriftung.join(' | ')}` : ''));
  if (!problems.length) console.log('Keine Auffälligkeiten.');
})().catch(error => { console.error(error); server.close(); process.exit(1); });
