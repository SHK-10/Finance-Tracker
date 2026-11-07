const $ = id => document.getElementById(id);
const money = value => `Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const labels = {today:'Today',yesterday:'Yesterday',week:'One week',month:'This month',threeMonths:'Three months',sixMonths:'Six months',year:'One year',all:'All time'};
const icons = {'Food & dining':'◒',Shopping:'◇',Transport:'↗',Housing:'⌂',Entertainment:'♫',Health:'✚',Salary:'↙',Other:'◈'};
const today = new Date();
const todayStart = new Date(today.getFullYear(),today.getMonth(),today.getDate());
let finance = {};
try { finance = JSON.parse(localStorage.getItem(FolioAccounts.dataKey())) || {}; } catch {}
let transactions = Array.isArray(finance.transactions) ? finance.transactions : [];

function txDate(value){return new Date(`${value}T12:00:00`);}
function getRange(mode){
  if(mode==='today')return {start:todayStart,end:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1)};
  if(mode==='yesterday')return {start:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()-1),end:todayStart};
  if(mode==='week')return {start:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()-6),end:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1)};
  if(mode==='month')return {start:new Date(today.getFullYear(),today.getMonth(),1),end:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1)};
  if(mode==='threeMonths'||mode==='sixMonths'||mode==='year'){
    const count=mode==='threeMonths'?3:mode==='sixMonths'?6:12;
    return {start:new Date(today.getFullYear(),today.getMonth()-count+1,1),end:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1)};
  }
  const dates=transactions.map(tx=>txDate(tx.date)).filter(date=>!Number.isNaN(date.getTime()));
  const first=dates.length?dates.reduce((min,date)=>date<min?date:min):new Date(today.getFullYear(),today.getMonth(),1);
  return {start:new Date(first.getFullYear(),first.getMonth(),1),end:new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1)};
}
function selectedTransactions(mode){const range=getRange(mode);return transactions.filter(tx=>{const date=txDate(tx.date);return !Number.isNaN(date.getTime())&&date>=range.start&&date<range.end;});}
function totals(list){return list.reduce((out,tx)=>{const amount=Number(tx.amount)||0;out[tx.type==='income'?'income':'expense']+=amount;return out;},{income:0,expense:0});}
function setTheme(theme){document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';}
function makeBuckets(mode){
  const range=getRange(mode),buckets=[];
  if(mode==='today'||mode==='yesterday')return [{start:range.start,end:range.end,label:labels[mode]}];
  if(mode==='week'){
    for(let index=0;index<7;index++){const start=new Date(range.start.getFullYear(),range.start.getMonth(),range.start.getDate()+index);buckets.push({start,end:new Date(start.getFullYear(),start.getMonth(),start.getDate()+1),label:start.toLocaleDateString('en-US',{weekday:'short'})});}
    return buckets;
  }
  if(mode==='month'){
    const days=Math.max(1,Math.ceil((range.end-range.start)/86400000)),count=Math.min(6,days);
    for(let index=0;index<count;index++){const offset=Math.floor(index*days/count),endOffset=Math.floor((index+1)*days/count);const start=new Date(range.start.getFullYear(),range.start.getMonth(),range.start.getDate()+offset),end=new Date(range.start.getFullYear(),range.start.getMonth(),range.start.getDate()+Math.max(offset+1,endOffset));buckets.push({start,end,label:start.toLocaleDateString('en-US',{month:'short',day:'numeric'})});}
    return buckets;
  }
  const count=mode==='threeMonths'?3:mode==='sixMonths'?6:mode==='year'?12:Math.min(12,Math.max(1,(today.getFullYear()-range.start.getFullYear())*12+today.getMonth()-range.start.getMonth()+1));
  const startMonth=mode==='all'?new Date(today.getFullYear(),today.getMonth()-count+1,1):range.start;
  for(let index=0;index<count;index++){const start=new Date(startMonth.getFullYear(),startMonth.getMonth()+index,1);buckets.push({start,end:new Date(start.getFullYear(),start.getMonth()+1,1),label:start.toLocaleDateString('en-US',{month:'short',year:count>6?'2-digit':undefined})});}
  return buckets;
}
function renderCashflow(){
  const mode=$('cashflowPeriod').value,list=selectedTransactions(mode),sum=totals(list),net=sum.income-sum.expense;
  $('cashflowRangeTitle').textContent=labels[mode];$('cashflowRangeNote').textContent='Income, expenses, and net cash flow';
  $('cashflowIncome').textContent=money(sum.income);$('cashflowExpenses').textContent=money(sum.expense);$('cashflowNet').textContent=money(net);$('cashflowNet').classList.toggle('negative-value',net<0);$('cashflowNetNote').textContent=net<0?'Expenses exceed income':'Income minus expenses';
  $('cashflowEmpty').hidden=list.length>0;
  const buckets=makeBuckets(mode).map(bucket=>({...bucket,income:0,expense:0}));
  for(const tx of list){const date=txDate(tx.date),bucket=buckets.find(item=>date>=item.start&&date<item.end);if(bucket)bucket[tx.type==='income'?'income':'expense']+=Number(tx.amount)||0;}
  const maximum=Math.max(1,...buckets.flatMap(bucket=>[bucket.income,bucket.expense]));
  const chart=$('cashflowChart');chart.innerHTML='';chart.setAttribute('aria-label',`${buckets.length} time periods. Income ${money(sum.income)} and expenses ${money(sum.expense)}.`);
  buckets.forEach(bucket=>{const group=document.createElement('div');group.className='cashflow-bar-group';group.innerHTML=`<div class="cashflow-bars"><i class="cashflow-bar income-bar" style="height:${bucket.income?Math.max(2,bucket.income/maximum*100):0}%" title="Income ${money(bucket.income)}"></i><i class="cashflow-bar expense-bar" style="height:${bucket.expense?Math.max(2,bucket.expense/maximum*100):0}%" title="Expenses ${money(bucket.expense)}"></i></div><span class="cashflow-bar-label"></span>`;group.querySelector('.cashflow-bar-label').textContent=bucket.label;chart.appendChild(group);});
  const host=$('cashflowActivity');host.innerHTML='';const recent=[...list].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  if(!recent.length){host.innerHTML='<p class="analytics-empty">No transactions recorded in this period.</p>';}
  for(const tx of recent){const row=document.createElement('div');row.className='cashflow-activity-row';const info=document.createElement('div');info.className='cashflow-activity-info';const icon=document.createElement('span');icon.className=`tx-icon ${tx.type==='income'?'income':''}`;icon.textContent=icons[tx.category]||icons.Other;const copy=document.createElement('span');copy.className='cashflow-activity-copy';const name=document.createElement('strong');name.textContent=tx.name;const meta=document.createElement('small');meta.textContent=`${tx.category} · ${txDate(tx.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;copy.append(name,meta);info.append(icon,copy);const amount=document.createElement('strong');amount.className=`cashflow-activity-amount ${tx.type==='income'?'income':''}`;amount.textContent=`${tx.type==='income'?'+':'−'}${money(Number(tx.amount)||0)}`;row.append(info,amount);host.appendChild(row);}
  $('cashflowActivityNote').textContent=`${list.length} ${list.length===1?'transaction':'transactions'} included in this summary.`;
}
function comparisonRange(mode,startValue,endValue){
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1),tomorrow=new Date(todayStart.getFullYear(),todayStart.getMonth(),todayStart.getDate()+1);
  const shiftMonth=offset=>new Date(today.getFullYear(),today.getMonth()+offset,1);
  if(mode==='today')return {start:todayStart,end:tomorrow,label:'Today'};
  if(mode==='yesterday')return {start:new Date(today.getFullYear(),today.getMonth(),today.getDate()-1),end:todayStart,label:'Yesterday'};
  if(mode==='month')return {start:monthStart,end:tomorrow,label:'This month'};
  if(mode==='previousMonth'){const start=shiftMonth(-1),days=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();return {start,end:new Date(start.getFullYear(),start.getMonth(),Math.min(today.getDate(),days)+1),label:'Same dates last month'};}
  if(mode==='threeMonths')return {start:shiftMonth(-2),end:tomorrow,label:'Last 3 months'};
  if(mode==='previousThreeMonths')return {start:shiftMonth(-5),end:shiftMonth(-2),label:'Previous 3 months'};
  if(mode==='sixMonths')return {start:shiftMonth(-5),end:tomorrow,label:'Last 6 months'};
  if(mode==='previousSixMonths')return {start:shiftMonth(-11),end:shiftMonth(-5),label:'Previous 6 months'};
  if(mode==='year')return {start:shiftMonth(-11),end:tomorrow,label:'Last 1 year'};
  if(mode==='previousYear')return {start:shiftMonth(-23),end:shiftMonth(-11),label:'Previous 1 year'};
  if(mode==='custom'&&startValue&&endValue){const start=new Date(`${startValue}T00:00:00`),endDate=new Date(`${endValue}T00:00:00`);if(!Number.isNaN(start.getTime())&&!Number.isNaN(endDate.getTime())&&endDate>=start){const end=new Date(endDate.getFullYear(),endDate.getMonth(),endDate.getDate()+1);return {start,end,label:`${startValue} to ${endValue}`};}}
  return null;
}
function compareMetricCard(label,a,b,periodA,periodB,lowerIsBetter=false){
  const difference=a-b,maximum=Math.max(Math.abs(a),Math.abs(b),1),good=lowerIsBetter?difference<=0:difference>=0;
  const card=document.createElement('article');card.className='report-compare-card';
  const heading=document.createElement('h3');heading.textContent=label;
  const values=document.createElement('div');values.className='report-compare-values';
  for(const [period,value] of [[periodA.label,a],[periodB.label,b]]){const item=document.createElement('span');item.textContent=period;const strong=document.createElement('strong');strong.textContent=money(value);item.append(strong);values.append(item);}
  const bars=document.createElement('div');bars.className='report-compare-bars';bars.setAttribute('aria-hidden','true');
  const current=document.createElement('i');current.className='current';current.style.width=`${Math.abs(a)/maximum*100}%`;
  const previous=document.createElement('i');previous.className='previous';previous.style.width=`${Math.abs(b)/maximum*100}%`;bars.append(current,previous);
  const change=document.createElement('strong');change.className=`report-compare-change ${difference===0?'neutral':good?'positive':'negative'}`;
  change.textContent=difference===0?'No change':`${difference>0?'↑':'↓'} ${money(Math.abs(difference))}${b===0?' · New':` · ${Math.abs(difference/Math.abs(b)*100).toFixed(1)}%`}`;
  card.append(heading,values,bars,change);return card;
}
function renderNetSavingsGrowth(netA,netB,rangeA,rangeB){
  const difference=netA-netB,change=$('netSavingGrowthChange'),good=difference>=0;
  $('netSavingGrowthLabelA').textContent=rangeA.label;$('netSavingGrowthLabelB').textContent=rangeB.label;
  $('netSavingGrowthValueA').textContent=money(netA);$('netSavingGrowthValueB').textContent=money(netB);
  change.className=`net-savings-growth-change ${difference===0?'neutral':good?'positive':'negative'}`;
  change.textContent=difference===0?'No change':`${difference>0?'↑':'↓'} ${money(Math.abs(difference))}${netB>0?` · ${Math.abs(difference/netB*100).toFixed(1)}%`:''}`;
  $('netSavingGrowthText').textContent=difference===0?'Net savings are unchanged between the selected periods.':`${good?'Net savings increased':'Net savings decreased'} from Period B to Period A.`;
}
function renderCompareData(){
  const modeA=$('comparePeriodA').value,modeB=$('comparePeriodB').value;
  const rangeA=comparisonRange(modeA,$('compareStartA').value,$('compareEndA').value),rangeB=comparisonRange(modeB,$('compareStartB').value,$('compareEndB').value);
  const host=$('reportCompareResults');host.replaceChildren();host.classList.remove('all-metrics','single-metric');
  const metric=$('compareMetric').value;
  $('compareCategoryField').hidden=metric!=='category';
  if(metric==='category'){
    const categorySelect=$('compareCategory'),selected=categorySelect.value,categories=[...new Set(transactions.map(tx=>tx.category||'Other'))].sort();
    categorySelect.replaceChildren(...categories.map(category=>{const option=document.createElement('option');option.value=category;option.textContent=category;return option;}));
    if(categories.includes(selected))categorySelect.value=selected;
  }
  if(!rangeA||!rangeB){$('reportCompareCaption').textContent='Choose valid start and end dates for both periods.';$('netSavingGrowthChange').textContent='—';$('netSavingGrowthChange').className='net-savings-growth-change neutral';$('netSavingGrowthText').textContent='Select two valid periods to compare net savings.';$('netSavingGrowthValueA').textContent='—';$('netSavingGrowthValueB').textContent='—';return;}
  $('reportCompareCaption').textContent=`${rangeA.label} compared with ${rangeB.label}.`;
  const listFor=range=>transactions.filter(tx=>{const date=txDate(tx.date);return !Number.isNaN(date.getTime())&&date>=range.start&&date<range.end;});
  const listA=listFor(rangeA),listB=listFor(rangeB),sumA=totals(listA),sumB=totals(listB),netA=sumA.income-sumA.expense,netB=sumB.income-sumB.expense;
  renderNetSavingsGrowth(netA,netB,rangeA,rangeB);
  host.classList.add(metric==='all'?'all-metrics':'single-metric');
  if(metric==='all'){
    host.append(compareMetricCard('Income',sumA.income,sumB.income,rangeA,rangeB));
    host.append(compareMetricCard('Expenses',sumA.expense,sumB.expense,rangeA,rangeB,true));
    host.append(compareMetricCard('Net savings',netA,netB,rangeA,rangeB));
  }else if(metric==='income')host.append(compareMetricCard('Income',sumA.income,sumB.income,rangeA,rangeB));
  else if(metric==='expense')host.append(compareMetricCard('Expenses',sumA.expense,sumB.expense,rangeA,rangeB,true));
  else if(metric==='net')host.append(compareMetricCard('Net savings',netA,netB,rangeA,rangeB));
  else{const category=$('compareCategory').value,amount=list=>list.filter(tx=>tx.type==='expense'&&(tx.category||'Other')===category).reduce((total,tx)=>total+(Number(tx.amount)||0),0);host.append(compareMetricCard(`${category||'Category'} expenses`,amount(listA),amount(listB),rangeA,rangeB,true));}
}
function renderReporting(){
  const mode=$('reportPeriod').value,list=selectedTransactions(mode),sum=totals(list),net=sum.income-sum.expense;
  $('reportRangeTitle').textContent=labels[mode];$('reportIncome').textContent=money(sum.income);$('reportExpenses').textContent=money(sum.expense);$('reportNet').textContent=money(net);$('reportNet').classList.toggle('negative-value',net<0);$('reportSavingsRate').textContent=`${sum.income?Math.round(net/sum.income*100):0}% savings rate`;
  const categories=new Map();for(const tx of list){if(tx.type==='expense'){const name=tx.category||'Other';categories.set(name,(categories.get(name)||0)+(Number(tx.amount)||0));}}
  const categoryList=[...categories.entries()].sort((a,b)=>b[1]-a[1]),maxCategory=Math.max(1,...categoryList.map(item=>item[1]));const categoryHost=$('reportCategories');categoryHost.innerHTML='';$('reportCategoryEmpty').hidden=categoryList.length>0;
  categoryList.forEach(([name,amount])=>{const row=document.createElement('div');row.className='report-category-row';row.innerHTML=`<div class="report-category-head"><span class="report-category-name"><i class="budget-emoji">${icons[name]||icons.Other}</i><strong></strong></span><strong>${money(amount)}</strong></div><div class="goal-progress-track"><div class="goal-progress-fill" style="width:${amount/maxCategory*100}%"></div></div>`;row.querySelector('.report-category-name strong').textContent=name;categoryHost.appendChild(row);});
  const expenses=list.filter(tx=>tx.type==='expense'),largest=expenses.reduce((best,tx)=>Number(tx.amount)>Number(best?.amount||0)?tx:best,null);
  $('reportTransactionCount').textContent=list.length;$('reportLargestExpense').textContent=largest?`${largest.name} · ${money(Number(largest.amount)||0)}`:'—';$('reportAverageExpense').textContent=money(expenses.length?sum.expense/expenses.length:0);$('reportTransactionCaption').textContent=`${list.length} recorded ${list.length===1?'transaction':'transactions'} for ${labels[mode].toLowerCase()}.`;$('reportRowCount').textContent=`${list.length} ${list.length===1?'record':'records'}`;
  const tbody=$('reportRows');tbody.innerHTML='';$('reportEmpty').hidden=list.length>0;
  [...list].sort((a,b)=>b.date.localeCompare(a.date)).forEach(tx=>{const row=document.createElement('tr'),name=document.createElement('td'),category=document.createElement('td'),date=document.createElement('td'),amount=document.createElement('td');name.innerHTML=`<span class="report-tx-name"><i class="tx-icon ${tx.type==='income'?'income':''}">${icons[tx.category]||icons.Other}</i></span>`;name.querySelector('.report-tx-name').append(document.createTextNode(tx.name));category.textContent=tx.category||'Other';const parsed=txDate(tx.date);date.textContent=Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});amount.className=`tx-amount align-right ${tx.type==='income'?'income':''}`;amount.textContent=`${tx.type==='income'?'+':'−'}${money(Number(tx.amount)||0)}`;row.append(name,category,date,amount);tbody.appendChild(row);});
}
function exportReport(){
  const mode=$('reportPeriod').value,list=[...selectedTransactions(mode)].sort((a,b)=>a.date.localeCompare(b.date));
  const fields=['Date','Name','Type','Category','Amount'];const escape=value=>`"${String(value??'').replaceAll('"','""')}"`;
  const rows=[fields,...list.map(tx=>[tx.date,tx.name,tx.type,tx.category,Number(tx.amount)||0])].map(row=>row.map(escape).join(',')).join('\r\n');
  const blob=new Blob([rows],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`folio-report-${mode}-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
}
$('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
setTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);setTheme(next);});
if(document.body.dataset.analyticsPage==='cashflow'){$('cashflowPeriod').addEventListener('change',renderCashflow);renderCashflow();}
if(document.body.dataset.analyticsPage==='reporting'){
  $('comparePeriodA').value='month';$('comparePeriodB').value='previousMonth';
  $('reportPeriod').addEventListener('change',renderReporting);$('exportReport').addEventListener('click',exportReport);
  for(const suffix of ['A','B']){
    const period=$(`comparePeriod${suffix}`),custom=$(`compareCustom${suffix}`);
    period.addEventListener('change',()=>{custom.hidden=period.value!=='custom';renderCompareData();});
    $(`compareStart${suffix}`).addEventListener('change',renderCompareData);$(`compareEnd${suffix}`).addEventListener('change',renderCompareData);
  }
  $('compareMetric').addEventListener('change',renderCompareData);$('compareCategory').addEventListener('change',renderCompareData);
  renderReporting();renderCompareData();
}
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
window.addEventListener('folio-finance-updated',event=>{finance=event.detail||{};transactions=Array.isArray(finance.transactions)?finance.transactions:[];if(document.body.dataset.analyticsPage==='cashflow')renderCashflow();if(document.body.dataset.analyticsPage==='reporting'){renderReporting();renderCompareData();}});
