/* PHIK features, batch 2. Loaded after the main script in index.html. */
function fmt(n){n=Number(n)||0;if(n>=1e6)return (n/1e6).toFixed(1).replace('.0','')+'M';if(n>=1e3)return (n/1e3).toFixed(1).replace('.0','')+'K';return String(n)}
var PREF={banner:true,sound:true,os:false};
try{Object.assign(PREF,JSON.parse(localStorage.getItem('phik_prefs')||'{}'))}catch(e){}
function savePrefs(){try{localStorage.setItem('phik_prefs',JSON.stringify(PREF))}catch(e){}}
var profCache={},viewed={},chatCtx=null,shown={},spaceCh=null,alertFilter='all',ordTab='mine';
async function profileOf(id){if(profCache[id])return profCache[id];var r=await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified').eq('id',id).maybeSingle();profCache[id]=r.data||{};return profCache[id]}

/* ======================= NOTIFICATIONS ======================= */
var NT={like:['👍','liked your post'],comment:['💬','commented on your post'],reply:['↩️','replied to your comment'],follow:['➕','started following you'],mention:['@','mentioned you'],order:['🛍️','']};
function dayGroup(t){var d=(Date.now()-new Date(t))/864e5;return d<1?'Today':(d<7?'This week':'Earlier')}
async function viewAlerts(){
  var f=alertFilter;
  $('#view').innerHTML=sub('Alerts')+`<div class="chips2"><button class="${f==='all'?'on':''}" onclick="alertFilter='all';viewAlerts()">All</button><button class="${f==='mentions'?'on':''}" onclick="alertFilter='mentions';viewAlerts()">Mentions</button><button class="${f==='orders'?'on':''}" onclick="alertFilter='orders';viewAlerts()">Orders</button><span style="flex:1"></span><button onclick="markAllRead()">Mark all read</button></div><div id="alist"><div class="empty">Loading…</div></div>`;
  var q=sb.from('notifications').select('id,type,post_id,snippet,is_read,created_at,actor_id,profiles!actor_id(username,display_name,avatar_url),posts(id,kind,title,caption,cover_url)').eq('user_id',me.id).order('created_at',{ascending:false}).limit(80);
  if(f==='mentions')q=q.in('type',['mention','reply']);
  if(f==='orders')q=q.eq('type','order');
  var r=await q,box=$('#alist');if(!box)return;
  if(r.error){box.innerHTML='<div class="empty">Could not load alerts.</div>';return}
  var d=(r.data||[]).filter(function(n){return !blockMap[n.actor_id]});
  if(!d.length){box.innerHTML='<div class="empty">No alerts yet.<br>Likes, comments and new followers show up here. 🔔</div>';return}
  var items=[],byPost={};
  d.forEach(function(n){
    if(n.type==='like'&&n.post_id&&byPost[n.post_id]){var g=byPost[n.post_id];g.actors.push(n.profiles||{});g.unread=g.unread||!n.is_read;return}
    var it={type:n.type,post_id:n.post_id,actor_id:n.actor_id,post:n.posts,snippet:n.snippet,unread:!n.is_read,created_at:n.created_at,actors:[n.profiles||{}]};
    items.push(it);if(n.type==='like'&&n.post_id)byPost[n.post_id]=it;
  });
  var html='',last='';
  items.forEach(function(it){
    var g=dayGroup(it.created_at);if(g!==last){html+='<div class="sub">'+g+'</div>';last=g}
    var a=it.actors,nm=function(p){return esc(p.display_name||p.username||'Someone')},who=nm(a[0]);
    if(a.length===2)who+=' and '+nm(a[1]);else if(a.length>2)who+=', '+nm(a[1])+' and '+(a.length-2)+' others';
    var t=NT[it.type]||['🔔',''],txt=it.type==='order'?esc(it.snippet||'Order update'):who+' '+t[1];
    var avs='<div class="nav2">'+a.slice(0,3).map(function(p){return avHtml(p,28)}).join('')+'</div>';
    var sn=(it.type==='comment'||it.type==='reply'||it.type==='mention')&&it.snippet?'<small>“'+esc(it.snippet)+'”</small>':'';
    var po=it.post,th=po?(okUrl(po.cover_url)?`<img class="nth" src="${esc(po.cover_url)}" alt="">`:`<div class="nth">${esc((po.title||po.caption||'').slice(0,18))}</div>`):'';
    html+=`<button class="nrow${it.unread?' un':''}" onclick="notifGo('${it.type}','${it.post_id||''}','${it.actor_id}')"><span class="nic">${t[0]}</span><div class="t">${it.type==='order'?'':avs}<div><b>${txt}</b> <span class="mute">· ${ago(it.created_at)}</span></div>${sn}</div>${th}</button>`;
  });
  box.innerHTML=html;
  if(unreadN){await sb.from('notifications').update({is_read:true}).eq('user_id',me.id).eq('is_read',false);unreadN=0;paint()}
}
function notifGo(type,pid,aid){if(type==='follow')open('user',aid);else if(type==='order')open('orders');else if(pid)open('post',pid);else open('user',aid)}
async function markAllRead(){await sb.from('notifications').update({is_read:true}).eq('user_id',me.id).eq('is_read',false);unreadN=0;paint();viewAlerts()}
function beep(){try{var C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.05;o.connect(g);g.connect(c.destination);o.start();setTimeout(function(){o.stop();c.close()},130)}catch(e){}}
function showBanner(icon,title,text,go){
  var b=$('#nbanner');if(!b){b=document.createElement('div');b.id='nbanner';document.body.appendChild(b)}
  b.innerHTML=`<span class="nic">${icon}</span><div style="min-width:0"><b>${esc(title)}</b><div class="bt">${esc(text)}</div></div>`;
  b.onclick=function(){b.classList.remove('show');go()};
  requestAnimationFrame(function(){b.classList.add('show')});clearTimeout(window._nb);window._nb=setTimeout(function(){b.classList.remove('show')},4500);
}
function notify(icon,title,text,go,tag){
  if(document.hidden){
    if(PREF.os&&window.Notification&&Notification.permission==='granted'){
      var o={body:text,icon:'icon-192.png',badge:'icon-192.png',tag:tag};
      if(navigator.serviceWorker&&navigator.serviceWorker.ready)navigator.serviceWorker.ready.then(function(reg){reg.showNotification(title,o)}).catch(function(){});
      else try{new Notification(title,o)}catch(e){}
    }
    return;
  }
  if(PREF.banner)showBanner(icon,title,text,go);
  if(PREF.sound)beep();
  if(navigator.vibrate)navigator.vibrate(30);
}
async function bannerNotif(n){
  var a=await profileOf(n.actor_id),nm=a.display_name||a.username||'Someone',t=NT[n.type]||['🔔',''];
  var txt=n.type==='order'?(n.snippet||'Order update'):nm+' '+t[1]+(n.snippet?': '+n.snippet:'');
  notify(t[0],'PHIK',txt,function(){notifGo(n.type,n.post_id||'',n.actor_id)},'n'+n.id);
}
async function bannerMsg(m){
  var top=stack[stack.length-1];if(top[0]==='chat'&&top[1]===m.sender_id&&!document.hidden)return;
  if(blockMap[m.sender_id]==='block')return;
  var a=await profileOf(m.sender_id),nm=a.display_name||a.username||'Someone';
  notify('💌',nm,m.body||(m.media_kind==='audio'?'🎤 Voice note':'📷 Photo'),function(){open('chat',m.sender_id)},'m'+m.id);
}
function subscribe(){
  sb.channel('rt-'+me.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'recipient_id=eq.'+me.id},function(p){onMsg(p.new);bannerMsg(p.new)})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:'sender_id=eq.'+me.id},function(p){tickSeen(p.new)})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+me.id},function(p){unreadN++;paint();if(cv()==='alerts')viewAlerts();else bannerNotif(p.new)})
   .subscribe();
}
var _vs=viewSettings;
viewSettings=function(){
  _vs();var p=document.querySelector('#view .pad');if(!p)return;
  var sw=function(k,l){return `<button class="mi" onclick="togglePref('${k}')"><em>${{banner:'🔔',sound:'🔊',os:'📲'}[k]}</em><span style="flex:1">${l}</span><i class="swt${PREF[k]?' on':''}"></i></button>`};
  p.insertAdjacentHTML('afterbegin','<h3 class="sh">Notifications</h3>'+sw('banner','Pop-up banners')+sw('sound','Sound and vibration')+sw('os','Phone alerts when PHIK is in the background'));
};
function togglePref(k){
  if(k==='os'&&!PREF.os){
    if(!window.Notification){toast('This browser does not support phone alerts');return}
    Notification.requestPermission().then(function(r){PREF.os=(r==='granted');savePrefs();if(!PREF.os)toast('Alerts are blocked in your browser settings');viewSettings()});return;
  }
  PREF[k]=!PREF[k];savePrefs();viewSettings();
}

/* ======================= VIEWS, UPLOADS ======================= */
function countView(id){if(!me||!id||viewed[id])return;viewed[id]=1;sb.from('post_views').upsert({post_id:id,user_id:me.id},{ignoreDuplicates:true,onConflict:'post_id,user_id'}).then(function(){})}
var _pp=playPost;playPost=function(id){_pp(id);countView(id)};
async function upload(file){
  var ses=(await sb.auth.getSession()).data.session;if(!ses)throw new Error('Please log in again');
  var ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').slice(0,5).toLowerCase()||'bin';
  var path=me.id+'/'+Date.now()+'_'+Math.floor(Math.random()*1e5)+'.'+ext;
  return new Promise(function(res,rej){
    var x=new XMLHttpRequest();x.open('POST',SB_URL+'/storage/v1/object/media/'+path);
    x.setRequestHeader('Authorization','Bearer '+ses.access_token);x.setRequestHeader('apikey',SB_KEY);
    x.setRequestHeader('Content-Type',file.type||'application/octet-stream');x.setRequestHeader('x-upsert','false');
    x.upload.onprogress=function(e){if(e.lengthComputable&&window.onUp)window.onUp(Math.round(e.loaded/e.total*100))};
    x.onload=function(){if(x.status>=200&&x.status<300)res(SB_URL+'/storage/v1/object/public/media/'+path);else{var m='Upload failed';try{m=JSON.parse(x.responseText).message||m}catch(e){}rej(new Error(m))}};
    x.onerror=function(){rej(new Error('Network error while uploading'))};
    x.send(file);
  });
}
function makeThumb(file){
  return new Promise(function(res){
    var v=document.createElement('video'),u=URL.createObjectURL(file),done=function(b){URL.revokeObjectURL(u);res(b)};
    v.preload='metadata';v.muted=true;v.playsInline=true;v.src=u;
    v.onloadeddata=function(){v.currentTime=Math.min(1,(v.duration||2)/2)};
    v.onseeked=function(){try{var c=document.createElement('canvas'),w=Math.min(640,v.videoWidth||640);c.width=w;c.height=Math.round(w*(v.videoHeight||360)/(v.videoWidth||640));c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(function(b){done(b)},'image/jpeg',.8)}catch(e){done(null)}};
    v.onerror=function(){done(null)};setTimeout(function(){done(null)},8000);
  });
}
function kindChange(){
  var k=$('#dk').value,mm=(k==='music'||k==='movie'),pr=(k==='product');
  ['#dp','#ds','#dxl','#dx'].forEach(function(x){$(x).classList.toggle('hide',!pr)});
  $('#dt').classList.toggle('hide',!(mm||pr));
  ['#dg','#dcl','#dcf','#drl'].forEach(function(x){$(x).classList.toggle('hide',!mm)});
  if(mm)$('#dg').innerHTML=(k==='movie'?MG:MUG).map(function(x){return `<option>${esc(x)}</option>`}).join('');
  $('#dc').placeholder=k==='movie'?'Describe your movie':(k==='music'?'About this track (optional)':(pr?'Describe your product':'What is new?'));
}
async function dropGo(){
  var kind=$('#dk').value,cap=$('#dc').value.trim(),file=$('#df').files[0],cover=$('#dcf').files[0],price=$('#dp').value,title=$('#dt').value.trim(),stock=$('#ds').value,extras=Array.from($('#dx').files||[]).slice(0,4),mm=(kind==='music'||kind==='movie');
  var need={photo:'image/',video:'video/',reel:'video/',music:'audio/',movie:'video/'}[kind];
  if(kind==='text'&&!cap){toast('Write something first');return}
  if(need&&!file){toast('Choose a file to drop');return}
  if(file&&need&&file.type.indexOf(need)!==0){toast('That file does not match the type you chose');return}
  if((mm||kind==='product')&&!title){toast('Add a title');return}
  if(kind==='product'&&!file){toast('Add a main photo for your product');return}
  if(kind==='movie'&&!cover){toast('Add a cover image for your movie');return}
  if(cover&&cover.type.indexOf('image/')!==0){toast('The cover must be an image');return}
  if(extras.some(function(f){return f.type.indexOf('image/')!==0})){toast('Extra product photos must be images');return}
  if(mm&&!$('#dr').checked){toast('Please confirm you have the rights to share this');return}
  if(kind==='product'&&(price===''||Number(price)<0)){toast('Enter a price');return}
  if(file&&file.size>50*1024*1024){toast('Files can be up to 50 MB for now');return}
  var btn=$('#dbtn');btn.disabled=true;btn.textContent='Dropping…';window.onUp=function(p){btn.textContent='Dropping… '+p+'%'};
  try{
    var url=file?await upload(file):null,curl=null,ex=[];
    if(mm&&cover)curl=await upload(cover);
    else if((kind==='video'||kind==='reel')&&file){var tb=await makeThumb(file);if(tb)curl=await upload(new File([tb],'thumb.jpg',{type:'image/jpeg'}))}
    for(var i=0;i<extras.length;i++)ex.push(await upload(extras[i]));
    var row={author_id:me.id,kind:kind,caption:cap||null,media_url:url};
    if(title&&(mm||kind==='product'))row.title=title;
    if(mm)row.genre=$('#dg').value;
    if(curl)row.cover_url=curl;
    if(kind==='product'){row.price_cents=Math.round(Number(price)*100);row.stock=stock===''?null:Math.max(0,parseInt(stock,10)||0);row.extra_media=ex}
    var ins=await sb.from('posts').insert(row);if(ins.error)throw ins.error;
    ['#dc','#df','#dp','#dt','#dcf','#ds','#dx'].forEach(function(x){$(x).value=''});$('#dr').checked=false;closeSheets();toast('Dropped! 🎉');
    if(cv()==='home')loadFeed();else if(cv()==='user')viewUser(stack[stack.length-1][1]);else setTab('home');
  }catch(e){toast(e.message||'Could not drop. Try again.')}
  window.onUp=null;btn.disabled=false;btn.textContent='Drop it';
}

/* ======================= FULL-SCREEN REELS ======================= */
var reelSound=false,reelObs=null;
var _lf=loadFeed;
loadFeed=function(more){if(homeTab==='reel'&&more!==true){reelsInit();return}return _lf(more)};
async function reelsInit(){
  ptarget='#plist';listMode='reels';var box=$('#plist');if(!box)return;
  var mo=$('#more');if(mo)mo.innerHTML='';
  box.innerHTML='<div class="empty">Loading…</div>';
  var r=await sb.from('feed').select('*').in('kind',['reel','video']).order('created_at',{ascending:false}).limit(40);
  if(!$('#plist')||homeTab!=='reel')return;
  if(r.error){box.innerHTML='<div class="empty">Could not load reels.</div>';return}
  posts=(r.data||[]).filter(function(p){return !blockMap[p.author_id]&&okUrl(p.media_url)});
  posts.sort(function(a,b){return score(b)-score(a)});
  renderReels();
}
function rsideHtml(p,i){
  var v=myLikes[p.id],sv=saved.has(p.id),mine=p.author_id===me.id,fol=follows.has(p.author_id);
  return `<span onclick="openUser('${p.author_id}')">${avHtml(p,44)}</span>${mine||fol?'':`<button class="rb plus" onclick="toggleFollow('${p.author_id}')">+</button>`}
  <button class="rb${v===1?' on':''}" onclick="like(${i},1)">${ic('up',v===1)}<small>${fmt(p.like_count)}</small></button>
  <button class="rb${v===-1?' on':''}" onclick="like(${i},-1)">${ic('down',v===-1)}</button>
  <button class="rb" onclick="openC(${i})">${ic('chat')}<small>${fmt(p.comment_count)}</small></button>
  <button class="rb${sv?' on':''}" onclick="toggleSave(${i})">${ic('mark',sv)}</button>
  <button class="rb" onclick="sharePost(${i})">${ic('share')}</button>
  <button class="rb" onclick="openMore(${i})">${ic('more')}</button>`;
}
function renderReels(){
  var box=$('#plist');if(!box)return;
  if(!posts.length){box.innerHTML='<div class="empty">No reels yet.<br>Drop a video or reel with + to be first. 🎞️</div>';return}
  box.innerHTML='<div id="reels">'+posts.map(function(p,i){
    return `<section class="reel" data-i="${i}"><video src="${esc(p.media_url)}" ${okUrl(p.cover_url)?`poster="${esc(p.cover_url)}"`:''} loop playsinline muted preload="metadata" onclick="reelTap(this)"></video>
    <div class="rside">${rsideHtml(p,i)}</div>
    <div class="rcap"><b>@${esc(p.username)}${p.is_verified?' ✅':''}</b>${p.caption?`<div>${linkify(p.caption)}</div>`:''}<small>👁 ${fmt(p.view_count)}</small></div>
    <button class="rmute" onclick="reelMute()">${reelSound?'🔊':'🔇'}</button></section>`}).join('')+'</div>';
  var root=$('#reels');if(reelObs)reelObs.disconnect();
  reelObs=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target.querySelector('video');if(e.intersectionRatio>0.65){v.muted=!reelSound;var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});countView(posts[+e.target.dataset.i].id)}else v.pause()})},{root:root,threshold:[0,0.65]});
  root.querySelectorAll('.reel').forEach(function(s){reelObs.observe(s)});
}
function reelTap(v){if(v.paused)v.play();else v.pause()}
function reelMute(){reelSound=!reelSound;document.querySelectorAll('#reels video').forEach(function(v){v.muted=!reelSound});document.querySelectorAll('.rmute').forEach(function(b){b.textContent=reelSound?'🔊':'🔇'})}
function reelsRefreshUI(){document.querySelectorAll('.reel').forEach(function(el){var i=+el.dataset.i;if(posts[i])el.querySelector('.rside').innerHTML=rsideHtml(posts[i],i)})}
var _rp2=renderPosts;renderPosts=function(){if(listMode==='reels'){reelsRefreshUI();return}_rp2()};

/* ======================= CHAT: photos, voice notes, seen ======================= */
function composer(){return `<div class="comp"><button onclick="$('#pimg').click()" aria-label="Photo">📷</button><input id="min" class="sb" style="margin:0" maxlength="2000" placeholder="Message 😊" onkeydown="if(event.key==='Enter')msend()"><button id="micb" onclick="toggleMic()" aria-label="Voice note">🎤</button><button class="pill on" onclick="msend()">Send</button></div><input id="pimg" type="file" accept="image/*" class="hide" onchange="photoChosen(this)">`}
function bubHtml(m,mine,name){
  var h='';if(name)h+=`<b class="bn">${esc(name)}</b>`;
  if(m.media_kind==='image'&&okUrl(m.media_url))h+=`<img class="bimg" src="${esc(m.media_url)}" alt="" onclick="window.open(this.src)">`;
  else if(m.media_kind==='audio'&&okUrl(m.media_url))h+=`<audio controls preload="none" src="${esc(m.media_url)}"></audio>`;
  if(m.body)h+=`<div>${esc(m.body)}</div>`;
  return h;
}
function addBub(m){
  var b=$('#bubs');if(!b)return;var mine=m.sender_id===me.id,d=document.createElement('div');
  d.className='bub '+(mine?'me':'th');if(m.id)d.dataset.id=m.id;
  d.innerHTML=bubHtml(m,mine)+(mine?`<span class="tick">${m.read_at?'✓✓ Seen':'✓ Sent'}</span>`:'');
  b.appendChild(d);window.scrollTo(0,document.body.scrollHeight);
}
function tickSeen(m){var e=document.querySelector('.bub[data-id="'+m.id+'"] .tick');if(e&&m.read_at)e.textContent='✓✓ Seen'}
function addSpaceBub(m){
  var b=$('#bubs');if(!b||(m.id&&shown[m.id]))return;if(m.id)shown[m.id]=1;
  var mine=m.sender_id===me.id,p=m.profiles||{},d=document.createElement('div');
  d.className='bub '+(mine?'me':'th');d.innerHTML=bubHtml(m,mine,mine?'':(p.display_name||p.username||'User'));
  b.appendChild(d);window.scrollTo(0,document.body.scrollHeight);
}
async function viewChat(uid){
  chatCtx={kind:'dm',id:uid};
  $('#view').innerHTML=sub('Chat')+'<div class="pad"><div id="bubs"></div>'+composer()+'</div>';
  var r=await Promise.all([sb.from('profiles').select('username,display_name').eq('id',uid).single(),
    sb.from('messages').select('id,sender_id,recipient_id,body,read_at,media_url,media_kind,created_at').or(`and(sender_id.eq.${me.id},recipient_id.eq.${uid}),and(sender_id.eq.${uid},recipient_id.eq.${me.id})`).order('created_at',{ascending:true}).limit(200)]);
  var s=document.querySelector('.sub span');if(s&&r[0].data)s.textContent=r[0].data.display_name||r[0].data.username;
  (r[1].data||[]).forEach(addBub);markRead(uid);
}
async function sendMsg(body,url,kind){
  var c=chatCtx;if(!c)return false;
  var row=c.kind==='dm'?{sender_id:me.id,recipient_id:c.id,body:body,media_url:url||null,media_kind:kind||null}:{space_id:c.id,sender_id:me.id,body:body,media_url:url||null,media_kind:kind||null};
  var r=await sb.from(c.kind==='dm'?'messages':'space_messages').insert(row).select().single();
  if(r.error){toast('Could not send');return false}
  (c.kind==='dm'?addBub:addSpaceBub)(Object.assign({},r.data,{profiles:prof}));return true;
}
async function msend(){var i=$('#min'),v=i.value.trim();if(!v)return;i.value='';if(!await sendMsg(v))i.value=v}
async function sendFile(file,kind){try{var u=await upload(file);await sendMsg('',u,kind)}catch(e){toast(e.message||'Could not send')}}
function photoChosen(inp){var f=inp.files[0];inp.value='';if(!f)return;if(f.type.indexOf('image/')!==0||f.size>10*1024*1024){toast('Choose an image under 10 MB');return}toast('Sending photo…');sendFile(f,'image')}
var rec=null,recChunks=[],recT=0,recTimer=null;
async function toggleMic(){
  if(rec){rec.stop();return}
  if(!navigator.mediaDevices||!window.MediaRecorder){toast('Voice notes are not supported on this phone');return}
  var st;try{st=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast('Allow the microphone to send voice notes');return}
  var mt=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(function(t){return MediaRecorder.isTypeSupported(t)})||'';
  rec=new MediaRecorder(st,mt?{mimeType:mt}:{});recChunks=[];recT=0;
  rec.ondataavailable=function(e){if(e.data.size)recChunks.push(e.data)};
  rec.onstop=function(){
    clearInterval(recTimer);st.getTracks().forEach(function(t){t.stop()});
    var type=(rec.mimeType||mt||'audio/webm').split(';')[0],b=new Blob(recChunks,{type:type});rec=null;
    var mb=$('#micb');if(mb)mb.textContent='🎤';
    if(b.size<1500){toast('Too short');return}
    sendFile(new File([b],'voice.'+(type.indexOf('mp4')>-1?'m4a':'webm'),{type:type}),'audio');
  };
  rec.start();$('#micb').textContent='⏹️ 0s';
  recTimer=setInterval(function(){recT++;var mb=$('#micb');if(mb)mb.textContent='⏹️ '+recT+'s';if(recT>=120&&rec)rec.stop()},1000);
}
var _vm=viewMsgs;
viewMsgs=async function(){
  await _vm();var v=$('#view');
  if(v&&cv()==='msgs'&&!v.querySelector('.chips2')){var s=v.querySelector('.sub');if(s)s.insertAdjacentHTML('afterend','<div class="chips2"><button class="on">Chats</button><button onclick="open(\'spaces\')">Spaces</button></div>')}
};

/* ======================= SPACES ======================= */
var SPI={group:'👥',channel:'📢',community:'🌍'};
async function viewSpaces(){
  $('#view').innerHTML=sub('Spaces')+'<div class="chips2"><button onclick="back()">Chats</button><button class="on">Spaces</button><span style="flex:1"></span><button onclick="openCreateSpace()">➕ New</button></div><div id="spl"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('space_members').select('role,spaces(id,name,description,kind,is_public,member_count)').eq('user_id',me.id),
    sb.from('spaces').select('id,name,description,kind,is_public,member_count').eq('is_public',true).order('member_count',{ascending:false}).limit(30)]);
  var b=$('#spl');if(!b)return;
  var mine=(r[0].data||[]).map(function(x){return x.spaces}).filter(Boolean),have={};mine.forEach(function(s){have[s.id]=1});
  var disc=(r[1].data||[]).filter(function(s){return !have[s.id]});
  var row=function(s,join){return `<div class="row"><div class="cov">${SPI[s.kind]}</div><div class="t" onclick="open('space','${s.id}')"><b>${esc(s.name)}</b><small>${s.member_count} members · ${s.kind}</small></div>${join?`<button class="pill" onclick="joinSpace('${s.id}')">Join</button>`:''}</div>`};
  b.innerHTML='<div class="sub">My spaces</div>'+(mine.map(function(s){return row(s,false)}).join('')||'<div class="empty">You have not joined a space yet.</div>')+'<div class="sub">Discover</div>'+(disc.map(function(s){return row(s,true)}).join('')||'<div class="empty">No public spaces to discover yet. Create the first one! 🌍</div>');
}
function openCreateSpace(){
  $('#sbody').innerHTML=`<h3>Create a space</h3><input id="sn" class="sb" maxlength="60" placeholder="Space name"><textarea id="sd" class="sb" rows="2" maxlength="300" placeholder="What is it about?"></textarea>
  <select id="sk" class="sb"><option value="group">👥 Group, everyone can chat</option><option value="channel">📢 Channel, only admins post</option><option value="community">🌍 Community, open discussion</option></select>
  <label style="display:flex;gap:8px;margin-bottom:10px"><input type="checkbox" id="sp2" checked> Public, anyone can find and join</label><button class="big" onclick="createSpace()">Create</button>`;
  $('#ssheet').classList.add('show');
}
async function createSpace(){
  var n=$('#sn').value.trim();if(n.length<2){toast('Give your space a name');return}
  var r=await sb.from('spaces').insert({owner_id:me.id,name:n,description:$('#sd').value.trim()||null,kind:$('#sk').value,is_public:$('#sp2').checked}).select().single();
  if(r.error){toast('Could not create the space');return}
  closeSheets();open('space',r.data.id);
}
async function joinSpace(id){var r=await sb.from('space_members').insert({space_id:id,user_id:me.id,role:'member'});if(r.error){toast('Could not join');return}toast('Joined ✅');if(cv()==='space')viewSpace(id);else viewSpaces()}
async function leaveSpace(id){
  var s=await sb.from('spaces').select('owner_id').eq('id',id).maybeSingle();
  if(s.data&&s.data.owner_id===me.id){toast('You own this space. Delete it instead.');return}
  await sb.from('space_members').delete().eq('space_id',id).eq('user_id',me.id);stack=[['msgs'],['spaces']];render();
}
async function delSpace(id){if(!confirm('Delete this space and all its messages?'))return;var r=await sb.from('spaces').delete().eq('id',id);if(r.error){toast('Could not delete');return}stack=[['msgs'],['spaces']];render()}
async function viewSpace(id){
  chatCtx=null;shown={};
  $('#view').innerHTML=sub('Space')+'<div id="sp"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('spaces').select('*').eq('id',id).maybeSingle(),sb.from('space_members').select('role').eq('space_id',id).eq('user_id',me.id).maybeSingle()]);
  var s=r[0].data,m=r[1].data,box=$('#sp');if(!box)return;
  if(!s){box.innerHTML='<div class="empty">This space is private or no longer exists.</div>';return}
  var head=`<div class="pad" style="border-bottom:1px solid var(--line)"><b style="font-size:17px">${SPI[s.kind]} ${esc(s.name)}</b><div class="mute">${s.member_count} members · ${s.kind}${s.is_public?'':' · private'}</div>${s.description?`<p style="margin-top:6px">${esc(s.description)}</p>`:''}</div>`;
  if(!m){box.innerHTML=head+`<div class="pad"><button class="big" onclick="joinSpace('${id}')">Join this ${s.kind}</button></div>`;return}
  var can=(s.kind!=='channel'||m.role==='owner'||m.role==='admin');
  box.innerHTML=head+`<div class="pad"><div id="bubs"></div>${can?composer():'<p class="mute" style="text-align:center">Only admins can post in this channel.</p>'}<div style="display:flex;gap:8px;margin-top:12px;justify-content:center"><button class="pill" onclick="leaveSpace('${id}')">Leave</button>${s.owner_id===me.id?`<button class="pill" onclick="delSpace('${id}')">Delete space</button>`:''}</div></div>`;
  chatCtx={kind:'space',id:id};
  var ms=await sb.from('space_messages').select('id,sender_id,body,media_url,media_kind,created_at,profiles(username,display_name)').eq('space_id',id).order('created_at',{ascending:false}).limit(100);
  (ms.data||[]).reverse().forEach(addSpaceBub);
  if(spaceCh){sb.removeChannel(spaceCh);spaceCh=null}
  spaceCh=sb.channel('sp-'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'space_messages',filter:'space_id=eq.'+id},async function(p){var x=p.new;if(shown[x.id])return;x.profiles=await profileOf(x.sender_id);addSpaceBub(x)}).subscribe();
}
var _render=render;
render=function(){var t=stack[stack.length-1];if(t[0]!=='space'&&spaceCh){sb.removeChannel(spaceCh);spaceCh=null}if(t[0]!=='chat'&&t[0]!=='space')chatCtx=null;_render()};

/* ======================= SHOP: product page, cart, orders ======================= */
function stars(a){var n=Math.round(Number(a)||0);return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n)}
async function addToCart(id,silent){
  var p=await sb.from('posts').select('author_id,price_cents,stock').eq('id',id).maybeSingle();
  if(!p.data||p.data.price_cents==null){toast('This product is not available');return false}
  if(p.data.author_id===me.id){toast('This is your own product');return false}
  if(p.data.stock!==null&&p.data.stock<=0){toast('Out of stock');return false}
  var c=await sb.from('cart_items').select('qty').eq('user_id',me.id).eq('post_id',id).maybeSingle(),q=Math.min(99,((c.data&&c.data.qty)||0)+1);
  if(p.data.stock!==null&&q>p.data.stock){toast('Only '+p.data.stock+' in stock');return false}
  var r=await sb.from('cart_items').upsert({user_id:me.id,post_id:id,qty:q});
  if(r.error){toast('Could not add to cart');return false}
  if(!silent)toast('Added to cart 🛒');return true;
}
async function buyNow(id){if(await addToCart(id,true))open('cart')}
async function viewProduct(id){
  $('#view').innerHTML=sub('Product')+'<div id="pd"><div class="empty">Loading…</div></div>';
  var r=await sb.from('feed').select('*').eq('id',id).maybeSingle(),b=$('#pd');if(!b)return;
  var p=r.data;if(!p){b.innerHTML='<div class="empty">This product is not available.</div>';return}
  countView(id);posts=[p];
  var imgs=[p.media_url].concat(p.extra_media||[]).filter(okUrl),mine=p.author_id===me.id,oos=p.stock!==null&&p.stock<=0;
  var rv=await sb.from('reviews').select('rating,body,created_at,user_id,profiles(username,display_name)').eq('post_id',id).order('created_at',{ascending:false}).limit(30);
  var hb=await sb.rpc('has_bought',{pid:id}),done=(rv.data||[]).some(function(x){return x.user_id===me.id});
  if(!$('#pd'))return;
  $('#pd').innerHTML=`<div class="gal">${imgs.map(function(u){return `<img src="${esc(u)}" alt="" loading="lazy">`}).join('')||'<div class="cov" style="width:100%;height:240px">🛍️</div>'}</div>
  <div class="pad"><div style="font-size:24px;font-weight:800">$${((p.price_cents||0)/100).toFixed(2)}</div>
  <h3 style="margin:4px 0">${esc(p.title||'Product')}</h3>
  <div class="mute">${p.rating?`<span style="color:var(--ink)">${stars(p.rating)}</span> ${p.rating} (${p.rating_count}) · `:''}${p.stock===null?'In stock':(p.stock>0?'Only '+p.stock+' left':'Out of stock')} · 👁 ${fmt(p.view_count)}</div>
  <div class="row" style="padding:12px 0" onclick="openUser('${p.author_id}')">${avHtml(p)}<div class="t"><b>${esc(p.display_name||p.username)}${p.is_verified?' ✅ Verified seller':''}</b><small>@${esc(p.username)}</small></div>${mine?'':`<button class="pill" onclick="event.stopPropagation();open('chat','${p.author_id}')">💌 Message</button>`}</div>
  ${p.caption?`<p style="line-height:1.55;margin-bottom:12px">${linkify(p.caption)}</p>`:''}
  ${mine?'<p class="mute">This is your product. Manage it from Dashboard.</p>':`<div style="display:flex;gap:8px"><button class="big" style="background:none;color:var(--ink);border:1.5px solid var(--ink)" ${oos?'disabled':''} onclick="addToCart('${id}')">Add to cart</button><button class="big" ${oos?'disabled':''} onclick="buyNow('${id}')">Buy now</button></div>`}
  <h3 class="sh">Reviews</h3>
  ${hb.data&&!done?`<div style="margin-bottom:12px"><select id="rr" class="sb"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ OK</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select><textarea id="rb" class="sb" rows="2" maxlength="500" placeholder="Tell others about it"></textarea><button class="pill on" onclick="sendReview('${id}')">Post review</button></div>`:''}
  ${(rv.data||[]).map(function(x){var u=x.profiles||{};return `<div class="cm"><b>${esc(u.display_name||u.username||'Buyer')}</b> <span>${stars(x.rating)}</span>${x.body?`<div>${esc(x.body)}</div>`:''}</div>`}).join('')||'<p class="mute">No reviews yet. Buyers can review after delivery.</p>'}
  <button class="pill" style="margin-top:12px" onclick="openC(0)">💬 Questions and comments</button></div>`;
}
async function sendReview(id){var r=await sb.from('reviews').insert({post_id:id,user_id:me.id,rating:+$('#rr').value,body:$('#rb').value.trim()||null});if(r.error){toast('Could not post your review');return}toast('Thanks for your review ⭐');viewProduct(id)}
async function viewCart(){
  $('#view').innerHTML=sub('🛒 Cart')+'<div id="cl"><div class="empty">Loading…</div></div>';
  var r=await sb.from('cart_items').select('qty,post_id,posts(id,title,caption,price_cents,stock,cover_url,media_url,author_id,profiles(username,display_name))').eq('user_id',me.id).order('created_at'),b=$('#cl');if(!b)return;
  var d=(r.data||[]).filter(function(x){return x.posts&&x.posts.price_cents!=null});
  if(!d.length){b.innerHTML='<div class="empty">Your cart is empty.<br>Browse the Shop tab and tap Add to cart. 🛍️</div>';return}
  var tot=0;
  b.innerHTML=d.map(function(x){var p=x.posts,sl=(p.profiles||{}),line=p.price_cents*x.qty;tot+=line;var im=okUrl(p.media_url)?`<img class="nth" style="width:64px;height:64px" src="${esc(p.media_url)}" alt="">`:'<div class="nth" style="width:64px;height:64px">🛍️</div>';
    return `<div class="row" style="align-items:flex-start">${im}<div class="t"><b>${esc(p.title||p.caption||'Product')}</b><small>by ${esc(sl.display_name||sl.username||'seller')}</small><b>$${(p.price_cents/100).toFixed(2)}</b></div><div style="text-align:right"><div style="display:flex;gap:6px;align-items:center"><button class="pill" onclick="cartQty('${p.id}',${x.qty-1})">−</button><b>${x.qty}</b><button class="pill" onclick="cartQty('${p.id}',${x.qty+1})">+</button></div><button class="mute" style="margin-top:6px;font-size:12px" onclick="cartQty('${p.id}',0)">Remove</button></div></div>`}).join('')+
  `<div class="pad"><div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-bottom:10px"><span>Total</span><span>$${(tot/100).toFixed(2)}</span></div><button class="big" onclick="open('checkout')">Checkout</button></div>`;
}
async function cartQty(id,q){
  var r=q<=0?await sb.from('cart_items').delete().eq('user_id',me.id).eq('post_id',id):await sb.from('cart_items').update({qty:Math.min(99,q)}).eq('user_id',me.id).eq('post_id',id);
  if(r.error){toast('Could not update your cart');return}viewCart();
}
function viewCheckout(){
  $('#view').innerHTML=sub('Checkout')+`<div class="pad"><input id="on" class="sb" maxlength="80" placeholder="Full name" value="${esc(prof.display_name||'')}"><input id="op" class="sb" maxlength="30" type="tel" placeholder="Phone number"><textarea id="oa" class="sb" rows="2" maxlength="300" placeholder="Delivery address"></textarea><textarea id="oo" class="sb" rows="2" maxlength="300" placeholder="Note for the seller (optional)"></textarea>
  <div class="card2"><b>💵 Pay on delivery</b><p class="mute" style="margin-top:4px;line-height:1.5">You pay the seller when you receive your order. Online payment with mobile money and cards is coming soon.</p></div>
  <button class="big" id="obtn" onclick="placeOrder()">Place order</button></div>`;
}
async function placeOrder(){
  var b=$('#obtn');b.disabled=true;
  var r=await sb.rpc('place_order',{p_name:$('#on').value,p_phone:$('#op').value,p_address:$('#oa').value,p_note:$('#oo').value});
  b.disabled=false;
  if(r.error){toast((r.error.message||'Could not place the order').replace(/^.*?:\s*/,''));return}
  toast('Order placed! 🎉');ordTab='mine';stack=[['orders']];render();
}
var OST={placed:'🕒 Placed',confirmed:'✅ Confirmed',shipped:'🚚 Shipped',delivered:'📦 Delivered',cancelled:'❌ Cancelled'};
async function viewOrders(){
  $('#view').innerHTML=sub('📦 Orders')+`<div class="chips2"><button class="${ordTab==='mine'?'on':''}" onclick="ordTab='mine';viewOrders()">My orders</button><button class="${ordTab==='sales'?'on':''}" onclick="ordTab='sales';viewOrders()">Sales</button></div><div id="ol"><div class="empty">Loading…</div></div>`;
  var sales=ordTab==='sales';
  var r=await sb.from('orders').select('id,status,total_cents,created_at,buyer_name,buyer_phone,address,note,buyer_id,seller_id,order_items(post_id,title,price_cents,qty),buyer:profiles!buyer_id(username,display_name),seller:profiles!seller_id(username,display_name)').eq(sales?'seller_id':'buyer_id',me.id).order('created_at',{ascending:false}).limit(50);
  var b=$('#ol');if(!b)return;
  if(r.error){b.innerHTML='<div class="empty">Could not load orders.</div>';return}
  b.innerHTML=(r.data||[]).map(function(o){
    var other=sales?(o.buyer||{}):(o.seller||{}),oid=o.other_id,btns='';
    if(sales){
      if(o.status==='placed')btns+=`<button class="pill on" onclick="ordSet('${o.id}','confirmed')">Confirm</button><button class="pill" onclick="ordSet('${o.id}','cancelled')">Cancel</button>`;
      if(o.status==='confirmed')btns+=`<button class="pill on" onclick="ordSet('${o.id}','shipped')">Mark shipped</button><button class="pill" onclick="ordSet('${o.id}','cancelled')">Cancel</button>`;
      if(o.status==='shipped')btns+=`<button class="pill on" onclick="ordSet('${o.id}','delivered')">Mark delivered</button>`;
    }else{
      if(o.status==='placed')btns+=`<button class="pill" onclick="ordSet('${o.id}','cancelled')">Cancel order</button>`;
      if(o.status==='delivered')btns+=(o.order_items||[]).map(function(i){return i.post_id?`<button class="pill" onclick="open('product','${i.post_id}')">⭐ Review</button>`:''}).join('');
    }
    btns+=`<button class="pill" onclick="open('chat','${sales?o.buyer_id:o.seller_id}')">💌 Message</button>`;
    return `<div class="pad" style="border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><b>#${o.id.slice(0,6).toUpperCase()} · ${OST[o.status]||o.status}</b><span class="mute">${ago(o.created_at)}</span></div>
    <p class="mute" style="margin:4px 0">${sales?'Buyer':'Seller'}: ${esc(other.display_name||other.username||'User')}</p>
    ${(o.order_items||[]).map(function(i){return `<div>${i.qty} × ${esc(i.title)} <span class="mute">$${(i.price_cents/100).toFixed(2)}</span></div>`}).join('')}
    <div style="margin:6px 0"><b>Total $${(o.total_cents/100).toFixed(2)}</b> <span class="mute">· pay on delivery</span></div>
    ${sales?`<p class="mute" style="margin-bottom:6px">📍 ${esc(o.buyer_name)} · ${esc(o.buyer_phone)}<br>${esc(o.address)}${o.note?'<br>“'+esc(o.note)+'”':''}</p>`:''}
    <div style="display:flex;gap:6px;flex-wrap:wrap">${btns}</div></div>`}).join('')||`<div class="empty">${sales?'No sales yet. Your orders will show here.':'No orders yet.'}</div>`;
}
async function ordSet(id,st){
  if(st==='cancelled'&&!confirm('Cancel this order?'))return;
  var r=await sb.rpc('set_order_status',{oid:id,st:st});
  if(r.error){toast((r.error.message||'Could not update').replace(/^.*?:\s*/,''));return}viewOrders();
}

/* ======================= CREATOR DASHBOARD ======================= */
async function viewDashboard(){
  $('#view').innerHTML=sub('📊 Dashboard')+'<div id="db"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('feed').select('id,kind,title,caption,view_count,like_count,comment_count,price_cents,stock').eq('author_id',me.id).order('created_at',{ascending:false}).limit(200),
    sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',me.id),sb.rpc('subscriber_count',{uid:me.id}),sb.from('orders').select('status,total_cents').eq('seller_id',me.id)]);
  var b=$('#db');if(!b)return;
  var ps=r[0].data||[],v=0,l=0,c=0;ps.forEach(function(p){v+=Number(p.view_count||0);l+=Number(p.like_count||0);c+=Number(p.comment_count||0)});
  var os=r[3].data||[],rev=0,open_=0;os.forEach(function(o){if(o.status==='delivered')rev+=o.total_cents;if(o.status==='placed'||o.status==='confirmed'||o.status==='shipped')open_++});
  var top=ps.slice().sort(function(a,b2){return Number(b2.view_count)-Number(a.view_count)}).slice(0,5),prods=ps.filter(function(p){return p.kind==='product'});
  var st=function(n,t){return `<div><b>${n}</b><small>${t}</small></div>`};
  b.innerHTML=`<div class="pad"><div class="stat">${st(fmt(v),'Views')}${st(fmt(l),'Likes')}${st(fmt(c),'Comments')}</div><div class="stat">${st(fmt(r[1].count||0),'Followers')}${st(Number(r[2].data)||0,'Subscribers')}${st(ps.length,'Posts')}</div><div class="stat">${st('$'+(rev/100).toFixed(2),'Sales (delivered)')}${st(open_,'Open orders')}<div style="cursor:pointer" onclick="ordTab='sales';open('orders')"><b>→</b><small>View orders</small></div></div>
  <h3 class="sh">Top posts</h3>${top.map(function(p){return `<div class="cm"><b>${esc((p.title||p.caption||p.kind).slice(0,50))}</b> <span class="mute">· 👁 ${fmt(p.view_count)} · 👍 ${fmt(p.like_count)} · 💬 ${fmt(p.comment_count)}</span></div>`}).join('')||'<p class="mute">Drop something to see stats here.</p>'}
  <h3 class="sh">My products</h3>${prods.map(function(p){return `<div class="cm"><b>${esc(p.title||'Product')}</b> <span class="mute">· $${(p.price_cents/100).toFixed(2)} · stock ${p.stock===null?'unlimited':p.stock}</span><div class="ca"><button onclick="editStock('${p.id}')">Edit stock</button><button onclick="open('product','${p.id}')">Open</button></div></div>`}).join('')||'<p class="mute">No products yet. Tap + and choose Product for sale.</p>'}</div>`;
}
async function editStock(id){var v=prompt('New stock (leave empty for unlimited)');if(v===null)return;var n=v.trim()===''?null:Math.max(0,parseInt(v,10)||0);var r=await sb.from('posts').update({stock:n}).eq('id',id);toast(r.error?'Could not update':'Stock updated');viewDashboard()}

/* ======================= PLAYLISTS, CONTINUE WATCHING ======================= */
var _lm=loadMusic;
loadMusic=async function(){
  if(musicTab==='playlists'){return renderPlaylists()}
  await _lm();var c=document.querySelector('.chips2');
  if(c&&!c.querySelector('[data-pl]'))c.insertAdjacentHTML('beforeend','<button data-pl onclick="musicTab=\'playlists\';loadMusic()">Playlists</button>');
};
async function renderPlaylists(){
  var box=$('#plist');if(!box)return;listMode='';
  box.innerHTML='<div class="chips2"><button onclick="musicTab=\'discover\';loadMusic()">Discover</button><button onclick="musicTab=\'library\';loadMusic()">Library</button><button class="on">Playlists</button></div><div id="tl"><div class="empty">Loading…</div></div>';
  var r=await sb.from('playlists').select('id,name,playlist_tracks(post_id)').eq('owner_id',me.id).order('created_at',{ascending:false}),b=$('#tl');if(!b)return;
  b.innerHTML='<div class="pad"><button class="pill on" onclick="newPlaylist()">➕ New playlist</button></div>'+((r.data||[]).map(function(x){return `<button class="row" onclick="open('playlist','${x.id}')"><div class="cov">🎶</div><div class="t"><b>${esc(x.name)}</b><small>${(x.playlist_tracks||[]).length} tracks</small></div></button>`}).join('')||'<div class="empty">No playlists yet.<br>Create one, then add tracks from the ⋯ menu.</div>');
}
async function newPlaylist(then){var n=prompt('Playlist name');if(!n||!n.trim())return null;var r=await sb.from('playlists').insert({owner_id:me.id,name:n.trim().slice(0,60)}).select().single();if(r.error){toast('Could not create the playlist');return null}if(then)return r.data;renderPlaylists();return r.data}
var _om=openMore;
openMore=function(i){_om(i);var p=posts[i];if(p&&p.kind==='music')$('#mbody').insertAdjacentHTML('beforeend',`<button class="mi" onclick="addToPlaylist('${p.id}')"><em>🎶</em>Add to playlist</button>`)};
async function addToPlaylist(pid){
  var r=await sb.from('playlists').select('id,name').eq('owner_id',me.id).order('created_at',{ascending:false});
  $('#mbody').innerHTML='<h3>Add to playlist</h3>'+(r.data||[]).map(function(x){return `<button class="mi" onclick="chooseList('${x.id}','${pid}')"><em>🎶</em>${esc(x.name)}</button>`}).join('')+`<button class="mi" onclick="chooseList('','${pid}')"><em>➕</em>New playlist</button>`;
}
async function chooseList(lid,pid){
  if(!lid){var n=await newPlaylist(true);if(!n)return;lid=n.id}
  var r=await sb.from('playlist_tracks').upsert({playlist_id:lid,post_id:pid},{ignoreDuplicates:true,onConflict:'playlist_id,post_id'});
  closeSheets();toast(r.error?'Could not add':'Added to playlist 🎶');
}
async function viewPlaylist(id){
  $('#view').innerHTML=sub('🎶 Playlist')+'<div id="plist"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('playlists').select('name').eq('id',id).maybeSingle(),sb.from('playlist_tracks').select('post_id').eq('playlist_id',id).order('added_at',{ascending:false})]);
  var box=$('#plist');if(!box)return;var ids=(r[1].data||[]).map(function(x){return x.post_id});
  var s=document.querySelector('.sub span');if(s&&r[0].data)s.textContent='🎶 '+r[0].data.name;
  var f=ids.length?await sb.from('feed').select('*').in('id',ids):{data:[]},m={};(f.data||[]).forEach(function(p){m[p.id]=p});
  posts=ids.map(function(i){return m[i]}).filter(Boolean);
  box.innerHTML='<div class="pad"><button class="pill" onclick="delPlaylist(\''+id+'\')">Delete playlist</button></div><div id="tl"></div>';
  ptarget='#tl';listMode='tracks';renderPosts();
}
async function delPlaylist(id){if(!confirm('Delete this playlist?'))return;await sb.from('playlists').delete().eq('id',id);musicTab='playlists';homeTab='music';setTab('home')}
function railHtml(t,l){return `<h3 class="rh">${t}</h3><div class="rail">${l.map(function(p){return `<button class="pst" onclick="open('watch','${p.id}')">${coverHtml(p)}<small>${esc(p.title||'Untitled')}</small></button>`}).join('')}</div>`}
var _lmv=loadMovies;
loadMovies=async function(){
  await _lmv();var box=$('#plist');if(!box||homeTab!=='movies'||box.querySelector('.empty'))return;
  var w=await sb.from('watch_progress').select('post_id,seconds').eq('user_id',me.id).gt('seconds',5).order('updated_at',{ascending:false}).limit(12);
  var ids=(w.data||[]).map(function(x){return x.post_id}),rows='';
  if(ids.length){var f=await sb.from('feed').select('*').in('id',ids).eq('kind','movie'),m={};(f.data||[]).forEach(function(p){m[p.id]=p});var l=ids.map(function(i){return m[i]}).filter(Boolean);if(l.length)rows+=railHtml('▶️ Continue watching',l)}
  var sv=Array.from(saved);
  if(sv.length){var f2=await sb.from('feed').select('*').in('id',sv).eq('kind','movie').limit(20);if((f2.data||[]).length)rows+=railHtml('🔖 My list',f2.data)}
  if(!rows||!$('#plist'))return;
  var h=box.querySelector('.hero');if(h)h.insertAdjacentHTML('afterend',rows);else box.insertAdjacentHTML('afterbegin',rows);
};
var _vw=viewWatch;
viewWatch=async function(id){
  await _vw(id);countView(id);var v=document.querySelector('#plist video');if(!v)return;
  var w=await sb.from('watch_progress').select('seconds').eq('user_id',me.id).eq('post_id',id).maybeSingle(),sec=w.data?w.data.seconds:0;
  var resume=function(){if(sec>5&&sec<(v.duration||1e9)-10)v.currentTime=sec};
  if(v.readyState>=1)resume();else v.addEventListener('loadedmetadata',resume,{once:true});
  var last=0;
  v.addEventListener('timeupdate',function(){var t=Math.floor(v.currentTime);if(Math.abs(t-last)>=10){last=t;sb.from('watch_progress').upsert({user_id:me.id,post_id:id,seconds:t,updated_at:new Date().toISOString()}).then(function(){})}});
  v.addEventListener('ended',function(){sb.from('watch_progress').delete().eq('user_id',me.id).eq('post_id',id).then(function(){})});
};

/* ======================= DRAWER, ROUTES ======================= */
function openDrawer(){
  var n=prof.display_name||prof.username,it=function(k,e,l){return `<button class="mi" onclick="drawGo('${k}')"><em>${e}</em>${l}</button>`};
  $('#dbody').innerHTML=`<div style="margin-bottom:10px">${avHtml(prof,52)}<div style="margin-top:8px;font-weight:800;font-size:17px">${esc(n)}${prof.is_verified?' ✅':''}</div><div class="mute">@${esc(prof.username)}</div></div>`+
  it('profile','👤','Profile')+it('dashboard','📊','Dashboard')+it('orders','📦','Orders and sales')+it('cart','🛒','Cart')+it('spaces','👥','Spaces')+it('music','🎵','Music')+it('movies','🍿','Movies')+it('reel','🎬','Reels')+it('shop','🛍️','My Shop')+it('saved','🔖','Saved')+it('policy','📜','Policies and privacy')+it('settings','⚙️','Settings')+(prof.is_admin?it('admin','🛡️','Admin'):'')+
  `<button class="mi" onclick="logout()"><em>🚪</em>Log out</button>`;
  $('#drawer').classList.add('show');
}
var _dg=drawGo;
drawGo=function(w){if(['dashboard','orders','cart','spaces'].indexOf(w)>-1){closeSheets();if(w==='orders')ordTab='mine';stack=[[w]];render();return}_dg(w)};
VIEWS.product=viewProduct;VIEWS.cart=viewCart;VIEWS.checkout=viewCheckout;VIEWS.orders=viewOrders;VIEWS.dashboard=viewDashboard;
VIEWS.spaces=viewSpaces;VIEWS.space=viewSpace;VIEWS.playlist=viewPlaylist;

/* ======================= FRENCH ======================= */
Object.assign(FR,{'Mentions':'Mentions','Orders':'Commandes','Mark all read':'Tout marquer comme lu','Today':'Aujourd’hui','This week':'Cette semaine','Earlier':'Plus tôt','All':'Tout','Notifications':'Notifications','Pop-up banners':'Bannières','Sound and vibration':'Son et vibration','Phone alerts when PHIK is in the background':'Alertes du téléphone quand PHIK est en arrière-plan','Chats':'Discussions','Spaces':'Espaces','My spaces':'Mes espaces','Discover':'Découvrir','Join':'Rejoindre','Leave':'Quitter','Create a space':'Créer un espace','Space name':'Nom de l’espace','What is it about?':'De quoi s’agit-il ?','Create':'Créer','Space':'Espace','Product':'Produit','Add to cart':'Ajouter au panier','Reviews':'Avis','Post review':'Publier l’avis','Tell others about it':'Dites ce que vous en pensez','Cart':'Panier','🛒 Cart':'🛒 Panier','Total':'Total','Checkout':'Commander','Remove':'Retirer','Full name':'Nom complet','Phone number':'Numéro de téléphone','Delivery address':'Adresse de livraison','Note for the seller (optional)':'Note pour le vendeur (facultatif)','Place order':'Passer la commande','💵 Pay on delivery':'💵 Paiement à la livraison','My orders':'Mes commandes','Sales':'Ventes','📦 Orders':'📦 Commandes','Confirm':'Confirmer','Mark shipped':'Marquer expédié','Mark delivered':'Marquer livré','Cancel':'Annuler','Cancel order':'Annuler la commande','⭐ Review':'⭐ Avis','📊 Dashboard':'📊 Tableau de bord','Views':'Vues','Likes':'J’aime','Comments':'Commentaires','Top posts':'Meilleures publications','My products':'Mes produits','Edit stock':'Modifier le stock','Open':'Ouvrir','Dashboard':'Tableau de bord','Orders and sales':'Commandes et ventes','Playlists':'Playlists','➕ New playlist':'➕ Nouvelle playlist','Add to playlist':'Ajouter à une playlist','▶️ Continue watching':'▶️ Reprendre la lecture','🔖 My list':'🔖 Ma liste','Stock (leave empty for unlimited)':'Stock (vide = illimité)','Extra product photos (up to 4)':'Photos supplémentaires (jusqu’à 4)','Message 😊':'Message 😊','Only admins can post in this channel.':'Seuls les administrateurs peuvent publier ici.','No reels yet.':'Pas encore de reels.','Added to cart 🛒':'Ajouté au panier 🛒','Order placed! 🎉':'Commande passée ! 🎉','Sending photo…':'Envoi de la photo…','Joined ✅':'Rejoint ✅'});
FRX.push([/^Replying to (.+)$/,'Réponse à $1'],[/^Dropping… (\d+)%$/,'Publication… $1 %']);
