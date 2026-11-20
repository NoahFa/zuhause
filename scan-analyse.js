// Dokumentenscanner Phase 2: liest aus dem erkannten Text, was für ein Dokument es ist, von wem, von wann, über welchen Betrag –
// und schlägt Name, Ordner, Kategorie und passende Folgeaktionen vor. Reine Textauswertung, läuft komplett auf dem Handy.
// Gelernte Zuordnungen (Absender → Ordner/Kategorie) liegen im gemeinsamen Zustand unter state.scanRules.
(() => {
  'use strict';
  const MONTHS = { januar: 1, jan: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const validDate = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d && y > 1990 && y < 2100; };
  const addDays = (value, days) => { const t = new Date(`${value}T12:00:00`); t.setDate(t.getDate() + days); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const addMonths = (value, months) => { const t = new Date(`${value}T12:00:00`), day = t.getDate(); t.setDate(1); t.setMonth(t.getMonth() + months); t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const today = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const german = value => value ? value.split('-').reverse().join('.') : '';

  // Typische Lesefehler der Texterkennung in Zahlen ausgleichen (O→0, l/I→1).
  // Ohne „Lookbehind“ geschrieben, damit es auch auf iPhones vor iOS 16.4 läuft.
  const cleanNumber = s => s.replace(/([\d,.])[Oo]/g, '$10').replace(/[Oo](?=[\d,.])/g, '0').replace(/(\d)[lI|]/g, '$11').replace(/[lI|](?=\d)/g, '1');

  // Alle Datumsangaben mit Position: 12.11.2026 · 12.11.26 · 12. November 2026 · 2026-11-12
  function findDates(text) {
    const out = [], t = cleanNumber(text);
    for (const m of t.matchAll(/\b(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})\b/g)) { let [d, mo, y] = [+m[1], +m[2], +m[3]]; if (y < 100) y += 2000; if (validDate(y, mo, d)) out.push({ value: iso(y, mo, d), index: m.index }); }
    for (const m of t.matchAll(/\b(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,9})\.?\s+(\d{4})\b/g)) { const mo = MONTHS[m[2].toLowerCase()]; if (mo && validDate(+m[3], mo, +m[1])) out.push({ value: iso(+m[3], mo, +m[1]), index: m.index }); }
    for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) if (validDate(+m[1], +m[2], +m[3])) out.push({ value: iso(+m[1], +m[2], +m[3]), index: m.index });
    return out.sort((a, b) => a.index - b.index);
  }
  // Betrag: 1.234,56 · 75,00 · 75.00 – aber nicht Teil eines Datums (26.11.2026) oder einer längeren Zahl
  const AMOUNT = /(^|[^\d,.])(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})(?![\d]|[.,]\d)/g;
  // Datumsangaben vor der Betragssuche entfernen – auch ohne Jahr („bis 26.11.“), sonst würde daraus 26,11 €
  const DATE_LIKE = /\b\d{1,2}\s?[./-]\s?\d{1,2}\s?[./-]\s?\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?!\d)/g;
  const parseAmount = s => { s = s.replace(/\s/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Number(s); };
  function amountsIn(line) { return [...cleanNumber(line).replace(DATE_LIKE, ' ').matchAll(AMOUNT)].map(m => parseAmount(m[2])).filter(n => Number.isFinite(n) && n > 0 && n < 1e6); }

  // Der Gesamtbetrag: Zeile mit „Gesamt/Summe/Endbetrag/zu zahlen …“, sonst der größte Betrag mit Euro-Bezug
  function findTotal(lines, kind) {
    const keys = kind === 'payslip' ? /auszahlung|netto\s*(betrag|verdienst|bezug)?|überweisung/i : /gesamt\s*(betrag|summe)?|endbetrag|rechnungsbetrag|zu zahlen|zahlbetrag|summe|total|betrag/i;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!keys.test(lines[i]) || /zwischen|netto(?!.*gesamt)|mwst|ust|steuer\s*\d/i.test(lines[i]) && kind !== 'payslip') continue;
      // mehrere Zahlen in der Zeile: die mit Euro-Zeichen bzw. Komma-Schreibweise bevorzugen
      // auch ganze Euro-Beträge mit Euro-Zeichen („75 €“, „1.250 €“)
      const euro = [...cleanNumber(lines[i]).replace(DATE_LIKE, ' ').matchAll(/(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d{1,3}(?:\.\d{3})+|\d+)(?:,-)?\s*(?:€|eur\b)/gi)].map(m => parseAmount(/^\d{1,3}(\.\d{3})+$/.test(m[1]) ? m[1].replace(/\./g, '') : m[1])).filter(n => n > 0 && n < 1e6);
      if (euro.length) return euro[euro.length - 1];
      const own = amountsIn(lines[i]); if (own.length) return own[own.length - 1];
      const next = amountsIn(lines[i + 1] || ''); if (next.length) return next[0];
    }
    const euroLines = lines.filter(l => /€|eur\b/i.test(l)).flatMap(amountsIn);
    return euroLines.length ? Math.max(...euroLines) : null;
  }

  const TYPES = [
    { key: 'payslip', label: 'Lohnabrechnung', test: /lohnabrechnung|gehaltsabrechnung|verdienstabrechnung|entgeltabrechnung|abrechnung der brutto|brutto.?netto/i, category: /lohn|gehalt|steuer/i },
    { key: 'tax', label: 'Steuer', test: /finanzamt|steuerbescheid|einkommensteuer|lohnsteuerbescheinigung|steuer-?id|steueridentifikations/i, category: /steuer/i },
    { key: 'vaccination', label: 'Impfung', test: /impfung|impfpass|tollwut|staupe|parvo|leptospir|heimtierausweis|impfstoff/i, category: /lou|tier|gesund|impf/i },
    { key: 'receipt', label: 'Kassenbon', test: /kassenbon|bon-?nr|beleg-?nr|kartenzahlung|ec-?karte|girocard|bar\s*gegeben|rückgeld|kasse\s*\d|summe\s*eur|vielen dank für ihren einkauf/i, category: /rechnung|beleg|quittung|kassen/i },
    { key: 'invoice', label: 'Rechnung', test: /rechnung|rechnungs-?nr|zahlbar|zahlungsziel|fällig|bitte überweisen|iban/i, category: /rechnung/i },
    { key: 'insurance', label: 'Versicherung', test: /versicherung|versicherungsschein|police|versicherungsnummer|beitragsrechnung/i, category: /versicherung/i },
    { key: 'contract', label: 'Vertrag', test: /vertrag|vertragsnummer|kündigungsfrist|mindestlaufzeit|vertragslaufzeit|laufzeit/i, category: /vertr/i },
    { key: 'study', label: 'Hochschule', test: /hochschule|universität|semester|immatrikulation|studienbescheinigung|prüfungsamt|modul/i, category: /studi|hochschule|uni/i },
  ];
  const FOLDERS = [
    ['Lou', /\blou\b|tierarzt|tierärzt|tierklinik|hund|heimtier|tollwut|staupe|wurmkur|futter|chip-?nr|transponder/i],
    ['Charleen', /charleen|kolping|caritas|kauler\s*hof|hochschule|semester|immatrikul|studierend/i],
    ['Noah', /\bnoah\b/i],
  ];
  const DIY = /bauhaus|hornbach|obi\b|toom|hagebau|würth|wuerth|bauzentrum|holzhandel|baumarkt|schrauben|dübel|silikon|leim|profil|beschlag/i;
  const GENERIC = /^(rechnung|kassenbon|quittung|beleg|seite|datum|kunde|kundennummer|tel|telefon|fax|www|e-?mail|steuer|ust|mwst|herr|frau|an|bitte|lohn|gehalt)\b/i;

  // Absender: Zeile mit Firmen-/Praxis-Kennzeichen, sonst erste sinnvolle Zeile oben auf der Seite
  function findSender(lines) {
    const head = lines.slice(0, 12);
    const marked = head.find(l => /gmbh|\bag\b|\be\.?\s?v\.?\b|\bkg\b|\bug\b|praxis|tierarzt|tierklinik|stadtwerke|versicherung|bank|sparkasse|hochschule|finanzamt|markt|apotheke|bäckerei|\bmarkt\b/i.test(l) && /[a-zäöü]{3}/i.test(l) && l.length <= 60);
    const first = head.find(l => !GENERIC.test(l) && /[A-Za-zÄÖÜäöü]{4}/.test(l) && !/\d{4,}/.test(l) && l.length >= 4 && l.length <= 50);
    const raw = (marked || first || '').replace(/[|_~*#]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return raw.replace(/\s*[-–,]\s*$/, '').slice(0, 45);
  }
  // nur ganze Rechtsform-Wörter entfernen (sonst wird z. B. „Evangelische“ zu „angelische“)
  const senderKey = sender => ` ${String(sender || '').toLowerCase()} `.replace(/[\s,]+(gmbh|co\.?|kg|ag|e\.\s?v\.?|ev|ug|ohg|mbh)(?=[\s,.]|$)/g, ' ').replace(/&/g, ' ').replace(/[^a-zäöüß0-9]+/g, ' ').trim().split(' ').slice(0, 3).join(' ');

  function analyse(text, categories = [], rules = {}) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean), all = lines.join('\n');
    let best = null, bestScore = 0;
    for (const type of TYPES) { const score = (all.match(new RegExp(type.test.source, 'gi')) || []).length; if (score > bestScore) { best = type; bestScore = score; } }
    // Kassenbon schlägt Rechnung nur mit deutlichen Kassen-Merkmalen; Lohnabrechnung/Steuer/Impfung haben Vorrang
    const has = key => TYPES.find(x => x.key === key).test.test(all);
    const invoiceLike = /rechnung|zahlbar|zahlungsziel|bitte überweisen/i.test(all);
    const realTax = /finanzamt|steuerbescheid|einkommensteuer|lohnsteuerbescheinigung/i.test(all);
    for (const key of ['payslip', 'tax', 'vaccination']) { if (key === 'vaccination' && invoiceLike) continue; if (key === 'tax' && invoiceLike && !realTax) continue; if (has(key)) { best = TYPES.find(x => x.key === key); break; } }
    if (best?.key === 'vaccination' && invoiceLike) best = TYPES.find(x => x.key === 'invoice'); // Tierarzt-Rechnung mit Impfung heißt „Rechnung“
    const kind = best?.key || 'other';
    const dates = findDates(all), sender = findSender(lines);
    const near = re => { const m = all.match(re); if (!m) return null; const after = dates.find(d => d.index >= m.index && d.index - m.index < 80); return after?.value || null; };
    // Fälligkeit: zuerst ein Datum in derselben Zeile wie „zahlbar bis …“; nur wenn dort keins steht, die nächste Zeile –
    // aber nicht, wenn sie selbst ein anderes Datum benennt (z. B. „Rechnungsdatum“ direkt darunter)
    const DUE = /zahlbar\s*(bis|am)?|zu zahlen\s*(bis|am)?|fällig\s*(am|bis)?|zahlungsziel|spätestens|bis zum/i;
    let due = (() => {
      const m = all.match(DUE); if (!m) return null;
      const lineEnd = all.indexOf('\n', m.index), sameLine = dates.find(d => d.index >= m.index && (lineEnd < 0 || d.index < lineEnd));
      if (sameLine) return sameLine.value;
      if (/(?:zahlbar|zu zahlen|fällig)[^\n\d]{0,20}\d{1,2}\.\d{1,2}\.(?!\d)/i.test(all.slice(m.index, lineEnd < 0 ? undefined : lineEnd))) return null; // ohne Jahr: Regel weiter unten
      const nextEnd = lineEnd < 0 ? -1 : all.indexOf('\n', lineEnd + 1), nextLine = lineEnd < 0 ? '' : all.slice(lineEnd + 1, nextEnd < 0 ? undefined : nextEnd);
      if (lineEnd < 0 || /datum|vom\b/i.test(nextLine)) return null; // letzte Zeile: es gibt keine nächste
      return dates.find(d => d.index > lineEnd && (nextEnd < 0 || d.index < nextEnd))?.value || null;
    })();
    // Dokumentdatum: zuerst ausdrückliches Rechnungs-/Belegdatum, dann „Datum“ (nicht Liefer-/Leistungsdatum), sonst erstes Datum, das keine Frist ist
    const plainDate = (() => { const re = /(^|[^a-zäöü])(datum|vom)\b/gi; let m; while ((m = re.exec(all))) { const i = m.index; const after = dates.find(d => d.index >= i && d.index - i < 80); if (after) return after.value; } return null; })();
    const deadlines = new Set([due, near(/vertragsende|laufzeit\s*bis|endet\s*am|gültig bis|lieferdatum|leistungsdatum/i)].filter(Boolean));
    const docDate = near(/(rechnungs|beleg|ausstellungs|bescheid)datum/i) || plainDate || dates.find(d => !deadlines.has(d.value))?.value || null;
    const days = all.match(/(?:innerhalb|binnen)\s+(?:von\s+)?(\d{1,3})\s+tag/i); if (!due && days && docDate) due = addDays(docDate, +days[1]);
    // „zahlbar bis 26.11.“ ohne Jahr: Jahr vom Dokumentdatum (bzw. heute), liegt es davor, das Folgejahr
    if (!due) { const m = all.match(/(?:zahlbar|zu zahlen|fällig)[^\n\d]{0,20}(\d{1,2})\.(\d{1,2})\.(?!\d)/i); if (m) { const base = docDate || today(); let y = Number(base.slice(0, 4)); if (validDate(y, +m[2], +m[1])) { let d = iso(y, +m[2], +m[1]); if (d < base && validDate(y + 1, +m[2], +m[1])) d = iso(y + 1, +m[2], +m[1]); due = d; } } }
    const total = findTotal(lines, kind);
    // Vertrag: Ende + Kündigungsfrist → Erinnerung zwei Wochen vor Fristende
    let reminder = null, reminderNote = '';
    if (kind === 'contract' || kind === 'insurance') {
      const end = near(/vertragsende|laufzeit\s*bis|endet\s*am|ablauf|bis zum|gültig bis/i);
      // Frist als Ziffer oder Wort („drei Monate“); steht nur „Kündigungsfrist“ ohne Zahl da, vorsichtshalber 3 Monate
      const WORDS = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
      let notice = all.match(/kündigungsfrist[^.\n]{0,40}?(\d{1,2}|ein(?:e[mnr]?)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(monat|woche|tag)/i);
      if (notice && !/^\d/.test(notice[1])) notice = [notice[0], String(WORDS[notice[1].toLowerCase()] || 1), notice[2]];
      let assumed = false;
      if (!notice && /kündigungsfrist/i.test(all)) { notice = ['', '3', 'Monat']; assumed = true; }
      if (end) { let last = end; if (notice) last = notice[2].toLowerCase().startsWith('monat') ? addMonths(end, -notice[1]) : addDays(end, -(notice[1] * (notice[2].toLowerCase().startsWith('woche') ? 7 : 1))); reminder = addDays(last, -14); reminderNote = `Vertragsende ${german(end)}${notice ? `, Kündigungsfrist ${notice[1]} ${notice[2]}${+notice[1] > 1 ? (notice[2].toLowerCase().startsWith('monat') ? 'e' : 'n') : ''}${assumed ? ' (angenommen – Frist bitte im Vertrag prüfen)' : ''}` : ''}`; }
      // Frist schon vorbei? Dann verlängert sich der Vertrag meist um ein Jahr → nächste Frist erinnern (statt „heute + 11 Monate“)
      if (reminder && reminder < today()) { const years = Math.ceil((Number(today().slice(0, 4)) - Number(reminder.slice(0, 4))) || 1); reminder = addMonths(reminder, 12 * years); if (reminder < today()) reminder = addMonths(reminder, 12); } // direkt gerechnet statt höchstens 10 Schritte
      if (!reminder) { reminder = addMonths(today(), 11); reminderNote ||= 'Vertrag prüfen (Laufzeit/Kündigung)'; }
    }
    // Ordner: zuerst gelernte Regel, dann Stichworte
    const key = senderKey(sender), rule = key && rules[key];
    const folder = rule?.folder || FOLDERS.find(([, re]) => re.test(all))?.[0] || null;
    const wantedCategory = best?.category;
    const category = rule?.category && categories.includes(rule.category) ? rule.category : (wantedCategory && categories.find(c => wantedCategory.test(c))) || null;
    const label = best?.label || 'Dokument';
    const parts = [label]; if (sender && !sender.toLowerCase().includes(label.toLowerCase())) parts.push(sender); if (docDate) parts.push(`– ${german(docDate)}`);
    const name = parts.length > 1 ? parts.join(' ') : '';
    return { kind, label, vaccination: has('vaccination'), sender, senderKey: key, docDate, due, total, reminder, reminderNote, folder, category, name, diy: DIY.test(all), learned: !!rule };
  }

  // Merken: Absender → gewählter Ordner und Kategorie (höchstens 200 Einträge)
  function learn(key, folder, category) {
    if (!key || key.length < 3) return;
    const rules = state.scanRules && typeof state.scanRules === 'object' ? state.scanRules : (state.scanRules = {});
    const old = rules[key]; if (old && old.folder === folder && old.category === category) return;
    rules[key] = { folder, category, at: new Date().toISOString() };
    const keys = Object.keys(rules); if (keys.length > 200) keys.sort((a, b) => String(rules[a].at).localeCompare(String(rules[b].at))).slice(0, keys.length - 200).forEach(k => delete rules[k]);
  }

  window.ZuhauseScanAnalyse = { analyse, learn, findDates, findTotal, findSender, senderKey, german };
})();
