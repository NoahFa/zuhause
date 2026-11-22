{
/* ---------- Mathe ---------- */
const TAU=Math.PI*2,D2R=Math.PI/180;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],crs=(a,b)=>a[0]*b[1]-a[1]*b[0],len=a=>Math.hypot(a[0],a[1]);
const dist=(a,b)=>len(sub(a,b)),nrm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l]},ang=a=>Math.atan2(a[1],a[0]);
const pol=(c,r,t)=>[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)],na=t=>((t%TAU)+TAU)%TAU;
const rotP=(p,c,t)=>{const d=sub(p,c),co=Math.cos(t),si=Math.sin(t);return[c[0]+d[0]*co-d[1]*si,c[1]+d[0]*si+d[1]*co]};
const inArc=(t,a0,a1)=>na(t-a0)<=na(a1-a0)+1e-9;
const mid=(a,b)=>mul(add(a,b),.5),deg=t=>t/D2R;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dSeg(p,a,b){const d=sub(b,a),L=dot(d,d);if(L<1e-18)return dist(p,a);const t=clamp(dot(sub(p,a),d)/L,0,1);return dist(p,add(a,mul(d,t)))}
function lineInt(a,b,c,d){const r=sub(b,a),s=sub(d,c),den=crs(r,s);if(Math.abs(den)<1e-12)return null;return add(a,mul(r,crs(sub(c,a),s)/den))}
const fmt=(v,d=2)=>{const r=Math.round(v*10**d)/10**d;return(Object.is(r,-0)?0:r).toString()};
const fmtDE=v=>fmt(v,1).replace('.',',');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* Rechner ohne eval: + - * / ( ) */
function ev(s){s=s.replace(/\s+/g,'');let i=0;
 const num=()=>{if(s[i]==='('){i++;const v=ex();if(s[i]!==')')throw 0;i++;return v}
  if(s[i]==='-'){i++;return -num()}if(s[i]==='+'){i++;return num()}
  const m=/^\d*\.?\d+(e[-+]?\d+)?|^\d+\./i.exec(s.slice(i));if(!m)throw 0;i+=m[0].length;return parseFloat(m[0])};
 const term=()=>{let v=num();while(s[i]==='*'||s[i]==='/'){const o=s[i++],w=num();v=o==='*'?v*w:v/w}return v};
 const ex=()=>{let v=term();while(s[i]==='+'||s[i]==='-'){const o=s[i++],w=term();v=o==='+'?v+w:v-w}return v};
 try{if(!s)return null;const v=ex();return i===s.length&&isFinite(v)?v:null}catch(e){return null}}

/* ---------- Zustand ---------- */
const DEF_LAYERS=()=>[{n:'0',c:'#c9ced6',v:true},{n:'Kontur',c:'#f4f6f8',v:true},{n:'Hilfslinien',c:'#6f9cff',v:true},{n:'Bemaßung',c:'#5ad1e8',v:true}];
const DEF_CUT=()=>({tool:6,depth:6});
let S={ents:[],layers:DEF_LAYERS(),cur:'Kontur',nid:1,def:DEF_CUT()};
let sel=new Set(),undoS=[],redoS=[];
const view={s:1,ox:0,oy:0};
const tg={osnap:true,ortho:false,grid:true,gsnap:false,cam:false};let gstep=10;
let mouse={sp:[0,0],in:false},cursorW=[0,0],curP=[0,0],snapHit=null,hoverE=null,drag=null,pan=null,spaceDown=false,spaceUsed=false;
let lastPt=null,mem={pg:6,off:10,rad:5,cha:5,cols:3,rows:1,dx:100,dy:100,dia:35,th:20,td:1,bb:'L',
 rowD:5,rowN:5,rowS:32,rowT:13,dwD:8,dwN:2,dwS:32,dwT:12,cupD:35,cupT:13,lkN:6,lkD:5,lkT:10};
const lyr=n=>S.layers.find(l=>l.n===n);
const byId=id=>S.ents.find(e=>e.id===id);
const vis=e=>{const l=lyr(e.ly);return!l||l.v};
const geomEnts=()=>S.ents.filter(e=>e.t!=='dim'&&vis(e));
const dimLayer=()=>lyr('Bemaßung')?'Bemaßung':S.cur;
function mk(t,p,ly){return Object.assign({id:S.nid++,t,ly:ly||S.cur},p)}
function tmp(t,p){return Object.assign({t,ly:S.cur},p)}
function realize(o,ly){o.id=S.nid++;o.ly=ly||o.ly||S.cur;return o}
function replace(e,list){const i=S.ents.indexOf(e);if(i>=0)S.ents.splice(i,1,...list)}
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- Geometrie je Objekt ---------- */
function slotPrims(e){const d=nrm(sub(e.b,e.a)),n=[-d[1],d[0]],r=e.r,th=ang(d);
 return[{a:add(e.a,mul(n,-r)),b:add(e.b,mul(n,-r))},{c:e.b,r,a0:th-Math.PI/2,a1:th+Math.PI/2},{a:add(e.b,mul(n,r)),b:add(e.a,mul(n,r))},{c:e.a,r,a0:th+Math.PI/2,a1:th+Math.PI*1.5}]}
/* Polylinien-Bögen: Wölbung (bulge) je Segment = tan(Winkel/4), positiv = gegen den Uhrzeigersinn */
function bulgeArc(a,b,bu){const th=4*Math.atan(bu),c=dist(a,b),u=nrm(sub(b,a)),n=[-u[1],u[0]],C=add(mid(a,b),mul(n,c/2/Math.tan(th/2))),r=Math.abs(c/2/Math.sin(th/2));
 return th>0?{c:C,r,a0:ang(sub(a,C)),a1:ang(sub(b,C))}:{c:C,r,a0:ang(sub(b,C)),a1:ang(sub(a,C))}}
const hasB=bu=>bu&&Math.abs(bu)>1e-9;
const segPrim=(a,b,bu)=>hasB(bu)?bulgeArc(a,b,bu):{a,b};
const primLen=q=>q.a?dist(q.a,q.b):q.r*(isFull(q)?TAU:na(q.a1-q.a0));
const plineHasArcs=e=>!!(e.bl&&e.bl.some(hasB));
/* Text in Einstrich-Schrift */
const FONT=window.CAD_FONT||{cap:662,g:{}};
function glyph(ch){return FONT.g[ch]||FONT.g['?']||[378,[]]}
function textWidth(e){const sc=e.h/FONT.cap;let w=0;for(const ch of e.s)w+=glyph(ch)[0]*sc;return w}
function textStrokes(e){const sc=e.h/FONT.cap,o=[],co=Math.cos(e.a||0),si=Math.sin(e.a||0);let x=0;
 for(const ch of e.s){const[adv,st]=glyph(ch);for(const k of st){const pl=[];for(let i=0;i<k.length;i+=2){const lx=x+k[i]*sc,ly=k[i+1]*sc;pl.push([e.p[0]+lx*co-ly*si,e.p[1]+lx*si+ly*co])}if(pl.length>1)o.push(pl)}x+=adv*sc}
 return o}
function dimGeom(e){const a=e.a,b=e.b,p=e.p;let d1,d2,val;
 if(e.m==='h'){d1=[a[0],p[1]];d2=[b[0],p[1]];val=Math.abs(b[0]-a[0])}
 else if(e.m==='v'){d1=[p[0],a[1]];d2=[p[0],b[1]];val=Math.abs(b[1]-a[1])}
 else{const u=nrm(sub(b,a)),n=[-u[1],u[0]],o=dot(sub(p,a),n);d1=add(a,mul(n,o));d2=add(b,mul(n,o));val=dist(a,b)}
 return{lines:[[a,d1],[b,d2],[d1,d2]],d1,d2,val,m:mid(d1,d2),th:ang(sub(d2,d1))}}
function prims(e){switch(e.t){
 case'line':return[{a:e.a,b:e.b}];
 case'pline':{const o=[],p=e.pts,bl=e.bl||[];for(let i=0;i<p.length-1;i++)o.push(segPrim(p[i],p[i+1],bl[i]));if(e.closed&&p.length>2)o.push(segPrim(p[p.length-1],p[0],bl[p.length-1]));return o}
 case'text':{const o=[];for(const pl of textStrokes(e))for(let i=0;i<pl.length-1;i++)o.push({a:pl[i],b:pl[i+1]});return o}
 case'circle':return[{c:e.c,r:e.r}];
 case'arc':return[{c:e.c,r:e.r,a0:e.a0,a1:e.a1}];
 case'slot':return slotPrims(e);
 case'dim':return dimGeom(e).lines.map(([a,b])=>({a,b}));}
 return[]}
const isFull=q=>q.a0===undefined;
function sample(q){if(q.a)return[q.a,q.b];const a0=isFull(q)?0:q.a0,sp=isFull(q)?TAU:na(q.a1-q.a0)||TAU,n=Math.max(8,Math.ceil(sp/TAU*64)),o=[];for(let i=0;i<=n;i++)o.push(pol(q.c,q.r,a0+sp*i/n));return o}
function dPrim(p,q){if(q.a)return dSeg(p,q.a,q.b);const d=dist(p,q.c);if(isFull(q)||inArc(ang(sub(p,q.c)),q.a0,q.a1))return Math.abs(d-q.r);return Math.min(dist(p,pol(q.c,q.r,q.a0)),dist(p,pol(q.c,q.r,q.a1)))}
function dEnt(p,e){let m=Infinity;for(const q of prims(e))m=Math.min(m,dPrim(p,q));return m}
function snapPts(e){const o=[];if(e.t==='text')return[{p:e.p,k:'end'}];const many=e.t==='pline'&&e.pts.length>40;for(const q of prims(e)){
 if(q.a){o.push({p:q.a,k:'end'},{p:q.b,k:'end'});if(!many||dist(q.a,q.b)>3)o.push({p:mid(q.a,q.b),k:'mid'})}
 else{o.push({p:q.c,k:'cen'});for(let i=0;i<4;i++){const t=i*Math.PI/2;if(isFull(q)||inArc(t,q.a0,q.a1))o.push({p:pol(q.c,q.r,t),k:'quad'})}
  if(!isFull(q)){o.push({p:pol(q.c,q.r,q.a0),k:'end'},{p:pol(q.c,q.r,q.a1),k:'end'},{p:pol(q.c,q.r,q.a0+na(q.a1-q.a0)/2),k:'mid'})}}}
 return o}
/* Schnittpunkte */
const onC=(q,pt)=>isFull(q)||inArc(ang(sub(pt,q.c)),q.a0,q.a1);
function iSS(p,q){const r=sub(p.b,p.a),s=sub(q.b,q.a),den=crs(r,s);if(Math.abs(den)<1e-12)return[];const w=sub(q.a,p.a),t=crs(w,s)/den,u=crs(w,r)/den;return(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)?[add(p.a,mul(r,t))]:[]}
function iSC(p,q){const d=sub(p.b,p.a),f=sub(p.a,q.c),A=dot(d,d),B=2*dot(f,d),C=dot(f,f)-q.r*q.r;let D=B*B-4*A*C;if(D<0||A<1e-18)return[];D=Math.sqrt(D);const o=[];for(const t of D<1e-12?[-B/(2*A)]:[(-B-D)/(2*A),(-B+D)/(2*A)]){if(t>=-1e-9&&t<=1+1e-9){const pt=add(p.a,mul(d,t));if(onC(q,pt))o.push(pt)}}return o}
function iCC(p,q){const d=dist(p.c,q.c);if(d<1e-12||d>p.r+q.r+1e-9||d<Math.abs(p.r-q.r)-1e-9)return[];const a=(p.r*p.r-q.r*q.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,p.r*p.r-a*a)),u=nrm(sub(q.c,p.c)),m=add(p.c,mul(u,a)),n=[-u[1],u[0]];const pts=h<1e-9?[m]:[add(m,mul(n,h)),add(m,mul(n,-h))];return pts.filter(pt=>onC(p,pt)&&onC(q,pt))}
function iPP(p,q){if(p.a&&q.a)return iSS(p,q);if(p.a)return iSC(p,q);if(q.a)return iSC(q,p);return iCC(p,q)}
function iEE(e,f){const o=[];for(const p of prims(e))for(const q of prims(f))o.push(...iPP(p,q));return o}
function bbox(es){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const e of es)for(const q of prims(e))for(const p of sample(q)){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}return x0<=x1?[x0,y0,x1,y1]:null}

/* ---------- Konturen als Punktfolgen (für Fräsvorschau und Formen kombinieren) ---------- */
const TOL=0.01; /* größte Abweichung beim Annähern von Bögen, mm */
function arcPts(c,r,t0,sw){const st=2*Math.acos(clamp(1-TOL/Math.max(r,TOL),-1,1)),n=Math.max(2,Math.ceil(Math.abs(sw)/st)),o=[];for(let i=1;i<=n;i++)o.push(pol(c,r,t0+sw*i/n));return o}
function segPts(a,b,bu){if(!hasB(bu))return[b];const q=bulgeArc(a,b,bu),o=arcPts(q.c,q.r,ang(sub(a,q.c)),4*Math.atan(bu));o[o.length-1]=b;return o}
const isClosed=e=>e.t==='circle'||e.t==='slot'||(e.t==='pline'&&!!e.closed&&e.pts.length>2);
/* liefert [{pts,closed}] */
function toPaths(e){switch(e.t){
 case'line':return[{pts:[e.a,e.b],closed:false}];
 case'arc':{const sw=na(e.a1-e.a0)||TAU;return[{pts:[pol(e.c,e.r,e.a0),...arcPts(e.c,e.r,e.a0,sw)],closed:false}]}
 case'circle':{const o=arcPts(e.c,e.r,0,TAU);o.pop();return[{pts:[pol(e.c,e.r,0),...o],closed:true}]}
 case'slot':{const o=[];for(const q of slotPrims(e)){if(q.a){if(!o.length)o.push(q.a);o.push(q.b)}else o.push(...arcPts(q.c,q.r,q.a0,na(q.a1-q.a0)))}o.pop();return[{pts:o,closed:true}]}
 case'pline':{const p=e.pts,cl=isClosed(e),m=cl?p.length:p.length-1,o=[p[0]];for(let i=0;i<m;i++)o.push(...segPts(p[i],p[(i+1)%p.length],e.bl&&e.bl[i]));if(cl)o.pop();return[{pts:o,closed:cl}]}
 case'text':return textStrokes(e).map(pts=>({pts,closed:false}));}
 return[]}
const area=pts=>{let a=0;for(let i=0,n=pts.length;i<n;i++){const p=pts[i],q=pts[(i+1)%n];a+=p[0]*q[1]-q[0]*p[1]}return a/2};
const ccw=pts=>area(pts)<0?[...pts].reverse():pts;
function inPoly(p,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
const CL=window.ClipperLib,SC=1000;
const toCl=pts=>pts.map(p=>({X:Math.round(p[0]*SC),Y:Math.round(p[1]*SC)})),fromCl=P=>P.map(q=>[q.X/SC,q.Y/SC]);
function clOffset(paths,d,open){if(!paths.length)return[];const co=new CL.ClipperOffset(2,TOL*SC/2);co.AddPaths(paths.map(toCl),CL.JoinType.jtRound,open?CL.EndType.etOpenRound:CL.EndType.etClosedPolygon);const o=new CL.Paths();co.Execute(o,d*SC);return o.map(fromCl)}
function clBool(type,subj,clip){const c=new CL.Clipper();c.AddPaths(subj.map(toCl),CL.PolyType.ptSubject,true);if(clip&&clip.length)c.AddPaths(clip.map(toCl),CL.PolyType.ptClip,true);const o=new CL.Paths();
 c.Execute(CL.ClipType[type],o,CL.PolyFillType.pftNonZero,CL.PolyFillType.pftNonZero);return CL.Clipper.CleanPolygons(o,SC*0.002).filter(q=>q.length>2).map(fromCl)}
/* kleine Splitter (Rechenrauschen) entfernen */
const noSliver=ps=>clOffset(clOffset(ps,-0.03),0.03).filter(q=>Math.abs(area(q))>0.01);

/* ---------- Fräsen ---------- */
const CUTS={outside:'Außen',inside:'Innen',online:'Auf Linie',pocket:'Tasche',guide:'Hilfslinie'};
const CUTCOL={outside:'#f4f6f8',inside:'#f4f6f8',online:'#ffd166',pocket:'#a9b1bb',guide:'#6f9cff'};
const needsClosed=t=>t==='outside'||t==='inside'||t==='pocket';
let geoVer=0,CC={ver:-1};
function cache(){if(CC.ver===geoVer)return CC;CC={ver:geoVer,paths:new Map(),auto:new Map(),cam:new Map()};
 const closed=[];for(const e of S.ents){if(e.t==='dim')continue;const ps=toPaths(e);CC.paths.set(e.id,ps);if(isClosed(e)&&ps[0])closed.push([e,ps[0].pts,bbox([e])])}
 for(const[e,pts,b]of closed){let inside=false;for(const[f,q,fb]of closed){if(f===e||!vis(f)||f.ly==='Hilfslinien'||f.ct==='guide'||f.ct==='online')continue;
   if(b[0]>=fb[0]-1e-6&&b[1]>=fb[1]-1e-6&&b[2]<=fb[2]+1e-6&&b[3]<=fb[3]+1e-6&&(b[2]-b[0])*(b[3]-b[1])<(fb[2]-fb[0])*(fb[3]-fb[1])&&inPoly(pts[0],q)){inside=true;break}}
  CC.auto.set(e.id,inside?'inside':'outside')}
 return CC}
const pathsOf=e=>cache().paths.get(e.id)||toPaths(e);
function autoCut(e){if(e.t==='text')return'online';if(e.ly==='Hilfslinien')return'guide';if(!isClosed(e))return'online';return cache().auto.get(e.id)||'outside'}
function cutOf(e){const t=e.ct||autoCut(e);return{t,eff:needsClosed(t)&&!isClosed(e)?'online':t,d:e.cd!=null?e.cd:S.def.depth,tool:e.tool!=null?e.tool:S.def.tool,auto:!e.ct}}
/* Fräserbahn und stehenbleibendes Material */
function camOf(e){const C=cache();if(C.cam.has(e.id))return C.cam.get(e.id);const c=cutOf(e),r=c.tool/2,ps=pathsOf(e);let res={center:[],band:[],left:[],fail:false};
 try{if(c.eff==='guide'||r<=0){}
  else if(c.eff==='online'){res.center=ps.map(p=>p.closed?[...p.pts,p.pts[0]]:p.pts);res.band=ps.flatMap(p=>p.closed?clBool('ctDifference',clOffset([ccw(p.pts)],r),clOffset([ccw(p.pts)],-r)):clOffset([p.pts],r,true))}
  else{const P=[ccw(ps[0].pts)];
   if(c.eff==='outside'){res.center=clOffset(P,r);const close=clOffset(res.center,-r);res.left=noSliver(clBool('ctDifference',close,P))}
   else{res.center=clOffset(P,-r);if(!res.center.length){res.fail=true;res.left=P}else{const open=clOffset(res.center,r);res.left=noSliver(clBool('ctDifference',P,open))}}
   res.center=res.center.map(q=>[...q,q[0]])}}catch(err){console.error(err)}
 C.cam.set(e.id,res);return res}

/* Transformation: k = 'mv' | 'rot' | 'mir' */
function xf(e,f,k='mv'){const n=clone(e);
 switch(e.t){case'line':case'slot':n.a=f(e.a);n.b=f(e.b);break;
 case'pline':n.pts=e.pts.map(f);if(k==='mir'&&n.bl)n.bl=n.bl.map(v=>-v);if(k!=='mv'&&n.rect){const xs=n.pts.map(p=>p[0]),ys=n.pts.map(p=>p[1]);const ax=new Set(xs.map(v=>v.toFixed(6))).size,ay=new Set(ys.map(v=>v.toFixed(6))).size;if(ax!==2||ay!==2)delete n.rect}break;
 case'circle':n.c=f(e.c);break;
 case'arc':{let p0=f(pol(e.c,e.r,e.a0)),p1=f(pol(e.c,e.r,e.a1));n.c=f(e.c);if(k==='mir')[p0,p1]=[p1,p0];n.a0=ang(sub(p0,n.c));n.a1=ang(sub(p1,n.c));break}
 case'dim':n.a=f(e.a);n.b=f(e.b);n.p=f(e.p);if(k!=='mv')n.m='al';break
 case'text':{const d=pol([0,0],1,e.a||0),w=textWidth(e);if(k==='mir'){const m=f(add(e.p,mul(d,w/2)));n.p=sub(m,mul(d,w/2))}else{n.p=f(e.p);if(k==='rot')n.a=ang(sub(f(add(e.p,d)),n.p))}break}}
 return n}
const mvF=d=>p=>add(p,d),rotF=(c,t)=>p=>rotP(p,c,t);
const mirF=(a,b)=>p=>{const d=nrm(sub(b,a)),q=add(a,mul(d,dot(sub(p,a),d)));return sub(mul(q,2),p)};
function explode(e){if(e.t==='pline'||e.t==='slot')return prims(e).map(q=>q.a?mk('line',{a:q.a,b:q.b},e.ly):mk('arc',{c:q.c,r:q.r,a0:na(q.a0),a1:na(q.a1)},e.ly));return null}
const nearest=(es,p)=>es.reduce((b,e)=>(!b||dEnt(p,e)<dEnt(p,b))?e:b,null);
function rectE(a,b,real){const o={pts:[a,[b[0],a[1]],b,[a[0],b[1]]],closed:true,rect:true};return real?mk('pline',o):tmp('pline',o)}
function polyE(c,p,n,real){const r=dist(c,p),t0=ang(sub(p,c)),pts=[];for(let i=0;i<n;i++)pts.push(pol(c,r,t0+i*TAU/n));return real?mk('pline',{pts,closed:true}):tmp('pline',{pts,closed:true})}
function circ3(a,b,c){const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-9)return null;const A=dot(a,a),B=dot(b,b),C=dot(c,c);return[(A*(b[1]-c[1])+B*(c[1]-a[1])+C*(a[1]-b[1]))/d,(A*(c[0]-b[0])+B*(a[0]-c[0])+C*(b[0]-a[0]))/d]}
function arc3(a,m,b,real){const c=circ3(a,m,b);if(!c)return null;const r=dist(c,a);let s=ang(sub(a,c)),e=ang(sub(b,c));if(!inArc(ang(sub(m,c)),s,e))[s,e]=[e,s];const o={c,r,a0:s,a1:e};return real?mk('arc',o):tmp('arc',o)}
function dimAuto(a,b,p){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
 const gx=p[0]<x0?x0-p[0]:p[0]>x1?p[0]-x1:0,gy=p[1]<y0?y0-p[1]:p[1]>y1?p[1]-y1:0;
 let m;if(gx===0&&gy===0)m=(x1-x0)>=(y1-y0)?'h':'v';else m=gy>=gx?'h':'v';return tmp('dim',{a,b,p,m,ly:dimLayer()})}

/* Stutzen */
function trimEnt(e,p){const pts=[];for(const f of geomEnts())if(f!==e&&f.t!=='text')pts.push(...iEE(e,f));
 const pieces=(ts,span)=>{ts=[...new Set(ts.map(t=>+t.toFixed(9)))].filter(t=>t>1e-6&&t<span-1e-6).sort((a,b)=>a-b);if(!ts.length)return null;return ts};
 if(e.t==='line'){const d=sub(e.b,e.a),L2=dot(d,d),ts=pieces(pts.map(q=>dot(sub(q,e.a),d)/L2),1);if(!ts)return null;const tp=dot(sub(p,e.a),d)/L2;let lo=0,hi=1;for(const t of ts){if(t<tp)lo=t;else{hi=t;break}}
  const o=[];if(lo>1e-6)o.push(mk('line',{a:e.a,b:add(e.a,mul(d,lo))},e.ly));if(hi<1-1e-6)o.push(mk('line',{a:add(e.a,mul(d,hi)),b:e.b},e.ly));return o}
 if(e.t==='circle'){const as=pieces(pts.map(q=>na(ang(sub(q,e.c)))),TAU+1);if(!as||as.length<2)return null;const ap=na(ang(sub(p,e.c)));let lo=as[as.length-1],hi=as[0];for(const a of as){if(a<ap)lo=a;else{hi=a;break}}
  return[mk('arc',{c:e.c,r:e.r,a0:hi,a1:lo},e.ly)]}
 if(e.t==='arc'){const sp=na(e.a1-e.a0),ts=pieces(pts.map(q=>na(ang(sub(q,e.c))-e.a0)),sp);if(!ts)return null;const tp=na(ang(sub(p,e.c))-e.a0);let lo=0,hi=sp;for(const t of ts){if(t<tp)lo=t;else{hi=t;break}}
  const o=[];if(lo>1e-6)o.push(mk('arc',{c:e.c,r:e.r,a0:e.a0,a1:e.a0+lo},e.ly));if(hi<sp-1e-6)o.push(mk('arc',{c:e.c,r:e.r,a0:e.a0+hi,a1:e.a1},e.ly));return o}
 return null}

/* Abrunden / Fasen zweier Linien */
function fillet(L1,p1,L2,p2,r,cham){const I=lineInt(L1.a,L1.b,L2.a,L2.b);if(!I)return'Die Linien sind parallel.';
 const side=(L,p)=>{const d=nrm(sub(L.b,L.a));return dot(sub(p,I),d)>=0?d:mul(d,-1)};
 const u1=side(L1,p1),u2=side(L2,p2),far=(L,u)=>dot(sub(L.a,I),u)>dot(sub(L.b,I),u)?L.a:L.b,f1=far(L1,u1),f2=far(L2,u2);
 if(r<=0)return{l1:[I,f1],l2:[I,f2]};
 if(cham){const T1=add(I,mul(u1,r)),T2=add(I,mul(u2,r));if(r>dist(I,f1)||r>dist(I,f2))return'Fase zu groß.';return{l1:[T1,f1],l2:[T2,f2],x:tmp('line',{a:T1,b:T2})}}
 const th=Math.acos(clamp(dot(u1,u2),-1,1))/2;if(th<1e-6)return'Kein Eckwinkel gefunden.';const d=r/Math.tan(th);
 if(d>dist(I,f1)+1e-9||d>dist(I,f2)+1e-9)return'Radius zu groß für diese Linien.';
 const T1=add(I,mul(u1,d)),T2=add(I,mul(u2,d)),C=add(I,mul(nrm(add(u1,u2)),r/Math.sin(th)));
 let a0=ang(sub(T1,C)),a1=ang(sub(T2,C));if(na(a1-a0)>Math.PI)[a0,a1]=[a1,a0];
 return{l1:[T1,f1],l2:[T2,f2],x:tmp('arc',{c:C,r,a0,a1})}}

/* Versatz */
function offsetEnt(e,d,p){const n=clone(e);delete n.id;
 if(e.t==='line'){const v=sub(e.b,e.a),s=Math.sign(crs(v,sub(p,e.a)))||1,o=mul(nrm([-v[1],v[0]]),d*s);n.a=add(e.a,o);n.b=add(e.b,o);return n}
 if(e.t==='circle'||e.t==='arc'){const r=dist(p,e.c)>e.r?e.r+d:e.r-d;if(r<=1e-9)return null;n.r=r;return n}
 if(e.t==='slot'){const r=dSeg(p,e.a,e.b)>e.r?e.r+d:e.r-d;if(r<=1e-9)return null;n.r=r;return n}
 if(e.t==='pline'&&plineHasArcs(e)){if(!isClosed(e))return null;const P=ccw(toPaths(e)[0].pts),r=clOffset([P],inPoly(p,P)?-d:d);if(!r.length)return null;
  const best=r.reduce((a,b)=>Math.abs(area(b))>Math.abs(area(a))?b:a);delete n.bl;delete n.rect;n.pts=best;n.closed=true;return n}
 if(e.t==='pline'){const ps=prims(e);let bi=0,bd=Infinity;ps.forEach((q,i)=>{const dd=dSeg(p,q.a,q.b);if(dd<bd){bd=dd;bi=i}});
  const s=Math.sign(crs(sub(ps[bi].b,ps[bi].a),sub(p,ps[bi].a)))||1;
  const off=ps.map(q=>{const v=sub(q.b,q.a),o=mul(nrm([-v[1],v[0]]),d*s);return{a:add(q.a,o),b:add(q.b,o)}});
  const m=off.length,pts=[];
  if(e.closed){for(let i=0;i<m;i++){const A=off[(i-1+m)%m],B=off[i];pts.push(lineInt(A.a,A.b,B.a,B.b)||B.a)}}
  else{pts.push(off[0].a);for(let i=1;i<m;i++){const A=off[i-1],B=off[i];pts.push(lineInt(A.a,A.b,B.a,B.b)||B.a)}pts.push(off[m-1].b)}
  n.pts=pts;return n}
 return null}

/* ---------- Undo ---------- */
const snapS=()=>JSON.stringify(S);
function pushUndo(){undoS.push(snapS());if(undoS.length>200)undoS.shift();redoS=[]}
function dropUndo(){S=JSON.parse(undoS.pop())}
function doCommit(fn){pushUndo();fn();afterChange()}
function undo(){if(G)cancel(true);if(!undoS.length){log('Nichts rückgängig zu machen.');return}redoS.push(snapS());S=JSON.parse(undoS.pop());sel.clear();log('Rückgängig.');afterChange()}
function redo(){if(!redoS.length){log('Nichts zu wiederholen.');return}undoS.push(snapS());S=JSON.parse(redoS.pop());sel.clear();afterChange()}

/* ---------- Befehle ---------- */
const STR=prompt=>({k:'str',prompt}),P=(prompt,o={})=>({k:'pt',prompt,...o}),N=(prompt,def)=>({k:'num',prompt:prompt+(def!=null?` <${fmt(def)}>`:''),def}),PK=prompt=>({k:'pick',prompt}),OP=(prompt,opts,def)=>({k:'opt',prompt,opts,def});
function* needSel(){let es=[...sel].map(byId).filter(Boolean);if(!es.length)es=yield{k:'sel',prompt:'Objekte wählen (Klick oder Rahmen), dann Enter'};sel.clear();return es||[]}
const CMDS={
 L:{n:'Linie',g:'Z',i:'M4 20L20 4',*run(){const r0=yield P('Startpunkt');if(!r0.p)return;let p0=r0.p;const first=p0;let c=0;
  for(;;){const r=yield P(c>1?'Nächster Punkt  [S]chließen · Enter = fertig':'Nächster Punkt · Enter = fertig',{base:p0,opts:c>1?['S']:[],prev:p=>[tmp('line',{a:p0,b:p})]});
   if(!r.p&&r.opt!=='S')return;const q=r.opt==='S'?first:r.p;const a=p0;doCommit(()=>S.ents.push(mk('line',{a,b:q})));if(r.opt==='S')return;p0=q;c++}}},
 PL:{n:'Polylinie',g:'Z',i:'M3 18L9 8l6 6 6-10',*run(){const r0=yield P('Startpunkt');if(!r0.p)return;const pts=[r0.p];
  for(;;){const last=pts[pts.length-1];const r=yield P('Nächster Punkt  [S]chließen  [Z]urück · Enter = fertig',{base:last,opts:['S','Z'],prev:p=>[tmp('pline',{pts:[...pts,p],closed:false})]});
   if(r.opt==='Z'){if(pts.length>1)pts.pop();continue}
   if(!r.p){if(pts.length>1)doCommit(()=>S.ents.push(mk('pline',{pts,closed:r.opt==='S'&&pts.length>2})));return}
   pts.push(r.p)}}},
 R:{n:'Rechteck',g:'Z',i:'M4 6h16v12H4z',*run(){const r0=yield P('Erste Ecke');if(!r0.p)return;const a=r0.p;const r=yield P('Gegenecke oder @Breite,Höhe',{base:a,prev:p=>[rectE(a,p)]});if(!r.p||r.p[0]===a[0]||r.p[1]===a[1])return;doCommit(()=>S.ents.push(rectE(a,r.p,true)))}},
 K:{n:'Kreis',g:'Z',i:'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0',*run(){const r0=yield P('Mittelpunkt');if(!r0.p)return;const c=r0.p;
  const r=yield P('Radius (Zahl oder Punkt)  [D]urchmesser',{base:c,num:true,opts:['D'],prev:p=>[tmp('circle',{c,r:Math.max(dist(c,p),1e-6)})]});
  let rad=null;if(r.opt==='D'){const d=yield N('Durchmesser',mem.dia);if(d==null)return;mem.dia=d;rad=d/2}else if(r.n!=null)rad=r.n;else if(r.p)rad=dist(c,r.p);
  if(rad>0)doCommit(()=>S.ents.push(mk('circle',{c,r:rad})))}},
 B:{n:'Bogen (3 Punkte)',g:'Z',i:'M4 18A9 9 0 0 1 20 18',*run(){const a=(yield P('Startpunkt')).p;if(!a)return;const m=(yield P('Punkt auf dem Bogen',{base:a,prev:p=>[tmp('line',{a,b:p})]})).p;if(!m)return;
  const r=yield P('Endpunkt',{base:m,prev:p=>{const e=arc3(a,m,p);return e?[e]:[]}});if(!r.p)return;const e=arc3(a,m,r.p,true);if(e)doCommit(()=>S.ents.push(e))}},
 PG:{n:'Polygon',g:'Z',i:'M12 3l8 5v8l-8 5-8-5V8z',*run(){const n=yield N('Anzahl Ecken',mem.pg);if(!n||n<3)return;const k=mem.pg=Math.round(n);const c=(yield P('Mittelpunkt')).p;if(!c)return;
  const r=yield P('Eckpunkt oder Radius (Zahl)',{base:c,num:true,prev:p=>[polyE(c,p,k)]});const p=r.n!=null?add(c,[r.n,0]):r.p;if(!p||dist(p,c)<1e-9)return;doCommit(()=>S.ents.push(polyE(c,p,k,true)))}},
 LL:{n:'Langloch',g:'Z',i:'M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z',*run(){const a=(yield P('Erster Mittelpunkt')).p;if(!a)return;const b=(yield P('Zweiter Mittelpunkt',{base:a,prev:p=>[tmp('line',{a,b:p})]})).p;if(!b||dist(a,b)<1e-9)return;
  const r=yield P('Breite (Zahl) oder Punkt auf dem Rand',{base:b,num:true,prev:p=>[tmp('slot',{a,b,r:Math.max(dSeg(p,a,b),.01)})]});const rad=r.n!=null?r.n/2:(r.p?dSeg(r.p,a,b):0);if(rad>0)doCommit(()=>S.ents.push(mk('slot',{a,b,r:rad})))}},
 BB:{n:'Bohrbild',g:'Z',i:'M3 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M3 18h18',*run(){
  const k=yield OP(`Art: [L]ochreihe 32 · [T]opfband 35 · [D]übelbild · [K] Lochkreis <${mem.bb}>`,['L','T','D','K'],mem.bb);if(!k)return;mem.bb=k;
  const hole=(c,d,t)=>mk('circle',{c,r:d/2,ct:'pocket',cd:t,...holeTool(d)});
  if(k==='K'){const n=yield N('Anzahl Löcher',mem.lkN);if(!n||n<2)return;mem.lkN=Math.round(n);const d=yield N('Loch-Ø',mem.lkD);if(!d||d<=0)return;mem.lkD=d;const t=yield N('Tiefe',mem.lkT);if(t==null||t<=0)return;mem.lkT=t;
   const c=(yield P('Mittelpunkt des Lochkreises')).p;if(!c)return;
   const pts=(p,R)=>{const r0=R!=null?R:dist(c,p),t0=R!=null?Math.PI/2:ang(sub(p,c)),o=[];for(let i=0;i<mem.lkN;i++)o.push(pol(c,r0,t0+i*TAU/mem.lkN));return o};
   const r=yield P('Lochkreis-Radius (Zahl) oder Punkt fürs erste Loch',{base:c,num:true,prev:p=>pts(p).map(q=>tmp('circle',{c:q,r:d/2}))});const L=r.n!=null?pts(null,r.n):r.p?pts(r.p):null;if(!L||dist(L[0],c)<1e-9)return;
   doCommit(()=>L.forEach(q=>S.ents.push(hole(q,d,t))));log(`${L.length} Löcher Ø${fmtDE(d)} auf Lochkreis Ø${fmtDE(dist(L[0],c)*2)}.`,'ok');return}
  if(k==='T'){const d=yield N('Topf-Ø',mem.cupD);if(!d||d<=0)return;mem.cupD=d;const t=yield N('Bohrtiefe',mem.cupT);if(t==null||t<=0)return;mem.cupT=t;
   const ref=(yield P('Bezugspunkt anklicken (z. B. Ecke der Tür) · Enter = ohne')).p;
   if(ref)log('Tipp: Topfmitte relativ eingeben, z. B. @21.5,100 (21,5 mm von der Kante, 100 mm hoch).');
   for(;;){const r=yield P('Topfmitte · Enter = fertig',{base:ref||undefined,prev:p=>[tmp('circle',{c:p,r:d/2})]});if(!r.p)return;const q=r.p;doCommit(()=>S.ents.push(hole(q,d,t)))}}
  const D=k==='L'?{d:'rowD',n:'rowN',s:'rowS',t:'rowT',name:'Lochreihe'}:{d:'dwD',n:'dwN',s:'dwS',t:'dwT',name:'Dübelbild'};
  const d=yield N('Loch-Ø',mem[D.d]);if(!d||d<=0)return;mem[D.d]=d;const n=yield N('Anzahl Löcher',mem[D.n]);if(!n||n<1)return;mem[D.n]=Math.round(n);
  let sp=0;if(mem[D.n]>1){sp=yield N('Lochabstand',mem[D.s]);if(!sp||sp<=0)return;mem[D.s]=sp}const t=yield N('Tiefe',mem[D.t]);if(t==null||t<=0)return;mem[D.t]=t;
  const ref=(yield P('Bezugspunkt anklicken (z. B. Ecke) · Enter = ohne')).p;
  const a=(yield P('Erstes Loch'+(ref?' (z. B. @37,9.5 vom Bezugspunkt)':''),{base:ref||undefined,prev:p=>[tmp('circle',{c:p,r:d/2})]})).p;if(!a)return;
  const row=dir=>{const u=nrm(dir),o=[];for(let i=0;i<mem[D.n];i++)o.push(add(a,mul(u,i*sp)));return o};
  let L;if(mem[D.n]>1){const r=yield P('Richtung: Punkt anklicken oder Winkel (0 = rechts, 90 = oben)',{base:a,num:true,prev:p=>dist(p,a)<1e-9?[]:row(sub(p,a)).map(q=>tmp('circle',{c:q,r:d/2}))});
   if(r.n!=null)L=row(pol([0,0],1,r.n*D2R));else if(r.p&&dist(r.p,a)>1e-9)L=row(sub(r.p,a));else return}else L=[a];
  doCommit(()=>L.forEach(q=>S.ents.push(hole(q,d,t))));log(`${D.name}: ${L.length} × Ø${fmtDE(d)}${L.length>1?', Abstand '+fmtDE(sp):''}, Tiefe ${fmtDE(t)}.`,'ok')}},
 TX:{n:'Text / Gravur',g:'Z',i:'M5 7V4h14v3M12 4v16M9 20h6',*run(){const s=yield STR('Text eingeben');if(!s)return;const h=yield N('Schrifthöhe (Großbuchstaben)',mem.th);if(!h||h<=0)return;mem.th=h;
  const r=yield P('Einfügepunkt (unten links)',{prev:p=>[tmp('text',{p,s,h,a:0})]});if(!r.p)return;const q=r.p;
  doCommit(()=>S.ents.push(mk('text',{p:q,s,h,a:0,ct:'online',cd:mem.td})));log('Text als Gravur (auf Linie, '+fmtDE(mem.td)+' mm tief). Ändern rechts unter „Fräsen“.')}},
 V:{n:'Verschieben',g:'A',i:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',*run(){const es=yield* needSel();if(!es.length)return;const b=(yield P('Basispunkt')).p;if(!b)return;
  const r=yield P('Zielpunkt',{base:b,prev:p=>es.map(e=>xf(e,mvF(sub(p,b))))});if(!r.p)return;const d=sub(r.p,b);doCommit(()=>es.forEach(e=>Object.assign(e,xf(e,mvF(d)))))}},
 KO:{n:'Kopieren',g:'A',i:'M4 4h11v11H4zM9 9h11v11H9z',*run(){const es=yield* needSel();if(!es.length)return;const b=(yield P('Basispunkt')).p;if(!b)return;
  for(;;){const r=yield P('Zielpunkt · Enter = fertig',{base:b,prev:p=>es.map(e=>xf(e,mvF(sub(p,b))))});if(!r.p)return;const d=sub(r.p,b);doCommit(()=>es.forEach(e=>S.ents.push(realize(xf(e,mvF(d)),e.ly))))}}},
 D:{n:'Drehen',g:'A',i:'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',*run(){const es=yield* needSel();if(!es.length)return;const b=(yield P('Drehpunkt')).p;if(!b)return;
  const r=yield P('Winkel in Grad (Zahl) oder Punkt',{base:b,num:true,prev:p=>es.map(e=>xf(e,rotF(b,ang(sub(p,b))),'rot'))});const t=r.n!=null?r.n*D2R:(r.p?ang(sub(r.p,b)):null);if(t==null)return;
  doCommit(()=>es.forEach(e=>Object.assign(e,xf(e,rotF(b,t),'rot'))))}},
 SP:{n:'Spiegeln',g:'A',i:'M12 3v18M9 7L4 17h5zM15 7l5 10h-5z',*run(){const es=yield* needSel();if(!es.length)return;const a=(yield P('Erster Punkt der Spiegelachse')).p;if(!a)return;
  const r=yield P('Zweiter Punkt der Spiegelachse',{base:a,prev:p=>dist(p,a)<1e-9?[]:[tmp('line',{a,b:p}),...es.map(e=>xf(e,mirF(a,p),'mir'))]});if(!r.p||dist(r.p,a)<1e-9)return;const b=r.p;
  const o=yield OP('Original löschen?  [J]a / [N]ein <N>',['J','N'],'N');if(!o)return;
  doCommit(()=>es.forEach(e=>{if(o==='J')Object.assign(e,xf(e,mirF(a,b),'mir'));else S.ents.push(realize(xf(e,mirF(a,b),'mir'),e.ly))}))}},
 VS:{n:'Versatz (Parallele)',g:'A',i:'M4 17L17 4M8 20L20 8',*run(){const d=yield N('Abstand',mem.off);if(!d||d<=0)return;mem.off=d;
  for(;;){const r=yield PK('Objekt wählen · Enter = fertig');if(!r.e)return;const e=r.e;if(e.t==='dim'){log('Bemaßung geht nicht.','e');continue}
   const s=yield P('Seite anklicken',{prev:p=>{const o=offsetEnt(e,d,p);return o?[o]:[]}});if(!s.p)return;const o=offsetEnt(e,d,s.p);if(o)doCommit(()=>S.ents.push(realize(o,e.ly)));else log('Versatz geht hier nicht (Radius zu klein).','e')}}},
 AR:{n:'Abrunden',g:'A',i:'M4 20v-8a8 8 0 0 1 8-8h8',*run(){const r=yield N('Radius',mem.rad);if(r==null||r<0)return;mem.rad=r;const a=yield PK('Erste Linie');if(!a.e)return;hlE=a.e;const b=yield PK('Zweite Linie');hlE=null;if(!b.e)return;doFillet(a,b,r,false)}},
 FA:{n:'Fasen',g:'A',i:'M4 20v-9l7-7h9',*run(){const r=yield N('Fasenlänge',mem.cha);if(r==null||r<0)return;mem.cha=r;const a=yield PK('Erste Linie');if(!a.e)return;hlE=a.e;const b=yield PK('Zweite Linie');hlE=null;if(!b.e)return;doFillet(a,b,r,true)}},
 ST:{n:'Stutzen',g:'A',i:'M3 12h7M14 12h7M12 3v4M12 17v4M8 8l8 8',*run(){for(;;){const r=yield PK('Teilstück zum Wegschneiden anklicken · Enter = fertig');if(!r.e)return;const e=r.e;if(e.t==='dim')continue;
  pushUndo();let t=e;const ex=explode(e);if(ex){replace(e,ex);t=nearest(ex,r.p)}const res=trimEnt(t,r.p);if(!res){dropUndo();log('Keine Schnittkante gefunden.','e');render();continue}replace(t,res);afterChange()}}},
 RK:{n:'Reihe kopieren',g:'A',i:'M3 9h5v6H3zM10 9h5v6h-5zM17 9h4v6h-4z',*run(){const es=yield* needSel();if(!es.length)return;const c=yield N('Anzahl Spalten (X)',mem.cols);if(!c||c<1)return;const rw=yield N('Anzahl Zeilen (Y)',mem.rows);if(!rw||rw<1)return;
  mem.cols=Math.round(c);mem.rows=Math.round(rw);let dx=0,dy=0;if(mem.cols>1){dx=yield N('Abstand Spalten (X)',mem.dx);if(dx==null)return;mem.dx=dx}if(mem.rows>1){dy=yield N('Abstand Zeilen (Y)',mem.dy);if(dy==null)return;mem.dy=dy}
  doCommit(()=>{for(let i=0;i<mem.cols;i++)for(let j=0;j<mem.rows;j++){if(!i&&!j)continue;es.forEach(e=>S.ents.push(realize(xf(e,mvF([i*dx,j*dy])),e.ly)))}})}},
 ZL:{n:'Zerlegen',g:'A',i:'M4 4h6v6H4zM14 14h6v6h-6zM14 4l6 6M4 14l6 6',*run(){const es=yield* needSel();let k=0;doCommit(()=>es.forEach(e=>{const x=explode(e);if(x){replace(e,x);k++}}));log(k+' Objekt(e) zerlegt.')}},
 E:{n:'Löschen',g:'A',i:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',*run(){const es=yield* needSel();if(!es.length)return;doCommit(()=>{S.ents=S.ents.filter(e=>!es.includes(e))});log(es.length+' gelöscht.')}},
 BM:{n:'Bemaßung',g:'M',i:'M4 8v10M20 8v10M4 13h16M7 10l-3 3 3 3M17 10l3 3-3 3',*run(){const a=(yield P('Erster Punkt')).p;if(!a)return;const b=(yield P('Zweiter Punkt',{base:a,prev:p=>[tmp('line',{a,b:p})]})).p;if(!b)return;
  const r=yield P('Lage der Maßlinie',{prev:p=>[dimAuto(a,b,p)]});if(!r.p)return;doCommit(()=>S.ents.push(realize(dimAuto(a,b,r.p),dimLayer())))}},
 BA:{n:'Bemaßung ausgerichtet',g:'M',i:'M6 18L18 6M3 15l6 6M15 3l6 6',*run(){const a=(yield P('Erster Punkt')).p;if(!a)return;const b=(yield P('Zweiter Punkt',{base:a,prev:p=>[tmp('line',{a,b:p})]})).p;if(!b||dist(a,b)<1e-9)return;
  const r=yield P('Lage der Maßlinie',{prev:p=>[tmp('dim',{a,b,p,m:'al',ly:dimLayer()})]});if(!r.p)return;doCommit(()=>S.ents.push(mk('dim',{a,b,p:r.p,m:'al'},dimLayer())))}},
 MS:{n:'Abstand messen',g:'M',i:'M3 8h18v8H3zM7 8v3M11 8v4M15 8v3',*run(){const a=(yield P('Erster Punkt')).p;if(!a)return;const r=yield P('Zweiter Punkt',{base:a,prev:p=>[tmp('line',{a,b:p})]});if(!r.p)return;const d=sub(r.p,a);
  log(`Abstand ${fmtDE(len(d))} mm · ΔX ${fmtDE(d[0])} · ΔY ${fmtDE(d[1])} · Winkel ${fmtDE(deg(ang(d)))}°`,'ok')}},
 VB:{n:'Verbinden (zur Kontur)',g:'F',i:'M10 14a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6-6l1-1',*run(){const es=yield* needSel();if(!es.length)return;
  const r=joinEnts(es);if(!r.made.length){log('Nichts zu verbinden – die Enden treffen sich nicht (Abstand > 0,05 mm).','e');return}
  doCommit(()=>{S.ents=S.ents.filter(e=>!r.used.has(e));S.ents.push(...r.made)});r.made.forEach(e=>sel.add(e.id));updProps();
  const c=r.made.filter(e=>e.closed).length;log(`${r.made.length} Kontur(en) aus ${r.used.size} Teilen${c?`, davon ${c} geschlossen`:''}.`+(r.made.length>c?' Offen bleibt, wo Enden nicht aufeinandertreffen.':''),'ok')}},
 VE:{n:'Vereinigen',g:'F',i:'M4 4h10v6h6v10H10v-6H4z',*run(){yield* boolRun('ctUnion')}},
 AB:{n:'Abziehen',g:'F',i:'M4 4h16v8h-8v8H4zM15 15h5v5h-5z',*run(){yield* boolRun('ctDifference')}},
 SM:{n:'Schnittmenge',g:'F',i:'M9 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14M15 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14',*run(){yield* boolRun('ctIntersection')}},
 ZA:{n:'Zoom alles',now:()=>zoomAll()},
};
const ALIAS={VERBINDEN:'VB',VEREINIGEN:'VE',ABZIEHEN:'AB',SCHNITTMENGE:'SM',BOHRBILD:'BB',BOHREN:'BB',TEXT:'TX',GRAVUR:'TX',JOIN:'VB',UNION:'VE',SUBTRACT:'AB',
 LINIE:'L',POLYLINIE:'PL',RECHTECK:'R',KREIS:'K',BOGEN:'B',POLYGON:'PG',LANGLOCH:'LL',VERSCHIEBEN:'V',KOPIEREN:'KO',DREHEN:'D',SPIEGELN:'SP',VERSATZ:'VS',ABRUNDEN:'AR',FASEN:'FA',STUTZEN:'ST',REIHE:'RK',ZERLEGEN:'ZL',LÖSCHEN:'E',ENTF:'E',BEMASSUNG:'BM',BEMAßUNG:'BM',MESSEN:'MS',ZOOM:'ZA',
 C:'K',A:'B',M:'V',CO:'KO',RO:'D',MI:'SP',O:'VS',F:'AR',CHA:'FA',TR:'ST',X:'ZL',DI:'MS'};
const alias=t=>{const u=t.toUpperCase();return CMDS[u]?u:ALIAS[u]||null};
let hlE=null;
const holeTool=d=>S.def.tool<d-1e-9?{}:{tool:Math.min(3,+(d*0.6).toFixed(1))};
/* lose Linien/Bögen/offene Polylinien zu Polylinien verketten */
function joinEnts(es,tol=0.05){const pc=[];
 for(const e of es){if(e.t==='line')pc.push({e,pts:[e.a,e.b],bl:[0]});
  else if(e.t==='arc'){const sw=na(e.a1-e.a0)||TAU;if(sw>=TAU-1e-9)continue;pc.push({e,pts:[pol(e.c,e.r,e.a0),pol(e.c,e.r,e.a1)],bl:[Math.tan(sw/4)]})}
  else if(e.t==='pline'&&!isClosed(e)){const n=e.pts.length-1;pc.push({e,pts:e.pts.map(p=>[...p]),bl:Array.from({length:n},(_,i)=>(e.bl&&e.bl[i])||0)})}}
 const rev=c=>({e:c.e,pts:[...c.pts].reverse(),bl:[...c.bl].reverse().map(v=>-v)});
 const used=new Set(),made=[],left=[...pc];
 while(left.length){let ch=left.shift(),parts=[ch.e],grew=true;ch={pts:[...ch.pts],bl:[...ch.bl]};
  while(grew){grew=false;const s0=ch.pts[0],s1=ch.pts[ch.pts.length-1];if(ch.pts.length>2&&dist(s0,s1)<tol)break;
   for(let i=0;i<left.length;i++){const c=left[i],c0=c.pts[0],c1=c.pts[c.pts.length-1];let add=null,front=false;
    if(dist(s1,c0)<tol)add=c;else if(dist(s1,c1)<tol)add=rev(c);else if(dist(s0,c1)<tol){add=c;front=true}else if(dist(s0,c0)<tol){add=rev(c);front=true}
    if(!add)continue;left.splice(i,1);parts.push(c.e);
    if(front){ch.pts=[...add.pts.slice(0,-1),...ch.pts];ch.bl=[...add.bl,...ch.bl]}else{ch.pts=[...ch.pts,...add.pts.slice(1)];ch.bl=[...ch.bl,...add.bl]}grew=true;break}}
  let closed=false;if(ch.pts.length>2&&dist(ch.pts[0],ch.pts[ch.pts.length-1])<tol){ch.pts.pop();closed=true}
  if(parts.length<2&&!closed)continue;
  const o={pts:ch.pts,closed};if(ch.bl.some(hasB))o.bl=ch.bl;const f=parts[0];const n=mk('pline',o,f.ly);for(const k of['ct','cd','tool'])if(f[k]!=null)n[k]=f[k];
  made.push(n);parts.forEach(x=>used.add(x))}
 return{used,made}}
/* Formen kombinieren */
function* boolRun(type){const ok=e=>isClosed(e);const name={ctUnion:'Vereinigen',ctDifference:'Abziehen',ctIntersection:'Schnittmenge'}[type];
 let A=yield* needSel();const skipped=A.filter(e=>!ok(e)).length;A=A.filter(ok);if(skipped)log(skipped+' offene Objekt(e) übersprungen – erst Verbinden (VB).','e');
 let B=[];if(type==='ctDifference'){if(!A.length){log('Erst die Grundform wählen (geschlossene Kontur).','e');return}A.forEach(e=>hlSet.add(e.id));
  B=((yield{k:'sel',prompt:'Formen zum Abziehen wählen, dann Enter'})||[]).filter(e=>ok(e)&&!A.includes(e));hlSet.clear();sel.clear();if(!B.length){log('Nichts zum Abziehen gewählt.','e');return}}
 else if(A.length<2){log(name+' braucht mindestens 2 geschlossene Konturen.','e');return}
 const poly=e=>ccw(toPaths(e)[0].pts);let res;
 if(type==='ctDifference')res=clBool(type,A.map(poly),B.map(poly));else if(type==='ctUnion')res=clBool(type,A.map(poly),[]);
 else{res=[poly(A[0])];for(const e of A.slice(1))res=clBool(type,res,[poly(e)])}
 res=res.filter(q=>Math.abs(area(q))>1e-4);
 const f=A[0],made=res.map(q=>{const n=mk('pline',{pts:area(q)<0?[...q].reverse():q,closed:true},f.ly);if(f.ct&&area(q)>0)n.ct=f.ct;for(const k of['cd','tool'])if(f[k]!=null)n[k]=f[k];return n});
 doCommit(()=>{S.ents=S.ents.filter(e=>!A.includes(e)&&!B.includes(e));S.ents.push(...made)});made.forEach(e=>sel.add(e.id));updProps();
 log(made.length?`${name}: ${made.length} Kontur(en) entstanden.`:`${name}: Ergebnis ist leer – die Formen überlappen nicht.`,made.length?'ok':'e')}
const hlSet=new Set();
function doFillet(A,B,r,ch){const ok=e=>e.t==='line'||e.t==='pline';if(!ok(A.e)||!ok(B.e)){log('Geht nur mit Linien, Polylinien und Rechtecken.','e');return}
 pushUndo();let L1=A.e,L2=B.e;
 if(L1.t==='pline'){const ls=explode(L1);replace(L1,ls);L1=nearest(ls,A.p);if(B.e===A.e)L2=nearest(ls.filter(l=>l!==L1),B.p)}
 if(L2.t==='pline'){const ls=explode(L2);replace(L2,ls);L2=nearest(ls,B.p)}
 if(L1===L2){dropUndo();log('Zwei verschiedene Linien wählen.','e');return}
 const res=fillet(L1,A.p,L2,B.p,r,ch);if(typeof res==='string'){dropUndo();log(res,'e');return}
 L1.a=res.l1[0];L1.b=res.l1[1];L2.a=res.l2[0];L2.b=res.l2[1];if(res.x)S.ents.push(realize(res.x,L1.ly));afterChange()}

/* ---------- Ablauf ---------- */
let G=null,REQ=null,lastCmd=null,curCmd=null;
function run(key){const c=CMDS[key];if(!c)return;if(c.now){c.now();return}cancel(true);lastCmd=curCmd=key;log('» '+c.n,'ok');G=c.run();adv(undefined)}
function adv(v){if(!G)return;let r;try{r=G.next(v)}catch(err){console.error(err);log('Fehler: '+err.message,'e');r={done:true}}
 if(r.done){G=null;REQ=null;curCmd=null;hlE=null;hlSet.clear()}else{REQ=r.value;if(['num','opt','str'].includes(REQ.k))inp.focus()}updPrompt();updTools();computeSnap();render()}
function cancel(silent){hlSet.clear();if(G){try{G.return()}catch(e){}G=null;REQ=null;curCmd=null;hlE=null;if(!silent)log('*Abbruch*')}else if(!silent){sel.clear();updProps()}updPrompt();updTools();render()}

/* ---------- UI-Elemente ---------- */
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d'),inp=$('inp'),hist=$('hist');
function log(t,c=''){const d=document.createElement('div');d.textContent=t;if(c)d.className=c;hist.appendChild(d);while(hist.children.length>80)hist.firstChild.remove();hist.scrollTop=hist.scrollHeight}
function updPrompt(){$('prompt').textContent=REQ?REQ.prompt+':':'Befehl:'}
const ICON=d=>`<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
function buildTools(){const grp={Z:'Zeichnen',A:'Ändern',M:'Maße',F:'Fräsen'};let h='',last='';const mZ=[],mA=[],mF=[];
 for(const[k,c]of Object.entries(CMDS)){if(!c.g)continue;if(c.g!==last){h+=`<div class="grp">${grp[c.g]}</div>`;last=c.g}
  h+=`<button class="tb" data-r="${k}" data-tip="${esc(c.n)}  (${k})" aria-label="${esc(c.n)}">${ICON(c.i)}</button>`;
  (c.g==='Z'?mZ:c.g==='F'?mF:mA).push(`<li><button data-r="${k}">${esc(c.n)}<kbd>${k}</kbd></button></li>`)}
 $('tools').innerHTML=h;$('mZ').innerHTML=mZ.join('');$('mA').innerHTML=mA.join('');$('mF').innerHTML=mF.join('')+'<hr><li><button data-a="cam">Fräsvorschau<kbd>F6</kbd></button></li>';
 $('helpT').innerHTML='<tr><th>Kürzel</th><th>Befehl</th><th>Kürzel</th><th>Befehl</th></tr>'+(()=>{const l=Object.entries(CMDS).map(([k,c])=>`<td><code>${k}</code></td><td>${esc(c.n)}</td>`);let o='';for(let i=0;i<l.length;i+=2)o+=`<tr>${l[i]}${l[i+1]||'<td></td><td></td>'}</tr>`;return o})()}
function updTools(){document.querySelectorAll('.tb').forEach(b=>b.classList.toggle('on',b.dataset.r===curCmd));for(const k in tg)$('t_'+k).classList.toggle('on',tg[k])}

/* Eigenschaften */
const TN={line:'Linie',pline:'Polylinie',rect:'Rechteck',circle:'Kreis',arc:'Bogen',slot:'Langloch',dim:'Bemaßung',text:'Text'};
const rectXYWH=e=>{const xs=e.pts.map(p=>p[0]),ys=e.pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]};
const setRect=(e,i,v)=>{const r=rectXYWH(e);r[i]=v;if(r[2]<=0||r[3]<=0)return;const[x,y,w,h]=r;e.pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]};
const PF={
 line:[['X1',e=>e.a[0],(e,v)=>e.a[0]=v],['Y1',e=>e.a[1],(e,v)=>e.a[1]=v],['X2',e=>e.b[0],(e,v)=>e.b[0]=v],['Y2',e=>e.b[1],(e,v)=>e.b[1]=v],
  ['Länge',e=>dist(e.a,e.b),(e,v)=>{if(v>0)e.b=add(e.a,mul(nrm(sub(e.b,e.a)),v))}],['Winkel °',e=>deg(ang(sub(e.b,e.a))),(e,v)=>{e.b=pol(e.a,dist(e.a,e.b),v*D2R)}]],
 circle:[['Mitte X',e=>e.c[0],(e,v)=>e.c[0]=v],['Mitte Y',e=>e.c[1],(e,v)=>e.c[1]=v],['Radius',e=>e.r,(e,v)=>{if(v>0)e.r=v}],['Ø',e=>e.r*2,(e,v)=>{if(v>0)e.r=v/2}]],
 arc:[['Mitte X',e=>e.c[0],(e,v)=>e.c[0]=v],['Mitte Y',e=>e.c[1],(e,v)=>e.c[1]=v],['Radius',e=>e.r,(e,v)=>{if(v>0)e.r=v}],['Start °',e=>deg(na(e.a0)),(e,v)=>e.a0=v*D2R],['Ende °',e=>deg(na(e.a1)),(e,v)=>e.a1=v*D2R]],
 rect:[['X',e=>rectXYWH(e)[0],(e,v)=>setRect(e,0,v)],['Y',e=>rectXYWH(e)[1],(e,v)=>setRect(e,1,v)],['Breite',e=>rectXYWH(e)[2],(e,v)=>setRect(e,2,v)],['Höhe',e=>rectXYWH(e)[3],(e,v)=>setRect(e,3,v)]],
 slot:[['X1',e=>e.a[0],(e,v)=>e.a[0]=v],['Y1',e=>e.a[1],(e,v)=>e.a[1]=v],['X2',e=>e.b[0],(e,v)=>e.b[0]=v],['Y2',e=>e.b[1],(e,v)=>e.b[1]=v],['Breite',e=>e.r*2,(e,v)=>{if(v>0)e.r=v/2}],['Gesamtlänge',e=>dist(e.a,e.b)+2*e.r,null]],
 pline:[['Punkte',e=>e.pts.length,null],['Länge',e=>prims(e).reduce((s,q)=>s+primLen(q),0),null]],
 text:[['Text',e=>e.s,(e,v)=>{if(v)e.s=v},'str'],['Höhe',e=>e.h,(e,v)=>{if(v>0)e.h=v}],['X',e=>e.p[0],(e,v)=>e.p[0]=v],['Y',e=>e.p[1],(e,v)=>e.p[1]=v],['Winkel °',e=>deg(e.a||0),(e,v)=>e.a=v*D2R],['Breite',e=>textWidth(e),null]],
 dim:[['Maß',e=>dimGeom(e).val,null]]};
const kind=e=>e.t==='pline'&&e.rect?'rect':e.t;
function updProps(){const es=[...sel].map(byId).filter(Boolean);$('selc').textContent=es.length?es.length+' gewählt':'';let h='';
 if(!es.length)h='<p class="muted">Nichts gewählt. Objekt anklicken oder Rahmen aufziehen.</p>';
 else{const lys=new Set(es.map(e=>e.ly));
  h+=`<div class="pr"><label>Typ</label><input readonly value="${es.length===1?TN[kind(es[0])]:'Verschiedene'}" style="text-align:left"></div>`;
  h+=`<div class="pr"><label for="p_ly">Ebene</label><select id="p_ly">${lys.size>1?'<option value="">– gemischt –</option>':''}${S.layers.map(l=>`<option ${lys.size===1&&lys.has(l.n)?'selected':''}>${esc(l.n)}</option>`).join('')}</select></div>`;
  if(es.length===1){const e=es[0];(PF[kind(e)]||[]).forEach((f,i)=>{const str=f[3]==='str';h+=`<div class="pr"><label for="pf${i}">${f[0]}</label><input id="pf${i}" data-i="${i}" ${!f[2]?'readonly':str?'type="text" style="text-align:left"':'type="text" inputmode="decimal"'} value="${str?esc(f[1](e)):fmt(f[1](e),3)}"></div>`});
   if(e.t==='pline'&&!e.rect)h+=`<div class="pr"><label for="p_cl">Geschlossen</label><input type="checkbox" id="p_cl" ${e.closed?'checked':''}></div>`}
  h+=camProps(es);
  h+=`<div class="row" style="justify-content:flex-start"><button class="btn" data-r="E">Löschen</button><button class="btn" data-r="KO">Kopieren</button><button class="btn" data-r="V">Verschieben</button></div>`}
 $('props').innerHTML=h;
 const ly=$('p_ly');if(ly)ly.onchange=()=>{if(ly.value)doCommit(()=>es.forEach(e=>e.ly=ly.value))};
 const cl=$('p_cl');if(cl)cl.onchange=()=>doCommit(()=>es[0].closed=cl.checked);
 bindCamProps(es);
 $('props').querySelectorAll('input[data-i]').forEach(el=>{const f=PF[kind(es[0])][+el.dataset.i];if(!f[2])return;
  el.addEventListener('change',()=>{if(f[3]==='str'){const v=el.value.trim();if(!v){el.value=f[1](es[0]);return}doCommit(()=>f[2](es[0],v));return}const v=ev(el.value.replace(',','.'));if(v==null){el.value=fmt(f[1](es[0]),3);return}doCommit(()=>f[2](es[0],v))});
  el.addEventListener('keydown',k=>{if(k.key==='Enter')el.blur()})})}
/* Fräs-Eigenschaften */
function camProps(es){es=es.filter(e=>e.t!=='dim');if(!es.length)return'';const cs=es.map(cutOf),same=k=>cs.every(c=>c[k]===cs[0][k]),allAuto=es.every(e=>!e.ct),anyClosed=es.some(isClosed);
 const tv=allAuto?'':same('t')?cs[0].t:'*';
 let h=`<h2 style="margin:14px 0 8px">Fräsen</h2><div class="pr"><label for="c_t">Frästyp</label><select id="c_t">${tv==='*'?'<option value="*" selected>– gemischt –</option>':''}<option value="" ${allAuto?'selected':''}>Automatisch${allAuto&&same('t')?' ('+CUTS[cs[0].t]+')':''}</option>${Object.entries(CUTS).map(([k,n])=>`<option value="${k}" ${tv===k?'selected':''} ${needsClosed(k)&&!anyClosed?'disabled':''}>${n}</option>`).join('')}</select></div>`;
 const num=(id,lab,k,dk)=>`<div class="pr"><label for="${id}">${lab}</label><input id="${id}" type="text" inputmode="decimal" value="${same(k)?fmt(cs[0][k],2):''}" placeholder="${same(k)?'':'gemischt'}" title="Leer lassen = Standard (${fmt(S.def[dk])} mm)"></div>`;
 h+=num('c_d','Tiefe mm','d','depth')+num('c_tool','Fräser Ø mm','tool','tool');
 const warn=[];if(es.some(e=>e.ct&&needsClosed(e.ct)&&!isClosed(e)))warn.push('Außen, Innen und Tasche gehen nur mit geschlossener Kontur – offene Teile erst mit „Verbinden“ (VB) schließen.');
 if(es.length<=40){let bad=0,fail=0;for(const e of es){const m=camOf(e);if(m.fail)fail++;else if(m.left.length)bad++}
  if(fail)warn.push(`Fräser zu dick: passt bei ${fail===1&&es.length===1?'dieser Kontur':fail+' Kontur(en)'} gar nicht hinein.`);
  if(bad)warn.push(`In ${bad===1&&es.length===1?'dieser Kontur':bad+' Kontur(en)'} bleibt in Ecken Material stehen (Fräser zu dick) – rot in der Fräsvorschau (F6).`)}
 if(warn.length)h+=`<div class="warn">${warn.map(esc).join('<br>')}</div>`;
 return h}
function bindCamProps(es){es=es.filter(e=>e.t!=='dim');const t=$('c_t');if(!t)return;
 t.onchange=()=>{if(t.value==='*')return;doCommit(()=>es.forEach(e=>{if(!t.value)delete e.ct;else if(!needsClosed(t.value)||isClosed(e))e.ct=t.value}))};
 for(const[id,k]of[['c_d','cd'],['c_tool','tool']]){const el=$(id);el.addEventListener('keydown',x=>{if(x.key==='Enter')el.blur()});
  el.addEventListener('change',()=>{const raw=el.value.trim();if(!raw){doCommit(()=>es.forEach(e=>delete e[k]));return}const v=ev(raw.replace(',','.'));if(v==null||v<=0){updProps();return}doCommit(()=>es.forEach(e=>e[k]=v))})}}
function updDefs(){$('d_tool').value=fmt(S.def.tool,2);$('d_depth').value=fmt(S.def.depth,2)}
for(const[id,k]of[['d_tool','tool'],['d_depth','depth']]){const el=$(id);el.addEventListener('keydown',x=>{if(x.key==='Enter')el.blur()});
 el.addEventListener('change',()=>{const v=ev(el.value.replace(',','.'));if(v==null||v<=0){updDefs();return}doCommit(()=>S.def[k]=v)})}
/* Ebenen */
const EYE='<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',EYEX='<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16"/></svg>';
const DEL='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function updLayers(){$('layers').innerHTML=S.layers.map((l,i)=>{const c=S.ents.filter(e=>e.ly===l.n).length;return`<div class="ly ${l.n===S.cur?'cur':''}"><input type="radio" name="curly" data-i="${i}" data-a="cur" ${l.n===S.cur?'checked':''} aria-label="Aktuelle Ebene ${esc(l.n)}">
 <input type="color" value="${l.c}" data-i="${i}" data-a="col" aria-label="Farbe"><span class="lyn" title="${esc(l.n)}">${esc(l.n)} <span class="cnt">${c}</span></span>
 <button data-i="${i}" data-a="vis" aria-label="Sichtbar">${l.v?EYE:EYEX}</button><button data-i="${i}" data-a="del" aria-label="Ebene löschen" ${c||l.n==='0'?'disabled style="opacity:.25"':''}>${DEL}</button></div>`}).join('');
 $('cnt').textContent=S.ents.length+' Objekte'}
$('layers').addEventListener('input',e=>{const t=e.target,l=S.layers[+t.dataset.i];if(!l)return;geoVer++;if(t.dataset.a==='col'){l.c=t.value;save();render()}if(t.dataset.a==='cur'){S.cur=l.n;save();updLayers()}});
$('layers').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const l=S.layers[+t.dataset.i];if(!l)return;geoVer++;
 if(t.dataset.a==='vis'){l.v=!l.v;[...sel].forEach(id=>{const x=byId(id);if(x&&x.ly===l.n)sel.delete(id)});save();updLayers();updProps();render()}
 if(t.dataset.a==='del'){S.layers.splice(+t.dataset.i,1);if(S.cur===l.n)S.cur='0';save();updLayers();updProps()}});
$('addly').addEventListener('submit',e=>{e.preventDefault();const n=$('lyname').value.trim();if(!n)return;if(lyr(n)){log('Ebene gibt es schon.','e');return}
 const cols=['#ff9f43','#ff6b9a','#b388ff','#7bd88f','#ffd166'];S.layers.push({n,c:cols[S.layers.length%cols.length],v:true});S.cur=n;$('lyname').value='';save();updLayers();updProps()});

/* ---------- Ansicht ---------- */
const w2s=p=>[p[0]*view.s+view.ox,-p[1]*view.s+view.oy],s2w=s=>[(s[0]-view.ox)/view.s,(view.oy-s[1])/view.s];
function zoomAll(){const W=cv.clientWidth,H=cv.clientHeight,b=bbox(S.ents.filter(vis));if(!b){view.s=1.2;view.ox=W*.2;view.oy=H*.8;render();return}
 const w=Math.max(b[2]-b[0],10),h=Math.max(b[3]-b[1],10);view.s=Math.min(W/(w*1.25),H/(h*1.25));view.ox=W/2-(b[0]+w/2)*view.s;view.oy=H/2+(b[1]+h/2)*view.s;render()}
function hit(p){const tol=7/view.s;let best=null,bd=tol;for(const e of S.ents){if(!vis(e))continue;const d=dEnt(p,e);if(d<bd){bd=d;best=e}}return best}
function orthoP(p){const b=REQ&&REQ.base;if(!tg.ortho||!b)return p;const d=sub(p,b);return Math.abs(d[0])>=Math.abs(d[1])?[p[0],b[1]]:[b[0],p[1]]}
function computeSnap(){cursorW=s2w(mouse.sp);snapHit=null;hoverE=null;
 if(!REQ||REQ.k!=='pt'){curP=cursorW;if(!drag&&!pan)hoverE=hit(cursorW);return}
 if(tg.osnap){const tol=11/view.s,raw=cursorW;let best=null,bd=tol;const near=[];
  for(const e of geomEnts()){for(const s of snapPts(e)){const d=dist(s.p,raw);if(d<bd){bd=d;best=s}}if(e.t!=='text'&&dEnt(raw,e)<tol*1.5)near.push(e)}
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++)for(const p of iEE(near[i],near[j])){const d=dist(p,raw);if(d<bd){bd=d;best={p,k:'int'}}}
  if(REQ.base){const d=dist(REQ.base,raw);if(d<bd)best={p:REQ.base,k:'end'}}
  snapHit=best}
 if(snapHit){curP=snapHit.p;return}
 let p=cursorW;if(tg.gsnap)p=[Math.round(p[0]/gstep)*gstep,Math.round(p[1]/gstep)*gstep];curP=orthoP(p)}

/* ---------- Zeichnen ---------- */
let W=0,H=0,dpr=1;
function resize(){dpr=window.devicePixelRatio||1;W=cv.clientWidth;H=cv.clientHeight;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);render()}
function strokePrims(ps){ctx.beginPath();for(const q of ps){if(q.a){ctx.moveTo(q.a[0],q.a[1]);ctx.lineTo(q.b[0],q.b[1])}else{const a0=isFull(q)?0:q.a0,sp=isFull(q)?TAU:(na(q.a1-q.a0)||TAU);const s=pol(q.c,q.r,a0);ctx.moveTo(s[0],s[1]);ctx.arc(q.c[0],q.c[1],q.r,a0,a0+sp,false)}}ctx.stroke()}
const px=v=>v/view.s;
function drawEnt(e,col,w=1.3,dash=null){ctx.strokeStyle=col;ctx.lineWidth=px(w);ctx.setLineDash(dash?dash.map(px):[]);
 if(e.t==='dim'){const g=dimGeom(e);strokePrims(g.lines.map(([a,b])=>({a,b})));const u=nrm(sub(g.d2,g.d1)),t=mul(rotP(u,[0,0],Math.PI/4),px(5));ctx.setLineDash([]);ctx.lineWidth=px(w+.6);
  ctx.beginPath();for(const d of[g.d1,g.d2]){ctx.moveTo(d[0]-t[0],d[1]-t[1]);ctx.lineTo(d[0]+t[0],d[1]+t[1])}ctx.stroke();dimTexts.push([e,col]);return}
 strokePrims(prims(e))}
let dimTexts=[];
function drawDimText(e,col){const g=dimGeom(e);let th=-g.th;if(th>Math.PI/2+1e-6)th-=Math.PI;if(th<-Math.PI/2-1e-6)th+=Math.PI;if(th>Math.PI/2+1e-6)th-=Math.PI;
 const s=w2s(g.m);ctx.save();ctx.translate(s[0],s[1]);ctx.rotate(th);ctx.font='500 12.5px "IBM Plex Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
 const t=fmtDE(g.val),w=ctx.measureText(t).width;ctx.fillStyle='#16191dcc';ctx.fillRect(-w/2-3,-17,w+6,15);ctx.fillStyle=col;ctx.fillText(t,0,-3);ctx.restore()}
function drawGrid(){if(!tg.grid)return;let g=gstep;let k=0;while(g*view.s<9&&k++<12)g*=(String(g/gstep).startsWith('1')||String(g/gstep).startsWith('5'))?2:2.5;const maj=g*5;
 const [x0,y1]=s2w([0,0]),[x1,y0]=s2w([W,H]);
 for(const[step,a]of[[g,.05],[maj,.11]]){ctx.strokeStyle=`rgba(200,215,230,${a})`;ctx.lineWidth=1;ctx.beginPath();
  for(let x=Math.ceil(x0/step)*step;x<=x1;x+=step){const s=Math.round(w2s([x,0])[0])+.5;ctx.moveTo(s,0);ctx.lineTo(s,H)}
  for(let y=Math.ceil(y0/step)*step;y<=y1;y+=step){const s=Math.round(w2s([0,y])[1])+.5;ctx.moveTo(0,s);ctx.lineTo(W,s)}ctx.stroke()}}
function drawSnap(h){const s=w2s(h.p),r=6;ctx.strokeStyle='#ffb020';ctx.lineWidth=2;ctx.setLineDash([]);ctx.beginPath();
 if(h.k==='end')ctx.rect(s[0]-r,s[1]-r,2*r,2*r);else if(h.k==='mid'){ctx.moveTo(s[0],s[1]-r-1);ctx.lineTo(s[0]+r+1,s[1]+r);ctx.lineTo(s[0]-r-1,s[1]+r);ctx.closePath()}
 else if(h.k==='cen')ctx.arc(s[0],s[1],r,0,TAU);else if(h.k==='quad'){ctx.moveTo(s[0],s[1]-r-1);ctx.lineTo(s[0]+r+1,s[1]);ctx.lineTo(s[0],s[1]+r+1);ctx.lineTo(s[0]-r-1,s[1]);ctx.closePath()}
 else{ctx.moveTo(s[0]-r,s[1]-r);ctx.lineTo(s[0]+r,s[1]+r);ctx.moveTo(s[0]+r,s[1]-r);ctx.lineTo(s[0]-r,s[1]+r)}ctx.stroke();
 const lab={end:'Endpunkt',mid:'Mitte',cen:'Zentrum',quad:'Quadrant',int:'Schnittpunkt'}[h.k];ctx.font='12px "IBM Plex Sans",sans-serif';ctx.fillStyle='#ffb020';ctx.fillText(lab,s[0]+12,s[1]+20)}
function fillPolys(ps,col){if(!ps.length)return;ctx.beginPath();for(const q of ps){ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<q.length;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath()}ctx.fillStyle=col;ctx.fill('nonzero')}
function strokePolys(ps,col,w,dash){if(!ps.length)return;ctx.strokeStyle=col;ctx.lineWidth=px(w);ctx.setLineDash(dash?dash.map(px):[]);ctx.beginPath();for(const q of ps){ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<q.length;i++)ctx.lineTo(q[i][0],q[i][1])}ctx.stroke();ctx.setLineDash([])}
function drawCam(){const es=S.ents.filter(e=>e.t!=='dim'&&vis(e)),by={};for(const e of es){const c=cutOf(e);(by[c.eff]=by[c.eff]||[]).push(e)}
 const P=e=>pathsOf(e).filter(p=>p.closed).map(p=>p.pts);
 fillPolys((by.outside||[]).flatMap(P),'rgba(236,240,245,.16)');
 fillPolys((by.inside||[]).flatMap(P),'#16191d');
 fillPolys((by.pocket||[]).flatMap(P),'rgba(150,158,168,.42)');
 for(const e of[...(by.online||[])])fillPolys(camOf(e).band,'rgba(255,209,102,.16)');
 for(const t of['outside','inside','pocket','online'])for(const e of by[t]||[]){const m=camOf(e);if(t!=='online')strokePolys(m.center,'rgba(255,210,122,.75)',1,[4,3]);fillPolys(m.left,'rgba(229,72,45,.75)')}}
function render(){if(!W)return;dimTexts=[];ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#16191d';ctx.fillRect(0,0,W,H);drawGrid();
 const o=w2s([0,0]);ctx.lineWidth=1.5;ctx.strokeStyle='#e5482d';ctx.beginPath();ctx.moveTo(o[0],o[1]);ctx.lineTo(o[0]+28,o[1]);ctx.stroke();ctx.strokeStyle='#4cc38a';ctx.beginPath();ctx.moveTo(o[0],o[1]);ctx.lineTo(o[0],o[1]-28);ctx.stroke();
 ctx.setTransform(dpr*view.s,0,0,-dpr*view.s,dpr*view.ox,dpr*view.oy);ctx.lineCap='round';ctx.lineJoin='round';
 if(tg.cam)drawCam();
 for(const e of S.ents){if(!vis(e))continue;const l=lyr(e.ly);drawEnt(e,tg.cam&&e.t!=='dim'?CUTCOL[cutOf(e).eff]:l?l.c:'#ddd',sel.has(e.id)?1.6:1.3,sel.has(e.id)?[7,5]:null);if(sel.has(e.id))drawEnt(e,'rgba(229,72,45,.85)',1.6,[7,5])}
 if(hoverE&&!sel.has(hoverE.id))drawEnt(hoverE,'rgba(255,176,32,.9)',2.6);
 if(hlE)drawEnt(hlE,'rgba(255,176,32,.95)',2.6,[6,4]);
 for(const id of hlSet){const e=byId(id);if(e)drawEnt(e,'rgba(255,176,32,.95)',2.6,[6,4])}
 if(REQ&&REQ.prev&&mouse.in){try{for(const e of REQ.prev(curP))drawEnt(e,'#ffd27a',1.3,[6,4])}catch(err){}}
 if(REQ&&REQ.base&&mouse.in){const b=REQ.base;drawEnt(tmp('line',{a:b,b:curP}),'rgba(255,255,255,.18)',1,[2,4])}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 for(const[e,c]of dimTexts)drawDimText(e,c);
 for(const id of sel){const e=byId(id);if(!e||!vis(e))continue;for(const s of snapPts(e)){if(s.k==='quad')continue;const p=w2s(s.p);ctx.fillStyle='#e5482d';ctx.fillRect(p[0]-3,p[1]-3,6,6)}}
 if(snapHit&&mouse.in)drawSnap(snapHit);
 if(drag&&dist(drag.s,drag.c)>4){const cr=drag.c[0]<drag.s[0];ctx.setLineDash(cr?[5,4]:[]);ctx.strokeStyle=cr?'#4cc38a':'#6f9cff';ctx.fillStyle=cr?'rgba(76,195,138,.1)':'rgba(111,156,255,.1)';ctx.lineWidth=1;
  const x=Math.min(drag.s[0],drag.c[0]),y=Math.min(drag.s[1],drag.c[1]),w=Math.abs(drag.c[0]-drag.s[0]),h=Math.abs(drag.c[1]-drag.s[1]);ctx.fillRect(x,y,w,h);ctx.strokeRect(x+.5,y+.5,w,h);ctx.setLineDash([])}
 if(mouse.in&&!pan){const s=REQ&&REQ.k==='pt'?w2s(curP):mouse.sp,x=Math.round(s[0])+.5,y=Math.round(s[1])+.5;ctx.strokeStyle='rgba(235,240,245,.55)';ctx.lineWidth=1;ctx.beginPath();
  const g=REQ&&REQ.k==='pt'?0:6;ctx.moveTo(0,y);ctx.lineTo(x-g,y);ctx.moveTo(x+g,y);ctx.lineTo(W,y);ctx.moveTo(x,0);ctx.lineTo(x,y-g);ctx.moveTo(x,y+g);ctx.lineTo(x,H);ctx.stroke();
  if(g){ctx.strokeStyle='#ebf0f5';ctx.strokeRect(x-g,y-g,2*g,2*g)}}
 const c=REQ&&REQ.k==='pt'?curP:cursorW;let t=`X ${fmtDE(c[0])} · Y ${fmtDE(c[1])}`;if(REQ&&REQ.base){const d=sub(curP,REQ.base);t+=` · L ${fmtDE(len(d))} · ${fmtDE(deg(ang(d)))}°`}$('xy').textContent=t}

/* Rahmenauswahl */
function boxSel(a,b,cross,shift){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
 const inside=p=>p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1;const edges=[[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]].map(([a,b])=>({a,b}));
 for(const e of S.ents){if(!vis(e))continue;const pts=prims(e).flatMap(sample);let ok;
  if(!cross)ok=pts.every(inside);else{ok=pts.some(inside);if(!ok)for(const q of prims(e)){const s=sample(q);for(let i=0;i<s.length-1&&!ok;i++)for(const ed of edges)if(iSS({a:s[i],b:s[i+1]},ed).length){ok=true;break}if(ok)break}}
  if(ok){shift?sel.delete(e.id):sel.add(e.id)}}}

/* ---------- Maus ---------- */
cv.addEventListener('contextmenu',e=>e.preventDefault());
/* Finger: zwei Finger = Zoom/Verschieben; Punkt wird erst beim Loslassen gesetzt (Finger ziehen = Fang suchen) */
let lastPT='mouse',pinch=null,tap=false;const TP=new Map();
document.addEventListener('pointerdown',e=>{lastPT=e.pointerType||'mouse'},true);
const focusInp=()=>{if(lastPT!=='touch')inp.focus()};
function clickAt(){computeSnap();
 if(REQ&&REQ.k==='pt'){lastPt=curP;adv({p:curP});return true}
 if(REQ&&REQ.k==='pick'){const h=hit(cursorW);if(h)adv({e:h,p:cursorW});else log('Kein Objekt getroffen.','e');return true}
 return false}
function pinchState(){const[a,b]=[...TP.values()];return{d:Math.max(dist(a,b),1),m:mid(a,b)}}
function endTouch(e){if(!TP.has(e.pointerId))return false;TP.delete(e.pointerId);if(pinch){if(!TP.size)pinch=null;return true}return false}
cv.addEventListener('pointercancel',e=>{endTouch(e);tap=false;drag=null;pan=null;render()});
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);closeMenus();const sp=[e.offsetX,e.offsetY];
 if(e.pointerType==='touch'){TP.set(e.pointerId,sp);if(TP.size>=2){if(TP.size===2){const p=pinchState();pinch={d:p.d,m:p.m,s:view.s,ox:view.ox,oy:view.oy}}drag=null;tap=false;mouse.in=false;render();return}}
 mouse.sp=sp;
 if(e.button===1||(e.button===0&&spaceDown)){e.preventDefault();pan={s:sp,ox:view.ox,oy:view.oy};spaceUsed=true;return}
 if(e.button===2){onEnter();return}if(e.button!==0)return;
 if(e.pointerType==='touch'&&REQ&&(REQ.k==='pt'||REQ.k==='pick')){tap=true;mouse.in=true;computeSnap();render();return}
 if(clickAt())return;
 if(REQ&&(REQ.k==='num'||REQ.k==='opt'||REQ.k==='str')){inp.focus();return}
 drag={s:sp,c:sp,shift:e.shiftKey}});
cv.addEventListener('pointermove',e=>{if(TP.has(e.pointerId)){TP.set(e.pointerId,[e.offsetX,e.offsetY]);
  if(pinch){if(TP.size>=2){const p=pinchState(),w=[(pinch.m[0]-pinch.ox)/pinch.s,(pinch.oy-pinch.m[1])/pinch.s];view.s=clamp(pinch.s*p.d/pinch.d,1e-3,1e3);view.ox=p.m[0]-w[0]*view.s;view.oy=p.m[1]+w[1]*view.s;render()}return}}
 mouse.sp=[e.offsetX,e.offsetY];mouse.in=true;
 if(pan){view.ox=pan.ox+mouse.sp[0]-pan.s[0];view.oy=pan.oy+mouse.sp[1]-pan.s[1]}
 if(drag)drag.c=mouse.sp;computeSnap();render()});
cv.addEventListener('pointerup',e=>{if(endTouch(e))return;if(tap){tap=false;mouse.sp=[e.offsetX,e.offsetY];clickAt();mouse.in=false;render();return}
 if(pan){pan=null;render();return}if(!drag)return;const d=drag;drag=null;
 if(dist(d.s,d.c)<4){const h=hit(s2w(d.s));if(h){if(d.shift)sel.delete(h.id);else sel.has(h.id)&&!REQ?sel.delete(h.id):sel.add(h.id)}else if(!d.shift&&!REQ)sel.clear()}
 else boxSel(s2w(d.s),s2w(d.c),d.c[0]<d.s[0],d.shift);updProps();computeSnap();render();focusInp()});
cv.addEventListener('pointerleave',()=>{mouse.in=false;render()});
cv.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(-e.deltaY*(e.deltaMode?.05:.0015)),sp=[e.offsetX,e.offsetY],w=s2w(sp);view.s=clamp(view.s*f,1e-3,1e3);view.ox=sp[0]-w[0]*view.s;view.oy=sp[1]+w[1]*view.s;computeSnap();render()},{passive:false});

/* ---------- Tastatur ---------- */
function parsePt(t){const base=(REQ&&REQ.base)||lastPt;let rel=false;if(t[0]==='@'){rel=true;t=t.slice(1)}
 if(t.includes('<')){const[a,b]=t.split('<'),d=ev(a),w=ev(b);if(d==null||w==null)return null;const o=base||[0,0];return{p:pol(rel||base?o:[0,0],d,w*D2R)}}
 if(/[,;]/.test(t)){const[a,b]=t.split(/[,;]/),x=ev(a),y=ev(b);if(x==null||y==null)return null;if(rel){if(!base)return null;return{p:add(base,[x,y])}}return{p:[x,y]}}
 const n=ev(t);if(n!=null&&!rel)return{n};return null}
function onEnter(){inp.dataset.raw=inp.value.trim();const t=inp.value.trim();inp.value='';
 if(!REQ){if(!t){if(lastCmd)run(lastCmd);return}const k=alias(t);if(k)run(k);else log('Unbekannter Befehl: '+t+'  (F1 = Hilfe)','e');return}
 if(REQ.k==='str'){adv(inp.dataset.raw||null);return}
 if(t&&REQ.k!=='num'&&!(REQ.opts||[]).includes(t.toUpperCase())&&alias(t)&&!/^[\d@.\-(]/.test(t)){run(alias(t));return}
 if(REQ.k==='sel'){const es=[...sel].map(byId).filter(Boolean);if(!es.length){log('Noch nichts gewählt.','e');return}adv(es);return}
 if(REQ.k==='num'){if(!t){adv(REQ.def!=null?REQ.def:null);return}const n=ev(t.replace(/,/g,'.'));if(n==null){log('Bitte eine Zahl eingeben.','e');return}adv(n);return}
 if(REQ.k==='opt'){const o=t?t.toUpperCase():REQ.def;if(REQ.opts.includes(o))adv(o);else log('Bitte '+REQ.opts.join(' oder ')+'.','e');return}
 if(REQ.k==='pick'){adv({});return}
 if(!t){adv({enter:true});return}
 const up=t.toUpperCase();if((REQ.opts||[]).includes(up)){adv({opt:up});return}
 const p=parsePt(t);if(p){if(p.n!=null){if(REQ.num){adv({n:p.n});return}if(!REQ.base){log('Erst einen Punkt setzen – oder X,Y eingeben.','e');return}
   let dir=sub(orthoP(cursorW),REQ.base);if(len(dir)<1e-9)dir=[1,0];const q=add(REQ.base,mul(nrm(dir),p.n));lastPt=q;adv({p:q});return}
  lastPt=p.p;adv({p:p.p});return}
 log('Eingabe nicht verstanden: '+t,'e')}
function act(a){const T={osnap:1,ortho:1,grid:1,gsnap:1,cam:1};if(T[a]){tg[a]=!tg[a];log(({osnap:'Objektfang',ortho:'Ortho',grid:'Raster',gsnap:'Rasterfang',cam:'Fräsvorschau'})[a]+(tg[a]?' an':' aus')+(a==='cam'&&tg[a]?' – gestrichelt: Weg der Fräsermitte · rot: hier bleibt Material stehen':''));updTools();computeSnap();render();saveUI();return}
 ({enter:onEnter,esc:()=>{inp.value='';cancel(false)},neu:()=>$('dNew').classList.add('open'),oeffnen:()=>$('file').click(),speichern:saveFile,undo,redo,zoomAll,help:()=>$('dHelp').classList.add('open'),
  alle:()=>{S.ents.filter(vis).forEach(e=>sel.add(e.id));updProps();render()}})[a]?.()}
window.addEventListener('keydown',e=>{const t=e.target,inProp=t!==inp&&(t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA');
 if(document.querySelector('.dlg.open')){if(e.key==='Escape')document.querySelectorAll('.dlg.open').forEach(d=>d.classList.remove('open'));return}
 const F={F1:'help',F3:'osnap',F6:'cam',F7:'grid',F8:'ortho',F9:'gsnap'};if(F[e.key]){e.preventDefault();act(F[e.key]);return}
 if(inProp)return;
 if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(k==='y'){e.preventDefault();redo()}else if(k==='s'){e.preventDefault();saveFile()}else if(k==='a'&&!inp.value){e.preventDefault();act('alle')}return}
 if(e.key==='Escape'){e.preventDefault();inp.value='';cancel(false);return}
 if(e.key==='Enter'){e.preventDefault();onEnter();return}
 if(e.key===' '&&!inp.value){e.preventDefault();if(!e.repeat){spaceDown=true;spaceUsed=false}return}
 if((e.key==='Delete')&&!inp.value&&!REQ&&sel.size){e.preventDefault();run('E');return}
 if(e.key.length===1&&t!==inp)inp.focus()});
window.addEventListener('keyup',e=>{if(e.key===' '&&spaceDown){spaceDown=false;if(!spaceUsed&&!inp.value)onEnter()}});

/* Menüs & Knöpfe */
function closeMenus(){document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'))}
document.addEventListener('click',e=>{const dd=e.target.closest('.dd>button');if(dd){const p=dd.parentElement,o=p.classList.contains('open');closeMenus();if(!o)p.classList.add('open');return}
 const b=e.target.closest('[data-r],[data-a]');if(b&&!b.closest('#layers')){closeMenus();if(b.dataset.r)run(b.dataset.r);else act(b.dataset.a);if(!b.closest('.dlg')&&!(REQ&&['num','opt','str'].includes(REQ.k)))focusInp();return}
 if(e.target.closest('[data-close]')||e.target.classList.contains('dlg')){document.querySelectorAll('.dlg.open').forEach(d=>d.classList.remove('open'));return}
 if(!e.target.closest('.dd'))closeMenus()});
document.querySelectorAll('.menu .dd').forEach(d=>d.addEventListener('mouseenter',()=>{if(document.querySelector('.dd.open')&&!d.classList.contains('open')){closeMenus();d.classList.add('open')}}));
const tip=$('tip');document.addEventListener('mouseover',e=>{const b=e.target.closest('[data-tip]');if(!b){tip.style.display='none';return}const r=b.getBoundingClientRect();tip.textContent=b.dataset.tip;tip.style.display='block';tip.style.left=(r.right+8)+'px';tip.style.top=(r.top+r.height/2-13)+'px'});
$('gstep').addEventListener('change',e=>{const v=ev(e.target.value.replace(',','.'));if(v>0){gstep=v;saveUI();render()}else e.target.value=gstep});

/* ---------- Dateien ---------- */
let fileName='Zeichnung.json';
function save(){try{localStorage.setItem('origincad.v1',snapS())}catch(e){}}
function saveUI(){try{localStorage.setItem('origincad.ui',JSON.stringify({tg,gstep}))}catch(e){}}
function afterChange(){geoVer++;save();updDefs();updProps();updLayers();computeSnap();render()}
async function saveFile(){const data=JSON.stringify({app:'OriginCAD',v:2,...S});
 try{if(window.showSaveFilePicker){const h=await showSaveFilePicker({suggestedName:fileName,types:[{description:'Origin-CAD-Zeichnung',accept:{'application/json':['.json']}}]});const w=await h.createWritable();await w.write(data);await w.close();fileName=h.name;$('fname').textContent=fileName+' · Maße in mm';log('Gespeichert: '+fileName,'ok');return}}
 catch(err){if(err&&err.name==='AbortError'){log('Speichern abgebrochen.');return}}
 try{const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);log('Gespeichert als Download: '+fileName,'ok')}
 catch(err){$('saveT').value=data;$('dSave').classList.add('open')}}
$('copyB').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('saveT').value);$('copyB').textContent='Kopiert ✓'}catch(e){$('saveT').select();$('copyB').textContent='Mit Strg+C kopieren'}setTimeout(()=>$('copyB').textContent='Kopieren',2000)});
$('newB').addEventListener('click',()=>{pushUndo();S={ents:[],layers:DEF_LAYERS(),cur:'Kontur',nid:1,def:{...S.def}};fileName='Zeichnung.json';sel.clear();$('dNew').classList.remove('open');afterChange();zoomAll();log('Neue Zeichnung.','ok')});
$('file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const o=JSON.parse(await f.text());if(!Array.isArray(o.ents))throw 0;pushUndo();
 S={ents:o.ents,layers:o.layers&&o.layers.length?o.layers:DEF_LAYERS(),cur:o.cur||'0',nid:Math.max(o.nid||1,...o.ents.map(x=>x.id+1),1),def:Object.assign(DEF_CUT(),o.def||{})};sel.clear();afterChange();updDefs();zoomAll();fileName=f.name;$('fname').textContent=f.name+' · Maße in mm';log('Geöffnet: '+f.name,'ok')}catch(err){log('Datei konnte nicht gelesen werden.','e')}});

/* ---------- Start ---------- */
function sample0(){const K='Kontur',B='Bemaßung';S.nid=1;S.ents=[
 mk('pline',{pts:[[0,0],[400,0],[400,600],[0,600]],closed:true,rect:true},K),
 mk('circle',{c:[21.5,100],r:17.5},K),mk('circle',{c:[21.5,500],r:17.5},K),
 mk('slot',{a:[360,250],b:[360,350],r:10},K),
 mk('dim',{a:[0,0],b:[400,0],p:[200,-45],m:'h'},B),mk('dim',{a:[0,0],b:[0,600],p:[-45,300],m:'v'},B),
 mk('dim',{a:[400,0],b:[360,250],p:[440,125],m:'v'},B)]}
let restored=false;try{const o=JSON.parse(localStorage.getItem('origincad.v1')||'null');if(o&&Array.isArray(o.ents)){S=o;S.def=Object.assign(DEF_CUT(),o.def||{});restored=true}const u=JSON.parse(localStorage.getItem('origincad.ui')||'null');if(u){Object.assign(tg,u.tg||{});gstep=u.gstep||10;$('gstep').value=gstep}}catch(e){}
if(!restored){sample0();log('Beispiel: Front 400 × 600 mit zwei Topfbändern Ø35 und Griffloch. Datei › Neu leert die Zeichnung.')}
else log('Letzte Zeichnung wiederhergestellt.');
log('Tipp: L + Enter für Linie, R für Rechteck, K für Kreis. F1 zeigt alle Befehle.');
buildTools();updTools();updDefs();updProps();updLayers();updPrompt();
new ResizeObserver(()=>{const first=!W;resize();if(first)zoomAll()}).observe($('cvw'));
if(matchMedia('(pointer:fine)').matches)inp.focus();
window.__cad={w2s,get S(){return S},run,onEnter,inp,adv,get REQ(){return REQ},sel,zoomAll,cutOf,camOf,act,tg,updProps,bbox,
 areaOf:(id,off)=>{const P=[ccw(toPaths(byId(id))[0].pts)];return(off?clOffset(P,off):P).reduce((s,q)=>s+area(q),0)}};
}
