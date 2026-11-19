/* Shared helpers and puzzle mechanics */
"use strict";
const FA=[1,2,3,4,5,9,13],FB=[6,7,8,10,14];
const sgrp=l=>[1,2,3,4].includes(l)?"s-r1":[5,9,13].includes(l)?"s-c1":[6,7,8].includes(l)?"s-r2":[10,14].includes(l)?"s-c2":[11,12].includes(l)?"s-r3":"s-l";
const fringe=l=>FA.includes(l)?"a":FB.includes(l)?"b":"c";
const fmt=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):"—";
const store={get(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):NaN};

/* ---------- puzzle mechanics ---------- */
function goal(n){const g=[];for(let i=1;i<n;i++)g.push(i);g.push(0);return g}
function nbrs(z,w,h){const r=[],x=z%w,y=(z/w)|0;if(y>0)r.push(z-w);if(y<h-1)r.push(z+w);if(x>0)r.push(z-1);if(x<w-1)r.push(z+1);return r}
function solved(b){for(let i=0;i<b.length-1;i++)if(b[i]!==i+1)return false;return true}
function scramble(w,h){
  const n=w*h,b=goal(n);
  for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}
  const p=b.map(v=>v===0?n-1:v-1),seen=new Array(n).fill(false);let par=0;
  for(let i=0;i<n;i++){if(seen[i])continue;let j=i,len=0;while(!seen[j]){seen[j]=true;j=p[j];len++}par+=len-1}
  const z=b.indexOf(0),d=(w-1-z%w)+(h-1-((z/w)|0));
  if(par%2!==d%2){const a=b.findIndex(v=>v!==0),c=b.findIndex((v,i)=>v!==0&&i!==a);[b[a],b[c]]=[b[c],b[a]]}
  return solved(b)?scramble(w,h):b;
}
const tables={};
function table(key){
  if(tables[key])return tables[key];
  const {w,h}=PUZ[key],g=goal(w*h),dist=new Map([[g.join(""),0]]);let fr=[g],d=0,sum=0,max=0;
  while(fr.length){const nx=[];for(const s of fr){const z=s.indexOf(0);for(const k of nbrs(z,w,h)){const t=s.slice();t[z]=t[k];t[k]=0;const kk=t.join("");if(!dist.has(kk)){dist.set(kk,d+1);nx.push(t);sum+=d+1;max=d+1}}}fr=nx;d++}
  return tables[key]={dist,count:dist.size,max,mean:sum/dist.size};
}
function tileLetter(z,k,w){return k===z+1?"L":k===z-1?"R":k===z+w?"U":"D"}
function optimal(key,b){const {w,h}=PUZ[key],T=table(key);let s=b.slice(),d=T.dist.get(s.join("")),out="";
  while(d>0){const z=s.indexOf(0);for(const k of nbrs(z,w,h)){const t=s.slice();t[z]=t[k];t[k]=0;if(T.dist.get(t.join(""))===d-1){out+=tileLetter(z,k,w);s=t;d--;break}}}return out}
function manhattan(b,w){let md=0;b.forEach((v,i)=>{if(v){md+=Math.abs((v-1)%w-i%w)+Math.abs(((v-1)/w|0)-(i/w|0))}});return md}
function lowerBound(b,w,h){let lc=0;
  for(let y=0;y<h;y++)for(let a=0;a<w;a++)for(let c=a+1;c<w;c++){const va=b[y*w+a],vc=b[y*w+c];if(va&&vc&&((va-1)/w|0)===y&&((vc-1)/w|0)===y&&va>vc)lc+=2}
  for(let x=0;x<w;x++)for(let a=0;a<h;a++)for(let c=a+1;c<h;c++){const va=b[a*w+x],vc=b[c*w+x];if(va&&vc&&(va-1)%w===x&&(vc-1)%w===x&&va>vc)lc+=2}
  return manhattan(b,w)+lc}

/* ---------- subset puzzles ----------
   The trainers nest: 3x2 ⊂ 3x3 ⊂ 4x3 ⊂ 4x4 (3x3 = 4x3 with col 5-9-13 solved, etc.).
   subBoard returns the next-smaller trainer's board when the outer block is already in place, else null.
   Self-contained on purpose: its source is also injected into the solver worker. */
function subBoard(key,b){
  if(key==="3x3"){if(b[0]!==1||b[1]!==2||b[2]!==3)return null;return{key:"3x2",b:b.slice(3).map(v=>v&&v-3)}}
  if(key==="4x3"){if(b[0]!==1||b[4]!==5||b[8]!==9)return null;const m=[0,0,1,2,3,0,4,5,6,0,7,8];return{key:"3x3",b:b.filter((_,i)=>i%4).map(v=>m[v])}}
  if(key==="4x4"){for(let i=0;i<4;i++)if(b[i]!==i+1)return null;return{key:"4x3",b:b.slice(4).map(v=>v&&v-4)}}
  return null}
/* A case is redundant for a trainer when it is really a smaller trainer's case: the outer block is already
   solved AND solving just the smaller puzzle is optimal. If breaking up the solved block gives a strictly
   shorter solution, it is a genuine case for the bigger trainer and is kept. Exact tables only (3x3). */
function redundantExact(key,b){const s=subBoard(key,b);if(!s)return false;
  return table(s.key).dist.get(s.b.join(""))===table(key).dist.get(b.join(""))}
