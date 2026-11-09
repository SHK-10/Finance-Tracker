(() => {
  const $=id=>document.getElementById(id),key=`${FolioAccounts.dataKey()}-debt-tracker`;
  const money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(Number(value)||0)}`;
  const localDateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  let loans=[];
  try{const stored=JSON.parse(localStorage.getItem(key));if(Array.isArray(stored))loans=stored;}catch{}
  let currentBalanceTouched=false;
  let principalReductionTouched=false;
  $('todayLabel').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  $('activeAccountName').textContent=`${FolioAccounts.current().name} account`;
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeIcon').textContent=dark?'☀':'☾';$('themeToggle').setAttribute('aria-label',dark?'Turn on light mode':'Turn on dark mode');$('themeToggle').title=dark?'Turn on light mode':'Turn on dark mode';document.querySelector('meta[name="theme-color"]').content=dark?'#171b18':'#f5f6f2';};
  applyTheme(localStorage.getItem('folio-theme')==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('folio-theme',next);applyTheme(next);});
  const setMobileMenu=open=>{$('sidebar').classList.toggle('open',open);$('mobileBackdrop').hidden=!open;$('mobileMenu').setAttribute('aria-expanded',String(open));};
  $('mobileMenu').addEventListener('click',()=>setMobileMenu(!$('sidebar').classList.contains('open')));$('mobileBackdrop').addEventListener('click',()=>setMobileMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileMenu(false);});
  document.querySelectorAll('.main-nav > .nav-link,.nav-sublink').forEach(link=>link.addEventListener('click',()=>setMobileMenu(false)));
  const monthKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  function emiPaidForMonth(loan,period=monthKey(new Date())){return (loan.payments||[]).filter(payment=>payment.isEmi&&String(payment.date||'').slice(0,7)===period).reduce((sum,payment)=>sum+(Number(payment.amount)||0),0);}
  function emiDueInfo(loan){
    const emi=Number(loan.monthlyPayment)||0,dueDay=Number(loan.dueDay)||0,now=new Date(),remaining=Math.max(0,emi-emiPaidForMonth(loan));
    if(Number(loan.currentBalance)<=0)return {label:'Loan paid off',detail:'No further EMI is scheduled for this loan.',tone:'paid'};
    if(!emi)return {label:'No EMI set',detail:dueDay?`Due day ${dueDay}`:'Set an EMI and due day to track your schedule.',tone:'neutral'};
    if(remaining===0)return {label:'EMI paid this month',detail:`Next installment: ${money(emi)}${dueDay?` · due day ${dueDay}`:''}`,tone:'paid'};
    if(!dueDay)return {label:`${money(remaining)} remaining this month`,detail:'Set a due day to see when the EMI is due.',tone:'neutral'};
    const dueDate=new Date(now.getFullYear(),now.getMonth(),Math.min(dueDay,new Date(now.getFullYear(),now.getMonth()+1,0).getDate())),days=Math.ceil((new Date(dueDate.getFullYear(),dueDate.getMonth(),dueDate.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000),formatted=dueDate.toLocaleDateString('en-US',{month:'short',day:'numeric'}),partial=emiPaidForMonth(loan)>0?` · ${money(remaining)} left`:'';
    if(days<0)return {label:`EMI overdue${partial}`,detail:`Due ${formatted} · ${money(remaining)} still due`,tone:'overdue'};
    if(days===0)return {label:`EMI due today${partial}`,detail:`${money(remaining)} remaining for this month`,tone:'due'};
    if(days<=7)return {label:`EMI due in ${days} ${days===1?'day':'days'}${partial}`,detail:`${money(remaining)} due on ${formatted}`,tone:'due'};
    return {label:`EMI due ${formatted}${partial}`,detail:`${money(remaining)} scheduled this month`,tone:'neutral'};
  }

  function save(){localStorage.setItem(key,JSON.stringify(loans));window.dispatchEvent(new CustomEvent('folio-debts-updated',{detail:loans}));render();}
  function renderLoan(loan){
    const balance=Math.max(0,Number(loan.currentBalance)||0),original=Math.max(balance,Number(loan.originalAmount)||balance),paid=Math.max(0,original-balance),percent=original?Math.min(100,paid/original*100):0;
    const card=document.createElement('article');card.className=`debt-loan-card${balance<=0?' paid-off':''}`;
    const header=document.createElement('div');header.className='debt-loan-header';const identity=document.createElement('div');identity.className='debt-loan-identity';const icon=document.createElement('span');icon.className='debt-loan-icon';icon.textContent='↘';icon.setAttribute('aria-hidden','true');const title=document.createElement('div');title.className='debt-loan-title';const name=document.createElement('strong');name.textContent=loan.name;const status=document.createElement('small');status.textContent=balance<=0?'Paid off':'Loan balance';title.append(name,status);identity.append(icon,title);const balanceLabel=document.createElement('div');balanceLabel.className='debt-loan-balance';balanceLabel.innerHTML='<span>OUTSTANDING</span>';const balanceAmount=document.createElement('strong');balanceAmount.textContent=money(balance);balanceLabel.append(balanceAmount);header.append(identity,balanceLabel);
    const emiInfo=emiDueInfo(loan),emiStatus=document.createElement('div');emiStatus.className=`debt-emi-status ${emiInfo.tone}`;const emiLabel=document.createElement('strong');emiLabel.textContent=emiInfo.label;const emiDetail=document.createElement('small');emiDetail.textContent=emiInfo.detail;emiStatus.append(emiLabel,emiDetail);
    const progress=document.createElement('div');progress.className='debt-progress-track';const fill=document.createElement('div');fill.className='debt-progress-fill';fill.style.width=`${percent}%`;fill.setAttribute('role','progressbar');fill.setAttribute('aria-valuemin','0');fill.setAttribute('aria-valuemax','100');fill.setAttribute('aria-valuenow',String(Math.round(percent)));fill.setAttribute('aria-label',`${Math.round(percent)} percent repaid`);progress.append(fill);
    const stats=document.createElement('div');stats.className='debt-loan-stats';for(const [label,value] of [['Original loan',money(original)],['Repaid',money(paid)],['Annual interest',Number(loan.interestRate)>0?`${Number(loan.interestRate)}%`:'—'],['Monthly EMI',Number(loan.monthlyPayment)>0?money(loan.monthlyPayment):'—']]){const item=document.createElement('div'),caption=document.createElement('span'),amount=document.createElement('strong');caption.textContent=label;amount.textContent=value;item.append(caption,amount);stats.append(item);}
    const actions=document.createElement('div');actions.className='debt-loan-actions';
    if(Number(loan.monthlyPayment)>0){const emiButton=document.createElement('button');emiButton.type='button';emiButton.className='primary-btn debt-repay-button';emiButton.textContent=balance>0?'Record EMI':'Paid in full';emiButton.disabled=balance<=0;emiButton.addEventListener('click',()=>openPaymentForm(loan,true));actions.append(emiButton);}
    const repay=document.createElement('button');repay.type='button';repay.className=Number(loan.monthlyPayment)>0?'secondary-btn':'primary-btn debt-repay-button';repay.textContent=balance>0?(Number(loan.monthlyPayment)>0?'Extra repayment':'＋ Record repayment'):'Paid in full';repay.disabled=balance<=0;repay.addEventListener('click',()=>openPaymentForm(loan,false));const edit=document.createElement('button');edit.type='button';edit.className='secondary-btn';edit.textContent='Edit';edit.addEventListener('click',()=>openLoanForm(loan));const remove=document.createElement('button');remove.type='button';remove.className='secondary-btn debt-delete-button';remove.textContent='Delete';remove.addEventListener('click',()=>{if(!confirm(`Delete the ${loan.name} loan and its repayment history?`))return;loans=loans.filter(item=>item.id!==loan.id);save();});actions.append(repay,edit,remove);
    card.append(header,emiStatus,progress,stats,actions);
    if(Array.isArray(loan.payments)&&loan.payments.length){const history=document.createElement('details');history.className='debt-payment-history';const summary=document.createElement('summary');summary.textContent=`Repayment history · ${loan.payments.length}`;const list=document.createElement('div');list.className='debt-payment-list';
      [...loan.payments].sort((a,b)=>String(b.date).localeCompare(String(a.date))).forEach(payment=>{const row=document.createElement('div');row.className='debt-payment-row';const info=document.createElement('span');info.className='debt-payment-info';const date=document.createElement('strong');date.textContent=payment.date?new Date(`${payment.date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Repayment';const note=document.createElement('small');const breakdown=payment.isEmi?` · principal ${money(payment.principalAmount??payment.amount)}, interest ${money(payment.interestAmount||0)}`:'';note.textContent=`${payment.isEmi?'EMI payment':'Extra repayment'}${payment.note?` · ${payment.note}`:''}${breakdown}`;info.append(date,note);const amount=document.createElement('strong');amount.textContent=money(payment.amount);const undo=document.createElement('button');undo.type='button';undo.className='debt-undo-payment';undo.textContent='Remove';undo.setAttribute('aria-label',`Remove repayment of ${money(payment.amount)}`);undo.addEventListener('click',()=>{if(!confirm('Remove this repayment and restore its principal amount to the outstanding balance?'))return;loan.currentBalance=Math.min(Number(loan.originalAmount)||Infinity,(Number(loan.currentBalance)||0)+(Number(payment.principalAmount??payment.amount)||0));loan.payments=loan.payments.filter(item=>item.id!==payment.id);save();});row.append(info,amount,undo);list.append(row);});history.append(summary,list);card.append(history);
    }
    return card;
  }
  function render(){
    loans=loans.map(loan=>({...loan,currentBalance:Math.max(0,Number(loan.currentBalance)||0),originalAmount:Math.max(0,Number(loan.originalAmount)||0),payments:Array.isArray(loan.payments)?loan.payments:[]}));
    const active=loans.filter(loan=>Number(loan.currentBalance)>0),outstanding=loans.reduce((sum,loan)=>sum+(Number(loan.currentBalance)||0),0),now=new Date(),monthStart=localDateKey(new Date(now.getFullYear(),now.getMonth(),1)),todayKey=localDateKey(now);
    const paidThisMonth=loans.flatMap(loan=>loan.payments).filter(payment=>payment.date>=monthStart&&payment.date<=todayKey).reduce((sum,payment)=>sum+(Number(payment.amount)||0),0);
    const emiDue=active.reduce((sum,loan)=>sum+Math.max(0,(Number(loan.monthlyPayment)||0)-emiPaidForMonth(loan)),0);
    $('debtTotalOutstanding').textContent=money(outstanding);$('debtActiveCount').textContent=String(active.length);$('debtPaidThisMonth').textContent=money(paidThisMonth);$('debtEmiDueThisMonth').textContent=money(emiDue);
    const host=$('debtLoanList');host.replaceChildren(...[...loans].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(renderLoan));$('debtEmpty').hidden=loans.length>0;
  }
  function openLoanForm(loan=null){
    $('debtLoanForm').reset();currentBalanceTouched=!!loan;$('debtLoanId').value=loan?.id||'';$('debtLoanDialogTitle').textContent=loan?'Edit loan':'Add loan';$('debtLoanName').value=loan?.name||'';$('debtOriginalAmount').value=loan?.originalAmount??'';$('debtCurrentBalance').value=loan?.currentBalance??'';$('debtInterestRate').value=loan?.interestRate??'';$('debtMonthlyPayment').value=loan?.monthlyPayment??'';$('debtDueDay').value=loan?.dueDay??'';$('debtLoanDialog').showModal();
  }
  function openPaymentForm(loan,isEmi=false){
    $('debtPaymentForm').reset();principalReductionTouched=false;$('debtPaymentLoanId').value=loan.id;$('debtPaymentIsEmi').value=String(isEmi);$('debtPaymentEyebrow').textContent=isEmi?'RECORD MONTHLY EMI':'RECORD EXTRA REPAYMENT';$('debtPaymentTitle').textContent=`${isEmi?'EMI':'Repayment'} · ${loan.name}`;$('debtPaymentAmount').max=String(loan.currentBalance);$('debtPaymentAmount').value=isEmi?Math.min(Number(loan.monthlyPayment)||0,Number(loan.currentBalance)||0):'';$('debtPrincipalField').hidden=!isEmi;$('debtPrincipalReduction').required=isEmi;$('debtPrincipalReduction').max=String(loan.currentBalance);$('debtPaymentDate').value=localDateKey(new Date());$('debtPaymentDate').max=localDateKey(new Date());$('debtPaymentNote').value=isEmi?'Monthly EMI':'';$('debtPaymentBalance').textContent=`Outstanding balance: ${money(loan.currentBalance)}`;$('debtPaymentSubmit').innerHTML=isEmi?'Save EMI payment <span>→</span>':'Save extra repayment <span>→</span>';
    if(isEmi){const amount=Number($('debtPaymentAmount').value)||0,interest=Number(loan.currentBalance)*Math.max(0,Number(loan.interestRate)||0)/1200;$('debtPrincipalReduction').value=Math.min(Number(loan.currentBalance),Math.max(0,amount-interest));}
    $('debtPaymentDialog').showModal();
  }
  $('addTrackedLoan').addEventListener('click',()=>openLoanForm());$('debtEmptyAdd').addEventListener('click',()=>openLoanForm());
  $('debtOriginalAmount').addEventListener('input',()=>{if(!$('debtLoanId').value&&!currentBalanceTouched)$('debtCurrentBalance').value=$('debtOriginalAmount').value;});
  $('debtCurrentBalance').addEventListener('input',()=>{currentBalanceTouched=true;});
  $('debtPaymentAmount').addEventListener('input',()=>{if($('debtPaymentIsEmi').value!=='true'||principalReductionTouched)return;const loan=loans.find(item=>item.id===$('debtPaymentLoanId').value),amount=Number($('debtPaymentAmount').value)||0;if(!loan)return;const interest=Number(loan.currentBalance)*Math.max(0,Number(loan.interestRate)||0)/1200;$('debtPrincipalReduction').value=Math.min(Number(loan.currentBalance),Math.max(0,amount-interest));});
  $('debtPrincipalReduction').addEventListener('input',()=>{principalReductionTouched=true;});
  $('debtLoanForm').addEventListener('submit',event=>{
    event.preventDefault();const id=$('debtLoanId').value,original=Number($('debtOriginalAmount').value),current=Number($('debtCurrentBalance').value);
    if(current>original){alert('Current outstanding balance cannot exceed the original loan amount.');return;}
    const existing=loans.find(loan=>loan.id===id),record={...(existing||{}),id:id||crypto.randomUUID(),name:$('debtLoanName').value.trim(),originalAmount:original,currentBalance:current,interestRate:Math.max(0,Number($('debtInterestRate').value)||0),monthlyPayment:Math.max(0,Number($('debtMonthlyPayment').value)||0),dueDay:Math.max(0,Number($('debtDueDay').value)||0),payments:Array.isArray(existing?.payments)?existing.payments:[],createdAt:existing?.createdAt||new Date().toISOString()};
    loans=id?loans.map(loan=>loan.id===id?record:loan):[record,...loans];save();$('debtLoanDialog').close();
  });
  $('debtPaymentForm').addEventListener('submit',event=>{
    event.preventDefault();const loan=loans.find(item=>item.id===$('debtPaymentLoanId').value),amount=Number($('debtPaymentAmount').value),date=$('debtPaymentDate').value;
    if(!loan||amount<=0||amount>Number(loan.currentBalance)){alert('Enter a repayment greater than zero and no more than the outstanding balance.');return;}
    const isEmi=$('debtPaymentIsEmi').value==='true',principalAmount=isEmi?Number($('debtPrincipalReduction').value):amount;
    if(!Number.isFinite(principalAmount)||principalAmount<0||principalAmount>amount||principalAmount>Number(loan.currentBalance)){alert('Principal reduction must be between zero, the payment amount, and the current loan balance.');return;}
    const interestAmount=isEmi?Math.max(0,amount-principalAmount):0;loan.currentBalance=Math.max(0,Number(loan.currentBalance)-principalAmount);loan.payments.push({id:crypto.randomUUID(),amount,principalAmount,interestAmount,date,note:$('debtPaymentNote').value.trim(),isEmi});save();$('debtPaymentDialog').close();
  });
  document.querySelectorAll('[data-debt-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('#debtLoanDialog,#debtPaymentDialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
  window.addEventListener('storage',event=>{if(event.key===key){try{const saved=JSON.parse(event.newValue);loans=Array.isArray(saved)?saved:[];}catch{loans=[];}render();}});
  render();
})();
