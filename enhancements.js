(function () {
  let cropImage = null;
  let cropDrinkId = null;
  let draftImages = [];

  const addModal = (id, html) => {
    if (!document.getElementById(id)) document.body.insertAdjacentHTML('beforeend', html);
  };
  const menu = () => activeDrinkMenu();

  function renderMenuFinal() {
    const current = menu();
    const page = document.querySelector('.menuPage');
    if (!page) return;
    const editing = !!menuEditing;
    const subheader = current.subheader || '';
    const drinks = current.drinks.map(drink => editing
      ? `<article class="drinkItem editDrinkItem"><div class="drinkEditTop"><input class="drinkEditName" value="${esc(drink.name)}" oninput="updateDrink('${drink.id}','name',this.value)"><input class="drinkEditPrice" value="${esc(drink.price)}" oninput="updateDrink('${drink.id}','price',this.value)"><button class="drinkDelete" onclick="deleteDrink('${drink.id}')">×</button></div><textarea class="drinkEditDescription" oninput="updateDrink('${drink.id}','description',this.value)">${esc(drink.description)}</textarea><button class="drinkImageEdit" onclick="chooseDrinkImage('${drink.id}')">${drink.image ? 'Change photo' : 'Add photo'}</button></article>`
      : `<article class="drinkItem">${drink.image ? `<button class="drinkEye" onclick="showDrinkPhoto('${drink.id}')" aria-label="View ${esc(drink.name)} photo">◉</button>` : ''}<h3>${esc(drink.name)} <span>$${esc(drink.price)}</span></h3><p>${esc(drink.description)}</p></article>`
    ).join('');
    const extra = editing
      ? `<div class="menuPageSubheader editing"><input value="${esc(subheader)}" placeholder="Special event name" oninput="updateMenuSubheader(this.value)"><label><input type="checkbox" ${current.subheaderVisible ? 'checked' : ''} onchange="updateMenuSubheaderVisible(this.checked)"> Visible</label></div>`
      : (current.subheaderVisible && subheader ? `<div class="menuPageSubheader">${esc(subheader)}</div>` : '');
    page.innerHTML = `<button id="menuEditBtn" class="btn gold small menuEditInPage" onclick="toggleMenuEdit()">${editing ? 'Save menu' : 'Edit menu'}</button><div class="menuPageHeader"><div class="menuKey">⚿</div><h2>Behind Closed Doors</h2></div>${extra}<div class="drinkList">${drinks}</div>${editing ? '<button class="addDrinkButton" onclick="addDrink()">+ Add new drink</button>' : ''}<p class="menuDisclaimer">Digital menu may not be accurate.<br><strong>The real menu at the bar is always right.</strong></p>`;
    renderMenuLibrary();
  }

  window.renderDrinkMenu = renderMenuFinal;
  window.persistDrinkMenus = () => { saveState(); renderMenuFinal(); };
  window.updateDrink = (id, key, value) => { const drink = menu().drinks.find(item => item.id === id); if (!drink) return; drink[key] = value; menuDirty = true; saveState(); };
  window.updateMenuSubheader = value => { menu().subheader = value; menuDirty = true; saveState(); };
  window.updateMenuSubheaderVisible = value => { menu().subheaderVisible = value; menuDirty = true; saveState(); renderMenuFinal(); };
  window.toggleMenuEdit = () => { if (menuEditing) return openMenuSaveDialog(); menuEditing = true; menuDirty = false; setMenuOpen(true); renderMenuFinal(); toast('Menu is ready to edit'); };
  window.saveEditedMenu = () => {
    const input = document.getElementById('menuSaveName');
    const name = (input?.value || menu().name).trim();
    if (!name) return input?.focus();
    const source = menu();
    state.drinkMenus[name] = { name, subheader: source.subheader || '', subheaderVisible: !!source.subheaderVisible, drinks: source.drinks.map(drink => ({ ...drink, id: uid('drink') })) };
    state.activeDrinkMenu = name; menuEditing = false; menuDirty = false; saveState(); closeMenuSaveDialog(); renderMenuFinal();
    toast(name === source.name ? 'Menu overwritten and saved' : 'New menu created and saved');
  };
  window.selectDrinkMenu = name => { if (menuEditing && menuDirty) return openMenuSaveDialog(); if (!state.drinkMenus?.[name]) return; state.activeDrinkMenu = name; saveState(); renderMenuFinal(); toast(`${name} loaded`); };

  function drawCrop() {
    const canvas = document.getElementById('cropCanvas');
    if (!canvas || !cropImage) return;
    const ctx = canvas.getContext('2d'), size = 700;
    const zoom = +document.getElementById('cropZoom').value;
    const x = +document.getElementById('cropX').value, y = +document.getElementById('cropY').value;
    const scale = Math.max(size / cropImage.width, size / cropImage.height) * zoom;
    const w = cropImage.width * scale, h = cropImage.height * scale;
    ctx.fillStyle = '#0b0806'; ctx.fillRect(0, 0, size, size); ctx.drawImage(cropImage, (size - w) / 2 + x * size * .35, (size - h) / 2 + y * size * .35, w, h);
  }
  window.chooseDrinkImage = id => { window.pendingDrinkImageId = id; document.getElementById('drinkImagePicker')?.classList.add('open'); };
  window.readDrinkImage = input => { const file = input.files?.[0]; input.value = ''; if (!file) return; const reader = new FileReader(); reader.onload = () => { cropImage = new Image(); cropImage.onload = () => { cropDrinkId = window.pendingDrinkImageId; addModal('cropModal', `<div id="cropModal" class="modalWrap cropModal"><div class="modal"><button class="modalClose" onclick="closeCropModal()">×</button><div class="eyebrow">Frame drink photo</div><h3>Center the drink in the square</h3><canvas id="cropCanvas" class="cropCanvas" width="700" height="700"></canvas><div class="cropControls"><label>Zoom <input id="cropZoom" type="range" min="1" max="3" step=".01" value="1" oninput="drawDrinkCrop()"></label><label>Horizontal <input id="cropX" type="range" min="-1" max="1" step=".01" value="0" oninput="drawDrinkCrop()"></label><label>Vertical <input id="cropY" type="range" min="-1" max="1" step=".01" value="0" oninput="drawDrinkCrop()"></label></div><div class="modalActions"><button class="btn ghost" onclick="closeCropModal()">Cancel</button><button class="btn gold" onclick="saveCroppedDrink()">Save photo</button></div></div></div>`); document.getElementById('cropModal').classList.add('open'); drawCrop(); }; cropImage.src = reader.result; }; reader.readAsDataURL(file); };
  window.drawDrinkCrop = drawCrop;
  window.closeCropModal = () => document.getElementById('cropModal')?.classList.remove('open');
  window.saveCroppedDrink = () => { const drink = menu().drinks.find(item => item.id === cropDrinkId), canvas = document.getElementById('cropCanvas'); if (!drink || !canvas) return; drink.image = canvas.toDataURL('image/jpeg', .84); menuDirty = true; saveState(); closeCropModal(); document.getElementById('drinkImagePicker')?.classList.remove('open'); renderMenuFinal(); toast('Drink photo added'); };
  window.showDrinkPhoto = id => { const drink = menu().drinks.find(item => item.id === id), modal = document.getElementById('drinkPhotoModal'); if (!drink?.image || !modal) return; modal.querySelector('h3').textContent = drink.name; modal.querySelector('img').src = drink.image; modal.querySelector('.drinkPhotoDescription').textContent = drink.description; modal.classList.add('open'); };

  function renderChatFinal() {
    const list = document.getElementById('chatList'), user = currentUser(); if (!list) return;
    list.innerHTML = chatMessages.map(message => { const mine = message.profileId === user?.id, editable = mine && Date.now() - message.createdAt < 300000, images = (message.images || []).map(src => `<img class="chatMessageImage" src="${src}" alt="Attached image" onclick="openChatImage(this.src)">`).join(''); return `<article class="chatMessage ${mine ? 'own' : ''}" ${editable ? `oncontextmenu="openChatContext('${message.id}',event);return false" onpointerdown="startChatLongPress('${message.id}')" onpointerup="cancelChatLongPress()" onpointercancel="cancelChatLongPress()"` : ''}><div class="chatMessageHead"><strong>${esc(message.singerName)}</strong><time>${fmtTime(message.createdAt)}</time></div><div class="chatMessageBody">${esc(message.message).replace(/\n/g, '<br>')}</div>${images ? `<div class="chatMessageImages">${images}</div>` : ''}</article>`; }).join('') || '<div class="chatEmpty"><strong>The booth is open.</strong>Be the first to say hello tonight.</div>';
  }
  window.renderChat = renderChatFinal;
  window.sendChat = event => {
    event.preventDefault();
    if (!ensureUser('Sign in to join Karaoke Chat')) return;
    const input = document.getElementById('chatInput'), text = input.value.trim(), user = currentUser();
    if (!text && !draftImages.length) return;
    const row = { id: uid('chat'), profileId: user.id, singerName: user.name, message: text.slice(0, 1000), createdAt: Date.now(), images: draftImages.slice() };
    chatMessages.push(row); input.value = ''; draftImages = []; renderChatFinal();
    sharedFetch('karaoke_chat_messages', { method: 'POST', body: JSON.stringify({ id: row.id, profile_id: row.profileId, singer_name: row.singerName, message: row.message, night_key: nightKey(), image_urls: row.images }) }).then(syncChat).catch(error => console.warn('Shared chat is reconnecting', error));
  };
  window.openChatContext = (id, event) => { document.getElementById('chatContext')?.remove(); const box = document.createElement('div'); box.id = 'chatContext'; box.className = 'chatContext'; box.style.left = `${Math.min(event.clientX, innerWidth - 205)}px`; box.style.top = `${Math.min(event.clientY, innerHeight - 110)}px`; box.innerHTML = `<button onclick="openChatColorPicker();closeChatContext()">Change my message color</button><button onclick="openChatEdit('${id}');closeChatContext()">Edit this message</button>`; document.body.appendChild(box); };
  window.closeChatContext = () => document.getElementById('chatContext')?.remove();
  window.startChatLongPress = id => { clearTimeout(chatLongPressTimer); chatLongPressTimer = setTimeout(() => openChatContext(id, { clientX: innerWidth / 2, clientY: innerHeight / 2 }), 550); };
  window.openChatImage = src => { addModal('chatImageModal', '<div id="chatImageModal" class="modalWrap chatImageModal"><div class="modal"><button class="modalClose" onclick="closeChatImage()">×</button><img id="chatImageFull"><a id="chatImageDownload" class="btn gold" download="karaoke-chat-image.jpg">⇩ Download</a></div></div>'); document.getElementById('chatImageFull').src = src; document.getElementById('chatImageDownload').href = src; document.getElementById('chatImageModal').classList.add('open'); };
  window.closeChatImage = () => document.getElementById('chatImageModal')?.classList.remove('open');

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', '<style>.profileSection .manageRow>div:first-child{display:flex;align-items:center;gap:6px;min-width:0}.profileSection .manageRow .requestMeta{margin-left:auto;max-width:32%;font-size:11px}.profileSection .historyStatus{flex:0 0 auto}@media(max-width:620px){.profileSection .manageRow .requestMeta{display:none}}</style>');
    const intro = document.querySelector('.menuIntro'); if (intro) { const title=intro.querySelector('h2'),copy=intro.querySelector('p'); if(title)title.textContent='Drink Menu'; if(copy)copy.textContent='Tap the leather cover to reveal the menu, then browse the drinks behind closed doors.'; document.getElementById('menuEditBtn')?.remove(); }
    addModal('menuSaveModal', '<div id="menuSaveModal" class="modalWrap menuSaveModal"><div class="modal"><button class="modalClose" onclick="closeMenuSaveDialog()">×</button><div class="eyebrow">Save cocktail menu</div><h3>Name this menu</h3><p>If you save with the same name, it will overwrite the old menu. If you save with a new name, it will create a new menu option.</p><input id="menuSaveName" class="control" maxlength="60"><div class="modalActions"><button class="btn ghost" onclick="closeMenuSaveDialog()">Keep editing</button><button class="btn gold" onclick="saveEditedMenu()">Save menu</button></div></div></div>');
    const saveModal = document.getElementById('menuSaveModal'); if (saveModal) { const copy = saveModal.querySelector('p'); if (copy) copy.textContent = 'If you save with the same name, it will overwrite the old menu. If you save with a new name, it will create a new menu option.'; const button = saveModal.querySelector('.modalActions .gold'); if (button) button.textContent = 'Save menu'; }
    const photo = document.querySelector('#drinkPhotoModal .modal'); if (photo && !photo.querySelector('.drinkPhotoDescription')) photo.insertAdjacentHTML('beforeend', '<p class="drinkPhotoDescription"></p>');
    document.getElementById('chatColorButton')?.remove();
    const input = document.getElementById('chatInput'); if (input) { input.maxLength = 1000; const form = document.querySelector('.chatComposer'), plus = document.createElement('button'); plus.type = 'button'; plus.className = 'btn ghost chatPlus'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Add image'); plus.onclick = () => document.getElementById('chatImageInput').click(); form.insertBefore(plus, input); const count = document.createElement('div'); count.id = 'chatTokenCount'; count.className = 'chatTokenCount'; form.appendChild(count); const resize = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 180)}px`; count.textContent = `${input.value.length}/1000`; count.classList.toggle('atMax', input.value.length >= 1000); }; input.addEventListener('input', resize); input.addEventListener('beforeinput', event => { if (input.value.length >= 1000 && !event.inputType.includes('delete')) { event.preventDefault(); input.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.01)' }, { transform: 'scale(1)' }], 180); } }); addModal('chatImageInputHolder', '<input id="chatImageInput" type="file" accept="image/*" multiple hidden>'); document.getElementById('chatImageInput').onchange = event => { Array.from(event.target.files || []).slice(0, 4 - draftImages.length).forEach(file => { const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 700 / Math.max(image.width, image.height)), canvas = document.createElement('canvas'); canvas.width = image.width * scale; canvas.height = image.height * scale; canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); draftImages.push(canvas.toDataURL('image/jpeg', .8)); const holder = document.querySelector('.chatAttachments'); if (holder) holder.innerHTML = draftImages.map(src => `<img class="chatAttachment" src="${src}">`).join(''); else input.insertAdjacentHTML('beforebegin', `<div class="chatAttachments">${draftImages.map(src => `<img class="chatAttachment" src="${src}">`).join('')}</div>`); }; image.src = reader.result; }; reader.readAsDataURL(file); }); event.target.value = ''; }; resize(); }
    renderMenuFinal();
    if (!Array.isArray(state.history)) { state.history = []; saveState(); }
  });
})();
