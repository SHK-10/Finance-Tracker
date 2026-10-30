const STORE_KEY = 'folio-finance-v1';
const defaults = { transactions: [], budgets: [
  {category:'Food & dining',limit:650}, {category:'Shopping',limit:400}, {category:'Transport',limit:250}
] };
let state;
try { state = JSON.parse(localStorage.getItem(FolioAccounts.dataKey())) || structuredClone(defaults); } catch { state = structuredClone(defaults); }
const $ = (id) => document.getElementById(id);
const THEME_KEY = 'folio-theme';
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  $('themeIcon').textContent = dark ? '☀' : '☾';
  $('themeToggle').setAttribute('aria-label', dark ? 'Turn on light mode' : 'Turn on dark mode');
  $('themeToggle').title = dark ? 'Turn on light mode' : 'Turn on dark mode';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171b18' : '#f5f6f2';
}
const money = (value) => `Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const today = new Date();
const dateKey = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const monthMatch = (date, offset=0) => { const d = new Date(`${date}T12:00:00`); const target = new Date(today.getFullYear(),today.getMonth()+offset,1); return d.getMonth()===target.getMonth() && d.getFullYear()===target.getFullYear(); };
function save(){ localStorage.setItem(FolioAccounts.dataKey(),JSON.stringify(state)); render(); }
function emoji(category){ return ({'Food & dining':'◒','Shopping':'◇','Transport':'↗','Housing':'⌂','Entertainment':'♫','Health':'✚','Salary':'↙','Other':'◈'})[category] || '◈'; }
function renderSummary(){
  const income=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expenses=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const thisMonth=state.transactions.filter(t=>monthMatch(t.date));
  const monthIncome=thisMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const monthSpend=thisMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  $('totalBalance').textContent=money(income-expenses); $('monthlyIncome').textContent=money(monthIncome); $('monthlySpend').textContent=money(monthSpend);
  $('savingsRate').textContent=monthIncome?Math.max(0,Math.round((monthIncome-monthSpend)/monthIncome*100)):0;
  $('balanceTrend').textContent=state.transactions.length?'Your tracked balance':'Add your first transaction';
}
function renderTransactions(){
  const tbody=$('transactionRows'); tbody.innerHTML=''; const list=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  $('emptyState').classList.toggle('show',!list.length); tbody.style.display=list.length?'':'none';
  $('clearDemoData').hidden=!state.transactions.some(tx=>tx.demo);
  for(const tx of list){const tr=document.createElement('tr'); const date=new Date(`${tx.date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); tr.innerHTML=`<td><div class="transaction-info"><span class="tx-icon ${tx.type}">${emoji(tx.category)}</span>${escapeHtml(tx.name)}${tx.demo?'<span class="demo-badge">DEMO</span>':''}</div></td><td><span class="category-chip">${escapeHtml(tx.category)}</span></td><td>${date}</td><td class="tx-amount ${tx.type==='income'?'income':''}">${tx.type==='income'?'+':'−'}${money(tx.amount)}</td>`; tbody.appendChild(tr); }
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderBudgets(){
  const host=$('budgetList'); host.innerHTML=''; if(!state.budgets.length){host.innerHTML='<div class="budget-empty">No budgets yet. Add one to start tracking.</div>';return;}
  for(const b of state.budgets){const spent=state.transactions.filter(t=>t.type==='expense'&&t.category===b.category&&monthMatch(t.date)).reduce((s,t)=>s+t.amount,0);const pct=Math.min(100,b.limit?spent/b.limit*100:0);const row=document.createElement('div');row.className='budget-item';row.innerHTML=`<div class="budget-head"><div class="budget-name"><span class="budget-emoji">${emoji(b.category)}</span>${escapeHtml(b.category)}</div><span class="budget-values"><strong>${money(spent)}</strong> / ${money(b.limit)}</span></div><div class="progress-track"><div class="progress-fill ${spent>b.limit?'over':''}" style="width:${pct}%"></div></div>`;host.appendChild(row);}
}
function renderChart(){
  const mode=$('periodSelect').value;
  const startOfDay=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const addDays=(date,amount)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+amount);
  const todayStart=startOfDay(today);
  let buckets=[];
  let rangeStart=null;
  if(mode==='today'||mode==='yesterday'){
    rangeStart=addDays(todayStart,mode==='today'?0:-1);
    buckets=[{start:rangeStart,end:addDays(rangeStart,1),label:mode==='today'?'Today':'Yesterday',income:0,expense:0}];
  }else if(mode==='week'||mode==='month'){
    const days=mode==='week'?7:todayStart.getDate();
    rangeStart=mode==='week'?addDays(todayStart,1-days):new Date(todayStart.getFullYear(),todayStart.getMonth(),1);
    const bucketCount=mode==='week'?7:Math.min(6,days);
    buckets=Array.from({length:bucketCount},(_,index)=>{
      const offset=Math.floor(index*days/bucketCount),endOffset=Math.floor((index+1)*days/bucketCount);
      const start=addDays(rangeStart,offset),end=addDays(rangeStart,endOffset);
      return {start,end,label:mode==='week'?start.toLocaleDateString('en-US',{weekday:'short'}):start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),income:0,expense:0};
    });
  }else{
    const monthCount=mode==='threeMonths'?3:mode==='sixMonths'?6:mode==='year'?12:0;
    const monthStart=date=>new Date(date.getFullYear(),date.getMonth(),1);
    if(mode==='all'){
      const dates=state.transactions.map(tx=>new Date(`${tx.date}T12:00:00`)).filter(date=>!Number.isNaN(date.getTime()));
      const earliest=dates.length?monthStart(dates.reduce((min,date)=>date<min?date:min)):new Date(today.getFullYear(),today.getMonth()-5,1);
      const totalMonths=(today.getFullYear()-earliest.getFullYear())*12+today.getMonth()-earliest.getMonth()+1;
      const count=Math.min(12,Math.max(1,totalMonths));
      rangeStart=new Date(today.getFullYear(),today.getMonth()-count+1,1);
      buckets=Array.from({length:count},(_,index)=>{const start=new Date(rangeStart.getFullYear(),rangeStart.getMonth()+index,1),end=new Date(start.getFullYear(),start.getMonth()+1,1);return {start,end,label:start.toLocaleDateString('en-US',{month:'short'}),income:0,expense:0};});
    }else{
      rangeStart=new Date(today.getFullYear(),today.getMonth()-monthCount+1,1);
      buckets=Array.from({length:monthCount},(_,index)=>{const start=new Date(rangeStart.getFullYear(),rangeStart.getMonth()+index,1),end=new Date(start.getFullYear(),start.getMonth()+1,1);return {start,end,label:start.toLocaleDateString('en-US',{month:'short'}),income:0,expense:0};});
    }
  }
  const endOfRange=addDays(todayStart,1);
  const selectedTransactions=state.transactions.filter(tx=>{const date=new Date(`${tx.date}T12:00:00`);return mode==='all'||(date>=rangeStart&&date<endOfRange);});
  for(const tx of selectedTransactions){const date=new Date(`${tx.date}T12:00:00`),bucket=buckets.find(item=>date>=item.start&&date<item.end);if(bucket&&Object.hasOwn(bucket,tx.type))bucket[tx.type]+=tx.amount;}
  const max=Math.max(100,...buckets.flatMap(bucket=>[bucket.income,bucket.expense]));
  $('barChart').innerHTML='';$('chartLabels').innerHTML='';$('chartYAxis').innerHTML='';
  for(let tick=4;tick>=0;tick--){const value=max*tick/4,label=document.createElement('span');const short=value>=1000000?`${(value/1000000).toFixed(value%1000000?1:0)}m`:value>=1000?`${(value/1000).toFixed(value%1000?1:0)}k`:Math.round(value);label.textContent=`Nrs ${short}`;$('chartYAxis').appendChild(label);}
  for(const bucket of buckets){const group=document.createElement('div');group.className='bar-group';group.innerHTML=`<div class="bar expense-bar" style="height:${Math.max(bucket.expense?2:0,bucket.expense/max*92)}%" title="Expenses ${money(bucket.expense)}"></div><div class="bar income-bar" style="height:${Math.max(bucket.income?2:0,bucket.income/max*92)}%" title="Income ${money(bucket.income)}"></div>`;$('barChart').appendChild(group);const label=document.createElement('span');label.textContent=bucket.label;$('chartLabels').appendChild(label);}
  $('chartTotal').textContent=money(selectedTransactions.filter(tx=>tx.type==='expense').reduce((sum,tx)=>sum+tx.amount,0));
}
function render(){renderSummary();renderTransactions();renderBudgets();renderChart();}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400);}
function openDialog(dialog){dialog.showModal();}
$('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
$('txDate').value=dateKey(today);
applyTheme(localStorage.getItem(THEME_KEY)==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem(THEME_KEY,next);applyTheme(next);});
$('addTransaction').addEventListener('click',()=>openDialog($('transactionDialog')));
$('emptyAdd').addEventListener('click',()=>openDialog($('transactionDialog')));
$('addBudget').addEventListener('click',()=>openDialog($('budgetDialog')));
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
$('transactionForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);state.transactions.unshift({id:crypto.randomUUID(),name:data.get('name').trim(),amount:Number(data.get('amount')),type:data.get('type'),category:data.get('category'),date:data.get('date')});save();e.currentTarget.reset();$('txDate').value=dateKey(today);$('transactionDialog').close();toast('Transaction added');});
$('budgetForm').addEventListener('submit',e=>{e.preventDefault();const category=$('budgetCategory').value,limit=Number($('budgetLimit').value);const existing=state.budgets.find(b=>b.category===category);if(existing)existing.limit=limit;else state.budgets.push({category,limit});save();e.currentTarget.reset();$('budgetDialog').close();toast('Budget saved');});
$('periodSelect').addEventListener('change',renderChart);
$('learnMore').addEventListener('click',()=>toast('A calmer view of your money, one step at a time.'));
$('viewTransactions').addEventListener('click',e=>{if(state.transactions.length>5){e.preventDefault();const tbody=$('transactionRows');tbody.innerHTML='';const list=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));for(const tx of list){const tr=document.createElement('tr'),date=new Date(`${tx.date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});tr.innerHTML=`<td><div class="transaction-info"><span class="tx-icon ${tx.type}">${emoji(tx.category)}</span>${escapeHtml(tx.name)}${tx.demo?'<span class="demo-badge">DEMO</span>':''}</div></td><td><span class="category-chip">${escapeHtml(tx.category)}</span></td><td>${date}</td><td class="tx-amount ${tx.type==='income'?'income':''}">${tx.type==='income'?'+':'−'}${money(tx.amount)}</td>`;tbody.appendChild(tr);}toast('Showing all transactions');}});
$('clearDemoData').addEventListener('click',()=>{if(confirm('Remove the demo transactions from this account?')){state.transactions=state.transactions.filter(tx=>!tx.demo);save();toast('Demo transactions removed');}});
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));
$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>{setMobileMenu(false);document.querySelectorAll('.nav-link,.nav-sublink').forEach(n=>n.classList.remove('active'));link.classList.add('active');}));
const demoSeedKey=`folio-demo-seeded-${FolioAccounts.currentId()}`;
if(!localStorage.getItem(demoSeedKey)){
  const daysAgo=days=>{const date=new Date();date.setDate(date.getDate()-days);return dateKey(date);};
  const sampleAmount=(min,max)=>Math.round((min+Math.random()*(max-min))/50)*50;
  state.transactions.push(
    {id:crypto.randomUUID(),name:'Monthly salary',amount:sampleAmount(65000,90000),type:'income',category:'Salary',date:daysAgo(2),demo:true},
    {id:crypto.randomUUID(),name:'Weekly groceries',amount:sampleAmount(1800,4200),type:'expense',category:'Food & dining',date:daysAgo(1),demo:true},
    {id:crypto.randomUUID(),name:'Ride to work',amount:sampleAmount(250,900),type:'expense',category:'Transport',date:daysAgo(3),demo:true},
    {id:crypto.randomUUID(),name:'Coffee with friends',amount:sampleAmount(350,1100),type:'expense',category:'Food & dining',date:daysAgo(4),demo:true},
    {id:crypto.randomUUID(),name:'Home supplies',amount:sampleAmount(900,2600),type:'expense',category:'Shopping',date:daysAgo(6),demo:true}
  );
  localStorage.setItem(FolioAccounts.dataKey(),JSON.stringify(state));
  localStorage.setItem(demoSeedKey,'1');
}
render();
