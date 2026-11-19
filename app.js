const seed={appointments:[],householdTasks:[],shopping:[],expenses:[],incomes:[],taxTasks:[],documentChecklist:{},fixedCosts:[],receiptDrafts:[],montageMachines:[],montageMaterials:[],montageTemplates:[],studyItems:[],customCategories:{shopping:{},documents:['Versicherungen','Verträge','Rechnungen','Steuerunterlagen','Sonstige Dokumente'],study:[]},budget:{monthlyAmount:0,savingsGoal:0,closedMonths:{}},settings:{wasteStreetId:'284318',wasteDistrict:'2a2',wasteStreetLabel:'Am Fürstenbrünnchen',weatherPlace:'Bergisch Gladbach'}};
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
let state=structuredClone(seed);
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const SUPABASE_URL='https://mvdnatelwrakkkvdwcaa.supabase.co';
const SUPABASE_KEY='sb_publishable_nn42O5RpDEbuSYHxB6a10w_29-b7lXP';
const cloud=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let currentUser=null,currentHousehold=null,currentMemberName='',cloudReady=false,cloudSaveTimer=null,lastCloudUpdate='',cloudRevision=0,localDirty=false,saveInFlight=false,localChangeVersion=0;
let lastSyncedState=structuredClone(seed);
let householdMembers=[],automaticEvents=[];
let personNames={person1:'Noah',person2:'Charleen'};
const isoDate=date=>{const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};
const todayIso=()=>isoDate(new Date());
function scopedStorageKey(suffix='state'){return currentUser&&currentHousehold?`zuhause-v2:${currentUser.id}:${currentHousehold.id}:${suffix}`:''}
function storeScopedState(){const key=scopedStorageKey();if(key){localStorage.setItem(key,JSON.stringify(state));localStorage.setItem(scopedStorageKey('base'),JSON.stringify(lastSyncedState))}}
function setDirty(value){localDirty=value;const key=scopedStorageKey('dirty');if(key){if(value)localStorage.setItem(key,'1');else localStorage.removeItem(key)}}
function mergeValue(remote,local,base){
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(same(local,base))return structuredClone(remote);
  if(same(remote,base)||same(remote,local))return structuredClone(local);
  if(Array.isArray(remote)&&Array.isArray(local)){
    const prior=Array.isArray(base)?base:[];
    if([...remote,...local,...prior].every(item=>item&&typeof item==='object'&&item.id!=null)){
      const remoteMap=new Map(remote.map(item=>[String(item.id),item])),localMap=new Map(local.map(item=>[String(item.id),item])),baseMap=new Map(prior.map(item=>[String(item.id),item]));
      const ids=new Set([...remoteMap.keys(),...localMap.keys()]);
      return [...ids].filter(id=>!(baseMap.has(id)&&(!localMap.has(id)||!remoteMap.has(id)))).map(id=>mergeValue(remoteMap.get(id),localMap.get(id),baseMap.get(id)));
    }
    const removed=new Set(prior.filter(item=>!local.includes(item)||!remote.includes(item)));
    return [...new Set([...remote,...local])].filter(item=>!removed.has(item));
  }
  if(remote&&local&&typeof remote==='object'&&typeof local==='object'){
    const result={};for(const key of new Set([...Object.keys(remote),...Object.keys(local),...Object.keys(base||{})])){const value=mergeValue(remote[key],local[key],base?.[key]);if(value!==undefined)result[key]=value}return result;
  }
  return structuredClone(local===undefined?remote:local);
}
function mergeById(remote=[],local=[],base=[]){return mergeValue(remote||[],local||[],base||[])}
// Abgeschlossene Monate nie Feld für Feld mischen: Hat der Server einen Monat schon abgeschlossen, gilt sein Abschluss als Ganzes.
// Ausgaben, die dort fehlen, zählen dann als Nachzügler im laufenden Monat (sonst konnte eine Ausgabe nirgends mehr zählen).
function mergeStates(remote,local,base=lastSyncedState){const merged=mergedState(mergeValue(remote||{},local||{},base||{}));const closed=remote?.budget?.closedMonths;if(closed&&typeof closed==='object'){merged.budget.closedMonths={...(merged.budget.closedMonths||{})};for(const [month,snapshot] of Object.entries(closed))merged.budget.closedMonths[month]=structuredClone(snapshot)}return merged}
function setSyncStatus(text,mode=''){
  const pill=$('#syncPill'),label=$('#syncText');if(label)label.textContent=text;
  if(pill)pill.className='sync-pill '+mode;
}
function persist(){
  localChangeVersion+=1;storeScopedState();setDirty(true);
  if(cloudReady){clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(saveCloudState,500)}
}
async function saveCloudState(){
  if(!cloudReady||!currentHousehold||!currentUser||saveInFlight||!localDirty)return;
  if(!navigator.onLine){setSyncStatus('Nur auf diesem Gerät','error');return}
  saveInFlight=true;const saveVersion=localChangeVersion;
  setSyncStatus('Wird gespeichert …','syncing');
  try{
  const {appointments:legacyAppointments,...nonCalendarState}=state;
  let stateToSave=structuredClone(nonCalendarState),result=await cloud.rpc('save_app_state_without_calendar',{next_data:stateToSave,expected_revision:cloudRevision});
  if(result.error&&/Konflikt|revision/i.test(result.error.message||'')){
    const latest=await cloud.from('app_state').select('data,updated_at,revision').eq('household_id',currentHousehold.id).single();
    if(!latest.error&&latest.data){state=mergeStates(latest.data.data,state,lastSyncedState);lastSyncedState=mergedState(latest.data.data);cloudRevision=Number(latest.data.revision||0);storeScopedState();stateToSave=structuredClone(state);setTimeout(()=>renderAll(),0);result=await cloud.rpc('save_app_state_without_calendar',{next_data:stateToSave,expected_revision:cloudRevision})}
  }
  saveInFlight=false;
  if(result.error){setSyncStatus('Nur auf diesem Gerät','error');toast('Online-Speichern wartet – die Änderung bleibt auf diesem Gerät');clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(saveCloudState,45000);return}
  const savedRow=Array.isArray(result.data)?result.data[0]:result.data;
  cloudRevision=Number(savedRow?.revision||cloudRevision+1);lastCloudUpdate=savedRow?.updated_at||new Date().toISOString();lastSyncedState=mergedState(stateToSave);storeScopedState();
  if(localChangeVersion===saveVersion){setDirty(false);setSyncStatus('Sicher gespeichert','connected')}else{setDirty(true);setSyncStatus('Weitere Änderung wird gespeichert …','syncing');setTimeout(saveCloudState,0)}
  }catch{setSyncStatus('Nur auf diesem Gerät','error')}finally{saveInFlight=false}
}
function showAuthPanel(id){
  $$('.auth-panel').forEach(panel=>panel.hidden=panel.id!==id);
  $('#authScreen').hidden=false;
}
function friendlyError(message=''){
  if(/Invalid login credentials/i.test(message))return 'E-Mail-Adresse oder Passwort stimmen nicht.';
  if(/Email not confirmed/i.test(message))return 'Bitte zuerst den Link in der Bestätigungs-E-Mail öffnen.';
  if(/User already registered/i.test(message))return 'Für diese E-Mail-Adresse gibt es schon einen Zugang.';
  if(/Password should be/i.test(message))return 'Das Passwort braucht mindestens 6 Zeichen.';
  if(/should be different/i.test(message))return 'Das neue Passwort muss sich vom alten unterscheiden.';
  return 'Das hat gerade nicht geklappt. Bitte noch einmal versuchen.';
}
function mergedState(data){
  const base=structuredClone(seed),incoming=data&&typeof data==='object'?data:{};
  const result={...base,...incoming};
  ['appointments','householdTasks','shopping','expenses','incomes','taxTasks','fixedCosts','receiptDrafts','montageMachines','montageMaterials','montageTemplates','studyItems'].forEach(list=>{if(!Array.isArray(result[list]))result[list]=[]});
  if(!result.documentChecklist||typeof result.documentChecklist!=='object')result.documentChecklist={};
  result.customCategories={...base.customCategories,...(result.customCategories||{})};result.budget={...base.budget,...(result.budget||{})};result.settings={...base.settings,...(result.settings||{})};
  return result;
}
function updatePersonNames(members=[]){
  const owner=members.find(member=>member.role==='owner'),second=members.find(member=>member.user_id!==owner?.user_id);
  personNames={person1:owner?.display_name?.trim()||'Noah',person2:second?.display_name?.trim()||'Charleen'};
  document.querySelectorAll('[data-person-name="person1"]').forEach(node=>node.textContent=personNames.person1);
  document.querySelectorAll('[data-person-name="person2"]').forEach(node=>node.textContent=personNames.person2);
  document.querySelectorAll('[data-person-initial="person1"]').forEach(node=>node.textContent=personNames.person1.slice(0,1).toUpperCase());
  document.querySelectorAll('[data-person-initial="person2"]').forEach(node=>node.textContent=personNames.person2.slice(0,1).toUpperCase());
}
function updateStorageExplanation(){
  if(!currentHousehold)return;
  let banner=$('#householdAloneBanner');
  if(householdMembers.length<2){
    if(!banner){banner=document.createElement('div');banner.id='householdAloneBanner';banner.className='household-banner';$('#today')?.prepend(banner)}
    banner.innerHTML=`<strong>Ihr seid noch nicht verbunden.</strong><span>In diesem Zuhause ist bisher nur ${escapeHtml(householdMembers[0]?.display_name||'eine Person')}. Darum erscheinen Einträge nicht auf dem anderen Handy.</span><span>Einladungscode für die zweite Person: <b>${escapeHtml(currentHousehold.join_code)}</b></span><button type="button" class="text-button" data-open-switch>Du willst stattdessen in ein anderes Zuhause wechseln? →</button>`;
  }else banner?.remove();
  details.storage=['Sicher zwischen euren Geräten verbunden',`<p><strong>${escapeHtml(currentHousehold.name)}</strong> wird geschützt bei Supabase gespeichert.</p><p>Einladungscode für die zweite Person: <strong class="invite-code">${escapeHtml(currentHousehold.join_code)}</strong></p><p>Mitglieder in diesem Zuhause: <strong>${escapeHtml(householdMembers.map(member=>member.display_name||'Ohne Namen').join(', ')||'–')}</strong></p>${householdMembers.length<2?'<p class="household-alone">Bisher ist nur eine Person in diesem Zuhause. Die zweite Person muss sich mit dem Einladungscode oben verbinden, sonst seht ihr nicht dieselben Daten.</p><div id="switchHouseholdForm" class="switch-household"><strong>Oder: Du willst in ein anderes Zuhause wechseln?</strong><span>Gib den Einladungscode der anderen Person ein. Dein bisheriges Zuhause bleibt gespeichert, du siehst es danach aber nicht mehr.</span><input name="code" required maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="Einladungscode" aria-label="Einladungscode"><button class="secondary" type="button" data-switch-household>Zuhause wechseln</button><small id="switchHouseholdMessage"></small></div>':''}<p>Nur angemeldete Mitglieder dieses Zuhauses können die Daten und Belege öffnen.</p><div class="detail-actions"><button class="secondary" type="button" data-sign-out>Abmelden</button></div>`];
}
let connectionRetry=null,connectionAttempts=0,passwordRecovery=/type=recovery/.test(location.hash)||new URLSearchParams(location.search).get('type')==='recovery';
function connectionProblem(){
  showAuthPanel('authOffline');setSyncStatus('Keine Verbindung','error');
  clearTimeout(connectionRetry);const wait=Math.min(30000,2000*2**connectionAttempts++);
  connectionRetry=setTimeout(resumeSession,wait);
}
async function resumeSession(){
  clearTimeout(connectionRetry);if(!cloud)return;
  const slow=setTimeout(()=>{if(!$('#authLoading').hidden){showAuthPanel('authOffline');setSyncStatus('Keine Verbindung','error')}},6000);
  try{
    const result=await cloud.auth.getSession();clearTimeout(slow);
    const {data:{session},error}=result;
    if(session&&passwordRecovery){currentUser=session.user;showAuthPanel('authNewPassword');setSyncStatus('Neues Passwort festlegen','');return}
    if(session){currentUser=session.user;await loadHousehold();return}
    if(error&&/fetch|network|timeout|load failed/i.test(String(error.message||error.name||'')))return connectionProblem();
    if(error&&error.name==='AuthRetryableFetchError')return connectionProblem();
    showAuthPanel('authLogin');setSyncStatus('Bitte anmelden','');
  }catch{clearTimeout(slow);connectionProblem()}
}
async function loadHousehold(){
  try{return await loadHouseholdOnce()}catch{return connectionProblem()}
}
async function loadHouseholdOnce(){
  showAuthPanel('authLoading');setSyncStatus('Verbindung wird geprüft','syncing');
  const {data:member,error:memberError}=await cloud.from('household_members').select('household_id,display_name,role').eq('user_id',currentUser.id).maybeSingle();
  if(memberError){return connectionProblem()}
  if(!member){cloudReady=false;showAuthPanel('householdSetup');return}
  const {data:household,error:householdError}=await cloud.from('households').select('id,name,join_code').eq('id',member.household_id).single();
  if(householdError){return connectionProblem()}
  currentHousehold=household;currentMemberName=member.display_name||'';
  const {data:members}=await cloud.from('household_members').select('user_id,display_name,role').eq('household_id',household.id);
  householdMembers=members||[];updatePersonNames(householdMembers);
  const {data:row,error:stateError}=await cloud.from('app_state').select('data,updated_at,revision').eq('household_id',household.id).single();
  if(stateError){return connectionProblem()}
  const scoped=readJson(scopedStorageKey()),dirty=localStorage.getItem(scopedStorageKey('dirty'))==='1',storedBase=readJson(scopedStorageKey('base'));
  lastSyncedState=mergedState(row.data);state=dirty&&scoped?mergeStates(row.data,scoped,storedBase||lastSyncedState):structuredClone(lastSyncedState);localDirty=dirty;localChangeVersion=dirty?1:0;storeScopedState();lastCloudUpdate=row.updated_at;cloudRevision=Number(row.revision||0);
  cloudReady=true;updateStorageExplanation();await loadAutomaticContent();
  await window.ZuhauseCalendar?.connect({cloud,household,user:currentUser,members:members||[],legacyAppointments:state.appointments,automaticEvents,callbacks:{toast,go,detail:openDetail,remindersSelected:reminderHint}});
  renderAll();renderInsurance();window.ZuhauseRecipes?.sync?.();await loadDocuments();
  connectionAttempts=0;clearTimeout(connectionRetry);$('#authScreen').hidden=true;setSyncStatus('Sicher gespeichert','connected');
  if(dirty||!row.data||!Object.keys(row.data).length){setDirty(true);await saveCloudState()}
  if(!state.settings?.sampleDataRemoved)await removeSampleDataOnce();
}
// Einmalig (16.11.2026, auf Wunsch von Noah): alle Muster-/Beispieldaten leeren.
// Fußball, Müll und Wetter kommen aus eigenen Quellen und bleiben unberührt.
// Vorher wird eine Sicherung in state.resetBackup abgelegt; Dokumentdateien im Speicher bleiben erhalten.
async function removeSampleDataOnce(){
  try{
    const hid=currentHousehold.id;
    if(!state.resetBackup){
      const [events,docs]=await Promise.all([cloud.from('calendar_events').select('*').eq('household_id',hid),cloud.from('documents').select('*').eq('household_id',hid)]);
      if(events.error||docs.error)return;
      const {resetBackup,...appState}=state;
      state.resetBackup={createdAt:new Date().toISOString(),appState:structuredClone(appState),calendarEvents:events.data||[],documents:docs.data||[]};
      setDirty(true);localChangeVersion+=1;await saveCloudState();
      if(localDirty)return;
    }
    const delEvents=await cloud.from('calendar_events').delete().eq('household_id',hid);
    const delDocs=await cloud.from('documents').delete().eq('household_id',hid);
    if(delEvents.error||delDocs.error)return;
    const keep=state.settings||{};
    state={...structuredClone(seed),montageJobs:[],resetBackup:state.resetBackup,settings:{...seed.settings,wasteStreetId:keep.wasteStreetId||seed.settings.wasteStreetId,wasteDistrict:keep.wasteDistrict||seed.settings.wasteDistrict,wasteStreetLabel:keep.wasteStreetLabel||seed.settings.wasteStreetLabel,weatherPlace:keep.weatherPlace||seed.settings.weatherPlace,montageInitialised:true,sampleDataRemoved:new Date().toISOString()}};
    setDirty(true);localChangeVersion+=1;storeScopedState();await saveCloudState();
    if(!localDirty){toast('Beispieldaten entfernt');setTimeout(()=>location.reload(),900)}
  }catch{}
}
let lastStateRefresh=0;
async function refreshCloudState(force){
  if(!cloudReady||!currentHousehold||document.hidden)return;
  // Auf der Haushaltsseite (Einkaufsliste) alle 5 Sekunden abgleichen, sonst alle 15 Sekunden.
  if(!force&&!$('#household.active')&&Date.now()-lastStateRefresh<14000)return;
  lastStateRefresh=Date.now();
  window.ZuhauseCalendar?.refresh(force===true||force?.type!==undefined);
  if(saveInFlight)return;
  await Promise.allSettled([loadDocuments(),loadAutomaticContent(),window.ZuhauseRecipes?.sync?.()]);
  window.ZuhauseFeatures?.refresh();
  if(saveInFlight)return;
  const {data,error}=await cloud.from('app_state').select('data,updated_at,revision').eq('household_id',currentHousehold.id).single();
  if(error||!data||saveInFlight||Number(data.revision||0)<=cloudRevision)return;
  const remoteState=mergedState(data.data);state=localDirty?mergeStates(data.data,state,lastSyncedState):remoteState;lastSyncedState=remoteState;lastCloudUpdate=data.updated_at;cloudRevision=Number(data.revision||0);storeScopedState();window.ZuhauseCalendar?.setLegacyAppointments(state.appointments);await loadAutomaticContent();renderAll();setSyncStatus(localDirty?'Änderungen werden abgeglichen':'Neuester Stand',localDirty?'syncing':'connected');if(localDirty)saveCloudState();
}
async function startCloud(){
  if(!cloud){showAuthPanel('authLogin');$('#loginMessage').textContent='Die sichere Verbindung konnte nicht geladen werden. Bitte die Seite neu öffnen.';return}
  navigator.storage?.persist?.().catch(()=>{});
  await resumeSession();
  cloud.auth.onAuthStateChange((event,sessionNow)=>{
    if(event==='SIGNED_OUT'){window.ZuhauseCalendar?.disconnect();const prefix=currentUser&&currentHousehold?`zuhause-v2:${currentUser.id}:${currentHousehold.id}:`:'';if(prefix)Object.keys(localStorage).filter(key=>key.startsWith(prefix)).forEach(key=>localStorage.removeItem(key));localStorage.removeItem('zuhause-v1');state=structuredClone(seed);currentUser=null;currentHousehold=null;householdMembers=[];cloudReady=false;localDirty=false;showAuthPanel('authLogin');setSyncStatus('Bitte anmelden','')}
    if(event==='PASSWORD_RECOVERY'){passwordRecovery=true;currentUser=sessionNow?.user||currentUser;showAuthPanel('authNewPassword');return}
    if(sessionNow&&sessionNow.user.id!==currentUser?.id){currentUser=sessionNow.user;if(!passwordRecovery)setTimeout(loadHousehold,0)}
  });
}
// Nur http(s)-Links aus Serverdaten übernehmen.
function safeExternalUrl(value){try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}}
let toastTimer=null;
function toast(message='Gespeichert'){const el=$('#toast');el.classList.remove('with-action');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
// Meldung mit „Rückgängig“ nach dem Löschen (6 Sekunden lang).
function toastUndo(message,undo){const el=$('#toast');el.replaceChildren(document.createTextNode(message));const button=document.createElement('button');button.type='button';button.className='toast-undo';button.textContent='Rückgängig';button.addEventListener('click',()=>{clearTimeout(toastTimer);el.classList.remove('show','with-action');undo();});el.append(button);el.classList.add('show','with-action');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show','with-action'),6000)}
function go(page){
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===page));
  $$('[data-page]').forEach(b=>{const active=b.dataset.page===page;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='calendar')window.ZuhauseCalendar?.render();
}
$$('[data-page]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();go(b.dataset.page)}));

function normaliseExternal(row){
  return {key:`${row.source}:${row.external_id}`,date:row.event_date,time:(row.start_time||'00:00').slice(0,5),title:row.title,person:row.person||'Gemeinsam',kind:row.kind||'private',source:row.source,status:row.status||'scheduled',note:row.note||row.metadata?.competition||'',url:row.source_url||'',endTime:row.metadata?.end_time||''};
}
async function loadAutomaticContent(){
  let events=[];
  if(cloudReady&&currentHousehold){
    const {data}=await cloud.from('external_events').select('source,external_id,event_date,start_time,title,person,kind,status,note,source_url,metadata').eq('household_id',currentHousehold.id).order('event_date');
    if(Array.isArray(data)&&data.length)events=data.map(normaliseExternal);
  }
  automaticEvents=[...new Map(events.map(event=>[event.key,event])).values()];
  window.ZuhauseCalendar?.setAutomaticEvents(automaticEvents);
  await loadPositiveMessage();
}
async function loadPositiveMessage(){
  const phrases=['Gemeinsam wird aus vielen kleinen Schritten etwas Großes.','Heute muss nicht alles perfekt sein – ein guter Schritt reicht.','Ihr seid ein Team. Das macht den Alltag leichter.','Was heute erledigt wird, schenkt euch morgen Ruhe.','Ein freundlicher Gedanke kann einen ganzen Tag verändern.','Nehmt euch heute auch Zeit für etwas Schönes.','Euer Zuhause wächst mit jedem kleinen gemeinsamen Moment.'];
  const day=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/86400000);
  let content=null;
  if(cloudReady&&currentHousehold){const {data}=await cloud.from('daily_content').select('headline,published_on,source_name,source_url').eq('household_id',currentHousehold.id).order('published_on',{ascending:false}).limit(1).maybeSingle();content=data}
  $('#positiveTitle').textContent=content?.headline||phrases[day%phrases.length];
  $('#positiveSource').textContent=content?'Gute Nachricht · '+(content.source_name||'Good News'):'Euer Satz für heute';
  $('#positiveDate').textContent=content?.published_on?new Date(content.published_on+'T12:00:00').toLocaleDateString('de-DE')+' · Quelle öffnen →':'Gute Nachrichten öffnen →';
  $('#positiveCard').href=safeExternalUrl(content?.source_url)||'https://goodnews.eu/';
}
function setGreeting(){
  const h=new Date().getHours();
  const greeting=h<11?'Guten Morgen':h<18?'Hallo':h<22?'Guten Abend':'Hallo';
  $('#greeting').textContent=greeting+', '+(currentMemberName||'ihr zwei');
  if(h<11){$('#dayMessage').textContent='Ein guter Start in euren Tag.';$('#timeMessage').textContent='Termine, Aufgaben und alles Wichtige für heute.'}
  else if(h<18){$('#dayMessage').textContent='So sieht euer Tag gerade aus.';$('#timeMessage').textContent='Was erledigt ist, verschwindet ganz einfach aus dem Weg.'}
  else{$('#dayMessage').textContent='Für heute fast geschafft.';$('#timeMessage').textContent='Ein kurzer Blick auf morgen, dann ist Feierabend.'}
  $('#topDate').textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
}
function displayPerson(value){return value==='person1'?personNames.person1:value==='person2'?personNames.person2:value||'Gemeinsam'}
function parseStoredDate(value=''){
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(`${value}T12:00:00`);
  const match=String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);return match?new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}T12:00:00`):null;
}
// Geldbeträge immer selbst lesen (deutsch: „23,50“, „1.250“, „1.250,50“) – Zahlenfelder des Browsers lesen das Komma je nach Gerät falsch
function euroValue(value){let t=String(value??'').trim().replace(/[\s€]/g,'');if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');const n=Number(t);return Number.isFinite(n)?Math.round(n*100)/100:NaN}
function displayDate(value){const date=parseStoredDate(value);return date?date.toLocaleDateString('de-DE'):value}
function renderTimeline(){
  window.ZuhauseCalendar?.renderHomeTimeline();
}
function taskMarkup(t){return `<label class="check-row ${t.done?'done':''}"><input type="checkbox" data-task-id="${escapeHtml(t.id)}" ${t.done?'checked':''}><span class="check-dot"></span><span><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(displayPerson(t.person))} · ${escapeHtml(t.due)}</small></span></label>`}
function renderTasks(){
  const open=state.householdTasks.filter(t=>!t.done);
  $('#homeTaskList').innerHTML=(open.slice(0,3).map(taskMarkup).join('')||'<p>Alles erledigt – sehr schön.</p>');
  $('#householdTaskList').innerHTML=state.householdTasks.map(taskMarkup).join('');
  $$('[data-task-id]').forEach(i=>i.addEventListener('change',()=>{
    const t=state.householdTasks.find(x=>String(x.id)===i.dataset.taskId);if(t)t.done=i.checked;
    persist();renderTasks();toast(i.checked?'Aufgabe erledigt':'Aufgabe wieder geöffnet');
  }));
}
function shoppingMarkup(i){return `<label class="check-row ${i.done?'done':''}"><input type="checkbox" data-shopping-id="${escapeHtml(i.id)}" ${i.done?'checked':''}><span class="check-dot"></span><span><strong>${escapeHtml(i.title)}</strong><small>${i.done?'eingekauft':'noch auf der Liste'}</small></span></label>`}
function renderShopping(){
  const open=state.shopping.filter(i=>!i.done);
  $('#shoppingPreview').innerHTML=open.slice(0,3).map(shoppingMarkup).join('')||'<p>Die Liste ist leer.</p>';
  $('#shoppingFull').innerHTML=state.shopping.map(shoppingMarkup).join('');
  $$('[data-shopping-id]').forEach(i=>i.addEventListener('change',()=>{
    const item=state.shopping.find(x=>String(x.id)===i.dataset.shoppingId);if(item)item.done=i.checked;
    persist();renderShopping();toast(i.checked?'Als eingekauft markiert':'Wieder auf der Liste');
  }));
}
function renderCalendar(){
  window.ZuhauseCalendar?.render();
}
function expenseMarkup(e){return `<button class="expense-row" data-expense="${escapeHtml(e.id)}"><span class="expense-icon">${escapeHtml(e.icon||'€')}</span><span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(displayDate(e.date))} · ${escapeHtml(displayPerson(e.person))} · ${escapeHtml(e.category)}</small></span><strong>${money(Number(e.amount)||0)}</strong><em class="tag">${e.review?'Bitte prüfen':'geordnet'}</em></button>`}
function renderExpenses(filter=''){
  const list=state.expenses.filter(e=>(e.title+' '+e.category+' '+e.person).toLowerCase().includes(filter.toLowerCase()));
  const html=list.map(expenseMarkup).join('')||'<p>Keine passenden Einträge.</p>';
  if($('#expenseList'))$('#expenseList').innerHTML=html;
  const now=new Date(),monthExpenses=state.expenses.filter(e=>{const date=parseStoredDate(e.date);return date&&date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()}),yearExpenses=state.expenses.filter(e=>{const date=parseStoredDate(e.date);return date&&date.getFullYear()===now.getFullYear()});
  const taxExpenses=yearExpenses.filter(e=>e.review),monthTotal=monthExpenses.reduce((sum,e)=>sum+(Number(e.amount)||0),0),yearTotal=taxExpenses.reduce((sum,e)=>sum+(Number(e.amount)||0),0),receipts=taxExpenses.filter(e=>e.receipt).length;
  $('#taxExpenseList').innerHTML=taxExpenses.length?taxExpenses.map(expenseMarkup).join(''):'<p>Noch keine steuerlich zu prüfende Ausgabe.</p>';
  const sharedTotal=monthExpenses.filter(e=>e.person==='Gemeinsam'||e.category==='Gemeinsamer Haushalt').reduce((sum,e)=>sum+(Number(e.amount)||0),0),reviewTotal=monthExpenses.filter(e=>e.review).reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  for(const [id,value] of [['financeTotal',monthTotal],['homeExpenseTotal',monthTotal],['financeSharedTotal',sharedTotal],['financeReviewAmount',reviewTotal]])if($('#'+id))$('#'+id).textContent=money(value);
  $('#expenseTotal').textContent=money(yearTotal);$('#taxYearLabel').textContent=String(now.getFullYear());$('#reviewTotal').textContent=taxExpenses.length;
  $('#taxYearOverview').textContent=String(now.getFullYear());
  $('#receiptRate').textContent=Math.round(receipts/Math.max(taxExpenses.length,1)*100)+'%';
  const grouped=new Map();monthExpenses.forEach(e=>grouped.set(e.category,(grouped.get(e.category)||0)+(Number(e.amount)||0)));const max=Math.max(...grouped.values(),1),bars=$('#financeCategoryBars');if(!bars)return;bars.replaceChildren();
  if(!grouped.size)bars.append(Object.assign(document.createElement('p'),{textContent:'Für diesen Monat sind noch keine Ausgaben erfasst.'}));
  [...grouped.entries()].sort((a,b)=>b[1]-a[1]).forEach(([category,amount])=>{const row=document.createElement('div'),label=document.createElement('span'),track=document.createElement('i'),bar=document.createElement('b'),value=document.createElement('strong');label.textContent=category;bar.style.width=`${Math.round(amount/max*100)}%`;track.append(bar);value.textContent=money(amount);row.append(label,track,value);bars.append(row)});
  $$('[data-expense]').forEach(row=>row.addEventListener('click',()=>openExpense(row.dataset.expense)));
}
function renderTaxTasks(){
  $('#taxTaskList').innerHTML=state.taxTasks.map(t=>`<label class="check-row ${t.done?'done':''}"><input type="checkbox" data-tax-task="${escapeHtml(t.id)}" ${t.done?'checked':''}><span class="check-dot"></span><span><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.note)}</small></span></label>`).join('');
  const done=state.taxTasks.filter(t=>t.done).length,pct=state.taxTasks.length?Math.round(done/state.taxTasks.length*100):0,open=state.taxTasks.length-done;
  $('#taxRingNumber').textContent=pct+'%';$('#taxProgressText').textContent=pct+' % erledigt';$('#taxOpenText').textContent=open?`Noch ${open} kleine ${open===1?'Aufgabe':'Aufgaben'} →`:'Keine offene Aufgabe';
  $$('[data-tax-task]').forEach(i=>i.addEventListener('change',()=>{const t=state.taxTasks.find(x=>x.id===i.dataset.taxTask);if(t)t.done=i.checked;persist();renderTaxTasks();toast(i.checked?'Steuer-Aufgabe erledigt':'Wieder geöffnet')}));
}
function renderInsurance(){
  $('#insuranceGrid').innerHTML='<article class="card module-card"><span>♢</span><h3>Noch keine Versicherung erfasst</h3><p>Verträge erscheinen hier erst nach dem Eintragen.</p><button data-open="insurance">Versicherung eintragen →</button></article>';
  bindOpenButtons();
}
function openExpense(id){
  const e=state.expenses.find(x=>String(x.id)===String(id));if(!e)return;
  openDetail(e.title,`<p><strong>${money(Number(e.amount)||0)}</strong> · ${escapeHtml(displayDate(e.date))}</p><ul class="detail-list"><li>Bezahlt von: ${escapeHtml(displayPerson(e.person))}</li><li>Grund: ${escapeHtml(e.category)}</li><li>Beleg: ${e.receipt?'vorhanden':'noch nicht vorhanden'}</li></ul><p>Noch keine Aussage, ob das Finanzamt die Ausgabe anerkennt.</p>`);
}

const fieldSets={
  task:{kicker:'Haushalt',title:'Aufgabe hinzufügen',help:'Offene und überfällige Aufgaben bleiben sichtbar. Bei Wiederholungen verschwinden erledigte Runden am nächsten Tag, die nächste kommt automatisch.',fields:`<div class="field-grid"><label class="field full"><span>Was muss erledigt werden?</span><input name="title" placeholder="z. B. Paket abholen" maxlength="160" required></label><label class="field full"><span>Beschreibung (optional)</span><textarea name="description" rows="3" maxlength="1000"></textarea></label><label class="field"><span data-person-label>Wer?</span><select name="person"><option value="Gemeinsam">Beide</option><option value="person1" data-person-name="person1">Noah</option><option value="person2" data-person-name="person2">Charleen</option></select></label><label class="field"><span>Fällig am</span><input name="dueOn" type="date" required></label><label class="calendar-all-day full"><input name="repeats" type="checkbox" data-repeat-toggle><span>Wiederholt sich</span></label><label class="field full" data-repeat-field hidden><span>Intervall</span><select name="recurrence"><option value="daily">Täglich</option><option value="weekly" selected>Wöchentlich</option><option value="biweekly">Alle zwei Wochen</option><option value="monthly">Monatlich</option><option value="custom">Benutzerdefiniert</option></select></label><label class="calendar-all-day full" data-alternate-field hidden><input name="alternate" type="checkbox"><span>Abwechselnd <b data-person-name="person1">Noah</b> und <b data-person-name="person2">Charleen</b> (Putzplan)</span></label><div class="field-grid full" data-custom-repeat hidden><label class="field"><span>Alle</span><input name="recurrenceInterval" type="number" min="1" max="365" value="1"></label><label class="field"><span>Einheit</span><select name="recurrenceUnit"><option value="days">Tage</option><option value="weeks">Wochen</option><option value="months">Monate</option></select></label></div></div>`},
  shopping:{kicker:'Einkauf',title:'Zur Liste hinzufügen',help:'Menge und Bereich werden automatisch erkannt und können später bearbeitet werden.',fields:`<div class="field-grid"><label class="field full"><span>Was brauchen wir?</span><input name="title" placeholder="z. B. 2 × Milch" maxlength="160" required></label><button class="secondary full" type="button" data-shopping-voice>◉ Spracheingabe</button></div>`},
  expense:{kicker:'Ausgabe',title:'Was habt ihr bezahlt?',help:'Wird vom gemeinsamen Monatsbudget abgezogen.',fields:`<div class="field-grid"><label class="field full"><span>Was?</span><input name="title" placeholder="z. B. Einkauf bei Rewe" maxlength="160" required></label><label class="field"><span>Wie viel?</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 23,50" required></label><label class="field"><span>Wann?</span><input name="date" type="date" required></label><details class="field full expense-more"><summary>Mehr Angaben (freiwillig)</summary><div class="field-grid"><label class="field"><span>Wer hat bezahlt?</span><select name="person"><option value="Gemeinsam" selected>Gemeinsam</option><option value="person1" data-person-name="person1">Noah</option><option value="person2" data-person-name="person2">Charleen</option></select></label><label class="field"><span>Bereich</span><select name="category"><option>Gemeinsamer Haushalt</option><option>Persönlich</option><option>Noch unklar</option></select></label><label class="calendar-all-day full"><input name="receipt" type="checkbox"><span>Beleg ist vorhanden</span></label></div></details></div>`},
  day:{kicker:'Arbeit & Fahrten',title:'Wie sah der Tag aus?',help:'Wählt den Ort. Eine mögliche Steuerwirkung wird später geprüft.',fields:`<div class="field-grid"><label class="field"><span>Für wen?</span><select name="person"><option value="person1" data-person-name="person1">Noah</option><option value="person2" data-person-name="person2">Charleen</option></select></label><label class="field"><span>Datum</span><input name="date" type="date" required></label><label class="field full"><span>Was war?</span><select name="kind"><option>Im Büro / Betrieb gearbeitet</option><option>Zu Hause gearbeitet</option><option>In der Hochschule</option><option>Fahrt fürs Nebengewerbe</option><option>Urlaub</option><option>Krank</option><option>Frei</option></select></label></div>`},
  income:{kicker:'Nebengewerbe',title:'Einnahme eintragen',help:'Rechnungsbetrag und Datum festhalten.',fields:`<div class="field-grid"><label class="field full"><span>Wofür?</span><input name="title" placeholder="z. B. Auftrag" maxlength="160" required></label><label class="field"><span>Betrag</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 23,50" required></label><label class="field"><span>Datum</span><input name="date" type="date" required></label></div>`},
  insurance:{kicker:'Versicherung',title:'Vertrag ergänzen',help:'Wir speichern Fakten, versprechen aber keine steuerliche Wirkung.',fields:`<div class="field-grid"><label class="field full"><span>Welche Versicherung?</span><input name="title" maxlength="160" required></label><label class="field"><span>Auf wen?</span><select name="person"><option value="person1" data-person-name="person1">Noah</option><option value="person2" data-person-name="person2">Charleen</option><option value="Gemeinsam">Auf beide</option></select></label><label class="field"><span>Betrag pro Jahr</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 23,50"></label></div>`}
};
let activeEntry='task';
function bindOpenButtons(){$$('[data-open]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',e=>{e.stopPropagation();openEntry(b.dataset.open)})})}
function openEntry(type){setTimeout(()=>{if(type==='shopping')$('#dynamicFields [name=title]')?.focus()},80);activeEntry=type;const f=fieldSets[type];if(!f)return;$('#dialogKicker').textContent=f.kicker;$('#dialogTitle').textContent=f.title;$('#dialogHelp').textContent=f.help;$('#dynamicFields').innerHTML=f.fields;updatePersonNames(householdMembers);$('#dynamicFields').querySelectorAll('input[type="date"]').forEach(input=>input.value=todayIso());const repeat=$('[data-repeat-toggle]'),repeatField=$('[data-repeat-field]'),custom=$('[data-custom-repeat]');if(repeat){repeat.addEventListener('change',()=>{repeatField.hidden=!repeat.checked;const alternateField=$('[data-alternate-field]');if(alternateField)alternateField.hidden=!repeat.checked;custom.hidden=!repeat.checked||$('#dynamicFields select[name="recurrence"]').value!=='custom'});$('#dynamicFields select[name="recurrence"]').addEventListener('change',event=>custom.hidden=!repeat.checked||event.target.value!=='custom')}document.querySelector('[data-shopping-voice]')?.addEventListener('click',()=>window.ZuhauseFeatures?.startShoppingVoice?.());$('#entryDialog').showModal()}
// Putzplan „abwechselnd“: dann fragt „Wer?“ nach der Person, die anfängt („Beide“ passt dort nicht)
document.addEventListener('change',e=>{const form=e.target.closest?.('#entryForm');if(!form||!['alternate','repeats'].includes(e.target.name))return;const alt=form.querySelector('[name=alternate]')?.checked&&form.querySelector('[name=repeats]')?.checked,label=form.querySelector('[data-person-label]'),select=form.querySelector('[name=person]'),both=select?.querySelector('option[value=Gemeinsam]');if(label)label.textContent=alt?'Wer fängt an?':'Wer?';if(both){both.hidden=!!alt;both.disabled=!!alt}if(alt&&select?.value==='Gemeinsam')select.value='person1'});
$('#entryForm').addEventListener('submit',e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target));
  if(['expense','income'].includes(activeEntry)&&!(euroValue(data.amount)>0)){toast('Bitte einen Betrag über 0 € eintragen, z. B. 23,50');return}
  const lateExpense=activeEntry==='expense'&&!!state.budget.closedMonths?.[String(data.date).slice(0,7)];
  if(activeEntry==='task')state.householdTasks.unshift({id:crypto.randomUUID(),seriesId:data.repeats==='on'?crypto.randomUUID():null,title:data.title,description:data.description||'',person:data.person,dueOn:data.dueOn,due:data.dueOn,recurrenceAnchor:data.dueOn,done:false,completedAt:null,recurrence:data.repeats==='on'?(data.recurrence||'weekly'):'none',recurrenceInterval:Number(data.recurrenceInterval)||1,recurrenceUnit:data.recurrenceUnit||'weeks',alternate:data.repeats==='on'&&data.alternate==='on',createdAt:new Date().toISOString()});if(activeEntry==='task'&&state.householdTasks[0]?.alternate&&!['person1','person2'].includes(state.householdTasks[0].person))state.householdTasks[0].person='person1';
  // Einkauf über das Fenster: dieselbe Erkennung und dasselbe Zusammenrechnen wie das Feld in der Liste
  if(activeEntry==='shopping'&&window.ZuhauseFeatures?.addShopping){window.ZuhauseFeatures.addShopping(data.title);$('#entryDialog').close();e.target.reset();return}
  if(activeEntry==='shopping'){const parsed=window.ZuhauseFeatures?.parseShoppingItem?.(data.title)||{title:data.title,quantity:'',category:'Sonstiges'};state.shopping.unshift({id:crypto.randomUUID(),raw:data.title,title:parsed.title,quantity:parsed.quantity,category:parsed.category,done:false,createdAt:new Date().toISOString()})}
  if(activeEntry==='expense')state.expenses.unshift({id:crypto.randomUUID(),date:data.date,title:data.title,category:data.category,person:data.person,amount:euroValue(data.amount),receipt:data.receipt==='on',review:['Beruf / Arbeit','Hochschule / Studium','Nebengewerbe','Noch unklar'].includes(data.category),icon:'€'});
  if(activeEntry==='income')state.incomes.push({id:crypto.randomUUID(),title:data.title,amount:euroValue(data.amount),date:data.date});
  persist();renderAll();$('#entryDialog').close();e.target.reset();toast(lateExpense?'Gespeichert – der Monat war schon abgeschlossen, die Ausgabe zählt im laufenden Monat':'Eintrag gespeichert');
});
$$('[data-entry-cancel]').forEach(button=>button.addEventListener('click',()=>$('#entryDialog').close()));

const details={
  storage:['Noch nicht zwischen Geräten verbunden','<p>Diese erste Fassung speichert Eingaben nur in diesem Browser. Sobald Supabase verbunden ist, bekommen eure beiden iPhones und der Computer denselben Stand.</p><p>Bis dahin bitte keine echten Steuerunterlagen hochladen.</p>'],
  pet:['Haustier','<p>Hier können später Tierarzttermine, Impfungen, Futter-Erinnerungen und wichtige Unterlagen gesammelt werden.</p>'],
  contracts:['Wohnung & Verträge','<p>Geplant sind Miete, Strom, Internet und gemeinsame Versicherungen – jeweils mit Laufzeit, Zahlender Person und Erinnerung.</p>'],
  notifications:['Müll-Mitteilungen','<p>Die App erinnert euch am Vortag um 15:00 Uhr. Fallen mehrere Tonnen zusammen, kommt nur eine gemeinsame Mitteilung.</p><p>Auf jedem iPhone muss die App auf dem Home-Bildschirm liegen und die Mitteilung einmal erlaubt werden.</p>'],
  install:['Zuhause auf dem iPhone','<ol class="plain-steps"><li>Diese Seite in Safari öffnen.</li><li>Unten auf „Teilen“ tippen.</li><li>„Zum Home-Bildschirm“ und dann „Hinzufügen“ wählen.</li></ol><p>Push-Mitteilungen funktionieren auf iPhones ab iOS 16.4 nur aus der installierten Home-Bildschirm-App.</p>'],
  settings:['Einstellungen','<p>Hier kommen später eure Zugänge, Datensicherung, persönliche Ansicht und die Auswahl der Erinnerungen hinein.</p>'],
  financeTogether:['Gemeinsame Finanzen','<p>Miete, Haushaltskosten und gemeinsame Verträge. Bei Steuerthemen wird zusätzlich gespeichert, wer tatsächlich bezahlt hat.</p>'],
  financePerson1:['Persönlicher Bereich','<p>Persönliche Ausgaben und Einnahmen bleiben der ausgewählten Person zugeordnet.</p>'],
  financePerson2:['Persönlicher Bereich','<p>Persönliche Ausgaben und Einnahmen bleiben der ausgewählten Person zugeordnet.</p>'],
  docsPrivate:['Meine Dokumente','<p>Private Dokumente können nur von der Person geöffnet werden, die sie hochgeladen hat.</p>'],
  docsShared:['Gemeinsame Dokumente','<p>Gemeinsame Dokumente sind für beide Haushaltsmitglieder sichtbar.</p>'],
  profilePerson1:['Persönliches Profil','<p>Eigene Termine, Unterlagen und Steuerangaben.</p>'],
  profilePerson2:['Persönliches Profil','<p>Eigene Termine, Unterlagen und Steuerangaben.</p>'],
  householdProfile:['Euer gemeinsamer Bereich','<p>Kalender, Aufgaben, Einkauf, Wohnung und gemeinsame Kosten.</p>'],
  elsterWhy:['Warum noch nicht direkt senden?','<p>ELSTER muss echte Steuerdaten sicher prüfen und verschlüsseln. Dafür brauchen wir eine offizielle Entwicklerfreigabe und die ELSTER-Komponente ERiC.</p>'],
  elsterData:['Schritt 1: Daten sammeln','<p>Kalender, Ausgaben, Versicherungen, Lohnunterlagen und Nebengewerbe werden getrennt gesammelt.</p>'],
  elsterCheck:['Schritt 2: Einfach prüfen','<p>Alltagsfragen werden später in die passenden ELSTER-Felder übersetzt.</p>'],
  elsterAccount:['Schritt 3: ELSTER verbinden','<p>Ihr erhaltet jeweils einen eigenen kostenlosen ELSTER-Zugang. Zertifikate bleiben bei euch.</p>'],
  elsterSend:['Schritt 4: Prüfen und senden','<p>Vorher seht ihr jede Angabe. Gesendet wird nur nach eurer ausdrücklichen Bestätigung.</p>'],
  elsterPerson1:['Eigene ELSTER-Erklärung','<p>Jede Person bereitet ihre Einkommensteuererklärung getrennt vor.</p>'],
  elsterPerson2:['Eigene ELSTER-Erklärung','<p>Jede Person bereitet ihre Einkommensteuererklärung getrennt vor.</p>']
};
function openDetail(title,body){$('#detailTitle').textContent=title;const target=$('#detailBody');target.replaceChildren();if(body instanceof Node)target.append(body);else target.innerHTML=body;$('#detailDialog').showModal()}
$$('[data-detail]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const d=details[b.dataset.detail];if(d)openDetail(d[0],d[1])}));
const explanations={
  safety:['Warum wir vorsichtig sind','<p>Steuern hängen von vielen Einzelheiten ab. Eine Ausgabe kann beruflich wirken und trotzdem ganz oder teilweise nicht zählen.</p><ol class="plain-steps"><li>Ihr sammelt den echten Vorgang.</li><li>Die App zeigt offene Fragen.</li><li>Vor der Abgabe wird alles geprüft.</li></ol>'],
  eur:['EÜR ohne Fachsprache','<p>EÜR heißt „Einnahmenüberschussrechnung“: Geld aus dem Gewerbe minus passende Ausgaben. Das Ergebnis ist noch nicht die zu zahlende Steuer.</p>'],
  handover:['So soll ELSTER funktionieren','<ol class="plain-steps"><li>Je Person eine eigene Erklärung.</li><li>Alle Angaben noch einmal in normaler Sprache.</li><li>Technische Prüfung durch ELSTER.</li><li>Versand nur nach eurer Bestätigung.</li><li>Offizielles Sendeprotokoll speichern.</li></ol>']
};
$$('[data-explain]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const d=explanations[b.dataset.explain];if(!d)return;$('#explainTitle').textContent=d[0];$('#explainBody').innerHTML=d[1];$('#explainDialog').showModal()}));
$('#expenseSearch').addEventListener('input',e=>renderExpenses(e.target.value));
const VAPID_PUBLIC_KEY='BBdsUcOhWD0t-zaxgt7JrMuGKa2kf2-KaIZ0bY6ZmMBKXlF3h-NFNogjIefewWbPxFQDvfrqhhz8g4bLcto7FRs';
function urlBase64ToUint8Array(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}
// Nach einem Termin mit Erinnerung nur dann auf Mitteilungen hinweisen, wenn sie auf diesem Gerät noch nicht erlaubt sind
function reminderHint(){if(!('Notification' in window)||Notification.permission!=='granted')notificationHelp()}
function notificationHelp(){
  const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const status=!supported?'Dieses Gerät unterstützt App-Mitteilungen leider nicht.':Notification.permission==='granted'?'Mitteilungen sind auf diesem Gerät erlaubt.':installed?'Mitteilungen können jetzt eingeschaltet werden.':'Bitte fügt Zuhause zuerst zum Home-Bildschirm hinzu.';
  openDetail('App-Mitteilungen',`<p>Zuhause kann euch persönlich an Kalendertermine und gemeinsam an die Müllabholung erinnern.</p><div class="notification-box"><span class="notification-status">${status}</span>${supported&&installed?'<button class="primary" type="button" data-enable-notifications>Mitteilungen einschalten</button>':'<button class="secondary" type="button" data-detail-install>Installationshilfe öffnen</button>'}</div><p>Diese Einstellung wird auf jedem iPhone einmal vorgenommen.</p>`);
}
async function enableNotifications(){
  if(!cloudReady||!currentHousehold||!currentUser){toast('Bitte zuerst anmelden');return false}
  if(VAPID_PUBLIC_KEY.startsWith('VAPID_')){toast('Der Mitteilungsdienst wird noch verbunden');return}
  try{
    const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Mitteilungen wurden nicht erlaubt');return}
    const registration=await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
    const data=subscription.toJSON();
    const {error}=await cloud.from('push_subscriptions').upsert({household_id:currentHousehold.id,user_id:currentUser.id,endpoint:data.endpoint,p256dh:data.keys?.p256dh,auth_key:data.keys?.auth,enabled:true,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
    if(error)throw error;toast('App-Mitteilungen sind eingeschaltet');$('#detailDialog').close();
  }catch{toast('Mitteilungen konnten noch nicht eingeschaltet werden')}
}
async function disableCurrentPush(){
  if(!('serviceWorker' in navigator))return;
  try{const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();if(!subscription)return;if(cloud&&currentUser)await cloud.from('push_subscriptions').update({enabled:false,updated_at:new Date().toISOString()}).eq('endpoint',subscription.endpoint).eq('user_id',currentUser.id);await subscription.unsubscribe()}catch{}
}
$$('[data-notification-settings]').forEach(button=>button.addEventListener('click',notificationHelp));
document.addEventListener('click',event=>{if(event.target.closest('[data-enable-notifications]'))enableNotifications();if(event.target.closest('[data-detail-install]')){const d=details.install;openDetail(d[0],d[1])}});
$('#fakeUpload').addEventListener('click',()=>$('#fileInput').click());
$('#scanDocument').addEventListener('click',()=>$('#cameraInput').click());
$('#fileInput').addEventListener('change',e=>{if(e.target.files[0])uploadDocument(e.target.files[0]);e.target.value=''});
$('#cameraInput').addEventListener('change',e=>{if(e.target.files[0])uploadDocument(e.target.files[0]);e.target.value=''});
function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function readableSize(bytes=0){if(bytes<1024)return bytes+' B';if(bytes<1048576)return Math.round(bytes/1024)+' KB';return (bytes/1048576).toFixed(1).replace('.',',')+' MB'}
// Grund für ein gescheitertes Hochladen merken: Netzproblem (→ Scan wartet und geht später hoch) oder etwas anderes (→ Grund anzeigen)
function uploadFailed(error,kind){const message=String(error?.message||error||'');window.__uploadFailure={kind:kind||(!navigator.onLine||/fetch|network|load failed|timed? ?out|abort|connection/i.test(message)?'network':/quota|exceed|size|too large|payload|413/i.test(message)?'full':'other'),message};return false}
async function uploadDocument(file){
  window.__uploadFailure=null;
  if(!cloudReady||!currentHousehold||!currentUser){toast('Bitte zuerst anmelden');return uploadFailed('nicht angemeldet','network')}
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)){toast('Bitte ein PDF oder Foto auswählen');return uploadFailed('Dateityp','other')}
  if(file.size>10485760){toast('Die Datei darf höchstens 10 MB groß sein');return uploadFailed('zu groß','full')}
  setSyncStatus('Datei wird geschützt abgelegt …','syncing');
  const cleanName=file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100)||'dokument';
  const visibility='shared',meta=window.__pendingDocumentMeta||{},originalPaths=[];
  const path=`${currentHousehold.id}/shared/${crypto.randomUUID()}-${cleanName}`;
  for(const original of Array.isArray(meta.originalFiles)?meta.originalFiles:[]){
    const originalName=original.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100)||'original';
    const originalPath=`${currentHousehold.id}/shared/originals/${crypto.randomUUID()}-${originalName}`;
    const {error}=await cloud.storage.from('receipts').upload(originalPath,original,{cacheControl:'3600',upsert:false,contentType:original.type});
    if(error){if(originalPaths.length)await cloud.storage.from('receipts').remove(originalPaths);setSyncStatus('Originale konnten nicht gesichert werden','error');toast('Die Originalfotos konnten nicht vollständig gespeichert werden');return uploadFailed(error)}
    originalPaths.push(originalPath);
  }
  const {error:uploadError}=await cloud.storage.from('receipts').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(uploadError){if(originalPaths.length)await cloud.storage.from('receipts').remove(originalPaths);setSyncStatus('Upload fehlgeschlagen','error');toast('Die Datei konnte nicht hochgeladen werden');return uploadFailed(uploadError)}
  if(meta.thumb)await cloud.storage.from('receipts').upload(`${path}.thumb.jpg`,meta.thumb,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'}).catch(()=>{});
  const record={household_id:currentHousehold.id,uploaded_by:currentUser.id,owner_user_id:currentUser.id,visibility,storage_path:path,file_name:meta.name||file.name,mime_type:file.type,size_bytes:file.size,category:meta.category||'Sonstige Dokumente',folder:meta.folder||'Gemeinsam',ocr_text:meta.ocrText||'',original_paths:originalPaths};
  let {error:metaError}=await cloud.from('documents').insert(record);
  if(metaError&&/folder|ocr_text|original_paths/i.test(metaError.message||'')){delete record.folder;delete record.ocr_text;delete record.original_paths;({error:metaError}=await cloud.from('documents').insert(record))}
  if(metaError){await cloud.storage.from('receipts').remove([path,`${path}.thumb.jpg`,...originalPaths]).catch(()=>{});setSyncStatus('Upload zurückgenommen','error');toast('Die Datei konnte nicht vollständig gespeichert werden');return uploadFailed(metaError)}
  window.__pendingDocumentMeta=null;await loadDocuments();setSyncStatus('Sicher gespeichert','connected');toast('Dokument sicher abgelegt');return path;
}
async function loadDocuments(){
  const list=$('#documentList');if(!list||!cloudReady||!currentHousehold)return;
  let {data,error}=await cloud.from('documents').select('id,file_name,mime_type,size_bytes,storage_path,created_at,category,folder,ocr_text,visibility,owner_user_id,uploaded_by').eq('household_id',currentHousehold.id).order('created_at',{ascending:false});
  if(error&&/folder|ocr_text/i.test(error.message||''))({data,error}=await cloud.from('documents').select('id,file_name,mime_type,size_bytes,storage_path,created_at,category,visibility,owner_user_id,uploaded_by').eq('household_id',currentHousehold.id).order('created_at',{ascending:false}));
  if(error){list.innerHTML='<p>Dateien konnten gerade nicht geladen werden.</p>';return}
  list.innerHTML=data.length?data.map(doc=>`<button class="document-row" data-document-path="${escapeHtml(doc.storage_path)}" data-folder="${escapeHtml(doc.folder||'Gemeinsam')}" data-category="${escapeHtml(doc.category||'Sonstige Dokumente')}" data-search="${escapeHtml(`${doc.file_name} ${doc.category||''} ${doc.folder||''} ${doc.ocr_text||''}`)}"><span class="document-icon">${doc.mime_type==='application/pdf'?'PDF':'▣'}</span><span><strong>${escapeHtml(doc.file_name)}</strong><small>${new Date(doc.created_at).toLocaleDateString('de-DE')} · ${readableSize(doc.size_bytes)} · ${escapeHtml(doc.folder||'Gemeinsam')} / ${escapeHtml(doc.category||'Sonstige Dokumente')}</small></span><em>Öffnen →</em></button>`).join(''):'<p>Noch keine Datei hochgeladen.</p>';
  const privateSalary=data.filter(doc=>doc.visibility!=='shared'&&(doc.owner_user_id||doc.uploaded_by)===currentUser.id&&/lohn/i.test(doc.category||'')).length,shared=data.filter(doc=>doc.visibility==='shared').length;
  if($('#documentPrivateCount'))$('#documentPrivateCount').textContent=String(privateSalary);if($('#documentPrivateProgress'))$('#documentPrivateProgress').style.width=`${Math.min(100,Math.round(privateSalary/12*100))}%`;if($('#documentSharedCount'))$('#documentSharedCount').textContent=String(shared);if($('#documentSharedProgress'))$('#documentSharedProgress').style.width=shared?'100%':'0%';
  $$('[data-document-path]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.documentPath)));
}
function bindDocumentChecklist(){
  $$('[data-document-check]').forEach(input=>{input.checked=!!state.documentChecklist[input.dataset.documentCheck];if(input.dataset.bound)return;input.dataset.bound='1';input.addEventListener('change',()=>{state.documentChecklist[input.dataset.documentCheck]=input.checked;persist();toast('Dokumenten-Check gespeichert')})});
}
async function openDocument(path){
  const {data,error}=await cloud.storage.from('receipts').createSignedUrl(path,60);
  if(error||!data?.signedUrl){toast('Datei konnte gerade nicht geöffnet werden');return}
  const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener';link.click();
}
$('#retryConnection').addEventListener('click',()=>{connectionAttempts=0;showAuthPanel('authLoading');resumeSession()});
document.addEventListener('click',e=>{if(e.target.closest('[data-open-switch]')&&details.storage)openDetail(details.storage[0],details.storage[1])});
document.addEventListener('click',async e=>{
  if(!e.target.closest('[data-switch-household]'))return;e.preventDefault();
  const form=e.target.closest('#switchHouseholdForm'),code=form.querySelector('[name=code]').value.trim(),message=form.querySelector('#switchHouseholdMessage'),button=form.querySelector('button');
  if(!code)return;if(!confirm('Wirklich in das andere Zuhause wechseln? Dein bisheriges Zuhause bleibt gespeichert, du siehst es danach aber nicht mehr.'))return;
  button.disabled=true;message.textContent='Wird gewechselt …';
  const {error}=await cloud.rpc('switch_household',{invite_code:code,member_name:currentMemberName||null});button.disabled=false;
  if(error){message.textContent=/Einladungscode/i.test(error.message)?'Der Einladungscode stimmt nicht. Bitte noch einmal prüfen.':/bereits/i.test(error.message)?'Du bist schon in diesem Zuhause.':/noch jemand/i.test(error.message)?'Wechseln geht nicht, weil in deinem jetzigen Zuhause noch jemand ist.':friendlyError(error.message);return}
  message.textContent='Geschafft! Die App lädt neu …';setTimeout(()=>location.reload(),800);
});
$('#showRegister').addEventListener('click',()=>showAuthPanel('authRegister'));
$('#showReset').addEventListener('click',()=>{const email=$('#loginForm').elements.email.value;showAuthPanel('authReset');if(email)$('#resetForm').elements.email.value=email;$('#resetMessage').textContent=''});
document.querySelectorAll('[data-show-login]').forEach(button=>button.addEventListener('click',()=>showAuthPanel('authLogin')));
$('#resetForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),email=form.elements.email.value.trim();button.disabled=true;$('#resetMessage').textContent='Wird gesendet …';
  const {error}=await cloud.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});button.disabled=false;
  $('#resetMessage').textContent=error?(/rate|limit|seconds/i.test(error.message)?'Gerade wurden zu viele E-Mails verschickt. Bitte in einer Stunde noch einmal versuchen.':friendlyError(error.message)):'Geschafft! Schau in dein Postfach (auch im Spam-Ordner). Die E-Mail heißt „Reset your password“ – tippe dort auf den Link.';
});
$('#newPasswordForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');
  if(form.elements.password.value!==form.elements.repeat.value){$('#newPasswordMessage').textContent='Die beiden Passwörter stimmen nicht überein.';return}
  button.disabled=true;$('#newPasswordMessage').textContent='Wird gespeichert …';
  const {error}=await cloud.auth.updateUser({password:form.elements.password.value});button.disabled=false;
  if(error){$('#newPasswordMessage').textContent=friendlyError(error.message);return}
  passwordRecovery=false;history.replaceState(null,'',location.pathname);form.reset();toast('Neues Passwort gespeichert');await loadHousehold();
});
$('#showLogin').addEventListener('click',()=>showAuthPanel('authLogin'));
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;button.textContent='Wird angemeldet …';$('#loginMessage').textContent='';
  const {data:result,error}=await cloud.auth.signInWithPassword({email:data.email,password:data.password});
  button.disabled=false;button.textContent='Anmelden';
  if(error){$('#loginMessage').textContent=friendlyError(error.message);return}
  currentUser=result.user;await loadHousehold();form.reset();
});
$('#registerForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;button.textContent='Wird angelegt …';$('#registerMessage').textContent='';
  const {data:result,error}=await cloud.auth.signUp({email:data.email,password:data.password,options:{emailRedirectTo:location.origin+location.pathname}});
  button.disabled=false;button.textContent='Zugang anlegen';
  if(error){$('#registerMessage').textContent=friendlyError(error.message);return}
  if(result.session){currentUser=result.user;await loadHousehold()}else{$('#registerMessage').textContent='Fast fertig: Bitte öffne jetzt die Bestätigungs-E-Mail und tippe dort auf den Link.'}
});
$('#createHouseholdForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;$('#householdMessage').textContent='Euer Zuhause wird angelegt …';
  const {error}=await cloud.rpc('create_household',{household_name:data.householdName,member_name:data.memberName});button.disabled=false;
  if(error){$('#householdMessage').textContent=friendlyError(error.message);return}await loadHousehold();
});
$('#joinHouseholdForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;$('#householdMessage').textContent='Einladungscode wird geprüft …';
  const {error}=await cloud.rpc('join_household',{invite_code:data.inviteCode,member_name:data.memberName});button.disabled=false;
  if(error){$('#householdMessage').textContent=/Einladungscode/i.test(error.message)?'Der Einladungscode stimmt nicht. Bitte noch einmal prüfen.':friendlyError(error.message);return}await loadHousehold();
});
document.addEventListener('click',async e=>{if(e.target.closest('[data-sign-out]')){await Promise.allSettled([window.ZuhauseRecipes?.sync?.(),localDirty?saveCloudState():null]);const waiting=(await window.ZuhauseScanner?.queueAll?.())?.length||0,recipes=window.ZuhauseRecipes?.pendingCount?.()||0,open=[waiting?`${waiting} ${waiting===1?'Scan':'Scans'}`:'',recipes?`${recipes} ${recipes===1?'Rezept':'Rezepte'}`:'',localDirty?'weitere Änderungen':''].filter(Boolean);if(open.length&&!confirm(`Noch nicht hochgeladen: ${open.join(', ')}. Beim Abmelden gehen sie auf diesem Handy verloren. Trotzdem abmelden?`))return;if(waiting)await window.ZuhauseScanner.queueClear();await disableCurrentPush();await cloud.auth.signOut();$('#detailDialog').close()}});
$('#exportData').addEventListener('click',()=>{const year=new Date().getFullYear(),data={hinweis:'Kontrolldatei. Noch keine ELSTER-Datei.',steuerjahr:year,personen:[personNames.person1,personNames.person2],ausgaben:state.expenses,einnahmen:state.incomes,aufgaben:state.taxTasks};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`zuhause-steuer-${year}-kontrolle.json`;a.click();URL.revokeObjectURL(a.href);toast('Kontroll-Datei geladen')});
function renderAll(){
  setGreeting();renderTimeline();renderTasks();renderShopping();renderCalendar();renderExpenses();renderTaxTasks();bindDocumentChecklist();
  const year=new Date().getFullYear(),income=state.incomes.filter(item=>{const date=parseStoredDate(item.date);return date&&date.getFullYear()===year}).reduce((sum,item)=>sum+(Number(item.amount)||0),0),businessExpenses=state.expenses.filter(item=>{const date=parseStoredDate(item.date);return date&&date.getFullYear()===year&&item.category==='Nebengewerbe'}).reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  $('#incomeTotal').textContent=money(income);$('#businessExpenseTotal').textContent=money(businessExpenses);$('#profitTotal').textContent=money(income-businessExpenses);
}
window.ZuhauseCalendar?.bootstrap({legacyAppointments:state.appointments,automaticEvents,callbacks:{toast,go,detail:openDetail,remindersSelected:reminderHint}});
setGreeting();bindOpenButtons();renderAll();renderInsurance();
const localCalendarPreview=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='calendar';
if(localCalendarPreview){$('#authScreen').hidden=true;go('calendar')}else{startCloud();setInterval(refreshCloudState,5000);window.addEventListener('focus',refreshCloudState);document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCloudState(true);if(localDirty)saveCloudState()}});window.addEventListener('pageshow',()=>refreshCloudState(true));window.addEventListener('online',()=>{if(!$('#authOffline').hidden){connectionAttempts=0;resumeSession();return}setSyncStatus('Verbindung wieder da','syncing');saveCloudState()})}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
const requestParams=new URLSearchParams(location.search),requestedDate=requestParams.get('date'),requestedPage=requestParams.get('page');if(/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||''))window.ZuhauseCalendar?.selectDate(requestedDate);if(requestedPage&&document.getElementById(requestedPage))go(requestedPage);
