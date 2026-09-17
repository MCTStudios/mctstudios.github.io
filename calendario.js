const firebaseConfig={apiKey:"AIzaSyDRKSc1TjyWkULLAIkNSKCJQdhGL2YC7V4",authDomain:"mctstudios-auth.firebaseapp.com",projectId:"mctstudios-auth",storageBucket:"mctstudios-auth.firebasestorage.app",messagingSenderId:"599724018113",appId:"1:599724018113:web:d6e228e7d82a400d360740",measurementId:"G-NLTKEVP3EK"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.firestore();
const $=id=>document.getElementById(id);
let current=new Date(),events=[],user=null,selected=null,unsubscribe=null;
const pad=n=>String(n).padStart(2,"0"),dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function toast(t){const x=$("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2400)}
function open(id){$(id).classList.remove("hidden")} function close(id){$(id).classList.add("hidden")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
auth.onAuthStateChanged(u=>{if(!u){location.href="login.html";return}user=u;let n=u.displayName||u.email.split("@")[0];$("userName").textContent=n.charAt(0).toUpperCase()+n.slice(1);listen()});
function listen(){if(unsubscribe)unsubscribe();unsubscribe=db.collection("calendarEvents").orderBy("date").onSnapshot(s=>{events=s.docs.map(d=>({id:d.id,...d.data()}));render()},e=>{console.error(e);toast("Firestore non ancora configurato o accesso negato")})}
function render(){
 const y=current.getFullYear(),m=current.getMonth();
 $("monthTitle").textContent=new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric"}).format(current);
 const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset),today=dateKey(new Date());
 let html="";
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d),same=d.getMonth()===m;
  const ev=events.filter(x=>x.date===key).sort((a,b)=>(a.startTime||"").localeCompare(b.startTime||""));
  html+=`<div class="day ${same?"":"other"} ${key===today?"today":""}" data-date="${key}"><span class="day-number">${d.getDate()}</span>${ev.map(x=>`<div class="event" data-id="${x.id}"><b>${esc(x.title)}</b><span>${x.startTime?esc(x.startTime)+" • ":""}${esc(x.creatorLabel||"")}</span></div>`).join("")}</div>`;
 }
 $("calendarGrid").innerHTML=html;
 document.querySelectorAll(".event").forEach(e=>e.onclick=ev=>{ev.stopPropagation();showDetail(e.dataset.id)});
 document.querySelectorAll(".day").forEach(d=>d.onclick=()=>{$("eventDate").value=d.dataset.date;open("eventModal")});
}
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("prevBtn").onclick=()=>{current.setMonth(current.getMonth()-1);render()};$("nextBtn").onclick=()=>{current.setMonth(current.getMonth()+1);render()};$("todayBtn").onclick=()=>{current=new Date();render()};
$("newEventBtn").onclick=()=>{$("eventForm").reset();$("eventDate").value=dateKey(new Date());open("eventModal")};
$("settingsBtn").onclick=()=>open("settingsModal");
$("eventForm").onsubmit=async e=>{e.preventDefault();if(!user)return;
 const data={title:$("eventTitle").value.trim(),date:$("eventDate").value,startTime:$("eventStart").value,endTime:$("eventEnd").value,description:$("eventDescription").value.trim(),creatorLabel:$("eventCreator").value.trim(),createdByUid:user.uid,createdByEmail:user.email||"",createdAt:firebase.firestore.FieldValue.serverTimestamp()};
 if(!data.title||!data.date||!data.creatorLabel)return;
 try{await db.collection("calendarEvents").add(data);close("eventModal");e.target.reset();toast("Evento condiviso con MCT Studios ✓")}catch(err){console.error(err);toast("Impossibile creare l'evento")}};
function showDetail(id){selected=events.find(e=>e.id===id);if(!selected)return;$("detailTitle").textContent=selected.title;
 $("detailBody").innerHTML=`<div class="detail-row"><small>DATA E ORARIO</small>${new Date(selected.date+"T12:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}${selected.startTime?` • ${esc(selected.startTime)}${selected.endTime?" – "+esc(selected.endTime):""}`:""}</div><div class="detail-row"><small>CREATO DA</small>${esc(selected.creatorLabel)}</div>${selected.description?`<div class="detail-row"><small>DESCRIZIONE</small>${esc(selected.description)}</div>`:""}`;
 $("deleteEventBtn").classList.toggle("hidden",selected.createdByUid!==user?.uid);open("detailModal")}
$("deleteEventBtn").onclick=async()=>{if(!selected||selected.createdByUid!==user?.uid)return;try{await db.collection("calendarEvents").doc(selected.id).delete();close("detailModal");toast("Evento eliminato")}catch(e){toast("Impossibile eliminare l'evento")}};

const prefs=JSON.parse(localStorage.getItem("mctCalendarPrefs")||"{}");$("fontSize").value=prefs.fontSize||"normal";$("lightTheme").checked=!!prefs.light;
function applyPrefs(){document.body.classList.remove("large","xlarge","light");if($("fontSize").value!=="normal")document.body.classList.add($("fontSize").value);if($("lightTheme").checked)document.body.classList.add("light");localStorage.setItem("mctCalendarPrefs",JSON.stringify({fontSize:$("fontSize").value,light:$("lightTheme").checked}))}
$("fontSize").onchange=applyPrefs;$("lightTheme").onchange=applyPrefs;applyPrefs();
function icsEscape(s){return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
$("exportBtn").onclick=()=>{let out=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MCT Studios//MCT Calendar//IT","CALSCALE:GREGORIAN"];
 events.forEach(e=>{const ds=e.date.replaceAll("-",""),start=(e.startTime||"00:00").replace(":","")+"00",end=(e.endTime||e.startTime||"23:59").replace(":","")+"00";out.push("BEGIN:VEVENT",`UID:${e.id}@mctstudios.online`,`DTSTART:${ds}T${start}`,`DTEND:${ds}T${end}`,`SUMMARY:${icsEscape(e.title)}`,`DESCRIPTION:${icsEscape((e.description||"")+"\nCreato da: "+(e.creatorLabel||""))}`,"END:VEVENT")});out.push("END:VCALENDAR");
 const blob=new Blob([out.join("\r\n")],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="MCT-Calendar.ics";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Calendario esportato ✓")};