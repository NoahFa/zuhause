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
  let cache = { recipes: {}, cursor: null, pending: {} }, cacheKey = '', query = '', tab = 'shopping', syncing = false;

  // ---------- Zutaten verstehen ----------
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  const UNITS = [
    ['kg', /^(kg|kilo(gramm)?)$/i], ['g', /^(g|gr|gramm)$/i], ['mg', /^mg$/i], ['l', /^(l|liter)$/i], ['ml', /^(ml|milliliter)$/i], ['cl', /^cl$/i], ['dl', /^dl$/i],
    ['EL', /^(el|essl(öffel)?\.?|esslöffel)$/i], ['TL', /^(tl|teel(öffel)?\.?|teelöffel)$/i], ['Prise', /^prisen?$/i], ['Msp.', /^(msp\.?|messerspitzen?)$/i],
    ['Pck.', /^(pck\.?|pkg\.?|päckchen|packung(en)?)$/i], ['Dose', /^dosen?$/i], ['Bund', /^bunde?$/i], ['Zehe', /^zehen?$/i], ['Stück', /^(stück|stk\.?|st\.?)$/i],
    ['Scheibe', /^scheiben?$/i], ['Becher', /^becher$/i], ['Tasse', /^tassen?$/i], ['Glas', /^gl(as|äser)$/i], ['Handvoll', /^handvoll$/i], ['Blatt', /^bl(att|ätter)$/i],
    ['Zweig', /^zweige?$/i], ['Stange', /^stangen?$/i], ['Kopf', /^k(opf|öpfe)$/i], ['Knolle', /^knollen?$/i], ['Würfel', /^würfel$/i], ['Tropfen', /^tropfen$/i], ['Schuss', /^schuss$/i],
  ];
  function parseAmount(text) {
    const t = String(text || '').trim().replace(/\s+/g, ' ');
    // „1 ½“, „1½“, „½“, „1/2“, „1,5“, „2-3“ (erste Zahl)
    const m = t.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔⅛])?(?:\s*\/\s*(\d+))?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?(?=\s|$)/);
    if (!m || (!m[1] && !m[2])) return null;
    let value = m[1] ? Number(m[1].replace(',', '.')) : 0;
    if (m[3] && m[1]) value = Number(m[1].replace(',', '.')) / Number(m[3]);
    if (m[2]) value += FRACTIONS[m[2]];
    return value > 0 && Number.isFinite(value) ? { value, rest: t.slice(m[0].length).trim() } : null;
  }
  function parseIngredient(line) {
    const raw = String(line || '').replace(/^[-•*·]\s*/, '').trim(); if (!raw) return null;
    const amount = parseAmount(raw); let rest = amount ? amount.rest : raw, unit = '';
    const first = rest.split(/\s+/)[0] || '', known = UNITS.find(([, re]) => re.test(first.replace(/[.,]$/, '')) || re.test(first));
    if (known && rest.split(/\s+/).length > 1) { unit = known[0]; rest = rest.slice(first.length).trim(); }
    return { amount: amount ? Math.round(amount.value * 1000) / 1000 : null, unit, name: rest || raw };
  }
  const fractionText = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
  function formatAmount(value, unit) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    let v = value, u = unit;
    if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; } else if (u === 'ml' && v >= 1000) { v /= 1000; u = 'l'; }
    if (['g', 'ml'].includes(u)) v = v >= 100 ? Math.round(v / 5) * 5 : Math.round(v);
    let text;
    const whole = Math.floor(v + 1e-9), part = Math.round((v - whole) * 4) / 4;
    if (!['g', 'ml', 'kg', 'l'].includes(u) && Math.abs(v - (whole + part)) < 0.04 && (part in fractionText || part === 0)) text = `${whole || ''}${part ? fractionText[part] : ''}` || '0';
    else text = (Math.round(v * 100) / 100).toLocaleString('de-DE');
    return `${text}${u ? ` ${u}` : ''}`;
  }
  const ingredientText = (ing, factor = 1) => `${ing.amount ? `${formatAmount(ing.amount * factor, ing.unit)} ` : ing.unit ? `${ing.unit} ` : ''}${ing.name}`;

  // Gleiche Zutat erkennen: Kleinschreibung, Zusätze nach Komma/Klammer weg, einfache Mehrzahl-Endungen kürzen
  const stem = word => { const w = String(word || '').toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].trim().replace(/\s+/g, ' '); const s = w.replace(/(en|er|n|e|s)$/, ''); return s.length >= 2 ? s : w; };
  // Einheiten, die sich ineinander umrechnen lassen (Grundeinheit, Faktor)
  const BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], l: ['ml', 1000], cl: ['ml', 10], dl: ['ml', 100], '': ['stk', 1], 'Stück': ['stk', 1], '×': ['stk', 1] };
  const baseOf = unit => BASE[unit] || [unit, 1];

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
        const { error } = await cloud.from('recipes').upsert(rows, { onConflict: 'id' });
        if (!error) { pending.forEach(r => { if (cache.pending[r.id] === r) delete cache.pending[r.id]; }); storeCache(); }
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
        storeCache(); if (changed) render();
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
  }
  function render() {
    installTabs(); loadCache();
    const card = document.querySelector('.full-shopping'), panel = document.querySelector('#recipePanel'); if (!card || !panel) return;
    card.classList.toggle('show-recipes', tab === 'recipes');
    card.querySelectorAll('[data-recipe-tab]').forEach(b => { b.classList.toggle('active', b.dataset.recipeTab === tab); b.setAttribute('aria-pressed', String(b.dataset.recipeTab === tab)); });
    if (tab !== 'recipes') return;
    if (panel.contains(document.activeElement) && document.activeElement.matches('input')) { renderList(panel); return; }
    panel.innerHTML = `<div class="recipe-toolbar"><label class="doc-search"><span aria-hidden="true">⌕</span><input id="recipeSearch" type="search" placeholder="Suchen" aria-label="Rezepte durchsuchen" value="${h(query)}"></label><button class="primary" type="button" data-recipe-new>＋ Rezept</button></div><div id="recipeList"></div><button type="button" class="ws-text-button" data-recipe-basics>Basics bearbeiten (Salz, Pfeffer …)</button>`;
    panel.querySelector('#recipeSearch').addEventListener('input', event => { query = event.target.value.trim(); renderList(panel); });
    renderList(panel);
  }
  function renderList(panel) {
    const box = panel.querySelector('#recipeList'); if (!box) return;
    const q = query.toLowerCase();
    const shown = list().filter(r => !q || `${r.title} ${(r.data?.ingredients || []).map(i => i.name).join(' ')} ${(r.data?.categories || []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || String(a.title).localeCompare(String(b.title), 'de'));
    box.innerHTML = shown.map(r => `<div class="recipe-row"><button type="button" class="recipe-heart ${r.favorite ? 'on' : ''}" data-recipe-fav="${h(r.id)}" aria-pressed="${!!r.favorite}" aria-label="${r.favorite ? 'Aus den Favoriten nehmen' : 'Als Favorit markieren'}">${r.favorite ? '♥' : '♡'}</button><button type="button" class="recipe-open" data-recipe-open="${h(r.id)}"><strong>${h(r.title)}</strong><small>${h(String(r.data?.servings || 2))} Portionen · ${(r.data?.ingredients || []).length} Zutaten${(r.data?.categories || []).length ? ` · ${h(r.data.categories.join(', '))}` : ''}</small></button><em aria-hidden="true">›</em></div>`).join('')
      || (list().length ? `<p class="ws-muted">Nichts gefunden für „${h(query)}“.</p>` : '<div class="ws-empty"><strong>Noch keine Rezepte.</strong><p>Tippe auf „＋ Rezept“ und trag euer erstes Lieblingsessen ein – danach kommt es mit einem Tipp auf die Einkaufsliste.</p></div>');
  }

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
        <div class="recipe-servings"><span>Portionen</span><button type="button" class="secondary" data-recipe-servings="-1" aria-label="Weniger Portionen" ${servings <= 1 ? 'disabled' : ''}>−</button><strong aria-live="polite">${servings}</strong><button type="button" class="secondary" data-recipe-servings="1" aria-label="Mehr Portionen">＋</button>${servings !== base ? `<small>Rezept ist für ${base}</small>` : ''}</div>
        <button type="button" class="primary ws-large" data-recipe-shop="${h(r.id)}">🛒 Auf die Einkaufsliste</button>
        <section><h3>Zutaten</h3><ul class="recipe-ingredients">${(r.data?.ingredients || []).map(ing => `<li>${ing.amount || ing.unit ? `<b>${h(ing.amount ? formatAmount(ing.amount * factor, ing.unit) : ing.unit)}</b> ` : ''}${h(ing.name)}</li>`).join('') || '<li class="ws-muted">Keine Zutaten eingetragen.</li>'}</ul></section>
        ${(r.data?.steps || []).length ? `<section><h3>Zubereitung</h3><ol class="recipe-steps">${r.data.steps.map(step => `<li>${h(step)}</li>`).join('')}</ol></section>` : ''}
        ${source ? `<p class="ws-help">Quelle: <a href="${h(source)}" target="_blank" rel="noopener noreferrer">${h(new URL(source).hostname)}</a></p>` : ''}
      </div>
      <div class="calendar-dialog-actions"><button type="button" class="danger" data-recipe-delete="${h(r.id)}">Löschen</button><span></span><button type="button" class="secondary" data-recipe-edit="${h(r.id)}">Bearbeiten</button><button type="button" class="secondary" data-recipe-close>Schließen</button></div></form>`);
    d.dataset.recipeId = id;
  }

  // ---------- Eintippen / Bearbeiten ----------
  function edit(id) {
    const r = id ? recipe(id) : null, data = r?.data || {};
    const d = dialog('recipeEditDialog', `<form><div class="dialog-head"><div><span class="kicker">Rezept</span><h2>${r ? 'Rezept bearbeiten' : 'Neues Rezept'}</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields">
        <label class="ws-field"><span>Titel</span><input name="title" required maxlength="200" value="${h(r?.title || '')}" placeholder="z. B. Spaghetti Bolognese"></label>
        <label class="ws-field recipe-servings-field"><span>Für wie viele Portionen?</span><input name="servings" type="number" inputmode="numeric" min="1" max="99" required value="${h(String(data.servings || 2))}"></label>
        <label class="ws-field"><span>Zutaten – eine pro Zeile</span><textarea name="ingredients" rows="8" placeholder="500 g Spaghetti&#10;1 Zwiebel&#10;2 EL Olivenöl&#10;Salz">${h((data.ingredients || []).map(ing => ingredientText(ing)).join('\n'))}</textarea><small class="ws-help">Menge und Einheit vorne, z. B. „200 g Mehl“, „1,5 l Milch“, „½ TL Salz“.</small></label>
        <label class="ws-field"><span>Zubereitung – ein Schritt pro Absatz</span><textarea name="steps" rows="8" placeholder="Zwiebel würfeln und in Öl anschwitzen.&#10;&#10;Hackfleisch dazugeben …">${h((data.steps || []).join('\n\n'))}</textarea></label>
        <label class="ws-field"><span>Quelle (Link, optional)</span><input name="source" type="url" inputmode="url" maxlength="500" value="${h(data.source || '')}" placeholder="https://…"></label>
        <p class="auth-message" data-recipe-message></p>
      </div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`);
    d.querySelector('form').onsubmit = event => {
      event.preventDefault(); const f = new FormData(event.currentTarget), message = d.querySelector('[data-recipe-message]');
      const title = String(f.get('title')).trim(), servings = Math.min(99, Math.max(1, Math.round(Number(f.get('servings')) || 2)));
      if (!title) { message.textContent = 'Bitte einen Titel eingeben.'; return; }
      const sourceText = String(f.get('source')).trim(), source = sourceText ? safeExternalUrl(sourceText) : '';
      if (sourceText && !source) { message.textContent = 'Der Link muss mit http:// oder https:// beginnen.'; return; }
      const ingredients = String(f.get('ingredients')).split(/\r?\n/).map(parseIngredient).filter(Boolean).slice(0, 200);
      const steps = String(f.get('steps')).split(/\r?\n\s*\r?\n|\r?\n(?=\s*\d+[.)]\s)/).map(s => s.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 100);
      // beim Speichern frisch holen (der Abgleich kann den Stand inzwischen ersetzt haben)
      const current = id ? recipe(id) : null, newId = current?.id || uid();
      change({ ...(current || {}), id: newId, title, favorite: !!current?.favorite, deleted_at: null, data: { ...(current?.data || {}), servings, ingredients, steps, source } });
      d.close(); toast('Rezept gespeichert'); show(newId);
    };
  }
  function remove(id) {
    const r = recipe(id); if (!r) return;
    const copy = JSON.parse(JSON.stringify(r));
    change({ ...r, deleted_at: new Date().toISOString() }); document.querySelector('#recipeViewDialog')?.close();
    toastUndo(`„${r.title}“ gelöscht`, () => change({ ...copy, deleted_at: null }));
  }

  // ---------- Auf die Einkaufsliste ----------
  function shopPreview(id) {
    const r = recipe(id); if (!r) return;
    const base = Number(r.data?.servings) || 2, servings = servingsFor[id] || base, factor = servings / base, items = r.data?.ingredients || [];
    const d = dialog('recipeShopDialog', `<form><div class="dialog-head"><div><span class="kicker">${h(r.title)} · ${servings} Portionen</span><h2>Auf die Einkaufsliste</h2></div><button class="close" type="button" data-recipe-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><p class="ws-help">Haken weg bei allem, was ihr schon zu Hause habt. Basics wie Salz und Öl sind schon abgewählt.</p>
        <div class="recipe-shop-list">${items.map((ing, i) => `<label class="ws-check recipe-shop-row"><input type="checkbox" name="pick" value="${i}" ${isBasic(ing.name) ? '' : 'checked'}><span>${ing.amount || ing.unit ? `<b>${h(ing.amount ? formatAmount(ing.amount * factor, ing.unit) : ing.unit)}</b> ` : ''}${h(ing.name)}${isBasic(ing.name) ? ' <small>Basic</small>' : ''}</span></label>`).join('') || '<p class="ws-muted">Dieses Rezept hat keine Zutaten.</p>'}</div>
      </div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-recipe-close>Abbrechen</button><button class="primary" type="submit" ${items.length ? '' : 'disabled'}>Übernehmen</button></div></form>`);
    d.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const picked = [...d.querySelectorAll('[name=pick]:checked')].map(input => items[Number(input.value)]).filter(Boolean);
      const result = addToShopping(picked, factor, r.title);
      d.close(); document.querySelector('#recipeViewDialog')?.close();
      toast(`${result.added} neu auf der Liste${result.merged ? `, ${result.merged} zusammengerechnet` : ''}`);
    };
  }
  // Menge eines Einkaufsartikels („2 ×“, „500 g“, „1,5 kg“) lesen
  function shoppingAmount(quantity) {
    const q = String(quantity || '').trim(); if (!q) return { value: null, unit: '' };
    const amount = parseAmount(q.replace(/×|x$/i, '').trim()); if (!amount) return { value: null, unit: q };
    const rest = amount.rest.replace(/^×|^x\b/i, '').trim(), unit = UNITS.find(([, re]) => re.test(rest))?.[0] || rest;
    return { value: amount.value, unit: /×|x/i.test(q) && !rest ? '' : unit };
  }
  const shoppingQuantity = (value, unit) => value === null || value === undefined ? (unit || '') : !unit || unit === 'Stück' ? `${formatAmount(value, '')} ×` : formatAmount(value, unit);
  function addToShopping(ingredients, factor, recipeTitle) {
    let added = 0, merged = 0;
    for (const ing of ingredients) {
      // Stückzahlen zum Einkaufen aufrunden (eine halbe Zwiebel oder Dose kauft man nicht); Gewicht, Löffel usw. bleiben genau
      const unit = ing.unit || '', countable = ['', 'Stück', 'Dose', 'Pck.', 'Bund', 'Becher', 'Glas', 'Kopf', 'Knolle', 'Stange', 'Tasse'].includes(unit);
      const value = ing.amount ? (countable ? Math.ceil(ing.amount * factor - 1e-9) : ing.amount * factor) : null;
      const existing = state.shopping.find(item => !item.done && stem(item.title) === stem(ing.name));
      if (existing) {
        const have = shoppingAmount(existing.quantity), [baseA, fA] = baseOf(have.unit), [baseB, fB] = baseOf(unit);
        if (value === null) { merged++; continue; } // steht schon drauf, Menge offen
        if (have.value === null && !have.unit) { existing.quantity = shoppingQuantity(value, unit); merged++; continue; }
        if (have.value !== null && baseA === baseB) {
          // zusammenrechnen in der Grundeinheit, dann wieder lesbar (z. B. 1.200 g → 1,2 kg)
          const total = have.value * fA + value * fB, outUnit = baseA === 'stk' ? '' : baseA;
          existing.quantity = shoppingQuantity(total, outUnit); existing.fromRecipe = recipeTitle; merged++; continue;
        }
      }
      // Bereich im Supermarkt über die bestehende Zuordnung der Einkaufsliste
      const parsed = window.ZuhauseFeatures?.parseShoppingItem?.(ing.name) || { title: ing.name, category: 'Sonstiges' };
      state.shopping.unshift({ id: uid(), raw: ingredientText({ ...ing, amount: value }), title: ing.name, quantity: shoppingQuantity(value, unit), category: parsed.category || 'Sonstiges', done: false, fromRecipe: recipeTitle, createdAt: new Date().toISOString() });
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
    const b = event.target.closest('[data-recipe-tab],[data-recipe-new],[data-recipe-open],[data-recipe-fav],[data-recipe-edit],[data-recipe-delete],[data-recipe-shop],[data-recipe-servings],[data-recipe-basics]'); if (!b) return;
    const ds = b.dataset;
    if ('recipeTab' in ds) { tab = ds.recipeTab; try { localStorage.setItem('zuhause-shopping-tab', tab); } catch {} render(); if (tab === 'recipes') sync(); }
    if ('recipeNew' in ds) edit(null);
    if ('recipeOpen' in ds) show(ds.recipeOpen);
    if ('recipeEdit' in ds) edit(ds.recipeEdit);
    if ('recipeDelete' in ds) remove(ds.recipeDelete);
    if ('recipeShop' in ds) shopPreview(ds.recipeShop);
    if ('recipeBasics' in ds) editBasics();
    if ('recipeFav' in ds) { const r = recipe(ds.recipeFav); if (r) change({ ...r, favorite: !r.favorite }); }
    if ('recipeServings' in ds) { const id = b.closest('dialog')?.dataset.recipeId, r = recipe(id); if (r) { const base = Number(r.data?.servings) || 2; servingsFor[id] = Math.min(99, Math.max(1, (servingsFor[id] || base) + Number(ds.recipeServings))); show(id); } }
  });

  render(); setTimeout(() => { render(); sync(); }, 0);
  window.ZuhauseRecipes = { render, sync, parseIngredient, formatAmount, shoppingAmount, addToShopping, isBasic, _setRecipes: rows => { loadCache(); rows.forEach(r => { cache.recipes[r.id] = r; }); render(); } };
})();
