/* Committee letter pad — pure helpers (no DOM, no Firebase): date formatting, reference number, and the A4 letter HTML. */
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const toBn=s=>String(s).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
const MON=["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
export function fmtDate(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");return m?toBn(`${+m[3]} ${MON[+m[2]-1]} ${m[1]}`):""}
export const nextRef=(count,year=new Date().getFullYear())=>`VCAJ/LTR/${String(year).slice(2)}/${String(count+1).padStart(4,"0")}`;
export const DEFAULT_SETTINGS={orgBn:"বিবেকানন্দ ক্রিকেট অ্যাসোসিয়েশন অফ জেলিয়াখালী",orgEn:"VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI",tagline:"ESTD. 2006",shortName:"V.C.A.J কমিটি",address:"",phone:"",email:"",regNo:"",presidentName:"",secretaryName:""};
const safeImg=v=>typeof v==="string"&&/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(v)?v:"";
export function paperHtml(d,s,STAMP){
 s={...DEFAULT_SETTINGS,...(s||{})};
 const contact=[s.address,s.phone&&"ফোন: "+s.phone,s.email&&"ইমেইল: "+s.email,s.regNo&&"রেজি. নং: "+s.regNo].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ");
 const sign=(img,who,name)=>`<div class="sgc"><div class="sgs">${safeImg(img)?`<img src="${safeImg(img)}" alt="">`:""}</div><div class="sgl"></div><div class="sgn">${name?`<b>${esc(name)}</b><br>`:""}${who}<br><small>${esc(s.shortName)}</small></div></div>`;
 const sec=d.signSecretary?sign(d.sigSecretary,"সম্পাদক",d.secretaryName||s.secretaryName):"<div></div>";
 const pre=d.signPresident?sign(d.sigPresident,"সভাপতি",d.presidentName||s.presidentName):"<div></div>";
 const stamp=`<div class="stc"><div class="stb ${d.stampDigital?"has":"blank"}">${d.stampDigital?`<img src="${STAMP}" alt="">`:"<span>কমিটির স্ট্যাম্প</span>"}</div></div>`;
 return`<div class="pp">${d.watermark?`<div class="wm" style="background-image:url('${STAMP}')"></div>`:""}
<div class="lh"><img class="lg" src="${STAMP}" alt=""><div class="lt"><div class="lb">${esc(s.orgBn)}</div><div class="le">${esc(s.orgEn)}</div>${s.tagline?`<div class="ls">${esc(s.tagline)}</div>`:""}${contact?`<div class="lc">${contact}</div>`:""}</div></div>
<div class="rl"></div>
<div class="mt"><span>স্মারক নং: <b>${esc(d.refNo||"")}</b></span><span>তারিখ: <b>${esc(fmtDate(d.date))}</b></span></div>
${d.to?`<div class="to"><div>প্রতি,</div>${esc(d.to)}</div>`:""}
${d.subject?`<div class="sb"><b>বিষয়:</b> <u>${esc(d.subject)}</u></div>`:""}
${d.salutation?`<div class="sl">${esc(d.salutation)}</div>`:""}
<div class="bd">${esc(d.body||"")}</div>
${d.closing?`<div class="cl">${esc(d.closing)}</div>`:""}
<div class="ft">${sec}${stamp}${pre}</div>
${d.cc?`<div class="cc"><b>অনুলিপি:</b><br>${esc(d.cc)}</div>`:""}</div>`}
export const PAPER_CSS=`.pp{position:relative;width:210mm;min-height:297mm;box-sizing:border-box;padding:16mm 20mm 14mm;background:#fff;color:#111;font-family:"Noto Sans Bengali","Hind Siliguri",system-ui,sans-serif;font-size:15px;line-height:1.75;overflow:hidden}
.pp .wm{position:absolute;left:50%;top:48%;width:420px;height:420px;margin:-210px 0 0 -210px;background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.07;pointer-events:none}
.pp>*:not(.wm){position:relative}
.pp .lh{display:flex;gap:14px;align-items:center}.pp .lg{width:82px;height:82px;object-fit:contain}.pp .lt{flex:1;text-align:center}
.pp .lb{font-size:23px;font-weight:800;color:#0b1d6b;line-height:1.25}.pp .le{font-size:12.5px;font-weight:700;letter-spacing:.6px;color:#0b1d6b}.pp .ls{font-size:12px;font-weight:700;color:#b45309;letter-spacing:1px}.pp .lc{font-size:11.5px;color:#334155;margin-top:2px}
.pp .rl{height:3px;margin:8px 0 12px;background:linear-gradient(90deg,#0b1d6b,#ff8a1f,#0b1d6b);border-radius:3px}
.pp .mt{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:10px}
.pp .to{white-space:pre-wrap;margin-bottom:8px}.pp .sb{margin:6px 0 10px}.pp .sl{margin-bottom:4px}
.pp .bd{white-space:pre-wrap;text-align:justify;min-height:120mm}.pp .cl{margin:14px 0 0}
.pp .ft{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:end;margin-top:26px;break-inside:avoid}
.pp .sgc{text-align:center}.pp .sgs{height:64px;display:flex;align-items:flex-end;justify-content:center}.pp .sgs img{max-height:60px;max-width:100%}
.pp .sgl{border-top:1.5px solid #111;margin:2px 8px 4px}.pp .sgn{font-size:13px;line-height:1.5}.pp .sgn small{color:#475569}
.pp .stc{display:flex;justify-content:center}.pp .stb{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center}
.pp .stb.blank{border:2px dashed #94a3b8;color:#94a3b8;font-size:12px}.pp .stb.has img{width:118px;height:118px;object-fit:contain;transform:rotate(-8deg)}
.pp .cc{margin-top:16px;font-size:12.5px;white-space:pre-wrap;border-top:1px dashed #94a3b8;padding-top:6px}
@media print{.pp .stb.blank{border-color:transparent}.pp .stb.blank span{visibility:hidden}.pp,.pp *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
