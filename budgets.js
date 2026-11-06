const $ = id => document.getElementById(id);
const DEFAULT_BUDGETS=[{category:'Food & dining',limit:650},{category:'Shopping',limit:400},{category:'Transport',limit:250}];
let budgetState;
try{budgetState=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}catch{budgetState={transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}
const money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const today=new Date();
const startToday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
const endTomorrow=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
const categoryIcon={'Food & dining':'◒','Shopping':'◇','Transport':'↗','Housing':'⌂','Entertainment':'♫','Health':'✚','Other':'◈'};
function txDate(value){return new Date(`${value}T12:00:00`);}
function getRange(mode){
  if(mode==='today')return {start:startToday,end:endTomorrow,label:'Today'};
  if(mode==='yesterday')return {start:new Date(today.getFullYear(),today.getMonth(),today.getDate()-1),end:startToday,label:'Yesterday'};
  if(mode==='week')return {start:new Date(today.getFullYear(),today.getMonth(),today.getDate()-6),end:endTomorrow,label:'One week'};
  if(mode==='month')return {start:new Date(today.getFullYear(),today.getMonth(),1),end:new Date(today.getFullYear(),today.getMonth()+1,1),label:'This month'};
  if(mode==='threeMonths')return {start:new Date(today.getFullYear(),today.getMonth()-2,1),end:new Date(today.getFullYear(),today.getMonth()+1,1),label:'Three months'};
  if(mode==='sixMonths')return {start:new Date(today.getFullYear(),today.getMonth()-5,1),end:new Date(today.getFullYear(),today.getMonth()+1,1),label:'Six months'};
  if(mode==='year')return {start:new Date(today.getFullYear(),today.getMonth()-11,1),end:new Date(today.getFullYear(),today.getMonth()+1,1),label:'One year'};
  const validDates=budgetState.transactions.map(tx=>txDate(tx.date)).filter(date=>!Number.isNaN(date.getTime()));
  const first=validDates.length?validDates.reduce((min,date)=>date<min?date:min):new Date(today.getFullYear(),today.getMonth(),1);
  return {start:new Date(first.getFullYear(),first.getMonth(),1),end:new Date(today.getFullYear(),today.getMonth()+1,1),label:'All time'};
}
function allowanceFor(limit,start,end){
  let total=0,cursor=new Date(start.getFullYear(),start.getMonth(),1);
  while(cursor<end){
    const next=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
    const from=Math.max(start.getTime(),cursor.getTime()),to=Math.min(end.getTime(),next.getTime());
    const daysInMonth=(next-cursor)/86400000;
    total+=limit*((to-from)/86400000)/daysInMonth;
    cursor=next;
  }
  return total;
}
function renderSpendingPie(rangeTx,totalSpent){
  const colors=['#557861','#806fd1','#d18b5b','#4d93a4','#ba6680','#8c9b45','#6797cf','#a675b7','#cbad4e','#4c9b78'];
  const categories=new Map();
  for(const tx of rangeTx)categories.set(tx.category,(categories.get(tx.category)||0)+tx.amount);
  const entries=[...categories].sort((a,b)=>b[1]-a[1]);
  const chart=$('budgetPieChart'),legend=$('budgetChartLegend');
  $('budgetPieTotal').textContent=money(totalSpent);legend.replaceChildren();
  if(totalSpent<=0){chart.style.background='conic-gradient(var(--line) 0deg 360deg)';chart.setAttribute('aria-label','No spending recorded for this period');const empty=document.createElement('p');empty.className='budget-chart-empty';empty.textContent='No spending recorded for this period.';legend.append(empty);return;}
  let angle=0;
  const slices=entries.map(([category,amount],index)=>{const start=angle;angle+=amount/totalSpent*360;return {category,amount,index,start,end:angle};});
  chart.style.background=`conic-gradient(${slices.map(slice=>`${colors[slice.index%colors.length]} ${slice.start}deg ${slice.end}deg`).join(',')})`;
  chart.setAttribute('aria-label',`Spending breakdown by ${entries.length} categories, total ${money(totalSpent)}`);
  for(const slice of slices){
    const item=document.createElement('div');item.className='budget-legend-item';
    const swatch=document.createElement('span');swatch.className='budget-legend-swatch';swatch.style.backgroundColor=colors[slice.index%colors.length];swatch.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.className='budget-legend-name';name.textContent=slice.category;
    const value=document.createElement('strong');value.className='budget-legend-value';value.textContent=`${money(slice.amount)} · ${Math.round(slice.amount/totalSpent*100)}%`;
    item.append(swatch,name,value);legend.append(item);
  }
}
function renderBudgets(){
  const mode=$('periodSelect').value,range=getRange(mode),rangeTx=budgetState.transactions.filter(tx=>{const date=txDate(tx.date);return tx.type==='expense'&&date>=range.start&&date<range.end;});
  const totalSpent=rangeTx.reduce((sum,tx)=>sum+tx.amount,0);
  const totalAllowed=budgetState.budgets.reduce((sum,item)=>sum+allowanceFor(item.limit,range.start,range.end),0);
  $('rangeDescription').textContent=`Your budget and spending for ${range.label.toLowerCase()}.`;
  $('budgetStatPeriod').textContent=range.label;
  $('periodBudget').textContent=money(totalAllowed);
  $('periodSpent').textContent=money(totalSpent);
  $('periodRemaining').textContent=money(totalAllowed-totalSpent);
  $('periodRemaining').classList.toggle('over-budget',totalSpent>totalAllowed);
  $('remainingCaption').textContent=totalSpent>totalAllowed?'Over budget for this period':'Available for this period';
  renderSpendingPie(rangeTx,totalSpent);
  $('budgetCount').textContent=`${budgetState.budgets.length} ${budgetState.budgets.length===1?'category':'categories'}`;
  $('budgetPageEmpty').hidden=budgetState.budgets.length>0;
  const host=$('allBudgetList');host.innerHTML='';
  for(const item of budgetState.budgets){
    const spent=rangeTx.filter(tx=>tx.category===item.category).reduce((sum,tx)=>sum+tx.amount,0);
    const allowed=allowanceFor(item.limit,range.start,range.end),remaining=allowed-spent,pct=allowed?Math.round(spent/allowed*100):0;
    const row=document.createElement('article');row.className='all-budget-row';
    row.innerHTML=`<div class="all-budget-main"><div class="all-budget-name"><span class="budget-emoji">${categoryIcon[item.category]||'◈'}</span><span><strong></strong><small>Monthly limit ${money(item.limit)}</small></span></div><div class="all-budget-numbers"><span>Spent<strong>${money(spent)}</strong></span><span>Budget<strong>${money(allowed)}</strong></span><span class="${remaining<0?'over-budget':''}">Remaining<strong>${money(remaining)}</strong></span><span class="budget-used">${pct}% used</span><button class="edit-budget" type="button">Edit</button></div></div>`;
    row.querySelector('.all-budget-name strong').textContent=item.category;
    row.querySelector('.edit-budget').addEventListener('click',()=>{ $('budgetCategory').value=item.category;$('budgetLimit').value=item.limit;$('budgetDialog').showModal(); });
    host.appendChild(row);
  }
  renderBudgetAlerts($('budgetAlerts'),budgetState);
}
function saveBudgets(){localStorage.setItem(FolioAccounts.dataKey(),JSON.stringify(budgetState));renderBudgets();}
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;const dark=theme==='dark';
  $('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';
  document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';
}
$('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
$('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
$('periodSelect').addEventListener('change',renderBudgets);
$('addBudget').addEventListener('click',()=>{ $('budgetForm').reset();$('budgetDialog').showModal(); });
$('emptyAddBudget').addEventListener('click',()=>{ $('budgetForm').reset();$('budgetDialog').showModal(); });
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
$('budgetForm').addEventListener('submit',event=>{
  event.preventDefault();const category=$('budgetCategory').value,limit=Number($('budgetLimit').value);
  const existing=budgetState.budgets.find(item=>item.category===category);
  if(existing)existing.limit=limit;else budgetState.budgets.push({category,limit});
  saveBudgets();$('budgetDialog').close();event.currentTarget.reset();
});
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));
$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
renderBudgets();
