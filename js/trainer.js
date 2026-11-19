/* Zen trainer */
"use strict";
const ZEN=(function(){
  const KEYS=["3x2","3x3","4x3","4x4"];
  const LEVELS={"4x4":[[5,15],[16,25],[26,35],[36,45]],"4x3":[[5,12],[13,20],[21,28]]};
  const PER=10;                        // cases per 3x3 depth / big-puzzle level
  const STEPS=[3,8,25,"break"];        // after a miss: optimal again after 3, 8, 25 solves, then after an 8 h break
  const BREAK_MS=8*3600e3;
  const ui=Object.assign({tab:"3x2",pre:true,hover:false,timer:true,buf:1,pace:"auto",size:{}},store.get("ssa-ui-v3")||{});
  KEYS.forEach(k=>{if(!ui.size[k])ui.size[k]=80});
  const saveUI=()=>store.set("ssa-ui-v3",ui);
  const $=id=>document.getElementById(id);
  const root=$("zen"),stage=$("zStage"),boardEl=$("zBoard"),lockEl=$("zLock"),tagEl=$("zTag"),targetEl=$("zTarget"),subEl=$("zSub"),fbEl=$("zFb"),seqEl=$("zSeq"),barEl=$("zBar"),progEl=$("zProg"),panel=$("zPanel");
  const genW=mkSolver(),anaW=mkSolver();
  genW.onStatus=m=>{if(C.key===m.key)setTarget()};

  /* ---------- per-puzzle data ---------- */
  const Z={};
  function loadProg(key){let p=store.get("ssa-v3-"+key);
    if(!p){p={clock:0,mastered:{},levels:{},cards:{},src:"auto"};
      const old=store.get("ssa-prog-v1-"+key);
      if(old){Object.assign(p.mastered,old.mastered||{});Object.assign(p.levels,old.levels||{});if(old.src)p.src=old.src;
        (old.review||[]).forEach(r=>{p.cards[r.k]={step:0,due:0,n:r.n||1,s:r.s}})}}
    p.cards=p.cards||{};p.mastered=p.mastered||{};p.levels=p.levels||{};return p}
  function data(key){if(!Z[key]){const P=PUZ[key],d=Z[key]={key,P,big:!P.exact,prog:loadProg(key),pf:{src:null,items:[]},byDepth:null,order:null,mcount:null,lastK:null,skip:new Set()};
      if(d.big)pruneCards(d)}return Z[key]}
  /* Review cards saved before subset filtering may be smaller-trainer cases; drop those (big puzzles: checked in the worker). */
  function pruneCards(d){for(const k in d.prog.cards){const c=d.prog.cards[k],b=fromKey(d,k);if(!c.s||!subBoard(d.key,b))continue;
      genW.post({type:"redundant",key:d.key,board:b,opt:c.s.length},r=>{if(r.redundant===true&&d.prog.cards[k]){delete d.prog.cards[k];save(d);if(C.d===d)progUI()}})}}
  const save=d=>store.set("ssa-v3-"+d.key,d.prog);
  const keyOf=(d,b)=>d.big?b.join(","):b.join("");
  const fromKey=(d,k)=>d.big?k.split(",").map(Number):[...k].map(Number);
  function prepExact(d){if(d.byDepth)return;const T=table(d.key);d.byDepth=Array.from({length:T.max+1},()=>[]);
    for(const [k,v] of T.dist){if(v===0)continue;if(redundantExact(d.key,fromKey(d,k))){d.skip.add(k);continue}d.byDepth[v].push(k)}
    let pruned=false;for(const k in d.prog.cards)if(d.skip.has(k)){delete d.prog.cards[k];pruned=true}if(pruned)save(d);
    if(d.key==="3x2"){d.order=[];for(let i=1;i<d.byDepth.length;i++)d.order.push(...d.byDepth[i].slice().sort((a,b)=>strHash(a)-strHash(b)))}
    recount(d)}
  function recount(d){if(d.big||!d.byDepth)return;const T=table(d.key);d.mcount=d.byDepth.map(()=>0);for(const k in d.prog.mastered){const v=T.dist.get(k);if(v&&!d.skip.has(k))d.mcount[v]++}}
  function learnCounts(d,f){const c={};for(const k in d.prog.cards){const v=d.prog.cards[k][f];if(v!=null)c[v]=(c[v]||0)+1}return c}
  function resolve(d){const p=d.prog,s=p.src||"auto";if(s!=="auto")return s;
    if(d.key==="3x2")return "ord";
    if(d.key==="3x3"){const lc=learnCounts(d,"d");for(let i=1;i<d.byDepth.length;i++)if(d.mcount[i]+(lc[i]||0)<Math.min(d.byDepth[i].length,PER))return "d:"+i;return "random"}
    const lc=learnCounts(d,"l"),L=LEVELS[d.key];for(let i=0;i<L.length;i++)if((p.levels[i]||0)+(lc[i]||0)<PER)return "l:"+i;return "random"}
  function progress(d){const p=d.prog,nc=Object.keys(p.cards).length;
    if(d.key==="3x2"){const m=Object.keys(p.mastered).length;return{f:m/359,txt:m>=359?"all 359 solved optimally":`${m} / 359 solved optimally`,nc}}
    if(d.key==="3x3"){let a=0,t=0;for(let i=1;i<d.byDepth.length;i++){const tg=Math.min(d.byDepth[i].length,PER);t+=tg;a+=Math.min(d.mcount[i],tg)}
      const s=resolve(d);return{f:a/t,txt:`${a} / ${t} cases · ${s.startsWith("d:")?"depth "+s.slice(2):"random state"}`,nc}}
    const L=LEVELS[d.key];let a=0;L.forEach((_,i)=>{a+=Math.min(p.levels[i]||0,PER)});const s=resolve(d);
    return{f:a/(L.length*PER),txt:`${a} / ${L.length*PER} cases · ${s.startsWith("l:")?"level "+(+s.slice(2)+1):"random state"}`,nc}}

  /* ---------- picking scrambles ---------- */
  /* Uniform random state that belongs to this trainer (not a smaller trainer's case). */
  function randBoard(d){let b;do b=scramble(d.P.w,d.P.h);while(d.big?subBoard(d.key,b):d.skip.has(keyOf(d,b)));return b}
  function mkExact(d,k,extra){const b=fromKey(d,k),sol=optimal(d.key,b),dep=table(d.key).dist.get(k);
    return Object.assign({b,sol,opt:sol.length,ready:true,depth:dep,isNew:!d.prog.mastered[k]},extra||{})}
  function mkBig(d,s){
    if(s==="random"){const b=randBoard(d),it={b,sol:null,opt:null,ready:true,lb:lowerBound(b,d.P.w,d.P.h),label:"random state"};
      genW.post({key:d.key,board:b},r=>{if(r.fail){it.fail=true;if(r.lb)it.lb=r.lb}else{it.sol=r.sol;it.opt=r.sol.length}onItem(it)});return it}
    const i=+s.slice(2),[lo,hi]=LEVELS[d.key][i],it={b:null,sol:null,opt:null,ready:false,lvl:i,label:`level ${i+1} · optimal ${lo}–${hi}`};
    genW.post({type:"gen",key:d.key,lo,hi},r=>{if(r.fail)it.genFail=true;else{it.b=r.board;it.sol=r.sol;it.opt=r.sol.length}it.ready=true;onItem(it)});return it}
  function newItem(d){const s=resolve(d),p=d.prog;
    if(!d.big){let k;
      if(s==="ord"){k=d.order.find(x=>!p.mastered[x]&&!p.cards[x]);if(!k)return null}
      else if(s.startsWith("d:")){const arr=d.byDepth[+s.slice(2)]||[],un=arr.filter(x=>!p.mastered[x]&&!p.cards[x]),pool=un.length?un:arr;if(!pool.length)return null;k=pool[Math.floor(Math.random()*pool.length)]}
      else k=keyOf(d,randBoard(d));
      const it=mkExact(d,k);it.label=(s==="random"?"random · ":"")+"depth "+it.depth+(it.isNew?"":" · already solved");return it}
    if(d.pf.src!==s)d.pf={src:s,items:[]};while(d.pf.items.length<2)d.pf.items.push(mkBig(d,s));
    const it=d.pf.items.shift();d.pf.items.push(mkBig(d,s));return it}
  function cardItem(d,k){const c=d.prog.cards[k],lab=`review · ${c.step} of ${STEPS.length} done`;
    if(!d.big)return mkExact(d,k,{card:k,label:lab+" · depth "+table(d.key).dist.get(k)});
    const b=fromKey(d,k);return{b,sol:c.s,opt:c.s.length,ready:true,card:k,lvl:c.l,lb:lowerBound(b,d.P.w,d.P.h),label:lab}}
  function pick(d){const p=d.prog,now=Date.now();let best=null;
    for(const k in p.cards){const c=p.cards[k];if(k===d.lastK)continue;if(c.due<=p.clock&&(c.dueT||0)<=now&&(!best||c.due<p.cards[best].due))best=k}
    if(best)return cardItem(d,best);
    const it=newItem(d);if(it)return it;
    let e=null;for(const k in p.cards){const c=p.cards[k];if(k===d.lastK||(c.dueT||0)>now)continue;if(!e||c.due<p.cards[e].due)e=k}
    if(e)return cardItem(d,e);
    const r=mkExact(d,keyOf(d,randBoard(d)));r.label="every case solved · random practice";return r}

  /* ---------- spaced repetition ---------- */
  function sched(p,c){const s=STEPS[c.step];if(s==="break"){c.due=p.clock+5;c.dueT=Date.now()+BREAK_MS}else{c.due=p.clock+s;c.dueT=0}}
  function master(d,k,info){if(!d.big)d.prog.mastered[k]=1;else if(info&&info.l!=null)d.prog.levels[info.l]=(d.prog.levels[info.l]||0)+1}
  function judge(d,it,mv){const p=d.prog;p.clock++;const k=keyOf(d,it.b),hit=mv===it.opt;let c=p.cards[k],note="";
    if(c){if(hit){c.step++;if(c.step>=STEPS.length){delete p.cards[k];master(d,k,c);note="learned · leaves the pool"}
        else{sched(p,c);note=c.dueT?"next review after an 8 h break":`review ${c.step} of ${STEPS.length} · next in ${c.due-p.clock} solves`}}
      else{c.step=0;c.n++;delete c.dueT;sched(p,c);note="back in 3 solves"}}
    else if(hit){if(it.isNew!==false)master(d,k,{l:it.lvl})}
    else{c=p.cards[k]={step:0,n:1};if(it.depth!=null&&!d.big)c.d=it.depth;if(it.lvl!=null)c.l=it.lvl;if(d.big)c.s=it.sol;sched(p,c);note="back in 3 solves";
      const ks=Object.keys(p.cards);if(ks.length>400)delete p.cards[ks[0]]}
    save(d);recount(d);return note}

  /* ---------- current solve ---------- */
  const C={key:null,d:null,it:null,b:null,moves:0,path:"",t0:0,running:false,phase:"idle",lockUntil:0,timers:[],cells:[],div:null,sesIdx:-1};
  const clearTimers=()=>{C.timers.forEach(clearTimeout);C.timers=[]};
  const later=(fn,ms)=>{C.timers.push(setTimeout(fn,ms))};
  function buildCells(){const P=C.d.P;boardEl.innerHTML="";boardEl.style.gridTemplateColumns=`repeat(${P.w},auto)`;C.cells=[];
    for(let i=0;i<P.w*P.h;i++){const t=document.createElement("button");t.type="button";t.tabIndex=-1;
      t.addEventListener("pointerdown",e=>{e.preventDefault();closePanel();toCell(i)});
      t.addEventListener("pointerenter",e=>{if(ui.hover&&e.pointerType==="mouse")toCell(i)});
      boardEl.appendChild(t);C.cells.push(t)}}
  function render(){const P=C.d.P;C.b.forEach((v,i)=>{const t=C.cells[i];if(!t)return;
    if(!v){t.className="tile blank";t.textContent="";t.setAttribute("aria-label","gap")}
    else{const l=P.labels[v-1];t.className="tile "+sgrp(l);t.textContent=l;t.removeAttribute("aria-label")}})}
  const boardCls=c=>{boardEl.classList.remove("good","bad","dim");if(c)boardEl.classList.add(c)};
  function layout(){if(!C.d)return;const P=C.d.P,fs=isFS();
    const W=(root.clientWidth||Math.min(window.innerWidth,1000))-40;
    const H=fs?window.innerHeight-230:Math.min(700,window.innerHeight-150)-230;
    const fit=Math.min(W/(P.w+.3),Math.max(160,H)/(P.h+.3),fs?230:150);
    boardEl.style.setProperty("--t",Math.max(28,Math.round(fit*ui.size[C.key]/100))+"px")}
  function setTarget(){const it=C.it;
    if(C.phase==="wait"){targetEl.innerHTML="preparing a scramble…";return}
    if(C.phase==="build"){targetEl.innerHTML="building tables…";return}
    if(!it)return;
    if(!ui.pre&&(C.phase==="lock"||C.phase==="solve")){targetEl.innerHTML="optimal <b>?</b>";return}
    if(it.opt!=null)targetEl.innerHTML=`optimal <b>${it.opt}</b>`;
    else if(it.fail)targetEl.innerHTML=`optimal not found · at least <b>${it.lb}</b>`;
    else targetEl.innerHTML=genW.status[C.key]==="building"?"building solver tables…":"solving…"}
  function setSub(final){const t=C.running?(performance.now()-C.t0)/1000:(C.time||0);
    if(final){subEl.textContent=`${C.moves} moves · ${fmt(C.time,2)} s · ${fmt(C.moves/C.time,1)} tps`;return}
    subEl.textContent=ui.timer?`${C.moves} moves · ${fmt(C.running?t:0,2)} s`:`${C.moves} moves`}
  function tick(){if(!C.running)return;setSub();requestAnimationFrame(tick)}
  const fb=h=>{fbEl.innerHTML=h};
  function lockAnim(ms){lockEl.style.transition="none";lockEl.style.width=ms?"100%":"0";void lockEl.offsetWidth;if(ms){lockEl.style.transition=`width ${ms}ms linear`;lockEl.style.width="0"}}
  function progUI(){if(!C.d||(!C.d.big&&!C.d.byDepth))return;const g=progress(C.d);
    barEl.style.width=(Math.min(1,g.f)*100).toFixed(1)+"%";progEl.textContent=g.txt+(g.nc?` · ${g.nc} reviewing`:"")}
  function load(it){clearTimers();C.it=it;C.b=it.b.slice();C.moves=0;C.path="";C.running=false;C.time=0;C.div=null;
    C.d.lastK=keyOf(C.d,it.b);render();boardCls("");fb("");seqEl.innerHTML="";tagEl.textContent=it.label||"";
    const ms=Math.round(ui.buf*1000);C.lockUntil=performance.now()+ms;lockAnim(ms);
    if(ms>0){C.phase="lock";boardEl.classList.add("locked");later(()=>{if(C.it===it&&C.phase==="lock"){C.phase="solve";boardEl.classList.remove("locked")}},ms)}
    else{C.phase="solve";boardEl.classList.remove("locked")}
    setTarget();setSub()}
  function next(){clearTimers();const d=C.d;if(!d||(!d.big&&!d.byDepth))return;
    const it=pick(d);
    if(!it.ready){C.phase="wait";C.it=it;C.b=goal(d.P.w*d.P.h);render();boardCls("dim");boardEl.classList.remove("locked");lockAnim(0);tagEl.textContent=it.label||"";fb("");seqEl.innerHTML="";setTarget();subEl.textContent="";return}
    load(it)}
  function onItem(it){if(it!==C.it)return;
    if(C.phase==="wait"&&it.ready){if(it.genFail){const r=mkBig(C.d,"random");C.it=r;load(r)}else load(it);return}
    if(C.phase==="lock"||C.phase==="solve")setTarget();
    if(C.phase==="await"){if(it.opt!=null){setTarget();judgeFlow()}else if(it.fail){setTarget();fb(`${C.moves} moves · optimal not found for this scramble`);later(next,1500)}}}
  function canMove(){if(C.phase==="lock"&&performance.now()>=C.lockUntil){C.phase="solve";boardEl.classList.remove("locked")}return C.phase==="solve"}
  function step(k){const z=C.b.indexOf(0);if(!C.running){C.running=true;C.t0=performance.now();requestAnimationFrame(tick)}
    C.path+=tileLetter(z,k,C.d.P.w);C.b[z]=C.b[k];C.b[k]=0;C.moves++}
  function after(){render();if(solved(C.b))finish();else if(!ui.timer)setSub()}
  function moveDir(L){if(!canMove())return;const P=C.d.P,z=C.b.indexOf(0),x=z%P.w,y=(z/P.w)|0;let k=-1;
    if(L==="L"&&x<P.w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<P.h-1)k=z+P.w;if(L==="D"&&y>0)k=z-P.w;if(k<0)return;step(k);after()}
  function toCell(i){if(!canMove())return;const P=C.d.P;let z=C.b.indexOf(0);if(i===z)return;const zx=z%P.w,zy=(z/P.w)|0,ix=i%P.w,iy=(i/P.w)|0;
    if(zy===iy){const s=ix>zx?1:-1;while(z!==i){step(z+s);z+=s}}else if(zx===ix){const s=iy>zy?P.w:-P.w;while(z!==i){step(z+s);z+=s}}else return;after()}
  function finish(){C.running=false;C.time=(performance.now()-C.t0)/1000;C.mv=C.moves;C.mine=C.path;setSub(true);
    const it=C.it,ses=store.get("ssa3-"+C.key)||[];ses.push({t:+C.time.toFixed(3),m:C.moves,o:it.opt});if(ses.length>1000)ses.shift();store.set("ssa3-"+C.key,ses);C.sesIdx=ses.length-1;
    if(it.opt==null){if(it.fail){C.phase="done";fb(`${C.moves} moves · optimal not found for this scramble`);later(next,1500);return}
      C.phase="await";fb("finding the optimal…");return}
    judgeFlow()}
  function judgeFlow(){const it=C.it;
    const ses=store.get("ssa3-"+C.key)||[];if(ses[C.sesIdx]&&ses[C.sesIdx].o==null){ses[C.sesIdx].o=it.opt;store.set("ssa3-"+C.key,ses)}
    const note=judge(C.d,it,C.mv);progUI();
    if(C.mv===it.opt){C.phase="done";boardCls("good");
      fb(`<b class="z-ok">✓ optimal</b>${note?` <span class="z-mute">· ${note}</span>`:""}`);later(next,600)}
    else startReview(note)}

  /* ---------- miss review: show where it went wrong ---------- */
  function divergeExact(key,b0,path){const {w,h}=PUZ[key],T=table(key),b=b0.slice();let d=T.dist.get(b.join(""));
    for(let i=0;i<path.length;i++){applyLetter(b,w,h,path[i]);const nd=T.dist.get(b.join(""));
      if(nd!==d-1){const pre=b0.slice();for(let j=0;j<i;j++)applyLetter(pre,w,h,path[j]);return{k:i,cont:optimal(key,pre)}}d=nd}
    return{k:0,cont:optimal(key,b0)}}
  function startReview(note){const it=C.it,d=C.d,over=C.mv-it.opt;C.phase="review";boardCls("bad");
    C.head=`<b class="z-bad">+${over}</b> <span class="z-mute">· optimal ${it.opt} · ${note}</span>`;
    fb(C.head+`<div class="z-why">finding where it went wrong…</div>`);
    const go=div=>{if(C.it!==it||C.phase!=="review")return;C.div=div;playReview()};
    if(!d.big)go(divergeExact(d.key,it.b,C.mine));
    else anaW.post({type:"diverge",key:d.key,board:it.b,path:C.mine,opt:it.opt,sol:it.sol},m=>go(m.fail?{k:0,cont:it.sol,full:true}:{k:m.k,cont:m.cont}))}
  function hintTile(L,b){const P=C.d.P,z=b.indexOf(0);const k=L==="L"?z+1:L==="R"?z-1:L==="U"?z+P.w:z-P.w;if(C.cells[k])C.cells[k].classList.add("hint")}
  const ARROW={L:"←",R:"→",U:"↑",D:"↓"};
  function seqHTML(pre,cont,j){return `<span class="z-pre">${pre}</span>${pre.length?'<span class="z-cut"></span>':""}`+[...cont].map((c,i)=>`<span class="${i<j?"z-done":i===j?"z-now":""}">${c}</span>`).join("")}
  function playReview(){clearTimers();const it=C.it,div=C.div,P=C.d.P,b=it.b.slice();C.phase="review";C.b=b;render();boardCls("bad");
    const pre=C.mine.slice(0,div.k),cont=div.cont||"";
    const why=div.full?"Couldn't pin down the exact move in time. Here is the full optimal solution."
      :div.k===0?`Your first move (${ARROW[C.mine[0]]}) already left the optimal path. Optimal starts ${ARROW[cont[0]]}.`
      :`Your first ${div.k} move${div.k>1?"s were":" was"} optimal. On move ${div.k+1} you went ${ARROW[C.mine[div.k]]}; optimal goes ${ARROW[cont[0]]}.`;
    fb(C.head+`<div class="z-why">${why}</div><div class="z-btns"><button class="z-link" data-z="replay">replay (R)</button><button class="z-link" data-z="next">next (space)</button></div>`);
    seqEl.innerHTML=seqHTML(pre,cont,-1);
    const iv=ui.pace==="auto"?Math.max(160,Math.min(480,6500/Math.max(1,cont.length))):1000/+ui.pace;
    let i=0,j=0;
    const preStep=()=>{if(i<pre.length){applyLetter(b,P.w,P.h,pre[i]);i++;render();later(preStep,70)}else{render();if(cont.length)hintTile(cont[0],b);later(contStep,pre.length?750:500)}};
    const contStep=()=>{if(j<cont.length){applyLetter(b,P.w,P.h,cont[j]);j++;render();seqEl.innerHTML=seqHTML(pre,cont,j);later(contStep,iv)}
      else{boardCls("good");later(()=>{if(C.phase==="review")next()},1400)}};
    later(preStep,350)}

  /* ---------- tabs, panel, fullscreen ---------- */
  const tabs=[...root.querySelectorAll('.seg [role="tab"]')];
  function select(key){if(!PUZ[key])return;clearTimers();C.running=false;C.key=key;C.d=data(key);ui.tab=key;saveUI();
    tabs.forEach(t=>{const on=t.dataset.key===key;t.setAttribute("aria-selected",on);t.tabIndex=on?0:-1});
    buildCells();layout();C.it=null;C.b=goal(C.d.P.w*C.d.P.h);render();boardCls("dim");fb("");seqEl.innerHTML="";tagEl.textContent="";subEl.textContent="";
    if(panelOpen())fillPanel();
    if(!C.d.big&&!C.d.byDepth){C.phase="build";setTarget();setTimeout(()=>{if(C.key!==key)return;prepExact(C.d);progUI();next()},40)}
    else{progUI();next()}}
  tabs.forEach(t=>t.addEventListener("click",e=>{e.currentTarget.blur();select(t.dataset.key)}));
  const panelOpen=()=>!panel.hidden;
  function closePanel(){if(!panel.hidden){panel.hidden=true;$("zGear").setAttribute("aria-expanded","false")}}
  function fillPanel(){const d=C.d,key=C.key;
    $("zSize").value=ui.size[key];$("zPre").checked=ui.pre;$("zHover").checked=ui.hover;$("zTimer").checked=ui.timer;$("zBuf").value=String(ui.buf);$("zPace").value=String(ui.pace);
    const opts=key==="3x2"?[["auto","Every position, easiest first"],["random","Random positions"]]
      :key==="3x3"?[["auto","Depth by depth"],...Array.from({length:31},(_,i)=>i+1).filter(i=>!d.byDepth||(d.byDepth[i]||[]).length).map(i=>["d:"+i,`Only depth ${i}${d.byDepth?` (${d.byDepth[i].length})`:""}`]),["random","Random state"]]
      :[["auto","Level by level"],...LEVELS[key].map(([a,b],i)=>["l:"+i,`Only level ${i+1} (optimal ${a}–${b})`]),["random","Random state"]];
    $("zPool").innerHTML=opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");$("zPool").value=d.prog.src||"auto";
    $("zPuz").textContent=key;$("zPuz2").textContent=key;
    const s=(store.get("ssa3-"+key)||[]).slice(-100),wo=s.filter(x=>x.o!=null);
    const st=s.length?{t:s.reduce((a,x)=>a+x.t,0)/s.length,m:s.reduce((a,x)=>a+x.m,0)/s.length}:null;
    const nm=d.big?Object.values(d.prog.levels).reduce((a,b)=>a+b,0):Object.keys(d.prog.mastered).length,nc=Object.keys(d.prog.cards).length;
    $("zStats").innerHTML=st?`<div><b>${fmt(st.t)}</b><span>mean s</span></div><div><b>${fmt(st.m,1)}</b><span>moves</span></div><div><b>${wo.length?"+"+fmt(wo.reduce((a,x)=>a+x.m-x.o,0)/wo.length,1):"—"}</b><span>over opt</span></div><div><b>${fmt(st.m/st.t,1)}</b><span>tps</span></div>`:`<p class="note" style="margin:0">No solves yet.</p>`;
    $("zCounts").textContent=`last ${s.length} solves · ${nm} cases cleared · ${nc} in review`;
    $("zUse").hidden=!(key==="3x3"||key==="4x4")||!s.length;
    $("zConfirm").hidden=true;$("zConfirmAll").hidden=true}
  $("zGear").addEventListener("click",e=>{e.currentTarget.blur();if(panelOpen())closePanel();else{fillPanel();panel.hidden=false;e.currentTarget.setAttribute("aria-expanded","true")}});
  $("zClose").addEventListener("click",closePanel);
  $("zSize").addEventListener("input",e=>{ui.size[C.key]=+e.target.value;saveUI();layout()});
  $("zPre").addEventListener("change",e=>{ui.pre=e.target.checked;saveUI();setTarget()});
  $("zHover").addEventListener("change",e=>{ui.hover=e.target.checked;saveUI()});
  $("zTimer").addEventListener("change",e=>{ui.timer=e.target.checked;saveUI();if(C.phase==="solve"||C.phase==="lock")setSub()});
  $("zBuf").addEventListener("change",e=>{ui.buf=+e.target.value;saveUI()});
  $("zPace").addEventListener("change",e=>{ui.pace=e.target.value;saveUI()});
  $("zPool").addEventListener("change",e=>{C.d.prog.src=e.target.value;save(C.d);C.d.pf={src:null,items:[]};progUI();next()});
  $("zUse").addEventListener("click",()=>{const s=(store.get("ssa3-"+C.key)||[]).slice(-100),L=s.length;if(!L)return;
    document.getElementById("advSize").value=C.key;document.getElementById("advAvg").value=L>=100?"100":L>=50?"50":L>=12?"12":"5";
    document.getElementById("advMoves").value=(s.reduce((x,y)=>x+y.m,0)/L).toFixed(1);document.getElementById("advTime").value=(s.reduce((x,y)=>x+y.t,0)/L).toFixed(3);
    document.getElementById("advNote").textContent=`Using your last ${L} trainer solves (mean, not a trimmed average).`;
    advisor.update(true);closePanel();if(isFS())toggleFS();location.hash="#advisor"});
  function wipe(key){["ssa-v3-","ssa-prog-v1-","ssa3-"].forEach(p=>{try{localStorage.removeItem(p+key)}catch(e){}});delete Z[key]}
  $("zReset").addEventListener("click",()=>{$("zConfirm").hidden=false});
  $("zResetNo").addEventListener("click",()=>{$("zConfirm").hidden=true});
  $("zResetYes").addEventListener("click",()=>{wipe(C.key);closePanel();select(C.key)});
  $("zWipe").addEventListener("click",()=>{$("zConfirmAll").hidden=false});
  $("zWipeNo").addEventListener("click",()=>{$("zConfirmAll").hidden=true});
  $("zWipeYes").addEventListener("click",()=>{KEYS.forEach(wipe);closePanel();select(C.key)});
  fbEl.addEventListener("click",e=>{const a=e.target.closest("[data-z]");if(!a)return;a.blur();if(a.dataset.z==="replay"&&C.div)playReview();if(a.dataset.z==="next")next()});
  stage.addEventListener("pointerdown",e=>{if(!e.target.closest("#zPanel"))closePanel()});

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
    if(e.key===" "||e.key==="Enter"){e.preventDefault();if(C.phase!=="wait"&&C.phase!=="build")next();return}
    if(e.key==="r"||e.key==="R"){if(C.div&&(C.phase==="review"||C.phase==="done")){e.preventDefault();playReview()}return}
    if(e.key==="f"||e.key==="F"){e.preventDefault();toggleFS();return}
    if(/^[1-4]$/.test(e.key)){e.preventDefault();select(KEYS[+e.key-1])}});

  return{start(){select(KEYS.includes(ui.tab)?ui.tab:"3x2")},select,layout,
    exitPseudo(){if(root.classList.contains("pfs"))setPseudo(false)}};
})();
