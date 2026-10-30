const accountDialog=document.getElementById('accountDialog');
const accountList=document.getElementById('accountList');
function renderAccounts(){
  const current=FolioAccounts.current();
  document.getElementById('activeAccountName').textContent=`${current.name} account`;
  accountList.innerHTML='';
  FolioAccounts.list().forEach(account=>{
    const button=document.createElement('button');
    button.type='button';button.className=`account-choice${account.id===current.id?' selected':''}`;
    button.innerHTML=`<span class="account-choice-avatar">${account.name.charAt(0).toUpperCase()}</span><span class="account-choice-copy"><strong></strong><small>${account.id===current.id?'Currently active':'Switch to this account'}</small></span><span class="account-check">${account.id===current.id?'✓':'→'}</span>`;
    button.querySelector('strong').textContent=account.name;
    button.addEventListener('click',()=>{FolioAccounts.setActive(account.id);location.reload();});
    accountList.appendChild(button);
  });
}
renderAccounts();
document.getElementById('accountSwitcherButton').addEventListener('click',()=>accountDialog.showModal());
document.querySelectorAll('[data-account-close]').forEach(button=>button.addEventListener('click',()=>accountDialog.close()));
accountDialog.addEventListener('click',event=>{if(event.target===accountDialog)accountDialog.close();});
document.getElementById('createAccountForm').addEventListener('submit',event=>{
  event.preventDefault();
  const account=FolioAccounts.add(document.getElementById('newAccountName').value);
  if(account){FolioAccounts.setActive(account.id);location.reload();}
});
