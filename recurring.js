(() => {
  const $=id=>document.getElementById(id),api=window.FolioRecurring;
  const today=new Date(),dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const frequencyLabels={weekly:'Every week',monthly:'Every month',yearly:'Every year'};
  let schedules=api.read();
  $('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  $('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';};
  applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
  function setCategories(type,selected){
    const values=type==='income'?['Salary','Freelance','Business','Investment','Gift','Other']:['Housing','Utilities','Internet','Food & dining','Transport','Entertainment','Health','Shopping','Subscription','Other'];
    const select=$('recurringCategory');select.replaceChildren(...values.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;return option;}));
    if(selected&&values.includes(selected))select.value=selected;
  }
  function persist(){api.write(schedules);render();}
  function render(){
    const filter=$('recurringFilter').value,list=[...schedules].filter(item=>filter==='all'||(filter==='active'?item.active:!item.active)).sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue)));
    const active=schedules.filter(item=>item.active),pending=active.filter(item=>item.pendingDueDate),next=active.filter(item=>item.nextDue).sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue)))[0];
    $('recurringActiveCount').textContent=active.length;$('recurringPendingCount').textContent=pending.length;$('recurringNextDate').textContent=next?api.formatDate(next.nextDue):'—';$('recurringNextName').textContent=next?.name||'Nothing scheduled yet';
    $('recurringEmpty').hidden=list.length>0;const host=$('recurringList');host.replaceChildren();
    for(const item of list){
      const card=document.createElement('article');card.className=`recurring-card ${item.active?'':'paused'}`;
      const main=document.createElement('div');main.className='recurring-card-main';
      const icon=document.createElement('span');icon.className=`recurring-type-icon ${item.type==='income'?'income':''}`;icon.textContent=item.type==='income'?'↙':'↗';icon.setAttribute('aria-hidden','true');
      const copy=document.createElement('div');copy.className='recurring-card-copy';const title=document.createElement('strong');title.textContent=item.name;const meta=document.createElement('span');meta.textContent=`${item.category} · ${frequencyLabels[item.frequency]||'Recurring'} · ${api.money(Number(item.amount)||0)}`;copy.append(title,meta);main.append(icon,copy);
      const badge=document.createElement('span');badge.className=`recurring-mode-badge ${item.pendingDueDate?'pending':item.approvalMode==='auto'?'automatic':''}`;badge.textContent=item.pendingDueDate?'Needs approval':item.approvalMode==='auto'?'Auto record':'Ask first';main.append(badge);card.append(main);
      const detail=document.createElement('div');detail.className='recurring-card-detail';detail.textContent=item.pendingDueDate?`Due ${api.formatDate(item.pendingDueDate)} · waiting for your approval`:item.active?`Next due ${api.formatDate(item.nextDue)}${item.endDate?` · Ends ${api.formatDate(item.endDate)}`:''}`:'Schedule paused';card.append(detail);
      const actions=document.createElement('div');actions.className='recurring-card-actions';
      if(item.pendingDueDate){const approve=document.createElement('button');approve.className='primary-btn';approve.type='button';approve.textContent='Add transaction';approve.addEventListener('click',()=>api.resolve(item.id,true));const skip=document.createElement('button');skip.className='secondary-btn';skip.type='button';skip.textContent='Skip this date';skip.addEventListener('click',()=>api.resolve(item.id,false));actions.append(approve,skip);}
      const edit=document.createElement('button');edit.className='secondary-btn';edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>openForm(item));actions.append(edit);
      const toggle=document.createElement('button');toggle.className='secondary-btn';toggle.type='button';toggle.textContent=item.active?'Pause':'Resume';toggle.addEventListener('click',()=>{item.active=!item.active;persist();});actions.append(toggle);
      const remove=document.createElement('button');remove.className='secondary-btn';remove.type='button';remove.textContent='Delete';remove.addEventListener('click',()=>{if(!confirm(`Delete the ${item.name} recurring schedule?`))return;if(item.pendingDueDate)api.resolve(item.id,false);schedules=api.read().filter(entry=>entry.id!==item.id);persist();});actions.append(remove);
      card.append(actions);host.append(card);
    }
  }
  function openForm(item=null){
    const form=$('recurringForm');form.reset();$('recurringId').value=item?.id||'';$('recurringDialogTitle').textContent=item?'Edit recurring transaction':'Add recurring transaction';
    $('recurringName').value=item?.name||'';$('recurringType').value=item?.type||'expense';setCategories($('recurringType').value,item?.category);
    $('recurringAmount').value=item?.amount??'';$('recurringFrequency').value=item?.frequency||'monthly';$('recurringStart').value=item?.nextDue||dateKey(today);$('recurringEnd').value=item?.endDate||'';$('recurringApprovalMode').value=item?.approvalMode||'ask';$('recurringDialog').showModal();
  }
  $('newRecurringButton').addEventListener('click',()=>openForm());$('recurringFilter').addEventListener('change',render);
  $('recurringType').addEventListener('change',event=>setCategories(event.target.value));
  $('closeRecurringDialog').addEventListener('click',()=>$('recurringDialog').close());
  $('recurringDialog').addEventListener('click',event=>{if(event.target===$('recurringDialog'))$('recurringDialog').close();});
  $('recurringForm').addEventListener('submit',event=>{
    event.preventDefault();const id=$('recurringId').value,start=$('recurringStart').value,end=$('recurringEnd').value;
    if(end&&end<start){$('recurringEnd').setCustomValidity('End date must be on or after the first due date.');$('recurringEnd').reportValidity();$('recurringEnd').setCustomValidity('');return;}
    const parsed=new Date(`${start}T12:00:00`),existing=schedules.find(item=>item.id===id);
    const entry={...(existing||{}),id:id||crypto.randomUUID(),name:$('recurringName').value.trim(),amount:Number($('recurringAmount').value),type:$('recurringType').value,category:$('recurringCategory').value,frequency:$('recurringFrequency').value,startDate:start,endDate:end||null,approvalMode:$('recurringApprovalMode').value,active:existing?existing.active:true,nextDue:start,pendingDueDate:null,monthDay:parsed.getDate(),monthOfYear:parsed.getMonth()};
    if(existing)schedules=schedules.map(item=>item.id===id?entry:item);else schedules.unshift(entry);
    persist();$('recurringDialog').close();
  });
  window.addEventListener('folio-recurring-changed',event=>{if(Array.isArray(event.detail)){schedules=event.detail;render();}});
  window.addEventListener('storage',event=>{if(event.key===api.key){schedules=api.read();render();}});
  function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
  $('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
  document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
  render();
})();
