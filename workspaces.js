(() => {
  'use strict';
  const h = escapeHtml;
  let selectedJobId = null;
  let montageTab = 'order';
  let equipmentTab = 'machines';
  let lastWorkspace = 'shared';
  const page = document.querySelector('#montage');
  page.dataset.redesigned = '1';
  const uid = () => crypto.randomUUID();
  const field = (label, name, value = '', type = 'text', extra = '') => `<label class="ws-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value)}" ${extra}></label>`;
  const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('de-DE', {day:'numeric',month:'long'}) : 'Ohne Datum';
  function ensure() {
    if (!Array.isArray(state.montageJobs)) state.montageJobs = [];
    if (!state.montageJobs.some(item=>item.id===selectedJobId)) selectedJobId=state.settings.lastMontageJobId||state.montageJobs.find(item=>item.status!=='done')?.id||state.montageJobs[0]?.id||null;
  }
  function job() { ensure(); return state.montageJobs.find(item => item.id === selectedJobId); }
  function save() { persist(); render(true); }
  function changeJob(update, redraw=true) { const item = job(); if (!item) return; update(item); item.updatedAt = new Date().toISOString(); if(redraw)save();else persist(); }
  function openDialog(title, html, onSave, submitLabel = 'Speichern') {
    let dialog = document.querySelector('#workspaceDialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id='workspaceDialog'; document.body.append(dialog); }
    dialog.innerHTML = `<form><div class="dialog-head"><div><span class="kicker">Noahs Montage</span><h2>${h(title)}</h2></div><button class="close" type="button" data-ws-close aria-label="Schließen">×</button></div><div class="ws-dialog-fields">${html}</div><div class="dialog-actions"><button class="secondary" type="button" data-ws-close>Abbrechen</button><button class="primary" type="submit">${h(submitLabel)}</button></div></form>`;
    dialog.querySelectorAll('[data-ws-close]').forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector('form').onsubmit = event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (onSave(data) !== false) dialog.close(); };
    dialog.showModal();
    return dialog;
  }
  function route(target) { go(target); }
  function workspaceFor(target) { return target === 'noah' || target === 'montage' || target === 'nebenjob' ? 'noah' : target === 'study' ? 'charleen' : 'shared'; }
  function workspaceNav(target) {
    lastWorkspace = workspaceFor(target);
    document.body.dataset.workspace = lastWorkspace;
    document.querySelectorAll('[data-space]').forEach(button => { const active = button.dataset.space === lastWorkspace; button.classList.toggle('active',active); button.setAttribute('aria-pressed', String(active)); });
  }
  function installNavigation() {
    const switcher = `<nav class="workspace-switch" aria-label="Bereich wählen"><button data-space="shared"><span>⌂</span><strong>Gemeinsam</strong></button><button data-space="noah"><span class="ws-avatar noah-avatar">N</span><strong>Noah</strong></button><button data-space="charleen"><span class="ws-avatar charleen-avatar">C</span><strong>Charleen</strong></button></nav>`;
    document.querySelector('.topbar').insertAdjacentHTML('afterend',switcher);
    document.querySelector('.sidebar .nav-list').insertAdjacentHTML('beforebegin','<div class="sidebar-spaces"><span class="kicker">Eure Bereiche</span><button data-space="shared">⌂ Gemeinsam</button><button data-space="noah">N Noahs Bereich</button><button data-space="charleen">C Charleens Bereich</button><span class="kicker">Gemeinsamer Alltag</span></div>');
    document.querySelector('.mobile-nav').innerHTML = '<button data-ws-route="today" data-page="today"><span>⌂</span>Heute</button><button data-ws-route="calendar" data-page="calendar"><span>▦</span>Kalender</button><button data-ws-route="household" data-page="household"><span>✓</span>Haushalt</button><button data-ws-route="finances" data-page="finances"><span>€</span>Finanzen</button><button data-ws-route="more" data-page="more"><span>•••</span>Mehr</button>';
    const originalGo = go;
    go = function(target) { originalGo(target); workspaceNav(target); if(target==='noah'||target==='montage') render(); };
    document.addEventListener('click', event => {
      const space=event.target.closest('[data-space]');
      const link=event.target.closest('[data-ws-route]');
      if (space) { route({shared:'today',noah:'noah',charleen:'study'}[space.dataset.space]); }
      if (link) { route(link.dataset.wsRoute); }
    });
    document.querySelector('#today .quick-actions [data-feature-page="montage"]')?.setAttribute('data-ws-route','noah');
    workspaceNav(document.querySelector('.page.active')?.id || 'today');
  }
  function installPages() {
    document.querySelector('main.main').insertAdjacentHTML('beforeend','<section class="page ws-personal" id="noah"></section>');
    page.classList.add('ws-personal');
    const study=document.querySelector('#study'); study.classList.add('ws-personal','charleen-workspace');
    const people=document.querySelector('#people');
    people.innerHTML='<div class="page-title"><div><p class="eyebrow">Eure persönlichen Oberflächen</p><h1>Welchen Bereich möchtest du öffnen?</h1><p>Eigene Übersichten für euch beide. Alle Inhalte bleiben für beide sichtbar.</p></div></div><div class="ws-template-grid"><article class="card ws-template-card"><span class="kicker">Noah</span><h3>Montage & Arbeitsalltag</h3><p>Aufträge vorbereiten, Material planen, Vorlagen und Ausrüstung verwalten.</p><button class="primary" data-space="noah">Noahs Bereich öffnen</button></article><article class="card ws-template-card"><span class="kicker">Charleen</span><h3>Studium & Persönliches</h3><p>Studium, Nebenjob, Caritas, Sparziele und Aufgaben im Blick behalten.</p><button class="primary" data-space="charleen">Charleens Bereich öffnen</button></article><article class="card ws-template-card"><span class="kicker">Gemeinsam</span><h3>Euer Zuhause</h3><p>Familienkalender, Haushalt, Einkäufe, Mülltermine und gemeinsame Finanzen.</p><button class="secondary" data-space="shared">Gemeinsamen Bereich öffnen</button></article></div>';
    study.querySelector('.page-title').innerHTML='<div><p class="eyebrow">Dein eigener Bereich</p><h1>Charleen.</h1><p>Platz für dein Studium, persönliche Aufgaben, Termine und Unterlagen.</p></div><span class="ws-personal-badge charleen-avatar">C</span>';
    study.querySelector('.section-back')?.remove();
    study.querySelector('.page-title').insertAdjacentHTML('afterend','<div class="ws-intro"><strong>Deine Übersicht</strong><p>Deine Aufgaben und Kategorien verwaltest du hier. Termine und Dokumente bleiben mit eurem gemeinsamen Zuhause verbunden.</p></div>');
  }
  function renderNoah() {
    const open=state.montageJobs.filter(item=>item.status!=='done').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    document.querySelector('#noah').innerHTML=`<div class="ws-personal-title"><div><p class="eyebrow">Dein eigener Bereich</p><h1>Noah.</h1><p>Deine Aufträge. Deine Vorbereitung. Alles für den nächsten Montagetag.</p></div><span class="ws-personal-badge noah-avatar">N</span></div><article class="ws-start-card"><span class="kicker">Montagevorbereitung</span><h2>Was steht als Nächstes an?</h2><p>Starte mit einer Vorlage oder einem leeren Auftrag. Material, Arbeitsschritte und Packliste gehören anschließend genau zu diesem Auftrag.</p><button class="primary ws-large" data-new-job>＋ Auftrag vorbereiten</button><div class="ws-secondary-actions"><button class="secondary" data-open-montage-tab="van">Verbrauchsmaterial Auto${vanDue()?` · ${vanDue()} auffüllen`:''}</button><button class="secondary" data-open-montage-tab="templates">Vorlagen verwalten</button><button class="secondary" data-open-montage-tab="equipment">Maschinen verwalten</button></div></article>${window.ZuhauseNoahJobs?.summaryCard?.()||''}<div class="ws-section-head"><div><span class="kicker">Dein Arbeitsalltag</span><h2>Offene Montageaufträge</h2></div><span class="ws-count">${open.length}</span></div><div class="ws-job-grid">${open.map(item=>jobCard(item)).join('')||'<div class="ws-empty"><strong>Noch kein Auftrag vorbereitet.</strong><p>Lege deinen ersten Auftrag an und stelle seine Packliste zusammen.</p></div>'}</div>${state.montageJobs.some(item=>item.status==='done')?`<details class="ws-history"><summary>Abgeschlossene Aufträge</summary><div class="ws-job-grid">${state.montageJobs.filter(item=>item.status==='done').map(jobCard).join('')}</div></details>`:''}<div class="ws-personal-links"><button data-ws-route="calendar">▦ Kalender öffnen →</button><button data-ws-route="documents">▤ Dokumente öffnen →</button></div>`;
  }
  function jobCard(item) {
    const tasks=item.tasks||[]; const done=tasks.filter(t=>t.done).length;
    return `<button class="ws-job-card" data-open-job="${h(item.id)}"><span class="ws-card-top"><small>${h(dateLabel(item.date))}</small><em>${item.status==='done'?'Abgeschlossen':item.status==='ready'?'Vorbereitet':'In Vorbereitung'}</em></span><strong>${h(item.title)}</strong><p>${h(item.templateName||'Ohne Vorlage')} · ${item.materials.length} Materialien</p><span>${done} / ${tasks.length} Arbeitsschritte erledigt <b>Auftrag öffnen →</b></span></button>`;
  }
  function render(force=false) {
    ensure(); renderNoah(); window.ZuhauseCalendar?.setMontageJobs?.(state.montageJobs);
    if(!force&&page.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
    page.innerHTML=`<div class="section-back"><button data-ws-route="noah">← Noahs Übersicht</button></div><div class="ws-montage-title"><div><p class="eyebrow">Noahs Arbeitsbereich</p><h1>Montage vorbereiten.</h1><p>Ein Auftrag für heute. Vorlagen für das nächste Mal.</p></div><button class="primary" data-new-job>＋ Neuer Auftrag</button></div><nav class="ws-tabs" aria-label="Montagebereich"><button data-montage-tab="order" class="${montageTab==='order'?'active':''}">Aktueller Auftrag</button><button data-montage-tab="van" class="${montageTab==='van'?'active':''}">Material Auto${vanDue()?` <b class="ws-tab-count">${vanDue()}</b>`:''}</button><button data-montage-tab="templates" class="${montageTab==='templates'?'active':''}">Vorlagen</button><button data-montage-tab="equipment" class="${montageTab==='equipment'?'active':''}">Maschinen</button></nav><div id="montageWorkspaceBody">${montageTab==='templates'?templatesView():montageTab==='equipment'?equipmentView():montageTab==='van'?vanView():orderView()}</div>`;
    if(montageTab==='order'&&job()){
      ['job-work','job-material','job-pack'].forEach((id,index)=>{page.querySelectorAll('.ws-step')[index].id=id;});
      page.querySelector('.ws-order-heading').insertAdjacentHTML('afterend','<nav class="ws-stage-jumps" aria-label="Zum Auftragsschritt springen"><a href="#job-work">1 · Arbeit</a><a href="#job-material">2 · Material</a><a href="#job-pack">3 · Packliste</a></nav>');
    }
  }
  function newJob(templateId = '') {
    openDialog('Auftrag vorbereiten', `<p class="ws-help">Die Vorlage wird in den Auftrag kopiert. Du kannst danach alles für diesen Einsatz anpassen.</p><label class="ws-field"><span>Mit welcher Vorlage starten?</span><select name="templateId"><option value="">Leerer Auftrag – selbst zusammenstellen</option>${state.montageTemplates.map(t=>`<option value="${h(t.id)}" ${t.id===(templateId||state.settings.lastTemplateId)?'selected':''}>${h(t.name)}</option>`).join('')}</select></label>${field('Wie heißt der Auftrag?','title','','text','required placeholder="z. B. Fenster bei Familie Müller" maxlength="160"')}${field('Montagetag','date',todayIso(),'date','required')}${field('Adresse (optional)','address','','text','maxlength="200" placeholder="Straße, Ort – für die Route" autocomplete="street-address"')}`, data => {
      const template=state.montageTemplates.find(t=>t.id===data.get('templateId'));
      state.settings.lastTemplateId=template?.id||'';
      const id=uid();
      state.montageJobs.unshift({id,title:String(data.get('title')).trim(),date:data.get('date'),address:String(data.get('address')||'').trim(),templateId:template?.id||null,templateName:template?.name||'',notes:template?.notes||'',status:'draft',machines:state.montageMachines.filter(m=>template?.machineIds?.includes(m.id)).map(m=>({...structuredClone(m),checked:false})),materials:state.montageMaterials.filter(m=>template?.materialIds?.includes(m.id)).map(m=>({...structuredClone(m),quantity:template?.materialQuantities?.[m.id]||m.quantity||'1',checked:false})),tasks:(template?.tasks||[]).map(title=>({id:uid(),title,done:false})),createdAt:new Date().toISOString()});
      selectedJobId=id;state.settings.lastMontageJobId=id;montageTab='order';save();route('montage');
    }, 'Auftrag anlegen');
  }
  function orderView() {
    const item=job();
    if (!item) return `<div class="ws-empty"><h2>Welchen Auftrag bereitest du vor?</h2><p>Wähle einen vorhandenen Auftrag oder starte eine neue Montage.</p><button class="primary ws-large" data-new-job>＋ Auftrag vorbereiten</button></div><div class="ws-job-grid">${state.montageJobs.map(jobCard).join('')}</div>`;
    return `<div class="ws-order-heading"><div><span class="kicker">${h(dateLabel(item.date))} · ${item.status==='done'?'Abgeschlossen':item.status==='ready'?'Vorbereitet':'In Vorbereitung'}</span><h2>${h(item.title)}</h2><p>${item.templateName?`Aus Vorlage „${h(item.templateName)}“`:'Individuell zusammengestellt'} · Änderungen gelten nur für diesen Auftrag.</p>${item.address?`<a class="ws-route-link" href="https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}" target="_blank" rel="noopener">📍 ${h(item.address)} · Route öffnen →</a>`:''}</div><button class="secondary" data-edit-job>Auftragsdaten bearbeiten</button></div><div class="ws-workflow"><section class="card ws-step"><div class="ws-step-heading"><span>1</span><div><small>Was wird gemacht?</small><h2>Arbeitsschritte</h2></div></div><form id="jobTaskForm" class="ws-inline"><label class="ws-field"><span>Arbeitsschritt ergänzen</span><input name="title" placeholder="z. B. Alte Fenster ausbauen" required maxlength="240"></label><button class="primary">＋ Hinzufügen</button></form><div class="ws-task-list">${item.tasks.map(task=>`<div class="ws-task-row"><label><input type="checkbox" data-job-task="${h(task.id)}" ${task.done?'checked':''}><span>${h(task.title)}</span></label><button class="ws-remove" data-remove-job-task="${h(task.id)}" aria-label="Arbeitsschritt entfernen">×</button></div>`).join('')||'<p class="ws-muted">Noch keine Arbeitsschritte. Ergänze, was ihr vor Ort erledigen müsst.</p>'}</div></section><section class="card ws-step"><div class="ws-step-heading"><span>2</span><div><small>Was muss mit?</small><h2>Material für diesen Auftrag</h2></div></div><p class="ws-help">Hier änderst du Mengen und ergänzt zusätzliches Material. Deine Vorlage bleibt erhalten.</p><form id="jobMaterialForm" class="ws-material-form"><label class="ws-field"><span>Material</span><input name="name" list="jobMaterialCatalog" placeholder="z. B. Montageschaum" required maxlength="160"></label><label class="ws-field"><span>Menge / Einheit</span><input name="quantity" placeholder="z. B. 3 Dosen" required maxlength="60"></label><button class="primary">＋ Material ergänzen</button></form><datalist id="jobMaterialCatalog">${state.montageMaterials.map(m=>`<option value="${h(m.name)}">`).join('')}</datalist><div class="ws-material-list">${item.materials.map(m=>`<div class="ws-material-row"><span><strong>${h(m.name)}</strong><small>${h(m.category||'Auftragsmaterial')}${m.refill?' · nachfüllen':''}</small></span><label class="ws-field"><span>Menge</span><input value="${h(m.quantity||'1')}" data-job-quantity="${h(m.id)}" aria-label="Menge ${h(m.name)}" maxlength="60"></label><button class="ws-remove" data-remove-job-material="${h(m.id)}" aria-label="Material entfernen">×</button></div>`).join('')||'<p class="ws-muted">Noch kein Material. Wähle einen bekannten Artikel oder gib einen neuen ein.</p>'}</div><div class="ws-subsection-head"><h3>Maschinen & Werkzeug</h3><button class="secondary" data-pick-job-machines>Maschinen auswählen</button></div><div class="ws-machine-chips">${item.machines.map(m=>`<span><strong>${h(m.name)}</strong><small>${m.placement==='van'?'Im Montagewagen':'Extra einpacken'}</small></span>`).join('')||'<p class="ws-muted">Noch keine Maschine ausgewählt.</p>'}</div></section><section class="card ws-step"><div class="ws-step-heading"><span>3</span><div><small>Ist alles vorbereitet?</small><h2>Packliste für den Helfer</h2></div></div><p class="ws-help">Zusätzliche Maschinen, Material und offene Nachfüllartikel. Abgehakte Punkte bleiben gespeichert.</p><div id="jobPackList">${packView(item)}</div><label class="ws-field ws-note"><span>Hinweise für diesen Auftrag</span><textarea id="jobNotes" rows="3" placeholder="z. B. Zugang über den Hof, lange Leiter mitnehmen">${h(item.notes)}</textarea></label><div class="ws-order-actions"><button class="primary ws-large" data-job-pdf>PDF-Packliste erstellen</button><button class="secondary" data-job-status="${item.status==='ready'?'draft':'ready'}">${item.status==='ready'?'Wieder in Vorbereitung':'Als vorbereitet markieren'}</button><button class="secondary" data-job-status="${item.status==='done'?'draft':'done'}">${item.status==='done'?'Auftrag wieder öffnen':'Auftrag abschließen'}</button></div><button class="ws-text-button" data-job-to-template>Diese Zusammenstellung als neue Vorlage speichern →</button></section></div>`;
  }
  function packing(item, all=false) {
    const machines=item.machines.filter(m=>all||m.placement!=='van'||m.refill);
    const materials=[...item.materials];
    state.montageMaterials.filter(m=>m.refill&&!materials.some(row=>row.id===m.id||row.catalogId===m.id)).forEach(m=>materials.push({...m,refill:true,catalogOnly:true,checked:!!item.extraPackChecks?.['materials:'+m.id]}));
    state.montageMachines.filter(m=>m.refill&&!machines.some(row=>row.id===m.id)).forEach(m=>machines.push({...m,refill:true,catalogOnly:true,checked:!!item.extraPackChecks?.['machines:'+m.id]}));
    return {machines,materials};
  }
  function packView(item) {
    const p=packing(item);
    const rows=(list,type)=>list.map(m=>`<label class="ws-pack-row"><input type="checkbox" data-job-pack="${type}:${h(m.id)}" ${m.checked?'checked':''}><span><strong>${h(m.quantity?m.quantity+' '+m.name:m.name)}</strong><small>${m.refill?'Nachfüllen / fehlt':type==='machines'?'Extra einpacken':'Auftragsmaterial'}</small></span></label>`).join('');
    return `<h3>Extra einpacken</h3>${rows(p.machines,'machines')||'<p class="ws-muted">Keine zusätzliche Maschine.</p>'}<h3>Material & Nachfüllen</h3>${rows(p.materials,'materials')||'<p class="ws-muted">Kein Material eingetragen.</p>'}<details class="ws-equipment-details"><summary>Vollständige Ausrüstung dieses Auftrags anzeigen</summary>${item.machines.map(m=>`<p>${h(m.name)} · ${m.placement==='van'?'im Wagen':'extra einpacken'}</p>`).join('')||'<p>Keine Maschine gewählt.</p>'}</details>`;
  }
  function templatesView() {
    return `<div class="ws-section-head"><div><h2>Deine Montagevorlagen</h2><p>Eine Vorlage enthält das, was du für diese Montageart normalerweise brauchst.</p></div><button class="primary" data-new-template>＋ Neue Vorlage</button></div><div class="ws-template-grid">${state.montageTemplates.map(t=>`<article class="card ws-template-card"><span class="kicker">Wiederverwendbare Vorlage</span><h3>${h(t.name)}</h3><p>${t.machineIds?.length||0} Maschinen · ${t.materialIds?.length||0} Materialien · ${t.tasks?.length||0} Arbeitsschritte</p>${t.notes?`<p class="ws-muted">${h(t.notes)}</p>`:''}<button class="primary" data-job-from-template="${h(t.id)}">Auftrag aus Vorlage vorbereiten</button><button class="secondary" data-ws-edit-template="${h(t.id)}">Vorlage bearbeiten</button></article>`).join('')||'<div class="ws-empty"><p>Noch keine Vorlage. Lege deine erste Montageart an.</p></div>'}</div>`;
  }
  function editTemplate(id) {
    const template=state.montageTemplates.find(t=>t.id===id);
    const t=template||{name:'',notes:'',machineIds:[],materialIds:[],materialQuantities:{},tasks:[]};
    const dialog=openDialog(template?'Vorlage bearbeiten':'Neue Montagevorlage', `${field('Name der Vorlage','name',t.name,'text','required placeholder="z. B. Fenstermontage" maxlength="160"')}<p class="ws-help">Änderungen an der Vorlage gelten für neue Aufträge. Bereits angelegte Aufträge bleiben unverändert.</p><fieldset class="ws-selection"><legend>Maschinen für diese Montageart</legend>${state.montageMachines.map(m=>`<label><input type="checkbox" name="machineIds" value="${h(m.id)}" ${t.machineIds.includes(m.id)?'checked':''}><span><strong>${h(m.name)}</strong><small>${m.placement==='van'?'Immer im Montagewagen':'Extra einpacken'}</small></span></label>`).join('')||'<p>Lege Maschinen unter „Maschinen“ an.</p>'}</fieldset><fieldset class="ws-selection"><legend>Material und übliche Mengen</legend>${state.montageMaterials.map(m=>`<div class="ws-template-material"><label><input type="checkbox" name="materialIds" value="${h(m.id)}" ${t.materialIds.includes(m.id)?'checked':''}><span>${h(m.name)}</span></label><input name="qty:${h(m.id)}" value="${h(t.materialQuantities?.[m.id]||m.quantity||'1')}" aria-label="Standardmenge ${h(m.name)}" placeholder="Menge / Einheit"></div>`).join('')||'<p>Lege Material unter „Verbrauchsmaterial Auto“ an.</p>'}</fieldset><label class="ws-field"><span>Übliche Arbeitsschritte – eine Zeile je Schritt</span><textarea name="tasks" rows="5" placeholder="Alte Fenster ausbauen&#10;Neue Fenster einsetzen&#10;Anschlüsse abdichten">${h((t.tasks||[]).join('\n'))}</textarea></label><label class="ws-field"><span>Hinweise zur Vorlage</span><textarea name="notes" rows="3">${h(t.notes||'')}</textarea></label>`, data=>{
      const updated={...t,id:template?.id||uid(),name:String(data.get('name')).trim(),notes:String(data.get('notes')||''),machineIds:data.getAll('machineIds'),materialIds:data.getAll('materialIds'),tasks:String(data.get('tasks')||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),materialQuantities:{}};
      updated.materialIds.forEach(mid=>updated.materialQuantities[mid]=String(data.get('qty:'+mid)||'1'));
      const current=state.montageTemplates.find(entry=>entry.id===updated.id);if(current) Object.assign(current,updated); else state.montageTemplates.push(updated); save();toast('Vorlage gespeichert');
    }, 'Vorlage speichern');
    dialog.classList.add('ws-wide-dialog');
    if(template){const remove=document.createElement('button');remove.type='button';remove.className='ws-text-button';remove.textContent='Diese Vorlage entfernen';remove.onclick=()=>{if(confirm('Vorlage entfernen? Bereits angelegte Aufträge bleiben erhalten.')){state.montageTemplates=state.montageTemplates.filter(entry=>entry.id!==template.id);save();dialog.close();}};dialog.querySelector('.ws-dialog-fields').append(remove);}
  }
  function vanDue() { return (state.montageMaterials||[]).filter(m=>m.refill).length; }
  function vanView() {
    equipmentTab='materials';
    const list=state.montageMaterials; const due=list.filter(m=>m.refill);
    const groups=new Map(); [...list].sort((a,b)=>a.name.localeCompare(b.name,'de')).forEach(m=>{const key=(m.category||'').trim()||'Ohne Kategorie';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);});
    const names=[...groups.keys()].sort((a,b)=>a==='Ohne Kategorie'?1:b==='Ohne Kategorie'?-1:a.localeCompare(b,'de'));
    const row=m=>`<div class="ws-van-row${m.refill?' is-due':''}"><button type="button" class="ws-van-toggle" data-van-toggle="${h(m.id)}" aria-pressed="${m.refill?'true':'false'}"><span class="ws-van-text"><strong>${h(m.name)}</strong><small>${m.quantity?'Im Auto: '+h(m.quantity):'Keine Menge angegeben'}</small></span><em>${m.refill?'Auffüllen':'Voll'}</em></button><button type="button" class="ws-van-edit" data-edit-equipment="${h(m.id)}" aria-label="${h(m.name)} bearbeiten"><span aria-hidden="true">✎</span><span class="ws-van-edit-label">Bearbeiten</span></button></div>`;
    return `<div class="ws-section-head"><div><h2>Verbrauchsmaterial im Auto</h2><p>Deine feste Liste für den Montagewagen. Tippe einen Artikel an, wenn er zur Neige geht. Er steht dann automatisch auf jeder Packliste.</p></div><button class="primary" data-new-equipment>＋ Material hinzufügen</button></div>${list.length?`<section class="card ws-van-due${due.length?' has-due':''}"><div><span class="kicker">Muss aufgefüllt werden</span><h3>${due.length?due.length+' Artikel':'Alles voll'}</h3>${due.length?`<p>${due.map(m=>h(m.name)).join(' · ')}</p>`:'<p>Im Auto fehlt gerade nichts.</p>'}</div>${due.length?'<button class="secondary" data-van-all-refilled>Alles aufgefüllt ✓</button>':''}</section>${names.map(name=>`<section class="ws-van-group"><h3>${h(name)}</h3><div class="ws-van-list">${groups.get(name).map(row).join('')}</div></section>`).join('')}`:'<div class="ws-empty"><strong>Noch kein Verbrauchsmaterial angelegt.</strong><p>Lege an, was immer im Auto sein soll, zum Beispiel Schrauben, Silikon oder Montageschaum.</p></div>'}`;
  }
  function equipmentView() {
    equipmentTab='machines';
    const machines=true; const list=state.montageMachines;
    return `<div class="ws-section-head"><div><h2>Maschinen & Werkzeug</h2><p>Hier pflegst du deine Maschinen. Verbrauchsmaterial findest du im Reiter „Verbrauchsmaterial Auto“.</p></div><button class="primary" data-new-equipment>＋ Maschine hinzufügen</button></div><div class="ws-inventory">${list.map(m=>`<article class="card ws-inventory-row"><div><strong>${h(m.name)}</strong><small>${h(m.category||'Ohne Kategorie')} · ${machines?(m.placement==='van'?'Immer im Montagewagen':'Extra einpacken'):h(m.quantity||'1')}</small></div><label class="ws-refill"><input type="checkbox" data-ws-refill="${h(m.id)}" ${m.refill?'checked':''}>${machines?'Fehlt':'Nachfüllen'}</label><button class="secondary" data-edit-equipment="${h(m.id)}">Bearbeiten</button></article>`).join('')||'<div class="ws-empty">Noch kein Eintrag. Ergänze deinen tatsächlichen Bestand.</div>'}</div>`;
  }
  function editEquipment(id) {
    const machines=equipmentTab==='machines';const list=machines?state.montageMachines:state.montageMaterials;const item=list.find(m=>m.id===id);
    const dialog=openDialog(`${machines?'Maschine':'Material'} ${item?'bearbeiten':'hinzufügen'}`,`${field('Bezeichnung','name',item?.name||'','text','required maxlength="160"')}${field('Kategorie','category',item?.category||'','text','placeholder="z. B. Befestigung" maxlength="100" list="wsCategoryList"')}<datalist id="wsCategoryList">${[...new Set(list.map(m=>(m.category||'').trim()).filter(Boolean))].map(c=>`<option value="${h(c)}">`).join('')}</datalist>${machines?`<label class="ws-field"><span>Wo ist die Maschine normalerweise?</span><select name="placement"><option value="van" ${item?.placement==='van'?'selected':''}>Immer im Montagewagen</option><option value="extra" ${item?.placement!=='van'?'selected':''}>Extra aus der Werkstatt einpacken</option></select></label>`:field('Menge im Auto / Einheit','quantity',item?.quantity||'1','text','required placeholder="z. B. 2 Kartons" maxlength="60"')}`,data=>{const values={id:item?.id||uid(),name:String(data.get('name')).trim(),category:String(data.get('category')||''),refill:item?.refill||false};if(machines)values.placement=data.get('placement');else values.quantity=data.get('quantity');const currentList=machines?state.montageMachines:state.montageMaterials;const current=currentList.find(entry=>entry.id===values.id);if(current)Object.assign(current,values);else currentList.push(values);save();toast('Ausrüstung gespeichert');});
    if(item){const remove=document.createElement('button');remove.type='button';remove.className='ws-text-button';remove.textContent='Aus dem Bestand entfernen';remove.onclick=()=>{if(confirm('Aus dem Bestand entfernen? Bereits angelegte Aufträge behalten ihre gespeicherte Ausrüstung.')){const key=machines?'montageMachines':'montageMaterials';state[key]=state[key].filter(entry=>entry.id!==item.id);save();dialog.close();}};dialog.querySelector('.ws-dialog-fields').append(remove);}
  }
  function pickJobMachines() {
    const item=job();if(!item)return;
    openDialog('Maschinen für diesen Auftrag',`<p class="ws-help">Wähle alles aus, was ihr für diesen Einsatz braucht. Die Packliste unterscheidet automatisch zwischen Wagen und Werkstatt.</p><fieldset class="ws-selection"><legend>Benötigte Maschinen</legend>${state.montageMachines.map(m=>`<label><input name="ids" type="checkbox" value="${h(m.id)}" ${item.machines.some(row=>row.id===m.id)?'checked':''}><span><strong>${h(m.name)}</strong><small>${m.placement==='van'?'Im Montagewagen':'Extra einpacken'}</small></span></label>`).join('')||'<p>Lege zuerst unter „Maschinen“ eine Maschine an.</p>'}</fieldset>`,data=>changeJob(j=>{j.machines=state.montageMachines.filter(m=>data.getAll('ids').includes(m.id)).map(m=>j.machines.find(old=>old.id===m.id)||{...structuredClone(m),checked:false});}));
  }
  async function jobPdf() {
    const item=job();if(!item)return;
    try {
      if(!window.jspdf)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
      const pdf=new window.jspdf.jsPDF();let y=20;
      const line=(text,size=11)=>{pdf.setFontSize(size);for(const part of pdf.splitTextToSize(String(text),178)){if(y>278){pdf.addPage();y=20;}pdf.text(part,16,y);y+=size===18?11:7;}};
      line(item.title,18);line(`Montage am ${dateLabel(item.date)}`);y+=5;
      const p=packing(item);line('Extra einpacken',14);p.machines.forEach(m=>line(`${m.checked?'[x]':'[ ]'} ${m.name}${m.refill?' – fehlt / nachfüllen':''}`));if(!p.machines.length)line('Keine zusätzliche Maschine.');y+=4;
      line('Material & Nachfüllen',14);p.materials.forEach(m=>line(`${m.checked?'[x]':'[ ]'} ${m.quantity||''} ${m.name}${m.refill?' – nachfüllen':''}`));y+=4;
      if(item.tasks.length){line('Arbeitsschritte',14);item.tasks.forEach(t=>line(`${t.done?'[x]':'[ ]'} ${t.title}`));}
      if(item.notes){y+=4;line('Hinweise',14);line(item.notes);}
      pdf.save(`Packliste-${item.title.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g,'-')}-${item.date}.pdf`);toast('PDF-Packliste erstellt');
    }catch{toast('Das PDF konnte nicht erstellt werden. Bitte erneut versuchen.');}
  }
  document.addEventListener('submit',event=>{
    if(event.target.id==='jobTaskForm'){event.preventDefault();const data=new FormData(event.target);changeJob(j=>j.tasks.push({id:uid(),title:String(data.get('title')).trim(),done:false}));}
    if(event.target.id==='jobMaterialForm'){event.preventDefault();const data=new FormData(event.target);const name=String(data.get('name')).trim();const catalog=state.montageMaterials.find(m=>m.name.toLowerCase()===name.toLowerCase());changeJob(j=>j.materials.push({id:uid(),catalogId:catalog?.id||null,name,quantity:String(data.get('quantity')).trim(),category:catalog?.category||'Auftragsmaterial',checked:false}));}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('[data-job-task]'))changeJob(j=>{j.tasks.find(t=>t.id===el.dataset.jobTask).done=el.checked;});
    if(el.matches('[data-job-quantity]')){changeJob(j=>{j.materials.find(m=>m.id===el.dataset.jobQuantity).quantity=el.value.trim()||'1';},false);document.querySelector('#jobPackList').innerHTML=packView(job());}
    if(el.matches('[data-job-pack]')){const [type,id]=el.dataset.jobPack.split(':');changeJob(j=>{const row=j[type].find(m=>m.id===id);if(row)row.checked=el.checked;else{j.extraPackChecks||={};j.extraPackChecks[el.dataset.jobPack]=el.checked;}});}
    if(el.id==='jobNotes')changeJob(j=>{j.notes=el.value;},false);
    if(el.matches('[data-ws-refill]')){const list=equipmentTab==='machines'?state.montageMachines:state.montageMaterials;const item=list.find(m=>m.id===el.dataset.wsRefill);if(item){item.refill=el.checked;save();}}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;const d=button.dataset;
    if('newJob'in d)newJob();
    if('openJob'in d){selectedJobId=d.openJob;state.settings.lastMontageJobId=selectedJobId;persist();montageTab='order';route('montage');}
    if('openMontageTab'in d){montageTab=d.openMontageTab;route('montage');}
    if('montageTab'in d){montageTab=d.montageTab;render();}
    if('newTemplate'in d)editTemplate();
    if('wsEditTemplate'in d)editTemplate(d.wsEditTemplate);
    if('jobFromTemplate'in d)newJob(d.jobFromTemplate);
    if('equipmentTab'in d){equipmentTab=d.equipmentTab;render();}
    if('vanToggle'in d){const item=state.montageMaterials.find(m=>m.id===d.vanToggle);if(item){item.refill=!item.refill;save();}}
    if('vanAllRefilled'in d){if(confirm('Alle Artikel als aufgefüllt markieren?')){state.montageMaterials.forEach(m=>{m.refill=false;});save();toast('Auto ist wieder voll');}}
    if('newEquipment'in d)editEquipment();
    if('editEquipment'in d)editEquipment(d.editEquipment);
    if('pickJobMachines'in d)pickJobMachines();
    if('removeJobTask'in d)changeJob(j=>{j.tasks=j.tasks.filter(t=>t.id!==d.removeJobTask);});
    if('removeJobMaterial'in d)changeJob(j=>{j.materials=j.materials.filter(m=>m.id!==d.removeJobMaterial);});
    if('jobStatus'in d)changeJob(j=>{j.status=d.jobStatus;});
    if('jobPdf'in d)jobPdf();
    if('editJob'in d){const item=job();openDialog('Auftragsdaten bearbeiten',field('Auftrag','title',item.title,'text','required maxlength="160"')+field('Montagetag','date',item.date,'date','required')+field('Adresse (optional)','address',item.address||'','text','maxlength="200" placeholder="Straße, Ort – für die Route" autocomplete="street-address"'),data=>changeJob(j=>{j.title=String(data.get('title')).trim();j.date=data.get('date');j.address=String(data.get('address')||'').trim();}));}
    if('jobToTemplate'in d){const item=job();openDialog('Als neue Vorlage speichern',field('Name der neuen Vorlage','name',item.title,'text','required maxlength="160"')+'<p class="ws-help">Arbeitsschritte, Materialmengen und Maschinen werden übernommen. Der Auftrag bleibt bestehen.</p>',data=>{const template={id:uid(),name:String(data.get('name')).trim(),notes:item.notes,machineIds:item.machines.map(m=>m.id),materialIds:[],materialQuantities:{},tasks:item.tasks.map(t=>t.title)};item.materials.forEach(m=>{let known=state.montageMaterials.find(c=>c.id===m.catalogId||c.id===m.id||c.name.toLowerCase()===m.name.toLowerCase());if(!known){known={id:uid(),name:m.name,quantity:m.quantity,category:m.category,refill:false};state.montageMaterials.push(known);}template.materialIds.push(known.id);template.materialQuantities[known.id]=m.quantity;});state.montageTemplates.push(template);save();toast('Neue Vorlage gespeichert');});}
  });
  installPages(); installNavigation();
  const oldRender=renderAll;renderAll=function(){oldRender();render();};
  const oldRefresh=window.ZuhauseFeatures.refresh;window.ZuhauseFeatures.refresh=function(){oldRefresh();render();};
  window.ZuhauseWorkspaces={render,newJob,packing,jobPdf,openJob:id=>{selectedJobId=id;state.settings.lastMontageJobId=id;persist();montageTab='order';route('montage');}};
  render();
})();
