(() => {
  const $=id=>document.getElementById(id);
  const key=`${FolioAccounts.dataKey()}-reminders`;
  const kindLabels={payment:'Payment',bill:'Bill',subscription:'Subscription',custom:'Custom reminder'};
  const repeatLabels={none:'Does not repeat',daily:'Every day',weekly:'Every week',monthly:'Every month',yearly:'Every year'};
  let reminders=[];
  try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved))reminders=saved;}catch{}
  const money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
  const formatDate=value=>new Date(value).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  function save(){localStorage.setItem(key,JSON.stringify(reminders));window.dispatchEvent(new CustomEvent('folio-reminders-changed',{detail:reminders}));render();}
  function localInputValue(date){const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
  function setPermissionStatus(){
    const button=$('notificationPermission'),status=$('notificationStatus');
    if(!('Notification' in window)){status.textContent='This browser does not support desktop notifications. In-app alerts still work while Folio is open.';button.disabled=true;button.textContent='Not supported';return;}
    if(Notification.permission==='granted'){status.textContent='Notifications are enabled for this browser.';button.textContent='Notifications enabled';button.disabled=true;}
    else if(Notification.permission==='denied'){status.textContent='Notifications are blocked. Change this site’s notification permission in your browser settings.';button.textContent='Blocked in browser';button.disabled=true;}
    else{status.textContent='Allow notifications so Folio can alert you when a reminder is due.';button.textContent='Enable notifications';button.disabled=false;}
  }
  function render(){
    const enabled=reminders.filter(item=>item.enabled),repeat=enabled.filter(item=>item.repeat&&item.repeat!=='none');
    $('upcomingCount').textContent=enabled.length;$('repeatingCount').textContent=repeat.length;
    const next=[...enabled].sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt))[0];
    $('nextReminderDate').textContent=next?new Date(next.dueAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
    $('nextReminderTitle').textContent=next?.title||'Nothing scheduled yet';
    const filter=$('reminderFilter').value;
    const visible=reminders.filter(item=>filter==='all'||(filter==='completed'?(!item.enabled):item.enabled)).sort((a,b)=>{
      if(a.enabled!==b.enabled)return a.enabled?-1:1;
      return new Date(a.dueAt)-new Date(b.dueAt);
    });
    const host=$('reminderList');host.innerHTML='';$('reminderEmpty').hidden=visible.length>0;
    for(const reminder of visible){
      const card=document.createElement('article');card.className=`reminder-card${reminder.enabled?'':' reminder-card-done'}`;
      const status=reminder.enabled?'Scheduled':reminder.delivered?'Reminder sent':'Completed';
      card.innerHTML=`<span class="reminder-type-icon">♧</span><div class="reminder-card-main"><div class="reminder-card-title-row"><h3 class="reminder-card-title"></h3><span class="reminder-status"></span></div><div class="reminder-card-meta"><span class="reminder-due"></span><span class="reminder-repeat"></span><span class="reminder-kind"></span></div><p class="reminder-note"></p></div><div class="reminder-card-amount"></div><div class="reminder-card-actions"><button type="button" class="reminder-edit">Edit</button><button type="button" class="reminder-complete"></button><button type="button" class="reminder-delete" aria-label="Delete reminder">Delete</button></div>`;
      card.querySelector('.reminder-card-title').textContent=reminder.title;
      card.querySelector('.reminder-status').textContent=status;
      card.querySelector('.reminder-due').textContent=formatDate(reminder.dueAt);
      card.querySelector('.reminder-repeat').textContent=repeatLabels[reminder.repeat]||repeatLabels.none;
      card.querySelector('.reminder-kind').textContent=kindLabels[reminder.kind]||kindLabels.custom;
      card.querySelector('.reminder-note').textContent=reminder.notes||'';
      card.querySelector('.reminder-card-amount').textContent=Number(reminder.amount)>0?money(Number(reminder.amount)):'';
      card.querySelector('.reminder-note').hidden=!reminder.notes;
      card.querySelector('.reminder-edit').addEventListener('click',()=>openReminder(reminder));
      const complete=card.querySelector('.reminder-complete');complete.textContent=reminder.enabled?'Mark complete':'Reopen';
      complete.addEventListener('click',()=>{reminder.enabled=!reminder.enabled;reminder.delivered=false;save();});
      card.querySelector('.reminder-delete').addEventListener('click',()=>{reminders=reminders.filter(item=>item.id!==reminder.id);save();});
      host.appendChild(card);
    }
  }
  function openReminder(reminder){
    $('reminderForm').reset();$('reminderId').value=reminder?.id||'';$('reminderTitle').value=reminder?.title||'';$('reminderKind').value=reminder?.kind||'payment';$('reminderAmount').value=reminder?.amount||'';$('reminderNotes').value=reminder?.notes||'';$('reminderRepeat').value=reminder?.repeat||'none';
    const due=reminder?new Date(reminder.dueAt):new Date(Date.now()+60*60*1000);if(!reminder)due.setMinutes(0,0,0);
    $('reminderDue').value=localInputValue(due);$('reminderDue').min=localInputValue(new Date());$('reminderDialogTitle').textContent=reminder?'Edit reminder':'Create a reminder';$('reminderDialog').showModal();
  }
  $('todayLabel').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';};
  applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
  $('newReminderButton').addEventListener('click',()=>openReminder(null));
  $('reminderFilter').addEventListener('change',render);
  $('notificationPermission').addEventListener('click',async()=>{if(!('Notification' in window))return;try{await Notification.requestPermission();}catch{}setPermissionStatus();});
  $('reminderForm').addEventListener('submit',event=>{
    event.preventDefault();const id=$('reminderId').value,due=new Date($('reminderDue').value);if(Number.isNaN(due.getTime())||due.getTime()<=Date.now()){alert('Choose a reminder time in the future.');return;}
    const data={title:$('reminderTitle').value.trim(),kind:$('reminderKind').value,amount:Math.max(0,Number($('reminderAmount').value)||0),dueAt:due.toISOString(),repeat:$('reminderRepeat').value,notes:$('reminderNotes').value.trim(),enabled:true,delivered:false};if(!data.title)return;
    if(id){const item=reminders.find(reminder=>reminder.id===id);if(item)Object.assign(item,data);}
    else reminders.push({id:crypto.randomUUID(),...data,createdAt:new Date().toISOString()});
    save();$('reminderDialog').close();
  });
  document.querySelectorAll('[data-reminder-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $('reminderDialog').addEventListener('click',event=>{if(event.target===$('reminderDialog'))$('reminderDialog').close();});
  window.addEventListener('folio-reminders-changed',event=>{if(Array.isArray(event.detail))reminders=event.detail;render();});
  window.addEventListener('storage',event=>{if(event.key===key){try{reminders=JSON.parse(event.newValue)||[];}catch{reminders=[];}render();}});
  function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
  $('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
  document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
  setPermissionStatus();render();
})();
