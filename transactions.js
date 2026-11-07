(() => {
  const $=id=>document.getElementById(id),money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
  const icons={'Food & dining':'◒',Shopping:'◇',Transport:'↗',Transportation:'↗',Housing:'⌂',Entertainment:'♫',Health:'✚',Salary:'↙',Other:'◈'};
  let finance={};try{finance=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{};}catch{}
  if(!Array.isArray(finance.transactions))finance.transactions=[];
  const transactions=()=>finance.transactions;
  const categoryNames=()=>[...new Set([...['Food & dining','Shopping','Transport','Housing','Entertainment','Health','Salary','Utilities','Internet','Subscription','Other'],...transactions().map(tx=>tx.category||'Other')])].sort((a,b)=>a.localeCompare(b));
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const setTheme=theme=>{document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';};
  $('todayLabel').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});$('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
  setTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);setTheme(next);});
  function refreshCategoryFilter(){const select=$('transactionCategoryFilter'),selected=select.value;select.replaceChildren(new Option('All categories','all'),...categoryNames().map(name=>new Option(name,name)));if(categoryNames().includes(selected))select.value=selected;}
  function addCell(row,content,className=''){const cell=document.createElement('td');if(className)cell.className=className;if(content instanceof Node)cell.append(content);else cell.textContent=content;row.append(cell);return cell;}
  function render(){
    refreshCategoryFilter();const query=$('transactionSearch').value.trim().toLowerCase(),type=$('transactionTypeFilter').value,category=$('transactionCategoryFilter').value,from=$('transactionDateFrom').value,to=$('transactionDateTo').value;
    const visible=transactions().filter(tx=>{
      const searchable=[tx.name,tx.category,tx.notes,...(Array.isArray(tx.tags)?tx.tags:[])].join(' ').toLowerCase();
      return (!query||searchable.includes(query))&&(type==='all'||tx.type===type)&&(category==='all'||(tx.category||'Other')===category)&&(!from||tx.date>=from)&&(!to||tx.date<=to);
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const host=$('managedTransactionRows');host.replaceChildren();
    for(const tx of visible){
      const row=document.createElement('tr'),nameCell=document.createElement('td'),nameLine=document.createElement('div');nameLine.className='managed-transaction-name';
      const icon=document.createElement('span');icon.className=`tx-icon ${tx.type==='income'?'income':''}`;icon.textContent=icons[tx.category]||icons.Other;icon.setAttribute('aria-hidden','true');
      const name=document.createElement('strong');name.textContent=tx.name;nameLine.append(icon,name);nameCell.append(nameLine);
      if(tx.notes){const note=document.createElement('small');note.className='managed-transaction-note';note.textContent=tx.notes;nameCell.append(note);}
      row.append(nameCell);
      const categoryCell=document.createElement('td'),categoryChip=document.createElement('span');categoryChip.className='category-chip';categoryChip.textContent=tx.category||'Other';categoryCell.append(categoryChip);
      if(Array.isArray(tx.tags)&&tx.tags.length){const tags=document.createElement('span');tags.className='transaction-tag-list';for(const value of tx.tags){const tag=document.createElement('span');tag.className='transaction-tag';tag.textContent=value;tags.append(tag);}categoryCell.append(tags);}
      row.append(categoryCell);
      addCell(row,tx.type==='income'?'Income':'Expense');
      const parsed=new Date(`${tx.date}T12:00:00`);addCell(row,Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
      addCell(row,`${tx.type==='income'?'+':'−'}${money(Number(tx.amount)||0)}`,`tx-amount ${tx.type==='income'?'income':''}`);
      const actions=document.createElement('td'),edit=document.createElement('button');edit.className='secondary-btn transaction-action';edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>openForm(tx));
      const remove=document.createElement('button');remove.className='secondary-btn transaction-action';remove.type='button';remove.textContent='Delete';remove.addEventListener('click',()=>{if(!confirm(`Delete “${tx.name}”?`))return;finance.transactions=transactions().filter(item=>item.id!==tx.id);save();});actions.append(edit,remove);row.append(actions);host.append(row);
    }
    $('managedTransactionCount').textContent=`${visible.length} ${visible.length===1?'record':'records'}`;
    $('managedTransactionSummary').textContent=visible.length===transactions().length?'Search by name, note, or tag.':`Showing ${visible.length} of ${transactions().length} transactions.`;
    $('managedTransactionsEmpty').hidden=visible.length>0;
  }
  function setFormCategories(selected){const values=categoryNames();$('managedTransactionCategory').replaceChildren(...values.map(value=>new Option(value,value)));if(selected&&values.includes(selected))$('managedTransactionCategory').value=selected;}
  function openForm(tx=null){
    $('managedTransactionForm').reset();$('managedTransactionId').value=tx?.id||'';$('managedTransactionDialogTitle').textContent=tx?'Edit transaction':'Add transaction';
    $('managedTransactionName').value=tx?.name||'';$('managedTransactionAmount').value=tx?.amount??'';$('managedTransactionType').value=tx?.type||'expense';setFormCategories(tx?.category||'Food & dining');$('managedTransactionDate').value=tx?.date||dateKey(new Date());$('managedTransactionNotes').value=tx?.notes||'';$('managedTransactionTags').value=Array.isArray(tx?.tags)?tx.tags.join(', '):'';$('managedTransactionDialog').showModal();
  }
  function save(){localStorage.setItem(FolioAccounts.dataKey(),JSON.stringify(finance));window.dispatchEvent(new CustomEvent('folio-finance-updated',{detail:finance}));render();}
  $('newTransactionButton').addEventListener('click',()=>openForm());$('closeManagedTransactionDialog').addEventListener('click',()=>$('managedTransactionDialog').close());
  $('managedTransactionDialog').addEventListener('click',event=>{if(event.target===$('managedTransactionDialog'))$('managedTransactionDialog').close();});
  $('managedTransactionForm').addEventListener('submit',event=>{
    event.preventDefault();const id=$('managedTransactionId').value,existing=transactions().find(tx=>tx.id===id),tags=[...new Set($('managedTransactionTags').value.split(',').map(value=>value.trim()).filter(Boolean))];
    const entry={...(existing||{}),id:id||crypto.randomUUID(),name:$('managedTransactionName').value.trim(),amount:Number($('managedTransactionAmount').value),type:$('managedTransactionType').value,category:$('managedTransactionCategory').value,date:$('managedTransactionDate').value,notes:$('managedTransactionNotes').value.trim(),tags};
    finance.transactions=existing?transactions().map(tx=>tx.id===id?entry:tx):[entry,...transactions()];save();$('managedTransactionDialog').close();
  });
  ['transactionSearch','transactionTypeFilter','transactionCategoryFilter','transactionDateFrom','transactionDateTo'].forEach(id=>$(id).addEventListener(id==='transactionSearch'?'input':'change',render));
  $('clearTransactionFilters').addEventListener('click',()=>{$('transactionSearch').value='';$('transactionTypeFilter').value='all';$('transactionCategoryFilter').value='all';$('transactionDateFrom').value='';$('transactionDateTo').value='';render();});
  window.addEventListener('folio-finance-updated',event=>{if(event.detail&&typeof event.detail==='object')finance=event.detail;else{try{finance=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{};}catch{finance={};}}if(!Array.isArray(finance.transactions))finance.transactions=[];render();});
  function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
  $('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
  document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
  render();
})();
