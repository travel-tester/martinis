
const defaults=[{name:'Country Search',description:'Find the country information you need.',url:'https://travel-tester.github.io/martinis/martinis-country-list.html',icon:'◎',tag:'Destination tools'},{name:'Away List',description:'Sandy Martin team away lists and handover files.',url:'https://navigatrgroup.sharepoint.com/sites/team-tours-europe/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2Fteam%2Dtours%2Deurope%2FShared%20Documents%2FGeneral%2FDE%20Away%20Lists%20%26%20Handover%20Files%2FAway%20Lists%2FSandy%20Martin%20Team&viewid=c179767c%2D32c3%2D44fe%2Dbee0%2D68bfeee82f11&FolderCTID=0x012000E7655521DCE2604AB9841171F4DFAAB8',icon:'☷',tag:'Team resources'}];
// Dedicated homepage flows, scoped to martinis-homepage-data.json only.
const HOME_GET_URL = 'https://default51cb5df4df054e5bb20c17d576ab85.e3.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/194ae4bff1fb436b9e48d21d85142cf9/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=VvTjHPPm9zTlkwYJ3xbcxrLbuzZPPyLOQclbKtAA950';
const HOME_POST_URL = 'https://default51cb5df4df054e5bb20c17d576ab85.e3.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/add7e967fa364da8b663c670858bdbb6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=vLa-kK6I23FJcsWwo7LJbCzTLmtEFIynY4h81elhPjY';
const $ = id => document.getElementById(id);
const cacheKey = 'martinis-homepage-shared-v1';
let entries = [], saving = false, loading = false;
const pendingEntries = new Map();
function valid(url) { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } }
function element(tag, className, text) { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; }
function activeEntries() {
  const removed = new Set(entries.filter(x=>x.type==='remove').map(x=>x.target));
  const unique = new Map();
  for(const item of entries) if(item && typeof item.id==='string' && !removed.has(item.id)) unique.set(item.id,item);
  return [...unique.values()];
}
function render() {
  const all=activeEntries();
  const links=all.filter(x=>x.type==='link' && typeof x.name==='string' && valid(x.url));
  const announcements=all.filter(x=>x.type==='announcement' && typeof x.text==='string').reverse();
  $('grid').replaceChildren();
  for(const item of [...defaults,...links]) {
    const card=element('article','card');
    const a=element('a'); a.href=item.url; a.target='_blank'; a.rel='noopener noreferrer'; a.setAttribute('aria-label',item.name+' (opens in a new tab)');
    a.append(element('h3','',item.name)); card.append(a);
    if(item.id) card.append(removeButton(item));
    $('grid').append(card);
  }
  $('announcement-list').replaceChildren();
  for(const item of announcements) {
    const article=element('article','announcement');
    if(item.title)article.append(element('h3','',item.title));
    article.append(element('p','',item.text));
    const footer=element('div','announcement-footer');
    const date=new Date(item.createdAt);
    if(!Number.isNaN(date.getTime())) { const time=element('time','',new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date)); time.dateTime=date.toISOString(); footer.append(time); }
    footer.append(removeButton(item)); article.append(footer); $('announcement-list').append(article);
  }
  $('announcements').hidden=!announcements.length;
}
function removeButton(item) {
  const b=element('button','remove','Remove'); b.type='button'; b.setAttribute('aria-label','Remove '+(item.name||item.title||'announcement'));
  b.onclick=async()=> { if(!confirm('Remove this '+(item.type==='link'?'link':'announcement')+' for everyone?'))return; try { await submitEntry({type:'remove',target:item.id}); }catch { $('status').textContent='Could not remove it. Please try again.'; } };
  return b;
}
async function readEntries(timeout=20000) {
  const response=await fetch(HOME_GET_URL,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error('Read failed');
  let data=await response.json(); if(typeof data==='string')data=JSON.parse(data);
  if(!Array.isArray(data))throw new Error('Unexpected data');
  return data.filter(x=>x && typeof x==='object');
}
function cache(){try{localStorage.setItem(cacheKey,JSON.stringify(entries));}catch{}}
async function refresh(initial=false) {
  if(saving||loading||!HOME_GET_URL)return;
  loading=true;
  try { const fresh=await readEntries(); if(!saving){entries=fresh; cache(); render(); if(initial)$('status').textContent='';} }
  catch { if(initial)$('status').textContent='Team updates could not be loaded. Please refresh to try again.'; }
  finally { loading=false; }
}
function setBusy(busy) { saving=busy; document.querySelectorAll('dialog button, .homepage-actions button, .remove, #import-links').forEach(b=>b.disabled=busy); }
async function submitEntry(data) {
  if(saving)throw new Error('Already saving');
  if(!HOME_POST_URL)throw new Error('Shared saving is not connected yet.');
  const draftKey=JSON.stringify(data);
  const item=pendingEntries.get(draftKey)||{...data,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
  pendingEntries.set(draftKey,item);
  setBusy(true); $('status').textContent='Saving for the team…';
  try {
    let requestError=null;
    try {
      const response=await fetch(HOME_POST_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(item),signal:AbortSignal.timeout(20000)});
      if(response.type!=='opaque'&&!response.ok)requestError=new Error('Save request failed');
    } catch(error) { requestError=error; }
    // Queued writes are accepted before completion. Confirm this exact item in shared storage.
    let confirmed=false; const deadline=Date.now()+45000;
    for(let attempt=0;attempt<25&&Date.now()<deadline;attempt++) {
      try { const fresh=await readEntries(Math.max(1,Math.min(8000,deadline-Date.now()))); if(fresh.some(x=>x.id===item.id)){entries=fresh;confirmed=true;break;} } catch {}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!confirmed)throw requestError||new Error('Save not confirmed');
    pendingEntries.delete(draftKey); cache(); render(); $('status').textContent='Saved for everyone.';
  } catch(error) { $('status').textContent='Save could not be confirmed. Your text is still in the form; check the homepage before retrying.'; throw error; }
  finally { setBusy(false); }
}
$('add').onclick=()=> { $('form').reset(); $('link-error').textContent=''; $('dialog').showModal(); $('name').focus(); };
$('cancel').onclick=()=>$('dialog').close();
$('add-announcement').onclick=()=> { $('announcement-form').reset(); $('announcement-error').textContent=''; $('announcement-dialog').showModal(); $('announcement-text').focus(); };
$('announcement-cancel').onclick=()=>$('announcement-dialog').close();
for(const id of ['dialog','announcement-dialog'])$(id).addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('url').oninput=()=>$('url').setCustomValidity('');
$('form').onsubmit=async e=> {
  e.preventDefault(); $('link-error').textContent=''; const name=$('name').value.trim(),url=$('url').value.trim();
  if(!name){$('name').focus();return;}
  if(!valid(url)){$('url').setCustomValidity('Use an http or https web address.');$('url').reportValidity();return;}
  try { await submitEntry({type:'link',name,url,description:$('description').value.trim()}); $('dialog').close(); }
  catch { $('link-error').textContent='Could not confirm the save. Your link is still here. Please check the homepage before retrying.'; }
};
$('announcement-form').onsubmit=async e=> {
  e.preventDefault(); $('announcement-error').textContent=''; const text=$('announcement-text').value.trim(); if(!text){$('announcement-text').focus();return;}
  try { await submitEntry({type:'announcement',title:$('announcement-title').value.trim(),text}); $('announcement-dialog').close(); }
  catch { $('announcement-error').textContent='Could not confirm the save. Your announcement is still here. Please check the homepage before retrying.'; }
};
let oldLinks=[];
try { const old=JSON.parse(localStorage.getItem('team-desk-links-v1')||'[]'); if(Array.isArray(old))oldLinks=old.filter(x=>x&&typeof x.name==='string'&&valid(x.url)); }catch{}
$('import-links').hidden=!oldLinks.length;
$('import-links').onclick=async()=> {
  if(!confirm('Share your '+oldLinks.length+' previously saved links with everyone?'))return;
  try { while(oldLinks.length){const x=oldLinks[0];await submitEntry({type:'link',name:x.name.slice(0,70),url:x.url,description:(x.description||'').slice(0,130)});oldLinks.shift();try{localStorage.setItem('team-desk-links-v1',JSON.stringify(oldLinks));}catch{}}$('import-links').hidden=true; }
  catch { $('status').textContent='Some links could not be shared. Please check before retrying.'; }
};
try { const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]'); if(Array.isArray(cached))entries=cached.filter(x=>x&&typeof x==='object'); }catch{}
render(); refresh(true);
setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
