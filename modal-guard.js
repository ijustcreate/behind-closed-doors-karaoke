(function () {
  'use strict';

  const shell = document.querySelector('.shell');
  const landing = document.getElementById('landing');
  let guardInertedShell = false;
  let guardInertedLanding = false;

  function openModals() {
    return [...document.querySelectorAll('.modalWrap.open')];
  }

  function syncModalGuard() {
    const hasOpenModal = openModals().length > 0;
    document.body.classList.toggle('modal-open', hasOpenModal);

    if (hasOpenModal) {
      if (shell && !shell.hasAttribute('inert')) {
        shell.setAttribute('inert', '');
        shell.setAttribute('aria-hidden', 'true');
        guardInertedShell = true;
      }
      if (landing && !landing.hasAttribute('inert')) {
        landing.setAttribute('inert', '');
        landing.setAttribute('aria-hidden', 'true');
        guardInertedLanding = true;
      }
      return;
    }

    if (guardInertedShell && shell) {
      shell.removeAttribute('inert');
      shell.removeAttribute('aria-hidden');
      guardInertedShell = false;
    }
    if (guardInertedLanding && landing) {
      landing.removeAttribute('inert');
      landing.removeAttribute('aria-hidden');
      guardInertedLanding = false;
    }
  }

  document.head.insertAdjacentHTML('beforeend', `<style id="modal-guard-styles">
    .modalWrap{pointer-events:none}
    .modalWrap.open{z-index:2000!important;pointer-events:auto!important;touch-action:pan-y;overscroll-behavior:contain}
    .modalWrap.open .modal{pointer-events:auto;touch-action:pan-y}
    html:has(body.modal-open),body.modal-open{overflow:hidden!important;overscroll-behavior:none}
    body.modal-open .shell,body.modal-open #landing{pointer-events:none!important;user-select:none}
  </style>`);

  new MutationObserver(syncModalGuard).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  syncModalGuard();
})();
