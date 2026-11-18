// Charleens Bereich: Reiter Studium (Module + Prüfungsleistungen), Nebenjob (Stempeluhr, Lohn, Trinkgeld),
// Caritas BeWo (To-dos), Sparziele und die bisherigen Notizen. Daten liegen in state.charleen.
(() => {
  'use strict';
  const h = escapeHtml;
  const uid = () => crypto.randomUUID();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => iso(new Date());
  const fromIso = v => new Date(`${v}T12:00:00`);
  const addDays = (v, n) => { const d = fromIso(v); d.setDate(d.getDate() + n); return iso(d); };
  const daysUntil = v => Math.round((fromIso(v) - fromIso(todayIso())) / 86400000);
  const niceDate = (v, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => fromIso(v).toLocaleDateString('de-DE', opts);
  const euro = n => money(Math.round((Number(n) || 0) * 100) / 100);
  const num = v => { let s = String(v ?? '').trim().replace(/[\s€]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); const n = Number(s); return Number.isFinite(n) ? n : 0; }; // deutsche Schreibweise: 1.250,50 → 1250.5
  const hm = minutes => `${Math.floor(minutes / 60)}:${pad(Math.round(minutes % 60))}\u00a0h`;
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const EXAM_TYPES = ['Präsentation', 'Hausarbeit', 'Klausur', 'Referat', 'Portfolio', 'Mündliche Prüfung', 'Projektarbeit', 'Bericht'];
  const EXAM_STATUS = { open: 'offen', submitted: 'abgegeben', passed: 'bestanden', failed: 'nicht bestanden' };
  let tab = 'study', jobMonth = todayIso().slice(0, 7), tick = null;

  function data() {
    if (!state.charleen || typeof state.charleen !== 'object') state.charleen = {};
    const c = state.charleen;
    if (!Array.isArray(c.modules)) c.modules = [];
    if (!c.job || typeof c.job !== 'object') c.job = {};
    if (!Array.isArray(c.job.entries)) c.job.entries = [];
    if (!Array.isArray(c.job.adjustments)) c.job.adjustments = [];
    if (!c.job.limitOverrides || typeof c.job.limitOverrides !== 'object') c.job.limitOverrides = {};
    if (!Array.isArray(c.work)) c.work = [];
    if (!Array.isArray(c.savings)) c.savings = [];
    return c;
  }
  // Wichtig: Beim Abgleich mit dem anderen Handy wird der ganze Datenstand ersetzt. Fenster dürfen deshalb nicht mit
  // beim Öffnen gemerkten Objekten speichern, sondern holen sie beim Speichern über ihre ID neu (fresh*).
  const freshModule = id => data().modules.find(x => x.id === id);
  function save(message) { persist(); render(); syncCalendar(); window.ZuhauseFeatures?.refresh?.(); if (message) toast(message); }

  // ---------- Hilfsdialog ----------
  function dialog(title, html, onSave, extraButton) {
    let d = document.querySelector('#charleenDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'charleenDialog'; d.className = 'calendar-event-dialog'; document.body.append(d); }
    d.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Charleen</span><h2>${h(title)}</h2></div><button class="close" type="button" data-ch-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields">${html}<p class="auth-message" data-ch-message></p></div><div class="dialog-actions"><button class="secondary" type="button" data-ch-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    d.querySelectorAll('[data-ch-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelector('form').onsubmit = event => { event.preventDefault(); const result = onSave(new FormData(event.currentTarget)); if (typeof result === 'string') d.querySelector('[data-ch-message]').textContent = result; else if (result !== false) d.close(); };
    if (extraButton) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ws-text-button'; b.textContent = extraButton.label; b.onclick = () => { if (extraButton.run() !== false) d.close(); }; d.querySelector('.ws-dialog-fields').append(b); }
    d.showModal(); d.querySelector('input:not([type=hidden]),select,textarea')?.focus(); return d;
  }
  const field = (label, name, value = '', type = 'text', attrs = '') => `<label class="ws-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value ?? '')}" ${attrs}></label>`;
  const removeButton = (label, confirmText, run) => ({ label, run: () => { if (!confirm(confirmText)) return false; run(); } });

  // ---------- Studium ----------
  function allExams() {
    return data().modules.flatMap(module => (module.exams || []).map(exam => ({ ...exam, module })));
  }
  function examLine(exam) {
    if (!exam.date) return 'ohne Datum';
    const d = daysUntil(exam.date), when = niceDate(exam.date);
    if (exam.status && exam.status !== 'open') return when;
    if (d < 0) return `${when} · vorbei`;
    if (d === 0) return `${when} · heute`;
    if (d === 1) return `${when} · morgen`;
    return `${when} · in ${d} Tagen`;
  }
  function studyView() {
    const c = data(), today = todayIso();
    const upcoming = allExams().filter(e => (!e.status || e.status === 'open') && e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    const known = new Set(c.modules.map(m => m.name.toLowerCase()));
    const fromTimetable = [...new Set((window.automaticEvents || automaticEvents || []).filter(e => e.kind === 'study' || e.source === 'hochschule').map(e => String(e.title).replace(/^🎓\s*/, '').trim()))].filter(name => name && !known.has(name.toLowerCase()));
    return `
      <article class="card ch-next"><span class="kicker">Als Nächstes</span><h2>Prüfungsleistungen</h2>
        ${upcoming.length ? upcoming.map(e => `<div class="ch-next-row ${daysUntil(e.date) <= 7 ? 'soon' : ''}"><strong>${h(e.module.name)} – ${h(e.type)}</strong><small>${h(examLine(e))}</small></div>`).join('') : '<p class="ws-muted">Keine anstehende Prüfungsleistung eingetragen.</p>'}
      </article>
      <div class="ws-section-head"><div><span class="kicker">Studium</span><h2>Module</h2></div><button class="primary" data-ch-module-new>＋ Modul</button></div>
      ${fromTimetable.length ? `<div class="lou-suggestions"><span>Aus dem Stundenplan:</span>${fromTimetable.map(name => `<button data-ch-module-suggest="${h(name)}">＋ ${h(name)}</button>`).join('')}</div>` : ''}
      <div class="ch-modules">${c.modules.map(m => `<article class="card ch-module"><div class="ch-module-head"><div><strong>${h(m.name)}</strong>${m.note ? `<small>${h(m.note)}</small>` : ''}</div><button class="ws-van-edit" data-ch-module-edit="${h(m.id)}" aria-label="Modul bearbeiten">✎</button></div>
        ${(m.exams || []).slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))).map(e => `<div class="ch-exam status-${h(e.status || 'open')}"><div><strong>${h(e.type)}</strong><small>${h(examLine(e))}${e.status && e.status !== 'open' ? ` · ${h(EXAM_STATUS[e.status])}` : ''}${e.grade ? ` · Note ${h(e.grade)}` : ''}</small></div><button class="ws-van-edit" data-ch-exam-edit="${h(m.id)}:${h(e.id)}" aria-label="Prüfungsleistung bearbeiten">✎</button></div>`).join('') || '<p class="ws-muted">Noch keine Prüfungsleistung.</p>'}
        <button class="ws-text-button" data-ch-exam-new="${h(m.id)}">＋ Prüfungsleistung</button></article>`).join('') || '<div class="ws-empty"><strong>Noch kein Modul eingetragen.</strong><p>Lege deine Module an und trage dazu die Prüfungsleistungen mit Datum ein, z. B. Embodiment – Präsentation – 17.12.2026.</p></div>'}</div>`;
  }
  function editModule(id, presetName) {
    const c = data(), m = c.modules.find(x => x.id === id);
    dialog(m ? 'Modul bearbeiten' : 'Modul hinzufügen', `${field('Modul', 'name', m?.name || presetName || '', 'text', 'required maxlength="120" placeholder="z. B. Embodiment"')}${field('Notiz (optional)', 'note', m?.note || '', 'text', 'maxlength="160" placeholder="z. B. Dozentin, Semester"')}`,
      f => { const c = data(), m = id ? freshModule(id) : null; const name = String(f.get('name')).trim(); if (!name) return false; if (m) Object.assign(m, { name, note: String(f.get('note')).trim() }); else c.modules.push({ id: uid(), name, note: String(f.get('note')).trim(), exams: [] }); save('Modul gespeichert'); },
      m ? removeButton('Modul entfernen', `Modul „${m.name}“ mit allen Prüfungsleistungen entfernen?`, () => { const c = data(); c.modules = c.modules.filter(x => x.id !== id); save('Modul entfernt'); }) : null);
  }
  function editExam(moduleId, examId) {
    const m = data().modules.find(x => x.id === moduleId); if (!m) return; m.exams ||= [];
    const e = m.exams.find(x => x.id === examId);
    dialog(e ? 'Prüfungsleistung bearbeiten' : `Prüfungsleistung · ${m.name}`,
      `<label class="ws-field"><span>Art</span><input name="type" list="chExamTypes" required maxlength="80" value="${h(e?.type || '')}" placeholder="z. B. Präsentation"><datalist id="chExamTypes">${EXAM_TYPES.map(t => `<option value="${t}">`).join('')}</datalist></label>${field('Datum', 'date', e?.date || '', 'date')}<label class="ws-field"><span>Stand</span><select name="status">${Object.entries(EXAM_STATUS).map(([k, v]) => `<option value="${k}" ${(e?.status || 'open') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${field('Note (optional)', 'grade', e?.grade || '', 'text', 'maxlength="10" inputmode="decimal" placeholder="z. B. 1,7"')}`,
      f => { const values = { type: String(f.get('type')).trim(), date: String(f.get('date') || ''), status: String(f.get('status')), grade: String(f.get('grade')).trim() }; if (!values.type) return false; const m = freshModule(moduleId); if (!m) return 'Das Modul wurde inzwischen entfernt.'; m.exams ||= []; const e = examId ? m.exams.find(x => x.id === examId) : null; if (e) Object.assign(e, values); else m.exams.push({ id: uid(), ...values }); save('Prüfungsleistung gespeichert'); },
      e ? removeButton('Prüfungsleistung entfernen', `„${e.type}“ entfernen?`, () => { const m = freshModule(moduleId); if (m) m.exams = (m.exams || []).filter(x => x.id !== examId); save('Entfernt'); }) : null);
  }

  // ---------- Nebenjob ----------
  function minutesBetween(start, end) { if (!start || !end) return 0; const [a, b] = start.split(':').map(Number), [c, d] = end.split(':').map(Number); let m = (c * 60 + d) - (a * 60 + b); if (m < 0) m += 1440; return m; }
  function shift(entry) { const minutes = Math.max(0, minutesBetween(entry.start, entry.end) - num(entry.pause)); const wage = minutes / 60 * num(entry.rate); return { minutes, wage, tip: num(entry.tip), total: wage + num(entry.tip) }; }
  // Überstundenkonto: Monatsgrenze (Standard 43 h). Mehr Stunden gehen aufs Konto, weniger Stunden werden am
  // Monatsende vom Konto aufgefüllt (soweit vorhanden). Auszahlungen/Korrekturen werden im jeweiligen Monat zuerst verbucht.
  // Grenze: entweder Verdienstgrenze in € (z. B. 603 € beim Minijob → Stunden = Grenze ÷ Stundenlohn) oder feste Stunden.
  // Lohn eines Monats: aus den Schichten dieses Monats (nach Stunden gewichtet), sonst der letzte Lohn davor, sonst der aktuelle.
  // So rechnet ein späterer neuer Stundenlohn vergangene Monate nicht um.
  function rateForMonth(job, month) {
    const inMonth = job.entries.filter(e => e.date?.startsWith(month) && num(e.rate));
    if (inMonth.length) { let minutes = 0, sum = 0; inMonth.forEach(e => { const m = shift(e).minutes || 1; minutes += m; sum += m * num(e.rate); }); return sum / minutes; }
    const before = job.entries.filter(e => e.date && e.date.slice(0, 7) < month && num(e.rate)).sort((a, b) => b.date.localeCompare(a.date))[0];
    return before ? num(before.rate) : num(job.rate);
  }
  const monthLimit = (job, month) => num(job.limitOverrides?.[month]) || (num(job.monthCap) && rateForMonth(job, month) ? num(job.monthCap) / rateForMonth(job, month) : num(job.monthLimit) || 43);
  // Buchung in Stunden; Auszahlungen nur mit Betrag werden über den Stundenlohn in Stunden umgerechnet.
  const adjustHours = (job, a) => { if (a.hours !== null && a.hours !== undefined && a.hours !== '') return num(a.hours); const rate = rateForMonth(job, String(a.date || '').slice(0, 7)); return rate ? -num(a.amount) / rate : 0; };
  function ledger(job) {
    const current = todayIso().slice(0, 7), worked = {};
    job.entries.forEach(e => { if (e.date) worked[e.date.slice(0, 7)] = (worked[e.date.slice(0, 7)] || 0) + shift(e).minutes / 60; });
    const months = [...new Set([...Object.keys(worked), ...job.adjustments.map(a => String(a.date || '').slice(0, 7))])].filter(Boolean).sort();
    if (!months.length) return { rows: [], balance: 0, current: { month: current, hours: 0, limit: monthLimit(job, current) } };
    const rows = []; let balance = 0;
    for (let m = months[0]; m < current; m = iso(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 15)).slice(0, 7)) {
      const hours = worked[m] || 0, limit = monthLimit(job, m), adjust = job.adjustments.filter(a => String(a.date).startsWith(m));
      const adjustSum = adjust.reduce((sum, a) => sum + adjustHours(job, a), 0); balance += adjustSum;
      let change = 0;
      if (hours > limit) change = hours - limit; else change = -Math.min(Math.max(balance, 0), limit - hours);
      balance += change;
      rows.push({ month: m, hours, limit, change, adjust, adjustSum, balance });
    }
    const currentAdjust = job.adjustments.filter(a => String(a.date).startsWith(current)).reduce((sum, a) => sum + adjustHours(job, a), 0);
    return { rows, balance: balance + currentAdjust, current: { month: current, hours: worked[current] || 0, limit: monthLimit(job, current), adjust: currentAdjust } };
  }
  const hDec = n => `${(Math.abs(n) < 0.005 ? 0 : Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0h`;
  const monthName = m => new Date(`${m}-15T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  function overtimeView(job) {
    const l = ledger(job), c = l.current, rest = c.limit - c.hours, lastRow = l.rows[l.rows.length - 1];
    return `<article class="card ch-overtime"><div class="ch-module-head"><div><span class="kicker">Überstundenkonto · Grenze ${num(job.monthCap) ? `${euro(job.monthCap)} ≈ ${hDec(monthLimit(job, c.month))}` : hDec(monthLimit(job, c.month)).replace(',00', '')} pro Monat</span><h2>${hDec(l.balance)}</h2><small>Stand ${lastRow ? `Ende ${h(monthName(lastRow.month))}` : 'jetzt'}${c.adjust ? ' inkl. Buchungen in diesem Monat' : ''}</small><p class="ws-help">Was über der Grenze liegt, kommt am Monatsende aufs Konto; fehlende Stunden werden dann vom Konto aufgefüllt.</p></div></div>
      <p class="ch-overtime-now">${h(monthName(c.month))} bisher: <b>${hDec(c.hours)}</b> von ${hDec(c.limit)} · ${rest > 0 ? `noch ${hDec(rest)} bis zur Grenze${l.balance > 0 ? ` – fehlende Stunden werden am Monatsende vom Konto genommen` : ''}` : `<b>${hDec(-rest)} über der Grenze</b> – gehen am Monatsende aufs Konto`}</p>
      <div class="ch-clock-actions"><button class="secondary" data-ch-adjust-new>Auszahlung / Korrektur</button><button class="secondary" data-ch-limit>Monatsgrenze</button></div>
      ${l.rows.length ? `<details class="ws-history"><summary>Verlauf nach Monaten</summary><div class="ch-ledger"><div class="head"><span>Monat</span><span>Gearbeitet</span><span>Konto ±</span><span>Stand</span></div>${l.rows.map(r => `<div><span>${h(monthName(r.month))}${Math.abs(r.limit - monthLimit(job, '0000-00')) > 0.001 ? ` <small>(Grenze ${hDec(r.limit)})</small>` : ''}${r.adjust.map(a => `<small>${h(a.note || (adjustHours(job, a) < 0 ? 'Auszahlung' : 'Korrektur'))}: ${adjustHours(job, a) > 0 ? '+' : ''}${hDec(adjustHours(job, a))} <button class="row-delete" data-ch-adjust-delete="${h(a.id)}" aria-label="Buchung löschen">×</button></small>`).join('')}</span><span>${hDec(r.hours)}</span><span class="${r.change < -0.004 ? 'neg' : 'pos'}">${r.change > 0.004 ? '+' : ''}${hDec(Math.abs(r.change) < 0.005 ? 0 : r.change)}</span><b>${hDec(r.balance)}</b></div>`).join('')}</div></details>` : ''}
    </article>`;
  }
  function editAdjustment() {
    const job = data().job;
    dialog('Auszahlung oder Korrektur', `<label class="ws-field"><span>Art</span><select name="kind"><option value="payout">Überstunden ausgezahlt (wird abgezogen)</option><option value="plus">Korrektur: Stunden dazu</option><option value="minus">Korrektur: Stunden abziehen</option></select></label>${field('Betrag in €', 'amount', '', 'text', 'inputmode="decimal" placeholder="z. B. 450"')}${field('oder Stunden', 'hours', '', 'text', 'inputmode="decimal" placeholder="z. B. 16,25"')}<p class="ws-help">Bei einer Auszahlung reicht der Betrag – die App rechnet ihn mit deinem Stundenlohn (${job.rate ? euro(job.rate) : 'noch nicht festgelegt'}) in Stunden um.</p>${field('Datum', 'date', todayIso(), 'date', 'required')}${field('Notiz (optional)', 'note', '', 'text', 'maxlength="80"')}`,
      f => { const job = data().job; const kind = String(f.get('kind')), amount = Math.abs(num(f.get('amount'))), hoursIn = Math.abs(num(f.get('hours')));
        if (!amount && !hoursIn) return 'Bitte einen Betrag oder Stunden eintragen.'; if (!hoursIn && !num(job.rate) && !job.entries.length) return 'Bitte zuerst den Stundenlohn festlegen oder Stunden eintragen.';
        const bookingRate = rateForMonth(job, String(f.get('date')).slice(0, 7)) || num(job.rate);
        const hours = Math.round((hoursIn ? (kind === 'plus' ? hoursIn : -hoursIn) : (kind === 'plus' ? amount / bookingRate : -amount / bookingRate)) * 100) / 100;
        job.adjustments.push({ id: uid(), date: String(f.get('date')), hours, amount: amount || null, note: String(f.get('note')).trim() || (kind === 'payout' ? `Auszahlung${amount ? ` ${euro(amount)}` : ''}` : 'Korrektur') }); save('Gebucht'); });
  }
  function editLimit() {
    const job = data().job;
    dialog('Monatsgrenze', `${field('Verdienstgrenze in € pro Monat', 'cap', job.monthCap ?? '', 'text', 'inputmode="decimal" placeholder="z. B. 603"')}${field('oder feste Stunden pro Monat', 'limit', job.monthCap ? '' : (job.monthLimit ?? 43), 'text', 'inputmode="decimal"')}<p class="ws-help">Was über der Grenze liegt, wird nicht ausgezahlt und geht aufs Überstundenkonto. Arbeitest du in einem Monat weniger, wird am Monatsende vom Konto aufgefüllt.</p>`,
      f => { const job = data().job; const cap = num(f.get('cap')), limit = num(f.get('limit')); if (cap > 0) { job.monthCap = cap; } else if (limit > 0) { job.monthCap = null; job.monthLimit = limit; } else return 'Bitte eine Grenze eintragen.'; save('Gespeichert'); });
  }
  function jobView() {
    const job = data().job, entries = job.entries.filter(e => e.date?.startsWith(jobMonth)).sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));
    const sum = entries.reduce((s, e) => { const x = shift(e); return { minutes: s.minutes + x.minutes, wage: s.wage + x.wage, tip: s.tip + x.tip, total: s.total + x.total }; }, { minutes: 0, wage: 0, tip: 0, total: 0 });
    const year = jobMonth.slice(0, 4), yearTips = job.entries.filter(e => e.date?.startsWith(year)).reduce((s, e) => s + num(e.tip), 0), allTips = job.entries.reduce((s, e) => s + num(e.tip), 0);
    const monthLabel = new Date(`${jobMonth}-15T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const running = job.running;
    return `
      <article class="card ch-clock ${running ? 'running' : ''}"><div><span class="kicker">${h(job.name || 'Nebenjob')} · Stempeluhr</span>
        ${running ? `<h2>Eingestempelt seit ${h(running.start)} Uhr${running.date && running.date !== todayIso() ? ` (${h(niceDate(running.date, { weekday: 'short', day: 'numeric', month: 'short' }))})` : ''}</h2><p class="ch-elapsed" data-ch-elapsed>${h(hm(minutesBetween(running.start, nowTime())))}</p>${(running.date && running.date < todayIso()) || minutesBetween(running.start, nowTime()) > 720 ? '<p class="clock-warning">Läuft seit über 12 Stunden – vielleicht vergessen auszustempeln? Beim Ausstempeln kannst du die richtige Endzeit eintragen.</p>' : ''}` : `<h2>Nicht eingestempelt</h2><p class="ws-muted">Stundenlohn: ${job.rate ? euro(job.rate) : '<b>noch nicht festgelegt</b>'}</p>`}</div>
        <div class="ch-clock-actions">${running ? '<button class="primary ws-large" data-ch-clock-out>Ausstempeln</button>' : '<button class="primary ws-large" data-ch-clock-in>Einstempeln</button>'}<button class="secondary" data-ch-shift-new>＋ Schicht nachtragen</button><button class="secondary" data-ch-job-settings>Job & Stundenlohn</button></div>
        <button class="ws-text-button" data-scan-here data-scan-folder="Charleen">📄 Lohnabrechnung scannen</button>
      </article>
      ${overtimeView(job)}
      <div class="ch-month-switch"><button class="secondary" data-ch-month="-1" aria-label="Vormonat">‹</button><strong>${h(monthLabel)}</strong><button class="secondary" data-ch-month="1" aria-label="Nächster Monat">›</button></div>
      <div class="ch-stats"><div><small>Arbeitszeit</small><strong>${h(hm(sum.minutes))}</strong></div><div><small>Lohn</small><strong>${euro(sum.wage)}</strong></div><div><small>Trinkgeld</small><strong>${euro(sum.tip)}</strong></div><div class="total"><small>Gesamt</small><strong>${euro(sum.total)}</strong></div></div>
      <p class="ch-tips-note">Trinkgeld ${h(year)}: <b>${euro(yearTips)}</b>${allTips !== yearTips ? ` · insgesamt: <b>${euro(allTips)}</b>` : ''}</p>
      <div class="ch-shifts">${entries.map(e => { const x = shift(e); return `<div class="card ch-shift"><div><strong>${h(niceDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${h(e.start)}–${h(e.end)}</strong><small>${h(hm(x.minutes))}${num(e.pause) ? ` (${num(e.pause)} Min. Pause)` : ''} · ${euro(e.rate)}/h · Lohn ${euro(x.wage)}${x.tip ? ` · Trinkgeld ${euro(x.tip)}` : ''}</small></div><b>${euro(x.total)}</b><button class="ws-van-edit" data-ch-shift-edit="${h(e.id)}" aria-label="Schicht bearbeiten">✎</button></div>`; }).join('') || '<p class="ws-muted">In diesem Monat noch keine Schicht.</p>'}</div>`;
  }
  function jobSettings() {
    const job = data().job;
    dialog('Job & Stundenlohn', `${field('Name des Jobs', 'name', job.name || '', 'text', 'maxlength="80" placeholder="z. B. Café am Markt"')}${field('Stundenlohn in €', 'rate', job.rate ?? '', 'text', 'inputmode="decimal" required placeholder="z. B. 13,50"')}<p class="ws-help">Der Stundenlohn gilt für neue Schichten. Bereits eingetragene Schichten behalten ihren Lohn.</p>`,
      f => { const job = data().job; const rate = num(f.get('rate')); if (rate <= 0) return 'Bitte einen Stundenlohn eintragen.'; Object.assign(job, { name: String(f.get('name')).trim(), rate }); save('Gespeichert'); });
  }
  function editShift(id, preset) {
    const job = data().job, e = job.entries.find(x => x.id === id), v = e || preset || { date: todayIso(), start: '', end: '', pause: 0, tip: '', rate: job.rate };
    dialog(e ? 'Schicht bearbeiten' : preset ? 'Ausstempeln' : 'Schicht nachtragen',
      `${field('Datum', 'date', v.date, 'date', 'required')}<div class="lou-interval">${field('Von', 'start', v.start, 'time', 'required')}${field('Bis', 'end', v.end, 'time', 'required')}</div><div class="lou-interval">${field('Pause (Minuten)', 'pause', v.pause || 0, 'number', 'min="0" max="600"')}${field('Trinkgeld in €', 'tip', v.tip ?? '', 'text', 'inputmode="decimal" placeholder="0"')}</div>${field('Stundenlohn in €', 'rate', v.rate ?? '', 'text', 'inputmode="decimal" required')}`,
      f => {
        const values = { date: String(f.get('date')), start: String(f.get('start')), end: String(f.get('end')), pause: num(f.get('pause')), tip: num(f.get('tip')), rate: num(f.get('rate')) };
        if (!values.date || !values.start || !values.end) return 'Bitte Datum, Beginn und Ende eintragen.';
        if (values.rate <= 0) return 'Bitte einen Stundenlohn eintragen.';
        const job = data().job, e = id ? job.entries.find(x => x.id === id) : null;
        if (e) Object.assign(e, values); else job.entries.push({ id: uid(), ...values });
        if (preset) job.running = null;
        jobMonth = values.date.slice(0, 7); const x = shift(values); save(`${hm(x.minutes)} · ${euro(x.total)} gespeichert`);
      },
      e ? removeButton('Schicht entfernen', 'Diese Schicht entfernen?', () => { const job = data().job; job.entries = job.entries.filter(x => x.id !== id); save('Schicht entfernt'); }) : preset ? { label: 'Einstempeln verwerfen', run: () => { if (!confirm('Einstempeln verwerfen, ohne zu speichern?')) return false; data().job.running = null; save(); } } : null);
  }

  // ---------- Caritas ----------
  function workView() {
    const list = data().work, open = list.filter(t => !t.done).sort((a, b) => String(a.dueOn || '9999').localeCompare(String(b.dueOn || '9999'))), done = list.filter(t => t.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
    const row = t => { const overdue = !t.done && t.dueOn && t.dueOn < todayIso(); return `<label class="check-row shopping-feature ${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''}"><input type="checkbox" data-ch-work-done="${h(t.id)}" ${t.done ? 'checked' : ''}><span class="check-dot"></span><span><strong>${h(t.title)}</strong><small>${t.dueOn ? (overdue ? `überfällig · ${h(niceDate(t.dueOn))}` : h(niceDate(t.dueOn))) : 'ohne Datum'}${t.note ? ` · ${h(t.note)}` : ''}</small></span><button type="button" class="row-edit" data-ch-work-edit="${h(t.id)}" aria-label="Ändern">✎</button><button type="button" class="row-delete" data-ch-work-delete="${h(t.id)}" aria-label="Löschen">×</button></label>`; };
    return `<article class="card ch-work"><span class="kicker">Caritasverband</span><h2>Horizont BeWo</h2>
      <form id="chWorkForm" class="ch-work-form"><input name="title" required maxlength="200" placeholder="Was ist zu tun?" aria-label="To-do"><input name="dueOn" type="date" aria-label="Fällig am"><button class="primary" type="submit">＋ To-do</button></form>
      <div>${open.map(row).join('') || '<p class="ws-muted">Nichts offen.</p>'}</div>
      <button class="ws-text-button" data-scan-here data-scan-folder="Charleen">📄 Unterlagen für Caritas scannen</button>
      ${done.length ? `<details class="ws-history"><summary>Erledigt (${done.length})</summary>${done.map(row).join('')}</details>` : ''}</article>`;
  }
  function editWork(id) {
    const t = data().work.find(x => x.id === id); if (!t) return;
    dialog('To-do ändern', `${field('Was?', 'title', t.title, 'text', 'required maxlength="200"')}${field('Fällig am', 'dueOn', t.dueOn || '', 'date')}${field('Notiz', 'note', t.note || '', 'text', 'maxlength="200"')}`,
      f => { const t = data().work.find(x => x.id === id); if (!t) return 'Dieses To-do wurde inzwischen entfernt.'; const title = String(f.get('title')).trim(); if (!title) return false; Object.assign(t, { title, dueOn: String(f.get('dueOn') || ''), note: String(f.get('note')).trim() }); save('Gespeichert'); });
  }

  // ---------- Sparziele ----------
  function goalStats(g) {
    const saved = (g.deposits || []).reduce((s, d) => s + num(d.amount), 0), target = num(g.target), rest = Math.max(0, target - saved);
    let perMonth = null;
    if (g.deadline && rest > 0) { const months = Math.max(1, Math.ceil(daysUntil(g.deadline) / 30.44)); perMonth = rest / months; }
    return { saved, target, rest, pct: target ? Math.min(100, Math.round(saved / target * 100)) : 0, perMonth };
  }
  function savingsView() {
    const goals = data().savings;
    return `<div class="ws-section-head"><div><span class="kicker">Für dich</span><h2>Sparziele</h2><p>Unabhängig vom gemeinsamen Haushaltsbudget.</p></div><button class="primary" data-ch-goal-new>＋ Sparziel</button></div>
      <div class="ch-goals">${goals.map(g => { const s = goalStats(g); return `<article class="card ch-goal ${s.rest === 0 && s.target ? 'reached' : ''}"><div class="ch-module-head"><div><strong>${h(g.name)}</strong><small>${euro(s.saved)} von ${euro(s.target)}${g.deadline ? ` · bis ${h(niceDate(g.deadline))}` : ''}</small></div><button class="ws-van-edit" data-ch-goal-edit="${h(g.id)}" aria-label="Sparziel bearbeiten">✎</button></div>
        <div class="ch-bar" role="progressbar" aria-valuenow="${s.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${s.pct}%"></i></div>
        <p class="ch-goal-line">${s.rest === 0 && s.target ? '🎉 Ziel erreicht!' : `${s.pct} % · noch ${euro(s.rest)}${s.perMonth ? ` · etwa <b>${euro(s.perMonth)}</b> pro Monat` : ''}`}</p>
        <div class="ch-clock-actions"><button class="secondary" data-ch-deposit="${h(g.id)}">＋ Einzahlen</button><button class="secondary" data-ch-withdraw="${h(g.id)}">− Entnehmen</button></div>
        ${(g.deposits || []).length ? `<details class="ws-history"><summary>Verlauf (${g.deposits.length})</summary>${g.deposits.slice().sort((a, b) => b.date.localeCompare(a.date)).map(d => `<div class="ch-deposit"><span>${h(niceDate(d.date))}${d.note ? ` · ${h(d.note)}` : ''}</span><b class="${num(d.amount) < 0 ? 'neg' : ''}">${num(d.amount) > 0 ? '+' : ''}${euro(d.amount)}</b><button class="row-delete" data-ch-deposit-delete="${h(g.id)}:${h(d.id)}" aria-label="Eintrag löschen">×</button></div>`).join('')}</details>` : ''}
      </article>`; }).join('') || '<div class="ws-empty"><strong>Noch kein Sparziel.</strong><p>Zum Beispiel Urlaub, neues Handy oder Notgroschen – mit Zielbetrag und auf Wunsch einem Datum.</p></div>'}</div>`;
  }
  function editGoal(id) {
    const c = data(), g = c.savings.find(x => x.id === id);
    dialog(g ? 'Sparziel bearbeiten' : 'Neues Sparziel', `${field('Wofür?', 'name', g?.name || '', 'text', 'required maxlength="80" placeholder="z. B. Urlaub"')}${field('Zielbetrag in €', 'target', g?.target ?? '', 'text', 'inputmode="decimal" required')}${field('Bis wann? (optional)', 'deadline', g?.deadline || '', 'date')}${g ? '' : field('Schon gespart in € (optional)', 'start', '', 'text', 'inputmode="decimal" placeholder="0"')}`,
      f => { const c = data(), g = id ? c.savings.find(x => x.id === id) : null; const name = String(f.get('name')).trim(), target = num(f.get('target')); if (!name || target <= 0) return 'Bitte Name und Zielbetrag eintragen.'; if (g) Object.assign(g, { name, target, deadline: String(f.get('deadline') || '') }); else { const start = num(f.get('start')); c.savings.push({ id: uid(), name, target, deadline: String(f.get('deadline') || ''), deposits: start ? [{ id: uid(), date: todayIso(), amount: start, note: 'Startbetrag' }] : [] }); } save('Sparziel gespeichert'); },
      g ? removeButton('Sparziel entfernen', `Sparziel „${g.name}“ mit Verlauf entfernen?`, () => { const c = data(); c.savings = c.savings.filter(x => x.id !== id); save('Sparziel entfernt'); }) : null);
  }
  function deposit(id, sign) {
    const g = data().savings.find(x => x.id === id); if (!g) return;
    dialog(sign > 0 ? `Einzahlen · ${g.name}` : `Entnehmen · ${g.name}`, `${field('Betrag in €', 'amount', '', 'text', 'inputmode="decimal" required autofocus')}${field('Datum', 'date', todayIso(), 'date', 'required')}${field('Notiz (optional)', 'note', '', 'text', 'maxlength="80"')}`,
      f => { const g = data().savings.find(x => x.id === id); if (!g) return 'Dieses Sparziel wurde inzwischen entfernt.'; const amount = Math.abs(num(f.get('amount'))); if (!amount) return 'Bitte einen Betrag eintragen.'; (g.deposits ||= []).push({ id: uid(), date: String(f.get('date')), amount: sign * amount, note: String(f.get('note')).trim() }); save(sign > 0 ? `${euro(amount)} eingezahlt` : `${euro(amount)} entnommen`); });
  }

  // ---------- Seite ----------
  function install() {
    const page = document.querySelector('#study'); if (!page || page.querySelector('.ch-tabs')) return;
    // Reiter direkt unter den Namen (am Handy sonst erst nach dem Scrollen sichtbar).
    const anchor = page.querySelector('.page-title');
    [...page.children].forEach(child => { if (!child.matches('.page-title,.ws-intro,.section-back')) child.dataset.chNotes = '1'; });
    anchor.insertAdjacentHTML('afterend', '<nav class="ws-tabs ch-tabs" aria-label="Charleens Bereiche"><button data-ch-tab="study">🎓 Studium</button><button data-ch-tab="job">⏱ Nebenjob</button><button data-ch-tab="work">🤝 Caritas</button><button data-ch-tab="savings">💶 Sparziele</button><button data-ch-tab="notes">✓ Aufgaben</button></nav><div id="charleenPanel"></div>');
    const intro = page.querySelector('.ws-intro p'); if (intro) intro.textContent = 'Studium, Nebenjob, Caritas und Sparziele – alles an einem Ort. Termine und Dokumente bleiben mit eurem gemeinsamen Zuhause verbunden.';
  }
  // force: auch neu zeichnen, wenn gerade ein Eingabefeld aktiv ist (z. B. direkt nach „＋ To-do“, sonst blieb der neue Eintrag unsichtbar)
  function render(force = false) {
    install();
    const page = document.querySelector('#study'), panel = document.querySelector('#charleenPanel'); if (!page || !panel) return;
    if (force !== true && panel.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) return;
    page.querySelectorAll('[data-ch-tab]').forEach(b => { b.classList.toggle('active', b.dataset.chTab === tab); b.setAttribute('aria-pressed', String(b.dataset.chTab === tab)); });
    page.querySelectorAll('[data-ch-notes]').forEach(el => { el.hidden = tab !== 'notes'; });
    panel.hidden = tab === 'notes';
    panel.innerHTML = tab === 'study' ? studyView() : tab === 'job' ? jobView() : tab === 'work' ? workView() : tab === 'savings' ? savingsView() : '';
    clearInterval(tick); if (tab === 'job' && data().job.running) tick = setInterval(() => { const el = document.querySelector('[data-ch-elapsed]'); if (!el || !data().job.running) { clearInterval(tick); return; } el.textContent = hm(minutesBetween(data().job.running.start, nowTime())); }, 30000);
  }

  // ---------- Kalender, „Demnächst“ ----------
  function syncCalendar() {
    const items = allExams().filter(e => e.date).map(e => ({ id: `exam:${e.id}`, calendarKey: 'person2', title: `📝 ${e.module.name} – ${e.type}${e.status && e.status !== 'open' ? ` (${EXAM_STATUS[e.status]})` : ''}`, allDay: true, startDate: e.date, endDate: e.date, startTime: '', endTime: '', labelColor: 'violet', location: '', url: '', notes: 'Prüfungsleistung aus Charleens Studium', revision: 1, readOnly: true, source: 'studium', recurrence: null, participantKeys: ['person2'], reminderMinutes: [] }));
    window.ZuhauseCalendar?.setExtraEvents?.('exams', items);
  }
  function upcomingEntries(today, limit) {
    const exams = allExams().filter(e => (!e.status || e.status === 'open') && e.date && e.date >= today && e.date <= limit).map(e => ({ date: e.date, title: `📝 ${e.module.name} – ${e.type}`, type: 'Charleen' }));
    const work = data().work.filter(t => !t.done && t.dueOn && t.dueOn <= limit).map(t => ({ date: t.dueOn < today ? today : t.dueOn, title: `🤝 ${t.title}${t.dueOn < today ? ' (überfällig)' : ''}`, type: 'Caritas' }));
    return [...exams, ...work];
  }

  // ---------- Bedienung ----------
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || !b.closest('#study, #charleenDialog')) return; const d = b.dataset;
    if ('chTab' in d) { tab = d.chTab; render(); }
    if ('chModuleNew' in d) editModule();
    if ('chModuleSuggest' in d) editModule(null, d.chModuleSuggest);
    if ('chModuleEdit' in d) editModule(d.chModuleEdit);
    if ('chExamNew' in d) editExam(d.chExamNew);
    if ('chExamEdit' in d) { const [m, e] = d.chExamEdit.split(':'); editExam(m, e); }
    if ('chJobSettings' in d) jobSettings();
    if ('chClockIn' in d) { const job = data().job; if (!job.rate) { jobSettings(); return; } job.running = { start: nowTime(), date: todayIso() }; save(`Eingestempelt um ${job.running.start} Uhr`); }
    if ('chClockOut' in d) { const job = data().job, r = job.running; if (!r) return; editShift(null, { date: r.date, start: r.start, end: nowTime(), pause: 0, tip: '', rate: job.rate }); }
    if ('chShiftNew' in d) editShift();
    if ('chAdjustNew' in d) editAdjustment();
    if ('chLimit' in d) editLimit();
    if ('chAdjustDelete' in d) { event.preventDefault(); const job = data().job; if (confirm('Diese Buchung löschen?')) { job.adjustments = job.adjustments.filter(a => a.id !== d.chAdjustDelete); save('Gelöscht'); } }
    if ('chShiftEdit' in d) editShift(d.chShiftEdit);
    if ('chMonth' in d) { const [y, m] = jobMonth.split('-').map(Number), dt = new Date(y, m - 1 + Number(d.chMonth), 15); jobMonth = iso(dt).slice(0, 7); render(); }
    if ('chWorkEdit' in d) { event.preventDefault(); editWork(d.chWorkEdit); }
    if ('chWorkDelete' in d) { event.preventDefault(); const c = data(), removed = c.work.find(t => t.id === d.chWorkDelete); c.work = c.work.filter(t => t.id !== d.chWorkDelete); save(); toastUndo(`${removed?.title || 'To-do'} gelöscht`, () => { const fresh = data(); if (removed && !fresh.work.some(t => t.id === removed.id)) fresh.work.push(removed); save(); }); }
    if ('chGoalNew' in d) editGoal();
    if ('chGoalEdit' in d) editGoal(d.chGoalEdit);
    if ('chDeposit' in d) deposit(d.chDeposit, 1);
    if ('chWithdraw' in d) deposit(d.chWithdraw, -1);
    if ('chDepositDelete' in d) { const [gid, did] = d.chDepositDelete.split(':'), g = data().savings.find(x => x.id === gid); if (g && confirm('Diesen Eintrag löschen?')) { g.deposits = g.deposits.filter(x => x.id !== did); save('Gelöscht'); } }
  });
  document.addEventListener('change', event => {
    const el = event.target; if (!el.matches('[data-ch-work-done]')) return;
    const t = data().work.find(x => x.id === el.dataset.chWorkDone); if (!t) return;
    t.done = el.checked; t.doneAt = el.checked ? new Date().toISOString() : null; save(el.checked ? 'Erledigt' : 'Wieder offen');
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'chWorkForm') return; event.preventDefault();
    const f = new FormData(event.target), title = String(f.get('title')).trim(); if (!title) return;
    data().work.push({ id: uid(), title, dueOn: String(f.get('dueOn') || ''), note: '', done: false, createdAt: new Date().toISOString() });
    event.target.reset(); persist(); render(true); window.ZuhauseFeatures?.refresh?.(); document.querySelector('#chWorkForm input[name=title]')?.focus(); toast('Hinzugefügt');
  });

  const originalGo = go;
  go = function (target) { originalGo(target); if (target === 'study') render(); };
  const oldRender = renderAll; renderAll = function () { oldRender(); syncCalendar(); if (document.querySelector('#study.active')) render(); };
  install(); render(); syncCalendar();
  window.ZuhauseCharleen = { render, upcomingEntries, shift };
})();
