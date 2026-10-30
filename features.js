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
  notify('✉️',nm,m.body||(m.media_kind==='audio'?'🎤 Voice note':'📷 Photo'),function(){open('chat',m.sender_id)},'m'+m.id);
}
function subscribe(){
  sb.channel('rt-'+me.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'recipient_id=eq.'+me.id},function(p){cacheClear();onMsg(p.new);bannerMsg(p.new)})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:'sender_id=eq.'+me.id},function(p){cacheClear();tickSeen(p.new)})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+me.id},function(p){cacheClear();unreadN++;paint();if(cv()==='alerts')viewAlerts();else bannerNotif(p.new)})
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
  if(k==='story'){$('#dk').value='text';closeSheets();openStorySheet();return}
  ['#dp','#ds','#dxl','#dx'].forEach(function(x){$(x).classList.toggle('hide',!pr)});
  $('#dt').classList.toggle('hide',!(mm||pr));
  ['#dg','#dcl','#dcf','#drl'].forEach(function(x){$(x).classList.toggle('hide',!mm)});
  ['#dsr','#dep'].forEach(function(x){$(x).classList.toggle('hide',k!=='movie')});
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
    if(kind==='movie'&&$('#dsr').value.trim()){row.series_title=$('#dsr').value.trim().slice(0,80);row.episode_no=Math.min(999,Math.max(1,parseInt($('#dep').value,10)||1))}
    if(curl)row.cover_url=curl;
    if(kind==='product'){row.price_cents=Math.round(Number(price)*100);row.stock=stock===''?null:Math.max(0,parseInt(stock,10)||0);row.extra_media=ex}
    var ins=await sb.from('posts').insert(row);if(ins.error)throw ins.error;
    ['#dc','#df','#dp','#dt','#dcf','#ds','#dx','#dsr','#dep'].forEach(function(x){$(x).value=''});$('#dr').checked=false;closeSheets();toast('Dropped! 🎉');
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
  if(m.body)h+=`<div>${msgText(m.body)}</div>`;
  return h;
}
function addBub(m){
  var b=$('#bubs');if(!b)return;var mine=m.sender_id===me.id,d=document.createElement('div');
  d.className='bub '+(mine?'me':'th');if(m.id)d.dataset.id=m.id;
  d.innerHTML=bubHtml(m,mine)+(mine?`<span class="tick"><span class="tk">${m.read_at?'✓✓ Seen':'✓ Sent'}</span>${m.id&&!m.space_id?` · <a onclick="unsend('${m.id}')">Unsend</a>`:''}</span>`:'');
  b.appendChild(d);window.scrollTo(0,document.body.scrollHeight);
}
function tickSeen(m){var e=document.querySelector('.bub[data-id="'+m.id+'"] .tick .tk');if(e&&m.read_at)e.textContent='✓✓ Seen'}
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
  var s=document.querySelector('.sub span');if(s&&r[0].data){s.textContent=r[0].data.display_name||r[0].data.username;s.style.cursor='pointer';s.onclick=function(){openUser(uid)}}
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
  <div class="row" style="padding:12px 0" onclick="openUser('${p.author_id}')">${avHtml(p)}<div class="t"><b>${esc(p.display_name||p.username)}${p.is_verified?' ✅ Verified seller':''}</b><small>@${esc(p.username)}</small></div>${mine?'':`<button class="pill" onclick="event.stopPropagation();open('chat','${p.author_id}')">✉️ Message</button>`}</div>
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
    btns+=`<button class="pill" onclick="open('chat','${sales?o.buyer_id:o.seller_id}')">✉️ Message</button>`;
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
openMore=function(i){_om(i);var p=posts[i];if(!p)return;var b=$('#mbody');b.insertAdjacentHTML('beforeend',`<button class="mi" onclick="closeSheets();copyLink(location.origin+location.pathname+'#p-${p.id}')"><em>🔗</em>Copy link</button>`);if(p.kind==='music')b.insertAdjacentHTML('beforeend',`<button class="mi" onclick="addToPlaylist('${p.id}')"><em>🎶</em>Add to playlist</button>`)};
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
  var gs={};posts.forEach(function(p){if(p.series_title){var k=seriesKey(p);(gs[k]=gs[k]||[]).push(p)}});
  var ks=Object.keys(gs);
  if(ks.length)rows='<h3 class="rh">📺 Series</h3><div class="rail">'+ks.map(function(k){var l=gs[k].sort(function(a,b){return (a.episode_no||0)-(b.episode_no||0)});return `<button class="pst" onclick="open('series','${k}')">${coverHtml(l[0])}<small>${esc(l[0].series_title)} · ${l.length} ep</small></button>`}).join('')+'</div>';
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
  var cur=posts[0];
  if(cur&&cur.series_title){
    var eps=await sb.from('feed').select('id,title,episode_no,cover_url,kind').eq('kind','movie').eq('author_id',cur.author_id).eq('series_title',cur.series_title).order('episode_no',{ascending:true}),l=eps.data||[],box=$('#plist');
    if(box&&l.length>1){
      box.insertAdjacentHTML('beforeend','<h3 class="rh">📺 Episodes</h3>'+l.map(function(p){return `<button class="row${p.id===id?' un':''}" onclick="stack[stack.length-1]=['watch','${p.id}'];render()">${coverHtml(p)}<div class="t"><b>E${p.episode_no||'?'} · ${esc(p.title||'Episode')}</b></div>${p.id===id?'<span class="pb">▶️</span>':''}</button>`}).join(''));
      var nx=l[l.findIndex(function(x){return x.id===id})+1];
      if(nx)v.addEventListener('ended',function(){stack[stack.length-1]=['watch',nx.id];render()});
    }
  }
};

/* ======================= DRAWER, ROUTES ======================= */
function openDrawer(){
  var n=prof.display_name||prof.username,it=function(k,e,l){return `<button class="mi" onclick="drawGo('${k}')"><em>${e}</em>${l}</button>`};
  $('#dbody').innerHTML=`<div style="margin-bottom:10px">${avHtml(prof,52)}<div style="margin-top:8px;font-weight:800;font-size:17px">${esc(n)}${prof.is_verified?' ✅':''}</div><div class="mute">@${esc(prof.username)}</div></div>`+
  it('profile','👤','Profile')+it('dashboard','📊','Dashboard')+it('orders','📦','Orders and sales')+it('cart','🛒','Cart')+it('spaces','👥','Spaces')+it('music','🎵','Music')+it('movies','🍿','Movies')+it('reel','🎬','Reels')+it('shop','🛍️','Shop')+it('myshop','🏪','My Shop')+it('saved','🔖','Saved')+it('policy','📜','Policies and privacy')+it('settings','⚙️','Settings')+(prof.is_admin?it('admin','🛡️','Admin'):'')+
  `<button class="mi" onclick="logout()"><em>🚪</em>Log out</button>`;
  $('#drawer').classList.add('show');
}
var _dg=drawGo;
drawGo=function(w){if(['dashboard','orders','cart','spaces','myshop'].indexOf(w)>-1){closeSheets();if(w==='orders')ordTab='mine';stack=[[w]];render();return}_dg(w)};
VIEWS.product=viewProduct;VIEWS.cart=viewCart;VIEWS.checkout=viewCheckout;VIEWS.orders=viewOrders;VIEWS.dashboard=viewDashboard;
VIEWS.spaces=viewSpaces;VIEWS.space=viewSpace;VIEWS.playlist=viewPlaylist;

/* ======================= FRENCH ======================= */
Object.assign(FR,{'Mentions':'Mentions','Orders':'Commandes','Mark all read':'Tout marquer comme lu','Today':'Aujourd’hui','This week':'Cette semaine','Earlier':'Plus tôt','All':'Tout','Notifications':'Notifications','Pop-up banners':'Bannières','Sound and vibration':'Son et vibration','Phone alerts when PHIK is in the background':'Alertes du téléphone quand PHIK est en arrière-plan','Chats':'Discussions','Spaces':'Espaces','My spaces':'Mes espaces','Discover':'Découvrir','Join':'Rejoindre','Leave':'Quitter','Create a space':'Créer un espace','Space name':'Nom de l’espace','What is it about?':'De quoi s’agit-il ?','Create':'Créer','Space':'Espace','Product':'Produit','Add to cart':'Ajouter au panier','Reviews':'Avis','Post review':'Publier l’avis','Tell others about it':'Dites ce que vous en pensez','Cart':'Panier','🛒 Cart':'🛒 Panier','Total':'Total','Checkout':'Commander','Remove':'Retirer','Full name':'Nom complet','Phone number':'Numéro de téléphone','Delivery address':'Adresse de livraison','Note for the seller (optional)':'Note pour le vendeur (facultatif)','Place order':'Passer la commande','💵 Pay on delivery':'💵 Paiement à la livraison','My orders':'Mes commandes','Sales':'Ventes','📦 Orders':'📦 Commandes','Confirm':'Confirmer','Mark shipped':'Marquer expédié','Mark delivered':'Marquer livré','Cancel':'Annuler','Cancel order':'Annuler la commande','⭐ Review':'⭐ Avis','📊 Dashboard':'📊 Tableau de bord','Views':'Vues','Likes':'J’aime','Comments':'Commentaires','Top posts':'Meilleures publications','My products':'Mes produits','Edit stock':'Modifier le stock','Open':'Ouvrir','Dashboard':'Tableau de bord','Orders and sales':'Commandes et ventes','Playlists':'Playlists','➕ New playlist':'➕ Nouvelle playlist','Add to playlist':'Ajouter à une playlist','▶️ Continue watching':'▶️ Reprendre la lecture','🔖 My list':'🔖 Ma liste','Stock (leave empty for unlimited)':'Stock (vide = illimité)','Extra product photos (up to 4)':'Photos supplémentaires (jusqu’à 4)','Message 😊':'Message 😊','Only admins can post in this channel.':'Seuls les administrateurs peuvent publier ici.','No reels yet.':'Pas encore de reels.','Added to cart 🛒':'Ajouté au panier 🛒','Order placed! 🎉':'Commande passée ! 🎉','Sending photo…':'Envoi de la photo…','Joined ✅':'Rejoint ✅'});
FRX.push([/^Replying to (.+)$/,'Réponse à $1'],[/^Dropping… (\d+)%$/,'Publication… $1 %']);


/* ======================= BATCH 3: messaging, share links, X-style icons, pull to refresh ======================= */
IC.home='<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
IC.search='<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>';
IC.bell='<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';
IC.mail='<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>';
IC.gear='<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>';
function navIcons(){
  var m={home:'home',search:'search',alerts:'bell',msgs:'mail'};
  document.querySelectorAll('nav [data-t]').forEach(function(b){var sp=b.querySelector('span');if(sp&&m[b.dataset.t])sp.innerHTML=ic(m[b.dataset.t])});
  var g=$('#hgear');if(g)g.innerHTML=ic('gear');
}
navIcons();

/* ---- messaging: conversation list, new message, unsend ---- */
function msgPreview(m){return m.media_kind==='audio'?'🎤 Voice note':(m.media_kind==='image'?'📷 Photo':(m.body||''))}
viewMsgs=async function(){
  if(cv()!=='msgs')return;
  $('#view').innerHTML=sub('Messages')+'<div class="chips2"><button class="on">Chats</button><button onclick="open(\'spaces\')">Spaces</button></div><div id="mlist"><div class="empty">Loading…</div></div><button class="fab" onclick="openNewMsg()" aria-label="New message">'+ic('mail')+'<i>+</i></button>';
  var r=await sb.from('messages').select('id,sender_id,recipient_id,body,read_at,media_kind,created_at').or(`sender_id.eq.${me.id},recipient_id.eq.${me.id}`).order('created_at',{ascending:false}).limit(300);
  var box=$('#mlist');if(!box)return;
  if(r.error){box.innerHTML='<div class="empty">Could not load messages.</div>';return}
  var conv={},order=[];
  (r.data||[]).forEach(function(m){var o=m.sender_id===me.id?m.recipient_id:m.sender_id;if(!conv[o]){conv[o]={last:m,unread:0};order.push(o)}if(m.recipient_id===me.id&&!m.read_at)conv[o].unread++});
  order=order.filter(function(o){return blockMap[o]!=='block'});
  if(!order.length){box.innerHTML='<div class="empty">No messages yet.<br>Tap the button below to message someone.</div><div class="pad"><button class="big" onclick="openNewMsg()">New message</button></div>';return}
  var pr=await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified').in('id',order),map={};
  (pr.data||[]).forEach(function(p){map[p.id]=p;profCache[p.id]=p});
  if(!$('#mlist'))return;
  $('#mlist').innerHTML=order.map(function(o){var p=map[o]||{},c=conv[o];
    return `<button class="row${c.unread?' un':''}" onclick="open('chat','${o}')">${avHtml(p)}<div class="t"><b>${esc(p.display_name||p.username||'User')}${p.is_verified?' ✅':''}</b><small>${c.last.sender_id===me.id?'You: ':''}${esc(msgPreview(c.last))}</small></div><small class="mute">${ago(c.last.created_at)}</small>${c.unread?'<i class="dot"></i>':''}</button>`}).join('');
};
var nmTimer=null;
function openNewMsg(){
  $('#sbody').innerHTML='<h3>New message</h3><input id="nmq" class="sb" placeholder="Search people" oninput="nmDebounce(this.value)" autocomplete="off"><div id="nmr" style="max-height:50vh;overflow:auto"><div class="empty">Loading…</div></div>';
  $('#ssheet').classList.add('show');nmSearch('');setTimeout(function(){var i=$('#nmq');if(i)i.focus()},200);
}
function nmDebounce(v){clearTimeout(nmTimer);nmTimer=setTimeout(function(){nmSearch(v)},300)}
async function nmSearch(raw){
  var q=(raw||'').replace(/[^\p{L}\p{N}_ ]/gu,'').trim(),box=$('#nmr');if(!box)return;
  var req=sb.from('profiles').select('id,username,display_name,avatar_url,is_verified').neq('id',me.id).limit(25);
  req=q?req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`):req.order('created_at',{ascending:false});
  var r=await req;if(!$('#nmr'))return;
  var l=(r.data||[]).filter(function(p){return !blockMap[p.id]});
  l.sort(function(a,b){return (follows.has(b.id)?1:0)-(follows.has(a.id)?1:0)});
  box.innerHTML=l.map(function(p){return `<button class="row" onclick="startChat('${p.id}')">${avHtml(p)}<div class="t"><b>${esc(p.display_name||p.username)}${p.is_verified?' ✅':''}</b><small>@${esc(p.username)}</small></div></button>`}).join('')||'<div class="empty">No one found.</div>';
}
function startChat(id){closeSheets();var t=stack[stack.length-1];if(t[0]==='chat'&&t[1]===id)return;open('chat',id)}
async function unsend(id){
  if(!confirm('Unsend this message?'))return;
  var r=await sb.from('messages').delete().eq('id',id);
  if(r.error){toast('Could not unsend');return}
  var e=document.querySelector('.bub[data-id="'+id+'"]');if(e)e.remove();
}

/* ---- share links that open for everyone ---- */
function copyLink(url){
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){toast('Link copied')},function(){prompt('Copy this link',url)});
  else prompt('Copy this link',url);
}
function sharePost(i){
  var p=posts[i],url=location.origin+location.pathname+'#p-'+p.id,t=(p.title||p.caption||'A post on PHIK').slice(0,100);closeSheets();
  if(navigator.share)navigator.share({title:'PHIK',text:t+'\n'+url}).catch(function(e){if(e&&e.name!=='AbortError')copyLink(url)});else copyLink(url);
}
function shareProfile(u){
  var url=location.origin+location.pathname+'#u-'+u;
  if(navigator.share)navigator.share({title:'PHIK',text:'Find me on PHIK: @'+u+'\n'+url}).catch(function(e){if(e&&e.name!=='AbortError')copyLink(url)});else copyLink(url);
}
var _vu=viewUser;
viewUser=async function(uid){
  await _vu(uid);var pr=document.querySelector('#view .pr');if(!pr||uid!==me.id||pr.querySelector('[data-sh]'))return;
  var b=pr.querySelector('button.pill');if(b)b.outerHTML='<div style="display:flex;gap:6px"><button class="pill" onclick="openEdit()">Edit profile</button><button class="pill" data-sh onclick="shareProfile(\''+esc(prof.username)+'\')">Share</button></div>';
};
async function routeHash(){
  if(!me)return;var h=location.hash,m=h.match(/^#p-([0-9a-f-]{36})$/i),u=h.match(/^#u-([a-z0-9_]{3,30})$/i);
  if(m){stack=[['home'],['post',m[1]]];render();history.replaceState(null,'',location.pathname+location.search)}
  else if(u){var r=await sb.from('profiles').select('id').eq('username',u[1].toLowerCase()).maybeSingle();history.replaceState(null,'',location.pathname+location.search);if(r.data){stack=[['home'],['user',r.data.id]];render()}else toast('User not found')}
}
window.addEventListener('hashchange',function(){routeHash()});
function guestHash(){var m=location.hash.match(/^#p-([0-9a-f-]{36})$/i);return m?m[1]:null}
function guestJoin(mode){var g=$('#guest');if(g)g.classList.add('hide');$('#auth').classList.remove('hide');if(mode!==signup)swap()}
async function showGuestPost(){
  var id=guestHash();if(!id||me)return;
  $('#auth').classList.add('hide');$('#app').classList.add('hide');
  var g=$('#guest');if(!g){g=document.createElement('div');g.id='guest';document.body.appendChild(g)}
  g.classList.remove('hide');
  var head='<div class="gh"><div class="logo">K</div><b>PHIK</b></div>',cta='<div class="pad"><button class="big" onclick="guestJoin(true)">Create a free account</button><button class="big" style="background:none;color:var(--ink);border:1.5px solid var(--ink)" onclick="guestJoin(false)">Log in</button></div>';
  g.innerHTML=head+'<div class="empty">Loading…</div>';
  var r=await sb.from('feed').select('*').eq('id',id).maybeSingle(),p=r.data;
  if(me)return;
  if(!p){g.innerHTML=head+'<div class="empty">Join PHIK to see this post.</div>'+cta;return}
  var name=p.display_name||p.username;
  g.innerHTML=head+`<article class="post"><div class="ph">${avHtml(p)}<div class="who"><b>${esc(name)}${p.is_verified?' ✅':''}</b><small>@${esc(p.username)}</small></div></div>${p.title?`<p class="cap"><b>${esc(p.title)}</b></p>`:''}${p.caption?`<p class="cap">${esc(p.caption)}</p>`:''}${mediaHtml(p).replace(/ onclick="[^"]*"/g,'')}<div class="act" style="justify-content:flex-start;gap:18px;color:var(--mute)"><span>${ic('up')} ${p.like_count||0}</span><span>${ic('chat')} ${p.comment_count||0}</span></div></article><p class="mute" style="text-align:center;padding:12px">Log in or create an account to like, comment and follow.</p>`+cta;
}
var _boot=boot;
boot=function(s){var g=$('#guest');if(s&&g)g.classList.add('hide');if(!s&&guestHash()&&!me){showGuestPost();return}return _boot(s)};
if(!me&&guestHash())setTimeout(function(){if(!me)showGuestPost()},900);

/* ---- pull down to refresh ---- */
(function(){
  var y0=null,pull=0,ptr=null;
  function el(){if(!ptr){ptr=document.createElement('div');ptr.id='ptr';document.body.appendChild(ptr)}return ptr}
  document.addEventListener('touchstart',function(e){
    y0=null;if(window.scrollY>0||e.touches.length!==1||!me)return;
    var c=cv();if(c==='chat'||c==='space')return;
    var t=e.target;if(t.closest&&t.closest('#reels,.sheet,textarea,input,select,audio,video,#guest,#auth'))return;
    y0=e.touches[0].clientY;pull=0;
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(y0===null)return;var d=e.touches[0].clientY-y0,p=el();
    if(d<=0||window.scrollY>0){pull=0;p.style.opacity=0;return}
    pull=Math.min(d,120);p.textContent=pull>=70?'Release to refresh':'Pull down to refresh';p.style.opacity=Math.min(1,pull/50);p.style.transform='translate(-50%,'+(pull/3)+'px)';
  },{passive:true});
  document.addEventListener('touchend',function(){
    if(y0===null)return;var p=el(),go=pull>=70;y0=null;pull=0;
    if(go){p.textContent='Refreshing…';p.style.opacity=1;refreshView();setTimeout(function(){p.style.opacity=0;p.style.transform='translate(-50%,0)'},900)}
    else{p.style.opacity=0;p.style.transform='translate(-50%,0)'}
  },{passive:true});
})();

Object.assign(FR,{'New message':'Nouveau message','Search people':'Rechercher des personnes','No one found.':'Personne trouvé.','Tap the button below to message someone.':'Touchez le bouton ci-dessous pour écrire à quelqu’un.','Unsend':'Annuler l’envoi','Pull down to refresh':'Tirez vers le bas pour actualiser','Release to refresh':'Relâchez pour actualiser','Refreshing…':'Actualisation…','Create a free account':'Créer un compte gratuit','Join PHIK to see this post.':'Rejoignez PHIK pour voir cette publication.','Log in or create an account to like, comment and follow.':'Connectez-vous ou créez un compte pour aimer, commenter et suivre.','Copy link':'Copier le lien','🎤 Voice note':'🎤 Note vocale','📷 Photo':'📷 Photo','You: ':'Vous : '});


/* ======================= BATCH 4: stories, series, hardening ======================= */
/* ---- series ---- */
function seriesKey(p){return p.author_id+'|'+encodeURIComponent(p.series_title)}
async function viewSeries(key){
  var a=key.split('|'),uid=a[0],title=decodeURIComponent(a[1]||'');
  $('#view').innerHTML=sub('📺 Series')+'<div id="srs"><div class="empty">Loading…</div></div>';
  var r=await sb.from('feed').select('*').eq('kind','movie').eq('author_id',uid).eq('series_title',title).order('episode_no',{ascending:true}),b=$('#srs');if(!b)return;
  var d=r.data||[];if(!d.length){b.innerHTML='<div class="empty">This series has no episodes yet.</div>';return}
  var f=d[0];
  b.innerHTML=`<div class="hero" onclick="open('watch','${f.id}')">${coverHtml(f)}<div class="ov"><b>${esc(title)}</b><span>▶ Play episode ${f.episode_no||1}</span></div></div><div class="pad"><div class="mute">by <a class="tg" onclick="openUser('${uid}')">${esc(f.display_name||f.username)}</a> · ${d.length} episode${d.length>1?'s':''}</div></div>`+
  d.map(function(p){return `<button class="row" onclick="open('watch','${p.id}')">${coverHtml(p)}<div class="t"><b>E${p.episode_no||'?'} · ${esc(p.title||'Episode')}</b><small>${esc((p.caption||'').slice(0,80))}</small></div><span class="pb">▶️</span></button>`}).join('');
}
VIEWS.series=viewSeries;

/* ---- stories ---- */
var SG=[],svState=null,svTimer=null,storyBg='#111111',SBG=['#111111','#5B2EFF','#E0245E','#0A7F5A','#B45309','#1D4ED8'];
var _vh=viewHome;
viewHome=function(){_vh();if(['foryou','trending','following'].indexOf(homeTab)>-1){$('#view').insertAdjacentHTML('afterbegin','<div id="stories" class="strow"></div>');loadStories()}};
async function loadStories(){
  var box=$('#stories');if(!box)return;
  var r=await Promise.all([sb.from('stories').select('id,author_id,media_url,media_kind,caption,bg,created_at,profiles(username,display_name,avatar_url)').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(200),
    sb.from('story_views').select('story_id').eq('user_id',me.id).limit(500)]);
  if(!$('#stories'))return;
  var seen={},by={};(r[1].data||[]).forEach(function(x){seen[x.story_id]=1});SG=[];
  (r[0].data||[]).forEach(function(st){
    if(blockMap[st.author_id])return;
    if(!by[st.author_id]){by[st.author_id]={uid:st.author_id,p:st.profiles||{},items:[],unseen:false};SG.push(by[st.author_id])}
    var g=by[st.author_id];st.seen=!!seen[st.id]||st.author_id===me.id;g.items.push(st);if(!st.seen)g.unseen=true;
  });
  SG.sort(function(a,b){var am=a.uid===me.id?0:1,bm=b.uid===me.id?0:1;if(am!==bm)return am-bm;if(a.unseen!==b.unseen)return a.unseen?-1:1;return (follows.has(b.uid)?1:0)-(follows.has(a.uid)?1:0)});
  var mine=by[me.id];
  var html=`<button class="sc" onclick="${mine?`openStories('${me.id}')`:'openStorySheet()'}" aria-label="Your story"><span class="ring ${mine?'seen':'add'}">${avHtml(prof,56)}<i class="sp" ${mine?'onclick="event.stopPropagation();openStorySheet()"':''}>+</i></span><small>Your story</small></button>`;
  SG.forEach(function(g){if(g.uid===me.id)return;html+=`<button class="sc" onclick="openStories('${g.uid}')"><span class="ring ${g.unseen?'':'seen'}">${avHtml(g.p,56)}</span><small>${esc((g.p.display_name||g.p.username||'User').slice(0,10))}</small></button>`});
  box.innerHTML=html;
}
function openStorySheet(){
  storyBg=SBG[0];
  $('#sbody').innerHTML=`<h3>Add to your story</h3><p class="mute" style="margin-bottom:6px">Photo or video. It disappears after 24 hours.</p><input id="stf" class="sb" type="file" accept="image/*,video/*"><textarea id="stc" class="sb" rows="2" maxlength="200" placeholder="Write something, or make a text story"></textarea><div class="sw2" id="swl">${SBG.map(function(c,i){return `<button class="${i?'':'on'}" style="background:${c}" onclick="pickBg('${c}',this)" aria-label="Colour"></button>`}).join('')}</div><button class="big" id="stb" onclick="postStory()">Share to story</button>`;
  $('#ssheet').classList.add('show');
}
function pickBg(c,b){storyBg=c;document.querySelectorAll('#swl button').forEach(function(x){x.classList.remove('on')});b.classList.add('on')}
async function postStory(){
  var f=$('#stf').files[0],cap=$('#stc').value.trim();
  if(!f&&!cap){toast('Choose a photo or video, or write something');return}
  if(f&&f.type.indexOf('image/')!==0&&f.type.indexOf('video/')!==0){toast('Choose a photo or video');return}
  if(f&&f.size>50*1024*1024){toast('Files can be up to 50 MB');return}
  var b=$('#stb');b.disabled=true;b.textContent='Sharing…';window.onUp=function(p){b.textContent='Sharing… '+p+'%'};
  try{
    var url=f?await upload(f):null,kind=f?(f.type.indexOf('video/')===0?'video':'image'):'text';
    var r=await sb.from('stories').insert({author_id:me.id,media_url:url,media_kind:kind,caption:cap||null,bg:storyBg});
    if(r.error)throw r.error;
    closeSheets();toast('Story shared ✨');loadStories();
  }catch(e){toast(e.message||'Could not share your story')}
  window.onUp=null;b.disabled=false;b.textContent='Share to story';
}
function openStories(uid){
  var gi=SG.findIndex(function(g){return g.uid===uid});if(gi<0)return;
  var g=SG[gi],ii=0;if(uid!==me.id){var k=g.items.findIndex(function(x){return !x.seen});ii=k<0?0:k}
  svState={gi:gi,ii:ii};var v=$('#sv');if(!v){v=document.createElement('div');v.id='sv';document.body.appendChild(v);
    var y0=null;v.addEventListener('touchstart',function(e){y0=e.touches[0].clientY},{passive:true});
    v.addEventListener('touchend',function(e){if(y0!==null&&e.changedTouches[0].clientY-y0>110)closeStories();y0=null},{passive:true})}
  v.classList.remove('hide');document.body.style.overflow='hidden';showStory();
}
function closeStories(){clearTimeout(svTimer);var v=$('#sv');if(v){v.classList.add('hide');v.innerHTML=''}document.body.style.overflow='';svState=null;loadStories()}
function runBar(ms){var b=$('#sbar');if(!b)return;clearTimeout(svTimer);b.style.transition='none';b.style.width='0%';void b.offsetWidth;b.style.transition='width '+ms+'ms linear';b.style.width='100%';svTimer=setTimeout(nextStory,ms)}
function showStory(){
  clearTimeout(svTimer);if(!svState)return;
  var g=SG[svState.gi],st=g&&g.items[svState.ii];if(!st){closeStories();return}
  var mine=g.uid===me.id,v=$('#sv'),nm=esc(g.p.display_name||g.p.username||'');
  var bars=g.items.map(function(x,i){return `<i class="${i<svState.ii?'done':''}">${i===svState.ii?'<b id="sbar"></b>':''}</i>`}).join('');
  var media=st.media_kind==='text'?`<div class="stext" style="background:${esc(st.bg)}">${esc(st.caption||'')}</div>`:(okUrl(st.media_url)?(st.media_kind==='video'?`<video id="svm" src="${esc(st.media_url)}" autoplay playsinline></video>`:`<img id="svm" src="${esc(st.media_url)}" alt="">`):'<div class="stext">Story unavailable</div>');
  v.innerHTML=`<div class="smedia">${media}</div><div class="sbars">${bars}</div><div class="shead">${avHtml(g.p,34)}<b>${nm}</b><span>${ago(st.created_at)}</span><span style="flex:1"></span><button onclick="closeStories()" aria-label="Close">✕</button></div>${(st.media_kind!=='text'&&st.caption)?`<div class="scap">${esc(st.caption)}</div>`:''}<div class="sl" onclick="prevStory()"></div><div class="sr" onclick="nextStory()"></div>
  <div class="sfoot">${mine?`<button onclick="storyViewers('${st.id}')">👁 Views</button><button onclick="delStory('${st.id}')">🗑️ Delete</button>`:`<input id="srp" maxlength="500" placeholder="Reply to ${nm}…" onfocus="pauseStory()" onblur="resumeStory()" onkeydown="if(event.key==='Enter')storyReply()"><button onclick="storyReply()" aria-label="Send reply">➤</button>`}</div>`;
  if(!mine&&!st.seen){st.seen=true;sb.from('story_views').upsert({story_id:st.id,user_id:me.id},{ignoreDuplicates:true,onConflict:'story_id,user_id'}).then(function(){})}
  var m=$('#svm');
  if(st.media_kind==='video'&&m){m.onended=nextStory;m.onerror=function(){runBar(3000)};var go=function(){runBar(Math.min(m.duration||10,30)*1000)};if(m.readyState>=1)go();else m.onloadedmetadata=go}
  else if(st.media_kind==='image'&&m){if(m.complete)runBar(5000);else{m.onload=function(){runBar(5000)};m.onerror=function(){runBar(2000)}}}
  else runBar(5000);
}
function nextStory(){
  if(!svState)return;var g=SG[svState.gi];
  if(svState.ii<g.items.length-1){svState.ii++;showStory();return}
  if(svState.gi<SG.length-1){svState.gi++;var n=SG[svState.gi],k=n.items.findIndex(function(x){return !x.seen});svState.ii=k<0?0:k;showStory();return}
  closeStories();
}
function prevStory(){if(!svState)return;if(svState.ii>0){svState.ii--;showStory()}else showStory()}
function pauseStory(){clearTimeout(svTimer);var m=$('#svm');if(m&&m.pause)m.pause()}
function resumeStory(){if(!svState)return;var m=$('#svm');if(m&&m.tagName==='VIDEO'){m.play().catch(function(){});return}runBar(5000)}
async function storyReply(){
  var i=$('#srp'),t=i&&i.value.trim();if(!t||!svState)return;var uid=SG[svState.gi].uid;
  var r=await sb.from('messages').insert({sender_id:me.id,recipient_id:uid,body:'↩️ Story reply: '+t});
  if(r.error){toast('Could not send your reply');return}
  i.value='';i.blur();toast('Reply sent ✉️');
}
async function storyViewers(id){
  pauseStory();var v=$('#sv'),old=v.querySelector('.svw');if(old)old.remove();
  v.insertAdjacentHTML('beforeend','<div class="svw"><div style="display:flex;justify-content:space-between"><b>Views</b><button onclick="this.closest(\'.svw\').remove();resumeStory()" aria-label="Close">✕</button></div><div id="svl"><div class="empty">Loading…</div></div></div>');
  var r=await sb.from('story_views').select('created_at,profiles(username,display_name,avatar_url)').eq('story_id',id).order('created_at',{ascending:false}),b=$('#svl');if(!b)return;
  b.innerHTML=(r.data||[]).map(function(x){var p=x.profiles||{};return `<div class="row">${avHtml(p)}<div class="t"><b>${esc(p.display_name||p.username||'User')}</b><small>${ago(x.created_at)}</small></div></div>`}).join('')||'<div class="empty">No views yet.</div>';
}
async function delStory(id){
  if(!confirm('Delete this story?'))return;
  var r=await sb.from('stories').delete().eq('id',id);if(r.error){toast('Could not delete');return}
  var g=SG[svState.gi];g.items=g.items.filter(function(x){return x.id!==id});
  if(!g.items.length){closeStories();return}
  if(svState.ii>=g.items.length)svState.ii=g.items.length-1;showStory();
}

/* ---- stronger reporting, admin, editing ---- */
async function reportUser(uid){closeSheets();var why=prompt('Why are you reporting this person?');if(why===null)return;var r=await sb.from('reports').insert({reporter_id:me.id,user_id:uid,reason:why.trim().slice(0,500)||null});toast(r.error?'Could not send the report':'Thanks. We will review this account.')}
async function reportComment(cid){var why=prompt('Why are you reporting this comment?');if(why===null)return;var r=await sb.from('reports').insert({reporter_id:me.id,comment_id:cid,reason:why.trim().slice(0,500)||null});toast(r.error?'Could not send the report':'Thanks. We will review this comment.')}
var _um=userMenu;
userMenu=function(uid){_um(uid);$('#mbody').insertAdjacentHTML('beforeend',`<button class="mi" onclick="reportUser('${uid}')"><em>🚩</em>Report user</button>`)};
async function editPost(i){
  var p=posts[i];if(!p||p.author_id!==me.id)return;closeSheets();
  var cap=prompt('Edit your caption',p.caption||'');if(cap===null)return;
  var upd={caption:cap.trim().slice(0,2000)||null};
  if(p.title!==null&&p.title!==undefined){var t=prompt('Edit the title',p.title);if(t!==null&&t.trim())upd.title=t.trim().slice(0,120)}
  var r=await sb.from('posts').update(upd).eq('id',p.id);
  if(r.error){toast('Could not save your changes');return}
  Object.assign(p,upd);renderPosts();toast('Post updated ✅');
}
var _om2=openMore;
openMore=function(i){_om2(i);var p=posts[i];if(p&&p.author_id===me.id)$('#mbody').insertAdjacentHTML('afterbegin',`<button class="mi" onclick="editPost(${i})"><em>✏️</em>Edit post</button>`)};
async function viewAdmin(){
  if(!prof.is_admin){back();return}
  $('#view').innerHTML=sub('🛡️ Admin')+`<div class="pad"><p class="mute" style="margin-bottom:8px">Verify or ban a user by username</p><input id="au" class="sb" placeholder="username"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="pill" onclick="adminUser('verify',true)">✅ Verify</button><button class="pill" onclick="adminUser('verify',false)">Remove badge</button><button class="pill" onclick="adminUser('ban',true)">⛔ Ban</button><button class="pill" onclick="adminUser('ban',false)">Unban</button></div></div><div class="sub">Open reports</div><div id="rp"><div class="empty">Loading…</div></div>`;
  var r=await sb.from('reports').select('id,reason,created_at,post_id,comment_id,user_id,reporter:profiles!reporter_id(username),reported:profiles!user_id(username,display_name),comments(id,body,author_id),posts(id,author_id,kind,title,caption,profiles(username,display_name))').eq('status','open').order('created_at',{ascending:false}).limit(50);
  var b=$('#rp');if(!b)return;
  if(r.error){b.innerHTML='<div class="empty">Could not load reports.</div>';return}
  b.innerHTML=(r.data||[]).map(function(x){
    var po=x.posts,co=x.comments,us=x.reported,what,btns;
    if(po){what='<b>Post by @'+esc((po.profiles||{}).username||'?')+'</b><p style="margin:6px 0">'+esc((po.title||po.caption||'(media only)').slice(0,160))+'</p>';btns=`<button class="pill" onclick="adminDel('${x.id}','${x.post_id}')">Delete post</button><button class="pill" onclick="adminBan('${po.author_id}')">Ban author</button>`}
    else if(co){what='<b>Comment</b><p style="margin:6px 0">'+esc((co.body||'').slice(0,160))+'</p>';btns=`<button class="pill" onclick="adminDelC('${x.id}','${co.id}')">Delete comment</button><button class="pill" onclick="adminBan('${co.author_id}')">Ban author</button>`}
    else{what='<b>Account @'+esc((us||{}).username||'?')+'</b>';btns=`<button class="pill" onclick="adminBan('${x.user_id}')">Ban user</button>`}
    return `<div class="pad" style="border-bottom:1px solid var(--line)">${what}<p class="mute" style="margin-bottom:8px">Reported by @${esc((x.reporter||{}).username||'?')}: ${esc(x.reason||'no reason given')}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${btns}<button class="pill" onclick="adminResolve('${x.id}')">Dismiss</button></div></div>`}).join('')||'<div class="empty">No open reports. 🎉</div>';
}
async function adminDelC(rid,cid){if(!confirm('Delete this comment?'))return;var r=await sb.from('comments').delete().eq('id',cid);toast(r.error?'Could not delete':'Comment deleted');viewAdmin()}

/* ---- connection and error handling ---- */
(function(){
  var bar=null,last=0;
  function off(on){if(!bar){bar=document.createElement('div');bar.id='offbar';bar.textContent='You are offline';document.body.appendChild(bar)}bar.style.display=on?'block':'none'}
  window.addEventListener('offline',function(){off(true)});
  window.addEventListener('online',function(){off(false);toast('Back online ✅');if(me)refreshView()});
  if(navigator.onLine===false)off(true);
  window.addEventListener('unhandledrejection',function(e){if(Date.now()-last<6000)return;last=Date.now();try{console.warn(e.reason)}catch(x){}toast('Something went wrong. Pull down to refresh.')});
  var h=$('#hav');if(h)h.setAttribute('aria-label','Menu');
  document.querySelectorAll('nav [data-t]').forEach(function(b){b.setAttribute('aria-label',b.innerText.trim())});
})();

Object.assign(FR,{'Your story':'Votre story','Add to your story':'Ajouter à votre story','Photo or video. It disappears after 24 hours.':'Photo ou vidéo. Disparaît après 24 heures.','Write something, or make a text story':'Écrivez quelque chose, ou créez une story texte','Share to story':'Partager en story','Sharing…':'Partage…','Story shared ✨':'Story partagée ✨','📖 Story (24 hours)':'📖 Story (24 heures)','🗑️ Delete':'🗑️ Supprimer','👁 Views':'👁 Vues','Views':'Vues','No views yet.':'Aucune vue pour le moment.','Reply sent ✉️':'Réponse envoyée ✉️','📺 Series':'📺 Séries','📺 Episodes':'📺 Épisodes','Series name (optional)':'Nom de la série (facultatif)','Episode number':'Numéro d’épisode','Edit post':'Modifier la publication','Report user':'Signaler l’utilisateur','Report':'Signaler','Post updated ✅':'Publication mise à jour ✅','You are offline':'Vous êtes hors ligne','Back online ✅':'De nouveau en ligne ✅','Something went wrong. Pull down to refresh.':'Une erreur s’est produite. Tirez vers le bas pour actualiser.','Story unavailable':'Story indisponible','Delete comment':'Supprimer le commentaire','Ban user':'Bannir l’utilisateur'});


/* ======================= BATCH 5: speed, messaging, profile, shop, reels ======================= */
var rawFrom=sb.from.bind(sb);
/* ---- fast: short-lived read cache (cleared after any write) ---- */
(function(){
  var C={},TTL=20000,W={insert:1,update:1,delete:1,upsert:1};
  window.cacheClear=function(){C={}};
  sb.from=function(table){
    var calls=[],wrote=false,q=rawFrom(table);
    var p=new Proxy({},{get:function(_,k){
      if(k==='then')return function(res,rej){return run().then(res,rej)};
      if(k==='catch')return function(f){return run().catch(f)};
      if(k==='finally')return function(f){return run().finally(f)};
      return function(){var a=Array.prototype.slice.call(arguments);if(W[k])wrote=true;calls.push([k,a]);q=q[k].apply(q,a);return p};
    }});
    function run(){
      if(wrote)return Promise.resolve(q).then(function(r){C={};return r});
      var key=table+JSON.stringify(calls),hit=C[key];
      if(hit&&Date.now()-hit.t<TTL)return Promise.resolve(JSON.parse(hit.j));
      return Promise.resolve(q).then(function(r){if(r&&!r.error&&calls.length&&calls[0][0]==='select'){try{C[key]={t:Date.now(),j:JSON.stringify(r)}}catch(e){}}return r});
    }
    return p;
  };
  var rr=sb.rpc.bind(sb);
  sb.rpc=function(n,a){var r=rr(n,a);if(n==='subscriber_count'||n==='has_bought')return r;return Promise.resolve(r).then(function(x){C={};return x})};
})();
var _rv=refreshView;refreshView=function(){cacheClear();_rv()};
var _lo=logout;logout=async function(){cacheClear();stopPoll();return _lo()};
var _boot2=boot;boot=function(sn){if(!me||(sn&&sn.user&&sn.user.id!==me.id))cacheClear();return _boot2(sn)};
/* ---- keep scroll position when going back ---- */
var _open=open;open=function(v,a){var t=stack[stack.length-1];if(t)t.sy=window.scrollY;_open(v,a)};
back=function(){if(stack.length<2)return;stack.pop();var y=stack[stack.length-1].sy||0;render();setTimeout(function(){window.scrollTo(0,y)},80);setTimeout(function(){window.scrollTo(0,y)},350)};
/* ---- keyboard-aware bottom bars ---- */
if(window.visualViewport){var vv=window.visualViewport,kbf=function(){document.documentElement.style.setProperty('--kb',Math.max(0,window.innerHeight-vv.height-vv.offsetTop)+'px')};vv.addEventListener('resize',kbf);vv.addEventListener('scroll',kbf)}

/* ---- screen modes and polling cleanup ---- */
var chatLast='1970-01-01T00:00:00Z',chatTimer=null,seenIds={},lastDay='',failed={},lastChatSig='';
function stopPoll(){if(chatTimer){clearInterval(chatTimer);chatTimer=null}}
function startPoll(fn,ms){stopPoll();chatTimer=setInterval(function(){if(!document.hidden)fn()},ms)}
var _render3=render;
render=function(){
  var c=stack[stack.length-1][0];
  if(c!=='chat'&&c!=='space'&&c!=='msgs')stopPoll();
  document.body.classList.toggle('chatmode',c==='chat'||c==='space');
  document.body.classList.toggle('reelmode',c==='home'&&homeTab==='reel');
  _render3();
};
var _vh2=viewHome;
viewHome=function(){document.body.classList.toggle('reelmode',homeTab==='reel');_vh2()};

/* ======================= MESSAGING ======================= */
function msgText(t){return esc(t).replace(/(https?:\/\/[^\s<]+)/g,function(u){return '<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>'})}
function hhmm(t){return new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function dayLabel(t){var d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);if(d.toDateString()===n.toDateString())return 'Today';if(d.toDateString()===y.toDateString())return 'Yesterday';return d.toLocaleDateString([],{day:'numeric',month:'short',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})}
function nearBottom(){return document.documentElement.scrollHeight-window.scrollY-window.innerHeight<280}
function pushBub(m,mine,name){
  var b=$('#bubs');if(!b)return null;
  if(!m.pending&&mine){var pe=b.querySelector('.bub.pending');if(pe&&pe.dataset.body===(m.body||'')&&m.id&&!seenIds[m.id]){pe.dataset.id=m.id;pe.classList.remove('pending');seenIds[m.id]=1;var tk=pe.querySelector('.tk');if(tk)tk.textContent=m.read_at?'✓✓ Seen':'✓ Sent';return pe}}
  if(m.id&&seenIds[m.id])return null;if(m.id)seenIds[m.id]=1;
  var stick=nearBottom()||mine,dl=dayLabel(m.created_at);
  if(dl!==lastDay){lastDay=dl;b.insertAdjacentHTML('beforeend','<div class="dsep">'+dl+'</div>')}
  var d=document.createElement('div');d.className='bub '+(mine?'me':'th')+(m.pending?' pending':'');d.dataset.id=m.id||'';d.dataset.body=m.body||'';
  var un=(mine&&!m.pending&&chatCtx&&chatCtx.kind==='dm'&&m.id)?' · <a onclick="unsend(\''+m.id+'\')">Unsend</a>':'';
  d.innerHTML=bubHtml(m,mine,name)+'<span class="tick">'+(mine?'<span class="tk">'+(m.pending?'Sending…':(m.read_at?'✓✓ Seen':'✓ Sent'))+'</span> · ':'')+hhmm(m.created_at)+'<span class="un">'+un+'</span></span>';
  b.appendChild(d);if(stick)window.scrollTo(0,document.body.scrollHeight);return d;
}
addBub=function(m){return pushBub(m,m.sender_id===me.id)};
addSpaceBub=function(m){var mine=m.sender_id===me.id,p=m.profiles||{};return pushBub(m,mine,mine?'':(p.display_name||p.username||'User'))};
async function sendMsg(body,url,kind){
  var c=chatCtx;if(!c)return false;
  var tmp='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  var m={id:tmp,sender_id:me.id,body:body,media_url:url||null,media_kind:kind||null,created_at:new Date().toISOString(),pending:true,profiles:prof};
  if(c.kind==='dm')addBub(m);else addSpaceBub(m);
  var row=c.kind==='dm'?{sender_id:me.id,recipient_id:c.id,body:body,media_url:url||null,media_kind:kind||null}:{space_id:c.id,sender_id:me.id,body:body,media_url:url||null,media_kind:kind||null};
  var r=await sb.from(c.kind==='dm'?'messages':'space_messages').insert(row).select().single();
  var el=document.querySelector('.bub[data-id="'+tmp+'"]');
  if(r.error||!r.data){failed[tmp]={body:body,url:url,kind:kind};if(el){el.classList.remove('pending');el.classList.add('fail');var t1=el.querySelector('.tick');if(t1)t1.innerHTML='Not sent · <a class="rt" onclick="retrySend(\''+tmp+'\')">Retry</a> · <a onclick="this.closest(\'.bub\').remove()">Delete</a>'}toast(((r.error&&r.error.message)||'Could not send').replace(/^.*?:\s*/,''));return false}
  seenIds[r.data.id]=1;
  if(el){el.dataset.id=r.data.id;el.classList.remove('pending');var tk=el.querySelector('.tk');if(tk)tk.textContent='✓ Sent';var un=el.querySelector('.un');if(un&&c.kind==='dm')un.innerHTML=' · <a onclick="unsend(\''+r.data.id+'\')">Unsend</a>'}
  return true;
}
function retrySend(id){var f=failed[id];if(!f)return;var e=document.querySelector('.bub[data-id="'+id+'"]');if(e)e.remove();delete failed[id];sendMsg(f.body,f.url,f.kind)}
msend=async function(){var i=$('#min'),v=i&&i.value.trim();if(!v)return;i.value='';i.focus();await sendMsg(v)};
function chatHead(uid,p){
  var n=esc(p.display_name||p.username||'Chat');
  return `<div class="chead"><button onclick="back()" aria-label="Back">⬅️</button><span id="cav" onclick="openUser('${uid}')">${avHtml(p,34)}</span><b id="chn" onclick="openUser('${uid}')">${n}</b></div>`;
}
viewChat=async function(uid){
  chatCtx={kind:'dm',id:uid};seenIds={};lastDay='';chatLast='1970-01-01T00:00:00Z';
  $('#view').innerHTML=chatHead(uid,profCache[uid]||{})+'<div class="pad"><div id="bubs"></div></div>'+composer();
  var cols='id,sender_id,recipient_id,body,read_at,media_url,media_kind,created_at',pair=`and(sender_id.eq.${me.id},recipient_id.eq.${uid}),and(sender_id.eq.${uid},recipient_id.eq.${me.id})`;
  var r=await Promise.all([profileOf(uid),sb.from('messages').select(cols).or(pair).order('created_at',{ascending:false}).limit(100)]);
  if(!chatCtx||chatCtx.id!==uid||!$('#bubs'))return;
  var p=r[0]||{},n=$('#chn'),a=$('#cav');if(n)n.textContent=p.display_name||p.username||'Chat';if(a)a.innerHTML=avHtml(p,34);
  (r[1].data||[]).reverse().forEach(function(m){addBub(m);chatLast=m.created_at});
  window.scrollTo(0,document.body.scrollHeight);markRead(uid);
  startPoll(function(){pollChat(uid,cols,pair)},4000);
};
async function pollChat(uid,cols,pair){
  if(!chatCtx||chatCtx.kind!=='dm'||chatCtx.id!==uid)return;
  var r=await Promise.all([rawFrom('messages').select(cols).or(pair).gt('created_at',chatLast).order('created_at',{ascending:true}).limit(50),
    rawFrom('messages').select('id,read_at').eq('sender_id',me.id).eq('recipient_id',uid).not('read_at','is',null).order('created_at',{ascending:false}).limit(15)]);
  if(!chatCtx||chatCtx.id!==uid)return;
  var got=false;(r[0].data||[]).forEach(function(m){chatLast=m.created_at;var mine=m.sender_id===me.id;if(!mine&&!seenIds[m.id])got=true;addBub(m)});
  (r[1].data||[]).forEach(tickSeen);if(got){cacheClear();markRead(uid)}
}
/* conversation list: instant, filterable, quietly refreshed */
function filterChats(q){q=(q||'').toLowerCase().trim();document.querySelectorAll('#mlist .row').forEach(function(r){r.classList.toggle('hide',!!q&&(r.dataset.n||'').indexOf(q)<0)})}
async function loadChats(fresh){
  var r=await (fresh?rawFrom:sb.from)('messages').select('id,sender_id,recipient_id,body,read_at,media_kind,created_at').or(`sender_id.eq.${me.id},recipient_id.eq.${me.id}`).order('created_at',{ascending:false}).limit(300);
  var box=$('#mlist');if(!box||cv()!=='msgs')return;
  if(r.error){if(!fresh)box.innerHTML='<div class="empty">Could not load messages.</div>';return}
  var conv={},order=[];
  (r.data||[]).forEach(function(m){var o=m.sender_id===me.id?m.recipient_id:m.sender_id;if(!conv[o]){conv[o]={last:m,unread:0};order.push(o)}if(m.recipient_id===me.id&&!m.read_at)conv[o].unread++});
  order=order.filter(function(o){return blockMap[o]!=='block'});
  var sig=order.map(function(o){return o+conv[o].last.id+conv[o].unread+(conv[o].last.read_at?1:0)}).join('|');
  if(fresh&&sig===lastChatSig)return;lastChatSig=sig;
  if(!order.length){box.innerHTML='<div class="empty">No messages yet.<br>Tap the button below to message someone.</div><div class="pad"><button class="big" onclick="openNewMsg()">New message</button></div>';return}
  var miss=order.filter(function(o){return !profCache[o]||!profCache[o].username});
  if(miss.length){var pr=await sb.from('profiles').select('id,username,display_name,avatar_url,is_verified').in('id',miss);(pr.data||[]).forEach(function(p){profCache[p.id]=p})}
  if(!$('#mlist')||cv()!=='msgs')return;
  $('#mlist').innerHTML=order.map(function(o){var p=profCache[o]||{},c=conv[o],nm=p.display_name||p.username||'User';
    return `<button class="row${c.unread?' un':''}" data-n="${esc((nm+' '+(p.username||'')).toLowerCase())}" onclick="open('chat','${o}')">${avHtml(p)}<div class="t"><b>${esc(nm)}${p.is_verified?' ✅':''}</b><small>${c.last.sender_id===me.id?'You: ':''}${esc(msgPreview(c.last))}</small></div><small class="mute">${ago(c.last.created_at)}</small>${c.unread?'<i class="dot"></i>':''}</button>`}).join('');
  var q=$('#mfq');if(q&&q.value)filterChats(q.value);
}
viewMsgs=async function(){
  if(cv()!=='msgs')return;
  if(!$('#mlist')){lastChatSig='';$('#view').innerHTML=sub('Messages')+'<div class="chips2"><button class="on">Chats</button><button onclick="open(\'spaces\')">Spaces</button></div><div class="pad" style="padding-bottom:0"><input id="mfq" class="sb" style="margin:0" placeholder="Search chats" oninput="filterChats(this.value)"></div><div id="mlist"><div class="empty">Loading…</div></div><button class="fab" onclick="openNewMsg()" aria-label="New message">'+ic('mail')+'<i>+</i></button>'}
  await loadChats(false);startPoll(function(){loadChats(true)},8000);
};

/* ======================= SPACES ======================= */
viewSpace=async function(id){
  chatCtx=null;seenIds={};lastDay='';chatLast='1970-01-01T00:00:00Z';
  $('#view').innerHTML=`<div class="chead"><button onclick="back()" aria-label="Back">⬅️</button><b id="chn" style="flex:1">Space</b><button onclick="open('members','${id}')" aria-label="Members">👥</button><button onclick="spaceMenu('${id}')" aria-label="More">${ic('more')}</button></div><div id="sp"><div class="empty">Loading…</div></div>`;
  var r=await Promise.all([sb.from('spaces').select('*').eq('id',id).maybeSingle(),sb.from('space_members').select('role').eq('space_id',id).eq('user_id',me.id).maybeSingle()]);
  var sp=r[0].data,m=r[1].data,box=$('#sp');if(!box)return;
  if(!sp){box.innerHTML='<div class="empty">This space is private or no longer exists.</div>';return}
  var n=$('#chn');if(n)n.innerHTML=SPI[sp.kind]+' '+esc(sp.name)+'<small class="mute" style="display:block;font-weight:400">'+sp.member_count+' members · '+sp.kind+'</small>';
  var info=sp.description?`<div class="pad" style="color:var(--mute)">${esc(sp.description)}</div>`:'';
  if(!m){box.innerHTML=info+`<div class="pad"><button class="big" onclick="joinSpace('${id}')">Join this ${sp.kind}</button></div>`;return}
  var can=(sp.kind!=='channel'||m.role==='owner'||m.role==='admin');
  box.innerHTML=info+'<div class="pad"><div id="bubs"></div></div>'+(can?composer():'<div class="comp" style="justify-content:center"><span class="mute">Only admins can post in this channel.</span></div>');
  chatCtx={kind:'space',id:id,owner:sp.owner_id===me.id};
  var cols='id,sender_id,body,media_url,media_kind,created_at,profiles(username,display_name)';
  var ms=await sb.from('space_messages').select(cols).eq('space_id',id).order('created_at',{ascending:false}).limit(100);
  if(!chatCtx||chatCtx.id!==id||!$('#bubs'))return;
  (ms.data||[]).reverse().forEach(function(x){addSpaceBub(x);chatLast=x.created_at});window.scrollTo(0,document.body.scrollHeight);
  if(spaceCh){sb.removeChannel(spaceCh);spaceCh=null}
  spaceCh=sb.channel('sp-'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'space_messages',filter:'space_id=eq.'+id},async function(p){var x=p.new;if(seenIds[x.id])return;x.profiles=await profileOf(x.sender_id);addSpaceBub(x)}).subscribe();
  startPoll(function(){pollSpace(id,cols)},4000);
};
VIEWS.space=viewSpace;
async function pollSpace(id,cols){
  if(!chatCtx||chatCtx.kind!=='space'||chatCtx.id!==id)return;
  var r=await rawFrom('space_messages').select(cols).eq('space_id',id).gt('created_at',chatLast).order('created_at',{ascending:true}).limit(50);
  if(!chatCtx||chatCtx.id!==id)return;
  (r.data||[]).forEach(function(x){chatLast=x.created_at;addSpaceBub(x)});
}
function spaceMenu(id){
  var own=chatCtx&&chatCtx.owner;
  $('#mbody').innerHTML=`<button class="mi" onclick="closeSheets();copyLink(location.origin+location.pathname+'#s-${id}')"><em>🔗</em>Invite link</button><button class="mi" onclick="closeSheets();open('members','${id}')"><em>👥</em>Members</button><button class="mi" onclick="closeSheets();leaveSpace('${id}')"><em>🚪</em>Leave space</button>${own?`<button class="mi" onclick="closeSheets();delSpace('${id}')"><em>🗑️</em>Delete space</button>`:''}`;
  $('#msheet').classList.add('show');
}
async function viewMembers(id){
  $('#view').innerHTML=sub('👥 Members')+'<div id="mm"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('space_members').select('role,user_id,profiles(id,username,display_name,avatar_url,is_verified)').eq('space_id',id).order('joined_at'),sb.from('spaces').select('owner_id').eq('id',id).maybeSingle()]);
  var b=$('#mm');if(!b)return;var own=r[1].data&&r[1].data.owner_id===me.id;
  b.innerHTML=(r[0].data||[]).map(function(x){var p=x.profiles||{};return `<div class="row"><span onclick="openUser('${x.user_id}')">${avHtml(p)}</span><div class="t" onclick="openUser('${x.user_id}')"><b>${esc(p.display_name||p.username||'User')}${p.is_verified?' ✅':''}</b><small>@${esc(p.username||'')} · ${x.role}</small></div>${own&&x.user_id!==me.id?`<button class="pill" onclick="removeMember('${id}','${x.user_id}')">Remove</button>`:''}</div>`}).join('')||'<div class="empty">No members.</div>';
}
async function removeMember(sid,uid){if(!confirm('Remove this member?'))return;var r=await sb.from('space_members').delete().eq('space_id',sid).eq('user_id',uid);toast(r.error?'Could not remove':'Removed');viewMembers(sid)}
VIEWS.members=viewMembers;
routeHash=async function(){
  if(!me)return;var h=location.hash,m=h.match(/^#p-([0-9a-f-]{36})$/i),u=h.match(/^#u-([a-z0-9_]{3,30})$/i),sp=h.match(/^#s-([0-9a-f-]{36})$/i);
  if(m){stack=[['home'],['post',m[1]]];render();history.replaceState(null,'',location.pathname+location.search)}
  else if(sp){stack=[['msgs'],['spaces'],['space',sp[1]]];render();history.replaceState(null,'',location.pathname+location.search)}
  else if(u){var r=await sb.from('profiles').select('id').eq('username',u[1].toLowerCase()).maybeSingle();history.replaceState(null,'',location.pathname+location.search);if(r.data){stack=[['home'],['user',r.data.id]];render()}else toast('User not found')}
};

/* ======================= FOLLOWERS, FOLLOWING ======================= */
async function viewPeople(arg){
  var a=arg.split('|'),uid=a[0],tab=a[1]||'followers',mine=uid===me.id,tabs=[['followers','Followers'],['following','Following']];if(mine)tabs.push(['subs','Subscribers']);
  $('#view').innerHTML=sub(esc(names[uid]||'People'))+'<div class="chips2">'+tabs.map(function(t){return `<button class="${t[0]===tab?'on':''}" onclick="stack[stack.length-1]=['people','${uid}|${t[0]}'];render()">${t[1]}</button>`}).join('')+'</div><div id="pl2"><div class="empty">Loading…</div></div>';
  var pc='id,username,display_name,avatar_url,is_verified',q;
  if(tab==='followers')q=sb.from('follows').select('profiles!follower_id('+pc+')').eq('following_id',uid).order('created_at',{ascending:false}).limit(200);
  else if(tab==='following')q=sb.from('follows').select('profiles!following_id('+pc+')').eq('follower_id',uid).order('created_at',{ascending:false}).limit(200);
  else q=sb.from('subscriptions').select('status,profiles!subscriber_id('+pc+')').eq('creator_id',me.id).order('created_at',{ascending:false}).limit(200);
  var r=await q,b=$('#pl2');if(!b)return;
  if(r.error){b.innerHTML='<div class="empty">Could not load this list.</div>';return}
  var l=(r.data||[]).filter(function(x){return x.profiles&&!blockMap[x.profiles.id]});
  b.innerHTML=l.map(function(x){var p=x.profiles,f=follows.has(p.id);
    return `<div class="row"><span onclick="openUser('${p.id}')">${avHtml(p)}</span><div class="t" onclick="openUser('${p.id}')"><b>${esc(p.display_name||p.username)}${p.is_verified?' ✅':''}</b><small>@${esc(p.username)}${x.status?' · '+(x.status==='active'?'subscriber':'on waitlist'):''}</small></div>${p.id===me.id?'':`<button class="pill${f?' on':''}" onclick="peopleFollow('${p.id}',this)">${f?'Following':'Follow'}</button>`}</div>`}).join('')||'<div class="empty">'+(tab==='subs'?'No subscribers yet. Subscriptions start when payments launch.':'Nobody here yet.')+'</div>';
}
async function peopleFollow(uid,btn){
  var has=follows.has(uid),r=has?await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',uid):await sb.from('follows').insert({follower_id:me.id,following_id:uid});
  if(r.error){toast('Could not update');return}
  if(has)follows.delete(uid);else follows.add(uid);btn.textContent=has?'Follow':'Following';btn.classList.toggle('on',!has);
}
VIEWS.people=viewPeople;

/* ======================= PROFILE ======================= */
function productGrid(l){
  return '<div class="pgrid">'+l.map(function(p){
    var img=okUrl(p.media_url)?`<img src="${esc(p.media_url)}" alt="" loading="lazy" decoding="async">`:'<div class="pimg">🛍️</div>';
    return `<div class="pc" onclick="open('product','${p.id}')">${img}<div class="pi"><b>$${((p.price_cents||0)/100).toFixed(2)}</b><div class="pt">${esc(p.title||p.caption||'Product')}</div><small>${p.rating?'★ '+p.rating+' · ':''}${p.stock===0?'Sold out':esc(p.display_name||p.username||'')}</small></div>${p.author_id===me.id||p.stock===0?'':`<button class="pcb" onclick="event.stopPropagation();addToCart('${p.id}')" aria-label="Add to cart">${ic('cart')}</button>`}</div>`}).join('')+'</div>';
}
function posterGrid(l){return '<div class="pgrid pg3">'+l.map(function(p){return `<button class="pst" style="width:auto" onclick="open('watch','${p.id}')">${coverHtml(p)}<small>${esc(p.title||'Untitled')}</small></button>`}).join('')+'</div>'}
async function loadProfTab(uid,t){
  stack[stack.length-1].tab=t;
  document.querySelectorAll('.tabs2 button').forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});
  var box=$('#ptab');if(!box)return;box.innerHTML='<div class="empty">Loading…</div>';
  var data=[];
  if(t==='likes'){var l=await sb.from('likes').select('post_id').eq('user_id',uid).eq('value',1).order('created_at',{ascending:false}).limit(40),ids=(l.data||[]).map(function(x){return x.post_id});if(ids.length){var f=await sb.from('feed').select('*').in('id',ids);var mp={};(f.data||[]).forEach(function(p){mp[p.id]=p});data=ids.map(function(i){return mp[i]}).filter(Boolean)}}
  else{
    var q=sb.from('feed').select('*').eq('author_id',uid).order('created_at',{ascending:false}).limit(40);
    if(t==='reels')q=q.in('kind',['reel','video']);else if(t==='music')q=q.eq('kind','music');else if(t==='movies')q=q.eq('kind','movie');else if(t==='shop')q=q.eq('kind','product');
    var r=await q;data=r.data||[];
  }
  if(!$('#ptab')||(stack[stack.length-1].tab!==t))return;
  data=data.filter(function(p){return !blockMap[p.author_id]});posts=data;ptarget='#ptab';listMode='';
  if(!data.length){box.innerHTML='<div class="empty">'+({posts:'No posts yet.',reels:'No reels yet.',music:'No music yet.',movies:'No movies yet.',shop:'No products yet.',likes:'No likes yet.'}[t])+'</div>';return}
  if(t==='movies')box.innerHTML=posterGrid(data);
  else if(t==='shop')box.innerHTML=productGrid(data);
  else{if(t==='music')listMode='tracks';renderPosts()}
}
viewUser=async function(uid){
  var mine=uid===me.id,tab=stack[stack.length-1].tab||'posts',cached=mine?prof:profCache[uid];
  if(!$('#ph0')||$('#ph0').dataset.u!==uid)$('#view').innerHTML=sub(esc((cached&&(cached.display_name||cached.username))||'Profile'))+'<div id="ph0" data-u="'+uid+'"><div class="empty">Loading…</div></div>';
  var c=await Promise.all([mine?Promise.resolve({data:prof}):sb.from('profiles').select('*').eq('id',uid).maybeSingle(),
    sb.from('posts').select('*',{count:'exact',head:true}).eq('author_id',uid),sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',uid),
    sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',uid),sb.rpc('subscriber_count',{uid:uid})]);
  var pr=c[0].data,hd=$('#ph0');if(!hd||hd.dataset.u!==uid)return;
  if(!pr){hd.innerHTML='<div class="empty">This profile could not be found.</div>';return}
  profCache[uid]=pr;var name=pr.display_name||pr.username,fol=follows.has(uid);names[uid]=name;
  var btns=mine?`<div style="display:flex;gap:6px"><button class="pill" onclick="openEdit()">Edit profile</button><button class="pill" data-sh onclick="shareProfile('${esc(pr.username)}')">Share</button></div>`:
    `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="dots" onclick="userMenu('${uid}')" aria-label="More">${ic('more')}</button><button class="pill" onclick="open('chat','${uid}')">✉️ Message</button><button class="pill${fol?' on':''}" onclick="toggleFollow('${uid}')">${fol?'Following':'Follow'}</button>${subPill(uid)}</div>`;
  var tabs=[['posts','Posts'],['reels','Reels'],['music','Music'],['movies','Movies'],['shop','Shop']];if(mine)tabs.push(['likes','Likes']);
  var joined=pr.created_at?new Date(pr.created_at).toLocaleDateString([],{month:'long',year:'numeric'}):'';
  hd.innerHTML=`<div class="cover"></div><div class="pr">${avHtml(pr)}${btns}</div><div class="pad"><b style="font-size:19px">${esc(name)}${pr.is_verified?' ✅':''}</b><div class="mute">@${esc(pr.username)}${joined?' · Joined '+joined:''}</div>${pr.bio?`<p style="margin-top:8px;line-height:1.5">${linkify(pr.bio)}</p>`:''}
  <div class="stat"><div class="clk" onclick="open('people','${uid}|followers')"><b>${fmt(c[2].count||0)}</b><small>Followers</small></div><div class="clk" onclick="open('people','${uid}|following')"><b>${fmt(c[3].count||0)}</b><small>Following</small></div><div class="clk" onclick="${mine?`open('people','${uid}|subs')`:`openSub('${uid}')`}"><b>${Number(c[4].data)||0}</b><small>Subscribers</small></div><div class="clk" onclick="loadProfTab('${uid}','posts')"><b>${fmt(c[1].count||0)}</b><small>Posts</small></div></div></div>
  <div class="tabs2">${tabs.map(function(t){return `<button data-t="${t[0]}" class="${t[0]===tab?'on':''}" onclick="loadProfTab('${uid}','${t[0]}')">${t[1]}</button>`}).join('')}</div><div id="ptab"></div>`;
  loadProfTab(uid,tab);
};

/* ======================= SHOP ======================= */
var shopSort='new',shopQ='',shopCache=[],shopMine={};
var _lf2=loadFeed;
loadFeed=function(more){if(homeTab==='shop'&&more!==true){ptarget='#plist';listMode='';var m=$('#more');if(m)m.innerHTML='';loadShop();return}return _lf2(more)};
async function loadShop(){
  var box=$('#plist');if(!box)return;
  box.innerHTML=`<div class="pad" style="padding-bottom:6px"><div style="display:flex;gap:8px"><input id="shq" class="sb" style="margin:0" placeholder="Search products and sellers" value="${esc(shopQ)}" oninput="shopFilter(this.value)"><button class="pill on" onclick="open('cart')" aria-label="Cart">${ic('cart')} <span id="cartn"></span></button></div><div class="chips2" style="padding:10px 0 0">${[['new','Newest'],['low','Price: low'],['high','Price: high'],['top','Top rated']].map(function(x){return `<button class="${shopSort===x[0]?'on':''}" onclick="shopSort='${x[0]}';loadShop()">${x[1]}</button>`}).join('')}</div></div><div id="pgl"><div class="empty">Loading…</div></div>`;
  var r=await sb.from('feed').select('*').eq('kind','product').order('created_at',{ascending:false}).limit(80);
  if(!$('#pgl'))return;
  shopCache=(r.data||[]).filter(function(p){return !blockMap[p.author_id]});shopRender();
  sb.from('cart_items').select('qty').eq('user_id',me.id).then(function(x){var n=0;(x.data||[]).forEach(function(i){n+=i.qty});var e=$('#cartn');if(e)e.textContent=n||''});
}
function shopFilter(v){shopQ=v;shopRender()}
function shopRender(){
  var q=shopQ.trim().toLowerCase(),l=shopCache.filter(function(p){return !q||((p.title||'')+' '+(p.caption||'')+' '+(p.username||'')+' '+(p.display_name||'')).toLowerCase().indexOf(q)>-1});
  if(shopSort==='low')l.sort(function(a,b){return a.price_cents-b.price_cents});else if(shopSort==='high')l.sort(function(a,b){return b.price_cents-a.price_cents});else if(shopSort==='top')l.sort(function(a,b){return (Number(b.rating)||0)-(Number(a.rating)||0)});
  var b=$('#pgl');if(b)b.innerHTML=l.length?productGrid(l):'<div class="empty">No products found.<br>Sellers can add one from My Shop. 🛍️</div>';
}
async function viewMyShop(){
  $('#view').innerHTML=sub('🏪 My Shop')+'<div id="ms"><div class="empty">Loading…</div></div>';
  var r=await Promise.all([sb.from('feed').select('*').eq('author_id',me.id).eq('kind','product').order('created_at',{ascending:false}).limit(100),
    sb.from('orders').select('id,status,total_cents,created_at,buyer_id,buyer:profiles!buyer_id(username,display_name),order_items(title,qty)').eq('seller_id',me.id).order('created_at',{ascending:false}).limit(30)]);
  var b=$('#ms');if(!b)return;
  var ps=r[0].data||[],os=r[1].data||[];shopMine={};ps.forEach(function(p){shopMine[p.id]=p});
  var act=os.filter(function(o){return ['placed','confirmed','shipped'].indexOf(o.status)>-1}),rev=0;os.forEach(function(o){if(o.status==='delivered')rev+=o.total_cents});
  var rated=ps.filter(function(p){return p.rating}),avg=rated.length?(rated.reduce(function(a,p){return a+Number(p.rating)},0)/rated.length).toFixed(1):null;
  var nx={placed:['confirmed','Confirm'],confirmed:['shipped','Mark shipped'],shipped:['delivered','Mark delivered']};
  b.innerHTML=`<div class="pad"><div style="display:flex;gap:12px;align-items:center">${avHtml(prof,52)}<div><b style="font-size:18px">${esc(prof.display_name||prof.username)}${prof.is_verified?' ✅':''}</b><div class="mute">${prof.is_verified?'Verified seller':'Seller'}${avg?' · ★ '+avg:''}</div></div></div>
  <div class="stat"><div><b>${ps.length}</b><small>Products</small></div><div><b>${act.length}</b><small>Open orders</small></div><div><b>$${(rev/100).toFixed(2)}</b><small>Delivered sales</small></div></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill on" onclick="startProduct()">➕ Add product</button><button class="pill" onclick="ordTab='sales';open('orders')">📦 All orders</button><button class="pill" onclick="open('dashboard')">📊 Dashboard</button><button class="pill" onclick="open('cart')">🛒 Cart</button></div></div>
  <div class="sub">Orders to handle</div>${act.map(function(o){var n=nx[o.status],bu=o.buyer||{};return `<div class="pad" style="border-bottom:1px solid var(--line)"><b>#${o.id.slice(0,6).toUpperCase()}</b> · ${esc(o.status)} · $${(o.total_cents/100).toFixed(2)}<div class="mute">${esc(bu.display_name||bu.username||'Buyer')} · ${(o.order_items||[]).map(function(i){return i.qty+'× '+esc(i.title)}).join(', ')}</div><div style="display:flex;gap:6px;margin-top:6px"><button class="pill on" onclick="shopOrd('${o.id}','${n[0]}')">${n[1]}</button><button class="pill" onclick="open('chat','${o.buyer_id}')">✉️ Message</button></div></div>`}).join('')||'<div class="empty">No open orders.</div>'}
  <div class="sub">My products</div>${ps.length?'<div class="pgrid">'+ps.map(function(p){return `<div class="pc" onclick="open('product','${p.id}')">${okUrl(p.media_url)?`<img src="${esc(p.media_url)}" alt="" loading="lazy">`:'<div class="pimg">🛍️</div>'}<div class="pi"><b>$${((p.price_cents||0)/100).toFixed(2)}</b><div class="pt">${esc(p.title||'Product')}</div><small>${p.stock===null?'Unlimited':(p.stock===0?'Sold out':p.stock+' left')} · 👁 ${fmt(p.view_count)}</small></div><div class="pcr"><button onclick="event.stopPropagation();editProduct('${p.id}')">Edit</button><button onclick="event.stopPropagation();delProduct('${p.id}')">Delete</button></div></div>`}).join('')+'</div>':'<div class="empty">You have no products yet.<br>Tap Add product to start selling. 🛍️</div>'}`;
}
VIEWS.myshop=viewMyShop;
function startProduct(){openDrop();$('#dk').value='product';kindChange()}
async function shopOrd(id,st){var r=await sb.rpc('set_order_status',{oid:id,st:st});if(r.error){toast((r.error.message||'Could not update').replace(/^.*?:\s*/,''));return}toast('Order updated ✅');viewMyShop()}
function editProduct(id){
  var p=shopMine[id];if(!p)return;
  $('#sbody').innerHTML=`<h3>Edit product</h3><input id="ept" class="sb" maxlength="120" placeholder="Title" value="${esc(p.title||'')}"><input id="epp" class="sb" type="number" min="0" step="0.01" placeholder="Price in USD" value="${((p.price_cents||0)/100).toFixed(2)}"><input id="eps" class="sb" type="number" min="0" step="1" placeholder="Stock (leave empty for unlimited)" value="${p.stock===null?'':p.stock}"><textarea id="epc" class="sb" rows="3" maxlength="2000" placeholder="Description">${esc(p.caption||'')}</textarea><button class="big" onclick="saveProduct('${id}')">Save changes</button>`;
  $('#ssheet').classList.add('show');
}
async function saveProduct(id){
  var t=$('#ept').value.trim(),pr=$('#epp').value,st=$('#eps').value;
  if(!t){toast('Add a title');return}if(pr===''||Number(pr)<0){toast('Enter a price');return}
  var r=await sb.from('posts').update({title:t,price_cents:Math.round(Number(pr)*100),stock:st===''?null:Math.max(0,parseInt(st,10)||0),caption:$('#epc').value.trim()||null}).eq('id',id);
  if(r.error){toast('Could not save');return}closeSheets();toast('Product updated ✅');viewMyShop();
}
async function delProduct(id){if(!confirm('Delete this product?'))return;var r=await sb.from('posts').delete().eq('id',id);toast(r.error?'Could not delete':'Product deleted');viewMyShop()}

/* ======================= REELS (immersive) ======================= */
var reelMode='foryou',reelPage=0,reelBusy=false,lastTap=0,tapT=null,reelAct=-1;
function reelSection(p,i){
  return `<section class="reel" data-i="${i}"><video data-src="${esc(p.media_url)}" ${okUrl(p.cover_url)?`poster="${esc(p.cover_url)}"`:''} loop playsinline muted preload="none" onclick="reelTap(this.parentNode,${i})"></video>
  <div class="rside">${rsideHtml(p,i)}</div>
  <div class="rcap"><b onclick="openUser('${p.author_id}')">@${esc(p.username)}${p.is_verified?' ✅':''}</b>${p.caption?`<div>${linkify(p.caption)}</div>`:''}<small>👁 ${fmt(p.view_count)}</small></div>
  <button class="rmute" onclick="reelMute()" aria-label="Sound">${reelSound?'🔊':'🔇'}</button><i class="rpb"><b></b></i></section>`;
}
reelsInit=async function(more){
  ptarget='#plist';listMode='reels';var box=$('#plist');if(!box)return;
  document.body.classList.add('reelmode');var mo=$('#more');if(mo)mo.innerHTML='';
  if(more!==true){reelPage=0;reelAct=-1;box.innerHTML='<div class="empty" style="color:#fff;background:#000;min-height:60vh">Loading…</div>'}
  if(reelMode==='following'&&!follows.size){posts=[];renderReels();return}
  var q=sb.from('feed').select('*').in('kind',['reel','video']).order('created_at',{ascending:false}).range(reelPage*15,reelPage*15+14);
  if(reelMode==='following')q=q.in('author_id',Array.from(follows));
  var r=await q;if(!$('#plist')||homeTab!=='reel')return;
  if(r.error){box.innerHTML='<div class="empty">Could not load reels.</div>';return}
  var got=(r.data||[]).filter(function(p){return !blockMap[p.author_id]&&okUrl(p.media_url)});reelPage++;
  if(more===true){var have={};posts.forEach(function(p){have[p.id]=1});got=got.filter(function(p){return !have[p.id]});var st=posts.length;posts=posts.concat(got);var rc=$('#reels');if(rc){rc.insertAdjacentHTML('beforeend',got.map(function(p,k){return reelSection(p,st+k)}).join(''));rc.querySelectorAll('.reel').forEach(function(s){if(!s.dataset.o){s.dataset.o=1;reelObs.observe(s)}})}reelBusy=false;return}
  posts=got;if(reelMode==='foryou')posts.sort(function(a,b){return score(b)-score(a)});renderReels();
};
renderReels=function(){
  var box=$('#plist');if(!box)return;
  var top=`<div class="rtop"><button onclick="reelExit()" aria-label="Close">✕</button><span><button class="${reelMode==='foryou'?'on':''}" onclick="reelSet('foryou')">For you</button><button class="${reelMode==='following'?'on':''}" onclick="reelSet('following')">Following</button></span><span style="width:34px"></span></div>`;
  if(!posts.length){box.innerHTML='<div id="rwrap">'+top+'<div class="empty" style="color:#fff;padding-top:140px">'+(reelMode==='following'?'Follow creators to see their reels here.':'No reels yet.<br>Drop a video or reel with + to be first. 🎞️')+'</div></div>';return}
  box.innerHTML='<div id="rwrap">'+top+'<div id="reels">'+posts.map(reelSection).join('')+'</div></div>';
  var root=$('#reels');if(reelObs)reelObs.disconnect();
  reelObs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.intersectionRatio>0.65)reelActivate(+e.target.dataset.i)})},{root:root,threshold:[0.65]});
  root.querySelectorAll('.reel').forEach(function(s){s.dataset.o=1;reelObs.observe(s)});
};
function reelActivate(i){
  if(i===reelAct)return;reelAct=i;var secs=document.querySelectorAll('#reels .reel');
  secs.forEach(function(sec,j){
    var v=sec.querySelector('video');if(!v)return;
    if(Math.abs(j-i)<=1&&!v.getAttribute('src')){v.src=v.dataset.src;v.preload=j===i?'auto':'metadata';v.ontimeupdate=function(){var b=sec.querySelector('.rpb b');if(b&&v.duration)b.style.width=(v.currentTime/v.duration*100)+'%'}}
    if(j===i){v.muted=!reelSound;sec.classList.remove('paused');var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});if(posts[i])countView(posts[i].id)}
    else{v.pause();if(Math.abs(j-i)>2&&v.getAttribute('src')){v.removeAttribute('src');v.load()}}
  });
  if(posts.length-i<=3&&!reelBusy&&reelMode!=='x'){reelBusy=true;reelsInit(true)}
}
function reelTap(sec,i){
  var now=Date.now();
  if(now-lastTap<300){clearTimeout(tapT);lastTap=0;if(myLikes[posts[i].id]!==1)like(i,1);sec.insertAdjacentHTML('beforeend','<div class="hb">❤️</div>');setTimeout(function(){var h=sec.querySelector('.hb');if(h)h.remove()},800);return}
  lastTap=now;tapT=setTimeout(function(){var v=sec.querySelector('video');if(!v)return;if(v.paused){v.play();sec.classList.remove('paused')}else{v.pause();sec.classList.add('paused')}},260);
}
function reelSet(m){if(reelMode===m)return;reelMode=m;reelsInit()}
function reelExit(){homeTab='foryou';document.body.classList.remove('reelmode');viewHome()}

/* ---- tidy: dates and accessibility ---- */
Object.assign(FR,{'Search chats':'Rechercher des discussions','Members':'Membres','Invite link':'Lien d’invitation','Leave space':'Quitter l’espace','Delete space':'Supprimer l’espace','Remove':'Retirer','Today':'Aujourd’hui','Yesterday':'Hier','Not sent':'Non envoyé','Retry':'Réessayer','Followers':'Abonnés','Following':'Abonnements','Subscribers':'Abonnés payants','Posts':'Publications','Reels':'Reels','Music':'Musique','Movies':'Films','Shop':'Boutique','Likes':'J’aime','Search products and sellers':'Rechercher des produits et des vendeurs','Newest':'Récents','Price: low':'Prix croissant','Price: high':'Prix décroissant','Top rated':'Mieux notés','No products found.':'Aucun produit trouvé.','🏪 My Shop':'🏪 Ma boutique','➕ Add product':'➕ Ajouter un produit','📦 All orders':'📦 Toutes les commandes','Orders to handle':'Commandes à traiter','My products':'Mes produits','Open orders':'Commandes ouvertes','Delivered sales':'Ventes livrées','Edit product':'Modifier le produit','Save changes':'Enregistrer','Description':'Description','Delete':'Supprimer','Edit':'Modifier','Confirm':'Confirmer','Follow creators to see their reels here.':'Suivez des créateurs pour voir leurs reels ici.','For you':'Pour vous','Load more':'Voir plus','Inbox':'Boîte de réception','Nobody here yet.':'Personne ici pour le moment.','No posts yet.':'Aucune publication.','No reels yet.':'Aucun reel.','No music yet.':'Aucune musique.','No movies yet.':'Aucun film.','No products yet.':'Aucun produit.','No likes yet.':'Aucun j’aime.','✉️ Message':'✉️ Écrire'});
(function(){var h=$('#hgear');if(h)h.setAttribute('aria-label','Settings')})();
