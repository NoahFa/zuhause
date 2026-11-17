(function () {
  'use strict';

  const CALENDARS = {
    // Kräftige, klar unterscheidbare Personenfarben (Wunsch Noah, 16.11.2026): Gemeinsam grün, Noah blau, Charleen beere.
    shared: { key: 'shared', name: 'Gemeinsam', color: '#2e7d4f', soft: '#dff0e5' },
    person1: { key: 'person1', name: 'Noah', color: '#1f6fc5', soft: '#dceafb' },
    person2: { key: 'person2', name: 'Charleen', color: '#cc3d6a', soft: '#fbe1ea' },
  };
  const LABELS = {
    sage: { color: '#536b57', soft: '#e6ebe0' }, blue: { color: '#54778e', soft: '#e1eaf0' },
    coral: { color: '#a65f52', soft: '#f4e3de' }, gold: { color: '#976c2e', soft: '#f5ead6' },
    violet: { color: '#686284', soft: '#e8e5ef' },
  };
  const DAY_MS = 86400000;
  const state = {
    client: null, household: null, user: null, members: [], normalized: false, connected: false,
    calendars: { ...CALENDARS }, events: [], automatic: [], montage: [], extra: {}, recurrences: new Map(), participants: new Map(), reminders: new Map(), exceptions: new Map(),
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
  // Die Person bestimmt immer die Farbe; eine Farbmarkierung erscheint nur noch als kleiner Punkt.
  function colorsFor(event) { const calendar = CALENDARS[event.calendarKey] || CALENDARS.shared; return { ...calendar, label: event.labelColor && LABELS[event.labelColor] ? LABELS[event.labelColor].color : '' }; }
  function displayTime(event) { const base = event.allDay ? 'Ganztägig' : `${(event.startTime || '00:00').slice(0, 5)} Uhr`; return event.spanLength > 1 ? `${event.spanDay === 1 ? base : 'Fortsetzung'} · Tag ${event.spanDay} von ${event.spanLength}` : base; }
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
    const key = item.kind === 'football' || item.person === 'person1' ? 'person1' : item.kind === 'study' || item.person === 'person2' ? 'person2' : 'shared';
    return {
      id: `automatic:${item.key}`, calendarKey: key, title: item.title || 'Termin', allDay: false,
      startDate: item.date, endDate: item.date, startTime: item.time || '06:00', endTime: item.endTime || addMinutes(item.time || '06:00', 60),
      labelColor: item.kind === 'waste' ? 'sage' : item.kind === 'football' ? 'blue' : item.kind === 'study' ? 'violet' : 'calendar',
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
      reminderMinutes: state.reminders.get(row.id) || [], legacyKey: row.legacy_key || null,
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
      const wanted = recurrence.monthDay || start.getDate(), lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      return monthDelta >= 0 && monthDelta % interval === 0 && current.getDate() === Math.min(wanted, lastDay);
    }
    if (recurrence.frequency === 'yearly') {
      const start = dateFromIso(event.startDate), current = dateFromIso(candidate);
      if ((current.getFullYear() - start.getFullYear()) % interval !== 0 || current.getMonth() !== start.getMonth()) return false;
      const leapFallback = start.getMonth() === 1 && start.getDate() === 29 && new Date(current.getFullYear(), 1, 29).getMonth() !== 1;
      return current.getDate() === (leapFallback ? 28 : start.getDate());
    }
    return false;
  }

  function occurrencesInRange(rangeStart, rangeEnd) {
    const output = [];
    const allEvents = [...state.events, ...state.automatic, ...state.montage, ...Object.values(state.extra).flat()];
    for (const event of allEvents) {
      // Mehrtägige Termine: auch Vorkommen berücksichtigen, die vor dem Zeitraum beginnen und in ihn hineinreichen.
      const duration = Math.max(0, daysBetween(event.startDate, event.endDate || event.startDate));
      const first = maxDate(isoDate(addDays(rangeStart, -duration)), event.startDate);
      const last = minDate(rangeEnd, event.recurrence?.endsOn || rangeEnd);
      for (let cursor = dateFromIso(first), guard = 0; isoDate(cursor) <= last && guard < 800; cursor = addDays(cursor, 1), guard += 1) {
        const occurrenceDate = isoDate(cursor);
        if (!recurrenceMatches(event, occurrenceDate)) continue;
        const exception = state.exceptions.get(`${event.id}:${occurrenceDate}`);
        if (exception?.action === 'skip') continue;
        const shown = exception?.replacement || event;
        // Jeder Tag eines mehrtägigen Termins erscheint (dayDate = angezeigter Tag); occurrenceDate bleibt der Beginn (fürs Bearbeiten).
        for (let day = 0; day <= duration; day += 1) {
          const dayDate = isoDate(addDays(occurrenceDate, day)); if (dayDate < rangeStart || dayDate > rangeEnd) continue;
          output.push({ ...shown, title: birthdayTitle(shown, occurrenceDate), occurrenceDate, dayDate, spanDay: day + 1, spanLength: duration + 1, occurrenceEndDate: isoDate(addDays(occurrenceDate, duration)), seriesId: event.recurrence ? event.id : null });
        }
      }
    }
    return output.filter(matchesFilters).sort(sortOccurrences);
  }
  const BIRTHDAY = '🎂';
  function isBirthday(event) { return String(event?.title || '').startsWith(BIRTHDAY) && event?.recurrence?.frequency === 'yearly'; }
  function birthdayTitle(event, occurrenceDate) {
    if (!isBirthday(event)) return event.title;
    const age = Number(occurrenceDate.slice(0, 4)) - Number(event.startDate.slice(0, 4));
    return age >= 1 ? `${event.title} wird ${age}` : event.title;
  }
  function sortOccurrences(a, b) { return `${a.dayDate || a.occurrenceDate}${a.allDay || a.spanDay > 1 ? '00:00' : a.startTime}`.localeCompare(`${b.dayDate || b.occurrenceDate}${b.allDay || b.spanDay > 1 ? '00:00' : b.startTime}`) || a.title.localeCompare(b.title, 'de'); }
  function matchesFilters(event) {
    if (!state.filters.has(event.calendarKey)) return false;
    if (!state.search) return true;
    const haystack = `${event.title} ${event.location || ''} ${event.notes || ''}`.toLocaleLowerCase('de');
    return haystack.includes(state.search.toLocaleLowerCase('de'));
  }

  function render() {
    if (!qs('#calendarGrid')) return;
    updateControls();
    if (state.search) renderSearch();
    else if (state.view === 'month') renderMonth();
    else if (state.view === 'week') renderWeek();
    else if (state.view === 'agenda') renderAgenda();
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
      const date = addDays(start, index), dateIso = isoDate(date), dayEvents = occurrences.filter(item => (item.dayDate || item.occurrenceDate) === dateIso);
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
      const dayEvents = occurrences.filter(item => (item.dayDate || item.occurrenceDate) === dateIso);
      if (!dayEvents.length) column.append(el('p', 'calendar-empty-day', 'Keine Termine'));
      dayEvents.forEach(event => column.append(weekEventCard(event))); grid.append(column);
    }
  }
  function renderAgenda() {
    const grid = qs('#calendarGrid'); grid.replaceChildren(); grid.className = 'calendar-agenda';
    const start = state.selectedDate, end = isoDate(addDays(start, 120)), occurrences = occurrencesInRange(start, end);
    if (!occurrences.length) { grid.append(emptyState('Keine passenden Termine gefunden.')); return; }
    const groups = new Map(); occurrences.forEach(item => { const day = item.dayDate || item.occurrenceDate; if (!groups.has(day)) groups.set(day, []); groups.get(day).push(item); });
    groups.forEach((items, date) => {
      const section = el('section', 'agenda-day'); const heading = el('button', 'agenda-day-heading'); heading.type = 'button';
      heading.append(el('b', '', dateFromIso(date).getDate()), el('span', '', dateLabel(date))); heading.addEventListener('click', () => selectDay(date, true)); section.append(heading);
      items.forEach(item => section.append(agendaEventRow(item))); grid.append(section);
    });
  }
  function eventChip(event) {
    const chip = el('span', `event event-${event.calendarKey}${event.allDay ? ' all-day' : ' timed'}${event.status === 'cancelled' ? ' cancelled' : ''}`);
    const colors = colorsFor(event); chip.style.setProperty('--event-color', colors.color); chip.style.setProperty('--event-soft', colors.soft); if (colors.label) { chip.classList.add('has-label'); chip.style.setProperty('--label-color', colors.label); }
    if (!event.allDay && !(event.spanDay > 1)) chip.append(el('span', 'event-time', `${event.startTime} `)); chip.append(document.createTextNode(event.title)); chip.title = event.allDay ? event.title : `${event.startTime} ${event.title}`; return chip;
  }
  function weekEventCard(event) {
    const button = el('button', `week-event event-${event.calendarKey}`); button.type = 'button'; const colors = colorsFor(event);
    button.style.setProperty('--event-color', colors.color); button.style.setProperty('--event-soft', colors.soft);
    button.append(el('small', '', displayTime(event)), el('strong', '', event.title));
    button.addEventListener('click', () => openEdit(event.id, event.occurrenceDate)); return button;
  }
  // Suche über alle Monate (ein Jahr zurück, gut ein Jahr voraus) statt nur im angezeigten Monat.
  function renderSearch() {
    const grid = qs('#calendarGrid'); grid.replaceChildren(); grid.className = 'calendar-agenda calendar-search-results';
    const today = isoDate(new Date()), occurrences = occurrencesInRange(isoDate(addDays(today, -366)), isoDate(addDays(today, 400))).filter(item => (item.spanDay || 1) === 1);
    const upcoming = occurrences.filter(item => item.occurrenceDate >= today), past = occurrences.filter(item => item.occurrenceDate < today).reverse();
    const head = el('p', 'calendar-search-head', occurrences.length ? `${occurrences.length} ${occurrences.length === 1 ? 'Treffer' : 'Treffer'} für „${state.search}“` : `Keine Termine mit „${state.search}“ gefunden.`); grid.append(head);
    const section = (title, items) => { if (!items.length) return; const box = el('section', 'agenda-day'); box.append(el('h3', 'calendar-search-group', title)); items.slice(0, 40).forEach(item => { const row = agendaEventRow(item); row.querySelector('small').textContent = `${dateLabel(item.occurrenceDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${row.querySelector('small').textContent}`; box.append(row); }); grid.append(box); };
    section('Kommende', upcoming); section('Vergangene', past);
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
    const today = isoDate(new Date()), tomorrow = isoDate(addDays(today, 1));
    const item = event => {
      const button = el('button', 'timeline-item'); button.type = 'button';
      button.append(el('time', '', event.allDay || event.spanDay > 1 ? 'Ganztägig' : event.startTime), el('span', 'timeline-line'));
      const body = el('span'); body.append(el('strong', '', event.title), el('small', '', event.spanLength > 1 ? `${calendarFor(event).name} · Tag ${event.spanDay} von ${event.spanLength}` : calendarFor(event).name)); button.append(body);
      button.addEventListener('click', () => { state.callbacks.go?.('calendar'); selectDay(event.dayDate || event.occurrenceDate, true); }); return button;
    };
    const events = occurrencesInRange(today, today), next = occurrencesInRange(tomorrow, tomorrow);
    if (!events.length) timeline.append(el('p', '', 'Heute steht nichts im Kalender.'));
    events.slice(0, 6).forEach(event => timeline.append(item(event)));
    // Ein Blick auf morgen (Wunsch aus der Bedienbarkeits-Prüfung).
    if (next.length) { timeline.append(el('p', 'timeline-heading', 'Morgen')); next.slice(0, 4).forEach(event => timeline.append(item(event))); }
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
    form.querySelector('.calendar-more')?.removeAttribute('open');
    updateFormVisibility(); dialog.showModal(); form.elements.title.focus();
  }
  function openEdit(eventId, occurrenceDate) {
    const event = [...state.events, ...state.automatic, ...state.montage, ...Object.values(state.extra).flat()].find(item => item.id === eventId); if (!event) return;
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
    form.querySelector('.calendar-more')?.toggleAttribute('open', !!(event.location || event.url || event.notes || event.reminderMinutes?.length || (event.labelColor && event.labelColor !== 'calendar')));
    updateFormVisibility(); qs('#calendarEventDialog').showModal();
  }
  function showAutomaticDetail(event, occurrenceDate) {
    const body = el('div', 'calendar-readonly-detail'); body.append(el('p', '', `${displayTime(event)} · ${dateLabel(occurrenceDate)}`), el('p', '', `Kalender: ${calendarFor(event).name}`));
    if (event.location) { const route = el('a', '', `📍 ${event.location} – Route öffnen →`); route.href = `https://maps.apple.com/?daddr=${encodeURIComponent(event.location)}`; route.target = '_blank'; route.rel = 'noopener'; body.append(route); }
    if (event.jobId) { const open = el('button', 'primary', 'Auftrag öffnen'); open.type = 'button'; open.addEventListener('click', () => { qs('#detailDialog')?.close(); window.ZuhauseWorkspaces?.openJob?.(event.jobId); }); body.append(open); }
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
    calendarResult.data.forEach(row => { state.calendars[row.calendar_key] = { key: row.calendar_key, id: row.id, name: row.name, color: CALENDARS[row.calendar_key]?.color || row.color, soft: CALENDARS[row.calendar_key]?.soft || '#ecece7' }; });
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
    CALENDARS.person1.name = owner?.display_name?.trim() || 'Noah'; CALENDARS.person2.name = second?.display_name?.trim() || 'Charleen';
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
  let lastRefresh = 0;
  async function refresh(force = false) {
    if (!state.normalized || !state.client || !state.household || !navigator.onLine) return;
    if (!force && Date.now() - lastRefresh < 45000) return;
    lastRefresh = Date.now();
    if (state.realtime && state.realtime.state !== 'joined') { try { state.client.removeChannel(state.realtime); } catch {} state.realtime = null; }
    subscribeRealtime();
    try { await flushQueue(); await loadCloudData(); } catch {}
  }
  function disconnect() {
    if (state.realtime && state.client) state.client.removeChannel(state.realtime); state.realtime = null; state.client = null; state.household = null; state.user = null; state.normalized = false;
  }
  function selectDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
    selectDay(date, false);
  }
  function setAutomaticEvents(items) { state.automatic = (items || []).map(item => item.id?.startsWith?.('automatic:') ? item : automaticEvent(item)); render(); }
  // Montageaufträge aus Noahs Bereich erscheinen als ganztägige Einträge in Noahs Kalender (nur lesen; bearbeitet wird im Auftrag).
  function setMontageJobs(jobs) {
    const status = { draft: 'In Vorbereitung', ready: 'Vorbereitet', done: 'Abgeschlossen' };
    state.montage = (jobs || []).filter(job => /^\d{4}-\d{2}-\d{2}$/.test(job.date || '')).map(job => ({
      id: `montage:${job.id}`, jobId: job.id, calendarKey: 'person1', title: `${job.status === 'done' ? '✓' : '🔧'} ${job.title}`, allDay: true,
      startDate: job.date, endDate: job.date, startTime: '', endTime: '', labelColor: 'gold', location: job.address || '', url: '',
      notes: `Montageauftrag · ${status[job.status] || 'In Vorbereitung'}`, revision: 1, readOnly: true, source: 'montage', recurrence: null, participantKeys: ['person1'], reminderMinutes: [],
    }));
    if (state.initialized) render();
  }
  // Weitere nur lesbare Einträge aus anderen Bereichen, z. B. Charleens Prüfungsleistungen.
  function setExtraEvents(group, items) { state.extra[group] = items || []; if (state.initialized) render(); }
  function setLegacyAppointments(items) { if (!state.normalized) { state.events = (items || []).map(legacyEvent); render(); } }
  // ---- Kalenderdatei (.ics) importieren, z. B. aus TimeTree ----
  function icsLines(text) { return String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n'); }
  function icsText(value = '') { return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim(); }
  function icsParse(text) {
    const events = []; let current = null, depth = 0;
    for (const line of icsLines(text)) {
      if (line === 'BEGIN:VEVENT') { current = { props: {} }; depth = 0; continue; }
      if (!current) continue;
      if (line === 'END:VEVENT') { events.push(current); current = null; continue; }
      if (line.startsWith('BEGIN:')) { depth += 1; continue; }
      if (line.startsWith('END:')) { depth = Math.max(0, depth - 1); continue; }
      if (depth) continue;
      const index = line.indexOf(':'); if (index < 1) continue;
      const [name, ...paramParts] = line.slice(0, index).split(';'); const params = {};
      paramParts.forEach(part => { const [key, ...rest] = part.split('='); params[key.toUpperCase()] = rest.join('=').replace(/^"|"$/g, ''); });
      (current.props[name.toUpperCase()] ||= []).push({ value: line.slice(index + 1), params });
    }
    return events;
  }
  function zoneOffset(timeZone, utcMs) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs)).map(part => [part.type, part.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - utcMs;
  }
  function wallParts(ms) { const iso = new Date(ms).toISOString(); return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; }
  function icsDate(prop) {
    if (!prop) return null;
    const match = prop.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!match) return null;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (prop.params.VALUE === 'DATE' || !match[4]) return { allDay: true, date };
    const wall = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] || 0));
    let utc = null;
    if (match[7]) utc = wall;
    else if (prop.params.TZID) { try { let guess = wall - zoneOffset(prop.params.TZID, wall); guess = wall - zoneOffset(prop.params.TZID, guess); utc = guess; } catch { utc = null; } }
    if (utc === null) return { allDay: false, ...wallParts(wall), wall };
    const berlin = utc + zoneOffset('Europe/Berlin', utc); return { allDay: false, ...wallParts(berlin), wall: berlin };
  }
  function icsDurationMinutes(value) {
    const match = String(value || '').match(/^[+]?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/); if (!match) return null;
    return (+(match[1] || 0)) * 10080 + (+(match[2] || 0)) * 1440 + (+(match[3] || 0)) * 60 + (+(match[4] || 0));
  }
  function icsTimes(entry) {
    const first = key => entry.props[key]?.[0]; const start = icsDate(first('DTSTART')); if (!start) return null;
    let end = icsDate(first('DTEND'));
    if (start.allDay) { let endDate = end ? isoDate(addDays(end.date, -1)) : start.date; if (endDate < start.date) endDate = start.date; return { allDay: true, startDate: start.date, endDate, startTime: '', endTime: '' }; }
    if (!end || end.allDay) { const minutes = icsDurationMinutes(first('DURATION')?.value) ?? 60; end = { ...wallParts(start.wall + minutes * 60000) }; }
    if (`${end.date}T${end.time}` < `${start.date}T${start.time}`) end = { date: start.date, time: start.time };
    return { allDay: false, startDate: start.date, endDate: end.date, startTime: start.time, endTime: end.time };
  }
  function icsRecurrence(rule, startDate) {
    if (!rule) return { recurrence: null, simplified: false };
    const r = Object.fromEntries(rule.split(';').map(part => part.split('=')).map(([key, value]) => [String(key).toUpperCase(), String(value || '').toUpperCase()]));
    const frequency = (r.FREQ || '').toLowerCase(); if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) return { recurrence: null, simplified: true };
    if (r.BYSETPOS || r.BYWEEKNO || r.BYYEARDAY || r.BYHOUR || (r.BYMONTH && frequency !== 'yearly')) return { recurrence: null, simplified: true };
    const codes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; let weekdays = [], monthDay = null;
    if (r.BYDAY) { const days = r.BYDAY.split(','); if (frequency !== 'weekly' || !days.every(day => codes.includes(day))) return { recurrence: null, simplified: true }; weekdays = days.map(day => codes.indexOf(day) + 1); }
    if (frequency === 'weekly' && !weekdays.length) weekdays = [dateFromIso(startDate).getDay() || 7];
    if (frequency === 'monthly') { if (r.BYMONTHDAY && !/^\d+$/.test(r.BYMONTHDAY)) return { recurrence: null, simplified: true }; monthDay = r.BYMONTHDAY ? +r.BYMONTHDAY : dateFromIso(startDate).getDate(); }
    const recurrence = { frequency, interval: Math.min(999, Math.max(1, parseInt(r.INTERVAL || '1', 10) || 1)), weekdays, monthDay, endsOn: r.UNTIL ? icsDate({ value: r.UNTIL, params: {} })?.date || null : null };
    if (r.COUNT) { const count = parseInt(r.COUNT, 10) || 1; let seen = 0, day = startDate; for (let i = 0; i < 40000 && seen < count; i += 1) { if (recurrenceMatches({ startDate, recurrence }, day) && ++seen === count) recurrence.endsOn = day; day = isoDate(addDays(day, 1)); } }
    return { recurrence, simplified: false };
  }
  async function importIcs(text, { calendarKey = 'shared', includePast = false, onProgress = () => {} } = {}) {
    if (!state.normalized || !state.client || !state.household || !navigator.onLine) throw new Error('Für den Import braucht der Kalender eine Internetverbindung. Bitte später erneut versuchen.');
    const calendar = state.calendars[calendarKey]; if (!calendar?.id) throw new Error('Dieser Kalender ist noch nicht eingerichtet.');
    const entries = icsParse(text); if (!entries.length) throw new Error('In dieser Datei wurden keine Termine gefunden.');
    const today = isoDate(new Date()), summary = { added: 0, duplicate: 0, past: 0, simplified: 0, invalid: 0 };
    const known = new Map(); state.events.forEach(event => { if (event.legacyKey) known.set(event.legacyKey, event.id); });
    for (const value of state.exceptions.values()) if (value.replacement?.legacyKey) known.set(value.replacement.legacyKey, value.replacement.id);
    const participantIds = state.members.filter(member => calendarKey === 'shared' || memberKey(member) === calendarKey).map(member => member.user_id);
    const rows = [], recurrences = [], participants = [], exceptions = new Map(), seriesByUid = new Map();
    const text1 = (entry, key) => icsText(entry.props[key]?.[0]?.value || '');
    const addRow = (entry, times, key, recurrence) => {
      const id = uuid(); const url = safeUrl(text1(entry, 'URL'));
      rows.push({ id, household_id: state.household.id, calendar_id: calendar.id, title: (text1(entry, 'SUMMARY') || 'Termin').slice(0, 160), all_day: times.allDay, start_date: times.startDate, end_date: times.endDate, start_time: times.allDay ? null : times.startTime, end_time: times.allDay ? null : times.endTime, timezone: 'Europe/Berlin', label_color: 'calendar', location: text1(entry, 'LOCATION').slice(0, 240) || null, url: url && url.length <= 500 ? url : null, notes: text1(entry, 'DESCRIPTION').slice(0, 4000) || null, created_by: state.user.id, updated_by: state.user.id, revision: 1, legacy_key: key });
      participantIds.forEach(userId => participants.push({ event_id: id, household_id: state.household.id, user_id: userId }));
      if (recurrence) recurrences.push({ event_id: id, household_id: state.household.id, frequency: recurrence.frequency, interval_count: recurrence.interval, weekdays: recurrence.weekdays, month_day: recurrence.monthDay, ends_on: recurrence.endsOn, rrule: recurrenceRRule({ recurrence }) });
      known.set(key, id); summary.added += 1; return id;
    };
    const keyFor = (entry, suffix = '') => { const uid = text1(entry, 'UID'); return `ics:${uid || `${text1(entry, 'SUMMARY')}|${entry.props.DTSTART?.[0]?.value || ''}`}${suffix}`; };
    const cancelled = entry => text1(entry, 'STATUS').toUpperCase() === 'CANCELLED';
    const masters = entries.filter(entry => !entry.props['RECURRENCE-ID']), overrides = entries.filter(entry => entry.props['RECURRENCE-ID']);
    masters.forEach((entry, index) => {
      if (index % 50 === 0) onProgress(`Termine werden gelesen … ${index} von ${masters.length}`);
      if (cancelled(entry)) return;
      const times = icsTimes(entry); if (!times) { summary.invalid += 1; return; }
      const key = keyFor(entry), uid = text1(entry, 'UID');
      if (known.has(key)) { summary.duplicate += 1; if (uid) seriesByUid.set(uid, { id: known.get(key), existing: true }); return; }
      const { recurrence, simplified } = icsRecurrence(entry.props.RRULE?.[0]?.value, times.startDate); if (simplified) summary.simplified += 1;
      const lastDay = recurrence ? (recurrence.endsOn || '9999-12-31') : times.endDate;
      if (!includePast && lastDay < today) { summary.past += 1; return; }
      const id = addRow(entry, times, key, recurrence);
      if (uid && recurrence) seriesByUid.set(uid, { id, existing: false });
      if (recurrence) (entry.props.EXDATE || []).forEach(prop => prop.value.split(',').forEach(value => { const day = icsDate({ value, params: prop.params })?.date; if (day) exceptions.set(`${id}:${day}`, { household_id: state.household.id, series_event_id: id, occurrence_date: day, action: 'skip', replacement_event_id: null, created_by: state.user.id }); }));
    });
    overrides.forEach(entry => {
      const series = seriesByUid.get(text1(entry, 'UID')), day = icsDate(entry.props['RECURRENCE-ID'][0])?.date; if (!day) return;
      if (series?.existing) { summary.duplicate += 1; return; }
      if (series && cancelled(entry)) { exceptions.set(`${series.id}:${day}`, { household_id: state.household.id, series_event_id: series.id, occurrence_date: day, action: 'skip', replacement_event_id: null, created_by: state.user.id }); return; }
      if (cancelled(entry)) return;
      const times = icsTimes(entry); if (!times) { summary.invalid += 1; return; }
      const key = keyFor(entry, `@${day}`); if (known.has(key)) { summary.duplicate += 1; return; }
      if (!includePast && times.endDate < today && !series) { summary.past += 1; return; }
      const id = addRow(entry, times, key, null);
      if (series) exceptions.set(`${series.id}:${day}`, { household_id: state.household.id, series_event_id: series.id, occurrence_date: day, action: 'replace', replacement_event_id: id, created_by: state.user.id });
    });
    const inserted = [];
    const chunks = (list, size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
    try {
      for (const chunk of chunks(rows)) { onProgress(`Termine werden gespeichert … ${inserted.length} von ${rows.length}`); const { error } = await state.client.from('calendar_events').insert(chunk); if (error) throw error; inserted.push(...chunk.map(row => row.id)); }
      for (const chunk of chunks(recurrences)) { const { error } = await state.client.from('event_recurrences').insert(chunk); if (error) throw error; }
      for (const chunk of chunks(participants, 500)) { const { error } = await state.client.from('event_participants').insert(chunk); if (error) throw error; }
      for (const chunk of chunks([...exceptions.values()])) { const { error } = await state.client.from('event_exceptions').insert(chunk); if (error) throw error; }
    } catch (error) {
      for (const chunk of chunks(inserted)) await state.client.from('calendar_events').delete().in('id', chunk);
      throw new Error(`Der Import wurde abgebrochen und nichts übernommen (${errorText(error)}). Bitte erneut versuchen.`);
    }
    onProgress('Kalender wird aktualisiert …'); await loadCloudData(); return summary;
  }

  function openBirthday() {
    let dialog = qs('#calendarBirthdayDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'calendarBirthdayDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
    const options = ['shared', 'person1', 'person2'].map(key => `<option value="${key}">${escapeHtml(state.calendars[key]?.name || CALENDARS[key].name)}</option>`).join('');
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Kalender</span><h2>Geburtstag eintragen</h2></div><button class="close" type="button" data-birthday-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields"><p class="ws-help">Der Geburtstag erscheint jedes Jahr automatisch im Kalender.</p><label class="ws-field"><span>Wer hat Geburtstag?</span><input name="name" required maxlength="120" placeholder="z. B. Oma Hilde" autocomplete="off"></label><label class="ws-field"><span>Geburtsdatum</span><input name="date" type="date" required></label><label class="ws-check"><input type="checkbox" name="yearKnown" checked> <span>Das Jahr stimmt – Alter anzeigen</span></label><label class="ws-field"><span>In welchen Kalender?</span><select name="calendarKey">${options}</select></label><fieldset class="ws-check-group"><legend>Meine Erinnerung (um 9 Uhr)</legend><label class="ws-check"><input type="checkbox" name="reminder" value="0"> <span>Am Geburtstag</span></label><label class="ws-check"><input type="checkbox" name="reminder" value="1440" checked> <span>Einen Tag vorher</span></label><label class="ws-check"><input type="checkbox" name="reminder" value="10080"> <span>Eine Woche vorher</span></label></fieldset><p class="auth-message" data-birthday-message aria-live="polite"></p></div><div class="dialog-actions"><button class="secondary" type="button" data-birthday-close>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    const form = qs('form', dialog), message = qs('[data-birthday-message]', dialog);
    qsa('[data-birthday-close]', dialog).forEach(button => { button.onclick = () => dialog.close(); });
    form.onsubmit = async event => {
      event.preventDefault(); message.textContent = '';
      const name = form.elements.name.value.trim().replace(/^🎂\s*/, ''), date = form.elements.date.value, calendarKey = form.elements.calendarKey.value;
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { message.textContent = 'Bitte Name und Datum eintragen.'; return; }
      const thisYear = new Date().getFullYear();
      if (form.elements.yearKnown.checked && Number(date.slice(0, 4)) > thisYear) { message.textContent = 'Das Geburtsjahr liegt in der Zukunft.'; return; }
      let startDate = form.elements.yearKnown.checked ? date : `${thisYear}${date.slice(4)}`;
      if (startDate.endsWith('-02-29') && !form.elements.yearKnown.checked && new Date(thisYear, 1, 29).getMonth() !== 1) startDate = `2024-02-29`;
      const reminders = [...form.querySelectorAll('[name="reminder"]:checked')].map(input => Number(input.value));
      const payload = { id: uuid(), householdId: state.household?.id || null, calendarKey, title: `${BIRTHDAY} ${name}`.slice(0, 160), allDay: true, startDate, endDate: startDate, startTime: '', endTime: '', timezone: 'Europe/Berlin', labelColor: 'gold', location: '', url: '', notes: '', revision: 0, participantKeys: calendarKey === 'shared' ? ['person1', 'person2'] : [calendarKey], reminderMinutes: reminders, recurrence: { frequency: 'yearly', interval: 1, weekdays: [], monthDay: null, endsOn: null } };
      try { state.editing = null; await saveEvent(payload); dialog.close(); state.callbacks.toast?.('Geburtstag gespeichert'); if (reminders.length) state.callbacks.remindersSelected?.(); }
      catch (error) { message.textContent = errorText(error); }
    };
    dialog.showModal(); form.elements.name.focus();
  }
  function openImport() {
    let dialog = qs('#calendarImportDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'calendarImportDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
    const options = ['shared', 'person1', 'person2'].map(key => `<option value="${key}">${escapeHtml(state.calendars[key]?.name || CALENDARS[key].name)}</option>`).join('');
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Kalender</span><h2>Termine importieren</h2></div><button class="close" type="button" data-import-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields"><p class="ws-help">Wähle eine Kalenderdatei (.ics) aus, zum Beispiel den Export aus TimeTree. Termine, die schon übernommen wurden, werden übersprungen.</p><label class="ws-field"><span>Kalenderdatei</span><input name="file" type="file" accept=".ics,text/calendar" required></label><label class="ws-field"><span>In welchen Kalender?</span><select name="calendarKey">${options}</select></label><label class="ws-check"><input type="checkbox" name="includePast"> <span>Auch vergangene Termine übernehmen</span></label><p class="auth-message" data-import-message aria-live="polite"></p></div><div class="dialog-actions"><button class="secondary" type="button" data-import-close>Abbrechen</button><button class="primary" type="submit">Importieren</button></div></form>`;
    const form = qs('form', dialog), message = qs('[data-import-message]', dialog), submit = qs('button[type="submit"]', dialog);
    qsa('[data-import-close]', dialog).forEach(button => { button.onclick = () => dialog.close(); });
    form.onsubmit = async event => {
      event.preventDefault(); const file = form.elements.file.files[0]; if (!file) return;
      submit.disabled = true; message.textContent = 'Datei wird gelesen …';
      try {
        const result = await importIcs(await file.text(), { calendarKey: form.elements.calendarKey.value, includePast: form.elements.includePast.checked, onProgress: text => { message.textContent = text; } });
        const parts = [`${result.added} Termine übernommen`]; if (result.duplicate) parts.push(`${result.duplicate} waren schon da`); if (result.past) parts.push(`${result.past} vergangene übersprungen`);
        if (result.simplified) parts.push(`${result.simplified} mit besonderer Wiederholung nur als einzelner Termin`); if (result.invalid) parts.push(`${result.invalid} nicht lesbar`);
        message.textContent = parts.join(' · ') + '.'; submit.textContent = 'Weitere Datei importieren'; form.elements.file.value = ''; state.callbacks.toast?.(`${result.added} Termine übernommen`);
      } catch (error) { message.textContent = errorText(error); }
      finally { submit.disabled = false; }
    };
    dialog.showModal();
  }

  function bootstrap(options = {}) {
    state.callbacks = { ...state.callbacks, ...options.callbacks };
    state.events = (options.legacyAppointments || []).map(legacyEvent); setAutomaticEvents(options.automaticEvents || []);
    if (!state.initialized) bindUi(); state.initialized = true; render();
  }
  function bindUi() {
    const titleAdd = qs('.calendar-titlebar > [data-calendar-add]');
    if (titleAdd) { const actions = el('div', 'calendar-title-actions'); titleAdd.replaceWith(actions); const importButton = el('button', 'secondary', 'Importieren'); importButton.type = 'button'; importButton.addEventListener('click', openImport); const birthdayButton = el('button', 'secondary', '🎂 Geburtstag'); birthdayButton.type = 'button'; birthdayButton.addEventListener('click', openBirthday); actions.append(importButton, birthdayButton, titleAdd); }
    qs('#previousPeriod')?.addEventListener('click', () => navigate(-1)); qs('#nextPeriod')?.addEventListener('click', () => navigate(1));
    qs('#currentPeriod')?.addEventListener('click', () => { state.selectedDate = isoDate(new Date()); state.cursor = startOfMonth(new Date()); render(); });
    qsa('[data-calendar-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.calendarView; render(); }));
    qsa('[data-calendar-filter]').forEach(button => button.addEventListener('click', () => toggleFilter(button.dataset.calendarFilter)));
    qsa('[data-calendar-add]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openCreate(state.selectedDate); }));
    qs('#calendarSearch')?.addEventListener('input', event => { state.search = event.target.value.trim(); render(); });
    qs('#calendarPanelClose')?.addEventListener('click', () => qs('#calendarDayPanel').classList.remove('open'));
    qsa('[data-calendar-cancel]').forEach(button => button.addEventListener('click', () => qs('#calendarEventDialog').close()));
    qs('#calendarEventForm')?.addEventListener('submit', saveFromForm); qs('#calendarDeleteButton')?.addEventListener('click', deleteCurrent); qs('#calendarCopyButton')?.addEventListener('click', copyCurrent);
    const eventForm = qs('#calendarEventForm');
    // Termin-Fenster kürzer: oben Titel, Wer, Tag/Uhrzeit, Wiederholung; der Rest unter „Mehr Optionen“.
    if (eventForm && !eventForm.querySelector('.calendar-more')) {
      const labelOf = name => eventForm.elements[name]?.closest('label');
      const span = name => labelOf(name)?.querySelector('span');
      if (span('calendarKey')) span('calendarKey').textContent = 'Wer?';
      if (span('labelColor')) span('labelColor').textContent = 'Farbmarkierung (Punkt)';
      const more = document.createElement('details'); more.className = 'calendar-more field full'; more.innerHTML = '<summary>Mehr Optionen: Erinnerung, Ort, Link, Notiz, Teilnehmer, Farbe</summary><div class="calendar-more-body"></div>';
      const body = more.querySelector('.calendar-more-body');
      const anchor = eventForm.querySelector('.calendar-recurrence-end') || labelOf('recurrence');
      anchor?.after(more);
      [eventForm.querySelector('.calendar-reminders'), labelOf('location'), labelOf('url'), labelOf('notes'), eventForm.querySelector('.calendar-participants'), labelOf('labelColor')].filter(Boolean).forEach(node => body.append(node));
    }
    if (eventForm) {
      const remember = () => { eventForm.dataset.prevStartDate = eventForm.elements.startDate.value; eventForm.dataset.prevStartTime = eventForm.elements.startTime.value; };
      eventForm.addEventListener('focusin', event => { if (event.target.name === 'startDate' || event.target.name === 'startTime') remember(); });
      eventForm.elements.startDate?.addEventListener('change', () => {
        const before = eventForm.dataset.prevStartDate, now = eventForm.elements.startDate.value, end = eventForm.elements.endDate;
        if (!now) return;
        if (before && end.value && end.value >= before) end.value = isoDate(addDays(end.value, daysBetween(before, now))); else if (!end.value || end.value < now) end.value = now;
        if (end.value < now) end.value = now; remember();
      });
      eventForm.elements.startTime?.addEventListener('change', () => {
        const before = eventForm.dataset.prevStartTime, now = eventForm.elements.startTime.value, end = eventForm.elements.endTime;
        if (!now) return;
        const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
        const duration = before && end.value ? toMin(end.value) - toMin(before) : 60;
        const target = toMin(now) + (duration > 0 ? duration : 60), sameDay = eventForm.elements.startDate.value === eventForm.elements.endDate.value;
        if (sameDay && target >= 1440) { end.value = '23:59'; } else { end.value = `${String(Math.floor(target / 60) % 24).padStart(2, '0')}:${String(target % 60).padStart(2, '0')}`; }
        remember();
      });
    }
    qs('#calendarEventForm [name="allDay"]')?.addEventListener('change', updateFormVisibility); qs('#calendarEventForm [name="recurrence"]')?.addEventListener('change', updateFormVisibility);
    qs('#calendarEventForm [name="calendarKey"]')?.addEventListener('change', event => { const key = event.target.value; qsa('[name="participant"]', qs('#calendarEventForm')).forEach(input => { input.checked = key === 'shared' || input.value === key; }); });
    const grid = qs('#calendarGrid'); let swipe = null;
    // Nur echtes Wischen auf dem Kalender blättert um: Start und Ende auf dem Kalender, gleicher Finger, vorwiegend waagerecht, kurz.
    // Vorher reichte ein einzelnes Loslassen über dem Kalender (z. B. nach „Speichern“ im Termin-Fenster auf dem iPhone), um einen Monat zurückzuspringen.
    grid?.addEventListener('pointerdown', event => { swipe = qsa('dialog[open]').length ? null : { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() }; });
    grid?.addEventListener('pointercancel', () => { swipe = null; });
    grid?.addEventListener('pointerup', event => {
      const start = swipe; swipe = null;
      if (!start || start.id !== event.pointerId || qsa('dialog[open]').length || Date.now() - start.at > 900) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx > 0 ? -1 : 1);
    });
    window.addEventListener('online', flushQueue); document.addEventListener('keydown', event => { if (!qs('#calendar')?.classList.contains('active') || event.target.matches('input,textarea,select')) return; if (event.key === 'ArrowLeft') navigate(-1); if (event.key === 'ArrowRight') navigate(1); });
  }

  window.ZuhauseCalendar = { setExtraEvents, setMontageJobs, refresh, importIcs, openImport, openBirthday, bootstrap, connect, disconnect, render, setAutomaticEvents, setLegacyAppointments, openCreate, selectDate, renderHomeTimeline, occurrencesInRange };
})();
