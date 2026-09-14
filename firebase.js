import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,doc,onSnapshot,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyDvLc4y_yLL-omKQaNnU2UkBMEyVCmbnaM",
 authDomain:"brujas-redes.firebaseapp.com",
 projectId:"brujas-redes",
 storageBucket:"brujas-redes.firebasestorage.app",
 messagingSenderId:"704431450868",
 appId:"1:704431450868:web:939ee0977c967459074ca1"
};
const db=getFirestore(initializeApp(firebaseConfig));
const sharedRef=doc(db,"shared","brujas-redes");
const status=document.getElementById("syncStatus");
let lastCloudJson="",saveTimer=null,applyingCloud=false,cloudReady=false,pendingSave=false;
window.brujasCloudReady=false;
const payload=()=>window.getBrujasCloudData();
const setStatus=(text,error=false)=>{if(!status)return;status.lastChild.textContent=text;status.style.color=error?"#ff9696":"";const dot=status.querySelector("i");if(dot)dot.style.background=error?"#ff5d5d":""};
window.queueBrujasCloudSave=()=>{
 if(applyingCloud)return;
 if(!cloudReady){pendingSave=true;setStatus("Cargando datos…");return}
 clearTimeout(saveTimer);
 saveTimer=setTimeout(async()=>{
  const data=payload(),json=JSON.stringify(data);
  if(json===lastCloudJson)return;
  setStatus("Guardando…");
  try{await setDoc(sharedRef,{...data,updatedAt:serverTimestamp()});lastCloudJson=json;setStatus("Sincronizado")}
  catch(error){console.error("No se pudo sincronizar",error);setStatus("Error de sincronización",true)}
 },650)
};
onSnapshot(sharedRef,snapshot=>{
 if(snapshot.exists()){
  const raw=snapshot.data();
  const data={state:raw.state,formats:raw.formats,palette:raw.palette,savedDesigns:raw.savedDesigns,activeDesign:raw.activeDesign,teams:raw.teams};
  const json=JSON.stringify(data);
  if(json!==lastCloudJson){lastCloudJson=json;applyingCloud=true;window.applyBrujasCloudData(data);applyingCloud=false}
  pendingSave=false;cloudReady=true;window.brujasCloudReady=true;
  window.dispatchEvent(new CustomEvent("brujas-cloud-ready"));
  setStatus("Sincronizado")
 }else{
  lastCloudJson="";cloudReady=true;window.brujasCloudReady=true;
  window.dispatchEvent(new CustomEvent("brujas-cloud-ready"));
  window.queueBrujasCloudSave()
 }
},error=>{console.error("No se pudo leer Firestore",error);pendingSave=false;setStatus("Sin conexión con la nube",true)});
