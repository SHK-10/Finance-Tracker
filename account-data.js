(() => {
  const LIST_KEY='folio-accounts-v1';
  const ACTIVE_KEY='folio-active-account-v1';
  const DATA_PREFIX='folio-finance-v1-';
  let accounts;
  try { accounts=JSON.parse(localStorage.getItem(LIST_KEY)); } catch { accounts=null; }
  if(!Array.isArray(accounts)||!accounts.length) accounts=[{id:'personal',name:'Personal'},{id:'family',name:'Family'}];
  if(!accounts.some(account=>account.id==='personal')) accounts.unshift({id:'personal',name:'Personal'});
  if(!accounts.some(account=>account.id==='family')) accounts.push({id:'family',name:'Family'});
  const legacy=localStorage.getItem('folio-finance-v1');
  if(legacy&&!localStorage.getItem(`${DATA_PREFIX}personal`)) localStorage.setItem(`${DATA_PREFIX}personal`,legacy);
  localStorage.setItem(LIST_KEY,JSON.stringify(accounts));
  let activeId=localStorage.getItem(ACTIVE_KEY);
  if(!accounts.some(account=>account.id===activeId)) { activeId='personal'; localStorage.setItem(ACTIVE_KEY,activeId); }
  window.FolioAccounts={
    list:()=>accounts,
    currentId:()=>activeId,
    current:()=>accounts.find(account=>account.id===activeId)||accounts[0],
    dataKey:(id=activeId)=>`${DATA_PREFIX}${id}`,
    setActive(id){ if(accounts.some(account=>account.id===id)){activeId=id;localStorage.setItem(ACTIVE_KEY,id);} },
    add(name){
      const clean=name.trim().slice(0,32);
      if(!clean) return null;
      const id=`account-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const account={id,name:clean};accounts.push(account);localStorage.setItem(LIST_KEY,JSON.stringify(accounts));
      localStorage.setItem(`${DATA_PREFIX}${id}`,JSON.stringify({transactions:[],budgets:[{category:'Food & dining',limit:650},{category:'Shopping',limit:400},{category:'Transport',limit:250}]}));
      return account;
    }
  };
})();
