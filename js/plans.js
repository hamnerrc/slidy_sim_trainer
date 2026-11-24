/* Planning shared by the trainer page and the simulation worker: transposed shapes, the orders and ways round a
   method can be built in (plans), and one simulated solve played exactly as the grader expects. No page state here. */
"use strict";
function tmap(A,B){const m={};A.labels.forEach((l,j)=>{const x=j%A.w,y=(j/A.w)|0;m[l]=B.labels[x*B.w+y]});return m}
const ALT={"3x2":{pk:"2x3"},"4x3":{pk:"3x4"}};for(const k in ALT)ALT[k].map=tmap(PUZ[k],PUZ[ALT[k].pk]);

function mapSpec(sp,m){if(!sp)return sp;const r=Object.assign({},sp),mp=g=>g.map(l=>m[l]).sort((x,y)=>x-y);if(sp.t)r.t=mp(sp.t);if(sp.alts)r.alts=sp.alts.map(mp);
  if(sp.la)r.la=Object.assign({},sp.la,{next:mapSpec(sp.la.next,m)});return r}
/* the method's steps for a case: on the transposed shape (pk), or turned to the other line (flip, pick mode) */
function stepsFor(S,pk,flip){pk=pk||S.d.key;if(pk===S.d.key&&!flip)return S.M.steps;S.alt=S.alt||{};const id=pk+(flip?"~T":"");
  return S.alt[id]||(S.alt[id]=S.M.steps.map(sp=>mapSpec(sp,flip?SQ[S.d.key]:S.M.seq?T4:ALT[S.d.key].map)))}
const SQ={"3x3":tmap(PUZ["3x3"],PUZ["3x3"]),"4x4":tmap(PUZ["4x4"],PUZ["4x4"])};
function lines(key){const P=PUZ[key];return{row:P.labels.slice(0,P.w),col:P.labels.filter((_,j)=>j%P.w===0)}}
/* which line the method builds first as written ("row" / "col"), or null when it has none to pick */
function lineOf(key,M){if(!SQ[key])return null;const L=lines(key),acc=new Set();
  for(const sp of M.steps){if(sp.rest||sp.alts||sp.prefix)return null;sp.t.forEach(l=>acc.add(l));
    for(const o of ["row","col"])if(L[o].every(l=>acc.has(l)))return o}
  return null}

const T4=tmap(PUZ["4x4"],PUZ["4x4"]);

/* can this method's steps go in another order? (plain tile steps, 2-4 of them, a trailing rest stays last) */
function orderable(steps){const k=steps.length;if(k<2||steps.some(x=>x.alts||x.prefix)||steps.slice(0,-1).some(x=>x.la||x.rest)||steps[k-1].la)return false;
  const head=steps[k-1].rest?k-1:k;return head>=2&&head<=4}

function perms(a){if(a.length<2)return[a];const r=[];a.forEach((x,i)=>perms(a.slice(0,i).concat(a.slice(i+1))).forEach(p=>r.push([x].concat(p))));return r}
/* the method turned end for end along its line (in 4x4 coordinates): 5 / 9-13 becomes 13 / 5-9, 1 / 2 / 3-4 becomes
   4 / 3 / 1-2. Null when its tiles don't lie on one row or column. */
function reflectLine(steps){const ts=steps.filter(x=>x.t).flatMap(x=>x.t);if(ts.length<2)return null;
  const row=new Set(ts.map(l=>((l-1)/4)|0)).size===1,col=new Set(ts.map(l=>(l-1)%4)).size===1;if(!row&&!col)return null;
  const ord=ts.slice().sort((a,b)=>a-b),m={};ord.forEach((l,i)=>{m[l]=ord[ord.length-1-i]});
  return steps.map(x=>x.t?Object.assign({},x,{t:x.t.map(l=>m[l]).sort((a,b)=>a-b)}):x)}
/* the step lists allowed: the method's steps and their end-for-end mirror, each in every order (plain tile steps,
   up to 4; a trailing rest stays last; set-ups stay put). Orders that can't be built drop out when measured. */
function stepOrders(steps,flex){if(!flex||!orderable(steps))return[steps];
  const bases=[steps],r=reflectLine(steps);if(r)bases.push(r);const out=[],seen=new Set();
  for(const b of bases){const k=b.length,tail=b[k-1].rest?[b[k-1]]:[],head=b[k-1].rest?b.slice(0,-1):b;
    for(const p of perms(head)){const st=p.concat(tail),id=st.map(x=>x.rest?"r":x.t.join("-")).join("/");if(!seen.has(id)){seen.add(id);out.push(st)}}}
  return out}
const stepsName=(key,st)=>st.filter(x=>!x.rest).map(x=>METHODS.stepName(key,x)).join(" → ");
/* variants: [{steps, a (way round, sequences), label}] → plans with their best totals */
function plansFor(key,variants,walls,b,flex){const out=[];
  for(const v of variants){const os=stepOrders(v.steps,flex);
    for(const steps of os){const p=mkPlan(key,steps,walls,b);if(!p)continue;
      p.a=v.a;p.line=v.label;p.name=[v.label,os.length>1?stepsName(key,steps):""].filter(Boolean).join(" · ")||stepsName(key,steps);out.push(p)}}
  return out}
/* a plan's best total (m, path) and its first step's standard are worked out when first asked for: a lone set-up
   step's total is a full look-ahead search, so it waits; a multi-step plan is measured now (cheap, and it tells
   whether the order can be built at all) */
function mkPlan(key,steps,walls,b){walls=walls.slice();b=b.slice();const R0=METHODS.resolve(key,steps[0],walls),lone=steps.length===1&&!!steps[0].la;
  if(!Number.isFinite(R0.f(b)))return null;
  let r=null,std=null;
  const p={steps,R:R0,setup:lone,whole:steps.length===1,
    warm:function*(){if(!r)r=yield* METHODS.chainBestG(key,steps,walls,b);if(!std)std=yield* METHODS.standardG(key,R0,walls,b)},
    known:()=>!!r,ok:()=>!r||Number.isFinite(r.v)};
  Object.defineProperty(p,"m",{get:()=>(r||(r=METHODS.chainBest(key,steps,walls,b))).v});Object.defineProperty(p,"path",{get:()=>(r||(r=METHODS.chainBest(key,steps,walls,b))).path});
  Object.defineProperty(p,"std",{get:()=>std||(std=METHODS.standard(key,R0,walls,b))});
  return p}
const bestOf=a=>{const f=a.filter(p=>Number.isFinite(p.m));return(f.length?f:a).reduce((x,y)=>y.m<x.m?y:x)};

/* which way round a stage is, from the shape of what is left (4x4 coordinates); square stages keep the previous way */
function orientA(BP,walls,st,prev){const P=PUZ[st],placed=new Set(walls.map(c=>BP.labels[c])),rem=BP.labels.filter(l=>!placed.has(l)).concat([16]);
  const xs=rem.map(l=>(l-1)%4),ys=rem.map(l=>((l-1)/4)|0),w=Math.max(...xs)-Math.min(...xs)+1,h=Math.max(...ys)-Math.min(...ys)+1;
  return w!==h?!(w===P.w&&h===P.h):prev}
/* the ways round a stage may go: its own, plus the other with "Pick the best order" on a square stage with a line */
function stageVariants(M,st,norm,A){const line=PUZ[st].w===PUZ[st].h?lineOf(st,{steps:norm}):null,both=!!line&&!!M.seq.mir[st];
  return(both?[A,!A]:[A]).map(a=>{const steps=norm.map(sp=>a?mapSpec(sp,T4):sp);let label="";
    if(both){const labs=lines(st)[line].map(l=>a?T4[l]:l),isRow=new Set(labs.map(l=>((l-1)/4)|0)).size===1;label=(isRow?"row ":"column ")+labs.slice().sort((x,y)=>x-y).join("-")}
    return{steps,a,label}})}

/* ---------- expected movecount: random scrambles played at the standard ----------
   Each simulated solve plays every step exactly as the grader expects (its optimum, the best set-up, or the best
   plan when an order switch is on), with these exact settings, and counts the moves. Bigger steps are left out. */
function* simSolveG(S){const M=S.M,ap=S.ap;let pk=S.d.key;if(ap&&Math.random()<.5)pk=ap;const P=PUZ[pk];
  if(M.steps.some(x=>x.prefix))return NaN;
  const b=METHODS.fillBoard(pk,[],null);let walls=[],moves=0,A=false;if(!b)return NaN;
  const run=path=>{for(const L of path)applyLetter(b,P.w,P.h,L);moves+=path.length};
  const plainStep=function*(sp){yield* METHODS.ensureG(pk,sp,walls);const R=METHODS.resolve(pk,sp,walls);if(!Number.isFinite(R.f(b)))return false;run(sp.la?(yield* METHODS.standardG(pk,R,walls,b)).path||"":METHODS.descend(pk,R,walls,b));walls=METHODS.wallsAfter(R,b,walls);return true};
  const bestPlan=function*(variants,flex){for(const v of variants)for(const o of stepOrders(v.steps,flex))yield* METHODS.ensureG(pk,o[0],walls);
    const pl=plansFor(pk,variants,walls,b,flex);for(const p of pl)yield* p.warm();const f=pl.filter(p=>Number.isFinite(p.m));return f.length?bestOf(f):null};
  const placeAll=p=>{for(const sp of p.steps){if(sp.rest)return;walls=walls.concat((sp.alts?sp.alts[0]:sp.t).map(l=>METHODS.home(METHODS.loc(pk,l))))}};
  if(!M.seq){
    const variants=M.pick?["row","col"].map(ln=>({steps:stepsFor(S,pk,ln!==M.pick.line),label:ln})):[{steps:stepsFor(S,pk),label:""}];
    if(variants.length>1||(M.flex&&M.steps.length>1)){const p=yield* bestPlan(variants,!!M.flex);if(!p)return NaN;run(p.path);return moves}
    for(const sp of stepsFor(S,pk))if(!(yield* plainStep(sp)))return NaN;return moves}
  const stg=M.seq.stg;let i=0;
  while(i<M.steps.length){let end=i;while(end+1<M.steps.length&&stg[end+1]===stg[i])end++;const st=M.seq.stages[stg[i]];
    A=orientA(P,walls,st,A);const norm=M.steps.slice(i,end+1),variants=stageVariants(M,st,norm,A);
    if(variants.length>1||(M.flex&&norm.length>1)){const p=yield* bestPlan(variants,!!M.flex);if(!p)return NaN;run(p.path);A=p.a;placeAll(p)}
    else for(const sp of variants[0].steps)if(!(yield* plainStep(sp)))return NaN;
    i=end+1}
  return moves}


