/* Printed prize list (prizes-data.js) + Admin corrections stored in Firestore "prizeList" + saved winners (awards.prizeNo). */
import {CATS,MAIN,SPECIAL} from "./prizes-data.js";
export {CATS,MAIN,SPECIAL};
export async function loadOverrides(force){
 try{const [f,c]=await Promise.all([import("./firebase.js"),import("./vcaj-cache.js")]);
  if(force)c.clearCached("vc_prizeList");
  return await c.getCached("vc_prizeList",()=>f.getDocs(f.collection(f.db,"prizeList")).then(s=>s.docs.map(d=>({...d.data(),id:d.id}))),180000)}catch(e){return[]}}
export async function loadWinners(season=2026){
 try{const [f,c]=await Promise.all([import("./firebase.js"),import("./vcaj-cache.js")]);
  const rows=await c.getCached("vc_prizeAwards",()=>f.getDocs(f.collection(f.db,"awards")).then(s=>s.docs.map(d=>({...d.data(),id:d.id}))),180000);
  const W={};rows.filter(a=>a.prizeNo&&a.public!==false&&String(a.season??"")===String(season)).forEach(a=>(W[a.prizeNo]||(W[a.prizeNo]=[])).push(a));return W}catch(e){return{}}}
export function merge(ovs){
 const o={};(ovs||[]).forEach(x=>o[x.id]=x);
 const main=MAIN.map(m=>({...m,...(o["m"+m.rank]||{}),id:"m"+m.rank,rank:m.rank,edited:!!o["m"+m.rank]}));
 const base=SPECIAL.map(p=>({...p,...(o["p"+p.no]||{}),id:"p"+p.no,no:String(p.no),edited:!!o["p"+p.no]}));
 const custom=(ovs||[]).filter(x=>x.custom).map(x=>({cat:"honor",icon:"🏅",memorial:"",by:"",...x,no:String(x.no),edited:true,custom:true}));
 const all=[...base,...custom].sort((a,b)=>Number(a.no)-Number(b.no));
 return{main,all,special:all.filter(p=>!p.hidden)}}
export const prizeText=p=>`${p.memorial?p.memorial+" • ":""}সৌজন্যে: ${p.by}`;
