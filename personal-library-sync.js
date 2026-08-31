/* Keeps account favorites and song history with the profile, not just this browser. */
(function () {
  'use strict';
  let syncing = false;
  let timer = null;
  const endpoint = () => `${window.BCD_SYNC_CONFIG?.url}/functions/v1/karaoke-profile`;
  const own = (rows, user) => (Array.isArray(rows) ? rows : []).filter(row => row && row.userId === user.id);
  const profileCredential = user => {
    try { return localStorage.getItem(`bcd-profile-${user.id}`) || sessionStorage.getItem(`bcd-profile-${user.id}`) || localStorage.getItem(`bcd-admin-${user.id}`) || sessionStorage.getItem(`bcd-admin-${user.id}`) || (user.passwordHash && user.passwordHash !== 'REMOTE' ? user.passwordHash : null); } catch { return null; }
  };
  const keyFor = (row, kind) => kind === 'favorite' ? String(row.songId || '') : `${row.songId || ''}:${row.status || 'requested'}:${row.requestedAt || row.completedAt || row.id || ''}`;
  const merge = (first, second, kind) => { const seen = new Map(); [...first, ...second].forEach(row => { const key = keyFor(row, kind); if (key && !seen.has(key)) seen.set(key, row); }); return [...seen.values()].sort((a, b) => Number(b.createdAt || b.requestedAt || b.completedAt || 0) - Number(a.createdAt || a.requestedAt || a.completedAt || 0)); };
  async function call(user, op, library) {
    const credential = profileCredential(user);
    const key = window.BCD_SYNC_CONFIG?.key;
    const response = await fetch(endpoint(), { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'personal_library', op, profileId: user.id, passwordHash: credential, passwordFoldedHash: credential, library }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not sync your saved songs'); return result.library || { favorites: [], history: [] };
  }
  async function syncPersonalLibrary() {
    const user = window.currentUser?.(); if (syncing || !user?.remoteProfile || user.guest) return; syncing = true;
    try {
      const remote = await call(user, 'load');
      const state = window.getBcdState?.(); if (!state) return;
      const favorites = merge(own(state.favorites, user), remote.favorites || [], 'favorite').map(row => ({ ...row, userId: user.id }));
      const history = merge(own(state.history, user), remote.history || [], 'history').map(row => ({ ...row, userId: user.id }));
      state.favorites = (state.favorites || []).filter(row => row.userId !== user.id).concat(favorites);
      state.history = (state.history || []).filter(row => row.userId !== user.id).concat(history);
      window.saveState?.(); if (window.activeTab === 'profile') window.renderProfile?.(); await call(user, 'save', { favorites, history });
    } catch (error) { console.warn('Personal library sync unavailable', error); } finally { syncing = false; }
  }
  function queueLibrarySync(delay = 250) { clearTimeout(timer); timer = setTimeout(syncPersonalLibrary, delay); }
  window.syncPersonalLibrary = syncPersonalLibrary; window.queuePersonalLibrarySync = queueLibrarySync;
  ['toggleFavorite', 'requestSong', 'submitScore', 'removeHistory'].forEach(name => { const original = window[name]; if (typeof original !== 'function') return; window[name] = function () { const result = original.apply(this, arguments); queueLibrarySync(); return result; }; });
  const originalRemember = window.rememberSharedProfile; if (typeof originalRemember === 'function') window.rememberSharedProfile = function () { const result = originalRemember.apply(this, arguments); queueLibrarySync(500); return result; };
  const originalLogin = window.completeLogin; if (typeof originalLogin === 'function') window.completeLogin = function () { const result = originalLogin.apply(this, arguments); queueLibrarySync(500); return result; };
  const begin = () => { queueLibrarySync(900); setInterval(syncPersonalLibrary, 30000); };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', begin); else begin();
}());
