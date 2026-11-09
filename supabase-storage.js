/* Sync Folio's existing account-scoped localStorage records to Supabase. */
(() => {
  const config = window.FOLIO_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes('YOUR_PROJECT_ID') && !config.anonKey.includes('YOUR_SUPABASE');
  if (!configured || !window.supabase?.createClient) {
    if (configured) console.error('Folio cloud sync: Supabase client library did not load.');
    return;
  }

  const TABLE = 'user_app_data';
  const client = window.supabase.createClient(config.url, config.anonKey);
  const nativeSetItem = Storage.prototype.setItem;
  let userId = null;
  let hydrating = false;
  let initialized = false;
  let syncQueue = Promise.resolve();
  const isAppKey = key => typeof key === 'string' && key.startsWith('folio-');
  window.FolioCloudSync = { status: 'connecting', error: null };

  function showStatus(message, error = false) {
    if (!document.body) return;
    let notice = document.getElementById('folioCloudSyncStatus');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'folioCloudSyncStatus';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;z-index:9999;right:18px;bottom:18px;max-width:min(420px,calc(100vw - 36px));padding:12px 16px;border-radius:12px;font:500 14px/1.45 system-ui,sans-serif;box-shadow:0 8px 28px #0002;';
      document.body.append(notice);
    }
    notice.textContent = message;
    notice.style.background = error ? '#7f2727' : '#1f6545';
    notice.style.color = '#fff';
    notice.hidden = false;
    if (!error) window.setTimeout(() => { notice.hidden = true; }, 5000);
  }

  function reportError(message, error) {
    const detail = error?.message || String(error || message);
    window.FolioCloudSync.status = 'error';
    window.FolioCloudSync.error = detail;
    console.error(message, detail);
    showStatus(`Supabase sync error: ${detail}`, true);
    window.dispatchEvent(new CustomEvent('folio-cloud-sync-error', { detail: { message: detail } }));
  }

  function getAccountId(key) {
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('folio-accounts-v1')) || []; } catch {}
    return accounts.filter(account => key.startsWith(`folio-finance-v1-${account.id}`))
      .sort((a, b) => String(b.id).length - String(a.id).length)[0]?.id || 'personal';
  }

  function recordsFor(key, value) {
    if (key === 'folio-accounts-v1' && Array.isArray(value)) {
      return { table: 'account_profiles', accountId: 'profiles', records: value.map((item, index) => ({ id: String(item.id || `account-${index}`), payload: item })) };
    }
    const accountId = getAccountId(key);
    const prefix = `folio-finance-v1-${accountId}`;
    const suffix = key.slice(prefix.length).replace(/^-/, '');
    const asRecords = list => (Array.isArray(list) ? list : []).map((item, index) => ({ id: String(item.id || item.category || `entry-${index}`), payload: item }));

    if (!suffix) {
      const finance = value && typeof value === 'object' ? value : {};
      return [
        { table: 'transactions', records: asRecords(finance.transactions) },
        { table: 'budgets', records: asRecords(finance.budgets) }
      ].map(item => ({ ...item, accountId }));
    }
    if (suffix === 'goals') return { table: 'financial_goals', accountId, records: asRecords(value) };
    if (suffix === 'goals-settings') return { table: 'financial_plan_settings', accountId, records: [{ id: 'settings', payload: value || {} }] };
    if (suffix === 'net-worth') return { table: 'net_worth_entries', accountId, records: asRecords(value?.items).map(item => ({ ...item, payload: { ...item.payload, recordType: 'entry' } })) };
    if (suffix === 'net-worth-history') return { table: 'net_worth_entries', accountId, records: (Array.isArray(value) ? value : []).map((item, index) => ({ id: `snapshot-${item.date || index}`, payload: { ...item, recordType: 'snapshot' } })) };
    if (suffix === 'debt-tracker') return { table: 'loans', accountId, records: asRecords(value) };
    if (suffix === 'recurring') return { table: 'recurring_transactions', accountId, records: asRecords(value) };
    if (suffix === 'reminders') return { table: 'reminders', accountId, records: asRecords(value) };
    return null;
  }

  async function syncTableRecords(table, accountId, records) {
    const { data: existing, error: readError } = await client.from(table).select('record_id').eq('user_id', userId).eq('account_id', accountId);
    if (readError) throw readError;
    const rows = records.map(record => ({ user_id: userId, account_id: accountId, record_id: record.id, payload: record.payload }));
    if (rows.length) {
      const { error } = await client.from(table).upsert(rows, { onConflict: 'user_id,account_id,record_id' });
      if (error) throw error;
    }
    const keep = new Set(rows.map(row => row.record_id));
    const stale = (existing || []).map(row => row.record_id).filter(id => !keep.has(id));
    if (stale.length) {
      const { error } = await client.from(table).delete().eq('user_id', userId).eq('account_id', accountId).in('record_id', stale);
      if (error) throw error;
    }
  }

  async function mirrorFeatureData(key, value) {
    const mapping = recordsFor(key, value);
    for (const item of (Array.isArray(mapping) ? mapping : mapping ? [mapping] : [])) {
      try { await syncTableRecords(item.table, item.accountId, item.records); }
      catch (error) { reportError(`Could not sync ${item.table}.`, error); }
    }
  }

  async function upload(key, rawValue) {
    if (!userId || !initialized || hydrating || !isAppKey(key)) return;
    let value;
    try { value = JSON.parse(rawValue); } catch { value = rawValue; }
    syncQueue = syncQueue.then(async () => {
      const { error } = await client.from(TABLE).upsert({ user_id: userId, storage_key: key, value }, { onConflict: 'user_id,storage_key' });
      if (error) reportError(`Could not save ${key} to ${TABLE}.`, error);
      else await mirrorFeatureData(key, value);
    }).catch(error => reportError('Folio cloud sync failed.', error));
  }

  Storage.prototype.setItem = function(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === window.localStorage) void upload(String(key), String(value));
  };

  async function applyRemoteRow(row) {
    if (!isAppKey(row.storage_key)) return;
    const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    if (localStorage.getItem(row.storage_key) !== raw) {
      hydrating = true;
      nativeSetItem.call(localStorage, row.storage_key, raw);
      hydrating = false;
      window.dispatchEvent(new StorageEvent('storage', { key: row.storage_key, newValue: raw, storageArea: localStorage }));
      window.dispatchEvent(new CustomEvent('folio-cloud-data-updated', { detail: { key: row.storage_key } }));
    }
    await mirrorFeatureData(row.storage_key, row.value);
  }

  async function start() {
    // Allows local UI work without an account. In this mode changes remain in
    // localStorage and are intentionally not uploaded to Supabase.
    if (config.requireAuth === false) {
      window.FolioCloudSync.status = 'local-only';
      window.FolioCloudSync.error = null;
      console.info('Folio cloud sync paused by configuration; using local browser storage.');
      return;
    }

    let { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    // Folio requires a real email/password account. Older versions created an
    // anonymous session here, which made auth.html treat visitors as signed in.
    if (!session || session.user?.is_anonymous) {
      if (session?.user?.is_anonymous) await client.auth.signOut();
      window.location.replace('auth.html');
      return;
    }
    // getSession() reads the browser's cached token. Verify that Auth still
    // recognizes this user before writing a profile with an auth.users FK.
    const { data: verified, error: verifyError } = await client.auth.getUser();
    if (verifyError || !verified?.user || verified.user.is_anonymous) {
      await client.auth.signOut();
      window.location.replace('auth.html');
      return;
    }
    const user = verified.user;
    userId = user.id;

    const profile = {
      user_id: userId,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || '',
      updated_at: new Date().toISOString()
    };
    const { error: profileError } = await client.from('users').upsert(profile, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const { data: rows, error: readError } = await client.from(TABLE).select('storage_key,value').eq('user_id', userId);
    if (readError) throw readError;
    const remoteKeys = new Set((rows || []).map(row => row.storage_key));
    const localRows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isAppKey(key)) localRows.push({ key, raw: localStorage.getItem(key) });
    }
    hydrating = true;
    for (const row of rows || []) await applyRemoteRow(row);
    hydrating = false;
    initialized = true;
    // Seed cloud storage from this browser only for keys not already in the account.
    for (const row of localRows) if (!remoteKeys.has(row.key)) void upload(row.key, row.raw);

    client.channel(`folio-data-${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}`
    }, async payload => {
      if (payload.eventType === 'DELETE') return;
      await applyRemoteRow(payload.new);
    }).subscribe();
    window.dispatchEvent(new CustomEvent('folio-cloud-sync-ready', { detail: { userId } }));
    console.info('Folio cloud sync connected.');
    if (window.FolioCloudSync.status !== 'error') {
      window.FolioCloudSync.status = 'connected';
      window.FolioCloudSync.error = null;
      showStatus('Supabase sync connected', false);
    }
  }

  start().catch(error => {
    const detail = error?.message || String(error || '');
    if (/row-level security policy.*users|users.*row-level security policy/i.test(detail)) {
      reportError('The users table is missing its owner policy. Run the latest supabase-schema.sql in Supabase SQL Editor.', error);
      return;
    }
    reportError('Folio cloud sync could not connect. Check Supabase setup and anonymous sign-in settings:', error);
  });
})();
