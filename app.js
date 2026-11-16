const seed={
  appointments:[
    {id:1,date:'2026-11-08',time:'10:30',title:'Wochenplanung',person:'Gemeinsam',kind:'private'},
    {id:2,date:'2026-11-08',time:'17:00',title:'Spaziergang mit Lou',person:'Gemeinsam',kind:'private'},
    {id:3,date:'2026-11-09',time:'07:00',title:'Arbeit',person:'Noah',kind:'work'},
    {id:4,date:'2026-11-10',time:'15:30',title:'Hochschule',person:'Charlene',kind:'work'},
    {id:5,date:'2026-11-18',time:'16:00',title:'Tierarzt mit Lou',person:'Gemeinsam',kind:'private'}
  ],
  householdTasks:[
    {id:1,title:'Müll rausstellen',person:'Noah',due:'Heute Abend',done:false},
    {id:2,title:'Wäsche zusammenlegen',person:'Gemeinsam',due:'Heute',done:false},
    {id:3,title:'Stromzähler fotografieren',person:'Charlene',due:'Diese Woche',done:false},
    {id:4,title:'Bad putzen',person:'Noah',due:'Erledigt',done:true}
  ],
  shopping:[
    {id:1,title:'Hafermilch',done:false},{id:2,title:'Äpfel',done:false},{id:3,title:'Hundefutter für Lou',done:false},{id:4,title:'Spülmittel',done:true}
  ],
  expenses:[
    {id:1,date:'06.11.2026',title:'Tanken',category:'Fahrt noch zuordnen',person:'Noah',amount:68.40,receipt:true,review:true,icon:'⛽'},
    {id:2,date:'02.11.2026',title:'Fachbuch Elektrotechnik',category:'Beruf / Studium',person:'Charlene',amount:39.90,receipt:true,review:true,icon:'▤'},
    {id:3,date:'29.10.2026',title:'Arbeitsschuhe',category:'Nebengewerbe',person:'Noah',amount:119.00,receipt:true,review:true,icon:'◇'},
    {id:4,date:'15.10.2026',title:'Studiengebühr',category:'Hochschule',person:'Charlene',amount:201.40,receipt:false,review:true,icon:'▦'}
  ],
  incomes:[{id:1,title:'Montageauftrag Mustermann',amount:1240,date:'28.10.2026'}],
  taxTasks:[
    {id:'salary',title:'Lohnabrechnungen ablegen',note:'Beide für Oktober sind da.',done:true},
    {id:'days',title:'Arbeitstage kurz prüfen',note:'Büro, Zuhause oder Hochschule?',done:false},
    {id:'receipt',title:'Tankbeleg zuordnen',note:'Der Grund ist noch offen.',done:false},
    {id:'business',title:'Nebengewerbe prüfen',note:'Einnahmen und Ausgaben ansehen.',done:false}
  ],
  insurances:[
    {id:1,icon:'♢',title:'Privathaftpflicht',person:'Noah',amount:null,note:'Jahresbetrag noch ergänzen'},
    {id:2,icon:'◉',title:'Berufsunfähigkeit',person:'Noah',amount:null,note:'Jahresbetrag noch ergänzen'},
    {id:3,icon:'⌂',title:'Wohnungsversicherung',person:'Auf beide',amount:null,note:'Police läuft auf euch beide'}
  ],
  workdays:[]
};
const legacy=JSON.parse(localStorage.getItem('steuerkompass-v1')||'null');
const saved=JSON.parse(localStorage.getItem('zuhause-v1')||'null');
const state=saved||structuredClone(seed);
if(legacy&&!saved){
  if(Array.isArray(legacy.expenses))state.expenses=legacy.expenses;
  if(Array.isArray(legacy.incomes))state.incomes=legacy.incomes;
  if(legacy.tasks)state.taxTasks.forEach(t=>{if(t.id in legacy.tasks)t.done=!!legacy.tasks[t.id]});
}
if(!Array.isArray(state.insurances))state.insurances=structuredClone(seed.insurances);
if(!Array.isArray(state.workdays))state.workdays=[];
// Umbenennung: aus "Freundin" wird "Charlene" (auch in schon gespeicherten Einträgen)
['appointments','householdTasks','expenses','workdays','insurances'].forEach(k=>(state[k]||[]).forEach(x=>{if(x.person==='Freundin')x.person='Charlene'}));
// Heutiges Datum als JJJJ-MM-TT (lokale Zeit, nicht UTC)
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
function persist(){localStorage.setItem('zuhause-v1',JSON.stringify(state))}
function toast(message='Gespeichert'){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2100)}
function go(page){
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===page));
  $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-page]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();go(b.dataset.page)}));

function setGreeting(){
  const h=new Date().getHours();
  const greeting=h<11?'Guten Morgen':h<18?'Hallo':h<22?'Guten Abend':'Hallo';
  $('#greeting').textContent=greeting+', ihr zwei';
  if(h<11){$('#dayMessage').textContent='Ein guter Start in euren Tag.';$('#timeMessage').textContent='Termine, Aufgaben und alles Wichtige für heute.'}
  else if(h<18){$('#dayMessage').textContent='So sieht euer Tag gerade aus.';$('#timeMessage').textContent='Was erledigt ist, verschwindet ganz einfach aus dem Weg.'}
  else{$('#dayMessage').textContent='Für heute fast geschafft.';$('#timeMessage').textContent='Ein kurzer Blick auf morgen, dann ist Feierabend.'}
  $('#topDate').textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
}
function renderTimeline(){
  const today=todayISO();
  const items=state.appointments.filter(a=>a.date===today).sort((a,b)=>a.time.localeCompare(b.time));
  $('#todayTimeline').innerHTML=items.length?items.map(a=>`<button class="timeline-item" data-appointment="${a.id}"><time>${a.time}</time><span class="timeline-line"></span><span><strong>${a.title}</strong><small>${a.person}</small></span></button>`).join(''):'<p>Heute steht noch nichts im Kalender.</p>';
}
function taskMarkup(t){return `<label class="check-row ${t.done?'done':''}"><input type="checkbox" data-task-id="${t.id}" ${t.done?'checked':''}><span class="check-dot"></span><span><strong>${t.title}</strong><small>${t.person} · ${t.due}</small></span></label>`}
function renderTasks(){
  const open=state.householdTasks.filter(t=>!t.done);
  $('#homeTaskList').innerHTML=(open.slice(0,3).map(taskMarkup).join('')||'<p>Alles erledigt – sehr schön.</p>');
  $('#householdTaskList').innerHTML=state.householdTasks.map(taskMarkup).join('');
  $$('[data-task-id]').forEach(i=>i.addEventListener('change',()=>{
    const t=state.householdTasks.find(x=>x.id===Number(i.dataset.taskId));if(t)t.done=i.checked;
    persist();renderTasks();toast(i.checked?'Aufgabe erledigt':'Aufgabe wieder geöffnet');
  }));
}
function shoppingMarkup(i){return `<label class="check-row ${i.done?'done':''}"><input type="checkbox" data-shopping-id="${i.id}" ${i.done?'checked':''}><span class="check-dot"></span><span><strong>${i.title}</strong><small>${i.done?'eingekauft':'noch auf der Liste'}</small></span></label>`}
function renderShopping(){
  const open=state.shopping.filter(i=>!i.done);
  $('#shoppingPreview').innerHTML=open.slice(0,3).map(shoppingMarkup).join('')||'<p>Die Liste ist leer.</p>';
  $('#shoppingFull').innerHTML=state.shopping.map(shoppingMarkup).join('');
  $$('[data-shopping-id]').forEach(i=>i.addEventListener('change',()=>{
    const item=state.shopping.find(x=>x.id===Number(i.dataset.shoppingId));if(item)item.done=i.checked;
    persist();renderShopping();toast(i.checked?'Als eingekauft markiert':'Wieder auf der Liste');
  }));
}
// Kalender: angezeigter Monat und Personen-Filter
const calNow=new Date();let calY=calNow.getFullYear(),calM=calNow.getMonth(),calPerson='Alle';
function isoDate(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
// "Noah" zeigt Noahs und gemeinsame Termine, "Gemeinsam" nur gemeinsame
function matchesPerson(a){return calPerson==='Alle'||a.person===calPerson||(calPerson!=='Gemeinsam'&&a.person==='Gemeinsam')}
function renderCalendar(){
  const labels=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="cal-label">${x}</div>`).join('');
  const lead=(new Date(calY,calM,1).getDay()+6)%7,prevDays=new Date(calY,calM,0).getDate(),daysInMonth=new Date(calY,calM+1,0).getDate(),today=todayISO();
  let days='';
  for(let i=lead;i>0;i--)days+=`<div class="cal-day muted"><strong>${prevDays-i+1}</strong></div>`;
  for(let i=1;i<=daysInMonth;i++){
    const date=isoDate(calY,calM,i);
    const events=state.appointments.filter(a=>a.date===date&&matchesPerson(a)).sort((a,b)=>a.time.localeCompare(b.time));
    const more=events.length>2?`<span class="event more">+${events.length-2}</span>`:'';
    days+=`<button class="cal-day${date===today?' today':''}" data-calendar-day="${date}"><strong>${i}</strong>${events.slice(0,2).map(e=>`<span class="event ${e.kind}">${e.title}</span>`).join('')}${more}</button>`;
  }
  const trail=(7-(lead+daysInMonth)%7)%7;
  for(let i=1;i<=trail;i++)days+=`<div class="cal-day muted"><strong>${i}</strong></div>`;
  $('#calendarGrid').innerHTML=labels+days;
  $('#calMonthLabel').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(calY,calM,1));
  const upcoming=state.appointments.filter(a=>a.date>=today&&matchesPerson(a)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
  $('#upcomingList').innerHTML=upcoming.length?upcoming.map(a=>`<button class="upcoming-item" data-appointment="${a.id}"><b>${Number(a.date.slice(-2))}.${Number(a.date.slice(5,7))}.</b><span><strong>${a.title}</strong><small>${a.time} Uhr · ${a.person}</small></span></button>`).join(''):'<p>Keine anstehenden Termine.</p>';
}
function expenseMarkup(e){return `<button class="expense-row" data-expense="${e.id}"><span class="expense-icon">${e.icon||'€'}</span><span><strong>${e.title}</strong><small>${e.date} · ${e.person} · ${e.category}</small></span><strong>${money(e.amount)}</strong><em class="tag">${e.review?'Bitte prüfen':'geordnet'}</em></button>`}
function renderExpenses(filter=''){
  const list=state.expenses.filter(e=>(e.title+' '+e.category+' '+e.person).toLowerCase().includes(filter.toLowerCase()));
  const html=list.map(expenseMarkup).join('')||'<p>Keine passenden Einträge.</p>';
  $('#expenseList').innerHTML=html;$('#taxExpenseList').innerHTML=html;
  const total=state.expenses.reduce((s,e)=>s+Number(e.amount),0),receipts=state.expenses.filter(e=>e.receipt).length;
  $('#financeTotal').textContent=money(total);$('#homeExpenseTotal').textContent=money(total);
  $('#expenseTotal').textContent=money(total);$('#reviewTotal').textContent=state.expenses.filter(e=>e.review).length;
  $('#receiptRate').textContent=Math.round(receipts/Math.max(state.expenses.length,1)*100)+'%';
  $$('[data-expense]').forEach(row=>row.addEventListener('click',()=>openExpense(Number(row.dataset.expense))));
}
function renderTaxTasks(){
  $('#taxTaskList').innerHTML=state.taxTasks.map(t=>`<label class="check-row ${t.done?'done':''}"><input type="checkbox" data-tax-task="${t.id}" ${t.done?'checked':''}><span class="check-dot"></span><span><strong>${t.title}</strong><small>${t.note}</small></span></label>`).join('');
  const done=state.taxTasks.filter(t=>t.done).length,pct=Math.round(done/state.taxTasks.length*100),open=state.taxTasks.length-done;
  $('#taxRingNumber').textContent=pct+'%';$('#taxProgressText').textContent=pct+' % erledigt';$('#taxOpenText').textContent=`Noch ${open} kleine ${open===1?'Aufgabe':'Aufgaben'} →`;
  $$('[data-tax-task]').forEach(i=>i.addEventListener('change',()=>{const t=state.taxTasks.find(x=>x.id===i.dataset.taxTask);if(t)t.done=i.checked;persist();renderTaxTasks();toast(i.checked?'Steuer-Aufgabe erledigt':'Wieder geöffnet')}));
}
function renderInsurance(){
  $('#insuranceGrid').innerHTML=state.insurances.map(i=>`<button class="insurance-item card" data-open="insurance"><span class="expense-icon">${i.icon||'♢'}</span><span><h3>${i.title}</h3><p>${i.person} · ${i.amount!=null?money(i.amount)+' pro Jahr':(i.note||'Jahresbetrag noch ergänzen')}</p></span><strong>Öffnen →</strong></button>`).join('');
  bindOpenButtons();
}
function openExpense(id){
  const e=state.expenses.find(x=>x.id===id);if(!e)return;
  openDetail(e.title,`<p><strong>${money(e.amount)}</strong> · ${e.date}</p><ul class="detail-list"><li>Bezahlt von: ${e.person}</li><li>Grund: ${e.category}</li><li>Beleg: ${e.receipt?'vorhanden':'noch nicht vorhanden'}</li></ul><p>Noch keine Aussage, ob das Finanzamt die Ausgabe anerkennt.</p>`);
}

const fieldSets={
  appointment:{kicker:'Kalender',title:'Termin eintragen',help:'Für euch beide, nur für dich oder nur für Noah.',fields:`<div class="field-grid"><div class="field full"><label>Was steht an?</label><input name="title" placeholder="z. B. Zahnarzt" required></div><div class="field"><label>Datum</label><input name="date" type="date" required></div><div class="field"><label>Uhrzeit</label><input name="time" type="time" value="12:00" required></div><div class="field full"><label>Für wen?</label><select name="person"><option>Gemeinsam</option><option>Noah</option><option>Charlene</option></select></div></div>`},
  task:{kicker:'Haushalt',title:'Aufgabe hinzufügen',help:'Wer kümmert sich darum und bis wann?',fields:`<div class="field-grid"><div class="field full"><label>Was muss erledigt werden?</label><input name="title" placeholder="z. B. Paket abholen" required></div><div class="field"><label>Wer?</label><select name="person"><option>Gemeinsam</option><option>Noah</option><option>Charlene</option></select></div><div class="field"><label>Wann?</label><select name="due"><option>Heute</option><option>Heute Abend</option><option>Morgen</option><option>Diese Woche</option></select></div></div>`},
  shopping:{kicker:'Einkauf',title:'Zur Liste hinzufügen',help:'Der Eintrag erscheint sofort bei euch auf der Startseite.',fields:`<div class="field-grid"><div class="field full"><label>Was brauchen wir?</label><input name="title" placeholder="z. B. Brot" required></div></div>`},
  expense:{kicker:'Ausgabe',title:'Wofür habt ihr bezahlt?',help:'Privat sammeln oder für die spätere Steuerprüfung kennzeichnen.',fields:`<div class="field-grid"><div class="field"><label>Wer hat bezahlt?</label><select name="person"><option>Noah</option><option>Charlene</option><option>Gemeinsam</option></select></div><div class="field"><label>Wann?</label><input name="date" type="date" required></div><div class="field full"><label>Was wurde bezahlt?</label><input name="title" placeholder="z. B. Einkauf oder Werkzeug" required></div><div class="field"><label>Wie viel?</label><input name="amount" type="number" step="0.01" min="0" required></div><div class="field"><label>Bereich</label><select name="category"><option>Gemeinsamer Haushalt</option><option>Persönlich</option><option>Beruf / Arbeit</option><option>Hochschule / Studium</option><option>Nebengewerbe</option><option>Noch unklar</option></select></div><div class="field full"><label><input name="receipt" type="checkbox"> Beleg ist vorhanden</label></div></div>`},
  day:{kicker:'Arbeit & Fahrten',title:'Wie sah der Tag aus?',help:'Wählt den Ort. Eine mögliche Steuerwirkung wird später geprüft.',fields:`<div class="field-grid"><div class="field"><label>Für wen?</label><select name="person"><option>Noah</option><option>Charlene</option></select></div><div class="field"><label>Datum</label><input name="date" type="date" required></div><div class="field full"><label>Was war?</label><select name="kind"><option>Im Büro / Betrieb gearbeitet</option><option>Zu Hause gearbeitet</option><option>In der Hochschule</option><option>Fahrt fürs Nebengewerbe</option><option>Urlaub</option><option>Krank</option><option>Frei</option></select></div></div>`},
  income:{kicker:'Nebengewerbe',title:'Geld vom Auftrag eintragen',help:'Rechnungsbetrag und Status festhalten.',fields:`<div class="field-grid"><div class="field full"><label>Wofür?</label><input name="title" placeholder="z. B. Montageauftrag Müller" required></div><div class="field"><label>Betrag</label><input name="amount" type="number" step="0.01" min="0" required></div><div class="field"><label>Datum</label><input name="date" type="date" required></div></div>`},
  insurance:{kicker:'Versicherung',title:'Vertrag ergänzen',help:'Wir speichern Fakten, versprechen aber keine steuerliche Wirkung.',fields:`<div class="field-grid"><div class="field full"><label>Welche Versicherung?</label><input name="title" required></div><div class="field"><label>Auf wen?</label><select name="person"><option>Noah</option><option>Charlene</option><option>Auf beide</option></select></div><div class="field"><label>Betrag pro Jahr</label><input name="amount" type="number" step="0.01"></div></div>`}
};
let activeEntry='task';
function bindOpenButtons(){$$('[data-open]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',e=>{e.stopPropagation();openEntry(b.dataset.open)})})}
function openEntry(type){activeEntry=type;const f=fieldSets[type];if(!f)return;$('#dialogKicker').textContent=f.kicker;$('#dialogTitle').textContent=f.title;$('#dialogHelp').textContent=f.help;$('#dynamicFields').innerHTML=f.fields;$$('#dynamicFields input[type=date]').forEach(i=>i.value=todayISO());$('#entryDialog').showModal()}
$('#entryForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(e.submitter&&e.submitter.value==='cancel'){$('#entryDialog').close();e.target.reset();return}
  const data=Object.fromEntries(new FormData(e.target));
  if(activeEntry==='appointment')state.appointments.push({id:Date.now(),title:data.title,date:data.date,time:data.time,person:data.person,kind:'private'});
  if(activeEntry==='task')state.householdTasks.unshift({id:Date.now(),title:data.title,person:data.person,due:data.due,done:false});
  if(activeEntry==='shopping')state.shopping.unshift({id:Date.now(),title:data.title,done:false});
  if(activeEntry==='expense'){const d=new Date(data.date+'T12:00:00');state.expenses.unshift({id:Date.now(),date:d.toLocaleDateString('de-DE'),title:data.title,category:data.category,person:data.person,amount:Number(data.amount),receipt:data.receipt==='on',review:['Beruf / Arbeit','Hochschule / Studium','Nebengewerbe','Noch unklar'].includes(data.category),icon:'€'})}
  if(activeEntry==='income')state.incomes.push({id:Date.now(),title:data.title,amount:Number(data.amount),date:data.date});
  if(activeEntry==='day')state.workdays.push({id:Date.now(),date:data.date,person:data.person,kind:data.kind});
  if(activeEntry==='insurance')state.insurances.push({id:Date.now(),icon:'♢',title:data.title,person:data.person,amount:data.amount===''?null:Number(data.amount)});
  persist();renderAll();renderInsurance();$('#entryDialog').close();e.target.reset();toast('Eintrag gespeichert');
});

const details={
  storage:['Noch nicht zwischen Geräten verbunden','<p>Diese erste Fassung speichert Eingaben nur in diesem Browser. Sobald Supabase verbunden ist, bekommen eure beiden iPhones und der Computer denselben Stand.</p><p>Bis dahin bitte keine echten Steuerunterlagen hochladen.</p>'],
  lou:['Lou','<p>Hier sammeln wir später Tierarzttermine, Impfungen, Futter-Erinnerungen und wichtige Unterlagen.</p><ul class="detail-list"><li>Tierarzt: 18. November, 16:00 Uhr</li><li>Hundefutter steht auf der Einkaufsliste</li></ul>'],
  contracts:['Wohnung & Verträge','<p>Geplant sind Miete, Strom, Internet und gemeinsame Versicherungen – jeweils mit Laufzeit, Zahlender Person und Erinnerung.</p>'],
  notifications:['Mitteilungen','<p>Die App soll morgens eure Tagesübersicht und abends die wichtigsten Punkte für morgen zeigen.</p><p>Auf dem iPhone funktionieren solche Mitteilungen später, wenn die App zum Home-Bildschirm hinzugefügt wurde und ihr sie erlaubt.</p>'],
  install:['Als App auf dem iPhone','<ol class="plain-steps"><li>Die Seite in Safari öffnen.</li><li>Unten auf „Teilen“ tippen.</li><li>„Zum Home-Bildschirm“ wählen.</li><li>Mit „Hinzufügen“ bestätigen.</li></ol>'],
  settings:['Einstellungen','<p>Hier kommen später eure Zugänge, Datensicherung, persönliche Ansicht und die Auswahl der Erinnerungen hinein.</p>'],
  financeTogether:['Gemeinsame Finanzen','<p>Miete, Haushaltskosten und gemeinsame Verträge. Bei Steuerthemen wird zusätzlich gespeichert, wer tatsächlich bezahlt hat.</p>'],
  financeNoah:['Noahs Bereich','<p>Persönliche Ausgaben und Einnahmen bleiben Noah zugeordnet.</p>'],
  financePartner:['Charlenes Bereich','<p>Persönliche Ausgaben, Studium und Minijob bleiben der richtigen Person zugeordnet.</p>'],
  docsNoah:['Noahs Dokumente','<p>Lohnabrechnungen, Jahresbescheinigungen und Unterlagen zum Nebengewerbe.</p>'],
  docsPartner:['Charlenes Dokumente','<p>Lohn, duales Studium, Hochschule und Minijob.</p>'],
  profileNoah:['Profil Noah','<p>Angestellter mit geplantem Montage-Nebengewerbe und eigener Steuererklärung.</p>'],
  profilePartner:['Profil Charlene','<p>Angestellte im dualen Studium mit Minijob und eigener Steuererklärung.</p>'],
  householdProfile:['Euer gemeinsamer Bereich','<p>Kalender, Aufgaben, Einkauf, Wohnung und gemeinsame Kosten.</p>'],
  elsterWhy:['Warum noch nicht direkt senden?','<p>ELSTER muss echte Steuerdaten sicher prüfen und verschlüsseln. Dafür brauchen wir eine offizielle Entwicklerfreigabe und die ELSTER-Komponente ERiC.</p>'],
  elsterData:['Schritt 1: Daten sammeln','<p>Kalender, Ausgaben, Versicherungen, Lohnunterlagen und Nebengewerbe werden getrennt gesammelt.</p>'],
  elsterCheck:['Schritt 2: Einfach prüfen','<p>Alltagsfragen werden später in die passenden ELSTER-Felder übersetzt.</p>'],
  elsterAccount:['Schritt 3: ELSTER verbinden','<p>Ihr erhaltet jeweils einen eigenen kostenlosen ELSTER-Zugang. Zertifikate bleiben bei euch.</p>'],
  elsterSend:['Schritt 4: Prüfen und senden','<p>Vorher seht ihr jede Angabe. Gesendet wird nur nach eurer ausdrücklichen Bestätigung.</p>'],
  elsterNoah:['ELSTER für Noah','<p>Eigene Einkommensteuererklärung und später die Angaben zum Nebengewerbe.</p>'],
  elsterPartner:['ELSTER für Charlene','<p>Eigene Einkommensteuererklärung mit Studium und Minijob.</p>']
};
function openDetail(title,body){$('#detailTitle').textContent=title;$('#detailBody').innerHTML=body;$('#detailDialog').showModal()}
$$('[data-detail]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const d=details[b.dataset.detail];if(d)openDetail(d[0],d[1])}));
const explanations={
  safety:['Warum wir vorsichtig sind','<p>Steuern hängen von vielen Einzelheiten ab. Eine Ausgabe kann beruflich wirken und trotzdem ganz oder teilweise nicht zählen.</p><ol class="plain-steps"><li>Ihr sammelt den echten Vorgang.</li><li>Die App zeigt offene Fragen.</li><li>Vor der Abgabe wird alles geprüft.</li></ol>'],
  eur:['EÜR ohne Fachsprache','<p>EÜR heißt „Einnahmenüberschussrechnung“: Geld aus dem Gewerbe minus passende Ausgaben. Das Ergebnis ist noch nicht die zu zahlende Steuer.</p>'],
  handover:['So soll ELSTER funktionieren','<ol class="plain-steps"><li>Je Person eine eigene Erklärung.</li><li>Alle Angaben noch einmal in normaler Sprache.</li><li>Technische Prüfung durch ELSTER.</li><li>Versand nur nach eurer Bestätigung.</li><li>Offizielles Sendeprotokoll speichern.</li></ol>']
};
$$('[data-explain]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const d=explanations[b.dataset.explain];if(!d)return;$('#explainTitle').textContent=d[0];$('#explainBody').innerHTML=d[1];$('#explainDialog').showModal()}));
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-appointment]');if(a){const item=state.appointments.find(x=>x.id===Number(a.dataset.appointment));if(item)openDetail(item.title,`<p><strong>${item.time} Uhr</strong> · ${item.date.split('-').reverse().join('.')}</p><p>Für: ${item.person}</p>`)}
  const day=e.target.closest('[data-calendar-day]');if(day){const entries=state.appointments.filter(x=>x.date===day.dataset.calendarDay),work=state.workdays.filter(x=>x.date===day.dataset.calendarDay);openDetail(day.dataset.calendarDay.split('-').reverse().join('.'),(entries.length?entries.map(x=>`<p><strong>${x.time} Uhr</strong> · ${x.title} · ${x.person}</p>`).join(''):'<p>Noch kein Termin eingetragen.</p>')+(work.length?'<ul class="detail-list">'+work.map(w=>`<li>${w.person}: ${w.kind}</li>`).join('')+'</ul>':''))}
});
$('#expenseSearch').addEventListener('input',e=>renderExpenses(e.target.value));
$$('.chip').forEach(c=>c.addEventListener('click',()=>{$$('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');calPerson=c.textContent.trim();renderCalendar()}));
$$('.month-select').forEach((b,i)=>b.addEventListener('click',()=>{calM+=i===0?-1:1;if(calM<0){calM=11;calY--}if(calM>11){calM=0;calY++}renderCalendar()}));
// Tippen auf den Monatsnamen springt zurück zu heute
$('#calMonthLabel').addEventListener('click',()=>{const n=new Date();calY=n.getFullYear();calM=n.getMonth();renderCalendar()});
$('#fakeUpload').addEventListener('click',()=>$('#fileInput').click());
$('#fileInput').addEventListener('change',()=>toast('Dokument ausgewählt – sicherer Upload folgt'));
$('#exportData').addEventListener('click',()=>{const data={hinweis:'Kontrolldatei. Noch keine ELSTER-Datei.',steuerjahr:2026,personen:['Noah','Charlene'],ausgaben:state.expenses,einnahmen:state.incomes,arbeitstage:state.workdays,versicherungen:state.insurances,aufgaben:state.taxTasks};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='zuhause-steuer-2026-kontrolle.json';a.click();URL.revokeObjectURL(a.href);toast('Kontroll-Datei geladen')});
function renderAll(){renderTimeline();renderTasks();renderShopping();renderCalendar();renderExpenses();renderTaxTasks();const income=state.incomes.reduce((s,i)=>s+Number(i.amount),0);$('#incomeTotal').textContent=money(income);$('#profitTotal').textContent=money(income-462.30)}
setGreeting();bindOpenButtons();renderAll();renderInsurance();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
