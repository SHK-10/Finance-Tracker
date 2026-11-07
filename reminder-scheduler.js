(() => {
  if (!window.FolioAccounts) return;
  const key=`${FolioAccounts.dataKey()}-reminders`;
  let reminders=[];
  const alertQueue=[];
  let activeAlert=null;
  try { const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved))reminders=saved; } catch {}

  function persist(){localStorage.setItem(key,JSON.stringify(reminders));}
  function nextDate(date,repeat,desiredDay=null){
    const next=new Date(date);
    if(repeat==='daily')next.setDate(next.getDate()+1);
    else if(repeat==='weekly')next.setDate(next.getDate()+7);
    else if(repeat==='monthly'||repeat==='yearly'){
      const day=Number(desiredDay)||next.getDate();next.setDate(1);next.setMonth(next.getMonth()+(repeat==='monthly'?1:12));
      const lastDay=new Date(next.getFullYear(),next.getMonth()+1,0).getDate();next.setDate(Math.min(day,lastDay));
    }
    return next;
  }
  function showInApp(reminder){
    alertQueue.push(reminder);
    presentAlert();
  }
  function presentAlert(){
    if(activeAlert?.open||!alertQueue.length)return;
    const reminder=alertQueue.shift();
    let dialog=document.querySelector('.reminder-alert-dialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='reminder-alert-dialog';dialog.setAttribute('aria-labelledby','reminderAlertTitle');dialog.setAttribute('aria-describedby','reminderAlertDescription');
      dialog.innerHTML='<div class="reminder-alert-card"><div class="reminder-alert-kicker"><span class="reminder-alert-pulse"></span> REMINDER DUE NOW</div><div class="reminder-alert-icon" aria-hidden="true">♧</div><p class="reminder-alert-kind"></p><h2 id="reminderAlertTitle" class="reminder-alert-title"></h2><p id="reminderAlertDescription" class="reminder-alert-description"></p><strong class="reminder-alert-amount"></strong><div class="reminder-alert-actions"><button type="button" class="reminder-alert-open">View reminders</button><button type="button" class="reminder-alert-dismiss">Got it</button></div></div>';
      dialog.addEventListener('close',()=>{activeAlert=null;window.setTimeout(presentAlert,120);});
      dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
      document.body.appendChild(dialog);
    }
    const kindLabels={payment:'Payment reminder',bill:'Bill reminder',subscription:'Subscription reminder',custom:'Custom reminder'};
    dialog.querySelector('.reminder-alert-kind').textContent=kindLabels[reminder.kind]||'Scheduled reminder';
    dialog.querySelector('.reminder-alert-title').textContent=reminder.title;
    dialog.querySelector('.reminder-alert-description').textContent=reminder.notes||'Your scheduled reminder is due now.';
    const amount=dialog.querySelector('.reminder-alert-amount');amount.textContent=reminder.amount?`Nrs ${new Intl.NumberFormat('en-IN').format(reminder.amount)}`:'';amount.hidden=!reminder.amount;
    dialog.querySelector('.reminder-alert-dismiss').onclick=()=>dialog.close();
    dialog.querySelector('.reminder-alert-open').onclick=()=>{dialog.close();window.location.assign('reminders.html');};
    activeAlert=dialog;
    if(!dialog.open)dialog.showModal();
  }
  function notify(reminder){
    let sent=false;
    if('Notification' in window&&Notification.permission==='granted'){
      try{
        const kindLabels={payment:'Payment',bill:'Bill',subscription:'Subscription',custom:'Custom reminder'};
        const details=[kindLabels[reminder.kind]||'Scheduled reminder',reminder.amount?`Nrs ${new Intl.NumberFormat('en-IN').format(reminder.amount)}`:'',reminder.notes||''].filter(Boolean).join(' · ');
        const notification=new Notification(reminder.title,{body:details,tag:`folio-${reminder.id}`});
        notification.onclick=()=>{window.focus();notification.close();};sent=true;
      }catch{}
    }
    showInApp(reminder);
    return sent;
  }
  function emergencyFundNotice(reminder){
    let goals=[];try{const saved=JSON.parse(localStorage.getItem(`${FolioAccounts.dataKey()}-goals`));if(Array.isArray(saved))goals=saved;}catch{}
    const fund=goals.find(goal=>goal.type==='emergency');if(!fund)return false;
    const months=Number(fund.targetMonths)===6?6:3,target=Number(fund.target)||0,minimum=target*3/months,saved=Number(fund.saved)||0;
    if(minimum<=0||saved>=minimum)return false;
    reminder.title='Emergency fund is below the 3-month minimum';reminder.amount=minimum-saved;reminder.notes=`Your emergency fund has ${new Intl.NumberFormat('en-IN').format(saved)} saved. Add ${new Intl.NumberFormat('en-IN').format(minimum-saved)} to reach three months of estimated essential expenses.`;
    return true;
  }
  function checkDue(){
    const now=Date.now();let changed=false;
    for(const reminder of reminders){
      if(!reminder.enabled||!reminder.dueAt)continue;
      const due=new Date(reminder.dueAt).getTime();if(!Number.isFinite(due)||due>now)continue;
      const shouldNotify=!reminder.goalReminder||reminder.goalReminder!=='emergency-fund'||emergencyFundNotice(reminder);
      if(shouldNotify)notify(reminder);reminder.lastNotifiedAt=new Date(now).toISOString();changed=true;
      if(reminder.repeat&&reminder.repeat!=='none'){
        let next=new Date(reminder.dueAt);let guard=0;do{next=nextDate(next,reminder.repeat,reminder.salaryDay);guard++;}while(next.getTime()<=now&&guard<500);
        reminder.dueAt=next.toISOString();
      }else{reminder.enabled=false;reminder.delivered=true;}
    }
    if(changed){persist();window.dispatchEvent(new CustomEvent('folio-reminders-changed',{detail:reminders}));}
  }
  window.addEventListener('folio-reminders-changed',event=>{if(Array.isArray(event.detail))reminders=event.detail;});
  window.addEventListener('storage',event=>{if(event.key===key){try{reminders=JSON.parse(event.newValue)||[];}catch{reminders=[];}}});
  checkDue();window.setInterval(checkDue,15000);
})();
