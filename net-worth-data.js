(() => {
  if(!window.FolioAccounts)return;
  const key=`${FolioAccounts.dataKey()}-net-worth`;
  const historyKey=`${key}-history`;
  const read=()=>{
    try{const saved=JSON.parse(localStorage.getItem(key));return saved&&Array.isArray(saved.items)?saved:{items:[]};}
    catch{return {items:[]};}
  };
  const summarize=data=>{
    const items=Array.isArray(data?.items)?data.items:[];
    const assets=items.filter(item=>item.type!=='loan').reduce((sum,item)=>sum+(Number(item.amount)||0),0);
    const loans=items.filter(item=>item.type==='loan').reduce((sum,item)=>sum+(Number(item.amount)||0),0);
    return {assets,loans,netWorth:assets-loans,items};
  };
  const write=data=>{localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new CustomEvent('folio-net-worth-updated',{detail:summarize(data)}));};
  const readHistory=()=>{try{const saved=JSON.parse(localStorage.getItem(historyKey));return Array.isArray(saved)?saved:[];}catch{return [];}};
  const recordSnapshot=data=>{
    const totals=summarize(data),history=readHistory(),now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,snapshot={date:today,assets:totals.assets,liabilities:totals.loans,netWorth:totals.netWorth};
    const index=history.findIndex(item=>item.date===today);if(index>=0)history[index]=snapshot;else history.push(snapshot);
    history.sort((a,b)=>a.date.localeCompare(b.date));localStorage.setItem(historyKey,JSON.stringify(history.slice(-730)));return history;
  };
  window.FolioNetWorth={key,historyKey,read,summarize,write,readHistory,recordSnapshot};
  window.addEventListener('storage',event=>{if(event.key===key)window.dispatchEvent(new CustomEvent('folio-net-worth-updated',{detail:summarize(read())}));});
})();
