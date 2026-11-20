/* Move helpers */
"use strict";
function applyLetter(b,w,h,L){const z=b.indexOf(0),x=z%w,y=(z/w)|0;let k=-1;
  if(L==="L"&&x<w-1)k=z+1;if(L==="R"&&x>0)k=z-1;if(L==="U"&&y<h-1)k=z+w;if(L==="D"&&y>0)k=z-w;
  if(k<0)return false;b[z]=b[k];b[k]=0;return true}
const strHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0};
