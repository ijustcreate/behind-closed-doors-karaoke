(function () {
  const ui = {
    en:['Edit menu','Save menu','Saved menus','Add photo','Change photo','+ Add new drink','Special event name','Visible'],
    es:['Editar menú','Guardar menú','Menús guardados','Añadir foto','Cambiar foto','+ Añadir bebida','Nombre del evento','Visible'],
    ko:['메뉴 편집','메뉴 저장','저장된 메뉴','사진 추가','사진 변경','+ 새 음료 추가','특별 행사 이름','표시'],
    zh:['编辑菜单','保存菜单','已保存菜单','添加照片','更换照片','+ 添加饮品','特别活动名称','显示'],
    ja:['メニューを編集','メニューを保存','保存したメニュー','写真を追加','写真を変更','+ ドリンクを追加','特別イベント名','表示'],
    fr:['Modifier le menu','Enregistrer le menu','Menus enregistrés','Ajouter une photo','Changer la photo','+ Ajouter une boisson','Nom de l’événement','Visible'],
    it:['Modifica menu','Salva menu','Menu salvati','Aggiungi foto','Cambia foto','+ Aggiungi bevanda','Nome evento speciale','Visibile'],
    ru:['Редактировать меню','Сохранить меню','Сохранённые меню','Добавить фото','Изменить фото','+ Добавить напиток','Название события','Показывать'],
    tl:['I-edit ang menu','I-save ang menu','Mga na-save na menu','Magdagdag ng larawan','Palitan ang larawan','+ Magdagdag ng inumin','Pangalan ng espesyal na event','Makikita']
  };
  const words = () => ui[currentUser()?.language || 'en'] || ui.en;
  const current = () => activeDrinkMenu();
  const nativeSave = window.saveEditedMenu;
  function renderMenu() {
    const menu = current(), page = document.querySelector('.menuPage'), stage = document.getElementById('menuStage'); if (!page) return;
    const edit = !!menuEditing, t = words(), sub = menu.subheader || '';
    if (stage) stage.style.setProperty('height', `${edit ? Math.max(760, 300 + menu.drinks.length * 178) : drinkMenuHeight()}px`, 'important');
    const drinks = menu.drinks.map(d => edit
      ? `<article class="drinkItem editDrinkItem"><div class="drinkEditTop"><input class="drinkEditName" value="${esc(d.name)}" oninput="updateDrink('${d.id}','name',this.value)"><input class="drinkEditPrice" value="${esc(d.price)}" oninput="updateDrink('${d.id}','price',this.value)"><button class="drinkDelete" onclick="deleteDrink('${d.id}')">×</button></div><textarea class="drinkEditDescription" oninput="updateDrink('${d.id}','description',this.value)">${esc(d.description)}</textarea><button class="drinkImageEdit" onclick="chooseDrinkImage('${d.id}')">${d.image ? t[4] : t[3]}</button></article>`
      : `<article class="drinkItem ${d.image ? 'hasPhoto' : ''}" ${d.image ? `onclick="openDrinkPhotoSafely('${d.id}',event)"` : ''}><h3>${esc(d.name)} <span>$${esc(d.price)}</span></h3><p>${esc(d.description)}</p></article>`).join('');
    const special = edit ? `<div class="menuPageSubheader editing"><input value="${esc(sub)}" placeholder="${t[6]}" oninput="updateMenuSubheader(this.value)"><label><input type="checkbox" ${menu.subheaderVisible ? 'checked' : ''} onchange="updateMenuSubheaderVisible(this.checked)"> ${t[7]}</label></div>` : (menu.subheaderVisible && sub ? `<div class="menuPageSubheader">${esc(sub)}</div>` : '');
    page.innerHTML = `<div class="menuTopControls"><select id="savedMenuSelect" class="menuSelect" onchange="selectDrinkMenu(this.value)" aria-label="${t[2]}"></select><button id="menuEditBtn" class="btn gold small" onclick="toggleMenuEdit()">${edit ? t[1] : t[0]}</button></div><div class="menuPageHeader"><div class="menuKey">⚿</div><h2>Behind Closed Doors Bar</h2></div>${special}<div class="drinkList">${drinks}</div>${edit ? `<button class="addDrinkButton" onclick="addDrink()">${t[5]}</button>` : ''}<p class="menuDisclaimer">Digital menu may not be accurate.<br><strong>The real menu at the bar is always right.</strong></p>`;
    renderMenuLibrary();
  }
  window.renderDrinkMenu = renderMenu;
  window.openDrinkPhotoSafely = (id, event) => { event?.preventDefault(); event?.stopImmediatePropagation(); showDrinkPhoto(id); };
  document.addEventListener('click', event => { const item = event.target.closest('.drinkItem.hasPhoto'); if (!item) return; event.preventDefault(); event.stopImmediatePropagation(); const match = item.getAttribute('onclick')?.match(/'([^']+)'/); if (match) showDrinkPhoto(match[1]); }, true);
  window.toggleMenuEdit = () => { if (menuEditing) return openMenuSaveDialog(); menuEditing = true; menuDirty = false; setMenuOpen(true); const bar = document.getElementById('barMenu'); if (bar) { bar.querySelectorAll('[data-admin-editable]').forEach(el => el.contentEditable = 'true'); bar.classList.add('editing'); } renderMenu(); toast('Menu is ready to edit'); };
  window.saveEditedMenu = () => { const bar = document.getElementById('barMenu'); if (bar) state.barMenuHtml = bar.innerHTML; nativeSave(); if (bar) { bar.querySelectorAll('[data-admin-editable]').forEach(el => el.contentEditable = 'false'); bar.classList.remove('editing'); saveState(); } renderMenu(); };
  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', '<style>.menuIntro #menuEditBtn{display:none!important}.menuStage{margin-bottom:20px!important}.menuPage{position:relative!important}.menuTopControls{position:absolute;left:10px;right:10px;top:10px;z-index:30;display:flex;justify-content:space-between;gap:8px}.menuTopControls #menuEditBtn{position:static!important;width:auto!important;margin:0!important;flex:0 0 auto}.menuSelect{max-width:56%;appearance:none;-webkit-appearance:none;border:1px solid rgba(121,89,36,.75);background:#20140d url("data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 12 8\"%3E%3Cpath d=\"m1 1 5 5 5-5\" fill=\"none\" stroke=\"%23d8b76e\" stroke-width=\"2\"/%3E%3C/svg%3E") right 9px center/10px no-repeat;color:#f0d59c;padding:7px 27px 7px 9px;border-radius:3px;font:700 10px ui-sans-serif,system-ui;letter-spacing:.04em}.menuPageHeader{margin-top:48px!important}.menuPageHeader .menuKey{margin-bottom:25px!important}.menuPage.editing{overflow:visible!important}.backBarShelf,.barMenu{position:relative;z-index:1}.barMenu.editing{outline:1px dashed rgba(201,162,87,.8);outline-offset:4px}.drinkItem.hasPhoto{cursor:pointer}.drinkItem.hasPhoto:after{content:"View photo";display:block;color:#8b6424;font:700 8px ui-sans-serif,system-ui;letter-spacing:.12em;text-transform:uppercase;margin-top:3px}@media(max-width:620px){.menuTopControls{left:7px;right:7px;top:7px}.menuSelect{max-width:59%;font-size:9px}.menuPageHeader{margin-top:43px!important}}</style>');
    const chatTab = document.querySelector('.tab[data-tab="chat"]'); if (chatTab) chatTab.hidden = true; const nudge = document.querySelector('.chatNudge'); if (nudge) nudge.hidden = true;
    const hero = document.querySelector('[data-view="songbook"] .heroCard'); if (hero && !document.getElementById('heroChatButton')) hero.insertAdjacentHTML('beforeend', '<button id="heroChatButton" class="btn gold small" onclick="switchTab(\'chat\')">Karaoke Chat</button>');
    document.querySelector('#barMenu')?.addEventListener('input', () => { if (menuEditing) menuDirty = true; });
    renderMenu();
  });
})();
