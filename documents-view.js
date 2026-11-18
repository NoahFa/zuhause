// Dokumente wiederfinden und ansehen (Plan „Dokumentenscanner perfektionieren“, Phase 3):
// Ordner-Kacheln mit Anzahl, „Zuletzt hinzugefügt“, Vorschaubilder, Suche mit hervorgehobener Fundstelle,
// Detailansicht mit Öffnen, Teilen (iPhone-Teilen-Menü), Umbenennen, Verschieben und Löschen.
// Vorschaubilder liegen neben der Datei im Speicher: <pfad>.thumb.jpg (keine Datenbankänderung nötig).
(() => {
  'use strict';
  const h = escapeHtml;
  const FOLDERS = ['Gemeinsam', 'Noah', 'Charleen', 'Lou'];
  const ICON = { Gemeinsam: '⌂', Noah: 'N', Charleen: 'C', Lou: '🐾' };
  let docs = [], folder = 'Alle', category = '', query = '', thumbs = new Map(), thumbsUntil = 0, lastSignature = '';
  const thumbPath = path => `${path}.thumb.jpg`;
  const norm = s => String(s || '').toLowerCase();
  const fresh = id => docs.find(d => d.id === id);

  // ---------- Vorschaubild erzeugen (für Scans und hochgeladene Fotos) ----------
  async function imageThumb(source) {
    try {
      const bitmap = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source, { imageOrientation: 'from-image' });
      const f = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bitmap.width * f)); c.height = Math.max(1, Math.round(bitmap.height * f));
      c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height); bitmap.close?.();
      return await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.75));
    } catch { return null; }
  }

  // ---------- Laden ----------
  async function load() {
    const list = document.querySelector('#documentList'); if (!list || !cloudReady || !currentHousehold) return;
    const columns = 'id,file_name,mime_type,size_bytes,storage_path,created_at,category,folder,ocr_text,original_paths,visibility,owner_user_id,uploaded_by';
    let { data, error } = await cloud.from('documents').select(columns).eq('household_id', currentHousehold.id).order('created_at', { ascending: false });
    if (error && /folder|ocr_text|original_paths/i.test(error.message || '')) ({ data, error } = await cloud.from('documents').select('id,file_name,mime_type,size_bytes,storage_path,created_at,category,visibility,owner_user_id,uploaded_by').eq('household_id', currentHousehold.id).order('created_at', { ascending: false }));
    if (error) { list.innerHTML = '<p>Dateien konnten gerade nicht geladen werden.</p>'; return; }
    // Die Liste wird beim regelmäßigen Abgleich mitgeladen – nur neu zeichnen, wenn sich wirklich etwas geändert hat
    // (sonst springt die Liste alle paar Sekunden und ein Tipp kann ins Leere gehen).
    const signature = JSON.stringify((data || []).map(d => [d.id, d.file_name, d.folder, d.category]));
    const changed = signature !== lastSignature; lastSignature = signature; docs = data || [];
    if (changed || !document.querySelector('#docFolderTiles')) { render(); loadThumbs(); window.ZuhauseScanner?.showQueue?.(); }
    usage(changed && usageCache !== null);
  }
  async function loadThumbs() {
    if (!docs.length || !cloud) return;
    if (Date.now() > thumbsUntil) { thumbs = new Map(); thumbsUntil = Date.now() + 50 * 60000; }
    const missing = docs.filter(d => !thumbs.has(d.storage_path));
    if (!missing.length) return;
    // Fotos zeigen sich selbst, PDFs ihr Vorschaubild (falls beim Scannen erstellt)
    const paths = missing.map(d => d.mime_type?.startsWith('image/') ? d.storage_path : thumbPath(d.storage_path));
    const { data } = await cloud.storage.from('receipts').createSignedUrls(paths, 3600).catch(() => ({ data: null }));
    missing.forEach((d, i) => thumbs.set(d.storage_path, data?.[i]?.signedUrl || ''));
    document.querySelectorAll('[data-doc-thumb]').forEach(img => { const url = thumbs.get(img.dataset.docThumb); if (url) { img.src = url; img.hidden = false; img.nextElementSibling?.setAttribute('hidden', ''); } });
  }

  // ---------- Speicherplatz ----------
  // Gratis-Tarif von Supabase: 1 GB für alle Dateien. Gezählt wird alles im Ordner des Haushalts (PDFs, Originale, Vorschaubilder, Lou-Fotos).
  const LIMIT = 1024 ** 3, PER_PAGE = 0.35 * 1024 ** 2; // grob je gescannter Seite: PDF + Original + Vorschaubild
  let usageCache = null;
  async function sizeOf(prefix, depth = 0) {
    let total = 0, offset = 0;
    for (;;) {
      const { data, error } = await cloud.storage.from('receipts').list(prefix, { limit: 1000, offset });
      if (error || !data) throw error || new Error('Liste fehlt');
      for (const item of data) {
        if (item.id === null && depth < 5) total += await sizeOf(`${prefix}/${item.name}`, depth + 1);
        else total += Number(item.metadata?.size) || 0;
      }
      if (data.length < 1000) return total; offset += 1000;
    }
  }
  const mb = bytes => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toLocaleString('de-DE', { maximumFractionDigits: 2 })} GB` : bytes < 1024 ** 2 ? 'unter 1 MB' : `${Math.round(bytes / 1024 ** 2).toLocaleString('de-DE')} MB`;
  function showUsage(bytes) {
    const card = document.querySelector('.document-card'), top = document.querySelector('#docTopSlot'); if (!card || !top) return;
    let box = document.querySelector('#docStorage');
    if (!box) { box = document.createElement('div'); box.id = 'docStorage'; }
    const share = bytes / LIMIT, pct = Math.min(100, Math.round(share * 100)), pages = Math.max(0, Math.floor((LIMIT - bytes) / PER_PAGE));
    // erst ab halb voll oben zeigen, vorher als schmale Zeile unter der Liste
    if (share >= 0.5) top.append(box); else card.after(box);
    box.className = `doc-storage ${share >= 0.9 ? 'full' : share >= 0.8 ? 'warn' : share >= 0.5 ? '' : 'quiet'}`;
    box.innerHTML = `<div><strong>Speicher: ${mb(bytes)} von 1 GB belegt</strong><small>${share >= 0.8 ? `Wird knapp – Platz für noch etwa ${pages.toLocaleString('de-DE')} gescannte Seiten. Alte Dokumente löschen oder mehr Speicher dazubuchen.` : `Platz für noch etwa ${pages.toLocaleString('de-DE')} gescannte Seiten.`}</small></div><span class="doc-storage-bar" role="img" aria-label="${pct} Prozent belegt"><i style="width:${Math.max(1, pct)}%"></i></span>`;
  }
  async function usage(force = false) {
    if (!cloudReady || !currentHousehold) return;
    if (!force && usageCache && Date.now() - usageCache.at < 10 * 60000) { showUsage(usageCache.bytes); return; }
    try {
      const bytes = await sizeOf(currentHousehold.id); usageCache = { bytes, at: Date.now() }; showUsage(bytes);
      if (bytes / LIMIT >= 0.9) { try { if (localStorage.getItem('zuhause-storage-warned') !== todayIso().slice(0, 7)) { localStorage.setItem('zuhause-storage-warned', todayIso().slice(0, 7)); toast('Der Speicher für Dokumente ist fast voll'); } } catch {} }
    } catch { /* Anzeige ist nur ein Hinweis – bei Fehlern einfach weglassen */ }
  }

  // ---------- Darstellung ----------
  function snippet(doc) {
    if (!query) return '';
    const text = String(doc.ocr_text || '').replace(/\s+/g, ' '), i = norm(text).indexOf(norm(query));
    if (i < 0) return '';
    const start = Math.max(0, i - 40), end = Math.min(text.length, i + query.length + 60);
    return `${start ? '… ' : ''}${h(text.slice(start, i))}<mark>${h(text.slice(i, i + query.length))}</mark>${h(text.slice(i + query.length, end))}${end < text.length ? ' …' : ''}`;
  }
  function matches(doc) {
    if (folder !== 'Alle' && (doc.folder || 'Gemeinsam') !== folder) return false;
    if (category && (doc.category || 'Sonstige Dokumente') !== category) return false;
    if (!query) return true;
    return norm(`${doc.file_name} ${doc.category} ${doc.folder} ${doc.ocr_text}`).includes(norm(query));
  }
  const isNew = doc => Date.now() - new Date(doc.created_at).getTime() < 3 * 86400000;
  function row(doc) {
    const thumb = thumbs.get(doc.storage_path), pdf = doc.mime_type === 'application/pdf', snip = snippet(doc);
    return `<button class="document-row doc-row" data-doc-id="${h(doc.id)}" data-document-path="${h(doc.storage_path)}" data-folder="${h(doc.folder || 'Gemeinsam')}" data-category="${h(doc.category || 'Sonstige Dokumente')}">
      <span class="doc-thumb"><img data-doc-thumb="${h(doc.storage_path)}" alt="" ${thumb ? `src="${h(thumb)}"` : 'hidden'}><span class="document-icon" ${thumb ? 'hidden' : ''}>${pdf ? 'PDF' : '▣'}</span></span>
      <span class="doc-text"><strong>${h(doc.file_name)}${isNew(doc) ? ' <i class="doc-new">neu</i>' : ''}</strong><small>${new Date(doc.created_at).toLocaleDateString('de-DE')} · ${h(doc.folder || 'Gemeinsam')} · ${h(doc.category || 'Sonstige Dokumente')}</small>${snip ? `<small class="doc-snippet">${snip}</small>` : ''}</span><em aria-hidden="true">›</em></button>`;
  }
  function render() {
    const list = document.querySelector('#documentList'); if (!list) return;
    ensureControls();
    const counts = Object.fromEntries(FOLDERS.map(f => [f, docs.filter(d => (d.folder || 'Gemeinsam') === f).length]));
    const tiles = document.querySelector('#docFolderTiles');
    if (tiles) tiles.innerHTML = [['Alle', '☰', docs.length], ...FOLDERS.map(f => [f, ICON[f], counts[f]])].map(([f, icon, n]) => `<button class="doc-tile ${folder === f ? 'active' : ''}" data-doc-folder="${h(f)}" aria-pressed="${folder === f}"><span>${icon}</span><strong>${h(f === 'Alle' ? 'Alle' : f)}</strong><small>${n}<span class="doc-word"> ${n === 1 ? "Dokument" : "Dokumente"}</span></small></button>`).join('');
    // Kategorie-Filter: nur Kategorien, die im gewählten Ordner vorkommen
    const inFolder = docs.filter(d => folder === 'Alle' || (d.folder || 'Gemeinsam') === folder);
    const cats = [...new Set(inFolder.map(d => d.category || 'Sonstige Dokumente'))].sort((a, b) => a.localeCompare(b, 'de'));
    if (category && !cats.includes(category)) category = '';
    const chips = document.querySelector('#docCategoryChips');
    if (chips) { chips.hidden = cats.length < 2; chips.innerHTML = cats.length < 2 ? '' : ['', ...cats].map(c => `<button class="doc-chip ${category === c ? 'active' : ''}" data-doc-category="${h(c)}" aria-pressed="${category === c}">${c ? h(c) : 'Alle Kategorien'}</button>`).join(''); }
    const shown = docs.filter(matches);
    // „Zuletzt hinzugefügt“ nur, wenn die Liste lang ist (sonst stünden dieselben Einträge zweimal untereinander)
    const recent = !query && !category && folder === 'Alle' && docs.length > 12 ? docs.slice(0, 4) : [];
    list.innerHTML = !docs.length ? '<div class="ws-empty"><strong>Noch keine Dokumente.</strong><p>Tippe oben auf „Dokument scannen“ – Seite fotografieren, die App macht daraus ein sauberes, durchsuchbares PDF.</p></div>'
      : `${recent.length ? `<p class="doc-section">Zuletzt hinzugefügt</p><div class="doc-recent">${recent.map(d => `<button class="doc-recent-card" data-doc-id="${h(d.id)}"><span class="doc-thumb big"><img data-doc-thumb="${h(d.storage_path)}" alt="" ${thumbs.get(d.storage_path) ? `src="${h(thumbs.get(d.storage_path))}"` : 'hidden'}><span class="document-icon" ${thumbs.get(d.storage_path) ? 'hidden' : ''}>${d.mime_type === 'application/pdf' ? 'PDF' : '▣'}</span></span><small>${h(d.file_name)}</small></button>`).join('')}</div><p class="doc-section">Alle Dokumente</p>` : ''}
        ${shown.map(row).join('') || `<p class="ws-muted">${query ? `Nichts gefunden für „${h(query)}“${folder !== 'Alle' ? ` im Ordner ${h(folder)}` : ''}.` : 'In diesem Ordner liegt noch nichts.'}</p>`}`;
    const head = document.querySelector('.document-card .card-head h2'); if (head) head.textContent = `${folder === 'Alle' ? 'Alle Dokumente' : `Ordner ${folder}`}${category ? ` · ${category}` : ''}`;
  }
  function ensureControls() {
    const card = document.querySelector('.document-card'); if (!card || document.querySelector('#docFolderTiles')) return;
    // Reihenfolge: Suche direkt unter den Knöpfen, dann Hinweise (Warteschlange/Speicher), Ordner, Kategorien, Liste
    const title = document.querySelector('#documents .page-title');
    (title || card).insertAdjacentHTML(title ? 'afterend' : 'beforebegin', `<label class="doc-search"><span aria-hidden="true">⌕</span><input id="docSearchInput" type="search" placeholder="Suchen – auch im Text der Dokumente" aria-label="Dokumente durchsuchen"></label><div id="docTopSlot"></div><div class="doc-tiles" id="docFolderTiles" role="group" aria-label="Ordner"></div><div class="doc-chips" id="docCategoryChips" role="group" aria-label="Kategorie" hidden></div>`);
    card.querySelector('.private-badge')?.remove();
    // Einstellungen und Dokumenten-Check nach unten, zugeklappt
    const check = document.querySelector('#documents .checklist-card');
    document.querySelector('#docSearchInput').addEventListener('input', event => { query = event.target.value.trim(); render(); });
    // alte Suchfelder der Einstellungskarte ausblenden (die neue Suche ersetzt sie)
    ['#documentSearch', '#documentSearchScope'].forEach(sel => { const label = document.querySelector(sel)?.closest('label'); if (label) label.hidden = true; });
    const controls = document.querySelector('.document-controls');
    if (controls && !controls.closest('details')) { const wrap = document.createElement('details'); wrap.className = 'card doc-settings'; wrap.innerHTML = '<summary>Kategorien verwalten</summary>'; controls.remove(); controls.classList.remove('card'); wrap.append(controls); card.after(wrap); }
    // Ordner/Kategorie/Name für „Datei hochladen“ fragt jetzt das Speichern-Fenster – die alten Felder ausblenden
    ['#documentFolder', '#documentCategory', '#documentName'].forEach(sel => { const label = document.querySelector(sel)?.closest('label'); if (label) label.hidden = true; });
    if (check && !check.closest('details')) { const wrap = document.createElement('details'); wrap.className = 'card doc-settings'; wrap.innerHTML = '<summary>Dokumenten-Check (was noch fehlt)</summary>'; check.remove(); check.classList.remove('card'); check.querySelector('h2')?.remove(); check.querySelector('.kicker')?.remove(); wrap.append(check); (document.querySelector('.doc-settings') || card).after(wrap); }
  }

  // ---------- Detailansicht ----------
  function detail(id) {
    const doc = fresh(id); if (!doc) return;
    let d = document.querySelector('#docDetailDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'docDetailDialog'; d.className = 'calendar-event-dialog doc-detail'; document.body.append(d); }
    const categories = state.customCategories?.documents || [];
    const thumb = thumbs.get(doc.storage_path);
    d.dataset.docId = doc.id;
    d.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Dokument</span><h2>${h(doc.file_name)}</h2></div><button class="close" type="button" data-doc-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields">
        ${thumb ? `<button type="button" class="doc-preview" data-doc-open="${h(doc.id)}"><img src="${h(thumb)}" alt="Vorschau"></button>` : ''}
        <div class="doc-detail-actions"><button type="button" class="primary" data-doc-open="${h(doc.id)}">Öffnen</button><button type="button" class="secondary" data-doc-share="${h(doc.id)}" ${navigator.canShare ? 'disabled' : ''}>${navigator.canShare ? 'Wird vorbereitet …' : 'Teilen / Drucken'}</button></div>
        <p class="ws-help">${new Date(doc.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })} · ${readableSize(doc.size_bytes)}${doc.ocr_text ? ' · Text durchsuchbar' : ''}</p>
        <label class="ws-field"><span>Name</span><input name="name" maxlength="120" required value="${h(doc.file_name)}"></label>
        <div class="lou-interval"><label class="ws-field"><span>Ordner</span><select name="folder">${FOLDERS.map(f => `<option ${f === (doc.folder || 'Gemeinsam') ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="ws-field"><span>Kategorie</span><select name="category">${[...new Set([...categories, doc.category || 'Sonstige Dokumente'])].map(c => `<option ${c === doc.category ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label></div>
        ${doc.ocr_text ? `<details class="doc-ocr"><summary>Erkannten Text anzeigen</summary><pre>${h(doc.ocr_text)}</pre></details>` : ''}
        <p class="auth-message" data-doc-message></p>
      </div>
      <div class="calendar-dialog-actions"><button type="button" class="danger" data-doc-delete="${h(doc.id)}">Löschen</button><span></span><button type="button" class="secondary" data-doc-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    d.querySelectorAll('[data-doc-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const f = new FormData(event.currentTarget), message = d.querySelector('[data-doc-message]');
      const values = { file_name: String(f.get('name')).trim(), folder: String(f.get('folder')), category: String(f.get('category')) };
      if (!values.file_name) { message.textContent = 'Bitte einen Namen eingeben.'; return; }
      const { error } = await cloud.from('documents').update(values).eq('id', id).eq('household_id', currentHousehold.id);
      if (error) { message.textContent = 'Speichern hat nicht geklappt. Bitte später noch einmal.'; return; }
      const current = fresh(id); if (current) Object.assign(current, values); d.close(); render(); toast('Gespeichert');
    };
    d.showModal(); prepareShare(doc, d);
  }
  // Teilen am iPhone: Safari öffnet das Teilen-Menü nur direkt nach dem Tippen. Die Datei wird deshalb schon beim Öffnen
  // des Dokuments geladen; der Knopf ist bereit, sobald sie da ist.
  let shareFile = null;
  async function prepareShare(doc, d) {
    shareFile = null; const button = d.querySelector('[data-doc-share]'); if (!navigator.canShare || !button) return;
    try {
      const url = await signedUrl(doc); if (!url) throw new Error('kein Link');
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], /\.\w{2,4}$/.test(doc.file_name) ? doc.file_name : `${doc.file_name}.${doc.mime_type === 'application/pdf' ? 'pdf' : 'jpg'}`, { type: doc.mime_type });
      if (!d.open || d.dataset.docId !== doc.id) return;
      shareFile = navigator.canShare({ files: [file] }) ? { id: doc.id, file } : null;
    } catch { shareFile = null; }
    if (d.open && d.dataset.docId === doc.id) { button.disabled = false; button.textContent = 'Teilen / Drucken'; }
  }
  async function signedUrl(doc) { const { data, error } = await cloud.storage.from('receipts').createSignedUrl(doc.storage_path, 300); return error ? null : data?.signedUrl; }
  async function openDoc(id) {
    const doc = fresh(id); if (!doc) return;
    // Fenster sofort öffnen (iPhone blockiert sonst das Öffnen nach dem Warten), dann Adresse setzen
    const win = window.open('', '_blank'); const url = await signedUrl(doc);
    if (!url) { win?.close(); toast('Datei konnte gerade nicht geöffnet werden'); return; }
    // falls das Fenster blockiert wurde: als Link öffnen, aber nie die App-Seite selbst ersetzen
    if (win) win.location.href = url; else { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
  }
  function share(id) {
    const doc = fresh(id); if (!doc) return;
    // sofort teilen (ohne vorheriges Warten), sonst als Ersatz öffnen – dort geht Teilen/Drucken über das Safari-Menü
    if (shareFile?.id === id) { navigator.share({ files: [shareFile.file], title: doc.file_name }).catch(error => { if (error?.name !== 'AbortError') openDoc(id); }); return; }
    openDoc(id);
  }
  async function remove(id) {
    const doc = fresh(id); if (!doc || !confirm(`„${doc.file_name}“ endgültig löschen?`)) return;
    const { error } = await cloud.from('documents').delete().eq('id', id).eq('household_id', currentHousehold.id);
    if (error) { toast('Löschen hat nicht geklappt'); return; }
    await cloud.storage.from('receipts').remove([doc.storage_path, thumbPath(doc.storage_path), ...(doc.original_paths || [])]).catch(() => {});
    docs = docs.filter(x => x.id !== id); document.querySelector('#docDetailDialog')?.close(); render(); usage(true); toast('Dokument gelöscht');
  }

  document.addEventListener('click', event => {
    const el = event.target.closest('[data-doc-id],[data-doc-folder],[data-doc-category],[data-doc-open],[data-doc-share],[data-doc-delete]'); if (!el) return;
    const ds = el.dataset;
    if ('docFolder' in ds) { folder = ds.docFolder; render(); return; }
    if ('docCategory' in ds) { category = ds.docCategory; render(); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    if ('docOpen' in ds) openDoc(ds.docOpen);
    else if ('docShare' in ds) share(ds.docShare);
    else if ('docDelete' in ds) remove(ds.docDelete);
    else if ('docId' in ds) detail(ds.docId);
  }, true);

  // ---------- „Datei hochladen“ mit Speichern-Fenster ----------
  // Fotos gehen in den Scanner (Ecken, Entzerren, Vorschläge); PDFs bekommen ein kurzes Fenster für Name, Ordner und Kategorie –
  // vorher landeten sie ohne Nachfrage in den versteckt eingestellten Feldern.
  function uploadDialog(file) {
    const categories = state.customCategories?.documents || ['Sonstige Dokumente'];
    const guess = window.ZuhauseScanAnalyse?.analyse(file.name.replace(/[_-]+/g, ' '), categories, state.scanRules || {}) || {};
    const preset = window.__uploadContext || {}; window.__uploadContext = null;
    const folderNow = preset.folder || guess.folder || 'Gemeinsam', categoryNow = guess.category || (categories.includes('Sonstige Dokumente') ? 'Sonstige Dokumente' : categories[0]);
    let d = document.querySelector('#docUploadDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'docUploadDialog'; d.className = 'calendar-event-dialog doc-detail'; document.body.append(d); }
    d.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Datei hochladen</span><h2>Wohin damit?</h2></div><button class="close" type="button" data-doc-close aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields"><p class="ws-help">${h(file.name)} · ${readableSize(file.size)}</p>
        <label class="ws-field"><span>Name</span><input name="name" maxlength="120" required value="${h(file.name.replace(/\.[^.]+$/, ''))}"></label>
        <div class="lou-interval"><label class="ws-field"><span>Ordner</span><select name="folder">${FOLDERS.map(f => `<option ${f === folderNow ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="ws-field"><span>Kategorie</span><select name="category">${categories.map(c => `<option ${c === categoryNow ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label></div>
        <p class="auth-message" data-doc-message></p></div>
      <div class="calendar-dialog-actions"><span></span><span></span><button type="button" class="secondary" data-doc-close>Abbrechen</button><button class="primary" type="submit">Hochladen</button></div></form>`;
    d.querySelectorAll('[data-doc-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const f = new FormData(event.currentTarget), button = d.querySelector('[type=submit]');
      button.disabled = true; button.textContent = 'Wird hochgeladen …';
      window.__pendingDocumentMeta = { folder: String(f.get('folder')), category: String(f.get('category')), ocrText: '', name: String(f.get('name')).trim() || file.name };
      const ok = await uploadDocument(file);
      if (ok) { if (guess.senderKey) window.ZuhauseScanAnalyse?.learn(guess.senderKey, String(f.get('folder')), String(f.get('category'))); d.close(); }
      else { button.disabled = false; button.textContent = 'Hochladen'; d.querySelector('[data-doc-message]').textContent = window.__uploadFailure?.kind === 'network' ? 'Keine Verbindung – bitte später noch einmal.' : 'Hochladen hat nicht geklappt.'; }
    };
    d.showModal();
  }
  document.addEventListener('change', event => {
    const input = event.target; if (!input.matches?.('#fileInput, #cameraInput')) return;
    event.stopImmediatePropagation(); const files = [...(input.files || [])]; input.value = ''; if (!files.length) return;
    if (files.every(file => file.type.startsWith('image/')) && window.ZuhauseScanner?.openWithFiles) window.ZuhauseScanner.openWithFiles(files);
    else uploadDialog(files[0]);
  }, true);

  // ersetzt die bisherige Liste (app.js/features.js)
  loadDocuments = load;
  window.ZuhauseDocuments = { load, uploadDialog, usage, showUsage, usageBytes: () => usageCache?.bytes ?? null, imageThumb, thumbPath, render, _setDocs: list => { docs = list; render(); } };
})();
