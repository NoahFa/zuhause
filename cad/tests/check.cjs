// Prüft das Zeichenprogramm im echten Browser: Start ohne Fehler, Fräs-Einstellungen, Verbinden, Formen kombinieren, Bohrbilder, Text.
// Aufruf: node cad/tests/check.cjs   (optional: Ordner für Fotos als 1. Angabe)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..'),SHOTS=process.argv[2]||null;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';const p=path.join(ROOT,f);if(!p.startsWith(ROOT)||!fs.existsSync(p)){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});r.end(fs.readFileSync(p))});
let fails=0;const ok=(c,t,extra='')=>{console.log((c?'  ok   ':'  FEHLER ')+t+(c?'':' '+extra));if(!c)fails++};
const near=(a,b,t=0.05)=>Math.abs(a-b)<=t;
(async()=>{await new Promise(r=>srv.listen(0,r));const url=`http://localhost:${srv.address().port}/`;
 const b=await chromium.launch();const errs=[];
 const open=async(vp)=>{const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await p.goto(url);await p.waitForFunction(()=>window.__cad);return p};
 const p=await open({width:1440,height:900});
 const C=(...a)=>p.evaluate(a=>{for(const t of a){__cad.inp.value=t;__cad.onEnter()}},a);
 const ents=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__cad.S.ents)));
 const fresh=async()=>{await p.evaluate(()=>{document.getElementById('newB').click()})};
 const areaOf=id=>p.evaluate(id=>__cad.areaOf(id),id);
 const shot=async n=>{if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await p.evaluate(()=>__cad.zoomAll());await p.screenshot({path:path.join(SHOTS,n+'.png')})}};

 console.log('Start');
 let E=await ents();ok(E.length===7,'Beispielzeichnung geladen');
 let cuts=await p.evaluate(()=>__cad.S.ents.filter(e=>e.t!=='dim').map(e=>__cad.cutOf(e).t));
 ok(cuts.join()==='outside,inside,inside,inside','Automatik: Front = Außen, Topfbohrungen und Langloch = Innen',cuts.join());
 await p.evaluate(()=>__cad.act('cam'));await shot('01-fraesvorschau-beispiel');

 console.log('Fräserbahn');
 await fresh();await C('R','0,0','200,100','R','50,30','@60,40','K','150,50','2','K','30,80','10');
 let r=await p.evaluate(()=>__cad.S.ents.map(e=>{const m=__cad.camOf(e),c=__cad.cutOf(e);return{t:c.t,left:m.left.length,fail:m.fail,center:m.center.length}}));
 ok(r[0].t==='outside'&&r[0].left===0&&r[0].center===1,'Außenkontur: Bahn außen herum, kein Rest');
 ok(r[1].t==='inside'&&r[1].left===4,'Innenausschnitt eckig mit Fräser Ø6: 4 Ecken bleiben stehen',JSON.stringify(r[1]));
 ok(r[2].fail,'Loch Ø4 mit Fräser Ø6: passt nicht');
 ok(!r[3].fail&&r[3].left===0,'Loch Ø20 mit Fräser Ø6: passt');
 // Fräser-Ø am Objekt ändern
 await p.evaluate(()=>{const e=__cad.S.ents[2];__cad.sel.clear();__cad.sel.add(e.id);__cad.updProps();const el=document.getElementById('c_tool');el.value='3';el.dispatchEvent(new Event('change'))});
 r=await p.evaluate(()=>{const e=__cad.S.ents[2];return{tool:e.tool,fail:__cad.camOf(e).fail}});ok(r.tool===3&&!r.fail,'Fräser Ø3 am Loch eingetragen: passt jetzt');
 await p.evaluate(()=>{const el=document.getElementById('c_t');el.value='pocket';el.dispatchEvent(new Event('change'));const d=document.getElementById('c_d');d.value='12,5';d.dispatchEvent(new Event('change'))});
 r=await p.evaluate(()=>__cad.cutOf(__cad.S.ents[2]));ok(r.t==='pocket'&&r.d===12.5,'Frästyp Tasche und Tiefe 12,5 gespeichert');
 await p.evaluate(()=>{const el=document.getElementById('d_tool');el.value='8';el.dispatchEvent(new Event('change'))});
 r=await p.evaluate(()=>[__cad.cutOf(__cad.S.ents[0]).tool,__cad.cutOf(__cad.S.ents[2]).tool]);ok(r[0]===8&&r[1]===3,'Fräser-Standard 8 gilt für alles ohne eigene Angabe');
 await p.keyboard.press('Control+z');r=await p.evaluate(()=>__cad.S.def.tool);ok(r===6,'Rückgängig stellt den Standard wieder her');
 await shot('02-fraeserbahn-ecken');

 console.log('Verbinden');
 await fresh();await C('L','0,0','100,0','100,60','','B','100,60','50,90','0,60','L','0,60','0,0','');
 await p.evaluate(()=>{__cad.act('alle')});await C('VB');E=await ents();
 ok(E.length===1&&E[0].t==='pline'&&E[0].closed&&E[0].bl&&E[0].bl.filter(v=>Math.abs(v)>1e-6).length===1,'3 Linien + 1 Bogen werden eine geschlossene Kontur mit Bogen',JSON.stringify(E).slice(0,200));
 let A=await areaOf(E[0].id);const seg=(()=>{const R=(50*50+30*30)/(2*30),th=2*Math.asin(50/R);return R*R/2*(th-Math.sin(th))})();
 ok(near(A,6000+seg,1),'Fläche stimmt (Rechteck + Bogenstück)',A+' / '+(6000+seg));
 ok((await p.evaluate(()=>__cad.cutOf(__cad.S.ents[0]).t))==='outside','verbundene Kontur wird automatisch Außen');
 await C('VS','5');await p.evaluate(()=>{const e=__cad.S.ents[0];__cad.adv({e,p:[50,0]});__cad.adv({p:[50,20]})});await C('');
 E=await ents();ok(E.length===2&&near(await areaOf(E[1].id),(await p.evaluate(()=>__cad.areaOf(__cad.S.ents[0].id,-5))),0.5),'Versatz nach innen bei Kontur mit Bogen');
 await fresh();await C('L','0,0','50,0','','L','80,0','120,0','');await p.evaluate(()=>__cad.act('alle'));await C('VB');E=await ents();ok(E.length===2&&E.every(e=>e.t==='line'),'Linien mit Lücke bleiben getrennt');

 console.log('Formen kombinieren');
 const two=async()=>{await fresh();await C('R','0,0','100,100','K','100,50','30')};
 await two();await p.evaluate(()=>__cad.act('alle'));await C('VE');E=await ents();
 ok(E.length===1&&near(await areaOf(E[0].id),10000+Math.PI*900/2,2),'Vereinigen: Rechteck + halber Kreis');
 await two();await p.evaluate(()=>{__cad.sel.add(__cad.S.ents[0].id)});await C('AB');await p.evaluate(()=>{__cad.sel.add(__cad.S.ents[1].id)});await C('');E=await ents();
 ok(E.length===1&&near(await areaOf(E[0].id),10000-Math.PI*900/2,2),'Abziehen: Rechteck minus halber Kreis');
 await two();await p.evaluate(()=>__cad.act('alle'));await C('SM');E=await ents();
 ok(E.length===1&&near(await areaOf(E[0].id),Math.PI*900/2,2),'Schnittmenge: halber Kreis');
 await fresh();await C('R','0,0','100,100','K','50,50','20');await p.evaluate(()=>{__cad.sel.add(__cad.S.ents[0].id)});await C('AB');await p.evaluate(()=>{__cad.sel.add(__cad.S.ents[1].id)});await C('');E=await ents();
 cuts=await p.evaluate(()=>__cad.S.ents.map(e=>__cad.cutOf(e).t));ok(E.length===2&&cuts.join()==='outside,inside','Abziehen in der Mitte ergibt Außenkontur + Innenausschnitt',cuts.join());
 await p.keyboard.press('Control+z');E=await ents();ok(E.length===2&&E[1].t==='circle','Rückgängig holt den Kreis zurück');
 await shot('03-formen');

 console.log('Bohrbilder');
 await fresh();await C('R','0,0','400,600','BB','L','5','5','32','13');await p.evaluate(()=>{__cad.adv({p:[0,0]})});await C('@37,64','90');E=await ents();
 let H=E.filter(e=>e.t==='circle');ok(H.length===5&&near(H[0].c[0],37)&&near(H[0].c[1],64)&&near(H[4].c[1],64+4*32)&&H.every(h=>h.r===2.5&&h.ct==='pocket'&&h.cd===13),'32er-Lochreihe: 5 × Ø5, 37 von der Kante, nach oben');
 ok(H.every(h=>h.tool===3)&&!(await p.evaluate(()=>__cad.camOf(__cad.S.ents[1]).fail)),'Löcher bekommen einen passenden Fräser (Ø3)');
 await C('BB','T','35','13');await p.evaluate(()=>{__cad.adv({p:[400,0]})});await C('@-21.5,100','@-21.5,500','');E=await ents();
 H=E.filter(e=>e.t==='circle'&&e.r===17.5);ok(H.length===2&&near(H[0].c[0],378.5)&&near(H[1].c[1],500)&&H[0].cd===13&&H[0].tool===undefined,'Topfband Ø35: 2 Stück, 21,5 von der Kante');
 await C('BB','D','8','3','32','12','','200,300','0');E=await ents();H=E.filter(e=>e.r===4);ok(H.length===3&&near(H[2].c[0],264)&&H[0].cd===12,'Dübelbild: 3 × Ø8 im Abstand 32');
 await C('BB','K','6','5','10','200,450','40');E=await ents();H=E.slice(-6);ok(H.every(h=>near(Math.hypot(h.c[0]-200,h.c[1]-450),40))&&near(H[0].c[1],490),'Lochkreis: 6 Löcher auf Radius 40');
 await shot('04-bohrbilder');

 console.log('Text');
 await C('TX','Küche Tür 1 – Ø35','20','40,560');E=await ents();const T=E[E.length-1];
 ok(T.t==='text'&&T.s==='Küche Tür 1 – Ø35'&&T.h===20&&T.ct==='online'&&T.cd===1,'Text als Gravur angelegt (Umlaute, Ø)');
 r=await p.evaluate(id=>{const e=__cad.S.ents.find(x=>x.id===id),b=__cad.bbox([e]);return{b,band:__cad.camOf(e).band.length}},T.id);
 ok(near(r.b[3]-560,20*914/662,6)&&r.b[2]-r.b[0]>150&&r.band>5,'Schrifthöhe und Breite stimmen, Fräsbahn vorhanden',JSON.stringify(r));
 await p.evaluate(id=>{__cad.sel.clear();__cad.sel.add(id);__cad.updProps();const el=document.querySelector('#props input[data-i="0"]');el.value='Neu';el.dispatchEvent(new Event('change'))},T.id);
 ok((await ents()).pop().s==='Neu','Text rechts in den Eigenschaften änderbar');
 await p.evaluate(()=>__cad.sel.clear());await shot('05-text');

 console.log('Speichern und Laden');
 const json=await p.evaluate(()=>JSON.stringify({app:'OriginCAD',v:2,...__cad.S}));
 await p.setInputFiles('#file',{name:'Test.json',mimeType:'application/json',buffer:Buffer.from(json)});await p.waitForFunction(()=>document.getElementById('fname').textContent.startsWith('Test.json'));
 ok(JSON.stringify(await ents())===JSON.stringify(JSON.parse(json).ents),'Datei mit Fräs-Angaben kommt unverändert zurück');
 const old=JSON.stringify({ents:[{id:1,t:'line',ly:'0',a:[0,0],b:[10,0]}],layers:[{n:'0',c:'#c9ced6',v:true}],cur:'0',nid:2});
 await p.setInputFiles('#file',{name:'Alt.json',mimeType:'application/json',buffer:Buffer.from(old)});await p.waitForFunction(()=>document.getElementById('fname').textContent.startsWith('Alt.json'));
 r=await p.evaluate(()=>__cad.cutOf(__cad.S.ents[0]));ok(r.t==='online'&&r.tool===6&&r.d===6,'Alte Zeichnung aus Etappe 1 lässt sich öffnen');

 console.log('Darstellung');
 for(const[n,vp]of[['tablet',{width:1024,height:768}],['handy',{width:390,height:844}]]){const q=await open(vp);await q.evaluate(()=>__cad.act('cam'));
  const o=await q.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth,cv:document.getElementById('cv').clientHeight}));ok(o.sw<=o.w&&o.cv>150,`${n}: nichts läuft seitlich über, Zeichenfläche sichtbar`,JSON.stringify(o));
  if(SHOTS)await q.screenshot({path:path.join(SHOTS,'06-'+n+'.png')});await q.close()}
 ok(errs.length===0,'keine Skriptfehler',errs.join(' | '));
 await b.close();srv.close();console.log(fails?`\n${fails} FEHLER`:'\nAlles in Ordnung.');process.exit(fails?1:0)})();
