/* Zen trainer: every puzzle is trained with a chosen method, step by step, each step graded against its exact standard */
"use strict";
const ZEN=(function(){
  const KEYS=["3x2","3x3","4x3","4x4"];
  const DEFAULT={"3x2":"opt","3x3":"opt","4x3":"col","4x4":"pairs"};
  const PER=10;                        // cases per 3x3 depth in the depth-by-depth progression
  const STEPS=[3,8,25,"break"];        // after a miss: standard again after 3, 8, 25 solves, then after an 8 h break
  const BREAK_MS=8*3600e3;
  const ui=Object.assign({tab:"3x2",pre:true,hover:true,timer:true,buf:1,pace:"auto",size:{}},store.get("ssa-ui-v3")||{});
  if(!ui.hv1){ui.hover=true;ui.hv1=1}   // hover became the default; switch it on once for earlier visitors
  ui.meth=ui.meth||{};ui.rng=ui.rng||{};ui.custom=ui.custom||{};
  KEYS.forEach(k=>{if(!ui.size[k])ui.size[k]=80});
  const saveUI=()=>store.set("ssa-ui-v3",ui);
  const $=id=>document.getElementById(id);
  const root=$("zen"),stage=$("zStage"),boardEl=$("zBoard"),lockEl=$("zLock"),tagEl=$("zTag"),targetEl=$("zTarget"),subEl=$("zSub"),fbEl=$("zFb"),seqEl=$("zSeq"),barEl=$("zBar"),progEl=$("zProg"),panel=$("zPanel");

  /* ---------- per-puzzle data (exact tables for the classic progression) ---------- */
  const Z={};
  function loadClassic(key){let p=store.get("ssa-v3-"+key);
    if(!p){p={clock:0,mastered:{},cards:{},src:"auto"};
      const old=store.get("ssa-prog-v1-"+key);
      if(old){Object.assign(p.mastered,old.mastered||{});if(old.src)p.src=old.src;(old.review||[]).forEach(r=>{p.cards[r.k]={step:0,due:0,n:r.n||1}})}}
    p.cards=p.cards||{};p.mastered=p.mastered||{};p.clock=p.clock||0;
    if(typeof p.src==="string"&&p.src.startsWith("d:")){const i=+p.src.slice(2);ui.rng[key+":opt"]=[i,i];p.src="random";saveUI()}
    if(p.src!=="auto"&&p.src!=="random")p.src="auto";
    return p}
  function data(key){if(!Z[key]){const P=PUZ[key];Z[key]={key,P,exact:!!P.exact,classic:P.exact?loadClassic(key):null,byDepth:null,order:null,mcount:null,skip:new Set(),ms:{}}}return Z[key]}
  function prepExact(d){if(!d.exact||d.byDepth)return;const T=table(d.key);d.byDepth=Array.from({length:T.max+1},()=>[]);
    for(const [k,v] of T.dist){if(v===0)continue;if(redundantExact(d.key,[...k].map(Number))){d.skip.add(k);continue}d.byDepth[v].push(k)}
    const p=d.classic;let pruned=false;for(const k in p.cards)if(d.skip.has(k)){delete p.cards[k];pruned=true}if(pruned)store.set("ssa-v3-"+d.key,p);
    if(d.key==="3x2"){d.order=[];for(let i=1;i<d.byDepth.length;i++)d.order.push(...d.byDepth[i].slice().sort((a,b)=>strHash(a)-strHash(b)))}
    recount(d)}
  function recount(d){if(!d.byDepth)return;const T=table(d.key);d.mcount=d.byDepth.map(()=>0);for(const k in d.classic.mastered){const v=T.dist.get(k);if(v&&!d.skip.has(k))d.mcount[v]++}}

  /* ---------- method state: progress, history and review cards per puzzle + method ---------- */
  const PARSED={};
  const parsed=(key,c)=>{const id=key+"|"+c;if(!(id in PARSED)){try{PARSED[id]=METHODS.parse(key,c)}catch(e){PARSED[id]=null}}return PARSED[id]};
  const methods=key=>METHODS.list(key,(ui.custom[key]||[]).map(c=>parsed(key,c)).filter(Boolean));
  function curMethod(key){const L=methods(key),id=ui.meth[key]||DEFAULT[key];return L.find(m=>m.id===id)||L.find(m=>m.id===DEFAULT[key])||L[0]}
  function mstate(d,M){if(d.ms[M.id])return d.ms[M.id];const classic=M.id==="opt"&&d.exact;
    const pk=classic?"ssa-v3-"+d.key:"ssa-m-"+d.key+"-"+M.id,hk=classic?"ssa3-"+d.key:"ssa4-"+d.key+"-"+M.id;
    let prog=classic?d.classic:store.get(pk);if(!prog)prog={clock:0,cards:{}};prog.cards=prog.cards||{};prog.clock=prog.clock||0;
    const sep=classic?"":",";
    return d.ms[M.id]={d,M,classic,pk,hk,prog,drill:null,lastK:null,ready:false,
      kof:b=>b.join(sep),fromKey:k=>classic?[...k].map(Number):k.split(",").map(Number)}}
  const save=S=>store.set(S.pk,S.prog);
  const hist=S=>store.get(S.hk)||[];
  function first(S){return METHODS.resolve(S.d.key,S.M.steps[0],[])}
  function depthOf(S,b){return first(S).f(b)}
  function range(S){const inf=METHODS.depthInfo(S.d.key,S.M),r=ui.rng[S.d.key+":"+S.M.id]||[1,inf.max];return[Math.max(1,Math.min(r[0],inf.max)),Math.max(1,Math.min(r[1],inf.max))]}
  /* Build every table the method needs (one dry run through its steps). */
  function prepare(S){if(S.ready)return;const key=S.d.key;if(S.classic)prepExact(S.d);
    let walls=[];
    for(const sp of S.M.steps){const R=METHODS.resolve(key,sp,walls),b=METHODS.fillBoard(key,walls,null);if(b)METHODS.standard(key,R,walls,b);
      R.alts.forEach(a=>{const w2=walls.concat(a.map(METHODS.home));if(sp.la)METHODS.resolve(key,sp.la.next,w2)});
      if(sp.prefix||R.rest)break;walls=walls.concat(R.alts[0].map(METHODS.home))}
    S.ready=true}

  /* ---------- classic progression (full 3x2 / 3x3 optimal) ---------- */
  function learnCounts(S){const c={};for(const k in S.prog.cards){const v=S.prog.cards[k].d;if(v!=null)c[v]=(c[v]||0)+1}return c}
  function classicSrc(S){const d=S.d;if(d.key==="3x2")return "ord";
    const lc=learnCounts(S);for(let i=1;i<d.byDepth.length;i++)if(d.mcount[i]+(lc[i]||0)<Math.min(d.byDepth[i].length,PER))return "d:"+i;return null}
  function classicProgress(S){const d=S.d,p=S.prog;
    if(d.key==="3x2"){const m=Object.keys(p.mastered).length;return{f:m/359,txt:m>=359?"all 359 solved optimally":`${m} / 359 solved optimally`}}
    let a=0,t=0;for(let i=1;i<d.byDepth.length;i++){const tg=Math.min(d.byDepth[i].length,PER);t+=tg;a+=Math.min(d.mcount[i],tg)}
    const s=classicSrc(S);return{f:a/t,txt:`${a} / ${t} cases · ${s?"depth "+s.slice(2):"all depths done · random states"}`}}
  function classicItem(S){const d=S.d,p=S.prog,s=classicSrc(S);if(!s)return null;let k;
    if(s==="ord"){k=d.order.find(x=>!p.mastered[x]&&!p.cards[x]);if(!k)return null}
    else{const arr=d.byDepth[+s.slice(2)]||[],un=arr.filter(x=>!p.mastered[x]&&!p.cards[x]),pool=un.length?un:arr;if(!pool.length)return null;k=pool[Math.floor(Math.random()*pool.length)]}
    const b=S.fromKey(k),dep=table(d.key).dist.get(k);return{b,depth:dep,isNew:!p.mastered[k],label:"depth "+dep+(p.mastered[k]?" · already solved":"")}}

  /* ---------- picking scrambles ---------- */
  function randomItem(S){const d=S.d,[lo,hi]=range(S);let b=null;
    if(S.classic){let tot=0;for(let i=lo;i<=hi;i++)tot+=(d.byDepth[i]||[]).length;
      if(tot){let r=Math.floor(Math.random()*tot);for(let i=lo;i<=hi;i++){const a=d.byDepth[i]||[];if(r<a.length){b=S.fromKey(a[r]);break}r-=a.length}}}
    else b=METHODS.sampleFirst(d.key,first(S),lo,hi);
    if(!b)b=METHODS.fillBoard(d.key,[],null);
    const dep=depthOf(S,b),full=lo===1&&hi===METHODS.depthInfo(d.key,S.M).max;
    return{b,depth:dep,isNew:S.classic?!S.prog.mastered[S.kof(b)]:true,label:(full?"random":"depth "+(lo===hi?lo:lo+"–"+hi))+" · depth "+dep}}
  function cardItem(S,k){const c=S.prog.cards[k],b=S.fromKey(k);return{b,card:k,depth:depthOf(S,b),label:`review · ${c.step} of ${STEPS.length} done · depth ${depthOf(S,b)}`}}
  function pick(S){if(S.drill)return drillPick(S);const p=S.prog,now=Date.now();let best=null;
    for(const k in p.cards){const c=p.cards[k];if(k===S.lastK)continue;if(c.due<=p.clock&&(c.dueT||0)<=now&&(!best||c.due<p.cards[best].due))best=k}
    if(best)return cardItem(S,best);
    if(S.classic&&p.src==="auto"){const it=classicItem(S);if(it)return it}
    return randomItem(S)}

  /* ---------- review drill: only cases in review, until each meets the standard DRILL times in a row ---------- */
  const DRILL=2;
  function drillLeft(S){return Object.keys(S.prog.cards).filter(k=>(S.drill.streak[k]||0)<DRILL)}
  function drillPick(S){const ks=drillLeft(S);if(!ks.length)return null;
    const pool=ks.length>1?ks.filter(k=>k!==S.lastK):ks,lo=Math.min(...pool.map(k=>S.drill.streak[k]||0)),c=pool.filter(k=>(S.drill.streak[k]||0)===lo);
    const k=c[Math.floor(Math.random()*c.length)],it=cardItem(S,k);it.label=`drill · ${S.drill.streak[k]||0} of ${DRILL} in a row · depth ${it.depth}`;return it}
  /* Drill solves leave the spaced-repetition schedule untouched. */
  function drillJudge(S,it,hit){const k=S.kof(it.b),st=S.drill.streak;
    if(hit){st[k]=(st[k]||0)+1;return st[k]>=DRILL?"drilled · out of this drill":`${DRILL-st[k]} more in a row`}
    st[k]=0;return "streak reset"}
  function setDrill(on){const S=C.S;if(!S)return;S.drill=on?{streak:{}}:null;closePanel();drillUI();progUI();next()}
  function drillUI(){const b=$("zDrill"),S=C.S;if(!b||!S)return;const n=Object.keys(S.prog.cards).length;
    b.innerHTML=S.drill?'Back<span class="zl"> to training</span>':`Drill<span class="zl"> reviews</span>${n?` (${n})`:""}`;b.setAttribute("aria-pressed",S.drill?"true":"false");b.classList.toggle("on",!!S.drill);
    b.disabled=!S.drill&&!n;b.title=S.drill?"Return to normal training":n?"Practice only the cases in review":"No cases in review yet"}
  function drillDone(){const S=C.S,n=Object.keys(S.prog.cards).length;C.phase="done";C.it=null;C.R=null;C.b=goal(C.d.P.w*C.d.P.h);render();boardCls("good");lockAnim(0);boardEl.classList.remove("locked");
    targetEl.innerHTML=n?`<b>${n}</b> review case${n>1?"s":""} drilled`:"nothing in review";tagEl.textContent="";subEl.textContent="";seqEl.innerHTML="";
    fb(`<b class="z-ok">✓ ${n?"every review case met the standard "+DRILL+" times in a row":"no cases left in review"}</b><div class="z-btns">${n?'<button class="z-link" data-z="drill">drill again</button>':""}<button class="z-link" data-z="exit">back to training</button></div>`)}

  /* ---------- spaced repetition ---------- */
  function sched(p,c){const s=STEPS[c.step];if(s==="break"){c.due=p.clock+5;c.dueT=Date.now()+BREAK_MS}else{c.due=p.clock+s;c.dueT=0}}
  function judge(S,it,hit){const p=S.prog;p.clock++;const k=S.kof(it.b);let c=p.cards[k],note="";
    const master=()=>{if(S.classic){p.mastered[k]=1;recount(S.d)}};
    if(c){if(hit){c.step++;if(c.step>=STEPS.length){delete p.cards[k];master();note="learned · leaves the pool"}
        else{sched(p,c);note=c.dueT?"next review after an 8 h break":`review ${c.step} of ${STEPS.length} · next in ${c.due-p.clock} solves`}}
      else{c.step=0;c.n++;delete c.dueT;sched(p,c);note="back in 3 solves"}}
    else if(hit){if(it.isNew!==false)master()}
    else{c=p.cards[k]={step:0,n:1};if(it.depth!=null)c.d=it.depth;sched(p,c);note="back in 3 solves";
      const ks=Object.keys(p.cards);if(ks.length>400)delete p.cards[ks[0]]}
    save(S);return note}

  /* ---------- current solve ---------- */
  const C={key:null,d:null,S:null,it:null,b:null,moves:0,t0:0,running:false,phase:"idle",lockUntil:0,timers:[],cells:[],rv:null,
    si:0,walls:[],R:null,sb:null,sp:"",std:null,dcur:0,res:[]};
  const clearTimers=()=>{C.timers.forEach(clearTimeout);C.timers=[]};
  const later=(fn,ms)=>{C.timers.push(setTimeout(fn,ms))};
  function buildCells(){const P=C.d.P;boardEl.innerHTML="";boardEl.style.gridTemplateColumns=`repeat(${P.w},auto)`;C.cells=[];
    for(let i=0;i<P.w*P.h;i++){const t=document.createElement("button");t.type="button";t.tabIndex=-1;
      t.addEventListener("pointerdown",e=>{e.preventDefault();closePanel();toCell(i)});
      t.addEventListener("pointerenter",e=>{if(ui.hover&&e.pointerType==="mouse")toCell(i)});
      boardEl.appendChild(t);C.cells.push(t)}}
  // touch/pen: dragging a finger across the board moves the gap to the tile under it (hover mode)
  boardEl.addEventListener("pointermove",e=>{if(!ui.hover||e.pointerType==="mouse"||!C.cells.length)return;
    const el=document.elementFromPoint(e.clientX,e.clientY),i=el?C.cells.indexOf(el.closest&&el.closest(".tile")):-1;if(i>=0)toCell(i)});
  /* tiles outside the current step are greyed; tiles placed by earlier steps keep their colour */
  function render(b,R,walls){b=b||C.b;R=R===undefined?C.R:R;walls=walls||C.walls;const P=C.d.P,act=R?new Set(R.tiles):null,fz=new Set(walls.map(c=>c+1));
    b.forEach((v,i)=>{const t=C.cells[i];if(!t)return;
      if(!v){t.className="tile blank";t.textContent="";t.setAttribute("aria-label","gap");return}
      const l=P.labels[v-1],grey=act&&!act.has(v)&&!fz.has(v);t.className="tile "+(grey?"gr":sgrp(l))+(fz.has(v)&&act?" fz":"");t.textContent=l;t.removeAttribute("aria-label")})}
  const boardCls=c=>{boardEl.classList.remove("good","bad","dim");if(c)boardEl.classList.add(c)};
  function layout(){if(!C.d)return;const P=C.d.P,fs=isFS();
    const W=(root.clientWidth||Math.min(window.innerWidth,1000))-40;
    const H=fs?window.innerHeight-230:Math.min(700,window.innerHeight-150)-230;
    const fit=Math.min(W/(P.w+.3),Math.max(160,H)/(P.h+.3),fs?230:150);
    boardEl.style.setProperty("--t",Math.max(28,Math.round(fit*ui.size[C.key]/100))+"px")}
  const multi=()=>C.S&&C.S.M.steps.length>1;
  /* name of what is left once `placed` cells are filled */
  function restName(key,placed){const n=PUZ[key].w*PUZ[key].h-placed;return({9:"3x3",6:"3x2",4:"2x2"})[n]||"rest"}
  const nextName=(key,R,walls)=>{const nx=R.spec.la.next;return nx.rest?restName(key,walls.length+R.alts[0].length):METHODS.stepName(key,nx)};
  function stepLabel(R,walls){const key=C.key,sp=R.spec;walls=walls||C.walls;
    if(sp.prefix)return `first ${sp.prefix} moves`;
    if(R.rest)return walls.length?restName(key,walls.length):key;
    const nm=METHODS.stepName(key,sp);return sp.la?`${nm} + ${nextName(key,R,walls)}`:nm}
  function setTarget(){const it=C.it;
    if(C.phase==="build"){targetEl.innerHTML="building tables…";return}
    if(!it||!C.R)return;
    const st=multi()?`<span class="z-step">step ${C.si+1}/${C.S.M.steps.length}</span> `:"",sp=C.R.spec;
    const lab=sp.prefix?`first ${sp.prefix} moves · optimal`:C.R.rest&&!C.walls.length?"optimal":`${stepLabel(C.R)} ${sp.la?"best":"optimal"}`;
    targetEl.innerHTML=`${st}${lab} <b>${!ui.pre&&(C.phase==="lock"||C.phase==="solve")?"?":C.std.std}</b>`}
  function setSub(final){const t=C.running?(performance.now()-C.t0)/1000:(C.time||0);
    if(final){subEl.textContent=`${C.moves} moves · ${fmt(C.time,2)} s · ${fmt(C.moves/C.time,1)} tps`;return}
    subEl.textContent=ui.timer?`${C.moves} moves · ${fmt(C.running?t:0,2)} s`:`${C.moves} moves`}
  function tick(){if(!C.running)return;setSub();requestAnimationFrame(tick)}
  const fb=h=>{fbEl.innerHTML=h};
  function lockAnim(ms){lockEl.style.transition="none";lockEl.style.width=ms?"100%":"0";void lockEl.offsetWidth;if(ms){lockEl.style.transition=`width ${ms}ms linear`;lockEl.style.width="0"}}
  function rolling(S,n){const h=hist(S).slice(-n);return{n:h.length,pass:h.filter(x=>x.p!=null?x.p:x.m===x.o).length}}
  function progUI(){const S=C.S;if(!S||!S.ready)return;drillUI();
    if(S.drill){const n=Object.keys(S.prog.cards).length,left=drillLeft(S).length;barEl.style.width=(n?(n-left)/n*100:100).toFixed(1)+"%";progEl.textContent=`drilling reviews · ${n-left} / ${n} drilled · schedule unchanged`;return}
    const nc=Object.keys(S.prog.cards).length,rc=rolling(S,100),pct=rc.n?Math.round(rc.pass/rc.n*100):0;
    if(S.classic&&S.prog.src==="auto"&&classicSrc(S)){const g=classicProgress(S);barEl.style.width=(Math.min(1,g.f)*100).toFixed(1)+"%";
      progEl.textContent=g.txt+(rc.n?` · ${pct}% met of last ${rc.n}`:"")+(nc?` · ${nc} reviewing`:"");return}
    barEl.style.width=pct+"%";progEl.textContent=(rc.n?`standard met ${pct}% of last ${rc.n}`:"no solves yet with this method")+(nc?` · ${nc} reviewing`:"")}
  function load(it){clearTimers();C.it=it;C.b=it.b.slice();C.moves=0;C.running=false;C.time=0;C.rv=null;C.si=0;C.walls=[];C.res=[];
    C.S.lastK=C.S.kof(it.b);boardCls("");fb("");seqEl.innerHTML="";tagEl.textContent=it.label||"";
    startStep();
    const ms=Math.round(ui.buf*1000);C.lockUntil=performance.now()+ms;lockAnim(ms);
    if(ms>0){C.phase="lock";boardEl.classList.add("locked");later(()=>{if(C.it===it&&C.phase==="lock"){C.phase="solve";boardEl.classList.remove("locked")}},ms)}
    else{C.phase="solve";boardEl.classList.remove("locked")}
    setTarget();setSub()}
  function startStep(){const key=C.key;C.R=METHODS.resolve(key,C.S.M.steps[C.si],C.walls);C.sb=C.b.slice();C.sp="";
    C.std=METHODS.standard(key,C.R,C.walls,C.b);C.dcur=C.R.f(C.b);render();setTarget();
    // a step whose tiles are already home counts as done with 0 moves
    if(!C.R.spec.prefix&&METHODS.doneStep(C.R,C.b)){const v=METHODS.value(key,C.R,C.walls,C.b,0);stepDone(v<=C.std.std,v)}}
  function next(){clearTimers();const S=C.S;if(!S||!S.ready)return;
    const it=pick(S);if(!it){drillDone();return}
    load(it)}
  function canMove(){if(C.phase==="lock"&&performance.now()>=C.lockUntil){C.phase="solve";boardEl.classList.remove("locked")}return C.phase==="solve"}
  const isWall=c=>C.walls.includes(c);
  /* one single-tile move; returns false when the solve stopped (step missed or method finished) */
  function step(k){if(isWall(k))return false;const z=C.b.indexOf(0);if(!C.running){C.running=true;C.t0=performance.now();requestAnimationFrame(tick)}
    C.sp+=tileLetter(z,k,C.d.P.w);C.b[z]=C.b[k];C.b[k]=0;C.moves++;return afterMove()}
  function afterMove(){const R=C.R,key=C.key;
    if(R.spec.prefix){const nd=R.f(C.b);if(nd!==C.dcur-1){stepDone(false);return false}C.dcur=nd;
      if(C.sp.length>=R.spec.prefix||nd===0){stepDone(true);return false}return true}
    if(!METHODS.doneStep(R,C.b))return true;
    const val=METHODS.value(key,R,C.walls,C.b,C.sp.length);stepDone(val<=C.std.std,val);return C.phase==="solve"}
  function stepDone(pass,val){const R=C.R,st=C.std.std;
    C.res.push({name:R.spec.prefix?`first ${R.spec.prefix}`:R.rest?stepLabel(R):METHODS.stepName(C.key,R.spec),std:R.spec.prefix?Math.min(R.spec.prefix,st):st,val:val==null?C.sp.length:val,pass,moves:C.sp.length});
    if(!pass){finishSolve(false);return}
    if(R.spec.prefix||C.si+1>=C.S.M.steps.length){finishSolve(true);return}
    C.walls=METHODS.wallsAfter(R,C.b,C.walls);C.si++;
    fb(C.res.map(r=>`<span class="z-okstep">✓ ${r.name} ${r.moves}</span>`).join(" "));startStep()}
  function after(){render();if(C.phase==="solve"&&!ui.timer)setSub()}
  function moveDir(L){if(!canMove())return;const P=C.d.P,z=C.b.indexOf(0),x=z%P.w,y=(z/P.w)|0;let k=-1;
    if(L==="L"&&x<P.w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<P.h-1)k=z+P.w;if(L==="D"&&y>0)k=z-P.w;if(k<0||isWall(k))return;step(k);after()}
  function toCell(i){if(!canMove())return;const P=C.d.P;let z=C.b.indexOf(0);if(i===z)return;const zx=z%P.w,zy=(z/P.w)|0,ix=i%P.w,iy=(i/P.w)|0;let s;
    if(zy===iy)s=ix>zx?1:-1;else if(zx===ix)s=iy>zy?P.w:-P.w;else return;
    for(let c=z+s;;c+=s){if(isWall(c))return;if(c===i)break}
    while(z!==i){if(!step(z+s))break;z+=s}after()}

  /* ---------- end of a solve ---------- */
  function finishSolve(pass){const S=C.S,it=C.it;C.running=false;C.time=(performance.now()-C.t0)/1000||0;setSub(true);
    const s=C.res.reduce((a,r)=>a+r.std,0),v=C.res.reduce((a,r)=>a+r.val,0),h=hist(S);
    const e={t:+C.time.toFixed(3),m:C.moves,s,v,p:pass?1:0,d:it.depth};if(S.classic)e.o=s;
    let rv=null;
    if(!pass){const R=C.R;rv={b0:C.sb,path:C.sp,R,walls:C.walls.slice(),std:C.std,res:C.res[C.res.length-1]};
      rv.div=METHODS.diverge(C.key,R,rv.walls,rv.b0,rv.path,rv.std);if(C.si===0)e.k=rv.div.k}
    h.push(e);if(h.length>1000)h.shift();store.set(S.hk,h);
    const note=S.drill?drillJudge(S,it,pass):judge(S,it,pass);progUI();
    if(pass){C.phase="done";boardCls("good");const last=C.res[C.res.length-1],beat=v<s;
      const steps=multi()?C.res.map(r=>`<span class="z-okstep">✓ ${r.name} ${r.moves}</span>`).join(" ")+"<br>":"";
      const whole=S.M.steps.length===1&&S.M.steps[0].rest&&!S.M.steps[0].prefix;
      fb(`${steps}<b class="z-ok">✓ ${beat?`beat the method by ${s-v}`:whole?"optimal":"standard met"}</b>${note?` <span class="z-mute">· ${note}</span>`:""}`);
      later(next,multi()?900:600);return}
    C.rv=rv;C.phase="review";boardCls("bad");
    const r=rv.res,over=r.val-r.std;
    C.head=(multi()?`<span class="z-mute">step ${C.si+1} · ${r.name}</span> `:"")+(rv.R.spec.prefix?`<b class="z-bad">✗</b> <span class="z-mute">· move ${r.moves} left the optimal path · ${note}</span>`
      :`<b class="z-bad">+${over}</b> <span class="z-mute">· standard ${r.std} · ${note}</span>`);
    playReview()}

  /* ---------- miss review: replay the missed step and show where it left the standard ---------- */
  function hintTile(L,b){const P=C.d.P,z=b.indexOf(0);const k=L==="L"?z+1:L==="R"?z-1:L==="U"?z+P.w:z-P.w;if(C.cells[k])C.cells[k].classList.add("hint")}
  const ARROW={L:"←",R:"→",U:"↑",D:"↓"};
  function seqHTML(pre,cont,j){return `<span class="z-pre">${pre}</span>${pre.length?'<span class="z-cut"></span>':""}`+[...cont].map((c,i)=>`<span class="${i<j?"z-done":i===j?"z-now":""}">${c}</span>`).join("")}
  function laNote(rv){const R=rv.R;if(!R.spec.la)return "";const nx=nextName(C.key,R,rv.walls);
    const yours=rv.res.val-rv.res.moves,bestLen=rv.std.path.length,bestNext=rv.std.std-bestLen;
    return ` Your ${METHODS.stepName(C.key,R.spec)} took ${rv.res.moves} and left ${yours} for the ${nx}. The best set-up: ${bestLen} + ${bestNext}.`}
  function playReview(){clearTimers();const rv=C.rv,div=rv.div,P=C.d.P,b=rv.b0.slice();C.phase="review";C.b=b;render(b,rv.R,rv.walls);boardCls("bad");
    const pre=rv.path.slice(0,div.k),cont=div.cont||"",std=rv.R.spec.la?"the best set-up":"optimal";
    const why=(div.k===0?`Your first move (${ARROW[rv.path[0]]||"—"}) already left the standard. ${std[0].toUpperCase()+std.slice(1)} starts ${ARROW[cont[0]]||"—"}.`
      :`Your first ${div.k} move${div.k>1?"s were":" was"} on standard. On move ${div.k+1} you went ${ARROW[rv.path[div.k]]||"—"}; ${std} goes ${ARROW[cont[0]]||"—"}.`)+laNote(rv);
    fb(C.head+`<div class="z-why">${why}</div><div class="z-btns"><button class="z-link" data-z="replay">replay (R)</button><button class="z-link" data-z="next">next (space)</button></div>`);
    seqEl.innerHTML=seqHTML(pre,cont,-1);
    const iv=ui.pace==="auto"?Math.max(160,Math.min(480,6500/Math.max(1,cont.length))):1000/+ui.pace;
    let i=0,j=0;const rr=()=>render(b,rv.R,rv.walls);
    const preStep=()=>{if(i<pre.length){applyLetter(b,P.w,P.h,pre[i]);i++;rr();later(preStep,70)}else{rr();if(cont.length)hintTile(cont[0],b);later(contStep,pre.length?750:500)}};
    const contStep=()=>{if(j<cont.length){applyLetter(b,P.w,P.h,cont[j]);j++;rr();seqEl.innerHTML=seqHTML(pre,cont,j);later(contStep,iv)}
      else{boardCls("good");later(()=>{if(C.phase==="review")next()},1400)}};
    later(preStep,350)}

  /* ---------- tabs, method choice ---------- */
  const tabs=[...root.querySelectorAll('.seg [role="tab"]')];
  function select(key){if(!PUZ[key])return;clearTimers();C.running=false;C.key=key;C.d=data(key);ui.tab=key;saveUI();
    C.S=mstate(C.d,curMethod(key));drillUI();
    tabs.forEach(t=>{const on=t.dataset.key===key;t.setAttribute("aria-selected",on);t.tabIndex=on?0:-1});
    buildCells();layout();C.it=null;C.R=null;C.walls=[];C.b=goal(C.d.P.w*C.d.P.h);render();boardCls("dim");fb("");seqEl.innerHTML="";tagEl.textContent="";subEl.textContent="";
    if(panelOpen())fillPanel();
    const S=C.S;
    if(!S.ready){C.phase="build";setTarget();setTimeout(()=>{if(C.S!==S)return;prepare(S);if(panelOpen())fillPanel();progUI();next()},40)}
    else{progUI();next()}}
  function setMethod(id){ui.meth[C.key]=id;saveUI();select(C.key)}
  tabs.forEach(t=>t.addEventListener("click",e=>{e.currentTarget.blur();select(t.dataset.key)}));

  /* ---------- settings panel ---------- */
  const panelOpen=()=>!panel.hidden;
  function closePanel(){if(!panel.hidden){panel.hidden=true;$("zGear").setAttribute("aria-expanded","false")}}
  function fillPanel(){const d=C.d,key=C.key,S=C.S,M=S.M;
    $("zSize").value=ui.size[key];$("zPre").checked=ui.pre;$("zHover").checked=ui.hover;$("zTimer").checked=ui.timer;$("zBuf").value=String(ui.buf);$("zPace").value=String(ui.pace);
    $("zPuz").textContent=key;$("zPuz2").textContent=key;$("zPuz3").textContent=key;
    const L=methods(key);
    $("zMeth").innerHTML=L.map(m=>`<option value="${m.id}">${esc(m.name)}${m.custom?" (custom)":""}</option>`).join("");$("zMeth").value=M.id;
    $("zMethNote").textContent=M.desc+(M.exp?` Expected: ${M.exp}.`:"");
    $("zCustomDel").hidden=!M.custom;$("zCustomErr").textContent="";
    const auto=S.classic&&S.prog.src==="auto";
    $("zPool").innerHTML=(S.classic?[["auto",key==="3x2"?"Every position, easiest first":"Depth by depth"],["random","Random states"]]:[["random","Random states"]]).map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
    $("zPool").value=S.classic?S.prog.src:"random";$("zPool").disabled=!S.classic;
    if(S.ready){const inf=METHODS.depthInfo(key,M),[lo,hi]=range(S),o=Array.from({length:inf.max},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("");
      $("zDlo").innerHTML=o;$("zDhi").innerHTML=o;$("zDlo").value=String(lo);$("zDhi").value=String(hi);$("zDname").textContent=inf.name}
    $("zDlo").disabled=$("zDhi").disabled=auto||!S.ready;$("zDnote").textContent=auto?"Used with random states.":"Optimal moves of the first step. Pick one depth, a band, or “x and up” by setting the top to the maximum.";
    const s=hist(S).slice(-100),n=s.length;
    const st=n?{t:s.reduce((a,x)=>a+x.t,0)/n,m:s.reduce((a,x)=>a+x.m,0)/n,o:s.reduce((a,x)=>a+((x.v!=null?x.v:x.m)-(x.s!=null?x.s:x.o)),0)/n}:null;
    $("zStats").innerHTML=st?`<div><b>${fmt(st.t)}</b><span>mean s</span></div><div><b>${fmt(st.m,1)}</b><span>moves</span></div><div><b>+${fmt(st.o,1)}</b><span>over std</span></div><div><b>${fmt(st.t?st.m/st.t:NaN,1)}</b><span>tps</span></div>`:`<p class="note" style="margin:0">No solves yet with this method.</p>`;
    const rc=rolling(S,100),nc=Object.keys(S.prog.cards).length,nm=S.classic?Object.keys(S.prog.mastered).length:null;
    let miss="";const ks=s.filter(x=>x.k!=null&&!x.p);if(ks.length>=5){const c={};ks.forEach(x=>{c[x.k+1]=(c[x.k+1]||0)+1});const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];miss=` · misses most often on move ${top[0]} (${Math.round(top[1]/ks.length*100)}%)`}
    $("zCounts").textContent=`last ${n} solves · standard met ${rc.n?Math.round(rc.pass/rc.n*100):0}%${nm!=null?` · ${nm} cases cleared`:""} · ${nc} in review${miss}`;
    $("zUse").hidden=!(key==="3x3"&&S.classic)||!n;
    $("zConfirm").hidden=true;$("zConfirmAll").hidden=true;$("zImportAsk").hidden=true;$("zImportMsg").textContent=""}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  $("zGear").addEventListener("click",e=>{e.currentTarget.blur();if(panelOpen())closePanel();else{fillPanel();panel.hidden=false;e.currentTarget.setAttribute("aria-expanded","true")}});
  $("zClose").addEventListener("click",closePanel);
  $("zSize").addEventListener("input",e=>{ui.size[C.key]=+e.target.value;saveUI();layout()});
  $("zPre").addEventListener("change",e=>{ui.pre=e.target.checked;saveUI();setTarget()});
  $("zHover").addEventListener("change",e=>{ui.hover=e.target.checked;saveUI()});
  $("zTimer").addEventListener("change",e=>{ui.timer=e.target.checked;saveUI();if(C.phase==="solve"||C.phase==="lock")setSub()});
  $("zBuf").addEventListener("change",e=>{ui.buf=+e.target.value;saveUI()});
  $("zPace").addEventListener("change",e=>{ui.pace=e.target.value;saveUI()});
  $("zMeth").addEventListener("change",e=>{setMethod(e.target.value);fillPanel()});
  $("zPool").addEventListener("change",e=>{const S=C.S;if(!S.classic)return;S.prog.src=e.target.value;save(S);fillPanel();progUI();next()});
  function setRange(){const S=C.S;let lo=+$("zDlo").value,hi=+$("zDhi").value;if(lo>hi){if(this===$("zDlo"))hi=lo;else lo=hi}
    ui.rng[C.key+":"+S.M.id]=[lo,hi];saveUI();$("zDlo").value=String(lo);$("zDhi").value=String(hi);next()}
  $("zDlo").addEventListener("change",setRange);$("zDhi").addEventListener("change",setRange);
  $("zCustomAdd").addEventListener("click",()=>{const key=C.key,txt=$("zCustom").value.trim();let M;
    try{M=METHODS.parse(key,txt)}catch(e){$("zCustomErr").textContent=e.message;return}
    const L=ui.custom[key]=ui.custom[key]||[];if(!L.includes(txt))L.push(txt);$("zCustom").value="";setMethod(M.id);fillPanel()});
  $("zCustomDel").addEventListener("click",()=>{const key=C.key,M=C.S.M;if(!M.custom)return;ui.custom[key]=(ui.custom[key]||[]).filter(t=>t!==M.custom);delete ui.meth[key];setMethod(DEFAULT[key]);fillPanel()});
  $("zUse").addEventListener("click",()=>{const s=hist(C.S).slice(-100),L=s.length;if(!L)return;
    document.getElementById("advSize").value=C.key;document.getElementById("advAvg").value=L>=100?"100":L>=50?"50":L>=12?"12":"5";
    document.getElementById("advMoves").value=(s.reduce((x,y)=>x+y.m,0)/L).toFixed(1);document.getElementById("advTime").value=(s.reduce((x,y)=>x+y.t,0)/L).toFixed(3);
    document.getElementById("advNote").textContent=`Using your last ${L} trainer solves (mean, not a trimmed average).`;
    advisor.update(true);closePanel();if(isFS())toggleFS();location.hash="#advisor"});

  /* ---------- reset, export, import ---------- */
  const lsKeys=()=>{const r=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("ssa"))r.push(k)}}catch(e){}return r};
  const puzzleKey=(k,key)=>k==="ssa-v3-"+key||k==="ssa-prog-v1-"+key||k==="ssa3-"+key||k.startsWith("ssa-m-"+key+"-")||k.startsWith("ssa4-"+key+"-");
  function wipe(key){lsKeys().filter(k=>puzzleKey(k,key)).forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});delete Z[key]}
  $("zReset").addEventListener("click",()=>{$("zConfirm").hidden=false});
  $("zResetNo").addEventListener("click",()=>{$("zConfirm").hidden=true});
  $("zResetYes").addEventListener("click",()=>{wipe(C.key);closePanel();select(C.key)});
  $("zWipe").addEventListener("click",()=>{$("zConfirmAll").hidden=false});
  $("zWipeNo").addEventListener("click",()=>{$("zConfirmAll").hidden=true});
  $("zWipeYes").addEventListener("click",()=>{KEYS.forEach(wipe);closePanel();select(C.key)});
  $("zExport").addEventListener("click",()=>{const data={};lsKeys().forEach(k=>{data[k]=store.get(k)});
    const blob=new Blob([JSON.stringify({app:"speedsliding-atlas",version:1,exported:new Date().toISOString(),data},null,1)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`speedsliding-progress-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);$("zImportMsg").textContent="Progress exported."});
  let pending=null;
  $("zImport").addEventListener("click",()=>{$("zImportFile").value="";$("zImportFile").click()});
  $("zImportFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const j=JSON.parse(r.result);if(!j||j.app!=="speedsliding-atlas"||typeof j.data!=="object")throw 0;
        const keys=Object.keys(j.data).filter(k=>k.startsWith("ssa"));if(!keys.length)throw 0;
        pending=j.data;$("zImportAsk").hidden=false;$("zImportMsg").textContent=`File from ${j.exported?j.exported.slice(0,10):"an unknown date"} · ${keys.length} saved item${keys.length>1?"s":""}.`}
      catch(err){pending=null;$("zImportAsk").hidden=true;$("zImportMsg").textContent="That file isn't a Speedsliding Atlas progress export."}};
    r.readAsText(f)});
  function mergeVal(a,b){if(a==null)return b;if(Array.isArray(a)||typeof a!=="object"||typeof b!=="object"||!b)return a;
    const o=Object.assign({},a);if(b.mastered)o.mastered=Object.assign({},b.mastered,a.mastered||{});
    if(b.cards)o.cards=Object.assign({},b.cards,a.cards||{});if(b.clock!=null)o.clock=Math.max(a.clock||0,b.clock);return o}
  function applyImport(mode){if(!pending)return;const data=pending;pending=null;
    if(mode==="replace")lsKeys().forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
    for(const k in data){if(!k.startsWith("ssa"))continue;store.set(k,mode==="replace"?data[k]:mergeVal(store.get(k),data[k]))}
    location.reload()}
  $("zImportReplace").addEventListener("click",()=>applyImport("replace"));
  $("zImportMerge").addEventListener("click",()=>applyImport("merge"));
  $("zImportCancel").addEventListener("click",()=>{pending=null;$("zImportAsk").hidden=true;$("zImportMsg").textContent=""});

  fbEl.addEventListener("click",e=>{const a=e.target.closest("[data-z]");if(!a)return;a.blur();if(a.dataset.z==="replay"&&C.rv)playReview();if(a.dataset.z==="next")next();if(a.dataset.z==="drill")setDrill(true);if(a.dataset.z==="exit")setDrill(false)});
  $("zDrill").addEventListener("click",e=>{e.currentTarget.blur();setDrill(!C.S.drill)});
  stage.addEventListener("pointerdown",e=>{if(!e.target.closest("#zPanel"))closePanel()});

  /* ---------- fullscreen ---------- */
  const isFS=()=>document.fullscreenElement===root||root.classList.contains("pfs");
  function setPseudo(on){root.classList.toggle("pfs",on);document.documentElement.style.overflow=on?"hidden":"";setFsIcon();setTimeout(layout,30)}
  function setFsIcon(){const on=isFS();$("zFs").setAttribute("aria-label",on?"Exit fullscreen (F)":"Fullscreen (F)");$("zFs").classList.toggle("on",on)}
  function toggleFS(){if(isFS()){if(document.fullscreenElement){document.exitFullscreen().catch(()=>{})}setPseudo(false);return}
    let r=null;try{r=root.requestFullscreen&&root.requestFullscreen()}catch(e){r=null}
    if(r&&r.then)r.then(()=>setTimeout(layout,60)).catch(()=>setPseudo(true));else setPseudo(true)}
  document.addEventListener("fullscreenchange",()=>{root.classList.toggle("fs",document.fullscreenElement===root);setFsIcon();setTimeout(layout,60)});
  $("zFs").addEventListener("click",e=>{e.currentTarget.blur();toggleFS()});
  window.addEventListener("resize",()=>layout());

  /* ---------- keyboard ---------- */
  const MOVES={ArrowLeft:"L",ArrowRight:"R",ArrowUp:"U",ArrowDown:"D",a:"L",d:"R",w:"U",s:"D",A:"L",D:"R",W:"U",S:"D",j:"L",l:"R",i:"U",k:"D",J:"L",L:"R",I:"U",K:"D"};
  document.addEventListener("keydown",e=>{
    if(document.getElementById("view-train").hidden||e.metaKey||e.ctrlKey||e.altKey)return;
    const tg=(e.target.tagName||"").toLowerCase();if(tg==="input"||tg==="select"||tg==="textarea")return;
    if(e.key==="Escape"){if(panelOpen())closePanel();else if(root.classList.contains("pfs"))setPseudo(false);return}
    if(MOVES[e.key]){e.preventDefault();moveDir(MOVES[e.key]);return}
    if(e.key===" "||e.key==="Enter"){e.preventDefault();if(C.phase!=="build")next();return}
    if(e.key==="r"||e.key==="R"){if(C.rv&&(C.phase==="review"||C.phase==="done")){e.preventDefault();playReview()}return}
    if(e.key==="f"||e.key==="F"){e.preventDefault();toggleFS();return}
    if(/^[1-4]$/.test(e.key)){e.preventDefault();select(KEYS[+e.key-1])}});

  return{start(){select(KEYS.includes(ui.tab)?ui.tab:"3x2")},select,layout,_state:()=>C,
    exitPseudo(){if(root.classList.contains("pfs"))setPseudo(false)}};
})();
