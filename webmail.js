(() => {
  'use strict';

  const API_BASE = 'https://api-mail.mctstudios.online';
  const firebaseConfig = {
    apiKey: 'AIzaSyDRKSc1TjyWkULLAIkNSKCJQdhGL2YC7V4',
    authDomain: 'mctstudios-auth.firebaseapp.com',
    projectId: 'mctstudios-auth',
    storageBucket: 'mctstudios-auth.firebasestorage.app',
    messagingSenderId: '599724018113',
    appId: '1:599724018113:web:d6e228e7d82a400d360740',
    measurementId: 'G-NLTKEVP3EK'
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  const $ = (id) => document.getElementById(id);
  const el = {
    boot: $('bootScreen'), app: $('app'), sidebar: $('sidebar'), backdrop: $('sidebarBackdrop'),
    openSidebar: $('openSidebar'), closeSidebar: $('closeSidebar'), logout: $('logoutBtn'),
    composeBtn: $('composeBtn'), composeWindow: $('composeWindow'), composeBackdrop: $('composeBackdrop'),
    closeCompose: $('closeCompose'), composeForm: $('composeForm'), composeFrom: $('composeFrom'),
    composeTo: $('composeTo'), composeSubject: $('composeSubject'), composeBody: $('composeBody'), sendBtn: $('sendBtn'),
    search: $('searchInput'), refresh: $('refreshBtn'), accountSelect: $('accountSelect'),
    folderTitle: $('folderTitle'), folderSubtitle: $('folderSubtitle'), messageCounter: $('messageCounter'),
    messageList: $('messageList'), emptyState: $('emptyState'), emptyText: $('emptyText'), syncText: $('syncText'),
    markAllRead: $('markAllReadBtn'), readerPanel: $('readerPanel'), readerPlaceholder: $('readerPlaceholder'),
    reader: $('reader'), closeReader: $('closeReader'), readerSubject: $('readerSubject'), readerFromName: $('readerFromName'),
    readerFromEmail: $('readerFromEmail'), readerAvatar: $('readerAvatar'), readerDate: $('readerDate'), readerTo: $('readerTo'),
    readerFolderLabel: $('readerFolderLabel'), messageBody: $('messageBody'), attachments: $('attachments'),
    toggleRead: $('toggleReadBtn'), moveInbox: $('moveInboxBtn'), trash: $('trashBtn'),
    sidebarAvatar: $('sidebarAvatar'), sidebarName: $('sidebarName'), sidebarEmail: $('sidebarEmail'),
    toastStack: $('toastStack')
  };

  const folders = {
    inbox:  { title: 'Posta in arrivo', subtitle: 'Le tue comunicazioni più recenti.' },
    sent:   { title: 'Inviati', subtitle: 'I messaggi che hai inviato.' },
    drafts: { title: 'Bozze', subtitle: 'Messaggi salvati e non ancora inviati.' },
    junk:   { title: 'Spam', subtitle: 'Messaggi classificati come indesiderati.' },
    trash:  { title: 'Cestino', subtitle: 'Messaggi spostati nel cestino.' }
  };

  const state = {
    user: null,
    accounts: [],
    account: '',
    folder: 'inbox',
    messages: [],
    filtered: [],
    selectedId: null,
    selectedMessage: null,
    loading: false
  };

  async function token() {
    if (!auth.currentUser) throw new Error('Sessione scaduta');
    return auth.currentUser.getIdToken();
  }

  async function api(path, options = {}) {
    const t = await token();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${t}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let data = null;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || data?.ok === false) {
      const error = new Error(data?.error || `Errore HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function toast(title, message = '', type = 'ok') {
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.innerHTML = `<i></i><div><strong></strong><p></p></div>`;
    node.querySelector('strong').textContent = title;
    node.querySelector('p').textContent = message;
    el.toastStack.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function getAccounts(me) {
    const raw = me?.mailboxes || me?.accounts || me?.user?.mailboxes || me?.user?.accounts || [];
    return raw.map(x => typeof x === 'string' ? x : x?.email).filter(Boolean);
  }

  function initials(value) {
    const clean = String(value || 'M').replace(/<.*?>/g, '').trim();
    return (clean[0] || 'M').toUpperCase();
  }

  function addressName(address) {
    if (!address) return 'Sconosciuto';
    return address.name || address.email || 'Sconosciuto';
  }

  function addressEmail(address) { return address?.email || ''; }

  function firstAddress(value) {
    if (Array.isArray(value)) return value[0] || {};
    return value || {};
  }

  function formatDate(value, long = false) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    if (long) return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);
    if (date.getFullYear() === now.getFullYear()) return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(date);
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
  }

  function isRead(msg) { return Boolean(msg?.keywords?.['$seen']); }

  function setLoadingList() {
    el.messageList.innerHTML = Array.from({ length: 7 }, () => '<div class="skeleton"><div></div><div></div><div></div></div>').join('');
    el.emptyState.hidden = true;
  }

  function updateFolderChrome() {
    document.querySelectorAll('.folder').forEach(btn => btn.classList.toggle('active', btn.dataset.folder === state.folder));
    el.folderTitle.textContent = folders[state.folder].title;
    el.folderSubtitle.textContent = folders[state.folder].subtitle;
    el.readerFolderLabel.textContent = folders[state.folder].title.toUpperCase();
    el.moveInbox.hidden = state.folder === 'inbox' || state.folder === 'sent' || state.folder === 'drafts';
    el.trash.textContent = state.folder === 'trash' ? 'Elimina definitivamente' : 'Cestino';
  }

  function renderList() {
    const q = el.search.value.trim().toLowerCase();
    state.filtered = state.messages.filter(msg => {
      if (!q) return true;
      const from = firstAddress(msg.from);
      const hay = [msg.subject, msg.preview, from.name, from.email].join(' ').toLowerCase();
      return hay.includes(q);
    });

    el.messageCounter.textContent = `${state.filtered.length} ${state.filtered.length === 1 ? 'messaggio' : 'messaggi'}`;
    el.messageList.innerHTML = '';
    el.emptyState.hidden = state.filtered.length > 0;
    el.emptyText.textContent = q ? 'Nessun risultato per questa ricerca.' : 'Questa cartella è vuota.';

    const frag = document.createDocumentFragment();
    state.filtered.forEach(msg => {
      const from = firstAddress(msg.from);
      const row = document.createElement('article');
      row.className = `message-item ${isRead(msg) ? '' : 'unread'} ${msg.id === state.selectedId ? 'selected' : ''}`;
      row.dataset.id = msg.id;

      const dot = document.createElement('span'); dot.className = 'unread-dot';
      const content = document.createElement('div'); content.className = 'message-content';
      const top = document.createElement('div'); top.className = 'message-top';
      const sender = document.createElement('span'); sender.className = 'message-sender';
      sender.textContent = state.folder === 'sent' ? `A: ${addressName(firstAddress(msg.to))}` : addressName(from);
      const time = document.createElement('time'); time.className = 'message-time'; time.textContent = formatDate(msg.receivedAt || msg.sentAt);
      const subject = document.createElement('div'); subject.className = 'message-subject'; subject.textContent = msg.subject || '(Senza oggetto)';
      const preview = document.createElement('div'); preview.className = 'message-preview'; preview.textContent = msg.preview || 'Nessuna anteprima disponibile.';
      top.append(sender, time); content.append(top, subject, preview);
      if (msg.hasAttachment) {
        const badges = document.createElement('div'); badges.className = 'message-badges';
        const b = document.createElement('span'); b.className = 'mini-badge'; b.textContent = 'Allegato'; badges.appendChild(b); content.appendChild(badges);
      }
      row.append(dot, content);
      row.addEventListener('click', () => openMessage(msg.id));
      frag.appendChild(row);
    });
    el.messageList.appendChild(frag);
  }

  async function loadMessages({ quiet = false } = {}) {
    if (!state.account || state.loading) return;
    state.loading = true;
    if (!quiet) setLoadingList();
    el.syncText.textContent = 'Sincronizzazione…';
    try {
      const data = await api(`/messages?account=${encodeURIComponent(state.account)}&folder=${encodeURIComponent(state.folder)}`);
      state.messages = Array.isArray(data.emails) ? data.emails : [];
      renderList();
      const countEl = $(`count-${state.folder}`);
      if (countEl) countEl.textContent = state.messages.length || '';
      el.syncText.textContent = 'Sincronizzata';
    } catch (error) {
      state.messages = [];
      renderList();
      el.syncText.textContent = 'Errore';
      toast('Impossibile caricare la posta', error.message, 'error');
    } finally { state.loading = false; }
  }

  function closeReaderView() {
    state.selectedId = null; state.selectedMessage = null;
    el.reader.hidden = true; el.readerPlaceholder.hidden = false;
    el.readerPanel.classList.remove('mobile-open');
    renderList();
  }

  function renderMessageBody(msg) {
    el.messageBody.innerHTML = '';
    const htmlPart = Array.isArray(msg.htmlBody) ? msg.htmlBody[0] : null;
    const textPart = Array.isArray(msg.textBody) ? msg.textBody[0] : null;
    const htmlId = htmlPart?.partId || htmlPart?.blobId;
    const textId = textPart?.partId || textPart?.blobId;
    const htmlValue = htmlId && msg.bodyValues?.[htmlId]?.value;
    const textValue = textId && msg.bodyValues?.[textId]?.value;

    if (htmlValue) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', '');
      iframe.setAttribute('title', 'Contenuto del messaggio');
      iframe.srcdoc = `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light"><style>html,body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1d2330;background:white;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#1769d2}</style>${htmlValue}`;
      el.messageBody.appendChild(iframe);
    } else {
      const body = document.createElement('div'); body.className = 'plain-body';
      body.textContent = textValue || msg.preview || '(Messaggio senza contenuto testuale)';
      el.messageBody.appendChild(body);
    }

    const files = Array.isArray(msg.attachments) ? msg.attachments : [];
    el.attachments.innerHTML = '';
    el.attachments.hidden = files.length === 0;
    files.forEach(file => {
      const chip = document.createElement('span'); chip.className = 'attachment-chip';
      chip.textContent = `${file.name || 'Allegato'}${file.size ? ` · ${Math.ceil(file.size / 1024)} KB` : ''}`;
      el.attachments.appendChild(chip);
    });
  }

  async function openMessage(id) {
    state.selectedId = id; renderList();
    el.readerPlaceholder.hidden = true; el.reader.hidden = false; el.readerPanel.classList.add('mobile-open');
    el.readerSubject.textContent = 'Caricamento…'; el.messageBody.textContent = '';
    try {
      const data = await api(`/messages/${encodeURIComponent(id)}?account=${encodeURIComponent(state.account)}`);
      const msg = data.email || data.message || data;
      state.selectedMessage = msg;
      const from = firstAddress(msg.from);
      el.readerSubject.textContent = msg.subject || '(Senza oggetto)';
      el.readerFromName.textContent = addressName(from);
      el.readerFromEmail.textContent = addressEmail(from) || '—';
      el.readerAvatar.textContent = initials(addressName(from));
      el.readerDate.textContent = formatDate(msg.receivedAt || msg.sentAt, true);
      el.readerTo.textContent = (msg.to || []).map(a => a.name ? `${a.name} <${a.email}>` : a.email).filter(Boolean).join(', ') || '—';
      el.toggleRead.textContent = isRead(msg) ? 'Segna non letta' : 'Segna letta';
      renderMessageBody(msg);
      if (!isRead(msg)) await setRead(true, { silent: true });
    } catch (error) {
      toast('Impossibile aprire il messaggio', error.message, 'error');
      closeReaderView();
    }
  }

  async function setRead(read, { silent = false } = {}) {
    if (!state.selectedId) return;
    try {
      await api(`/messages/${encodeURIComponent(state.selectedId)}/read`, {
        method: 'POST', body: JSON.stringify({ account: state.account, read })
      });
      const msg = state.messages.find(m => m.id === state.selectedId);
      if (msg) {
        msg.keywords ||= {};
        if (read) msg.keywords['$seen'] = true; else delete msg.keywords['$seen'];
      }
      if (state.selectedMessage) {
        state.selectedMessage.keywords ||= {};
        if (read) state.selectedMessage.keywords['$seen'] = true; else delete state.selectedMessage.keywords['$seen'];
      }
      el.toggleRead.textContent = read ? 'Segna non letta' : 'Segna letta';
      renderList();
      if (!silent) toast(read ? 'Messaggio segnato come letto' : 'Messaggio segnato come non letto');
    } catch (error) { if (!silent) toast('Operazione non riuscita', error.message, 'error'); }
  }

  async function moveSelected(folder) {
    if (!state.selectedId) return;
    try {
      await api(`/messages/${encodeURIComponent(state.selectedId)}/move`, {
        method: 'POST', body: JSON.stringify({ account: state.account, folder })
      });
      toast(folder === 'trash' ? 'Messaggio spostato nel cestino' : 'Messaggio ripristinato');
      closeReaderView(); await loadMessages({ quiet: true });
    } catch (error) { toast('Spostamento non riuscito', error.message, 'error'); }
  }

  async function deleteSelected() {
    if (!state.selectedId) return;
    if (!confirm('Eliminare definitivamente questo messaggio? Questa operazione non può essere annullata.')) return;
    try {
      await api(`/messages/${encodeURIComponent(state.selectedId)}?account=${encodeURIComponent(state.account)}`, { method: 'DELETE' });
      toast('Messaggio eliminato definitivamente');
      closeReaderView(); await loadMessages({ quiet: true });
    } catch (error) { toast('Eliminazione non riuscita', error.message, 'error'); }
  }

  function openCompose() {
    el.composeFrom.textContent = state.account;
    el.composeWindow.hidden = false; el.composeBackdrop.hidden = false;
    setTimeout(() => el.composeTo.focus(), 20);
  }
  function closeCompose() { el.composeWindow.hidden = true; el.composeBackdrop.hidden = true; }

  async function sendMessage(event) {
    event.preventDefault();
    const recipients = el.composeTo.value.split(',').map(v => v.trim()).filter(Boolean);
    if (!recipients.length) return toast('Inserisci almeno un destinatario', '', 'error');
    el.sendBtn.disabled = true; el.sendBtn.querySelector('span').textContent = 'Invio…';
    try {
      await api('/send', {
        method: 'POST',
        body: JSON.stringify({ account: state.account, to: recipients, subject: el.composeSubject.value.trim(), text: el.composeBody.value })
      });
      closeCompose(); el.composeForm.reset();
      toast('Email inviata', `Messaggio inviato da ${state.account}`);
      if (state.folder === 'sent') await loadMessages({ quiet: true });
    } catch (error) { toast('Invio non riuscito', error.message, 'error'); }
    finally { el.sendBtn.disabled = false; el.sendBtn.querySelector('span').textContent = 'Invia'; el.composeFrom.textContent = state.account; }
  }

  async function markVisibleRead() {
    const unread = state.filtered.filter(m => !isRead(m));
    if (!unread.length) return toast('Nessun messaggio non letto');
    el.markAllRead.disabled = true;
    let done = 0;
    for (const msg of unread) {
      try {
        await api(`/messages/${encodeURIComponent(msg.id)}/read`, { method: 'POST', body: JSON.stringify({ account: state.account, read: true }) });
        msg.keywords ||= {}; msg.keywords['$seen'] = true; done++;
      } catch { /* continua con gli altri */ }
    }
    el.markAllRead.disabled = false; renderList(); toast('Operazione completata', `${done} messaggi segnati come letti.`);
  }

  async function initUser(user) {
    state.user = user;
    try {
      const me = await api('/me');
      state.accounts = getAccounts(me);
      if (!state.accounts.length) throw new Error('Nessuna casella email autorizzata per questo account.');
      state.account = state.accounts[0];
      el.accountSelect.innerHTML = '';
      state.accounts.forEach(account => {
        const o = document.createElement('option'); o.value = account; o.textContent = account; el.accountSelect.appendChild(o);
      });
      const labelName = user.displayName || user.email?.split('@')[0] || 'MCT Studios';
      el.sidebarName.textContent = labelName;
      el.sidebarEmail.textContent = state.account;
      el.sidebarAvatar.textContent = initials(labelName);
      el.composeFrom.textContent = state.account;
      el.boot.style.opacity = '0';
      setTimeout(() => { el.boot.hidden = true; el.app.hidden = false; }, 180);
      updateFolderChrome();
      await loadMessages();
    } catch (error) {
      el.boot.querySelector('p').textContent = error.message;
      toast('Accesso alla webmail non riuscito', error.message, 'error');
    }
  }

  document.querySelectorAll('.folder').forEach(btn => btn.addEventListener('click', async () => {
    state.folder = btn.dataset.folder; closeReaderView(); updateFolderChrome();
    el.sidebar.classList.remove('open'); el.backdrop.classList.remove('show');
    await loadMessages();
  }));
  el.search.addEventListener('input', renderList);
  el.search.addEventListener('keydown', e => { if (e.key === 'Escape') { el.search.value = ''; renderList(); el.search.blur(); } });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el.search.focus(); } });
  el.refresh.addEventListener('click', () => loadMessages());
  el.accountSelect.addEventListener('change', async () => {
    state.account = el.accountSelect.value; el.sidebarEmail.textContent = state.account; el.composeFrom.textContent = state.account;
    closeReaderView(); await loadMessages();
  });
  el.composeBtn.addEventListener('click', openCompose); el.closeCompose.addEventListener('click', closeCompose); el.composeBackdrop.addEventListener('click', closeCompose);
  el.composeForm.addEventListener('submit', sendMessage); el.closeReader.addEventListener('click', () => el.readerPanel.classList.remove('mobile-open'));
  el.toggleRead.addEventListener('click', () => setRead(!isRead(state.selectedMessage || {})));
  el.moveInbox.addEventListener('click', () => moveSelected('inbox'));
  el.trash.addEventListener('click', () => state.folder === 'trash' ? deleteSelected() : moveSelected('trash'));
  el.markAllRead.addEventListener('click', markVisibleRead);
  el.openSidebar.addEventListener('click', () => { el.sidebar.classList.add('open'); el.backdrop.classList.add('show'); });
  el.closeSidebar.addEventListener('click', () => { el.sidebar.classList.remove('open'); el.backdrop.classList.remove('show'); });
  el.backdrop.addEventListener('click', () => { el.sidebar.classList.remove('open'); el.backdrop.classList.remove('show'); });
  el.logout.addEventListener('click', () => auth.signOut().then(() => location.href = 'login.html'));

  auth.onAuthStateChanged(user => {
    if (!user) location.href = 'login.html';
    else initUser(user);
  });
})();
