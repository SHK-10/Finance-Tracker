(() => {
  const $ = id => document.getElementById(id);
  const api = window.FolioNetWorth;
  const financeKey = window.FolioAccounts?.dataKey ? FolioAccounts.dataKey() : 'folio-accounts';
  
  const formatMoney = (val) => {
    const amount = Number(val) || 0;
    return `Nrs ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  };

  const labels = {
    cash: 'Cash', bank: 'Bank balance', investment: 'Investment', other: 'Other asset',
    loan: 'Loan', mortgage: 'Mortgage', personalLoan: 'Personal loan',
    autoLoan: 'Auto loan', studentLoan: 'Student loan', creditCard: 'Credit card',
    otherLiability: 'Other liability'
  };

  let data = api?.read ? api.read() : { items: [] };
  if (!data.items) data.items = [];
  let selectedList = null;

  const todayLabel = $('todayLabel');
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const activeAccountName = $('activeAccountName');
  if (activeAccountName && window.FolioAccounts?.current) {
    activeAccountName.textContent = `${FolioAccounts.current().name} account`;
  }

  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    if ($('themeIcon')) $('themeIcon').textContent = dark ? '☀' : '☾';
    if ($('themeToggle')) {
      $('themeToggle').setAttribute('aria-label', dark ? 'Turn on light mode' : 'Turn on dark mode');
      $('themeToggle').title = dark ? 'Turn on light mode' : 'Turn on dark mode';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = dark ? '#171b18' : '#f5f6f2';
  };

  applyTheme(localStorage.getItem('folio-theme') === 'dark' ? 'dark' : 'light');
  $('themeToggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('folio-theme', next);
    applyTheme(next);
  });

  function renderItem(item) {
    const card = document.createElement('article');
    card.className = 'net-worth-item';

    const liability = api?.isLiability ? api.isLiability(item) : false;
    const icon = document.createElement('span');
    icon.className = `net-worth-item-icon ${liability ? 'liability' : ''}`;
    icon.textContent = liability ? '−' : '+';
    icon.setAttribute('aria-hidden', 'true');

    const details = document.createElement('span');
    details.className = 'net-worth-item-details';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const type = document.createElement('small');
    type.textContent = labels[item.type] || 'Other asset';
    details.append(name, type);

    const amount = document.createElement('strong');
    amount.className = 'net-worth-item-amount';
    amount.textContent = formatMoney(Number(item.amount) || 0);

    const actions = document.createElement('span');
    actions.className = 'net-worth-item-actions';
    const edit = document.createElement('button');
    edit.className = 'secondary-btn';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openForm(item));

    const remove = document.createElement('button');
    remove.className = 'secondary-btn';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      if (!confirm(`Delete ${item.name} from net worth?`)) return;
      data.items = data.items.filter(entry => entry.id !== item.id);
      save();
    });
    actions.append(edit, remove);

    card.append(icon, details, amount, actions);
    return card;
  }

  function renderTrackedLoan(loan) {
    const card = document.createElement('article');
    card.className = 'net-worth-item net-worth-tracked-loan';
    const icon = document.createElement('span');
    icon.className = 'net-worth-item-icon liability';
    icon.textContent = '−';
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('span');
    details.className = 'net-worth-item-details';
    const name = document.createElement('strong');
    name.textContent = loan.name || 'Tracked loan';
    const type = document.createElement('small');
    type.textContent = 'EMI and loan tracker · Outstanding balance';
    details.append(name, type);
    const amount = document.createElement('strong');
    amount.className = 'net-worth-item-amount';
    amount.textContent = formatMoney(Number(loan.currentBalance) || 0);
    const actions = document.createElement('span');
    actions.className = 'net-worth-item-actions';
    const manage = document.createElement('a');
    manage.className = 'secondary-btn';
    manage.href = 'debt-tracker.html';
    manage.textContent = 'Manage';
    actions.append(manage);
    card.append(icon, details, amount, actions);
    return card;
  }

  function render() {
    const totals = api?.summarize ? api.summarize(data) : { items: data.items, netWorth: 0, assets: 0, loans: 0, transactionFlow: 0 };
    const items = totals.items || data.items || [];
    const assets = items.filter(item => !(api?.isLiability ? api.isLiability(item) : false));
    const loans = items.filter(item => (api?.isLiability ? api.isLiability(item) : false));
    const trackedLoans = totals.trackedLoans || [];

    if ($('netWorthTotal')) {
      $('netWorthTotal').textContent = formatMoney(totals.netWorth);
      $('netWorthTotal').classList.toggle('negative-value', totals.netWorth < 0);
    }
    if ($('netWorthAssets')) $('netWorthAssets').textContent = formatMoney(totals.assets);
    if ($('netWorthLoans')) $('netWorthLoans').textContent = formatMoney(totals.loans);

    const transactionEntry = totals.transactionFlow !== 0 ? 1 : 0;
    const assetEntryCount = assets.length + transactionEntry;
    if ($('netWorthAssetCount')) $('netWorthAssetCount').textContent = `${assetEntryCount} ${assetEntryCount === 1 ? 'item' : 'items'}`;
    const trackedLoanRows = trackedLoans.filter(loan => Number(loan.currentBalance) > 0);
    const liabilityCount = loans.length + trackedLoanRows.length;
    if ($('netWorthLoanCount')) $('netWorthLoanCount').textContent = `${liabilityCount} ${liabilityCount === 1 ? 'item' : 'items'}`;

    const assetHost = $('netWorthAssetsList');
    const loanHost = $('netWorthLoansList');
    const assetRows = assets.map(renderItem);

    if (transactionEntry) {
      const row = document.createElement('article');
      row.className = 'net-worth-item net-worth-transaction-entry';
      const icon = document.createElement('span');
      icon.className = 'net-worth-item-icon';
      icon.textContent = '↕';
      icon.setAttribute('aria-hidden', 'true');
      const details = document.createElement('span');
      details.className = 'net-worth-item-details';
      const name = document.createElement('strong');
      name.textContent = 'Recorded transaction net flow';
      const description = document.createElement('small');
      description.textContent = 'All income minus expenses';
      details.append(name, description);
      const amount = document.createElement('strong');
      amount.className = 'net-worth-item-amount';
      amount.textContent = formatMoney(totals.transactionFlow);
      row.append(icon, details, amount);
      assetRows.push(row);
    }

    if (assetHost) assetHost.replaceChildren(...assetRows);
    if (loanHost) loanHost.replaceChildren(...loans.map(renderItem), ...trackedLoanRows.map(renderTrackedLoan));
    if ($('netWorthAssetsEmpty')) $('netWorthAssetsEmpty').hidden = assetRows.length > 0;
    if ($('netWorthLoansEmpty')) $('netWorthLoansEmpty').hidden = liabilityCount > 0;

    if (api?.recordSnapshot) api.recordSnapshot(data);
    renderHistory();
    renderComparison();
  }

  function dateForPeriod(mode, dateValue) {
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (mode === 'custom') return dateValue ? new Date(`${dateValue}T12:00:00`) : null;
    if (mode === 'yesterday') base.setDate(base.getDate() - 1);
    const shiftMonths = amount => {
      const day = base.getDate();
      base.setDate(1);
      base.setMonth(base.getMonth() + amount);
      base.setDate(Math.min(day, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()));
    };
    if (mode === 'previousMonth') shiftMonths(-1);
    if (mode === 'threeMonths') shiftMonths(-3);
    if (mode === 'sixMonths') shiftMonths(-6);
    if (mode === 'year') shiftMonths(-12);
    return base;
  }

  const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function snapshotAt(date) {
    const dateKey = localDateKey(date);
    const history = (api?.readHistory ? api.readHistory() : []).filter(item => item.date <= dateKey).sort((a, b) => b.date.localeCompare(a.date));
    if (history.length) return history[0];
    if (dateKey >= localDateKey(new Date())) {
      const totals = api?.summarize ? api.summarize(data) : { assets: 0, loans: 0, netWorth: 0 };
      return { date: dateKey, assets: totals.assets, liabilities: totals.loans, netWorth: totals.netWorth };
    }
    return null;
  }

  function renderComparison() {
    if (!$('netWorthPeriodA') || !$('netWorthPeriodB')) return;
    const modeA = $('netWorthPeriodA').value;
    const modeB = $('netWorthPeriodB').value;
    const dateA = dateForPeriod(modeA, $('netWorthDateA')?.value);
    const dateB = dateForPeriod(modeB, $('netWorthDateB')?.value);

    if ($('netWorthDateA')) $('netWorthDateA').hidden = modeA !== 'custom';
    if ($('netWorthDateB')) $('netWorthDateB').hidden = modeB !== 'custom';
    const result = $('netWorthCompareResult');
    if (result) result.classList.remove('positive', 'negative', 'neutral');

    if (!dateA || !dateB) {
      if ($('netWorthCompareLabel')) $('netWorthCompareLabel').textContent = 'Choose a date for each custom period.';
      if ($('netWorthCompareChange')) $('netWorthCompareChange').textContent = '—';
      if ($('netWorthCompareDetail')) $('netWorthCompareDetail').textContent = '';
      return;
    }
    const current = snapshotAt(dateA);
    const previous = snapshotAt(dateB);
    if (!current || !previous) {
      if ($('netWorthCompareLabel')) $('netWorthCompareLabel').textContent = 'Not enough saved history for these dates.';
      if ($('netWorthCompareChange')) $('netWorthCompareChange').textContent = '—';
      if ($('netWorthCompareDetail')) $('netWorthCompareDetail').textContent = 'Net worth history starts from the first saved snapshot.';
      return;
    }
    const difference = current.netWorth - previous.netWorth;
    if ($('netWorthCompareLabel')) $('netWorthCompareLabel').textContent = `${current.date} compared with ${previous.date}`;
    if ($('netWorthCompareChange')) $('netWorthCompareChange').textContent = `${difference > 0 ? '↑ ' : difference < 0 ? '↓ ' : ''}${formatMoney(Math.abs(difference))}`;
    if ($('netWorthCompareDetail')) $('netWorthCompareDetail').textContent = `Net worth: ${formatMoney(current.netWorth)} vs ${formatMoney(previous.netWorth)}.`;
    if (result) result.classList.add(difference > 0 ? 'positive' : difference < 0 ? 'negative' : 'neutral');
  }

  function renderHistory() {
    const host = $('netWorthHistoryRows');
    if (!host) return;
    const history = (api?.readHistory ? api.readHistory() : []).sort((a, b) => b.date.localeCompare(a.date));
    host.replaceChildren();
    if ($('netWorthHistoryEmpty')) $('netWorthHistoryEmpty').hidden = history.length > 0;
    for (const snapshot of history) {
      const row = document.createElement('tr');
      for (const [value, align] of [
        [snapshot.date, ''],
        [formatMoney(snapshot.assets), 'align-right'],
        [formatMoney(snapshot.liabilities), 'align-right'],
        [formatMoney(snapshot.netWorth), 'align-right']
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (align) cell.className = align;
        row.append(cell);
      }
      host.append(row);
    }
  }

  function selectList(type) {
    selectedList = selectedList === type ? null : type;
    const showAssets = selectedList === 'assets';
    const showLoans = selectedList === 'loans';
    if ($('netWorthLists')) $('netWorthLists').hidden = !selectedList;
    if ($('netWorthAssetsPanel')) $('netWorthAssetsPanel').hidden = !showAssets;
    if ($('netWorthLoansPanel')) $('netWorthLoansPanel').hidden = !showLoans;
    if ($('showAssets')) {
      $('showAssets').setAttribute('aria-pressed', String(showAssets));
      $('showAssets').classList.toggle('selected', showAssets);
    }
    if ($('showLoans')) {
      $('showLoans').setAttribute('aria-pressed', String(showLoans));
      $('showLoans').classList.toggle('selected', showLoans);
    }
  }

  for (const [id, type] of [['showAssets', 'assets'], ['showLoans', 'loans']]) {
    const control = $(id);
    if (control) {
      control.addEventListener('click', () => selectList(type));
      control.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectList(type);
        }
      });
    }
  }

  function save() {
    if (api?.write) api.write(data);
    render();
  }

  function openForm(item = null, defaultType = null) {
    const liability = selectedList === 'loans';
    const choices = liability
      ? [['loan', 'Loan'], ['mortgage', 'Mortgage'], ['personalLoan', 'Personal loan'], ['autoLoan', 'Auto loan'], ['studentLoan', 'Student loan'], ['creditCard', 'Credit card'], ['otherLiability', 'Other liability']]
      : [['cash', 'Cash'], ['bank', 'Bank balance'], ['investment', 'Investment'], ['other', 'Other asset']];
    const type = $('netWorthType');
    $('netWorthForm')?.reset();
    if (type) {
      type.replaceChildren(...choices.map(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
      }));
      type.value = item?.type || defaultType || (liability ? 'loan' : 'cash');
    }

    if ($('netWorthItemId')) $('netWorthItemId').value = item?.id || '';
    if ($('netWorthDialogTitle')) $('netWorthDialogTitle').textContent = item ? `Edit ${liability ? 'liability' : 'asset'}` : `Add ${liability ? 'liability' : 'asset'}`;
    if ($('netWorthName')) {
      $('netWorthName').value = item?.name || '';
      $('netWorthName').placeholder = liability ? 'e.g. Car loan, Credit card' : 'e.g. Wallet cash, Main bank, Investments';
    }
    if ($('netWorthAmount')) $('netWorthAmount').value = item?.amount ?? '';
    if ($('netWorthFormNote')) $('netWorthFormNote').textContent = liability ? 'Enter the outstanding amount as a positive balance.' : 'Choose an asset category and enter its current balance.';
    $('netWorthDialog')?.showModal();
  }

  document.querySelectorAll('[data-net-worth-add]').forEach(button =>
    button.addEventListener('click', () => openForm(null, button.dataset.netWorthAdd === 'liability' ? 'loan' : 'cash'))
  );

  $('closeNetWorthDialog')?.addEventListener('click', () => $('netWorthDialog')?.close());
  $('netWorthDialog')?.addEventListener('click', event => {
    if (event.target === $('netWorthDialog')) $('netWorthDialog').close();
  });

  $('netWorthForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const id = $('netWorthItemId').value;
    const existing = data.items.find(item => item.id === id);
    const entry = {
      id: id || crypto.randomUUID(),
      name: $('netWorthName').value.trim(),
      type: $('netWorthType').value,
      amount: Number($('netWorthAmount').value)
    };
    data.items = existing ? data.items.map(item => item.id === id ? entry : item) : [entry, ...data.items];
    save();
    $('netWorthDialog')?.close();
  });

  $('compareNetWorth')?.addEventListener('click', renderComparison);
  for (const suffix of ['A', 'B']) {
    $('netWorthPeriod' + suffix)?.addEventListener('change', renderComparison);
    $('netWorthDate' + suffix)?.addEventListener('change', renderComparison);
  }

  $('toggleNetWorthHistory')?.addEventListener('click', () => {
    const wrap = $('netWorthHistoryWrap');
    if (!wrap) return;
    const show = wrap.hidden;
    wrap.hidden = !show;
    $('toggleNetWorthHistory').setAttribute('aria-expanded', String(show));
    $('toggleNetWorthHistory').textContent = show ? 'Hide history' : 'View all history';
  });

  window.addEventListener('folio-net-worth-updated', () => {
    if (api?.read) data = api.read();
    render();
  });
  window.addEventListener('folio-debts-updated', render);
  window.addEventListener('folio-finance-updated', render);
  window.addEventListener('storage', event => {
    if (api?.key && event.key === api.key) {
      if (api.read) data = api.read();
      render();
    } else if (event.key === financeKey) {
      render();
    } else if (api?.debtKey && event.key === api.debtKey) {
      render();
    }
  });

  function setMobileMenu(open) {
    $('sidebar')?.classList.toggle('open', open);
    if ($('mobileBackdrop')) $('mobileBackdrop').hidden = !open;
    $('mobileMenu')?.setAttribute('aria-expanded', String(open));
  }

  $('mobileMenu')?.addEventListener('click', () => setMobileMenu(!$('sidebar')?.classList.contains('open')));
  $('mobileBackdrop')?.addEventListener('click', () => setMobileMenu(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMobileMenu(false);
  });
  document.querySelectorAll('.main-nav > .nav-link, .nav-sublink').forEach(link =>
    link.addEventListener('click', () => setMobileMenu(false))
  );

  render();
})();
