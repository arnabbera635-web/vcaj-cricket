/* Fixture / schedule helpers — pure functions (no DOM, no Firebase). Times are Indian Standard Time (+05:30). */
import {fmtDate,fmtTime,toBn} from "./broadcast-core.js";
export const STAGE_LABEL={r16:"Round of 16",qf:"Quarter Final",sf:"Semi Final",final:"Final"};
const WD=["রবিবার","সোমবার","মঙ্গলবার","বুধবার","বৃহস্পতিবার","শুক্রবার","শনিবার"];
export const weekday=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");return m?WD[new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).getUTCDay()]:""};
export const dayTitle=iso=>iso?`${fmtDate(iso)} (${weekday(iso)})`:"";
export const addDays=(iso,n)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+n));return d.toISOString().slice(0,10)};
export const addMin=(t,n)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t);const x=(+m[1])*60+(+m[2])+n;if(x<0||x>=1440)return"";return`${String(Math.floor(x/60)).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`};
export const startMs=(date,time)=>date&&time?Date.parse(`${date}T${time}:00+05:30`):NaN;
/* the 15 matches in bracket order; numbering M1..M15 */
export function matchList(){
 const L=[];
 for(let i=0;i<8;i++)L.push({key:`r16-${i}`,stage:"r16",idx:i,no:i+1});
 for(let i=0;i<4;i++)L.push({key:`qf-${i}`,stage:"qf",idx:i,no:9+i});
 for(let i=0;i<2;i++)L.push({key:`sf-${i}`,stage:"sf",idx:i,no:13+i});
 L.push({key:"final-0",stage:"final",idx:0,no:15});
 return L}
/* who plays; before a result is known later rounds show "Winner M#" (never a guessed team) */
export function sides(m,cur,nameOf){
 const w=k=>cur?.winners?.[k]||"";
 let a,b,pa,pb;
 if(m.stage==="r16"){a=cur?.slots?.[m.idx*2]||"";b=cur?.slots?.[m.idx*2+1]||"";pa="দল ঠিক হয়নি";pb="দল ঠিক হয়নি"}
 else if(m.stage==="qf"){a=w(`r16-${m.idx*2}`);b=w(`r16-${m.idx*2+1}`);pa=`Winner M${m.idx*2+1}`;pb=`Winner M${m.idx*2+2}`}
 else if(m.stage==="sf"){a=w(`qf-${m.idx*2}`);b=w(`qf-${m.idx*2+1}`);pa=`Winner M${9+m.idx*2}`;pb=`Winner M${10+m.idx*2}`}
 else{a=w("sf-0");b=w("sf-1");pa="Winner M13";pb="Winner M14"}
 return{a,b,aName:a?nameOf(a):pa,bName:b?nameOf(b):pb,known:!!(a&&b)}}
/* the plan from the schedule sheet: 4 match days of (2 Round-of-16 + 1 Quarter Final), buffer day(s), then 2 Semi Finals + Final */
export function generate({startDate,startTime="08:00",gapMin=180,restDays=1}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate||""))return{error:"শুরুর তারিখ দিন"};
 if(!/^\d{1,2}:\d{2}$/.test(startTime||""))return{error:"প্রথম ম্যাচের সময় দিন"};
 gapMin=Number(gapMin);if(!(gapMin>=30&&gapMin<=480))return{error:"ম্যাচের মাঝের ব্যবধান ৩০ থেকে ৪৮০ মিনিটের মধ্যে দিন"};
 const t=k=>addMin(startTime,k*gapMin);
 if(!t(2))return{error:"এই সময় ও ব্যবধানে তৃতীয় ম্যাচ মধ্যরাত পেরিয়ে যায় — আগে শুরু করুন বা ব্যবধান কমান"};
 const fx={},add=(key,date,time)=>fx[key]={date,time,venue:"",note:"",status:"scheduled"};
 for(let d=0;d<4;d++){const date=addDays(startDate,d);add(`r16-${d*2}`,date,t(0));add(`r16-${d*2+1}`,date,t(1));add(`qf-${d}`,date,t(2))}
 const reserveDate=addDays(startDate,4),finalDate=addDays(startDate,4+Math.max(1,Number(restDays)||1));
 add("sf-0",finalDate,t(0));add("sf-1",finalDate,t(1));add("final-0",finalDate,t(2));
 return{fixtures:fx,reserveDate}}
/* warnings for the admin: same time twice, or a later round placed before the matches it depends on */
export function problems(fx){
 const out=[],seen={},dep={"qf-0":["r16-0","r16-1"],"qf-1":["r16-2","r16-3"],"qf-2":["r16-4","r16-5"],"qf-3":["r16-6","r16-7"],"sf-0":["qf-0","qf-1"],"sf-1":["qf-2","qf-3"],"final-0":["sf-0","sf-1"]};
 const no=Object.fromEntries(matchList().map(m=>[m.key,m.no]));
 for(const [k,f] of Object.entries(fx||{})){
  const ms=startMs(f.date,f.time);if(isNaN(ms))continue;
  const s=`${f.date} ${f.time}`;if(seen[s])out.push(`M${no[k]} ও M${no[seen[s]]} একই সময়ে (${fmtDate(f.date)} ${fmtTime(f.time)})`);else seen[s]=k;
  for(const d of dep[k]||[]){const dm=startMs(fx[d]?.date,fx[d]?.time);if(!isNaN(dm)&&dm>=ms)out.push(`M${no[k]} (${STAGE_LABEL[k.split("-")[0]]}) এর সময় তার আগের ম্যাচ M${no[d]}-এর আগে বা একই সময়ে`)}}
 return out}
/* day-wise schedule */
export function items(fx,cur,nameOf){
 return matchList().map(m=>({...m,...sides(m,cur,nameOf),fx:fx?.[m.key]||{},ms:startMs(fx?.[m.key]?.date,fx?.[m.key]?.time)}))}
export function byDay(list){
 const days={};list.filter(x=>x.fx.date).forEach(x=>(days[x.fx.date]||(days[x.fx.date]=[])).push(x));
 Object.values(days).forEach(a=>a.sort((p,q)=>(p.fx.time||"").localeCompare(q.fx.time||"")||p.no-q.no));
 return Object.entries(days).sort((a,b)=>a[0].localeCompare(b[0]))}
export const lineOf=(x,venueDefault="")=>{
 const f=x.fx||{},bits=[f.time&&"⏰ "+fmtTime(f.time),(f.venue||venueDefault)&&"📍 "+(f.venue||venueDefault),f.status==="postponed"&&"⏸️ স্থগিত"+(f.note?" ("+f.note+")":"")].filter(Boolean);
 return`M${x.no} ${STAGE_LABEL[x.stage]}: ${x.aName} বনাম ${x.bName}${bits.length?"\n    "+bits.join(" • "):""}`};
export function scheduleBody(list,meta={}){
 const days=byDay(list),rest=meta.reserveDate;
 const rows=[...days.map(([d,a])=>({d,t:`🗓️ ${dayTitle(d)}\n${a.map(x=>lineOf(x,meta.venue)).join("\n")}`}))];
 if(rest)rows.push({d:rest,t:`🗓️ ${dayTitle(rest)}\n    রিজার্ভ / বিশ্রামের দিন (প্রয়োজনে স্থগিত ম্যাচ এই দিনে)`});
 rows.sort((a,b)=>a.d.localeCompare(b.d));
 const unsched=list.filter(x=>!x.fx.date).length;
 return["📅 ম্যাচ সময়সূচি",...rows.map(r=>r.t),...(unsched?[`\nℹ️ ${toBn(unsched)}টি ম্যাচের সময় পরে জানানো হবে।`]:[])].join("\n\n")}
export function matchBody(x,meta={}){
 const f=x.fx||{};
 return`📅 ম্যাচের সময়সূচি\n\n${STAGE_LABEL[x.stage]} (M${x.no})\n${x.aName} বনাম ${x.bName}\n${f.date?"🗓️ "+dayTitle(f.date):"🗓️ তারিখ পরে জানানো হবে"}${f.time?"\n⏰ "+fmtTime(f.time):""}${(f.venue||meta.venue)?"\n📍 "+(f.venue||meta.venue):""}${f.status==="postponed"?"\n⏸️ ম্যাচটি স্থগিত"+(f.note?" — "+f.note:"")+"। নতুন সময় শীঘ্রই জানানো হবে।":"\n\nঅনুগ্রহ করে নির্ধারিত সময়ের আগে মাঠে উপস্থিত থাকবেন।"}`}
/* calendar file (.ics): IST converted to UTC so every phone shows the right time */
const pad=n=>String(n).padStart(2,"0"),utc=ms=>{const d=new Date(ms);return`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`};
const ics=s=>String(s??"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
export function toIcs(list,meta={}){
 const durMin=meta.durationMin||120,L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//VCAJ//Tournament Fixtures//BN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
 for(const x of list){
  if(isNaN(x.ms)||x.fx.status==="postponed")continue;
  L.push("BEGIN:VEVENT",`UID:${x.key}-${meta.season||""}@vcaj`,`DTSTAMP:${utc(meta.now||Date.now())}`,`DTSTART:${utc(x.ms)}`,`DTEND:${utc(x.ms+durMin*60000)}`,
   `SUMMARY:${ics(`M${x.no} ${x.aName} vs ${x.bName}`)}`,`DESCRIPTION:${ics(`${STAGE_LABEL[x.stage]} — ${meta.title||""}`)}`);
  const v=x.fx.venue||meta.venue;if(v)L.push(`LOCATION:${ics(v)}`);
  L.push("END:VEVENT")}
 L.push("END:VCALENDAR");return L.join("\r\n")}
export function nextUp(list,now=Date.now()){
 return list.filter(x=>!isNaN(x.ms)&&x.ms>=now&&x.fx.status!=="postponed"&&!x.winner).sort((a,b)=>a.ms-b.ms)[0]||null}
export function countdown(ms){
 if(ms<=0)return"এখনই";const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mi=m%60;
 return[d&&`${toBn(d)} দিন`,h&&`${toBn(h)} ঘণ্টা`,(!d&&mi||(!d&&!h))&&`${toBn(mi)} মিনিট`].filter(Boolean).join(" ")}
export function liveBadge(doc){
 if(!doc)return null;
 if(doc.status==="COMPLETED")return{kind:"done",text:"✅ "+(doc.resultText||"ম্যাচ শেষ")};
 if(doc.status==="LIVE"||String(doc.status||"").startsWith("SUPER_OVER")){const o=Math.floor((doc.legalBalls||0)/6)+"."+((doc.legalBalls||0)%6);return{kind:"live",text:`🔴 LIVE${doc.battingTeam?` — ${doc.battingTeam} ${doc.score??0}/${doc.wickets??0} (${o})`:""}`}}
 return null}
