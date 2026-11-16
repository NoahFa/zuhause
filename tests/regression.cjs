const { JSDOM } = require('../tools/dom-test/node_modules/jsdom');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const errors = [];
let dom;
(async () => {
dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: 'http://localhost:4173/?preview=calendar', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window;
const RealDate = w.Date;
w.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-15T12:00:00+01:00'])); } static now() { return new RealDate('2026-11-15T12:00:00+01:00').getTime(); } };
w.structuredClone = structuredClone;
w.scrollTo = () => {};
w.fetch = async () => ({ ok: false, json: async () => [] });
const documentRows = [{id:'doc',file_name:'Police.pdf',mime_type:'application/pdf',storage_path:'shared/police.pdf',size_bytes:200,created_at:'2026-11-15',category:'Versicherungen',folder:'Lou',ocr_text:'Rechnungsnummer ABC987',visibility:'shared'}];
w.supabase = {createClient: () => ({from: table => {
  const query = {select:()=>query,eq:()=>query,order:async()=>({data:table==='documents'?documentRows:[],error:null})}; return query;
}})};
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; };
// Native browsers expose named form controls; jsdom needs these accessors.
for (const name of ['monthlyAmount', 'savingsGoal', 'dueOn']) {
  Object.defineProperty(w.HTMLFormElement.prototype, name, {get() {return this.elements.namedItem(name);}});
}
w.addEventListener('error', event => errors.push(event.error));
const ctx = dom.getInternalVMContext();
const run = source => new vm.Script(source).runInContext(ctx);
for (const file of ['calendar.js', 'app.js', 'features.js', 'workspaces.js']) {
  run(fs.readFileSync(path.join(root, file), 'utf8'));
}
run('renderAll()');
assert.equal(errors.length, 0);
console.log('Initialisierung und erneutes Rendern: OK');

run(`state.montageMachines=[{id:'van',name:'Schrauber',placement:'van'},{id:'drill',name:'Bohrhammer',placement:'extra'}];state.montageMaterials=[{id:'foam',name:'Schaum',quantity:'2 Dosen',category:'Montage'}];state.montageTemplates=[{id:'window',name:'Fenstermontage',machineIds:['van','drill'],materialIds:['foam'],materialQuantities:{foam:'3 Dosen'},tasks:['Alte Fenster ausbauen'],notes:'Leiter mitnehmen'}];ZuhauseWorkspaces.render()`);
w.document.querySelector('.workspace-switch [data-space="noah"]').click();
assert.equal(w.document.querySelector('#noah').classList.contains('active'),true);
run(`ZuhauseWorkspaces.newJob('window')`);
let form=w.document.querySelector('#workspaceDialog form');
form.elements.namedItem('title').value='Drei Fenster bei Müller';
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(run('state.montageJobs.length'),1);
assert.equal(run('state.montageJobs[0].materials[0].quantity'),'3 Dosen');
assert.equal(run('state.montageJobs[0].tasks[0].title'),'Alte Fenster ausbauen');
form=w.document.querySelector('#jobMaterialForm');
form.elements.namedItem('name').value='Silikon';form.elements.namedItem('quantity').value='2 Kartuschen';
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(run('state.montageJobs[0].materials.length'),2);
assert.equal(run('state.montageMaterials.length'),1,'Auftragsmaterial verändert den Katalog nicht');
w.document.querySelector('[data-montage-tab="templates"]').click();
w.document.querySelector('[data-ws-edit-template="window"]').click();
form=w.document.querySelector('#workspaceDialog form');form.elements.namedItem('qty:foam').value='5 Dosen';
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(run('state.montageTemplates[0].materialQuantities.foam'),'5 Dosen');
assert.equal(run('state.montageJobs[0].materials[0].quantity'),'3 Dosen','Vorlagenänderung darf bestehenden Auftrag nicht ändern');
w.document.querySelector('[data-montage-tab="order"]').click();
w.document.querySelector('[data-job-task]').click();
w.document.querySelector('[data-job-pack]').click();run('renderAll()');
assert.equal(run('state.montageJobs[0].tasks[0].done'),true);
assert.equal(w.document.querySelector('[data-job-pack]').checked,true,'Abgehakte Packpunkte bleiben nach Neurendern erhalten');
assert.equal(run('ZuhauseWorkspaces.packing(state.montageJobs[0]).machines.length'),1,'Wagenmaschine gehört nicht in Extra-Packliste');
w.document.querySelector('.workspace-switch [data-space="charleen"]').click();
assert.equal(w.document.querySelector('#study').classList.contains('active'),true);
assert.equal(w.document.body.dataset.workspace,'charleen');
console.log('Eigene Bereiche, Auftrag aus Vorlage, Material, unabhängige Vorlagenmengen und gespeicherte Packpunkte: OK');

run(`state.householdTasks = [{id:'test-task', title:'Paket', person:'Gemeinsam', dueOn:todayIso(), recurrence:'none', done:false}]; renderAll();`);
w.document.querySelector('#homeTaskList input').click();
assert.equal(run('state.householdTasks[0].done'), true);
assert.match(w.document.querySelector('#homeTaskList').textContent, /heute erledigt/);
w.document.querySelector('#householdTaskList [data-delete-task]').click();
assert.equal(run('state.householdTasks.length'), 0);
console.log('Aufgaben abhaken und löschen: OK');

const merged = run(`mergeStates(
 {shopping:[{id:'keep', title:'remote'}],budget:{monthlyAmount:100,savingsGoal:300}},
 {shopping:[],budget:{monthlyAmount:200,savingsGoal:0}},
 {shopping:[{id:'keep',title:'remote'}],budget:{monthlyAmount:100,savingsGoal:0}}
)`);
assert.equal(merged.shopping.length, 0, 'Lokales Löschen darf nicht wiederauferstehen');
assert.equal(merged.budget.monthlyAmount, 200);
assert.equal(merged.budget.savingsGoal, 300, 'Unverändertes lokales Feld darf Remote-Änderung nicht überschreiben');
console.log('Drei-Wege-Synchronisierung: OK');

run(`state.shopping=[{id:'shop',title:'2 × Milch',done:false}]; renderAll()`);
assert.match(w.document.querySelector('#shoppingFull').textContent, /Kühlprodukte/);
w.document.querySelector('#shoppingFull [data-delete-shopping]').click();
assert.equal(run('state.shopping.length'), 0);
console.log('Einkaufsliste sortieren und löschen: OK');

assert.equal(errors.length, 0, errors.map(e => e.message).join('\n'));
await run(`cloudReady=true; currentHousehold={id:'home'};currentUser={id:'user'};loadDocuments()`);
w.document.querySelector('#documentSearch').value = 'ABC987';
w.document.querySelector('#documentSearch').dispatchEvent(new w.Event('input'));
assert.equal(w.document.querySelector('.document-row').hidden, false, 'OCR-Text muss durchsuchbar bleiben');
console.log('Dokumente laden und OCR durchsuchen: OK');

run(`state.budget={monthlyAmount:100, startMonth:'2026-09',closedMonths:{}};state.fixedCosts=[{id:'rent',amount:40,startMonth:'2026-09'}];state.expenses=[{id:'sep',date:'2026-09-03',amount:80}];`);
const october = run(`window.ZuhauseFeatures.calculateMonth('2026-10')`);
assert.equal(october.carry, -20, 'Negatives Budget muss automatisch übertragen werden');
assert.equal(october.available, 40);
run(`window.ZuhauseFeatures.closePastBudgetMonths();state.budget.monthlyAmount=300;state.fixedCosts=[];state.expenses=[];`);
assert.equal(run(`window.ZuhauseFeatures.calculateMonth('2026-09').available`), -20, 'Abgeschlossener Monat bleibt unverändert');
assert.equal(run(`window.ZuhauseFeatures.calculateMonth('2026-10').expenseItems.length`), 0);
console.log('Automatischer Budgetübertrag und unveränderlicher Verlauf: OK');

run(`cloudReady=false;currentUser=null;state.householdTasks=[{id:'repeat',seriesId:'series',title:'Routine',person:'Gemeinsam',dueOn:'2026-11-13',recurrence:'daily',done:false}];ZuhauseFeatures.refresh();ZuhauseFeatures.refresh();`);
const ids = run(`state.householdTasks.map(item=>item.id)`);
assert.equal(new Set(ids).size, ids.length);
assert.ok(run(`state.householdTasks.filter(item=>item.dueOn===todayIso()).length`) <= 1);
run(`state.montageMachines=[];state.montageMaterials=[];state.montageTemplates=[];ZuhauseFeatures.refresh()`);
assert.equal(run('state.montageMachines.length'), 0, 'Gelöschte Beispieldaten dürfen nicht zurückkommen');
console.log('Wiederholungen ohne Duplikate und gelöschte Vorlagen: OK');
run(`state.householdTasks=[{id:'month',seriesId:'monthly',title:'Monatlich',person:'Gemeinsam',dueOn:'2026-01-31',recurrence:'monthly',done:false}];ZuhauseFeatures.refresh()`);
assert.equal(run(`state.householdTasks.some(item=>item.dueOn==='2026-03-31')`), true, 'Monatsserien müssen nach Februar wieder zum ursprünglichen Tag zurückkehren');
assert.equal(run(`state.householdTasks.some(item=>item.dueOn==='2026-03-28')`), false);
console.log('Monatliche Aufgaben am Monatsende: OK');
await new Promise(resolve => setImmediate(resolve));
dom.window.close();
console.log('Alle Ablaufprüfungen bestanden.');
})().catch(error => { console.error(error); process.exitCode=1; dom?.window.close(); });
