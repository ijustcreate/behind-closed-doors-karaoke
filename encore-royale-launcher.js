(function () {
  'use strict';

  const LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('encore-dev') === '1';
  const TUG_THRESHOLD = 285;
  const GAME_URL = window.ENCORE_ROYALE_URL || 'https://ijustcreate.github.io/bcd-kc-encore/?embed=1&from=bcd&build=1.2';
  const navigatorWithStandalone = navigator;
  const journey = { started:false, invalid:false, maxScroll:0 };
  let portal = null;
  let frame = null;
  let rawTug = 0;
  let ready = false;
  let reloadPending = false;
  let reloadTimer = 0;
  let diagnosticsOpen = false;
  let diagnosticsTimer = 0;
  let diagnosticsReport = null;
  let disposalDone = null;
  let committed = false;
  let releaseTimer = 0;
  let touchY = null;
  let suspendedSite = null;
  let suspendedAriaHidden = null;
  let suspendedInert = false;

  // The karaoke app stays loaded so returning from the battle is instant, but
  // its view is made non-interactive and skipped by paint/layout while Encore
  // owns the screen. App code can also listen for this event to pause optional
  // polling or animations without coupling the game to the site's internals.
  function suspendSite() {
    if (suspendedSite) return;
    suspendedSite = document.querySelector('body > .shell') || document.querySelector('.shell');
    if (!suspendedSite) return;
    suspendedAriaHidden = suspendedSite.getAttribute('aria-hidden');
    suspendedInert = !!suspendedSite.inert;
    suspendedSite.inert = true;
    suspendedSite.setAttribute('aria-hidden', 'true');
    document.dispatchEvent(new CustomEvent('bcd:encore:active', { detail:{ active:true } }));
  }

  function resumeSite() {
    if (!suspendedSite) return;
    suspendedSite.inert = suspendedInert;
    if (suspendedAriaHidden === null) suspendedSite.removeAttribute('aria-hidden');
    else suspendedSite.setAttribute('aria-hidden', suspendedAriaHidden);
    suspendedSite = null;
    document.dispatchEvent(new CustomEvent('bcd:encore:active', { detail:{ active:false } }));
  }

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
      playerName: typeof user?.name === 'string' && user.name.trim() ? user.name.trim().slice(0, 32) : 'Climber',
      sungSongs: sungSongs(),
      isAdmin: user?.isAdmin === true && !user?.guest,
      installed: true,
      roomId: 'encore-royal-main',
      // The game also has its own published endpoint configuration. Empty
      // means offline practice, never a peer-simulated replacement room.
      serverUrl: window.ENCORE_SERVER_URL || ''
    };
  }

  function ensurePortal() {
    if (portal || !isInstalled()) return portal;
    portal = document.createElement('section');
    portal.id = 'encorePortal';
    portal.className = 'encore-portal';
    portal.setAttribute('aria-label', 'BCDKC Encore Royal entrance');
    // Do not create the game iframe while somebody is only testing the secret
    // pull. An iframe starts its own JS, rendering, and network work as soon as
    // it is attached, so it belongs to the committed entrance only.
    portal.innerHTML = `<div class="encore-game-mount"></div><div class="encore-curtain encore-curtain-left"></div><div class="encore-curtain encore-curtain-right"></div><img class="encore-valance" src="assets/encore/curtain-valance.png" alt=""><img class="encore-portal-mark" src="assets/bcd-karaoke-logo.jpg" alt=""><div class="encore-portal-hint">There is something beneath the songbook<br>keep pulling</div><button class="encore-portal-close" type="button" aria-label="Return to BCD Karaoke">×</button><div class="encore-reload-tools"><button class="encore-reload-button" type="button">Reload Encore</button><button class="encore-diagnostics-button" type="button" aria-expanded="false">📱 Phone diagnostics</button><section class="encore-diagnostics-panel" hidden><div class="encore-diagnostics-title">PHONE DIAGNOSTICS · NO TELEMETRY</div><pre class="encore-diagnostics-output">Collecting…</pre><button class="encore-copy-diagnostics" type="button">Copy report</button></section><span class="encore-build-version" role="status" aria-live="polite">Version loading…</span></div>`;
    document.body.append(portal);
    portal.querySelector('.encore-portal-close').addEventListener('click', closePortal);
    portal.querySelector('.encore-reload-button').addEventListener('click', reloadGame);
    portal.querySelector('.encore-diagnostics-button').addEventListener('click', toggleDiagnostics);
    portal.querySelector('.encore-copy-diagnostics').addEventListener('click', copyDiagnostics);
    return portal;
  }

  function diagnosticsText(report) {
    if (!report) return 'Waiting for game…';
    const p = report.presentation || {}, c = report.costs || {}, d = report.device || {}, r = report.runtime || {}, room = report.room || {};
    return [
      `Build  v${report.version || 'unknown'} · ${r.embedded ? 'embedded' : 'direct'}`,
      `FPS    ${p.presentedFps ?? 'n/a'} presented · ${p.rafFps ?? 'n/a'} rAF`,
      `Frame  ${p.averageFrameMs ?? 'n/a'}ms avg · ${p.maxFrameMs ?? 'n/a'}ms max · ${p.maxStallMs ?? 'n/a'}ms stall`,
      `Cost   update ${c.averageUpdateMs ?? 'n/a'}ms · draw ${c.averageRenderMs ?? 'n/a'}ms`,
      `View   ${d.viewport || 'unavailable'} · screen ${d.screen || 'unavailable'} · DPR ${d.dpr ?? 'unavailable'}`,
      `Orient ${d.orientation || 'unavailable'} · ${d.platform || 'platform unavailable'}`,
      `State  ${r.visibility || 'unavailable'} · focus ${r.focused == null ? 'unavailable' : r.focused ? 'yes' : 'no'}`,
      `Render ${r.renderer || 'unavailable'} · ${r.quality || 'quality unavailable'}`,
      `Limit  ${r.touchPresentation ? 'phone throttle on' : 'phone throttle off'} · cap ${r.presentationCap ?? 'unavailable'} FPS`,
      `Room   ${room.mode || 'unavailable'} · status ${room.status || 'unavailable'} · admission ${room.admission || 'unavailable'}`,
      `Count  ${room.occupancyVerified ? `${room.players}/8 verified` : 'unavailable (not verified)'} · ${room.visibleRemotes ?? 'unavailable'} visible remotes`,
      `Assets rigs ${r.loadedRigs ?? 'unavailable'} loaded · ${Array.isArray(r.failedRigs) ? r.failedRigs.length : r.failedRigs ?? 'unavailable'} failed · images ${Array.isArray(r.failedImages) ? r.failedImages.length : r.failedImages ?? 'unavailable'} failed`,
      `Sample ${report.sampleSeconds ?? 'unavailable'}s · frame gaps >50ms ${p.droppedFrames ?? 'unavailable'}`,
      `UA     ${d.userAgent || 'unavailable'}`,
      `N/A    ${Array.isArray(report.unavailable) ? report.unavailable.join(', ') : 'unavailable browser metrics not reported'}`
    ].join('\n');
  }

  function renderDiagnostics() {
    if (!portal) return;
    portal.querySelector('.encore-diagnostics-output').textContent = diagnosticsText(diagnosticsReport);
  }

  function requestDiagnostics() {
    if (!diagnosticsOpen || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type:'bcd:encore:diagnostics:request' }, new URL(frame.src, location.href).origin);
  }

  function toggleDiagnostics() {
    if (!portal) return;
    diagnosticsOpen = !diagnosticsOpen;
    const button = portal.querySelector('.encore-diagnostics-button');
    const panel = portal.querySelector('.encore-diagnostics-panel');
    button.setAttribute('aria-expanded', String(diagnosticsOpen));
    panel.hidden = !diagnosticsOpen;
    if (diagnosticsOpen) {
      diagnosticsReport = null; renderDiagnostics(); requestDiagnostics();
      clearInterval(diagnosticsTimer); diagnosticsTimer = setInterval(requestDiagnostics, 1000);
    } else clearInterval(diagnosticsTimer);
  }

  async function copyDiagnostics() {
    const text = diagnosticsText(diagnosticsReport);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const button = portal?.querySelector('.encore-copy-diagnostics');
    if (button) { button.textContent = 'Copied'; setTimeout(() => { if (button.isConnected) button.textContent = 'Copy report'; }, 1200); }
  }

  function startGameFrame() {
    if (!portal || frame) return frame;
    const mount = portal.querySelector('.encore-game-mount');
    frame = document.createElement('iframe');
    frame.title = 'BCDKC Encore Royal';
    frame.allow = 'fullscreen; gamepad';
    // Keeping this isolated makes the game an independently deployable app and
    // prevents it from competing with BCD until the player explicitly enters.
    const url = new URL(GAME_URL, location.href);
    url.searchParams.set('fresh', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    frame.src = url.href;
    // Initialize on load too, including older builds without a ready message.
    // sendSession always targets the exact game origin.
    frame.addEventListener('load', () => sendSession(true));
    mount?.append(frame);
    return frame;
  }

  function updateReloadUI(message) {
    if (!portal) return;
    const button = portal.querySelector('.encore-reload-button');
    button.disabled = reloadPending;
    button.textContent = reloadPending ? 'Reloading…' : 'Reload Encore';
    portal.querySelector('.encore-build-version').textContent = message;
  }

  async function reloadGame() {
    if (!committed || !frame || reloadPending) return;
    reloadPending = true;
    updateReloadUI('Fetching latest…');
    const oldFrame = frame;
    const currentPortal = portal;
    // Wait briefly for presence unsubscribe before replacing the browsing
    // context. The timeout also supports older builds without shutdown ACKs.
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1500);
      disposalDone = () => { clearTimeout(timer); resolve(); };
      oldFrame.contentWindow?.postMessage({ type:'bcd:encore:command', payload:{ command:'close' } }, new URL(oldFrame.src).origin);
    });
    disposalDone = null;
    if (portal !== currentPortal || frame !== oldFrame) return;
    ready = false;
    oldFrame.src = 'about:blank';
    oldFrame.remove(); // Destroys old JS globals, loops, listeners, and sockets.
    frame = null;
    startGameFrame();
    reloadTimer = setTimeout(() => {
      reloadPending = false;
      updateReloadUI('Load timed out · retry');
    }, 45000);
  }

  function sendSession(loaded = false) {
    // Only send after navigation/load or the game readiness handshake.
    if ((!ready && !loaded) || !frame?.contentWindow) return;
    let targetOrigin;
    try { targetOrigin = new URL(frame.src, location.href).origin; } catch { return; }
    if (targetOrigin === 'null') return;
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
    startGameFrame();
    setTug(TUG_THRESHOLD);
    portal.classList.add('is-committed');
    document.body.classList.remove('encore-tugging');
    document.body.classList.add('encore-portal-open');
    suspendSite();
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
    clearTimeout(reloadTimer);
    clearInterval(diagnosticsTimer);
    disposalDone?.();
    reloadPending = false;
    diagnosticsReport = null;
    // Ask the game to dispose cleanly, then immediately navigate it away. The
    // navigation aborts its animation loop and any future realtime work even if
    // the close message is delayed or the app is being backgrounded on a phone.
    frame?.contentWindow?.postMessage({ type:'bcd:encore:command', payload:{ command:'close' } }, '*');
    if (frame) frame.src = 'about:blank';
    portal.classList.add('is-closing');
    const old = portal;
    portal = null;
    frame = null;
    ready = false;
    committed = false;
    diagnosticsOpen = false;
    rawTug = 0;
    document.body.classList.remove('encore-tugging', 'encore-portal-open');
    resumeSite();
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
    launcher.innerHTML = `<div class="encore-admin-copy"><div class="eyebrow">Installed app · administrator preview</div><h2>BCDKC Encore Royal</h2><p>Bypass the secret songbook pull and enter the live game room directly.</p></div><button type="button" class="btn gold encore-launch-button">Enter Encore Royal</button>`;
    launcher.querySelector('button').addEventListener('click', () => commitPortal({ instant:true }));
    profile.append(launcher);
  }

  window.openEncoreRoyale = function () {
    if (!isInstalled()) {
      if (typeof toast === 'function') toast('BCDKC Encore Royal is only available in the installed BCDKC app');
      return;
    }
    commitPortal({ instant:true });
  };
  window.openCelestefall = window.openEncoreRoyale;
  window.closeEncoreRoyale = closePortal;
  window.render_game_to_text = function () {
    const launcherState = { mode:committed ? 'loading-game' : 'karaoke-site', installed:isInstalled(), fullCatalog:fullCatalogActive(), journeyStarted:journey.started, journeyInvalid:journey.invalid, atBottom:atDocumentBottom(), tug:Math.round(rawTug) };
    try { return frame?.contentWindow?.render_game_to_text?.() || JSON.stringify(launcherState); }
    catch { return JSON.stringify({ ...launcherState, mode:committed ? 'embedded-game' : 'karaoke-site' }); }
  };

  window.addEventListener('message', event => {
    if (!frame?.contentWindow || event.source !== frame.contentWindow || !event.data) return;
    if (event.origin !== new URL(frame.src, location.href).origin) return;
    if (event.data.type === 'bcd:encore:disposed') disposalDone?.();
    if (event.data.type === 'bcd:encore:ready') {
      if (ready) return;
      ready = true;
      clearTimeout(reloadTimer);
      reloadPending = false;
      const version = typeof event.data.version === 'string' ? event.data.version.slice(0, 32) : '';
      updateReloadUI(version ? `v${version}` : 'Version unavailable');
      sendSession();
      if (committed) openCurtains();
    }
    if (event.data.type === 'bcd:encore:diagnostics:report' && event.data.report && typeof event.data.report === 'object') {
      diagnosticsReport = { ...event.data.report, version: typeof event.data.version === 'string' ? event.data.version.slice(0, 16) : 'unknown' };
      renderDiagnostics();
    }
    if (event.data.type === 'bcd:encore:close') closePortal();
    if (event.data.type === 'bcd:encore:event') {
      if (event.data.event === 'capture_point') window.awardAchievement?.('encore_capture');
      if (event.data.event === 'first_pk') window.awardAchievement?.('killer_note');
    }
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
  // On mobile, leaving a PWA commonly fires visibilitychange without unloading
  // the page. Tear Encore down in that case so it cannot keep consuming battery
  // or CPU in the background. Re-entering the app leaves the user on BCD.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') closePortal();
  }, { passive:true });
  window.addEventListener('pagehide', closePortal, { passive:true });
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
    // Keep the open game in sync when an account is restored or renamed.
    let lastIdentity = '';
    setInterval(() => {
      if (!ready || !frame) { lastIdentity = ''; return; }
      const payload = initPayload();
      const identity = JSON.stringify([payload.playerId, payload.playerName]);
      if (identity === lastIdentity) return;
      lastIdentity = identity;
      sendSession();
    }, 1000);
    const profile = document.getElementById('profileView');
    if (profile) new MutationObserver(() => requestAnimationFrame(ensureAdminLauncher)).observe(profile, { childList:true, subtree:true });
    if (LOCAL_PREVIEW && new URLSearchParams(location.search).get('encore-open') === '1') setTimeout(() => commitPortal({ instant:true }), 80);
  });
})();
