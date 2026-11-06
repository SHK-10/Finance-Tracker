(() => {
  const money=value=>`Nrs ${new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)}`;
  window.renderBudgetAlerts=(host,state)=>{
    if(!host)return;
    const now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const alerts=[];
    for(const budget of state.budgets||[]){
      const spent=(state.transactions||[]).filter(tx=>{const date=new Date(`${tx.date}T12:00:00`);return tx.type==='expense'&&tx.category===budget.category&&date>=monthStart&&date<tomorrow;}).reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);
      const ratio=budget.limit>0?spent/budget.limit:0;
      if(ratio>=1)alerts.push({level:'over',category:budget.category,spent,limit:budget.limit,message:`${budget.category} is over budget by ${money(spent-budget.limit)}.`});
      else if(ratio>=.8)alerts.push({level:'near',category:budget.category,spent,limit:budget.limit,message:`${budget.category} has used ${Math.floor(ratio*100)}% of its budget. ${money(budget.limit-spent)} remaining.`});
    }
    host.replaceChildren();
    if(!alerts.length){host.hidden=true;return;}
    host.hidden=false;
    host.className='budget-alert-list';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
    for(const alert of alerts){
      const item=document.createElement('div');item.className=`budget-alert ${alert.level}`;
      const icon=document.createElement('span');icon.className='budget-alert-icon';icon.textContent=alert.level==='over'?'!':'↗';icon.setAttribute('aria-hidden','true');
      const copy=document.createElement('span');copy.className='budget-alert-copy';
      const title=document.createElement('strong');title.textContent=alert.level==='over'?'Budget limit exceeded':'Budget nearly reached';
      const detail=document.createElement('span');detail.textContent=alert.message;
      copy.append(title,detail);item.append(icon,copy);host.append(item);
    }
  };
})();
