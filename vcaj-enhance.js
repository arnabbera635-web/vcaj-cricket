/* VCAJ unified enhancements: nav, theme, offline banner, PWA, toast, scroll-top. Pure vanilla, no dependencies. */
(function(){
"use strict";
var d=document,$=function(s,r){return(r||d).querySelector(s)};
function el(t,a,h){var e=d.createElement(t);for(var k in a||{})e.setAttribute(k,a[k]);if(h)e.innerHTML=h;return e}
// theme
try{var t=localStorage.getItem("vcTheme");if(t)d.documentElement.setAttribute("data-theme",t)}catch(e){}
function ready(f){d.readyState!=="loading"?f():d.addEventListener("DOMContentLoaded",f)}
window.vcToast=function(msg){var x=$("#vc-toast");if(!x){x=el("div",{id:"vc-toast",role:"status"});d.body.appendChild(x)}x.textContent=msg;x.classList.add("show");clearTimeout(x._t);x._t=setTimeout(function(){x.classList.remove("show")},2800)};
ready(function(){
 var page=(location.pathname.split("/").pop()||"index.html");
 var links=[["index.html","🏠 Home"],["live.html","🔴 Live Score"],["bracket.html","🏆 Bracket"],["matches.html","📅 Matches"],["teams.html","👥 Teams"],["stats.html","📈 Stats"],["h2h.html","⚔️ Head-to-Head"],["sponsors.html","🤝 Sponsors"],["sponsors.html","🤝 Sponsors"],["sponsors.html","🏢 Sponsors"],["players.html","🏏 Players"],["records.html","📊 Records"],["season-awards.html","🥇 Awards"],["team-registration.html","📝 Registration"],["member-panel.html","🔐 Member"],["scorer.html","⚙️ Admin"]];
 var isAdminPage=/^(scorer|admin|accounts|admin-records|member-setup|team-registrations-admin)/.test(page);
 var bar=$(".topbar");
 if(!bar&&!isAdminPage&&page.indexOf("google")!==0){
  bar=el("header",{"class":"topbar"},'<a class="brand" href="index.html">VCAJ <span>Cricket</span></a><nav>'+links.map(function(l){return'<a href="'+l[0]+'">'+l[1]+'</a>'}).join("")+"</nav>");
  d.body.insertBefore(bar,d.body.firstChild);
 }
 if(bar){
  var nav=$("nav",bar);
  if(nav){
   if(!nav.querySelector('a[href="stats.html"]')&&!isAdminPage){var sa=el("a",{href:"stats.html"},"Stats");var rc=nav.querySelector('a[href="records.html"]');rc?nav.insertBefore(sa,rc):nav.appendChild(sa)}
   if(!nav.querySelector('a[href="sponsors.html"]')&&!isAdminPage){nav.appendChild(el("a",{href:"sponsors.html"},"Sponsors"))}
   if(!nav.querySelector('a[href="sponsors.html"]')&&!isAdminPage)nav.appendChild(el("a",{href:"sponsors.html"},"Sponsors"));
   [].forEach.call(nav.querySelectorAll("a"),function(a){if((a.getAttribute("href")||"").split("?")[0]===page)a.classList.add("vc-active")});
   var b=el("button",{id:"vc-burger","aria-label":"মেনু","aria-expanded":"false",type:"button"},"☰");
   bar.insertBefore(b,nav);
   b.onclick=function(){var o=nav.classList.toggle("vc-open");b.setAttribute("aria-expanded",o);b.textContent=o?"✕":"☰"};
   nav.addEventListener("click",function(e){if(e.target.tagName==="A")nav.classList.remove("vc-open")});
  }
 }
 // theme toggle
 var tb=el("button",{id:"vc-theme","aria-label":"Dark / Light mode",type:"button"},"🌓");
 tb.onclick=function(){var n=d.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";d.documentElement.setAttribute("data-theme",n);try{localStorage.setItem("vcTheme",n)}catch(e){}vcToast(n==="dark"?"🌙 Dark mode":"☀️ Light mode")};
 d.body.appendChild(tb);
 // scroll to top
 var up=el("button",{id:"vc-top","aria-label":"উপরে যান",type:"button"},"↑");
 up.onclick=function(){scrollTo({top:0,behavior:"smooth"})};d.body.appendChild(up);
 addEventListener("scroll",function(){up.classList.toggle("show",scrollY>400)},{passive:true});
 // offline banner
 var nb=el("div",{id:"vc-net",role:"alert"});d.body.appendChild(nb);
 function net(){if(navigator.onLine){if(nb.classList.contains("show")){nb.textContent="✅ ইন্টারনেট ফিরে এসেছে";nb.classList.add("ok");setTimeout(function(){nb.classList.remove("show")},2200)}}else{nb.textContent="⚠️ ইন্টারনেট নেই — অফলাইন মোড";nb.classList.remove("ok");nb.classList.add("show")}}
 addEventListener("online",net);addEventListener("offline",net);net();
 // wrap tables for safe scroll + share/install footer
 if(page.indexOf("google")!==0&&!$(".vc-footer")){
  var f=el("footer",{"class":"vc-footer"},'<div><button type="button" id="vc-share">📤 শেয়ার করুন</button><button type="button" id="vc-install">📲 অ্যাপ ইনস্টল</button><button type="button" id="vc-print">🖨️ প্রিন্ট</button></div>© '+new Date().getFullYear()+' <b>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</b><div style="margin-top:8px"><a href="index.html">Home</a><a href="live.html">Live</a><a href="records.html">Records</a><a href="team-registration.html">Registration</a></div>');
  d.body.appendChild(f);
  $("#vc-print").onclick=function(){print()};
  $("#vc-share").onclick=function(){var u={title:d.title,url:location.href};if(navigator.share)navigator.share(u).catch(function(){});else if(navigator.clipboard){navigator.clipboard.writeText(u.url).then(function(){vcToast("🔗 লিংক কপি হয়েছে")})}else prompt("Link:",u.url)};
 }
 // home sponsor strip
 if(page==="index.html"||page===""){import("./firebase.js").then(function(F){return F.getDocs(F.collection(F.db,"sponsors"))}).then(function(s){var l=s.docs.map(function(d){return d.data()});if(!l.length)return;var o={Gold:0,Silver:1,Bronze:2,Supporter:3};l.sort(function(a,b){return(o[a.tier]||9)-(o[b.tier]||9)});var w=el("section",{id:"vc-spstrip"});w.appendChild(el("h3",{},"🏢 আমাদের Sponsors"));var r=el("div",{"class":"vc-sprow"});l.forEach(function(x){var a=el("a",{href:"sponsors.html"});a.textContent=x.name;r.appendChild(a)});w.appendChild(r);var f=$(".vc-footer");f?f.parentNode.insertBefore(w,f):d.body.appendChild(w)}).catch(function(){})}
 // PWA install
 var dp;addEventListener("beforeinstallprompt",function(e){e.preventDefault();dp=e;var i=$("#vc-install");if(i)i.style.display="inline-block"});
 var ib=$("#vc-install");if(ib)ib.onclick=function(){if(!dp)return;dp.prompt();dp.userChoice.then(function(){dp=null;ib.style.display="none"})};
 addEventListener("appinstalled",function(){vcToast("✅ অ্যাপ ইনস্টল হয়েছে")});
 // optional Wagon Wheel add-on (does nothing if its files are not uploaded)
 if($("#runButtons")){var ws=d.createElement("script");ws.src="wagon-scorer.js";ws.defer=true;ws.onerror=function(){};d.body.appendChild(ws)}
 if(/^(analysis|stats)(\.html)?$/.test(page)){fetch("wagon.html",{method:"HEAD"}).then(function(r){if(r.ok){var m=$("main")||d.body;var a=el("a",{href:"wagon.html"},"<button type=\"button\" style=\"margin:10px 0\">🎯 Wagon Wheel দেখুন</button>");m.insertBefore(a,m.children[1]||null)}}).catch(function(){})}
 // optional pages: Notices / Gallery (links and home banner appear only if the files are uploaded)
 var nv=bar&&$("nav",bar);
 [["notices.html","📢 Notices"],["gallery.html","📸 Gallery"]].forEach(function(p){if(!nv||isAdminPage)return;fetch(p[0],{method:"HEAD"}).then(function(r){if(r.ok&&!nv.querySelector('a[href="'+p[0]+'"]'))nv.appendChild(el("a",{href:p[0]},p[1]))}).catch(function(){})});
 if(/^(index)?(\.html)?$/.test(page)){fetch("notices.html",{method:"HEAD"}).then(function(r){if(!r.ok)return;return Promise.all([import("./firebase.js"),import("./vcaj-cache.js")]).then(function(m){var f=m[0];return m[1].getCached("vc_notices_top",function(){return f.getDocs(f.query(f.collection(f.db,"notices"),f.orderBy("createdAtMs","desc"),f.limit(3))).then(function(s){return s.docs.map(function(x){return x.data()})})},300000)}).then(function(list){if(!list||!list.length)return;list.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0)});var n=list[0],b=el("a",{href:"notices.html","class":"vc-notice"});b.textContent="📢 "+n.title+"  →";var mc=$("main")||$(".container");if(mc)mc.insertBefore(b,mc.firstChild)})}).catch(function(){})}
 // Home page: scrolling sponsor strip (static data, so no Firebase reads; appears only if sponsors-data.js is uploaded)
 if(/^(index)?(\.html)?$/.test(page)){import("./sponsors-data.js").then(function(m){var L=m.SPONSORS;if(!L||!L.length)return;var t=L.map(function(s){return((m.CATS[s.cat]||m.CATS.other).e)+" "+s.name}).join("      ")+"      ";var a=el("a",{href:"sponsors.html","class":"vc-spons"}),w=el("span",{"class":"vc-spons-w"}),i=el("span",{"class":"vc-spons-t"});i.textContent=t+t;w.appendChild(i);a.appendChild(el("span",{"class":"vc-spons-l"},"🤝 Sponsors"));a.appendChild(w);var mc=$("main")||$(".container");if(mc)mc.insertBefore(a,mc.firstChild)}).catch(function(){})}
 // service worker
 if("serviceWorker" in navigator&&location.protocol.indexOf("http")===0)navigator.serviceWorker.register("sw.js").catch(function(){});
});
})();
