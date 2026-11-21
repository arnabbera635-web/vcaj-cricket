/* Team broadcast — pure helpers (no DOM, no Firebase). */
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const toBn=s=>String(s).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
const MON=["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
export function fmtDate(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");return m?toBn(`${+m[3]} ${MON[+m[2]-1]} ${m[1]}`):""}
export function fmtTime(t){const m=/^(\d{1,2}):(\d{2})$/.exec(t||"");if(!m)return"";const h=+m[1],mi=m[2],w=h<5?"ভোর":h<12?"সকাল":h<16?"দুপুর":h<18?"বিকাল":h<20?"সন্ধ্যা":"রাত",h12=h%12===0?12:h%12;return`${w} ${toBn(h12)}:${toBn(mi)}`}
export const p91=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);return d.length===10?"91"+d:(d.length===12&&d.startsWith("91")?d:"")};
export const DEFAULTS={title:'Jeliakhali "Mondal and Mondal" Cricket Tournament',organizer:"Vivekananda Cricket Association of Jeliakhali",sign:"V.C.A.J কমিটি",venue:""};
export const STAGES=["Round of 16","Quarter Final","Semi Final","Final"];
/* schedule rows -> readable list */
export function scheduleText(rows,venueDefault=""){
 const L=(rows||[]).filter(r=>r.a&&r.b);
 if(!L.length)return"";
 return["📅 ম্যাচ সময়সূচি",...L.map((r,i)=>{
  const bits=[r.date&&"🗓️ "+fmtDate(r.date),r.time&&"⏰ "+fmtTime(r.time),(r.venue||venueDefault)&&"📍 "+(r.venue||venueDefault)].filter(Boolean).join(" • ");
  return`${toBn(i+1)}) ${r.stage?r.stage+" — ":""}${r.a} বনাম ${r.b}${bits?"\n    "+bits:""}`})].join("\n")}
/* final message for one team (teamName empty => generic text for a group) */
export function buildMessage({teamName,body,liveLine,addressTeam=true},cfg){
 const c={...DEFAULTS,...(cfg||{})};
 const L=[`🏏 ${c.title}`,`পরিচালনায় — ${c.organizer}`,""];
 if(addressTeam)L.push(teamName?`প্রিয় ${teamName} দল,`:"সকল দলের প্রতি,");
 L.push(String(body||"").trim());
 if(liveLine)L.push("",liveLine);
 L.push("",`ধন্যবাদ 🙏`,`— ${c.organizer} (${c.sign})`);
 return L.join("\n")}
export const hashMsg=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return"m"+(h>>>0).toString(36)};
export const TEMPLATES={
 schedule:"আপনার দলের ম্যাচের সময়সূচি নিচে দেওয়া হলো। অনুগ্রহ করে নির্ধারিত সময়ের আগে মাঠে উপস্থিত থাকবেন।\n\n(নিচের \"সময়সূচি বানান\" থেকে তালিকা বসান)",
 notice:"",
 reporting:"আপনার দলের ম্যাচ আগামী ____ তারিখ, ____ টায়। অনুগ্রহ করে ম্যাচ শুরুর ____ মিনিট আগে মাঠে উপস্থিত থাকবেন। (নিয়ম অনুযায়ী দলের ১১ জনের মধ্যে কমপক্ষে ১ জন অনূর্ধ্ব ১৯ বছরের খেলোয়াড় থাকতে হবে।)",
 result:"আমাদের টুর্নামেন্টের ম্যাচের ফলাফল ও পরবর্তী ম্যাচের খবর ওয়েবসাইটে দেওয়া হয়েছে। দেখে নিন।",
 weather:"আবহাওয়া খারাপ থাকায় আজকের ম্যাচ স্থগিত করা হয়েছে। নতুন সময় শীঘ্রই জানানো হবে।"};
