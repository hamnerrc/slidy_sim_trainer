/* Solving methods: each trainer is solved as a sequence of steps, each graded against its own exact standard */
"use strict";
const METHODS=(function(){
  /* A step places a group of tiles while earlier steps' tiles stay put ("walls").
     step = {t:[labels]} | {alts:[[labels],[labels]]} (whichever group you finish first) | {rest:1} (the rest of the puzzle)
     options: la:{slack,next:stepSpec} grades the step together with the optimal next step it leaves;
              prefix:N grades only the first N moves. */
  const PRESETS={
    "3x2":[
      {id:"opt",name:"Full 3x2 optimal",steps:[{rest:1}],exp:"about 12.6 moves",desc:"The whole 3x2 at its optimum."},
      {id:"p1014",name:"10-14 pair, then the 2x2",steps:[{t:[10,14]},{rest:1}],exp:"about 13.1 moves",desc:"Place 10 and 14 optimally, then cycle the last three."}],
    "3x3":[
      {id:"row",name:"Row 6-8, then 3x2 optimal",steps:[{t:[6,7,8]},{rest:1}],exp:"about 26.5 moves",desc:"Row 6-8 at its own optimum, then the optimal 3x2."},
      {id:"col",name:"Column 6-10-14, then 3x2 optimal",steps:[{t:[6,10,14]},{rest:1}],exp:"about 26.4 moves",desc:"Column 6-10-14 at its own optimum, then the optimal 3x2."},
      {id:"rowla",name:"Row 6-8 set up for the 3x2",steps:[{t:[6,7,8],la:{slack:0,next:{rest:1}}},{rest:1}],exp:"about 25.7 moves",desc:"The row is graded together with the 3x2 it leaves."},
      {id:"colla",name:"Column 6-10-14 set up for the 3x2",steps:[{t:[6,10,14],la:{slack:0,next:{rest:1}}},{rest:1}],exp:"about 25.8 moves",desc:"The column is graded together with the 3x2 it leaves."},
      {id:"either",name:"Row or column, whichever is better",steps:[{alts:[[6,7,8],[6,10,14]],la:{slack:0,next:{rest:1}}},{rest:1}],exp:"about 24.0 moves (50% of cases optimal)",desc:"Pick row or column per case. Graded on the better total."},
      {id:"open8",name:"Opening: first 8 moves optimal",steps:[{rest:1,prefix:8}],exp:"8 moves per case",desc:"Only the first 8 moves count. A wrong move ends the case at once."},
      {id:"opt",name:"Full 3x3 optimal",steps:[{rest:1}],exp:"about 22.0 moves",desc:"The whole 3x3 at its optimum: the top standard."}],
    "4x3":[
      {id:"pair",name:"5, then 9-13 pair",steps:[{t:[5]},{t:[9,13]}],exp:"about 24.0 moves for the column",desc:"Tile 5 first, then 9 and 13 together."},
      {id:"col",name:"Column 5-9-13 optimal",steps:[{t:[5,9,13]}],exp:"about 19.0 moves",desc:"The column as one step at its optimum."},
      {id:"colla",name:"Column set up for the 3x3",steps:[{t:[5,9,13],la:{slack:0,next:{rest:1}}}],exp:"about 19 moves for the column, 39.8 with the 3x3",desc:"An optimal column, graded on the 3x3 it leaves."},
      {id:"colla2",name:"Column set up for the 3x3, up to +2",steps:[{t:[5,9,13],la:{slack:2,next:{rest:1}}}],exp:"about 20 moves for the column, 38.0 with the 3x3",desc:"The column may spend 2 extra moves to force a better 3x3."},
      {id:"colfull",name:"Column, then 3x3 optimal",steps:[{t:[5,9,13]},{rest:1}],exp:"about 40.9 moves",desc:"Optimal column, then solve the optimal 3x3 too."}],
    "4x4":[
      {id:"single",name:"1, then 2, then 3-4 pair",steps:[{t:[1]},{t:[2]},{t:[3,4]}],exp:"about 38.5 moves for row 1",desc:"One tile at a time, last pair together."},
      {id:"pairs",name:"1-2 pair, then 3-4 pair",steps:[{t:[1,2]},{t:[3,4]}],exp:"about 35.5 moves for row 1",desc:"Two pairs, each at its optimum."},
      {id:"row",name:"Row 1 optimal",steps:[{t:[1,2,3,4]}],exp:"about 26.9 moves",desc:"Row 1 as one step at its optimum."},
      {id:"rowla",name:"Row 1 set up for column 5-9-13",steps:[{t:[1,2,3,4],la:{slack:0,next:{t:[5,9,13]}}}],exp:"about 26.9 moves for the row, 44.1 with column 5-9-13",desc:"An optimal row, graded on the column it leaves."},
      {id:"r5",name:"Row 1, then 5, then 9-13",steps:[{t:[1,2,3,4]},{t:[5]},{t:[9,13]}],exp:"about 51.2 moves for the first L",desc:"Row 1, then the first column as 5 and a pair."},
      {id:"r13",name:"Row 1, then 13, then 5-9",steps:[{t:[1,2,3,4]},{t:[13]},{t:[5,9]}],exp:"about 51.1 moves for the first L",desc:"Row 1, then 13 to the corner and 5-9 between."},
      {id:"col",name:"Column 1-5-9-13 optimal",steps:[{t:[1,5,9,13]}],exp:"about 26.7 moves",desc:"The first column as one step at its optimum."},
      {id:"c2",name:"1-5-9-13, then 2, then 3-4",steps:[{t:[1,5,9,13]},{t:[2]},{t:[3,4]}],exp:"about 50.6 moves for the first L",desc:"Column first, then the row as 2 and a pair."},
      {id:"c4",name:"1-5-9-13, then 4, then 2-3",steps:[{t:[1,5,9,13]},{t:[4]},{t:[2,3]}],exp:"about 50.8 moves for the first L",desc:"Column first, then 4 to the corner and 2-3 between."}]};

  const loc=(key,lab)=>PUZ[key].labels.indexOf(lab)+1;     // label -> tile number on this board
  const lab=(key,v)=>PUZ[key].labels[v-1];
  const home=v=>v-1;

  /* ---------- pattern tables: exact moves to bring a tile group home, gap anywhere ---------- */
  const PAT={};
  function nbWalls(w,h,W){const r=[];for(let z=0;z<w*h;z++){const x=z%w,y=(z/w)|0,a=[];
      if(y>0)a.push(z-w);if(y<h-1)a.push(z+w);if(x>0)a.push(z-1);if(x<w-1)a.push(z+1);r.push(a.filter(c=>!W[c]))}return r}
  function pattern(key,tiles,walls){const id=key+"|"+tiles.join(",")+"|"+walls.slice().sort((a,b)=>a-b).join(",");if(PAT[id])return PAT[id];
    const {w,h}=PUZ[key],n=w*h,k=tiles.length,W=new Uint8Array(n);walls.forEach(c=>W[c]=1);
    const NB=nbWalls(w,h,W),st=[];for(let j=0;j<k;j++)st.push(n**(j+1));const size=n**(k+1);
    if(size>(1<<24))throw new Error("step too large");
    const D=new Uint8Array(size).fill(255),Q=new Int32Array(size),hm=tiles.map(home),pos=new Int32Array(k);
    let base=0;hm.forEach((c,j)=>{base+=c*st[j]});let qh=0,qt=0,max=0;
    for(let g=0;g<n;g++)if(!W[g]&&!hm.includes(g)){D[base+g]=0;Q[qt++]=base+g}
    while(qh<qt){const s=Q[qh++],d=D[s];let x=(s/n)|0;const g=s-x*n;
      for(let j=0;j<k;j++){pos[j]=x%n;x=(x/n)|0}
      const nb=NB[g];for(let q=0;q<nb.length;q++){const c=nb[q];let t=s-g+c;
        for(let j=0;j<k;j++)if(pos[j]===c){t+=(g-c)*st[j];break}
        if(D[t]===255){D[t]=d+1;Q[qt++]=t;if(d+1>max)max=d+1}}}
    const hist=new Array(max+1).fill(0);for(let i=0;i<size;i++)if(D[i]!==255)hist[D[i]]++;
    const P={key,tiles,walls,n,k,st,D,NB,max,hist,
      code(b){let s=b.indexOf(0);for(let j=0;j<k;j++)s+=b.indexOf(tiles[j])*st[j];return s},
      dist(b){const v=D[P.code(b)];return v===255?Infinity:v}};
    return PAT[id]=P}

  /* exact table for a solved-region remainder that is itself a 3x2 or 3x3 (possibly transposed) */
  function region(key,walls){const {w,h}=PUZ[key],n=w*h,W=new Set(walls),cells=[];for(let c=0;c<n;c++)if(!W.has(c))cells.push(c);
    const xs=cells.map(c=>c%w),ys=cells.map(c=>(c/w)|0),x0=Math.min(...xs),y0=Math.min(...ys),w2=Math.max(...xs)-x0+1,h2=Math.max(...ys)-y0+1;
    if(cells.length!==w2*h2)return null;
    for(const sk of ["3x2","3x3"]){const S=PUZ[sk];let R=null;
      if(S.w===w2&&S.h===h2){R=[];for(let y=0;y<h2;y++)for(let x=0;x<w2;x++)R.push((y0+y)*w+x0+x)}
      else if(S.w===h2&&S.h===w2){R=[];for(let yy=0;yy<S.h;yy++)for(let xx=0;xx<S.w;xx++)R.push((y0+xx)*w+x0+yy)}
      if(R){const inv=new Map(R.map((c,j)=>[c,j]));
        return{sk,R,dist(b){let s="";for(let j=0;j<R.length;j++){const v=b[R[j]];s+=v?inv.get(home(v))+1:0}const d=table(sk).dist.get(s);return d==null?Infinity:d}}}}
    return null}

  /* ---------- runtime step: resolve a step spec against the tiles already placed ---------- */
  function resolve(key,spec,walls){const n=PUZ[key].w*PUZ[key].h,W=new Set(walls);
    if(spec.rest){const tiles=[];for(let v=1;v<n;v++)if(!W.has(home(v)))tiles.push(v);
      const R=region(key,walls);let f;
      if(R)f=R.dist;else{const P=pattern(key,tiles,walls);f=P.dist}
      return{spec,alts:[tiles],f,rest:true,tiles,exact:!!R&&walls.length===0}}
    const alts=(spec.alts||[spec.t]).map(g=>g.map(l=>loc(key,l))),pats=alts.map(a=>pattern(key,a,walls));
    return{spec,alts,pats,tiles:[...new Set(alts.flat())],f:b=>Math.min(...pats.map(p=>p.dist(b)))}}
  const altDone=(R,b)=>R.alts.findIndex(a=>a.every(v=>b[home(v)]===v));
  function doneStep(R,b){if(R.rest)return solved(b);return altDone(R,b)>=0}
  const wallsAfter=(R,b,walls)=>{const i=R.rest?0:altDone(R,b);return walls.concat(R.alts[Math.max(0,i)].map(home))};

  /* ---------- grading ---------- */
  function moveList(key,b,walls){const {w,h}=PUZ[key],z=b.indexOf(0),x=z%w,y=(z/w)|0,W=new Set(walls),r=[];
    if(y>0)r.push(z-w);if(y<h-1)r.push(z+w);if(x>0)r.push(z-1);if(x<w-1)r.push(z+1);return r.filter(c=>!W.has(c))}
  /* value of the next step after this one finishes on board b */
  function nextVal(key,R,b,walls){const sp=R.spec.la.next,W2=wallsAfter(R,b,walls);return resolve(key,sp,W2).f(b)}
  /* Best achievable (step moves + optimal next step), using at most `limit` step moves. Returns {v,path}. */
  function lookahead(key,R,walls,b,limit,budget,fp){const {w}=PUZ[key];let best=Infinity,bestPath="",nodes=0;const memo=new Map(),path=[],F=fp||R.f;
    const B=b.slice();
    (function go(g,prev){const h=F(B);if(g+h>limit||++nodes>budget)return;
      if(h===0||altDone(R,B)>=0){const v=g+nextVal(key,R,B,walls);if(v<best){best=v;bestPath=path.join("")}return}
      const k=B.join(","),m=memo.get(k);if(m!==undefined&&m<=g)return;memo.set(k,g);
      const z=B.indexOf(0);for(const c of moveList(key,B,walls)){if(c===prev)continue;
        B[z]=B[c];B[c]=0;path.push(tileLetter(z,c,w));go(g+1,z);path.pop();B[c]=B[z];B[z]=0}})(0,-1);
    return{v:best,path:bestPath,cut:nodes>budget}}
  const BUDGET=400000;
  /* standard for a step from board b: {std, limit} */
  /* Set-up steps: each alternative group may use up to its own optimum + slack moves. */
  function laBest(key,R,walls,b,lims,used,budget){let best={v:Infinity,path:"",cut:false};
    (R.pats||[{dist:R.f}]).forEach((p,a)=>{const lim=lims[a]-used;if(lim<0)return;const r=lookahead(key,R,walls,b,lim,budget,p.dist);if(r.cut)best.cut=true;if(r.v<best.v)best={v:r.v,path:r.path,cut:best.cut}});
    return best}
  function standard(key,R,walls,b){const d=R.f(b);
    if(!R.spec.la)return{std:d,d};
    const lims=(R.pats||[{dist:R.f}]).map(p=>p.dist(b)+R.spec.la.slack),r=laBest(key,R,walls,b,lims,0,BUDGET);return{std:r.v,d,lims,path:r.path}}
  /* value of what the solver did: step moves (+ next step optimum for set-up steps) */
  function value(key,R,walls,bEnd,moves){return R.spec.la?moves+nextVal(key,R,bEnd,walls):moves}
  /* optimal continuation for a plain step from board b */
  function descend(key,R,walls,b){const {w}=PUZ[key],s=b.slice();let d=R.f(s),out="";
    while(d>0&&d<Infinity){const z=s.indexOf(0);let moved=false;for(const c of moveList(key,s,walls)){s[z]=s[c];s[c]=0;if(R.f(s)===d-1){out+=tileLetter(z,c,w);d--;moved=true;break}s[c]=s[z];s[z]=0}if(!moved)break}
    return out}
  /* where a step left the standard: k = moves that were still on track, cont = a standard continuation from there */
  function diverge(key,R,walls,b0,path,stdObj){const {w,h}=PUZ[key],b=b0.slice();
    if(!R.spec.la){let d=R.f(b);for(let i=0;i<path.length;i++){applyLetter(b,w,h,path[i]);const nd=R.f(b);
        if(nd!==d-1){const pre=b0.slice();for(let j=0;j<i;j++)applyLetter(pre,w,h,path[j]);return{k:i,cont:descend(key,R,walls,pre)}}d=nd}
      return{k:0,cont:descend(key,R,walls,b0)}}
    let last={k:0,cont:stdObj.path};
    for(let i=1;i<=path.length;i++){applyLetter(b,w,h,path[i-1]);
      const r=laBest(key,R,walls,b,stdObj.lims,i,BUDGET/4);if(r.cut||!Number.isFinite(r.v))break;
      if(i+r.v!==stdObj.std)break;last={k:i,cont:r.path};if(altDone(R,b)>=0)break}
    return last}

  /* ---------- custom methods: "1-5-9-13 / 2 / 3-4 / rest" ---------- */
  function parse(key,text){const P=PUZ[key],parts=String(text).split("/").map(s=>s.trim()).filter(Boolean);if(!parts.length)throw new Error("Enter at least one step.");
    const used=new Set(),steps=[];
    parts.forEach((p,i)=>{if(/^rest$/i.test(p)){if(i!==parts.length-1)throw new Error("“rest” can only be the last step.");steps.push({rest:1});return}
      const t=p.split(/[-,\s]+/).filter(Boolean).map(Number);
      t.forEach(l=>{if(!P.labels.includes(l))throw new Error(`Tile ${l} isn't on the ${key} board.`);if(used.has(l))throw new Error(`Tile ${l} appears twice.`);used.add(l)});
      steps.push({t})});
    if(steps.length&&!steps[steps.length-1].rest&&used.size===P.labels.length)throw new Error("Those steps cover every tile; end with “rest” instead.");
    // every step must be reachable and small enough to tabulate
    let walls=[];const n=P.w*P.h;
    for(const s of steps){let R;try{R=resolve(key,s,walls)}catch(e){throw new Error("A step has too many tiles to grade exactly. Split it up.")}
      for(let t=0;t<40;t++){const b=fillBoard(key,walls,null);if(!Number.isFinite(R.f(b)))throw new Error("A step can't be finished without moving tiles placed earlier (for example a single last tile of a line). Place the last two tiles of a line together.")}
      if(!s.rest)walls=walls.concat(R.alts[0].map(home))}
    return{id:"c:"+strHash(key+text).toString(36),name:text.replace(/\s*\/\s*/g," / "),steps,desc:"Custom method.",custom:text}}

  /* ---------- scrambles ---------- */
  function solvable(b,w,h){const n=w*h,p=b.map(v=>v===0?n-1:v-1),seen=new Array(n).fill(false);let par=0;
    for(let i=0;i<n;i++){if(seen[i])continue;let j=i,len=0;while(!seen[j]){seen[j]=true;j=p[j];len++}par+=len-1}
    const z=b.indexOf(0),d=(w-1-z%w)+(h-1-((z/w)|0));return par%2===d%2}
  /* random board with the walls' tiles placed and (optionally) fixed tile/gap positions */
  function fillBoard(key,walls,fixed){const {w,h}=PUZ[key],n=w*h,b=new Array(n).fill(-1),W=new Set(walls);
    walls.forEach(c=>{b[c]=c+1});const left=[];const fx=fixed||{};
    for(const v in fx){b[fx[v]]=+v}
    for(let v=0;v<n;v++){if(v&&W.has(home(v)))continue;if(fx[v]!=null)continue;left.push(v)}
    const free=[];for(let c=0;c<n;c++)if(b[c]===-1)free.push(c);
    for(let i=left.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[left[i],left[j]]=[left[j],left[i]]}
    free.forEach((c,i)=>{b[c]=left[i]});
    if(!solvable(b,w,h)){const sw=free.filter(c=>b[c]!==0);if(sw.length<2)return null;[b[sw[0]],b[sw[1]]]=[b[sw[1]],b[sw[0]]]}
    return b}
  /* uniform random board whose first-step depth lies in [lo,hi] */
  const RANGE={};
  function sampleFirst(key,R,lo,hi){
    if(R.pats&&R.pats.length===1){const P=R.pats[0],id=P.key+P.tiles+"|"+lo+"-"+hi;let L=RANGE[id];
      if(!L){let c=0;for(let i=0;i<P.D.length;i++)if(P.D[i]>=lo&&P.D[i]<=hi)c++;L=new Int32Array(c);c=0;for(let i=0;i<P.D.length;i++)if(P.D[i]>=lo&&P.D[i]<=hi)L[c++]=i;RANGE[id]=L}
      if(!L.length)return null;
      for(let t=0;t<20;t++){let x=L[Math.floor(Math.random()*L.length)];const n=P.n,g=x%n;x=(x-g)/n;const fx={0:g};
        for(let j=0;j<P.k;j++){fx[P.tiles[j]]=x%n;x=(x-x%n)/n}
        const b=fillBoard(key,[],fx);if(b&&!solved(b))return b}
      return null}
    for(let t=0;t<4000;t++){const b=fillBoard(key,[],null),d=R.f(b);if(d>=lo&&d<=hi&&!solved(b))return b}
    return null}

  function list(key,custom){return PRESETS[key].concat(custom||[])}
  function depthInfo(key,M){const R=resolve(key,M.steps[0],[]);
    if(R.exact)return{max:table(key).max,name:"whole puzzle"};
    if(R.pats&&R.pats.length===1)return{max:R.pats[0].max,name:stepName(key,M.steps[0])};
    return{max:Math.max(...R.pats.map(p=>p.max)),name:stepName(key,M.steps[0])}}
  function stepName(key,s){if(s.rest)return s.prefix?`first ${s.prefix} moves`:"the rest";if(s.alts)return s.alts.map(a=>a.join("-")).join(" or ");return s.t.join("-")}
  return{PRESETS,list,resolve,doneStep,wallsAfter,standard,value,diverge,parse,sampleFirst,fillBoard,depthInfo,stepName,altDone,pattern,loc,lab,home}
})();
