(function () {
  'use strict';

  const LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('encore-dev') === '1';
  const TUG_THRESHOLD = 285;
  const GAME_URL = window.ENCORE_ROYALE_URL || './encore-royale/dist/index.html?embed=1';
  const navigatorWithStandalone = navigator;
  const journey = { started:false, invalid:false, maxScroll:0 };
  let portal = null;
  let frame = null;
  let rawTug = 0;
  let ready = false;
  let committed = false;
  let releaseTimer = 0;
  let touchY = null;

  function isInstalled() {
    return LOCAL_PREVIEW || document.documentElement.classList.contains('pwa-standalone') || document.body?.classList.contains('pwa-standalone') || matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
  }

  function songbookVisible() {
    const view = document.querySelector('[data-view="songbook"]');
    return !!view && !view.hidden;
  }

  function fullCatalogActive() {
    const search = document.getElementById('search');
    const genre = document.getElementById('genreFilter');
    const sort = document.getElementById('sortBy');
    return songbookVisible() && !(search?.value || '').trim() && (!genre || genre.value === 'all') && (!sort || sort.value === 'title');
  }

  function atDocumentBottom() {
    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    return innerHeight + scrollY >= height - 24;
  }

  function journeyCanContinue() {
    return isInstalled() && fullCatalogActive() && journey.started && !journey.invalid;
  }

  function journeyEligible() {
    return isInstalled() && fullCatalogActive() && journey.started && !journey.invalid && atDocumentBottom();
  }

  function updateJourney() {
    if (!isInstalled() || !fullCatalogActive()) return;
    const results = document.getElementById('songResults');
    if (!results) return;
    const resultsTop = results.getBoundingClientRect().top + scrollY;
    if (scrollY <= resultsTop + 120) {
      journey.started = true;
      journey.invalid = false;
      journey.maxScroll = scrollY;
    }
    if (journey.started) journey.maxScroll = Math.max(journey.maxScroll, scrollY);
  }

  function sungSongs() {
    try {
      const user = currentUser();
      return [...new Set(state.history.filter(item => item.userId === user?.id && item.status === 'sung').map(item => songById(item.songId)?.title).filter(Boolean))];
    } catch { return []; }
  }

  function initPayload() {
    let user = null;
    try { user = currentUser(); } catch {}
    return {
      playerId: user?.id || 'installed-player',
      playerName: user?.name || 'Cole',
      sungSongs: sungSongs(),
      installed: true,
      roomId: 'backstage-lobby'
    };
  }

  function ensurePortal() {
    if (portal || !isInstalled()) return portal;
    portal = document.createElement('section');
    portal.id = 'encorePortal';
    portal.className = 'encore-portal';
    portal.setAttribute('aria-label', 'Secret Encore Royale entrance');
    portal.innerHTML = `<iframe title="Encore Royale" allow="fullscreen; gamepad" src="${GAME_URL}"></iframe><div class="encore-curtain encore-curtain-left"></div><div class="encore-curtain encore-curtain-right"></div><img class="encore-valance" src="assets/encore/curtain-valance.png" alt=""><img class="encore-portal-mark" src="assets/bcd-karaoke-logo.jpg" alt=""><div class="encore-portal-hint">There is something beneath the songbook<br>keep pulling</div><button class="encore-portal-close" type="button" aria-label="Return to BCD Karaoke">×</button>`;
    document.body.append(portal);
    frame = portal.querySelector('iframe');
    portal.querySelector('.encore-portal-close').addEventListener('click', closePortal);
    return portal;
  }

  function sendSession() {
    if (!frame?.contentWindow) return;
    let targetOrigin = '*';
    try { targetOrigin = new URL(frame.src, location.href).origin; } catch {}
    frame.contentWindow.postMessage({ type:'bcd:encore:init', payload:initPayload() }, targetOrigin);
  }

  function setTug(value) {
    rawTug = Math.max(0, value);
    const progress = 1 - Math.exp(-rawTug / 112);
    const reveal = Math.round(progress * Math.min(innerHeight * .42, 285));
    const markProgress = Math.max(0, (progress - .2) / .8);
    document.documentElement.style.setProperty('--encore-site-lift', `${Math.round(progress * 48)}px`);
    document.body.classList.toggle('encore-tugging', rawTug > 0 && !committed);
    const element = rawTug > 0 ? ensurePortal() : portal;
    if (!element) return;
    element.style.setProperty('--encore-reveal', `${reveal}px`);
    element.style.setProperty('--encore-mark-opacity', String(Math.min(.96, markProgress)));
    element.style.setProperty('--encore-mark-scale', String(.7 + markProgress * .3));
    element.style.setProperty('--encore-hint-opacity', String(Math.max(0, (progress - .45) * 1.7)));
  }

  function relaxTug() {
    if (committed || rawTug <= 0) return;
    rawTug *= .76;
    if (rawTug < .8) {
      rawTug = 0;
      setTug(0);
      return;
    }
    setTug(rawTug);
    requestAnimationFrame(relaxTug);
  }

  function scheduleRelax() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(relaxTug, 150);
  }

  function addTug(delta) {
    if (!journeyEligible() || committed || delta <= 0) return false;
    clearTimeout(releaseTimer);
    setTug(rawTug + Math.min(delta, 70) * .72);
    if (rawTug >= TUG_THRESHOLD) commitPortal();
    else scheduleRelax();
    return true;
  }

  function commitPortal(options) {
    if (committed || !isInstalled()) return;
    committed = true;
    ensurePortal();
    setTug(TUG_THRESHOLD);
    portal.classList.add('is-committed');
    document.body.classList.remove('encore-tugging');
    document.body.classList.add('encore-portal-open');
    sendSession();
    const minimumDrama = options?.instant ? 100 : 420;
    setTimeout(() => {
      if (ready) openCurtains();
      else setTimeout(openCurtains, 1800);
    }, minimumDrama);
  }

  function openCurtains() {
    if (!portal || !committed) return;
    portal.classList.add('is-ready');
    requestAnimationFrame(() => portal?.classList.add('is-opening'));
  }

  function closePortal() {
    if (!portal) return;
    frame?.contentWindow?.postMessage({ type:'bcd:encore:command', payload:{ command:'close' } }, '*');
    portal.classList.add('is-closing');
    const old = portal;
    portal = null;
    frame = null;
    ready = false;
    committed = false;
    rawTug = 0;
    document.body.classList.remove('encore-tugging', 'encore-portal-open');
    document.documentElement.style.setProperty('--encore-site-lift', '0px');
    setTimeout(() => old.remove(), 340);
  }

  function ensureAdminLauncher() {
    let launcher = document.getElementById('encoreRoyalAdminLauncher');
    let user = null;
    try { user = currentUser(); } catch {}
    const profile = document.getElementById('profileView');
    if (!isInstalled() || !profile || !user?.isAdmin || user.guest) {
      launcher?.remove();
      return;
    }
    if (launcher?.parentElement === profile) return;
    launcher?.remove();
    launcher = document.createElement('section');
    launcher.id = 'encoreRoyalAdminLauncher';
    launcher.className = 'encore-admin-launcher';
    launcher.innerHTML = `<div class="encore-admin-copy"><div class="eyebrow">Installed app · administrator preview</div><h2>Encore Royale</h2><p>Bypass the secret songbook pull and enter the isolated game build directly.</p></div><button type="button" class="btn gold encore-launch-button">Enter the arena</button>`;
    launcher.querySelector('button').addEventListener('click', () => commitPortal({ instant:true }));
    profile.append(launcher);
  }

  window.openEncoreRoyale = function () {
    if (!isInstalled()) {
      if (typeof toast === 'function') toast('Encore Royale is only available in the installed BCDKC app');
      return;
    }
    commitPortal({ instant:true });
  };
  window.closeEncoreRoyale = closePortal;
  window.render_game_to_text = function () {
    const launcherState = { mode:committed ? 'loading-game' : 'karaoke-site', installed:isInstalled(), fullCatalog:fullCatalogActive(), journeyStarted:journey.started, journeyInvalid:journey.invalid, atBottom:atDocumentBottom(), tug:Math.round(rawTug) };
    try { return frame?.contentWindow?.render_game_to_text?.() || JSON.stringify(launcherState); }
    catch { return JSON.stringify({ ...launcherState, mode:committed ? 'embedded-game' : 'karaoke-site' }); }
  };

  window.addEventListener('message', event => {
    if (!frame?.contentWindow || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === 'bcd:encore:ready') {
      ready = true;
      sendSession();
      if (committed) openCurtains();
    }
    if (event.data.type === 'bcd:encore:close') closePortal();
  });

  window.addEventListener('wheel', event => {
    if (addTug(event.deltaY)) event.preventDefault();
  }, { passive:false });
  window.addEventListener('touchstart', event => {
    // Capture before the exact bottom so one portrait swipe can flow from
    // ordinary document scrolling into the resisted secret pull.
    touchY = journeyCanContinue() ? event.touches[0]?.clientY ?? null : null;
  }, { passive:true });
  window.addEventListener('touchmove', event => {
    if (touchY === null) return;
    const nextY = event.touches[0]?.clientY;
    if (nextY === undefined) return;
    const delta = touchY - nextY;
    touchY = nextY;
    if (addTug(delta)) event.preventDefault();
  }, { passive:false });
  window.addEventListener('touchend', () => { touchY = null; if (!committed) relaxTug(); }, { passive:true });
  window.addEventListener('scroll', updateJourney, { passive:true });
  window.addEventListener('resize', () => { if (rawTug && !committed) setTug(rawTug); }, { passive:true });
  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.('.alphaButton') && journey.started) journey.invalid = true;
  }, true);
  document.addEventListener('input', event => {
    if (event.target?.matches?.('#search,#genreFilter,#sortBy')) Object.assign(journey, { started:false, invalid:false, maxScroll:0 });
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.matches?.('#genreFilter,#sortBy')) Object.assign(journey, { started:false, invalid:false, maxScroll:0 });
  }, true);
  window.addEventListener('DOMContentLoaded', () => {
    updateJourney();
    ensureAdminLauncher();
    const profile = document.getElementById('profileView');
    if (profile) new MutationObserver(() => requestAnimationFrame(ensureAdminLauncher)).observe(profile, { childList:true, subtree:true });
    if (LOCAL_PREVIEW && new URLSearchParams(location.search).get('encore-open') === '1') setTimeout(() => commitPortal({ instant:true }), 80);
  });
})();
