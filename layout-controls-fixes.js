(function () {
  const locales = { en:'en-US', es:'es-ES', ko:'ko-KR', zh:'zh-CN', ja:'ja-JP', fr:'fr-FR', it:'it-IT', ru:'ru-RU', tl:'fil-PH' };
  let accountPolishing = false;

  function syncEditableMenuHeight() {
    const stage = document.getElementById('menuStage'), page = stage?.querySelector('.menuPage'); if (!stage || !page) return;
    stage.classList.toggle('menuEditingExpanded', !!menuEditing);
    if (!menuEditing) { stage.style.removeProperty('--edit-menu-height'); return; }
    requestAnimationFrame(() => {
      const last = page.querySelector('.menuDisclaimer') || page.lastElementChild, pageTop = page.getBoundingClientRect().top;
      const measured = Math.max(760, Math.ceil((last?.getBoundingClientRect().bottom || pageTop + page.scrollHeight) - pageTop + 24));
      stage.style.setProperty('--edit-menu-height', `${measured}px`);
    });
  }

  function selectedMenuLabel(select) { return select?.selectedOptions?.[0]?.textContent || activeDrinkMenu().name; }
  function decorateMenuPicker() {
    const select = document.getElementById('savedMenuSelect'), controls = select?.closest('.menuTopControls'); if (!select || !controls) return;
    select.hidden = true;
    let button = document.getElementById('menuPickerButton');
    if (!button) {
      button = document.createElement('button'); button.id = 'menuPickerButton'; button.type = 'button'; button.className = 'menuPickerButton';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openThemedMenuPicker(); });
      controls.insertBefore(button, select);
    }
    button.innerHTML = `<span>${esc(selectedMenuLabel(select))}</span><span aria-hidden="true">⌄</span>`;
    button.setAttribute('aria-label', select.getAttribute('aria-label') || 'Saved menus');
  }
  function ensureMenuPickerModal() {
    let modal = document.getElementById('menuPickerModal'); if (modal) return modal;
    modal = document.createElement('div'); modal.id = 'menuPickerModal'; modal.className = 'modalWrap menuPickerModal';
    modal.innerHTML = '<div class="modal"><button class="modalClose" type="button" aria-label="Close menu picker">×</button><div class="eyebrow menuPickerEyebrow">Drink Menu</div><h3 class="menuPickerTitle">Choose a menu</h3><div class="menuPickerOptions"></div></div>';
    modal.querySelector('.modalClose').onclick = closeThemedMenuPicker;
    modal.addEventListener('click', event => { if (event.target === modal) closeThemedMenuPicker(); });
    document.body.append(modal); return modal;
  }
  window.openThemedMenuPicker = () => {
    const select = document.getElementById('savedMenuSelect'), modal = ensureMenuPickerModal(), list = modal.querySelector('.menuPickerOptions'); if (!select) return;
    modal.querySelector('.menuPickerTitle').textContent = select.getAttribute('aria-label') || 'Choose a menu'; list.replaceChildren();
    [...select.options].forEach(option => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `menuPickerOption${option.selected ? ' selected' : ''}`;
      button.innerHTML = `<span>${esc(option.textContent)}</span><span aria-hidden="true">${option.selected ? '✓' : ''}</span>`;
      button.onclick = () => { closeThemedMenuPicker(); selectDrinkMenu(option.value); };
      list.append(button);
    });
    modal.classList.add('open');
  };
  window.closeThemedMenuPicker = () => document.getElementById('menuPickerModal')?.classList.remove('open');

  function historyTimestamp(item) {
    const timestamp = item.completedAt || item.requestedAt; if (!timestamp) return '';
    const locale = locales[currentUser()?.language || 'en'] || locales.en;
    return new Intl.DateTimeFormat(locale, { dateStyle:'medium', timeStyle:'short' }).format(new Date(timestamp));
  }
  function polishAccountRows() {
    if (accountPolishing) return; accountPolishing = true;
    const user = currentUser(), sections = document.querySelectorAll('#profileView .accountSection');
    if (user && !user.guest) {
      sections[0]?.querySelectorAll('button[onclick^="toggleFavorite"]').forEach(button => {
        if (button.textContent !== '×') button.textContent = '×';
        button.classList.add('favoriteRemove');
        if (!button.getAttribute('aria-label')?.toLowerCase().includes('favorite')) button.setAttribute('aria-label', 'Remove from favorites');
      });
      const history = state.history.filter(item => item.userId === user.id);
      sections[1]?.querySelectorAll('.accountSongRow').forEach((row, index) => {
        const item = history[index], identity = row.firstElementChild; if (!item || !identity) return;
        let details = identity.querySelector('.historyDetails');
        if (!details) { details = document.createElement('span'); details.className = 'historyDetails'; identity.append(details); }
        const stamp = historyTimestamp(item), score = item.score !== undefined ? `${pt('score')}: ${item.score}` : '';
        const text = [stamp, score].filter(Boolean).join(' · '); if (details.textContent !== text) details.textContent = text;
      });
    }
    accountPolishing = false;
  }

  const nativeRenderDrinkMenu = window.renderDrinkMenu;
  window.renderDrinkMenu = () => { nativeRenderDrinkMenu(); decorateMenuPicker(); syncEditableMenuHeight(); };
  const nativeRenderMenuLibrary = window.renderMenuLibrary;
  window.renderMenuLibrary = () => { nativeRenderMenuLibrary(); requestAnimationFrame(decorateMenuPicker); };
  const nativeToggleMenuEdit = window.toggleMenuEdit;
  window.toggleMenuEdit = () => { const result = nativeToggleMenuEdit(); setTimeout(() => { decorateMenuPicker(); syncEditableMenuHeight(); }, 0); return result; };
  const nativeSaveEditedMenu = window.saveEditedMenu;
  window.saveEditedMenu = () => { const result = nativeSaveEditedMenu(); setTimeout(syncEditableMenuHeight, 0); return result; };
  const nativeRenderProfile = window.renderProfile;
  window.renderProfile = () => { nativeRenderProfile(); requestAnimationFrame(polishAccountRows); };

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', `<style>
      #savedMenuSelect{display:none!important}.menuPickerButton{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:58%;min-width:128px;padding:7px 9px;border:1px solid rgba(121,89,36,.75);border-radius:3px;background:#20140d;color:#f0d59c;font:700 10px ui-sans-serif,system-ui;letter-spacing:.04em;text-align:left;cursor:pointer}.menuPickerButton span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.menuPickerButton span:last-child{color:#d8b76e;font-size:14px}.menuPickerModal .modal{max-width:390px}.menuPickerOptions{display:grid;gap:6px;margin-top:15px}.menuPickerOption{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 14px;border:1px solid rgba(201,162,87,.28);border-radius:3px;background:rgba(201,162,87,.035);color:#dfceb0;font:600 13px ui-sans-serif,system-ui;text-align:left;cursor:pointer}.menuPickerOption:hover,.menuPickerOption:focus,.menuPickerOption.selected{border-color:#c9a257;background:rgba(201,162,87,.14);color:#f2d492;outline:0}.menuPickerOption.selected{font-weight:800}.menuStage.menuEditingExpanded{min-height:var(--edit-menu-height)!important;height:var(--edit-menu-height)!important}.menuStage.menuEditingExpanded .menuTilt,.menuStage.menuEditingExpanded .menuBook{min-height:var(--edit-menu-height)!important}.menuStage.menuEditingExpanded .menuPage{overflow:visible!important}.scoreModal .scoreDial{width:100%!important;max-width:260px!important;margin:18px auto!important}.scoreModal #scoreInput{display:block;width:100%!important;min-width:0!important;height:44px!important;box-sizing:border-box!important;padding:9px 11px!important;border:1px solid rgba(201,162,87,.5)!important;border-radius:3px!important;background:#120d09!important;color:#f0dfbd!important;font:400 16px/1.2 ui-sans-serif,system-ui!important;letter-spacing:0!important;text-align:left!important}.scoreModal #scoreInput::placeholder{color:#81766a!important;opacity:1}.historyDetails{grid-column:1/-1!important;display:block!important;margin-top:2px;color:#a99572;font:500 9px/1.25 ui-sans-serif,system-ui;letter-spacing:.02em}.favoriteRemove{width:30px!important;height:30px!important;padding:0!important;font-size:18px!important;line-height:1!important}.profileBar{margin-top:14px!important}@media(max-width:620px){.menuPickerButton{max-width:60%;min-width:112px;font-size:9px}.menuStage.menuEditingExpanded{min-height:var(--edit-menu-height)!important}.historyDetails{font-size:8.5px}}
    </style>`);
    ensureMenuPickerModal(); decorateMenuPicker(); syncEditableMenuHeight(); polishAccountRows();
    const profile = document.getElementById('profileView'); if (profile) new MutationObserver(polishAccountRows).observe(profile,{childList:true,subtree:true,characterData:true});
    document.addEventListener('input', event => { if (event.target.closest('.menuPage.editing')) syncEditableMenuHeight(); });
  });
})();
