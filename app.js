const ADMIN_PASSWORD='redesbrujas123';
let currentRole=null;
function showRoleView(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view))
}
function enterRole(role){
  currentRole=role;
  const isAdmin=role==='admin';
  $$('[data-admin-only]').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  $('#roleBadge').textContent=isAdmin?'Administrador':'Operador';
  $('#roleGate').classList.add('hidden');
  $('#mainApp').classList.remove('role-locked');
  showRoleView(isAdmin?'setup':'live');
  window.scrollTo(0,0)
}
function resetRole(){
  currentRole=null;
  $('#mainApp').classList.add('role-locked');
  $('#roleGate').classList.remove('hidden');
  $('#adminPasswordBox').classList.add('hidden');
  $('#adminPassword').value='';
  $('#adminPasswordError').textContent='';
  window.scrollTo(0,0)
}
queueMicrotask(()=>{
$('#chooseOperator').onclick=()=>enterRole('operator');
$('#chooseAdmin').onclick=()=>{
  $('#adminPasswordBox').classList.remove('hidden');
  $('#adminPasswordError').textContent='';
  setTimeout(()=>$('#adminPassword').focus(),30)
};
function confirmAdminRole(){
  if($('#adminPassword').value!==ADMIN_PASSWORD){
    $('#adminPasswordError').textContent='Contraseña incorrecta.';
    $('#adminPassword').select();
    return
  }
  enterRole('admin')
}
$('#confirmAdmin').onclick=confirmAdminRole;
$('#adminPassword').onkeydown=e=>{if(e.key==='Enter')confirmAdminRole()};
$('#changeRole').onclick=resetRole;
});

let lastTouchEnd=0;
document.addEventListener('touchend',event=>{const now=Date.now();if(now-lastTouchEnd<320)event.preventDefault();lastTouchEnd=now},{passive:false});
document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});
document.addEventListener('dblclick',event=>event.preventDefault(),{passive:false});

const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const fresh={homeName:'Brujas',awayName:'',homeLogo:'',awayLogo:'',players:[],homeScore:0,awayScore:0,phase:'Partido sin iniciar',events:[],timerSeconds:0,timerRunning:false,timerStartedAt:null,matchDay:'SÁBADO',matchTime:'11:00 AM',matchPlace:'COMPLEJO MICROSULES'};
let state={...fresh,...JSON.parse(localStorage.getItem('brujasMatch')||'{}')},goalSide='home',selectedEvent=null;
const actionLocks=new Map();
let publishingStory=false;
function acquireActionLock(name,duration=1200){
 const now=Date.now(),until=actionLocks.get(name)||0;
 if(now<until){toast('Esperá un momento');return false}
 actionLocks.set(name,now+duration);
 setTimeout(()=>{if((actionLocks.get(name)||0)<=Date.now())actionLocks.delete(name)},duration+50);
 return true
}

const formatNames={upcoming:'Próximo partido',start:'Inicio del partido',goal:'Gol',halftime:'Entretiempo',secondhalf:'Segundo tiempo',final:'Final del partido'};
const titleDefaults={upcoming:'PRÓXIMO PARTIDO',start:'INICIO DE PARTIDO',goal:'¡GOOOOOL!',halftime:'ENTRETIEMPO',secondhalf:'SEGUNDO TIEMPO',final:'FINAL DEL PARTIDO'};
const baseElements={
 title:{x:50,y:25,size:52},line:{x:50,y:27.5,size:170},homeLogo:{x:24,y:44,size:270},center:{x:50,y:44,size:90},awayLogo:{x:76,y:44,size:270},
 homeName:{x:24,y:55,size:45},awayName:{x:76,y:55,size:45},detail:{x:50,y:62,size:39},day:{x:34,y:67,size:43},time:{x:68,y:67,size:43},place:{x:50,y:72,size:28}
};
const goalElements={
 title:{x:50,y:24,size:42,font:'Montserrat',color:'#090909',weight:400,spacing:8},
 line:{x:50,y:27,size:170,height:6,color:'#ff5a00'},
 homeLogo:{x:25,y:43,size:235},center:{x:50,y:43,size:68,font:'Impact',color:'#090909',weight:900,spacing:0},awayLogo:{x:75,y:43,size:235},
 homeScore:{x:25,y:55,size:108,font:'Anton',color:'#ff5a00',weight:900,spacing:0},
 awayScore:{x:75,y:55,size:108,font:'Anton',color:'#090909',weight:900,spacing:0},
 minute:{x:50,y:62,size:34,font:'Montserrat',color:'#555555',weight:500,spacing:2},
 scorer:{x:50,y:67,size:46,font:'Montserrat',color:'#090909',weight:900,spacing:1},
 goalText:{x:50,y:74,size:88,font:'Montserrat',color:'#ff5a00',weight:900,spacing:2}
};
const resultFormats=['halftime','secondhalf','final'];
const resultElements=Object.fromEntries(['title','line','homeLogo','center','awayLogo','homeScore','awayScore'].map(k=>[k,goalElements[k]]));

const formatTweaks={
 upcoming:{title:{y:24},line:{y:27},homeLogo:{y:43},center:{y:43},awayLogo:{y:43},homeName:{y:55},awayName:{y:55}},
 start:{},goal:{},halftime:{},secondhalf:{},final:{}
};
function makeDefaults(){const o={};Object.keys(formatNames).forEach(f=>{o[f]={title:titleDefaults[f],elements:JSON.parse(JSON.stringify(baseElements))};Object.entries(formatTweaks[f]||{}).forEach(([k,v])=>Object.assign(o[f].elements[k],v))});o.goal={title:'PRIMER TIEMPO',layoutVersion:2,elements:JSON.parse(JSON.stringify(goalElements))};resultFormats.forEach(f=>o[f]={title:titleDefaults[f],layoutVersion:2,elements:JSON.parse(JSON.stringify(resultElements))});return o}
let formats={...makeDefaults(),...JSON.parse(localStorage.getItem('brujasFormats')||'{}')};
const defaultColor=k=>k==='line'||k==='homeName'?'#ff5a00':'#090909',defaultWeight=k=>k==='title'||k==='place'?400:(k==='homeName'||k==='awayName'||k==='center'?900:700);
function hydrateFormat(f){
 formats[f]=formats[f]||makeDefaults()[f];
 if(f==='goal'&&formats[f].layoutVersion!==2){
  const custom=Object.fromEntries(Object.entries(formats[f].elements||{}).filter(([k])=>k.startsWith('custom')));
  formats[f]={title:'PRIMER TIEMPO',layoutVersion:2,elements:{...JSON.parse(JSON.stringify(goalElements)),...custom}}
 }else if(resultFormats.includes(f)&&formats[f].layoutVersion!==2){
  const custom=Object.fromEntries(Object.entries(formats[f].elements||{}).filter(([k])=>k.startsWith('custom')));
  formats[f]={title:titleDefaults[f],layoutVersion:2,elements:{...JSON.parse(JSON.stringify(resultElements)),...custom}}
 }else{
  const defaults=f==='goal'?goalElements:(resultFormats.includes(f)?resultElements:baseElements);
  formats[f].elements={...JSON.parse(JSON.stringify(defaults)),...formats[f].elements}
 }
 Object.entries(formats[f].elements).forEach(([k,e])=>{e.font=e.font||'Arial';e.color=e.color||defaultColor(k);e.weight=e.weight||defaultWeight(k);e.spacing=e.spacing??0;if(k==='line'||e.type==='line')e.height=e.height||6})
}
Object.keys(formatNames).forEach(f=>hydrateFormat(f));
const fonts=['Arial','Anton','Bebas Neue','Oswald','Barlow Condensed','Montserrat','Roboto Condensed','Poppins','Impact','Georgia','Trebuchet MS','Verdana','Playfair Display','Times New Roman','Courier New','Tahoma'];
let palette=JSON.parse(localStorage.getItem('brujasPalette')||'["#ff5a00","#090909","#ffffff","#1b5e20","#1565c0","#fbc02d"]');
const oldPresets=JSON.parse(localStorage.getItem('brujasSavedPresets')||'{}'),oldActive=JSON.parse(localStorage.getItem('brujasActivePresets')||'{}');
let savedDesigns=JSON.parse(localStorage.getItem('brujasDesigns')||'{}'),activeDesign=localStorage.getItem('brujasActiveDesign')||'';
let teams=JSON.parse(localStorage.getItem('brujasTeams')||'[]'),editingTeamId=null,teamLogoData='';
if(!Object.keys(savedDesigns).length){const names=new Set;Object.values(oldPresets).forEach(group=>Object.keys(group||{}).forEach(n=>names.add(n)));names.forEach(name=>{savedDesigns[name]={formats:{},syncGeometry:{}};Object.keys(formatNames).forEach(f=>savedDesigns[name].formats[f]=JSON.parse(JSON.stringify(oldPresets[f]?.[name]||makeDefaults()[f]))) });activeDesign=Object.values(oldActive).find(n=>savedDesigns[n])||''}
Object.values(savedDesigns).forEach(d=>d.syncGeometry=d.syncGeometry||{});
let editFormat='upcoming',editElement='title',floatingOpen=false;
const applicable={upcoming:['title','line','homeLogo','center','awayLogo','homeName','awayName','day','time','place'],start:['title','line','homeLogo','center','awayLogo','homeName','awayName'],goal:['title','line','homeLogo','center','awayLogo','homeScore','awayScore','minute','scorer','goalText'],halftime:['title','line','homeLogo','center','awayLogo','homeScore','awayScore'],secondhalf:['title','line','homeLogo','center','awayLogo','homeScore','awayScore'],final:['title','line','homeLogo','center','awayLogo','homeScore','awayScore']};
const elementNames={title:'Título',line:'Línea naranja',homeLogo:'Escudo local',center:'VS / marcador',awayLogo:'Escudo visitante',homeName:'Nombre local',awayName:'Nombre visitante',detail:'Detalle',homeScore:'Goles local',awayScore:'Goles visitante',minute:'Minuto',scorer:'Goleador local',goalText:'Texto GOOOL',day:'Día',time:'Hora',place:'Lugar'};
const applicableFor=f=>[...applicable[f],...Object.keys(formats[f].elements).filter(k=>k.startsWith('custom'))];
const save=()=>{localStorage.setItem('brujasMatch',JSON.stringify(state));localStorage.setItem('brujasFormats',JSON.stringify(formats));localStorage.setItem('brujasPalette',JSON.stringify(palette));localStorage.setItem('brujasDesigns',JSON.stringify(savedDesigns));localStorage.setItem('brujasActiveDesign',activeDesign);localStorage.setItem('brujasTeams',JSON.stringify(teams));window.queueBrujasCloudSave?.()};
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sampleEvent=f=>({type:f,title:titleDefaults[f],homeScore:f==='start'||f==='upcoming'?0:2,awayScore:f==='start'||f==='upcoming'?0:1,scorer:f==='goal'?'JUGADOR BRUJAS':'',minute:f==='goal'?'37':'',side:f==='goal'?'home':'',icon:'●'});
function itemStyle(k,c){const e=c.elements[k];return `left:${e.x}%;top:${e.y}%;font-size:${e.size/10.8}cqw;color:${e.color};font-family:'${e.font}',sans-serif;font-weight:${e.weight};letter-spacing:${e.spacing/10.8}cqw`}
const editClass=(k,on)=>on?` editable ${k===editElement?'selected':''}`:'';
function logoHTML(src,k,c,on=false){const e=c.elements[k],sty=`left:${e.x}%;top:${e.y}%;width:${e.size/10.8}cqw;height:${e.size/10.8}cqw`,at=on?` data-element="${k}"`:'';return src?`<img class="story-item${editClass(k,on)}" ${at} style="${sty};object-fit:contain" src="${src}" alt="">`:`<div class="story-item placeholder-logo${editClass(k,on)}" ${at} style="${sty}">ESCUDO</div>`}
function floatingEditor(c){const e=c.elements[editElement],isLine=editElement==='line'||e.type==='line',isLogo=editElement.includes('Logo'),top=Math.min(e.y+9,79),canEditText=editElement==='title'||(editElement.startsWith('custom')&&e.type==='text'),content=editElement==='title'?c.title:e.content;return `<div class="floating-editor" data-floating style="left:50%;top:${top}%"><div class="floating-head"><span>${esc(elementNames[editElement]||(isLine?'Línea agregada':'Texto agregado'))}</span><button type="button" data-float-close>×</button></div><div class="floating-grid">${canEditText?`<div class="floating-control" style="grid-column:1/-1"><label>Texto</label><input data-float-content value="${esc(content||'')}"></div>`:''}<div class="floating-control"><label>Horizontal</label><input data-float-key="x" type="range" min="0" max="100" value="${e.x}"></div><div class="floating-control"><label>Vertical</label><input data-float-key="y" type="range" min="0" max="100" value="${e.y}"></div><div class="floating-control"><label>${isLine?'Ancho':'Tamaño'}</label><input data-float-key="size" type="range" min="8" max="400" value="${e.size}"></div>${isLine?`<div class="floating-control"><label>Alto</label><input data-float-key="height" type="range" min="1" max="80" value="${e.height||6}"></div>`:''}${!isLine&&!isLogo?`<div class="floating-control"><label>Fuente</label><select data-float-font>${fonts.map(f=>`<option value="${f}" ${f===e.font?'selected':''}>${f}</option>`).join('')}</select></div><div class="floating-control"><label>Separar letras</label><input data-float-key="spacing" type="range" min="-2" max="30" value="${e.spacing||0}"></div><label class="floating-check"><input data-float-bold type="checkbox" ${e.weight>=700?'checked':''}> Negrita</label>`:''}<div class="floating-control"><label>Color</label><input data-float-color type="color" value="${e.color}"></div></div>${!editElement.startsWith('custom')?`<label class="floating-check" style="margin-top:7px"><input data-float-sync type="checkbox" ${savedDesigns[activeDesign]?.syncGeometry?.[editElement]?'checked':''}> Igualar posición y tamaño en todas</label>`:''}</div>`}
function scoreForEvent(ev){
 const index=state.events.findIndex(item=>item===ev||(item.time&&ev.time&&item.time===ev.time));
 if(index<0)return {home:ev.homeScore??state.homeScore,away:ev.awayScore??state.awayScore};
 const events=state.events.slice(0,index+1);
 return {home:events.filter(item=>item.type==='goal'&&item.side==='home').length,away:events.filter(item=>item.type==='goal'&&item.side==='away').length}
}
function goalPeriod(ev){
 const index=state.events.findIndex(item=>item===ev||(item.time&&ev.time&&item.time===ev.time));
 const previous=index<0?state.events:state.events.slice(0,index+1);
 return previous.some(item=>item.type==='secondhalf')?'SEGUNDO TIEMPO':'PRIMER TIEMPO'
}
function storyIcon(type){
 const common='viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" style="vertical-align:-.14em;margin-right:.38em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
 return type==='calendar'
  ?`<svg ${common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`
  :`<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`
}
function storyHTML(ev,interactive=false){
 const f=formatNames[ev.type]?ev.type:'start',c=formats[f],eventScore=scoreForEvent(ev),score=`${eventScore.home}–${eventScore.away}`,mid=(f==='start'||f==='upcoming')?'VS':score,isScoreboard=f==='goal'||resultFormats.includes(f);
 const heading=f==='goal'?goalPeriod(ev):c.title;
 let h=`<div class="story-item story-title${editClass('title',interactive)}" data-element="${interactive?'title':''}" style="${itemStyle('title',c)}">${esc(heading)}</div><div class="story-item story-line${editClass('line',interactive)}" data-element="${interactive?'line':''}" style="left:${c.elements.line.x}%;top:${c.elements.line.y}%;width:${c.elements.line.size/10.8}cqw;height:${c.elements.line.height/10.8}cqw;background:${c.elements.line.color}"></div>`;
 h+=logoHTML(state.homeLogo,'homeLogo',c,interactive)+`<div class="story-item story-center${editClass('center',interactive)}" data-element="${interactive?'center':''}" style="${itemStyle('center',c)}">${isScoreboard?'VS':mid}</div>`+logoHTML(state.awayLogo,'awayLogo',c,interactive);
 if(isScoreboard){
  h+=`<div class="story-item story-detail${editClass('homeScore',interactive)}" data-element="${interactive?'homeScore':''}" style="${itemStyle('homeScore',c)}">${eventScore.home}</div><div class="story-item story-detail${editClass('awayScore',interactive)}" data-element="${interactive?'awayScore':''}" style="${itemStyle('awayScore',c)}">${eventScore.away}</div>`;
  if(f==='goal'){
   h+=`<div class="story-item story-detail${editClass('minute',interactive)}" data-element="${interactive?'minute':''}" style="${itemStyle('minute',c)}">MIN ${esc(ev.minute||37)}'</div>`;
   if(ev.side==='home'){
    h+=`<div class="story-item story-detail${editClass('scorer',interactive)}" data-element="${interactive?'scorer':''}" style="${itemStyle('scorer',c)}">${esc(ev.scorer||'JUGADOR BRUJAS')}</div><div class="story-item story-detail${editClass('goalText',interactive)}" data-element="${interactive?'goalText':''}" style="${itemStyle('goalText',c)}">GOOOL!!</div>`
   }
  }
 }else{
  h+=`<div class="story-item story-name story-home-name${editClass('homeName',interactive)}" data-element="${interactive?'homeName':''}" style="${itemStyle('homeName',c)}">${esc(state.homeName||'LOCAL')}</div><div class="story-item story-name${editClass('awayName',interactive)}" data-element="${interactive?'awayName':''}" style="${itemStyle('awayName',c)}">${esc(state.awayName||'VISITANTE')}</div>`
 }
 if(f==='upcoming')h+=`<div class="story-item story-detail${editClass('day',interactive)}" data-element="${interactive?'day':''}" style="${itemStyle('day',c)}">${storyIcon('calendar')}${esc(state.matchDay||'DÍA')}</div><div class="story-item story-detail${editClass('time',interactive)}" data-element="${interactive?'time':''}" style="${itemStyle('time',c)}">${storyIcon('clock')}${esc(state.matchTime||'HORA')}</div><div class="story-item story-detail${editClass('place',interactive)}" data-element="${interactive?'place':''}" style="${itemStyle('place',c)}">${esc(state.matchPlace||'LUGAR')}</div>`;
 Object.keys(c.elements).filter(k=>k.startsWith('custom')).forEach(k=>{const e=c.elements[k],at=interactive?` data-element="${k}"`:'';h+=e.type==='line'?`<div class="story-item story-line${editClass(k,interactive)}" ${at} style="left:${e.x}%;top:${e.y}%;width:${e.size/10.8}cqw;height:${e.height/10.8}cqw;background:${e.color}"></div>`:`<div class="story-item story-detail${editClass(k,interactive)}" ${at} style="${itemStyle(k,c)}">${esc(e.content||'TEXTO')}</div>`});
 if(interactive&&floatingOpen)h+=floatingEditor(c);
 return h
}
function placeholder(){return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="15" fill="#202a23"/><path d="M40 18l18 8v13c0 12-8 20-18 24-10-4-18-12-18-24V26z" fill="none" stroke="#718078" stroke-width="3"/></svg>')}
function render(){
 ['homeName','awayName','matchDay','matchTime','matchPlace'].forEach(id=>$('#'+id).value=state[id]||'');
 $('#homeThumb').src=state.homeLogo||placeholder();$('#awayThumb').src=state.awayLogo||placeholder();
 $('#playerList').innerHTML=state.players.map((p,i)=>`<span class="chip">${esc(p)} <button data-remove="${i}">×</button></span>`).join('')||'<span class="sub">Todavía no agregaste jugadores.</span>';
 $('#setupStory').innerHTML=storyHTML(sampleEvent('upcoming'));
 $('#liveHomeName').textContent=state.homeName||'Local';$('#liveAwayName').textContent=state.awayName||'Visitante';
 $('#liveHomeLogo').innerHTML=state.homeLogo?`<img class="crest" src="${state.homeLogo}">`:'<div class="crest-fallback">LOCAL</div>';$('#liveAwayLogo').innerHTML=state.awayLogo?`<img class="crest" src="${state.awayLogo}">`:'<div class="crest-fallback">VISITA</div>';
 state.phase=phaseFromEvents();$('#homeScore').textContent=state.homeScore;$('#awayScore').textContent=state.awayScore;$('#phase').textContent=state.phase;updateTimerDisplay();
 $('#timeline').innerHTML=state.events.length?state.events.slice().reverse().map((e,ri)=>{const index=state.events.length-1-ri;return `<div class="log"><div class="log-icon">${e.icon}</div><div class="log-info"><strong>${esc(e.title)}</strong><span>${esc(e.subtitle||'Historia generada')}</span></div><div class="log-actions"><button data-story="${index}">Ver</button><button data-undo="${index}">Deshacer</button></div></div>`}).join(''):'<div class="timeline-empty">Acá aparecerán las historias generadas durante el partido.</div>';
 renderPresetChooser();renderDesigner();renderTeams();save()
}
function presetOptions(){const names=Object.keys(savedDesigns);return '<option value="">Seleccioná un diseño</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}
function activateDesign(name){if(name&&savedDesigns[name]){formats=JSON.parse(JSON.stringify(savedDesigns[name].formats));Object.keys(formatNames).forEach(f=>hydrateFormat(f))}activeDesign=name;save();render()}
function renderPresetChooser(){
 $('#presetChooser').innerHTML=presetOptions();$('#presetChooser').value=savedDesigns[activeDesign]?activeDesign:''
}
function teamOptions(selected=''){return '<option value="">Carga manual / sin seleccionar</option>'+teams.map(t=>`<option value="${t.id}" ${t.id===selected?'selected':''}>${esc(t.name)}</option>`).join('')}
function selectedTeamId(side){const found=teams.find(t=>t.name===state[side+'Name']&&t.logo===state[side+'Logo']);return found?.id||''}
function renderTeams(){
 const home=$('#homeTeamSelect'),away=$('#awayTeamSelect');
 if(home){home.innerHTML=teamOptions(selectedTeamId('home'));away.innerHTML=teamOptions(selectedTeamId('away'))}
 const lib=$('#teamLibrary');if(!lib)return;
 lib.innerHTML=teams.length?teams.map(t=>`<article class="team-card"><img src="${t.logo||placeholder()}" alt=""><strong>${esc(t.name)}</strong><div class="team-card-actions"><button class="secondary" data-team-action="home" data-id="${t.id}">Usar local</button><button class="secondary" data-team-action="away" data-id="${t.id}">Usar visita</button><button class="secondary" data-team-action="edit" data-id="${t.id}">Editar</button><button class="danger" data-team-action="delete" data-id="${t.id}">Eliminar</button></div></article>`).join(''):'<div class="empty-teams">Todavía no guardaste equipos.</div>'
}
function useTeam(id,side){const t=teams.find(x=>x.id===id);if(!t)return;state[side+'Name']=t.name;state[side+'Logo']=t.logo;render();toast('Equipo cargado como '+(side==='home'?'local':'visitante'))}
function resetTeamForm(){editingTeamId=null;teamLogoData='';$('#teamName').value='';$('#teamLogo').value='';$('#teamThumb').src=placeholder();$('#teamFormTitle').textContent='Agregar equipo';$('#saveTeam').textContent='Guardar equipo';$('#cancelTeamEdit').classList.add('hidden')}
function switchView(id){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===id));$$('.view').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo({top:0,behavior:'smooth'})}
$$('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
['homeName','awayName','matchDay','matchTime','matchPlace'].forEach(id=>$('#'+id).oninput=e=>{state[id]=e.target.value;render()});
$('#homeTeamSelect').onchange=e=>{if(e.target.value)useTeam(e.target.value,'home')};
$('#awayTeamSelect').onchange=e=>{if(e.target.value)useTeam(e.target.value,'away')};
function compressImage(file,done){const reader=new FileReader;reader.onload=()=>{const img=new Image;img.onload=()=>{const max=420,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);done(canvas.toDataURL('image/webp',.82))};img.onerror=()=>done(reader.result);img.src=reader.result};reader.readAsDataURL(file)}
function loadImage(input,key){const f=input.files[0];if(!f)return;compressImage(f,data=>{state[key]=data;render()})}
$('#homeLogo').onchange=e=>loadImage(e.target,'homeLogo');$('#awayLogo').onchange=e=>loadImage(e.target,'awayLogo');
$('#teamThumb').src=placeholder();
$('#teamLogo').onchange=e=>{const f=e.target.files[0];if(f)compressImage(f,data=>{teamLogoData=data;$('#teamThumb').src=data})};
$('#saveTeam').onclick=()=>{const name=$('#teamName').value.trim();if(!name)return toast('Escribí el nombre del equipo');if(!teamLogoData)return toast('Elegí un escudo');const wasEditing=!!editingTeamId;if(editingTeamId){const t=teams.find(x=>x.id===editingTeamId);if(t){t.name=name;t.logo=teamLogoData}}else teams.push({id:String(Date.now()),name,logo:teamLogoData});resetTeamForm();save();render();toast(wasEditing?'Equipo actualizado':'Equipo guardado')};
$('#cancelTeamEdit').onclick=resetTeamForm;
$('#teamLibrary').onclick=e=>{const b=e.target.closest('[data-team-action]');if(!b)return;const t=teams.find(x=>x.id===b.dataset.id);if(!t)return;if(b.dataset.teamAction==='home'||b.dataset.teamAction==='away'){useTeam(t.id,b.dataset.teamAction);switchView('setup')}else if(b.dataset.teamAction==='edit'){editingTeamId=t.id;teamLogoData=t.logo;$('#teamName').value=t.name;$('#teamThumb').src=t.logo;$('#teamFormTitle').textContent='Editar equipo';$('#saveTeam').textContent='Guardar cambios';$('#cancelTeamEdit').classList.remove('hidden');scrollTo({top:0,behavior:'smooth'})}else if(b.dataset.teamAction==='delete'){appConfirm('¿Eliminar '+t.name+'?',()=>{teams=teams.filter(x=>x.id!==t.id);save();render();toast('Equipo eliminado')})}};

function addPlayer(){const p=$('#playerInput').value.trim();if(!p)return;state.players.push(p);$('#playerInput').value='';render()}
$('#addPlayer').onclick=addPlayer;$('#playerInput').onkeydown=e=>{if(e.key==='Enter')addPlayer()};$('#playerList').onclick=e=>{if(e.target.dataset.remove!==undefined){state.players.splice(+e.target.dataset.remove,1);render()}};
$('#upcomingStory').onclick=()=>{if(!state.awayName.trim()||!state.matchDay.trim()||!state.matchTime.trim()||!state.matchPlace.trim())return toast('Completá rival, día, hora y lugar');openStory(sampleEvent('upcoming'))};
$('#startMatch').onclick=()=>{if(!state.homeName.trim()||!state.awayName.trim())return toast('Ingresá ambos equipos');state.homeScore=0;state.awayScore=0;state.phase='Partido sin iniciar';state.events=[];render();switchView('live');toast('Partido creado')};
function addEvent(type,subtitle,icon){const ev={...sampleEvent(type),title:formats[type].title,subtitle,icon,time:Date.now(),homeScore:state.homeScore,awayScore:state.awayScore};state.events.push(ev);selectedEvent=ev;render();openStory(ev)}
document.querySelectorAll('.event').forEach(b=>b.onclick=()=>{if(!acquireActionLock('event',1200))return;const t=b.dataset.event;if(t==='goalHome'||t==='goalAway')return openGoal(t==='goalHome'?'home':'away');b.disabled=true;setTimeout(()=>b.disabled=false,1200);const phases={start:'En juego',halftime:'Entretiempo',secondhalf:'Segundo tiempo',final:'Finalizado'},subs={start:'Rueda la pelota',halftime:'Resultado parcial',secondhalf:'Vuelve a rodar la pelota',final:'Resultado final'},icons={start:'▶',halftime:'⏸',secondhalf:'▶',final:'🏁'};state.phase=phases[t];addEvent(t,subs[t],icons[t])});
function timerValue(){
 const base=Math.max(0,Number(state.timerSeconds)||0);
 const elapsed=state.timerRunning&&state.timerStartedAt?Math.floor((Date.now()-Number(state.timerStartedAt))/1000):0;
 return Math.min(7200,base+Math.max(0,elapsed))
}
function timerMinuteValue(){return Math.min(120,Math.floor(timerValue()/60))}
function updateTimerDisplay(){
 const total=timerValue(),minutes=Math.floor(total/60),seconds=total%60;
 const display=$('#timerDisplay'),label=$('#timerMinute'),input=$('#timerEdit');
 if(display)display.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
 if(label)label.textContent=`MIN ${minutes}' · TOCÁ EL TIEMPO PARA EDITAR`;
 if(input&&document.activeElement!==input)input.value=minutes;
 if(total>=7200&&state.timerRunning){state.timerSeconds=7200;state.timerRunning=false;state.timerStartedAt=null;save();toast('El cronómetro llegó a 120 minutos')}
}
function closeTimerEditor(){$('#timerEditor').classList.add('hidden')}
$('#timerDisplay').onclick=()=>{$('#timerEdit').value=timerMinuteValue();$('#timerEditor').classList.remove('hidden');setTimeout(()=>{$('#timerEdit').focus();$('#timerEdit').select()},30)};
$('#timerStart').onclick=()=>{if(state.timerRunning)return;state.timerSeconds=timerValue();if(state.timerSeconds>=7200)return toast('El máximo es 120 minutos');state.timerStartedAt=Date.now();state.timerRunning=true;save();updateTimerDisplay()};
$('#timerPause').onclick=()=>{state.timerSeconds=timerValue();state.timerRunning=false;state.timerStartedAt=null;save();updateTimerDisplay()};
$('#timerReset').onclick=()=>appConfirm('¿Reiniciar el cronómetro a 0:00?',()=>{state.timerSeconds=0;state.timerRunning=false;state.timerStartedAt=null;closeTimerEditor();save();updateTimerDisplay();toast('Cronómetro reiniciado')});
$('#timerApply').onclick=()=>{const minute=Number($('#timerEdit').value);if(!Number.isFinite(minute)||minute<0||minute>120)return toast('Ingresá un minuto entre 0 y 120');state.timerSeconds=Math.round(minute*60);if(state.timerRunning)state.timerStartedAt=Date.now();closeTimerEditor();save();updateTimerDisplay();toast(`Cronómetro ajustado al minuto ${minute}'`)};
function stepTimerEdit(delta){const input=$('#timerEdit'),current=Number(input.value)||0;input.value=Math.max(0,Math.min(120,current+delta));input.focus()}
$('#timerMinus').onclick=()=>stepTimerEdit(-1);
$('#timerPlus').onclick=()=>stepTimerEdit(1);
$('#timerEdit').onkeydown=e=>{if(e.key==='Enter')$('#timerApply').click();if(e.key==='Escape')closeTimerEditor()};
setInterval(updateTimerDisplay,250);

function openGoal(side){if(side==='home'&&!state.players.length)return toast('Agregá jugadores al plantel local');goalSide=side;$('#goalTitle').textContent=side==='home'?'Gol de '+state.homeName:'Gol de '+state.awayName;const arr=side==='home'?state.players:['Gol visitante'];$('#scorer').innerHTML='<option value="">Seleccioná un jugador</option>'+arr.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('#scorer').closest('.field').classList.toggle('hidden',side!=='home');$('#minute').value=String(timerMinuteValue());$('#goalModal').classList.add('open')}
$('#confirmGoal').onclick=()=>{const scorer=goalSide==='home'?$('#scorer').value:'Gol visitante',minute=Number($('#minute').value);if(goalSide==='home'&&!scorer)return toast('Seleccioná quién hizo el gol');if(!Number.isFinite(minute)||minute<0||minute>120)return toast('Ingresá un minuto entre 0 y 120');if(!acquireActionLock('confirmGoal',1500))return;const button=$('#confirmGoal');button.disabled=true;if(goalSide==='home')state.homeScore++;else state.awayScore++;state.phase='En juego';const ev={type:'goal',title:formats.goal.title,subtitle:`${scorer} · ${minute}'`,icon:'⚽',scorer,minute,side:goalSide,time:Date.now(),homeScore:state.homeScore,awayScore:state.awayScore};state.events.push(ev);closeModals();render();openStory(ev);setTimeout(()=>button.disabled=false,1500)};
async function openStory(ev){
 selectedEvent=ev;
 const preview=$('#finalStory'),modal=$('#storyModal');
 preview.classList.remove('rendered-story');
 preview.innerHTML=storyHTML(ev);
 modal.classList.add('open');
 try{
  const result=await buildStoryImage(ev);
  if(selectedEvent!==ev||!modal.classList.contains('open')||!result)return;
  preview.innerHTML=`<img src="${result.imageData}" alt="Vista previa exacta de la historia">`;
  preview.classList.add('rendered-story')
 }catch(error){console.error('No se pudo generar la vista previa exacta',error)}
}
function phaseFromEvents(){
 const last=state.events.at(-1);
 if(!last)return 'Partido sin iniciar';
 if(last.type==='final')return 'Finalizado';
 if(last.type==='halftime')return 'Entretiempo';
 return state.events.some(event=>event.type==='secondhalf')?'En juego - Segundo tiempo':'En juego - Primer tiempo'
}
function recalculateMatch(){
 state.homeScore=state.events.filter(e=>e.type==='goal'&&e.side==='home').length;
 state.awayScore=state.events.filter(e=>e.type==='goal'&&e.side==='away').length;
 state.phase=phaseFromEvents()
}
$('#timeline').onclick=e=>{if(e.target.dataset.story!==undefined)openStory(state.events[+e.target.dataset.story]);if(e.target.dataset.undo!==undefined){const index=+e.target.dataset.undo,event=state.events[index];if(!event)return;state.events.splice(index,1);recalculateMatch();render();toast('Evento deshecho')}};
const closeModals=()=>$$('.modal').forEach(m=>m.classList.remove('open'));$$('[data-close]').forEach(b=>b.onclick=closeModals);$$('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
let pendingConfirm=null;
function closeConfirm(){pendingConfirm=null;$('#confirmModal').classList.remove('open')}
function appConfirm(message,onAccept){pendingConfirm=onAccept;$('#confirmMessage').textContent=message;$('#confirmModal').classList.add('open')}
$('#confirmCancel').onclick=closeConfirm;$('#confirmClose').onclick=closeConfirm;
$('#confirmAccept').onclick=()=>{const action=pendingConfirm;closeConfirm();if(action)action()};
function renderDesigner(){
 if(!$('#formatSelect').options.length)$('#formatSelect').innerHTML=Object.entries(formatNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
 $('#formatSelect').value=editFormat;$('#savedPresetSelect').innerHTML=presetOptions();const hasDesign=!!(activeDesign&&savedDesigns[activeDesign]);$('#savedPresetSelect').value=hasDesign?activeDesign:'';$('#designerControls').classList.toggle('hidden',!hasDesign);$('#designerPreview').classList.toggle('hidden',!hasDesign);$('#deletePreset').disabled=!hasDesign;$('#updatePreset').disabled=!hasDesign;if(!hasDesign)return;const els=applicableFor(editFormat);if(!els.includes(editElement))editElement=els[0];
 $('#elementSelect').innerHTML=els.map(k=>`<option value="${k}">${elementNames[k]||((formats[editFormat].elements[k].type==='line'?'Línea':'Texto')+' agregado') }</option>`).join('');$('#elementSelect').value=editElement;
 $('#customTitle').value=formats[editFormat].title;const e=formats[editFormat].elements[editElement];
 if(!$('#fontSelect').options.length)$('#fontSelect').innerHTML=fonts.map(f=>`<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
 const isCustom=editElement.startsWith('custom'),isLine=editElement==='line'||e.type==='line';$('#customContentField').classList.toggle('hidden',!isCustom||isLine);$('#customContent').value=e.content||'';$('#deleteElement').disabled=!isCustom;$('#applyGeometryAll').disabled=isCustom;$('#applyGeometryAll').checked=!isCustom&&!!savedDesigns[activeDesign].syncGeometry[editElement];
 $('#posX').value=e.x;$('#posY').value=e.y;$('#elementSize').value=e.size;$('#posXOut').value=e.x+'%';$('#posYOut').value=e.y+'%';$('#sizeOut').value=e.size+'px';$('#sizeLabel').textContent=isLine?'Ancho de línea':(editElement.includes('Logo')?'Tamaño del escudo':'Tamaño del texto');$('#lineHeightRow').classList.toggle('hidden',!isLine);$('#lineHeight').value=e.height||6;$('#lineHeightOut').value=(e.height||6)+'px';$('#fontSelect').value=e.font;$('#fontSelect').disabled=isLine||editElement.includes('Logo');$('#boldToggle').checked=e.weight>=700;$('#boldToggle').disabled=isLine||editElement.includes('Logo');$('#boldOut').value=e.weight>=700?'Sí':'No';$('#letterSpacing').value=e.spacing||0;$('#letterSpacing').disabled=isLine||editElement.includes('Logo');$('#spacingOut').value=(e.spacing||0)+'px';$('#colorPicker').value=e.color;renderPalette();
 const designer=$('#designerStory');
 designer.classList.add('canvas-editor');
 designer.innerHTML='<img class="editor-canvas-image" alt="Vista previa exacta">'+storyHTML(sampleEvent(editFormat),true);
 queueDesignerCanvas()
}
let designerCanvasTimer=0,designerCanvasRequest=0;
function queueDesignerCanvas(){
 clearTimeout(designerCanvasTimer);
 const request=++designerCanvasRequest,format=editFormat;
 designerCanvasTimer=setTimeout(async()=>{
  try{
   const result=await buildStoryImage(sampleEvent(format));
   const image=$('#designerStory .editor-canvas-image');
   if(request===designerCanvasRequest&&format===editFormat&&image&&result)image.src=result.imageData
  }catch(error){console.error('No se pudo actualizar el canvas del editor',error)}
 },80)
}
$('#formatSelect').onchange=e=>{editFormat=e.target.value;editElement=applicableFor(editFormat)[0];floatingOpen=false;renderDesigner()};$('#elementSelect').onchange=e=>{editElement=e.target.value;floatingOpen=false;renderDesigner()};
$('#designerStory').onclick=e=>{if(e.target.closest('[data-float-close]')){floatingOpen=false;renderDesigner();return}const item=e.target.closest('[data-element]');if(item?.dataset.element){editElement=item.dataset.element;floatingOpen=true;renderDesigner()}};
$('#designerStory').oninput=e=>{const key=e.target.dataset.floatKey,el=formats[editFormat].elements[editElement],node=$('#designerStory').querySelector(`[data-element="${editElement}"]`);if(e.target.matches('[data-float-content]')){if(editElement==='title')formats[editFormat].title=e.target.value;else el.content=e.target.value;node.textContent=e.target.value}if(key){setGeometry(key,+e.target.value);if(key==='x')node.style.left=e.target.value+'%';if(key==='y')node.style.top=e.target.value+'%';if(key==='size'){if(editElement==='line'||el.type==='line')node.style.width=(e.target.value/10.8)+'cqw';else if(editElement.includes('Logo')){node.style.width=(e.target.value/10.8)+'cqw';node.style.height=(e.target.value/10.8)+'cqw'}else node.style.fontSize=(e.target.value/10.8)+'cqw'}if(key==='height')node.style.height=(e.target.value/10.8)+'cqw';if(key==='spacing')node.style.letterSpacing=(e.target.value/10.8)+'cqw'}if(e.target.matches('[data-float-color]')){el.color=e.target.value;node.style.color=e.target.value;if(editElement==='line'||el.type==='line')node.style.background=e.target.value};queueDesignerCanvas()};
$('#designerStory').onchange=e=>{const el=formats[editFormat].elements[editElement];if(e.target.matches('[data-float-font]'))el.font=e.target.value;if(e.target.matches('[data-float-bold]'))el.weight=e.target.checked?900:400;if(e.target.matches('[data-float-sync]')){$('#applyGeometryAll').checked=e.target.checked;$('#applyGeometryAll').dispatchEvent(new Event('change'))}save();renderDesigner()};
$('#presetChooser').onchange=e=>activateDesign(e.target.value);
$('#savedPresetSelect').onchange=e=>{activateDesign(e.target.value);editElement='title';renderDesigner()};
$('#savePreset').onclick=()=>{const name=$('#presetName').value.trim();if(!name)return toast('Escribí un nombre para el diseño');const storeDesign=()=>{savedDesigns[name]={formats:JSON.parse(JSON.stringify(formats)),syncGeometry:{}};activeDesign=name;$('#presetName').value='';save();render();toast('Diseño completo guardado')};if(savedDesigns[name])appConfirm('Ya existe un diseño con ese nombre. ¿Reemplazarlo?',storeDesign);else storeDesign()};
$('#updatePreset').onclick=()=>{if(!activeDesign||!savedDesigns[activeDesign])return toast('Seleccioná un diseño guardado');savedDesigns[activeDesign].formats=JSON.parse(JSON.stringify(formats));save();render();toast('Diseño actualizado')};
$('#deletePreset').onclick=()=>{if(!activeDesign||!savedDesigns[activeDesign])return toast('Seleccioná un diseño guardado');const name=activeDesign;appConfirm(`¿Eliminar el diseño "${name}"?`,()=>{delete savedDesigns[name];activeDesign='';save();render();toast('Diseño eliminado')})};
$('#customTitle').oninput=e=>{formats[editFormat].title=e.target.value;renderDesigner()};
$('#customContent').oninput=e=>{formats[editFormat].elements[editElement].content=e.target.value;renderDesigner()};
function addCustom(type){const key='custom'+Date.now();formats[editFormat].elements[key]={type,x:50,y:type==='line'?78:75,size:type==='line'?220:38,height:6,font:'Arial',weight:700,spacing:0,color:type==='line'?'#ff5a00':'#090909',content:type==='text'?'NUEVO TEXTO':''};editElement=key;save();renderDesigner();toast(type==='line'?'Línea agregada':'Texto agregado')}
$('#addTextElement').onclick=()=>addCustom('text');$('#addLineElement').onclick=()=>addCustom('line');$('#deleteElement').onclick=()=>{if(!editElement.startsWith('custom'))return;const element=editElement,format=editFormat;appConfirm('¿Eliminar este elemento?',()=>{delete formats[format].elements[element];editElement='title';save();renderDesigner();toast('Elemento eliminado')})};
$('#applyGeometryAll').onchange=e=>{if(!activeDesign||editElement.startsWith('custom'))return;savedDesigns[activeDesign].syncGeometry[editElement]=e.target.checked;if(e.target.checked){const source=formats[editFormat].elements[editElement];Object.keys(formatNames).forEach(f=>{const target=formats[f].elements[editElement];if(target)['x','y','size','height'].forEach(k=>{if(source[k]!==undefined)target[k]=source[k]})})}save();renderDesigner()};
function setGeometry(key,value){formats[editFormat].elements[editElement][key]=value;if(savedDesigns[activeDesign]?.syncGeometry?.[editElement]&&!editElement.startsWith('custom'))Object.keys(formatNames).forEach(f=>{if(formats[f].elements[editElement])formats[f].elements[editElement][key]=value})}
['posX','posY','elementSize'].forEach(id=>$('#'+id).oninput=e=>{const key=id==='posX'?'x':id==='posY'?'y':'size';setGeometry(key,+e.target.value);renderDesigner()});
$('#lineHeight').oninput=e=>{setGeometry('height',+e.target.value);renderDesigner()};
function targets(scope,includeLine=false){let out=[];const fs=scope==='all'?Object.keys(formats):[editFormat];fs.forEach(f=>applicableFor(f).forEach(k=>{const e=formats[f].elements[k];if((includeLine||(k!=='line'&&e.type!=='line'))&&!k.includes('Logo'))out.push(e)}));return scope==='element'?[formats[editFormat].elements[editElement]]:out}
$('#fontSelect').onchange=e=>{formats[editFormat].elements[editElement].font=e.target.value;renderDesigner()};
$('#boldToggle').onchange=e=>{formats[editFormat].elements[editElement].weight=e.target.checked?900:400;renderDesigner()};
$('#letterSpacing').oninput=e=>{formats[editFormat].elements[editElement].spacing=+e.target.value;renderDesigner()};
function renderPalette(){$('#palette').innerHTML=palette.map(c=>`<button class="swatch ${c.toLowerCase()===$('#colorPicker').value.toLowerCase()?'active':''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
$('#palette').onclick=e=>{if(e.target.dataset.color){$('#colorPicker').value=e.target.dataset.color;renderPalette()}};
$('#colorPicker').oninput=renderPalette;
$('#addColor').onclick=()=>{const c=$('#colorPicker').value.toLowerCase();if(!palette.includes(c))palette.push(c);save();renderPalette();toast('Color guardado')};
$('#applyColor').onclick=()=>{const scope=$('#colorScope').value,color=$('#colorPicker').value;if(scope==='element')formats[editFormat].elements[editElement].color=color;else targets(scope,true).forEach(x=>x.color=color);save();renderDesigner();toast('Color aplicado')};
$('#saveFormat').onclick=()=>{if(!activeDesign||!savedDesigns[activeDesign])return toast('Seleccioná un diseño guardado');savedDesigns[activeDesign].formats=JSON.parse(JSON.stringify(formats));save();render();toast('Diseño completo guardado')};$('#resetFormat').onclick=()=>{const format=editFormat;appConfirm('¿Restaurar este tipo de historia al diseño original?',()=>{formats[format]=makeDefaults()[format];Object.entries(formats[format].elements).forEach(([k,e])=>{e.font='Arial';e.color=defaultColor(k);e.weight=defaultWeight(k);e.spacing=0;if(k==='line')e.height=6});render();toast('Tipo de historia restaurado')})};
const imgLoad=src=>new Promise(ok=>{if(!src)return ok(null);const i=new Image;i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=src});
function drawContain(ctx,img,x,y,size){const r=Math.min(size/img.width,size/img.height),w=img.width*r,h=img.height*r;ctx.drawImage(img,x-w/2,y-h/2,w,h)}
function drawText(ctx,text,e){ctx.fillStyle=e.color;ctx.font=`${e.weight||700} ${e.size}px "${e.font}"`;ctx.letterSpacing=(e.spacing||0)+'px';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,e.x*10.8,e.y*19.2);ctx.letterSpacing='0px'}
function drawTextWithIcon(ctx,text,e,type){
 ctx.save();ctx.fillStyle=e.color;ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(2,e.size*.055);ctx.font=`${e.weight||700} ${e.size}px "${e.font}"`;ctx.letterSpacing=(e.spacing||0)+'px';ctx.textBaseline='middle';
 const icon=e.size*.72,gap=e.size*.3,textWidth=ctx.measureText(text).width,total=icon+gap+textWidth,left=e.x*10.8-total/2,cy=e.y*19.2;
 ctx.beginPath();
 if(type==='calendar'){
  ctx.roundRect(left,cy-icon*.45,icon,icon*.9,icon*.1);ctx.moveTo(left,cy-icon*.12);ctx.lineTo(left+icon,cy-icon*.12);ctx.moveTo(left+icon*.28,cy-icon*.58);ctx.lineTo(left+icon*.28,cy-icon*.34);ctx.moveTo(left+icon*.72,cy-icon*.58);ctx.lineTo(left+icon*.72,cy-icon*.34)
 }else{
  ctx.arc(left+icon/2,cy,icon*.45,0,Math.PI*2);ctx.moveTo(left+icon/2,cy-icon*.23);ctx.lineTo(left+icon/2,cy);ctx.lineTo(left+icon*.7,cy+icon*.12)
 }
 ctx.stroke();ctx.textAlign='left';ctx.fillText(text,left+icon+gap,cy);ctx.restore()
}
async function buildStoryImage(event=selectedEvent){
 if(!event)return null;
 const ev={...event},f=ev.type,cfg=JSON.parse(JSON.stringify(formats[f]));
 const storyState={homeName:storyState.homeName,awayName:storyState.awayName,homeLogo:state.homeLogo,awayLogo:state.awayLogo,matchDay:storyState.matchDay,matchTime:storyState.matchTime,matchPlace:storyState.matchPlace};
 const eventScore=scoreForEvent(event),periodTitle=goalPeriod(event);
 const c=document.createElement('canvas');c.width=1080;c.height=1920;
 const x=c.getContext('2d');
 const [base,hi,ai]=await Promise.all([imgLoad('assets/story-base.jpg'),imgLoad(storyState.homeLogo),imgLoad(storyState.awayLogo)]);
 x.clearRect(0,0,c.width,c.height);
 if(base)x.drawImage(base,0,0,1080,1920);else{x.fillStyle='#fff';x.fillRect(0,0,1080,1920)}
 await Promise.all(Object.values(cfg.elements).filter(e=>e.font).map(e=>document.fonts.load(`${e.weight||700} ${e.size}px "${e.font}"`).catch(()=>null)));
 drawText(x,(f==='goal'?periodTitle:cfg.title).toUpperCase(),cfg.elements.title);
 const ln=cfg.elements.line;x.fillStyle=ln.color;x.fillRect(ln.x*10.8-ln.size/2,ln.y*19.2-ln.height/2,ln.size,ln.height);
 if(hi)drawContain(x,hi,cfg.elements.homeLogo.x*10.8,cfg.elements.homeLogo.y*19.2,cfg.elements.homeLogo.size);
 if(ai)drawContain(x,ai,cfg.elements.awayLogo.x*10.8,cfg.elements.awayLogo.y*19.2,cfg.elements.awayLogo.size);
 const isScoreboard=f==='goal'||resultFormats.includes(f);
 if(isScoreboard){
  drawText(x,'VS',cfg.elements.center);
  drawText(x,String(eventScore.home),cfg.elements.homeScore);
  drawText(x,String(eventScore.away),cfg.elements.awayScore);
  if(f==='goal'){
   drawText(x,`MIN ${ev.minute}'`,cfg.elements.minute);
   if(ev.side==='home'){
    drawText(x,(ev.scorer||'JUGADOR BRUJAS').toUpperCase(),cfg.elements.scorer);
    drawText(x,'GOOOL!!',cfg.elements.goalText)
   }
  }
 }else{
  drawText(x,(f==='start'||f==='upcoming')?'VS':`${ev.homeScore}–${ev.awayScore}`,cfg.elements.center);
  drawText(x,(storyState.homeName||'LOCAL').toUpperCase(),cfg.elements.homeName);
  drawText(x,(storyState.awayName||'VISITANTE').toUpperCase(),cfg.elements.awayName);
  if(f==='upcoming'){
   drawTextWithIcon(x,(storyState.matchDay||'DÍA').toUpperCase(),cfg.elements.day,'calendar');
   drawTextWithIcon(x,(storyState.matchTime||'HORA').toUpperCase(),cfg.elements.time,'clock');
   drawText(x,(storyState.matchPlace||'LUGAR').toUpperCase(),cfg.elements.place)
  }
 }
 Object.keys(cfg.elements).filter(k=>k.startsWith('custom')).forEach(k=>{
  const e=cfg.elements[k];
  if(e.type==='line'){x.fillStyle=e.color;x.fillRect(e.x*10.8-e.size/2,e.y*19.2-e.height/2,e.size,e.height)}
  else drawText(x,(e.content||'TEXTO').toUpperCase(),e)
 });
 return {imageData:c.toDataURL('image/png'),type:f}
}
function pngDataToBlob(dataUrl){
 const binary=atob(dataUrl.split(',')[1]),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:'image/png'})
}
$('#downloadStory').onclick=async()=>{
 const button=$('#downloadStory'),original=button.textContent;
 button.disabled=true;button.textContent='Preparando…';
 try{
  const visibleImage=$('#finalStory img')?.src;
  const result=visibleImage?{imageData:visibleImage,type:selectedEvent?.type||'historia'}:await buildStoryImage();
  if(!result)return;
  const filename=`historia-${result.type}-${Date.now()}.png`,blob=pngDataToBlob(result.imageData),file=new File([blob],filename,{type:'image/png'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:'Historia de Brujas FPC'});toast('Imagen lista para guardar')}
   catch(error){if(error.name!=='AbortError')throw error}
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=filename;a.target='_blank';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Historia descargada')
  }
 }catch(error){console.error('No se pudo guardar la historia',error);toast('No se pudo guardar la imagen')}
 finally{button.disabled=false;button.textContent=original}
};
const publishEndpoint='https://us-east1-brujas-redes.cloudfunctions.net/publishInstagramStory';
$('#publishStory').onclick=()=>{
 if(!selectedEvent)return;
 $('#publishPassword').value=sessionStorage.getItem('brujasPublishPassword')||'';
 $('#storyModal').classList.remove('open');
 $('#publishModal').classList.add('open');
 setTimeout(()=>$('#publishPassword').focus(),50)
};
$('#publishPassword').onkeydown=e=>{if(e.key==='Enter')$('#confirmPublish').click()};
$('#confirmPublish').onclick=async()=>{
 const password=$('#publishPassword').value;
 if(!password)return toast('Ingresá la contraseña de publicación');
 if(publishingStory)return toast('La historia ya se está publicando');
 publishingStory=true;
 const button=$('#confirmPublish'),original=button.textContent;
 button.disabled=true;button.textContent='Publicando…';
 try{
  const result=await buildStoryImage();
  if(!result)throw new Error('No hay una historia seleccionada');
  const response=await fetch(publishEndpoint,{method:'POST',headers:{'Content-Type':'application/json','x-publish-password':password},body:JSON.stringify({imageData:result.imageData})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo publicar la historia');
  sessionStorage.setItem('brujasPublishPassword',password);
  closeModals();toast('Historia publicada en Instagram')
 }catch(error){
  console.error('No se pudo publicar en Instagram',error);
  toast(error.message||'No se pudo publicar en Instagram')
 }finally{publishingStory=false;button.disabled=false;button.textContent=original}
};
window.getBrujasCloudData=()=>({state,formats,palette,savedDesigns,activeDesign,teams});
window.applyBrujasCloudData=data=>{
 state={...fresh,...(data.state||{})};
 formats=data.formats||makeDefaults();
 Object.keys(formatNames).forEach(f=>hydrateFormat(f));
 palette=Array.isArray(data.palette)?data.palette:palette;
 savedDesigns=data.savedDesigns||{};
 activeDesign=data.activeDesign||'';
 teams=Array.isArray(data.teams)?data.teams:teams;
 render()
};
render();
