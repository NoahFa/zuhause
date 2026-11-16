(function () {
  'use strict';

  const CALENDARS = {
    shared: { key: 'shared', name: 'Gemeinsam', color: '#536b57', soft: '#e6ebe0' },
    person1: { key: 'person1', name: 'Person 1', color: '#54778e', soft: '#e1eaf0' },
    person2: { key: 'person2', name: 'Person 2', color: '#a65f52', soft: '#f4e3de' },
  };
  const LABELS = {
    sage: { color: '#536b57', soft: '#e6ebe0' }, blue: { color: '#54778e', soft: '#e1eaf0' },
    coral: { color: '#a65f52', soft: '#f4e3de' }, gold: { color: '#976c2e', soft: '#f5ead6' },
    violet: { color: '#686284', soft: '#e8e5ef' },
  };
  const DAY_MS = 86400000;
  const state = {
    client: null, household: null, user: null, members: [], normalized: false, connected: false,
    calendars: { ...CALENDARS }, events: [], automatic: [], recurrences: new Map(), participants: new Map(), reminders: new Map(), exceptions: new Map(),
    cursor: startOfMonth(new Date()), selectedDate: isoDate(new Date()), view: 'month', filters: new Set(['shared', 'person1', 'person2']), search: '',
    editing: null, realtime: null, refreshTimer: null, touchStartX: 0, callbacks: {}, initialized: false,
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  function isoDate(value) {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function dateFromIso(value) { return new Date(`${value}T12:00:00`); }
  function addDays(value, amount) { const date = value instanceof Date ? new Date(value) : dateFromIso(value); date.setDate(date.getDate() + amount); return date; }
  function startOfMonth(value) { return new Date(value.getFullYear(), value.getMonth(), 1, 12); }
  function startOfWeek(value) { const date = new Date(value); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); date.setHours(12, 0, 0, 0); return date; }
  function daysBetween(a, b) { return Math.round((dateFromIso(b) - dateFromIso(a)) / DAY_MS); }
  function minDate(a, b) { return a < b ? a : b; }
  function maxDate(a, b) { return a > b ? a : b; }
  function safeUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
  function calendarFor(event) { return state.calendars[event.calendarKey] || CALENDARS.shared; }
  function colorsFor(event) { return event.labelColor && LABELS[event.labelColor] ? LABELS[event.labelColor] : calendarFor(event); }
  function displayTime(event) { return event.allDay ? 'Ganztägig' : `${(event.startTime || '00:00').slice(0, 5)} Uhr`; }
  function dateLabel(value, options = { weekday: 'long', day: 'numeric', month: 'long' }) { return new Intl.DateTimeFormat('de-DE', options).format(dateFromIso(value)); }
  function monthLabel(value) { return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(value); }
  function calendarKeyForPerson(person = '') { return person === 'person1' || person === 'person2' ? person : 'shared'; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function errorText(error) { return error?.message || String(error || 'Unbekannter Fehler'); }

  function legacyEvent(item) {
    const date = item.date || isoDate(new Date());
    return {
      id: `legacy:${item.id}`, legacyKey: `manual:${item.id}`, householdId: null, calendarId: null,
      calendarKey: calendarKeyForPerson(item.person), title: item.title || 'Termin', allDay: false,
      startDate: date, endDate: date, startTime: item.time || '09:00', endTime: addMinutes(item.time || '09:00', 60),
      timezone: 'Europe/Berlin', labelColor: 'calendar', location: '', url: '', notes: '', revision: 1,
      readOnly: false, source: 'legacy', recurrence: null, participantKeys: item.person === 'Gemeinsam' ? ['person1', 'person2'] : [calendarKeyForPerson(item.person)], reminderMinutes: [],
    };
  }
  function automaticEvent(item) {
    const key = item.kind === 'football' || item.person === 'person1' ? 'person1' : 'shared';
    return {
      id: `automatic:${item.key}`, calendarKey: key, title: item.title || 'Termin', allDay: false,
      startDate: item.date, endDate: item.date, startTime: item.time || '06:00', endTime: addMinutes(item.time || '06:00', 60),
      labelColor: item.kind === 'waste' ? 'sage' : item.kind === 'football' ? 'blue' : 'calendar',
      location: '', url: item.url || '', notes: item.note || '', revision: 1, readOnly: true,
      source: item.source || item.kind || 'Automatisch', status: item.status || 'scheduled', recurrence: null,
      participantKeys: key === 'shared' ? ['person1', 'person2'] : [key], reminderMinutes: [],
    };
  }
  function addMinutes(value, amount) {
    const [hour, minute] = String(value).split(':').map(Number);
    const total = (hour * 60 + minute + amount + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function normalizeRow(row) {
    const calendar = Object.values(state.calendars).find(item => item.id === row.calendar_id);
    return {
      id: row.id, householdId: row.household_id, calendarId: row.calendar_id,
      calendarKey: calendar?.key || row.calendar_key || 'shared', title: row.title,
      allDay: !!row.all_day, startDate: row.start_date, endDate: row.end_date || row.start_date,
      startTime: row.start_time ? String(row.start_time).slice(0, 5) : '', endTime: row.end_time ? String(row.end_time).slice(0, 5) : '',
      timezone: row.timezone || 'Europe/Berlin', labelColor: row.label_color || 'calendar',
      location: row.location || '', url: row.url || '', notes: row.notes || '', revision: Number(row.revision || 1),
      readOnly: false, source: 'cloud', createdBy: row.created_by, updatedBy: row.updated_by,
      recurrence: state.recurrences.get(row.id) || null, participantKeys: state.participants.get(row.id) || [],
      reminderMinutes: state.reminders.get(row.id) || [],
    };
  }

  function recurrenceMatches(event, candidate) {
    const recurrence = event.recurrence;
    if (!recurrence || recurrence.frequency === 'none') return candidate === event.startDate;
    if (candidate < event.startDate || (recurrence.endsOn && candidate > recurrence.endsOn)) return false;
    const delta = daysBetween(event.startDate, candidate);
    const interval = Math.max(1, Number(recurrence.interval || 1));
    if (recurrence.frequency === 'daily') return delta % interval === 0;
    if (recurrence.frequency === 'weekly') {
      const startWeek = startOfWeek(dateFromIso(event.startDate));
      const candidateWeek = startOfWeek(dateFromIso(candidate));
      const weekDelta = Math.round((candidateWeek - startWeek) / (7 * DAY_MS));
      const weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [dateFromIso(event.startDate).getDay() || 7];
      return weekDelta >= 0 && weekDelta % interval === 0 && weekdays.includes(dateFromIso(candidate).getDay() || 7);
    }
    if (recurrence.frequency === 'monthly') {
      const start = dateFromIso(event.startDate), current = dateFromIso(candidate);
      const monthDelta = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
      return monthDelta >= 0 && monthDelta % interval === 0 && current.getDate() === (recurrence.monthDay || start.getDate());
    }
    if (recurrence.frequency === 'yearly') {
      const start = dateFromIso(event.startDate), current = dateFromIso(candidate);
      return (current.getFullYear() - start.getFullYear()) % interval === 0 && current.getMonth() === start.getMonth() && current.getDate() === start.getDate();
    }
    return false;
  }

  function occurrencesInRange(rangeStart, rangeEnd) {
    const output = [];
    const allEvents = [...state.events, ...state.automatic];
    for (const event of allEvents) {
      const first = maxDate(rangeStart, event.startDate);
      const last = minDate(rangeEnd, event.recurrence?.endsOn || rangeEnd);
      for (let cursor = dateFromIso(first), guard = 0; isoDate(cursor) <= last && guard < 800; cursor = addDays(cursor, 1), guard += 1) {
        const occurrenceDate = isoDate(cursor);
        if (!recurrenceMatches(event, occurrenceDate)) continue;
        const exception = state.exceptions.get(`${event.id}:${occurrenceDate}`);
        if (exception?.action === 'skip') continue;
        const shown = exception?.replacement || event;
        const duration = Math.max(0, daysBetween(event.startDate, event.endDate));
        output.push({ ...shown, occurrenceDate, occurrenceEndDate: isoDate(addDays(occurrenceDate, duration)), seriesId: event.recurrence ? event.id : null });
      }
    }
    return output.filter(matchesFilters).sort(sortOccurrences);
  }
  function sortOccurrences(a, b) { return `${a.occurrenceDate}${a.allDay ? '00:00' : a.startTime}`.localeCompare(`${b.occurrenceDate}${b.allDay ? '00:00' : b.startTime}`) || a.title.localeCompare(b.title, 'de'); }
  function matchesFilters(event) {
    if (!state.filters.has(event.calendarKey)) return false;
    if (!state.search) return true;
    const haystack = `${event.title} ${event.location || ''} ${event.notes || ''}`.toLocaleLowerCase('de');
    return haystack.includes(state.search.toLocaleLowerCase('de'));
  }

  function render() {
    if (!qs('#calendarGrid')) return;
    updateControls();
    if (state.view === 'month') renderMonth();
    if (state.view === 'week') renderWeek();
    if (state.view === 'agenda') renderAgenda();
    renderDayPanel();
    renderHomeTimeline();
  }
  function updateControls() {
    const label = qs('#calendarMonthLabel');
    if (label) label.textContent = state.view === 'week'
      ? `${dateLabel(isoDate(startOfWeek(dateFromIso(state.selectedDate))), { day: 'numeric', month: 'short' })} – ${dateLabel(isoDate(addDays(startOfWeek(dateFromIso(state.selectedDate)), 6)), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : monthLabel(state.cursor);
    qsa('[data-calendar-view]').forEach(button => {
      const active = button.dataset.calendarView === state.view;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    qsa('[data-calendar-filter]').forEach(button => {
      const key = button.dataset.calendarFilter;
      const active = key === 'all' ? state.filters.size === 3 : state.filters.has(key);
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    const note = qs('#calendarSyncNote');
    if (note) note.textContent = state.normalized ? (navigator.onLine ? 'Auf beiden Geräten aktuell' : 'Offline · wird später synchronisiert') : 'Lokale Vorschau · Datenbank-Upgrade ausstehend';
  }
  function renderMonth() {
    const grid = qs('#calendarGrid'); grid.replaceChildren(); grid.className = 'calendar-grid calendar-month-grid';
    ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((name, index) => grid.append(el('div', `cal-label ${index > 4 ? 'weekend' : ''}`, name)));
    const first = startOfMonth(state.cursor), offset = (first.getDay() + 6) % 7, start = addDays(first, -offset), end = addDays(start, 41);
    const occurrences = occurrencesInRange(isoDate(start), isoDate(end));
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index), dateIso = isoDate(date), dayEvents = occurrences.filter(item => item.occurrenceDate === dateIso);
      const button = el('button', 'cal-day'); button.type = 'button'; button.dataset.calendarDay = dateIso;
      if (date.getMonth() !== state.cursor.getMonth()) button.classList.add('outside');
      if (dateIso === isoDate(new Date())) button.classList.add('today');
      if (dateIso === state.selectedDate) button.classList.add('selected');
      if (date.getDay() === 0 || date.getDay() === 6) button.classList.add('weekend');
      const number = el('strong', 'cal-day-number', date.getDate()); button.append(number);
      dayEvents.slice(0, 3).forEach(event => button.append(eventChip(event)));
      if (dayEvents.length > 3) button.append(el('span', 'event-more', `+ ${dayEvents.length - 3} weitere`));
      button.addEventListener('click', () => selectDay(dateIso, true)); grid.append(button);
    }
  }
  function renderWeek() {
    const grid = qs('#calendarGrid'); grid.replaceChildren(); grid.className = 'calendar-grid calendar-week-grid';
    const weekStart = startOfWeek(dateFromIso(state.selectedDate));
    const occurrences = occurrencesInRange(isoDate(weekStart), isoDate(addDays(weekStart, 6)));
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(weekStart, index), dateIso = isoDate(date);
      const column = el('section', 'calendar-week-day');
      const header = el('button', 'calendar-week-day-head'); header.type = 'button';
      header.append(el('span', '', dateLabel(dateIso, { weekday: 'short' })), el('strong', dateIso === isoDate(new Date()) ? 'today-number' : '', date.getDate()));
      header.addEventListener('click', () => selectDay(dateIso, true)); column.append(header);
      const dayEvents = occurrences.filter(item => item.occurrenceDate === dateIso);
      if (!dayEvents.length) column.append(el('p', 'calendar-empty-day', 'Keine Termine'));
      dayEvents.forEach(event => column.append(weekEventCard(event))); grid.append(column);
    }
  }
  function renderAgenda() {
    const grid = qs('#calendarGrid'); grid.replaceChildren(); grid.className = 'calendar-agenda';
    const start = state.selectedDate, end = isoDate(addDays(start, 120)), occurrences = occurrencesInRange(start, end);
    if (!occurrences.length) { grid.append(emptyState('Keine passenden Termine gefunden.')); return; }
    const groups = new Map(); occurrences.forEach(item => { if (!groups.has(item.occurrenceDate)) groups.set(item.occurrenceDate, []); groups.get(item.occurrenceDate).push(item); });
    groups.forEach((items, date) => {
      const section = el('section', 'agenda-day'); const heading = el('button', 'agenda-day-heading'); heading.type = 'button';
      heading.append(el('b', '', dateFromIso(date).getDate()), el('span', '', dateLabel(date))); heading.addEventListener('click', () => selectDay(date, true)); section.append(heading);
      items.forEach(item => section.append(agendaEventRow(item))); grid.append(section);
    });
  }
  function eventChip(event) {
    const chip = el('span', `event event-${event.calendarKey}${event.allDay ? ' all-day' : ' timed'}${event.status === 'cancelled' ? ' cancelled' : ''}`);
    const colors = colorsFor(event); chip.style.setProperty('--event-color', colors.color); chip.style.setProperty('--event-soft', colors.soft);
    chip.textContent = event.allDay ? event.title : `${event.startTime} ${event.title}`; return chip;
  }
  function weekEventCard(event) {
    const button = el('button', `week-event event-${event.calendarKey}`); button.type = 'button'; const colors = colorsFor(event);
    button.style.setProperty('--event-color', colors.color); button.style.setProperty('--event-soft', colors.soft);
    button.append(el('small', '', displayTime(event)), el('strong', '', event.title));
    button.addEventListener('click', () => openEdit(event.id, event.occurrenceDate)); return button;
  }
  function agendaEventRow(event) {
    const button = el('button', 'agenda-event-row'); button.type = 'button'; const colors = colorsFor(event);
    const marker = el('i', 'agenda-event-color'); marker.style.background = colors.color;
    const body = el('span'); body.append(el('strong', '', event.title), el('small', '', `${displayTime(event)} · ${calendarFor(event).name}${event.location ? ` · ${event.location}` : ''}`));
    button.append(marker, body, el('em', '', '›')); button.addEventListener('click', () => openEdit(event.id, event.occurrenceDate)); return button;
  }
  function emptyState(text) { const wrapper = el('div', 'calendar-empty'); wrapper.append(el('span', '', '▦'), el('p', '', text)); return wrapper; }

  function selectDay(date, openPanel) {
    state.selectedDate = date; state.cursor = startOfMonth(dateFromIso(date)); render();
    if (openPanel) qs('#calendarDayPanel')?.classList.add('open');
  }
  function renderDayPanel() {
    const title = qs('#selectedDayTitle'), kicker = qs('#selectedDayKicker'), list = qs('#calendarDayList'); if (!title || !list) return;
    title.textContent = dateLabel(state.selectedDate); kicker.textContent = state.selectedDate === isoDate(new Date()) ? 'Heute' : 'Ausgewählter Tag'; list.replaceChildren();
    const events = occurrencesInRange(state.selectedDate, state.selectedDate);
    if (!events.length) list.append(emptyState('Noch kein Termin eingetragen.'));
    events.forEach(event => list.append(agendaEventRow(event)));
  }
  function renderHomeTimeline() {
    const timeline = qs('#todayTimeline'); if (!timeline) return; timeline.replaceChildren();
    const events = occurrencesInRange(isoDate(new Date()), isoDate(new Date()));
    if (!events.length) { timeline.append(el('p', '', 'Heute steht noch nichts im Kalender.')); return; }
    events.slice(0, 6).forEach(event => {
      const button = el('button', 'timeline-item'); button.type = 'button';
      button.append(el('time', '', event.allDay ? 'Ganztägig' : event.startTime), el('span', 'timeline-line'));
      const body = el('span'); body.append(el('strong', '', event.title), el('small', '', calendarFor(event).name)); button.append(body);
      button.addEventListener('click', () => { state.callbacks.go?.('calendar'); selectDay(event.occurrenceDate, true); }); timeline.append(button);
    });
  }

  function navigate(direction) {
    if (state.view === 'week') {
      state.selectedDate = isoDate(addDays(state.selectedDate, direction * 7)); state.cursor = startOfMonth(dateFromIso(state.selectedDate));
    } else {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + direction, 1, 12); state.selectedDate = isoDate(state.cursor);
    }
    render();
  }
  function toggleFilter(key) {
    if (key === 'all') state.filters = state.filters.size === 3 ? new Set() : new Set(['shared', 'person1', 'person2']);
    else if (state.filters.has(key)) state.filters.delete(key); else state.filters.add(key);
    render();
  }

  function openCreate(date = state.selectedDate) {
    state.editing = null; const dialog = qs('#calendarEventDialog'), form = qs('#calendarEventForm'); if (!dialog || !form) return;
    form.reset(); form.elements.startDate.value = date; form.elements.endDate.value = date; form.elements.startTime.value = '09:00'; form.elements.endTime.value = '10:00'; form.elements.calendarKey.value = 'shared';
    qsa('[name="participant"]', form).forEach(input => { input.checked = true; });
    qs('#calendarEventDialogTitle').textContent = 'Termin eintragen'; qs('#calendarEventDialogKicker').textContent = 'Kalender'; qs('#calendarDeleteButton').hidden = true; qs('#calendarCopyButton').hidden = true; qs('#calendarFormMessage').textContent = '';
    updateFormVisibility(); dialog.showModal(); form.elements.title.focus();
  }
  function openEdit(eventId, occurrenceDate) {
    const event = [...state.events, ...state.automatic].find(item => item.id === eventId); if (!event) return;
    if (event.readOnly) { showAutomaticDetail(event, occurrenceDate); return; }
    state.editing = { event, occurrenceDate: occurrenceDate || event.startDate }; const form = qs('#calendarEventForm'); form.reset();
    form.elements.title.value = event.title; form.elements.calendarKey.value = event.calendarKey; form.elements.labelColor.value = event.labelColor || 'calendar'; form.elements.allDay.checked = event.allDay;
    const offset = daysBetween(event.startDate, state.editing.occurrenceDate);
    form.elements.startDate.value = state.editing.occurrenceDate; form.elements.endDate.value = isoDate(addDays(event.endDate, offset)); form.elements.startTime.value = event.startTime || '09:00'; form.elements.endTime.value = event.endTime || '10:00';
    form.elements.recurrence.value = event.recurrence?.frequency || 'none'; form.elements.recurrenceEnd.value = event.recurrence?.endsOn || '';
    form.elements.location.value = event.location || ''; form.elements.url.value = event.url || ''; form.elements.notes.value = event.notes || '';
    qsa('[name="participant"]', form).forEach(input => { input.checked = event.participantKeys.includes(input.value); });
    qsa('[name="reminder"]', form).forEach(input => { input.checked = event.reminderMinutes.includes(Number(input.value)); });
    qs('#calendarEventDialogTitle').textContent = 'Termin bearbeiten'; qs('#calendarEventDialogKicker').textContent = calendarFor(event).name; qs('#calendarDeleteButton').hidden = false; qs('#calendarCopyButton').hidden = false; qs('#calendarFormMessage').textContent = '';
    updateFormVisibility(); qs('#calendarEventDialog').showModal();
  }
  function showAutomaticDetail(event, occurrenceDate) {
    const body = el('div', 'calendar-readonly-detail'); body.append(el('p', '', `${displayTime(event)} · ${dateLabel(occurrenceDate)}`), el('p', '', `Kalender: ${calendarFor(event).name}`));
    if (event.notes) body.append(el('p', '', event.notes)); if (event.url && safeUrl(event.url)) { const link = el('a', '', 'Offizielle Seite öffnen →'); link.href = safeUrl(event.url); link.target = '_blank'; link.rel = 'noopener'; body.append(link); }
    state.callbacks.detail?.(event.title, body);
  }
  function updateFormVisibility() {
    const form = qs('#calendarEventForm'), allDay = form.elements.allDay.checked, recurring = form.elements.recurrence.value !== 'none';
    qsa('.calendar-time-field', form).forEach(field => { field.hidden = allDay; field.querySelector('input').disabled = allDay; });
    qs('.calendar-recurrence-end', form).hidden = !recurring;
  }
  function formPayload() {
    const form = qs('#calendarEventForm'), data = new FormData(form), allDay = form.elements.allDay.checked;
    const startDate = data.get('startDate'), endDate = data.get('endDate');
    if (endDate < startDate) throw new Error('Das Ende darf nicht vor dem Beginn liegen.');
    if (!allDay && startDate === endDate && data.get('endTime') <= data.get('startTime')) throw new Error('Die Endzeit muss nach der Startzeit liegen.');
    const participants = data.getAll('participant'), reminders = data.getAll('reminder').map(Number).sort((a, b) => a - b);
    return {
      id: state.editing?.event.id || uuid(), householdId: state.household?.id || null, calendarKey: data.get('calendarKey'), title: String(data.get('title') || '').trim(), allDay,
      startDate, endDate, startTime: allDay ? '' : data.get('startTime'), endTime: allDay ? '' : data.get('endTime'), timezone: 'Europe/Berlin', labelColor: data.get('labelColor'),
      location: String(data.get('location') || '').trim(), url: safeUrl(String(data.get('url') || '').trim()), notes: String(data.get('notes') || '').trim(), revision: state.editing?.event.revision || 0,
      participantKeys: participants, reminderMinutes: reminders,
      recurrence: data.get('recurrence') === 'none' ? null : { frequency: data.get('recurrence'), interval: 1, weekdays: data.get('recurrence') === 'weekly' ? [dateFromIso(startDate).getDay() || 7] : [], monthDay: data.get('recurrence') === 'monthly' ? dateFromIso(startDate).getDate() : null, endsOn: data.get('recurrenceEnd') || null },
    };
  }

  async function saveFromForm(event) {
    event.preventDefault(); const message = qs('#calendarFormMessage'); message.textContent = '';
    try {
      const payload = formPayload(); if (!payload.title) throw new Error('Bitte gib dem Termin einen Titel.');
      let scope = 'all'; if (state.editing?.event.recurrence) scope = await chooseSeriesScope(); if (scope === 'cancel') return;
      await saveEvent(payload, scope, state.editing?.occurrenceDate); qs('#calendarEventDialog').close(); state.callbacks.toast?.('Termin gespeichert');
      if (payload.reminderMinutes.length) state.callbacks.remindersSelected?.();
    } catch (error) { message.textContent = errorText(error); }
  }
  async function saveEvent(payload, scope = 'all', occurrenceDate = null) {
    const existing = state.editing?.event;
    if (!existing) {
      const optimistic = { ...payload, source: 'local', readOnly: false, revision: 1 }; state.events.push(optimistic); render();
      await commitOrQueue({ id: uuid(), type: 'create', event: optimistic }); return;
    }
    if (scope === 'single' && existing.recurrence) {
      const replacement = { ...payload, id: uuid(), recurrence: null, source: 'local', readOnly: false, revision: 1 };
      state.exceptions.set(`${existing.id}:${occurrenceDate}`, { action: 'replace', replacement }); render();
      await commitOrQueue({ id: uuid(), type: 'replaceOccurrence', eventId: existing.id, occurrenceDate, replacement }); return;
    }
    if (scope === 'future' && existing.recurrence) {
      const originalEnd = existing.recurrence.endsOn; existing.recurrence = { ...existing.recurrence, endsOn: isoDate(addDays(occurrenceDate, -1)) };
      const next = { ...payload, id: uuid(), startDate: occurrenceDate, source: 'local', readOnly: false, revision: 1, recurrence: { ...(payload.recurrence || existing.recurrence), endsOn: payload.recurrence?.endsOn || originalEnd } };
      state.events.push(next); render(); await commitOrQueue({ id: uuid(), type: 'splitSeries', eventId: existing.id, occurrenceDate, event: next }); return;
    }
    Object.assign(existing, payload, { revision: existing.revision + 1 }); render();
    await commitOrQueue({ id: uuid(), type: 'update', event: existing, expectedRevision: payload.revision });
  }
  async function deleteCurrent() {
    const existing = state.editing?.event; if (!existing) return;
    if (!confirm(`„${existing.title}“ wirklich löschen?`)) return;
    let scope = existing.recurrence ? await chooseSeriesScope() : 'all'; if (scope === 'cancel') return;
    if (scope === 'single') state.exceptions.set(`${existing.id}:${state.editing.occurrenceDate}`, { action: 'skip' });
    else if (scope === 'future') existing.recurrence = { ...existing.recurrence, endsOn: isoDate(addDays(state.editing.occurrenceDate, -1)) };
    else state.events = state.events.filter(item => item.id !== existing.id);
    render(); qs('#calendarEventDialog').close(); await commitOrQueue({ id: uuid(), type: 'delete', eventId: existing.id, occurrenceDate: state.editing.occurrenceDate, scope }); state.callbacks.toast?.('Termin gelöscht');
  }
  async function copyCurrent() {
    if (!state.editing) return; const copy = { ...state.editing.event, id: uuid(), title: `Kopie von ${state.editing.event.title}`, recurrence: null, revision: 1, source: 'local' };
    state.events.push(copy); render(); qs('#calendarEventDialog').close(); await commitOrQueue({ id: uuid(), type: 'create', event: copy }); state.callbacks.toast?.('Termin kopiert');
  }
  function chooseSeriesScope() {
    const dialog = qs('#calendarSeriesDialog'); dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue || 'cancel'), { once: true }));
  }

  function eventRow(event) {
    const calendar = state.calendars[event.calendarKey];
    return {
      id: event.id, household_id: state.household.id, calendar_id: calendar.id, title: event.title, all_day: event.allDay,
      start_date: event.startDate, end_date: event.endDate, start_time: event.allDay ? null : event.startTime, end_time: event.allDay ? null : event.endTime,
      timezone: 'Europe/Berlin', label_color: event.labelColor || 'calendar', location: event.location || null, url: event.url || null, notes: event.notes || null,
      created_by: event.createdBy || state.user.id, updated_by: state.user.id, revision: event.revision || 1,
    };
  }
  async function commitOrQueue(mutation) {
    if (!state.normalized || !navigator.onLine) { await enqueue(mutation); updateControls(); return; }
    try { await applyMutation(mutation); }
    catch (error) {
      await enqueue(mutation); qs('#calendarSyncNote').textContent = /Konflikt/i.test(errorText(error)) ? 'Konflikt erkannt · bitte Kalender neu laden' : 'Wird erneut synchronisiert';
      if (/Konflikt/i.test(errorText(error))) throw error;
    }
  }
  async function applyMutation(mutation) {
    const cloud = state.client;
    if (mutation.type === 'create') {
      const row = eventRow(mutation.event); const { error } = await cloud.from('calendar_events').upsert(row, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error;
      await replaceRelations(mutation.event); return;
    }
    if (mutation.type === 'update') {
      const row = eventRow(mutation.event); const expected = Number(mutation.expectedRevision || 1); row.revision = expected + 1;
      const { data, error } = await cloud.from('calendar_events').update(row).eq('id', mutation.event.id).eq('revision', expected).select('id,revision');
      if (error) throw error;
      if (!data?.length) {
        const { data: current, error: currentError } = await cloud.from('calendar_events').select('*').eq('id', mutation.event.id).maybeSingle(); if (currentError) throw currentError;
        const desired = eventRow(mutation.event);
        const comparable = (key, value) => ['start_time','end_time'].includes(key) ? String(value ?? '').slice(0, 5) : String(value ?? '');
        const alreadyApplied = current && Number(current.revision) === expected + 1 && ['title','all_day','start_date','end_date','start_time','end_time','label_color','location','url','notes'].every(key => comparable(key, current[key]) === comparable(key, desired[key]));
        if (!alreadyApplied) throw new Error('Konflikt: Der Termin wurde inzwischen auf einem anderen Gerät geändert.');
        await replaceRelations(mutation.event); return;
      }
      mutation.event.revision = data[0].revision; await replaceRelations(mutation.event); return;
    }
    if (mutation.type === 'replaceOccurrence') {
      const { error: replacementError } = await cloud.from('calendar_events').upsert(eventRow(mutation.replacement), { onConflict: 'id', ignoreDuplicates: true }); if (replacementError) throw replacementError;
      await replaceRelations(mutation.replacement);
      const { error } = await cloud.from('event_exceptions').upsert({ household_id: state.household.id, series_event_id: mutation.eventId, occurrence_date: mutation.occurrenceDate, action: 'replace', replacement_event_id: mutation.replacement.id, created_by: state.user.id }, { onConflict: 'series_event_id,occurrence_date' }); if (error) throw error; return;
    }
    if (mutation.type === 'splitSeries') {
      const { error: endError } = await cloud.from('event_recurrences').update({ ends_on: isoDate(addDays(mutation.occurrenceDate, -1)) }).eq('event_id', mutation.eventId); if (endError) throw endError;
      const { error } = await cloud.from('calendar_events').upsert(eventRow(mutation.event), { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; await replaceRelations(mutation.event); return;
    }
    if (mutation.type === 'delete') {
      if (mutation.scope === 'single') {
        const { error } = await cloud.from('event_exceptions').upsert({ household_id: state.household.id, series_event_id: mutation.eventId, occurrence_date: mutation.occurrenceDate, action: 'skip', created_by: state.user.id }, { onConflict: 'series_event_id,occurrence_date' }); if (error) throw error;
      } else if (mutation.scope === 'future') {
        const { error } = await cloud.from('event_recurrences').update({ ends_on: isoDate(addDays(mutation.occurrenceDate, -1)) }).eq('event_id', mutation.eventId); if (error) throw error;
      } else { const { error } = await cloud.from('calendar_events').delete().eq('id', mutation.eventId); if (error) throw error; }
    }
  }
  async function replaceRelations(event) {
    const cloud = state.client, calendarId = state.calendars[event.calendarKey]?.id;
    const { error: recurrenceDeleteError } = await cloud.from('event_recurrences').delete().eq('event_id', event.id); if (recurrenceDeleteError) throw recurrenceDeleteError;
    if (event.recurrence) {
      const r = event.recurrence; const { error } = await cloud.from('event_recurrences').insert({ event_id: event.id, household_id: state.household.id, frequency: r.frequency, interval_count: r.interval || 1, weekdays: r.weekdays || [], month_day: r.monthDay || null, ends_on: r.endsOn || null, rrule: recurrenceRRule(event) }); if (error) throw error;
    }
    const { error: participantDeleteError } = await cloud.from('event_participants').delete().eq('event_id', event.id); if (participantDeleteError) throw participantDeleteError;
    const participantRows = event.participantKeys.map(key => { const member = memberForKey(key); return member ? { event_id: event.id, household_id: state.household.id, user_id: member.user_id } : null; }).filter(Boolean);
    if (participantRows.length) { const { error } = await cloud.from('event_participants').insert(participantRows); if (error) throw error; }
    const { error: reminderDeleteError } = await cloud.from('event_reminders').delete().eq('event_id', event.id).eq('user_id', state.user.id); if (reminderDeleteError) throw reminderDeleteError;
    if (event.reminderMinutes.length) { const { error } = await cloud.from('event_reminders').insert(event.reminderMinutes.map(minutes => ({ event_id: event.id, household_id: state.household.id, user_id: state.user.id, minutes_before: minutes }))); if (error) throw error; }
    event.calendarId = calendarId;
  }
  function recurrenceRRule(event) {
    const r = event.recurrence; if (!r) return null; const parts = [`FREQ=${r.frequency.toUpperCase()}`, `INTERVAL=${r.interval || 1}`];
    if (r.frequency === 'weekly' && r.weekdays?.length) parts.push(`BYDAY=${r.weekdays.map(day => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day - 1]).join(',')}`);
    if (r.frequency === 'monthly' && r.monthDay) parts.push(`BYMONTHDAY=${r.monthDay}`); if (r.endsOn) parts.push(`UNTIL=${r.endsOn.replaceAll('-', '')}T235959Z`); return parts.join(';');
  }
  function memberKey(member) { if (!member) return ''; const owner = state.members.find(item => item.role === 'owner'); return member.user_id === owner?.user_id ? 'person1' : 'person2'; }
  function memberForKey(key) { return state.members.find(member => memberKey(member) === key) || null; }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('zuhause-calendar-v1', 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' }); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  async function enqueue(mutation) {
    const db = await openDb(); await new Promise((resolve, reject) => { const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put(mutation); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
  }
  async function queuedMutations() {
    const db = await openDb(); const items = await new Promise((resolve, reject) => { const req = db.transaction('queue').objectStore('queue').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); db.close(); return items;
  }
  async function removeQueued(id) {
    const db = await openDb(); await new Promise((resolve, reject) => { const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
  }
  async function flushQueue() {
    if (!state.normalized || !navigator.onLine) return; const items = await queuedMutations();
    for (const mutation of items) { try { await applyMutation(mutation); await removeQueued(mutation.id); } catch (error) { qs('#calendarSyncNote').textContent = `Synchronisierung wartet: ${errorText(error)}`; return; } }
    if (items.length) await loadCloudData(); updateControls();
  }

  async function ensureCalendars() {
    const rows = Object.values(CALENDARS).map((item, index) => ({ household_id: state.household.id, calendar_key: item.key, name: item.name, color: item.color, sort_order: index }));
    const { error } = await state.client.from('calendars').upsert(rows, { onConflict: 'household_id,calendar_key', ignoreDuplicates: true }); if (error) throw error;
  }
  async function loadCloudData() {
    if (!state.client || !state.household) return;
    const householdId = state.household.id;
    const [calendarResult, recurrenceResult, participantResult, reminderResult, exceptionResult] = await Promise.all([
      state.client.from('calendars').select('id,calendar_key,name,color,sort_order').eq('household_id', householdId).order('sort_order'),
      state.client.from('event_recurrences').select('*').eq('household_id', householdId),
      state.client.from('event_participants').select('event_id,user_id').eq('household_id', householdId),
      state.client.from('event_reminders').select('event_id,minutes_before').eq('household_id', householdId).eq('user_id', state.user.id),
      state.client.from('event_exceptions').select('*').eq('household_id', householdId),
    ]);
    if (calendarResult.error) throw calendarResult.error;
    Object.values(CALENDARS).forEach(item => { state.calendars[item.key] = { ...item }; });
    calendarResult.data.forEach(row => { state.calendars[row.calendar_key] = { key: row.calendar_key, id: row.id, name: row.name, color: row.color, soft: CALENDARS[row.calendar_key]?.soft || '#ecece7' }; });
    state.recurrences.clear(); (recurrenceResult.data || []).forEach(row => state.recurrences.set(row.event_id, { frequency: row.frequency, interval: row.interval_count, weekdays: row.weekdays || [], monthDay: row.month_day, endsOn: row.ends_on, rrule: row.rrule }));
    state.participants.clear(); (participantResult.data || []).forEach(row => { if (!state.participants.has(row.event_id)) state.participants.set(row.event_id, []); const member = state.members.find(item => item.user_id === row.user_id), key = memberKey(member); if (key) state.participants.get(row.event_id).push(key); });
    state.reminders.clear(); (reminderResult.data || []).forEach(row => { if (!state.reminders.has(row.event_id)) state.reminders.set(row.event_id, []); state.reminders.get(row.event_id).push(Number(row.minutes_before)); });
    state.exceptions.clear(); (exceptionResult.data || []).forEach(row => state.exceptions.set(`${row.series_event_id}:${row.occurrence_date}`, { action: row.action, replacementId: row.replacement_event_id }));
    const { data, error } = await state.client.from('calendar_events').select('*').eq('household_id', householdId).order('start_date'); if (error) throw error;
    const loadedEvents = (data || []).map(normalizeRow), replacementIds = new Set([...state.exceptions.values()].map(value => value.replacementId).filter(Boolean));
    for (const value of state.exceptions.values()) if (value.replacementId) value.replacement = loadedEvents.find(item => item.id === value.replacementId);
    state.events = loadedEvents.filter(item => !replacementIds.has(item.id));
    state.normalized = true; state.connected = true; render();
  }
  function isMissingSchema(error) { const text = errorText(error); return /calendar_events|calendars|PGRST205|42P01|schema cache/i.test(text); }
  async function connect(options) {
    state.client = options.cloud; state.household = options.household; state.user = options.user; state.members = options.members || []; state.callbacks = { ...state.callbacks, ...options.callbacks };
    const owner = state.members.find(member => member.role === 'owner'), second = state.members.find(member => member.user_id !== owner?.user_id);
    CALENDARS.person1.name = owner?.display_name?.trim() || 'Person 1'; CALENDARS.person2.name = second?.display_name?.trim() || 'Person 2';
    if (options.legacyAppointments) state.events = options.legacyAppointments.map(legacyEvent);
    setAutomaticEvents(options.automaticEvents || state.automatic);
    try { await ensureCalendars(); await loadCloudData(); subscribeRealtime(); await flushQueue(); }
    catch (error) {
      state.normalized = false; state.connected = true;
      if (!isMissingSchema(error)) state.callbacks.toast?.(`Kalender konnte nicht verbunden werden: ${errorText(error)}`);
      render();
    }
  }
  function subscribeRealtime() {
    if (!state.client || !state.household || state.realtime) return;
    const refresh = () => { clearTimeout(state.refreshTimer); state.refreshTimer = setTimeout(() => loadCloudData().catch(() => {}), 250); };
    state.realtime = state.client.channel(`calendar:${state.household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `household_id=eq.${state.household.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_recurrences', filter: `household_id=eq.${state.household.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_exceptions', filter: `household_id=eq.${state.household.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants', filter: `household_id=eq.${state.household.id}` }, refresh)
      .subscribe();
  }
  function disconnect() {
    if (state.realtime && state.client) state.client.removeChannel(state.realtime); state.realtime = null; state.client = null; state.household = null; state.user = null; state.normalized = false;
  }
  function selectDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
    selectDay(date, false);
  }
  function setAutomaticEvents(items) { state.automatic = (items || []).map(item => item.id?.startsWith?.('automatic:') ? item : automaticEvent(item)); render(); }
  function setLegacyAppointments(items) { if (!state.normalized) { state.events = (items || []).map(legacyEvent); render(); } }
  function bootstrap(options = {}) {
    state.callbacks = { ...state.callbacks, ...options.callbacks };
    state.events = (options.legacyAppointments || []).map(legacyEvent); setAutomaticEvents(options.automaticEvents || []);
    if (!state.initialized) bindUi(); state.initialized = true; render();
  }
  function bindUi() {
    qs('#previousPeriod')?.addEventListener('click', () => navigate(-1)); qs('#nextPeriod')?.addEventListener('click', () => navigate(1));
    qs('#currentPeriod')?.addEventListener('click', () => { state.selectedDate = isoDate(new Date()); state.cursor = startOfMonth(new Date()); render(); });
    qsa('[data-calendar-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.calendarView; render(); }));
    qsa('[data-calendar-filter]').forEach(button => button.addEventListener('click', () => toggleFilter(button.dataset.calendarFilter)));
    qsa('[data-calendar-add]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openCreate(state.selectedDate); }));
    qs('#calendarSearch')?.addEventListener('input', event => { state.search = event.target.value.trim(); render(); });
    qs('#calendarPanelClose')?.addEventListener('click', () => qs('#calendarDayPanel').classList.remove('open'));
    qsa('[data-calendar-cancel]').forEach(button => button.addEventListener('click', () => qs('#calendarEventDialog').close()));
    qs('#calendarEventForm')?.addEventListener('submit', saveFromForm); qs('#calendarDeleteButton')?.addEventListener('click', deleteCurrent); qs('#calendarCopyButton')?.addEventListener('click', copyCurrent);
    qs('#calendarEventForm [name="allDay"]')?.addEventListener('change', updateFormVisibility); qs('#calendarEventForm [name="recurrence"]')?.addEventListener('change', updateFormVisibility);
    qs('#calendarEventForm [name="calendarKey"]')?.addEventListener('change', event => { const key = event.target.value; qsa('[name="participant"]', qs('#calendarEventForm')).forEach(input => { input.checked = key === 'shared' || input.value === key; }); });
    const grid = qs('#calendarGrid'); grid?.addEventListener('pointerdown', event => { state.touchStartX = event.clientX; }); grid?.addEventListener('pointerup', event => { const delta = event.clientX - state.touchStartX; if (Math.abs(delta) > 55) navigate(delta > 0 ? -1 : 1); });
    window.addEventListener('online', flushQueue); document.addEventListener('keydown', event => { if (!qs('#calendar')?.classList.contains('active') || event.target.matches('input,textarea,select')) return; if (event.key === 'ArrowLeft') navigate(-1); if (event.key === 'ArrowRight') navigate(1); });
  }

  window.ZuhauseCalendar = { bootstrap, connect, disconnect, render, setAutomaticEvents, setLegacyAppointments, openCreate, selectDate, renderHomeTimeline, occurrencesInRange };
})();
