/* Runs the "if optimal" simulation on its own thread, so its work (and its memory clean-up) never touches a frame.
   It is told a method and how far the count has got; it plays solves and reports the running totals. */
"use strict";
const V=self.location.search;
importScripts("data.js"+V,"puzzle.js"+V,"solver.js"+V,"methods.js"+V,"plans.js"+V);
let cur=0;
self.onmessage=e=>{const {id,key,M,ap,n,sum,sq,target}=e.data,my=++cur,S={d:{key},M,alt:{},ap},r={n,sum,sq};
  const chunk=()=>{if(my!==cur)return;const t=Date.now();
    while(Date.now()-t<150&&r.n<target){let m;try{m=METHODS.run(simSolveG(S))}catch(err){m=NaN}
      if(!Number.isFinite(m)){postMessage({id,n:r.n,sum:r.sum,sq:r.sq,na:true,done:true});return}r.n++;r.sum+=m;r.sq+=m*m}
    const done=r.n>=target;postMessage({id,n:r.n,sum:r.sum,sq:r.sq,done});if(!done)setTimeout(chunk,0)};
  chunk()};
