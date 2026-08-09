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
  let createPasswordMode = 'regular';
  let createdGlyph = '';
  let glyphSession = null;
  let glyphFirstEntry = '';

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
      const label = member ? copyFor(CHAT_LABELS) : copyFor(JOIN_CHAT_LABELS);
      if (!heroButton.textContent.trim().startsWith(label)) heroButton.textContent = label;
      heroButton.classList.toggle('guestChatButton', !member);
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
    setModalOpen('clubWelcomeModal', true);
  };

  window.closeClubWelcome = function () {
    setModalOpen('clubWelcomeModal', false);
  };

  window.openLogin = function () {
    window.openClubWelcome(true);
  };

  window.openClubFeatureGate = function (feature = 'feature', itemId = '') {
    const title = document.getElementById('clubGateTitle');
    const copy = document.getElementById('clubGateCopy');
    const messages = {
      favorite: ['Save it to your favorites', 'Join the Club to access this feature.'],
      request: ['Request through the app', 'Join the Club to request songs through the app while Karaoke Host Mode is on.'],
      chat: ['Join the Club to Chat', 'Club members can say hello, share pictures, and join the room conversation.'],
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
    const id = document.getElementById('clubReturningId');
    const password = document.getElementById('clubReturningPassword');
    const credentials = document.getElementById('clubReturningCredentials');
    const title = document.getElementById('clubReturningTitle');
    const button = document.getElementById('clubReturningSubmit');
    if (id) { id.value = ''; id.disabled = false; }
    if (password) password.value = '';
    if (credentials) credentials.hidden = true;
    if (title) title.textContent = 'Welcome back.';
    if (button) button.textContent = 'Continue';
    setStatus('clubReturningStatus', '');
  }

  window.showReturningMember = function () {
    closeMembershipModals();
    resetReturningForm();
    setModalOpen('clubReturningModal', true);
    setTimeout(() => document.getElementById('clubReturningId')?.focus(), 40);
  };

  window.backToClubWelcome = function () {
    closeMembershipModals();
    setModalOpen('clubWelcomeModal', true);
  };

  window.submitReturningMember = async function () {
    const idField = document.getElementById('clubReturningId');
    const passwordField = document.getElementById('clubReturningPassword');
    const credentialPanel = document.getElementById('clubReturningCredentials');
    const button = document.getElementById('clubReturningSubmit');
    if (!credentialPanel?.hidden) {
      const password = passwordField?.value || '';
      if (!password) { setStatus('clubReturningStatus', 'Enter your password or choose the glyph password.'); passwordField?.focus(); return; }
      await signInWithPassword(password, button);
      return;
    }
    const id = idField?.value.trim() || '';
    if (!id) { setStatus('clubReturningStatus', 'Enter your BCDKC ID.'); idField?.focus(); return; }
    setStatus('clubReturningStatus', 'Checking the membership book…');
    button?.classList.add('clubBusy');
    try {
      const result = await profileAction({ action: 'lookup_profile', username: id });
      if (!result.found) {
        setStatus('clubReturningStatus', 'That BCDKC ID was not found. Check the spelling or create a new membership.');
        return;
      }
      returningId = result.profile.username;
      if (!result.requiresPassword) {
        finishMembership(result.profile, false);
        return;
      }
      idField.disabled = true;
      credentialPanel.hidden = false;
      document.getElementById('clubReturningTitle').textContent = `Welcome back, ${result.profile.name}.`;
      button.textContent = 'Sign in';
      setStatus('clubReturningStatus', 'Enter your password, or use your four-point glyph.');
      setTimeout(() => passwordField?.focus(), 20);
    } catch (error) {
      setStatus('clubReturningStatus', error.message);
    } finally {
      button?.classList.remove('clubBusy');
    }
  };

  async function signInWithPassword(password, button) {
    button?.classList.add('clubBusy');
    setStatus('clubReturningStatus', 'Opening the door…');
    try {
      const result = await sharedProfile(returningId, await hashPassword(password));
      finishMembership(result.profile, true);
    } catch (error) {
      setStatus('clubReturningStatus', error.message || 'That password did not match.');
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
    if (notes) notes.textContent = createdGlyph ? [...createdGlyph].map(value => MUSIC_NOTES[+value]).join(' ') : '○ ○ ○ ○';
    if (label) label.textContent = createdGlyph ? 'Glyph password ready' : 'No glyph selected yet';
  }

  window.submitNewMember = async function () {
    const idField = document.getElementById('clubCreateId');
    const displayField = document.getElementById('clubCreateDisplay');
    const button = document.getElementById('clubCreateSubmit');
    const username = idField?.value.trim() || '';
    const displayName = displayField?.value.trim() || username;
    let passwordHash = null;
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
      passwordHash = await hashPassword(`glyph:${createdGlyph}`);
    }
    button?.classList.add('clubBusy');
    setStatus('clubCreateStatus', 'Adding your name to the club book…');
    try {
      const result = await profileAction({ action: 'create_profile', username, displayName, passwordHash });
      finishMembership(result.profile, !!passwordHash);
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

  function finishMembership(profile, protectedProfile) {
    const user = rememberSharedProfile(profile, protectedProfile);
    user.guest = false;
    user.remoteProfile = true;
    user.passwordHash = protectedProfile ? 'REMOTE' : null;
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
      line.setAttribute('x1', POINTS[from].x); line.setAttribute('y1', POINTS[from].y);
      line.setAttribute('x2', POINTS[to].x); line.setAttribute('y2', POINTS[to].y);
      lines?.append(line);
    }
    const accept = document.getElementById('glyphAcceptButton');
    if (accept) accept.disabled = values.length !== 4;
  }

  function resetGlyphValues() {
    if (!glyphSession) return;
    glyphSession.values = [];
    renderGlyph();
  }

  function configureGlyphPhase(kind) {
    const title = document.getElementById('glyphTitle');
    const prompt = document.getElementById('glyphPrompt');
    const accept = document.getElementById('glyphAcceptButton');
    glyphSession = { kind, values: [] };
    if (kind === 'create-first') {
      title.textContent = 'Create your glyph'; prompt.textContent = 'Touch 4 points'; accept.textContent = 'Accept glyph';
    } else if (kind === 'create-confirm') {
      title.textContent = 'Repeat your glyph'; prompt.textContent = 'Touch the same 4 points again'; accept.textContent = 'Confirm glyph';
    } else {
      title.textContent = 'Enter your glyph'; prompt.textContent = 'Touch your 4 points'; accept.textContent = 'Open the door';
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
    if (!glyphSession || glyphSession.values.length >= 4) return;
    glyphSession.values.push(String(value));
    renderGlyph();
    if (navigator.vibrate) navigator.vibrate(8);
  };

  window.acceptGlyph = async function () {
    if (!glyphSession || glyphSession.values.length !== 4) return;
    const sequence = glyphSession.values.join('');
    if (glyphSession.kind === 'create-first') {
      glyphFirstEntry = sequence;
      configureGlyphPhase('create-confirm');
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
      setModalOpen('glyphPasswordModal', false);
      setModalOpen('clubCreateModal', true);
      updateGlyphReady();
      setStatus('clubCreateStatus', 'Your glyph password is confirmed.', true);
      return;
    }
    const accept = document.getElementById('glyphAcceptButton');
    accept?.classList.add('clubBusy');
    const status = document.getElementById('glyphStatus');
    status.textContent = 'Reading the glyph…';
    status.classList.remove('error');
    try {
      const result = await sharedProfile(returningId, await hashPassword(`glyph:${sequence}`));
      finishMembership(result.profile, true);
    } catch (_) {
      status.textContent = 'That glyph was not right. Try again.';
      status.classList.add('error');
      document.getElementById('glyphStage')?.classList.add('wrong');
      setTimeout(() => { document.getElementById('glyphStage')?.classList.remove('wrong'); resetGlyphValues(); }, 430);
    } finally {
      accept?.classList.remove('clubBusy');
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
            <p class="clubWelcomeCopy">Come in as a returning member, or make a free Club Membership ID in a few quick steps.</p>
            <div class="clubChoiceGrid"><button class="btn ghost" type="button" onclick="showReturningMember()">Returning Member</button><button class="btn gold" type="button" onclick="showNewMember()">New Member</button></div>
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
        <div class="modal clubModal clubStep"><button class="modalClose" type="button" onclick="document.getElementById('clubReturningModal').classList.remove('open')" aria-label="Close">&times;</button>
          <button class="clubBack" type="button" onclick="backToClubWelcome()">&larr; Membership choices</button><div class="eyebrow">Returning member</div><h3 id="clubReturningTitle">Welcome back.</h3>
          <p class="clubStepCopy">Enter the unique BCDKC ID you use to sign in.</p>
          <div class="clubField"><label for="clubReturningId">BCDKC ID</label><input id="clubReturningId" class="control" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Your account name"></div>
          <div id="clubReturningCredentials" hidden><div class="clubField"><label for="clubReturningPassword">Password</label><input id="clubReturningPassword" class="control" type="password" autocomplete="current-password" placeholder="Your password"></div><button class="btn ghost small" type="button" onclick="openReturningGlyph()">Use my glyph password</button></div>
          <p id="clubReturningStatus" class="clubFormStatus" aria-live="polite"></p><div class="modalActions"><button class="btn ghost" type="button" onclick="backToClubWelcome()">Back</button><button id="clubReturningSubmit" class="btn gold" type="button" onclick="submitReturningMember()">Continue</button></div>
        </div>
      </div>
      <div id="clubCreateModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="clubCreateTitle">
        <div class="modal clubModal clubStep"><button class="modalClose" type="button" onclick="document.getElementById('clubCreateModal').classList.remove('open')" aria-label="Close">&times;</button>
          <button class="clubBack" type="button" onclick="backToClubWelcome()">&larr; Membership choices</button><div class="eyebrow">New member</div><h3 id="clubCreateTitle">Create your BCDKC ID.</h3>
          <p class="clubStepCopy">Your ID is unique and used to sign in. Your display name can be anything you like.</p>
          <div class="clubField"><label for="clubCreateId">BCDKC ID</label><input id="clubCreateId" class="control" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Choose an account name"><small>If it is taken, we&rsquo;ll offer close alternatives.</small><div id="clubSuggestions" class="clubSuggestions"></div></div>
          <div class="clubField"><label for="clubCreateDisplay">Display name <span aria-hidden="true">&middot;</span> optional</label><input id="clubCreateDisplay" class="control" maxlength="40" autocomplete="nickname" placeholder="What people see in the club"><small>Display names do not need to be unique.</small></div>
          <div class="clubPasswordLegend">Choose a password style</div><div class="clubPasswordModes"><button class="clubPasswordMode active" data-mode="regular" type="button" onclick="setClubPasswordMode('regular')">Regular password</button><button class="clubPasswordMode" data-mode="glyph" type="button" onclick="setClubPasswordMode('glyph')">Four-point glyph</button></div>
          <div id="clubRegularPasswordPanel" class="clubPasswordPanel"><div class="clubField"><label for="clubCreatePassword">Password</label><input id="clubCreatePassword" class="control" type="password" maxlength="13" autocomplete="new-password" placeholder="Up to 13 characters"><small>No special rules. Maximum 13 characters; leave it blank for ID-only entry.</small></div><div class="clubField"><label for="clubCreatePasswordAgain">Enter it again</label><input id="clubCreatePasswordAgain" class="control" type="password" maxlength="13" autocomplete="new-password" placeholder="Repeat your password"></div></div>
          <div id="clubGlyphPasswordPanel" class="clubPasswordPanel" hidden><div class="clubGlyphReady"><div><strong id="clubGlyphReadyLabel">No glyph selected yet</strong><div id="clubGlyphReadyNotes" class="clubGlyphNotes">○ ○ ○ ○</div></div><button class="btn ghost small" type="button" onclick="openCreateGlyph()">Create glyph</button></div></div>
          <p id="clubCreateStatus" class="clubFormStatus" aria-live="polite"></p><div class="modalActions"><button class="btn ghost" type="button" onclick="backToClubWelcome()">Back</button><button id="clubCreateSubmit" class="btn gold" type="button" onclick="submitNewMember()">Join the Club</button></div>
        </div>
      </div>
      <div id="glyphPasswordModal" class="modalWrap" role="dialog" aria-modal="true" aria-labelledby="glyphTitle">
        <div class="modal glyphModal"><button class="modalClose" type="button" onclick="closeGlyphPassword()" aria-label="Close glyph password">&times;</button><div class="eyebrow">BCDKC glyph password</div><h3 id="glyphTitle">Create your glyph</h3><div id="glyphPrompt" class="glyphPrompt">Touch 4 points</div>
          <div class="glyphSequence" aria-live="polite">${[0, 1, 2, 3].map(() => '<span class="glyphSlot">·</span>').join('')}</div>
          <div id="glyphStage" class="glyphStage"><svg class="glyphGeometry" viewBox="0 0 320 300" aria-hidden="true"><defs><radialGradient id="glyphHalo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#174e70" stop-opacity=".18"></stop><stop offset=".58" stop-color="#08263a" stop-opacity=".08"></stop><stop offset="1" stop-color="#020608" stop-opacity="0"></stop></radialGradient></defs><circle class="glyphField" cx="160" cy="150" r="142"></circle><circle class="glyphOrbit" cx="160" cy="150" r="126"></circle><polygon class="glyphTriangle first" points="160,21 272,216 48,216"></polygon><polygon class="glyphTriangle second" points="160,279 48,84 272,84"></polygon><circle class="glyphInnerOrbit" cx="160" cy="150" r="57"></circle><g id="glyphLines"></g></svg><div class="glyphCore" aria-hidden="true"></div>
            ${POINTS.map((point, value) => `<button class="glyphPoint" style="left:${point.left}%;top:${point.top}%;--point-index:${value}" data-value="${value}" type="button" onclick="pressGlyphPoint(${value})" aria-label="Glyph point ${value}"><span class="glyphNote" aria-hidden="true">${MUSIC_NOTES[value]}</span><span class="glyphDigit">${value}</span></button>`).join('')}
          </div><p id="glyphStatus" class="glyphStatus" aria-live="polite"></p><div class="modalActions glyphActions"><button class="btn ghost" type="button" onclick="closeGlyphPassword()">Cancel</button><button id="glyphAcceptButton" class="btn gold" type="button" onclick="acceptGlyph()" disabled>Accept glyph</button></div>
        </div>
      </div>`);

    document.getElementById('clubReturningId')?.addEventListener('keydown', event => { if (event.key === 'Enter') window.submitReturningMember(); });
    document.getElementById('clubReturningPassword')?.addEventListener('keydown', event => { if (event.key === 'Enter') window.submitReturningMember(); });
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
