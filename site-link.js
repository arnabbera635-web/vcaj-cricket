/* One place that builds the "live score / website" lines added to receipt and voucher confirmation messages. */
export const TOURNAMENT_START="2026-12-25T08:00:00+05:30";   // change here next year
export const TOURNAMENT_NAME='Jeliakhali "Mondal and Mondal" Cricket Tournament';   // change here if the name changes
export const ORGANIZER="Vivekananda Cricket Association of Jeliakhali";
export const siteRoot=(loc=location)=>loc.origin+loc.pathname.replace(/[^/]*$/,"");
/* only the live-score / website lines (used inside the team broadcast, which already has its own heading) */
export function liveLinks(root,now=Date.now()){
 const started=now>=Date.parse(TOURNAMENT_START);
 const head=started?"🔴 লাইভ স্কোর ও ফলাফল দেখুন:":"🔴 ২৫ ডিসেম্বর ২০২৬, সকাল ৮টা থেকে খেলা শুরু — লাইভ স্কোর দেখুন:";
 return `${head}\n${root}live.html\n🌐 ওয়েবসাইট: ${root}`}
/* tournament name + organiser + live links (receipt / voucher confirmation messages) */
export const liveBlock=(root,now=Date.now())=>`🏏 ${TOURNAMENT_NAME}\nপরিচালনায়: ${ORGANIZER}\n\n${liveLinks(root,now)}`;
