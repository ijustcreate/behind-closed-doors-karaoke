(function () {
  const nativeMenuRender = window.renderDrinkMenu;
  const nativeProfileRender = window.renderProfile;
  function openDrinkPhoto(id) {
    const drink = activeDrinkMenu().drinks.find(item => item.id === id), modal = document.getElementById('drinkPhotoModal');
    if (!drink?.image || !modal) return;
    ['onpointerup', 'onpointercancel', 'onpointerleave'].forEach(name => modal.removeAttribute(name));
    modal.querySelector('h3').textContent = drink.name;
    modal.querySelector('img').src = drink.image;
    const description = modal.querySelector('.drinkPhotoDescription'); if (description) description.textContent = drink.description;
    setTimeout(() => modal.classList.add('open'), 0);
  }
  window.showDrinkPhoto = openDrinkPhoto;
  window.renderDrinkMenu = () => {
    document.querySelector('.menuIntro #savedMenuControls')?.remove();
    nativeMenuRender();
    document.querySelectorAll('.drinkItem.hasPhoto').forEach(item => {
      const id = item.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]; if (!id || item.querySelector('.drinkEye')) return;
      const button = document.createElement('button'); button.className = 'drinkEye'; button.type = 'button'; button.setAttribute('aria-label', 'View drink photo'); button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
      button.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openDrinkPhoto(id); });
      item.prepend(button);
      item.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openDrinkPhoto(id); });
    });
  };
  window.renderGroupedHistory = () => {};
  window.renderProfile = () => {
    nativeProfileRender();
    const user = currentUser(); if (!user || user.guest) return;
    const sort = state.favoriteSort || 'title', favorites = state.favorites.filter(item => item.userId === user.id).sort((a, b) => { const one = songById(a.songId) || {}, two = songById(b.songId) || {}; return ((sort === 'artist' ? one.artist : one.title) || '').localeCompare((sort === 'artist' ? two.artist : two.title) || '') || (one.title || '').localeCompare(two.title || ''); });
    const sections = document.querySelectorAll('#profileView .accountSection');
    sections[0]?.querySelectorAll('.accountSongRow').forEach((row, index) => { const song = songById(favorites[index]?.songId), actions = row.lastElementChild; if (!song || !actions || actions.querySelector('.favoriteRemove')) return; actions.insertAdjacentHTML('beforeend', `<button class="btn danger small favoriteRemove" aria-label="Remove ${esc(song.title)} from favorites" onclick="toggleFavorite('${song.id}')">×</button>`); });
    const history = state.history.filter(item => item.userId === user.id);
    sections[1]?.querySelectorAll('.accountSongRow').forEach((row, index) => { const item = history[index], actions = row.lastElementChild; if (!item || !actions) return; if (item.status === 'requested') actions.innerHTML = `<button class="btn gold historyMini" onclick="openScoreModal('${item.id}')">I sang this</button><button class="btn ghost historyMini" onclick="removeHistory('${item.id}')">I didn’t sing this</button>`; });
  };

  let longPressTimer = null, longPressPoint = null, suppressChatClick = false;
  const clearLongPress = () => { clearTimeout(longPressTimer); longPressTimer = null; };
  function closeChatActions() { document.getElementById('chatActions')?.remove(); }
  function openChatActions(id, point) {
    closeChatActions();
    const menu = document.createElement('div'); menu.id = 'chatActions'; menu.className = 'chatActions';
    menu.style.left = `${Math.min(Math.max(10, point.x), innerWidth - 215)}px`; menu.style.top = `${Math.min(Math.max(10, point.y), innerHeight - 120)}px`;
    menu.innerHTML = '<button data-action="color">Change my message color</button><button data-action="edit">Edit this message</button>';
    menu.querySelector('[data-action="color"]').onclick = () => { closeChatActions(); openChatColorPicker(); };
    menu.querySelector('[data-action="edit"]').onclick = () => { closeChatActions(); openChatEdit(id); };
    document.body.append(menu); setTimeout(() => document.addEventListener('pointerdown', closeChatActions, { once: true }), 0);
  }
  window.renderChat = function () {
    const list = document.getElementById('chatList'), user = currentUser(); if (!list) return;
    const chatColor = /^#[0-9a-f]{6}$/i.test(user?.chatColor || '') ? user.chatColor : '';
    list.innerHTML = chatMessages.map(message => {
      const mine = message.profileId === user?.id, ownStyle = mine && chatColor ? ` style="--own-chat-color:${chatColor}"` : '';
      if (chatEditingId === message.id) return `<article class="chatMessage own"${ownStyle}><textarea id="editChatText" class="control">${esc(message.message)}</textarea><div class="editActions"><button class="btn gold small" onclick="saveChatEdit('${message.id}')">Save</button><button class="btn ghost small" onclick="cancelChatEdit()">Cancel</button></div></article>`;
      const images = (message.images || []).map(src => `<img class="chatMessageImage" src="${src}" alt="Attached image" onclick="openChatImage(this.src)">`).join('');
      return `<article class="chatMessage ${mine ? 'own chatLongPress' : ''}" data-chat-id="${message.id}"${ownStyle}><div class="chatMessageHead"><strong>${esc(message.singerName)}</strong><time>${fmtTime(message.createdAt)}${message.editedAt ? ' · edited' : ''}</time></div><div class="chatMessageBody">${esc(message.message).replace(/\n/g, '<br>')}</div>${images ? `<div class="chatMessageImages">${images}</div>` : ''}</article>`;
    }).join('') || '<div class="chatEmpty"><strong>The booth is open.</strong>Be the first to say hello tonight.</div>';
  };
  document.addEventListener('pointerdown', event => {
    const message = event.target.closest('.chatLongPress'); if (!message) return;
    event.stopImmediatePropagation(); closeChatActions(); longPressPoint = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => { suppressChatClick = true; openChatActions(message.dataset.chatId, longPressPoint); }, 520);
  }, true);
  document.addEventListener('pointermove', event => { if (longPressPoint && Math.hypot(event.clientX - longPressPoint.x, event.clientY - longPressPoint.y) > 12) clearLongPress(); }, true);
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, clearLongPress, true));
  document.addEventListener('click', event => {
    const message = event.target.closest('.chatLongPress'); if (!message || event.target.closest('.chatMessageImage')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (suppressChatClick) { suppressChatClick = false; return; }
    openChatActions(message.dataset.chatId, { x: event.clientX || message.getBoundingClientRect().right, y: event.clientY || message.getBoundingClientRect().bottom });
  }, true);

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', '<style>.accountSection>summary:after{content:"⌃"!important;transform:none!important}.accountSection:not([open])>summary:after{content:"⌄"!important;transform:none!important}.accountSection>summary .achievementListButton{pointer-events:auto!important}.accountSongRow{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;min-height:42px!important;padding:5px 7px!important}.accountSongRow>div:first-child{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:1px 8px!important}.accountSongRow strong{font:700 14px/1.15 Georgia,serif!important}.accountSongRow small{grid-column:1!important;font-size:10px!important}.accountSongRow .code{grid-column:2!important;grid-row:1/3!important;align-self:center;font-size:10px!important}.accountSongRow>div:last-child{display:flex;gap:4px;align-items:center}.favoriteRemove{width:30px!important;height:30px!important;padding:0!important;font-size:17px!important}.historyMini{padding:5px 7px!important;font-size:9px!important;white-space:nowrap}.profileBar{margin-top:12px!important}.drinkItem.hasPhoto:after{display:none!important}.drinkEye{display:inline-grid!important;place-items:center;width:18px!important;height:18px!important;padding:0!important;margin:0 5px 2px 0!important;border:0!important;background:transparent!important;color:#8b6424!important;vertical-align:middle}.drinkEye svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}.chatActions{position:fixed;z-index:1000;display:grid;min-width:205px;padding:5px;background:linear-gradient(145deg,#2b1a11,#100b08);border:1px solid rgba(201,162,87,.75);box-shadow:0 16px 42px rgba(0,0,0,.62);border-radius:4px}.chatActions button{border:0;background:transparent;color:#efdbaf;text-align:left;padding:11px 12px;font:600 12px ui-sans-serif,system-ui}.chatActions button:hover{background:rgba(201,162,87,.14)}.chatContext{display:none!important}.brand>.monogram{position:absolute!important;left:20px!important}.brandrow:after{transform:scaleX(-1)!important}.menuPageSubheader:not(.editing){font:700 10px/1.35 ui-sans-serif,system-ui!important;letter-spacing:.18em!important;text-transform:uppercase!important}.menuIntro #savedMenuControls{display:none!important}#heroChatButton{display:block!important;position:absolute!important;right:18px!important;bottom:12px!important;top:auto!important;z-index:5}#songbookChatButton{display:none!important}@media(max-width:620px){.brand>.monogram{left:10px!important}.accountSongRow strong{font-size:13px!important}.historyMini{padding:4px 5px!important;font-size:8px!important}#heroChatButton{right:10px!important;bottom:9px!important}}</style>');
    const nudge = document.querySelector('.chatNudge'); if (nudge) nudge.remove(); document.getElementById('songbookChatButton')?.remove();
    const hero = document.querySelector('[data-view="songbook"] .heroCard'); if (hero && !document.getElementById('heroChatButton')) hero.insertAdjacentHTML('beforeend', '<button id="heroChatButton" class="btn gold small" onclick="switchTab(\'chat\')">Karaoke Chat</button>');
    document.querySelector('.menuIntro #savedMenuControls')?.remove(); renderDrinkMenu(); renderChat();
  });
})();
