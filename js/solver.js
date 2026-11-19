/* Background IDA* solver (Web Worker) */
"use strict";
/* ================= Zen trainer ================= */
const WORKER_SRC=`
const SPEC={"4x4":{w:4,h:4,pats:[[1,2,5,6,9],[3,4,7,8,12],[10,11,13,14,15]]},"4x3":{w:4,h:3,pats:[[1,2,5,6],[3,4,7,8],[9,10,11]]},"3x3":{w:3,h:3,pats:[[1,2,3,4],[5,6,7,8]]}};
const LIMIT=90000, built={};
function nbList(w,h){const r=[];for(let z=0;z<w*h;z++){const x=z%w,y=(z/w)|0,a=[];if(y>0)a.push(z-w);if(y<h-1)a.push(z+w);if(x>0)a.push(z-1);if(x<w-1)a.push(z+1);r.push(a)}return r}
function buildPat(w,h,tiles,NB){
  const n=w*h,k=tiles.length,B=4*k,mask=(1<<B)-1;
  const dist=new Uint8Array(1<<(B+4)).fill(255),pdb=new Uint8Array(1<<B).fill(255),pos=new Int8Array(k);
  let start=(n-1)<<B;tiles.forEach((t,j)=>{start+=(t-1)<<(4*j)});
  let cur=[start],d=0;dist[start]=0;
  while(cur.length){const next=[];
    for(let i=0;i<cur.length;i++){const s=cur[i];if(dist[s]!==d)continue;
      const pk=s&mask;if(pdb[pk]>d)pdb[pk]=d;
      let x=s;for(let j=0;j<k;j++){pos[j]=x&15;x>>>=4}const b=x&15,nb=NB[b];
      for(let q=0;q<nb.length;q++){const c=nb[q];let j=-1;for(let r=0;r<k;r++)if(pos[r]===c){j=r;break}
        if(j<0){const t=(s&mask)|(c<<B);if(dist[t]>d){dist[t]=d;cur.push(t)}}
        else{const t=s-(c<<(4*j))+(b<<(4*j))-(b<<B)+(c<<B);if(dist[t]>d+1){dist[t]=d+1;next.push(t)}}}}
    cur=next;d++}
  return pdb}
function letter(z,c,w){return c===z+1?"L":c===z-1?"R":c===z+w?"U":"D"}
function applyL(b,w,h,L){const z=b.indexOf(0),x=z%w,y=(z/w)|0;let k=-1;if(L==="L"&&x<w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<h-1)k=z+w;if(L==="D"&&y>0)k=z-w;if(k>=0){b[z]=b[k];b[k]=0}}
function ensure(key){const S=SPEC[key];if(!built[key]){postMessage({type:"status",key,msg:"building"});const NB=nbList(S.w,S.h);built[key]={NB,pdbs:S.pats.map(p=>buildPat(S.w,S.h,p,NB))};postMessage({type:"status",key,msg:"ready"})}return built[key]}
function solve(key,board,limit){
  const LIM=limit||LIMIT,S=SPEC[key],{NB,pdbs}=ensure(key),n=S.w*S.h,pi=new Int8Array(n+1).fill(-1),sh=new Int8Array(n+1);
  S.pats.forEach((p,i)=>p.forEach((t,j)=>{pi[t]=i;sh[t]=4*j}));
  const b=Int8Array.from(board),z0=b.indexOf(0),keys=new Int32Array(pdbs.length);
  for(let c=0;c<n;c++){const t=b[c];if(t>0)keys[pi[t]]+=c*(1<<sh[t])}
  let h0=0;for(let i=0;i<pdbs.length;i++)h0+=pdbs[i][keys[i]];
  const path=new Int8Array(160);let nodes=0,nextB,abort=false,len=-1;const t0=Date.now();
  function dfs(z,g,h,prev,bound){const f=g+h;if(f>bound){if(f<nextB)nextB=f;return false}
    if(h===0){len=g;return true}
    if((++nodes&0x3FFFF)===0&&Date.now()-t0>LIM){abort=true;return false}
    const nb=NB[z];
    for(let q=0;q<nb.length;q++){const c=nb[q];if(c===prev)continue;
      const t=b[c],p=pi[t],ok=keys[p],nk=ok+(z-c)*(1<<sh[t]),pd=pdbs[p],nh=h-pd[ok]+pd[nk];
      b[z]=t;b[c]=0;keys[p]=nk;path[g]=c;
      if(dfs(c,g+1,nh,z,bound))return true;
      b[c]=t;b[z]=0;keys[p]=ok;if(abort)return false}
    return false}
  let bound=h0;
  while(true){nextB=1e9;if(dfs(z0,0,h0,-1,bound))break;if(abort)return{fail:true,lb:h0};bound=nextB}
  let sol="",z=z0;for(let i=0;i<len;i++){sol+=letter(z,path[i],S.w);z=path[i]}
  return{sol}}
${subBoard}
/* true: the case is really the smaller trainer's (outer block solved and the sub-solve is optimal);
   false: genuine case; null: sub-solve timed out (undecided). */
function redundant(key,b,opt){const s=subBoard(key,b);if(!s)return false;const r=solve(s.key,s.b);return r.fail?null:r.sol.length<=opt}
function walk(key,k){const S=SPEC[key],NB=nbList(S.w,S.h),n=S.w*S.h,b=[];for(let i=1;i<n;i++)b.push(i);b.push(0);
  let z=n-1,prev=-1;for(let i=0;i<k;i++){const c=NB[z].filter(x=>x!==prev),q=c[Math.floor(Math.random()*c.length)];b[z]=b[q];b[q]=0;prev=z;z=q}return b}
onmessage=e=>{const m=e.data;try{
  if(m.type==="redundant"){postMessage({type:"result",id:m.id,redundant:redundant(m.key,m.board,m.opt)});return}
  if(m.type==="gen"){for(let t=0;t<300;t++){const k=m.lo+Math.floor(Math.random()*(m.hi*2-m.lo+1)),b=walk(m.key,k),r=solve(m.key,b);
      if(!r.fail&&r.sol.length>=m.lo&&r.sol.length<=m.hi&&redundant(m.key,b,r.sol.length)===false){postMessage({type:"result",id:m.id,board:b,sol:r.sol});return}}
    postMessage({type:"result",id:m.id,fail:true});return}
  if(m.type==="diverge"){const S=SPEC[m.key];ensure(m.key);
    const pos=i=>{const b=m.board.slice();for(let j=0;j<i;j++)applyL(b,S.w,S.h,m.path[j]);return b};
    let lo=0,hi=m.path.length,cont=m.sol;const t0=Date.now();
    while(hi-lo>1){const mid=(lo+hi)>>1,r=solve(m.key,pos(mid),20000);
      if(r.fail||Date.now()-t0>45000){postMessage({type:"result",id:m.id,fail:true});return}
      if(mid+r.sol.length===m.opt){lo=mid;cont=r.sol}else hi=mid}
    postMessage({type:"result",id:m.id,k:lo,cont});return}
  const r=solve(m.key,m.board);r.id=m.id;r.type="result";postMessage(r)}
  catch(err){postMessage({type:"result",id:m.id,fail:true,err:String(err)})}};
`;
function mkSolver(){return{w:null,n:0,cbs:new Map(),status:{},onStatus:null,
  get(){if(!this.w){this.w=new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:"text/javascript"})));
    this.w.onmessage=e=>{const m=e.data;if(m.type==="status"){this.status[m.key]=m.msg;if(this.onStatus)this.onStatus(m);return}
      const cb=this.cbs.get(m.id);if(cb){this.cbs.delete(m.id);cb(m)}};
    this.w.onerror=()=>{const c=[...this.cbs.values()];this.cbs.clear();c.forEach(f=>f({fail:true}))}}return this.w},
  post(msg,cb){const id=++this.n;this.cbs.set(id,cb);try{this.get().postMessage(Object.assign({id},msg))}catch(e){this.cbs.delete(id);cb({fail:true})}}}}
function applyLetter(b,w,h,L){const z=b.indexOf(0),x=z%w,y=(z/w)|0;let k=-1;
  if(L==="L"&&x<w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<h-1)k=z+w;if(L==="D"&&y>0)k=z-w;
  if(k<0)return false;b[z]=b[k];b[k]=0;return true}
const strHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0};
