(function () {
  'use strict';

  if (!document.querySelector('link[href="membership-flow.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'membership-flow.css';
    document.head.append(stylesheet);
  }

  const MUSIC_NOTES = ['♩', '♪', '♫', '♬', '♩♪', '♪♫'];
  const POINTS = [
    { x: 160, y: 21, left: 50, top: 7 },
    { x: 272, y: 84, left: 85, top: 28 },
    { x: 272, y: 216, left: 85, top: 72 },
    { x: 160, y: 279, left: 50, top: 93 },
    { x: 48, y: 216, left: 15, top: 72 },
    { x: 48, y: 84, left: 15, top: 28 },
  ];
  const MEMBER_LABELS = {
    en: 'My Account', es: 'Mi cuenta', ko: '내 계정', zh: '我的账户', ja: 'マイアカウント',
    fr: 'Mon compte', it: 'Il mio account', ru: 'Мой аккаунт', tl: 'Aking account',
  };
  const JOIN_LABELS = {
    en: 'Join the Club', es: 'Únete al Club', ko: '클럽 가입', zh: '加入俱乐部', ja: 'クラブに参加',
    fr: 'Rejoindre le club', it: 'Entra nel Club', ru: 'Вступить в клуб', tl: 'Sumali sa Club',
  };
  const CHAT_LABELS = {
    en: 'Karaoke Chat', es: 'Chat de karaoke', ko: '노래방 채팅', zh: '卡拉 OK 聊天', ja: 'カラオケチャット',
    fr: 'Chat karaoké', it: 'Chat karaoke', ru: 'Караоке-чат', tl: 'Karaoke Chat',
  };
  const JOIN_CHAT_LABELS = {
    en: 'Join the Club to Chat', es: 'Únete para chatear', ko: '가입하고 채팅하기', zh: '加入俱乐部聊天', ja: '参加してチャット',
    fr: 'Rejoignez-nous pour discuter', it: 'Entra per chattare', ru: 'Вступите, чтобы общаться', tl: 'Sumali para mag-chat',
  };

  const nativeRequestSong = window.requestSong;
  const nativeToggleFavorite = window.toggleFavorite;
  const nativeUpdateBadges = window.updateBadges;
  const nativeTranslateApplication = window.translateApplication;
  const nativeConfirmLogout = window.confirmLogout;
  let pendingMemberAction = null;
  let returningId = '';
  let returningProfile = null;
  let createPasswordMode = 'regular';
  let createdGlyph = '';
  let glyphSession = null;
  let glyphFirstEntry = '';
  let glyphPreviewTimer = 0;
  const LOGIN_METHOD_PREFERENCES_KEY = 'bcdkc-login-method-preferences';

  function preferredLoginMethod(username) {
    try {
      const preferences = JSON.parse(localStorage.getItem(LOGIN_METHOD_PREFERENCES_KEY) || '{}');
      return preferences[String(username || '').toLocaleLowerCase()] === 'glyph' ? 'glyph' : 'password';
    } catch (_) {
      return 'password';
    }
  }

  function rememberLoginMethod(username, method) {
    if (!username || !['password', 'glyph'].includes(method)) return;
    try {
      const preferences = JSON.parse(localStorage.getItem(LOGIN_METHOD_PREFERENCES_KEY) || '{}');
      preferences[String(username).toLocaleLowerCase()] = method;
      localStorage.setItem(LOGIN_METHOD_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (_) {
      // Sign-in still works when browser storage is unavailable.
    }
  }

  function signedInMember() {
    const user = currentUser?.();
    return user && !user.guest ? user : null;
  }

  function currentLanguage() {
    return signedInMember()?.language || document.documentElement.lang || 'en';
  }

  function copyFor(map) {
    return map[currentLanguage()] || map.en;
  }

  function syncVisualViewport() {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    root.style.setProperty('--club-vv-width', `${Math.round(viewport?.width || innerWidth)}px`);
    root.style.setProperty('--club-vv-height', `${Math.round(viewport?.height || innerHeight)}px`);
    root.style.setProperty('--club-vv-left', `${Math.round(viewport?.offsetLeft || 0)}px`);
    root.style.setProperty('--club-vv-top', `${Math.round(viewport?.offsetTop || 0)}px`);
    requestAnimationFrame(keepFocusedClubFieldVisible);
  }

  function keepFocusedClubFieldVisible() {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement) || !field.matches('.clubModal input, .clubModal textarea, .clubModal select')) return;
    const modal = field.closest('.clubModal');
    if (!modal || !modal.parentElement?.classList.contains('open')) return;

    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || innerHeight);
    const fieldBounds = field.getBoundingClientRect();
    const modalBounds = modal.getBoundingClientRect();
    const safeTop = Math.max(modalBounds.top + 18, viewportTop + 18);
    const safeBottom = Math.min(modalBounds.bottom - 18, viewportBottom - 18);

    if (fieldBounds.top < safeTop || fieldBounds.bottom > safeBottom) {
      const targetTop = modal.scrollTop + fieldBounds.top - modalBounds.top - Math.max(18, (modal.clientHeight - field.offsetHeight) / 2);
      modal.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
    }
  }

  function setModalOpen(id, open) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle('open', !!open);
  }

  function closeMembershipModals() {
    ['clubWelcomeModal', 'clubGateModal', 'clubReturningModal', 'clubCreateModal', 'glyphPasswordModal'].forEach(id => setModalOpen(id, false));
  }

  function setStatus(id, message, success = false) {
    const status = document.getElementById(id);
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('success', !!success);
  }

  async function profileAction(body) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/karaoke-profile`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let result = {};
    try { result = await response.json(); } catch (_) { /* The status below is more useful. */ }
    if (!response.ok) {
      const error = new Error(result.error || 'The club door could not connect. Please try again.');
      error.data = result;
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function syncGuestUi() {
    const member = signedInMember();
    document.body.classList.toggle('member-signed-in', !!member);
    const profileTab = document.getElementById('profileTab');
    if (profileTab) {
      const label = member ? copyFor(MEMBER_LABELS) : copyFor(JOIN_LABELS);
      profileTab.hidden = false;
      if (profileTab.textContent !== label) profileTab.textContent = label;
      profileTab.classList.toggle('joinClubTab', !member);
      profileTab.setAttribute('aria-label', label);
    }
    const headerChatTab = document.querySelector('.tab[data-tab="chat"]');
    if (headerChatTab) headerChatTab.hidden = true;
    const heroButton = document.getElementById('heroChatButton');
    if (heroButton) {
      const label = copyFor(CHAT_LABELS);
      if (!heroButton.textContent.trim().startsWith(label)) heroButton.textContent = label;
      heroButton.classList.remove('guestChatButton');
      heroButton.setAttribute('aria-label', label);
    }
    const heroCopy = document.querySelector('[data-view="songbook"] .heroCard p');
    if (heroCopy && !member) heroCopy.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && /sign in/i.test(node.textContent || '')) node.textContent = node.textContent.replace(/sign in/ig, 'Join the Club');
    });
  }

  window.enterSite = function () {
    document.getElementById('landing')?.classList.add('dismissed');
    closeMembershipModals();
    switchTab('songbook');
    requestAnimationFrame(syncGuestUi);
  };
  window.openLandingLogin = window.enterSite;

  window.openClubWelcome = function (clearPending = true) {
    if (signedInMember()) { switchTab('profile'); return; }
    if (clearPending) pendingMemberAction = null;
    closeMembershipModals();
    resetWelcomeMemberForm();
    setModalOpen('clubWelcomeModal', true);
    setTimeout(() => document.getElementById('clubWelcomeMemberId')?.focus(), 40);
  };

  window.closeClubWelcome = function () {
    setModalOpen('clubWelcomeModal', false);
  };

  window.openLogin = function () {
    window.openClubWelcome(true);
  };

  function syncWelcomeContinueState() {
    const id = document.getElementById('clubWelcomeMemberId');
    const button = document.getElementById('clubWelcomeContinue');
    if (!button) return;
    const ready = !!id?.value.trim();
    button.disabled = !ready;
    button.classList.toggle('clubActionReady', ready);
  }

  function setWelcomeHint(message, invalid = false) {
    const hint = document.getElementById('clubWelcomeHint');
    if (!hint) return;
    hint.textContent = message || 'Continue to enter your password or four-point glyph.';
    hint.classList.toggle('invalid', !!invalid);
  }

  function resetWelcomeMemberForm() {
    const id = document.getElementById('clubWelcomeMemberId');
    if (id) id.value = '';
    setWelcomeHint();
    syncWelcomeContinueState();
  }

  window.continueWelcomeMember = async function () {
    const welcomeId = document.getElementById('clubWelcomeMemberId');
    const button = document.getElementById('clubWelcomeContinue');
    const id = welcomeId?.value.trim() || '';
    if (!id) {
      const message = 'Enter your Membership ID to continue.';
      setWelcomeHint(message, true);
      welcomeId?.focus();
      return;
    }
    button?.classList.add('clubBusy');
    setWelcomeHint('Checking your Membership ID…');
    try {
      const result = await profileAction({ action: 'lookup_profile', username: id });
      if (!result.found) {
        const message = 'Not a valid Member ID. Please try again.';
        setWelcomeHint(message, true);
        toast(message, welcomeId);
        welcomeId?.focus();
        return;
      }
      if (!result.requiresPassword) {
        finishMembership(result.profile, false);
        return;
      }
      window.showReturningMember(result.profile);
    } catch (error) {
      const message = error.message || 'The club door could not connect. Please try again.';
      setWelcomeHint(message, true);
    } finally {
      button?.classList.remove('clubBusy');
    }
  };

  window.openClubFeatureGate = function (feature = 'feature', itemId = '') {
    const title = document.getElementById('clubGateTitle');
    const copy = document.getElementById('clubGateCopy');
    const messages = {
      favorite: ['Save it to your favorites', 'Join the Club to access this feature.'],
      request: ['Request through the app', 'Join the Club to request songs through the app while Karaoke Host Mode is on.'],
      chat: ['Karaoke Club Chat?!', 'Join the Club to access Karaoke Chat.'],
      feature: ['Join the Club', 'Join the Club to access this feature.'],
    };
    const selected = messages[feature] || messages.feature;
    pendingMemberAction = itemId || feature === 'chat' ? { type: feature, itemId } : null;
    if (title) title.textContent = selected[0];
    if (copy) copy.textContent = selected[1];
    closeMembershipModals();
    setModalOpen('clubGateModal', true);
  };

  window.continueFromClubGate = function () {
    setModalOpen('clubGateModal', false);
    window.openClubWelcome(false);
  };

  function showPaperRequest(song) {
    if (!song) return;
    const code = document.getElementById('paperRequestCode');
    const label = document.getElementById('paperRequestSong');
    if (code) code.textContent = song.code;
    if (label) label.textContent = `${song.title} · ${song.artist}`;
    setModalOpen('paperRequestModal', true);
  }

  window.requestSong = function (songId) {
    if (!signedInMember()) {
      const song = songById(songId);
      if (!song) return;
      if (!hostModeEnabled()) showPaperRequest(song);
      else window.openClubFeatureGate('request', songId);
      return;
    }
    return nativeRequestSong(songId);
  };

  window.toggleFavorite = function (songId) {
    if (!signedInMember()) {
      window.openClubFeatureGate('favorite', songId);
      return;
    }
    return nativeToggleFavorite(songId);
  };

  window.ensureUser = function () {
    if (signedInMember()) return true;
    window.openClubFeatureGate('chat');
    return false;
  };

  function resetReturningForm() {
    returningId = '';
    returningProfile = null;
    const password = document.getElementById('clubReturningPassword');
    const title = document.getElementById('clubReturningTitle');
    const button = document.getElementById('clubReturningSubmit');
    if (password) password.value = '';
    if (title) title.textContent = 'Welcome back.';
    button?.classList.remove('clubBusy');
    setStatus('clubReturningStatus', '');
    syncReturningSubmitState();
  }

  function syncReturningSubmitState() {
    const password = document.getElementById('clubReturningPassword');
    const button = document.getElementById('clubReturningSubmit');
    if (!button) return;
    const ready = !!password?.value;
    button.disabled = !ready;
    button.classList.toggle('clubActionReady', ready);
  }

  window.showReturningMember = function (profile) {
    if (!profile?.username) {
      window.openClubWelcome(false);
      return;
    }
    closeMembershipModals();
    resetReturningForm();
    returningProfile = profile;
    returningId = profile.username;
    const title = document.getElementById('clubReturningTitle');
    if (title) title.textContent = `Welcome back, ${profile.name}.`;
    setModalOpen('clubReturningModal', true);
    if (preferredLoginMethod(returningId) === 'glyph') {
      setStatus('clubReturningStatus', 'Opening your preferred glyph sign-in…');
      setTimeout(() => window.openReturningGlyph(), 60);
      return;
    }
    setTimeout(() => document.getElementById('clubReturningPassword')?.focus(), 40);
  };

  window.backToClubWelcome = function () {
    window.openClubWelcome(false);
  };

  window.submitReturningMember = async function () {
    const passwordField = document.getElementById('clubReturningPassword');
    const button = document.getElementById('clubReturningSubmit');
    const password = passwordField?.value || '';
    if (!returningProfile || !returningId) { window.backToClubWelcome(); return; }
    if (!password) { setStatus('clubReturningStatus', 'Enter your passcode to continue.'); passwordField?.focus(); return; }
    await signInWithPassword(password, button);
  };

  async function signInWithPassword(password, button) {
    button?.classList.add('clubBusy');
    setStatus('clubReturningStatus', 'Opening the door…');
    try {
      const credentialHash = await hashPassword(password);
      const result = await sharedProfile(returningId, credentialHash);
      rememberLoginMethod(returningId, 'password');
      finishMembership(result.profile, true, credentialHash);
    } catch (error) {
      setStatus('clubReturningStatus', 'That passcode wasn\'t right. Please try again, or use glyph sign-in instead.');
      document.getElementById('clubReturningPassword')?.focus();
    } finally {
      button?.classList.remove('clubBusy');
    }
  }

  function resetCreateForm() {
    createdGlyph = '';
    createPasswordMode = 'regular';
    ['clubCreateId', 'clubCreateDisplay', 'clubCreatePassword', 'clubCreatePasswordAgain'].forEach(id => {
      const field = document.getElementById(id); if (field) field.value = '';
    });
    document.getElementById('clubSuggestions')?.replaceChildren();
    setStatus('clubCreateStatus', '');
    window.setClubPasswordMode('regular');
    updateGlyphReady();
  }

  window.showNewMember = function () {
    closeMembershipModals();
    resetCreateForm();
    setModalOpen('clubCreateModal', true);
    setTimeout(() => document.getElementById('clubCreateId')?.focus(), 40);
  };

  window.setClubPasswordMode = function (mode) {
    createPasswordMode = mode === 'glyph' ? 'glyph' : 'regular';
    document.querySelectorAll('.clubPasswordMode').forEach(button => button.classList.toggle('active', button.dataset.mode === createPasswordMode));
    document.getElementById('clubRegularPasswordPanel').hidden = createPasswordMode !== 'regular';
    document.getElementById('clubGlyphPasswordPanel').hidden = createPasswordMode !== 'glyph';
  };

  function updateGlyphReady() {
    const notes = document.getElementById('clubGlyphReadyNotes');
    const label = document.getElementById('clubGlyphReadyLabel');
    const action = document.getElementById('clubGlyphActionButton');
    window.clearTimeout(glyphPreviewTimer);
    if (notes) {
      notes.textContent = createdGlyph ? [...createdGlyph].map(value => MUSIC_NOTES[+value]).join(' ') : '○ ○ ○ ○';
      notes.disabled = !createdGlyph;
      notes.classList.remove('revealed');
      notes.setAttribute('aria-pressed', 'false');
      notes.setAttribute('aria-label', createdGlyph ? 'Press to reveal glyph numbers' : 'No glyph selected');
    }
    if (label) label.textContent = createdGlyph ? 'Glyph password ready' : 'No glyph selected yet';
    if (action) action.textContent = createdGlyph ? 'Change glyph' : 'Create glyph';
  }

  window.showGlyphNumbers = function () {
    const preview = document.getElementById('clubGlyphReadyNotes');
    if (!preview || !createdGlyph) return;
    window.clearTimeout(glyphPreviewTimer);
    preview.textContent = [...createdGlyph].join(' ');
    preview.classList.add('revealed');
    preview.setAttribute('aria-pressed', 'true');
    preview.setAttribute('aria-label', `Glyph numbers ${[...createdGlyph].join(', ')}`);
    glyphPreviewTimer = window.setTimeout(() => {
      if (!createdGlyph) return;
      preview.textContent = [...createdGlyph].map(value => MUSIC_NOTES[+value]).join(' ');
      preview.classList.remove('revealed');
      preview.setAttribute('aria-pressed', 'false');
      preview.setAttribute('aria-label', 'Press to reveal glyph numbers');
    }, 2400);
  };

  window.submitNewMember = async function () {
    const idField = document.getElementById('clubCreateId');
    const displayField = document.getElementById('clubCreateDisplay');
    const button = document.getElementById('clubCreateSubmit');
    const username = idField?.value.trim() || '';
    const displayName = displayField?.value.trim() || username;
    let passwordHash = null;
    let glyphHash = null;
    document.getElementById('clubSuggestions')?.replaceChildren();
    if (!username) { setStatus('clubCreateStatus', 'Choose your unique BCDKC ID.'); idField?.focus(); return; }
    if (createPasswordMode === 'regular') {
      const password = document.getElementById('clubCreatePassword')?.value || '';
      const confirmation = document.getElementById('clubCreatePasswordAgain')?.value || '';
      if (password.length > 13) { setStatus('clubCreateStatus', 'Passwords can be no more than 13 characters.'); return; }
      if (password !== confirmation) { setStatus('clubCreateStatus', 'Those passwords do not match.'); document.getElementById('clubCreatePasswordAgain')?.focus(); return; }
      passwordHash = password ? await hashPassword(password) : null;
    } else {
      if (!createdGlyph) { setStatus('clubCreateStatus', 'Create and confirm your four-point glyph first.'); window.openCreateGlyph(); return; }
      glyphHash = await hashPassword(`glyph:${createdGlyph}`);
    }
    button?.classList.add('clubBusy');
    setStatus('clubCreateStatus', 'Adding your name to the club book…');
    try {
      const result = await profileAction({ action: 'create_profile', username, displayName, passwordHash, glyphHash });
      finishMembership(result.profile, !!(passwordHash || glyphHash));
    } catch (error) {
      setStatus('clubCreateStatus', error.message);
      const suggestions = error.data?.suggestions || [];
      const holder = document.getElementById('clubSuggestions');
      suggestions.forEach(suggestion => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.textContent = suggestion;
        choice.addEventListener('click', () => { idField.value = suggestion; holder.replaceChildren(); setStatus('clubCreateStatus', `${suggestion} is ready to try.`); });
        holder?.append(choice);
      });
    } finally {
      button?.classList.remove('clubBusy');
    }
  };

  function runPendingAction() {
    const action = pendingMemberAction;
    pendingMemberAction = null;
    if (!action) return;
    setTimeout(() => {
      if (action.type === 'favorite' && action.itemId) nativeToggleFavorite(action.itemId);
      if (action.type === 'request' && action.itemId) nativeRequestSong(action.itemId);
      if (action.type === 'chat') switchTab('chat');
    }, 80);
  }

  function finishMembership(profile, protectedProfile, adminCredentialHash = null) {
    const user = rememberSharedProfile(profile, protectedProfile);
    user.guest = false;
    user.remoteProfile = true;
    user.passwordHash = protectedProfile ? 'REMOTE' : null;
    if (user.isAdmin && adminCredentialHash) sessionStorage.setItem(`bcd-admin-${user.id}`, adminCredentialHash);
    state.currentUserId = user.id;
    saveState();
    closeMembershipModals();
    document.getElementById('loginModal')?.classList.remove('open');
    document.getElementById('landing')?.classList.add('dismissed');
    nativeUpdateBadges?.();
    renderActive();
    syncGuestUi();
    toast(`Welcome, ${user.name}`);
    runPendingAction();
  }

  function replayGlyphEntrance() {
    const stage = document.getElementById('glyphStage');
    if (!stage) return;
    stage.querySelectorAll('.glyphTriangle.first,.glyphTriangle.second,.glyphCore,.glyphPoint,.glyphPoint:before,.glyphNote,.glyphDigit').forEach(element => {
      element.style.animation = 'none';
      void element.getBoundingClientRect();
      element.style.animation = '';
    });
  }

  function renderGlyph() {
    if (!glyphSession) return;
    const values = glyphSession.values;
    const slots = document.querySelectorAll('.glyphSlot');
    slots.forEach((slot, index) => {
      const value = values[index];
      slot.textContent = value === undefined ? '·' : MUSIC_NOTES[+value];
      slot.classList.toggle('filled', value !== undefined);
    });
    document.querySelectorAll('.glyphPoint').forEach(button => {
      const count = values.filter(value => +value === +button.dataset.value).length;
      button.classList.toggle('selected', count > 0);
      button.style.setProperty('--point-glow', `${5 + count * 8}px`);
      button.style.filter = count ? `brightness(${1 + count * .22}) drop-shadow(0 0 ${4 + count * 3}px rgba(61,181,245,.72))` : '';
    });
    const lines = document.getElementById('glyphLines');
    lines?.replaceChildren();
    for (let index = 1; index < values.length; index++) {
      const from = +values[index - 1], to = +values[index];
      if (from === to) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('glyphConnection');
      const fromPoint = document.querySelector(`.glyphPoint[data-value="${from}"]`);
      const toPoint = document.querySelector(`.glyphPoint[data-value="${to}"]`);
      const stage = document.getElementById('glyphStage');
      const stageRect = stage?.getBoundingClientRect();
      const toSvgPoint = point => {
        const rect = point?.getBoundingClientRect();
        if (!rect || !stageRect) return POINTS[+point?.dataset.value] || { x: 160, y: 150 };
        return {
          x: ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 320,
          y: ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 300,
        };
      };
      const start = toSvgPoint(fromPoint), end = toSvgPoint(toPoint);
      line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
      line.setAttribute('x2', end.x); line.setAttribute('y2', end.y);
      lines?.append(line);
    }
    const stage = document.getElementById('glyphStage');
    stage?.classList.toggle('is-complete', values.length === 4);
    const undo = document.getElementById('glyphUndoButton');
    if (undo) undo.hidden = values.length === 0 || !!glyphSession.submitting;
  }

  function resetGlyphValues() {
    if (!glyphSession) return;
    glyphSession.values = [];
    glyphSession.submitting = false;
    renderGlyph();
  }

  function configureGlyphPhase(kind) {
    const title = document.getElementById('glyphTitle');
    const prompt = document.getElementById('glyphPrompt');
    glyphSession = { kind, values: [], submitting: false };
    document.getElementById('glyphStage')?.classList.remove('wrong', 'accepted', 'is-complete');
    if (kind === 'create-first') {
      title.textContent = 'Create your glyph'; prompt.textContent = 'Touch 4 points';
    } else if (kind === 'create-confirm') {
      title.textContent = 'Repeat your glyph'; prompt.textContent = 'Touch the same 4 points again';
    } else {
      title.textContent = 'Enter your glyph'; prompt.textContent = 'Touch your 4 points';
    }
    document.getElementById('glyphStatus').textContent = '';
    document.getElementById('glyphStatus').classList.remove('error');
    renderGlyph();
    replayGlyphEntrance();
  }

  window.openCreateGlyph = function () {
    glyphFirstEntry = '';
    closeMembershipModals();
    setModalOpen('glyphPasswordModal', true);
    configureGlyphPhase('create-first');
  };

  window.openReturningGlyph = function () {
    if (!returningId) return;
    closeMembershipModals();
    setModalOpen('glyphPasswordModal', true);
    configureGlyphPhase('login');
  };

  window.pressGlyphPoint = function (value) {
    if (!glyphSession || glyphSession.submitting || glyphSession.values.length >= 4) return;
    glyphSession.values.push(String(value));
    renderGlyph();
    if (navigator.vibrate) navigator.vibrate(8);
    if (glyphSession.values.length === 4) {
      glyphSession.submitting = true;
      document.getElementById('glyphStatus').textContent = 'Reading your glyph…';
      window.setTimeout(() => window.acceptGlyph(), 280);
    }
  };

  window.undoGlyphPoint = function () {
    if (!glyphSession || glyphSession.submitting || !glyphSession.values.length) return;
    glyphSession.values.pop();
    document.getElementById('glyphStatus').textContent = '';
    document.getElementById('glyphStatus').classList.remove('error');
    document.getElementById('glyphStage')?.classList.remove('wrong', 'accepted');
    renderGlyph();
    if (navigator.vibrate) navigator.vibrate(5);
  };

  window.acceptGlyph = async function () {
    if (!glyphSession || glyphSession.values.length !== 4) return;
    const sequence = glyphSession.values.join('');
    if (glyphSession.kind === 'create-first') {
      glyphFirstEntry = sequence;
      document.getElementById('glyphStage')?.classList.add('accepted');
      window.setTimeout(() => configureGlyphPhase('create-confirm'), 360);
      return;
    }
    if (glyphSession.kind === 'create-confirm') {
      if (sequence !== glyphFirstEntry) {
        const status = document.getElementById('glyphStatus');
        status.textContent = 'Those glyphs did not match. Try the second one again.';
        status.classList.add('error');
        document.getElementById('glyphStage')?.classList.add('wrong');
        setTimeout(() => { document.getElementById('glyphStage')?.classList.remove('wrong'); resetGlyphValues(); }, 430);
        return;
      }
      createdGlyph = sequence;
      const status = document.getElementById('glyphStatus');
      status.textContent = 'Glyph confirmed.';
      status.classList.remove('error');
      document.getElementById('glyphStage')?.classList.add('accepted');
      window.setTimeout(() => {
        setModalOpen('glyphPasswordModal', false);
        setModalOpen('clubCreateModal', true);
        updateGlyphReady();
        setStatus('clubCreateStatus', 'Your glyph password is confirmed.', true);
      }, 480);
      return;
    }
    const status = document.getElementById('glyphStatus');
    status.textContent = 'Reading your glyph…';
    status.classList.remove('error');
    try {
      const credentialHash = await hashPassword(`glyph:${sequence}`);
      const result = await sharedProfile(returningId, credentialHash);
      rememberLoginMethod(returningId, 'glyph');
      status.textContent = 'Welcome back.';
      document.getElementById('glyphStage')?.classList.add('accepted');
      window.setTimeout(() => finishMembership(result.profile, true, credentialHash), 480);
    } catch (_) {
      status.textContent = 'That glyph was not right. Try again.';
      status.classList.add('error');
      document.getElementById('glyphStage')?.classList.add('wrong');
      setTimeout(() => { document.getElementById('glyphStage')?.classList.remove('wrong'); resetGlyphValues(); }, 430);
    }
  };

  window.closeGlyphPassword = function () {
    const kind = glyphSession?.kind || '';
    setModalOpen('glyphPasswordModal', false);
    if (kind.startsWith('create')) setModalOpen('clubCreateModal', true);
    else setModalOpen('clubReturningModal', true);
  };

  function installMembershipUi() {
    if (document.getElementById('clubWelcomeModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="clubWelcomeModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="clubWelcomeTitle">
        <div class="modal clubModal"><button class="modalClose" type="button" onclick="closeClubWelcome()" aria-label="Close">&times;</button>
          <div class="clubWelcome"><div class="clubWelcomeMark" aria-hidden="true"></div><div class="eyebrow">Welcome to BCDKC</div>
            <h3 id="clubWelcomeTitle">Behind Closed Doors</h3><p class="clubWelcomeName">Karaoke Club</p>
            <p class="clubWelcomeCopy">Returning members, please enter your Membership ID, followed by your passcode.</p>
            <div class="clubWelcomeEntry"><div class="clubField clubWelcomeField"><input id="clubWelcomeMemberId" class="control" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" aria-label="Membership ID" placeholder="Enter your Membership ID"></div><button id="clubWelcomeContinue" class="btn gold clubMemberContinue" type="button" onclick="continueWelcomeMember()" disabled aria-label="Continue to password" title="Continue to password"><span class="clubContinueKey" aria-hidden="true"></span><span class="clubContinueArrow" aria-hidden="true">&gt;</span></button></div>
            <p id="clubWelcomeHint" class="clubWelcomeHint" aria-live="polite">Continue to enter your password or four-point glyph.</p>
            <div class="clubChoiceGrid"><button class="btn clubNewMember" type="button" onclick="showNewMember()">New Member</button><p class="clubNewMemberFree">It&rsquo;s Free!</p></div>
          </div>
        </div>
      </div>
      <div id="clubGateModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="clubGateTitle">
        <div class="modal clubModal"><button class="modalClose" type="button" onclick="document.getElementById('clubGateModal').classList.remove('open')" aria-label="Close">&times;</button>
          <div class="clubGate"><div class="clubGateIcon" aria-hidden="true"></div><div class="eyebrow">Members only</div><h3 id="clubGateTitle">Join the Club</h3><p><span id="clubGateCopy">Join the Club to access this feature.</span><br><span class="clubFree">It&rsquo;s free</span></p>
            <div class="modalActions"><button class="btn ghost" type="button" onclick="document.getElementById('clubGateModal').classList.remove('open')">Maybe later</button><button class="btn gold" type="button" onclick="continueFromClubGate()">Join the Club</button></div>
          </div>
        </div>
      </div>
      <div id="clubReturningModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="clubReturningTitle">
        <div class="modal clubModal clubStep clubReturningStep"><button class="modalClose" type="button" onclick="document.getElementById('clubReturningModal').classList.remove('open')" aria-label="Close">&times;</button>
          <button class="clubBack clubBackIcon" type="button" onclick="backToClubWelcome()" aria-label="Back" title="Back">&larr;</button><h3 id="clubReturningTitle">Welcome back.</h3>
          <p class="clubStepCopy">Please enter your passcode.</p>
          <div id="clubReturningCredentials"><div class="clubField clubReturningPasswordField"><label for="clubReturningPassword">Passcode</label><div class="clubReturningPasswordEntry"><input id="clubReturningPassword" class="control" type="password" autocomplete="current-password" placeholder="Enter your passcode"><button id="clubReturningSubmit" class="btn gold clubMemberContinue" type="button" onclick="submitReturningMember()" disabled aria-label="Continue to enter the club" title="Continue to enter the club"><span class="clubContinueKey" aria-hidden="true"></span><span class="clubContinueArrow" aria-hidden="true">&gt;</span></button></div></div><p id="clubReturningStatus" class="clubFormStatus" aria-live="polite"></p><button class="btn gold clubReturningGlyph" type="button" onclick="openReturningGlyph()">Use glyph to log in instead</button></div>
        </div>
      </div>
      <div id="clubCreateModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="clubCreateTitle">
        <div class="modal clubModal clubStep"><button class="modalClose" type="button" onclick="document.getElementById('clubCreateModal').classList.remove('open')" aria-label="Close">&times;</button>
          <button class="clubBack clubBackIcon" type="button" onclick="backToClubWelcome()" aria-label="Back" title="Back">&larr;</button><div class="eyebrow">New member</div><h3 id="clubCreateTitle">Create your BCDKC ID.</h3>
          <p class="clubStepCopy">Your ID is unique and used to sign in. Your display name can be anything you like.</p>
          <div class="clubField"><label for="clubCreateId">BCDKC ID</label><input id="clubCreateId" class="control" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Choose an account name"><small>If it is taken, we&rsquo;ll offer close alternatives.</small><div id="clubSuggestions" class="clubSuggestions"></div></div>
          <div class="clubField"><label for="clubCreateDisplay">Display name <span aria-hidden="true">&middot;</span> optional</label><input id="clubCreateDisplay" class="control" maxlength="40" autocomplete="nickname" placeholder="What people see in the club"><small>Display names do not need to be unique.</small></div>
          <div class="clubPasswordLegend">Choose a password style</div><div class="clubPasswordModes"><button class="clubPasswordMode active" data-mode="regular" type="button" onclick="setClubPasswordMode('regular')">Regular password</button><button class="clubPasswordMode" data-mode="glyph" type="button" onclick="setClubPasswordMode('glyph')">Four-point glyph</button></div>
          <div id="clubRegularPasswordPanel" class="clubPasswordPanel"><div class="clubField"><label for="clubCreatePassword">Password</label><input id="clubCreatePassword" class="control" type="password" maxlength="13" autocomplete="new-password" placeholder="Up to 13 characters"><small>No special rules. Maximum 13 characters; leave it blank for ID-only entry.</small></div><div class="clubField"><label for="clubCreatePasswordAgain">Enter it again</label><input id="clubCreatePasswordAgain" class="control" type="password" maxlength="13" autocomplete="new-password" placeholder="Repeat your password"></div></div>
          <div id="clubGlyphPasswordPanel" class="clubPasswordPanel" hidden><div class="clubGlyphReady"><div><strong id="clubGlyphReadyLabel">No glyph selected yet</strong><button id="clubGlyphReadyNotes" class="clubGlyphNotes" type="button" onpointerdown="showGlyphNumbers()" onclick="showGlyphNumbers()" aria-label="No glyph selected" aria-pressed="false" disabled>○ ○ ○ ○</button></div><button id="clubGlyphActionButton" class="btn ghost small" type="button" onclick="openCreateGlyph()">Create glyph</button></div></div>
          <p id="clubCreateStatus" class="clubFormStatus" aria-live="polite"></p><div class="modalActions"><button class="btn ghost" type="button" onclick="backToClubWelcome()">Back</button><button id="clubCreateSubmit" class="btn gold" type="button" onclick="submitNewMember()">Join the Club</button></div>
        </div>
      </div>
      <div id="glyphPasswordModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="glyphTitle">
        <div class="modal glyphModal"><button class="modalClose" type="button" onclick="closeGlyphPassword()" aria-label="Close glyph password">&times;</button><h3 id="glyphTitle">Create your glyph</h3><div id="glyphPrompt" class="glyphPrompt">Touch 4 points</div>
          <div class="glyphSequence" aria-live="polite">${[0, 1, 2, 3].map(() => '<span class="glyphSlot">·</span>').join('')}</div>
          <div id="glyphStage" class="glyphStage"><svg class="glyphGeometry" viewBox="0 0 320 300" aria-hidden="true"><defs><radialGradient id="glyphHalo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#174e70" stop-opacity=".18"></stop><stop offset=".58" stop-color="#08263a" stop-opacity=".08"></stop><stop offset="1" stop-color="#020608" stop-opacity="0"></stop></radialGradient></defs><circle class="glyphField" cx="160" cy="150" r="142"></circle><circle class="glyphOrbit" cx="160" cy="150" r="126"></circle><polygon class="glyphTriangle first" points="160,21 272,216 48,216"></polygon><polygon class="glyphTriangle second" points="160,279 48,84 272,84"></polygon><circle class="glyphInnerOrbit" cx="160" cy="150" r="57"></circle><g id="glyphLines"></g></svg><div class="glyphCore" aria-hidden="true"><svg class="glyphCoreIcon" viewBox="0 0 64 64" focusable="false"><g class="glyphCoreMark"><path class="glyphMic" d="M32 14a5 5 0 0 0-5 5v13a5 5 0 0 0 10 0V19a5 5 0 0 0-5-5Zm-8 15v3a8 8 0 0 0 16 0v-3m-8 11v7m-6 0h12"/><path class="glyphNoteLeft" d="M17 20v13m0-10 8-2v11m-8 1.5a3.5 2.7 0 1 0 0 5.4 3.5 2.7 0 0 0 0-5.4Zm8-3.5a3.5 2.7 0 1 0 0 5.4 3.5 2.7 0 0 0 0-5.4Z"/><path class="glyphNoteRight" d="M47 20v13m0-10-8-2v11m8 1.5a3.5 2.7 0 1 1 0 5.4 3.5 2.7 0 0 1 0-5.4Zm-8-3.5a3.5 2.7 0 1 1 0 5.4 3.5 2.7 0 0 1 0-5.4Z"/></g></svg></div>
            ${POINTS.map((point, value) => `<button class="glyphPoint" style="left:${point.left}%;top:${point.top}%;--point-index:${value}" data-value="${value}" type="button" onclick="pressGlyphPoint(${value})" aria-label="Glyph point ${value}"><span class="glyphNote" aria-hidden="true">${MUSIC_NOTES[value]}</span><span class="glyphDigit">${value}</span></button>`).join('')}
          </div><p id="glyphStatus" class="glyphStatus" aria-live="polite"></p><button id="glyphUndoButton" class="glyphUndo" type="button" onclick="undoGlyphPoint()" aria-label="Undo last glyph point" title="Undo last point" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7M8 12h9"/></svg></button>
        </div>
      </div>`);

    document.getElementById('clubWelcomeMemberId')?.addEventListener('input', () => { syncWelcomeContinueState(); setWelcomeHint(); });
    document.getElementById('clubWelcomeMemberId')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) window.continueWelcomeMember(); });
    document.getElementById('clubReturningPassword')?.addEventListener('input', syncReturningSubmitState);
    document.getElementById('clubReturningPassword')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) window.submitReturningMember(); });
    document.getElementById('clubCreatePasswordAgain')?.addEventListener('keydown', event => { if (event.key === 'Enter') window.submitNewMember(); });
    ['clubWelcomeModal', 'clubGateModal', 'clubReturningModal', 'clubCreateModal', 'glyphPasswordModal'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', event => { if (event.target.id === id) setModalOpen(id, false); });
    });
  }

  window.updateBadges = function () {
    const result = nativeUpdateBadges?.apply(this, arguments);
    syncGuestUi();
    return result;
  };
  window.translateApplication = function () {
    const result = nativeTranslateApplication?.apply(this, arguments);
    syncGuestUi();
    return result;
  };
  window.confirmLogout = function () {
    const result = nativeConfirmLogout?.apply(this, arguments);
    pendingMemberAction = null;
    requestAnimationFrame(syncGuestUi);
    return result;
  };

  document.addEventListener('click', event => {
    if (signedInMember()) return;
    if (event.target.closest('#profileTab')) {
      event.preventDefault(); event.stopImmediatePropagation();
      window.openClubWelcome(true);
      return;
    }
    if (event.target.closest('#heroChatButton,.tab[data-tab="chat"]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      window.openClubFeatureGate('chat');
    }
  }, true);

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMembershipModals();
  });
  window.addEventListener('resize', syncVisualViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncVisualViewport, { passive: true });
  document.addEventListener('focusin', event => {
    if (!event.target.matches?.('.clubModal input, .clubModal textarea, .clubModal select')) return;
    requestAnimationFrame(keepFocusedClubFieldVisible);
    setTimeout(keepFocusedClubFieldVisible, 120);
    setTimeout(keepFocusedClubFieldVisible, 300);
  });

  function initializeMembershipFlow() {
    syncVisualViewport();
    const oldGuest = currentUser?.();
    if (oldGuest?.guest) {
      state.currentUserId = null;
      state.users = (state.users || []).filter(user => !user.guest);
      saveState();
    }
    const landingButton = document.querySelector('#landing .landingActions .btn');
    if (landingButton) { landingButton.textContent = 'Open the Door'; landingButton.setAttribute('onclick', 'enterSite()'); }
    document.getElementById('guestLoginBtn')?.remove();
    document.getElementById('loginModal')?.classList.remove('open');
    installMembershipUi();
    syncGuestUi();
    const profileTab = document.getElementById('profileTab');
    if (profileTab) new MutationObserver(syncGuestUi).observe(profileTab, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['hidden'] });
    const hero = document.querySelector('[data-view="songbook"] .heroCard');
    if (hero) new MutationObserver(() => requestAnimationFrame(syncGuestUi)).observe(hero, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initializeMembershipFlow);
  else initializeMembershipFlow();
})();
