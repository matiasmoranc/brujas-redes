import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,doc,getDoc,onSnapshot,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyDvLc4y_yLL-omKQaNnU2UkBMEyVCmbnaM",
 authDomain:"brujas-redes.firebaseapp.com",
 projectId:"brujas-redes",
 storageBucket:"brujas-redes.firebasestorage.app",
 messagingSenderId:"704431450868",
 appId:"1:704431450868:web:939ee0977c967459074ca1"
};
const db=getFirestore(initializeApp(firebaseConfig));
const legacyRef=doc(db,"shared","brujas-redes");
const sectionNames=["config","live","designs","teams"];
const sectionRefs=Object.fromEntries(sectionNames.map(name=>[name,doc(db,"shared",`brujas-redes-${name}`)]));
const status=document.getElementById("syncStatus");
let lastCloudJson={},latestLocalJson={},localRevision={},dirtySections=new Set(),savingSections=new Set(),saveTimer=null,applyingCloud=false,cloudReady=false;
window.brujasCloudReady=false;
const setStatus=(text,error=false)=>{if(!status)return;status.lastChild.textContent=text;status.style.color=error?"#ff9696":"";const dot=status.querySelector("i");if(dot)dot.style.background=error?"#ff5d5d":""};
const clean=data=>{const value={...(data||{})};delete value.updatedAt;return value};
const legacySections=data=>{
 const state=data?.state||{};
 return {
  config:{homeName:state.homeName??"Brujas",awayName:state.awayName??"",homeLogo:state.homeLogo??"",awayLogo:state.awayLogo??"",players:state.players||[],matchDay:state.matchDay??"SÁBADO",matchTime:state.matchTime??"11:00 AM",matchPlace:state.matchPlace??"COMPLEJO MICROSULES"},
  live:{homeScore:state.homeScore||0,awayScore:state.awayScore||0,phase:state.phase||"Partido sin iniciar",events:state.events||[],timerSeconds:state.timerSeconds||0,timerRunning:!!state.timerRunning,timerStartedAt:state.timerStartedAt??null},
  designs:{formats:data?.formats||{},palette:data?.palette||[],savedDesigns:data?.savedDesigns||{},activeDesign:data?.activeDesign||""},
  teams:{teams:Array.isArray(data?.teams)?data.teams:[]}
 }
};
window.queueBrujasCloudSave=()=>{
 if(applyingCloud)return;
 if(!cloudReady){setStatus("Cargando datos…");return}
 const current=window.getBrujasCloudSections();
 sectionNames.forEach(name=>{
  const json=JSON.stringify(current[name]);
  if(json!==latestLocalJson[name]){
   latestLocalJson[name]=json;
   localRevision[name]=(localRevision[name]||0)+1;
   dirtySections.add(name)
  }
 });
 clearTimeout(saveTimer);
 saveTimer=setTimeout(flushCloudSave,250)
};
async function flushCloudSave(){
 saveTimer=null;
 const sections=window.getBrujasCloudSections();
 const pending=sectionNames.filter(name=>dirtySections.has(name)&&!savingSections.has(name));
 if(!pending.length)return;
 setStatus("Guardando…");
 try{
  await Promise.all(pending.map(async name=>{
   const data=sections[name],json=JSON.stringify(data),revision=localRevision[name]||0;
   savingSections.add(name);
   try{
    await setDoc(sectionRefs[name],{...data,updatedAt:serverTimestamp()});
    lastCloudJson[name]=json;
    if((localRevision[name]||0)===revision&&latestLocalJson[name]===json)dirtySections.delete(name)
   }finally{savingSections.delete(name)}
  }));
  if(dirtySections.size){clearTimeout(saveTimer);saveTimer=setTimeout(flushCloudSave,100)}
  else setStatus("Sincronizado")
 }catch(error){
  console.error("No se pudo sincronizar",error);
  setStatus("Error de sincronización",true);
  clearTimeout(saveTimer);saveTimer=setTimeout(flushCloudSave,2000)
 }
}
async function initializeCloud(){
 setStatus("Cargando datos…");
 const [legacySnapshot,...snapshots]=await Promise.all([getDoc(legacyRef),...sectionNames.map(name=>getDoc(sectionRefs[name]))]);
 const local=window.getBrujasCloudSections();
 const legacy=legacySections(legacySnapshot.exists()?legacySnapshot.data():window.getBrujasCloudData());
 const useLocal={
  config:!!(local.config.homeLogo||local.config.awayLogo||local.config.awayName||local.config.players?.length),
  live:!!(local.live.homeScore||local.live.awayScore||local.live.events?.length||local.live.timerSeconds||local.live.phase!=='Partido sin iniciar'),
  designs:!!(local.designs.activeDesign||Object.keys(local.designs.savedDesigns||{}).length),
  teams:!!local.teams.teams?.length
 };
 const fallback=Object.fromEntries(sectionNames.map(name=>[name,useLocal[name]?local[name]:legacy[name]]));
 for(let index=0;index<sectionNames.length;index++){
  const name=sectionNames[index],snapshot=snapshots[index];
  const data=snapshot.exists()?clean(snapshot.data()):fallback[name];
  if(!snapshot.exists())await setDoc(sectionRefs[name],{...data,updatedAt:serverTimestamp()});
  lastCloudJson[name]=JSON.stringify(data);
  latestLocalJson[name]=lastCloudJson[name];
  localRevision[name]=0;
  applyingCloud=true;window.applyBrujasCloudSection(name,data);applyingCloud=false
 }
 cloudReady=true;window.brujasCloudReady=true;
 window.dispatchEvent(new CustomEvent("brujas-cloud-ready"));
 setStatus("Sincronizado");
 sectionNames.forEach(name=>onSnapshot(sectionRefs[name],snapshot=>{
  if(!snapshot.exists())return;
  const data=clean(snapshot.data()),json=JSON.stringify(data);
  if(json===lastCloudJson[name])return;
  if(dirtySections.has(name)||savingSections.has(name))return;
  lastCloudJson[name]=json;latestLocalJson[name]=json;
  applyingCloud=true;window.applyBrujasCloudSection(name,data);applyingCloud=false;
  setStatus("Sincronizado")
 },error=>{console.error("No se pudo leer "+name,error);setStatus("Sin conexión con la nube",true)}))
}
initializeCloud().catch(error=>{console.error("No se pudo iniciar Firebase",error);setStatus("Sin conexión con la nube",true)});
