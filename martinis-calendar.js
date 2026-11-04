// Federal holiday reference dates, checked against Canada.ca and OPM, November 2026.
// These dates do not determine company closures or Canadian substitute days.
const calendarDateKey=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
function calendarParseDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day,12);
  return calendarDateKey(date)===value?date:null;
}
function calendarNthWeekday(year,month,weekday,n){const first=new Date(year,month,1,12);return new Date(year,month,1+(weekday-first.getDay()+7)%7+7*(n-1),12);}
function calendarLastWeekday(year,month,weekday){const last=new Date(year,month+1,0,12);last.setDate(last.getDate()-(last.getDay()-weekday+7)%7);return last;}
function calendarGoodFriday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),value=h+l-7*m+114;
  return new Date(year,Math.floor(value/31)-1,value%31-1,12);
}
function calendarHolidays(year){
  const results=[];
  const add=(date,title,country)=>{
    results.push({date:calendarDateKey(date),title,country,kind:'holiday'});
    if(country==='USA'&&(date.getDay()===0||date.getDay()===6)){
      const observed=new Date(date);observed.setDate(observed.getDate()+(date.getDay()===6?-1:1));
      results.push({date:calendarDateKey(observed),title:title+' (observed)',country,kind:'holiday'});
    }
  };
  for(const y of [year,year+1]){
    const fixed=(month,day,title,country)=>add(new Date(y,month-1,day,12),title,country);
    fixed(1,1,'New Year’s Day','Canada');add(calendarGoodFriday(y),'Good Friday','Canada');
    const victoria=new Date(y,4,24,12);victoria.setDate(victoria.getDate()-(victoria.getDay()-1+7)%7);add(victoria,'Victoria Day','Canada');
    fixed(7,1,'Canada Day','Canada');add(calendarNthWeekday(y,8,1,1),'Labour Day','Canada');
    if(y>=2021)fixed(9,30,'National Day for Truth and Reconciliation','Canada');
    add(calendarNthWeekday(y,9,1,2),'Thanksgiving','Canada');fixed(11,11,'Remembrance Day','Canada');fixed(12,25,'Christmas Day','Canada');fixed(12,26,'Boxing Day','Canada');
    fixed(1,1,'New Year’s Day','USA');add(calendarNthWeekday(y,0,1,3),'Martin Luther King Jr. Day','USA');add(calendarNthWeekday(y,1,1,3),'Washington’s Birthday','USA');
    add(calendarLastWeekday(y,4,1),'Memorial Day','USA');if(y>=2021)fixed(6,19,'Juneteenth','USA');fixed(7,4,'Independence Day','USA');
    add(calendarNthWeekday(y,8,1,1),'Labor Day','USA');add(calendarNthWeekday(y,9,1,2),'Columbus Day','USA');fixed(11,11,'Veterans Day','USA');
    add(calendarNthWeekday(y,10,4,4),'Thanksgiving','USA');fixed(12,25,'Christmas Day','USA');
  }
  return results.filter(item=>item.date.startsWith(year+'-')).sort((a,b)=>a.date.localeCompare(b.date)||a.country.localeCompare(b.country));
}
const teamCalendar=(()=>{
  const byId=id=>document.getElementById(id),now=new Date();
  let month=new Date(now.getFullYear(),now.getMonth(),1,12),selected=calendarDateKey(now),announcements=[];
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  function eventsForYear(year){
    return [...calendarHolidays(year),...announcements.filter(item=>calendarParseDate(item.eventDate)&&item.eventDate.startsWith(year+'-')).map(item=>({date:item.eventDate,title:item.title||'Team update',kind:'news',url:item.url,linkLabel:item.linkLabel}))].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function eventsForMonth(){const prefix=calendarDateKey(month).slice(0,7);return eventsForYear(month.getFullYear()).filter(item=>item.date.startsWith(prefix));}
  function selectMonthDate(){const items=eventsForMonth(),today=calendarDateKey(new Date());selected=(items.find(item=>item.date>=today)||items[0])?.date||calendarDateKey(month);}
  function eventNode(item,withDate=false){
    const node=el('div','calendar-event '+(item.country==='Canada'?'canada':item.country==='USA'?'usa':'news'));
    const meta=item.country?item.country+' · Federal':'Team';node.append(el('span','calendar-event-region',meta));
    node.append(el('strong','calendar-event-name',item.title));
    if(withDate)node.append(el('span','calendar-event-date',new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(calendarParseDate(item.date))));
    if(item.country==='Canada'&&[0,6].includes(calendarParseDate(item.date).getDay()))node.append(el('span','calendar-event-note','Weekend date; substitute day varies.'));
    if(item.url){try{const url=new URL(item.url);if(['http:','https:'].includes(url.protocol)){const link=el('a','calendar-event-link',item.linkLabel||'Open announcement');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';node.append(link);}}catch{}}
    return node;
  }
  function draw(){
    const monthText=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(month),today=calendarDateKey(new Date());
    byId('calendar-month').textContent=monthText;byId('calendar-days').setAttribute('aria-label',monthText+' dates');
    byId('calendar-prev').disabled=month.getFullYear()===2000&&month.getMonth()===0;byId('calendar-next').disabled=month.getFullYear()===2100&&month.getMonth()===11;
    const days=byId('calendar-days');days.replaceChildren();const items=eventsForMonth(),dateMap=new Map();
    items.forEach(item=>{if(!dateMap.has(item.date))dateMap.set(item.date,[]);dateMap.get(item.date).push(item);});
    for(let blank=0;blank<month.getDay();blank++){const spacer=el('span','calendar-blank');spacer.setAttribute('aria-hidden','true');days.append(spacer);}
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++){
      const date=new Date(month.getFullYear(),month.getMonth(),day,12),key=calendarDateKey(date),events=dateMap.get(key)||[],button=el('button','calendar-day',String(day));button.type='button';
      button.classList.toggle('is-today',key===today);button.classList.toggle('has-holiday',events.some(item=>item.kind==='holiday'));button.setAttribute('aria-pressed',String(key===selected));
      if(key===today)button.setAttribute('aria-current','date');
      button.setAttribute('aria-label',new Intl.DateTimeFormat(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(date)+(events.length?': '+events.map(item=>(item.country?item.country+' ':'')+item.title).join('; '):''));
      const markers=el('span','calendar-markers');markers.setAttribute('aria-hidden','true');
      for(const group of ['Canada','USA','Team'])if(events.some(item=>(item.country||'Team')===group))markers.append(el('i','calendar-dot '+(group==='Canada'?'canada':group==='USA'?'usa':'news')));
      button.append(markers);button.onclick=()=>{selected=key;draw();byId('calendar-days').querySelector('[aria-pressed="true"]').focus();};days.append(button);
    }
    byId('calendar-selected-date').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(calendarParseDate(selected));
    const events=byId('calendar-events');events.replaceChildren();const picked=dateMap.get(selected)||[];
    if(picked.length)picked.forEach(item=>events.append(eventNode(item)));else events.append(el('p','calendar-empty','No events for this date.'));
    const upcoming=byId('calendar-upcoming');upcoming.replaceChildren();
    const from=calendarDateKey(month)>today?calendarDateKey(month):today;
    const holidays=items.filter(item=>item.kind==='holiday'&&item.date>=from).slice(0,4);
    if(holidays.length)holidays.forEach(item=>upcoming.append(eventNode(item,true)));else upcoming.append(el('p','calendar-empty','No more holidays this month.'));
  }
  byId('calendar-prev').onclick=()=>{if(month.getFullYear()<=2000&&month.getMonth()===0)return;month=new Date(month.getFullYear(),month.getMonth()-1,1,12);selectMonthDate();draw();};
  byId('calendar-next').onclick=()=>{if(month.getFullYear()>=2100&&month.getMonth()===11)return;month=new Date(month.getFullYear(),month.getMonth()+1,1,12);selectMonthDate();draw();};
  byId('calendar-today').onclick=()=>{const date=new Date();month=new Date(date.getFullYear(),date.getMonth(),1,12);selected=calendarDateKey(date);draw();};
  return {render(items){announcements=items;draw();}};
})();
