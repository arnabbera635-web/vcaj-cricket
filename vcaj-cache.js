/* Free-tier saver: reads Firestore collections once and reuses them for a short time (per browser session). */
export async function getCached(key,loader,ttl=90000){
 try{const c=JSON.parse(sessionStorage.getItem(key)||"null");if(c&&Date.now()-c.t<ttl)return c.v}catch(e){}
 const v=await loader();
 try{sessionStorage.setItem(key,JSON.stringify({t:Date.now(),v}))}catch(e){}
 return v}
export function clearCached(key){try{sessionStorage.removeItem(key)}catch(e){}}
export function snapOnce(db,getDocs,collection,name,cb,err,ttl=90000){
 const run=async()=>{try{
  const arr=await getCached("vc_"+name,()=>getDocs(collection(db,name)).then(s=>s.docs.map(d=>({...d.data(),__id:d.id}))),ttl);
  cb({docs:arr.map(x=>{const {__id,...rest}=x;return{id:__id,data:()=>rest}})})}catch(e){if(err)err(e)}};
 run();setInterval(()=>{if(!document.hidden)run()},ttl)}
