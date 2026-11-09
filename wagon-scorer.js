/* OPTIONAL add-on: shot-direction / catch-position recorder for scorer.html. Delete this file to remove the feature. */
(function(){
"use strict";
if(!document.getElementById("runButtons"))return;
var $=function(i){return document.getElementById(i)},fb=null,last=null,timer=null;
function ls(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}}
function ss(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var on=ls("vcajWagon","on")!=="off",dotOn=ls("vcajWagonDot","off")==="on",hands={};try{hands=JSON.parse(ls("vcajHands","{}"))||{}}catch(e){hands={}}
function handOf(n){return hands[n]==="L"?"L":"R"}
var startEnd=ls("vcajWagonEnd","N")==="S"?"S":"N";
function endName(e){return e==="N"?"উত্তর":"দক্ষিণ"}
function overIdx(){var t=(document.getElementById("oversText")||{}).textContent||"",m=t.match(/^\s*(\d+)\./);return m?Number(m[1]):0}
function bowlerEnd(o){return o%2===0?startEnd:(startEnd==="N"?"S":"N")}
import("./firebase.js").then(function(m){fb=m}).catch(function(){});
var css=document.createElement("style");css.textContent="#wg-pad{position:fixed;right:10px;bottom:10px;z-index:90;background:#0d2344;color:#fff;border-radius:16px;padding:8px 10px 10px;box-shadow:0 14px 34px rgba(0,0,0,.45);display:none;width:196px;text-align:center;font:12px system-ui}#wg-pad.show{display:block}#wg-pad svg{display:block;margin:4px auto;touch-action:manipulation}#wg-pad button{background:#334e7a;color:#fff;border:0;border-radius:8px;padding:5px 9px;margin:0 2px;font-size:12px}.wg-tg{position:fixed;bottom:10px;z-index:80;background:#0d2344;color:#fff;border:0;border-radius:99px;padding:7px 12px;font-size:12px;opacity:.9}#wg-tg{left:10px}#wg-dg{left:128px}#wg-eg{left:10px;bottom:46px}";document.head.appendChild(css);
var pad=document.createElement("div");pad.id="wg-pad";
pad.innerHTML='<div id="wg-t"></div><svg id="wg-s" width="176" height="176" viewBox="-88 -88 176 176"><circle r="84" fill="#1f7a3a" stroke="#fff" stroke-width="2"/><circle r="52" fill="none" stroke="#ffffff55" stroke-dasharray="4 4"/><rect x="-5" y="-22" width="10" height="44" rx="2" fill="#d9b779"/><text y="-72" font-size="9" text-anchor="middle" fill="#fff">উত্তর ↑</text><text y="82" font-size="9" text-anchor="middle" fill="#fff">দক্ষিণ ↓</text><circle id="wg-bw" r="4" cx="0" cy="-30" fill="#fb923c"/><circle id="wg-d" r="5" fill="#fbbf24" display="none"/></svg><div><button id="wg-h"></button><button id="wg-skip">বাদ দিন</button><a href="wagon.html" target="_blank" style="color:#fbbf24;margin-left:6px">দেখুন</a></div>';
document.body.appendChild(pad);
var tg=document.createElement("button");tg.id="wg-tg";tg.className="wg-tg";document.body.appendChild(tg);
var dg=document.createElement("button");dg.id="wg-dg";dg.className="wg-tg";document.body.appendChild(dg);
var eg=document.createElement("button");eg.id="wg-eg";eg.className="wg-tg";document.body.appendChild(eg);
function lab(){tg.textContent=on?"🎯 Wagon: ON":"🎯 Wagon: OFF";dg.textContent=dotOn?"⚪ Dot: ON":"⚪ Dot: OFF";eg.textContent="🧭 প্রথম ওভার: বোলার "+endName(startEnd)+" প্রান্ত";if(!on)pad.classList.remove("show")}
tg.onclick=function(){on=!on;ss("vcajWagon",on?"on":"off");lab()};
dg.onclick=function(){dotOn=!dotOn;ss("vcajWagonDot",dotOn?"on":"off");lab()};eg.onclick=function(){startEnd=startEnd==="N"?"S":"N";ss("vcajWagonEnd",startEnd);lab()};lab();
function hide(){pad.classList.remove("show");clearTimeout(timer)}
function hlab(){var b=$("wg-h");if(b&&last)b.textContent=last.hand==="L"?"✋ বাঁহাতি":"🤚 ডানহাতি"}
function ask(title,shot){shot.hand=handOf(shot.batter);shot.overIdx=shot.overIdx==null?overIdx():shot.overIdx;shot.bowlerEnd=bowlerEnd(shot.overIdx);title+=" • ওভার "+(shot.overIdx+1)+" (বোলার "+endName(shot.bowlerEnd)+" প্রান্ত)";var bw=$("wg-bw");if(bw)bw.setAttribute("cy",shot.bowlerEnd==="N"?-30:30);last=shot;hlab();$("wg-t").textContent=title;$("wg-d").setAttribute("display","none");pad.classList.add("show");clearTimeout(timer);timer=setTimeout(function(){last=null;hide()},9000)}
function txt(id){var s=$(id);return s&&s.selectedOptions&&s.selectedOptions[0]?s.selectedOptions[0].text:""}
function ctx(){var inn=($("inningsNo")||{}).textContent||"";return{matchId:($("activeMatchId")||{}).value||"",inningsNo:Number((inn.match(/Innings\s*(\d)/i)||[])[1])||1,superOver:/super/i.test(inn)}}
$("wg-skip").onclick=function(){last=null;hide()};
$("wg-h").onclick=function(){if(!last)return;last.hand=last.hand==="L"?"R":"L";hands[last.batter]=last.hand;ss("vcajHands",JSON.stringify(hands));hlab()};
// 1) run / dot balls
document.addEventListener("click",function(e){
 var b=e.target.closest&&e.target.closest("#runButtons [data-run]");
 if(!b||!on||b.disabled)return;
 var r=Number(b.dataset.run);if(r===0&&!dotOn){hide();return}
 var c=ctx();if(!c.matchId){last=null;return}
 ask(r>0?"শট কোন দিকে? ("+r+" রান)":"ডট বল — কোন দিকে খেলা হলো?",{kind:r>0?"run":"dot",matchId:c.matchId,inningsNo:c.inningsNo,superOver:c.superOver,batter:txt("striker"),bowler:txt("bowler"),runs:r})
},true);
// 2) catch / run-out position (recorded only after the wicket is really accepted)
document.addEventListener("click",function(e){
 var b=e.target.closest&&e.target.closest("#confirmWicket");
 if(!b||!on)return;
 var type=($("dismissalType")||{}).value,c=ctx(),snap={kind:"wicket",matchId:c.matchId,inningsNo:c.inningsNo,superOver:c.superOver,batter:txt("dismissedBatter"),bowler:txt("bowler"),dismissal:type,fielder:txt("fielder"),runs:0,overIdx:overIdx()};
 if(!c.matchId||(type!=="caught"&&type!=="runOut"))return;
 setTimeout(function(){var m=$("wicketModal");if(m&&m.classList.contains("hidden"))ask((type==="caught"?"ক্যাচ কোথায় ধরা হলো?":"রান-আউট কোথায় হলো?")+(snap.fielder&&snap.fielder.indexOf("নির্বাচন")<0?" ("+snap.fielder+")":""),snap)},350)
},true);
// save tapped position
$("wg-s").addEventListener("click",function(e){
 if(!last||!fb)return;
 var s=$("wg-s"),r=s.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*176-88,y=(e.clientY-r.top)/r.height*176-88;
 var d=Math.min(1,Math.sqrt(x*x+y*y)/84);if(last.kind==="run"&&last.runs>=4)d=Math.max(d,.92);
 var ang=Math.round((Math.atan2(x,-y)*180/Math.PI+360)%360);
 var dot=$("wg-d");dot.setAttribute("cx",x);dot.setAttribute("cy",y);dot.setAttribute("display","");
 var shot=last;last=null;var id="WS"+Date.now().toString(36)+Math.floor(Math.random()*999);
 var data={kind:shot.kind,matchId:shot.matchId,batter:shot.batter,bowler:shot.bowler,runs:shot.runs,inningsNo:shot.inningsNo,superOver:shot.superOver,angle:ang,dist:Math.round(d*100)/100,hand:shot.hand==="L"?"L":"R",overIdx:shot.overIdx,bowlerEnd:shot.bowlerEnd,createdAtMs:Date.now()};
 if(shot.kind==="wicket"){data.dismissal=shot.dismissal;data.fielder=shot.fielder}
 fb.setDoc(fb.doc(fb.db,"wagonShots",id),data).then(function(){window._wgLast={id:id,t:data.createdAtMs};setTimeout(hide,500)}).catch(function(){$("wg-t").textContent="সেভ হয়নি — rules দেখুন"});
});
// Undo → remove the last recorded position (only if recent)
var u=$("undoBtn");if(u)u.addEventListener("click",function(){var l=window._wgLast;if(l&&fb&&Date.now()-l.t<120000){fb.deleteDoc(fb.doc(fb.db,"wagonShots",l.id)).catch(function(){});window._wgLast=null}},true);
})();
