// Lous Bereich: nächster Tierarzttermin (aus dem Kalender), regelmäßige Pflege mit Fälligkeit, Steckbrief, Futter, Dokumente.
// Daten liegen im gemeinsamen Zustand unter state.lou = { care: [...], profile: {...} }.
(() => {
  'use strict';
  const h = escapeHtml;
  const uid = () => crypto.randomUUID();
  const SUGGESTIONS = [
    { title: 'Wurmkur', every: 3, unit: 'months' },
    { title: 'Floh- & Zeckenschutz', every: 1, unit: 'months' },
    { title: 'Impfung auffrischen', every: 1, unit: 'years' },
    { title: 'Futter nachkaufen', every: 4, unit: 'weeks' },
    { title: 'Krallen prüfen', every: 6, unit: 'weeks' },
  ];
  const UNIT = { weeks: ['Woche', 'Wochen'], months: ['Monat', 'Monate'], years: ['Jahr', 'Jahre'] };

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => iso(new Date());
  const fromIso = value => new Date(`${value}T12:00:00`);
  function addInterval(value, every, unit) {
    const date = fromIso(value), n = Math.max(1, Number(every) || 1);
    if (unit === 'weeks') date.setDate(date.getDate() + 7 * n);
    else {
      const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + (unit === 'years' ? 12 * n : n));
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    }
    return iso(date);
  }
  const daysUntil = value => Math.round((fromIso(value) - fromIso(todayIso())) / 86400000);
  const niceDate = value => fromIso(value).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const intervalLabel = item => Number(item.every) === 1 ? ({ weeks: 'jede Woche', months: 'jeden Monat', years: 'jedes Jahr' }[item.unit] || '') : `alle ${item.every} ${UNIT[item.unit]?.[1] || ''}`;

  function data() {
    if (!state.lou || typeof state.lou !== 'object') state.lou = {};
    if (!Array.isArray(state.lou.care)) state.lou.care = [];
    if (!state.lou.profile || typeof state.lou.profile !== 'object') state.lou.profile = {};
    return state.lou;
  }
  function status(item) {
    const days = daysUntil(item.nextDue);
    if (days < 0) return { cls: 'overdue', text: `überfällig seit ${niceDate(item.nextDue)}` };
    if (days === 0) return { cls: 'due', text: 'heute fällig' };
    if (days <= 7) return { cls: 'soon', text: days === 1 ? 'morgen fällig' : `in ${days} Tagen fällig` };
    return { cls: '', text: `nächstes Mal ${niceDate(item.nextDue)}` };
  }
  function save() { persist(); render(); window.ZuhauseFeatures?.refresh?.(); }

  function nextVetAppointment() {
    const today = todayIso(), until = addInterval(today, 1, 'years');
    const list = window.ZuhauseCalendar?.occurrencesInRange?.(today, until) || [];
    return list.find(event => /tierarzt|\blou\b|🐾/i.test(`${event.title} ${event.notes || ''}`));
  }

  function render() {
    const page = document.querySelector('#lou'); if (!page) return;
    const lou = data(), profile = lou.profile;
    const care = [...lou.care].sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));
    const vet = nextVetAppointment();
    const unused = SUGGESTIONS.filter(s => !lou.care.some(item => item.title.toLowerCase() === s.title.toLowerCase()));
    const phone = String(profile.vetPhone || '').replace(/[^\d+]/g, '');
    page.innerHTML = `
      <div class="section-back"><button data-ws-route="household">← Haushalt</button></div>
      <div class="ws-personal-title"><div><p class="eyebrow">Eure Hündin</p><h1>Lou.</h1><p>Tierarzt, Pflege und alles Wichtige auf einen Blick.</p></div><span class="ws-personal-badge lou-badge">🐾</span></div>
      ${lou.photoPath ? `<figure class="lou-hero"><img data-lou-photo alt="Lou" ${photoCache.path === lou.photoPath && photoCache.url ? `src="${h(photoCache.url)}"` : ''}><button class="lou-photo-change" data-lou-photo-change>📷 Foto ändern</button></figure>` : '<button class="card lou-photo-empty" data-lou-photo-change><span>📷</span><strong>Foto von Lou hinzufügen</strong><small>Macht ihren Bereich persönlicher. Das Bild bleibt privat bei euch.</small></button>'}
      <input type="file" accept="image/*" id="louPhotoInput" hidden>
      <div class="lou-grid">
        <article class="card lou-vet"><span class="kicker">Tierarzt</span>
          ${vet ? `<h2>${h(vet.title)}</h2><p class="lou-big">${h(niceDate(vet.occurrenceDate))}${vet.allDay ? '' : ` · ${h(vet.startTime)} Uhr`}</p>` : '<h2>Kein Termin geplant</h2><p class="ws-muted">Tierarzttermine tragt ihr im Kalender ein. Steht „Tierarzt“ oder „Lou“ im Titel, erscheinen sie hier.</p>'}
          <div class="lou-actions"><button class="primary" data-lou-vet-new>＋ Tierarzttermin</button>${phone ? `<a class="secondary lou-call" href="tel:${h(phone)}">📞 ${h(profile.vetName || 'Tierarzt')} anrufen</a>` : ''}</div>
        </article>
        <article class="card lou-quick"><span class="kicker">Schnell erledigt</span><h2>Für Lou</h2>
          <button class="secondary lou-wide" data-lou-food>🛒 Futter auf die Einkaufsliste</button>
          <button class="secondary lou-wide" data-scan-here data-scan-folder="Lou">📄 Dokument scannen (Impfpass, Rechnung)</button>
          <button class="secondary lou-wide" data-lou-docs>▤ Lous Dokumente öffnen</button>
        </article>
      </div>
      <div class="ws-section-head"><div><span class="kicker">Regelmäßig</span><h2>Pflege & Vorsorge</h2><p>Tippe auf „Erledigt“, dann rechnet die App das nächste Mal aus. Fälliges erscheint auf „Heute“ und in der Morgen-Nachricht.</p></div><button class="primary" data-lou-care-new>＋ Hinzufügen</button></div>
      <div class="lou-care-list">${care.map(item => { const st = status(item); return `<div class="card lou-care ${st.cls}"><div><strong>${h(item.title)}</strong><small>${h(intervalLabel(item))} · <span class="lou-status">${h(st.text)}</span>${item.lastDone ? ` · zuletzt ${h(niceDate(item.lastDone))}` : ''}</small></div><button class="primary lou-done" data-lou-done="${h(item.id)}">Erledigt ✓</button><button class="ws-van-edit" data-lou-care-edit="${h(item.id)}" aria-label="${h(item.title)} bearbeiten">✎</button></div>`; }).join('') || '<div class="ws-empty"><strong>Noch keine Pflege eingetragen.</strong><p>Lege an, woran ihr regelmäßig denken müsst – oder tippe unten auf einen Vorschlag.</p></div>'}</div>
      ${unused.length ? `<div class="lou-suggestions"><span>Vorschläge:</span>${unused.map(s => `<button data-lou-suggest="${SUGGESTIONS.indexOf(s)}">＋ ${h(s.title)}</button>`).join('')}</div>` : ''}
      <article class="card lou-profile"><div class="card-head"><div><span class="kicker">Steckbrief</span><h2>Wichtige Angaben</h2></div><button class="secondary" data-lou-profile>Bearbeiten</button></div>
        <dl>${[['Tierarzt', [profile.vetName, profile.vetPhone].filter(Boolean).join(' · ')], ['Versicherung', profile.insurance], ['Chipnummer', profile.chip], ['Geburtstag', profile.birthday ? niceDate(profile.birthday) : ''], ['Notizen', profile.notes]].map(([label, value]) => `<div><dt>${label}</dt><dd>${value ? h(value) : '<span class="ws-muted">–</span>'}</dd></div>`).join('')}</dl>
      </article>`;
    showPhoto();
  }

  // ---- Foto: privat im Speicher unter <Haushalt>/shared/lou/, Anzeige über einen zeitlich begrenzten Link ----
  const photoCache = { path: '', url: '', until: 0 };
  async function showPhoto() {
    const path = data().photoPath, img = document.querySelector('#lou [data-lou-photo]'); if (!path || !img) return;
    if (photoCache.path === path && photoCache.url && Date.now() < photoCache.until) { if (img.src !== photoCache.url) img.src = photoCache.url; return; }
    const { data: signed, error } = await cloud.storage.from('receipts').createSignedUrl(path, 3600);
    if (error || !signed?.signedUrl) return;
    Object.assign(photoCache, { path, url: signed.signedUrl, until: Date.now() + 50 * 60000 });
    const current = document.querySelector('#lou [data-lou-photo]'); if (current) current.src = signed.signedUrl;
  }
  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }
  async function uploadPhoto(file) {
    if (!cloud || !currentHousehold || !cloudReady) { toast('Das Foto kann nur mit Internet und Anmeldung gespeichert werden'); return; }
    toast('Foto wird hochgeladen …');
    try {
      const blob = await shrink(file); if (!blob) throw new Error('Bild konnte nicht gelesen werden');
      const path = `${currentHousehold.id}/shared/lou/lou-${uid()}.jpg`;
      const { error } = await cloud.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
      if (error) throw error;
      const lou = data(), previous = lou.photoPath; lou.photoPath = path; persist(); render();
      if (previous && previous !== path) cloud.storage.from('receipts').remove([previous]).catch(() => {});
      toast('Foto gespeichert');
    } catch { toast('Das Foto konnte gerade nicht gespeichert werden. Bitte noch einmal versuchen.'); }
  }
  document.addEventListener('change', event => { if (event.target.id === 'louPhotoInput' && event.target.files?.[0]) { uploadPhoto(event.target.files[0]); event.target.value = ''; } });

  function dialog(title, html, onSave, extra) {
    let d = document.querySelector('#louDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'louDialog'; d.className = 'calendar-event-dialog'; document.body.append(d); }
    d.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Lou</span><h2>${h(title)}</h2></div><button class="close" type="button" data-lou-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields">${html}</div><div class="dialog-actions"><button class="secondary" type="button" data-lou-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    d.querySelectorAll('[data-lou-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelector('form').onsubmit = event => { event.preventDefault(); if (onSave(new FormData(event.currentTarget)) !== false) d.close(); };
    if (extra) d.querySelector('.ws-dialog-fields').append(extra(d));
    d.showModal(); return d;
  }
  const field = (label, name, value = '', type = 'text', attrs = '') => `<label class="ws-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value)}" ${attrs}></label>`;

  function editCare(id, preset) {
    const lou = data(), item = lou.care.find(entry => entry.id === id);
    const v = item || { title: preset?.title || '', every: preset?.every || 1, unit: preset?.unit || 'months', nextDue: todayIso() };
    dialog(item ? 'Pflege bearbeiten' : 'Pflege hinzufügen',
      `${field('Was?', 'title', v.title, 'text', 'required maxlength="80" placeholder="z. B. Wurmkur"')}
       <div class="lou-interval"><label class="ws-field"><span>Wie oft? Alle …</span><input name="every" type="number" min="1" max="99" value="${h(v.every)}" required></label><label class="ws-field"><span>&nbsp;</span><select name="unit">${Object.entries(UNIT).map(([key, label]) => `<option value="${key}" ${v.unit === key ? 'selected' : ''}>${label[1]}</option>`).join('')}</select></label></div>
       ${field('Nächstes Mal fällig am', 'nextDue', v.nextDue, 'date', 'required')}`,
      form => {
        const values = { title: String(form.get('title')).trim(), every: Math.max(1, Number(form.get('every')) || 1), unit: String(form.get('unit')), nextDue: String(form.get('nextDue')) };
        if (!values.title || !/^\d{4}-\d{2}-\d{2}$/.test(values.nextDue)) return false;
        // Frisch holen: beim Abgleich mit dem anderen Handy kann der Datenstand ersetzt worden sein.
        const freshLou = data(), freshItem = id ? freshLou.care.find(entry => entry.id === id) : null;
        if (freshItem) Object.assign(freshItem, values); else freshLou.care.push({ id: uid(), ...values, lastDone: null, history: [] });
        save(); toast('Gespeichert');
      },
      item ? d => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ws-text-button'; b.textContent = 'Diesen Eintrag entfernen'; b.onclick = () => { if (confirm(`„${item.title}“ entfernen?`)) { const freshLou = data(); freshLou.care = freshLou.care.filter(entry => entry.id !== id); save(); d.close(); } }; return b; } : null);
  }
  function editProfile() {
    const p = data().profile;
    dialog('Steckbrief bearbeiten',
      `${field('Tierarzt / Praxis', 'vetName', p.vetName || '', 'text', 'maxlength="120"')}${field('Telefon Tierarzt', 'vetPhone', p.vetPhone || '', 'tel', 'maxlength="40"')}${field('Versicherung', 'insurance', p.insurance || '', 'text', 'maxlength="160" placeholder="z. B. Haftpflicht, OP-Versicherung"')}${field('Chipnummer', 'chip', p.chip || '', 'text', 'maxlength="40"')}${field('Geburtstag', 'birthday', p.birthday || '', 'date')}<label class="ws-field"><span>Notizen</span><textarea name="notes" rows="3" maxlength="1000" placeholder="z. B. Allergien, Futtersorte">${h(p.notes || '')}</textarea></label>`,
      form => { data().profile = Object.fromEntries(['vetName', 'vetPhone', 'insurance', 'chip', 'birthday', 'notes'].map(key => [key, String(form.get(key) || '').trim()])); save(); toast('Steckbrief gespeichert'); });
  }

  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('louDone' in d) {
      const item = data().care.find(entry => entry.id === d.louDone); if (!item) return;
      const today = todayIso(); item.lastDone = today; item.history = [today, ...(item.history || [])].slice(0, 10);
      item.nextDue = addInterval(today, item.every, item.unit); save(); toast(`Erledigt – nächstes Mal ${niceDate(item.nextDue)}`);
    }
    if ('louCareNew' in d) editCare();
    if ('louCareEdit' in d) editCare(d.louCareEdit);
    if ('louSuggest' in d) editCare(null, SUGGESTIONS[Number(d.louSuggest)]);
    if ('louProfile' in d) editProfile();
    if ('louPhotoChange' in d) document.querySelector('#louPhotoInput')?.click();
    if ('louFood' in d) {
      const exists = state.shopping.some(item => !item.done && /futter/i.test(item.title));
      if (exists) { toast('Futter steht schon auf der Einkaufsliste'); return; }
      const parsed = window.ZuhauseFeatures?.parseShoppingItem?.('Hundefutter') || { title: 'Hundefutter', quantity: '', category: 'Sonstiges' };
      state.shopping.unshift({ id: uid(), raw: 'Hundefutter', title: parsed.title, quantity: parsed.quantity, category: parsed.category, done: false, createdAt: new Date().toISOString() });
      persist(); window.ZuhauseFeatures?.refresh?.(); toast('Hundefutter steht auf der Einkaufsliste');
    }
    if ('louDocs' in d) { go('documents'); setTimeout(() => { const folder = document.querySelector('#documentFolder'), search = document.querySelector('#documentSearch'); if (folder) folder.value = 'Lou'; if (search) { search.value = 'Lou'; search.dispatchEvent(new Event('input', { bubbles: true })); } }, 0); }
    if ('louVetNew' in d) { go('calendar'); setTimeout(() => { window.ZuhauseCalendar?.openCreate?.(); const form = document.querySelector('#calendarEventForm'); if (form) { form.elements.title.value = '🐾 Tierarzt Lou'; form.elements.calendarKey.value = 'shared'; } }, 50); }
  });

  function upcomingEntries(today, limit) {
    return data().care.filter(item => item.nextDue && item.nextDue <= limit).map(item => ({ date: item.nextDue < today ? today : item.nextDue, title: `🐾 ${item.title}${item.nextDue < today ? ' (überfällig)' : ''}`, type: 'Lou' }));
  }

  function install() {
    if (!document.querySelector('#lou')) document.querySelector('main.main').insertAdjacentHTML('beforeend', '<section class="page ws-personal lou-page" id="lou"></section>');
    const oldPetCard = document.querySelector('.household-module[data-detail="pet"]');
    // Neu aufbauen, damit der alte Klick-Befehl („kommt später“) nicht mehr greift.
    const petCard = oldPetCard?.cloneNode(true); if (oldPetCard) oldPetCard.replaceWith(petCard);
    if (petCard) { petCard.removeAttribute('data-detail'); petCard.dataset.wsRoute = 'lou'; petCard.classList.add('lou-entry'); petCard.querySelector('small') && (petCard.querySelector('small').textContent = 'Eure Hündin'); petCard.querySelector('strong') && (petCard.querySelector('strong').textContent = 'Lou'); petCard.querySelector('p') && (petCard.querySelector('p').textContent = 'Tierarzt, Pflege, Futter und Unterlagen.'); }
    const more = document.querySelector('#more .more-feature');
    if (more && !document.querySelector('#more [data-ws-route="lou"]')) more.insertAdjacentHTML('beforebegin', '<button class="more-feature" data-ws-route="lou"><span class="large-icon">🐾</span><span><small>Eure Hündin</small><strong>Lou</strong><p>Tierarzt, Pflege, Futter und Unterlagen.</p></span><em>→</em></button>');
    const originalGo = go;
    go = function (target) { originalGo(target); if (target === 'lou') render(); };
    const oldRender = renderAll; renderAll = function () { oldRender(); if (document.querySelector('#lou.active')) render(); };
  }

  install();
  window.ZuhauseLou = { render, upcomingEntries, addInterval };
})();
