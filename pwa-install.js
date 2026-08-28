if (!document.getElementById('bcd-info-script')) {
  const bcdInfoScript = document.createElement('script');
  bcdInfoScript.id = 'bcd-info-script';
  bcdInfoScript.src = 'bcd-info.js?v=20260830';
  document.head.append(bcdInfoScript);
}

(function () {
  'use strict';

  let deferredPrompt = null;
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

  async function restoreCookieSession() {
    const username = profileCookie();
    if (!username || currentUser?.()) return;
    try {
      const result = await sharedProfile(username);
      // Password-protected accounts deliberately require the password again.
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

  window.addEventListener('DOMContentLoaded', () => {
    connectProfileCookie();
    rememberProfile(currentUser?.());
    applyStandaloneLayout();
    connectUnreadBadge();
    createModal();
    if ('serviceWorker' in navigator && canInstallPwa()) {
      navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed.', error));
    }
    ensureInstallButton();
    restoreCookieSession();
    new MutationObserver(ensureInstallButton).observe(document.getElementById('profileView'), { childList: true, subtree: true });
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeGuidance(); });
})();
