const $ = (id) => document.getElementById(id);
const money = (value) => `Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
const THEME_KEY = 'folio-theme';

function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  const dark=theme==='dark';
  $('themeIcon').textContent=dark?'☀':'☾';
  $('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');
  $('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';
  document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';
}

function calculateEMI(){
  const principal=Math.max(0,Number($('loanAmount').value)||0);
  const rate=Math.max(0,Number($('loanRate').value)||0)/1200;
  const months=Math.max(1,(Number($('loanYears').value)||1)*12);
  const emi=rate===0?principal/months:principal*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1);
  $('emiResult').textContent=money(emi);
  $('emiInterest').textContent=money(emi*months-principal);
  $('emiTotal').textContent=money(emi*months);
}

function calculateReturn(){
  const initial=Math.max(0,Number($('investmentAmount').value)||0);
  const monthly=Math.max(0,Number($('monthlyContribution').value)||0);
  const rate=Math.max(0,Number($('returnRate').value)||0)/1200;
  const months=Math.max(1,(Number($('returnYears').value)||1)*12);
  const initialFuture=initial*Math.pow(1+rate,months);
  const contributionFuture=rate===0?monthly*months:monthly*((Math.pow(1+rate,months)-1)/rate)*(1+rate);
  const future=initialFuture+contributionFuture;
  const invested=initial+monthly*months;
  $('futureValue').textContent=money(future);
  $('amountInvested').textContent=money(invested);
  $('estimatedGrowth').textContent=money(future-invested);
}

$('todayLabel').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
document.getElementById('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
applyTheme(localStorage.getItem(THEME_KEY)==='dark'?'dark':'light');
$('themeToggle').addEventListener('click',()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  localStorage.setItem(THEME_KEY,next);
  applyTheme(next);
});
['loanAmount','loanRate','loanYears'].forEach(id=>$(id).addEventListener('input',calculateEMI));
['investmentAmount','monthlyContribution','returnRate','returnYears'].forEach(id=>$(id).addEventListener('input',calculateReturn));
function setMobileMenu(open){$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));}
$('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));
$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
calculateEMI();
calculateReturn();
