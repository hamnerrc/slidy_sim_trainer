/* View routing */
"use strict";
/* ---------- views ---------- */
(function(){const VIEWS=["train","advisor","guide"],rail=document.getElementById("guideRail");
  function setView(v,target){VIEWS.forEach(x=>{document.getElementById("view-"+x).hidden=x!==v});
    document.querySelectorAll(".views a").forEach(a=>{if(a.dataset.view===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
    rail.hidden=v!=="guide";if(v!=="train")ZEN.exitPseudo();
    if(target)requestAnimationFrame(()=>target.scrollIntoView());else window.scrollTo(0,0);
    if(v==="train")requestAnimationFrame(()=>ZEN.layout())}
  function route(){let h="";try{h=decodeURIComponent(location.hash.slice(1))}catch(e){}let v="train",tg=null;
    if(VIEWS.includes(h))v=h;else if(h){const el=document.getElementById(h);const vw=el&&el.closest(".view");if(vw){v=vw.id.slice(5);tg=el}}
    setView(v,tg)}
  window.addEventListener("hashchange",route);
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>{ZEN.select(b.dataset.goto);if(location.hash==="#train")setView("train");else location.hash="#train"}));
  route();ZEN.start();
})();
