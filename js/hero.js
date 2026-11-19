/* Hero strip */
"use strict";
/* ---------- hero ---------- */
(function(){const host=document.getElementById("heroStrip");
  const st=[["4x4",[]],["4x3",[1,2,3,4]],["3x3",[1,2,3,4,5,9,13]],["3x2",[1,2,3,4,5,9,13,6,7,8]],["2x2",[1,2,3,4,5,9,13,6,7,8,10,14]]];
  const lab=["row 1","col 5-9-13","row 6-8","col 10-14"];
  st.forEach(([n,done],i)=>{const s=document.createElement("div");s.className="stage";const m=document.createElement("div");m.className="mini";
    for(let c=1;c<=16;c++){const sp=document.createElement("span");if(c<16)sp.className=sgrp(c)+(done.includes(c)?" done":"");m.appendChild(sp)}
    s.appendChild(m);const sm=document.createElement("small");sm.textContent=n;s.appendChild(sm);host.appendChild(s);
    if(i<4){const a=document.createElement("div");a.className="arrow";a.textContent=lab[i]+" →";host.appendChild(a)}});
})();
