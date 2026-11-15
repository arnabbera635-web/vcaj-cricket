/* Pure calculation helpers for the prize list (no DOM, no Firebase) — uses only fields the scorer really writes:
   type, batterRuns, bowlerRuns, legal, strikerId, bowlerId, fielderId, dismissalType, inningsNo, over ("3.2" = before the ball), superOver, createdAt */
const num=v=>Number(v||0);
const overNo=e=>Math.floor(parseFloat(e.over||"0")||0);
export const regular=evs=>(evs||[]).filter(e=>!e.superOver);
const sorted=evs=>[...regular(evs)].sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));

/* complete over (6 legal balls) with 0 runs charged to the bowler — wides/no-balls carry bowlerRuns, so they correctly break a maiden */
export function maidens(evs){
 const g={};
 for(const e of regular(evs)){
  if(!e.bowlerId)continue;
  const k=`${e.inningsNo||1}|${overNo(e)}|${e.bowlerId}`;
  const o=g[k]||(g[k]={inningsNo:e.inningsNo||1,over:overNo(e),bowlerId:e.bowlerId,bowlerName:e.bowlerName||"",legal:0,runs:0});
  if(e.legal!==false)o.legal++;
  o.runs+=num(e.bowlerRuns)}
 return Object.values(g).filter(o=>o.legal===6&&o.runs===0)}

/* six legal balls in one over, every one hit for 6 by the same batter */
export function sixSixes(evs){
 const g={};
 for(const e of sorted(evs)){
  if(e.legal===false||!e.strikerId)continue;
  const k=`${e.inningsNo||1}|${overNo(e)}`;
  (g[k]||(g[k]=[])).push(e)}
 const out=[];
 for(const [k,L] of Object.entries(g)){
  if(L.length===6&&L.every(e=>e.type!=="wicket"&&num(e.batterRuns)===6&&e.strikerId===L[0].strikerId))
   out.push({strikerId:L[0].strikerId,batterName:L[0].batterName||"",inningsNo:L[0].inningsNo||1,over:overNo(L[0])})}
 return out}

/* caught-and-bowled: the catcher is the bowler */
export function caughtBowled(evs){
 const by={};
 for(const e of regular(evs)){
  if(e.type==="wicket"&&e.dismissalType==="caught"&&e.fielderId&&e.fielderId===e.bowlerId){
   const o=by[e.bowlerId]||(by[e.bowlerId]={id:e.bowlerId,name:e.bowlerName||"",count:0});o.count++}}
 return Object.values(by)}

/* boundaries by batter (4s and 6s off the bat) */
export function boundaries(evs){
 const by={};
 for(const e of regular(evs)){
  if(!e.strikerId||e.type==="wicket")continue;
  const b=num(e.batterRuns);if(b!==4&&b!==6)continue;
  const o=by[e.strikerId]||(by[e.strikerId]={id:e.strikerId,name:e.batterName||"",fours:0,sixes:0});
  if(b===4)o.fours++;else o.sixes++}
 return Object.values(by)}

/* ---------- prize catalogue: which prize can be calculated, and how reliably ---------- */
export const MODE={
 auto:["✅ Auto","হিসাব পুরোপুরি স্কোরারের ডেটা থেকে"],
 partial:["🟡 আংশিক","ডেটা থেকে তালিকা আসে, তবে Admin-কে নিশ্চিত করতে হবে"],
 manual:["✋ Manual","ডেটা থেকে হিসাব সম্ভব নয় — Admin নিজে বেছে দেবেন"]};
export const KIND={
 1:"auto",2:"auto",3:"auto",4:"auto",5:"auto",6:"partial",7:"partial",8:"partial",9:"auto",10:"auto",11:"auto",12:"auto",13:"auto",14:"auto",
 15:"manual",16:"auto",17:"auto",18:"manual",19:"auto",20:"auto",21:"manual",22:"manual",23:"manual",24:"manual",25:"auto"};
export const RULE={
 1:"প্রতিটি R16 ম্যাচে: রান + উইকেট×২৫ + ফিল্ডিং×৮ (ম্যাচের সেরা)",2:"প্রতিটি QF ম্যাচে: রান + উইকেট×২৫ + ফিল্ডিং×৮",3:"দুটি SF ম্যাচে আলাদা করে একই সূত্র",4:"ফাইনালে একই সূত্র",
 5:"ফাইনাল ম্যাচের সেরা ব্যাটসম্যান, বোলার ও ফিল্ডার (Awards ইঞ্জিনের সূত্র)",
 6:"কিপার আলাদা করে চেনা যায় না — শুধু স্টাম্পিং (সঙ্গে ক্যাচ) দেখে তালিকা। নিশ্চিত করুন কে কিপার ছিলেন",
 7:"দর্শনীয় ক্যাচ নিজে বিচার করতে হয় — শুধু সবচেয়ে বেশি ক্যাচের তালিকা রেফারেন্স হিসেবে",
 8:"রান-আউটে 'সরাসরি' বা 'কিপার ছাড়া' আলাদা করে লেখা হয় না — রান-আউট সংখ্যার তালিকা, Admin বেছে নেবেন",
 9:"টানা ৩টি বৈধ বলে একই বোলারের ৩ উইকেট — প্রত্যেক হ্যাট্রিক",10:"রান + উইকেট×২৫ + ফিল্ডিং×৬ (রান ও উইকেট দুটোই আছে এমন খেলোয়াড়)",
 11:"টুর্নামেন্টে সর্বমোট সর্বাধিক রান",12:"টুর্নামেন্টে সর্বমোট সর্বাধিক উইকেট",13:"প্রতিটি ইনিংসে ৫০ বা ১০০+ রান — প্রত্যেক ইনিংস আলাদা",
 14:"ফাইনালে এক ওভারে ৬টি বৈধ বলে ৬টি ছক্কা (একই ব্যাটার)",16:"যে ব্যাটারকে বোলার নিজেই ক্যাচ ধরে আউট করেছে",17:"৬টি বৈধ বলে বোলারের নামে ০ রান (ওয়াইড/নো-বল থাকলে মেডেন নয়) — প্রত্যেক মেডেন ওভার",
 19:"ফাইনালে ব্যাটারপিছু ছক্কা ও চার (বেশি ছক্কা আগে)",20:"পুরো টুর্নামেন্টে রান + উইকেট×২৫ + ফিল্ডিং×৮",25:"ফাইনালের দুই দলের সব খেলোয়াড় (চ্যাম্পিয়ন ও রানার্স-আপ)"};

/* ---------- the calculators. A = { state(), matchCandidates(type,matchId), tournamentCandidates(type), pname(id), pteam(id), completedMatch(m,season) } ---------- */
const top=(rows,n=6)=>rows.slice(0,n);
const mlabel=m=>`${m.stageName||m.stage||"Match"}: ${m.team1Name||""} vs ${m.team2Name||""}`;
const toRow=(x,matchId)=>({key:`${matchId||"t"}:${x.id}`,id:x.id,name:x.name,team:x.team,metric:x.metric,score:x.score,matchId:matchId||""});
const fielding=s=>num(s.catches)+num(s.runOuts)+num(s.stumpings);

export function calcPrize(no,A,season){
 const {matches,verified,players}=A.state();
 const done=(stage)=>matches.filter(m=>A.completedMatch(m,season)&&m.stage===stage&&verified.matches[m.id]);
 const evOf=m=>(verified.matches[m.id]?.events)||[];
 const momGroups=(stage)=>done(stage).map(m=>({title:mlabel(m),matchId:m.id,pick:1,rows:top(A.matchCandidates("MATCH_MOTM",m.id)).map(x=>toRow(x,m.id))}));
 const final=done("FINAL")[0];
 const needFinal=()=>final?null:"ফাইনাল ম্যাচ এখনও COMPLETED হয়নি (বা এই Season-এ নেই)";
 const g=(title,rows,pick,extra={})=>({title,rows,pick,...extra});
 switch(Number(no)){
  case 1:return{groups:momGroups("R16")};
  case 2:return{groups:momGroups("QF")};
  case 3:return{groups:momGroups("SF")};
  case 4:return{groups:momGroups("FINAL")};
  case 5:{const e=needFinal();if(e)return{error:e};
   return{groups:[["BEST_BATSMAN","সেরা ব্যাটসম্যান"],["BEST_BOWLER","সেরা বোলার"],["BEST_FIELDER","সেরা ফিল্ডার"]].map(([t,l])=>g(`${l} — ${mlabel(final)}`,top(A.matchCandidates(t,final.id)).map(x=>toRow(x,final.id)),1,{matchId:final.id,sub:l}))}}
  case 6:{const rows=Object.entries(verified.records).filter(([,s])=>s.stumpings>0).map(([id,s])=>({id,name:A.pname(id),team:A.pteam(id),score:s.stumpings*1000+s.catches,metric:`${s.stumpings} স্টাম্পিং • ${s.catches} ক্যাচ`})).sort((a,b)=>b.score-a.score);
   return{groups:[g("স্টাম্পিং করা খেলোয়াড়",top(rows).map(x=>toRow(x)),1)]}}
  case 7:return{groups:[g("সবচেয়ে বেশি ক্যাচ (রেফারেন্স)",top(A.tournamentCandidates("BEST_CATCH")).map(x=>toRow(x)),0)]};
  case 8:return{groups:[g("রান-আউটে জড়িত ফিল্ডার",top(A.tournamentCandidates("BEST_RUN_OUT")).map(x=>toRow(x)),0)]};
  case 9:return{groups:[g("হ্যাট্রিকধারী বোলার",A.tournamentCandidates("HAT_TRICK").map(x=>toRow(x)),99)]};
  case 10:return{groups:[g("সেরা অলরাউন্ডার",top(A.tournamentCandidates("BEST_ALLROUNDER")).map(x=>toRow(x)),1)]};
  case 11:return{groups:[g("সর্বাধিক রান",top(A.tournamentCandidates("MOST_RUNS")).map(x=>toRow(x)),1)]};
  case 12:return{groups:[g("সর্বাধিক উইকেট",top(A.tournamentCandidates("MOST_WICKETS")).map(x=>toRow(x)),1)]};
  case 13:{const rows=[];
   for(const m of matches.filter(m=>A.completedMatch(m,season)&&verified.matches[m.id]))
    for(const [id,s] of Object.entries(verified.matches[m.id].players))
     for(const x of s.innings)if(num(x.runs)>=50)rows.push({key:`${m.id}:${id}:${x.inningsNo}`,id,name:A.pname(id),team:A.pteam(id),matchId:m.id,score:x.runs,
      metric:`${x.runs} রান (${x.balls} বল, ${x.fours}×৪, ${x.sixes}×৬) — ${x.runs>=100?"সেঞ্চুরি":"হাফ-সেঞ্চুরি"} • ${mlabel(m)}`});
   rows.sort((a,b)=>b.score-a.score);return{groups:[g("৫০+ রানের ইনিংস",rows,rows.length)]}}
  case 14:{const e=needFinal();if(e)return{error:e};
   const rows=sixSixes(evOf(final)).map((x,i)=>({key:`${final.id}:${x.strikerId}:${x.inningsNo}:${x.over}`,id:x.strikerId,name:A.pname(x.strikerId)||x.batterName,team:A.pteam(x.strikerId),matchId:final.id,score:1,metric:`${x.over+1} নম্বর ওভারে টানা ৬টি ছক্কা • ${mlabel(final)}`}));
   return{groups:[g(`ফাইনালে এক ওভারে ৬ ছক্কা — ${mlabel(final)}`,rows,rows.length,{matchId:final.id})],empty:"ফাইনালে এমন কোনো ওভার পাওয়া যায়নি"}}
  case 16:{const by={};
   for(const m of matches.filter(m=>A.completedMatch(m,season)&&verified.matches[m.id]))for(const x of caughtBowled(evOf(m))){const o=by[x.id]||(by[x.id]={id:x.id,name:A.pname(x.id)||x.name,team:A.pteam(x.id),count:0});o.count+=x.count}
   const rows=Object.values(by).sort((a,b)=>b.count-a.count).map(x=>({key:`t:${x.id}`,id:x.id,name:x.name,team:x.team,matchId:"",score:x.count,metric:`${x.count}টি কট অ্যান্ড বোল্ড`}));
   return{groups:[g("কট অ্যান্ড বোল্ড",top(rows),1)],empty:"কোনো কট অ্যান্ড বোল্ড পাওয়া যায়নি"}}
  case 17:{const rows=[];
   for(const m of matches.filter(m=>A.completedMatch(m,season)&&verified.matches[m.id]))for(const x of maidens(evOf(m)))rows.push({key:`${m.id}:${x.bowlerId}:${x.inningsNo}:${x.over}`,id:x.bowlerId,name:A.pname(x.bowlerId)||x.bowlerName,team:A.pteam(x.bowlerId),matchId:m.id,score:1,metric:`${x.over+1} নম্বর ওভার মেডেন • ${mlabel(m)}`});
   return{groups:[g("মেডেন ওভার",rows,rows.length)],empty:"কোনো মেডেন ওভার পাওয়া যায়নি"}}
  case 19:{const e=needFinal();if(e)return{error:e};
   const rows=boundaries(evOf(final)).map(x=>({key:`${final.id}:${x.id}`,id:x.id,name:A.pname(x.id)||x.name,team:A.pteam(x.id),matchId:final.id,score:x.sixes*1000+x.fours,metric:`${x.sixes}টি ছক্কা • ${x.fours}টি চার • ${mlabel(final)}`})).sort((a,b)=>b.score-a.score);
   return{groups:[g(`ফাইনালে বাউন্ডারি — ${mlabel(final)}`,top(rows),1,{matchId:final.id})],empty:"ফাইনালে কোনো বাউন্ডারি পাওয়া যায়নি"}}
  case 20:{const rows=Object.entries(verified.records).map(([id,s])=>({id,name:A.pname(id),team:A.pteam(id),score:s.runs+s.wickets*25+fielding(s)*8,metric:`${s.runs} রান • ${s.wickets} উইকেট • ${fielding(s)} ফিল্ডিং`})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
   return{groups:[g("ম্যান অফ দ্যা সিরিজ",top(rows).map(x=>toRow(x)),1)]}}
  case 25:{const e=needFinal();if(e)return{error:e};
   const win=final.winnerTeamName||"",tn=[final.team1Name,final.team2Name].filter(Boolean);
   const rows=players.filter(p=>tn.includes(p.teamName)).map(p=>({key:`${final.id}:${p.id}`,id:p.id,name:p.name||p.playerName||p.id,team:p.teamName,matchId:final.id,score:p.teamName===win?2:1,metric:p.teamName===win?"🏆 চ্যাম্পিয়ন দল":"🥈 রানার্স-আপ দল"})).sort((a,b)=>b.score-a.score||a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
   return{groups:[g(`ফাইনালের দুই দল — ${mlabel(final)}`,rows,rows.length,{matchId:final.id})]}}
  default:return{manual:true}}}
