/* Finger / mouse signature pad. Stores a small transparent PNG so it sits cleanly on receipts. */
export const safeSig=v=>typeof v==="string"&&/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(v)&&v.length<90000?v:"";
export function makePad(canvas){
 const ctx=canvas.getContext("2d");let drawing=false,dirty=false,lx=0,ly=0;
 canvas.width=400;canvas.height=140;canvas.style.touchAction="none";
 ctx.lineWidth=2.8;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#0b1d6b";ctx.fillStyle="#0b1d6b";
 const pos=e=>{const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
 canvas.addEventListener("pointerdown",e=>{e.preventDefault();try{canvas.setPointerCapture(e.pointerId)}catch(x){}drawing=true;[lx,ly]=pos(e);ctx.beginPath();ctx.arc(lx,ly,1.4,0,7);ctx.fill();dirty=true});
 canvas.addEventListener("pointermove",e=>{if(!drawing)return;e.preventDefault();const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();lx=x;ly=y});
 ["pointerup","pointercancel","pointerleave"].forEach(ev=>canvas.addEventListener(ev,()=>{drawing=false}));
 return{
  clear(){ctx.clearRect(0,0,canvas.width,canvas.height);dirty=false},
  isEmpty:()=>!dirty,
  data(){return dirty?safeSig(canvas.toDataURL("image/png")):""},
  load(url){this.clear();const u=safeSig(url);if(!u)return;const im=new Image();im.onload=()=>{ctx.drawImage(im,0,0,canvas.width,canvas.height);dirty=true};im.src=u}
 }}
