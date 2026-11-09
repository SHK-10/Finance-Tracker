(() => {
  if(!window.FolioAccounts)return;
  const key=`${FolioAccounts.dataKey()}-net-worth`;
  const historyKey=`${key}-history`;
  const debtKey=`${FolioAccounts.dataKey()}-debt-tracker`;
  const read=()=>{
    try{const saved=JSON.parse(localStorage.getItem(key));return saved&&Array.isArray(saved.items)?saved:{items:[]};}
    catch{return {items:[]};}
  };
  const liabilityTypes=new Set(['loan','mortgage','personalLoan','autoLoan','studentLoan','creditCard','otherLiability']);
  const isLiability=item=>item?.isLiability===true||liabilityTypes.has(item?.type);
  const readTrackedLoans=()=>{try{const saved=JSON.parse(localStorage.getItem(debtKey));return Array.isArray(saved)?saved:[];}catch{return [];}};
  const summarize=data=>{
    const items=Array.isArray(data?.items)?data.items:[];
    const manualAssets=items.filter(item=>!isLiability(item)).reduce((sum,item)=>sum+(Number(item.amount)||0),0);
    const manualLiabilities=items.filter(isLiability).reduce((sum,item)=>sum+(Number(item.amount)||0),0),trackedLoans=readTrackedLoans(),trackedLiabilities=trackedLoans.reduce((sum,loan)=>sum+(Number(loan.currentBalance)||0),0),loans=manualLiabilities+trackedLiabilities;
    let finance={};try{finance=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{};}catch{}
    const transactions=Array.isArray(finance.transactions)?finance.transactions:[];
    const transactionFlow=transactions.reduce((sum,tx)=>sum+(tx.type==='income'?1:-1)*(Number(tx.amount)||0),0);
    const assets=manualAssets+transactionFlow;
    return {assets,manualAssets,transactionFlow,loans,manualLiabilities,trackedLiabilities,trackedLoans,netWorth:assets-loans,items};
  };
  const write=data=>{localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new CustomEvent('folio-net-worth-updated',{detail:summarize(data)}));};
  const readHistory=()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(historyKey));if(!Array.isArray(saved))return [];
      const finance=JSON.parse(localStorage.getItem(FolioAccounts.dataKey()))||{},transactions=Array.isArray(finance.transactions)?finance.transactions:[],trackedLoans=readTrackedLoans();
      return saved.map(snapshot=>{
        let migrated={...snapshot};
        if(!migrated.transactionsIncluded){const flow=transactions.filter(tx=>tx.date&&tx.date<=snapshot.date).reduce((sum,tx)=>sum+(tx.type==='income'?1:-1)*(Number(tx.amount)||0),0);migrated={...migrated,assets:(Number(migrated.assets)||0)+flow,netWorth:(Number(migrated.netWorth)||0)+flow,transactionFlow:flow,transactionsIncluded:true};}
        if(!migrated.trackedLiabilitiesIncluded){const balance=trackedLoans.filter(loan=>String(loan.createdAt||'').slice(0,10)<=snapshot.date).reduce((sum,loan)=>{const paidAfter=(Array.isArray(loan.payments)?loan.payments:[]).filter(payment=>payment.date>snapshot.date).reduce((total,payment)=>total+(Number(payment.principalAmount??payment.amount)||0),0);return sum+(Number(loan.currentBalance)||0)+paidAfter;},0);migrated={...migrated,liabilities:(Number(migrated.liabilities)||0)+balance,netWorth:(Number(migrated.netWorth)||0)-balance,trackedLiabilities:balance,trackedLiabilitiesIncluded:true};}
        return migrated;
      });
    }catch{return [];}
  };
  const recordSnapshot=data=>{
    const totals=summarize(data),history=readHistory(),now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,snapshot={date:today,assets:totals.assets,liabilities:totals.loans,netWorth:totals.netWorth,transactionFlow:totals.transactionFlow,trackedLiabilities:totals.trackedLiabilities,transactionsIncluded:true,trackedLiabilitiesIncluded:true};
    const index=history.findIndex(item=>item.date===today);if(index>=0)history[index]=snapshot;else history.push(snapshot);
    history.sort((a,b)=>a.date.localeCompare(b.date));localStorage.setItem(historyKey,JSON.stringify(history.slice(-730)));return history;
  };
  window.FolioNetWorth={key,historyKey,debtKey,read,readTrackedLoans,summarize,write,readHistory,recordSnapshot,isLiability};
  window.addEventListener('storage',event=>{if(event.key===key)window.dispatchEvent(new CustomEvent('folio-net-worth-updated',{detail:summarize(read())}));});
})();
