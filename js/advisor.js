/* Advisor */
"use strict";
/* ---------- advisor ---------- */
const CFG={
 "4x4":{mv:[160,130,110,95,85,75],tps:[6,9,12,16,20,25],xd:[56,200],yd:[0,34],iso:[2.5,3,4,5,7,10,15,25],opt:52.6,
   mvLab:[">160","130–160","110–130","95–110","85–95","75–85","<75"]},
 "3x3":{mv:[45,38,33,30,27,25],tps:[8,12,16,20,25,30],xd:[19,62],yd:[0,40],iso:[0.75,1,1.5,2,3,5,8],opt:21.97,
   mvLab:[">45","38–45","33–38","30–33","27–30","25–27","<25"]}
};
const tpsLab=c=>["<"+c.tps[0],...c.tps.slice(0,-1).map((v,i)=>v+"–"+c.tps[i+1]),"≥"+c.tps[c.tps.length-1]];
const EFF={
"4x4":[
 {n:"Unsettled method",d:"More than 160 means the reduction isn't fixed yet, or the gap wanders between tiles.",l:["Fix one reduction (fringe or LBL) and use it every solve.","Learn the corner trick for 3&4 and 9&13 so you never break a solved tile.","Solve untimed and count. Get under 140 before chasing time."],ex:"A clean beginner fringe lands around 130–150."},
 {n:"Tile by tile",d:"Typical when every tile is placed on its own with no pairs, and the gap travels the long way around.",l:["Pair-solve 1-2, 3-4, 9-13, 7-8, 10-14 every time.","Route the gap to the side each tile must move toward, never past it.","3x3 trainer: average under 32."],ex:"Leaderboard ranks 151–250 average about 129 moves at 9 TPS."},
 {n:"Clean reduction",d:"Standard fringe or LBL done cleanly at speed sits here. The leaderboard median ao100 is 104.",l:["Budget each stage: row 1 under about 38 (optimal 26.9), column 5-9-13 under 26 (18.8), 3x3 under 30 (≈24).","At every reduction, choose row or column by which is cheaper.","Check replays stage by stage to find which one is over budget."],ex:"Ranks 101–150 average about 109 moves at 11.5 TPS."},
 {n:"Efficient",d:"Around the leaderboard middle to top 100. Losses now come from stage endpoints and row 1.",l:["Plan 1 and 2 completely before your first move.","End each stage with the gap and next tiles set up (worth about 1.4 per stage on the 3x3).","Force an easy 2x2: steer 11, 12, 15 while inserting 10/14."],ex:"Ranks 31–100 average 97–99 moves at 14–17 TPS."},
 {n:"Top-30 efficiency",d:"Ranks 11–30 average about 90. You are about 15–25 moves above stage-perfect play.",l:["Insert blocks of 2–3 tiles in one loop.","Review your worst 20 solves with !solve or the replay optimal solver; most of the excess is row 1.","Solve the row and column of the first L together, not in sequence."],ex:"Moves/MD on the replay site is a quick per-solve efficiency check."},
 {n:"Top-10 efficiency",d:"The top 10 ao100s run 75–94 moves. Stage-perfect fringe is about 70, so you are within 5–15 of it.",l:["Cross-stage planning: carry 6 and 10 while inserting 5-9-13.","Study replays of dphdmn, vovker, daanbe, JZE (75–79 at speed).","Protect TPS: planning must not create pauses."],ex:"daanbe: 75.5 moves at 21.4 TPS (3.55 ao100)."},
 {n:"Beyond stage-perfect",d:"Under 75 at speed is better than any current top ao100. It requires planning across stages, beyond the ≈70 of perfect stage-by-stage play.",l:["Check that it's not an ao5/ao12 effect: best ao12s of top players are 64–70.","Look for TPS gains: at this movecount, execution is almost always the cheaper improvement.","Use FMC sessions to keep stretching what you can see."],ex:"Slow movecount ao100 records: 55.9 (1.3 TPS) to 66.7 (3.1 TPS)."}
],
"3x3":[
 {n:"Unsettled",d:"Tiles placed one at a time with the gap wandering.",l:["Learn row 6-7-8 with the corner trick.","Solve the 3x2 as the 10/14 pair, then cycle.","Count untimed until under 38."],ex:"Shortest-row then 3x2 without care averages 27.3."},
 {n:"Routing",d:"The reduction is known; gap routes are long.",l:["Route the gap directly to the side the tile moves toward.","3x2 trainer within 1 of optimal.","Read the 2x2 cycle direction before moving."],ex:"Leaderboard ranks 151–250 average 42.5."},
 {n:"Clean reduction",d:"Around the leaderboard median (32.7 for ao100).",l:["Watch the optimal replay after every solve over 32.","Pair 7&8 or 10&14 instead of using the corner trick.","Start choosing row vs column."],ex:"Ranks 101–150 average 34.4."},
 {n:"Efficient",d:"Near careless-but-perfect row-first play (27.3).",l:["Choose row vs column every solve (−1.9 measured).","Finish the row with the easiest 3x2 (−1.4 measured).","Burst the 3x2."],ex:"Ranks 31–100 average 29–31."},
 {n:"Top-30",d:"At or below perfect row-first play.",l:["Use row/column choice and endpoints on every solve.","Learn the common cases where optimal breaks the row.","Shift practice to TPS."],ex:"Ranks 11–30 average 28.3."},
 {n:"Top-10",d:"Top 10 ao100s: 23–28 moves.",l:["Mostly execution from here.","Keep the optimal habits as warm-up.","Track +moves over optimal."],ex:"c0wmanglr 23.0, daanbe 23.6, vovker 23.8."},
 {n:"Near optimal",d:"Under 25: close to choose-row-or-column perfect play (23.9). Optimal is 21.97.",l:["Execution is now the main lever.","Keep 3x3 sessions as TPS training.","Bring the same reading to the 4x4's second L."],ex:"Top 3x3 ao100: 0.736 s at 37 TPS."}
]};
const EXE={
"4x4":[
 {n:"Pausing",d:"Under 6 TPS usually means a pause before most tiles. Recognition is the bottleneck.",l:["Many short 3x3 and 3x2 solves: small puzzles train recognition fastest.","Switch to hover controls now rather than later.","Never-stop solves at a slow, steady pace."],ex:"At 110 moves, 5 → 8 TPS is 22 s → 14 s."},
 {n:"Bursty",d:"Fast bursts with long pauses between tiles.",l:["Hover, 0 ms animation.","Re-execute optimal 3x3 solutions from the trainer at max speed.","Make 2x2 cycles one motion."],ex:"Ranks 151–250 sit around 9 TPS."},
 {n:"Steady",d:"Leaderboard ranks 100–150 average 11.5 TPS.",l:["Lookahead: find the next tile before finishing the current one.","ao50/ao100 sessions for consistency.","Use 'Fringe minimal' or 'Fading tiles' display to train tracking."],ex:"10 tile placements with a 0.3 s look each is 3 s of nothing."},
 {n:"Fluent",d:"Ranks 60–100 average 13.7 TPS.",l:["Stage transitions at full speed.","Burst endings at 1.5× your average TPS.","Long marathons (x10, x42) for stamina."],ex:"Ranks 31–60 average 17 TPS."},
 {n:"Fast",d:"Ranks 30–60 average 17 TPS.",l:["Look ahead two tiles deep.","Warm up on 3x3 (top 3x3 ao100s are 25–37 TPS).","Check replays for per-move timing gaps."],ex:"Ranks 11–30 average 21 TPS."},
 {n:"Top-30 TPS",d:"Ranks 11–30 average 21 TPS; most of the top 10 are 21–25.",l:["Remove the last stage-transition hesitations (replay move times show them).","Ergonomics: mouse, DPI, desk, posture.","Balance with efficiency: at this TPS, 10 moves is about 0.45 s."],ex:"JZE: 22.6 TPS, 78.3 moves → 3.49 ao100."},
 {n:"Elite TPS",d:"Above 25 sustained is the top 5: dphdmn 29.3, vovker 28.2, TheMatsValk 27.9, tnum10 27.4, kolunoa 25.4.",l:["Efficiency is now the cheaper gain unless you're above 85 moves.","Keep consistency on ao100.","Peak TPS PBs: 30.8 ao100, 34.1 ao12."],ex:"TheMatsValk: 27.9 TPS but 92.4 moves → 3.33."}
],
"3x3":[
 {n:"Pausing",d:"Under 8 TPS on 3x3 means pausing between tiles.",l:["Hover controls.","Repeat the same scramble (Ctrl+Z in Slidysim).","Short, frequent sessions."],ex:"At 30 moves, 6 → 12 TPS halves your time."},
 {n:"Bursty",d:"Pauses between row and 3x2.",l:["Plan the whole solve before moving.","Re-execute optimal solutions.","Never-stop solves."],ex:"Ranks 151–250: 10 TPS."},
 {n:"Steady",d:"Ranks 101–150: about 13 TPS.",l:["Plan the 3x2 during the row.","ao100 sessions.","Bursts on the 2x2."],ex:"Ranks 61–100: 16 TPS."},
 {n:"Fluent",d:"Ranks 31–100: 16–19 TPS.",l:["One continuous motion per solve.","Hover with 0 ms animation.","Track per-move timing in replays."],ex:"Ranks 11–30: 24 TPS."},
 {n:"Fast",d:"Ranks 11–30: about 24 TPS.",l:["Full-solve planning before the first move.","Ergonomics.","Keep efficiency honest with the optimal replays."],ex:"Top 10 median: 28.7 TPS."},
 {n:"Top-10 TPS",d:"Top 10 median 28.7 TPS.",l:["Consistency over ao100.","Peak sessions when fresh.","Efficiency is now the cheaper lever if over 26 moves."],ex:"vovker: 32.7 TPS."},
 {n:"Elite",d:"30+ sustained; the record ao100 is 37 TPS.",l:["Efficiency.","Consistency.","Keep it fun."],ex:"dphdmn: 0.736 ao100 at 37.0 TPS."}
]};
const tierIdx=(v,th,higher)=>{let i=0;if(higher){while(i<th.length&&v>=th[i])i++}else{while(i<th.length&&v<=th[i])i++}return i};

const advisor={sel:null,you:null,
 data(){const Y=this.you;const a=Y.avg;const k=`${Y.size}_ao${a}`;return LB[k]||[]},
 update(reset){
  const size=document.getElementById("advSize").value,avg=document.getElementById("advAvg").value,mv=parseFloat(document.getElementById("advMoves").value),tm=parseFloat(document.getElementById("advTime").value);
  if(!(mv>0)||!(tm>0)){document.getElementById("advStats").innerHTML='<span class="note">Enter a movecount and a time above zero.</span>';return}
  const C=CFG[size],tps=mv/tm,m=tierIdx(mv,C.mv,false),t=tierIdx(tps,C.tps,true);
  this.you={size,avg,mv,tm,tps,m,t};
  if(reset||!this.sel||this.sel.size!==size)this.sel={size,m,t};
  const D=this.data(),faster=D.filter(r=>r[0]<tm).length;
  // community tier
  let cat=`${size} ao${avg}`;if(!TIERS.time[cat])cat=size==="3x3"?"3x3 ao12":"4x4 ao5";
  const th=TIERS.time[cat];let ti=-1;th.forEach((v,i)=>{if(tm<=v)ti=i});
  const tierName=ti<0?"Unranked":TIERS.names[ti],next=ti<th.length-1?`${TIERS.names[ti+1]} at ${th[ti+1]} s`:"top tier";
  document.getElementById("advStats").innerHTML=
   `<div class="stat"><b>${fmt(tps)}</b><span>TPS (moves ÷ time)</span></div>`+
   `<div class="stat"><b>${fmt(mv/C.opt,2)}×</b><span>optimal (${C.opt} avg)</span></div>`+
   `<div class="stat"><b>${tierName}</b><span>Open Slidysim tier (${cat}) · next: ${next}</span></div>`+
   `<div class="stat"><b>≈#${faster+1}</b><span>of ${D.length} on the ${size} ao${avg} board</span></div>`;
  this.draw();this.explain();
 },
 draw(){
  const svg=document.getElementById("chart"),Y=this.you,C=CFG[Y.size],D=this.data();
  const W=720,H=460,L=58,R=14,T=14,B=52;
  const X=v=>L+(C.xd[1]-Math.min(Math.max(v,C.xd[0]),C.xd[1]))/(C.xd[1]-C.xd[0])*(W-L-R);
  const Yp=v=>T+(1-Math.min(Math.max(v,C.yd[0]),C.yd[1])/C.yd[1])*(H-T-B);
  const xb=[C.xd[1],...C.mv,C.xd[0]],yb=[C.yd[0],...C.tps,C.yd[1]];
  let h="";
  // cells
  const times=[];for(let mi=0;mi<7;mi++)for(let ti=0;ti<7;ti++){const mid=(xb[mi]+xb[mi+1])/2,tp=(yb[ti]+yb[ti+1])/2;times.push(Math.log(mid/tp))}
  const lo=Math.min(...times),hi=Math.max(...times);
  for(let mi=0;mi<7;mi++)for(let ti=0;ti<7;ti++){
    const x1=X(xb[mi]),x2=X(xb[mi+1]),y1=Yp(yb[ti+1]),y2=Yp(yb[ti]);
    const mid=(xb[mi]+xb[mi+1])/2,tp=(yb[ti]+yb[ti+1])/2,k=1-(Math.log(mid/tp)-lo)/(hi-lo);
    const sel=this.sel.m===mi&&this.sel.t===ti;
    const cnt=D.filter(r=>tierIdx(r[1],C.mv,false)===mi&&tierIdx(r[2],C.tps,true)===ti).length;
    h+=`<rect class="cell" data-m="${mi}" data-t="${ti}" tabindex="0" role="button" aria-label="${C.mvLab[mi]} moves, ${tpsLab(C)[ti]} TPS, ${cnt} leaderboard players" x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" style="fill:color-mix(in oklab, var(--heat1) ${Math.round(k*100)}%, var(--heat0));stroke:${sel?"var(--accent)":"var(--surface)"};stroke-width:${sel?3:1.5}px"></rect>`;
  }
  // iso-time rays: tps = moves / T
  C.iso.forEach(Tm=>{const pts=[];for(let m=C.xd[0];m<=C.xd[1];m+=1){const tp=m/Tm;if(tp<=C.yd[1]&&tp>=C.yd[0])pts.push([X(m),Yp(tp)])}
    if(pts.length>1){h+=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" style="fill:none;stroke:var(--muted);stroke-width:1px;opacity:.7" stroke-dasharray="3 4"></polyline>`;
      const p=pts[0][1]<pts[pts.length-1][1]?pts[0]:pts[pts.length-1];const lp=pts.reduce((a,b)=>b[1]<a[1]?b:a);
      h+=`<text x="${Math.min(lp[0]+4,W-R-34)}" y="${Math.max(lp[1]+12,T+12)}">${Tm}s</text>`}});
  // dots
  D.forEach(r=>{h+=`<circle cx="${X(r[1])}" cy="${Yp(r[2])}" r="2.6" style="fill:var(--dot);opacity:.75" pointer-events="none"></circle>`});
  // axes
  xb.slice(1,-1).forEach(v=>{h+=`<text x="${X(v)}" y="${H-B+16}" text-anchor="middle">${v}</text>`});
  yb.slice(1,-1).forEach(v=>{h+=`<text x="${L-6}" y="${Yp(v)+4}" text-anchor="end">${v}</text>`});
  h+=`<text x="${(L+W-R)/2}" y="${H-12}" text-anchor="middle">average movecount → fewer</text>`;
  h+=`<text x="14" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 14 ${(T+H-B)/2})">TPS ↑</text>`;
  // you
  h+=`<circle cx="${X(Y.mv)}" cy="${Yp(Y.tps)}" r="8" style="fill:none;stroke:var(--you);stroke-width:3px" pointer-events="none"></circle><circle cx="${X(Y.mv)}" cy="${Yp(Y.tps)}" r="3" style="fill:var(--you)" pointer-events="none"></circle>`;
  h+=`<text x="${X(Y.mv)+12}" y="${Yp(Y.tps)-10}" style="fill:var(--you);font-weight:600">you</text>`;
  svg.innerHTML=h;
  svg.querySelectorAll(".cell").forEach(c=>{const go=()=>{this.sel={size:Y.size,m:+c.dataset.m,t:+c.dataset.t};this.draw();this.explain()};
    c.addEventListener("click",go);c.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}})});
 },
 explain(){
  const Y=this.you,S=this.sel,C=CFG[Y.size],D=this.data(),isYou=S.m===Y.m&&S.t===Y.t;
  const E=EFF[Y.size][S.m],X=EXE[Y.size][S.t];
  // peers: players near your time
  let peers=D.filter(r=>Math.abs(r[0]-Y.tm)/Y.tm<=0.12);
  if(peers.length<8)peers=[...D].sort((a,b)=>Math.abs(Math.log(a[0]/Y.tm))-Math.abs(Math.log(b[0]/Y.tm))).slice(0,12);
  const pm=median(peers.map(r=>r[1])),pt=median(peers.map(r=>r[2]));
  let next=D.filter(r=>r[0]>=Y.tm*0.7&&r[0]<=Y.tm*0.85);
  if(next.length<5)next=[...D].filter(r=>r[0]<Y.tm).slice(-8);
  const nm=median(next.map(r=>r[1])),nt=median(next.map(r=>r[2]));
  let pri,cls,why;
  if(isYou&&D.length){
    const gm=Y.mv/pm-1,gt=pt/Y.tps-1;
    if(gm-gt>0.06){pri="Solution finding first";cls="eff";why=`Players at your time average ${fmt(pm,1)} moves; you use ${fmt(Y.mv,1)} (${fmt(gm*100,0)}% more). Your TPS is ${gt<=0?"at or above":"close to"} theirs.`}
    else if(gt-gm>0.06){pri="Execution first";cls="exe";why=`Players at your time average ${fmt(pt,1)} TPS; you're at ${fmt(Y.tps,1)} (${fmt(gt*100,0)}% slower). Your movecount is ${gm<=0?"better than":"close to"} theirs.`}
    else{const gNext=(Y.mv/nm-1)-(nt/Y.tps-1);pri=gNext>0?"Balanced, lean toward solution finding":"Balanced, lean toward execution";cls="bal";
      why=`You match players at your time on both. The players about 15–30% faster than you differ from you more in ${gNext>0?"movecount":"TPS"}.`}
  }else{
    const d=S.t-S.m;
    if(d>=2){pri="Solution finding first";cls="eff";why="In this cell, TPS is well ahead of efficiency."}
    else if(d<=-2){pri="Execution first";cls="exe";why="In this cell, efficiency is well ahead of TPS."}
    else{pri="Balanced";cls="bal";why="In this cell, the two are about level."}
  }
  const effFirst=cls==="eff"||(cls==="bal"&&pri.includes("solution"));
  const mvU=isYou?Y.mv:(([C.xd[1],...C.mv,C.xd[0]][S.m]+[C.xd[1],...C.mv,C.xd[0]][S.m+1])/2);
  const tpU=isYou?Y.tps:(([0,...C.tps,C.yd[1]][S.t]+[0,...C.tps,C.yd[1]][S.t+1])/2);
  const cur=mvU/tpU,tgM=S.m<6?C.mv[S.m]:mvU*0.93,tgT=S.t<6?C.tps[S.t]:tpU*1.07;
  const gainM=cur-tgM/tpU,gainT=cur-mvU/tgT;
  const col=(head,o,lead)=>`<div class="${lead?"lead-col":""}"><h3>${head}</h3><p>${o.d}</p><ol>${o.l.map(x=>`<li>${x}</li>`).join("")}</ol><p class="note"><b>For reference:</b> ${o.ex}</p></div>`;
  const ec=col(`Solution finding · ${E.n} (${C.mvLab[S.m]} moves)`,E,effFirst),xc=col(`Execution · ${X.n} (${tpsLab(C)[S.t]} TPS)`,X,!effFirst);
  const peerHtml=isYou&&D.length?`<div class="peer"><div>you<b>${fmt(Y.mv,1)} mv · ${fmt(Y.tps,1)} tps</b></div><div>players at your time (${peers.length})<b>${fmt(pm,1)} mv · ${fmt(pt,1)} tps</b></div><div>15–30% faster than you (${next.length})<b>${next.length?fmt(nm,1)+" mv · "+fmt(nt,1)+" tps":"—"}</b></div></div>`:"";
  document.getElementById("advOut").innerHTML=`<div><span class="pill ${cls}">${pri}</span> <span class="note">${isYou?"your cell":"viewing another cell (typical numbers for it)"}</span></div>`+
   `<p class="prose" style="margin:0">${why} At ${fmt(mvU,1)} moves and ${fmt(tpU,1)} TPS a solve takes ${fmt(cur)} s. Reaching ${S.m<6?C.mv[S.m]+" moves":"7% fewer moves"} saves <b>${fmt(gainM)} s</b>; reaching ${S.t<6?C.tps[S.t]+" TPS":"7% more TPS"} saves <b>${fmt(gainT)} s</b>.</p>`+peerHtml+
   `<div class="adv-cols">${effFirst?ec+xc:xc+ec}</div>`;
 }
};
["advSize","advAvg","advMoves","advTime"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{document.getElementById("advNote").textContent="Using your numbers.";advisor.update(true)}));
advisor.update(true);
