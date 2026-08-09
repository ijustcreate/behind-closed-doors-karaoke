(function () {
  'use strict';

  const identityCopy = {
    en: ['Display name', 'Account name'], es: ['Nombre visible', 'Nombre de cuenta'],
    ko: ['표시 이름', '계정 이름'], zh: ['显示名称', '账户名'],
    ja: ['表示名', 'アカウント名'], fr: ['Nom affiché', 'Nom du compte'],
    it: ['Nome visualizzato', 'Nome account'], ru: ['Отображаемое имя', 'Имя аккаунта'],
    tl: ['Display name', 'Account name']
  };

  function normalizeAchievementShelf() {
    let shelf = document.getElementById('achievementShelf');
    if (!shelf) return;
    if (!shelf.matches('details')) {
      const nested = shelf.querySelector(':scope > details');
      const details = document.createElement('details');
      details.id = 'achievementShelf';
      details.open = nested ? nested.open : true;
      details.append(...(nested ? [...nested.childNodes] : [...shelf.childNodes]));
      shelf.replaceWith(details);
      shelf = details;
    }
    shelf.className = 'profileBox profileSection accountSection achievements';
    shelf.querySelector(':scope > summary')?.classList.add('sectionHead');
  }

  function syncAccountUi() {
    const user = currentUser?.();
    const profile = document.getElementById('profileView');
    if (!profile || !user || user.guest) return;

    const requestsEnabled = hostModeEnabled();
    document.body.classList.toggle('account-host-mode', requestsEnabled);
    profile.querySelectorAll('button[onclick^="requestSong"], .historyRequest').forEach(button => {
      button.hidden = !requestsEnabled;
      button.setAttribute('aria-hidden', String(!requestsEnabled));
    });

    const name = profile.querySelector('.profileBarName');
    if (name) {
      const copy = identityCopy[user.language || 'en'] || identityCopy.en;
      const identity = `<span class="profileIdentityLabel">${esc(copy[0])}</span><strong>${esc(user.name)}</strong><span class="profileAccountName">${esc(copy[1])}: ${esc(user.username || user.accountName || user.name)}</span>`;
      if (name.innerHTML !== identity) name.innerHTML = identity;
    }
    normalizeAchievementShelf();
  }

  const priorRenderProfile = window.renderProfile;
  window.renderProfile = function () {
    const result = priorRenderProfile.apply(this, arguments);
    requestAnimationFrame(syncAccountUi);
    setTimeout(syncAccountUi, 80);
    return result;
  };

  const priorLoadAchievements = window.loadAchievements;
  window.loadAchievements = async function () {
    const result = await priorLoadAchievements.apply(this, arguments);
    syncAccountUi();
    return result;
  };

  const priorSetHostMode = window.setHostMode;
  window.setHostMode = function () {
    const result = priorSetHostMode.apply(this, arguments);
    if (currentUser() && !currentUser().guest) renderProfile();
    else syncAccountUi();
    return result;
  };

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', `<style>
      body:not(.account-host-mode) #profileView button[onclick^="requestSong"],
      body:not(.account-host-mode) #profileView .historyRequest{display:none!important}
      #profileView .accountSection{padding:0!important}
      #profileView .accountSection>summary{min-height:56px!important;margin:0!important;padding:9px 12px!important;box-sizing:border-box!important;align-items:center!important}
      #profileView .accountSection>summary>div:first-child{min-width:0;text-align:left!important}
      #profileView .accountSection>summary h2{margin:0!important;font-size:18px!important;line-height:1.15!important}
      #profileView .accountSection>summary p{margin:2px 0 0!important;line-height:1.2!important}
      #profileView #achievementShelf>summary .achievementListButton{margin-left:auto!important;margin-right:8px!important}
      @media(max-width:620px){#profileView .accountSection>summary{min-height:52px!important;padding:8px 10px!important}#profileView .accountSection>summary h2{font-size:18px!important}}
    </style>`);
    syncAccountUi();
    const profile = document.getElementById('profileView');
    if (profile) new MutationObserver(() => requestAnimationFrame(syncAccountUi)).observe(profile, { childList: true, subtree: true });
  });
})();
