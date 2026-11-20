// Noahs Nebenjobs: Aufträge mit Stempeluhr, nachgetragenen Zeiten, Material mit Preisen und anpassbarem Stundensatz.
// Daten in state.noahJobs = { rate, running: { orderId, start, date } | null, orders: [...] }.
(() => {
  'use strict';
  const h = escapeHtml;
  const uid = () => crypto.randomUUID();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => iso(new Date());
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromIso = v => new Date(`${v}T12:00:00`);
  const niceDate = (v, o = { weekday: 'short', day: 'numeric', month: 'short' }) => fromIso(v).toLocaleDateString('de-DE', o);
  const num = v => { let s = String(v ?? '').trim().replace(/[\s€]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); const n = Number(s); return Number.isFinite(n) ? n : 0; }; // deutsche Schreibweise: 1.250,50 → 1250.5
  const euro = n => money(Math.round((Number(n) || 0) * 100) / 100);
  const hours = m => `${(Math.round(m / 60 * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
  const STATUS = { open: 'In Arbeit', invoiced: 'Abgerechnet', paid: 'Bezahlt' };
  let openOrderId = null, tick = null;

  function data() {
    if (!state.noahJobs || typeof state.noahJobs !== 'object') state.noahJobs = {};
    const d = state.noahJobs;
    if (!Array.isArray(d.orders)) d.orders = [];
    return d;
  }
  function minutesBetween(start, end) { if (!start || !end) return 0; const [a, b] = start.split(':').map(Number), [c, e] = end.split(':').map(Number); let m = c * 60 + e - (a * 60 + b); if (m < 0) m += 1440; return m; }
  const rateOf = order => num(order.rate) || num(data().rate);
  function totals(order) {
    const minutes = (order.times || []).reduce((s, t) => s + Math.max(0, minutesBetween(t.start, t.end) - num(t.pause)), 0);
    const labour = minutes / 60 * rateOf(order), material = (order.materials || []).reduce((s, m) => s + num(m.qty) * num(m.price), 0);
    return { minutes, labour, material, total: labour + material };
  }
  function save(message) { persist(); render(); window.ZuhauseWorkspaces?.render?.(); if (message) toast(message); }

  function dialog(title, html, onSave, extraButton) {
    let d = document.querySelector('#noahJobDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'noahJobDialog'; d.className = 'calendar-event-dialog'; document.body.append(d); }
    d.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Nebenjobs</span><h2>${h(title)}</h2></div><button class="close" type="button" data-nj-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields">${html}<p class="auth-message" data-nj-message></p></div><div class="dialog-actions"><button class="secondary" type="button" data-nj-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    d.querySelectorAll('[data-nj-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelector('form').onsubmit = event => { event.preventDefault(); const r = onSave(new FormData(event.currentTarget)); if (typeof r === 'string') d.querySelector('[data-nj-message]').textContent = r; else if (r !== false) d.close(); };
    if (extraButton) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ws-text-button'; b.textContent = extraButton.label; b.onclick = () => { if (extraButton.run() !== false) d.close(); }; d.querySelector('.ws-dialog-fields').append(b); }
    d.showModal(); d.querySelector('input,select,textarea')?.focus(); return d;
  }
  const field = (label, name, value = '', type = 'text', attrs = '') => `<label class="ws-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value ?? '')}" ${attrs}></label>`;

  // ---------- Ansichten ----------
  function runningBanner() {
    const r = data().running; if (!r) return '';
    const order = data().orders.find(o => o.id === r.orderId);
    return `<article class="card nj-running"><div><span class="kicker">Läuft gerade</span><strong>${h(order?.title || 'Auftrag')}</strong><small>seit ${h(r.start)} Uhr${r.date && r.date !== todayIso() ? ` (${h(niceDate(r.date))})` : ''} · <b data-nj-elapsed>${hours(minutesBetween(r.start, nowTime()))}</b></small>${(r.date && r.date < todayIso()) || minutesBetween(r.start, nowTime()) > 720 ? '<small class="clock-warning">Läuft seit über 12 Stunden – vielleicht vergessen auszustempeln?</small>' : ''}</div><button class="primary ws-large" data-nj-clock-out>Ausstempeln</button></article>`;
  }
  function listView() {
    const d = data(), orders = [...d.orders].sort((a, b) => (a.status === 'paid') - (b.status === 'paid') || String(b.createdAt).localeCompare(String(a.createdAt)));
    const open = d.orders.filter(o => o.status !== 'paid').reduce((s, o) => s + totals(o).total, 0);
    const month = todayIso().slice(0, 7), monthMinutes = d.orders.flatMap(o => (o.times || []).filter(t => t.date?.startsWith(month)).map(t => ({ t, o }))).reduce((s, { t }) => s + Math.max(0, minutesBetween(t.start, t.end) - num(t.pause)), 0);
    const monthEuro = d.orders.reduce((s, o) => s + (o.times || []).filter(t => t.date?.startsWith(month)).reduce((x, t) => x + Math.max(0, minutesBetween(t.start, t.end) - num(t.pause)) / 60 * rateOf(o), 0), 0);
    return `${runningBanner()}
      <div class="ch-stats nj-stats"><div><small>Diesen Monat</small><strong>${hours(monthMinutes)}</strong></div><div><small>Arbeitslohn Monat</small><strong>${euro(monthEuro)}</strong></div><div class="total"><small>Noch nicht bezahlt</small><strong>${euro(open)}</strong></div></div>
      <div class="ws-section-head"><div><span class="kicker">Nebenjobs</span><h2>Aufträge</h2><p>Standard-Stundensatz: <b>${d.rate ? euro(d.rate) : 'noch nicht festgelegt'}</b></p></div><div class="nj-head-actions"><button class="secondary" data-nj-rate>Stundensatz</button><button class="primary" data-nj-new>＋ Auftrag</button></div></div>
      <div class="nj-orders">${orders.map(o => { const t = totals(o); return `<button class="card nj-order status-${h(o.status || 'open')}" data-nj-open="${h(o.id)}"><span class="nj-order-top"><strong>${h(o.title)}</strong><em>${h(STATUS[o.status || 'open'])}</em></span><small>${h([o.customer, o.address].filter(Boolean).join(' · ') || 'ohne Kunde')}</small><span class="nj-order-sum"><span>${hours(t.minutes)} · Material ${euro(t.material)}</span><b>${euro(t.total)}</b></span>${data().running?.orderId === o.id ? '<span class="nj-live">● läuft</span>' : ''}</button>`; }).join('') || '<div class="ws-empty"><strong>Noch kein Auftrag.</strong><p>Lege einen Auftrag an, stemple ein und trage Material mit Preisen ein – die Abrechnung rechnet die App.</p></div>'}</div>`;
  }
  function orderView(order) {
    const t = totals(order), running = data().running, isRunning = running?.orderId === order.id;
    const times = [...(order.times || [])].sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));
    return `<div class="section-back"><button data-nj-back>← Alle Aufträge</button></div>
      <div class="ws-order-heading"><div><span class="kicker">${h(STATUS[order.status || 'open'])}${order.customer ? ` · ${h(order.customer)}` : ''}</span><h2>${h(order.title)}</h2>${order.address ? `<a class="ws-route-link" href="https://maps.apple.com/?daddr=${encodeURIComponent(order.address)}" target="_blank" rel="noopener">📍 ${h(order.address)} · Route öffnen →</a>` : ''}${order.notes ? `<p>${h(order.notes)}</p>` : ''}</div><button class="secondary" data-nj-edit="${h(order.id)}">Auftrag bearbeiten</button></div>
      ${isRunning ? runningBanner() : `<div class="ch-clock-actions nj-clock"><button class="primary ws-large" data-nj-clock-in="${h(order.id)}" ${running ? 'disabled' : ''}>Einstempeln</button><button class="secondary" data-nj-time-new="${h(order.id)}">＋ Zeit nachtragen</button></div>${running ? '<p class="ws-help">Du bist gerade bei einem anderen Auftrag eingestempelt.</p>' : ''}`}
      <section class="card ws-step"><div class="ws-step-heading"><span>⏱</span><div><small>Stempeluhr</small><h2>Arbeitszeit · ${hours(t.minutes)}</h2></div></div>
        ${times.map(x => { const m = Math.max(0, minutesBetween(x.start, x.end) - num(x.pause)); return `<div class="nj-row"><div><strong>${h(niceDate(x.date))} · ${h(x.start)}–${h(x.end)}</strong><small>${hours(m)}${num(x.pause) ? ` (${num(x.pause)} Min. Pause)` : ''}${x.note ? ` · ${h(x.note)}` : ''}</small></div><b>${euro(m / 60 * rateOf(order))}</b><button class="ws-van-edit" data-nj-time-edit="${h(order.id)}:${h(x.id)}" aria-label="Zeit bearbeiten">✎</button></div>`; }).join('') || '<p class="ws-muted">Noch keine Zeit erfasst.</p>'}
      </section>
      <section class="card ws-step"><div class="ws-step-heading"><span>🧾</span><div><small>Material</small><h2>Material · ${euro(t.material)}</h2></div></div>
        <button class="secondary scan-here" data-scan-here data-scan-folder="Noah" data-scan-category="Rechnungen" data-scan-name="Beleg" data-scan-actions="material" data-scan-order="${h(order.id)}">📄 Beleg scannen</button>
        <form class="nj-material-form" data-nj-material-form="${h(order.id)}" novalidate><input name="name" required maxlength="120" placeholder="Material, z. B. Silikon" aria-label="Material"><input name="qty" inputmode="decimal" placeholder="Menge" value="1" aria-label="Menge"><input name="unit" maxlength="20" placeholder="Einheit" aria-label="Einheit"><input name="price" inputmode="decimal" required placeholder="€/Einh." aria-label="Preis je Einheit in Euro"><button class="primary" type="submit">＋ Material</button></form>
        ${(order.materials || []).map(m => `<div class="nj-row"><div><strong>${h(m.name)}</strong><small>${m.fromScan ? '📄 aus Beleg · ' : ''}${h(String(m.qty).replace('.', ','))}${m.unit ? ` ${h(m.unit)}` : ''} × ${euro(m.price)}</small></div><b>${euro(num(m.qty) * num(m.price))}</b><button class="ws-van-edit" data-nj-material-edit="${h(order.id)}:${h(m.id)}" aria-label="Material bearbeiten">✎</button></div>`).join('') || '<p class="ws-muted">Noch kein Material.</p>'}
      </section>
      <section class="card ws-step nj-bill"><div class="ws-step-heading"><span>€</span><div><small>Abrechnung</small><h2>${euro(t.total)}</h2></div></div>
        <div class="nj-bill-lines"><span>Arbeitszeit ${hours(t.minutes)} × ${euro(rateOf(order))}${order.rate ? (order.rateFixed ? ' (festgeschrieben)' : ' (eigener Satz)') : ''}</span><b>${euro(t.labour)}</b><span>Material</span><b>${euro(t.material)}</b><span class="sum">Gesamt</span><b class="sum">${euro(t.total)}</b></div>
        <div class="ch-clock-actions">${order.status !== 'invoiced' && order.status !== 'paid' ? `<button class="secondary" data-nj-status="${h(order.id)}:invoiced">Als abgerechnet markieren</button>` : ''}${order.status !== 'paid' ? `<button class="${order.status === 'invoiced' ? 'primary' : 'secondary'}" data-nj-status="${h(order.id)}:paid">Bezahlt ✓</button>` : `<button class="secondary" data-nj-status="${h(order.id)}:open">Wieder öffnen</button>`}</div>
      </section>`;
  }

  // ---------- Bearbeiten ----------
  function editRate() {
    const d = data();
    dialog('Standard-Stundensatz', `${field('Stundensatz in €', 'rate', d.rate ?? '', 'text', 'inputmode="decimal" required placeholder="z. B. 35"')}<p class="ws-help">Gilt für alle Aufträge ohne eigenen Satz. Einen abweichenden Satz legst du im Auftrag fest.</p>`,
      f => { const rate = num(f.get('rate')); if (rate <= 0) return 'Bitte einen Stundensatz eintragen.'; data().rate = rate; save('Stundensatz gespeichert'); });
  }
  function editOrder(id) {
    const d = data(), o = d.orders.find(x => x.id === id);
    dialog(o ? 'Auftrag bearbeiten' : 'Neuer Auftrag', `${field('Auftrag', 'title', o?.title || '', 'text', 'required maxlength="120" placeholder="z. B. Küche montieren"')}${field('Kunde (optional)', 'customer', o?.customer || '', 'text', 'maxlength="120"')}${field('Adresse (optional)', 'address', o?.address || '', 'text', 'maxlength="200" placeholder="Straße, Ort – für die Route"')}${field('Eigener Stundensatz in € (optional)', 'rate', o?.rate ?? '', 'text', `inputmode="decimal" placeholder="Standard: ${d.rate ? euro(d.rate) : 'nicht festgelegt'}"`)}<label class="ws-field"><span>Notiz (optional)</span><textarea name="notes" rows="2" maxlength="500">${h(o?.notes || '')}</textarea></label>`,
      f => {
        const values = { title: String(f.get('title')).trim(), customer: String(f.get('customer')).trim(), address: String(f.get('address')).trim(), rate: num(f.get('rate')) || null, notes: String(f.get('notes')).trim() };
        if (!values.title) return false;
        // Frisch holen: beim Abgleich mit dem anderen Handy kann der Datenstand ersetzt worden sein.
        const d = data(), o = id ? d.orders.find(x => x.id === id) : null;
        if (o) Object.assign(o, values); else { const id = uid(); d.orders.unshift({ id, ...values, status: 'open', times: [], materials: [], createdAt: new Date().toISOString() }); openOrderId = id; }
        save(o ? 'Gespeichert' : 'Auftrag angelegt');
      },
      o ? { label: 'Auftrag löschen', run: () => { if (!confirm(`Auftrag „${o.title}“ mit allen Zeiten und Material löschen?`)) return false; const d = data(); d.orders = d.orders.filter(x => x.id !== id); if (d.running?.orderId === id) d.running = null; openOrderId = null; save('Auftrag gelöscht'); } } : null);
  }
  function editTime(orderId, timeId, preset) {
    const o = data().orders.find(x => x.id === orderId); if (!o) return; o.times ||= [];
    const t = o.times.find(x => x.id === timeId), v = t || preset || { date: todayIso(), start: '', end: '', pause: 0, note: '' };
    dialog(t ? 'Zeit bearbeiten' : preset ? 'Ausstempeln' : 'Zeit nachtragen', `${field('Datum', 'date', v.date, 'date', 'required')}<div class="lou-interval">${field('Von', 'start', v.start, 'time', 'required')}${field('Bis', 'end', v.end, 'time', 'required')}</div>${field('Pause (Minuten)', 'pause', v.pause || 0, 'number', 'min="0" max="600"')}${field('Was wurde gemacht? (optional)', 'note', v.note || '', 'text', 'maxlength="160"')}`,
      f => {
        const values = { date: String(f.get('date')), start: String(f.get('start')), end: String(f.get('end')), pause: num(f.get('pause')), note: String(f.get('note')).trim() };
        if (!values.date || !values.start || !values.end) return 'Bitte Datum, Beginn und Ende eintragen.';
        const o = data().orders.find(x => x.id === orderId); if (!o) return 'Dieser Auftrag wurde inzwischen gelöscht.'; o.times ||= [];
        const t = timeId ? o.times.find(x => x.id === timeId) : null;
        if (t) Object.assign(t, values); else o.times.push({ id: uid(), ...values });
        if (preset) data().running = null;
        save(`${hours(Math.max(0, minutesBetween(values.start, values.end) - values.pause))} gespeichert`);
      },
      t ? { label: 'Zeit löschen', run: () => { if (!confirm('Diese Zeit löschen?')) return false; const o = data().orders.find(x => x.id === orderId); if (o) o.times = (o.times || []).filter(x => x.id !== timeId); save('Gelöscht'); } } : preset ? { label: 'Einstempeln verwerfen', run: () => { if (!confirm('Einstempeln verwerfen, ohne zu speichern?')) return false; data().running = null; save(); } } : null);
  }
  function editMaterial(orderId, materialId) {
    const o = data().orders.find(x => x.id === orderId), m = o?.materials?.find(x => x.id === materialId); if (!m) return;
    dialog('Material bearbeiten', `${field('Material', 'name', m.name, 'text', 'required maxlength="120"')}<div class="lou-interval">${field('Menge', 'qty', String(m.qty).replace('.', ','), 'text', 'inputmode="decimal" required')}${field('Einheit', 'unit', m.unit || '', 'text', 'maxlength="20"')}</div>${field('Preis pro Einheit in €', 'price', String(m.price).replace('.', ','), 'text', 'inputmode="decimal" required')}`,
      f => { const name = String(f.get('name')).trim(); if (!name) return false; const m = data().orders.find(x => x.id === orderId)?.materials?.find(x => x.id === materialId); if (!m) return 'Dieses Material wurde inzwischen entfernt.'; Object.assign(m, { name, qty: String(f.get('qty')).trim() === '' ? 1 : num(f.get('qty')), unit: String(f.get('unit')).trim(), price: num(f.get('price')) }); save('Gespeichert'); },
      { label: 'Material entfernen', run: () => {
        const o = data().orders.find(x => x.id === orderId); if (!o) return; const index = (o.materials || []).findIndex(x => x.id === materialId); if (index < 0) return;
        const [removed] = o.materials.splice(index, 1); persist(); render(); window.ZuhauseWorkspaces?.render?.();
        toastUndo(`„${removed.name}“ entfernt`, () => { const again = data().orders.find(x => x.id === orderId); if (!again) return; (again.materials ||= []).splice(Math.min(index, again.materials.length), 0, removed); save('Wiederhergestellt'); });
      } });
  }

  // ---------- Seite ----------
  function render() {
    const page = document.querySelector('#nebenjob'); if (!page) return;
    if (page.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) return;
    const order = data().orders.find(o => o.id === openOrderId);
    page.innerHTML = `${order ? '' : '<div class="section-back"><button data-ws-route="noah">← Noahs Übersicht</button></div>'}<div class="ws-montage-title"><div><p class="eyebrow">Noahs Bereich</p><h1>Nebenjobs.</h1><p>Aufträge, Stunden, Material und Abrechnung.</p></div></div>${order ? orderView(order) : listView()}`;
    clearInterval(tick); if (data().running) tick = setInterval(() => { const el = document.querySelector('[data-nj-elapsed]'), r = data().running; if (!el || !r) { clearInterval(tick); return; } el.textContent = hours(minutesBetween(r.start, nowTime())); }, 30000);
  }
  // wie lange schon eingestempelt („1:20 h“)
  function runningFor(start) { const [hh, mm] = String(start).split(':').map(Number), now = new Date(), minutes = Math.max(0, now.getHours() * 60 + now.getMinutes() - (hh * 60 + mm)); return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`; }
  function summaryCard() {
    const d = data(), open = d.orders.filter(o => o.status !== 'paid'), running = d.running ? d.orders.find(o => o.id === d.running.orderId) : null;
    return `<article class="ws-start-card nj-start"><span class="kicker">Nebenjobs</span><h2>${running ? `● Eingestempelt: ${h(running.title)}` : 'Aufträge & Stunden'}</h2>${running ? `<p class="nj-running-since">seit ${h(d.running.start)} Uhr${d.running.date === todayIso() ? ` · ${runningFor(d.running.start)}` : ` (${h(String(d.running.date).split('-').reverse().join('.'))})`}</p>` : ''}<p>${open.length ? `${open.length} ${open.length === 1 ? 'Auftrag' : 'Aufträge'} offen · ${euro(open.reduce((s, o) => s + totals(o).total, 0))} noch nicht bezahlt` : 'Stempeluhr, Material mit Preisen und Abrechnung je Auftrag.'}</p>${running ? '<button class="primary ws-large" data-nj-quick-out>Ausstempeln</button><button class="secondary" data-ws-route="nebenjob">Nebenjobs öffnen</button>' : '<button class="primary ws-large" data-ws-route="nebenjob">Nebenjobs öffnen</button>'}</article>`;
  }

  // Ausstempeln direkt von Noahs Startseite
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-nj-quick-out]')) return;
    const r = data().running; if (!r) return; openOrderId = r.orderId; go('nebenjob'); editTime(r.orderId, null, { date: r.date, start: r.start, end: nowTime(), pause: 0, note: '' });
  });
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || !b.closest('#nebenjob, #noahJobDialog')) return; const d = b.dataset;
    if ('njNew' in d) editOrder();
    if ('njRate' in d) editRate();
    if ('njOpen' in d) { openOrderId = d.njOpen; render(); scrollTo({ top: 0 }); }
    if ('njBack' in d) { openOrderId = null; render(); }
    if ('njEdit' in d) editOrder(d.njEdit);
    if ('njClockIn' in d) { const o = data().orders.find(x => x.id === d.njClockIn); if (!o) { toast('Dieser Auftrag wurde inzwischen gelöscht'); render(); return; } if (!rateOf(o)) { editRate(); return; } data().running = { orderId: o.id, start: nowTime(), date: todayIso() }; save(`Eingestempelt um ${data().running.start} Uhr`); }
    if ('njClockOut' in d) { const r = data().running; if (r) { openOrderId = r.orderId; editTime(r.orderId, null, { date: r.date, start: r.start, end: nowTime(), pause: 0, note: '' }); } }
    if ('njTimeNew' in d) editTime(d.njTimeNew);
    if ('njTimeEdit' in d) { const [o, t] = d.njTimeEdit.split(':'); editTime(o, t); }
    if ('njMaterialEdit' in d) { const [o, m] = d.njMaterialEdit.split(':'); editMaterial(o, m); }
    if ('njStatus' in d) { const [id, status] = d.njStatus.split(':'), o = data().orders.find(x => x.id === id); if (o) { if (status !== 'open' && !num(o.rate) && num(data().rate)) { o.rate = num(data().rate); o.rateFixed = true; } if (status === 'open' && o.rateFixed) { o.rate = null; o.rateFixed = false; } o.status = status; save(STATUS[status]); } }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-nj-material-form]'); if (!form) return; event.preventDefault();
    const o = data().orders.find(x => x.id === form.dataset.njMaterialForm), f = new FormData(form), name = String(f.get('name')).trim(); if (!o) return;
    // eigene Meldung statt stillem Nichts (die Browser-Prüfung zeigt am iPhone oft gar nichts an)
    if (!name || String(f.get('price')).trim() === '') { toast(!name ? 'Bitte eintragen, welches Material' : 'Bitte den Preis eintragen'); form.querySelector(!name ? '[name=name]' : '[name=price]')?.focus(); return; }
    (o.materials ||= []).push({ id: uid(), name, qty: String(f.get('qty')).trim() === '' ? 1 : num(f.get('qty')), unit: String(f.get('unit')).trim(), price: num(f.get('price')) });
    save('Material ergänzt'); document.querySelector('[data-nj-material-form] input[name=name]')?.focus();
  });

  document.querySelector('main.main')?.insertAdjacentHTML('beforeend', '<section class="page ws-personal" id="nebenjob"></section>');
  const originalGo = go;
  go = function (target) { originalGo(target); if (target === 'nebenjob') { document.body.dataset.workspace = 'noah'; document.querySelectorAll('[data-space]').forEach(b => b.classList.toggle('active', b.dataset.space === 'noah')); render(); } };
  const oldRender = renderAll; renderAll = function () { oldRender(); if (document.querySelector('#nebenjob.active')) render(); };
  window.ZuhauseNoahJobs = { render, summaryCard, totals };
})();
