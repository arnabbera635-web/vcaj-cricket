/* Account audit — pure functions (no DOM, no Firebase). Every check only compares records that already exist; nothing is guessed. */
import {isDeskReceipt,classify,registryOf} from "./team-income.js";
const num=v=>Number(v)||0;
const norm=s=>String(s??"").toLowerCase().replace(/\s+/g," ").trim();
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
export const TYPE_LABEL={member:"Member চাঁদা",donation:"অতিথি অনুদান",sponsor:"Sponsor"};
export const METHODS=["Cash","UPI","Bank","Cheque","অজানা"];
export function methodOf(s){s=String(s||"");
 if(/upi|phonepe|gpay|google\s?pay|paytm|bhim/i.test(s))return"UPI";
 if(/bank|neft|imps|rtgs|transfer|ব্যাংক/i.test(s))return"Bank";
 if(/cheque|check|চেক/i.test(s))return"Cheque";
 if(/cash|নগদ/i.test(s))return"Cash";
 return"অজানা"}
export const parseNo=no=>{const m=/^VCAJ\/([A-Z]+)\/(\d{2})\/(\d+)$/.exec(String(no||""));return m?{k:`${m[1]}/${m[2]}`,seq:+m[3]}:null};
const dayOf=ms=>{try{return new Date(ms-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}catch{return""}};
const histDay=h=>/^\d{4}-\d{2}-\d{2}$/.test(h?.date||"")?h.date:"";
const lbl=r=>`${r.receiptNo||r.code} — ${r.name||r.payer||""} ${money(r.amount)}`;

/* ---------------- the checks ---------------- */
export function runAudit(D,opts={}){
 const o={today:new Date().toISOString().slice(0,10),pendingDays:3,bigAmount:5000,nowMs:Date.now(),...opts};
 const R=D.receipts||[],K=D.desk||[],V=D.vouchers||[],G=D.regs||[],M=D.members||[],logIds=new Set((D.logs||[]).map(l=>l.id));
 const issues=[],add=(id,sev,area,title,items,link,note)=>{if(items&&items.length)issues.push({id,sev,area,title,items,link:link||"",note:note||""})};
 // 1) numbering of receipts and vouchers
 const seqCheck=(list,numKey,area,link)=>{
  const by={},dup={};
  for(const r of list){const p=parseNo(r[numKey]);if(!p)continue;(by[p.k]||(by[p.k]=[])).push({seq:p.seq,r});}
  const seen={};for(const r of list){const n=r[numKey];if(!n)continue;(seen[n]||(seen[n]=[])).push(r)}
  const dups=Object.entries(seen).filter(([,a])=>a.length>1).map(([n,a])=>`${n} — ${a.length}টি: ${a.map(x=>`${x.name||x.payee||""} ${money(x.amount??x.total)}`).join(", ")}`);
  add("dup-no-"+numKey,"error",area,"একই নম্বর একাধিকবার ব্যবহার",dups,link,"দুজন একসঙ্গে বানালে এমন হতে পারে — একটার নম্বর বদলে দিন।");
  const gaps=[];
  for(const [k,a] of Object.entries(by)){const have=new Set(a.map(x=>x.seq)),mx=Math.max(...have),miss=[];for(let i=1;i<=mx;i++)if(!have.has(i))miss.push(String(i).padStart(4,"0"));if(miss.length)gaps.push(`${k} — নেই: ${miss.slice(0,12).join(", ")}${miss.length>12?" …":""}`)}
  add("gap-no-"+numKey,"warn",area,"নম্বরে ফাঁক (কোনো রসিদ/ভাউচার হারিয়েছে বা মোছা হয়েছে?)",gaps,link)};
 seqCheck(R,"receiptNo","রসিদ","receipts.html");seqCheck(V,"voucherNo","ভাউচার","vouchers.html");
 // 2) probable double entries
 const dupGroup=(list,keyFn,area,link,title)=>{const g={};for(const r of list){const k=keyFn(r);if(k)(g[k]||(g[k]=[])).push(r)}
  add("dupent-"+area,"warn",area,title,Object.values(g).filter(a=>a.length>1).map(a=>a.map(x=>x.receiptNo||x.voucherNo||x.code||x.id).join(" ও ")+` — একই নাম, টাকা (${money(a[0].amount??a[0].total)}) ও তারিখ`),link,"সত্যিই দুটো আলাদা লেনদেন হলে এটা উপেক্ষা করতে পারেন।")};
 dupGroup(R,r=>r.name&&`${r.type}|${norm(r.name)}|${num(r.amount)}|${r.date}`,"রসিদ","receipts.html","সম্ভবত দুবার এন্ট্রি");
 dupGroup(K.filter(r=>!r.trial),r=>r.payer&&`${norm(r.payer)}|${num(r.amount)}|${r.paymentDate||dayOf(r.issuedAtMs)}`,"টিম রসিদ","team-receipts.html","সম্ভবত দুবার এন্ট্রি (টিম রসিদ)");
 dupGroup(V,v=>v.payee&&`${norm(v.payee)}|${num(v.total)}|${v.date}`,"ভাউচার","vouchers.html","সম্ভবত দুবার এন্ট্রি");
 // 3) changed after issue
 const edited=(list,area,link,fmt)=>add("edited-"+area,"info",area,"ইস্যুর পর বদলানো হয়েছে",list.filter(x=>num(x.editCount)>0).map(x=>`${fmt(x)} — ${x.editCount} বার, শেষে ${x.editedBy||"?"}`),link,"আগের মান Activity Log-এ আছে।");
 edited(R,"রসিদ","activity-log.html",x=>x.receiptNo);edited(V,"ভাউচার","activity-log.html",x=>x.voucherNo);
 const late=(list,area,fmt)=>add("late-edit-"+area,"warn",area,"ইস্যুর ২৪ ঘণ্টারও পরে বদলানো",list.filter(x=>x.editedAtMs&&x.createdAtMs&&x.editedAtMs-x.createdAtMs>864e5).map(x=>`${fmt(x)} — ${Math.round((x.editedAtMs-x.createdAtMs)/864e5)} দিন পরে`),"activity-log.html");
 late(R,"রসিদ",x=>x.receiptNo);late(V,"ভাউচার",x=>x.voucherNo);
 // 4) voucher workflow & integrity
 const vlbl=v=>`${v.voucherNo} — ${v.payee} ${money(v.total)}`;
 add("v-pending","warn","ভাউচার",`${o.pendingDays} দিনের বেশি অনুমোদনের অপেক্ষায়`,V.filter(v=>v.status==="pending"&&o.nowMs-num(v.createdAtMs)>o.pendingDays*864e5).map(v=>`${vlbl(v)} — ${Math.floor((o.nowMs-num(v.createdAtMs))/864e5)} দিন`),"vouchers.html");
 add("v-sum","error","ভাউচার","আইটেমের যোগফল আর মোট টাকা মেলেনি",V.filter(v=>Array.isArray(v.items)&&v.items.length&&v.items.reduce((a,x)=>a+num(x.amount),0)!==num(v.total)).map(v=>`${vlbl(v)} — আইটেম মিলিয়ে ${money(v.items.reduce((a,x)=>a+num(x.amount),0))}`),"vouchers.html");
 add("v-noreviewer","error","ভাউচার","অনুমোদিত অথচ কে অনুমোদন করেছেন তার নাম নেই",V.filter(v=>v.status==="approved"&&!v.reviewedByName).map(vlbl),"vouchers.html","সরাসরি Admin-এর পুরনো ভাউচারে এমন থাকতে পারে (status ছাড়া ভাউচার ধরা হয় না)।");
 add("v-self","info","ভাউচার","যিনি বানিয়েছেন তিনিই অনুমোদন করেছেন",V.filter(v=>v.status==="approved"&&v.reviewedByUid&&v.reviewedByUid===v.createdByUid).map(vlbl),"vouchers.html","Admin নিজে বানালে স্বয়ংক্রিয়ভাবে এমন হয় — অন্য কেউ হলে খেয়াল করুন।");
 add("v-big","info","ভাউচার",`${money(o.bigAmount)} বা তার বেশি খরচ`,V.filter(v=>v.status!=="rejected"&&num(v.total)>=o.bigAmount).map(vlbl),"vouchers.html");
 // 5) member fees vs receipts
 const byMember={};for(const r of R)if(r.type==="member"&&r.memberId)(byMember[r.memberId]||(byMember[r.memberId]=[])).push(r);
 add("m-paid-norcpt","warn","সদস্য","'পরিশোধিত' অথচ কোনো সদস্য-রসিদ নেই",M.filter(m=>m.feeStatus==="পরিশোধিত"&&!(byMember[m.id]||[]).length).map(m=>`${m.name||m.id}${m.fee?" — ধার্য "+money(m.fee):""}`),"members.html","সিস্টেম চালুর আগের বা হাতে-লেখা রসিদের পেমেন্ট হলে এটা স্বাভাবিক।");
 add("m-rcpt-due","warn","সদস্য","রসিদ আছে অথচ স্ট্যাটাস 'বাকি'",M.filter(m=>(byMember[m.id]||[]).length&&(m.feeStatus||"বাকি")==="বাকি").map(m=>`${m.name||m.id} — ${money(byMember[m.id].reduce((a,r)=>a+num(r.amount),0))} রসিদ`),"members.html");
 add("m-short","warn","সদস্য","'পরিশোধিত' কিন্তু রসিদের মোট ধার্য চাঁদার চেয়ে কম",M.filter(m=>m.feeStatus==="পরিশোধিত"&&num(String(m.fee||"").replace(/[^\d]/g,""))>0&&(byMember[m.id]||[]).length&&byMember[m.id].reduce((a,r)=>a+num(r.amount),0)<num(String(m.fee).replace(/[^\d]/g,""))).map(m=>`${m.name} — ধার্য ${money(String(m.fee).replace(/[^\d]/g,""))}, রসিদ ${money(byMember[m.id].reduce((a,r)=>a+num(r.amount),0))}`),"members.html");
 // 6) team registrations
 const deskBy={};for(const k of K)if(!k.trial)(deskBy[norm(k.payer)]||(deskBy[norm(k.payer)]=[])).push(k);
 add("t-total","error","দল নিবন্ধন","'মোট পরিশোধিত' আর এন্ট্রি ফি + কাসনমনির যোগফল মেলেনি",G.filter(g=>g.entryFee&&g.kasanmani&&num(g.totalPaid)!==num(g.entryFee.paid)+num(g.kasanmani.paid)).map(g=>`${g.teamName} — মোট ${money(g.totalPaid)}, যোগফল ${money(num(g.entryFee.paid)+num(g.kasanmani.paid))}`),"team-registrations-admin.html");
 add("t-hist","warn","দল নিবন্ধন","পেমেন্ট ইতিহাসের যোগফল 'মোট পরিশোধিত'-এর সঙ্গে মেলেনি",G.filter(g=>Array.isArray(g.paymentHistory)&&g.paymentHistory.length&&g.paymentHistory.reduce((a,h)=>a+num(h.amount),0)!==num(g.totalPaid)).map(g=>`${g.teamName} — ইতিহাস ${money(g.paymentHistory.reduce((a,h)=>a+num(h.amount),0))}, মোট ${money(g.totalPaid)}`),"team-registrations-admin.html");
 add("t-desk-more","warn","দল নিবন্ধন","Receipt Desk-এর রসিদে নিবন্ধনের চেয়ে বেশি টাকা",G.filter(g=>{const d=(deskBy[norm(g.teamName)]||[]).reduce((a,k)=>a+num(k.amount),0);return d>num(g.totalPaid)}).map(g=>`${g.teamName} — রসিদে ${money((deskBy[norm(g.teamName)]||[]).reduce((a,k)=>a+num(k.amount),0))}, নিবন্ধনে ${money(g.totalPaid)}`),"team-receipts.html","নিবন্ধনে পেমেন্ট ঢোকানো বাকি থাকতে পারে।");
 // 7) probable trial / bad records
 const trialish=/(test|trial|dummy|demo|টেস্ট|ট্রায়াল|ডামি|পরীক্ষা)/i;
 add("trial-like","warn","রসিদ","ট্রায়ালের মতো দেখতে অথচ আসল হিসেবে ধরা",[...R.filter(r=>!r.trial&&(trialish.test(r.name||"")||num(r.amount)<=10)).map(lbl),...K.filter(r=>!r.trial&&(trialish.test(r.payer||"")||num(r.amount)<=10)).map(lbl)],"team-receipts.html","ট্রায়াল হলে 'টিম রসিদ' পেজে Trial করুন।");
 add("bad-amount","error","রসিদ","টাকার অঙ্ক শূন্য বা ঋণাত্মক",[...R,...K].filter(r=>!(num(r.amount)>0)).map(lbl),"receipts.html");
 add("future","warn","রসিদ","ভবিষ্যতের তারিখ",[...R.filter(r=>r.date>o.today).map(r=>`${lbl(r)} — ${r.date}`),...V.filter(v=>v.date>o.today).map(v=>`${vlbl(v)} — ${v.date}`)],"receipts.html");
 add("no-date","warn","রসিদ","তারিখ নেই",[...R.filter(r=>!r.date).map(lbl),...V.filter(v=>!v.date).map(vlbl)],"receipts.html");
 add("no-method","info","রসিদ","পেমেন্টের মাধ্যম অজানা",[...R.filter(r=>methodOf(r.method)==="অজানা").map(lbl),...V.filter(v=>methodOf(v.method)==="অজানা").map(vlbl)],"receipts.html","মাধ্যম মিলানোর হিসাবে এগুলো 'অজানা'-তে যাবে।");
 add("desk-total","warn","টিম রসিদ","পূর্বের টাকা + এই টাকা ≠ মোট",K.filter(k=>!k.trial&&k.previous!==undefined&&k.total!==undefined&&num(k.previous)+num(k.amount)!==num(k.total)).map(k=>`${lbl(k)} — আগে ${money(k.previous)}, মোট ${money(k.total)}`),"team-receipts.html");
 // 8) every record should have its activity-log entry
 if(D.logsComplete){
  const miss=(list,area,fmt)=>add("nolog-"+area,"warn",area,"Activity Log-এ এন্ট্রি পাওয়া যায়নি",list.filter(x=>x.logId&&!logIds.has(x.logId)).map(fmt),"activity-log.html","লগ ছাড়া সেভ হয়েছে — কেউ নিয়ম এড়িয়ে লিখে থাকতে পারেন।");
  miss(R,"রসিদ",x=>lbl(x));miss(V,"ভাউচার",vlbl)}
 const order={error:0,warn:1,info:2};issues.sort((a,b)=>order[a.sev]-order[b.sev]);
 const income=cashIncome(D,o).reduce((a,e)=>a+e.in,0),expense=V.filter(v=>v.status!=="rejected").reduce((a,v)=>a+num(v.total),0);
 return{issues,counts:{error:issues.filter(i=>i.sev==="error").length,warn:issues.filter(i=>i.sev==="warn").length,info:issues.filter(i=>i.sev==="info").length},income,expense,
  checked:{receipts:R.length,desk:K.length,vouchers:V.length,regs:G.length,members:M.length}}}

/* ---------------- cash book ---------------- */
export function cashIncome(D,o={}){
 const E=[];
 for(const r of D.receipts||[])E.push({date:r.date||"",desc:`${TYPE_LABEL[r.type]||r.type} — ${r.name} (${r.receiptNo||r.code})`,method:methodOf(r.method),in:num(r.amount),out:0,src:"receipt",ref:r.code});
 const reg=registryOf(D.regs||[]);
 for(const k of D.desk||[]){const c=classify(k,reg);if(!c.counted)continue;E.push({date:/^\d{4}-\d{2}-\d{2}$/.test(k.paymentDate||"")?k.paymentDate:(k.issuedAtMs?dayOf(k.issuedAtMs):""),desc:`টিম রসিদ — ${k.payer} (${k.category||""})`,method:methodOf(k.method),in:num(k.amount),out:0,src:"desk",ref:k.code})}
 for(const g of D.regs||[]){const H=Array.isArray(g.paymentHistory)?g.paymentHistory:[];
  if(H.length)for(const h of H)E.push({date:histDay(h),desc:`Team Registration — ${g.teamName} (${h.category||""})`,method:methodOf(h.method),in:num(h.amount),out:0,src:"reg",ref:g.id});
  else if(num(g.totalPaid)>0)E.push({date:"",desc:`Team Registration — ${g.teamName} (ইতিহাস নেই)`,method:"অজানা",in:num(g.totalPaid),out:0,src:"reg",ref:g.id})}
 return E}
export function buildCashBook(D,opts={}){
 const rows=[...cashIncome(D,opts)];
 for(const v of D.vouchers||[]){if(v.status==="rejected")continue;rows.push({date:v.date||"",desc:`${v.cat} — ${v.payee} (${v.voucherNo})${v.status==="pending"?" ⏳ অনুমোদন বাকি":""}`,method:methodOf(v.method),in:0,out:num(v.total),src:"voucher",ref:v.id})}
 const dated=rows.filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date)||(b.in>0)-(a.in>0)||a.desc.localeCompare(b.desc));
 let bal=num(opts.opening);const out=dated.map(r=>({...r,bal:bal+=r.in-r.out}));
 const undated=rows.filter(r=>!r.date).map(r=>({...r,bal:null}));
 return{rows:[...out,...undated],opening:num(opts.opening),income:rows.reduce((a,r)=>a+r.in,0),expense:rows.reduce((a,r)=>a+r.out,0),closing:bal+undated.reduce((a,r)=>a+r.in-r.out,0),undated:undated.length}}
/* money by payment method — system balance vs the physically counted amount */
export function reconcile(book,counted={}){
 const m={};METHODS.forEach(k=>m[k]={method:k,in:0,out:0});
 for(const r of book.rows){const k=m[r.method]?r.method:"অজানা";m[k].in+=r.in;m[k].out+=r.out}
 return METHODS.map(k=>{const x=m[k],bal=x.in-x.out,c=counted[k];return{...x,bal,counted:c===undefined||c===""?null:num(c),diff:c===undefined||c===""?null:num(c)-bal}})}
export const csvOf=rows=>"\ufeff"+rows.map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");
