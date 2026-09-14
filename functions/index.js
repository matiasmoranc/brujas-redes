const {onRequest}=require("firebase-functions/v2/https");
const {onSchedule}=require("firebase-functions/v2/scheduler");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getStorage}=require("firebase-admin/storage");
const crypto=require("crypto");

initializeApp();

const instagramToken=defineSecret("INSTAGRAM_ACCESS_TOKEN");
const publishPassword=defineSecret("PUBLISH_PASSWORD");
const instagramUserId="17841448990797204";
const graphVersion="v26.0";
const allowedOrigin="https://matiasmoranc.github.io";

function safeEqual(left,right){
 const a=Buffer.from(String(left||""));
 const b=Buffer.from(String(right||""));
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForContainer(containerId,token){
 for(let attempt=0;attempt<15;attempt++){
  const response=await fetch(`https://graph.instagram.com/${graphVersion}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error?.message||"No se pudo consultar el estado de la historia");
  if(data.status_code==="FINISHED")return;
  if(data.status_code==="ERROR"||data.status_code==="EXPIRED")throw new Error(data.status||"Instagram no pudo procesar la historia");
  await wait(2000);
 }
 throw new Error("Instagram demoró demasiado en procesar la historia. Intentá nuevamente.");
}

exports.publishInstagramStory=onRequest({
 region:"us-east1",
 cors:[allowedOrigin],
 secrets:[instagramToken,publishPassword],
 timeoutSeconds:120,
 memory:"512MiB",
 maxInstances:2
},async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Método no permitido"});
 if(!safeEqual(req.get("x-publish-password"),publishPassword.value())){
  return res.status(401).json({error:"Contraseña de publicación incorrecta"});
 }
 const match=String(req.body?.imageData||"").match(/^data:image\/png;base64,(.+)$/);
 if(!match)return res.status(400).json({error:"La historia debe enviarse como PNG"});
 const image=Buffer.from(match[1],"base64");
 if(!image.length||image.length>9*1024*1024)return res.status(413).json({error:"La imagen supera el máximo permitido"});
 const bucket=getStorage().bucket();
 const objectName=`instagram-stories/${Date.now()}-${crypto.randomUUID()}.png`;
 const downloadToken=crypto.randomUUID();
 const file=bucket.file(objectName);
 try{
  await file.save(image,{resumable:false,metadata:{contentType:"image/png",cacheControl:"public,max-age=3600",metadata:{firebaseStorageDownloadTokens:downloadToken}}});
  const imageUrl=`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`;
  const token=instagramToken.value();
  const createResponse=await fetch(`https://graph.instagram.com/${graphVersion}/${instagramUserId}/media`,{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({image_url:imageUrl,media_type:"STORIES",access_token:token})
  });
  const created=await createResponse.json();
  if(!createResponse.ok||!created.id)throw new Error(created.error?.message||"Instagram no creó el contenedor");
  await waitForContainer(created.id,token);
  let published=null;
  for(let attempt=0;attempt<5;attempt++){
   const publishResponse=await fetch(`https://graph.instagram.com/${graphVersion}/${instagramUserId}/media_publish`,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({creation_id:created.id,access_token:token})
   });
   published=await publishResponse.json();
   if(publishResponse.ok&&published.id)break;
   const message=published.error?.message||"Instagram no publicó la historia";
   if(!/media id is not available/i.test(message)||attempt===4)throw new Error(message);
   await wait(2000);
  }
  return res.json({ok:true,mediaId:published.id});
 }catch(error){
  console.error(error);
  return res.status(502).json({error:error.message||"No se pudo publicar la historia"});
 }
});

exports.cleanupInstagramStories=onSchedule({region:"us-east1",schedule:"every 24 hours",timeZone:"America/Montevideo"},async()=>{
 const [files]=await getStorage().bucket().getFiles({prefix:"instagram-stories/"});
 const cutoff=Date.now()-24*60*60*1000;
 await Promise.all(files.filter(file=>Date.parse(file.metadata.timeCreated||0)<cutoff).map(file=>file.delete().catch(()=>null)));
});
