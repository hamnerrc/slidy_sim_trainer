/* Key bindings: every keyboard action on the site, its keys (rebindable in the header's Keys dialog), saved in this browser */
"use strict";
const KEYMAP=(function(){
  const ACTIONS=[
    ["left","Slide a tile left · picks the column (left choice)",["ArrowLeft","a","j"]],
    ["right","Slide a tile right · picks the row (right choice)",["ArrowRight","d","l"]],
    ["up","Slide a tile up",["ArrowUp","w","i"]],
    ["down","Slide a tile down",["ArrowDown","s","k"]],
    ["next","Next case",[" ","Enter"]],
    ["slip","Mouse slip: restart the case (takes back a miss)",["c"]],
    ["replay","Replay: back to the start of this part of the review (press again quickly to go further back)",["r"]],
    ["optimal","Show / hide optimal",["h"]],
    ["stats","Show / hide stats",["t"]],
    ["fs","Fullscreen",["f"]],
    ["p1","Switch to 3x2",["1"]],["p2","Switch to 3x3",["2"]],["p3","Switch to 4x3",["3"]],["p4","Switch to 4x4",["4"]],["p5","Switch to the sequence trainer",["5"]]];
  const LS="ssa-keys-v1",IGNORE=new Set(["Shift","Control","Alt","Meta","CapsLock","Escape","Tab","Dead","Unidentified","Process"]);
  const norm=k=>k.length===1?k.toLowerCase():k;
  let map=load(),capturing=null;const subs=[];
  function load(){const s=store.get(LS)||{},m={};ACTIONS.forEach(([id,,def])=>{m[id]=Array.isArray(s[id])?s[id].map(norm):def.slice()});return m}
  function save(){store.set(LS,map);subs.forEach(f=>f())}
  function action(key){const k=norm(key);for(const [id] of ACTIONS)if(map[id].includes(k))return id;return null}
  const NAMES={" ":"Space",ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓",Enter:"Enter",Backspace:"⌫",Delete:"Del"};
  const label=k=>NAMES[k]||(k.length===1?k.toUpperCase():k);
  const keys=id=>map[id]||[];

  /* ---------- the dialog ---------- */
  const dlg=document.getElementById("keysDlg"),list=document.getElementById("keysList"),msg=document.getElementById("keysMsg");
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function render(){list.innerHTML=ACTIONS.map(([id,name])=>`<li><span class="kd-name">${esc(name)}</span><span class="kd-keys">`+
      map[id].map(k=>`<button type="button" class="kd-key" data-rm="${id}" data-k="${esc(k)}" title="Remove ${esc(label(k))}"><kbd>${esc(label(k))}</kbd><span aria-hidden="true">×</span></button>`).join("")+
      `<button type="button" class="kd-add${capturing===id?" on":""}" data-add="${id}">${capturing===id?"press a key…":"+ key"}</button></span></li>`).join("")}
  function open(){capturing=null;msg.textContent="";render();if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","")}
  function close(){capturing=null;if(dlg.close)dlg.close();else dlg.removeAttribute("open")}
  list.addEventListener("click",e=>{const rm=e.target.closest("[data-rm]"),add=e.target.closest("[data-add]");
    if(rm){const id=rm.dataset.rm;map[id]=map[id].filter(k=>k!==rm.dataset.k);capturing=null;msg.textContent="";save();render();return}
    if(add){capturing=capturing===add.dataset.add?null:add.dataset.add;msg.textContent=capturing?"Press the key to add. Esc cancels.":"";render()}});
  // while capturing, the next key press is the new binding (taken away from any action that had it)
  dlg.addEventListener("keydown",e=>{if(!capturing)return;e.preventDefault();e.stopPropagation();
    if(e.key==="Escape"){capturing=null;msg.textContent="";render();return}
    if(IGNORE.has(e.key)||e.metaKey||e.ctrlKey||e.altKey)return;
    const k=norm(e.key),from=ACTIONS.find(([id])=>id!==capturing&&map[id].includes(k));
    if(from)map[from[0]]=map[from[0]].filter(x=>x!==k);
    if(!map[capturing].includes(k))map[capturing].push(k);
    msg.textContent=from?`${label(k)} moved here from “${from[1]}”.`:`${label(k)} added.`;capturing=null;save();render()},true);
  dlg.addEventListener("cancel",e=>{if(capturing){e.preventDefault();capturing=null;msg.textContent="";render()}});
  document.getElementById("keysBtn").addEventListener("click",e=>{e.currentTarget.blur();open()});
  document.getElementById("keysDone").addEventListener("click",close);
  document.getElementById("keysReset").addEventListener("click",()=>{map={};ACTIONS.forEach(([id,,def])=>{map[id]=def.slice()});capturing=null;msg.textContent="Back to the default keys.";save();render()});
  dlg.addEventListener("click",e=>{if(e.target===dlg)close()});   // click on the backdrop

  return{action,keys,label,isOpen:()=>dlg.open||dlg.hasAttribute("open"),onChange:f=>subs.push(f)};
})();
