(function () {
  const nativeMenuRender = window.renderDrinkMenu;
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
    nativeMenuRender();
    document.querySelectorAll('.drinkItem.hasPhoto').forEach(item => {
      const id = item.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]; if (!id || item.querySelector('.drinkEye')) return;
      const button = document.createElement('button'); button.className = 'drinkEye'; button.type = 'button'; button.setAttribute('aria-label', 'View drink photo'); button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
      button.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openDrinkPhoto(id); });
      item.prepend(button);
      item.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openDrinkPhoto(id); });
    });
  };

  let longPressTimer = null, longPressPoint = null;
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
    list.innerHTML = chatMessages.map(message => {
      const mine = message.profileId === user?.id, editable = mine && Date.now() - message.createdAt < 300000;
      if (chatEditingId === message.id) return `<article class="chatMessage own"><textarea id="editChatText" class="control">${esc(message.message)}</textarea><div class="editActions"><button class="btn gold small" onclick="saveChatEdit('${message.id}')">Save</button><button class="btn ghost small" onclick="cancelChatEdit()">Cancel</button></div></article>`;
      const images = (message.images || []).map(src => `<img class="chatMessageImage" src="${src}" alt="Attached image" onclick="openChatImage(this.src)">`).join('');
      return `<article class="chatMessage ${mine ? 'own' : ''} ${editable ? 'chatLongPress' : ''}" data-chat-id="${message.id}"><div class="chatMessageHead"><strong>${esc(message.singerName)}</strong><time>${fmtTime(message.createdAt)}${message.editedAt ? ' · edited' : ''}</time></div><div class="chatMessageBody">${esc(message.message).replace(/\n/g, '<br>')}</div>${images ? `<div class="chatMessageImages">${images}</div>` : ''}</article>`;
    }).join('') || '<div class="chatEmpty"><strong>The booth is open.</strong>Be the first to say hello tonight.</div>';
  };
  document.addEventListener('pointerdown', event => {
    const message = event.target.closest('.chatLongPress'); if (!message) return;
    event.stopImmediatePropagation(); closeChatActions(); longPressPoint = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => openChatActions(message.dataset.chatId, longPressPoint), 520);
  }, true);
  ['pointerup', 'pointercancel', 'pointermove'].forEach(type => document.addEventListener(type, clearLongPress, true));

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', '<style>.accountSection>summary:after{content:"⌃"!important;transform:none!important}.accountSection:not([open])>summary:after{content:"›"!important;transform:none!important}.drinkItem.hasPhoto:after{display:none!important}.drinkEye{display:inline-grid!important;place-items:center;width:18px!important;height:18px!important;padding:0!important;margin:0 5px 2px 0!important;border:0!important;background:transparent!important;color:#8b6424!important;vertical-align:middle}.drinkEye svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}.chatActions{position:fixed;z-index:1000;display:grid;min-width:205px;padding:5px;background:linear-gradient(145deg,#2b1a11,#100b08);border:1px solid rgba(201,162,87,.75);box-shadow:0 16px 42px rgba(0,0,0,.62);border-radius:4px}.chatActions button{border:0;background:transparent;color:#efdbaf;text-align:left;padding:11px 12px;font:600 12px ui-sans-serif,system-ui}.chatActions button:hover{background:rgba(201,162,87,.14)}.chatContext{display:none!important}</style>');
    renderDrinkMenu(); renderChat();
  });
})();
