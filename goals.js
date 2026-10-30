const $ = id => document.getElementById(id);
const GOALS_KEY = `${FolioAccounts.dataKey()}-goals`;
const money = value => `Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const icons = {emergency:'✚',home:'⌂',vehicle:'↗',travel:'✈',education:'▤',health:'✚',custom:'✳'};
const labels = {emergency:'Emergency fund',home:'Home',vehicle:'Vehicle',travel:'Travel',education:'Education',health:'Health',custom:'Custom goal'};
const today = new Date();
let finance = {};
try { finance = JSON.parse(localStorage.getItem(FolioAccounts.dataKey())) || {}; } catch {}
let goals;
try { goals = JSON.parse(localStorage.getItem(GOALS_KEY)); } catch { goals = null; }
if (!Array.isArray(goals)) goals = [{id:'emergency-fund',name:'Emergency fund',type:'emergency',target:150000,saved:0,createdAt:new Date().toISOString()}];

function saveGoals(){localStorage.setItem(GOALS_KEY,JSON.stringify(goals));renderGoals();}
function recentMonthlySavings(){
  const transactions=Array.isArray(finance.transactions)?finance.transactions:[];
  const cutoff=new Date(today.getFullYear(),today.getMonth()-2,1);
  const endOfToday=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
  const months=new Map();
  for(const tx of transactions){
    if(!tx.date||!Number.isFinite(Number(tx.amount)))continue;
    const date=new Date(`${tx.date}T12:00:00`);
    if(Number.isNaN(date.getTime())||date<cutoff||date>=endOfToday)continue;
    const key=`${date.getFullYear()}-${date.getMonth()}`;
    const bucket=months.get(key)||{income:0,expense:0};
    bucket[tx.type==='income'?'income':'expense']+=Number(tx.amount);
    months.set(key,bucket);
  }
  if(!months.size)return 0;
  return Math.max(0,[...months.values()].reduce((sum,month)=>sum+month.income-month.expense,0)/months.size);
}
function estimatedDate(goal,monthlyRate){
  const remaining=Math.max(0,Number(goal.target)-Number(goal.saved));
  if(!remaining)return 'Goal reached';
  if(monthlyRate<=0)return 'Add income and expenses to estimate';
  const months=Math.ceil(remaining/monthlyRate);
  if(months>1200)return 'More than 100 years at this rate';
  const date=new Date(today.getFullYear(),today.getMonth()+months,1);
  return `Around ${date.toLocaleDateString('en-US',{month:'long',year:'numeric'})}`;
}
function renderGoals(){
  const rate=recentMonthlySavings();
  const total=goals.reduce((sum,goal)=>sum+Number(goal.saved||0),0);
  $('totalSaved').textContent=money(total);
  $('monthlySavingsRate').textContent=money(rate);
  $('goalCount').textContent=`Across ${goals.length} ${goals.length===1?'goal':'goals'}`;
  $('activeGoalCount').textContent=goals.filter(goal=>Number(goal.saved)<Number(goal.target)).length;
  const host=$('goalList');host.innerHTML='';
  goals.forEach(goal=>{
    const target=Math.max(0,Number(goal.target)||0),saved=Math.max(0,Number(goal.saved)||0),pct=target?Math.min(100,saved/target*100):0;
    const card=document.createElement('article');card.className=`goal-card${goal.type==='emergency'?' emergency-goal':''}`;
    card.innerHTML=`<div class="goal-card-top"><span class="goal-icon">${icons[goal.type]||icons.custom}</span><span class="goal-type">${labels[goal.type]||labels.custom}</span>${goal.type==='emergency'?'<span class="goal-featured">ESSENTIAL</span>':''}</div><h3 class="goal-name"></h3><div class="goal-amounts"><strong>${money(saved)}</strong><span>of ${money(target)}</span></div><div class="goal-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${Math.round(pct)} percent saved"><div class="goal-progress-fill" style="width:${pct}%"></div></div><div class="goal-progress-meta"><span>${Math.round(pct)}% saved</span><span>${money(Math.max(0,target-saved))} to go</span></div><div class="goal-date"><span>Estimated completion</span><strong>${estimatedDate(goal,rate)}</strong></div><div class="goal-card-actions"><button class="secondary-btn goal-add" type="button">＋ Add savings</button><button class="goal-edit" type="button" aria-label="Edit goal">Edit</button>${goal.type==='emergency'?'':'<button class="goal-delete" type="button" aria-label="Delete goal">Delete</button>'}</div>`;
    card.querySelector('.goal-name').textContent=goal.name;
    card.querySelector('.goal-add').addEventListener('click',()=>{$('contributionGoalId').value=goal.id;$('contributionTitle').textContent=`Add to ${goal.name}`;$('contributionForm').reset();$('contributionDialog').showModal();});
    card.querySelector('.goal-edit').addEventListener('click',()=>openGoalEditor(goal));
    const remove=card.querySelector('.goal-delete');if(remove)remove.addEventListener('click',()=>{goals=goals.filter(item=>item.id!==goal.id);saveGoals();});
    host.appendChild(card);
  });
}
function openGoalEditor(goal){
  $('goalForm').reset();$('goalId').value=goal?.id||'';$('goalName').value=goal?.name||'';$('goalType').value=goal?.type||'custom';$('goalTarget').value=goal?.target||'';$('goalCurrent').value=goal?.saved||0;
  $('goalDialogTitle').textContent=goal?'Edit savings goal':'Create a savings goal';$('goalDialogEyebrow').textContent=goal?'UPDATE YOUR PLAN':'YOUR NEXT MILESTONE';$('goalName').readOnly=goal?.type==='emergency';$('goalType').disabled=goal?.type==='emergency';$('goalDialog').showModal();
}
function applyTheme(theme){document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';}
$('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
$('createGoalButton').addEventListener('click',()=>openGoalEditor(null));
$('goalType').addEventListener('change',()=>{if(!$('goalId').value&&$('goalType').value==='emergency')$('goalName').value='Emergency fund';else if(!$('goalId').value&&$('goalName').value==='Emergency fund')$('goalName').value='';});
$('goalForm').addEventListener('submit',event=>{
  event.preventDefault();const id=$('goalId').value,name=$('goalName').value.trim(),type=$('goalType').value,target=Number($('goalTarget').value),saved=Number($('goalCurrent').value);
  if(!name||target<=0||saved<0)return;
  if(!id&&type==='emergency'&&goals.some(goal=>goal.type==='emergency')){alert('An emergency fund tracker already exists. Edit that tracker to change it.');return;}
  if(id){const goal=goals.find(item=>item.id===id);if(goal){goal.name=goal.type==='emergency'?'Emergency fund':name;goal.type=goal.type==='emergency'?'emergency':type;goal.target=target;goal.saved=saved;}}
  else goals.push({id:crypto.randomUUID(),name,type,target,saved,createdAt:new Date().toISOString()});
  saveGoals();$('goalDialog').close();
});
$('contributionForm').addEventListener('submit',event=>{event.preventDefault();const goal=goals.find(item=>item.id===$('contributionGoalId').value);const amount=Number($('contributionAmount').value);if(!goal||amount<=0)return;goal.saved=Number(goal.saved||0)+amount;saveGoals();$('contributionDialog').close();event.currentTarget.reset();});
document.querySelectorAll('[data-goal-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
renderGoals();
