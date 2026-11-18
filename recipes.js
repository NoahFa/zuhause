// Rezeptkatalog (18.11.2026, mit Noah abgestimmt): Reiter „Rezepte“ neben der Einkaufsliste auf der Haushalt-Seite.
// Rezepte liegen in der eigenen Tabelle public.recipes (je Haushalt, Row Level Security), nicht im gemeinsamen App-Datensatz –
// der wird bei jeder Änderung komplett hochgeladen. Jedes Handy hält eine Kopie (localStorage) und eine Warteschlange für
// Änderungen ohne Netz; abgeglichen wird im Takt der App (refreshCloudState). Bei gleichzeitiger Änderung gilt die letzte.
// Basics-Liste: state.settings.recipeBasics, Kategorien (Schritt 2): state.customCategories.recipes.
(() => {
  'use strict';
  const h = escapeHtml;
  const DEFAULT_BASICS = ['Salz', 'Pfeffer', 'Öl', 'Olivenöl', 'Zucker', 'Mehl', 'Wasser', 'Essig', 'Brühe'];
  const uid = () => crypto.randomUUID();
  let cache = { recipes: {}, cursor: null, pending: {} }, cacheKey = '', query = '', tab = 'shopping', syncing = false, categoryFilter = '', uploadProblem = '';
  const photoUrls = new Map(); // Fotopfad → kurzlebiger, signierter Link
  const categories = () => Array.isArray(state.customCategories?.recipes) ? state.customCategories.recipes : [];

  // ---------- Zutaten verstehen ----------
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  const UNITS = [
    ['kg', /^(kg|kilo(gramm)?)$/i], ['g', /^(g|gr|gramm)$/i], ['mg', /^mg$/i], ['l', /^(l|liter)$/i], ['ml', /^(ml|milliliter)$/i], ['cl', /^cl$/i], ['dl', /^dl$/i],
    ['EL', /^(el|essl(öffel)?\.?|esslöffel|tbsp|tablespoons?)$/i], ['TL', /^(tl|teel(öffel)?\.?|teelöffel|tsp|teaspoons?)$/i], ['Prise', /^prisen?$/i], ['Msp.', /^(msp\.?|messerspitzen?)$/i],
    ['Pck.', /^(pck\.?|pkg\.?|päckchen|packung(en)?)$/i], ['Dose', /^dosen?$/i], ['Bund', /^bunde?$/i], ['Zehe', /^zehen?$/i], ['Stück', /^(stück|stk\.?|st\.?)$/i],
    ['Scheibe', /^scheiben?$/i], ['Becher', /^becher$/i], ['Tasse', /^tassen?$/i], ['Glas', /^gl(as|äser)$/i], ['Handvoll', /^handvoll$/i], ['Blatt', /^bl(att|ätter)$/i],
    ['Zweig', /^zweige?$/i], ['Stange', /^stangen?$/i], ['Box', /^box(en)?$/i], ['cup', /^cups?$/i], ['oz', /^(oz|ounces?)$/i], ['lb', /^(lbs?|pounds?)$/i], ['pint', /^pints?$/i], ['Kopf', /^k(opf|öpfe)$/i], ['Knolle', /^knollen?$/i], ['Würfel', /^würfel$/i], ['Tropfen', /^tropfen$/i], ['Schuss', /^schuss$/i],
  ];
  // Menge am Zeilenanfang: „1 ½“, „1½“, „½“, „1/2“, „1 1/2“, „1,5“, „1.000“ (Tausenderpunkt), „2-3“ / „2 bis 3“ (erste Zahl)
  const number = token => /^\d{1,3}(\.\d{3})+$/.test(token) ? Number(token.replace(/\./g, '')) : Number(token.replace(',', '.'));
  function parseAmount(text) {
    const t = String(text || '').trim().replace(/\s+/g, ' ');
    let rest = t, value = 0, m;
    if ((m = rest.match(/^(\d+(?:[.,]\d+)*)/))) {
      value = number(m[1]); rest = rest.slice(m[0].length);
      if ((m = rest.match(/^\s*\/\s*(\d+)/))) { value = value / Number(m[1]); rest = rest.slice(m[0].length); }          // 1/2
      else if ((m = rest.match(/^\s+(\d+)\s*\/\s*(\d+)/))) { value += Number(m[1]) / Number(m[2]); rest = rest.slice(m[0].length); } // 1 1/2
      else if ((m = rest.match(/^\s*([½¼¾⅓⅔⅛])/))) { value += FRACTIONS[m[1]]; rest = rest.slice(m[0].length); }        // 1½ / 1 ½
    } else if ((m = rest.match(/^([½¼¾⅓⅔⅛])/))) { value = FRACTIONS[m[1]]; rest = rest.slice(m[0].length); }
    else return null;
    if ((m = rest.match(/^\s*(?:[-–]|bis)\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/i))) rest = rest.slice(m[0].length); // Spanne: erste Zahl gilt
    if (rest && !/^\s/.test(rest)) return null;
    return value > 0 && Number.isFinite(value) ? { value, rest: rest.trim() } : null;
  }
  function parseIngredient(line) {
    // „100g Mehl“ → „100 g Mehl“ (Seiten schreiben Menge und Einheit oft zusammen)
    const raw = String(line || '').replace(/^[-•*·]\s*/, '').trim().replace(/^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(?=[a-zA-ZäöüÄÖÜ])/, '$1 '); if (!raw) return null;
    const amount = parseAmount(raw); let rest = amount ? amount.rest : raw, unit = '', note = '';
    // „1 (400 g) Dose Tomaten“: Zusatz in Klammern vor der Einheit ans Ende stellen
    const paren = rest.match(/^\(([^)]{1,40})\)\s*/); if (paren) { note = ` (${paren[1]})`; rest = rest.slice(paren[0].length); }
    const first = rest.split(/\s+/)[0] || '', known = UNITS.find(([, re]) => re.test(first.replace(/[.,]$/, '')) || re.test(first));
    if (known && rest.split(/\s+/).length > 1) { unit = known[0]; rest = rest.slice(first.length).trim(); }
    return { amount: amount ? Math.round(amount.value * 1000) / 1000 : null, unit, name: `${rest || raw}${note}` };
  }
  const fractionText = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
  function formatAmount(value, unit) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    let v = value, u = unit;
    if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; } else if (u === 'ml' && v >= 1000) { v /= 1000; u = 'l'; }
    if (['g', 'ml'].includes(u)) v = v >= 100 ? Math.round(v / 5) * 5 : v >= 1 ? Math.round(v) : Math.max(0.1, Math.round(v * 10) / 10); // unter 1 g mit Komma statt „0 g“
    let text;
    const whole = Math.floor(v + 1e-9), part = Math.round((v - whole) * 4) / 4;
    if (!['g', 'ml', 'kg', 'l'].includes(u) && Math.abs(v - (whole + part)) < 0.04 && (part in fractionText || part === 0)) text = `${whole || ''}${part ? fractionText[part] : ''}` || '0';
    else text = (Math.round(v * 100) / 100).toLocaleString('de-DE');
    return `${text}${u ? ` ${v > 1 ? PLURAL[u] || u : u}` : ''}`;
  }
  const PLURAL = { Dose: 'Dosen', Zehe: 'Zehen', Prise: 'Prisen', Scheibe: 'Scheiben', Tasse: 'Tassen', Stange: 'Stangen', Knolle: 'Knollen', Zweig: 'Zweige', Kopf: 'Köpfe', Glas: 'Gläser', Blatt: 'Blätter', Box: 'Boxen', cup: 'cups' };
  const SPOON = ['EL', 'TL', 'Prise', 'Msp.', 'Tropfen', 'Schuss']; // kleine Mengen – meist im Haus, in der Vorschau erst einmal abgewählt
  const ingredientText = (ing, factor = 1) => `${ing.amount ? `${formatAmount(ing.amount * factor, ing.unit)} ` : ing.unit ? `${ing.unit} ` : ''}${ing.name}`;

  // Gleiche Zutat erkennen: Kleinschreibung, Zusätze nach Komma/Klammer weg, einfache Mehrzahl-Endungen kürzen
  const stem = word => { const w = String(word || '').toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].trim().replace(/\s+/g, ' '); const s = w.replace(/(en|er|n|e|s)$/, ''); return s.length >= 2 ? s : w; };
  // Einheiten, die sich ineinander umrechnen lassen (Grundeinheit, Faktor)
  const BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], l: ['ml', 1000], cl: ['ml', 10], dl: ['ml', 100], '': ['stk', 1], 'Stück': ['stk', 1], '×': ['stk', 1] };
  const baseOf = unit => BASE[unit] || [unit, 1];
  // gleiche Zutat? ganzer Name gleich, oder ein einzelnes Wort passt zum letzten Wort des anderen („2 große Zwiebeln“ ↔ „Zwiebeln“)
  const lastWord = name => stem(String(name || '').replace(/\(.*?\)/g, '').split(',')[0].trim().split(/\s+/).pop());
  const sameIngredient = (a, b) => { if (stem(a) === stem(b)) return true; const wa = String(a).trim().split(/\s+/).length, wb = String(b).trim().split(/\s+/).length; return (wa === 1 || wb === 1) && lastWord(a) === lastWord(b) && lastWord(a).length >= 3; };

  // ---------- Daten und Abgleich ----------
  function key() { return typeof scopedStorageKey === 'function' ? scopedStorageKey('recipes') : ''; }
  function loadCache() {
    const k = key(); if (k === cacheKey) return; cacheKey = k; cache = { recipes: {}, cursor: null, pending: {} };
    try { const saved = k && JSON.parse(localStorage.getItem(k) || 'null'); if (saved?.recipes) cache = { recipes: saved.recipes, cursor: saved.cursor || null, pending: saved.pending || {} }; } catch {}
  }
  function storeCache() { try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch {} }
  const list = () => Object.values(cache.recipes).filter(r => !r.deleted_at);
  const recipe = id => { const r = cache.recipes[id]; return r && !r.deleted_at ? r : null; };
  function change(row) {
    // lokale Änderung: sofort sichtbar, merken für den Upload (auch ohne Netz)
    row.data = { ...(row.data || {}), changedAt: new Date().toISOString() };
    cache.recipes[row.id] = row; cache.pending[row.id] = row; storeCache(); render(); sync();
  }
  async function sync() {
    loadCache();
    if (syncing || typeof cloudReady === 'undefined' || !cloudReady || !currentHousehold || !navigator.onLine) return;
    syncing = true;
    try {
      // 1. eigene Änderungen hochladen
      const pending = Object.values(cache.pending);
      if (pending.length) {
        const rows = pending.map(r => ({ id: r.id, household_id: currentHousehold.id, title: String(r.title || 'Rezept').slice(0, 200), favorite: !!r.favorite, data: r.data || {}, deleted_at: r.deleted_at || null }));
        const done = r => { if (cache.pending[r.id] === r) delete cache.pending[r.id]; };
        const { error } = await cloud.from('recipes').upsert(rows, { onConflict: 'id' });
        if (!error) { pending.forEach(done); uploadProblem = ''; }
        else if (navigator.onLine) {
          // einzeln versuchen: ein abgelehntes Rezept (z. B. zu groß) soll die anderen nicht aufhalten
          let failed = 0;
          for (let i = 0; i < rows.length; i++) { const { error: one } = await cloud.from('recipes').upsert([rows[i]], { onConflict: 'id' }); if (one) failed++; else done(pending[i]); }
          uploadProblem = failed ? `${failed} ${failed === 1 ? 'Rezept konnte' : 'Rezepte konnten'} nicht gespeichert werden – bitte kürzen oder später erneut versuchen.` : '';
          render();
        }
        if (key() === cacheKey) storeCache();
      }
      // 2. Neues vom anderen Handy holen (nur seit dem letzten Mal, mit 5 s Überlappung)
      let request = cloud.from('recipes').select('id,household_id,title,favorite,data,updated_at,deleted_at').eq('household_id', currentHousehold.id).order('updated_at', { ascending: true }).limit(1000);
      if (cache.cursor) request = request.gt('updated_at', new Date(new Date(cache.cursor).getTime() - 5000).toISOString());
      const { data, error } = await request;
      if (!error && data) {
        let changed = false;
        for (const row of data) {
          if (cache.pending[row.id]) continue; // eigene, noch nicht hochgeladene Änderung hat Vorrang
          const old = cache.recipes[row.id];
          if (!old || old.updated_at !== row.updated_at || old.deleted_at !== row.deleted_at) { changed = true; if (row.deleted_at) delete cache.recipes[row.id]; else cache.recipes[row.id] = row; }
          if (!cache.cursor || row.updated_at > cache.cursor) cache.cursor = row.updated_at;
        }
        if (key() === cacheKey) { storeCache(); if (changed) render(); } // inzwischen abgemeldet/gewechselt? dann nichts mehr speichern
      }
    } catch { /* nächster Versuch beim nächsten Abgleich */ } finally { syncing = false; }
  }
  window.addEventListener('online', () => setTimeout(sync, 1000));

  // ---------- Einstellungen (im App-Datensatz) ----------
  function basics() { const b = state.settings?.recipeBasics; return Array.isArray(b) ? b : DEFAULT_BASICS; }
  const isBasic = name => { const n = stem(name); return basics().some(b => { const s = stem(b); return s && (n === s || n.endsWith(s)); }); };

  // ---------- Oberfläche: Reiter ----------
  function installTabs() {
    const card = document.querySelector('.full-shopping'); if (!card || card.querySelector('.recipe-tabs')) return;
    try { tab = localStorage.getItem('zuhause-shopping-tab') === 'recipes' ? 'recipes' : 'shopping'; } catch {}
    card.insertAdjacentHTML('afterbegin', '<nav class="ws-tabs recipe-tabs" aria-label="Einkaufen oder Rezepte"><button type="button" data-recipe-tab="shopping">🛒 Einkaufsliste</button><button type="button" data-recipe-tab="recipes">📖 Rezepte</button></nav>');
    card.insertAdjacentHTML('beforeend', '<div id="recipePanel" class="recipe-panel"></div>');
    // Sprungknöpfe oben auf der Haushaltsseite (am Handy liegt die Einkaufskarte sonst unter dem Rand)
    document.querySelector('#household .page-title')?.insertAdjacentHTML('afterend', '<div class="household-jumps"><button type="button" class="secondary" data-jump="shopping">🛒 Einkaufsliste</button><button type="button" class="secondary" data-jump="recipes">📖 Rezepte</button></div>');
  }
  // „Liste öffnen“, „Rezepte“ unter Mehr und die Sprungknöpfe: Reiter wählen und hinscrollen
  document.addEventListener('click', event => {
    const b = event.target.closest('[data-jump]'); if (!b) return;
    const target = b.dataset.jump === 'recipes' ? 'recipes' : 'shopping';
    setTimeout(() => {
      tab = target; try { localStorage.setItem('zuhause-shopping-tab', tab); } catch {}
      render(); if (tab === 'recipes') sync();
      document.querySelector('.full-shopping')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
  function render() {
    installTabs(); loadCache();
    const card = document.querySelector('.full-shopping'), panel = document.querySelector('#recipePanel'); if (!card || !panel) return;
    card.classList.toggle('show-recipes', tab === 'recipes');
    card.querySelectorAll('[data-recipe-tab]').forEach(b => { b.classList.toggle('active', b.dataset.recipeTab === tab); b.setAttribute('aria-pressed', String(b.dataset.recipeTab === tab)); });
    if (tab !== 'recipes') return;
    if (panel.contains(document.activeElement) && document.activeElement.matches('input')) { renderList(panel); return; }
    panel.innerHTML = `<div class="recipe-toolbar"><label class="doc-search"><span aria-hidden="true">⌕</span><input id="recipeSearch" type="search" placeholder="Suchen" aria-label="Rezepte durchsuchen" value="${h(query)}"></label><button class="primary" type="button" data-recipe-new>＋ Rezept</button></div><button type="button" class="secondary recipe-import-button" data-recipe-import>🔗 Aus Link übernehmen</button>${uploadProblem ? `<p class="scan-queue-note problem">⚠️ ${h(uploadProblem)}</p>` : ''}<div class="doc-chips" id="recipeChips" role="group" aria-label="Kategorie"></div><div id="recipeList"></div><div class="recipe-settings"><button type="button" class="ws-text-button" data-recipe-basics>Basics bearbeiten (Salz, Pfeffer …)</button><button type="button" class="ws-text-button" data-recipe-categories>Kategorien bearbeiten</button></div>`;
    panel.querySelector('#recipeSearch').addEventListener('input', event => { query = event.target.value.trim(); renderList(panel); });
    renderList(panel);
  }
  function renderList(panel) {
    const box = panel.querySelector('#recipeList'); if (!box) return;
    const q = query.toLowerCase(), cats = categories().filter(c => list().some(r => (r.data?.categories || []).includes(c)));
    if (categoryFilter && !cats.includes(categoryFilter)) categoryFilter = '';
    const chips = panel.querySelector('#recipeChips');
    if (chips) { chips.hidden = !cats.length; chips.innerHTML = cats.length ? ['', ...cats].map(c => `<button type="button" class="doc-chip ${categoryFilter === c ? 'active' : ''}" data-recipe-filter="${h(c)}" aria-pressed="${categoryFilter === c}">${c ? h(c) : 'Alle'}</button>`).join('') : ''; }
    const shown = list().filter(r => !categoryFilter || (r.data?.categories || []).includes(categoryFilter)).filter(r => !q || `${r.title} ${(r.data?.ingredients || []).map(i => i.name).join(' ')} ${(r.data?.categories || []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || String(a.title).localeCompare(String(b.title), 'de'));
    box.innerHTML = shown.map(r => `<div class="recipe-row ${r.data?.photoPath ? 'with-photo' : ''}">${r.data?.photoPath ? `<img class="recipe-thumb" data-recipe-photo="${h(r.data.photoPath)}" alt="" ${photoUrls.get(r.data.photoPath) ? `src="${h(photoUrls.get(r.data.photoPath))}"` : ''}>` : ''}<button type="button" class="recipe-heart ${r.favorite ? 'on' : ''}" data-recipe-fav="${h(r.id)}" aria-pressed="${!!r.favorite}" aria-label="${r.favorite ? 'Aus den Favoriten nehmen' : 'Als Favorit markieren'}">${r.favorite ? '♥' : '♡'}</button><button type="button" class="recipe-open" data-recipe-open="${h(r.id)}"><strong>${h(r.title)}</strong><small>${h(String(r.data?.servings || 2))} Portionen · ${(r.data?.ingredients || []).length} Zutaten${(r.data?.categories || []).length ? ` · ${h(r.data.categories.join(', '))}` : ''}</small></button><em aria-hidden="true">›</em></div>`).join('')
      || (list().length ? `<p class="ws-muted">Nichts gefunden${query ? ` für „${h(query)}“` : ''}${categoryFilter ? ` in „${h(categoryFilter)}“` : ''}.</p>` : '<div class="ws-empty"><strong>Noch keine Rezepte.</strong><p>Tippe auf „＋ Rezept“ oder übernimm eins per Link – danach kommt es mit einem Tipp auf die Einkaufsliste.</p></div>');
    loadPhotos();
  }

  // ---------- Fotos (geschützter Speicher, wie Dokumente: <haushalt>/shared/recipes/…) ----------
  async function loadPhotos() {
    if (typeof cloudReady === 'undefined' || !cloudReady || !cloud) return;
    const missing = [...new Set(list().map(r => r.data?.photoPath).filter(p => p && !photoUrls.has(p)))];
    if (missing.length) {
      const { data } = await cloud.storage.from('receipts').createSignedUrls(missing, 3600).catch(() => ({ data: null }));
      missing.forEach((p, i) => { if (data?.[i]?.signedUrl) photoUrls.set(p, data[i].signedUrl); });
      setTimeout(() => missing.forEach(p => photoUrls.delete(p)), 50 * 60000);
    }
    document.querySelectorAll('[data-recipe-photo]').forEach(img => { const url = photoUrls.get(img.dataset.recipePhoto); if (url && img.getAttribute('src') !== url) img.src = url; });
  }
  async function shrinkPhoto(blob) {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(blob));
    const f = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)), c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * f); c.height = Math.round(bitmap.height * f); c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height); bitmap.close?.();
    return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.8));
  }
  async function uploadPhoto(recipeId, blob) {
    const path = `${currentHousehold.id}/shared/recipes/${recipeId}-${uid().slice(0, 8)}.jpg`;
    const { error } = await cloud.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
    if (error) throw error; return path;
  }
  const removePhoto = path => { if (path && cloud && typeof cloudReady !== 'undefined' && cloudReady) cloud.storage.from('receipts').remove([path]).catch(() => {}); };

  // ---------- Dialog-Hilfe ----------
  function dialog(id, html) {
    let d = document.querySelector(`#${id}`);
    if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'calendar-event-dialog ws-wide-dialog recipe-dialog'; document.body.append(d); }
    d.innerHTML = html; d.querySelectorAll('[data-recipe-close]').forEach(b => { b.onclick = () => d.close(); }); if (!d.open) d.showModal(); return d;
  }

  // ---------- Ansehen mit Portionen ----------
  const servingsFor = {};
  function show(id) {
    const r = recipe(id); if (!r) return;
    const base = Number(r.data?.servings) || 2, servings = servingsFor[id] || base, factor = servings / base;
    const source = safeExternalUrl(r.data?.source || '');
    const d = dialog('recipeViewDialog', `<form method="dialog"><div class="dialog-head"><div><span class="kicker">Rezept</span><h2>${h(r.title)}</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields">
        ${r.data?.photoPath ? `<img class="recipe-hero" data-recipe-photo="${h(r.data.photoPath)}" alt="" ${photoUrls.get(r.data.photoPath) ? `src="${h(photoUrls.get(r.data.photoPath))}"` : ''}>` : ''}
        ${(r.data?.categories || []).length ? `<p class="recipe-cats">${r.data.categories.map(c => `<span>${h(c)}</span>`).join('')}</p>` : ''}
        <div class="recipe-servings"><span>Portionen</span><button type="button" class="secondary" data-recipe-servings="-1" aria-label="Weniger Portionen" ${servings <= 1 ? 'disabled' : ''}>−</button><strong aria-live="polite">${servings}</strong><button type="button" class="secondary" data-recipe-servings="1" aria-label="Mehr Portionen">＋</button>${servings !== base ? `<small>Rezept ist für ${base}</small>` : ''}</div>
        <button type="button" class="primary ws-large" data-recipe-shop="${h(r.id)}">🛒 Auf die Einkaufsliste</button>
        <section><h3>Zutaten</h3><ul class="recipe-ingredients">${(r.data?.ingredients || []).map(ing => `<li>${ing.amount || ing.unit ? `<b>${h(ing.amount ? formatAmount(ing.amount * factor, ing.unit) : ing.unit)}</b> ` : ''}${h(ing.name)}</li>`).join('') || '<li class="ws-muted">Keine Zutaten eingetragen.</li>'}</ul></section>
        ${(r.data?.steps || []).length ? `<section><h3>Zubereitung</h3><ol class="recipe-steps">${r.data.steps.map(step => `<li>${h(step)}</li>`).join('')}</ol></section>` : ''}
        ${source ? `<p class="ws-help">Quelle: <a href="${h(source)}" target="_blank" rel="noopener noreferrer">${h(new URL(source).hostname)}</a></p>` : ''}
      </div>
      <div class="calendar-dialog-actions"><button type="button" class="danger" data-recipe-delete="${h(r.id)}">Löschen</button><span></span><button type="button" class="secondary" data-recipe-edit="${h(r.id)}">Bearbeiten</button><button type="button" class="secondary" data-recipe-close>Schließen</button></div></form>`);
    d.dataset.recipeId = id; loadPhotos();
  }

  // ---------- Eintippen / Bearbeiten ----------
  function edit(id, preset = null) {
    const r = id ? recipe(id) : null, data = preset || r?.data || {};
    let photo = { blob: preset?.photoBlob || null, remove: false }, chosenCats = new Set((data.categories || []).filter(c => categories().includes(c)));
    // Kategorien der Rezeptseite, die es bei euch noch nicht gibt: als Vorschlag zum Antippen (nicht still verwerfen)
    const suggested = preset ? (data.categories || []).filter(c => c && !categories().some(k => k.toLowerCase() === String(c).toLowerCase())).slice(0, 6) : [];
    const d = dialog('recipeEditDialog', `<form><div class="dialog-head"><div><span class="kicker">Rezept</span><h2>${r ? 'Rezept bearbeiten' : 'Neues Rezept'}</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields">
        ${preset ? '<p class="recipe-import-note">Bitte kurz prüfen – gespeichert wird erst mit „Speichern“.</p>' : ''}
        <label class="ws-field"><span>Titel</span><input name="title" required maxlength="200" value="${h(preset?.title || r?.title || '')}" placeholder="z. B. Spaghetti Bolognese"></label>
        <label class="ws-field recipe-servings-field"><span>Für wie viele Portionen?</span><input name="servings" type="number" inputmode="numeric" min="1" max="99" required value="${h(String(data.servings || 2))}"></label>
        <label class="ws-field"><span>Zutaten – eine pro Zeile</span><textarea name="ingredients" rows="8" placeholder="500 g Spaghetti&#10;1 Zwiebel&#10;2 EL Olivenöl&#10;Salz">${h((data.ingredients || []).map(ing => typeof ing === 'string' ? ing : ingredientText(ing)).join('\n'))}</textarea><small class="ws-help">Menge und Einheit vorne, z. B. „200 g Mehl“, „1,5 l Milch“, „½ TL Salz“.</small></label>
        <label class="ws-field"><span>Zubereitung – ein Schritt pro Absatz</span><textarea name="steps" rows="8" placeholder="Zwiebel würfeln und in Öl anschwitzen.&#10;&#10;Hackfleisch dazugeben …">${h((data.steps || []).join('\n\n'))}</textarea></label>
        <div class="ws-field"><span>Foto (optional)</span><div class="recipe-photo-edit"><img data-recipe-edit-photo alt="" hidden><div><button type="button" class="secondary" data-recipe-photo-pick>📷 Foto wählen</button><button type="button" class="ws-text-button" data-recipe-photo-remove hidden>Foto entfernen</button></div></div></div>
        <div class="ws-field"><span>Kategorien</span><div class="doc-chips recipe-cat-pick" data-recipe-cat-pick></div>${suggested.length ? `<div class="recipe-cat-suggest"><small>Von der Rezeptseite:</small>${suggested.map(c => `<button type="button" class="doc-chip" data-cat-suggest="${h(c)}">＋ ${h(c)}</button>`).join('')}</div>` : ''}<div class="recipe-cat-new"><input data-recipe-cat-new maxlength="40" placeholder="Neue Kategorie, z. B. Schnell" aria-label="Neue Kategorie"><button type="button" class="secondary" data-recipe-cat-add>＋</button></div></div>
        <label class="ws-field"><span>Quelle (Link, optional)</span><input name="source" type="url" inputmode="url" maxlength="500" value="${h(data.source || '')}" placeholder="https://…"></label>
        <p class="auth-message" data-recipe-message></p>
      </div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`);
    // Foto-Vorschau
    const img = d.querySelector('[data-recipe-edit-photo]'), removeButton = d.querySelector('[data-recipe-photo-remove]');
    const showPhoto = () => {
      const url = photo.blob ? URL.createObjectURL(photo.blob) : !photo.remove && data.photoPath ? photoUrls.get(data.photoPath) : '';
      img.hidden = !url; if (url) img.src = url; removeButton.hidden = !(photo.blob || (!photo.remove && data.photoPath));
    };
    showPhoto(); if (!photo.blob && data.photoPath && !photoUrls.has(data.photoPath)) loadPhotos().then(showPhoto);
    d.querySelector('[data-recipe-photo-pick]').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = () => { if (input.files?.[0]) { photo = { blob: input.files[0], remove: false }; showPhoto(); } }; input.click(); };
    removeButton.onclick = () => { photo = { blob: null, remove: true }; showPhoto(); };
    // Kategorien antippen / neu anlegen
    const pick = d.querySelector('[data-recipe-cat-pick]');
    const drawCats = () => { pick.innerHTML = categories().map(c => `<button type="button" class="doc-chip ${chosenCats.has(c) ? 'active' : ''}" data-cat="${h(c)}" aria-pressed="${chosenCats.has(c)}">${h(c)}</button>`).join('') || '<small class="ws-help">Noch keine Kategorien – unten eine anlegen.</small>'; };
    drawCats();
    d.querySelectorAll('[data-cat-suggest]').forEach(b => { b.onclick = () => { const name = b.dataset.catSuggest.slice(0, 40); if (!categories().some(c => c.toLowerCase() === name.toLowerCase())) { state.customCategories = { ...(state.customCategories || {}), recipes: [...categories(), name] }; persist(); } chosenCats.add(categories().find(c => c.toLowerCase() === name.toLowerCase()) || name); b.remove(); drawCats(); }; });
    pick.onclick = event => { const b = event.target.closest('[data-cat]'); if (!b) return; const c = b.dataset.cat; chosenCats.has(c) ? chosenCats.delete(c) : chosenCats.add(c); drawCats(); };
    const addCat = () => { const input = d.querySelector('[data-recipe-cat-new]'), name = input.value.trim().slice(0, 40); if (!name) return; const existing = categories().find(c => c.toLowerCase() === name.toLowerCase()); if (!existing) { state.customCategories = { ...(state.customCategories || {}), recipes: [...categories(), name] }; persist(); } chosenCats.add(existing || name); input.value = ''; drawCats(); };
    d.querySelector('[data-recipe-cat-add]').onclick = addCat;
    d.querySelector('[data-recipe-cat-new]').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addCat(); } };
    d.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const f = new FormData(event.currentTarget), message = d.querySelector('[data-recipe-message]');
      const title = String(f.get('title')).trim(), servings = Math.min(99, Math.max(1, Math.round(Number(f.get('servings')) || 2)));
      if (!title) { message.textContent = 'Bitte einen Titel eingeben.'; return; }
      const sourceText = String(f.get('source')).trim(), source = sourceText ? safeExternalUrl(sourceText) : '';
      if (sourceText && !source) { message.textContent = 'Der Link muss mit http:// oder https:// beginnen.'; return; }
      const ingredients = String(f.get('ingredients')).split(/\r?\n/).map(parseIngredient).filter(Boolean).slice(0, 200);
      const steps = String(f.get('steps')).split(/\r?\n\s*\r?\n|\r?\n(?=\s*\d+[.)]\s)/).map(s => s.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 100);
      // beim Speichern frisch holen (der Abgleich kann den Stand inzwischen ersetzt haben)
      const current = id ? recipe(id) : null, newId = current?.id || uid();
      let photoPath = current?.data?.photoPath || '', photoNote = '';
      if (photo.blob || photo.remove) {
        if (photo.blob) {
          if (typeof cloudReady === 'undefined' || !cloudReady || !navigator.onLine) photoNote = ' – das Foto braucht Internet, bitte später noch einmal hinzufügen';
          else {
            const button = d.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'Foto wird gespeichert …';
            try { const old = photoPath; photoPath = await uploadPhoto(newId, await shrinkPhoto(photo.blob)); removePhoto(old); }
            catch { button.disabled = false; button.textContent = 'Speichern'; message.textContent = 'Das Foto konnte nicht gespeichert werden. Ohne Foto speichern? Dann „Foto entfernen“ tippen.'; return; }
          }
        } else { removePhoto(photoPath); photoPath = ''; }
      }
      const cats = categories().filter(c => chosenCats.has(c));
      change({ ...(current || {}), id: newId, title, favorite: !!current?.favorite, deleted_at: null, data: { ...(current?.data || {}), servings, ingredients, steps, source, categories: cats, photoPath } });
      d.close(); toast(`Rezept gespeichert${photoNote}`); show(newId);
    };
  }
  function remove(id) {
    const r = recipe(id); if (!r) return;
    const copy = JSON.parse(JSON.stringify(r));
    change({ ...r, deleted_at: new Date().toISOString() }); document.querySelector('#recipeViewDialog')?.close();
    let undone = false;
    toastUndo(`„${r.title}“ gelöscht`, () => { undone = true; change({ ...copy, deleted_at: null }); });
    // Foto erst nach Ablauf von „Rückgängig“ aus dem Speicher entfernen
    if (copy.data?.photoPath) setTimeout(() => { if (!undone && !recipe(id)) removePhoto(copy.data.photoPath); }, 8000);
  }

  // ---------- Aus Link übernehmen (Server-Funktion import-recipe) ----------
  function importDialog() {
    const d = dialog('recipeImportDialog', `<form><div class="dialog-head"><div><span class="kicker">Rezepte</span><h2>Aus Link übernehmen</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><p class="ws-help">Link einer Rezeptseite einfügen (z. B. Chefkoch). Die App liest Titel, Portionen, Zutaten, Zubereitung und Foto aus – du prüfst alles, bevor gespeichert wird.</p>
        <label class="ws-field"><span>Link</span><input name="url" type="url" inputmode="url" required maxlength="2000" placeholder="https://www.chefkoch.de/rezepte/…" autocomplete="off"></label>
        <p class="auth-message" data-recipe-message aria-live="polite"></p></div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit">Übernehmen</button></div></form>`);
    // eingefügten Link aus der Zwischenablage gleich vorschlagen ist am iPhone nicht erlaubt – also nur Fokus
    setTimeout(() => d.querySelector('[name=url]')?.focus(), 50);
    d.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const message = d.querySelector('[data-recipe-message]'), button = d.querySelector('[type=submit]');
      const url = safeExternalUrl(String(new FormData(event.currentTarget).get('url')).trim());
      if (!url) { message.textContent = 'Bitte einen Link mit http:// oder https:// einfügen.'; return; }
      if (typeof cloudReady === 'undefined' || !cloudReady || !navigator.onLine) { message.textContent = 'Dafür braucht es Internet.'; return; }
      button.disabled = true; button.textContent = 'Wird gelesen …'; message.textContent = '';
      try {
        const { data, error } = await cloud.functions.invoke('import-recipe', { body: { url } });
        if (error) { let text = ''; try { text = (await error.context?.json())?.error || ''; } catch {} throw new Error(text || 'Die Seite konnte gerade nicht gelesen werden.'); }
        let photoBlob = null;
        // Foto kommt als Text (base64) – selbst umwandeln, denn die Sicherheitsregel der App erlaubt fetch() auf data:-Adressen nicht
        const photoMatch = typeof data?.photo === 'string' && data.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (photoMatch) { try { const bin = atob(photoMatch[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); photoBlob = new Blob([bytes], { type: photoMatch[1] }); } catch {} }
        d.close();
        edit(null, { title: String(data?.title || ''), servings: Number(data?.servings) || 2, ingredients: (data?.ingredients || []).map(String), steps: (data?.steps || []).map(String), source: safeExternalUrl(data?.source || url) || url, categories: (data?.categories || []).map(String), photoBlob });
      } catch (err) { message.textContent = err?.message || 'Das hat nicht geklappt.'; button.disabled = false; button.textContent = 'Übernehmen'; }
    };
  }

  // ---------- Kategorien bearbeiten ----------
  function editCategories() {
    const d = dialog('recipeCategoriesDialog', `<form><div class="dialog-head"><div><span class="kicker">Rezepte</span><h2>Kategorien</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><div class="recipe-cat-list">${categories().map(c => `<div class="recipe-cat-row"><span>${h(c)}</span><small>${list().filter(r => (r.data?.categories || []).includes(c)).length} Rezepte</small><button type="button" class="ws-van-edit" data-cat-rename="${h(c)}" aria-label="${h(c)} umbenennen">✎</button><button type="button" class="ws-van-edit" data-cat-delete="${h(c)}" aria-label="${h(c)} löschen">×</button></div>`).join('') || '<p class="ws-muted">Noch keine Kategorien.</p>'}</div>
        <div class="recipe-cat-new"><input data-recipe-cat-new maxlength="40" placeholder="Neue Kategorie, z. B. Für Gäste" aria-label="Neue Kategorie"><button type="button" class="secondary" data-recipe-cat-add>＋</button></div></div>
      <div class="calendar-dialog-actions"><span></span><span></span><span></span><button type="button" class="primary" data-recipe-close>Fertig</button></div></form>`);
    const setCats = next => { state.customCategories = { ...(state.customCategories || {}), recipes: next }; persist(); };
    const renameIn = (from, to) => list().filter(r => (r.data?.categories || []).includes(from)).forEach(r => change({ ...r, data: { ...r.data, categories: [...new Set(r.data.categories.map(c => c === from ? to : c).filter(Boolean))] } }));
    d.querySelector('[data-recipe-cat-add]').onclick = () => { const input = d.querySelector('[data-recipe-cat-new]'), name = input.value.trim().slice(0, 40); if (name && !categories().some(c => c.toLowerCase() === name.toLowerCase())) setCats([...categories(), name]); editCategories(); };
    d.querySelectorAll('[data-cat-rename]').forEach(b => { b.onclick = () => { const from = b.dataset.catRename, to = prompt('Neuer Name', from)?.trim().slice(0, 40); if (!to || to === from) return; setCats([...new Set(categories().map(c => c === from ? to : c))]); renameIn(from, to); editCategories(); }; });
    d.querySelectorAll('[data-cat-delete]').forEach(b => { b.onclick = () => { const name = b.dataset.catDelete; if (!confirm(`Kategorie „${name}“ löschen? Die Rezepte bleiben erhalten.`)) return; setCats(categories().filter(c => c !== name)); renameIn(name, ''); editCategories(); }; });
  }

  // ---------- Auf die Einkaufsliste ----------
  function shopPreview(id) {
    const r = recipe(id); if (!r) return;
    const base = Number(r.data?.servings) || 2, servings = servingsFor[id] || base, factor = servings / base, items = r.data?.ingredients || [];
    const d = dialog('recipeShopDialog', `<form><div class="dialog-head"><div><span class="kicker">${h(r.title)} · ${servings} Portionen</span><h2>Auf die Einkaufsliste</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><p class="ws-help">Haken weg bei allem, was ihr schon zu Hause habt. Basics (Salz, Öl …) und kleine Mengen (EL, TL, Prise) sind schon abgewählt.</p>
        <div class="recipe-shop-list">${items.map((ing, i) => { const plan = planItem(ing, factor), basic = isBasic(ing.name), spoon = SPOON.includes(ing.unit); return `<label class="ws-check recipe-shop-row"><input type="checkbox" name="pick" value="${i}" ${basic || spoon ? '' : 'checked'}><span><span>${h(plan.text)}${basic ? ' <small>Basic</small>' : spoon && !basic ? ' <small>kleine Menge</small>' : ''}</span>${plan.note ? `<em>${h(plan.note)}</em>` : ''}</span></label>`; }).join('') || '<p class="ws-muted">Dieses Rezept hat keine Zutaten.</p>'}</div>
      </div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit" ${items.length ? '' : 'disabled'}>Übernehmen</button></div></form>`);
    d.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const picked = [...d.querySelectorAll('[name=pick]:checked')].map(input => items[Number(input.value)]).filter(Boolean);
      const before = JSON.parse(JSON.stringify(state.shopping));
      const result = addToShopping(picked, factor, r.title);
      d.close(); document.querySelector('#recipeViewDialog')?.close();
      // gleich zur Einkaufsliste wechseln, damit man das Ergebnis sieht – mit Rückgängig (z. B. versehentlich doppelt übertragen)
      tab = 'shopping'; try { localStorage.setItem('zuhause-shopping-tab', tab); } catch {} render();
      document.querySelector('.full-shopping')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toastUndo(`${result.added} neu auf der Liste${result.merged ? `, ${result.merged} zusammengerechnet` : ''}`, () => { state.shopping = before; persist(); try { renderShopping(); } catch {} try { renderAll(); } catch {} toast('Rückgängig gemacht'); });
    };
  }
  // Menge eines Einkaufsartikels („2 ×“, „500 g“, „1,5 kg“) lesen
  function shoppingAmount(quantity) {
    const q = String(quantity || '').trim(); if (!q) return { value: null, unit: '' };
    const amount = parseAmount(q.replace(/×/g, '').replace(/(\d|\s)x$/i, '$1').trim()); if (!amount) return { value: null, unit: q }; // „x“ nur als Mal-Zeichen, nicht in „Box“
    const rest = amount.rest.replace(/^×|^x\b/i, '').trim(), unit = UNITS.find(([, re]) => re.test(rest))?.[0] || rest;
    return { value: amount.value, unit: /×|x/i.test(q) && !rest ? '' : unit };
  }
  const shoppingQuantity = (value, unit) => value === null || value === undefined ? (unit || '') : !unit || unit === 'Stück' ? `${formatAmount(value, '')} ×` : formatAmount(value, unit);
  // Was passiert mit einer Zutat auf der Einkaufsliste? (für Vorschau und Übernehmen – beides zeigt bzw. tut dasselbe)
  function planItem(ing, factor) {
    // Stückzahlen zum Einkaufen aufrunden (eine halbe Zwiebel oder Dose kauft man nicht); Gewicht, Löffel usw. bleiben genau
    const unit = ing.unit || '', countable = ['', 'Stück', 'Dose', 'Pck.', 'Bund', 'Becher', 'Glas', 'Kopf', 'Knolle', 'Stange', 'Tasse', 'Box'].includes(unit);
    const exact = ing.amount ? ing.amount * factor : null, value = exact === null ? null : countable ? Math.ceil(exact - 1e-9) : exact;
    const rounded = exact !== null && countable && Math.abs(value - exact) > 1e-6 ? `aufgerundet von ${formatAmount(exact, unit)}` : '';
    const existing = state.shopping.find(item => !item.done && sameIngredient(item.title, ing.name));
    if (existing) {
      const have = shoppingAmount(existing.quantity), [baseA, fA] = baseOf(have.unit), [baseB, fB] = baseOf(unit);
      if (value === null) return { kind: 'already', existing, text: ing.name, note: `steht schon auf der Liste${existing.quantity ? ` (${existing.quantity})` : ''}` };
      if (have.value === null && !have.unit) { const q = shoppingQuantity(value, unit); return { kind: 'merge', existing, quantity: q, text: `${q} ${ing.name}`, note: 'steht schon auf der Liste – Menge wird ergänzt' }; }
      if (have.value !== null && baseA === baseB) {
        // zusammenrechnen in der Grundeinheit, dann wieder lesbar (z. B. 1.200 g → 1,2 kg)
        const q = shoppingQuantity(have.value * fA + value * fB, baseA === 'stk' ? '' : baseA);
        return { kind: 'merge', existing, quantity: q, text: `${q} ${existing.title}`, note: `${existing.quantity} stehen schon drauf → zusammen ${q}` };
      }
    }
    const q = shoppingQuantity(value, unit);
    return { kind: 'new', quantity: q, value, unit, text: `${q ? `${q} ` : ''}${ing.name}`, note: [rounded, existing ? 'andere Einheit – eigene Zeile' : ''].filter(Boolean).join(' · ') };
  }
  function addToShopping(ingredients, factor, recipeTitle) {
    let added = 0, merged = 0;
    for (const ing of ingredients) {
      const plan = planItem(ing, factor);
      if (plan.kind === 'already') { merged++; continue; }
      if (plan.kind === 'merge') { plan.existing.quantity = plan.quantity; plan.existing.fromRecipe = recipeTitle; merged++; continue; }
      // Bereich im Supermarkt über die bestehende Zuordnung der Einkaufsliste
      const parsed = window.ZuhauseFeatures?.parseShoppingItem?.(ing.name) || { title: ing.name, category: 'Sonstiges' };
      state.shopping.unshift({ id: uid(), raw: ingredientText({ ...ing, amount: plan.value }), title: ing.name, quantity: plan.quantity, category: parsed.category || 'Sonstiges', done: false, fromRecipe: recipeTitle, createdAt: new Date().toISOString() });
      added++;
    }
    persist(); try { renderShopping(); } catch {} try { renderAll(); } catch {}
    return { added, merged };
  }

  // ---------- Basics bearbeiten ----------
  function editBasics() {
    const d = dialog('recipeBasicsDialog', `<form><div class="dialog-head"><div><span class="kicker">Rezepte</span><h2>Basics</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><p class="ws-help">Was ihr fast immer zu Hause habt. Diese Zutaten sind beim Übertragen auf die Einkaufsliste erst einmal abgewählt. Auch Zusammensetzungen zählen mit: „Öl“ erfasst „Rapsöl“, „Salz“ erfasst „Meersalz“.</p>
        <label class="ws-field"><span>Eine pro Zeile</span><textarea name="basics" rows="10">${h(basics().join('\n'))}</textarea></label></div>
      <div class="calendar-dialog-actions"><button type="button" class="secondary" data-recipe-basics-reset>Standard</button><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`);
    d.querySelector('[data-recipe-basics-reset]').onclick = () => { d.querySelector('[name=basics]').value = DEFAULT_BASICS.join('\n'); };
    d.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const value = [...new Set(String(new FormData(event.currentTarget).get('basics')).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean))].slice(0, 100);
      state.settings = { ...(state.settings || {}), recipeBasics: value }; persist(); d.close(); toast('Basics gespeichert');
    };
  }

  // ---------- Klicks ----------
  document.addEventListener('click', event => {
    const b = event.target.closest('[data-recipe-import],[data-recipe-categories],[data-recipe-filter],[data-recipe-tab],[data-recipe-new],[data-recipe-open],[data-recipe-fav],[data-recipe-edit],[data-recipe-delete],[data-recipe-shop],[data-recipe-servings],[data-recipe-basics]'); if (!b) return;
    const ds = b.dataset;
    if ('recipeTab' in ds) { tab = ds.recipeTab; try { localStorage.setItem('zuhause-shopping-tab', tab); } catch {} render(); if (tab === 'recipes') sync(); }
    if ('recipeNew' in ds) edit(null);
    if ('recipeImport' in ds) importDialog();
    if ('recipeCategories' in ds) editCategories();
    if ('recipeFilter' in ds) { categoryFilter = ds.recipeFilter; const panel = document.querySelector('#recipePanel'); if (panel) renderList(panel); }
    if ('recipeOpen' in ds) show(ds.recipeOpen);
    if ('recipeEdit' in ds) edit(ds.recipeEdit);
    if ('recipeDelete' in ds) remove(ds.recipeDelete);
    if ('recipeShop' in ds) shopPreview(ds.recipeShop);
    if ('recipeBasics' in ds) editBasics();
    if ('recipeFav' in ds) { const r = recipe(ds.recipeFav); if (r) change({ ...r, favorite: !r.favorite }); }
    if ('recipeServings' in ds) { const id = b.closest('dialog')?.dataset.recipeId, r = recipe(id); if (r) { const base = Number(r.data?.servings) || 2; servingsFor[id] = Math.min(99, Math.max(1, (servingsFor[id] || base) + Number(ds.recipeServings))); show(id); } }
  });

  render(); setTimeout(() => { render(); sync(); }, 0);
  window.ZuhauseRecipes = { render, sync, pendingCount: () => { loadCache(); return Object.keys(cache.pending).length; }, parseIngredient, formatAmount, shoppingAmount, addToShopping, isBasic, _setRecipes: rows => { loadCache(); rows.forEach(r => { cache.recipes[r.id] = r; }); render(); } };
})();
