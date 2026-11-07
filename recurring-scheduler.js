(() => {
  if(!window.FolioAccounts)return;
  const dataKey=FolioAccounts.dataKey(),scheduleKey=`${dataKey}-recurring`;
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(scheduleKey));return Array.isArray(value)?value:[];}catch{return [];}};
  const write=list=>{localStorage.setItem(scheduleKey,JSON.stringify(list));window.dispatchEvent(new CustomEvent('folio-recurring-changed',{detail:list}));};
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const formatDate=value=>new Date(`${value}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
  function nextOccurrence(item,key){
    const current=new Date(`${key}T12:00:00`),monthDay=Number(item.monthDay)||current.getDate();
    if(item.frequency==='weekly')current.setDate(current.getDate()+7);
    else if(item.frequency==='yearly'){
      const month=Number.isInteger(item.monthOfYear)?item.monthOfYear:current.getMonth(),year=current.getFullYear()+1,days=new Date(year,month+1,0).getDate();
      current.setFullYear(year,month,Math.min(monthDay,days));
    }else{
      const year=current.getFullYear(),month=current.getMonth()+1,days=new Date(year,month+1,0).getDate();
      current.setFullYear(year,month,Math.min(monthDay,days));
    }
    return dateKey(current);
  }
  function appendFinanceTransaction(finance,item,due){
    if(!Array.isArray(finance.transactions))finance.transactions=[];
    if(!Array.isArray(finance.budgets))finance.budgets=[{category:'Food & dining',limit:650},{category:'Shopping',limit:400},{category:'Transport',limit:250}];
    const transactionId=`recurring-${item.id}-${due}`;
    if(finance.transactions.some(tx=>tx.id===transactionId))return false;
    finance.transactions.unshift({id:transactionId,name:item.name,amount:Number(item.amount),type:item.type,category:item.category,date:due,recurringId:item.id,recurringDueDate:due});return true;
  }
  function storeFinanceTransaction(item,due){
    let finance={};try{finance=JSON.parse(localStorage.getItem(dataKey))||{};}catch{}
    if(appendFinanceTransaction(finance,item,due)){localStorage.setItem(dataKey,JSON.stringify(finance));window.dispatchEvent(new CustomEvent('folio-finance-updated',{detail:finance}));}
  }
  let openDialog=null,dismissedPending='',processing=false;
  function resolve(id,approve){
    const schedules=read(),item=schedules.find(entry=>entry.id===id&&entry.pendingDueDate);if(!item)return;
    const due=item.pendingDueDate;
    if(approve)storeFinanceTransaction(item,due);
    item.nextDue=nextOccurrence(item,due);item.pendingDueDate=null;
    if(item.endDate&&item.nextDue>item.endDate)item.active=false;
    write(schedules);if(openDialog?.open)openDialog.close();openDialog=null;presentPending();
  }
  function presentPending(){
    const item=read().find(entry=>entry.active&&entry.approvalMode==='ask'&&entry.pendingDueDate);if(!item){if(openDialog?.open)openDialog.close();openDialog=null;return;}
    const signature=`${item.id}:${item.pendingDueDate}`;if(signature===dismissedPending)return;
    if(!openDialog){
      const dialog=document.createElement('dialog');dialog.className='recurring-approval-dialog';dialog.setAttribute('aria-labelledby','recurringApprovalTitle');
      dialog.innerHTML='<div class="recurring-approval-card"><div class="eyebrow">SCHEDULED TRANSACTION</div><h2 id="recurringApprovalTitle"></h2><p class="recurring-approval-detail"></p><p class="recurring-approval-note">Approve to add this transaction record to Folio. No payment will be sent.</p><div class="recurring-approval-actions"><button type="button" class="secondary-btn recurring-review-later">Review later</button><button type="button" class="secondary-btn recurring-skip">Skip this date</button><button type="button" class="primary-btn recurring-approve">Add transaction</button></div></div>';
      dialog.addEventListener('click',event=>{if(event.target===dialog){dismissedPending=signature;dialog.close();}});
      document.body.append(dialog);openDialog=dialog;
    }
    openDialog.querySelector('h2').textContent=item.name;
    openDialog.querySelector('.recurring-approval-detail').textContent=`${formatDate(item.pendingDueDate)} · ${item.type==='income'?'Income':'Expense'} · ${money(Number(item.amount)||0)} · ${item.category}`;
    openDialog.querySelector('.recurring-review-later').onclick=()=>{dismissedPending=signature;openDialog.close();};
    openDialog.querySelector('.recurring-skip').onclick=()=>resolve(item.id,false);
    openDialog.querySelector('.recurring-approve').onclick=()=>resolve(item.id,true);
    if(!openDialog.open)openDialog.showModal();
  }
  function notifyPending(item){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    try{const notification=new Notification('Scheduled transaction needs approval',{body:`${item.name} · ${money(Number(item.amount)||0)} due ${formatDate(item.pendingDueDate)}`,tag:`folio-recurring-${item.id}-${item.pendingDueDate}`});notification.onclick=()=>{window.focus();window.location.assign('recurring.html');notification.close();};}catch{}
  }
  function processDue(){
    if(processing)return;processing=true;
    try{
    const schedules=read(),todayKey=dateKey(new Date());let changed=false,finance=null,financeChanged=false;
    for(const item of schedules){
      if(!item.active||!item.nextDue)continue;
      if(item.endDate&&item.nextDue>item.endDate){item.active=false;changed=true;continue;}
      if(item.nextDue>todayKey)continue;
      if(item.approvalMode==='ask'){
        if(!item.pendingDueDate){item.pendingDueDate=item.nextDue;changed=true;notifyPending(item);}
        continue;
      }
      let count=0;
      while(item.nextDue<=todayKey&&(!item.endDate||item.nextDue<=item.endDate)&&count<2000){
        if(!finance){try{finance=JSON.parse(localStorage.getItem(dataKey))||{};}catch{finance={};}}
        financeChanged=appendFinanceTransaction(finance,item,item.nextDue)||financeChanged;item.nextDue=nextOccurrence(item,item.nextDue);count++;changed=true;
      }
      if(item.endDate&&item.nextDue>item.endDate)item.active=false;
    }
    if(financeChanged){localStorage.setItem(dataKey,JSON.stringify(finance));window.dispatchEvent(new CustomEvent('folio-finance-updated',{detail:finance}));}
    if(changed)write(schedules);
    presentPending();
    }finally{processing=false;}
  }
  window.FolioRecurring={key:scheduleKey,read,write,resolve,formatDate,money};
  window.addEventListener('folio-recurring-changed',()=>{presentPending();if(!processing)window.setTimeout(processDue,0);});
  window.addEventListener('storage',event=>{
    if(event.key===scheduleKey)presentPending();
    if(event.key===dataKey){let finance={};try{finance=JSON.parse(event.newValue)||{};}catch{}window.dispatchEvent(new CustomEvent('folio-finance-updated',{detail:finance}));}
  });
  processDue();window.setInterval(processDue,30000);
})();
