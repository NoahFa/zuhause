// Prüfung des Rezeptkatalogs (Vorschau-Modus, ohne Anmeldung, ohne echte Daten):
// Zutaten lesen, Portionen umrechnen, Basics, Übertragen auf die Einkaufsliste mit Zusammenrechnen und Supermarktbereich,
// sowie der Ablauf in der Oberfläche (Reiter, Rezept eintippen, ansehen, Favorit, Vorschau, Übernehmen, Löschen).
//
// Aufruf:  node tests/recipes-check.cjs [ordner-für-fotos]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (out) fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
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
  await page.route(/supabase\.co|regioit|open-meteo|fussball/, r => r.abort());
  await page.goto(`http://127.0.0.1:${port}/?preview=calendar`); await page.waitForTimeout(900);

  // ---------- Zutaten lesen und umrechnen ----------
  const parsed = await page.evaluate(() => {
    const R = window.ZuhauseRecipes;
    return ['500 g Spaghetti', '1,5 l Milch', '½ TL Salz', '1 ½ EL Zucker', '1/2 Zitrone', '3 Eier', '2-3 Zehen Knoblauch', 'Salz und Pfeffer', '2 Päckchen Vanillezucker', '• 200 gr Mehl', '1 Dose Tomaten (400 g)']
      .map(line => R.parseIngredient(line));
  });
  const p = parsed.map(x => `${x.amount ?? '-'}|${x.unit}|${x.name}`);
  check(p[0] === '500|g|Spaghetti', 'Gramm', p[0]);
  check(p[1] === '1.5|l|Milch', 'Komma-Zahl und Liter', p[1]);
  check(p[2] === '0.5|TL|Salz', 'Bruch ½ und TL', p[2]);
  check(p[3] === '1.5|EL|Zucker', '„1 ½ EL“', p[3]);
  check(p[4] === '0.5||Zitrone', '„1/2 Zitrone“', p[4]);
  check(p[5] === '3||Eier', 'Stückzahl ohne Einheit', p[5]);
  check(p[6] === '2|Zehe|Knoblauch', 'Spanne „2-3“ nimmt die erste Zahl', p[6]);
  check(p[7] === '-||Salz und Pfeffer', 'Ohne Menge', p[7]);
  check(p[8] === '2|Pck.|Vanillezucker', 'Päckchen', p[8]);
  check(p[9] === '200|g|Mehl', 'Aufzählungszeichen und „gr“', p[9]);
  check(p[10] === '1|Dose|Tomaten (400 g)', 'Dose mit Zusatz', p[10]);
  // Prüfung 18.11. (v45): gemischte Brüche, Tausenderpunkt, „bis“, englische Einheiten, Klammer vor Einheit, unter 1 g
  const more = await page.evaluate(() => ['1 1/2 TL Zucker', '1.000 g Mehl', '2 bis 3 Zwiebeln', '2 cups flour', '8 oz butter', '1 (400 g) Dose Tomaten', '1 Box Erdbeeren'].map(l => { const x = window.ZuhauseRecipes.parseIngredient(l); return `${x.amount}|${x.unit}|${x.name}`; }));
  check(more.join(' / ') === '1.5|TL|Zucker / 1000|g|Mehl / 2||Zwiebeln / 2|cup|flour / 8|oz|butter / 1|Dose|Tomaten (400 g) / 1|Box|Erdbeeren', 'Weitere Schreibweisen (1 1/2, 1.000 g, bis, cups, oz, Klammer, Box)', more.join(' / '));
  const small = await page.evaluate(() => [window.ZuhauseRecipes.formatAmount(0.25, 'g'), window.ZuhauseRecipes.formatAmount(3, 'Dose'), window.ZuhauseRecipes.formatAmount(1, 'Dose')]);
  check(small.join(' / ') === '0,3 g / 3 Dosen / 1 Dose', 'Unter 1 g mit Komma, Mehrzahl „Dosen“', small.join(' / '));
  const formatted = await page.evaluate(() => { const R = window.ZuhauseRecipes; return [R.formatAmount(250 * 4 / 2, 'g'), R.formatAmount(1.5 * 2, 'l'), R.formatAmount(0.5 * 3, ''), R.formatAmount(0.75, 'TL'), R.formatAmount(1200, 'ml'), R.formatAmount(333.33, 'g')]; });
  check(formatted.join(' / ') === '500 g / 3 l / 1½ / ¾ TL / 1,2 l / 335 g', 'Mengen lesbar umgerechnet', formatted.join(' / '));
  const basics = await page.evaluate(() => ['Salz', 'Meersalz', 'Olivenöl', 'Pfeffer, schwarz', 'Gemüsebrühe', 'Butter', 'Zwiebeln'].map(n => window.ZuhauseRecipes.isBasic(n)));
  check(basics.join(',') === 'true,true,true,true,true,false,false', 'Basics erkannt (auch „Meersalz“, „Gemüsebrühe“)', basics.join(','));

  // ---------- Zusammenrechnen auf der Einkaufsliste ----------
  const merged = await page.evaluate(() => {
    const R = window.ZuhauseRecipes;
    state.shopping = [
      { id: 's1', title: 'Hackfleisch', quantity: '500 g', category: 'Kühlprodukte', done: false },
      { id: 's2', title: 'Mehl', quantity: '1 kg', category: 'Trockenwaren', done: false },
      { id: 's3', title: 'Zwiebeln', quantity: '2 ×', category: 'Obst und Gemüse', done: false },
      { id: 's4', title: 'Sahne', quantity: '1 Becher', category: 'Kühlprodukte', done: false },
      { id: 's5', title: 'Milch', quantity: '1 l', category: 'Kühlprodukte', done: true },
      { id: 's6', title: 'Zucker', quantity: '1.000 g', category: 'Trockenwaren', done: false },
      { id: 's7', title: 'Erdbeeren', quantity: '1 Box', category: 'Obst und Gemüse', done: false },
    ];
    const result = R.addToShopping([
      { amount: 250, unit: 'g', name: 'Hackfleisch' }, { amount: 500, unit: 'g', name: 'Mehl' }, { amount: 1, unit: '', name: 'Zwiebel' },
      { amount: 200, unit: 'ml', name: 'Sahne' }, { amount: 500, unit: 'ml', name: 'Milch' }, { amount: 1, unit: 'Box', name: 'Erdbeeren' }, { amount: 200, unit: 'g', name: 'Zucker' }, { amount: 2, unit: '', name: 'große Zwiebeln' }, { amount: 2, unit: 'Zehe', name: 'Knoblauch' }, { amount: 400, unit: 'g', name: 'Spaghetti' },
    ], 1, 'Test');
    const q = t => state.shopping.filter(i => i.title.toLowerCase().startsWith(t)).map(i => `${i.quantity}${i.done ? '(erledigt)' : ''}`).join(' + ');
    return { result, zucker: q('zucker'), erdbeeren: q('erdbeer'), zwiebelAll: q('zwiebel'), hack: q('hack'), mehl: q('mehl'), zwiebel: q('zwiebel'), sahne: q('sahne'), milch: q('milch'), knoblauch: state.shopping.find(i => i.title === 'Knoblauch'), spaghetti: state.shopping.find(i => i.title === 'Spaghetti') };
  });
  check(merged.hack === '750 g', '500 g + 250 g Hackfleisch = 750 g', merged.hack);
  check(merged.mehl === '1,5 kg', '1 kg + 500 g Mehl = 1,5 kg', merged.mehl);
  check(merged.zwiebel === '5 ×', '2 × Zwiebeln + 1 Zwiebel + 2 große Zwiebeln = 5 ×', merged.zwiebel);
  check(merged.zucker === '1,2 kg', '„1.000 g“ Zucker + 200 g = 1,2 kg (Tausenderpunkt)', merged.zucker);
  check(merged.erdbeeren === '2 Boxen', '1 Box + 1 Box Erdbeeren = 2 Boxen („Box“ bleibt Box)', merged.erdbeeren);
  check(merged.sahne.split(' + ').length === 2, 'Becher + ml nicht umrechenbar → eigene Zeile', merged.sahne);
  check(merged.milch.includes('500 ml') && merged.milch.includes('(erledigt)'), 'Schon eingekaufte Milch zählt nicht – neue Zeile', merged.milch);
  check(merged.knoblauch?.quantity === '2 Zehen' && merged.knoblauch?.category, 'Neue Zutat mit Menge und Bereich', JSON.stringify(merged.knoblauch));
  check(merged.spaghetti?.category === 'Trockenwaren', 'Bereich über bestehende Zuordnung (Spaghetti → Trockenwaren)', merged.spaghetti?.category);
  check(merged.result.added === 4 && merged.result.merged === 6, 'Zählung neu/zusammengerechnet', JSON.stringify(merged.result));

  // ---------- Supermarktbereiche: Teilwort-Fallen (Prüfung 18.11.2026) ----------
  const areas = await page.evaluate(() => { const saved = state.customCategories.shopping; state.customCategories.shopping = { rum: 'Getränke' }; const r = ['Apfelsaft', 'Tomatenmark', 'Gemüsebrühe', 'Dose Tomaten', 'Reis', 'Vanilleeis', 'Salbei', 'Weißwein', 'Weißbrot', 'Holzkohle', 'Wassermelone', 'Rumpsteak', 'Rum', 'Eier'].map(w => window.ZuhauseFeatures.parseShoppingItem(w).category); state.customCategories.shopping = saved; return r; });
  const expected = ['Getränke', 'Trockenwaren', 'Trockenwaren', 'Trockenwaren', 'Trockenwaren', 'Tiefkühlprodukte', 'Obst und Gemüse', 'Getränke', 'Trockenwaren', 'Haushaltsartikel', 'Obst und Gemüse', 'Kühlprodukte', 'Getränke', 'Kühlprodukte'];
  check(areas.join() === expected.join(), 'Supermarktbereiche ohne Teilwort-Fehler (Saft, Tomatenmark, Reis/Eis, Salbei, Holzkohle, gemerktes „Rum“ ≠ Rumpsteak)', areas.map((a, i) => a === expected[i] ? '' : `#${i}:${a}`).filter(Boolean).join(' '));

  // Prüfung v49: unterschiedliche Zutaten nicht zusammenrechnen, Reis-Sorten nicht bei Tiefkühl
  const kinds = await page.evaluate(() => {
    state.shopping = [{ id: 'k1', title: 'Sahne', quantity: '200 ml', category: 'Kühlprodukte', done: false }, { id: 'k2', title: 'Tomaten', quantity: '500 g', category: 'Obst und Gemüse', done: false }, { id: 'k3', title: 'Zwiebeln', quantity: '2 ×', category: 'Obst und Gemüse', done: false }];
    window.ZuhauseRecipes.addToShopping([{ amount: 200, unit: 'ml', name: 'saure Sahne' }, { amount: 100, unit: 'g', name: 'getrocknete Tomaten' }, { amount: 2, unit: '', name: 'große Zwiebeln' }], 1, 'Test');
    const rows = state.shopping.map(i => `${i.quantity} ${i.title}`);
    return { rows, reis: ['Milchreis', 'Jasminreis', 'Wildreis', 'Vanilleeis'].map(w => window.ZuhauseFeatures.parseShoppingItem(w).category) };
  });
  check(kinds.rows.length === 5 && kinds.rows.includes('4 × Zwiebeln'), '„saure Sahne“/„getrocknete Tomaten“ eigene Zeilen, „große Zwiebeln“ zusammengerechnet', kinds.rows.join(' | '));
  check(kinds.reis.join() === 'Trockenwaren,Trockenwaren,Trockenwaren,Tiefkühlprodukte', 'Reis-Sorten bei Trockenwaren, Vanilleeis bei Tiefkühl', kinds.reis.join());

  // ---------- Ablauf in der Oberfläche ----------
  await page.evaluate(() => { state.shopping = []; go('household'); });
  await page.waitForTimeout(200);
  await page.click('[data-recipe-tab=recipes]');
  check(await page.isVisible('[data-recipe-new]') && !(await page.isVisible('#shoppingFull')), 'Reiter „Rezepte“ zeigt Katalog statt Liste');
  await page.click('[data-recipe-new]');
  await page.fill('#recipeEditDialog [name=title]', 'Spaghetti <b>Bolognese</b>');
  await page.fill('#recipeEditDialog [name=servings]', '4');
  await page.fill('#recipeEditDialog [name=ingredients]', '500 g Spaghetti\n400 g Hackfleisch\n1 Zwiebel\n2 EL Olivenöl\n1 Dose Tomaten\nSalz\nPfeffer');
  await page.fill('#recipeEditDialog [name=steps]', 'Zwiebel würfeln.\n\nHack anbraten.\n\nMit Tomaten köcheln.');
  await page.click('#recipeEditDialog [type=submit]'); await page.waitForTimeout(200);
  if (out) await page.screenshot({ path: path.join(out, 'rezept-ansicht.png') });
  check(await page.evaluate(() => document.querySelector('#recipeViewDialog h2')?.textContent) === 'Spaghetti <b>Bolognese</b>', 'Titel wird als Text gezeigt (maskiert)');
  await page.click('#recipeViewDialog [data-recipe-servings="-1"]'); await page.click('#recipeViewDialog [data-recipe-servings="-1"]');
  const scaled = await page.evaluate(() => [...document.querySelectorAll('#recipeViewDialog .recipe-ingredients li')].map(li => li.textContent.trim()));
  check(scaled[0] === '250 g Spaghetti' && scaled[2] === '½ Zwiebel', '4 → 2 Portionen umgerechnet', scaled.slice(0, 3).join(' | '));
  await page.click('#recipeViewDialog [data-recipe-shop]'); await page.waitForTimeout(150);
  if (out) await page.screenshot({ path: path.join(out, 'rezept-vorschau.png') });
  const picks = await page.evaluate(() => [...document.querySelectorAll('#recipeShopDialog [name=pick]')].map(i => `${i.closest('label').textContent.trim()}:${i.checked}`));
  check(picks.filter(x => x.endsWith(':false')).length === 3, 'Vorschau: Olivenöl, Salz, Pfeffer abgewählt', picks.join(' | '));
  await page.click('#recipeShopDialog [type=submit]'); await page.waitForTimeout(150);
  const shopping = await page.evaluate(() => state.shopping.map(i => `${i.quantity} ${i.title} [${i.category}]`));
  check(shopping.length === 4 && shopping.some(s => s === '200 g Hackfleisch [Kühlprodukte]') && shopping.some(s => s === '1 × Zwiebel [Obst und Gemüse]') && shopping.some(s => s === '1 Dose Tomaten [Obst und Gemüse]'), 'Übernommen mit Mengen und Bereichen, Stückzahlen aufgerundet (½ Zwiebel → 1)', shopping.join(' | '));
  await page.click('[data-recipe-tab=shopping]'); await page.waitForTimeout(150);
  check(await page.isVisible('#shoppingFull') && (await page.textContent('#shoppingFull')).includes('Hackfleisch'), 'Einkaufsliste zeigt die Zutaten');
  if (out) await page.screenshot({ path: path.join(out, 'einkaufsliste.png'), fullPage: true });
  await page.click('[data-recipe-tab=recipes]');
  await page.evaluate(() => window.ZuhauseRecipes._setRecipes([{ id: 'r-a', title: 'Apfelkuchen', favorite: false, data: { servings: 8, ingredients: [], steps: [] } }]));
  await page.click('[data-recipe-fav]:not(.on) >> nth=1');
  const order = await page.evaluate(() => [...document.querySelectorAll('.recipe-open strong')].map(s => s.textContent));
  check(order[0] === 'Spaghetti <b>Bolognese</b>', 'Favorit steht oben', order.join(' | '));
  if (out) await page.screenshot({ path: path.join(out, 'katalog.png') });
  await page.fill('#recipeSearch', 'hack'); await page.waitForTimeout(100);
  check(await page.locator('.recipe-open').count() === 1, 'Suche findet auch über Zutaten');
  await page.fill('#recipeSearch', '');
  const pending = await page.evaluate(() => Object.keys(JSON.parse(JSON.stringify(window.ZuhauseRecipes))).length >= 0);
  await page.click('[data-recipe-open="r-a"]'); await page.click('#recipeViewDialog [data-recipe-delete]'); await page.waitForTimeout(100);
  check(await page.locator('.recipe-open').count() === 1, 'Löschen');
  await page.click('.toast-undo'); await page.waitForTimeout(100);
  check(await page.locator('.recipe-open').count() === 2, 'Löschen rückgängig');
  // ---------- Schritt 2: Aus Link übernehmen (Server-Funktion nachgebildet), Kategorien, Foto ----------
  const tinyJpeg = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#c84'; x.fillRect(0, 0, 40, 30); return c.toDataURL('image/jpeg', 0.8); });
  await page.evaluate(photo => {
    window.__uploads = [];
    cloudReady = true; currentHousehold = { id: 'h1' };
    const invoke = async (name, { body }) => body.url.includes('kaputt')
      ? { data: null, error: { context: { json: async () => ({ error: 'Auf dieser Seite wurden keine Rezeptdaten gefunden. Das Rezept bitte selbst eintippen.' }) } } }
      : { data: { title: 'Kartoffelgratin', servings: 4, ingredients: ['800 g Kartoffeln', '200ml Sahne', '1 TL Salz', '1/2 TL Muskat'], steps: ['Ofen vorheizen.', 'Kartoffeln schneiden.'], categories: ['Hauptgericht'], source: body.url, photo }, error: null };
    Object.defineProperty(cloud, 'functions', { configurable: true, value: { invoke } });
    const storage = { upload: async (path, blob, opts) => { window.__uploads.push({ path, type: opts.contentType, size: blob.size }); return { error: null }; }, remove: async () => ({}), createSignedUrls: async paths => ({ data: paths.map(() => ({ signedUrl: photo })) }) };
    Object.defineProperty(cloud, 'storage', { configurable: true, value: { from: () => storage } });
    const from = cloud.from.bind(cloud);
    cloud.from = table => table === 'recipes' ? { upsert: async () => ({ error: null }), select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, gt() { return this; }, then: res => res({ data: [], error: null }) } : from(table);
  }, tinyJpeg);
  await page.click('[data-recipe-import]');
  await page.fill('#recipeImportDialog [name=url]', 'https://example.org/kaputt'); await page.click('#recipeImportDialog [type=submit]'); await page.waitForTimeout(150);
  check(/keine Rezeptdaten/.test(await page.textContent('#recipeImportDialog [data-recipe-message]')), 'Import: verständliche Meldung, wenn die Seite kein Rezept hat');
  await page.fill('#recipeImportDialog [name=url]', 'javascript:alert(1)'); await page.click('#recipeImportDialog [type=submit]'); await page.waitForTimeout(100);
  check(/http/.test(await page.textContent('#recipeImportDialog [data-recipe-message]')), 'Import: nur http/https-Links');
  await page.fill('#recipeImportDialog [name=url]', 'https://example.org/gratin'); await page.click('#recipeImportDialog [type=submit]'); await page.waitForTimeout(300);
  const prefilled = await page.evaluate(() => ({ title: document.querySelector('#recipeEditDialog [name=title]').value, servings: document.querySelector('#recipeEditDialog [name=servings]').value, ing: document.querySelector('#recipeEditDialog [name=ingredients]').value, src: document.querySelector('#recipeEditDialog [name=source]').value, photo: !document.querySelector('[data-recipe-edit-photo]').hidden }));
  check(prefilled.title === 'Kartoffelgratin' && prefilled.servings === '4' && prefilled.ing.includes('200ml Sahne') && prefilled.src === 'https://example.org/gratin' && prefilled.photo, 'Import füllt das Formular zur Kontrolle (inkl. Foto und Quelle)', JSON.stringify(prefilled));
  check(await page.evaluate(() => Object.values(JSON.parse(JSON.stringify(window.ZuhauseRecipes ? {} : {}))).length === 0) && (await page.locator('.recipe-open').count()) === 2, 'Vor „Speichern“ ist noch nichts gespeichert');
  await page.fill('#recipeEditDialog [data-recipe-cat-new]', 'Schnell'); await page.click('#recipeEditDialog [data-recipe-cat-add]');
  await page.fill('#recipeEditDialog [data-recipe-cat-new]', 'Vegetarisch'); await page.press('#recipeEditDialog [data-recipe-cat-new]', 'Enter');
  if (out) await page.screenshot({ path: path.join(out, 'import-kontrolle.png') });
  await page.click('#recipeEditDialog [type=submit]'); await page.waitForTimeout(400);
  const saved = await page.evaluate(() => { const title = document.querySelector('#recipeViewDialog h2')?.textContent; const items = [...document.querySelectorAll('#recipeViewDialog .recipe-ingredients li')].map(li => li.textContent.trim()); return { title, items, cats: [...document.querySelectorAll('#recipeViewDialog .recipe-cats span')].map(s => s.textContent), hero: !!document.querySelector('#recipeViewDialog .recipe-hero'), uploads: window.__uploads, catList: state.customCategories.recipes }; });
  check(saved.title === 'Kartoffelgratin' && saved.items.includes('200 ml Sahne'), 'Importiertes Rezept gespeichert („200ml“ als 200 ml erkannt)', saved.items.join(' | '));
  check(saved.uploads.length === 1 && /^h1\/shared\/recipes\/.+\.jpg$/.test(saved.uploads[0].path) && saved.uploads[0].type === 'image/jpeg' && saved.hero, 'Foto verkleinert in den geschützten Ordner des Haushalts', JSON.stringify(saved.uploads));
  check(saved.cats.join(',') === 'Schnell,Vegetarisch' && saved.catList.includes('Schnell'), 'Kategorien angelegt und zugeordnet', saved.cats.join(','));
  if (out) await page.screenshot({ path: path.join(out, 'import-gespeichert.png') });
  await page.evaluate(() => document.querySelector('#recipeViewDialog').close());
  await page.click('[data-recipe-filter="Schnell"]'); await page.waitForTimeout(100);
  check(await page.locator('.recipe-open').count() === 1, 'Filter nach Kategorie');
  if (out) await page.screenshot({ path: path.join(out, 'katalog-kategorien.png') });
  await page.click('[data-recipe-filter=""]');
  await page.click('[data-recipe-categories]');
  page.once('dialog', dlg => dlg.accept('Blitzschnell'));
  await page.click('[data-cat-rename="Schnell"]'); await page.waitForTimeout(150);
  const renamed = await page.evaluate(() => ({ list: state.customCategories.recipes, recipe: Object.values(window).length && [...document.querySelectorAll('.recipe-open small')].map(s => s.textContent).join(' | ') }));
  check(renamed.list.includes('Blitzschnell') && !renamed.list.includes('Schnell') && renamed.recipe.includes('Blitzschnell'), 'Kategorie umbenennen ändert auch die Rezepte', JSON.stringify(renamed));
  await page.evaluate(() => document.querySelector('#recipeCategoriesDialog').close());

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!overflow && pending, 'Kein waagerechtes Überlaufen');
  check(!errors.length, 'Keine Skriptfehler', errors.join(' | '));
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlle Rezept-Prüfungen bestanden.');
  process.exit(failures ? 1 : 0);
});
