/* Floating Memo for Passing Thoughts */
(()=>{
const $=s=>document.querySelector(s);
const wrap=$('#wrap'), layer=$('#layer'), sedEl=$('#sed'), sedLayers=$('#sedLayers'), sedLabel=$('#sedLabel');
const fogC=$('#fog'), breathC=$('#breath'), trailC=$('#trail'), input=$('#breathInput'), writeUI=$('#writeUI');
const linksC=$('#links'), sealHint=$('#sealHint'), emptyHint=$('#emptyHint'), detail=$('#detail'), dText=$('#dText'), dImg=$('#dImg'), dMeta=$('#dMeta');
const DAY=864e5, TAU=Math.PI*2;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let S=400,R=200,C=200,K=1,dpr=Math.min(2,window.devicePixelRatio||1);

/* ---------- state ---------- */
/* fresh start: memos saved by earlier test versions are cleared once; from now on only memos written here are kept */
const STORE='floatingmemo-v1';
try{localStorage.removeItem('hurim-v1')}catch(e){}
function load(){try{const s=localStorage.getItem(STORE);return s?JSON.parse(s):null}catch(e){return null}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){}}
function seed(){
  const t=Date.now();
  /* default memos: px/py place each one inside the orb as a fraction of its radius */
  const m=(id,text,px,py,extra={})=>Object.assign({id,text,img:null,created:t,touched:t,warm:false,status:'float',px,py},extra);
  /* a first visit starts with a completely empty orb: no memos, no sediment, no deleted memos */
  return {offset:0,nextId:20,links:[],trash:[],noSamples:true,seed2:true,seed3:true,memos:[]};
}
let state=load()||seed();
if(!Array.isArray(state.links)) state.links=[];
if(!Array.isArray(state.trash)) state.trash=[];
/* one-time cleanup: remove the old example memos (ids below 20), keep everything the user wrote */
if(!state.noSamples){
  state.memos=state.memos.filter(m=>m.id>=20);
  state.trash=state.trash.filter(t=>t.m&&t.m.id>=20);
  state.links=state.links.filter(l=>l[0]>=20&&l[1]>=20);
  state.noSamples=true; save();
}
/* browsers that opened the empty version get the default memos once; anyone with their own memos keeps them */
if(!state.seed2){
  if(!state.memos.length&&!state.trash.length){ const s=seed(); state.memos=s.memos; state.nextId=Math.max(state.nextId||20,s.nextId) }
  state.seed2=true; save();
}
/* one-time cleanup: remove every memo the app placed by itself (default memos carry a px position), wherever it ended up */
if(!state.seed3){
  const placed=m=>m&&m.px!=null;
  state.memos=state.memos.filter(m=>!placed(m));
  state.trash=state.trash.filter(t=>!placed(t.m));
  const ids=new Set([...state.memos.map(m=>m.id),...state.trash.map(t=>t.m&&t.m.id)]);
  state.links=state.links.filter(l=>ids.has(l[0])&&ids.has(l[1]));
  state.seed3=true; save();
}
for(const m of state.memos) if(m.status==='sealed'){m.status='float'; delete m.sealUntil}
const now=()=>Date.now()+state.offset*DAY;
const ageOf=m=>Math.max(0,(now()-m.touched)/DAY)*(m.secret?2:1);
const bodies=new Map();
let secretMode=false, secretT=0, exiting=false, writeFocusPending=false;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const short=t=>{t=(t||'손글씨 메모').replace(/\n/g,' ');return t.length>14?t.slice(0,14)+'…':t};
const fmtShort=ts=>{const d=new Date(ts);return `${d.getMonth()+1}/${d.getDate()}`};
const fmtLong=ts=>new Date(ts).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});

/* ---------- geometry ---------- */
function measure(){
  const oldR=R; const r=wrap.getBoundingClientRect();
  S=r.width; C=S/2; R=S/2-2; K=Math.max(.7,Math.min(1.3,S/420));
  for(const c of [fogC,breathC]){c.width=S*dpr;c.height=S*dpr}
  trailC.width=S*1.2*dpr; trailC.height=S*1.2*dpr;
  linksC.width=S*dpr; linksC.height=S*dpr;
  if(oldR&&oldR!==R){const k=R/oldR; for(const b of bodies.values()){b.x*=k;b.y*=k; styleBody(b)}}
  paintFog(fogC.getContext('2d'),0.9,7);
  renderSed();
}
function paintFog(ctx,alpha,seedN){
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,S,S);
  ctx.save(); ctx.beginPath(); ctx.arc(C,C,R,0,TAU); ctx.clip();
  ctx.fillStyle=`rgba(250,250,252,${Math.min(0.94,alpha*0.6)})`; ctx.fillRect(0,0,S,S);
  ctx.restore();
}
const archivedList=()=>state.memos.filter(m=>m.status==='archived'&&!!m.secret===secretMode).sort((a,b)=>a.archivedAt-b.archivedAt);
/* sediment: one layer per sunk memo, newest on top, every layer shows its text; up to 5 layers, scroll for older ones */
let sedOff=0, sedWheelT=0;
/* every sunk memo keeps its own readable layer: layers get thinner as the pile grows, and the pile rises if it must */
function sedMetrics(){
  const n=archivedList().length, base=Math.max(18,R*0.085), bottom=R*0.955;
  let lh=n?Math.max(15,Math.min(base,R*0.7/n)):base;
  if(n*lh>R*1.3) lh=R*1.3/n;
  return {n,lh,vis:n,bottom,top:bottom-n*lh};
}
function sedTopY(){ return sedMetrics().top }
function sedWindow(){ const list=archivedList().slice().reverse(), M=sedMetrics(); sedOff=Math.max(0,Math.min(sedOff,list.length-M.vis)); return list.slice(sedOff,sedOff+M.vis) }
function sedLayerAt(y){ const M=sedMetrics(), win=sedWindow(), i=Math.min(win.length-1,Math.floor((y-M.top)/M.lh)); return (i>=0&&win.length)?win[i]:null }
function renderSed(){
  const M=sedMetrics(), win=sedWindow();
  sedEl.style.height=M.vis?(R-M.top+2)+'px':'0px'; /* no memos sunk = no band at all */
  sedLayers.innerHTML='';
  win.forEach((m,i)=>{
    const y0=M.top+i*M.lh, ym=y0+M.lh/2, chord=2*Math.sqrt(Math.max(0,R*R-ym*ym));
    const el=document.createElement('div'); el.className='layer'; el.dataset.id=m.id;
    const last=i===win.length-1, fs=Math.max(9,Math.min(13,M.lh*0.78));
    el.style.top=(y0-M.top)+'px'; el.style.height=(last?(R+2-y0):M.lh)+'px'; /* the lowest layer fills down to the bottom of the orb */
    el.style.alignItems='flex-start'; el.style.paddingTop=((M.lh-fs*1.2)/2).toFixed(1)+'px'; el.style.boxSizing='border-box';
    /* newest layer on top is just a little darker than the glass; each older layer below is one step darker */
    const step=win.length>1?Math.min(0.07,0.6/(win.length-1)):0, amt=0.14+i*step;
    el.style.background=`color-mix(in srgb, var(--frost), var(--deep) ${(amt*100).toFixed(1)}%)`;
    const s=document.createElement('span'); s.textContent=(m.text||'손글씨 메모').replace(/\n/g,' ');
    s.style.maxWidth=Math.max(40,chord*0.78)+'px'; s.style.fontSize=fs.toFixed(1)+'px';
    if(amt>0.52) el.classList.add('dark');
    el.appendChild(s); sedLayers.appendChild(el);
  });
  const older=M.n-sedOff-win.length;
  sedLabel.textContent='';
}

/* ---------- bubbles ---------- */
function radiusOf(m){
  if(m.status==='sealed') return 14*K;
  const len=(m.text||'').length+(m.img?16:0);
  let r=(30+Math.min(len,44)*0.75)*K;
  r*= m.warm?1.06:Math.max(0.62,1-ageOf(m)*0.055);
  return r;
}
function fillBody(b){
  const m=b.m, el=b.el;
  el.querySelectorAll('img,.tx').forEach(n=>n.remove());
  if(m.img){const im=new Image(); im.src=m.img; im.alt=''; im.draggable=false; el.appendChild(im)}
  if(m.text){const tx=document.createElement('span'); tx.className='tx'; tx.textContent=m.text; el.appendChild(tx)}
}
function addBody(m,x,y,cls){
  const el=document.createElement('div'); el.className='bub'+(cls?' '+cls:''); el.dataset.id=m.id;
  el.innerHTML='<span class="tag"></span>'; el.style.setProperty('--tw',(-Math.random()*2.8).toFixed(2)+'s');
  layer.appendChild(el);
  const b={m,el,x,y,vx:0,vy:0,r:radiusOf(m),ph:Math.random()*TAU,drag:false,dying:false,reveal:0,lit:0,litShown:-1};
  bodies.set(m.id,b); fillBody(b); styleBody(b); place(b);
  return b;
}
function styleBody(b){
  const m=b.m, el=b.el; const r=radiusOf(m); b.r=r;
  el.style.width=el.style.height=(2*r)+'px';
  el.style.setProperty('--fs',(Math.max(10.5,Math.min(17,(30+5*0.75)*K*0.28))*(m.warm?1.06:1)).toFixed(2)+'px'); /* default memos share the size of a fresh short memo; warm ones stay slightly larger */
  el.classList.toggle('warm',!!m.warm);
  el.classList.toggle('seed',m.status==='sealed');
  const rev=b.reveal>performance.now();
  el.classList.toggle('reveal',rev);
  el.querySelector('.tag').textContent= m.status==='sealed'?fmtShort(m.sealUntil):'';
  const a=(m.warm||rev||m.status==='sealed')?0:ageOf(m);
  el.style.opacity=Math.max(0.36,1-a*0.085).toFixed(2);
  el.style.setProperty('--blur',Math.min(2.4,a*0.3).toFixed(2)+'px');
  el.style.setProperty('--dot',((m.warm?13:5+7*(1-Math.min(1,a/7)))*K).toFixed(1)+'px');
  el.setAttribute('aria-label',m.status==='sealed'?'봉인된 예언':(m.text||'손글씨 메모'));
}
function place(b){b.el.style.transform=`translate3d(${C+b.x-b.r}px,${C+b.y-b.r}px,0)`}
function spawnAll(){
  layer.innerHTML=''; bodies.clear();
  for(const m of state.memos){
    if(m.status==='archived'||!!m.secret!==secretMode) continue;
    const a=Math.min(1,ageOf(m)/7);
    if(m.px!=null) addBody(m,m.px*R,m.py*R);
    else addBody(m,(Math.random()-.5)*R*1.1,-R*.45+a*R*.9+(Math.random()-.5)*20);
  }
}

/* ---------- loop ---------- */
const trail=[];
let last=performance.now();
function tick(t){
  const dt=Math.min(40,t-last); last=t; const f=dt/16.67;
  const arr=[...bodies.values()]; const sedTop=sedTopY();
  for(const b of arr){
    if(b.reveal&&t>b.reveal){b.reveal=0; styleBody(b)}
    if(b.drag) continue;
    if(b.dying){ if(b.sinkTo){b.y+= (b.sinkTo-b.y)*0.08*f} place(b); continue }
    const m=b.m; let ty, tx=null;
    if(m.status==='sealed'){ty=sedTop-b.r-6}
    else if(b.reveal){ty=-R*0.08; tx=0}
    else if(m.warm){ty=-R*0.1; tx=0}
    else{const a=Math.min(1,ageOf(m)/7); ty=-R*0.5+a*((sedTop-b.r-6)+R*0.5)}
    b.vy+=(ty-b.y)*0.0018*f;
    if(tx!==null) b.vx+=(tx-b.x)*0.0016*f;
    const amp=RM?0.004:0.02;
    b.vx+=Math.sin(t*0.0006+b.ph)*amp*f; b.vy+=Math.cos(t*0.0008+b.ph*1.7)*amp*f;
  }
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
    const a=arr[i],b=arr[j]; if(a.dying||b.dying) continue;
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy), min=a.r+b.r+4;
    if(d<min&&d>0.01){const p=(min-d)/d*0.06*f; if(!a.drag){a.vx-=dx*p;a.vy-=dy*p} if(!b.drag){b.vx+=dx*p;b.vy+=dy*p}}
  }
  for(const [ia,ib] of state.links){
    const a=bodies.get(ia), b=bodies.get(ib); if(!a||!b||a.dying||b.dying) continue;
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, rest=a.r+b.r+34*K, p=(d-rest)/d*0.004*f;
    if(!a.drag){a.vx+=dx*p; a.vy+=dy*p} if(!b.drag){b.vx-=dx*p; b.vy-=dy*p}
  }
  const damp=Math.pow(0.93,f);
  for(const b of arr){
    if(!b.drag&&!b.dying){
      b.vx*=damp; b.vy*=damp; b.x+=b.vx*f; b.y+=b.vy*f;
      const lim=R-b.r-5, d=Math.hypot(b.x,b.y);
      if(d>lim){const nx=b.x/d, ny=b.y/d; b.x=nx*lim; b.y=ny*lim; const vn=b.vx*nx+b.vy*ny; if(vn>0){b.vx-=1.6*vn*nx; b.vy-=1.6*vn*ny}}
      if(b.m.status!=='sealed'){const floor=sedTop-b.r-2; if(b.y>floor){b.y=floor; if(b.vy>0)b.vy*=-0.3}}
    }
    if(!b.dying) place(b);
  }
  updateLamp(t,f,arr);
  drawLinks(t);
  drawTrail(t);
  requestAnimationFrame(tick);
}
function drawTrail(t){
  const ctx=trailC.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,S*1.2,S*1.2);
  while(trail.length&&t-trail[0].t>700) trail.shift();
  return; /* no afterimage when sweeping */
  ctx.lineCap='round'; ctx.lineJoin='round';
  const o=S*0.1+C;
  for(let i=1;i<trail.length;i++){
    const p=trail[i], q=trail[i-1]; if(p.brk) continue;
    const a=1-(t-p.t)/700;
    ctx.strokeStyle=`rgba(107,63,224,${a*0.35})`; ctx.lineWidth=(2+a*4)*K;
    ctx.beginPath(); ctx.moveTo(o+q.x,o+q.y); ctx.lineTo(o+p.x,o+p.y); ctx.stroke();
  }
}

/* ---------- constellations ---------- */
let hoverLink=-1, kin=null;
const linkKey=(a,b)=>a<b?a+'-'+b:b+'-'+a;
function liveLinks(){return state.links.map((l,i)=>({i,a:bodies.get(l[0]),b:bodies.get(l[1])})).filter(o=>o.a&&o.b&&!o.a.dying&&!o.b.dying)}
function addLinks(ids){
  const have=new Set(state.links.map(l=>linkKey(l[0],l[1]))); const added=[];
  for(let i=1;i<ids.length;i++){const k=linkKey(ids[i-1],ids[i]); if(ids[i-1]!==ids[i]&&!have.has(k)){have.add(k); state.links.push([ids[i-1],ids[i]]); added.push(k)}}
  if(added.length) record(()=>{const ks=new Set(added); state.links=state.links.filter(l=>!ks.has(linkKey(l[0],l[1])))});
  save(); return added.length;
}
function cutLinks(idx){
  const removed=idx.map(i=>state.links[i]).filter(Boolean);
  idx.sort((a,b)=>b-a).forEach(i=>state.links.splice(i,1)); save();
  record(()=>state.links.push(...removed));
  hoverLink=-1; wrap.classList.remove('cutting'); buzz(15); sfx.cut();
  toast(idx.length>1?`빛줄기 ${idx.length}개를 끊었어요`:'빛줄기를 끊었어요');
}
function segDist(p,a,b){const vx=b.x-a.x, vy=b.y-a.y, l=vx*vx+vy*vy||1; let t=((p.x-a.x)*vx+(p.y-a.y)*vy)/l; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t)}
function linkNear(p){
  for(const b of bodies.values()) if(!b.dying&&dist(p,b)<b.r*0.45) return -1;
  let best=-1, bd=8*K+3;
  for(const o of liveLinks()){const d=segDist(p,o.a,o.b); if(d<bd){bd=d; best=o.i}}
  return best;
}
function crosses(p1,p2,a,b){
  const d=(p2.x-p1.x)*(b.y-a.y)-(p2.y-p1.y)*(b.x-a.x); if(!d) return false;
  const t=((a.x-p1.x)*(b.y-a.y)-(a.y-p1.y)*(b.x-a.x))/d, u=((a.x-p1.x)*(p2.y-p1.y)-(a.y-p1.y)*(p2.x-p1.x))/d;
  return t>=0&&t<=1&&u>=0.1&&u<=0.9;
}
function crossedLinks(path){const out=new Set(); const L=liveLinks(); for(let i=1;i<path.length;i++) for(const o of L) if(crosses(path[i-1],path[i],o.a,o.b)) out.add(o.i); return [...out]}
function component(id){
  const seen=new Set([id]); let grow=true;
  while(grow){grow=false; for(const [a,b] of state.links){ if(seen.has(a)&&!seen.has(b)){seen.add(b);grow=true} else if(seen.has(b)&&!seen.has(a)){seen.add(a);grow=true} }}
  return seen;
}
function hitStar(p){for(const b of bodies.values()){ if(b.dying||b.m.status==='sealed') continue; if(dist(p,b)<Math.max(b.r*0.55,16*K)) return b } return null}
function drawLinks(t){
  const ctx=linksC.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,S,S); ctx.lineCap='round';
  for(const o of liveLinks()){
    const hot=o.i===hoverLink, k=kin&&kin.has(o.a.m.id);
    let ax=C+o.a.x, ay=C+o.a.y, bx=C+o.b.x, by=C+o.b.y;
    { const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, ta=o.a.r*0.5, tb=o.b.r*0.5;
      if(L>ta+tb+4){ax+=dx/L*ta; ay+=dy/L*ta; bx-=dx/L*tb; by-=dy/L*tb} }
    if(hot){
      const j=Math.sin(t*0.07)*1.8, nx=-(by-ay), ny=bx-ax, nl=Math.hypot(nx,ny)||1;
      ax+=nx/nl*j; ay+=ny/nl*j; bx-=nx/nl*j; by-=ny/nl*j;
      ctx.shadowBlur=0; ctx.strokeStyle='#a4a4aa'; ctx.lineWidth=2.4; ctx.setLineDash([]);
    } else {
      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(${secretMode?'120,170,128':'157,152,198'},${k?1:0.6+0.4*Math.max(o.a.lit,o.b.lit)})`; ctx.lineWidth=k?2.2:1.3; ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.shadowBlur=0;
  if(g&&g.type==='bg'&&g.hits&&g.hits.length){
    ctx.strokeStyle=secretMode?'#78aa80':'#9d98c6'; ctx.lineWidth=1.6; ctx.setLineDash([]); ctx.beginPath();
    g.hits.forEach((b,i)=>{ i?ctx.lineTo(C+b.x,C+b.y):ctx.moveTo(C+b.x,C+b.y) });
    const lp=g.path[g.path.length-1]; ctx.lineTo(C+lp.x,C+lp.y); ctx.stroke(); ctx.setLineDash([]);
  }
}

/* ---------- ambient readouts ---------- */
function updateFog(){
  const fl=state.memos.filter(m=>m.status==='float'&&!!m.secret===secretMode);
  let lv=0; for(const m of fl) lv+=Math.min(1,ageOf(m)/7)*0.085+0.02;
  lv=Math.min(0.72,lv);
  fogC.style.opacity=Math.max(0.45,lv).toFixed(2); /* a base layer of frost is always there, so the clear window around the cursor shows in both orbs */
  $('#memoCount').textContent=fl.length;
  emptyHint.hidden=fl.length>0||writing;
}
function updateDate(){}

/* ---------- toast ---------- */
function toast(){ /* no captions: feedback lives in the orb itself */ }
function buzz(ms){try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}

/* ---------- sound: every thought is a small glass note ---------- */
const sfx=(()=>{
  let ac=null, master=null, muted=false, lastChime=0;
  const SCALE=[0,2,4,7,9];
  function ctx(){
    if(muted) return null;
    if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=0.55;
      const comp=ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination) }catch(e){ return null } }
    if(ac.state==='suspended') ac.resume().catch(()=>{});
    return ac;
  }
  const noteOf=id=>{const n=((id*7)%15+15)%15; return 523.25*Math.pow(2,(SCALE[n%5]+12*Math.floor(n/5)-12)/12)};
  function bell(f,{t=0,dur=1.6,vol=.18,type='sine',partials=[[1,1],[2.76,.35],[5.4,.12]]}={}){
    const a=ctx(); if(!a) return; const t0=a.currentTime+t;
    for(const [m,v] of partials){
      const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.value=f*m;
      const end=t0+dur/(m>1?m*0.6:1);
      g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol*v,t0+0.008); g.gain.exponentialRampToValueAtTime(0.0001,end);
      o.connect(g); g.connect(master); o.start(t0); o.stop(end+0.05);
    }
  }
  function noise(dur,{t=0,vol=.15,f0=800,f1=800,q=1,type='bandpass',attack=.02}={}){
    const a=ctx(); if(!a) return; const t0=a.currentTime+t;
    const len=Math.ceil(a.sampleRate*dur), buf=a.createBuffer(1,len,a.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const s=a.createBufferSource(); s.buffer=buf;
    const fl=a.createBiquadFilter(); fl.type=type; fl.Q.value=q; fl.frequency.setValueAtTime(f0,t0); fl.frequency.exponentialRampToValueAtTime(f1,t0+dur);
    const g=a.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+attack); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t0); s.stop(t0+dur);
  }
  function glide(f0,f1,dur,{vol=.12,type='sine',t=0}={}){
    const a=ctx(); if(!a) return; const t0=a.currentTime+t;
    const o=a.createOscillator(), g=a.createGain(); o.type=type;
    o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(f1,t0+dur);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+0.03); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+.05);
  }
  return {
    unlock(){ctx()},
    toggle(){muted=!muted; if(muted&&ac) ac.suspend(); else ctx()},
    chime(b,force){
      const n=performance.now(); if(!force&&n-lastChime<70) return; lastChime=n;
      const age=Math.min(1,ageOf(b.m)/7);
      bell(noteOf(b.m.id),{vol:force?.16:.08*(1-age*.6)+.02,dur:force?1.4:1.1});
    },
    chord(bs){bs.forEach((b,i)=>bell(noteOf(b.m.id),{t:i*0.09,vol:.13,dur:2.2}))},
    pop(b){bell(noteOf(b.m.id)*2,{vol:.12,dur:.35,partials:[[1,1],[2.3,.6],[3.9,.4],[6.1,.2]]}); noise(.12,{vol:.18,f0:5000,f1:2000,q:.8})},
    wipe(){noise(.45,{vol:.14,f0:1200,f1:3500,q:2,attack:.1})},
    sink(){glide(220,110,1.2,{vol:.12}); noise(.9,{vol:.05,f0:600,f1:150,type:'lowpass',attack:.2})},
    rise(m){glide(220,noteOf(m.id),.7,{vol:.1}); bell(noteOf(m.id),{t:.55,vol:.1})},
    breath(){noise(.9,{vol:.09,f0:300,f1:1400,q:.6,attack:.35})},
    absorb(){noise(.5,{vol:.06,f0:2500,f1:500,q:.7,attack:.05}); glide(880,1320,.5,{vol:.07}); bell(1046.5,{t:.35,vol:.1,dur:1.8})},
    warm(on,b){
      const f=noteOf(b.m.id)/2;
      if(on) [1,1.25,1.5].forEach((m,i)=>bell(f*m,{t:i*.05,vol:.08,dur:2.4,type:'triangle',partials:[[1,1]]}));
      else glide(f,f*.8,.6,{vol:.07,type:'triangle'});
    },
    merge(a,b){glide(noteOf(b.m.id),noteOf(a.m.id),.4,{vol:.1}); bell(noteOf(a.m.id),{t:.35,vol:.14,dur:2})},
    cut(){noise(.06,{vol:.25,f0:6000,f1:6000,q:3,attack:.002}); glide(1400,500,.25,{vol:.08,type:'triangle'})},
    seal(){bell(130.8,{vol:.2,dur:3,partials:[[1,1],[2.4,.4],[4.1,.2]]})},
    secret(on){ if(on){glide(392,587,.6,{vol:.08,type:'triangle'}); bell(587,{t:.45,vol:.1,dur:2})} else glide(587,392,.5,{vol:.07,type:'triangle'}) },
    shatter(){ noise(.18,{vol:.2,f0:7000,f1:2500,q:.7,attack:.002}); bell(1568,{vol:.06,dur:.3,partials:[[1,1],[2.4,.6],[3.7,.4],[5.2,.3]]}) },
    rewind(ok){ if(ok){glide(1200,380,.28,{vol:.09,type:'triangle'}); noise(.25,{vol:.05,f0:3000,f1:600,q:.8})} else glide(300,260,.15,{vol:.05}) },
    knock(n){ bell(98+n*6,{vol:.22,dur:.35,partials:[[1,1],[2.1,.3],[3.3,.1]]}); noise(.05,{vol:.12,f0:900,f1:400,q:1.5,attack:.002}) },
    rush(){ noise(1.1,{vol:.07,f0:400,f1:3000,q:.5,attack:.2}) },
    tick(i){ bell(784*Math.pow(2,SCALE[i%5]/12),{vol:.04,dur:.5}) },
    reset(){ noise(1.2,{vol:.12,f0:300,f1:6000,q:.4,attack:.05}); [523,659,784,1046].forEach((f,i)=>bell(f,{t:.1+i*.06,vol:.06,dur:1.6})) },
    shake(){for(let i=0;i<9;i++) bell(523.25*Math.pow(2,(SCALE[i%5]+12*Math.floor(Math.random()*2))/12),{t:i*0.045+Math.random()*.03,vol:.05,dur:.9})}
  };
})();

/* ---------- history: every action can be rewound ---------- */
const hist=[]; let undoing=false;
function record(fn){ if(undoing) return; hist.push(fn); if(hist.length>40) hist.shift() }
function undo(){ const fn=hist.pop();
  if(!fn){ const e=state.trash.find(t=>!!t.m.secret===secretMode); if(!e) return false; restoreFromTrash(e,0,-R*0.3); return true } undoing=true; try{fn()}catch(e){} undoing=false; save(); updateFog(); return true }

/* ---------- trash: popped thoughts leave shards outside the orb ---------- */
const shardGroups=new Set();
function restoreFromTrash(entry,x,y){
  const i=state.trash.indexOf(entry); if(i<0) return null;
  state.trash.splice(i,1);
  const m=entry.m; m.status='float'; m.touched=now(); state.memos.push(m);
  const ids=new Set(state.memos.map(o=>o.id)), have=new Set(state.links.map(l=>linkKey(l[0],l[1])));
  for(const l of entry.links){ const k=linkKey(l[0],l[1]); if(ids.has(l[0])&&ids.has(l[1])&&!have.has(k)){state.links.push(l); have.add(k)} }
  const lim=R*0.7, d=Math.hypot(x,y); if(d>lim){x=x/d*lim; y=y/d*lim}
  const b=addBody(m,x,y,'born'); requestAnimationFrame(()=>requestAnimationFrame(()=>b.el.classList.remove('born')));
  for(const grp of [...shardGroups]) if(grp.entry===entry) clearShards(grp,true);
  save(); updateFog(); sfx.rise(m); buzz(12);
  return b;
}
function placeShards(grp){ grp.el.style.transform=`translate(${C+grp.x-grp.hw/2}px,${C+grp.y-grp.hw/2}px)` }
function clearShards(grp,gather){
  shardGroups.delete(grp); clearTimeout(grp.timer);
  if(gather) grp.el.classList.add('gather');
  grp.el.classList.add('fade'); setTimeout(()=>grp.el.remove(),1300);
}
function armShards(grp,ms){ clearTimeout(grp.timer); grp.el.classList.remove('fade'); grp.timer=setTimeout(()=>clearShards(grp,false),ms) }
function spawnShards(entry,b,v){
  const dx=b.x+v.x*120, dy=b.y+v.y*120, d=Math.hypot(dx,dy)||1, far=R+40*K, hw=Math.round(72*K);
  const el=document.createElement('div'); el.className='crumbs'; el.style.setProperty('--hw',hw+'px');
  const grp={entry,el,hw,x:b.x,y:b.y,timer:0}; el._grp=grp;
  for(let i=0;i<22;i++){
    const c=document.createElement('i'), a=Math.random()*TAU, rr=Math.pow(Math.random(),.6)*hw*0.42;
    c.style.setProperty('--s',((1.5+Math.random()*3.5)*K).toFixed(1)+'px');
    c.style.setProperty('--x',(Math.cos(a)*rr).toFixed(1)+'px'); c.style.setProperty('--y',(Math.sin(a)*rr).toFixed(1)+'px');
    c.style.opacity=(0.45+Math.random()*0.55).toFixed(2); el.appendChild(c);
  }
  layer.appendChild(el); placeShards(grp); shardGroups.add(grp);
  setTimeout(()=>{ if(!shardGroups.has(grp)) return; grp.x=dx/d*far; grp.y=dy/d*far; placeShards(grp); el.classList.add('spread') },180);
  armShards(grp,30000);
}

/* ---------- actions ---------- */
function touchMemo(b){b.m.touched=now(); styleBody(b); save(); updateFog()}
function removeBody(b,cls,ms){
  b.dying=true; b.el.classList.add(cls);
  setTimeout(()=>{b.el.remove(); bodies.delete(b.m.id)},ms);
}
function deleteMemo(b,cls){
  const m=b.m, pos={x:b.x,y:b.y};
  const oldLinks=state.links.filter(l=>l.includes(m.id));
  state.links=state.links.filter(l=>!l.includes(m.id));
  state.memos=state.memos.filter(x=>x!==m);
  const entry={m,links:oldLinks,at:now()}; state.trash.unshift(entry); if(state.trash.length>80) state.trash.length=80;
  save();
  removeBody(b,cls,cls==='pop'?240:520);
  updateFog(); buzz(20);
  record(()=>restoreFromTrash(entry,pos.x*.8,pos.y*.8));
  return entry;
}
function pop(b,v){
  const n=9;
  for(let i=0;i<n;i++){
    const d=document.createElement('span'); d.className='drop';
    const ang=i/n*TAU+Math.random()*.4, sp=(40+Math.random()*40)*K;
    d.style.left=(C+b.x-3)+'px'; d.style.top=(C+b.y-3)+'px';
    d.style.setProperty('--dx',(Math.cos(ang)*sp+v.x*60)+'px'); d.style.setProperty('--dy',(Math.sin(ang)*sp+v.y*60)+'px');
    layer.appendChild(d); setTimeout(()=>d.remove(),600);
  }
  sfx.pop(b); const entry=deleteMemo(b,'pop'); spawnShards(entry,b,v);
}
function wipe(b){sfx.wipe(); deleteMemo(b,'wipe','문질러 닦아냈어요')}
wrap.addEventListener('wheel',e=>{
  const p=loc(e); if(Math.hypot(p.x,p.y)>R||p.y<sedTopY()) return;
  e.preventDefault();
  const M=sedMetrics(), t=performance.now(); if(M.n<=M.vis||t-sedWheelT<140) return;
  sedWheelT=t; sedOff+=e.deltaY>0?1:-1; renderSed(); sfx.tick(sedOff);
},{passive:false});
function archive(b){
  sedOff=0;
  const m=b.m; m.status='archived'; m.archivedAt=now(); m.warm=false; save();
  b.sinkTo=R*0.9; removeBody(b,'sink',700); sfx.sink();
  record(()=>revive(m));
  setTimeout(()=>{renderSed(); updateFog()},350);
  buzz(12);
  toast('침전층으로 가라앉혔어요 · 바닥을 위로 쓸면 건질 수 있어요');
}
function revive(m){
  const list=archivedList(); m=m||list[list.length-1];
  if(!m){toast('침전층이 비어 있어요');return null}
  m.status='float'; m.touched=now(); save(); renderSed();
  const b=addBody(m,(Math.random()-.5)*R*.3,sedTopY()-30*K,'born');
  b.vy=-9; requestAnimationFrame(()=>requestAnimationFrame(()=>b.el.classList.remove('born'))); sfx.rise(m);
  record(()=>{const bb=bodies.get(m.id); if(bb&&!bb.dying) archive(bb)});
  updateFog(); return b;
}
function toggleWarm(b){
  if(b.m.status==='sealed'){toast(`봉인된 예언이에요 · ${fmtLong(b.m.sealUntil)}에 떠올라요`);return}
  b.m.warm=!b.m.warm; touchMemo(b); sfx.warm(b.m.warm,b);
  record(()=>{const bb=bodies.get(b.m.id); if(bb&&!bb.dying) toggleWarm(bb)}); buzz(b.m.warm?[10,40,10]:10);
  b.el.classList.remove('holding');
  toast(b.m.warm?'손의 온기로 데웠어요 · 흐려지지 않고 가운데 머물러요':'온기가 식었어요 · 이제 천천히 가라앉아요');
}
function merge(a,b){
  a.m.text=[a.m.text,b.m.text].filter(Boolean).join('\n');
  if(!a.m.img&&b.m.img) a.m.img=b.m.img;
  a.m.warm=a.m.warm||b.m.warm;
  { const seen=new Set();
    state.links=state.links.map(l=>l.map(x=>x===b.m.id?a.m.id:x)).filter(l=>{ if(l[0]===l[1]) return false; const k=linkKey(l[0],l[1]); if(seen.has(k)) return false; seen.add(k); return true }); }
  state.memos=state.memos.filter(x=>x!==b.m);
  b.vx=b.vy=0; b.sinkTo=null; removeBody(b,'absorb',420);
  b.el.style.transition='all .4s'; b.el.style.transform=`translate3d(${C+a.x-b.r}px,${C+a.y-b.r}px,0)`;
  fillBody(a); touchMemo(a); sfx.merge(a,b); a.el.classList.add('mergeTarget'); setTimeout(()=>a.el.classList.remove('mergeTarget'),450);
  buzz(15); toast('두 생각이 하나로 합쳐졌어요');
}
function seal(b,days){
  const m=b.m; m.status='sealed'; m.warm=false; m.sealUntil=now()+days*DAY; save();
  styleBody(b); updateFog(); buzz([8,30,8,30,8]); sfx.seal();
  toast(`${days}일 뒤, ${fmtLong(m.sealUntil)}에 떠오를 예언으로 봉인했어요`);
}
function shake(){
  for(const b of bodies.values()){ if(b.drag||b.dying)continue; b.vx+=(Math.random()-.5)*16; b.vy+=(Math.random()-.5)*16 }
  const arch=archivedList();
  const floats=[...bodies.values()].filter(b=>!b.dying&&b.m.status==='float'&&!b.m.warm).sort((a,b)=>a.m.touched-b.m.touched);
  let b=null;
  if(arch.length&&(Math.random()<.65||!floats.length)) b=revive(arch[Math.floor(Math.random()*arch.length)]);
  else if(floats.length) b=floats[0];
  buzz([20,30,20]); sfx.shake();
  if(!b){toast('구슬을 흔들었지만 떠오를 생각이 없어요');return}
  b.m.touched=now(); save();
  b.reveal=performance.now()+5000; styleBody(b); b.vy-=6;
  toast(`잊고 있던 생각이 떠올랐어요: "${short(b.m.text)}"`);
}
function passDay(){
  if(writing) commitWrite();
  state.offset+=1;
  const msgs=settle(); save();
  for(const b of bodies.values()) styleBody(b);
  renderSed(); updateFog(); updateDate();
  toast(msgs.length?msgs.join(' · '):'하루가 지났어요 · 손대지 않은 생각이 조금씩 흐려져요');
}
function settle(){
  const msgs=[]; let sunk=0;
  for(const m of state.memos){
    if(m.status==='sealed'&&m.sealUntil<=now()){
      m.status='float'; m.touched=now();
      const b=bodies.get(m.id); if(b){b.reveal=performance.now()+5000; styleBody(b); b.vy-=10}
      msgs.push(`예언이 떠올랐어요: "${short(m.text)}"`);
    } else if(m.status==='float'&&!m.warm&&ageOf(m)>=7){
      m.status='archived'; m.archivedAt=now(); sunk++;
      const b=bodies.get(m.id); if(b){b.sinkTo=R*.9; removeBody(b,'sink',700)}
    }
  }
  if(sunk) msgs.push(`오래 손대지 않은 생각 ${sunk}개가 침전층으로 내려갔어요`);
  return msgs;
}

/* ---------- writing on breath ---------- */
let writing=false, brCtx=null, stroke=null, hasInk=false, bbox=null;
const ink=document.createElement('canvas'); let inkCtx=null;
function enterWrite(p){
  writing=true; writeFocusPending=true; wrap.classList.add('writing'); breathC.classList.remove('fade');
  breathC.style.transformOrigin=`${C+p.x}px ${C+p.y}px`;
  brCtx=breathC.getContext('2d'); paintFog(brCtx,1.55,Math.floor(Math.random()*999));
  ink.width=S*dpr; ink.height=S*dpr; inkCtx=ink.getContext('2d'); inkCtx.setTransform(dpr,0,0,dpr,0,0);
  hasInk=false; bbox={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9};
  input.value=''; writeUI.hidden=false; emptyHint.hidden=true;
  buzz(15); sfx.breath();
  setTimeout(()=>{try{input.focus({preventScroll:true})}catch(e){}},60);
}
function strokeTo(p){
  const x=C+p.x, y=C+p.y, lx=C+stroke.last.x, ly=C+stroke.last.y;
  brCtx.save(); brCtx.globalCompositeOperation='destination-out'; brCtx.lineCap='round'; brCtx.lineJoin='round';
  brCtx.lineWidth=15*K; brCtx.beginPath(); brCtx.moveTo(lx,ly); brCtx.lineTo(x,y); brCtx.stroke(); brCtx.restore();
  inkCtx.strokeStyle='#6b3fe0'; inkCtx.lineCap='round'; inkCtx.lineJoin='round'; inkCtx.lineWidth=6*K;
  inkCtx.beginPath(); inkCtx.moveTo(lx,ly); inkCtx.lineTo(x,y); inkCtx.stroke();
  bbox.x0=Math.min(bbox.x0,x); bbox.y0=Math.min(bbox.y0,y); bbox.x1=Math.max(bbox.x1,x); bbox.y1=Math.max(bbox.y1,y);
  hasInk=true; stroke.last=p;
}
function leaveWrite(){
  writing=false; wrap.classList.remove('writing'); writeUI.hidden=true; try{input.blur()}catch(e){}
  breathC.classList.add('fade'); stroke=null;
}
function commitWrite(){
  if(!writing) return;
  const text=input.value.trim(); let img=null;
  if(hasInk&&bbox.x1-bbox.x0+bbox.y1-bbox.y0>12){
    const pad=8, x0=Math.max(0,bbox.x0-pad), y0=Math.max(0,bbox.y0-pad);
    const w=Math.min(S-x0,bbox.x1-bbox.x0+pad*2), h=Math.min(S-y0,bbox.y1-bbox.y0+pad*2);
    const sc=Math.min(1,160/Math.max(w,h)); const out=document.createElement('canvas');
    out.width=Math.max(1,Math.round(w*sc)); out.height=Math.max(1,Math.round(h*sc));
    out.getContext('2d').drawImage(ink,x0*dpr,y0*dpr,w*dpr,h*dpr,0,0,out.width,out.height);
    img=out.toDataURL('image/png');
  }
  const cx=hasInk?(bbox.x0+bbox.x1)/2-C:0, cy=hasInk?(bbox.y0+bbox.y1)/2-C:-R*.3;
  leaveWrite();
  if(!text&&!img){toast('김이 걷혔어요');updateFog();return}
  const m={id:state.nextId++,text,img,created:now(),touched:now(),warm:false,status:'float'};
  if(secretMode) m.secret=true;
  state.memos.push(m); save();
  const b=addBody(m,cx,cy,'born'); b.vy=-2;
  record(()=>{const bb=bodies.get(m.id); state.memos=state.memos.filter(x=>x!==m); state.links=state.links.filter(l=>!l.includes(m.id)); if(bb) removeBody(bb,'absorb',420)});
  requestAnimationFrame(()=>requestAnimationFrame(()=>b.el.classList.remove('born')));
  updateFog(); buzz(12); sfx.absorb();
  toast('생각이 구슬 속으로 스며들었어요');
}
function cancelWrite(){input.value=''; hasInk=false; commitWrite()}

/* ---------- the hidden orb: drawing three circles with the cursor (any size, anywhere) turns it green ---------- */
/* counts how far the cursor's direction keeps turning the same way; three full turns = three circles */
const swirl={hx:null,hy:null,head:null,turn:0,last:0,turns:0};
let swirlTouchOutside=false;
document.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'){ swirlTouchOutside=false; return }
  const r=wrap.getBoundingClientRect();
  swirlTouchOutside=Math.hypot(e.clientX-r.left-C,e.clientY-r.top-C)>R+6&&!(e.target.closest&&e.target.closest('.stand,#trash,#detail,button'));
  swirlReset();
},true);
document.addEventListener('pointerup',e=>{ if(e.pointerType==='touch'){ swirlTouchOutside=false; swirlReset() } },true);
function swirlReset(){ swirl.hx=swirl.hy=null; swirl.head=null; swirl.turn=0; swirl.turns=0; wrap.style.setProperty('--mix','0') }
document.addEventListener('pointermove',e=>{
  if(trashOpen||detailBody||exiting) return;
  /* mouse/trackpad: count only while not pressing. touch: count a finger that started on the empty space outside the orb */
  if(e.buttons&&!(e.pointerType==='touch'&&swirlTouchOutside)){ if(swirl.turn) swirlReset(); return }
  const t=performance.now();
  if(t-swirl.last>700&&swirl.hx!==null) swirlReset();
  swirl.last=t;
  if(swirl.hx===null){ swirl.hx=e.clientX; swirl.hy=e.clientY; return }
  const dx=e.clientX-swirl.hx, dy=e.clientY-swirl.hy;
  if(Math.hypot(dx,dy)<4) return;
  swirl.hx=e.clientX; swirl.hy=e.clientY;
  const h=Math.atan2(dy,dx);
  if(swirl.head!==null){
    let dh=h-swirl.head; if(dh>Math.PI)dh-=TAU; if(dh<-Math.PI)dh+=TAU;
    if(Math.abs(dh)>Math.PI*0.6){ swirl.head=h; return }
    if(swirl.turn&&Math.sign(dh)!==Math.sign(swirl.turn)&&Math.abs(dh)>0.3){ const hx=swirl.hx, hy=swirl.hy; swirlReset(); swirl.hx=hx; swirl.hy=hy; swirl.head=h; return }
    swirl.turn+=dh;
  }
  swirl.head=h;
  const turns=Math.abs(swirl.turn)/TAU;
  if(Math.floor(turns)>swirl.turns){ swirl.turns=Math.floor(turns); sfx.tick(swirl.turns+1) }
  wrap.style.setProperty('--mix',Math.max(0,Math.min(1,(turns-0.5)/2.5)).toFixed(3));
  if(turns>=3){ swirlReset(); if(secretMode) exitSecret(true); else enterSecret() }
});
function rebuildOrb(){ for(const grp of [...shardGroups]) clearShards(grp,false); hist.length=0; spawnAll(); renderSed(); updateFog() }
function enterSecret(){
  if(secretMode) return;
  /* the green orb opens in viewing mode, just like the violet one; text being written carries over */
  const keep=writing?input.value:'';
  if(writing){ hasInk=false; leaveWrite() }
  secretMode=true; wrap.classList.add('secret'); document.body.classList.add('secret'); rebuildOrb();
  if(keep){ enterWrite({x:0,y:-R*0.3}); input.value=keep }
  sfx.secret(true); buzz([10,40,10]);
}
/* writing in the green orb saves the memo but stays green, so the hidden memos can be read */
function commitSecret(){
  if(!secretMode) return false;
  const text=input.value.trim(); if(!text) return false;
  input.value='';
  const m={id:state.nextId++,text,img:null,created:now(),touched:now(),warm:false,status:'float',secret:true};
  state.memos.push(m); save();
  const b=addBody(m,0,-R*.3,'born'); b.vy=-2; requestAnimationFrame(()=>requestAnimationFrame(()=>b.el.classList.remove('born')));
  record(()=>{const bb=bodies.get(m.id); state.memos=state.memos.filter(x=>x!==m); state.links=state.links.filter(l=>!l.includes(m.id)); if(bb) removeBody(bb,'absorb',420)});
  sfx.absorb(); updateFog(); buzz(12);
  return true;
}
/* only drawing three circles again returns to the violet orb */
function exitSecret(keepText){
  if(!secretMode||exiting) return;
  let saved=false;
  if(writing){
    if(keepText&&(input.value.trim()||hasInk)){ commitWrite(); saved=true }
    else { input.value=''; hasInk=false; leaveWrite() }
  }
  const finish=()=>{ exiting=false; secretMode=false; wrap.classList.remove('secret'); document.body.classList.remove('secret'); rebuildOrb(); sfx.secret(false) };
  if(saved){ exiting=true; setTimeout(finish,1100) } else finish();
}
input.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229) return;
  if(e.key==='Enter'){e.preventDefault(); commitWrite()}
  if(e.key==='Escape'){e.preventDefault(); cancelWrite()}
});
document.addEventListener('pointerdown',e=>{
  if(writing&&!wrap.contains(e.target)) commitWrite();
},true);

/* ---------- gestures ---------- */
const ptrs=new Map(); let g=null, pinch=null, lastTap={id:null,t:0};
function loc(e){const r=wrap.getBoundingClientRect(); return {x:e.clientX-r.left-C, y:e.clientY-r.top-C, t:performance.now()}}
function velocity(samples){
  if(samples.length<2) return {x:0,y:0};
  const l=samples[samples.length-1]; let f=samples[0];
  for(const s of samples) if(l.t-s.t<=100){f=s;break}
  const dt=Math.max(8,l.t-f.t); return {x:(l.x-f.x)/dt, y:(l.y-f.y)/dt};
}
function nearest(p){let best=null,bd=1e9; for(const b of bodies.values()){if(b.dying)continue; const d=dist(b,p)-b.r; if(d<bd){bd=d;best=b}} return bd<60*K?best:null}
function overlapTarget(b){
  if(b.m.status==='sealed') return null;
  for(const o of bodies.values()){ if(o===b||o.dying||o.m.status==='sealed')continue; if(dist(o,b)<(o.r+b.r)*0.62) return o }
  return null;
}
function clearMarks(){for(const o of bodies.values()) o.el.classList.remove('mergeTarget'); sedEl.classList.remove('hot')}
function windings(path){
  if(path.length<14) return null;
  let best=null;
  for(const b of bodies.values()){
    if(b.dying||b.m.status==='sealed') continue;
    let sum=0, md=0, prev=Math.atan2(path[0].y-b.y,path[0].x-b.x);
    for(let i=1;i<path.length;i++){
      const a=Math.atan2(path[i].y-b.y,path[i].x-b.x); let d=a-prev;
      if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; sum+=d; prev=a;
      md+=Math.hypot(path[i].x-b.x,path[i].y-b.y);
    }
    md/=path.length-1; const w=Math.abs(sum);
    if(w>=5.3&&md>b.r*0.55&&md<b.r+120*K){
      if(!best||w>best.w||(w===best.w&&md<best.md)) best={b,w,md,days:Math.max(1,Math.round(w/TAU))};
    }
  }
  return best;
}
function cancelGesture(){
  if(!g) return; clearTimeout(g.hold);
  if(g.type==='bub'){g.b.drag=false; g.b.el.classList.remove('holding','dragging','rubbing','leaving')}
  g=null; sealHint.hidden=true; clearMarks();
}

wrap.addEventListener('pointerdown',e=>{
  if(!detail.hidden) return;
  if(writeUI.contains(e.target)) return;
  const p=loc(e); const inside=Math.hypot(p.x,p.y)<=R;
  if(writing){
    e.preventDefault();
    if(!inside){commitWrite();return}
    try{wrap.setPointerCapture(e.pointerId)}catch(_){}
    stroke={id:e.pointerId,last:p,p0:p}; strokeTo({x:p.x+.1,y:p.y+.1});
    return;
  }
  try{wrap.setPointerCapture(e.pointerId)}catch(_){}
  const bubEl=e.target.closest&&e.target.closest('.bub');
  ptrs.set(e.pointerId,{p0:p,p,target:bubEl?+bubEl.dataset.id:null});
  if(ptrs.size===2){
    cancelGesture();
    const [a,b]=[...ptrs.values()];
    pinch={d0:Math.max(10,dist(a.p,b.p)), same:(a.target&&a.target===b.target)?a.target:null, done:false};
    if(pinch.same){
      const bb=bodies.get(pinch.same); bb&&bb.el.classList.add('holding');
      pinch.timer=setTimeout(()=>{ if(!pinch||pinch.done||ptrs.size<2)return; const [a2,b2]=[...ptrs.values()];
        if(Math.abs(dist(a2.p,b2.p)/pinch.d0-1)<0.18&&bb){pinch.done=true; toggleWarm(bb)} },550);
    }
    return;
  }
  if(ptrs.size>2) return;
  const nl=inside?linkNear(p):-1;
  const shEl=e.target.closest&&e.target.closest('.crumbs');
  if(shEl&&shEl._grp&&shardGroups.has(shEl._grp)){
    const grp=shEl._grp; clearTimeout(grp.timer); grp.el.classList.remove('fade'); grp.el.classList.add('dragging');
    g={type:'shard',grp,p0:p,ox:grp.x-p.x,oy:grp.y-p.y,moved:false}; return;
  }
  if(nl>=0){g={type:'bg',p0:p,path:[p],moved:false,revs:[],lastDir:0,acc:0,hits:[],nearLink:nl,ang:Math.atan2(p.y,p.x),wind:0,rewound:0}; trail.push({...p,brk:true}); return}
  if(bubEl){
    const b=bodies.get(+bubEl.dataset.id); if(!b||b.dying){g=null;return}
    g={type:'bub',b,p0:p,off:{x:b.x-p.x,y:b.y-p.y},moved:false,samples:[p],rev:0,lastDir:0,acc:0};
    b.el.classList.add('holding');
    g.hold=setTimeout(()=>{ if(g&&g.type==='bub'&&!g.moved){g.held=true; toggleWarm(b)} },700);
    return;
  }
  if(!inside){g=null;return}
  if(p.y>sedTopY()){
    g={type:'sed',p0:p,moved:false,m:sedLayerAt(p.y)};
    if(g.m){const el=sedLayers.querySelector(`[data-id="${g.m.id}"]`); el&&el.classList.add('grab')}
    return;
  }
  g={type:'bg',p0:p,path:[p],moved:false,revs:[],lastDir:0,acc:0,hits:[],nearLink:linkNear(p),ang:Math.atan2(p.y,p.x),wind:0,rewound:0};
  trail.push({...p,brk:true});
  g.hold=setTimeout(()=>{ if(g&&g.type==='bg'&&!g.moved){const pp=g.p0; g=null; trail.length=0; enterWrite(pp)} },480);
});

wrap.addEventListener('pointermove',e=>{
  const p=loc(e);
  if(writing){ if(stroke&&e.pointerId===stroke.id) strokeTo(p); return }
  const pt=ptrs.get(e.pointerId); if(!pt) return; pt.p=p;
  if(pinch){
    if(ptrs.size===2&&!pinch.done){
      const [a,b]=[...ptrs.values()]; const r=dist(a.p,b.p)/pinch.d0;
      if(r>1.35){pinch.done=true; clearTimeout(pinch.timer);
        const mid={x:(a.p.x+b.p.x)/2,y:(a.p.y+b.p.y)/2};
        const nb=pinch.same?bodies.get(pinch.same):nearest(mid);
        if(nb) openDetail(nb); else toast('들여다볼 방울 위에서 손가락을 벌려 보세요');
      }
    }
    return;
  }
  if(!g) return;
  const moved=dist(p,g.p0);
  if(g.type==='shard'){ g.moved=true; g.grp.x=p.x+g.ox; g.grp.y=p.y+g.oy; placeShards(g.grp); return }
  if(g.type==='bub'){
    const b=g.b;
    if(!g.moved&&moved>7){g.moved=true; clearTimeout(g.hold); b.el.classList.remove('holding')}
    if(!g.moved) return;
    b.drag=true; b.el.classList.add('dragging');
    const prev=g.samples[g.samples.length-1];
    b.x=p.x+g.off.x; b.y=p.y+g.off.y; b.vx=b.vy=0;
    g.samples.push(p); if(g.samples.length>10) g.samples.shift();
    const dx=p.x-prev.x;
    if(Math.abs(dx)>1.2){const dir=Math.sign(dx); if(dir!==g.lastDir){ if(g.lastDir&&g.acc>5) g.rev++; g.acc=0; g.lastDir=dir } g.acc+=Math.abs(dx)}
    b.el.classList.toggle('rubbing',g.rev>=2&&dist(p,g.p0)<b.r*3);
    const out=Math.hypot(b.x,b.y)>R-b.r*0.3; b.el.classList.toggle('leaving',out);
    sedEl.classList.toggle('hot',!out&&b.m.status!=='sealed'&&b.y+b.r*0.3>sedTopY());
    return;
  }
  if(g.type==='sed'){
    if(moved>6) g.moved=true;
    if(!g.done&&p.y-g.p0.y<-45){g.done=true; const b=revive(g.m||undefined); if(b) toast(`"${short(b.m.text)}"을(를) 건져 올렸어요`)}
    return;
  }
  if(g.type==='bg'){
    const prev=g.path[g.path.length-1];
    g.path.push(p); if(g.path.length>500) g.path.shift();
    trail.push(p);
    { /* undo: while pressing, draw small counter-clockwise circles anywhere in the empty orb; one circle = one step back */
      if(g.lx===undefined){ g.lx=p.x; g.ly=p.y }
      const ddx=p.x-g.lx, ddy=p.y-g.ly;
      if(Math.hypot(ddx,ddy)>=3){
        g.lx=p.x; g.ly=p.y; const h=Math.atan2(ddy,ddx);
        if(g.head!==undefined){ let dh=h-g.head; if(dh>Math.PI)dh-=TAU; if(dh<-Math.PI)dh+=TAU; if(Math.abs(dh)<Math.PI*0.6) g.wind+=dh }
        g.head=h;
      }
      const steps=Math.floor(-g.wind/TAU);
      while(g.rewound<steps){
        g.rewound++; clearTimeout(g.hold); g.moved=true;
        const ok=undo(); sfx.rewind(ok);
        for(const bb of bodies.values()){ if(bb.dying||bb.drag) continue; bb.vx+=bb.y*0.03; bb.vy-=bb.x*0.03 }
      } }
    const hs=hitStar(p);
    if(hs&&!g.rewound&&g.hits[g.hits.length-1]!==hs){g.hits.push(hs); hs.el.classList.add('hit'); setTimeout(()=>hs.el.classList.remove('hit'),450); buzz(6); sfx.chime(hs,true)}
    if(!g.moved&&moved>10){g.moved=true; clearTimeout(g.hold)}
    const dx=p.x-prev.x;
    if(Math.abs(dx)>1){const dir=Math.sign(dx); if(dir!==g.lastDir){ if(g.lastDir&&g.acc>26) g.revs.push(p.t); g.acc=0; g.lastDir=dir } g.acc+=Math.abs(dx)}
    g.revs=g.revs.filter(t=>p.t-t<1100);
    /* shaking (zigzag) was removed */
  }
});

function release(e,cancelled){
  if(writing){
    clearTimeout(secretT); if(stroke&&e.pointerId===stroke.id) stroke=null;
    /* iPad/iPhone only open the keyboard during a real touch, so focus the input when the long-pressing finger lifts */
    if(writeFocusPending){ writeFocusPending=false; try{input.focus({preventScroll:true})}catch(_){} }
    return;
  }
  if(!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if(pinch){ if(ptrs.size===0){clearTimeout(pinch.timer); if(pinch.same){const bb=bodies.get(pinch.same); bb&&bb.el.classList.remove('holding')} pinch=null} return }
  if(!g) return;
  if(cancelled){cancelGesture();return}
  const p=loc(e); clearTimeout(g.hold);
  const G=g; g=null; sealHint.hidden=true; clearMarks();
  if(G.type==='shard'){
    const grp=G.grp; grp.el.classList.remove('dragging');
    if(Math.hypot(grp.x,grp.y)<R*0.92) restoreFromTrash(grp.entry,grp.x,grp.y); else armShards(grp,30000);
    return;
  }
  if(G.type==='bub'){
    const b=G.b; b.el.classList.remove('holding','dragging','rubbing','leaving');
    b.drag=false;
    if(!G.moved){
      if(G.held) return;
      const t=performance.now();
      b.vy-=1.2;
      return;
    }
    const v=velocity(G.samples);
    if(G.rev>=4&&dist(p,G.p0)<b.r*3){sfx.wipe(); b.vx=b.vy=0; touchMemo(b); openDetail(b);return}
    const d=Math.hypot(b.x,b.y), proj={x:b.x+v.x*220,y:b.y+v.y*220};
    if(d>R-b.r*0.3||(Math.hypot(v.x,v.y)>0.85&&Math.hypot(proj.x,proj.y)>R+10)){pop(b,v);return}
    if(b.m.status!=='sealed'&&b.y+b.r*0.3>sedTopY()){archive(b);return}
    b.vx=v.x*14; b.vy=v.y*14;
    if(b.m.status!=='sealed') touchMemo(b);
    return;
  }
  if(G.type==='sed'){ sedLayers.querySelectorAll('.grab').forEach(x=>x.classList.remove('grab')); if(!G.moved&&!G.done){const n=archivedList().length; toast(n?`침전층에 가라앉은 생각 ${n}개 · 위로 쓸어 올리면 건져요`:'침전층이 비어 있어요 · 방울을 바닥으로 끌어내리면 보관돼요')} return }
  if(G.type==='bg'){
    if(G.shook||G.rewound) return;
    if(!G.moved){ if(G.nearLink>=0){cutLinks([G.nearLink]);return} toast('빈 곳을 길게 누르면 김이 서려요');return}
    const ids=G.hits.map(b=>b.m.id);
    if(new Set(ids).size>=2){
      const n=addLinks(ids); if(n) sfx.chord(G.hits); for(const b of G.hits) if(!b.dying) touchMemo(b); buzz([8,25,8]);
      toast(n?`별 ${new Set(ids).size}개를 별자리로 이었어요`:'이미 이어져 있는 별이에요'); return;
    }
    const cut=crossedLinks(G.path);
    if(cut.length){
      let len=0; for(let i=1;i<G.path.length;i++) len+=dist(G.path[i],G.path[i-1]);
      const dur=Math.max(1,G.path[G.path.length-1].t-G.path[0].t);
      if(len/dur>0.55){cutLinks(cut);return}
    }
    const v=velocity(G.path.slice(-10)); const rr=p.x*p.x+p.y*p.y||1;
    const omega=(p.x*v.y-p.y*v.x)/rr; const k=Math.max(-.12,Math.min(.12,omega*16*0.9));
    for(const b of bodies.values()){ if(b.dying)continue; b.vx+=-b.y*k; b.vy+=b.x*k }
  }
}
wrap.addEventListener('pointerup',e=>release(e,false));
wrap.addEventListener('pointercancel',e=>release(e,true));
wrap.addEventListener('contextmenu',e=>e.preventDefault());
/* while writing, the browser's own tap/click follow-ups must not pull focus away from the input */
wrap.addEventListener('mousedown',e=>{ if(writing&&e.target!==input) e.preventDefault() });
wrap.addEventListener('touchend',e=>{ if(writing&&e.target!==input&&e.cancelable) e.preventDefault() },{passive:false});

/* lantern: the cursor or finger is a small light; only nearby stars bloom into words */
const lamp={x:0,y:0,on:false,a:0}, lampEl=$('#lamp'); let lampT;
function lampAt(p,on){lamp.x=p.x; lamp.y=p.y; lamp.on=on&&Math.hypot(p.x,p.y)<=R}
function updateLamp(t,f,arr){
  lamp.a+=((lamp.on&&!writing?1:0)-lamp.a)*Math.min(1,0.14*f);
  const LR=R*0.42;
  lampEl.style.width=lampEl.style.height=(LR*2)+'px';
  lampEl.style.transform=`translate(${C+lamp.x-LR}px,${C+lamp.y-LR}px)`;
  lampEl.style.opacity=lamp.a.toFixed(3);
  /* inside the clear window around the cursor memos are fully sharp; elsewhere in the orb only a little */
  const HR=LR*1.15, nearOf=(x,y)=>Math.max(0,Math.min(1,(HR-Math.hypot(x-lamp.x,y-lamp.y))/(HR*0.45)));
  const clarity=(x,y)=>lamp.a*(0.42+0.58*nearOf(x,y));
  { const M=sedMetrics(); [...sedLayers.children].forEach((el,i)=>{
      const ym=M.top+i*M.lh+M.lh/2, half=Math.sqrt(Math.max(0,R*R-ym*ym)), xn=Math.max(-half,Math.min(half,lamp.x));
      el.style.setProperty('--sl',clarity(xn,ym).toFixed(3)) }) }
  fogC.style.setProperty('--lx',(C+lamp.x)+'px'); fogC.style.setProperty('--ly',(C+lamp.y)+'px');
  fogC.style.setProperty('--lr',(LR*1.15*lamp.a).toFixed(1)+'px');
  for(const b of arr){
    if(b.dying) continue;
    const forced=b.drag||b.reveal>t||b===detailBody||b.el.classList.contains('holding');
    const d=Math.hypot(b.x-lamp.x,b.y-lamp.y);
    const tgt=forced?1:clarity(b.x,b.y);
    const prev=b.lit; b.lit+=(tgt-b.lit)*Math.min(1,0.2*f);
    const near=lamp.on&&!forced&&d<Math.max(b.r*0.7,24*K);
    if(near&&!b.near&&b.m.status!=='sealed') sfx.chime(b); b.near=near;
    if(Math.abs(b.lit-b.litShown)>0.008){b.litShown=b.lit; b.el.style.setProperty('--lit',b.lit.toFixed(3))}
  }
}
wrap.addEventListener('pointermove',e=>{
  const p=loc(e);
  if(e.pointerType==='touch'){ if(ptrs.size) lampAt(p,true); return }
  lampAt(p,true);
  if(writing||g||pinch){ if(hoverLink>=0){hoverLink=-1; wrap.classList.remove('cutting')} return }
  const be=e.target.closest&&e.target.closest('.bub');
  const i=linkNear(p);
  if(i!==hoverLink){hoverLink=i; wrap.classList.toggle('cutting',i>=0)}
  const comp=be?component(+be.dataset.id):null; kin=comp&&comp.size>1?comp:null;
});
wrap.addEventListener('pointerleave',e=>{ if(e.pointerType!=='touch'){ lamp.on=false; hoverLink=-1; kin=null; wrap.classList.remove('cutting') } });
wrap.addEventListener('pointerdown',e=>{ sfx.unlock(); clearTimeout(lampT); lampAt(loc(e),true) });
wrap.addEventListener('pointerup',e=>{ if(e.pointerType==='touch'){ clearTimeout(lampT); lampT=setTimeout(()=>{ if(!ptrs.size) lamp.on=false },900) } });

/* real device shake, when the browser allows it */
let lastShake=0;
window.addEventListener('devicemotion',e=>{
  const a=e.accelerationIncludingGravity; if(!a) return;
  const m=Math.hypot(a.x||0,a.y||0,a.z||0);
  /* device shake no longer surfaces memos */
});

/* ---------- detail (look closer) ---------- */
let detailBody=null, dPtrs=new Map(), dPinch=0;
function openDetail(b){
  if(b.m.status==='sealed'){toast(`봉인된 예언이에요 · ${fmtLong(b.m.sealUntil)}에 떠올라요`);return}
  cancelGesture(); ptrs.clear(); pinch=null;
  detailBody=b; dText.value=b.m.text||'';
  dImg.hidden=!b.m.img; if(b.m.img) dImg.src=b.m.img;
  const a=ageOf(b.m);
  dMeta.textContent=`${fmtLong(b.m.created)}에 씀`;
  detail.hidden=false; requestAnimationFrame(()=>detail.classList.add('on'));
}
function closeDetail(){
  if(!detailBody) return;
  const b=detailBody; detailBody=null;
  const t=dText.value.trim();
  if(t!==(b.m.text||'')){const old=b.m.text; b.m.text=t; fillBody(b); record(()=>{b.m.text=old; fillBody(b)})}
  if(!b.dying) touchMemo(b);
  detail.classList.remove('on'); setTimeout(()=>{detail.hidden=true},260);
  try{dText.blur()}catch(e){}
}
detail.addEventListener('pointerdown',e=>{
  dPtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(dPtrs.size===2){const [a,b]=[...dPtrs.values()]; dPinch=Math.hypot(a.x-b.x,a.y-b.y)}
  else if(e.target===detail) closeDetail();
});
detail.addEventListener('pointermove',e=>{
  if(!dPtrs.has(e.pointerId)) return; dPtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(dPtrs.size===2&&dPinch){const [a,b]=[...dPtrs.values()]; if(Math.hypot(a.x-b.x,a.y-b.y)/dPinch<0.7){dPinch=0; closeDetail()}}
});
['pointerup','pointercancel'].forEach(t=>detail.addEventListener(t,e=>{dPtrs.delete(e.pointerId); if(dPtrs.size<2) dPinch=0}));

/* ---------- chrome ---------- */
$('#dayBtn').onclick=passDay;
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if(trashOpen) closeTrash(); else if(detailBody) closeDetail();  else if(writing) cancelWrite() }
  if((e.key==='m'||e.key==='M')&&document.activeElement!==input&&document.activeElement!==dText) sfx.toggle();
});


/* ---------- trash screen: knock the stand five times ---------- */
const trashEl=$('#trash'), standEl=$('.stand'); let knocks=[], trashOpen=false, tg=null;
standEl.addEventListener('pointerdown',e=>{
  sfx.unlock(); const t=performance.now(); knocks=knocks.filter(k=>t-k<2600); knocks.push(t);
  standEl.classList.remove('knock'); void standEl.offsetWidth; standEl.classList.add('knock'); setTimeout(()=>standEl.classList.remove('knock'),90);
  sfx.knock(knocks.length); buzz(8);
  if(knocks.length>=5){knocks=[]; openTrash(); return}
  try{standEl.setPointerCapture(e.pointerId)}catch(_){}
  hold.start=t; hold.knockUndone=false; hold.sec=0; hold.down=true;
  cancelAnimationFrame(hold.raf); hold.raf=requestAnimationFrame(holdTick);
});
/* ---------- hold the stand for 5 seconds to empty the orb ---------- */
const hold={start:0,raf:0,knockUndone:false,sec:0,down:false};
/* p 0→1: lower slab, upper slab, then the whole orb from bottom to top */
const clamp01=v=>Math.max(0,Math.min(1,v));
function setCharge(p){
  standEl.style.setProperty('--p1',clamp01(p/0.175).toFixed(3));
  standEl.style.setProperty('--p2',clamp01((p-0.175)/0.175).toFixed(3));
  wrap.style.setProperty('--p3',clamp01((p-0.35)/0.65).toFixed(3));
}
function drainCharge(){ const f=$('#fill'); f.classList.add('drain'); setCharge(0); setTimeout(()=>f.classList.remove('drain'),750) }
function holdTick(){
  if(!hold.start) return;
  const el=performance.now()-hold.start;
  if(el>300&&!hold.knockUndone){ hold.knockUndone=true; knocks.pop() }   /* a long press is not a knock */
  const p=clamp01((el-300)/8000); setCharge(p);
  const s=Math.floor(el/1000); if(s>hold.sec){ hold.sec=s; sfx.tick(s+2); buzz(6) }
  if(p>=1){ hold.start=0; resetOrb(); drainCharge(); return }
  hold.raf=requestAnimationFrame(holdTick);
}
function holdCancel(){
  hold.down=false;
  if(!hold.start) return; hold.start=0; cancelAnimationFrame(hold.raf); drainCharge();
}
['pointerup','pointercancel','lostpointercapture'].forEach(t=>standEl.addEventListener(t,holdCancel));
function resetOrb(){
  const mine=m=>m&&!!m.secret===secretMode;
  const goneMemos=state.memos.filter(mine), goneTrash=state.trash.filter(t=>mine(t.m));
  const ids=new Set([...goneMemos.map(m=>m.id),...goneTrash.map(t=>t.m.id)]);
  const goneLinks=state.links.filter(l=>ids.has(l[0])||ids.has(l[1]));
  state.memos=state.memos.filter(m=>!mine(m)); state.trash=state.trash.filter(t=>!mine(t.m)); state.links=state.links.filter(l=>!ids.has(l[0])&&!ids.has(l[1]));
  if(writing){ input.value=''; hasInk=false; leaveWrite() }
  for(const b of bodies.values()) if(!b.dying) removeBody(b,'absorb',420);
  for(const grp of [...shardGroups]) clearShards(grp,false);
  hist.length=0; save(); renderSed(); updateFog();
  /* rewinding right after can bring everything back */
  record(()=>{ state.memos.push(...goneMemos); state.trash.push(...goneTrash); state.links.push(...goneLinks); spawnAll(); renderSed(); updateFog() });
  wrap.classList.add('flash'); setTimeout(()=>wrap.classList.remove('flash'),700);
  sfx.reset(); buzz([30,60,30]);
}
function standPoint(){const r=standEl.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}}
function openTrash(){
  if(trashOpen) return; trashOpen=true; if(writing) commitWrite();
  trashEl.innerHTML=''; trashEl.hidden=false;
  const W=innerWidth, H=innerHeight, sp=standPoint(), placed=[];
  state.trash.filter(t=>!!t.m.secret===secretMode).forEach((entry,i)=>{
    const el=document.createElement('div'); el.className='tmemo';
    if(entry.m.img){const im=new Image(); im.src=entry.m.img; im.alt=''; im.draggable=false; el.appendChild(im)}
    if(entry.m.text){const s=document.createElement('span'); s.textContent=entry.m.text; el.appendChild(s)}
    trashEl.appendChild(el);
    const w=el.offsetWidth, h=el.offsetHeight; let x=0,y=0,ok=false;
    for(let k=0;k<90&&!ok;k++){ x=W*0.06+Math.random()*Math.max(1,W*0.88-w); y=H*0.08+Math.random()*Math.max(1,H*0.66-h);
      ok=placed.every(r=>x+w<r.x-12||x>r.x+r.w+12||y+h<r.y-10||y>r.y+r.h+10) }
    placed.push({x,y,w,h}); el._home={x,y}; el._entry=entry;
    el.style.opacity='0'; el.style.transform=`translate(${sp.x-w/2}px,${sp.y-h/2}px) scale(.3)`;
    setTimeout(()=>{ if(!trashOpen) return; el.style.opacity='1'; el.style.transform=`translate(${x}px,${y}px) rotate(${((Math.random()-.5)*8).toFixed(1)}deg)`; if(i<12) sfx.tick(i) }, 60+i*55);
  });
  requestAnimationFrame(()=>trashEl.classList.add('on'));
  sfx.rush();
}
function closeTrash(){
  if(!trashOpen) return; trashOpen=false; tg=null;
  const sp=standPoint();
  [...trashEl.children].forEach((el,i)=>setTimeout(()=>{ el.style.opacity='0'; el.style.transform=`translate(${sp.x-el.offsetWidth/2}px,${sp.y}px) scale(.3)` }, i*25));
  trashEl.classList.remove('on');
  setTimeout(()=>{ if(!trashOpen){trashEl.hidden=true; trashEl.innerHTML=''} },750);
}
trashEl.addEventListener('pointerdown',e=>{
  const el=e.target.closest('.tmemo');
  if(!el){closeTrash(); return}
  try{trashEl.setPointerCapture(e.pointerId)}catch(_){}
  const r=el.getBoundingClientRect();
  tg={el,id:e.pointerId,ox:e.clientX-r.left,oy:e.clientY-r.top,sx:e.clientX,sy:e.clientY,moved:false,samples:[{x:e.clientX,y:e.clientY,t:performance.now()}]};
  el.classList.add('dragging');
});
trashEl.addEventListener('pointermove',e=>{
  if(!tg||e.pointerId!==tg.id) return;
  if(Math.hypot(e.clientX-tg.sx,e.clientY-tg.sy)>4) tg.moved=true;
  tg.samples.push({x:e.clientX,y:e.clientY,t:performance.now()}); if(tg.samples.length>8) tg.samples.shift();
  tg.el.style.transform=`translate(${e.clientX-tg.ox}px,${e.clientY-tg.oy}px)`;
});
function trashUp(e){
  if(!tg||e.pointerId!==tg.id) return;
  const el=tg.el, moved=tg.moved, v=velocity(tg.samples), ox=tg.ox, oy=tg.oy; tg=null; el.classList.remove('dragging');
  /* moving a memo only moves it; it is gone for good only when thrown off the screen */
  const px=e.clientX+v.x*600, py=e.clientY+v.y*600; /* where the memo would fly to if let go */
  const offScreen=px<-20||py<-20||px>innerWidth+20||py>innerHeight+20;
  const edge=e.clientX<10||e.clientY<10||e.clientX>innerWidth-10||e.clientY>innerHeight-10;
  const left=()=>state.trash.some(t=>!!t.m.secret===secretMode);
  if(moved&&((Math.hypot(v.x,v.y)>1.2&&offScreen)||edge)){
    shatterForever(el,e.clientX,e.clientY,v);
    if(!left()) setTimeout(closeTrash,700);
  } else if(moved){
    el._home={x:e.clientX-ox, y:e.clientY-oy};
  } else el.style.transform=`translate(${el._home.x}px,${el._home.y}px)`;
}
function shatterForever(el,cx,cy,v){
  const i=state.trash.indexOf(el._entry); if(i>=0){ state.trash.splice(i,1); save() }
  for(let k=0;k<18;k++){
    const d=document.createElement('span'); d.className='drop dust';
    const a=Math.random()*TAU, sp=30+Math.random()*70;
    d.style.left=(cx-2)+'px'; d.style.top=(cy-2)+'px';
    d.style.setProperty('--dx',(Math.cos(a)*sp+v.x*90).toFixed(1)+'px'); d.style.setProperty('--dy',(Math.sin(a)*sp+v.y*90).toFixed(1)+'px');
    trashEl.appendChild(d); setTimeout(()=>d.remove(),650);
  }
  el.style.transition='opacity .18s, transform .18s'; el.style.opacity='0'; el.style.transform+=' scale(1.4)';
  setTimeout(()=>el.remove(),220);
  sfx.shatter(); buzz(25);
}
trashEl.addEventListener('pointerup',trashUp);
trashEl.addEventListener('pointercancel',trashUp);

/* ---------- boot ---------- */
measure();
const bootMsgs=settle(); save();
spawnAll(); renderSed(); updateFog(); updateDate();
if(bootMsgs.length) setTimeout(()=>toast(bootMsgs.join(' · ')),600);
new ResizeObserver(()=>measure()).observe(wrap);
setInterval(()=>{for(const b of bodies.values()) if(!b.dying) styleBody(b); updateFog(); updateDate()},30000);
requestAnimationFrame(t=>{last=t; tick(t)});
})();
