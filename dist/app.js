const $=id=>document.getElementById(id);
const audio=$('audio');
let dayIndex=0,spotIndex=0,chapterIndex=0,plan=0,audioKey='',requestToken=0,message='待播放',pendingTime=0,downloadBusy=false,swReady=false,lastSave=0;
const SCOPE_TAG=encodeURIComponent(new URL('./',location.href).pathname),AUDIO_CACHE='italia-gh-audio-v1-'+SCOPE_TAG,CONTENT_VERSION='public-v1',IMAGE_CACHE='italia-gh-images-v1-'+SCOPE_TAG;
const manifest=typeof AUDIO==='undefined'?{}:AUDIO;
function stops(){const d=DAYS[dayIndex];return d.plans?d.plans[plan].stops:d.stops}
function entry(){return stops()[spotIndex]}
function spot(){return S[entry().id]}
function key(){return entry().id+'-'+chapterIndex}
function clip(id,i){return manifest[id+'-'+i]}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clock(n){n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
function chapterSeconds(id,i){return clip(id,i)?.duration||S[id].chapters[i].text.length/4}
function totalTime(id){return Math.ceil(S[id].chapters.reduce((n,c,i)=>n+chapterSeconds(id,i),0)/60)+' 分钟'}
function saveState(){try{localStorage.setItem('italia-listen-'+SCOPE_TAG,JSON.stringify({contentVersion:CONTENT_VERSION,dayIndex,spotIndex,chapterIndex,plan,time:audio.currentTime||0,speed:$('speed').value,auto:$('auto').checked}))}catch{}}
function restore(){try{const s=JSON.parse(localStorage.getItem('italia-listen-'+SCOPE_TAG));if(!s)return;if(Number.isInteger(s.dayIndex)&&DAYS[s.dayIndex])dayIndex=s.dayIndex;if(DAYS[dayIndex].plans&&Number.isInteger(s.plan)&&DAYS[dayIndex].plans[s.plan])plan=s.plan;if(Number.isInteger(s.spotIndex)&&stops()[s.spotIndex])spotIndex=s.spotIndex;if(Number.isInteger(s.chapterIndex)&&spot().chapters[s.chapterIndex])chapterIndex=s.chapterIndex;pendingTime=Math.max(0,Number(s.time)||0);if(['0.8','1','1.2','1.5'].includes(s.speed))$('speed').value=s.speed;if(typeof s.auto==='boolean')$('auto').checked=s.auto;if(s.contentVersion!==CONTENT_VERSION){chapterIndex=0;pendingTime=0;message='故事与声音已更新 · 请重新保存离线音频'}else message='已记住上次进度'}catch{}}
function stopAudio(){requestToken++;audio.pause();message='待播放'}
function prepare(){if(audioKey===key())return;stopAudio();audioKey=key();const a=manifest[audioKey];audio.src=a?a.file:'';audio.playbackRate=Number($('speed').value);audio.load();if('mediaSession'in navigator&&typeof MediaMetadata!=='undefined'){navigator.mediaSession.metadata=new MediaMetadata({title:spot().chapters[chapterIndex].title,artist:spot().name,album:'耳游意大利 · 中文导览',artwork:[{src:new URL('icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]})}}
function changeDay(i){const fromTab=document.activeElement?.getAttribute('role')==='tab';stopAudio();dayIndex=i;spotIndex=0;chapterIndex=0;pendingTime=0;plan=0;render();saveState();if(fromTab)$('route-tab-'+i).focus({preventScroll:true})}
function changeSpot(i){if(i<0||i>=stops().length)return;stopAudio();spotIndex=i;chapterIndex=0;pendingTime=0;render();saveState();$('guide').focus({preventScroll:true})}
function changeChapter(i,playNow=false){if(i<0||i>=spot().chapters.length)return;stopAudio();chapterIndex=i;pendingTime=0;renderGuide();saveState();if(playNow)playAudio()}
function render(){const routeScroll=$('routeTabs').scrollLeft;
 $('routeTabs').innerHTML=DAYS.map((d,i)=>`<button id="route-tab-${i}" class="route-tab ${i===dayIndex?'active':''}" role="tab" data-day="${i}" aria-selected="${i===dayIndex}" aria-controls="routePanel" tabindex="${i===dayIndex?0:-1}" aria-label="${safe(d.label+' · '+d.city)}"><span class="route-number">${safe(d.label)}</span><strong>${safe(d.short)}</strong></button>`).join('');
 $('routeTabs').scrollLeft=routeScroll;revealRoute();
 $('routePanel').setAttribute('aria-labelledby','route-tab-'+dayIndex);
 $('city').textContent=DAYS[dayIndex].city;$('dayNote').textContent=DAYS[dayIndex].note;$('stopCount').textContent=stops().length+' 站';
 $('plans').innerHTML=DAYS[dayIndex].plans?`<div class="plan-toggle">${DAYS[dayIndex].plans.map((p,i)=>`<button data-plan="${i}" class="${plan===i?'active':''}" aria-pressed="${plan===i}">${safe(p.name)}</button>`).join('')}</div>`:'';
 $('stops').innerHTML=stops().map((e,i)=>`<li class="stop ${i===spotIndex?'active':''}"><button data-spot="${i}" aria-current="${i===spotIndex?'step':'false'}"><span class="number">${String(i+1).padStart(2,'0')}</span><span><strong>${safe(S[e.id].name)}</strong><small>${e.optional?'可选 · ':''}${safe(S[e.id].kind)}</small></span></button></li>`).join('');
 renderGuide();updateOffline();
 const selected=$('stops').querySelector('.active');if(selected&&$('stops').scrollWidth>$('stops').clientWidth)$('stops').scrollLeft=Math.max(0,selected.offsetLeft-$('stops').offsetLeft-12);
}
function routeScrollButtons(){const tabs=$('routeTabs');$('routeBack').disabled=tabs.scrollLeft<=1;$('routeForward').disabled=tabs.scrollLeft>=tabs.scrollWidth-tabs.clientWidth-1}
function revealRoute(){const tabs=$('routeTabs'),selected=$('route-tab-'+dayIndex);if(selected){const box=tabs.getBoundingClientRect(),tab=selected.getBoundingClientRect();if(tab.left<box.left)tabs.scrollLeft-=box.left-tab.left+4;else if(tab.right>box.right)tabs.scrollLeft+=tab.right-box.right+4}routeScrollButtons()}
function chapterImages(id,index){return (PICTURES.chapters[id+'-'+index]||[]).map(key=>({key,...PICTURES.assets[key]}))}
function artworkHtml(id,index){const images=chapterImages(id,index);if(!images.length)return '';return `<div class="artwork-heading"><span>${images.every(a=>a.kind==='art')?'本段作品':'对照着看'}</span><small>${images.length>1?images.length+' 张':''}</small></div><div class="artwork-gallery ${images.length===1?'single':''}" role="group" aria-label="本段讲解配图">${images.map(a=>`<figure class="artwork"><button class="artwork-open" data-image="${safe(a.key)}" aria-label="放大：${safe(a.title)}"><img src="${safe(a.file)}" alt="${safe(a.title)}" width="${a.width}" height="${a.height}" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span><span class="image-fallback">配图暂未加载，请联网后重试。</span></button><figcaption><strong>${safe(a.title)}</strong><details class="image-attribution"><summary>图片来源与许可</summary><p>${safe(a.credit)} · <a href="${safe(a.page)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a><br><a href="${safe(a.licenseUrl)}" target="_blank" rel="noopener">${safe(a.license)}</a> · 已缩放与压缩</p></details></figcaption></figure>`).join('')}</div>`}
function openImage(key){const image=PICTURES.assets[key];if(!image)return;$('largeImage').src=image.file;$('largeImage').alt=image.title;$('imageTitle').textContent=image.title;$('imageCredit').textContent=image.credit+' · '+image.license+' · Wikimedia Commons';$('imageDialog').showModal()}
function renderGuide(){const s=spot(),e=entry();
 $('guide').innerHTML=`<div class="spot-top"><div><span class="tag">第 ${spotIndex+1} 站 / ${stops().length} · ${safe(s.kind)}</span><h2>${safe(s.name)}</h2><p class="italian">${safe(s.it)}</p></div><a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.map||s.it+(s.it.includes('Vatican')||s.it.includes('Vaticano')?'':' Italy'))}" target="_blank" rel="noopener">地图 ↗</a></div><div class="meta"><span>${s.chapters.length} 段讲解</span><span>约 ${totalTime(e.id)}</span>${e.optional?'<span>附加可选</span>':''}</div><p class="intro">${safe(s.intro)}</p><button class="listen" id="listen"><span>▶ 听这段讲解</span></button><div class="chapters-heading"><h3>讲解</h3></div>${s.chapters.map((c,i)=>`<article class="chapter ${i===chapterIndex?'current':''}"><button class="chapter-title" data-chapter="${i}" aria-expanded="${i===chapterIndex}"><span class="idx">${String(i+1).padStart(2,'0')}</span><strong>${safe(c.title)}</strong><small>${clock(chapterSeconds(e.id,i))} ${i===chapterIndex?'−':'+'}</small></button><div class="chapter-body">${i===chapterIndex?artworkHtml(e.id,i):''}<p class="where">${safe(c.mode)} · ${safe(c.where)}</p><p class="narration">${safe(c.text).replace(/\n/g,'</p><p class="narration">')}</p></div></article>`).join('')}${s.tip?`<div class="tips">${safe(s.tip)}</div>`:''}<div class="stop-navigation"><button id="previousStop" ${spotIndex===0?'disabled':''}>← 上一站</button>${spotIndex<stops().length-1?`<button id="nextStop">下一站 · ${safe(S[stops()[spotIndex+1].id].name)} →</button>`:'<span>已到本路线最后一站</span>'}</div><details class="source"><summary>参考资料与讲解说明</summary><div class="source-links">${s.sources.map(([label,url])=>`<a href="${safe(url)}" target="_blank" rel="noopener">${safe(label)} ↗</a>`).join('')}<br>原创中文讲解 · 神经网络合成语音 · 展陈以现场为准</div></details>`;
 prepare();updatePlayer();
}
function updatePlayer(){const s=spot(),playing=!audio.paused&&!audio.ended;$('playerPlace').textContent=s.name;$('playerChapter').textContent=`${chapterIndex+1} / ${s.chapters.length}　${s.chapters[chapterIndex].title}`;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停讲解':'播放讲解');$('prev').disabled=chapterIndex===0;$('next').disabled=chapterIndex===s.chapters.length-1;$('status').textContent=message;const listen=$('listen');if(listen)listen.firstElementChild.textContent=playing?'Ⅱ 暂停讲解':'▶ 听这段讲解';const duration=Number.isFinite(audio.duration)?audio.duration:chapterSeconds(entry().id,chapterIndex);$('seek').max=duration;$('seek').value=audio.currentTime||0;$('elapsed').textContent=clock(audio.currentTime);$('duration').textContent=clock(duration);if('mediaSession'in navigator){navigator.mediaSession.playbackState=playing?'playing':'paused';if(Number.isFinite(audio.duration)&&audio.duration>0&&navigator.mediaSession.setPositionState){try{navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.currentTime,audio.duration)})}catch{}}}}
async function playAudio(){prepare();if(!manifest[key()]){message='音频尚未准备好，请稍后刷新';updatePlayer();return}const token=++requestToken;message='正在加载音频…';updatePlayer();try{await audio.play();if(token!==requestToken)return;message='正在播放 · 普通话';updatePlayer()}catch{if(token!==requestToken)return;message=navigator.onLine?'暂时无法播放，请再点一次；若仍失败，请换手机 Safari 或 Chrome。':'本段未离线保存，请联网后播放或保存本路线音频。';updatePlayer()}}
function toggle(){if(!audio.paused){requestToken++;audio.pause();message='已暂停';updatePlayer();saveState()}else playAudio()}
audio.addEventListener('loadedmetadata',()=>{if(pendingTime>0){audio.currentTime=Math.min(pendingTime,Math.max(0,audio.duration-0.2));pendingTime=0}updatePlayer()});
audio.addEventListener('timeupdate',()=>{updatePlayer();if(Date.now()-lastSave>5000){saveState();lastSave=Date.now()}});
audio.addEventListener('playing',()=>{message='正在播放 · 普通话';updatePlayer()});
audio.addEventListener('pause',()=>{updatePlayer();saveState()});
audio.addEventListener('waiting',()=>{message='正在缓冲…';updatePlayer()});
audio.addEventListener('error',()=>{if(!audioKey)return;message='音频加载失败，请联网重试或重新保存本路线音频。';updatePlayer()});
audio.addEventListener('ended',()=>{if($('auto').checked&&chapterIndex<spot().chapters.length-1)changeChapter(chapterIndex+1,true);else{message=chapterIndex===spot().chapters.length-1?'本站已播完 · 到下一站后再选择景点':'本段已播完 · 可选择下一段';updatePlayer();saveState()}});
function dayClips(){return stops().flatMap(e=>S[e.id].chapters.map((c,i)=>clip(e.id,i))).filter(Boolean)}
function dayImages(){const files=new Map();for(const e of stops())S[e.id].chapters.forEach((c,i)=>chapterImages(e.id,i).forEach(a=>files.set(a.file,a)));return [...files.values()]}
const allResources=[...new Map([
 ...Object.values(manifest).map(c=>({...c,kind:'audio',cache:AUDIO_CACHE})),
 ...Object.values(PICTURES.assets).map(c=>({...c,kind:'image',cache:IMAGE_CACHE}))
].map(c=>[c.file,c])).values()];
const savedFiles=new Set();
let offlineNotice='',downloadJob=null,offlineChecked=false,offlinePageReady=false;
function routeResources(){const files=new Set([...dayClips(),...dayImages()].map(c=>c.file));return allResources.filter(c=>files.has(c.file))}
function resourceBytes(resources){return resources.reduce((n,c)=>n+c.bytes,0)}
function mb(bytes){return (bytes/1e6).toFixed(1)}
function updateOffline(){
 const ready=swReady&&offlineChecked,route=routeResources(),saved=allResources.filter(c=>savedFiles.has(c.file));
 const complete=ready&&offlinePageReady&&saved.length===allResources.length,routeComplete=ready&&offlinePageReady&&route.every(c=>savedFiles.has(c.file));
 $('downloadAll').disabled=!ready||downloadBusy;$('downloadDay').disabled=!ready||downloadBusy;
 $('downloadAll').textContent=complete?'✓ 全部已下载':saved.length?'↓ 继续下载全部':'↓ 下载全部';
 $('downloadDay').textContent=routeComplete?'✓ 本路线已下载':'↓ 下载本路线';
 $('downloadInfo').textContent=routeComplete?'可离线使用':`${dayClips().length} 段 · ${mb(resourceBytes(route))} MB`;
 $('pauseDownload').hidden=!downloadBusy;$('pauseDownload').disabled=!!downloadJob?.controller.signal.aborted;
 $('downloadProgress').hidden=!downloadBusy;
 $('downloadAllInfo').textContent=!ready?'准备离线下载…':complete?`全部已下载 · ${Object.keys(manifest).length} 段音频 · ${Object.keys(PICTURES.assets).length} 张图`:`${Object.keys(manifest).length} 段音频 · ${Object.keys(PICTURES.assets).length} 张图 · ${mb(resourceBytes(allResources))} MB`;
 if(downloadJob){
  const done=downloadJob.resources.filter(c=>savedFiles.has(c.file));
  $('downloadAll').textContent='正在下载…';
  $('downloadAllInfo').textContent=`${downloadJob.label} · ${mb(resourceBytes(done))} / ${mb(resourceBytes(downloadJob.resources))} MB`;
  $('downloadProgress').max=resourceBytes(downloadJob.resources);$('downloadProgress').value=resourceBytes(done);
 }
 $('downloadNotice').textContent=offlineNotice;$('downloadNotice').hidden=!offlineNotice;
}
async function validSaved(item,cache,deep=false){
 const url=new URL(item.file,location.href).href,response=await cache.match(url);
 if(!response)return false;
 if(response.status===200&&response.headers.get('content-type')?.startsWith(item.kind+'/')){
  if(!deep&&response.headers.get('x-italia-verified-bytes')===String(item.bytes))return true;
  const blob=await response.blob();
  if(blob.size===item.bytes){if(response.headers.get('x-italia-verified-bytes')!==String(blob.size)){const headers=new Headers(response.headers);headers.set('x-italia-verified-bytes',String(blob.size));await cache.put(url,new Response(blob,{headers}))}return true}
 }
 await cache.delete(url);return false;
}
async function inspectSaved(resources=allResources,deep=false){
 const stores=new Map(await Promise.all([AUDIO_CACHE,IMAGE_CACHE].map(async name=>[name,await caches.open(name)])));
 // Bounded reads avoid loading the whole guide into memory on phones.
 for(let start=0;start<resources.length;start+=4)await Promise.all(resources.slice(start,start+4).map(async item=>{
  if(await validSaved(item,stores.get(item.cache),deep))savedFiles.add(item.file);else savedFiles.delete(item.file);
 }));
}
async function ensureOfflinePage(){
 offlinePageReady=false;
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('core'))},30000);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();if(e.data?.ok){offlinePageReady=true;resolve()}else reject(Error('core'))};
  if(!navigator.serviceWorker.controller){clearTimeout(timer);channel.port1.close();reject(Error('core'));return}
  navigator.serviceWorker.controller.postMessage('ITALIA_CACHE_CORE',[channel.port2]);
 });
}
async function saveResource(item,signal){
 const cache=await caches.open(item.cache),url=new URL(item.file,location.href).href;
 if(await validSaved(item,cache)){savedFiles.add(item.file);return}
 savedFiles.delete(item.file);
 for(let attempt=0;attempt<3;attempt++){
  signal.throwIfAborted();
  try{
   const response=await fetch(url,{cache:'reload',signal});
   if(response.status!==200||!response.headers.get('content-type')?.startsWith(item.kind+'/'))throw Error('download');
   const blob=await response.blob();if(blob.size!==item.bytes)throw Error('incomplete');
   signal.throwIfAborted();
   const headers=new Headers({'Content-Type':response.headers.get('content-type'),'Content-Length':String(blob.size),'x-italia-verified-bytes':String(blob.size)});
   await cache.put(url,new Response(blob,{headers}));savedFiles.add(item.file);return;
  }catch(error){
   // A worker may have cached an image response during the fetch; remove it before retrying.
   await cache.delete(url);
   if(signal.aborted||error.name==='QuotaExceededError'||attempt===2)throw error;
  }
 }
}
async function downloadResources(all){
 if(downloadBusy||!swReady||!offlineChecked)return;
 const job={resources:all?allResources:routeResources(),label:all?'全部内容':DAYS[dayIndex].label,controller:new AbortController(),paused:false};
 downloadJob=job;downloadBusy=true;offlineNotice='下载时请保持页面打开';updateOffline();
 let wakeLock;
 try{
  // Request protection against automatic eviction where the browser supports it.
  navigator.storage?.persist?.().catch(()=>{});
  if(navigator.wakeLock)wakeLock=await navigator.wakeLock.request('screen').catch(()=>null);
  await ensureOfflinePage();await inspectSaved(job.resources);
  let next=0,firstError;
  const worker=async()=>{while(next<job.resources.length&&!job.controller.signal.aborted){const item=job.resources[next++];try{await saveResource(item,job.controller.signal);updateOffline()}catch(error){firstError??=error;job.controller.abort();break}}};
  await Promise.all([worker(),worker(),worker()]);
  if(firstError)throw firstError;job.controller.signal.throwIfAborted();
  offlineNotice='正在检查完整性…';updateOffline();
  await inspectSaved(job.resources,true);await ensureOfflinePage();job.controller.signal.throwIfAborted();
  if(!job.resources.every(c=>savedFiles.has(c.file)))throw Error('incomplete');
  offlineNotice='';
 }catch(error){
  offlineNotice=job.paused?'已暂停，已下载内容会保留':error.name==='QuotaExceededError'?'空间不足，请释放空间后继续':navigator.onLine?'下载未完成，请重试；已下载内容会保留':'网络已断开，联网后可继续下载';
 }finally{
  if(wakeLock)await wakeLock.release().catch(()=>{});
  downloadJob=null;downloadBusy=false;updateOffline();
 }
}
function downloadDay(){return downloadResources(false)}
function downloadAll(){return downloadResources(true)}
function pauseDownload(){if(downloadJob){downloadJob.paused=true;downloadJob.controller.abort();offlineNotice='正在暂停…';updateOffline()}}
function waitForOfflineController(){
 return new Promise((resolve,reject)=>{
  const channels=new Set();let timer;
  const finish=error=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',check);channels.forEach(port=>port.close());error?reject(error):resolve()};
  const check=()=>{const controller=navigator.serviceWorker.controller;if(!controller)return;const channel=new MessageChannel();channels.add(channel.port1);channel.port1.onmessage=e=>{if(e.data==='offline-v5')finish()};controller.postMessage('ITALIA_UI_VERSION',[channel.port2])};
  navigator.serviceWorker.addEventListener('controllerchange',check);timer=setTimeout(()=>finish(Error('Offline preparation timed out')),20000);check();
 });
}
async function setupOffline(){
 if(!('serviceWorker'in navigator)||!window.isSecureContext){$('downloadAllInfo').textContent='当前浏览器不支持离线保存';$('downloadInfo').textContent='请联网播放';return}
 try{
  await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await waitForOfflineController();
  await ensureOfflinePage();await inspectSaved(allResources,true);swReady=true;offlineChecked=true;updateOffline();
  $('offlineStatus').textContent='下载完成后，所有路线（含备选方案）、讲解、音频和配图均可在这台设备的同一浏览器离线使用。地图和外部资料仍需网络。清理浏览器数据或系统回收存储后，需要重新下载。';
 }catch{$('downloadAllInfo').textContent='离线准备未完成，请刷新重试';$('downloadInfo').textContent='请联网播放'}
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.image&&!b.classList.contains('image-error'))openImage(b.dataset.image);if(b.dataset.day!==undefined)changeDay(+b.dataset.day);if(b.dataset.spot!==undefined)changeSpot(+b.dataset.spot);if(b.dataset.chapter!==undefined)changeChapter(+b.dataset.chapter);if(b.dataset.plan!==undefined){stopAudio();plan=+b.dataset.plan;spotIndex=0;chapterIndex=0;pendingTime=0;render();saveState()}if(b.id==='listen')toggle();if(b.id==='nextStop')changeSpot(spotIndex+1);if(b.id==='previousStop')changeSpot(spotIndex-1)});
$('routeTabs').onkeydown=e=>{if(e.target.getAttribute('role')!=='tab')return;let i=dayIndex;if(e.key==='ArrowRight')i=(i+1)%DAYS.length;else if(e.key==='ArrowLeft')i=(i-1+DAYS.length)%DAYS.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=DAYS.length-1;else return;e.preventDefault();changeDay(i);$('route-tab-'+i).focus({preventScroll:true})};
$('routeBack').onclick=()=>$('routeTabs').scrollBy({left:-$('routeTabs').clientWidth*.75,behavior:'auto'});
$('routeForward').onclick=()=>$('routeTabs').scrollBy({left:$('routeTabs').clientWidth*.75,behavior:'auto'});
$('routeTabs').addEventListener('scroll',routeScrollButtons,{passive:true});window.addEventListener('resize',routeScrollButtons);
$('closeImage').onclick=()=>$('imageDialog').close();
document.addEventListener('error',e=>{if(e.target.matches?.('.artwork img'))e.target.closest('.artwork-open').classList.add('image-error')},true);
$('play').onclick=toggle;$('prev').onclick=()=>changeChapter(chapterIndex-1,!audio.paused);$('next').onclick=()=>changeChapter(chapterIndex+1,!audio.paused);$('speed').onchange=()=>{audio.playbackRate=Number($('speed').value);saveState();updatePlayer()};$('auto').onchange=saveState;$('seek').oninput=()=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number($('seek').value);updatePlayer();saveState()}};$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('downloadDay').onclick=downloadDay;$('downloadAll').onclick=downloadAll;$('pauseDownload').onclick=pauseDownload;
if('mediaSession'in navigator){for(const [action,handler] of Object.entries({play:playAudio,pause:()=>{audio.pause();message='已暂停';updatePlayer();saveState()},previoustrack:()=>changeChapter(chapterIndex-1,true),nexttrack:()=>changeChapter(chapterIndex+1,true),seekbackward:()=>{audio.currentTime=Math.max(0,audio.currentTime-15)},seekforward:()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)},seekto:e=>{if(Number.isFinite(e.seekTime))audio.currentTime=e.seekTime}})){try{navigator.mediaSession.setActionHandler(action,handler)}catch{}}}
window.addEventListener('pagehide',saveState);restore();render();setupOffline();
