const $ = id => document.getElementById(id);
const DEFAULT_BUDGETS=[{category:'Food & dining',limit:650},{category:'Shopping',limit:400},{category:'Transport',limit:250}];
const DEFAULT_CATEGORIES=['Food & dining','Shopping','Transport','Housing','Entertainment','Health','Other'];
let budgetState;
let editingBudgetCategory=null;
try{budgetState=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}catch{budgetState={transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}
if(!Array.isArray(budgetState.budgets))budgetState.budgets=structuredClone(DEFAULT_BUDGETS);
if(!Array.isArray(budgetState.categories))budgetState.categories=[...new Set([...DEFAULT_CATEGORIES,...budgetState.budgets.map(item=>item.category),...(Array.isArray(budgetState.transactions)?budgetState.transactions.map(tx=>tx.category):[])].filter(Boolean))];
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
    const alertThreshold=Math.min(99,Math.max(1,Number(item.alertThreshold)||80));
    row.innerHTML=`<div class="all-budget-main"><div class="all-budget-name"><span class="budget-emoji">${categoryIcon[item.category]||'◈'}</span><span><strong></strong><small>Monthly limit ${money(item.limit)} · Alert at ${alertThreshold}%</small></span></div><div class="all-budget-numbers"><span>Spent<strong>${money(spent)}</strong></span><span>Budget<strong>${money(allowed)}</strong></span><span class="${remaining<0?'over-budget':''}">Remaining<strong>${money(remaining)}</strong></span><span class="budget-used">${pct}% used</span><button class="edit-budget" type="button">Edit</button></div></div>`;
    row.querySelector('.all-budget-name strong').textContent=item.category;
    row.querySelector('.edit-budget').addEventListener('click',()=>openBudgetForm(item));
    host.appendChild(row);
  }
  renderBudgetAlerts($('budgetAlerts'),budgetState);
}
function saveBudgets(){localStorage.setItem(FolioAccounts.dataKey(),JSON.stringify(budgetState));renderBudgets();}
function toggleCustomBudgetCategory(){
  const custom=$('budgetCategory').value==='__new_custom__';$('customBudgetCategoryField').hidden=!custom;$('customBudgetCategory').required=custom;
}
function populateBudgetCategories(selected=''){
  const select=$('budgetCategory');select.replaceChildren();
  for(const category of budgetState.categories){const option=document.createElement('option');option.value=category;option.textContent=category;select.append(option);}
  const custom=document.createElement('option');custom.value='__new_custom__';custom.textContent='＋ Create new category…';select.append(custom);
  if(selected&&[...select.options].some(option=>option.value===selected))select.value=selected;
}
function openBudgetForm(item=null){
  $('budgetForm').reset();editingBudgetCategory=item?.category||null;populateBudgetCategories(item?.category||budgetState.categories[0]||'__new_custom__');
  const known=!!item&&budgetState.categories.includes(item.category);
  $('budgetCategory').value=item?(known?item.category:'__new_custom__'):(budgetState.categories[0]||'__new_custom__');
  $('customBudgetCategory').value=item&&!known?item.category:'';
  $('budgetLimit').value=item?.limit??'';$('budgetAlertThreshold').value=item?Math.min(99,Math.max(1,Number(item.alertThreshold)||80)):80;
  toggleCustomBudgetCategory();$('budgetDialog').showModal();
}
function renderBudgetCategories(){
  const host=$('budgetCategoryList');host.replaceChildren();
  if(!budgetState.categories.length){const empty=document.createElement('p');empty.className='budget-category-empty';empty.textContent='No categories yet. Add a category to create a budget for it.';host.append(empty);return;}
  for(const category of [...budgetState.categories].sort((a,b)=>a.localeCompare(b))){
    const row=document.createElement('div');row.className='budget-category-row';const name=document.createElement('strong');name.textContent=category;
    const budget=budgetState.budgets.find(item=>item.category===category),detail=document.createElement('span');detail.textContent=budget?'Budget set':'No budget yet';
    const remove=document.createElement('button');remove.type='button';remove.className='budget-category-delete';remove.textContent='Delete';remove.setAttribute('aria-label',`Delete ${category} category`);
    remove.addEventListener('click',()=>{
      const warning=budget?`Delete “${category}” and its budget? Existing transactions will remain in your history.`:`Delete “${category}”? Existing transactions will remain in your history.`;
      if(!confirm(warning))return;
      budgetState.categories=budgetState.categories.filter(item=>item!==category);budgetState.budgets=budgetState.budgets.filter(item=>item.category!==category);saveBudgets();renderBudgetCategories();
    });
    row.append(name,detail,remove);host.append(row);
  }
}
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
$('addBudget').addEventListener('click',()=>openBudgetForm());
$('emptyAddBudget').addEventListener('click',()=>openBudgetForm());
$('budgetCategory').addEventListener('change',toggleCustomBudgetCategory);
$('manageBudgetCategories').addEventListener('click',()=>{renderBudgetCategories();$('budgetCategoryDialog').showModal();});
$('closeBudgetCategoryDialog').addEventListener('click',()=>$('budgetCategoryDialog').close());
$('budgetCategoryDialog').addEventListener('click',event=>{if(event.target===$('budgetCategoryDialog'))$('budgetCategoryDialog').close();});
$('budgetCategoryForm').addEventListener('submit',event=>{
  event.preventDefault();const name=$('newBudgetCategory').value.trim();if(!name)return;
  if(budgetState.categories.some(category=>category.toLowerCase()===name.toLowerCase())){alert(`The category “${name}” already exists.`);return;}
  budgetState.categories.push(name);saveBudgets();renderBudgetCategories();event.currentTarget.reset();
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
$('budgetForm').addEventListener('submit',event=>{
  event.preventDefault();const creatingCategory=$('budgetCategory').value==='__new_custom__',category=creatingCategory?$('customBudgetCategory').value.trim():$('budgetCategory').value,limit=Number($('budgetLimit').value),alertThreshold=Number($('budgetAlertThreshold').value);
  if(!category){$('customBudgetCategory').focus();return;}
  const canonicalCategory=budgetState.categories.find(item=>item.toLowerCase()===category.toLowerCase());
  const finalCategory=canonicalCategory||category;
  const existing=editingBudgetCategory?budgetState.budgets.find(item=>item.category===editingBudgetCategory):budgetState.budgets.find(item=>item.category===finalCategory);
  const duplicate=budgetState.budgets.find(item=>item.category===finalCategory&&item!==existing);
  if(duplicate){alert(`A budget for ${finalCategory} already exists.`);return;}
  if(!canonicalCategory)budgetState.categories.push(category);
  if(existing){if(existing.category!==finalCategory){if(Array.isArray(budgetState.transactions))for(const tx of budgetState.transactions)if(tx.category===editingBudgetCategory)tx.category=finalCategory;budgetState.categories=budgetState.categories.filter(item=>item!==editingBudgetCategory);}existing.category=finalCategory;existing.limit=limit;existing.alertThreshold=alertThreshold;}else budgetState.budgets.push({category:finalCategory,limit,alertThreshold});
  editingBudgetCategory=null;
  saveBudgets();$('budgetDialog').close();event.currentTarget.reset();
});
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));
$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
renderBudgets();
window.addEventListener('folio-finance-updated',event=>{if(event.detail&&typeof event.detail==='object')budgetState=event.detail;else{try{budgetState=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}catch{budgetState={transactions:[],budgets:structuredClone(DEFAULT_BUDGETS)};}}renderBudgets();});
