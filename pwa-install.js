if (!document.getElementById('bcdkc-member-touch-icon')) {
  const memberTouchIcon = document.createElement('link');
  memberTouchIcon.id = 'bcdkc-member-touch-icon';
  memberTouchIcon.rel = 'apple-touch-icon';
  memberTouchIcon.sizes = '180x180';
  memberTouchIcon.href = 'assets/bcdkc-member-icon-v3-180.png';
  document.head.append(memberTouchIcon);
}
if (!document.getElementById('bcd-info-script')) {
  const bcdInfoScript = document.createElement('script');
  bcdInfoScript.id = 'bcd-info-script';
  bcdInfoScript.src = 'bcd-info.js?v=20260830-stretched-copy';
  document.head.append(bcdInfoScript);
}

(function () {
  'use strict';

  let deferredPrompt = null;
  let serviceWorkerRegistration = null;
  let refreshRequested = false;
  let updateAvailable = false;
  let updateNoticeShown = false;
  const installSelector = '#bcdkcInstallButton';
  const profileCookieName = 'bcdkc_last_profile';
  const canInstallPwa = () => window.isSecureContext || location.hostname === 'localhost';
  const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canBadgeApp = () => isInstalled() && typeof navigator.setAppBadge === 'function';

  function applyStandaloneLayout() {
    const standalone = isInstalled();
    document.documentElement.classList.toggle('pwa-standalone', standalone);
    document.body?.classList.toggle('pwa-standalone', standalone);
    if (document.getElementById('pwa-safe-area-styles')) return;
    document.head.insertAdjacentHTML('beforeend', '<style id="pwa-safe-area-styles">html.pwa-standalone{background:#0c0907}html.pwa-standalone .topbar{padding-top:env(safe-area-inset-top,0px)}@media(display-mode:standalone){.topbar{padding-top:env(safe-area-inset-top,0px)}}</style>');
  }

  function installedState() {
    document.querySelectorAll(installSelector).forEach(button => {
      button.textContent = 'BCDKC Installed';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Behind Closed Doors Karaoke Club is installed.';
    });
    ensureRefreshButton();
  }

  function ensureRefreshButton() {
    const actions = document.querySelector('#profileView .profileActions');
    let button = document.getElementById('bcdkcRefreshButton');
    if (!isInstalled() || !actions || !updateAvailable) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'bcdkcRefreshButton';
      button.className = 'btn gold small bcdkcRefreshButton';
      button.textContent = 'Refresh App';
      button.title = 'Check for the newest BCDKC version and reopen it.';
      button.addEventListener('click', refreshInstalledApp);
      actions.append(button);
    }
  }

  function markUpdateAvailable() {
    updateAvailable = true;
    ensureRefreshButton();
    const button = document.getElementById('bcdkcRefreshButton');
    if (button) {
      button.textContent = 'Update App';
      button.title = 'A newer BCDKC version is ready. Tap to refresh.';
      button.classList.add('updateReady');
    }
    if (!updateNoticeShown) {
      updateNoticeShown = true;
      window.toast?.('A new BCDKC version is ready — tap Update App in your profile');
    }
  }

  async function refreshInstalledApp() {
    const button = document.getElementById('bcdkcRefreshButton');
    refreshRequested = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing…';
    }
    window.toast?.('Checking for the newest BCDKC…');
    try {
      if (serviceWorkerRegistration) {
        await serviceWorkerRegistration.update();
        serviceWorkerRegistration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
      const url = new URL(location.href);
      url.searchParams.set('bcd-refresh', Date.now().toString());
      location.replace(url.href);
    } catch (error) {
      console.warn('Could not complete the app refresh.', error);
      location.reload();
    }
  }

  function profileCookie() {
    const prefix = `${profileCookieName}=`;
    const item = document.cookie.split('; ').find(value => value.startsWith(prefix));
    if (!item) return null;
    try { return decodeURIComponent(item.slice(prefix.length)); }
    catch { return null; }
  }

  function rememberProfile(user) {
    const username = user?.username;
    if (!username) return;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${profileCookieName}=${encodeURIComponent(username)}; Max-Age=2592000; Path=/; SameSite=Lax${secure}`;
  }

  function forgetProfile() {
    document.cookie = `${profileCookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  function savedAdminCredential(profileId) {
    if (!profileId) return null;
    const key = `bcd-admin-${profileId}`;
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); }
    catch { return null; }
  }

  async function restoreCookieSession() {
    const username = profileCookie();
    if (!username || currentUser?.()) return;
    try {
      let result = await sharedProfile(username);
      if (result.status === 'password_required' && result.profile?.isAdmin) {
        const credential = savedAdminCredential(result.profile.id);
        if (credential) result = await sharedProfile(username, credential, credential);
      }
      if (result.status !== 'ok' || !result.profile) return;
      const user = rememberSharedProfile(result.profile, false);
      state.currentUserId = user.id;
      saveState();
      renderActive();
    } catch (error) {
      console.warn('Could not restore the saved BCDKC profile.', error);
    }
  }

  function connectProfileCookie() {
    const nativeCompleteLogin = window.completeLogin;
    if (typeof nativeCompleteLogin === 'function') {
      window.completeLogin = function (user) {
        rememberProfile(user);
        return nativeCompleteLogin.apply(this, arguments);
      };
    }
    const nativeLogout = window.logout;
    if (typeof nativeLogout === 'function') {
      window.logout = function () {
        forgetProfile();
        return nativeLogout.apply(this, arguments);
      };
    }
  }

  function unreadChatCount() {
    const user = currentUser?.();
    if (!user || activeTab === 'chat' || !Array.isArray(chatMessages)) return 0;
    const lastRead = (state.chatLastReadAt || {})[user.id] || 0;
    return chatMessages.filter(message => message.profileId !== user.id && message.createdAt > lastRead).length;
  }

  function syncAppBadge() {
    if (!canBadgeApp()) return;
    const count = unreadChatCount();
    const operation = count ? navigator.setAppBadge(Math.min(count, 99)) : navigator.clearAppBadge?.();
    Promise.resolve(operation).catch(() => {});
  }

  async function requestChatBadgePermission() {
    if (!canBadgeApp() || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      document.getElementById('bcdkcChatBadgeButton')?.remove();
      syncAppBadge();
      toast?.('Chat badge enabled');
    }
  }

  function ensureChatBadgeButton() {
    if (!canBadgeApp() || !('Notification' in window) || Notification.permission !== 'default') return;
    const actions = document.querySelector('#profileView .profileActions');
    if (!actions || document.getElementById('bcdkcChatBadgeButton')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'bcdkcChatBadgeButton';
    button.className = 'btn ghost small bcdkcInstallButton';
    button.textContent = 'Enable Chat Badge';
    button.title = 'Show unread Karaoke Chat messages on the BCDKC app icon.';
    button.addEventListener('click', requestChatBadgePermission);
    actions.append(button);
  }

  function connectUnreadBadge() {
    const nativeUpdateChatUnread = window.updateChatUnread;
    if (typeof nativeUpdateChatUnread !== 'function' || nativeUpdateChatUnread.bcdkcBadgeConnected) return;
    const updateWithAppBadge = function () {
      const result = nativeUpdateChatUnread.apply(this, arguments);
      syncAppBadge();
      return result;
    };
    updateWithAppBadge.bcdkcBadgeConnected = true;
    window.updateChatUnread = updateWithAppBadge;
    syncAppBadge();
  }

  function ensureInstallButton() {
    if (!currentUser?.() || currentUser().guest) return;
    const actions = document.querySelector('#profileView .profileActions');
    if (!actions) return;
    if (actions.querySelector(installSelector)) {
      if (isInstalled()) ensureRefreshButton();
      ensureChatBadgeButton();
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'bcdkcInstallButton';
    button.className = 'btn ghost small bcdkcInstallButton';
    button.textContent = 'Install BCDKC';
    button.title = 'Keep the club one tap away.';
    button.setAttribute('aria-label', 'Install BCDKC. Keep the club one tap away.');
    button.addEventListener('click', requestInstall);
    actions.append(button);
    if (isInstalled()) installedState();
    ensureChatBadgeButton();
  }

  function guidance() {
    if (!canInstallPwa()) return 'Open the club using its secure HTTPS address to install it.';
    if (isIos()) return 'Tap Share, then choose Add to Home Screen. If you opened the club inside another app, open it in Safari first.';
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Open the Edge menu, then choose Apps and Install this site as an app.';
    if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return 'Open the browser menu, then choose Install Behind Closed Doors Karaoke Club.';
    if (/Firefox\//.test(ua)) return 'Open your browser menu and look for Install or Add to Home Screen.';
    return 'Open your browser menu and look for an Install or Add to Home Screen option.';
  }

  function showGuidance() {
    const modal = document.getElementById('pwaInstallModal');
    if (!modal) return;
    modal.querySelector('[data-pwa-guidance]').textContent = guidance();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('[data-pwa-close]').focus();
  }

  function closeGuidance() {
    const modal = document.getElementById('pwaInstallModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function requestInstall() {
    if (isInstalled()) return installedState();
    if (!deferredPrompt) return showGuidance();
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === 'accepted') installedState();
    else ensureInstallButton();
  }

  function createModal() {
    if (document.getElementById('pwaInstallModal')) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="pwaInstallModal" class="modalWrap pwaInstallModal" role="dialog" aria-modal="true" aria-labelledby="pwaInstallTitle" aria-hidden="true"><div class="modal"><button type="button" class="modalClose" data-pwa-close aria-label="Close install instructions">×</button><div class="eyebrow">Behind Closed Doors</div><h3 id="pwaInstallTitle">Keep the club close.</h3><p data-pwa-guidance></p><div class="modalActions"><button type="button" class="btn gold" data-pwa-close>Done</button></div></div></div>');
    const modal = document.getElementById('pwaInstallModal');
    modal.querySelectorAll('[data-pwa-close]').forEach(button => button.addEventListener('click', closeGuidance));
    modal.addEventListener('click', event => { if (event.target === modal) closeGuidance(); });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    ensureInstallButton();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installedState(); });

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshRequested) location.reload();
  });

  window.addEventListener('DOMContentLoaded', () => {
    connectProfileCookie();
    rememberProfile(currentUser?.());
    applyStandaloneLayout();
    connectUnreadBadge();
    createModal();
    if ('serviceWorker' in navigator && canInstallPwa()) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
        serviceWorkerRegistration = registration;
        if (registration.waiting && navigator.serviceWorker.controller) markUpdateAvailable();
        return registration.update();
      }).catch(error => console.warn('Service worker registration failed.', error));
    }
    ensureInstallButton();
    restoreCookieSession();
    document.head.insertAdjacentHTML('beforeend', '<style>.monogram,.landingKey,.coverKey,.menuKey,.clubWelcomeMark,.clubGateIcon,.glyphCoreIcon,.bcdInfoMark{background-color:transparent!important;background-image:url("assets/bcd-key-logo-transparent.webp")!important}body:not(.member-signed-in) .brand>.monogram{filter:saturate(.66)!important}.clubContinueKey{mask-image:url("assets/bcd-key-logo-transparent.webp")!important;-webkit-mask-image:url("assets/bcd-key-logo-transparent.webp")!important}</style>');
    document.head.insertAdjacentHTML('beforeend', '<style>.brandrow:after,.aboutVenueButton{background-color:transparent!important;background-image:url("assets/bcd-question-logo-transparent.webp")!important;filter:saturate(.62) brightness(.86)}.member-signed-in .monogram{background-color:transparent!important;background-image:url("assets/bcd-karaoke-logo-transparent.webp")!important}</style>');
    const replaceLegacyKeyImages = root => root.querySelectorAll?.('img[src="assets/bcd-key-mark.svg"],img[src="assets/bcd-key-logo.jpg"]').forEach(image => { image.src = 'assets/bcd-key-logo-transparent.png'; });
    replaceLegacyKeyImages(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) replaceLegacyKeyImages(node); }))).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(ensureInstallButton).observe(document.getElementById('profileView'), { childList: true, subtree: true });
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeGuidance(); });
})();
