/* Leaderboard and tier tables */
"use strict";
(function(){
/* ---------- tables ---------- */
const top=LB["4x4_ao100"]||[];
const NAMES=["dphdmn","vovker","Dawidluna","TheMatsValk","tnum10","JZE","kolunoa","c0wmanglr","daanbe","sq"];
document.querySelector("#topTable tbody").innerHTML=top.slice(0,10).map((r,i)=>`<tr><td class="num">${i+1}</td><td>${NAMES[i]}</td><td class="num">${fmt(r[0],3)}</td><td class="num">${fmt(r[1],1)}</td><td class="num">${fmt(r[2],1)}</td></tr>`).join("");
(function(){const tc=["4x4 ao12","4x4 ao100","3x3 ao100"],fc=["4x4 ao100","3x3 ao100"];
  let h=`<thead><tr><th>Tier</th>${tc.map(c=>`<th>${c} time</th>`).join("")}${fc.map(c=>`<th>FMC ${c} moves</th>`).join("")}</tr></thead><tbody>`;
  TIERS.names.forEach((n,i)=>{h+=`<tr><td>${n}</td>${tc.map(c=>`<td class="num">${TIERS.time[c][i]}</td>`).join("")}${fc.map(c=>`<td class="num">${TIERS.fmc[c][i]}</td>`).join("")}</tr>`});
  document.getElementById("tierTable").innerHTML=h+"</tbody>";})();
})();
