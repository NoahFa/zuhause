(function () {
  'use strict';

  const SHOPPING_ORDER = ['Obst und Gemüse', 'Tiefkühlprodukte', 'Kühlprodukte', 'Trockenwaren', 'Getränke', 'Haushaltsartikel', 'Sonstiges'];
  const WASTE_NAMES = { 0: 'Restmüll', 3: 'Biomüll', 4: 'Papier', 5: 'Gelbe Tonne' };
  const WASTE_COLORS = { Restmüll: '#706e6f', Biomüll: '#91682f', Papier: '#5271a8', 'Gelbe Tonne': '#d5a700' };
  const EXTERNAL_SCRIPTS = new Map();
  let wasteEvents = [];
  let weather = null;
  let receiptFile = null;

  let budgetFormSaved = false;
  function ensureFeatureState() {
    const arrays = ['fixedCosts', 'receiptDrafts', 'montageMachines', 'montageMaterials', 'montageTemplates', 'studyItems'];
    arrays.forEach(key => { if (!Array.isArray(state[key])) state[key] = []; });
    state.customCategories = { shopping: {}, documents: ['Versicherungen', 'Verträge', 'Rechnungen', 'Steuerunterlagen', 'Sonstige Dokumente'], study: [], ...(state.customCategories || {}) };
    if (!Array.isArray(state.customCategories.documents)) state.customCategories.documents = ['Versicherungen', 'Verträge', 'Rechnungen', 'Steuerunterlagen', 'Sonstige Dokumente'];
    if (!Array.isArray(state.customCategories.study)) state.customCategories.study = [];
    state.budget = { monthlyAmount: 0, savingsGoal: 0, closedMonths: {}, ...(state.budget || {}) };
    state.settings = { wasteStreetId: '284318', wasteDistrict: '2a2', wasteStreetLabel: 'Am Fürstenbrünnchen', weatherPlace: 'Bergisch Gladbach', ...(state.settings || {}) };
  }

  function addDays(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }

  function addMonths(value, months) {
    const source = new Date(`${value}T12:00:00`);
    const day = source.getDate();
    source.setDate(1);
    source.setMonth(source.getMonth() + months);
    const last = new Date(source.getFullYear(), source.getMonth() + 1, 0).getDate();
    source.setDate(Math.min(day, last));
    return isoDate(source);
  }

  function nextDue(task, value) {
    if (task.recurrence === 'daily') return addDays(value, 1);
    if (task.recurrence === 'weekly') return addDays(value, 7);
    if (task.recurrence === 'biweekly') return addDays(value, 14);
    if (task.recurrence === 'monthly') return anchoredMonth(task, value, 1);
    if (task.recurrence === 'custom') {
      const amount = Math.max(1, Number(task.recurrenceInterval) || 1);
      if (task.recurrenceUnit === 'months') return anchoredMonth(task, value, amount);
      return addDays(value, amount * (task.recurrenceUnit === 'weeks' ? 7 : 1));
    }
    return null;
  }
  function anchoredMonth(task, value, amount) {
    const target = addMonths(value, amount); const [year, month] = target.split('-').map(Number);
    const day = Number(String(task.recurrenceAnchor || task.dueOn).slice(8, 10));
    return `${target.slice(0, 8)}${String(Math.min(day, new Date(year, month, 0).getDate())).padStart(2, '0')}`;
  }

  function normaliseLegacyTasks() {
    let changed = false;
    state.householdTasks.forEach(task => {
      if (!task.dueOn) {
        const offset = task.due === 'Morgen' ? 1 : task.due === 'Diese Woche' ? 7 : 0;
        task.dueOn = addDays(todayIso(), offset);
        task.due = task.dueOn;
        changed = true;
      }
      if (task.done && !task.completedAt) { task.completedAt = new Date().toISOString(); changed = true; }
      if (!task.createdAt) { task.createdAt = new Date().toISOString(); changed = true; }
      if (!task.recurrence) task.recurrence = 'none';
      if (task.seriesId && !task.recurrenceAnchor) { task.recurrenceAnchor = state.householdTasks.filter(item => item.seriesId === task.seriesId).map(item => item.dueOn).filter(Boolean).sort()[0] || task.dueOn; changed = true; }
    });
    return changed;
  }

  function materialiseRecurringTasks() {
    const horizon = todayIso();
    // Altlast (bis v49): neue Runden hatten „skipped“ von der übersprungenen Runde geerbt und waren unsichtbar
    state.householdTasks.forEach(task => { if (task.skipped && !task.done) task.skipped = false; });
    const series = new Map();
    state.householdTasks.filter(task => task.seriesId && task.recurrence !== 'none').forEach(task => {
      const current = series.get(task.seriesId);
      if (!current || task.dueOn > current.dueOn) series.set(task.seriesId, task);
    });
    let changed = false;
    series.forEach(latest => {
      let due = latest.dueOn, person = latest.person;
      while (due < horizon) {
        due = nextDue(latest, due);
        if (!due || due > horizon) break;
        const exists = state.householdTasks.some(task => task.seriesId === latest.seriesId && task.dueOn === due);
        // Putzplan: bei „abwechselnd“ ist jede neue Runde die andere Person dran.
        if (latest.alternate) person = person === 'person1' ? 'person2' : 'person1';
        if (!exists) {
          state.householdTasks.push({ ...latest, person, id: `${latest.seriesId}:${due}`, dueOn: due, due, done: false, skipped: false, completedAt: null, createdAt: new Date().toISOString() }); // „skipped“ der übersprungenen Runde nicht mitkopieren
          changed = true;
        }
      }
    });
    return changed;
  }

  function formatDue(task) {
    const today = todayIso();
    if (task.done) return task.completedAt && isoDate(new Date(task.completedAt)) === today ? 'heute erledigt' : 'erledigt';
    if (task.dueOn < today) return `überfällig · ${task.dueOn.slice(0, 4) === today.slice(0, 4) ? `${Number(task.dueOn.slice(8, 10))}.${Number(task.dueOn.slice(5, 7))}.` : displayDate(task.dueOn)}`;
    if (task.dueOn === today) return 'heute';
    if (task.dueOn === addDays(today, 1)) return 'morgen';
    return displayDate(task.dueOn);
  }

  function taskVisibleOnHome(task) {
    const today = todayIso();
    return !task.done || (task.done && task.completedAt && isoDate(new Date(task.completedAt)) === today);
  }

  // Putzplan/Wiederholung: wer ist als Nächstes dran? (die nächste Runde erscheint sonst erst an ihrem Tag)
  function nextRoundText(task) {
    if (!task.recurrence || task.recurrence === 'none' || !(task.done || task.alternate)) return '';
    if (state.householdTasks.some(other => other.seriesId && other.seriesId === task.seriesId && other.dueOn > task.dueOn)) return '';
    const due = nextDue(task, task.dueOn); if (!due) return '';
    const person = task.alternate ? (task.person === 'person1' ? 'person2' : 'person1') : task.person;
    const [y, m, d] = due.split('-');
    return `<span class="next-round">⇄ nächste Runde: ${escapeHtml(displayPerson(person))}, ${Number(d)}.${Number(m)}.</span>`;
  }
  function taskRow(task, history = false) {
    const overdue = !task.done && task.dueOn < todayIso();
    return `<label class="check-row feature-task ${task.done ? 'done' : ''} ${overdue ? 'overdue' : ''}"><input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${task.done ? 'checked' : ''}><span class="check-dot"></span><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(displayPerson(task.person))} · ${escapeHtml(formatDue(task))}${task.recurrence !== 'none' && !nextRoundText(task) ? (task.alternate ? ' · ⇄ abwechselnd' : ' · ↻') : ''}${nextRoundText(task)}</small>${task.description ? `<em>${escapeHtml(task.description)}</em>` : ''}</span>${history ? `<button type="button" class="row-edit" data-edit-task="${escapeHtml(task.id)}" aria-label="Aufgabe ändern">✎</button><button type="button" class="row-delete" data-delete-task aria-label="Aufgabe löschen">×</button>` : ''}</label>`;
  }

  // Auswahl mit mehreren Möglichkeiten (z. B. „nur diese Runde“ / „ganze Serie“). Ergebnis: Index oder -1 für Abbrechen.
  function chooseAction(title, text, options) {
    return new Promise(resolve => {
      let dialog = document.querySelector('#chooseDialog');
      if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'chooseDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
      dialog.innerHTML = `<div class="dialog-head"><div><span class="kicker">Rückfrage</span><h2>${escapeHtml(title)}</h2></div></div><div class="ws-dialog-fields"><p class="ws-help">${escapeHtml(text)}</p>${options.map((option, index) => `<button class="${index === 0 ? 'primary' : 'secondary'} choose-option" type="button" data-choose="${index}">${escapeHtml(option.label)}</button>`).join('')}<button class="ws-text-button" type="button" data-choose="-1">Abbrechen</button></div>`;
      let answered = false;
      dialog.querySelectorAll('[data-choose]').forEach(button => button.addEventListener('click', () => { answered = true; dialog.close(); resolve(Number(button.dataset.choose)); }));
      dialog.addEventListener('close', () => { if (!answered) resolve(-1); }, { once: true });
      dialog.showModal();
    });
  }
  // Aufgabe nachträglich ändern; bei Wiederholungen auf Wunsch auch für die kommenden Runden.
  function editTask(id) {
    const task = state.householdTasks.find(item => String(item.id) === String(id)); if (!task) return;
    let dialog = document.querySelector('#taskEditDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'taskEditDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
    const option = (value, label) => `<option value="${value}" ${(task.person || 'Gemeinsam') === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Haushalt</span><h2>Aufgabe ändern</h2></div><button class="close" type="button" data-close-task-edit aria-label="Schließen">×</button></div><div class="ws-dialog-fields"><label class="ws-field"><span>Was?</span><input name="title" required maxlength="160" value="${escapeHtml(task.title)}"></label><label class="ws-field"><span>Beschreibung (optional)</span><input name="description" maxlength="300" value="${escapeHtml(task.description || '')}"></label><label class="ws-field"><span>Wer?</span><select name="person">${option('Gemeinsam', 'Beide')}${option('person1', displayPerson('person1'))}${option('person2', displayPerson('person2'))}</select></label><label class="ws-field"><span>Fällig am</span><input name="dueOn" type="date" required value="${escapeHtml(task.dueOn || '')}"></label>${task.seriesId && task.recurrence !== 'none' ? '<label class="ws-check"><input type="checkbox" name="future" checked> <span>Titel, Beschreibung und Person auch für die nächsten Runden übernehmen</span></label>' : ''}</div><div class="dialog-actions"><button class="secondary" type="button" data-close-task-edit>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    dialog.querySelectorAll('[data-close-task-edit]').forEach(button => { button.onclick = () => dialog.close(); });
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const data = new FormData(event.currentTarget), title = String(data.get('title')).trim(); if (!title) return;
      const current = state.householdTasks.find(item => String(item.id) === String(id)); if (!current) { dialog.close(); toast('Diese Aufgabe wurde inzwischen gelöscht'); return; }
      const shared = { title, description: String(data.get('description')).trim(), person: String(data.get('person')) };
      Object.assign(current, shared, { dueOn: String(data.get('dueOn')), due: String(data.get('dueOn')) });
      if (data.get('future') && current.seriesId) state.householdTasks.filter(item => item.seriesId === current.seriesId && item.dueOn >= current.dueOn).forEach(item => Object.assign(item, shared));
      persist(); renderTasksEnhanced(); dialog.close(); toast('Aufgabe geändert');
    };
    dialog.showModal();
  }

  function renderTasksEnhanced() {
    ensureFeatureState();
    const home = state.householdTasks.filter(task => !task.skipped && taskVisibleOnHome(task)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    const all = state.householdTasks.filter(task => !task.skipped).sort((a, b) => (a.done - b.done) || a.dueOn.localeCompare(b.dueOn));
    const homeTarget = document.querySelector('#homeTaskList');
    const allTarget = document.querySelector('#householdTaskList');
    if (homeTarget) homeTarget.innerHTML = home.length ? home.map(task => taskRow(task)).join('') : '<p>Für heute ist alles erledigt.</p>';
    if (allTarget) allTarget.innerHTML = all.length ? all.map(task => taskRow(task, true)).join('') : '<p>Noch keine Aufgabe angelegt.</p>';
    document.querySelectorAll('[data-task-id]').forEach(input => input.addEventListener('change', () => {
      const task = state.householdTasks.find(item => String(item.id) === input.dataset.taskId);
      if (!task) return;
      task.done = input.checked;
      task.completedAt = input.checked ? new Date().toISOString() : null;
      persist();
      renderTasksEnhanced();
      renderUpcoming();
      if (input.checked) toastUndo('Aufgabe erledigt', () => { task.done = false; task.completedAt = null; persist(); renderTasksEnhanced(); renderUpcoming(); }); else toast('Aufgabe wieder geöffnet');
    }));
    document.querySelectorAll('[data-delete-task]').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      const id = button.closest('.check-row')?.querySelector('[data-task-id]')?.dataset.taskId;
      const task = state.householdTasks.find(item => String(item.id) === id); if (!task) return;
      const snapshot = structuredClone(state.householdTasks.filter(item => item.id === task.id || (task.seriesId && item.seriesId === task.seriesId)));
      const restore = () => { const ids = new Set(snapshot.map(item => item.id)); state.householdTasks = [...state.householdTasks.filter(item => !ids.has(item.id)), ...snapshot]; persist(); renderTasksEnhanced(); renderUpcoming(); };
      if (task.seriesId && task.recurrence !== 'none') {
        const choice = await chooseAction('Wiederkehrende Aufgabe', `„${task.title}“ wiederholt sich. Was soll gelöscht werden?`, [{ label: 'Nur diese Runde' }, { label: 'Ganze Serie beenden' }]);
        if (choice === 0) { const current = state.householdTasks.find(item => item.id === task.id); if (current) Object.assign(current, { skipped: true, done: true, completedAt: null }); }
        else if (choice === 1) { state.householdTasks = state.householdTasks.filter(item => !(item.seriesId === task.seriesId && !item.done && item.dueOn >= task.dueOn)).map(item => item.seriesId === task.seriesId ? { ...item, recurrence: 'none' } : item); }
        else return;
        persist(); renderTasksEnhanced(); renderUpcoming(); toastUndo(choice === 0 ? 'Diese Runde gelöscht' : 'Serie beendet', restore); return;
      }
      state.householdTasks = state.householdTasks.filter(item => String(item.id) !== id);
      persist(); renderTasksEnhanced(); renderUpcoming(); toastUndo('Aufgabe gelöscht', restore);
    }));
    document.querySelectorAll('[data-edit-task]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); editTask(button.dataset.editTask); }));
  }

  function parseShoppingItem(rawValue) {
    const raw = String(rawValue || '').trim();
    const quantityMatch = raw.match(/^((?:\d+[\s.,/]*)+(?:x|×|Stück|Packung(?:en)?|Pck\.?|Flasche(?:n)?|Dose(?:n)?|Gl(?:as|äser)|Becher|Bund|kg|g|l|ml)?)\s+(.+)$/i);
    const quantity = quantityMatch ? quantityMatch[1].replace(/\bx\b/i, '×').trim().replace(/^(\d+)$/, '$1 ×') : ''; // „3 Joghurt“ → „3 ד wie „2 × Milch“
    const title = (quantityMatch ? quantityMatch[2] : raw).trim();
    const value = title.toLowerCase();
    // Reihenfolge zählt: genauere Wörter zuerst (Saft vor Apfel, Tomatenmark vor Tomate, Reis vor „eis“, Holzkohle vor Kohl).
    // „(?:^|[^a-zäöüß])…(?![a-zäöüß])“ = ganzes Wort – so trifft „ei“ nicht Salbei/Weißwein und „pute“ nicht Computer (Prüfung 18.11.2026).
    const groups = [
      // Prüfung 20.11.: Wörter, die sonst in falschen Gruppen landen („Schwein“ enthält „wein“, „Zitronensaft“ „saft“, „Maisstärke“ „mais“)
      ['Trockenwaren', /erdnussbutter|maisstärke|speisestärke|zitronensaft|limettensaft/],
      ['Kühlprodukte', /schwein|würstchen|wiener|eigelb|eiweiß|pizzateig|blätterteig|hefeteig|mürbeteig/],
      ['Trockenwaren', /chips|röstzwiebel|kerne|maismehl|gewürzgurke|essiggurke|butterkeks|keks|kokosmilch|brühwürfel|tomatenmark|passierte|paprikapulver|currypulver|brühe|essig|konserve|\bdose|dosen|(?:^|[^p])reis(?![a-zäöüß])|basmati|apfelmus|mus$/],
      ['Haushaltsartikel', /holzkohle|grillkohle|grillanzünder|kerze|teelicht|batterie|katzenfutter|hundefutter|katzenstreu/],
      ['Tiefkühlprodukte', /fischstäbchen|tk-|tiefkühl/],
      ['Getränke', /saft|schorle|limo|cola|bier|wein(?!traube)|sekt|(?:^|[^a-zäöüß])wasser(?!melone)|mineralwasser|getränk|eistee|smoothie|sirup/],
      ['Tiefkühlprodukte', /tiefkühl|tk[- ]|pizza|pommes|frost|eiscreme|eiswürfel|(?:^|[^a-zäöüß])eis(?![a-zäöüß])|[a-zäöüß]eis$/],
      ['Obst und Gemüse', /apfel|äpfel|banane|beere|salat|gurke|tomate|paprika|kartoffel|zwiebel|obst|gemüse|avocado|zitrone|orange|knoblauch|ingwer|möhre|karotte|lauch|porree|zucchini|aubergine|brokkoli|blumenkohl|spinat|pilz|champignon|kürbis|sellerie|petersilie|basilikum|schnittlauch|koriander|dill|minze|rosmarin|thymian|salbei|frühlingszwiebel|limette|mango|ananas|traube|birne|radieschen|rucola|kohl|melone|kiwi|pfirsich|pflaume|kirsche|mais/],
      ['Kühlprodukte', /milch|joghurt|käse|butter|sahne|quark|wurst|fleisch|tofu|(?:^|[^a-zäöüß])ei(?:er)?(?![a-zäöüß])|hack|hähnchen|huhn|(?:^|[^a-zäöüß])pute|steak|schnitzel|filet|rind|schwein|geschnetzelt|schinken|speck|lachs|fisch|garnele|mozzarella|parmesan|feta|frischkäse|crème fraîche|creme fraiche|schmand|hefe|margarine/],
      ['Trockenwaren', /brot|nudel|mehl|zucker|müsli|kaffee|tee|gewürz|öl|hafer|spaghetti|pasta|penne|fusilli|lasagne|linsen|kichererbse|bohnen|couscous|bulgur|quinoa|backpulver|vanille|senf|ketchup|honig|schokolade|kakao|nüsse|mandel|paniermehl|semmelbrösel|oregano|zimt|salz|pfeffer/],
      ['Haushaltsartikel', /papier|reiniger|spül|waschmittel|müllbeutel|zahnpasta|seife|schwamm|hundefutter|tierfutter/]
    ];
    // Gemerkte Zuordnungen nur für ganze Wörter bzw. Wortenden („Rum“ trifft „Kokosrum“, aber nicht „Rumpsteak“)
    const custom = state.customCategories?.shopping || {};
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // kurze gemerkte Wörter (unter 4 Buchstaben, z. B. „ei“) nur als ganzes Wort – sonst träfe „ei“ auch Salbei und Brei
    const customCategory = Object.entries(custom).find(([keyword]) => { const k = keyword.toLowerCase().trim(); if (!k) return false; return new RegExp(`${k.length < 4 ? '(?:^|[^a-zäöüß])' : ''}${escape(k)}(?![a-zäöüß])`).test(value); })?.[1];
    const category = customCategory || (/^\d.*(dose|gl(as|äser))/i.test(quantity) && !/tk|tiefkühl/.test(value) ? 'Trockenwaren' : '') || groups.find(([, pattern]) => pattern.test(value))?.[0] || 'Sonstiges'; // „1 Dose Mais“ steht im Regal, nicht beim Gemüse
    return { raw, quantity, title, category };
  }

  function shoppingRow(item) {
    return `<label class="check-row shopping-feature ${item.done ? 'done' : ''}"><input type="checkbox" data-shopping-id="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}><span class="check-dot"></span><span><strong>${item.quantity ? `${escapeHtml(item.quantity)} ` : ''}${escapeHtml(item.title)}</strong><small>${item.done ? 'eingekauft' : escapeHtml(item.category || 'Sonstiges')}</small></span><button type="button" class="row-edit" data-edit-shopping="${escapeHtml(item.id)}" aria-label="Artikel ändern">✎</button><button type="button" class="row-delete" data-delete-shopping aria-label="Artikel löschen">×</button></label>`;
  }

  function renderShoppingEnhanced() {
    ensureFeatureState();
    state.shopping.forEach(item => {
      if (!item.category || !item.quantity) Object.assign(item, parseShoppingItem(item.raw || item.title), { done: !!item.done });
    });
    if (!state.shoppingHistory || typeof state.shoppingHistory !== 'object') state.shoppingHistory = {};
    let historyChanged = false;
    state.shopping.forEach(item => {
      if (item.counted) return;
      const key = String(item.title || '').trim().toLowerCase(); if (!key) return;
      const entry = state.shoppingHistory[key] || { title: item.title, count: 0 };
      state.shoppingHistory[key] = { ...entry, title: item.title, count: entry.count + 1, last: todayIso(), quantity: item.quantity || '', category: item.category || 'Sonstiges' };
      item.counted = true; historyChanged = true;
    });
    if (historyChanged) persist();
    const open = state.shopping.filter(item => !item.done);
    const fullCard = document.querySelector('.full-shopping');
    if (fullCard && !fullCard.querySelector('#shoppingQuickForm')) {
      fullCard.querySelector('.card-head').insertAdjacentHTML('afterend', '<form id="shoppingQuickForm" class="shopping-quick"><input name="title" placeholder="Was brauchen wir? z. B. 2 × Milch" maxlength="160" autocomplete="off" enterkeyhint="done" aria-label="Artikel hinzufügen"><button class="primary" type="submit">＋</button></form><div id="shoppingFrequent" class="shopping-frequent"></div>');
      fullCard.insertAdjacentHTML('beforeend', '<button type="button" class="text-button shopping-clear" id="shoppingClearDone" hidden></button>');
    }
    const openKeys = new Set(open.map(item => String(item.title || '').trim().toLowerCase()));
    const frequent = Object.entries(state.shoppingHistory).filter(([key]) => !openKeys.has(key)).sort((a, b) => b[1].count - a[1].count || String(b[1].last).localeCompare(String(a[1].last))).slice(0, 10);
    const frequentBox = document.querySelector('#shoppingFrequent');
    if (frequentBox) frequentBox.innerHTML = frequent.length ? `<span>Oft gekauft:</span>${frequent.map(([key, entry]) => `<button type="button" data-shopping-again="${escapeHtml(key)}">＋ ${escapeHtml(entry.title)}</button>`).join('')}` : '';
    const doneCount = state.shopping.filter(item => item.done).length, clear = document.querySelector('#shoppingClearDone');
    if (clear) { clear.hidden = !doneCount; clear.textContent = `Eingekaufte entfernen (${doneCount})`; }
    const preview = document.querySelector('#shoppingPreview');
    if (preview) preview.innerHTML = open.slice(0, 4).map(shoppingRow).join('') || '<p>Die Liste ist leer.</p>';
    const full = document.querySelector('#shoppingFull');
    if (full) full.innerHTML = SHOPPING_ORDER.map(category => {
      const items = state.shopping.filter(item => (item.category || 'Sonstiges') === category);
      return items.length ? `<section class="shopping-group"><h3>${category}</h3>${items.map(shoppingRow).join('')}</section>` : '';
    }).join('') || '<p>Die Liste ist leer.</p>';
    document.querySelectorAll('[data-shopping-id]').forEach(input => input.addEventListener('change', () => {
      const item = state.shopping.find(entry => String(entry.id) === input.dataset.shoppingId);
      if (!item) return;
      item.done = input.checked; persist(); renderShoppingEnhanced(); toast(input.checked ? 'Als eingekauft markiert' : 'Wieder auf der Liste');
    }));
    document.querySelectorAll('[data-delete-shopping]').forEach(button => button.addEventListener('click', event => {
      event.preventDefault(); const id = button.closest('.check-row')?.querySelector('[data-shopping-id]')?.dataset.shoppingId;
      const removed = state.shopping.find(item => String(item.id) === id); state.shopping = state.shopping.filter(item => String(item.id) !== id);
      // noch nicht eingekauft wieder gelöscht = vermutlich Fehleintrag → zählt nicht für „Oft gekauft“
      const historyKey = String(removed?.title || '').trim().toLowerCase(), entry = state.shoppingHistory?.[historyKey];
      if (removed && !removed.done && entry) { if (entry.count <= 1) delete state.shoppingHistory[historyKey]; else entry.count -= 1; }
      persist(); renderShoppingEnhanced();
      toastUndo(`${removed?.title || 'Artikel'} entfernt`, () => { if (removed && !state.shopping.some(item => item.id === removed.id)) state.shopping.unshift(removed); persist(); renderShoppingEnhanced(); });
    }));
  }

  function addShopping(raw, extra = {}) {
    const parsed = parseShoppingItem(raw); if (!parsed.title) return false;
    const duplicate = state.shopping.find(item => !item.done && String(item.title).toLowerCase() === parsed.title.toLowerCase());
    if (duplicate) {
      // gleicher Artikel: Mengen zusammenrechnen statt nur „steht schon drauf“ (wie bei den Rezepten)
      const quantity = extra.quantity ?? parsed.quantity;
      const merged = quantity && duplicate.quantity ? window.ZuhauseRecipes?.mergeQuantities?.(duplicate.quantity, quantity) : null;
      if (merged) { duplicate.quantity = merged; persist(); renderShoppingEnhanced(); toast(`${parsed.title}: jetzt ${merged}`); return true; }
      if (quantity && !duplicate.quantity) { duplicate.quantity = quantity; persist(); renderShoppingEnhanced(); toast(`${parsed.title}: Menge ergänzt`); return true; }
      // nicht zusammenrechenbar (z. B. „500 g“ und „2 Pck.“): beide Mengen behalten statt die zweite wortlos zu verwerfen
      if (quantity && duplicate.quantity) { duplicate.quantity = `${duplicate.quantity} + ${quantity}`; persist(); renderShoppingEnhanced(); toast(`${parsed.title}: jetzt ${duplicate.quantity}`); return true; }
      toast(`${parsed.title} steht schon auf der Liste`); return false;
    }
    // schon eingekauft (abgehakt) auf der Liste? Dann diese Zeile wieder öffnen statt eine zweite anzulegen
    const bought = state.shopping.find(item => item.done && String(item.title).toLowerCase() === parsed.title.toLowerCase());
    if (bought) { state.shopping = [bought, ...state.shopping.filter(item => item !== bought)]; Object.assign(bought, { done: false, quantity: extra.quantity ?? parsed.quantity, category: extra.category || bought.category, createdAt: new Date().toISOString() }); persist(); renderShoppingEnhanced(); return true; }
    state.shopping.unshift({ id: crypto.randomUUID(), raw, title: parsed.title, quantity: extra.quantity ?? parsed.quantity, category: extra.category || parsed.category, done: false, createdAt: new Date().toISOString() });
    persist(); renderShoppingEnhanced(); return true;
  }
  function editShopping(id) {
    const item = state.shopping.find(entry => String(entry.id) === String(id)); if (!item) return;
    let dialog = document.querySelector('#shoppingEditDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'shoppingEditDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Einkauf</span><h2>Artikel ändern</h2></div><button class="close" type="button" data-close-shopping-edit aria-label="Schließen">×</button></div><div class="ws-dialog-fields"><label class="ws-field"><span>Artikel</span><input name="title" required maxlength="160" value="${escapeHtml(item.title)}"></label><label class="ws-field"><span>Menge</span><input name="quantity" maxlength="40" value="${escapeHtml(item.quantity || '')}" placeholder="z. B. 2 × oder 500 g"></label><label class="ws-field"><span>Bereich im Supermarkt</span><select name="category">${SHOPPING_ORDER.map(category => `<option ${category === (item.category || 'Sonstiges') ? 'selected' : ''}>${category}</option>`).join('')}</select></label><label class="ws-check"><input type="checkbox" name="remember" checked> <span>Diesen Artikel künftig immer hier einsortieren</span></label></div><div class="dialog-actions"><button class="secondary" type="button" data-close-shopping-edit>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    dialog.querySelectorAll('[data-close-shopping-edit]').forEach(button => { button.onclick = () => dialog.close(); });
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const data = new FormData(event.currentTarget), title = String(data.get('title')).trim(); if (!title) return;
      const category = String(data.get('category')), changedCategory = category !== item.category;
      Object.assign(item, { title, quantity: String(data.get('quantity')).trim(), category, raw: title });
      if (changedCategory && data.get('remember')) { state.customCategories ||= {}; state.customCategories.shopping ||= {}; state.customCategories.shopping[title.toLowerCase()] = category; }
      const key = title.toLowerCase(); if (state.shoppingHistory?.[key]) Object.assign(state.shoppingHistory[key], { quantity: item.quantity, category });
      persist(); renderShoppingEnhanced(); dialog.close(); toast('Artikel geändert');
    };
    dialog.showModal();
  }
  document.addEventListener('submit', event => {
    if (event.target.id !== 'shoppingQuickForm') return;
    event.preventDefault(); const input = event.target.elements.title, value = input.value.trim();
    if (value && addShopping(value)) { input.value = ''; toast('Auf die Liste gesetzt'); }
    input.focus();
  });
  document.addEventListener('click', event => {
    const again = event.target.closest('[data-shopping-again]'), edit = event.target.closest('[data-edit-shopping]'), clear = event.target.closest('#shoppingClearDone');
    if (again) { const entry = state.shoppingHistory?.[again.dataset.shoppingAgain]; if (entry && addShopping(entry.title, { quantity: entry.quantity || '', category: entry.category })) toast(`${entry.title} steht auf der Liste`); }
    if (edit) { event.preventDefault(); editShopping(edit.dataset.editShopping); }
    if (clear) { const removed = state.shopping.filter(item => item.done); if (removed.length) { state.shopping = state.shopping.filter(item => !item.done); persist(); renderShoppingEnhanced(); toastUndo(`${removed.length} eingekaufte Artikel entfernt`, () => { const ids = new Set(state.shopping.map(item => item.id)); state.shopping.push(...removed.filter(item => !ids.has(item.id))); persist(); renderShoppingEnhanced(); }); } }
  });

  function startShoppingVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { toast('Spracheingabe wird von diesem Browser nicht unterstützt'); return; }
    const recognition = new Speech();
    recognition.lang = 'de-DE'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const input = document.querySelector('#dynamicFields input[name="title"]');
      if (input) input.value = event.results[0][0].transcript;
    };
    recognition.onerror = () => toast('Spracheingabe konnte nicht gestartet werden');
    recognition.start(); toast('Ich höre zu …');
  }

  function injectHome() {
    const positive = document.querySelector('#positiveCard'); if (positive) positive.hidden = true;
    const overview = document.querySelector('#today .overview-grid'); if (overview) overview.hidden = true;
    const grid = document.querySelector('#today .home-grid'); if (!grid || document.querySelector('#weatherCard')) return;
    const day = grid.querySelector('.day-card'); const tasks = grid.querySelector('.task-card'); const shopping = grid.querySelector('.shopping-card'); const lou = grid.querySelector('.lou-card');
    const weatherCard = document.createElement('article'); weatherCard.id = 'weatherCard'; weatherCard.className = 'card weather-card';
    weatherCard.innerHTML = '<div class="card-head"><div><span class="kicker">Wetter</span><h2>Bergisch Gladbach</h2></div><span class="weather-symbol" id="weatherSymbol">⌁</span></div><div id="weatherContent"><p>Wetter wird geladen …</p></div>';
    const wasteCard = document.createElement('article'); wasteCard.id = 'wasteCard'; wasteCard.className = 'card waste-card';
    wasteCard.innerHTML = '<div class="card-head"><div><span class="kicker">Müllabfuhr</span><h2>Nächste Abholung</h2></div></div><div id="wasteContent"><p>Termine werden geladen …</p></div>';
    const upcoming = document.createElement('article'); upcoming.id = 'upcomingCard'; upcoming.className = 'card upcoming-card';
    upcoming.innerHTML = '<div class="card-head"><div><span class="kicker">Demnächst wichtig</span><h2>Die nächsten Tage</h2></div></div><div id="upcomingContent"></div>';
    grid.replaceChildren(day, weatherCard, tasks, shopping, wasteCard, upcoming);
    if (lou) lou.remove();
    const actions = document.querySelector('#today .quick-actions');
    if (actions) {
      const expense = actions.querySelector('[data-open="expense"]');
      if (expense) expense.outerHTML = '<button data-feature-page="montage"><span class="action-icon blue">▣</span><strong>Montage</strong><small>Packliste erstellen</small></button>';
      actions.insertAdjacentHTML('beforeend', '<button data-feature-page="study"><span class="action-icon coral">◎</span><strong>Charleen</strong><small>Studium, Job & mehr</small></button><button data-ws-route="lou"><span class="action-icon gold">🐾</span><strong>Lou</strong><small>Pflege & Tierarzt</small></button>');
    }
  }

  async function loadWeather() {
    const target = document.querySelector('#weatherContent'); if (!target) return;
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.9856&longitude=7.13298&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&forecast_days=3');
      if (!response.ok) throw new Error('Wetterdienst nicht erreichbar');
      weather = await response.json();
      const current = weather.current || {}, daily = weather.daily || {};
      const code = Number(current.weather_code || 0);
      const symbol = code === 0 ? '☀' : code < 4 ? '◑' : code < 60 ? '☁' : code < 80 ? '☂' : '❄';
      document.querySelector('#weatherSymbol').textContent = symbol;
      target.innerHTML = `<div class="weather-now"><strong>${Math.round(current.temperature_2m)}°</strong><span>gefühlt ${Math.round(current.apparent_temperature)}° · Wind ${Math.round(current.wind_speed_10m)} km/h</span></div><div class="weather-days">${(daily.time || []).map((date, index) => `<span><b>${index === 0 ? 'Heute' : new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short' })}</b><em>${Math.round(daily.temperature_2m_min[index])}–${Math.round(daily.temperature_2m_max[index])}°</em><small>${daily.precipitation_probability_max[index]} % Regen</small></span>`).join('')}</div>`;
    } catch { target.innerHTML = '<p>Das Wetter ist gerade nicht erreichbar.</p>'; }
  }

  async function loadWaste() {
    const target = document.querySelector('#wasteContent'); if (!target) return;
    try {
      const response = await fetch(`https://aw-bgl2-abfallapp.regioit.de/abfall-app-aw-bgl2/rest/strassen/${encodeURIComponent(state.settings.wasteStreetId)}/termine`);
      if (!response.ok) throw new Error('AWB nicht erreichbar');
      const rows = await response.json();
      wasteEvents = rows.filter(row => WASTE_NAMES[row.bezirk?.fraktionId] && row.datum >= todayIso()).map(row => ({ id: String(row.id), date: row.datum, title: WASTE_NAMES[row.bezirk.fraktionId] })).sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      wasteEvents = (automaticEvents || []).filter(event => event.kind === 'waste' && event.date >= todayIso()).map(event => ({ id: event.key, date: event.date, title: event.title }));
    }
    const nextDate = wasteEvents[0]?.date;
    const next = wasteEvents.filter(event => event.date === nextDate);
    target.innerHTML = next.length ? `<div class="waste-next"><strong>${displayDate(nextDate)}</strong><span>${next.map(event => `<i style="--bin:${WASTE_COLORS[event.title] || '#6f7568'}"></i>${escapeHtml(event.title)}`).join(' ')}</span><small>${escapeHtml(state.settings.wasteStreetLabel || '')} · automatisch aktualisiert</small></div>` : '<p>Noch kein kommender Termin gefunden.</p>';
    renderUpcoming();
  }

  function renderUpcoming() {
    const target = document.querySelector('#upcomingContent'); if (!target) return;
    const today = todayIso(); const limit = addDays(today, 14);
    // Alles aus dem Kalender (Termine, Geburtstage, Müll, Fußball, Hochschule, Montage, Prüfungen) ab morgen, dazu Lou und Caritas.
    // Aufgaben stehen schon in „Offene Aufgaben“ und werden hier nicht doppelt gezeigt.
    const entries = [];
    const calendar = window.ZuhauseCalendar?.occurrencesInRange?.(addDays(today, 1), limit) || [];
    calendar.filter(event => (event.spanDay || 1) === 1).forEach(event => entries.push({ date: event.occurrenceDate, title: event.title, type: event.kind === 'waste' || /müll|tonne|papier/i.test(event.source || '') ? 'Müll' : event.allDay ? 'Ganztägig' : `${event.startTime} Uhr`, route: 'calendar' }));
    (window.ZuhauseLou?.upcomingEntries?.(today, limit) || []).forEach(entry => entries.push({ ...entry, route: 'lou' }));
    (window.ZuhauseCharleen?.upcomingEntries?.(today, limit) || []).filter(entry => entry.type === 'Caritas').forEach(entry => entries.push({ ...entry, route: 'study' }));
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const friendly = date => date === today ? 'Heute' : date === addDays(today, 1) ? 'Morgen' : new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
    target.innerHTML = entries.length ? entries.slice(0, 8).map(entry => `<button type="button" class="upcoming-row" data-upcoming-route="${escapeHtml(entry.route)}" data-upcoming-date="${escapeHtml(entry.date)}"><time>${escapeHtml(friendly(entry.date))}</time><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.type)}</small></span></button>`).join('') : '<p>In den nächsten 14 Tagen ist nichts Zusätzliches geplant.</p>';
    target.querySelectorAll('[data-upcoming-route]').forEach(button => button.addEventListener('click', () => { const route = button.dataset.upcomingRoute; go(route); if (route === 'calendar') window.ZuhauseCalendar?.selectDate?.(button.dataset.upcomingDate); }));
  }

  function monthKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }

  // Ausgaben eines Monats. Nachzügler (Datum in einem schon abgeschlossenen Monat, dort aber nicht verbucht)
  // zählen im laufenden Monat – sonst würden sie nirgends vom Budget abgezogen.
  function expenseMonth(expense) { return String(expense.date || '').slice(0, 7); }
  // In irgendeinem abgeschlossenen Monat schon fest gebucht? (dann zählt die Ausgabe nirgends mehr ein zweites Mal)
  function bookedInClosedMonth(id) { return Object.values(state.budget.closedMonths || {}).some(month => (month.expenseItems || []).some(item => item.id === id)); }
  function isLateExpense(expense, current = monthKey()) {
    const month = expenseMonth(expense);
    return month < current && !!state.budget.closedMonths?.[month] && !bookedInClosedMonth(expense.id);
  }
  // Nachzügler zählen im ersten noch offenen Monat nach ihrem Datum – auch wenn dieser Monat später abgeschlossen wird
  // (vorher fehlten sie im Abschluss und wanderten jeden Monat weiter).
  function expensesForMonth(key) {
    const own = state.expenses.filter(expense => expenseMonth(expense) === key);
    // Nachzügler nur im laufenden (bzw. beim Abschluss: vergangenen) Monat – nicht in der Vorschau künftiger Monate
    if (state.budget.closedMonths?.[key] || key > monthKey()) return own;
    return [...own, ...state.expenses.filter(expense => isLateExpense(expense, key))];
  }

  const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  function previousMonth(key) { const [year, month] = key.split('-').map(Number); return monthKey(new Date(year, month - 2, 1)); }
  function nextMonth(key) { const [year, month] = key.split('-').map(Number); return monthKey(new Date(year, month, 1)); }
  function budgetStart() {
    return state.budget.startMonth || Object.keys(state.budget.closedMonths || {}).sort()[0] || monthKey();
  }
  function calculateMonth(key) {
    const closed = state.budget.closedMonths?.[key]; if (closed) return closed;
    const expenseItems = structuredClone(expensesForMonth(key));
    const fixedItems = structuredClone(state.fixedCosts.filter(cost => (!cost.startMonth || cost.startMonth <= key) && (!cost.endMonth || cost.endMonth >= key)));
    const expenses = roundMoney(expenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const fixed = roundMoney(fixedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const amount = Number(state.budget.monthlyAmounts?.[key] ?? state.budget.monthlyAmount ?? 0);
    const previous = previousMonth(key);
    const carry = key > budgetStart() ? Number(state.budget.closedMonths?.[previous]?.available ?? calculateMonth(previous).available) : 0;
    return { expenses, fixed, carry, amount, available: roundMoney(amount + carry - fixed - expenses), expenseItems, fixedItems };
  }
  function closePastBudgetMonths() {
    if (!state.budget.startMonth && !state.budget.monthlyAmount && !Object.keys(state.budget.closedMonths || {}).length) return false;
    let changed = false;
    if (!state.budget.startMonth) { state.budget.startMonth = budgetStart(); changed = true; }
    let key = budgetStart(); const current = monthKey(); let guard = 0;
    while (key < current && guard++ < 1200) {
      if (!state.budget.closedMonths[key]) { state.budget.closedMonths[key] = { ...calculateMonth(key), closedAt: new Date().toISOString() }; changed = true; }
      key = nextMonth(key);
    }
    return changed;
  }
  function financeMonth() { return document.querySelector('#financeMonth')?.value || monthKey(); }

  function injectFinances() {
    const page = document.querySelector('#finances'); if (!page || page.dataset.featured) return;
    page.dataset.featured = '1';
    page.innerHTML = `<div class="page-title"><div><p class="eyebrow">Gemeinsame Finanzen</p><h1>Budget und Ausgaben.</h1><p>Der rechnerische Haushaltsrahmen ist nicht euer Bankkontostand.</p></div><div class="page-actions"><button class="secondary" data-receipt-scan>📷 Kassenbon scannen</button><button class="primary" data-open="expense">＋ Ausgabe</button></div></div><div class="budget-summary"><article class="balance-card"><span>Verfügbar in diesem Monat</span><strong id="budgetAvailable">0,00 €</strong><small id="budgetMonthLabel"></small></article><article class="mini-money"><span>Übertrag aus Vormonat</span><strong id="budgetCarry">0,00 €</strong><small>auch negative Beträge</small></article><article class="mini-money"><span>Fixkosten diesen Monat</span><strong id="budgetFixed">0,00 €</strong><small id="fixedCount">0 Einträge</small></article></div><div class="finance-feature-grid"><article class="card finance-settings"><span class="kicker">Monatsrahmen</span><h2>Budget einstellen</h2><p class="budget-summary" id="budgetSummary"></p><button class="secondary budget-edit" type="button" id="budgetEdit">Budget ändern</button><form id="budgetForm" class="inline-form"><label>Monatliches Budget<input name="monthlyAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 800"></label><label>Sparziel für den Haushalt (optional)<input name="savingsGoal" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 100"></label><button class="primary" type="submit">Speichern</button></form><button class="text-button" data-close-month>Monat unveränderlich abschließen →</button></article><article class="card fixed-costs"><div class="card-head"><div><span class="kicker">Regelmäßig</span><h2>Fixkosten</h2></div></div><form id="fixedCostForm" class="inline-form"><input name="title" placeholder="z. B. Miete" required><input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Betrag" required><button class="secondary" type="submit">Hinzufügen</button></form><div id="fixedCostList"></div></article></div><article class="card table-card"><div class="card-head"><div><span class="kicker">Chronologisch</span><h2>Ausgaben diesen Monat</h2></div><div class="search">⌕ <input id="expenseSearchFeature" placeholder="Suchen …"></div></div><div class="expense-list" id="expenseListFeature"></div></article><article class="card savings-card"><div class="card-head"><div><span class="kicker">Sparanalyse</span><h2>Einfach vergleichen</h2></div></div><div id="savingsAnalysis"></div></article><input id="receiptCamera" type="file" accept="image/*" capture="environment" hidden>`;
    bindOpenButtons();
    page.querySelector('.page-title').insertAdjacentHTML('afterend', '<label class="field finance-month-picker"><span>Monat ansehen</span><input id="financeMonth" type="month"></label>');
    page.querySelector('#financeMonth').value = monthKey(); page.querySelector('#financeMonth').addEventListener('change', renderFinances);
    page.querySelector('[data-close-month]').textContent = 'Vergangene Monate werden automatisch abgeschlossen';
    page.querySelector('[data-close-month]').disabled = true;
    // Kassenbon über den neuen Scanner (Ecken, Entzerren, Sicherung ohne Internet); „Als Ausgabe ins Budget“ ist vorausgewählt
    page.querySelector('[data-receipt-scan]').addEventListener('click', () => { if (window.ZuhauseScanner) window.ZuhauseScanner.open({ category: 'Rechnungen', actions: ['expense'] }); else page.querySelector('#receiptCamera').click(); });
    page.querySelector('#receiptCamera').addEventListener('change', event => { if (event.target.files[0]) beginReceiptScan(event.target.files[0]); event.target.value = ''; });
    page.querySelector('#budgetEdit').addEventListener('click', () => { page.querySelector('.finance-settings').classList.remove('collapsed'); page.querySelector('#budgetForm').monthlyAmount.focus(); });
    page.querySelector('#budgetForm').addEventListener('submit', event => {
      event.preventDefault(); budgetFormSaved = true; const data = Object.fromEntries(new FormData(event.currentTarget));
      closePastBudgetMonths(); state.budget.startMonth ||= monthKey(); state.budget.monthlyAmounts ||= {};
      state.budget.monthlyAmount = euroValue(data.monthlyAmount) || 0; state.budget.monthlyAmounts[monthKey()] = state.budget.monthlyAmount; state.budget.savingsGoal = euroValue(data.savingsGoal) || 0; persist(); renderFinances(); toast('Budget gespeichert');
    });
    page.querySelector('#fixedCostForm').addEventListener('submit', event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      if (!(euroValue(data.amount) > 0)) { toast('Bitte einen Betrag über 0 € eintragen'); return; }
      state.fixedCosts.push({ id: crypto.randomUUID(), title: data.title, amount: euroValue(data.amount), startMonth: monthKey() }); event.currentTarget.reset(); persist(); renderFinances(); toast('Fixkosten gespeichert');
    });
    page.querySelector('#expenseSearchFeature').addEventListener('input', event => renderFinanceExpenseList(event.target.value));
  }

  function renderFinanceExpenseList(filter = '') {
    const target = document.querySelector('#expenseListFeature'); if (!target) return;
    const key = financeMonth(); const list = (state.budget.closedMonths[key]?.expenseItems || expensesForMonth(key)).filter(expense => `${expense.title} ${expense.store || ''}`.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    target.innerHTML = list.length ? list.map(expense => `<button class="expense-row" data-feature-expense="${escapeHtml(expense.id)}"><span class="expense-icon">${expense.receipt ? '▣' : '€'}</span><span><strong>${escapeHtml(expense.store || expense.title)}</strong><small>${displayDate(expense.date)}${isLateExpense(expense, key) ? ' · nachgetragen, zählt in diesem Monat' : ''}${expense.receiptItems?.length ? ` · ${expense.receiptItems.length} erkannte Artikel` : ''}</small></span><strong>${money(Number(expense.amount) || 0)}</strong><em class="tag">${expense.receipt ? 'Beleg' : 'Ausgabe'}</em></button>`).join('') : '<p>Noch keine Ausgabe in diesem Monat.</p>';
    target.querySelectorAll('[data-feature-expense]').forEach(button => button.addEventListener('click', () => {
      const expense = list.find(item => String(item.id) === button.dataset.featureExpense); if (!expense) return;
      editExpense(expense.id);
    }));
  }

  // Ausgabe ändern oder löschen. Ist sie in einem abgeschlossenen Monat schon fest gebucht, bleibt der Verlauf unverändert
  // und die Korrektur wird als Gegenbuchung im laufenden Monat eingetragen.
  const parseEuro = value => { let s = String(value ?? '').trim().replace(/[\s€]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); const n = Number(s); return Number.isFinite(n) ? roundMoney(n) : NaN; };
  function editExpense(id) {
    const expense = state.expenses.find(item => String(item.id) === String(id)) || Object.values(state.budget.closedMonths || {}).flatMap(m => m.expenseItems || []).find(item => String(item.id) === String(id));
    if (!expense) return;
    const frozen = bookedInClosedMonth(expense.id), categories = ['Gemeinsamer Haushalt', 'Persönlich', 'Nebengewerbe', 'Noch unklar'];
    // aktueller Stand bei abgeschlossenen Monaten: Original plus alle bisherigen Korrekturen (sonst würde jede Änderung vom Original aus neu gebucht)
    const corrections = () => state.expenses.filter(item => item.correctionOf === expense.id).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const effective = () => roundMoney((Number(expense.amount) || 0) + (frozen ? corrections() : 0));
    const cancelled = frozen && effective() === 0, isCorrection = !!expense.correctionOf, lock = frozen || isCorrection; // Korrekturbuchungen kann man nur löschen (Prüfung 20.11.)
    let dialog = document.querySelector('#expenseEditDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'expenseEditDialog'; dialog.className = 'calendar-event-dialog'; document.body.append(dialog); }
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Ausgabe</span><h2>${escapeHtml(expense.store || expense.title || 'Ausgabe')}</h2></div><button class="close" type="button" data-close-expense aria-label="Schließen">×</button></div>
      <div class="ws-dialog-fields">
        ${isCorrection ? '<p class="recipe-import-note">Das ist eine Korrekturbuchung zu einer Ausgabe aus einem abgeschlossenen Monat. Ändern geht nicht – nur löschen.</p>' : frozen ? `<p class="recipe-import-note">${cancelled ? 'Diese Ausgabe ist bereits storniert.' : `Dieser Monat ist schon abgeschlossen. Änderungen am Betrag werden als Korrektur im laufenden Monat verbucht – der alte Monat bleibt, wie er war.${corrections() ? ` Bisher korrigiert: ${money(corrections())}.` : ''}`}</p>` : ''}
        <label class="ws-field"><span>Was?</span><input name="title" required maxlength="120" value="${escapeHtml(expense.store || expense.title || '')}" ${lock ? 'disabled' : ''}></label>
        <div class="lou-interval"><label class="ws-field"><span>Wie viel?</span><input name="amount" inputmode="decimal" required value="${escapeHtml(String(effective()).replace('.', ','))}" ${cancelled || isCorrection ? 'disabled' : ''}></label>
        <label class="ws-field"><span>Wann?</span><input name="date" type="date" required value="${escapeHtml(expense.date || todayIso())}" ${lock ? 'disabled' : ''}></label></div>
        <label class="ws-field"><span>Bereich</span><select name="category" ${lock ? 'disabled' : ''}>${categories.map(c => `<option ${c === (expense.category || 'Gemeinsamer Haushalt') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        ${expense.receiptItems?.length ? `<details class="doc-ocr"><summary>${expense.receiptItems.length} erkannte Artikel</summary><ul class="detail-list">${expense.receiptItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
        <p class="auth-message" data-expense-message></p>
      </div>
      <div class="calendar-dialog-actions">${cancelled ? '<span></span>' : `<button type="button" class="danger" data-delete-expense>${frozen ? 'Stornieren' : 'Löschen'}</button>`}<span></span><button type="button" class="secondary" data-close-expense>Abbrechen</button><button class="primary" type="submit">Speichern</button></div></form>`;
    dialog.querySelectorAll('[data-close-expense]').forEach(b => { b.onclick = () => dialog.close(); });
    const correction = (difference, note) => state.expenses.unshift({ id: `korrektur:${expense.id}:${state.expenses.filter(item => item.correctionOf === expense.id).length}:${roundMoney(effective() + difference)}`, title: `Korrektur: ${expense.store || expense.title}`, store: `Korrektur: ${expense.store || expense.title}`, date: todayIso(), amount: roundMoney(difference), person: expense.person || 'Gemeinsam', category: expense.category || 'Gemeinsamer Haushalt', receipt: false, correctionOf: expense.id, note, createdAt: new Date().toISOString(), icon: '€' });
    const deleteButton = dialog.querySelector('[data-delete-expense]');
    if (deleteButton) deleteButton.onclick = () => {
      if (frozen) { const now = effective(); if (!now) return; if (!confirm(`„${expense.store || expense.title}“ stornieren? ${money(now)} werden im laufenden Monat gutgeschrieben.`)) return; correction(-now, 'Storno'); persist(); renderAll(); dialog.close(); toast('Storniert – im laufenden Monat gutgeschrieben'); return; }
      const index = state.expenses.findIndex(item => item.id === expense.id); if (index < 0) return;
      const [removed] = state.expenses.splice(index, 1); persist(); renderAll(); dialog.close();
      toastUndo(`„${removed.store || removed.title}“ gelöscht`, () => { if (!state.expenses.some(item => item.id === removed.id)) state.expenses.splice(Math.min(index, state.expenses.length), 0, removed); persist(); renderAll(); });
    };
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)), message = dialog.querySelector('[data-expense-message]');
      if (cancelled || isCorrection) { dialog.close(); return; }
      // abgeschlossener Monat: 0 € ist erlaubt (= vollständig korrigiert), sonst muss der Betrag über 0 € liegen
      const amount = parseEuro(data.amount);
      if (!Number.isFinite(amount) || amount < 0 || (!frozen && amount === 0)) { message.textContent = 'Bitte einen Betrag über 0 € eingeben.'; return; }
      const title = frozen ? (expense.store || expense.title) : String(data.title || '').trim(); if (!title) { message.textContent = 'Bitte eintragen, wofür.'; return; }
      if (frozen) {
        const difference = roundMoney(amount - effective());
        if (difference) correction(difference, 'Betrag geändert');
        persist(); renderAll(); dialog.close(); toast(difference ? `Korrektur ${money(difference)} im laufenden Monat verbucht` : 'Nichts geändert'); return;
      }
      const current = state.expenses.find(item => item.id === expense.id); if (!current) { dialog.close(); return; }
      if (data.date !== current.date && state.budget.closedMonths?.[String(data.date).slice(0, 7)] && !confirm('Dieser Monat ist schon abgeschlossen. Die Ausgabe zählt dann im laufenden Monat. Trotzdem?')) return;
      Object.assign(current, { title, store: current.store ? title : current.store, amount, date: data.date, category: data.category, review: ['Nebengewerbe', 'Noch unklar'].includes(data.category) });
      persist(); renderAll(); dialog.close(); toast('Ausgabe gespeichert');
    };
    dialog.showModal();
  }

  function renderFinances() {
    ensureFeatureState(); const page = document.querySelector('#finances'); if (!page?.dataset.featured) return;
    const key = financeMonth(); const summary = calculateMonth(key);
    // Noch kein Budget eingestellt: statt rotem Minus ohne Erklärung einen Hinweis zeigen
    const noBudget = !Number(state.budget.monthlyAmount) && !Object.values(state.budget.monthlyAmounts || {}).some(Number) && !Object.keys(state.budget.closedMonths || {}).length;
    document.querySelector('#budgetAvailable').textContent = noBudget ? 'Noch kein Budget' : money(summary.available);
    document.querySelector('#budgetAvailable').classList.toggle('negative', !noBudget && summary.available < 0);
    document.querySelector('#budgetAvailable').classList.toggle('no-budget', noBudget);
    document.querySelector('#budgetCarry').textContent = money(summary.carry);
    document.querySelector('#budgetFixed').textContent = money(summary.fixed);
    document.querySelector('#budgetMonthLabel').textContent = noBudget ? `Bisher ${money(summary.expenses + summary.fixed)} ausgegeben – unten „Budget einstellen“` : `${new Date(key + '-01T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}${state.budget.closedMonths?.[key] ? ' · abgeschlossen' : ''}`;
    page.querySelector('.finance-settings').hidden = key !== monthKey();
    page.querySelector('#fixedCostForm').hidden = key !== monthKey();
    document.querySelector('#fixedCount').textContent = `${state.fixedCosts.length} ${state.fixedCosts.length === 1 ? 'Eintrag' : 'Einträge'}`;
    const budgetCard = document.querySelector('.finance-settings'), budgetSet = Number(state.budget.monthlyAmount) > 0;
    if (budgetCard && (budgetFormSaved || !budgetCard.dataset.init)) { budgetCard.dataset.init = '1'; budgetFormSaved = false; budgetCard.classList.toggle('collapsed', budgetSet); }
    const budgetTitle = budgetCard?.querySelector('h2'); if (budgetTitle) budgetTitle.textContent = budgetSet ? 'Monatsbudget' : 'Budget einstellen';
    const budgetSummary = document.querySelector('#budgetSummary'); if (budgetSummary) budgetSummary.textContent = budgetSet ? `${money(Number(state.budget.monthlyAmount))} pro Monat${Number(state.budget.savingsGoal) > 0 ? ` · Sparziel ${money(Number(state.budget.savingsGoal))}` : ''}` : '';
    // Formular nur befüllen, wenn gerade niemand darin tippt (sonst überschrieb der Abgleich alle 15 s die Eingabe)
    const budgetForm = document.querySelector('#budgetForm'); if (!budgetForm.contains(document.activeElement)) { budgetForm.monthlyAmount.value = state.budget.monthlyAmount ? String(state.budget.monthlyAmount).replace('.', ',') : ''; budgetForm.savingsGoal.value = state.budget.savingsGoal ? String(state.budget.savingsGoal).replace('.', ',') : ''; }
    document.querySelector('#fixedCostList').innerHTML = (key === monthKey() ? state.fixedCosts.filter(cost => !cost.endMonth || cost.endMonth >= key) : summary.fixedItems || []).map(cost => `<div class="compact-row"><span>${escapeHtml(cost.title)}</span><strong>${money(Number(cost.amount) || 0)}</strong>${key === monthKey() ? (cost.endMonth ? '<small>endet nach diesem Monat</small>' : `<button data-delete-fixed="${escapeHtml(cost.id)}" aria-label="Fixkosten löschen">×</button>`) : ''}</div>`).join('') || '<p>Noch keine Fixkosten.</p>';
    // Fixkosten löschen: im laufenden Monat zählen sie noch (schon bezahlt), ab dem nächsten nicht mehr; erst diesen Monat angelegt → ganz weg
    document.querySelectorAll('[data-delete-fixed]').forEach(button => button.addEventListener('click', () => { closePastBudgetMonths(); const cost = state.fixedCosts.find(item => String(item.id) === button.dataset.deleteFixed); if (!cost) return; if (!cost.startMonth || cost.startMonth >= monthKey()) state.fixedCosts = state.fixedCosts.filter(item => item !== cost); else cost.endMonth = monthKey(); persist(); renderFinances(); toast(cost.endMonth ? 'Endet nach diesem Monat' : 'Fixkosten entfernt'); }));
    renderFinanceExpenseList(document.querySelector('#expenseSearchFeature')?.value || ''); renderSavingsAnalysis();
  }

  function renderSavingsAnalysis() {
    const target = document.querySelector('#savingsAnalysis'); if (!target) return;
    const months = [];
    for (let index = 5; index >= 0; index -= 1) { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index); const key = monthKey(date); months.push({ key, label: date.toLocaleDateString('de-DE', { month: 'short' }), value: expensesForMonth(key).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0) }); }
    const max = Math.max(...months.map(item => item.value), 1);
    const stores = new Map(); state.expenses.forEach(expense => stores.set(expense.store || expense.title, (stores.get(expense.store || expense.title) || 0) + (Number(expense.amount) || 0)));
    const topStores = [...stores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const current = months.at(-1)?.value || 0; const previous = months.at(-2)?.value || 0; const difference = current - previous;
    const tip = state.expenses.length < 5 ? 'Ab fünf Ausgaben gibt es hier einen Spartipp.' : difference < 0 ? `Ihr habt diesen Monat bisher ${money(Math.abs(difference))} weniger ausgegeben als im Vormonat.` : topStores.length ? `Der größte Ausgabenblock ist derzeit ${topStores[0][0]}. Prüft dort zuerst, ob sich etwas bündeln lässt.` : 'Sobald Ausgaben vorhanden sind, erscheint hier ein konkreter Spartipp.';
    target.innerHTML = `<div class="savings-chart">${months.map(item => `<span><i style="height:${Math.max(4, Math.round(item.value / max * 100))}%"></i><b>${item.label}</b><small>${money(item.value)}</small></span>`).join('')}</div><div class="savings-split"><div><h3>Nach Geschäften</h3>${topStores.map(([store, amount]) => `<div class="compact-row"><span>${escapeHtml(store)}</span><strong>${money(amount)}</strong></div>`).join('') || '<p>Noch keine Daten.</p>'}</div><div><h3>Spartipp</h3><p>${escapeHtml(tip)}</p>${state.budget.savingsGoal ? `<p><strong>Sparziel:</strong> ${money(state.budget.savingsGoal)}</p>` : ''}</div></div>`;
  }

  function loadExternalScript(url) {
    if (EXTERNAL_SCRIPTS.has(url)) return EXTERNAL_SCRIPTS.get(url);
    const promise = new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = url; script.onload = resolve; script.onerror = reject; document.head.append(script); });
    EXTERNAL_SCRIPTS.set(url, promise); promise.catch(() => EXTERNAL_SCRIPTS.delete(url)); return promise;
  }

  async function recogniseImage(file, progressTarget) {
    try {
      if ('TextDetector' in window) { const bitmap = await createImageBitmap(file); const blocks = await new TextDetector().detect(bitmap); bitmap.close(); return blocks.map(block => block.rawValue).join('\n'); }
      if (!window.ZuhauseScanner) return '';
      const result = await window.ZuhauseScanner.recognise(file, message => { if (progressTarget && message.progress) progressTarget.textContent = `Texterkennung ${Math.round(message.progress * 100)} %`; });
      return result.text || '';
    } catch { return ''; }
  }

  function parseReceiptText(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const amountMatches = [...text.matchAll(/(?:EUR|€|Summe|Gesamt|Betrag)[^\d]{0,12}(\d+[.,]\d{2})/gi)];
    const fallbackAmounts = [...text.matchAll(/\b(\d+[.,]\d{2})\b/g)];
    const amount = Number((amountMatches.at(-1)?.[1] || fallbackAmounts.at(-1)?.[1] || '0').replace(',', '.'));
    const dateMatch = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
    const date = dateMatch ? `${dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : todayIso();
    const store = lines.find(line => /[A-Za-zÄÖÜäöüß]{3}/.test(line) && !/bon|kasse|datum|tel|steuer/i.test(line)) || 'Einkauf';
    const items = lines.filter(line => /[A-Za-zÄÖÜäöüß]{3}/.test(line) && /\d+[.,]\d{2}/.test(line) && !/summe|gesamt|mwst|steuer|gegeben|rückgeld/i.test(line)).slice(0, 30);
    return { store, date, amount, items, ocrText: text };
  }

  async function beginReceiptScan(file) {
    receiptFile = file; openFeatureDialog('Kassenbon wird gelesen', '<p id="receiptProgress">Foto wird vorbereitet …</p>', '');
    const text = await recogniseImage(file, document.querySelector('#receiptProgress'));
    const draft = parseReceiptText(text);
    const dialog = document.querySelector('#featureDialog');
    dialog.querySelector('.feature-dialog-body').innerHTML = `<p>Bitte erkannte Angaben kontrollieren.</p><div class="field-grid"><label class="field full"><span>Geschäft</span><input name="store" value="${escapeHtml(draft.store)}" required></label><label class="field"><span>Datum</span><input name="date" type="date" value="${draft.date}" required></label><label class="field"><span>Gesamtbetrag</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" value="${draft.amount ? String(draft.amount).replace('.', ',') : ''}" required></label><label class="field full"><span>Erkannte Artikel (eine Zeile je Artikel)</span><textarea name="items" rows="7">${escapeHtml(draft.items.join('\n'))}</textarea></label></div><input type="hidden" name="ocrText" value="${escapeHtml(draft.ocrText.slice(0, 8000))}">`;
    dialog.querySelector('.feature-dialog-actions').innerHTML = '<button class="secondary" type="button" data-feature-cancel>Abbrechen</button><button class="primary" type="submit">Ausgabe speichern</button>';
    dialog.querySelector('[data-feature-cancel]').addEventListener('click', () => dialog.close());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      if (state.budget.closedMonths[String(data.date).slice(0, 7)]) { toast('Dieser Monat ist abgeschlossen. Bitte das Buchungsdatum korrigieren.'); return; }
      const submit = event.currentTarget.querySelector('button[type="submit"]'); submit.disabled = true;
      try {
        if (receiptFile && cloudReady) {
          window.__pendingDocumentMeta = { folder: 'Gemeinsam', category: 'Rechnungen', ocrText: data.ocrText, name: `Kassenbon ${data.store} ${data.date}` };
          if (!await uploadDocument(receiptFile)) return;
        }
      state.expenses.unshift({ id: crypto.randomUUID(), title: data.store, store: data.store, date: data.date, amount: euroValue(data.amount), person: 'Gemeinsam', category: 'Gemeinsamer Haushalt', receipt: true, receiptItems: data.items.split(/\r?\n/).map(item => item.trim()).filter(Boolean), receiptOcrText: data.ocrText, createdAt: new Date().toISOString(), icon: '▣' });
      persist(); renderAll(); dialog.close(); toast('Kassenbon gespeichert');
      receiptFile = null;
      } catch { toast('Der Kassenbon konnte nicht gespeichert werden. Bitte erneut versuchen.'); } finally { submit.disabled = false; }
    };
  }

  function openFeatureDialog(title, body, actions = '<button class="secondary" type="button" data-feature-cancel>Abbrechen</button><button class="primary" type="submit">Speichern</button>') {
    let dialog = document.querySelector('#featureDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'featureDialog'; dialog.innerHTML = '<form><div class="dialog-head"><div><span class="kicker">Zuhause</span><h2></h2></div><button class="close" type="button" data-feature-cancel aria-label="Schließen">×</button></div><div class="feature-dialog-body"></div><div class="dialog-actions feature-dialog-actions"></div></form>'; document.body.append(dialog); }
    dialog.querySelector('h2').textContent = title; dialog.querySelector('.feature-dialog-body').innerHTML = body; dialog.querySelector('.feature-dialog-actions').innerHTML = actions;
    dialog.querySelectorAll('[data-feature-cancel]').forEach(button => button.addEventListener('click', () => dialog.close())); dialog.querySelector('form').onsubmit = null; if (!dialog.open) dialog.showModal(); return dialog;
  }

  function injectDocuments() {
    const page = document.querySelector('#documents'); if (!page || page.dataset.featured) return; page.dataset.featured = '1';
    const title = page.querySelector('.page-title');
    title.innerHTML = `<div><p class="eyebrow">Dokumente</p><h1>Gemeinsam sicher ablegen.</h1><p>Beide sehen alle Bereiche. Ordner und Kategorien dienen nur der Übersicht.</p></div><div class="document-actions"><button class="primary" id="multiScan">📷 Dokument scannen</button><button class="secondary" id="fakeUploadFeature">↑ Datei hochladen</button></div>`;
    page.querySelector('.people-docs')?.remove();
    const card = page.querySelector('.document-card');
    card.insertAdjacentHTML('beforebegin', `<article class="card document-controls"><div class="document-filter-grid"><label>Ablageordner<select id="documentFolder"><option>Gemeinsam</option><option>Noah</option><option>Charleen</option><option>Lou</option></select></label><label>Kategorie<select id="documentCategory"></select></label><label>Dokumentname<input id="documentName" placeholder="wird aus dem Dateinamen übernommen"></label><label>Suche<input id="documentSearch" type="search" placeholder="Name oder erkannter Text"></label><label>Suchbereich<select id="documentSearchScope"><option value="all">Alle Dokumente</option><option value="category">Aktueller Ordner und Kategorie</option></select></label></div><form id="documentCategoryForm" class="inline-form"><input name="category" placeholder="Neue Kategorie" required><button class="secondary" type="submit">Kategorie anlegen</button></form><div id="documentCategoryList" class="category-manager"></div><p class="privacy-note">OCR läuft möglichst lokal im Browser. Die Originalfotos bleiben zusätzlich zum PDF geschützt erhalten.</p></article><input id="multiScanInput" type="file" accept="image/*" capture="environment" multiple hidden>`);
    page.querySelector('#fakeUploadFeature').addEventListener('click', () => page.querySelector('#fileInput').click());
    page.querySelector('#multiScan').addEventListener('click', () => page.querySelector('#multiScanInput').click());
    page.querySelector('#multiScanInput').addEventListener('change', event => { if (event.target.files.length) createScannedPdf([...event.target.files]); event.target.value = ''; });
    page.querySelector('#documentSearch').addEventListener('input', event => filterDocuments(event.target.value));
    page.querySelector('#documentSearchScope').addEventListener('change', () => filterDocuments(page.querySelector('#documentSearch').value));
    page.querySelector('#documentFolder').addEventListener('change', () => filterDocuments(page.querySelector('#documentSearch').value));
    page.querySelector('#documentCategory').addEventListener('change', () => filterDocuments(page.querySelector('#documentSearch').value));
    page.querySelector('#documentCategoryForm').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const category = String(data.category || '').trim(); if (category && !state.customCategories.documents.includes(category)) state.customCategories.documents.push(category); persist(); event.currentTarget.reset(); renderDocumentCategories(); toast('Kategorie angelegt'); });
    const bindUploadInput = input => input?.addEventListener('change', async event => {
      event.stopImmediatePropagation(); const file = event.target.files[0]; event.target.value = ''; if (!file) return;
      const text = file.type.startsWith('image/') ? await recogniseImage(file) : '';
      window.__pendingDocumentMeta = { folder: page.querySelector('#documentFolder').value, category: page.querySelector('#documentCategory').value, ocrText: text, name: page.querySelector('#documentName').value || file.name.replace(/\.[^.]+$/, '') };
      await uploadDocument(file);
    }, true);
    bindUploadInput(page.querySelector('#fileInput')); bindUploadInput(page.querySelector('#cameraInput'));
    renderDocumentCategories();
  }

  function renderDocumentCategories() {
    const select = document.querySelector('#documentCategory'); if (!select) return;
    const selected = select.value;
    select.innerHTML = state.customCategories.documents.map(category => `<option>${escapeHtml(category)}</option>`).join('');
    if (state.customCategories.documents.includes(selected)) select.value = selected;
    const manager = document.querySelector('#documentCategoryList');
    if (manager) {
      manager.innerHTML = state.customCategories.documents.map(category => `<span>${escapeHtml(category)}<button type="button" data-rename-document-category="${escapeHtml(category)}" aria-label="Kategorie ${escapeHtml(category)} umbenennen">✎</button></span>`).join('');
      manager.querySelectorAll('[data-rename-document-category]').forEach(button => button.addEventListener('click', () => renameDocumentCategory(button.dataset.renameDocumentCategory)));
    }
  }

  function filterDocuments(query = '') {
    const folder = document.querySelector('#documentFolder')?.value || '';
    const category = document.querySelector('#documentCategory')?.value || '';
    const scoped = document.querySelector('#documentSearchScope')?.value === 'category';
    const value = query.toLowerCase();
    document.querySelectorAll('#documentList .document-row').forEach(row => {
      const text = `${row.dataset.folder || ''} ${row.dataset.search || row.textContent}`.toLowerCase();
      const outsideScope = scoped && ((folder && row.dataset.folder !== folder) || (category && row.dataset.category !== category));
      row.hidden = outsideScope || (!!value && !text.includes(value));
    });
  }

  async function renameDocumentCategory(previous) {
    const next = prompt('Neuer Kategoriename', previous)?.trim();
    if (!next || next === previous || state.customCategories.documents.includes(next)) return;
    state.customCategories.documents = state.customCategories.documents.map(category => category === previous ? next : category);
    persist(); renderDocumentCategories();
    if (cloudReady && currentHousehold) {
      await cloud.from('documents').update({ category: next }).eq('household_id', currentHousehold.id).eq('category', previous);
      await loadDocuments();
    }
    toast('Kategorie umbenannt');
  }

  async function createScannedPdf(files) {
    const dialog = openFeatureDialog('Dokument wird zusammengesetzt', '<p id="scanProgress">Seiten werden vorbereitet …</p>', '');
    try {
      await loadExternalScript('vendor/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true }); let ocrText = '';
      for (let index = 0; index < files.length; index += 1) {
        document.querySelector('#scanProgress').textContent = `Seite ${index + 1} von ${files.length} · Texterkennung …`;
        const file = files[index]; const prepared = await prepareScanImage(file); const text = await recogniseImage(prepared.file, document.querySelector('#scanProgress')); ocrText += `\n${text}`;
        const maxWidth = 190, maxHeight = 277; const scale = Math.min(maxWidth / prepared.width, maxHeight / prepared.height); const width = prepared.width * scale, height = prepared.height * scale;
        if (index) pdf.addPage(); pdf.addImage(prepared.dataUrl, 'JPEG', (210 - width) / 2, (297 - height) / 2, width, height, undefined, 'FAST');
      }
      const blob = pdf.output('blob'); const name = `Scan-${todayIso()}.pdf`; const pdfFile = new File([blob], name, { type: 'application/pdf' });
      window.__pendingDocumentMeta = { folder: document.querySelector('#documentFolder').value, category: document.querySelector('#documentCategory').value, ocrText, name: document.querySelector('#documentName').value || `Scan ${displayDate(todayIso())}`, originalFiles: files };
      const saved = await uploadDocument(pdfFile); if (!saved) { dialog.close(); return; } dialog.close(); toast('Mehrseitiges PDF gespeichert');
    } catch { dialog.close(); toast('Das PDF konnte nicht erstellt werden'); }
  }

  function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
  function imageSize(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = reject; image.src = src; }); }

  async function prepareScanImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height); const { data, width, height } = pixels;
    const light = (x, y) => { const offset = (Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4; return (data[offset] + data[offset + 1] + data[offset + 2]) / 3; };
    const background = (light(0, 0) + light(width - 1, 0) + light(0, height - 1) + light(width - 1, height - 1)) / 4;
    const isPaper = (x, y) => light(x, y) > Math.max(170, background + 35);
    const rowHasPaper = y => { let changed = 0, checked = 0; const step = Math.max(1, Math.floor(width / 80)); for (let x = 0; x < width; x += step) { checked++; if (isPaper(x, y)) changed++; } return changed / checked > .35; };
    const columnHasPaper = x => { let changed = 0, checked = 0; const step = Math.max(1, Math.floor(height / 80)); for (let y = 0; y < height; y += step) { checked++; if (isPaper(x, y)) changed++; } return changed / checked > .35; };
    let top = 0, bottom = height - 1, left = 0, right = width - 1;
    while (top < height * .25 && !rowHasPaper(top)) top += 2;
    while (bottom > height * .75 && !rowHasPaper(bottom)) bottom -= 2;
    while (left < width * .25 && !columnHasPaper(left)) left += 2;
    while (right > width * .75 && !columnHasPaper(right)) right -= 2;
    if (background > 200 || top >= height * .25 || bottom <= height * .75 || left >= width * .25 || right <= width * .75) { top = 0; bottom = height - 1; left = 0; right = width - 1; }
    const margin = Math.max(4, Math.round(Math.min(width, height) * .008)); left = Math.max(0, left - margin); top = Math.max(0, top - margin); right = Math.min(width - 1, right + margin); bottom = Math.min(height - 1, bottom + margin);
    const output = document.createElement('canvas'); output.width = Math.max(1, right - left + 1); output.height = Math.max(1, bottom - top + 1); const out = output.getContext('2d'); out.filter = 'contrast(1.08)'; out.drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
    const blob = await new Promise((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Bildkorrektur fehlgeschlagen')), 'image/jpeg', .9));
    return { file: new File([blob], file.name.replace(/\.[^.]+$/, '') + '-korrigiert.jpg', { type: 'image/jpeg' }), dataUrl: output.toDataURL('image/jpeg', .9), width: output.width, height: output.height };
  }

  function injectPersonalPages() {
    const main = document.querySelector('main.main'); if (!main || document.querySelector('#montage')) return;
    main.insertAdjacentHTML('beforeend', `<section class="page" id="montage"><div class="section-back"><button data-feature-page="today">← Heute</button></div><div class="page-title"><div><p class="eyebrow">Noahs Montagebereich</p><h1>In zwei Minuten startklar.</h1><p>Vorlage wählen, Besonderheiten ergänzen und Packliste erzeugen.</p></div><button class="primary" data-generate-packlist>PDF-Packliste</button></div><div class="montage-grid"><article class="card"><span class="kicker">Vorbereitung</span><h2>Montage auswählen</h2><label class="field"><span>Vorlage</span><select id="montageTemplateSelect"></select></label><label class="refill-toggle full-equipment"><input id="montageShowAll" type="checkbox"> vollständige Ausrüstung anzeigen</label><label class="field"><span>Notiz für morgen</span><textarea id="montageNote" rows="3" placeholder="z. B. 3. Etage, lange Leiter"></textarea></label><div id="packPreview"></div></article><article class="card"><span class="kicker">Maschinen</span><h2>Ausrüstung verwalten</h2><form id="machineForm" class="stack-form"><input name="name" placeholder="Maschine" required><input name="category" placeholder="Kategorie" value="Werkzeug"><select name="placement"><option value="van">Immer im Montagewagen</option><option value="extra">Extra einpacken</option></select><button class="secondary" type="submit">Maschine hinzufügen</button></form><div id="machineList"></div></article><article class="card"><span class="kicker">Verbrauchsmaterial</span><h2>Material & Nachfüllen</h2><form id="materialForm" class="stack-form"><input name="name" placeholder="Material" required><input name="category" placeholder="Kategorie" value="Montagematerial"><input name="quantity" placeholder="Menge" value="1"><button class="secondary" type="submit">Material hinzufügen</button></form><div id="materialList"></div></article><article class="card"><span class="kicker">Wiederverwendbar</span><h2>Vorlagen</h2><form id="templateForm" class="stack-form"><input name="name" placeholder="z. B. Fenstermontage" required><textarea name="notes" rows="2" placeholder="Hinweise"></textarea><button class="primary" type="submit">Vorlage aus aktuellem Bestand</button></form><div id="templateList"></div></article></div></section><section class="page" id="study"><div class="section-back"><button data-feature-page="today">← Heute</button></div><div class="page-title"><div><p class="eyebrow">Charleens Bereich</p><h1>Studium und Persönliches.</h1><p>Eigene Kategorien, Aufgaben und Dokumentzugriffe – für euch beide einsehbar.</p></div></div><div class="study-grid"><article class="card"><span class="kicker">Neuer Eintrag</span><h2>Aufgabe oder Notiz</h2><form id="studyForm" class="stack-form"><input name="title" placeholder="Titel" required><input name="category" list="studyCategories" placeholder="Kategorie" value="Studium"><datalist id="studyCategories"></datalist><input name="dueOn" type="date"><textarea name="notes" rows="3" placeholder="Notiz"></textarea><button class="primary" type="submit">Speichern</button></form></article><article class="card"><div class="card-head"><div><span class="kicker">Charleen</span><h2>Offene Punkte</h2></div></div><div id="studyList"></div></article><article class="card"><span class="kicker">Ohne Programmierung</span><h2>Eigene Kategorien</h2><form id="studyCategoryForm" class="inline-form"><input name="category" placeholder="Neue Kategorie" required><button class="secondary" type="submit">Hinzufügen</button></form><div id="studyCategoryList" class="category-manager"></div></article><button class="card household-module" data-feature-page="documents"><span class="module-symbol">▤</span><span><small>Charleen</small><strong>Dokumente öffnen</strong><p>Im Dokumentenbereich den Hauptordner Charleen wählen.</p></span><em>→</em></button><button class="card household-module" data-feature-page="calendar"><span class="module-symbol">▦</span><span><small>Persönlich</small><strong>Kalender öffnen</strong><p>Charleens Termine filtern oder ergänzen.</p></span><em>→</em></button></div></section>`);
    const moreGrid = document.querySelector('#more .more-grid');
    moreGrid?.insertAdjacentHTML('afterbegin', '<button class="more-feature" data-feature-page="montage"><span class="large-icon">▣</span><span><small>Noah</small><strong>Montagevorbereitung</strong><p>Maschinen, Material, Vorlagen und PDF-Packliste.</p></span><em>→</em></button><button class="more-feature" data-ws-route="nebenjob"><span class="large-icon">€</span><span><small>Noah</small><strong>Nebenjobs</strong><p>Aufträge, Stempeluhr, Material und Abrechnung.</p></span><em>→</em></button><button class="more-feature" data-feature-page="study"><span class="large-icon people-icon">◎</span><span><small>Charleen</small><strong>Charleens Bereich</strong><p>Studium, Nebenjob, Caritas, Sparziele und Aufgaben.</p></span><em>→</em></button>');
    // Häufig Gebrauchtes zuerst: Dokumente und Rezepte (Lou, Montage, Charleen sind ohnehin über Heute und die Leiste oben erreichbar)
    [moreGrid?.querySelector('[data-jump=recipes]'), moreGrid?.querySelector('[data-page=documents]')].forEach(tile => { if (tile) moreGrid.prepend(tile); });
    bindFeatureNavigation(); bindMontage(); bindStudy(); seedPersonalData(); renderMontage(); renderStudy();
  }

  function seedPersonalData() {
    let changed = false;
    if (state.settings.montageInitialised) return false;
    state.settings.montageInitialised = true; changed = true;
    return changed;
  }

  function bindFeatureNavigation() { document.querySelectorAll('[data-feature-page]').forEach(button => { if (button.dataset.featureBound) return; button.dataset.featureBound = '1'; button.addEventListener('click', event => { event.preventDefault(); go(button.dataset.featurePage); if (button.dataset.featurePage === 'documents') setTimeout(() => { const folder = document.querySelector('#documentFolder'); if (folder && button.closest('#study')) { folder.value = 'Charleen'; filterDocuments(''); } }, 0); }); }); }

  function bindMontage() {
    document.querySelector('#machineForm').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.montageMachines.push({ id: crypto.randomUUID(), ...data, refill: false }); event.currentTarget.reset(); persist(); renderMontage(); });
    document.querySelector('#materialForm').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.montageMaterials.push({ id: crypto.randomUUID(), ...data, refill: false }); event.currentTarget.reset(); persist(); renderMontage(); });
    document.querySelector('#templateForm').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.montageTemplates.push({ id: crypto.randomUUID(), name: data.name, notes: data.notes || '', machineIds: state.montageMachines.map(item => item.id), materialIds: state.montageMaterials.map(item => item.id) }); event.currentTarget.reset(); persist(); renderMontage(); });
    document.querySelector('#montageTemplateSelect').addEventListener('change', renderPackPreview); document.querySelector('#montageShowAll').addEventListener('change', renderPackPreview); document.querySelector('[data-generate-packlist]').addEventListener('click', generatePacklistPdf);
  }

  function renderMontage() {
    if (document.querySelector('#montage')?.dataset.redesigned) return;
    const select = document.querySelector('#montageTemplateSelect'); if (!select) return;
    const selected = select.value; select.innerHTML = state.montageTemplates.map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join('') || '<option value="">Noch keine Vorlage</option>';
    if (state.montageTemplates.some(template => template.id === selected)) select.value = selected;
    document.querySelector('#machineList').innerHTML = state.montageMachines.map(item => `<div class="compact-row"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || '')} · ${item.placement === 'van' ? 'im Wagen' : 'extra einpacken'}</small></span><label class="refill-toggle"><input type="checkbox" data-machine-refill="${item.id}" ${item.refill ? 'checked' : ''}> fehlt</label><button data-edit-machine="${item.id}" aria-label="Maschine bearbeiten">✎</button><button data-delete-machine="${item.id}" aria-label="Maschine löschen">×</button></div>`).join('');
    document.querySelector('#materialList').innerHTML = state.montageMaterials.map(item => `<div class="compact-row"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || '')} · ${escapeHtml(item.quantity || '')}</small></span><label class="refill-toggle"><input type="checkbox" data-material-refill="${item.id}" ${item.refill ? 'checked' : ''}> nachfüllen</label><button data-edit-material="${item.id}" aria-label="Material bearbeiten">✎</button><button data-delete-material="${item.id}" aria-label="Material löschen">×</button></div>`).join('');
    document.querySelector('#templateList').innerHTML = state.montageTemplates.map(item => `<div class="compact-row"><span>${escapeHtml(item.name)}</span><button data-edit-template="${item.id}" aria-label="Vorlage bearbeiten">✎</button><button data-delete-template="${item.id}" aria-label="Vorlage löschen">×</button></div>`).join('');
    document.querySelectorAll('[data-machine-refill]').forEach(input => input.addEventListener('change', () => { const item = state.montageMachines.find(entry => entry.id === input.dataset.machineRefill); item.refill = input.checked; persist(); renderPackPreview(); }));
    document.querySelectorAll('[data-material-refill]').forEach(input => input.addEventListener('change', () => { const item = state.montageMaterials.find(entry => entry.id === input.dataset.materialRefill); item.refill = input.checked; persist(); renderPackPreview(); }));
    [['machine', 'montageMachines'], ['material', 'montageMaterials'], ['template', 'montageTemplates']].forEach(([name, key]) => document.querySelectorAll(`[data-edit-${name}]`).forEach(button => button.addEventListener('click', () => editMontageItem(name, state[key].find(item => item.id === button.dataset[`edit${name[0].toUpperCase()}${name.slice(1)}`])))));
    [['machine', 'montageMachines'], ['material', 'montageMaterials'], ['template', 'montageTemplates']].forEach(([name, key]) => document.querySelectorAll(`[data-delete-${name}]`).forEach(button => button.addEventListener('click', () => { state[key] = state[key].filter(item => item.id !== button.dataset[`delete${name[0].toUpperCase()}${name.slice(1)}`]); persist(); renderMontage(); })));
    renderPackPreview();
  }

  function editMontageItem(type, item) {
    if (!item) return;
    let fields = `<label class="field"><span>Bezeichnung</span><input name="name" value="${escapeHtml(item.name)}" required></label>`;
    if (type === 'template') {
      fields += `<label class="field"><span>Hinweise</span><textarea name="notes">${escapeHtml(item.notes || '')}</textarea></label><div class="template-options"><strong>Benötigte Maschinen</strong>${state.montageMachines.map(entry => `<label><input type="checkbox" name="machineIds" value="${escapeHtml(entry.id)}" ${item.machineIds?.includes(entry.id) ? 'checked' : ''}>${escapeHtml(entry.name)}</label>`).join('')}<strong>Benötigtes Material</strong>${state.montageMaterials.map(entry => `<label><input type="checkbox" name="materialIds" value="${escapeHtml(entry.id)}" ${item.materialIds?.includes(entry.id) ? 'checked' : ''}>${escapeHtml(entry.name)}</label>`).join('')}</div>`;
    } else {
      fields += `<label class="field"><span>Kategorie</span><input name="category" value="${escapeHtml(item.category || '')}" required></label>`;
      fields += type === 'machine' ? `<label class="field"><span>Ablage</span><select name="placement"><option value="van" ${item.placement === 'van' ? 'selected' : ''}>Immer im Montagewagen</option><option value="extra" ${item.placement !== 'van' ? 'selected' : ''}>Extra einpacken</option></select></label>` : `<label class="field"><span>Menge</span><input name="quantity" value="${escapeHtml(item.quantity || '1')}"></label>`;
    }
    const dialog = openFeatureDialog('Eintrag bearbeiten', fields);
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); item.name = String(data.get('name')).trim();
      if (type === 'template') { item.notes = String(data.get('notes') || ''); item.machineIds = data.getAll('machineIds'); item.materialIds = data.getAll('materialIds'); }
      else { item.category = String(data.get('category') || ''); if (type === 'machine') item.placement = data.get('placement'); else item.quantity = data.get('quantity'); }
      persist(); renderMontage(); dialog.close(); toast('Eintrag aktualisiert');
    };
  }

  function currentPacklist() {
    const template = state.montageTemplates.find(item => item.id === document.querySelector('#montageTemplateSelect')?.value) || state.montageTemplates[0];
    const showAll = !!document.querySelector('#montageShowAll')?.checked;
    const machines = state.montageMachines.filter(item => showAll || item.placement === 'extra' || item.refill).filter(item => item.refill || !template || template.machineIds?.includes(item.id));
    const materials = state.montageMaterials.filter(item => item.refill || !template || template.materialIds?.includes(item.id));
    return { template, machines, materials, showAll, note: document.querySelector('#montageNote')?.value || '' };
  }

  function renderPackPreview() { const target = document.querySelector('#packPreview'); if (!target) return; const pack = currentPacklist(); target.innerHTML = `<div class="pack-preview"><h3>${pack.showAll ? 'Vollständige Ausrüstung' : 'Für den Helfer'}</h3><strong>${pack.showAll ? 'Maschinen' : 'Extra einpacken'}</strong>${pack.machines.map(item => `<label><input type="checkbox"> ${escapeHtml(item.name)}${item.refill ? ' · fehlt/nachfüllen' : ''}</label>`).join('') || '<p>Keine zusätzliche Maschine.</p>'}<strong>Material</strong>${pack.materials.map(item => `<label><input type="checkbox"> ${escapeHtml(item.quantity || '1')} ${escapeHtml(item.name)}${item.refill ? ' · nachfüllen' : ''}</label>`).join('') || '<p>Kein Material.</p>'}</div>`; }

  async function generatePacklistPdf() {
    const pack = currentPacklist();
    try {
      await loadExternalScript('vendor/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf; const pdf = new jsPDF(); let y = 18;
      const write = (text, size = 11, gap = 7) => {
        pdf.setFontSize(size); const lines = pdf.splitTextToSize(String(text), 175);
        for (const line of lines) { if (y > 278) { pdf.addPage(); y = 18; } pdf.text(line, 15, y); y += gap; }
      };
      write(`Packliste – ${pack.template?.name || 'Montage'}`, 18, 11);
      write(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 10, 10);
      write(pack.showAll ? 'Maschinen' : 'Extra einpacken', 13, 9);
      (pack.machines.length ? pack.machines : [{ name: 'Keine zusätzliche Maschine' }]).forEach(item => write(`[ ] ${item.name}${item.refill ? ' – fehlt/nachfüllen' : ''}`));
      y += 4; write('Material', 13, 9);
      (pack.materials.length ? pack.materials : [{ name: 'Kein Material', quantity: '' }]).forEach(item => write(`[ ] ${item.quantity || ''} ${item.name}${item.refill ? ' – nachfüllen' : ''}`.trim()));
      const note = [pack.template?.notes, pack.note].filter(Boolean).join('\n'); if (note) { y += 5; write('Hinweis', 13, 9); write(note); }
      pdf.save(`Packliste-${pack.template?.name || 'Montage'}-${todayIso()}.pdf`); toast('PDF-Packliste erstellt');
    } catch { toast('PDF konnte nicht erstellt werden'); }
  }

  function bindStudy() {
    // Charleens Aufgaben: ohne Kategorie, Datum freiwillig (Wunsch Charleen, 16.11.2026).
    const form = document.querySelector('#studyForm'); form.elements.dueOn.value = ''; form.elements.category?.remove(); form.querySelector('#studyCategories')?.remove();
    form.elements.title.placeholder = 'Was ist zu tun?'; form.elements.dueOn.setAttribute('aria-label', 'Datum (freiwillig)'); form.elements.notes.placeholder = 'Notiz (freiwillig)';
    form.elements.dueOn.insertAdjacentHTML('beforebegin', '<small class="study-date-hint">Datum (freiwillig)</small>');
    document.querySelector('#studyCategoryForm')?.closest('article')?.remove();
    form.addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.studyItems.unshift({ id: crypto.randomUUID(), ...data, done: false, createdAt: new Date().toISOString() }); event.currentTarget.reset(); event.currentTarget.dueOn.value = todayIso(); persist(); renderStudy(); toast('Eintrag gespeichert'); });
    document.querySelector('#studyCategoryForm')?.addEventListener('submit', event => { event.preventDefault(); const category = String(new FormData(event.currentTarget).get('category') || '').trim(); if (category && !state.customCategories.study.includes(category)) state.customCategories.study.push(category); event.currentTarget.reset(); persist(); renderStudy(); toast('Kategorie hinzugefügt'); });
  }

  function renderStudy() {
    const list = document.querySelector('#studyList'); if (!list) return;
    const categories = ['Studium', 'Persönlich', ...state.customCategories.study].filter((value, index, values) => values.indexOf(value) === index);
    const studyCategoriesList = document.querySelector('#studyCategories'); if (studyCategoriesList) studyCategoriesList.innerHTML = categories.map(value => `<option value="${escapeHtml(value)}">`).join('');
    const studyCategoryBox = document.querySelector('#studyCategoryList'); if (studyCategoryBox) studyCategoryBox.innerHTML = state.customCategories.study.map(value => `<span>${escapeHtml(value)}<button type="button" data-rename-study-category="${escapeHtml(value)}" aria-label="Kategorie ${escapeHtml(value)} umbenennen">✎</button></span>`).join('') || '<small>Noch keine eigene Kategorie.</small>';
    list.innerHTML = state.studyItems.map(item => `<label class="check-row ${item.done ? 'done' : ''}"><input type="checkbox" data-study-id="${item.id}" ${item.done ? 'checked' : ''}><span class="check-dot"></span><span><strong>${escapeHtml(item.title)}</strong>${item.dueOn ? `<small>${displayDate(item.dueOn)}</small>` : ''}${item.notes ? `<em>${escapeHtml(item.notes)}</em>` : ''}</span><button type="button" class="row-delete" data-delete-study>×</button></label>`).join('') || '<p>Noch kein Eintrag.</p>';
    document.querySelectorAll('[data-study-id]').forEach(input => input.addEventListener('change', () => { const item = state.studyItems.find(entry => entry.id === input.dataset.studyId); item.done = input.checked; persist(); renderStudy(); }));
    document.querySelectorAll('[data-delete-study]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); const id = button.closest('.check-row')?.querySelector('[data-study-id]')?.dataset.studyId; const removed = state.studyItems.find(item => item.id === id); state.studyItems = state.studyItems.filter(item => item.id !== id); persist(); renderStudy(); toastUndo(`${removed?.title || 'Eintrag'} gelöscht`, () => { if (removed && !state.studyItems.some(item => item.id === removed.id)) state.studyItems.unshift(removed); persist(); renderStudy(); }); }));
    document.querySelectorAll('[data-rename-study-category]').forEach(button => button.addEventListener('click', () => renameStudyCategory(button.dataset.renameStudyCategory)));
  }

  function renameStudyCategory(previous) {
    const next = prompt('Neuer Kategoriename', previous)?.trim(); if (!next || next === previous) return;
    state.customCategories.study = state.customCategories.study.filter(category => category !== previous);
    if (!state.customCategories.study.includes(next)) state.customCategories.study.push(next);
    state.studyItems.forEach(item => { if (item.category === previous) item.category = next; });
    persist(); renderStudy(); toast('Kategorie umbenannt');
  }

  function refreshFeatures() { ensureFeatureState(); const changed = normaliseLegacyTasks() | materialiseRecurringTasks() | seedPersonalData() | closePastBudgetMonths(); renderTasksEnhanced(); renderShoppingEnhanced(); renderFinances(); renderUpcoming(); renderMontage(); renderStudy(); renderDocumentCategories(); bindFeatureNavigation(); if (changed && currentUser) persist(); }

  function initialise() {
    ensureFeatureState(); normaliseLegacyTasks(); materialiseRecurringTasks(); injectHome(); injectFinances(); injectDocuments(); injectPersonalPages();
    renderTasks = renderTasksEnhanced; renderShopping = renderShoppingEnhanced;
    const baseRenderAll = renderAll; renderAll = function () { baseRenderAll(); refreshFeatures(); };
    const baseLoadDocuments = loadDocuments; loadDocuments = async function () { await baseLoadDocuments(); filterDocuments(document.querySelector('#documentSearch')?.value || ''); };
    refreshFeatures(); loadWeather(); loadWaste();
    let renderedDay = todayIso();
    const refreshDay = () => { if (renderedDay !== todayIso()) { renderedDay = todayIso(); refreshFeatures(); loadWeather(); loadWaste(); } };
    window.addEventListener('focus', refreshDay); setInterval(refreshDay, 60000);
  }

  window.ZuhauseFeatures = { parseShoppingItem, addShopping, startShoppingVoice, refresh: refreshFeatures, calculateMonth, closePastBudgetMonths };
  initialise();
})();
