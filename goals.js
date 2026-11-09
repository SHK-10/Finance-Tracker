const $ = id => document.getElementById(id);
const GOALS_KEY = `${FolioAccounts.dataKey()}-goals`;
const PLAN_SETTINGS_KEY = `${GOALS_KEY}-settings`;
const EMERGENCY_DELETED_KEY = `${GOALS_KEY}-emergency-deleted`;
const REMINDERS_KEY = `${FolioAccounts.dataKey()}-reminders`;
const money = value => `Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const icons = {emergency:'✚',debt:'↘',retirement:'↗',home:'⌂',vehicle:'↗',travel:'✈',education:'▤',health:'✚',business:'◇',custom:'✳'};
const labels = {emergency:'Emergency fund',debt:'Debt payoff',retirement:'Retirement / investing',home:'Home',vehicle:'Vehicle',travel:'Travel',education:'Education',health:'Health protection',business:'Business',custom:'Custom goal'};
const essentials=/housing|rent|food|dining|transport|medical|health|utility|utilities|internet|insurance/i;
const today = new Date();
let finance = {};
try { finance = JSON.parse(localStorage.getItem(FolioAccounts.dataKey())) || {}; } catch {}
let goals;
try { goals = JSON.parse(localStorage.getItem(GOALS_KEY)); } catch { goals = null; }
if (!Array.isArray(goals)) goals = [{id:'emergency-fund',name:'Emergency fund',type:'emergency',target:0,saved:0,targetMonths:3,createdAt:new Date().toISOString()}];
if(!goals.some(goal=>goal.type==='emergency')&&localStorage.getItem(EMERGENCY_DELETED_KEY)!=='true')goals.unshift({id:'emergency-fund',name:'Emergency fund',type:'emergency',target:0,saved:0,targetMonths:3,createdAt:new Date().toISOString()});
let planSettings={salaryDay:null,emergencyMonths:3};
try{planSettings={...planSettings,...JSON.parse(localStorage.getItem(PLAN_SETTINGS_KEY))};}catch{}
planSettings.emergencyMonths=Number(planSettings.emergencyMonths)===6?6:3;

function saveGoals(){localStorage.setItem(GOALS_KEY,JSON.stringify(goals));window.dispatchEvent(new CustomEvent('folio-financial-plan-changed',{detail:goals}));renderGoals();}
function savePlanSettings(){localStorage.setItem(PLAN_SETTINGS_KEY,JSON.stringify(planSettings));}
let contributionMode='add';
function openContributionDialog(goal,mode='add'){
  contributionMode=mode;$('contributionForm').reset();$('contributionGoalId').value=goal.id;
  const withdrawing=mode==='withdraw';
  $('contributionTitle').textContent=`${withdrawing?'Withdraw from':'Add to'} ${goal.name}`;
  $('contributionAmountLabel').textContent=withdrawing?'Amount to withdraw':'Amount to add';
  $('contributionAmount').max=withdrawing?String(Math.max(0,Number(goal.saved)||0)):'';
  $('contributionSubmit').innerHTML=withdrawing?'Withdraw amount <span>→</span>':'Add savings <span>→</span>';
  $('contributionError').hidden=true;$('contributionError').textContent='';
  $('contributionDialog').showModal();
}
function salaryTransactions(){return (Array.isArray(finance.transactions)?finance.transactions:[]).filter(tx=>tx.type==='income'&&(/salary/i.test(String(tx.category||''))||/salary/i.test(String(tx.name||''))));}
function monthlyEssentialCosts(){
  const transactions=(Array.isArray(finance.transactions)?finance.transactions:[]),now=new Date(),first=new Date(now.getFullYear(),now.getMonth()-5,1),monthTotals=new Map();let earliest=null;
  for(const tx of transactions){if(tx.type!=='expense'||!essentials.test(String(tx.category||''))||!tx.date)continue;const date=new Date(`${tx.date}T12:00:00`);if(Number.isNaN(date.getTime())||date<first||date>now)continue;earliest=earliest&&earliest<date?earliest:date;const key=`${date.getFullYear()}-${date.getMonth()}`;monthTotals.set(key,(monthTotals.get(key)||0)+(Number(tx.amount)||0));}
  if(!monthTotals.size)return {average:0,months:0};
  const months=Math.max(1,(now.getFullYear()-earliest.getFullYear())*12+now.getMonth()-earliest.getMonth()+1),total=[...monthTotals.values()].reduce((sum,value)=>sum+value,0);
  return {average:total/months,months};
}
function nextPayday(day,immediateIfToday=false){
  const now=new Date(),candidate=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()),9,0,0,0);
  if(immediateIfToday&&day===now.getDate())return now;
  if(candidate>now)return candidate;
  const next=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()),9,0,0,0);return next;
}
function syncPaydayReminder(){
  let reminders=[];try{const saved=JSON.parse(localStorage.getItem(REMINDERS_KEY));if(Array.isArray(saved))reminders=saved;}catch{}
  const id=`financial-plan-emergency-payday-${FolioAccounts.currentId()}`,existing=reminders.find(item=>item.id===id),day=Number(planSettings.salaryDay),emergency=goals.find(goal=>goal.type==='emergency');
  if(!day||!emergency){if(existing){reminders=reminders.filter(item=>item.id!==id);localStorage.setItem(REMINDERS_KEY,JSON.stringify(reminders));window.dispatchEvent(new CustomEvent('folio-reminders-changed',{detail:reminders}));}return;}
  if(existing&&Number(existing.salaryDay)===day)return;
  reminders=reminders.filter(item=>item.id!==id);const due=nextPayday(day,!existing&&day===today.getDate());
  reminders.push({id,title:'Emergency fund salary-day check-in',kind:'custom',goalReminder:'emergency-fund',salaryDay:day,dueAt:due.toISOString(),repeat:'monthly',amount:0,notes:'We will remind you only if your emergency fund is below the 3-month minimum.',enabled:true,delivered:false,createdAt:new Date().toISOString()});
  localStorage.setItem(REMINDERS_KEY,JSON.stringify(reminders));window.dispatchEvent(new CustomEvent('folio-reminders-changed',{detail:reminders}));
}
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
function updateEmergencyGoal(){
  let emergency=goals.find(goal=>goal.type==='emergency'),changed=false;
  if(!emergency&&localStorage.getItem(EMERGENCY_DELETED_KEY)==='true')return {emergency:null,estimate:monthlyEssentialCosts(),months:planSettings.emergencyMonths};
  if(!emergency){emergency={id:'emergency-fund',name:'Emergency fund',type:'emergency',target:0,saved:0,targetMonths:3,createdAt:new Date().toISOString()};goals.unshift(emergency);changed=true;}
  if(!emergency.configured&&(Number(emergency.saved)>0||emergency.customTarget)){emergency.configured=true;changed=true;}
  const estimate=monthlyEssentialCosts(),months=planSettings.emergencyMonths===6?6:3;
  if(Number(emergency.targetMonths)!==months){emergency.targetMonths=months;changed=true;}
  if(!emergency.customTarget&&estimate.average>0&&Math.abs((Number(emergency.target)||0)-estimate.average*months)>0.01){emergency.target=estimate.average*months;changed=true;}
  if(changed)localStorage.setItem(GOALS_KEY,JSON.stringify(goals));
  return {emergency,estimate,months};
}
const suggestedPlans=[
  {type:'debt',name:'Pay off high-interest debt',detail:'Reduce costly debt and free up future income.'},
  {type:'retirement',name:'Retirement and investing',detail:'Build long-term savings for future independence.'},
  {type:'health',name:'Health and protection',detail:'Prepare for medical and insurance costs.'},
  {type:'home',name:'Home or housing',detail:'Save toward a home purchase or housing stability.'},
  {type:'education',name:'Education and skills',detail:'Invest in learning and career opportunities.'}
];
function renderSuggestions(){
  const host=$('suggestedGoals');host.replaceChildren();const emergency=updateEmergencyGoal().emergency;
  const emergencyPlan={type:'emergency',name:'Emergency fund',detail:'Build a reserve for unexpected costs and essential expenses.'};
  const available=[emergencyPlan,...suggestedPlans.filter(plan=>!goals.some(goal=>goal.type===plan.type))];
  if(!available.length){const note=document.createElement('p');note.className='suggested-goals-empty';note.textContent='You have added all the suggested goal types. Create a custom goal any time.';host.append(note);return;}
  for(const plan of available){const card=document.createElement('article');card.className='suggested-goal-card';const icon=document.createElement('span');icon.className='suggested-goal-icon';icon.textContent=icons[plan.type]||'✳';const title=document.createElement('strong');title.textContent=plan.name;const detail=document.createElement('p');detail.textContent=plan.detail;const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent='＋ Add goal';button.addEventListener('click',()=>plan.type==='emergency'?openGoalEditor(emergency):openGoalEditor(null,plan));card.append(icon,title,detail,button);host.append(card);}
}
function renderGoals(){
  renderSuggestions();
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
    card.innerHTML=`<div class="goal-card-top"><span class="goal-icon">${icons[goal.type]||icons.custom}</span><span class="goal-type">${labels[goal.type]||labels.custom}</span>${goal.type==='emergency'?'<span class="goal-featured">ESSENTIAL</span>':''}</div><h3 class="goal-name"></h3><div class="goal-amounts"><strong>${money(saved)}</strong><span>of ${money(target)}</span></div><div class="goal-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${Math.round(pct)} percent saved"><div class="goal-progress-fill" style="width:${pct}%"></div></div><div class="goal-progress-meta"><span>${Math.round(pct)}% saved</span><span>${money(Math.max(0,target-saved))} to go</span></div><div class="goal-date"><span>Estimated completion</span><strong>${estimatedDate(goal,rate)}</strong></div><div class="goal-card-actions"><button class="secondary-btn goal-add" type="button">＋ Add savings</button><button class="goal-withdraw" type="button" aria-label="Withdraw from goal" ${saved<=0?'disabled':''}>Withdraw</button><button class="goal-edit" type="button" aria-label="Edit goal">Edit</button><button class="goal-delete" type="button" aria-label="Delete goal">Delete</button></div>`;
    card.querySelector('.goal-name').textContent=goal.name;
    card.querySelector('.goal-add').addEventListener('click',()=>openContributionDialog(goal,'add'));
    card.querySelector('.goal-withdraw').addEventListener('click',()=>openContributionDialog(goal,'withdraw'));
    card.querySelector('.goal-edit').addEventListener('click',()=>openGoalEditor(goal));
    const remove=card.querySelector('.goal-delete');if(remove)remove.addEventListener('click',()=>{goals=goals.filter(item=>item.id!==goal.id);if(goal.type==='emergency')localStorage.setItem(EMERGENCY_DELETED_KEY,'true');saveGoals();});
    host.appendChild(card);
  });
}
function openGoalEditor(goal,suggestion=null){
  $('goalForm').reset();$('goalId').value=goal?.id||'';$('goalName').value=goal?.name||'';$('goalType').value=goal?.type||'custom';const estimatedEmergencyTarget=monthlyEssentialCosts().average*planSettings.emergencyMonths,existingEmergencyTarget=Number(goal?.target)||0;$('goalTarget').value=goal?.type==='emergency'?(goal.customTarget?existingEmergencyTarget:estimatedEmergencyTarget||existingEmergencyTarget||''):goal?.target||'';$('goalCurrent').value=goal?.saved||0;
  if(suggestion){$('goalName').value=suggestion.name;$('goalType').value=suggestion.type;}
  $('emergencyRange').value=String(goal?.targetMonths||planSettings.emergencyMonths);$('emergencyRangeField').classList.toggle('hidden',$('goalType').value!=='emergency');
  $('goalDialogTitle').textContent=goal?'Edit financial goal':'Create a financial goal';$('goalDialogEyebrow').textContent=goal?'UPDATE YOUR PLAN':'YOUR NEXT MILESTONE';$('goalName').readOnly=goal?.type==='emergency';$('goalType').disabled=goal?.type==='emergency';$('goalTarget').readOnly=false;$('goalDialog').showModal();
}
function applyTheme(theme){document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';}
$('todayLabel').textContent=today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
$('createGoalButton').addEventListener('click',()=>openGoalEditor(null));
$('goalType').addEventListener('change',()=>{const emergency=$('goalType').value==='emergency';if(!$('goalId').value)$('goalName').value=$('goalType').value==='custom'?'':labels[$('goalType').value]||'';$('emergencyRangeField').classList.toggle('hidden',!emergency);if(emergency){$('emergencyRange').value=String(planSettings.emergencyMonths);const estimate=monthlyEssentialCosts().average;if(estimate>0)$('goalTarget').value=String(estimate*planSettings.emergencyMonths);}});
$('emergencyRange').addEventListener('change',()=>{const months=Number($('emergencyRange').value)===6?6:3,estimate=monthlyEssentialCosts().average;planSettings.emergencyMonths=months;if(estimate>0)$('goalTarget').value=String(estimate*months);});
$('goalForm').addEventListener('submit',event=>{
  event.preventDefault();const id=$('goalId').value,name=$('goalName').value.trim(),type=$('goalType').value,target=Number($('goalTarget').value),saved=Number($('goalCurrent').value);
  if(!name||target<=0||saved<0)return;
  if(!id&&type==='emergency'&&goals.some(goal=>goal.type==='emergency')){alert('An emergency fund tracker already exists. Edit that tracker to change it.');return;}
  const emergency=type==='emergency',months=emergency?(Number($('emergencyRange').value)===6?6:3):undefined,estimate=monthlyEssentialCosts().average;
  if(emergency){planSettings.emergencyMonths=months;savePlanSettings();}
  if(id){const goal=goals.find(item=>item.id===id);if(goal){goal.name=goal.type==='emergency'?'Emergency fund':name;goal.type=goal.type==='emergency'?'emergency':type;goal.target=target;goal.customTarget=goal.type==='emergency'&&(!estimate||Math.abs(target-estimate*months)>0.01);goal.configured=goal.type==='emergency'||goal.configured;goal.targetMonths=goal.type==='emergency'?months:undefined;goal.saved=saved;}}
  else{goals.push({id:crypto.randomUUID(),name,type,target,saved,targetMonths:months,customTarget:emergency&&(!estimate||Math.abs(target-estimate*months)>0.01),configured:emergency||undefined,createdAt:new Date().toISOString()});if(emergency)localStorage.removeItem(EMERGENCY_DELETED_KEY);}
  saveGoals();$('goalDialog').close();
});
$('contributionForm').addEventListener('submit',event=>{event.preventDefault();const goal=goals.find(item=>item.id===$('contributionGoalId').value),amount=Number($('contributionAmount').value);if(!goal||amount<=0)return;const saved=Number(goal.saved)||0;if(contributionMode==='withdraw'&&amount>saved){$('contributionError').textContent=`You can withdraw up to ${money(saved)}.`;$('contributionError').hidden=false;return;}goal.saved=Math.max(0,Number((saved+(contributionMode==='withdraw'?-amount:amount)).toFixed(2)));if(goal.type==='emergency')goal.configured=true;saveGoals();$('contributionDialog').close();event.currentTarget.reset();});
document.querySelectorAll('[data-goal-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
renderGoals();
window.addEventListener('folio-finance-updated',event=>{if(event.detail&&typeof event.detail==='object')finance=event.detail;else{try{finance=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{};}catch{finance={};}}renderGoals();});
window.addEventListener('storage',event=>{if(event.key===FolioAccounts.dataKey()){try{finance=JSON.parse(event.newValue)||{};}catch{finance={};}renderGoals();}else if(event.key===GOALS_KEY){try{const updated=JSON.parse(event.newValue);if(Array.isArray(updated))goals=updated;}catch{}renderGoals();}else if(event.key===PLAN_SETTINGS_KEY){try{planSettings={...planSettings,...JSON.parse(event.newValue)};}catch{}renderGoals();}});
