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
  const canInstallPwa = () => window.isSecureContext || location.hostname === 'localhost';
  const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function installedState() {
    document.querySelectorAll(installSelector).forEach(button => {
      button.textContent = 'BCDKC Installed';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Behind Closed Doors Karaoke Club is installed.';
    });
  }

  function ensureInstallButton() {
    if (!currentUser?.() || currentUser().guest) return;
    const actions = document.querySelector('#profileView .profileActions');
    if (!actions || actions.querySelector(installSelector)) return;
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
    createModal();
    if ('serviceWorker' in navigator && canInstallPwa()) {
      navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed.', error));
    }
    ensureInstallButton();
    new MutationObserver(ensureInstallButton).observe(document.getElementById('profileView'), { childList: true, subtree: true });
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeGuidance(); });
})();
