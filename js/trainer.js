/* Zen trainer: every puzzle is trained with a chosen method, step by step, each step graded against its exact standard */
"use strict";
const ZEN=(function(){
  const KEYS=["3x2","3x3","4x3","4x4","seq"];
  const DEFAULT={"3x2":"opt","3x3":"opt","4x3":"col","4x4":"pairs"};
  const PER=10;                        // cases per 3x3 depth in the depth-by-depth progression
  const STEPS=[3,8,25,"break"];        // after a miss: standard again after 3, 8, 25 solves, then after an 8 h break
  const BREAK_MS=8*3600e3;
  const ui=Object.assign({tab:"3x2",pre:true,stats:false,hover:true,timer:true,buf:1,pace:"auto",size:{}},store.get("ssa-ui-v3")||{});
  if(!ui.hv1){ui.hover=true;ui.hv1=1}   // hover became the default; switch it on once for earlier visitors
  ui.meth=ui.meth||{};ui.rng=ui.rng||{};ui.custom=ui.custom||{};ui.alt=ui.alt||{};ui.pick=ui.pick||{};ui.merge=ui.merge||{};ui.flex=ui.flex||{};
  if("alt23" in ui){ui.alt["3x2"]=!!ui.alt23;delete ui.alt23}
  ["3x2","3x3","4x3","4x4","seq"].forEach(k=>{if(!ui.size[k])ui.size[k]=80});
  const saveUI=()=>store.set("ssa-ui-v3",ui);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
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
  /* ---------- transposed shapes ----------
     tmap(A,B): the label at (x,y) on puzzle A goes to (y,x) on puzzle B (A and B transposes of each other, or A=B square).
     The 3x2 and 4x3 trainers can also serve their transposed shape (2x3: column 6-10-14 solved first; 3x4: column
     1-5-9-13 solved first). Those cases are kept apart (keys prefixed "2x3:" / "3x4:") and join the pool only while the
     option is on; the method's tiles map across (10-14 becomes 7-8, column 5-9-13 becomes row 2-3-4). */
  const altPk=key=>ALT[key]&&ui.alt[key]?ALT[key].pk:null;
  const isAltKey=k=>k.indexOf(":")>0;


  /* ---------- pick mode (3x3, 4x4): the solver chooses the first row or column ----------
     Square boards map onto themselves when transposed, so every row method has a column twin (1-2 / 3-4 and
     1-5 / 9-13). Each case first asks row or column; the pick is right when its line is at least as good as the
     other (the first step's standard when that step is the whole line, so set-up methods compare set-ups; otherwise
     the line's own optimum). The chosen orientation is then solved with the method, turned to match. */
  const PICKM={};

  /* ---------- Sequence trainer ----------
     A range of stages solved on one board: scrambles start as the "from" puzzle and the attempt ends at the "through"
     point. Each stage is graded with the method chosen for it (set-ups graded as set-ups, and then you solve what you
     set up). A stage whose method finishes the puzzle (e.g. full 3x3 optimal) ends the list. Stages follow the board:
     build column 1 instead of row 1 and the next stage is a 3x4; with Mirrors on, square stages (the 4x4's and
     the 3x3's first line) accept either way round and grade the choice like pick mode. A missed step doesn't stop the
     solve; the first one is replayed at the end. */
  const SEQ_ST=["4x4","4x3","3x3","3x2"];
  const SEQ_END=[["4x3","until the 4x3 is left (row 1 done)",0],["3x3","until the 3x3 is left (first L done)",1],["3x2","until the 3x2 is left",2],["2x2","until the 2x2 is left",3],["solved","solved",3]];
  const SEQ_FROM={"4x4":"a 4x4 scramble","4x3":"a 4x3 scramble (row 1 solved)","3x3":"a 3x3 scramble (first L solved)","3x2":"a 3x2 scramble"};
  const SEQ_DEF={"4x4":"pairs","4x3":"col","3x3":"rowo","3x2":"opt"};
  ui.seq=Object.assign({start:"4x4",end:"solved"},ui.seq||{});ui.seq.m=Object.assign({},SEQ_DEF,ui.seq.m||{});
  // mirroring is per stage: mir["4x4"] / mir["3x3"] let that square stage go either way round; mir.start lets a 4x3 / 3x2 start be the 3x4 / 2x3
  if(!ui.seq.mir){const on=!!ui.seq.mirror;ui.seq.mir={start:on,"4x4":on,"3x3":on};delete ui.seq.mirror}
  const PAIR32={id:"pair",name:"10-14 pair optimal",steps:[{t:[10,14]}],desc:"Places 10 and 14, leaving the 2x2."};
  const seqEnds=start=>SEQ_END.filter(e=>e[2]>=SEQ_ST.indexOf(start)&&!(e[0]===start));
  function stageMethods(st,end){
    if(st==="3x2")return end==="2x2"?[PAIR32]:methods("3x2").filter(m=>!m.steps.some(x=>x.prefix));
    const L=methods(st).filter(m=>!m.steps.some(x=>x.prefix||x.alts));
    return L.filter(m=>!m.steps.some(x=>x.rest)||(st==="3x3"&&end==="solved"))}
  function seqStages(){const c=ui.seq;if(!seqEnds(c.start).some(e=>e[0]===c.end))c.end="solved";
    const a=SEQ_ST.indexOf(c.start),b=SEQ_END.find(e=>e[0]===c.end)[2],out=[];
    for(let i=a;i<=b;i++){const st=SEQ_ST[i],L=stageMethods(st,c.end),M=L.find(m=>m.id===c.m[st])||L.find(m=>m.id===SEQ_DEF[st])||L[0];
      out.push({st,M,L});if(st!=="3x2"&&M.steps.some(x=>x.rest))break}
    return out}
  const SEQM={};
  function seqMethod(){const c=ui.seq,stg=seqStages(),id="seq:"+c.start+">"+c.end+(c.mir.start&&ALT[c.start]?"~m":"")+(ui.flex.seq?"~f":"")+"|"+stg.map(x=>x.st+"="+x.M.id+(c.mir[x.st]&&SQ[x.st]?"~m":"")).join(",");
    if(SEQM[id])return SEQM[id];const steps=[],si=[];stg.forEach((x,i)=>x.M.steps.forEach(sp=>{steps.push(sp);si.push(i)}));
    return SEQM[id]={id,name:`${c.start} → ${c.end==="solved"?"solved":c.end+" left"}`,steps,desc:"Sequence: "+stg.map(x=>`${x.st} ${x.M.name}`).join(" · "),
      flex:!!ui.flex.seq,seq:{stages:stg.map(x=>x.st),stg:si,mir:Object.assign({},c.mir),start:c.start}}}
  const altOn=S=>S.M.seq?(S.M.seq.mir.start&&ALT[S.d.key]?ALT[S.d.key].pk:null):altPk(S.d.key);
  function pickMethod(key,M){const line=lineOf(key,M);if(!line)return null;const id=key+"|"+M.id;
    return PICKM[id]||(PICKM[id]=Object.assign({},M,{id:M.id+"~pick",base:M.base||M.id,pick:{line}}))}
  const FLEXM={};
  function flexMethod(key,M){const id=key+"|"+M.id;return FLEXM[id]||(FLEXM[id]=Object.assign({},M,{id:M.id+"~flex",base:M.base||M.id,flex:true}))}
  /* review cards in play: other-finish cards wait while the option is off */
  const activeCards=S=>Object.keys(S.prog.cards).filter(k=>!isAltKey(k)||altOn(S)===k.slice(0,k.indexOf(":")));
  function depthLists(pk,pfx){const T=table(pk),L=Array.from({length:T.max+1},()=>[]);for(const [k,v] of T.dist)if(v)L[v].push(pfx+k);return L}
  const byHash=a=>a.slice().sort((x,y)=>strHash(x)-strHash(y));
  function prepExact(d){if(!d.exact||d.byDepth)return;const T=table(d.key);d.byDepth=Array.from({length:T.max+1},()=>[]);
    for(const [k,v] of T.dist){if(v===0)continue;if(redundantExact(d.key,[...k].map(Number))){d.skip.add(k);continue}d.byDepth[v].push(k)}
    const p=d.classic;let pruned=false;for(const k in p.cards)if(d.skip.has(k)){delete p.cards[k];pruned=true}if(pruned)store.set("ssa-v3-"+d.key,p);
    if(ALT[d.key])d.byDepthAlt=depthLists(ALT[d.key].pk,ALT[d.key].pk+":");
    if(d.key==="3x2"){d.order=[];d.orderAlt=[];for(let i=1;i<d.byDepth.length;i++){d.order.push(...byHash(d.byDepth[i]));d.orderAlt.push(...byHash(d.byDepth[i].concat(d.byDepthAlt[i]||[])))}}
    recount(d)}
  function recount(d){if(!d.byDepth)return;const T=table(d.key);d.mcount=d.byDepth.map(()=>0);for(const k in d.classic.mastered){const v=T.dist.get(k);if(v&&!d.skip.has(k))d.mcount[v]++}}

  /* ---------- method state: progress, history and review cards per puzzle + method ---------- */
  const PARSED={};
  const parsed=(key,c)=>{const id=key+"|"+c;if(!(id in PARSED)){try{PARSED[id]=METHODS.parse(key,c)}catch(e){PARSED[id]=null}}return PARSED[id]};
  const methods=key=>METHODS.list(key,(ui.custom[key]||[]).map(c=>parsed(key,c)).filter(Boolean));
  function baseMethod(key){const L=methods(key),id=ui.meth[key]||DEFAULT[key];return L.find(m=>m.id===id)||L.find(m=>m.id===DEFAULT[key])||L[0]}
  function curMethodNoPick(key){let M=baseMethod(key);if(ui.flex[key]&&orderable(M.steps))M=flexMethod(key,M);return M}
  function curMethod(key){if(key==="seq")return seqMethod();let M=baseMethod(key);if(ui.flex[key]&&orderable(M.steps))M=flexMethod(key,M);return ui.pick[key]&&pickMethod(key,M)||M}
  function mstate(d,M){if(d.ms[M.id])return d.ms[M.id];const classic=M.id==="opt"&&d.exact;
    const pk=classic?"ssa-v3-"+d.key:"ssa-m-"+d.key+"-"+M.id,hk=classic?"ssa3-"+d.key:"ssa4-"+d.key+"-"+M.id;
    let prog=classic?d.classic:store.get(pk);if(!prog)prog={clock:0,cards:{}};prog.cards=prog.cards||{};prog.clock=prog.clock||0;
    const sep=classic?"":",";
    const body=k=>{const i=k.indexOf(":");return i>0?k.slice(i+1):k};
    return d.ms[M.id]={d,M,classic,pk,hk,prog,drill:null,lastK:null,ready:false,
      kof:(b,p)=>(p&&p!==d.key?p+":":"")+b.join(sep),pkOf:k=>{const i=k.indexOf(":");return i>0?k.slice(0,i):d.key},
      fromKey:k=>classic?[...body(k)].map(Number):body(k).split(",").map(Number)}}
  const save=S=>store.set(S.pk,S.prog);
  /* solve history, kept in memory (parsing up to 1000 saved solves on every look was a cost); writes go through setHist */
  const HC={};
  const hist=S=>HC[S.hk]||(HC[S.hk]=store.get(S.hk)||[]);
  function setHist(S,h){HC[S.hk]=h;store.set(S.hk,h)}
  const histForget=()=>{for(const k in HC)delete HC[k]};
  /* after the browser has drawn the current frame: for work that must not hold up a move appearing */
  const afterPaint=fn=>requestAnimationFrame(()=>setTimeout(fn,0));
  /* soon(fn): a new task right away (a message, not a clamped timer). sliced(gen): runs a pausable search ~4 ms at a
     time, each slice its own task so frames keep coming; job.finish() completes it at once if the answer is needed. */
  const mq=[],mc=new MessageChannel();mc.port1.onmessage=()=>{const f=mq.shift();if(f)f()};const soon=f=>{mq.push(f);mc.port2.postMessage(0)};
  const SLICE=4;
  function sliced(gen,cb,wait){const job={done:false,val:undefined,dead:false};
    const end=v=>{job.done=true;job.val=v;if(cb&&!job.dead)cb(v)};
    job.finish=()=>{if(!job.done){let r;while(!(r=gen.next()).done);end(r.value)}return job.val};
    const step=()=>{if(job.done||job.dead)return;if(wait&&wait()){setTimeout(step,300);return}
      const t=performance.now();let r;while(performance.now()-t<SLICE){r=gen.next();if(r.done){end(r.value);return}}soon(step)};
    soon(step);return job}
  function first(S,pk){pk=pk||S.d.key;return METHODS.resolve(pk,stepsFor(S,pk)[0],[])}
  function depthOf(S,b,pk){return first(S,pk).f(b)}
  function range(S){const inf=METHODS.depthInfo(S.d.key,S.M),r=ui.rng[S.d.key+":"+S.M.id]||[1,inf.max];return[Math.max(1,Math.min(r[0],inf.max)),Math.max(1,Math.min(r[1],inf.max))]}
  /* ---------- bigger steps when ready ----------
     Your reliable depth is the largest step optimum D where you meet the standard on at least 80% of your steps of
     D moves or fewer (last 300 solves of this method, at least 20 such steps and 3 within 3 moves of D). At the start
     of every step, if this step and the ones after it can be done as one, and that combined optimum is at most D,
     you get the combined step: it is never longer than doing them one by one, and it's within what you already solve. */
  const mergeMode=key=>ui.merge[key]||"auto";
  const RD={};
  function reliableDepth(S){const h=hist(S),id=S.hk+"|"+h.length+"|"+(h.length&&h[h.length-1].t);if(RD[S.hk]&&RD[S.hk].id===id)return RD[S.hk].D;
    const r=[];h.slice(-300).forEach(e=>{if(e.r)e.r.forEach(x=>r.push(x));else if(S.M.steps.length===1&&e.d!=null)r.push([e.d,e.p?1:0])});
    r.sort((a,b)=>a[0]-b[0]);let D=0,ok=0;
    for(let i=0;i<r.length;i++){ok+=r[i][1];const d=r[i][0];if(i+1<r.length&&r[i+1][0]===d)continue;
      const n=i+1,near=r.filter(x=>x[0]>d-3&&x[0]<=d).length;if(n>=20&&ok/n>=.8&&near>=3)D=d}
    RD[S.hk]={id,D};return D}
  function mergeLimit(S){const m=mergeMode(S.d.key);return m==="off"?0:m==="auto"?reliableDepth(S):+m}
  /* Build every table the method needs (one dry run through its steps). */
  function prepare(S){if(S.ready)return;if(S.classic)prepExact(S.d);
    const runs=[[S.d.key,false]];if(ALT[S.d.key])runs.push([ALT[S.d.key].pk,false]);if(S.M.pick)runs.push([S.d.key,true]);
    // a sequence on a square board can turn (column 1 first makes every later stage transposed); a 4x3 / 3x2 start's
    // turned version is its own board (3x4 / 2x3), covered by the run above
    if(S.M.seq&&PUZ[S.d.key].w===PUZ[S.d.key].h)runs.push([S.d.key,"T"]);
    runs.forEach(([key,flip])=>{let walls=[];const all=flip==="T"?S.M.steps.map(sp=>mapSpec(sp,T4)):stepsFor(S,key,flip);
    for(let i=0;i<all.length;i++){const sp=all[i];
      // tables for the bigger steps this method can turn into from here
      if(mergeMode(S.d.key)!=="off")for(let j=all.length-1;j>i;j--){const m=METHODS.merge(all.slice(i,j+1));if(m&&METHODS.mergeable(key,m,walls)){try{METHODS.resolve(key,m,walls)}catch(e){}}}
      const R=METHODS.resolve(key,sp,walls),b=METHODS.fillBoard(key,walls,null);if(b)METHODS.standard(key,R,walls,b);
      R.alts.forEach(a=>{const w2=walls.concat(a.map(METHODS.home));if(sp.la)METHODS.resolve(key,sp.la.next,w2)});
      if(sp.prefix||R.rest)break;walls=walls.concat(R.alts[0].map(METHODS.home))}});
    // a few solves played through every plan, orientation and order build the tables those choices use, so none has
    // to be built in the middle of a solve
    if(S.M.seq||S.M.pick||S.M.flex||S.M.steps.length>1)for(let i=0;i<12;i++){try{simSolve(S)}catch(e){}}
    S.ready=true}

  /* ---------- classic progression (full 3x2 / 3x3 optimal) ---------- */
  function learnCounts(S){const c={};for(const k in S.prog.cards){const v=S.prog.cards[k].d;if(v!=null)c[v]=(c[v]||0)+1}return c}
  function classicSrc(S){const d=S.d;if(d.key==="3x2")return "ord";
    const lc=learnCounts(S);for(let i=1;i<d.byDepth.length;i++)if(d.mcount[i]+(lc[i]||0)<Math.min(d.byDepth[i].length,PER))return "d:"+i;return null}
  function classicProgress(S){const d=S.d,p=S.prog;
    if(d.key==="3x2"){const ks=Object.keys(p.mastered),ma=ks.filter(isAltKey).length,alt=!!altPk(d.key),m=ks.length-(alt?0:ma),t=alt?718:359;
      return{f:m/t,txt:(m>=t?`all ${t} solved optimally`:`${m} / ${t} solved optimally`)+(alt?` · 2x3 ${ma} / 359`:"")}}
    let a=0,t=0;for(let i=1;i<d.byDepth.length;i++){const tg=Math.min(d.byDepth[i].length,PER);t+=tg;a+=Math.min(d.mcount[i],tg)}
    const s=classicSrc(S);return{f:a/t,txt:`${a} / ${t} cases`+(s?(ui.pre?" · depth "+s.slice(2):""):" · all depths done · random states")}}
  function classicItem(S){const d=S.d,p=S.prog,s=classicSrc(S);if(!s)return null;let k;
    if(s==="ord"){k=(altPk(d.key)?d.orderAlt:d.order).find(x=>!p.mastered[x]&&!p.cards[x]);if(!k)return null}
    else{const arr=d.byDepth[+s.slice(2)]||[],un=arr.filter(x=>!p.mastered[x]&&!p.cards[x]),pool=un.length?un:arr;if(!pool.length)return null;k=pool[Math.floor(Math.random()*pool.length)]}
    const pk=S.pkOf(k),b=S.fromKey(k),dep=depthOf(S,b,pk);return{b,pk,depth:dep,isNew:!p.mastered[k],parts:altTag(pk).concat([{t:p.mastered[k]?"already solved":"new case"},{t:"depth "+dep,d:1}])}}
  const altTag=pk=>PUZ[pk].variantOf?[{t:PUZ[pk].tag}]:[];

  /* ---------- picking scrambles ---------- */
  function randomItem(S){const d=S.d,[lo,hi]=range(S),ap=altOn(S);let b=null,pk=d.key;
    if(S.classic){const lists=[d.byDepth].concat(ap?[d.byDepthAlt]:[]);let tot=0;lists.forEach(L=>{for(let i=lo;i<=hi;i++)tot+=(L[i]||[]).length});
      if(tot){let r=Math.floor(Math.random()*tot);out:for(const L of lists)for(let i=lo;i<=hi;i++){const a=L[i]||[];if(r<a.length){b=S.fromKey(a[r]);pk=S.pkOf(a[r]);break out}r-=a.length}}}
    else{if(ap&&Math.random()<.5)pk=ap;b=METHODS.sampleFirst(pk,first(S,pk),lo,hi)}
    if(!b)b=METHODS.fillBoard(pk,[],null);
    const dep=depthOf(S,b,pk),full=lo===1&&hi===METHODS.depthInfo(d.key,S.M).max;
    return{b,pk,depth:dep,isNew:S.classic?!S.prog.mastered[S.kof(b,pk)]:true,parts:altTag(pk).concat(full?[{t:"random"},{t:"depth "+dep,d:1}]:[{t:"depth "+(lo===hi?lo:lo+"–"+hi)+" band",d:1},{t:"depth "+dep,d:1}])}}
  function cardItem(S,k){const c=S.prog.cards[k],pk=S.pkOf(k),b=S.fromKey(k),dep=depthOf(S,b,pk);return{b,pk,card:k,depth:dep,parts:altTag(pk).concat([{t:`review · ${c.step} of ${STEPS.length} done`},{t:"depth "+dep,d:1}])}}
  function pick(S){if(S.drill)return drillPick(S);const p=S.prog,now=Date.now();let best=null;
    for(const k of activeCards(S)){const c=p.cards[k];if(k===S.lastK)continue;if(c.due<=p.clock&&(c.dueT||0)<=now&&(!best||c.due<p.cards[best].due))best=k}
    if(best)return cardItem(S,best);
    if(S.classic&&p.src==="auto"){const it=classicItem(S);if(it)return it}
    return randomItem(S)}

  /* ---------- review drill: only cases in review, until each meets the standard DRILL times in a row ---------- */
  const DRILL=2;
  function drillLeft(S){return activeCards(S).filter(k=>(S.drill.streak[k]||0)<DRILL)}
  function drillPick(S){const ks=drillLeft(S);if(!ks.length)return null;
    const pool=ks.length>1?ks.filter(k=>k!==S.lastK):ks,lo=Math.min(...pool.map(k=>S.drill.streak[k]||0)),c=pool.filter(k=>(S.drill.streak[k]||0)===lo);
    const k=c[Math.floor(Math.random()*c.length)],it=cardItem(S,k);it.parts=[{t:`drill · ${S.drill.streak[k]||0} of ${DRILL} in a row`},{t:"depth "+it.depth,d:1}];return it}
  /* Drill solves leave the spaced-repetition schedule untouched. */
  function drillJudge(S,it,hit){const k=S.kof(it.b,it.pk),st=S.drill.streak;
    if(hit){st[k]=(st[k]||0)+1;return st[k]>=DRILL?"drilled · out of this drill":`${DRILL-st[k]} more in a row`}
    st[k]=0;return "streak reset"}
  function setDrill(on){const S=C.S;if(!S)return;S.drill=on?{streak:{}}:null;closePanel();drillUI();progUI();next()}
  function drillUI(){const b=$("zDrill"),S=C.S;if(!b||!S)return;const n=activeCards(S).length;
    b.innerHTML=S.drill?'Back<span class="zl"> to training</span>':`Drill<span class="zl"> reviews</span>${n?` (${n})`:""}`;b.setAttribute("aria-pressed",S.drill?"true":"false");b.classList.toggle("on",!!S.drill);
    b.disabled=!S.drill&&!n;b.title=S.drill?"Return to normal training":n?"Practice only the cases in review":"No cases in review yet"}
  function drillDone(){const S=C.S,n=activeCards(S).length;C.phase="done";C.it=null;C.R=null;C.b=goal(C.P.w*C.P.h);render();boardCls("good");lockAnim(0);boardEl.classList.remove("locked");
    targetEl.innerHTML=n?`<b>${n}</b> review case${n>1?"s":""} drilled`:"nothing in review";tagEl.textContent="";subEl.textContent="";seqEl.innerHTML="";stepsUI();
    fb(`<b class="z-ok">✓ ${n?"every review case met the standard "+DRILL+" times in a row":"no cases left in review"}</b><div class="z-btns">${n?'<button class="z-link" data-z="drill">drill again</button>':""}<button class="z-link" data-z="exit">back to training</button></div>`)}

  /* ---------- spaced repetition ---------- */
  function sched(p,c){const s=STEPS[c.step];if(s==="break"){c.due=p.clock+5;c.dueT=Date.now()+BREAK_MS}else{c.due=p.clock+s;c.dueT=0}}
  function judge(S,it,hit){const p=S.prog;p.clock++;const k=S.kof(it.b,it.pk);let c=p.cards[k],note="";
    const master=()=>{if(S.classic){p.mastered[k]=1;recount(S.d)}};
    if(c){if(hit){c.step++;if(c.step>=STEPS.length){delete p.cards[k];master();note="learned · leaves the pool"}
        else{sched(p,c);note=c.dueT?"next review after an 8 h break":`review ${c.step} of ${STEPS.length} · next in ${c.due-p.clock} solves`}}
      else{c.step=0;c.n++;delete c.dueT;sched(p,c);note="back in 3 solves"}}
    else if(hit){if(it.isNew!==false)master()}
    else{c=p.cards[k]={step:0,n:1};if(it.depth!=null)c.d=it.depth;sched(p,c);note="back in 3 solves";
      const ks=Object.keys(p.cards);if(ks.length>400)delete p.cards[ks[0]]}
    save(S);return note}

  /* ---------- current solve ---------- */
  const C={key:null,pk:null,P:null,steps:null,d:null,S:null,it:null,b:null,moves:0,t0:0,running:false,phase:"idle",lockUntil:0,timers:[],cells:[],rv:null,
    si:0,walls:[],R:null,sb:null,sp:"",std:null,dcur:0,res:[],streak:0};
  const clearTimers=()=>{C.timers.forEach(clearTimeout);C.timers=[]};
  /* a step's standard can take a while (set-ups search ahead), so it is worked out just after the move that started
     the step has been drawn, or right away if something needs it sooner */
  let stdV=null,stdF=null,stdJob=null;
  Object.defineProperty(C,"std",{configurable:true,enumerable:true,get(){if(stdF){const f=stdF;stdF=null;stdV=f()}return stdV},set(v){if(stdJob)stdJob.dead=true;stdJob=null;stdF=null;stdV=v}});
  const stdPending=()=>!!stdF;
  function stdLater(gen){if(stdJob)stdJob.dead=true;const job=stdJob=sliced(gen,v=>{if(stdJob===job){stdV=v;stdF=null;stdJob=null;setTarget()}});stdF=()=>job.finish()}
  const later=(fn,ms)=>{C.timers.push(setTimeout(fn,ms))};
  function buildCells(){const P=C.P;boardEl.innerHTML="";boardEl.style.gridTemplateColumns=`repeat(${P.w},auto)`;C.cells=[];
    for(let i=0;i<P.w*P.h;i++){const t=document.createElement("button");t.type="button";t.tabIndex=-1;
      t.addEventListener("pointerdown",e=>{e.preventDefault();closePanel();toCell(i)});
      t.addEventListener("pointerenter",e=>{if(ui.hover&&e.pointerType==="mouse")toCell(i)});
      boardEl.appendChild(t);C.cells.push(t)}}
  // touch/pen: dragging a finger across the board moves the gap to the tile under it (hover mode)
  boardEl.addEventListener("pointermove",e=>{if(!ui.hover||e.pointerType==="mouse"||!C.cells.length)return;
    const el=document.elementFromPoint(e.clientX,e.clientY),i=el?C.cells.indexOf(el.closest&&el.closest(".tile")):-1;if(i>=0)toCell(i)});
  /* tiles outside the current step are greyed; tiles placed by earlier steps keep their colour */
  function render(b,R,walls){b=b||C.b;R=R===undefined?C.R:R;walls=walls||C.walls;const P=C.P,act=R?new Set(C.plan&&R===C.R?C.plan.tiles:R.tiles):null,fz=new Set(walls.map(c=>c+1));
    b.forEach((v,i)=>{const t=C.cells[i];if(!t)return;
      if(!v){t.className="tile blank";t.textContent="";t.setAttribute("aria-label","gap");return}
      const l=P.labels[v-1],grey=act&&!act.has(v)&&!fz.has(v);t.className="tile "+(grey?"gr":sgrp(l))+(fz.has(v)&&act?" fz":"");t.textContent=l;t.removeAttribute("aria-label")})}
  const boardCls=c=>{boardEl.classList.remove("good","bad","dim");if(c)boardEl.classList.add(c)};
  function layout(){if(!C.d)return;const P=C.d.P,fs=isFS();
    const W=(root.clientWidth||Math.min(window.innerWidth,1000))-40;
    const H=fs?window.innerHeight-230:Math.min(700,window.innerHeight-150)-230;
    // with the 2x3 finish in the pool, size tiles for either orientation so they don't jump between cases
    const al=C.S&&altOn(C.S),pw=al?Math.max(P.w,P.h):P.w,ph=al?Math.max(P.w,P.h):P.h;
    const fit=Math.min(W/(pw+.3),Math.max(160,H)/(ph+.3),fs?230:150);
    boardEl.style.setProperty("--t",Math.max(28,Math.round(fit*ui.size[C.key]/100))+"px")}
  const multi=()=>C.S&&C.S.M.steps.length>1;
  /* name of what is left once `placed` cells are filled */
  function restName(key,placed){const n=PUZ[key].w*PUZ[key].h-placed;return({9:"3x3",6:"3x2",4:"2x2"})[n]||"rest"}
  const nextName=(key,R,walls)=>{const nx=R.spec.la.next;return nx.rest?restName(key,walls.length+R.alts[0].length):METHODS.stepName(key,nx)};
  function stepLabel(R,walls){const key=C.pk,sp=R.spec;walls=walls||C.walls;
    if(sp.prefix)return `first ${sp.prefix} moves`;
    if(R.rest)return walls.length?restName(key,walls.length):key;
    const nm=METHODS.stepName(key,sp);return sp.la?`${nm} + ${nextName(key,R,walls)}`:nm}
  /* while "show optimal" is off, nothing that reveals the case's optimum (standard, depth) is shown until the case ends */
  const reveal=()=>C.phase!=="pick"&&!C.plan&&(ui.pre||C.phase==="done"||C.phase==="review");
  function tagUI(){const it=C.it;let t=it&&it.parts?it.parts.filter(p=>!p.d||reveal()).map(p=>p.t).join(" · "):"";
    if(C.merged&&C.merged.length&&reveal())t+=(t?" · ":"")+C.merged.map(m=>`${m.n} steps as one: ${m.name}, ${m.d} ≤ your ${m.lim}`).join(" · ");
    tagEl.textContent=t}
  function setTarget(){const it=C.it;
    if(C.phase==="build"){targetEl.innerHTML='<span class="z-lab">building tables…</span>';return}
    if(C.plan&&C.R){const f=C.plan.firsts;targetEl.innerHTML=`<span class="z-lab">${esc(f.slice(0,-1).join(", ")+(f.length>1?" or ":"")+f[f.length-1])} first · your pick</span>`;return}
    if(C.phase==="pick"){const o=C.pickInfo;targetEl.innerHTML=`<span class="z-lab z-pq">which first?</span><button type="button" class="z-pick" data-pick="col"><kbd>${esc(KEYMAP.label(KEYMAP.keys("left")[0]||""))}</kbd>${esc(o.col.name)}</button><button type="button" class="z-pick" data-pick="row">${esc(o.row.name)}<kbd>${esc(KEYMAP.label(KEYMAP.keys("right")[0]||""))}</kbd></button>`;return}
    if(!it||!C.R)return;
    if(stdPending()&&C.phase==="solve"&&reveal()){const sp0=C.R.spec,nm=sp0.prefix?`first ${sp0.prefix} moves`:C.R.rest&&!C.walls.length?C.pk:stepLabel(C.R);
      targetEl.innerHTML=`<span class="z-lab">${esc(nm)}</span><b class="z-wait">…</b>`;return}
    const sp=C.R.spec,chips=!$("zSteps").hidden&&!sp.la,name=chips?"":sp.prefix?`first ${sp.prefix} moves`:C.R.rest&&!C.walls.length?C.pk:stepLabel(C.R),kind=C.std&&C.std.plan?"best plan total":sp.la?"best set-up":"optimal";
    targetEl.innerHTML=reveal()?`<span class="z-lab">${name?esc(name)+" · ":""}${kind}</span><b>${C.std.std}</b>`
      :`${name?`<span class="z-lab">${esc(name)}</span>`:""}<span class="z-hid">${kind} hidden</span>`}
  /* method steps as chips: done (with your moves), current, still to come */
  function stepNames(){const key=C.pk;let placed=0;
    return C.steps.map(sp=>{const n=sp.prefix?`first ${sp.prefix}`:sp.rest?(placed?restName(key,placed):key):METHODS.stepName(key,sp);placed+=sp.t?sp.t.length:sp.alts?sp.alts[0].length:0;return n})}
  function stepsUI(){const el=$("zSteps");if(!C.S||!C.it||C.phase==="pick"||C.S.M.steps.length<2||C.S.M.steps[0].prefix){el.hidden=true;el.innerHTML="";return}
    const nm=stepNames(),fin=C.phase==="done";el.hidden=false;
    el.innerHTML=nm.map((n,i)=>{const r=C.res[i];let cls="",extra="";
      const ok=r&&r.pass&&!r.pickBad;
      if(r){cls=ok?"ok":"bad";extra=`<em>${r.moves}</em>`}else if(i===C.si&&!fin)cls="now";
      if(i===C.si&&r&&!ok)cls="bad";
      return `<li class="${cls}"${r&&r.pickBad&&r.pass?' title="met its own optimum, but the other line or order was better"':""}>${ok?"✓ ":r?"✗ ":""}${esc(n)}${extra}</li>`}).join("")}
  function setSub(final){const t=C.running?(performance.now()-C.t0)/1000:(C.time||0),cell=(v,u)=>`<span><b>${v}</b>${u}</span>`;
    if(final){subEl.innerHTML=cell(C.moves,"moves")+cell(fmt(C.time,2),"s")+cell(fmt(C.moves/C.time,1),"tps");return}
    subEl.innerHTML=cell(C.moves,"moves")+(ui.timer?cell(fmt(C.running?t:0,2),"s"):"")}
  function tick(){if(!C.running)return;setSub();requestAnimationFrame(tick)}
  const fb=h=>{fbEl.innerHTML=h};
  function lockAnim(ms){lockEl.style.transition="none";lockEl.style.width=ms?"100%":"0";void lockEl.offsetWidth;if(ms){lockEl.style.transition=`width ${ms}ms linear`;lockEl.style.width="0"}}
  /* Stats over a list of solves, in terms a solver thinks in. "clean" = solves that met the method's standard (or beat
     it); a miss is any other solve, and its "extra" is the moves it went over the standard, so hard (deep) cases never
     count against you. Clean and extra are never trimmed: misses are rare, and trimming would throw away exactly the
     solves that matter. Moves and time are trimmed csTimer / Slidysim style for aoN (best and worst 5% dropped, one
     each for ao5 and ao12); "opt" is the mean standard of the same cases. */
  const stdOf=x=>x.s!=null?x.s:x.o;
  const overOf=x=>stdOf(x)==null?null:(x.v!=null?x.v:x.m)-stdOf(x);
  const okOf=x=>x.p!=null?!!x.p:overOf(x)!=null&&overOf(x)<=0;
  function tmean(a,trim){if(!a.length)return NaN;if(!trim||a.length<3)return a.reduce((x,y)=>x+y,0)/a.length;
    const c=Math.max(1,Math.ceil(a.length*.05)),b=a.slice().sort((x,y)=>x-y).slice(c,a.length-c);return b.reduce((x,y)=>x+y,0)/b.length}
  const STC=new Map();
  function statsC(S,h,a,b,trim){const x=h.slice(a,b);if(!x.length)return null;const id=S.hk+"|"+trim+"|"+x.length+"|"+x[0].t+"|"+x[x.length-1].t;
    let v=STC.get(id);if(!v){v=stats(x,trim);STC.set(id,v);if(STC.size>200)STC.delete(STC.keys().next().value)}return v}
  function stats(h,trim){const n=h.length;if(!n)return null;
    const g=h.filter(x=>stdOf(x)!=null),ms=h.filter(x=>!okOf(x)),extra=ms.reduce((a,x)=>a+Math.max(0,overOf(x)||0),0);
    const t=tmean(h.map(x=>x.t),trim),m=tmean(h.map(x=>x.m),trim);
    return{n,t,m,opt:g.length?g.reduce((a,x)=>a+stdOf(x),0)/g.length:NaN,clean:n-ms.length,miss:ms.length,extra,tps:t?m/t:NaN}}
  /* clean share as a percent that never rounds a miss away: 997 / 1000 is 99.7%, never 100% */
  function pct(c,n){if(!n)return"—";if(c===n)return"100%";const v=c/n*100;return(v>=99?Math.floor(v*10)/10:Math.floor(v))+"%"}
  /* best aoN moves, time and clean count anywhere in the saved history, cached per history length */
  let bestC={};
  /* best trimmed aoN over the saved history: one pass with a sorted sliding window (insert / remove by binary search) */
  function bestTrim(vals,w){const n=vals.length;if(n<w)return Infinity;if(w===1)return Math.min(...vals);
    const c=w<3?0:Math.max(1,Math.ceil(w*.05)),win=vals.slice(0,w).sort((x,y)=>x-y);let tot=win.reduce((a,x)=>a+x,0);
    const lb=v=>{let lo=0,hi=win.length;while(lo<hi){const m=(lo+hi)>>1;if(win[m]<v)lo=m+1;else hi=m}return lo};
    const mid=()=>{let t=tot;for(let i=0;i<c;i++)t-=win[i]+win[w-1-i];return t/(w-2*c)};
    let best=mid();for(let i=w;i<n;i++){const out=vals[i-w],inn=vals[i];win.splice(lb(out),1);win.splice(lb(inn),0,inn);tot+=inn-out;const v=mid();if(v<best)best=v}
    return best}
  const BAO={};
  function bestAo(S,h,w){const n=h.length,id=S.hk+"|"+w,first=n&&h[0].t,lastT=n&&h[n-1].t,c=BAO[id];
    if(c&&c.n===n&&c.first===first&&c.last===lastT)return c.v;
    let v;
    if(c&&c.n===n-1&&c.first===first&&n>=w){   // one solve added at the end, none dropped: only the newest window is new
      const x=statsC(S,h,n-w,n,1),cl=x.clean;v={m:Math.min(c.v.m,w===1?h[n-1].m:x.m),t:Math.min(c.v.t,w===1?h[n-1].t:x.t),c:Math.max(c.v.c,cl)}}
    else{let bc=-1;const ps=[0];h.forEach(x=>ps.push(ps[ps.length-1]+(okOf(x)?1:0)));for(let i=w;i<=n;i++)bc=Math.max(bc,ps[i]-ps[i-w]);
      v={m:bestTrim(h.map(x=>x.m),w),t:bestTrim(h.map(x=>x.t),w),c:bc}}
    BAO[id]={n,first,last:lastT,v};return v}
  /* every saved solve as one mark, 100 per row (50 on a phone, so the marks stay big enough to see), the newest at
     the bottom right, so each row is one ao100 (or ao50). A clean solve is a small dot on the baseline; a miss is a
     bar whose height grows with its extra moves (1, 2, 3, 4+), so a single slip in hundreds of solves stands out,
     and a bad run still reads as a wall of bars. */
  const narrowQ=window.matchMedia("(max-width:680px)");
  const tipOf=(h,i)=>{const n=h.length,x=h[i],ok=okOf(x),o=overOf(x),ago=n-1-i;
    return `${ago?ago+" solve"+(ago>1?"s":"")+" ago":"latest solve"} · ${ok?(o!=null&&o<0?`beat the standard by ${-o}`:"clean"):`missed${o>0?` · +${o} over the standard`:""}`} · ${fmt(x.t,2)} s${x.z?" · "+x.z:""}`};
  /* drawn on canvases (one per row) so a long history costs a few milliseconds, not thousands of page elements */
  function strip(h,per){const n=h.length,R=Math.ceil(n/per),out=[];
    for(let r=0;r<R;r++){const end=n-(R-1-r)*per;let k=0;for(let i=Math.max(0,end-per);i<end;i++)if(!okOf(h[i]))k++;
      out.push(`<canvas data-end="${end}" style="aspect-ratio:${per*10}/24" role="img" aria-label="${Math.min(per,end)} solves, ${k} missed"></canvas><span class="${k?"":"z0"}${r===R-1?" now":""}">${k}</span>`)}
    return `<div class="zl-viz" data-per="${per}"><div class="zl-leg"><span><svg viewBox="0 0 10 24" aria-hidden="true"><circle class="ok" cx="5" cy="20" r="2.4"/></svg>clean</span>`+
      `<span><svg viewBox="0 0 30 24" aria-hidden="true"><rect class="bad" x="1" y="16" width="8" height="7" rx="1.5"/><rect class="bad" x="11" y="12" width="8" height="11" rx="1.5"/><rect class="bad" x="21" y="4" width="8" height="19" rx="1.5"/></svg>missed: +1 · +2 · +4 or more</span>`+
      `<span class="zl-sub">${per} per row, newest bottom right</span><span class="zl-mh">misses</span></div><div class="zl-rows">${out.join("")}</div><p class="zl-tip" aria-live="polite"></p></div>`}
  function drawStrip(el,h){const viz=el.querySelector(".zl-viz");if(!viz)return;const per=+viz.dataset.per,cs=getComputedStyle(el),dpr=window.devicePixelRatio||1;
    const col={ok:cs.getPropertyValue("--fb").trim()||"#5cc08a",bad:cs.getPropertyValue("--you").trim()||"#f07a6e",line:cs.getPropertyValue("--line").trim()||"#3e3e3e"};
    const all=viz.querySelectorAll("canvas"),W=all.length?all[0].clientWidth:0;if(!W)return;const H=W*24/(per*10),u=W/(per*10),pw=Math.round(W*dpr),ph=Math.round(H*dpr);
    all.forEach(cv=>{if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph}
      const g=cv.getContext("2d");g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,pw,ph);g.setTransform(dpr*u,0,0,dpr*u,0,0);g.fillStyle=col.line;g.fillRect(0,23,per*10,1);
      // all dots as one shape, all bars as another: two fills per row however many solves it holds
      const end=+cv.dataset.end,sel=+(cv.dataset.sel??-1),dots=new Path2D(),bars=new Path2D();
      for(let j=0;j<per;j++){const i=end-per+j;if(i<0||i===sel)continue;const x=h[i];
        if(okOf(x)){dots.moveTo(j*10+7.4,20);dots.arc(j*10+5,20,2.4,0,7)}else{const o=overOf(x),e=Math.min(4,Math.max(1,o||1)),ht=7+4*(e-1);bars.rect(j*10+1,23-ht,8,ht)}}
      g.globalAlpha=.55;g.fillStyle=col.ok;g.fill(dots);g.globalAlpha=1;g.fillStyle=col.bad;g.fill(bars);
      if(sel>=end-per&&sel<end&&sel>=0){const j=sel-(end-per),x=h[sel];g.fillStyle=okOf(x)?col.ok:cs.getPropertyValue("--ink").trim();g.beginPath();
        if(okOf(x))g.arc(j*10+5,20,2.4,0,7);else{const o=overOf(x),e=Math.min(4,Math.max(1,o||1)),ht=7+4*(e-1);g.rect(j*10+1,23-ht,8,ht)}g.fill()}})}
  /* stats under the board: the strip of every solve, then last solve, ao5 … ao1000 as the history allows, and this session */
  const WIN=[5,12,50,100,200,500,1000];
  function liveUI(){const el=$("zLive"),b=$("zStatBtn");b.setAttribute("aria-pressed",ui.stats?"true":"false");b.classList.toggle("on",ui.stats);
    const l=ui.stats?"Hide stats (T)":"Show stats (T)";b.setAttribute("aria-label",l);b.title=l;
    el.hidden=!ui.stats;if(!ui.stats||!C.S)return;
    const S=C.S,h=hist(S),n=h.length;
    // two boxes made once: the strip (its canvases are kept and only redrawn) and the table (rebuilt)
    let sb=el.querySelector(".zl-sbox"),tb=el.querySelector(".zl-tbox");if(!sb){el.innerHTML='<div class="zl-sbox"></div><div class="zl-tbox"></div>';sb=el.querySelector(".zl-sbox");tb=el.querySelector(".zl-tbox")}
    if(!n){const ex=S.ready?simExpect(S,rr=>{if(C.S===S&&ui.stats&&rr.done)liveSoon()},"live"):null,ok=ex&&ex.n&&!(ex.na&&!ex.n);
      sb.innerHTML="";sb.dataset.k="";tb.innerHTML=`<p class="zl-none">no solves yet with this method${ok?` · if optimal: about ${fmt(ex.sum/ex.n,1)} moves a solve`:""}</p>`;return}
    const rows=[["last",1,1]];WIN.forEach(w=>{if(n>=w)rows.push(["ao"+w,w,1])});
    const sn=Math.min(S.sess||0,n);if(sn>1)rows.push(["session",sn,0]);
    // change from the same figure one solve earlier: lower is better for moves and time, higher for clean
    const dl=(a,p,k)=>{if(!p||!isFinite(a[k])||!isFinite(p[k]))return"";const d=a[k]-p[k];if(Math.abs(d)<.005)return"";return `<i class="${d<0?"dn":"up"}">${d<0?"▼":"▲"}${fmt(Math.abs(d),2)}</i>`};
    const dc=(a,p)=>{if(!p)return"";const d=a.clean/a.n-p.clean/p.n;if(Math.abs(d)<1e-9)return"";const v=Math.abs(d)*100;return `<i class="${d>0?"dn":"up"}">${d>0?"▲":"▼"}${v<1?fmt(v,1):Math.round(v)}</i>`};
    const pb=(v,cur)=>isFinite(v)?`<small class="${cur<=v+1e-9?"pb":""}">${cur<=v+1e-9?"PB":"best "+fmt(v,2)}</small>`:"";
    const cells=rows.map(([lab,w,trim])=>{const a=statsC(S,h,n-w,n,trim),sess=lab==="session",last=w===1&&!sess;
      const p=sess?statsC(S,h,n-w,n-1,0):last?null:n>w?statsC(S,h,n-w-1,n-1,trim):null,bst=sess||last?null:bestAo(S,h,w);
      let cl,ex;
      if(last){const o=overOf(h[n-1]);cl=a.miss?`<b class="zl-bad">✗ missed</b>`:`<b class="zl-ok">✓</b>`;ex=a.miss?(o>0?`<b>+${o}</b>`:`<b>—</b><small>left the path</small>`):(o!=null&&o<0?`<b>${o}</b><small>beat it</small>`:"0")}
      else{cl=`<b class="${a.miss?"":"zl-ok"}">${pct(a.clean,a.n)}</b>${dc(a,p)}`+
          (a.miss?`<small>${a.miss} missed<em> · </em><span>1 in ${a.n/a.miss<10?fmt(a.n/a.miss,1):Math.round(a.n/a.miss)}</span></small>`:"")+
          (bst&&n>w&&a.miss?`<small class="${a.clean>=bst.c?"pb":""}">${a.clean>=bst.c?"PB":"best "+pct(bst.c,w)}</small>`:"");
        ex=a.extra?`<b>+${a.extra}</b><small>+${fmt(a.extra/a.miss,1)} per miss</small>`:"0"}
      return[`<span class="zl-l">${sess?`session <small>${w} solves</small>`:lab}</span>`,`<span>${cl}</span>`,`<span>${ex}</span>`,
        `<span><b>${fmt(a.m,last?0:2)}</b>${dl(a,p,"m")}${bst&&n>w?pb(bst.m,a.m):""}</span>`,
        `<span>${fmt(a.opt,last?0:2)}</span>`,
        `<span>${fmt(a.t,2)}${dl(a,p,"t")}${bst&&n>w?pb(bst.t,a.t):""}</span>`,
        `<span>${fmt(a.tps,1)}</span>`]});
    // one table on wide screens; on a phone, accuracy and speed as two narrower tables so nothing scrolls sideways
    // what this method averages when every step is at its standard (simulated random solves, these exact settings)
    if(S.ready){const ex=simExpect(S,rr=>{const t=performance.now();if(C.S===S&&ui.stats&&(rr.done||!rr.lu||t-rr.lu>1500)){rr.lu=t;liveSoon()}},"live");
      if(!(ex.na&&!ex.n)){const mean=ex.n?ex.sum/ex.n:NaN,ci=ex.n?1.96*Math.sqrt(Math.max(0,ex.sq/ex.n-mean*mean))/Math.sqrt(ex.n):NaN,mu='<span class="zl-mu">—</span>';
        cells.push(Object.assign([`<span class="zl-l zl-ideal">if optimal <small>${ex.n||"…"} sims</small></span>`,`<span>${mu}</span>`,`<span>${mu}</span>`,
          `<span><b>${ex.n?fmt(mean,2):"…"}</b>${ex.n?`<small>±${fmt(ci,1)}${ex.done?"":" · counting"}</small>`:""}</span>`,`<span>${mu}</span>`,`<span>${mu}</span>`,`<span>${mu}</span>`],{ideal:true}))}}
    const H=[`${n} solve${n>1?"s":""}`,"clean","extra moves","moves","optimal","time","tps"];
    const table=(cols,cls)=>`<div class="zl-tab ${cls}" style="grid-template-columns:auto repeat(${cols.length-1},auto)"><div class="zl-h">${cols.map(c=>`<span>${H[c]}</span>`).join("")}</div>`+
      cells.filter(r=>!(r.ideal&&cls==="acc")).map(r=>`<div class="zl-r">${cols.map(c=>r[c]).join("")}</div>`).join("")+`</div>`;
    const narrow=narrowQ.matches;
    const per=narrow?50:100;stripInto(sb,h,per);
    tb.innerHTML=(narrow?table([0,1,2],"acc")+table([0,3,4,5,6],"spd"):table([0,1,2,3,4,5,6],"all"))+
      `<p class="zl-note">clean = met the method's standard · extra moves = total moves over the standard in the misses, so hard cases never count against you · moves and time in aoN drop the best and worst 5% (1 each for ao5 / ao12); clean and extra moves count every solve</p>`;soon(()=>drawStrip(el,h))}
  /* the strip's rows are rebuilt only when their number (or the row length) changes; otherwise the counts are updated in place */
  function stripInto(sb,h,per){const n=h.length,R=Math.ceil(n/per),k=per+"|"+R;
    if(sb.dataset.k!==k){sb.innerHTML=strip(h,per);sb.dataset.k=k;return}
    const cvs=sb.querySelectorAll(".zl-rows canvas"),cnt=sb.querySelectorAll(".zl-rows > span");
    for(let r=0;r<R;r++){const end=n-(R-1-r)*per;let m=0;for(let i=Math.max(0,end-per);i<end;i++)if(!okOf(h[i]))m++;
      const cv=cvs[r];cv.dataset.end=end;delete cv.dataset.sel;cv.setAttribute("aria-label",`${Math.min(per,end)} solves, ${m} missed`);
      cnt[r].textContent=m;cnt[r].className=(m?"":"z0")+(r===R-1?" now":"")}
    const tip=sb.querySelector(".zl-tip");if(tip)tip.textContent=""}
  function setStats(on){ui.stats=on;saveUI();liveUI()}
  narrowQ.addEventListener("change",()=>{if(ui.stats)liveUI()});
  // touch screens have no hover: tapping a mark in the strip shows its details under the strip (tap again to clear)
  // a mark under the pointer (hover with a mouse, tap on touch) shows its solve in the line under the strip
  function stripPoint(e,tap){const cv=e.target.closest&&e.target.closest(".zl-rows canvas"),el=$("zLive"),tp=el.querySelector(".zl-tip");if(!tp)return;
    if(!cv){if(tap){tp.textContent="";el.querySelectorAll("canvas[data-sel]").forEach(c=>delete c.dataset.sel);drawStrip(el,hist(C.S))}return}
    const per=+cv.closest(".zl-viz").dataset.per,r=cv.getBoundingClientRect(),j=Math.floor((e.clientX-r.left)/r.width*per),i=+cv.dataset.end-per+j,h=hist(C.S);
    if(j<0||j>=per||i<0||i>=h.length)return;el.querySelectorAll("canvas[data-sel]").forEach(c=>delete c.dataset.sel);cv.dataset.sel=i;tp.textContent=tipOf(h,i);drawStrip(el,h)}
  $("zLive").addEventListener("click",e=>stripPoint(e,true));
  $("zLive").addEventListener("pointermove",e=>{if(e.pointerType==="mouse")stripPoint(e,false)});
  function rolling(S,n){const h=hist(S).slice(-n);return{n:h.length,pass:h.filter(x=>x.p!=null?x.p:x.m===x.o).length}}
  let liveQ=0;const liveSoon=()=>{if(liveQ)return;liveQ=1;afterPaint(()=>{liveQ=0;liveUI()})};
  window.addEventListener("resize",()=>{if(ui.stats)drawStrip($("zLive"),C.S?hist(C.S):[])});
  function progUI(){const S=C.S;if(!S||!S.ready)return;drillUI();liveSoon();
    const ph=S.M.pick?hist(S).slice(-100).filter(x=>x.c!=null):[],pickP=ph.length?` · picked the better line ${Math.round(ph.filter(x=>x.c).length/ph.length*100)}% of last ${ph.length}`:"";
    if(S.drill){const n=activeCards(S).length,left=drillLeft(S).length;barEl.style.width=(n?(n-left)/n*100:100).toFixed(1)+"%";progEl.textContent=`drilling reviews · ${n-left} / ${n} drilled · schedule unchanged`;return}
    const nc=activeCards(S).length,rc=rolling(S,100),pct=rc.n?Math.round(rc.pass/rc.n*100):0;
    if(S.classic&&S.prog.src==="auto"&&classicSrc(S)){const g=classicProgress(S);barEl.style.width=(Math.min(1,g.f)*100).toFixed(1)+"%";
      progEl.textContent=g.txt+(rc.n?` · ${pct}% met of last ${rc.n}`:"")+(nc?` · ${nc} reviewing`:"")+(C.streak>1?` · streak ${C.streak}`:"");return}
    barEl.style.width=pct+"%";progEl.textContent=(rc.n?`standard met ${pct}% of last ${rc.n}`:"no solves yet with this method")+pickP+(nc?` · ${nc} reviewing`:"")+(C.streak>1?` · streak ${C.streak}`:"")}
  function load(it){clearTimers();const pk=it.pk||C.key;
    if(pk!==C.pk){C.pk=pk;C.P=PUZ[pk];buildCells()}C.steps=stepsFor(C.S,pk).slice();
    C.it=it;C.b=it.b.slice();C.moves=0;C.running=false;C.time=0;C.rv=null;C.si=0;C.walls=[];C.res=[];
    C.S.lastK=C.S.kof(it.b,pk);boardCls("");fb("");seqEl.innerHTML="";C.phase="load";C.pick=null;C.pickInfo=null;
    C.lim=mergeLimit(C.S);C.merged=[];C.undo=null;C.log=[];C.snaps=[];C.plan=null;C.planned=null;C.picks=[];C.A=false;
    if(C.S.M.seq){C.steps=C.steps.slice();C.stg=C.S.M.seq.stg.slice();C.norm=C.S.M.steps.slice()}else{C.stg=C.steps.map(()=>0);C.norm=null}
    const ms=Math.round(ui.buf*1000);
    if(C.S.M.pick){pickSetup();C.phase="pick";C.lockUntil=performance.now()+ms;lockAnim(ms);
      if(ms>0){boardEl.classList.add("locked");later(()=>{if(C.it===it)boardEl.classList.remove("locked")},ms)}else boardEl.classList.remove("locked");
      tagUI();stepsUI();setTarget();setSub();return}
    startStep();
    C.lockUntil=performance.now()+ms;lockAnim(ms);
    if(ms>0){C.phase="lock";boardEl.classList.add("locked");later(()=>{if(C.it===it&&C.phase==="lock"){C.phase="solve";boardEl.classList.remove("locked")}},ms)}
    else{C.phase="solve";boardEl.classList.remove("locked")}
    tagUI();stepsUI();setTarget();setSub()}
  /* ---------- plans: the ways a stage can be built ----------
     A plan is one way through the current stage: which way round (row or column first, with "Pick the best order")
     and which order its steps go in (with "Flexible order": 3-4 then 1-2 as well as 1-2 then 3-4). Each plan is
     measured by the best total its own steps allow from this board (every step at its optimum, each leaving the best
     board for the next), so the method itself decides which plan is right. The first group you finish picks the plan;
     a plan worse than the best one is a miss, and the replay shows the best one. */
  const flexOn=()=>!!(C.S&&C.S.M.flex);
  function makePlans(variants){return plansFor(C.pk,variants,C.walls,C.b,flexOn())}
  /* start choosing among plans for steps si..end (their min / best may come from a wider set, as in pick mode) */
  function planStart(list,end,all){all=all||list;if(!list.length)return;
    if(list.length===1){const p=list[0],best=bestOf(all);for(let k=0;k<p.steps.length;k++)C.steps[C.si+k]=p.steps[k];if(all.length>1){C.picks.push(pickRec(p,all,best,C.b.slice(),C.walls.slice()));planned(p)}return}
    // groups already home when the stage starts decide nothing: a plan is chosen by a group you finish yourself
    const pre=new Set(list.filter(p=>METHODS.doneStep(p.R,C.b)));
    const P=C.plan={list,all,pre,si:C.si,end,b0:C.b.slice(),walls:C.walls.slice(),tiles:[...new Set(list.flatMap(p=>p.R.tiles))],
      firsts:[...new Set(list.map(p=>METHODS.stepName(C.pk,p.steps[0])))]};
    // measured in slices while you think; orders that turn out not to be buildable leave the list
    sliced((function*(){for(const p of P.all)yield* p.warm()})(),()=>{if(C.plan!==P)return;const keep=P.list.filter(p=>p.ok());
      if(keep.length&&keep.length<P.list.length){P.list=keep;P.all=P.all.filter(p=>p.ok());P.tiles=[...new Set(keep.flatMap(p=>p.R.tiles))];P.firsts=[...new Set(keep.map(p=>METHODS.stepName(C.pk,p.steps[0])))];render();setTarget()}})}
  /* a choice and what it is compared with: the best plan overall, and the best of the others (for "was right (29 vs 33)") */
  function pickRec(p,all,best,b0,walls){const others=all.filter(x=>x!==p&&Number.isFinite(x.m)),runner=others.length?others.reduce((x,y)=>y.m<x.m?y:x):null;
    return{ok:p.m<=best.m,diff:Math.max(0,p.m-best.m),mine:p,other:best,runner,b0,walls,si:C.plan?C.plan.si:C.si}}
  /* the first group finished decides the plan (the best of the plans that start with it) */
  function planChoose(){const P=C.plan;let done=P.list.filter(p=>!P.pre.has(p)&&METHODS.doneStep(p.R,C.b));
    if(done.some(p=>Number.isFinite(p.m)))done=done.filter(p=>Number.isFinite(p.m));
    if(!done.length){if(P.pre.size<P.list.length)return false;done=P.list}
    const p=bestOf(done);for(let k=0;k<p.steps.length;k++)C.steps[P.si+k]=p.steps[k];
    if(p.a!=null)C.A=p.a;C.R=p.R;C.std=p.std;C.picks.push(pickRec(p,P.all,bestOf(P.all),P.b0,P.walls));
    C.plan=null;planned(p);tagUI();setTarget();return true}
  /* with an order switch on you are choosing a whole plan, so its first step is graded as a set-up for the rest of it:
     your moves plus the best the plan's remaining steps can do from where you left them, against the plan's best total.
     (A single-step plan keeps its own grading.) */
  function planned(p){C.planned=p.steps.length>1?{p,si:C.si}:null;if(C.planned&&C.R&&C.R.spec===p.steps[0])C.std={std:p.m,d:p.std.d,path:p.path,plan:true}}
  function stepValue(moves){const key=C.pk,q=C.planned;
    if(q&&q.si===C.si){const rest=q.p.steps.slice(1),W2=METHODS.wallsAfter(C.R,C.b,C.walls);return moves+METHODS.chainBest(key,rest,W2,C.b).v}
    return METHODS.value(key,C.R,C.walls,C.b,moves)}

  /* pick mode: measure both lines (every plan of each) on this scramble, show only their tiles, and wait for the choice */
  function pickSetup(){const S=C.S,key=C.pk,L=lines(key),wr=S.M.pick.line,o={};
    for(const ln of ["row","col"]){const flip=ln!==wr,steps=stepsFor(S,key,flip),name=(ln==="row"?"row ":"column ")+L[ln].join("-");
      o[ln]={ln,name,tiles:L[ln].map(l=>METHODS.loc(key,l)),plans:makePlans([{steps,label:name}])}}
    C.pickInfo=o;render(C.b,{tiles:[...new Set(o.row.tiles.concat(o.col.tiles))]},[])}
  function choosePick(ln){if(C.phase!=="pick"||performance.now()<C.lockUntil)return;const o=C.pickInfo,it=C.it;
    C.pick=ln;C.steps=o[ln].plans[0]?o[ln].plans[0].steps.slice():stepsFor(C.S,C.pk,ln!==C.S.M.pick.line).slice();
    planStart(o[ln].plans,C.steps.length-1,o.row.plans.concat(o.col.plans));
    const dep=METHODS.resolve(C.pk,C.steps[0],[]).f(C.b);it.depth=dep;it.parts=it.parts.map(p=>p.d&&/^depth \d+$/.test(p.t)?{t:"depth "+dep,d:1}:p);
    C.phase="solve";boardEl.classList.remove("locked");startStep();tagUI();stepsUI();setTarget();if(C.phase==="solve")setSub()}
  function startStep(){const key=C.pk;
    C.snaps.push({si:C.si,b:C.b.slice(),walls:C.walls.slice(),steps:C.steps.slice(),stg:C.stg.slice(),norm:C.norm&&C.norm.slice(),res:C.res.length,log:C.log.length,
      picks:C.picks.length,plan:C.plan,planned:C.planned,A:C.A,merged:C.merged.length,moves:C.moves});
    if(C.norm&&(C.si===0||C.stg[C.si]!==C.stg[C.si-1]))stageStart();
    else if(!C.norm&&C.si===0&&!C.pick&&!C.plan&&flexOn()&&C.steps.length>1)planStart(makePlans([{steps:C.steps.slice(),label:""}]),C.steps.length-1);
    if(C.plan){const p=C.plan.list[0];C.R=p.R;C.std=p.std}else{if(!(C.planned&&C.planned.si===C.si))mergeAhead();C.R=METHODS.resolve(key,C.steps[C.si],C.walls);
      if(C.planned&&C.planned.si===C.si){const p=C.planned.p;C.std={std:p.m,d:p.std.d,path:p.path,plan:true}}
      else{const R=C.R,W=C.walls.slice(),B=C.b.slice();if(R.spec.la)stdLater(METHODS.standardG(key,R,W,B));else{const d=R.f(B);C.std={std:d,d}}}}
    C.sb=C.b.slice();C.sp="";C.dcur=C.R.f(C.b);render();stepsUI();setTarget();
    // a step whose tiles are already home counts as done with 0 moves
    if(C.plan){if(planChoose()){const v=stepValue(0);stepDone(v<=C.std.std,v)}return}
    if(!C.R.spec.prefix&&METHODS.doneStep(C.R,C.b)){const v=stepValue(0);stepDone(v<=C.std.std,v)}}
  /* sequence: a new stage starts. Which way round is it? Read it off the shape of what is left (in 4x4 coordinates):
     a 4x3 region that stands 3 wide and 4 tall is the 3x4, so the stage's method is transposed. Square stages keep the
     way round they came in; with "Pick the best order" on they may go either way, and with "Flexible order" their
     steps in any workable order: every plan is measured and the first group you finish picks one. */
  function stageStart(){const S=C.S,st=S.M.seq.stages[C.stg[C.si]];
    C.A=orientA(C.P,C.walls,st,C.A);
    let end=C.si;while(end+1<C.steps.length&&C.stg[end+1]===C.stg[C.si])end++;
    for(let k=C.si;k<C.steps.length;k++)C.steps[k]=C.A?mapSpec(C.norm[k],T4):C.norm[k];
    C.plan=null;const variants=stageVariants(S.M,st,C.norm.slice(C.si,end+1),C.A);
    if(variants.length<2&&!(flexOn()&&end>C.si))return;
    planStart(makePlans(variants),end)}

  const simSolve=S=>{S.ap=altOn(S);return METHODS.run(simSolveG(S))};
  /* 3000 simulated solves per setting, played on a background thread (js/simworker.js) so they never touch a frame.
     Progress is saved as it goes and picks up where it left off on the next visit. Without workers it falls back to
     short slices here that pause entirely while you are solving. */
  const SIM={},SIMLS="ssa-exp-v2",SIMN=3000,simSaved=store.get(SIMLS)||{};
  const VER=(document.currentScript&&new URL(document.currentScript.src).search)||"";
  let simW=null,simFor=null;
  try{simW=new Worker("js/simworker.js"+VER);simW.onmessage=e=>{const d=e.data,r=SIM[d.id];if(!r)return;Object.assign(r,{n:d.n,sum:d.sum,sq:d.sq});if(d.na)r.na=true;
      if(d.done)r.done=true;if(r.n&&(d.done||r.n-(r.saved||0)>=250)){r.saved=r.n;simSaved[d.id]={n:r.n,sum:r.sum,sq:r.sq};store.set(SIMLS,simSaved)}
      Object.values(r.subs).forEach(f=>f(r))};simW.onerror=()=>{simW=null}}catch(e){simW=null}
  const busy=()=>["solve","lock","pick","finishing"].includes(C.phase);
  // listeners by name (the settings page, the stats table) are told as the count grows
  const simPost=(S,id,r)=>{simFor=id;simW.postMessage({id,key:S.d.key,M:JSON.parse(JSON.stringify(S.M)),ap:altOn(S),n:r.n,sum:r.sum,sq:r.sq,target:SIMN})};
  function simExpect(S,onTick,tag){const id=(S.d.key)+"|"+S.M.id;let r=SIM[id];
    if(r){if(onTick)r.subs[tag||"x"]=onTick;if(!r.done&&simW&&simFor!==id)simPost(S,id,r);return r}
    const sv=simSaved[id];r=SIM[id]=Object.assign({n:0,sum:0,sq:0},sv||{},{done:!!sv&&sv.n>=SIMN,subs:{}});if(onTick)r.subs[tag||"x"]=onTick;if(r.done)return r;
    if(simW){simPost(S,id,r);return r}
    S.ap=altOn(S);let lastSave=r.n,lastTell=0;
    const tell=()=>{Object.values(r.subs).forEach(f=>f(r))};
    sliced((function*(){while(r.n<SIMN){let m;try{m=yield* simSolveG(S)}catch(e){m=NaN}if(!Number.isFinite(m)){r.na=true;break}r.n++;r.sum+=m;r.sq+=m*m;
        if(r.n-lastSave>=250){lastSave=r.n;simSaved[id]={n:r.n,sum:r.sum,sq:r.sq};soon(()=>store.set(SIMLS,simSaved))}
        const t=performance.now();if(t-lastTell>400){lastTell=t;soon(tell)}}})(),
      ()=>{r.done=true;if(r.n){simSaved[id]={n:r.n,sum:r.sum,sq:r.sq};store.set(SIMLS,simSaved)}tell()},busy);
    return r}
  function simText(r){if(r.na&&!r.n)return"";if(!r.n)return"Working out the average…";const m=r.sum/r.n,sd=Math.sqrt(Math.max(0,r.sq/r.n-m*m)),ci=1.96*sd/Math.sqrt(r.n);
    return `If you hit the standard on every step with these exact settings: about ${m.toFixed(1)} moves a solve (±${ci.toFixed(1)}, ${r.n} simulated random solves${r.done?"":", still counting"}).`}
  function simUI(){const S=C.S,el=$(C.key==="seq"?"zSeqExp":"zMethExp");$("zSeqExp").textContent="";$("zMethExp").textContent="";if(!S||!S.ready||!el)return;
    const want=S;const r=simExpect(S,rr=>{if(C.S===want&&panelOpen())el.textContent=simText(rr)},"panel");el.textContent=simText(r)}
  /* turn this step and the ones after it into one when that combined optimum is within your reliable depth */
  function mergeAhead(){const lim=C.lim,i=C.si,st=C.steps;if(!lim||i>=st.length-1)return;
    for(let j=st.length-1;j>i;j--){if(C.stg[j]!==C.stg[i])continue;   // never across sequence stages
      const m=METHODS.merge(st.slice(i,j+1));if(!m||!METHODS.mergeable(C.pk,m,C.walls))continue;
      let R;try{R=METHODS.resolve(C.pk,m,C.walls)}catch(e){continue}
      const d=R.f(C.b);if(d<=lim){C.steps=st.slice(0,i).concat([m],st.slice(j+1));C.stg=C.stg.slice(0,i).concat([C.stg[i]],C.stg.slice(j+1));
        if(C.norm)C.norm=C.norm.slice(0,i).concat([METHODS.merge(C.norm.slice(i,j+1))],C.norm.slice(j+1));C.merged.push({name:m.rest?"the rest":METHODS.stepName(C.pk,m),d,lim,n:j-i+1});tagUI();return}}}
  function next(){flushFinish();clearTimers();const S=C.S;if(!S||!S.ready)return;
    const it=pick(S);if(!it){drillDone();return}
    load(it)}
  function canMove(){if(C.phase==="lock"&&performance.now()>=C.lockUntil){C.phase="solve";boardEl.classList.remove("locked")}return C.phase==="solve"}
  const isWall=c=>C.walls.includes(c);
  /* one single-tile move; returns false when the solve stopped (step missed or method finished) */
  function step(k){if(isWall(k))return false;const z=C.b.indexOf(0);if(!C.running){C.running=true;C.t0=performance.now();requestAnimationFrame(tick)}
    C.sp+=tileLetter(z,k,C.P.w);C.b[z]=C.b[k];C.b[k]=0;C.moves++;return afterMove()}
  function afterMove(){const R=C.R,key=C.pk;
    if(R.spec.prefix){const nd=R.f(C.b);if(nd!==C.dcur-1){stepDone(false);return false}C.dcur=nd;
      if(C.sp.length>=R.spec.prefix||nd===0){stepDone(true);return false}return true}
    if(C.plan){if(!planChoose())return true}
    else if(!METHODS.doneStep(R,C.b))return true;
    const val=stepValue(C.sp.length);stepDone(val<=C.std.std,val);return C.phase==="solve"}
  function stepDone(pass,val){const R=C.R,st=C.std.std,goOn=!R.spec.prefix&&C.si+1<C.steps.length;
    const pk=C.picks[C.picks.length-1],pickBad=!!pk&&!pk.ok&&pk.si===C.si;
    C.res.push({pickBad,name:R.spec.prefix?`first ${R.spec.prefix}`:R.rest?stepLabel(R):METHODS.stepName(C.pk,R.spec),std:R.spec.prefix?Math.min(R.spec.prefix,st):st,val:val==null?C.sp.length:val,pass,moves:C.sp.length,d:R.spec.prefix?null:C.std.d});
    // every step is kept for the review; a missed step doesn't stop a multi-step method: the next one is graded from where you are
    C.log.push({b0:C.sb,path:C.sp,R,walls:C.walls.slice(),std:C.std,res:C.res[C.res.length-1],si:C.si,plan:C.planned&&C.planned.si===C.si?C.planned.p:null});
    if(!pass&&!goOn){finishSolve(false);return}
    if(R.spec.prefix||C.si+1>=C.steps.length){finishSolve(true);return}
    C.walls=METHODS.wallsAfter(R,C.b,C.walls);C.si++;
    startStep()}
  function after(){render();if(C.phase==="solve"&&!ui.timer)setSub()}
  function moveDir(L){if(!canMove())return;const P=C.P,z=C.b.indexOf(0),x=z%P.w,y=(z/P.w)|0;let k=-1;
    if(L==="L"&&x<P.w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<P.h-1)k=z+P.w;if(L==="D"&&y>0)k=z-P.w;if(k<0||isWall(k))return;step(k);after()}
  function toCell(i){if(!canMove())return;const P=C.P;let z=C.b.indexOf(0);if(i===z)return;const zx=z%P.w,zy=(z/P.w)|0,ix=i%P.w,iy=(i/P.w)|0;let s;
    if(zy===iy)s=ix>zx?1:-1;else if(zx===ix)s=iy>zy?P.w:-P.w;else return;
    for(let c=z+s;;c+=s){if(isWall(c))return;if(c===i)break}
    while(z!==i){if(!step(z+s))break;z+=s}after()}

  /* ---------- end of a solve ---------- */
  /* The last move must show at once: stop the clock, draw the board, and do the grading, saving and stats after the
     browser has painted. Anything that needs the result first (next case, switching puzzle, mouse slip) finishes it now. */
  function finishSolve(pass){C.running=false;C.time=(performance.now()-C.t0)/1000||0;setSub(true);render();C.phase="finishing";
    const it=C.it;C.finishPend=()=>finishNow(pass);afterPaint(()=>{if(C.it===it)flushFinish()})}
  function flushFinish(){if(C.finishPend){const f=C.finishPend;C.finishPend=null;f()}}
  function finishNow(pass){const S=C.S,it=C.it;
    // totals in real moves: v = the moves you played, s = v minus each step's over (a set-up's own over counts once) and each wrong pick's cost
    const over=C.res.reduce((a,r)=>a+(r.val-r.std),0),v=C.moves,s=v-over,h=hist(S);
    // line picks: pick mode's question, or which way round a sequence's square stage was built (Mirrors).
    // A wrong pick is a miss even when the chosen line was built to standard; its cost counts as extra moves.
    const picks=C.picks||[];
    const bad=picks.find(p=>!p.ok),pickBad=!!bad,misses=C.log.filter(x=>!x.res.pass),stepPass=pass&&!misses.length;
    pass=stepPass&&!pickBad;
    const e={t:+C.time.toFixed(3),m:C.moves,s:s-picks.reduce((a,p)=>a+p.diff,0),v,p:pass?1:0,d:it.depth};if(S.classic)e.o=e.s;if(C.pk!==C.d.key)e.z=C.pk;if(picks.length)e.c=pickBad?0:1;
    /* the review: every wrong pick (the best plan played from where you chose) and every missed step (your moves up to
       where they left the standard, then the standard from there), in solve order */
    let rv=null;const items=[];
    picks.filter(p=>!p.ok).forEach(p=>{const o=p.other,rest=o.steps.some(x=>x.rest),R=o.whole?o.R:METHODS.resolve(C.pk,rest?{rest:1}:{t:o.steps.flatMap(x=>x.t)},p.walls),kd=p.mine.setup?" set-up":"";
      items.push({pickMiss:true,si:p.si,b0:p.b0.slice(),path:"",R,walls:p.walls.slice(),std:{std:o.m,path:o.path},res:{name:o.name,std:o.m,val:o.m,moves:0},div:{k:0,cont:o.path},
        why:`You went with ${p.mine.name} (${p.mine.m}); ${o.name} takes ${o.m}${kd}. Here is ${o.name}:`})});
    misses.forEach(x=>items.push(x.plan?planItem(x):Object.assign({},x,{div:METHODS.diverge(C.pk,x.R,x.walls,x.b0,x.path,x.std)})));
    items.sort((a,b)=>(a.si-b.si)||((b.pickMiss?1:0)-(a.pickMiss?1:0)));
    if(items.length){rv={items};const f=items.find(x=>!x.pickMiss);if(f&&f.si===0)e.k=f.div.k}
    const pp=bad||picks[0],mine=pp&&pp.mine,other=pp&&pp.other,kind=!pp?"":mine.setup?" set-up":"";
    const pickTxt=pp&&!pickBad?picks.filter(p=>p.runner).map(p=>p.runner.m===p.mine.m?`${p.mine.name} ties ${p.runner.name} (${p.mine.m})`:`${p.mine.name} was right (${p.mine.m} vs ${p.runner.m})`).join(" · "):"",
      pickHead=pickBad?`<b class="z-bad">✗ ${esc(other.name)} was better</b> <span class="z-mute">· ${esc(mine.name)} ${mine.m}, ${esc(other.name)} ${other.m}${kind}</span> `:"";
    // sequences: how the whole attempt went
    const nm=C.res.filter(r=>!r.pass||r.pickBad).length,seqTxt=C.norm?`${C.res.length-nm} of ${C.res.length} steps met · ${v} for a standard of ${e.s}`:"";
    const rr=C.res.filter(r=>r.d!=null).map(r=>[r.d,r.pass?1:0]);if(rr.length)e.r=rr;if(C.merged.length)e.g=C.merged.length;
    // mouse slip: what to put back if this miss is taken back
    C.undo={h:h.slice(),prog:JSON.stringify(S.prog),drill:S.drill?JSON.stringify(S.drill.streak):null,streak:C.streak,sess:S.sess||0,it};
    h.push(e);if(h.length>1000)h.shift();setHist(S,h);S.sess=(S.sess||0)+1;
    const note=S.drill?drillJudge(S,it,pass):judge(S,it,pass);progUI();
    C.streak=pass?C.streak+1:0;
    if(pass){C.phase="done";boardCls("good");tagUI();stepsUI();setTarget();progUI();const beat=v<s;
      const whole=C.steps.length===1&&C.steps[0].rest&&!C.steps[0].prefix;
      fb(`<b class="z-ok">✓ ${beat?`beat the method by ${s-v}`:whole?"optimal":"standard met"}</b>${seqTxt?` <span class="z-mute">· ${esc(seqTxt)}</span>`:""}${pickTxt?` <span class="z-mute">· ${esc(pickTxt)}</span>`:""}${note?` <span class="z-mute">· ${note}</span>`:""}`);
      later(next,multi()?900:600);return}
    C.rv=rv;C.phase="review";boardCls("bad");tagUI();stepsUI();setTarget();progUI();
    const extra=misses.reduce((a,x)=>a+Math.max(0,x.res.val-x.res.std),0),one=misses.length===1&&!pickBad?misses[0].res:null;
    if(one&&one.name&&C.log[C.log.length-1].R.spec.prefix)C.head=`<b class="z-bad">✗</b> <span class="z-mute">· move ${one.moves} left the optimal path · ${note}</span>`;
    else if(one&&!multi())C.head=`<b class="z-bad">+${one.val-one.std}</b> <span class="z-mute">· standard ${one.std}${seqTxt?" · "+esc(seqTxt):""} · ${note}</span>`;
    else C.head=pickHead+(misses.length?`<b class="z-bad">✗ ${misses.length} of ${C.res.length} steps missed${extra?` · +${extra}`:""}</b> `:"")+
      `<span class="z-mute">${!misses.length&&mine?`· your ${esc(mine.name)} met its standard · `:"· "}${seqTxt?esc(seqTxt)+" · ":""}${note}</span>`;
    playReview()}

  /* ---------- miss review: replay the missed step and show where it left the standard ---------- */
  function hintTile(L,b){const P=C.P,z=b.indexOf(0);const k=L==="L"?z+1:L==="R"?z-1:L==="U"?z+P.w:z-P.w;if(C.cells[k])C.cells[k].classList.add("hint")}
  const ARROW={L:"←",R:"→",U:"↑",D:"↓"};
  function seqHTML(pre,cont,j){return `<span class="z-pre">${pre}</span>${pre.length?'<span class="z-cut"></span>':""}`+[...cont].map((c,i)=>`<span class="${i<j?"z-done":i===j?"z-now":""}">${c}</span>`).join("")}
  function laNote(rv){const R=rv.R;if(!R.spec.la)return "";const nx=nextName(C.pk,R,rv.walls);
    const yours=rv.res.val-rv.res.moves,bestLen=rv.std.path.length,bestNext=rv.std.std-bestLen;
    return ` Your ${METHODS.stepName(C.pk,R.spec)} took ${rv.res.moves} and left ${yours} for the ${nx}. The best set-up: ${bestLen} + ${bestNext}.`}
  /* review item for a planned first step: on track while moves-so-far + the plan's best from there still equals its
     best total; the continuation shown is the rest of the best plan from where you left it */
  function planItem(x){const key=C.pk,p=x.plan,P=C.P,b=x.b0.slice();let k=0;
    for(let j=1;j<=x.path.length;j++){applyLetter(b,P.w,P.h,x.path[j-1]);if(j+METHODS.chainBest(key,p.steps,x.walls,b).v!==p.m)break;k=j}
    const bk=x.b0.slice();for(let j=0;j<k;j++)applyLetter(bk,P.w,P.h,x.path[j]);
    const rest=p.steps.some(z=>z.rest),R=METHODS.resolve(key,rest?{rest:1}:{t:p.steps.flatMap(z=>z.t)},x.walls);
    return Object.assign({},x,{R,planStd:true,div:{k,cont:METHODS.chainBest(key,p.steps,x.walls,bk).path}})}
  /* R during a review goes back one phase: to the start of the part playing now (a miss, or your own moves between
     misses); pressed again within a moment, one phase further back each time */
  let lastR=0;
  function replayBack(){const now=performance.now(),quick=now-lastR<900;lastR=now;
    if(!C.revAt||C.revPh==null){playReview();return}
    let ph=C.revPh;if(quick)ph=Math.max(0,ph-1);C.revAt(ph)}
  /* plays every review item in solve order. Each one: your moves up to where they left the standard (quickly), then
     the standard from there (at the replay pace). Between items your own moves are played on from that step's start, so
     the next miss is shown from the board you really reached. */
  function playReview(){clearTimers();const rv=C.rv,P=C.P,items=rv.items;C.phase="review";boardCls("bad");
    const btns=`<div class="z-btns"><button class="z-link" data-z="replay">replay this (R)</button><button class="z-link" data-z="next">next (space)</button></div>`;
    C.revAt=(ph)=>{clearTimers();C.phase="review";if(ph%2)yours((ph-1)/2);else play(ph/2)};
    const play=idx=>{C.revPh=idx*2;const it=items[idx],div=it.div,b=it.b0.slice();C.b=b;C.R=it.R;C.std=it.std;C.walls=it.walls.slice();setTarget();render(b,it.R,it.walls);boardCls("bad");
      const pre=it.path.slice(0,div.k),cont=div.cont||"",std=it.planStd?"the best plan":it.R.spec.la?"the best set-up":"optimal";
      const lab=items.length>1?`<b>${idx+1} of ${items.length}</b> · ${esc(it.res.name)}${it.pickMiss?"":` +${Math.max(0,it.res.val-it.res.std)}`} · `:"";
      const why=it.pickMiss?it.why:(div.k===0?`Your first move (${ARROW[it.path[0]]||"—"}) already left the standard. ${std[0].toUpperCase()+std.slice(1)} starts ${ARROW[cont[0]]||"—"}.`
        :`Your first ${div.k} move${div.k>1?"s were":" was"} on standard. On move ${div.k+1} you went ${ARROW[it.path[div.k]]||"—"}; ${std} goes ${ARROW[cont[0]]||"—"}.`)+laNote(it);
      fb(C.head+`<div class="z-why">${lab}${esc(why)}</div>`+btns);
      seqEl.innerHTML=seqHTML(pre,cont,-1);
      const iv=ui.pace==="auto"?Math.max(160,Math.min(480,6500/Math.max(1,cont.length))):1000/+ui.pace;
      let i=0,j=0;const rr=()=>render(b,it.R,it.walls);
      const preStep=()=>{if(i<pre.length){applyLetter(b,P.w,P.h,pre[i]);i++;rr();later(preStep,70)}else{rr();if(cont.length)hintTile(cont[0],b);later(contStep,pre.length?750:500)}};
      const contStep=()=>{if(j<cont.length){applyLetter(b,P.w,P.h,cont[j]);j++;rr();seqEl.innerHTML=seqHTML(pre,cont,j);later(contStep,iv)}
        else{boardCls("good");if(idx+1<items.length)later(()=>yours(idx),1100);else later(()=>{if(C.phase==="review")next()},1400)}};
      later(preStep,350)};
    // your own moves from this item's step up to the next item's, so the next one starts where you really were
    const yours=idx=>{C.revPh=idx*2+1;const it=items[idx],nx=items[idx+1],steps=C.log.filter(x=>x.si>=it.si&&x.si<nx.si);
      if(!steps.length){play(idx+1);return}
      const b=steps[0].b0.slice();C.b=b;boardCls("");let k=0,q=0;
      fb(C.head+`<div class="z-why">Now your own moves${steps.length>1?` through ${steps.map(x=>x.res.name).join(", ")}`:` for ${esc(steps[0].res.name)}`}, to where the next one starts…</div>`+btns);
      seqEl.innerHTML=`<span class="z-pre">${steps.map(x=>x.path).join(" ")}</span>`;render(b,steps[0].R,steps[0].walls);
      const go=()=>{if(k>=steps.length){later(()=>play(idx+1),500);return}const st=steps[k];
        if(q<st.path.length){applyLetter(b,P.w,P.h,st.path[q]);q++;render(b,st.R,st.walls);later(go,60)}else{k++;q=0;later(go,k<steps.length?200:0)}};
      later(go,400)};
    play(0)}

  /* ---------- tabs, method choice ---------- */
  const tabs=[...root.querySelectorAll('.seg [role="tab"]')];
  function select(key){if(!PUZ[key]&&key!=="seq")return;flushFinish();clearTimers();C.running=false;C.key=key;C.d=data(key==="seq"?ui.seq.start:key);ui.tab=key;saveUI();
    C.S=mstate(C.d,curMethod(key));C.pk=C.d.key;C.P=C.d.P;C.steps=C.S.M.steps;drillUI();
    tabs.forEach(t=>{const on=t.dataset.key===key;t.setAttribute("aria-selected",on);t.tabIndex=on?0:-1});
    buildCells();layout();C.it=null;C.R=null;C.walls=[];C.res=[];C.streak=0;C.b=goal(C.P.w*C.P.h);render();boardCls("dim");fb("");seqEl.innerHTML="";tagEl.textContent="";subEl.textContent="";stepsUI();fillQuick();
    if(key==="seq"&&!ui.seqSeen){ui.seqSeen=1;saveUI();openPanel("method")}
    if(panelOpen())fillPanel();
    const S=C.S;
    if(!S.ready){C.phase="build";setTarget();setTimeout(()=>{if(C.S!==S)return;prepare(S);if(panelOpen())fillPanel();progUI();next()},40)}
    else{progUI();next()}}
  function setMethod(id){ui.meth[C.key]=id;saveUI();select(C.key)}
  function fillQuick(){const q=$("zMethQ");q.disabled=C.key==="seq";
    if(C.key==="seq"){q.innerHTML=`<option>${esc(C.S.M.name)}</option>`;q.title=C.S.M.desc;return}
    const L=methods(C.key);q.innerHTML=L.map(m=>`<option value="${m.id}">${esc(m.name)}${m.custom?" (custom)":""}</option>`).join("");q.value=C.S.M.base||C.S.M.id;q.title=C.S.M.desc||""}
  $("zMethQ").addEventListener("change",e=>{e.target.blur();setMethod(e.target.value);if(panelOpen())fillPanel()});
  /* show / hide optimal */
  function eyeUI(){const b=$("zEye");b.setAttribute("aria-pressed",ui.pre?"true":"false");b.classList.toggle("off",!ui.pre);
    const l=ui.pre?"Hide optimal (H)":"Show optimal (H)";b.setAttribute("aria-label",l);b.title=l;if(panelOpen())$("zPre").checked=ui.pre}
  function setPre(on){ui.pre=on;saveUI();eyeUI();tagUI();setTarget();progUI()}
  $("zEye").addEventListener("click",e=>{e.currentTarget.blur();setPre(!ui.pre)});
  $("zStatBtn").addEventListener("click",e=>{e.currentTarget.blur();setStats(!ui.stats)});
  tabs.forEach(t=>t.addEventListener("click",e=>{e.currentTarget.blur();select(t.dataset.key)}));

  /* ---------- settings panel ---------- */
  const panelOpen=()=>!panel.hidden;
  function closePanel(){if(!panel.hidden){panel.hidden=true;$("zGear").setAttribute("aria-expanded","false")}}
  function openPanel(page){fillPanel();showPage(page||ui.spage||"method");panel.hidden=false;$("zGear").setAttribute("aria-expanded","true")}
  function showPage(pg){ui.spage=pg;saveUI();panel.querySelectorAll(".zp-nav button").forEach(b=>{if(b.dataset.page===pg)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
    panel.querySelectorAll(".zp-page").forEach(x=>x.classList.toggle("on",x.dataset.page===pg));panel.querySelector(".zp-body").scrollTop=0}
  panel.querySelector(".zp-nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page)});
  panel.addEventListener("pointerdown",e=>{if(e.target===panel)closePanel()});   // the dimmed backdrop
  function fillSeq(){const c=ui.seq,stg=seqStages();
    $("zSeqFrom").innerHTML=SEQ_ST.map(k=>`<option value="${k}">${SEQ_FROM[k]}</option>`).join("");$("zSeqFrom").value=c.start;
    $("zSeqTo").innerHTML=seqEnds(c.start).map(([v,t])=>`<option value="${v}">${t}</option>`).join("");$("zSeqTo").value=c.end;
    $("zSeqMirRow").hidden=!ALT[c.start];$("zSeqMir").checked=!!c.mir.start;
    $("zSeqMirNote").textContent=ALT[c.start]?`Scrambles also start as the ${ALT[c.start].pk} (the ${c.start} turned on its side).`:"";
    const TT={"4x4":"4x4 · first line","4x3":"4x3 · column 5-9-13","3x3":"3x3 · line 6-8","3x2":"3x2"};
    $("zSeqStages").innerHTML=stg.map(x=>`<div class="zp-stage"><label class="zp-row">${TT[x.st]}<select data-st="${x.st}">${x.L.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}${m.custom?" (custom)":""}</option>`).join("")}</select></label>`+
      (SQ[x.st]?`<label class="zp-check zp-sub"><input type="checkbox" role="switch" data-mir="${x.st}"${c.mir[x.st]?" checked":""}${lineOf(x.st,x.M)?"":" disabled"}><span>Pick the best order<small>${lineOf(x.st,x.M)?`Row or column first, your call: build either, and the better one by this method is the standard. The worse one is a miss.`:"This method has no row or column to choose between."}</small></span></label>`:"")+`</div>`).join("")+
      (stg.length&&stg[stg.length-1].st!=="3x2"&&stg[stg.length-1].M.steps.some(x=>x.rest)?`<p class="note">${stg[stg.length-1].M.name} finishes the puzzle, so no later stage is asked.</p>`:"");
    stg.forEach(x=>{$("zSeqStages").querySelector(`[data-st="${x.st}"]`).value=x.M.id})}
  function fillPanel(){const d=C.d,key=C.key,S=C.S,M=S.M,isSeq=key==="seq";
    $("zSeqSec").hidden=!isSeq;$("zMethSec").hidden=isSeq;if(isSeq)fillSeq();$("zpNavMethod").textContent=isSeq?"Sequence":"Method";
    const canFlex=isSeq?true:orderable(baseMethod(key).steps);$("zFlex").checked=!!ui.flex[key]&&canFlex;$("zFlex").disabled=!canFlex;
    $("zFlexNote").textContent=canFlex?`The method's steps may go in any order that works, starting from either end of the line: 3-4 then 1-2 as well as 1-2 then 3-4, and 13 then 5-9 as well as 5 then 9-13. The first group you finish picks the order; the best order (the lowest total these steps allow) is the standard, and a worse one is a miss.${isSeq?" Applies to every stage.":" Progress is kept apart from the fixed order."}`
      :"This method's steps can only go one way (a single step, a set-up, or a last tile that has to come last).";
    $("zSize").value=ui.size[key];$("zPre").checked=ui.pre;$("zHover").checked=ui.hover;$("zTimer").checked=ui.timer;$("zBuf").value=String(ui.buf);$("zPace").value=String(ui.pace);
    const pzn=isSeq?"sequence":key;$("zPuz").textContent=isSeq?"Sequence":key;$("zPuz2").textContent=pzn;$("zPuz3").textContent=pzn;
    const L=isSeq?[M]:methods(key);
    $("zMeth").innerHTML=L.map(m=>`<option value="${m.id}">${esc(m.name)}${m.custom?" (custom)":""}</option>`).join("");$("zMeth").value=M.base||M.id;
    $("zMethNote").textContent=M.desc+(M.exp?` Expected: ${M.exp}.`:"");
    $("zCustomDel").hidden=!M.custom;$("zCustomErr").textContent="";
    const auto=S.classic&&S.prog.src==="auto";
    $("zPool").innerHTML=(S.classic?[["auto",key==="3x2"?"Every position, easiest first":"Depth by depth"],["random","Random states"]]:[["random","Random states"]]).map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
    $("zPool").value=S.classic?S.prog.src:"random";$("zPool").disabled=!S.classic;
    if(S.ready){const inf=METHODS.depthInfo(d.key,M),[lo,hi]=range(S),o=Array.from({length:inf.max},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("");
      $("zDlo").innerHTML=o;$("zDhi").innerHTML=o;$("zDlo").value=String(lo);$("zDhi").value=String(hi);$("zDname").textContent=inf.name}
    $("zDlo").disabled=$("zDhi").disabled=auto||!S.ready;$("zDnote").textContent=auto?"Used with random states.":"Optimal moves of the first step. Pick one depth, a band, or “x and up” by setting the top to the maximum.";
    const s=hist(S).slice(-100),n=s.length;
    const st=stats(s);
    $("zStats").innerHTML=st?`<div><b>${fmt(st.t)}</b><span>mean s</span></div><div><b>${fmt(st.m,1)}</b><span>moves</span></div><div><b>${fmt(st.opt,1)}</b><span>optimal</span></div><div><b>${pct(st.clean,st.n)}</b><span>clean${st.miss?` · 1 in ${Math.round(st.n/st.miss)} missed`:""}</span></div><div><b>+${st.extra}</b><span>extra moves</span></div><div><b>${fmt(st.tps,1)}</b><span>tps</span></div>`:`<p class="note" style="margin:0">No solves yet with this method.</p>`;
    const rc=rolling(S,100),nc=activeCards(S).length,nm=S.classic?Object.keys(S.prog.mastered).length:null;
    let miss="";const ks=s.filter(x=>x.k!=null&&!x.p);if(ks.length>=5){const c={};ks.forEach(x=>{c[x.k+1]=(c[x.k+1]||0)+1});const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];miss=` · misses most often on move ${top[0]} (${Math.round(top[1]/ks.length*100)}%)`}
    $("zCounts").hidden=!n;$("zCounts").textContent=`last ${n} solves · standard met ${rc.n?Math.round(rc.pass/rc.n*100):0}%${nm!=null?` · ${nm} cases cleared`:""} · ${nc} in review${miss}`;
    $("zUse").hidden=!(key==="3x3"&&S.classic)||!n;
    $("zAltRow").hidden=!ALT[key]||isSeq;$("zAlt").checked=!!ui.alt[key];$("zAltTxt").innerHTML=ALTTXT[key]||"";
    const mm=mergeMode(key),RDv=S.ready?reliableDepth(S):0,multiStep=M.steps.length>1;
    $("zMerge").innerHTML=[["auto",`Auto · ${RDv?`your 80% depth: ${RDv}`:"not enough solves yet"}`],["off","Off · always the method's steps"]].concat([8,10,12,15,18,20,25,30].map(v=>[String(v),`Up to ${v} moves`])).map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
    $("zMerge").value=String(mm);$("zMerge").disabled=!multiStep;
    $("zMergeNote").textContent=multiStep?"When this step and the next ones can be done as one, and that combined optimum is within the depth you already solve reliably (Auto: at least 80% of your steps up to that many moves meet the standard), you get the combined step, e.g. the whole row instead of two pairs. It's never longer than the steps one by one.":"This method is a single step, so there is nothing to combine.";
    const canPick=!isSeq&&!!lineOf(key,curMethodNoPick(key));$("zPickRow").hidden=!SQ[key]||isSeq;$("zPick").checked=!!ui.pick[key]&&canPick;$("zPick").disabled=!canPick;
    $("zPickNote").textContent=canPick?`Each case first asks: column or row first? (${KEYMAP.label(KEYMAP.keys("left")[0]||"")} column, ${KEYMAP.label(KEYMAP.keys("right")[0]||"")} row, or tap.) You then build it with this method, turned to match. The method decides which is better: the lowest total its own steps allow, so a pick that only looks shorter as a whole line can still be wrong. A worse pick is a miss. Progress is kept apart from the plain method.`
      :"This method has no first row or column to choose: it solves the whole puzzle, picks for you, or never completes a line.";
    $("zConfirm").hidden=true;$("zConfirmAll").hidden=true;$("zImportAsk").hidden=true;$("zImportMsg").textContent="";simUI()}
  $("zGear").addEventListener("click",e=>{e.currentTarget.blur();if(panelOpen())closePanel();else openPanel()});
  $("zClose").addEventListener("click",closePanel);
  $("zSize").addEventListener("input",e=>{ui.size[C.key]=+e.target.value;saveUI();layout()});
  $("zPre").addEventListener("change",e=>setPre(e.target.checked));
  $("zHover").addEventListener("change",e=>{ui.hover=e.target.checked;saveUI()});
  $("zTimer").addEventListener("change",e=>{ui.timer=e.target.checked;saveUI();if(C.phase==="solve"||C.phase==="lock")setSub()});
  $("zBuf").addEventListener("change",e=>{ui.buf=+e.target.value;saveUI()});
  $("zPace").addEventListener("change",e=>{ui.pace=e.target.value;saveUI()});
  $("zMeth").addEventListener("change",e=>{setMethod(e.target.value);fillPanel()});
  const ALTTXT={"3x2":"Also train the 2x3 finish<small>As if column 6-10-14 were solved first, leaving 7 8 / 11 12 / 15. Its 359 positions are their own cases, added to the pool while this is on. Your method carries over (10-14 becomes 7-8).</small>",
    "4x3":"Also train the 3x4<small>As if column 1-5-9-13 were solved first instead of row 1, leaving 2 3 4 / 6 7 8 / 10 11 12 / 14 15. Its cases are their own, added to the pool while this is on. Your method carries over (column 5-9-13 becomes row 2-3-4).</small>"};
  $("zAlt").addEventListener("change",e=>{ui.alt[C.key]=e.target.checked;saveUI();layout();fillPanel();progUI();next()});
  const seqChanged=()=>{saveUI();select("seq");fillPanel()};
  $("zSeqFrom").addEventListener("change",e=>{ui.seq.start=e.target.value;seqChanged()});
  $("zSeqTo").addEventListener("change",e=>{ui.seq.end=e.target.value;seqChanged()});
  $("zSeqMir").addEventListener("change",e=>{ui.seq.mir.start=e.target.checked;seqChanged()});
  $("zSeqStages").addEventListener("change",e=>{const t=e.target;if(t.dataset.mir){ui.seq.mir[t.dataset.mir]=t.checked;seqChanged();return}
    const st=t.dataset.st;if(!st)return;ui.seq.m[st]=t.value;seqChanged()});
  $("zMerge").addEventListener("change",e=>{const v=e.target.value;ui.merge[C.key]=v;saveUI();if(C.S){C.S.ready=false;}select(C.key);fillPanel()});
  $("zFlex").addEventListener("change",e=>{ui.flex[C.key]=e.target.checked;saveUI();select(C.key);fillPanel()});
  $("zPick").addEventListener("change",e=>{ui.pick[C.key]=e.target.checked;saveUI();select(C.key);fillPanel()});
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
  // sequence progress lives under the start puzzle's keys with "seq:" in the method id; each tab resets only its own
  const puzzleKey=(k,key)=>key==="seq"?k.includes("-seq:"):!k.includes("-seq:")&&(k==="ssa-v3-"+key||k==="ssa-prog-v1-"+key||k==="ssa3-"+key||k.startsWith("ssa-m-"+key+"-")||k.startsWith("ssa4-"+key+"-"));
  function wipe(key){lsKeys().filter(k=>puzzleKey(k,key)).forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});histForget();
    if(key==="seq"){for(const z in Z)for(const id in Z[z].ms)if(id.startsWith("seq:"))delete Z[z].ms[id]}
    else{const keep={};if(Z[key])for(const id in Z[key].ms)if(id.startsWith("seq:"))keep[id]=Z[key].ms[id];delete Z[key];if(Object.keys(keep).length)data(key).ms=keep}}
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

  targetEl.addEventListener("click",e=>{const a=e.target.closest("[data-pick]");if(a){a.blur();choosePick(a.dataset.pick)}});
  fbEl.addEventListener("click",e=>{const a=e.target.closest("[data-z]");if(!a)return;a.blur();if(a.dataset.z==="replay"&&C.rv)replayBack();if(a.dataset.z==="next")next();if(a.dataset.z==="drill")setDrill(true);if(a.dataset.z==="exit")setDrill(false)});
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
  /* ---------- keys (rebindable: js/keys.js) ---------- */
  /* mouse slip: restart the case; right after a miss, take the miss back first (history, review card, streak) */
  /* Mouse slip. Single-step methods restart the case. Multi-step methods go back one step: mid-step, to where this step
     began; at the start of a step, to where the previous one began (press again to keep going back). Right after a
     solve ends on a miss, the result is taken back first (history, review card, streak) and you return to the start of
     the last step, the timer still running. */
  function restoreSnap(sn){C.si=sn.si;C.b=sn.b.slice();C.walls=sn.walls.slice();C.steps=sn.steps.slice();C.stg=sn.stg.slice();C.norm=sn.norm&&sn.norm.slice();
    C.res.length=sn.res;C.log.length=sn.log;C.picks.length=sn.picks;C.plan=sn.plan;C.planned=sn.planned;C.A=sn.A;C.merged.length=sn.merged;C.moves=sn.moves;
    C.rv=null;C.phase="solve";boardCls("");seqEl.innerHTML="";startStep();render();stepsUI();tagUI();setTarget();setSub()}
  function slip(){flushFinish();const S=C.S;if(!S||!C.it)return;
    const many=C.snaps.length>1||C.steps.length>1;
    if(C.phase==="review"&&C.undo){const u=C.undo,o=JSON.parse(u.prog);setHist(S,u.h);
      for(const k of Object.keys(S.prog))delete S.prog[k];Object.assign(S.prog,o);save(S);if(S.classic)recount(S.d);
      if(S.drill&&u.drill)S.drill.streak=JSON.parse(u.drill);C.streak=u.streak;S.sess=u.sess;C.undo=null;progUI();
      if(!many){load(u.it);fb('<span class="z-mute">mouse slip · the miss was taken back · same case again</span>');return}
      clearTimers();const sn=C.snaps.pop();C.running=true;C.t0=performance.now()-(C.time||0)*1000;requestAnimationFrame(tick);
      restoreSnap(sn);fb('<span class="z-mute">mouse slip · the miss was taken back · back to the start of the last step</span>');return}
    if(C.phase==="solve"&&many){
      if(C.sp.length){restoreSnap(C.snaps.pop());fb('<span class="z-mute">mouse slip · back to the start of this step</span>');return}
      C.snaps.pop();let sn=C.snaps.pop();
      while(sn&&C.snaps.length&&C.log[sn.log]&&!C.log[sn.log].path.length)sn=C.snaps.pop();   // skip steps that were already done with no moves
      if(sn){restoreSnap(sn);fb('<span class="z-mute">mouse slip · back to the start of the previous step</span>');return}}
    if(C.phase==="solve"||C.phase==="lock"||C.phase==="pick"){load(C.it);fb('<span class="z-mute">mouse slip · case restarted</span>')}}
  const kb=id=>KEYMAP.keys(id).map(k=>`<kbd>${esc(KEYMAP.label(k))}</kbd>`).join("")||'<i class="z-mute">none</i>';
  function helpUI(){$("zHelpKeys").innerHTML=[
      [kb("left"),"slide a tile left · picks the column"],[kb("right"),"slide a tile right · picks the row"],[kb("up"),"slide a tile up"],[kb("down"),"slide a tile down"],
      ["click / tap","any tile in the gap's row or column"],[kb("next"),"next case"],[kb("slip"),"mouse slip: restart the case, taking back a miss"],
      [kb("replay"),"in a review: back to the start of this part (again quickly: further back)"],[kb("optimal"),"show / hide optimal"],[kb("stats"),"show / hide stats (session, ao100, ao200…)"],[kb("fs"),"fullscreen"],
      [kb("p1")+kb("p2")+kb("p3")+kb("p4"),"switch puzzle"],[kb("p5"),"sequence trainer"]].map(([k,t])=>`<li><span>${k}</span>${t}</li>`).join("")}
  KEYMAP.onChange(()=>{helpUI();if(C.phase==="pick")setTarget()});
  const DIR={left:"L",right:"R",up:"U",down:"D"};
  document.addEventListener("keydown",e=>{
    if(document.getElementById("view-train").hidden||e.metaKey||e.ctrlKey||e.altKey||KEYMAP.isOpen())return;
    const tg=(e.target.tagName||"").toLowerCase();if(tg==="input"||tg==="select"||tg==="textarea")return;
    if(e.key==="Escape"){if(panelOpen())closePanel();else if(root.classList.contains("pfs"))setPseudo(false);return}
    if(panelOpen())return;
    const a=KEYMAP.action(e.key);if(!a)return;e.preventDefault();
    const dir=DIR[a];
    if(dir&&C.phase==="pick"){if(dir==="L")choosePick("col");else if(dir==="R")choosePick("row");return}
    if(dir){moveDir(dir);return}
    if(a==="next"){if(C.phase!=="build")next()}
    else if(a==="slip")slip();
    else if(a==="replay"){if(C.rv&&(C.phase==="review"||C.phase==="done"))replayBack()}
    else if(a==="fs")toggleFS();else if(a==="optimal")setPre(!ui.pre);else if(a==="stats")setStats(!ui.stats);
    else if(/^p[1-5]$/.test(a))select(KEYS[+a[1]-1])});

  return{start(){helpUI();eyeUI();liveUI();select(KEYS.includes(ui.tab)?ui.tab:"3x2")},select,layout,_state:()=>C,
    exitPseudo(){if(root.classList.contains("pfs"))setPseudo(false)}};
})();
