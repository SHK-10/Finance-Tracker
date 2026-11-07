(() => {
  const $=id=>document.getElementById(id),api=window.FolioNetWorth;
  const labels={cash:'Cash',bank:'Bank balance',investment:'Investment',loan:'Loan',other:'Other asset'};
  let data=api.read();
  let selectedList=null;
  $('todayLabel').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  $('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';};
  applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
  function renderItem(item){
    const card=document.createElement('article');card.className='net-worth-item';
    const icon=document.createElement('span');icon.className=`net-worth-item-icon ${item.type==='loan'?'liability':''}`;icon.textContent=item.type==='loan'?'−':'+';icon.setAttribute('aria-hidden','true');
    const details=document.createElement('span');details.className='net-worth-item-details';const name=document.createElement('strong');name.textContent=item.name;const type=document.createElement('small');type.textContent=labels[item.type]||'Other asset';details.append(name,type);
    const amount=document.createElement('strong');amount.className='net-worth-item-amount';amount.textContent=api.money(Number(item.amount)||0);
    const actions=document.createElement('span');actions.className='net-worth-item-actions';
    const edit=document.createElement('button');edit.className='secondary-btn';edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>openForm(item));
    const remove=document.createElement('button');remove.className='secondary-btn';remove.type='button';remove.textContent='Delete';remove.addEventListener('click',()=>{if(!confirm(`Delete ${item.name} from net worth?`))return;data.items=data.items.filter(entry=>entry.id!==item.id);save();});actions.append(edit,remove);
    card.append(icon,details,amount,actions);return card;
  }
  function render(){
    const totals=api.summarize(data),assets=totals.items.filter(item=>item.type!=='loan'),loans=totals.items.filter(item=>item.type==='loan');
    $('netWorthTotal').textContent=api.money(totals.netWorth);$('netWorthTotal').classList.toggle('negative-value',totals.netWorth<0);$('netWorthAssets').textContent=api.money(totals.assets);$('netWorthLoans').textContent=api.money(totals.loans);
    $('netWorthAssetCount').textContent=`${assets.length} ${assets.length===1?'item':'items'}`;$('netWorthLoanCount').textContent=`${loans.length} ${loans.length===1?'item':'items'}`;
    const assetHost=$('netWorthAssetsList'),loanHost=$('netWorthLoansList');assetHost.replaceChildren(...assets.map(renderItem));loanHost.replaceChildren(...loans.map(renderItem));
    $('netWorthAssetsEmpty').hidden=assets.length>0;$('netWorthLoansEmpty').hidden=loans.length>0;
    api.recordSnapshot(data);renderHistory();renderComparison();
  }
  function dateForPeriod(mode,dateValue){
    const today=new Date(),base=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    if(mode==='custom')return dateValue?new Date(`${dateValue}T12:00:00`):null;
    if(mode==='yesterday')base.setDate(base.getDate()-1);
    const shiftMonths=amount=>{const day=base.getDate();base.setDate(1);base.setMonth(base.getMonth()+amount);base.setDate(Math.min(day,new Date(base.getFullYear(),base.getMonth()+1,0).getDate()));};
    if(mode==='previousMonth')shiftMonths(-1);
    if(mode==='threeMonths')shiftMonths(-3);
    if(mode==='sixMonths')shiftMonths(-6);
    if(mode==='year')shiftMonths(-12);
    return base;
  }
  const localDateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function snapshotAt(date){
    const dateKey=localDateKey(date),history=api.readHistory().filter(item=>item.date<=dateKey).sort((a,b)=>b.date.localeCompare(a.date));
    if(history.length)return history[0];
    if(dateKey>=localDateKey(new Date())){const totals=api.summarize(data);return {date:dateKey,assets:totals.assets,liabilities:totals.loans,netWorth:totals.netWorth};}
    return null;
  }
  function renderComparison(){
    const modeA=$('netWorthPeriodA').value,modeB=$('netWorthPeriodB').value,dateA=dateForPeriod(modeA,$('netWorthDateA').value),dateB=dateForPeriod(modeB,$('netWorthDateB').value);
    $('netWorthDateA').hidden=modeA!=='custom';$('netWorthDateB').hidden=modeB!=='custom';const result=$('netWorthCompareResult');result.classList.remove('positive','negative','neutral');
    if(!dateA||!dateB){$('netWorthCompareLabel').textContent='Choose a date for each custom period.';$('netWorthCompareChange').textContent='—';$('netWorthCompareDetail').textContent='';return;}
    const current=snapshotAt(dateA),previous=snapshotAt(dateB);
    if(!current||!previous){$('netWorthCompareLabel').textContent='Not enough saved history for these dates.';$('netWorthCompareChange').textContent='—';$('netWorthCompareDetail').textContent='Net worth history starts from the first saved snapshot.';return;}
    const difference=current.netWorth-previous.netWorth;$('netWorthCompareLabel').textContent=`${current.date} compared with ${previous.date}`;$('netWorthCompareChange').textContent=`${difference>0?'↑ ':difference<0?'↓ ':''}${api.money(Math.abs(difference))}`;$('netWorthCompareDetail').textContent=`Net worth: ${api.money(current.netWorth)} vs ${api.money(previous.netWorth)}.`;result.classList.add(difference>0?'positive':difference<0?'negative':'neutral');
  }
  function renderHistory(){
    const history=api.readHistory().sort((a,b)=>b.date.localeCompare(a.date)),host=$('netWorthHistoryRows');host.replaceChildren();$('netWorthHistoryEmpty').hidden=history.length>0;
    for(const snapshot of history){const row=document.createElement('tr');for(const [value,align] of [[snapshot.date,''],[api.money(snapshot.assets),'align-right'],[api.money(snapshot.liabilities),'align-right'],[api.money(snapshot.netWorth),'align-right']]){const cell=document.createElement('td');cell.textContent=value;if(align)cell.className=align;row.append(cell);}host.append(row);}
  }
  function selectList(type){
    selectedList=selectedList===type?null:type;
    const showAssets=selectedList==='assets',showLoans=selectedList==='loans';
    $('netWorthLists').hidden=!selectedList;$('netWorthAssetsPanel').hidden=!showAssets;$('netWorthLoansPanel').hidden=!showLoans;
    $('showAssets').setAttribute('aria-pressed',String(showAssets));$('showLoans').setAttribute('aria-pressed',String(showLoans));
    $('showAssets').classList.toggle('selected',showAssets);$('showLoans').classList.toggle('selected',showLoans);
  }
  for(const [id,type] of [['showAssets','assets'],['showLoans','loans']]){
    const control=$(id);control.addEventListener('click',()=>selectList(type));
    control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectList(type);}});
  }
  function save(){api.write(data);render();}
  function openForm(item=null,defaultType=null){
    $('netWorthForm').reset();$('netWorthItemId').value=item?.id||'';$('netWorthDialogTitle').textContent=item?'Edit balance':'Add a balance';$('netWorthName').value=item?.name||'';$('netWorthType').value=item?.type||defaultType||(selectedList==='loans'?'loan':'cash');$('netWorthAmount').value=item?.amount??'';$('netWorthDialog').showModal();
  }
  document.querySelectorAll('[data-net-worth-add]').forEach(button=>button.addEventListener('click',()=>openForm(null,button.dataset.netWorthAdd==='liability'?'loan':'cash')));
  $('closeNetWorthDialog').addEventListener('click',()=>$('netWorthDialog').close());
  $('netWorthDialog').addEventListener('click',event=>{if(event.target===$('netWorthDialog'))$('netWorthDialog').close();});
  $('netWorthForm').addEventListener('submit',event=>{
    event.preventDefault();const id=$('netWorthItemId').value,existing=data.items.find(item=>item.id===id),entry={id:id||crypto.randomUUID(),name:$('netWorthName').value.trim(),type:$('netWorthType').value,amount:Number($('netWorthAmount').value)};
    data.items=existing?data.items.map(item=>item.id===id?entry:item):[entry,...data.items];save();$('netWorthDialog').close();
  });
  $('compareNetWorth').addEventListener('click',renderComparison);
  for(const suffix of ['A','B'])$('netWorthPeriod'+suffix).addEventListener('change',renderComparison);
  for(const suffix of ['A','B'])$('netWorthDate'+suffix).addEventListener('change',renderComparison);
  $('toggleNetWorthHistory').addEventListener('click',()=>{const show=$('netWorthHistoryWrap').hidden;$('netWorthHistoryWrap').hidden=!show;$('toggleNetWorthHistory').setAttribute('aria-expanded',String(show));$('toggleNetWorthHistory').textContent=show?'Hide history':'View all history';});
  window.addEventListener('folio-net-worth-updated',()=>{data=api.read();render();});
  window.addEventListener('storage',event=>{if(event.key===api.key){data=api.read();render();}});
  function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
  $('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
  document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
  render();
})();
