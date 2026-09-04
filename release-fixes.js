(function () {
  'use strict';

  const ROOM_SETTINGS_POLL_MS = 15000;
  const CHATBOT_MENU_MARKER = /^\[\[BCD_CHATBOT:(ON|OFF)\]\]\s*/;
  let roomSettingsWriteInFlight = false;

  function chatbotValueFromMenu(menu) {
    const match = String(menu?.subheader || '').match(CHATBOT_MENU_MARKER);
    return match ? match[1] === 'ON' : null;
  }

  async function legacyChatbotSetting() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/karaoke-profile`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_active_menu' })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Chatbot setting unavailable');
    return { enabled: chatbotValueFromMenu(result.menu), menu: result.menu };
  }

  function menuWithChatbotSetting(menu, enabled) {
    const humanSubheader = String(menu?.subheader || '').replace(CHATBOT_MENU_MARKER, '');
    return { ...menu, subheader: `[[BCD_CHATBOT:${enabled ? 'ON' : 'OFF'}]]${humanSubheader}` };
  }

  function lanternNightKey() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(Date.now() - 5 * 60 * 60 * 1000));
  }

  function lanternScheduledOn() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    const day = parts.find(part => part.type === 'weekday')?.value;
    const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
    return (['Thu', 'Fri', 'Sat'].includes(day) && hour >= 19)
      || (['Fri', 'Sat', 'Sun'].includes(day) && hour < 2);
  }

  function lanternIsOn() {
    const override = state.lanternOverride;
    return override?.key === lanternNightKey() ? !!override.on : lanternScheduledOn();
  }

  function arrangeTabs() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return;
    const ordered = ['drinks', 'songbook', 'requests', 'queue', 'profile', 'chat']
      .map(name => tabs.querySelector(`[data-tab="${name}"]`))
      .filter(Boolean);
    ordered.forEach(tab => tabs.append(tab));
  }

  function setNotification(tabName, count, label) {
    const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    const badge = document.getElementById(`${tabName === 'requests' ? 'request' : 'queue'}Badge`);
    if (!tab || !badge) return;
    const visible = count > 0;
    badge.textContent = String(count);
    badge.hidden = !visible;
    tab.classList.toggle('hasNotification', visible);
    tab.setAttribute('aria-label', visible ? `${label}, ${count} waiting` : label);
  }

  function refreshNavigation() {
    arrangeTabs();
    setNotification('requests', state.requests.filter(request => request.status === 'pending').length, 'Requests');
    setNotification('queue', state.queue.length, 'Queue');
  }

  function applyProfileAdminControl() {
    const profile = document.getElementById('profileView');
    const user = currentUser();
    if (!profile || !user || user.guest) return;

    profile.querySelectorAll('.profileActions button[onclick*="openSettings"]').forEach(button => button.remove());
    const hero = profile.querySelector('.viewHero');
    if (!hero) return;
    let button = hero.querySelector('#profileAdminSettingsButton');
    if (user.isAdmin && !button) {
      hero.insertAdjacentHTML('beforeend', '<button id="profileAdminSettingsButton" class="btn small" type="button">Admin settings</button>');
      button = hero.querySelector('#profileAdminSettingsButton');
    } else if (!user.isAdmin) {
      button?.remove();
      return;
    }

    // Bind the account launcher directly instead of relying on an inline
    // handler inside the mobile profile layout. This keeps its tap target
    // working when the profile is re-rendered by the account polish layers.
    if (button) {
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        window.openSettings();
      };
    }
  }

  function settleAchievementShelf() {
    let shelf = document.getElementById('achievementShelf');
    if (!shelf) return;
    if (!shelf.matches('details')) {
      const nested = shelf.querySelector(':scope > details');
      if (nested) {
        nested.id = 'achievementShelf';
        shelf.replaceWith(nested);
        shelf = nested;
      }
    }
    if (shelf.matches('details')) {
      shelf.classList.add('profileBox', 'profileSection', 'accountSection', 'achievements');
    }
  }

  function restoreProfilePosition(position) {
    if (position === null || activeTab !== 'profile') return;
    requestAnimationFrame(() => window.scrollTo({ top: position, behavior: 'auto' }));
  }

  function polishProfile(position = null) {
    settleAchievementShelf();
    applyProfileAdminControl();
    restoreProfilePosition(position);
  }

  function renderLanternControl() {
    const modal = document.querySelector('#settingsModal .modal');
    const status = document.getElementById('hostModeStatus');
    if (!modal || !status) return;

    const rows = [...modal.querySelectorAll('.lanternSetting')];
    let row = rows.shift();
    rows.forEach(item => item.remove());
    if (!row) {
      row = document.createElement('div');
      row.className = 'settingRow lanternSetting';
      status.insertAdjacentElement('afterend', row);
    }
    row.innerHTML = `<div><strong>Manual lantern override</strong><p>Default schedule: Thursday-Saturday, 7 PM-2 AM. Resets at 5 AM.</p></div><label class="switch"><input id="lanternManualToggle" type="checkbox" ${lanternIsOn() ? 'checked' : ''} onchange="setLanternManual(this.checked)" aria-label="Manual lantern override"><span></span></label>`;
  }

  function renderChatbotControl() {
    const modal = document.querySelector('#settingsModal .modal');
    const status = document.getElementById('hostModeStatus');
    if (!modal || !status) return;

    const rows = [...modal.querySelectorAll('.chatbotSetting')];
    let row = rows.shift();
    rows.forEach(item => item.remove());
    if (!row) {
      row = document.createElement('div');
      row.className = 'settingRow chatbotSetting';
      status.insertAdjacentElement('afterend', row);
    }
    const enabled = state.chatbotEnabled !== false;
    row.innerHTML = `<div><strong>BCD Chatbot</strong><p>${enabled ? 'On — replies only when someone speaks to @BCD.' : 'Off — the House Guide will not read or answer room chat.'}</p></div><label class="switch"><input id="chatbotEnabledToggle" type="checkbox" ${enabled ? 'checked' : ''} onchange="setChatbotEnabled(this.checked)" aria-label="BCD Chatbot"><span></span></label>`;
  }

  async function syncSharedRoomSettings() {
    if (roomSettingsWriteInFlight) return;
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/karaoke-profile`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_room_settings' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Room settings unavailable');

      let sharedChatbotEnabled = result.chatbotEnabled;
      if (typeof sharedChatbotEnabled !== 'boolean') {
        const legacy = await legacyChatbotSetting();
        sharedChatbotEnabled = legacy.enabled ?? true;
      }
      const hostModeChanged = state.karaokeHostMode !== !!result.karaokeHostMode;
      const chatbotChanged = state.chatbotEnabled !== sharedChatbotEnabled;
      const previousOverride = JSON.stringify(state.lanternOverride || null);
      state.karaokeHostMode = !!result.karaokeHostMode;
      state.chatbotEnabled = sharedChatbotEnabled;
      const remoteOverride = result.lanternOverride;
      if (remoteOverride?.key === lanternNightKey()) state.lanternOverride = remoteOverride;
      else delete state.lanternOverride;
      if (hostModeChanged || chatbotChanged || previousOverride !== JSON.stringify(state.lanternOverride || null)) saveState();
      if (hostModeChanged) {
        applyHostMode();
        if (state.karaokeHostMode) syncSharedBoard();
      }
      refreshNavigation();
      renderChatbotControl();
      renderLanternControl();
      updateSongbookLantern();
    } catch (error) {
      console.warn('Shared room settings unavailable', error);
    }
  }

  const previousUpdateBadges = window.updateBadges;
  window.updateBadges = function () {
    const result = previousUpdateBadges.apply(this, arguments);
    refreshNavigation();
    return result;
  };

  const previousApplyHostMode = window.applyHostMode;
  window.applyHostMode = function () {
    const result = previousApplyHostMode.apply(this, arguments);
    refreshNavigation();
    return result;
  };

  window.setHostMode = async function (enabled) {
    const user = currentUser();
    if (!user?.isAdmin) {
      toast('Karaoke Host Mode can only be changed by an administrator.');
      return;
    }
    const prior = state.karaokeHostMode === true;
    state.karaokeHostMode = !!enabled;
    saveState();
    applyHostMode();
    if (state.karaokeHostMode) syncSharedBoard();
    roomSettingsWriteInFlight = true;
    try {
      await adminProfileAction('set_karaoke_host_mode', { karaokeHostMode: state.karaokeHostMode });
      toast(state.karaokeHostMode ? 'Karaoke Host Mode is on for the room' : 'Karaoke Host Mode is off for the room');
    } catch (error) {
      state.karaokeHostMode = prior;
      saveState();
      applyHostMode();
      toast(error.message || 'Karaoke Host Mode could not be updated');
    } finally {
      roomSettingsWriteInFlight = false;
    }
  };

  window.setLanternManual = async function (enabled) {
    const user = currentUser();
    if (!user?.isAdmin) {
      toast('Lantern controls are available to administrators only.');
      return;
    }
    const prior = state.lanternOverride;
    state.lanternOverride = { key: lanternNightKey(), on: !!enabled };
    saveState();
    updateSongbookLantern();
    renderLanternControl();
    roomSettingsWriteInFlight = true;
    try {
      await adminProfileAction('set_lantern_override', { lanternOverride: state.lanternOverride });
      toast(enabled ? 'Lantern turned on until 5 AM' : 'Lantern turned off until 5 AM');
    } catch (error) {
      if (prior) state.lanternOverride = prior;
      else delete state.lanternOverride;
      saveState();
      updateSongbookLantern();
      renderLanternControl();
      toast(error.message || 'Lantern setting could not be updated');
    } finally {
      roomSettingsWriteInFlight = false;
    }
  };

  window.setChatbotEnabled = async function (enabled) {
    const user = currentUser();
    if (!user?.isAdmin) {
      toast('Chatbot controls are available to administrators only.');
      return;
    }
    const prior = state.chatbotEnabled !== false;
    state.chatbotEnabled = !!enabled;
    saveState();
    renderChatbotControl();
    roomSettingsWriteInFlight = true;
    try {
      try {
        await adminProfileAction('set_chatbot_enabled', { chatbotEnabled: state.chatbotEnabled });
      } catch (error) {
        // Older deployments store the same flag in the hidden portion of the
        // already permissioned active-menu record until the function update lands.
        const legacy = await legacyChatbotSetting();
        if (!legacy.menu) throw error;
        await adminProfileAction('set_active_menu', { menu: menuWithChatbotSetting(legacy.menu, state.chatbotEnabled) });
      }
      toast(state.chatbotEnabled ? 'BCD Chatbot is on' : 'BCD Chatbot is off');
    } catch (error) {
      state.chatbotEnabled = prior;
      saveState();
      renderChatbotControl();
      toast(error.message || 'Chatbot setting could not be updated');
    } finally {
      roomSettingsWriteInFlight = false;
    }
  };

  const previousOpenSettings = window.openSettings;
  window.openSettings = function () {
    const result = previousOpenSettings.apply(this, arguments);
    setTimeout(() => {
      renderChatbotControl();
      renderLanternControl();
    }, 0);
    syncSharedRoomSettings();
    return result;
  };

  window.deleteSelectedUserConfirmed = async function () {
    const select = document.getElementById('adminUserSelect');
    const button = document.querySelector('#deleteUserModal .btn.danger');
    const status = document.getElementById('adminStatus');
    if (!select?.value) return;
    const originalLabel = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Deleting...';
    }
    try {
      await adminProfileAction('delete_profile', { profileId: select.value });
      state.users = state.users.filter(user => user.id !== select.value);
      saveState();
      document.getElementById('deleteUserModal')?.classList.remove('open');
      await loadAdminProfiles();
      if (status) status.textContent = 'Singer account deleted.';
      toast('Singer account deleted');
    } catch (error) {
      if (status) status.textContent = error.message || 'Singer account could not be deleted.';
      toast(error.message || 'Singer account could not be deleted');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel || 'Yes, delete user';
      }
    }
  };

  function updateMenuEditButton() {
    const button = document.getElementById('menuEditBtn');
    if (!button) return;
    if (!menuEditing) button.textContent = 'Edit menu';
    else button.textContent = menuDirty ? 'Save menu' : 'Back';
    button.setAttribute('aria-label', button.textContent);
  }

  window.toggleMenuEdit = function () {
    const bar = document.getElementById('barMenu');
    if (menuEditing) {
      if (menuDirty) return openMenuSaveDialog();
      menuEditing = false;
      bar?.querySelectorAll('[data-admin-editable]').forEach(element => element.contentEditable = 'false');
      bar?.classList.remove('editing');
      document.querySelector('.menuPage')?.classList.remove('editing');
      renderDrinkMenu();
      renderMenuLibrary();
      updateMenuEditButton();
      return;
    }
    menuEditing = true;
    menuDirty = false;
    setMenuOpen(true);
    bar?.querySelectorAll('[data-admin-editable]').forEach(element => element.contentEditable = 'true');
    bar?.classList.add('editing');
    document.querySelector('.menuPage')?.classList.add('editing');
    renderDrinkMenu();
    renderMenuLibrary();
    requestAnimationFrame(updateMenuEditButton);
  };

  document.addEventListener('input', event => {
    if (menuEditing && event.target.closest('.menuPage, #barMenu')) {
      requestAnimationFrame(updateMenuEditButton);
    }
  }, true);

  const previousRenderProfile = window.renderProfile;
  window.renderProfile = function () {
    const position = activeTab === 'profile' ? window.scrollY : null;
    const result = previousRenderProfile.apply(this, arguments);
    requestAnimationFrame(() => polishProfile(position));
    return result;
  };

  const previousLoadAchievements = window.loadAchievements;
  window.loadAchievements = async function () {
    const position = activeTab === 'profile' ? window.scrollY : null;
    const result = await previousLoadAchievements.apply(this, arguments);
    polishProfile(position);
    return result;
  };

  function install() {
    document.head.insertAdjacentHTML('beforeend', `<style>
      #barMenu{border-top:1px solid rgba(201,162,87,.42)!important}
      .achievement:before{margin-left:8px!important}
      .tab{position:relative}
      .tab .badgeCount[hidden]{display:none!important}
      .tab.hasNotification .badgeCount{position:absolute!important;right:-3px!important;top:2px!important;min-width:16px!important;height:16px!important;padding:0 4px!important;margin:0!important;border:1px solid #d3a851!important;box-shadow:0 0 0 2px #17100c!important;font-size:9px!important;line-height:16px!important}
      #profileView .viewHero{position:relative!important;padding-right:132px!important}
      #profileAdminSettingsButton{position:absolute!important;z-index:3!important;right:12px!important;top:12px!important;margin:0!important;min-height:36px!important;pointer-events:auto!important;touch-action:manipulation!important}
      .chatbotSetting{margin-top:12px!important}
      @media(max-width:620px){
        .tab.hasNotification .badgeCount{right:-1px!important;top:0!important}
        #profileView .viewHero{padding-right:116px!important}
        #profileAdminSettingsButton{right:9px!important;top:9px!important;font-size:9px!important;padding:6px 7px!important}
        #brandName.isExpanded{font-size:clamp(11px,3.33vw,15px)!important;letter-spacing:0!important}
        #brandName.isExpanded .brandExpanded{max-width:calc(100vw - 48px)!important;letter-spacing:0!important}
        .brandrow>.brand>div:last-child{max-width:calc(100% - 60px)!important}
      }
    </style>`);
    refreshNavigation();
    updateMenuEditButton();
    polishProfile();
    syncSharedRoomSettings();
    setInterval(syncSharedRoomSettings, ROOM_SETTINGS_POLL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
