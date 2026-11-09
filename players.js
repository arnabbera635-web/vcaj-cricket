import {db,collection,doc,getDocs,setDoc,updateDoc,serverTimestamp} from "./firebase.js";
const $=id=>document.getElementById(id);let teams=[],players=[];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function load(){
 const [ts,ps]=await Promise.all([getDocs(collection(db,"teams")),getDocs(collection(db,"players"))]);
 teams=ts.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 players=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 $("teamCount").textContent=`${teams.length} / 16`;$("playerCount").textContent=players.length;
 const opts=teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
 $("newPlayerTeam").innerHTML=`<option value="">দল নির্বাচন করুন</option>${opts}`;
 $("editPlayerSelect").innerHTML=`<option value="">খেলোয়াড় নির্বাচন করুন</option>`+
   players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
 $("teamTable").innerHTML=teams.length?`<div class="table-wrap"><table><tr><th>Team</th><th>Short</th><th>Players</th><th>Season</th></tr>${
   teams.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.shortName||"")}</td><td>${t.playersCount||0}</td><td>${t.season||2026}</td></tr>`).join("")
 }</table></div>`:"<p class='muted'>কোনো দল নেই।</p>";
 $("playerTable").innerHTML=players.length?`<div class="table-wrap"><table><tr><th>Player</th><th>Team</th><th>Runs</th><th>Wickets</th><th>Matches</th></tr>${
   players.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.teamName||teams.find(t=>t.id===p.teamId)?.name||"")}</td><td>${p.totalRuns||0}</td><td>${p.totalWickets||0}</td><td>${p.totalMatches||0}</td></tr>`).join("")
 }</table></div>`:"<p class='muted'>কোনো খেলোয়াড় নেই।</p>";
}
$("addTeam").onclick=async()=>{
 const name=$("newTeamName").value.trim(),shortName=$("newTeamShort").value.trim();
 if(!name){$("teamMsg").textContent="দলের নাম দিন।";return;}
 if(teams.length>=16){$("teamMsg").textContent="১৬টি দলের সীমা পূর্ণ হয়েছে।";return;}
 const id=`team-${Date.now()}`;
 await setDoc(doc(db,"teams",id),{id,name,shortName,playersCount:0,season:2026,createdAt:serverTimestamp()});
 $("newTeamName").value=$("newTeamShort").value="";$("teamMsg").textContent="দল Save হয়েছে।";await load();
};
$("addPlayer").onclick=async()=>{
 const name=$("newPlayerName").value.trim(),teamId=$("newPlayerTeam").value;
 if(!name||!teamId){$("playerMsg").textContent="নাম ও দল নির্বাচন করুন।";return;}
 const id=`player-${Date.now()}`,team=teams.find(t=>t.id===teamId);
 await setDoc(doc(db,"players",id),{
  id,name,teamId,teamName:team?.name||"",totalRuns:0,totalBalls:0,totalFours:0,
  totalSixes:0,totalMatches:0,totalWickets:0,createdAt:serverTimestamp()
 });
 if(team)await setDoc(doc(db,"teams",teamId),{playersCount:(team.playersCount||0)+1},{merge:true});
 $("newPlayerName").value="";$("playerMsg").textContent="খেলোয়াড় Save হয়েছে।";await load();
};
$("editPlayerSelect").onchange=()=>{
 const p=players.find(x=>x.id===$("editPlayerSelect").value);
 $("editPlayerName").value=p?.name||"";$("editPlayerTeam").value=p?.teamId||"";
};
$("editPlayer").onclick=async()=>{
 const id=$("editPlayerSelect").value,name=$("editPlayerName").value.trim();
 if(!id||!name){$("editPlayerMsg").textContent="খেলোয়াড় ও নতুন নাম দিন।";return;}
 const pl=players.find(x=>x.id===id),nt=$("editPlayerTeam").value,tm=teams.find(x=>x.id===nt),upd={name,updatedAt:serverTimestamp()};if(tm&&pl&&pl.teamId!==nt){upd.teamId=nt;upd.teamName=tm.name;const ot=teams.find(x=>x.id===pl.teamId);if(ot)await setDoc(doc(db,"teams",ot.id),{playersCount:Math.max(0,(ot.playersCount||1)-1)},{merge:true});await setDoc(doc(db,"teams",nt),{playersCount:(tm.playersCount||0)+1},{merge:true})}await updateDoc(doc(db,"players",id),upd);
 $("editPlayerMsg").textContent="নাম আপডেট হয়েছে।";await load();$("editPlayerSelect").value=id;$("editPlayerName").value=name;
};

function fillT(){const o='<option value="">— Team —</option>'+teams.map(t=>`<option value="${t.id}">${String(t.name||"").replace(/[<>&"]/g,"")}</option>`).join(""),a=$("editTeamSelect").value,b=$("editPlayerTeam").value;$("editTeamSelect").innerHTML=o;$("editPlayerTeam").innerHTML=o;$("editTeamSelect").value=a;$("editPlayerTeam").value=b}
const _ld=load;load=async function(){await _ld();fillT()};
$("editTeamSelect").onchange=()=>{const t=teams.find(x=>x.id===$("editTeamSelect").value);$("editTeamName").value=t?.name||"";$("editTeamShort").value=t?.shortName||""};
$("editTeam").onclick=async()=>{const id=$("editTeamSelect").value,name=$("editTeamName").value.trim(),shortName=$("editTeamShort").value.trim();if(!id||!name){$("editTeamMsg").textContent="Team বাছুন ও নাম দিন";return}
 try{await updateDoc(doc(db,"teams",id),{name,shortName,updatedAt:serverTimestamp()});for(const p of players.filter(x=>x.teamId===id))await updateDoc(doc(db,"players",p.id),{teamName:name});$("editTeamMsg").textContent="✅ Team আপডেট হয়েছে (খেলোয়াড়দের team নামও বদলেছে)";await load();$("editTeamSelect").value=id}catch(e){$("editTeamMsg").textContent="❌ "+e.message}};
await load();
