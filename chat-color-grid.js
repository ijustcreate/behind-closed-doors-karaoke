(function () {
  const DEFAULT_CHAT_COLOR = '#5b0d14';
  const CHAT_COLORS = [
    ['Ruby', '#421014'], ['Ember', '#42180d'], ['Copper', '#42230b'], ['Amber', '#42300a'], ['Mustard', '#3e4208'],
    ['Olive', '#2f4208'], ['Forest', '#143904'], ['Green', '#0c420a'], ['Emerald', '#083d1e'], ['Teal', '#083e30'],
    ['Deep teal', '#083e3c'], ['Ocean', '#08323f'], ['Blue', '#08243f'], ['Royal blue', '#0d163f'], ['Indigo', '#1e0c41'],
    ['Purple', '#2f0b42'], ['Violet', '#3c0a42'], ['Orchid', '#430a37'], ['Magenta', '#430a28'], ['Rose', '#430a18'],
    ['Wine', '#3d1010'], ['Brick', '#40130c'], ['Plum', '#30102b'], ['Slate', '#202a31'], ['Dark grey', '#303030']
  ];
  let selectedChatColor = DEFAULT_CHAT_COLOR;

  const isHexColor = value => /^#[0-9a-f]{6}$/i.test(value || '');

  function updateColorSelection() {
    const modal = document.getElementById('chatColorModal');
    if (!modal) return;
    modal.querySelectorAll('[data-chat-color]').forEach(button => {
      const selected = button.dataset.chatColor.toLowerCase() === selectedChatColor.toLowerCase();
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    const preview = modal.querySelector('#chatColorPreview');
    if (preview) preview.style.background = selectedChatColor;
    const label = modal.querySelector('#chatColorValue');
    if (label) label.textContent = (CHAT_COLORS.find(([, color]) => color.toLowerCase() === selectedChatColor.toLowerCase()) || ['Custom color'])[0];
  }

  function buildColorModal() {
    let modal = document.getElementById('chatColorModal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', '<div id="chatColorModal" class="modalWrap chatColorModal"></div>');
      modal = document.getElementById('chatColorModal');
    }
    if (modal.dataset.colorGridReady === 'true') return modal;

    modal.dataset.colorGridReady = 'true';
    modal.innerHTML = `<div class="modal"><button class="modalClose" type="button" aria-label="Close message color" onclick="closeChatColorPicker()">×</button><div class="eyebrow">Karaoke Club Chat</div><h3>What color do you want your messages to be?</h3><p>Choose a deep, rich color for your chat bubbles.</p><div class="chatColorCurrent"><span id="chatColorPreview" aria-hidden="true"></span><span>Selected: <strong id="chatColorValue"></strong></span></div><div class="chatColorGrid" role="radiogroup" aria-label="Message color">${CHAT_COLORS.map(([name, color]) => `<button class="chatColorSwatch" type="button" role="radio" data-chat-color="${color}" aria-label="${name}" title="${name}" style="--swatch-color:${color}"></button>`).join('')}</div><div class="modalActions"><button class="btn ghost" type="button" onclick="resetChatColor()">Set to default</button><button class="btn gold" type="button" onclick="saveChatColor()">Save color</button></div></div>`;
    modal.addEventListener('click', event => {
      if (event.target === modal) closeChatColorPicker();
      const swatch = event.target.closest('[data-chat-color]');
      if (!swatch) return;
      selectedChatColor = swatch.dataset.chatColor;
      updateColorSelection();
    });
    return modal;
  }

  window.openChatColorPicker = function () {
    if (!ensureUser('Sign in to choose a message color')) return;
    const user = currentUser();
    selectedChatColor = isHexColor(user?.chatColor) ? user.chatColor : DEFAULT_CHAT_COLOR;
    buildColorModal().classList.add('open');
    updateColorSelection();
  };

  window.closeChatColorPicker = function () {
    document.getElementById('chatColorModal')?.classList.remove('open');
  };

  window.saveChatColor = function () {
    const user = currentUser();
    if (!user || !isHexColor(selectedChatColor)) return;
    user.chatColor = selectedChatColor;
    saveState();
    closeChatColorPicker();
    renderChat();
    toast('Message color saved');
  };

  window.resetChatColor = function () {
    const user = currentUser();
    if (!user) return;
    delete user.chatColor;
    saveState();
    closeChatColorPicker();
    renderChat();
    toast('Message color reset');
  };

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', `<style>
      .chatMessage.own{background:var(--own-chat-color,linear-gradient(145deg,#341116,#210b0e))!important}
      @supports (background:color-mix(in srgb, black, white)){
        .chatMessage.own{background:linear-gradient(145deg,var(--own-chat-color,#341116),color-mix(in srgb,var(--own-chat-color,#341116) 62%,#050403))!important}
      }
      .chatColorModal .modal{max-width:360px;padding:18px 19px 16px}
      .chatColorModal h3{margin:5px 0 7px;font-size:26px;line-height:1.08}
      .chatColorModal p{margin:0;font-size:12px;line-height:1.4}
      .chatColorCurrent{display:flex;align-items:center;gap:8px;margin:12px 0 9px;color:var(--muted);font-size:11px}
      .chatColorCurrent strong{color:var(--ink);font-weight:600}
      #chatColorPreview{width:30px;height:30px;flex:0 0 30px;border:1px solid rgba(240,222,177,.62);border-radius:50%;box-shadow:0 0 0 3px rgba(0,0,0,.28),inset 0 0 0 1px rgba(0,0,0,.22)}
      .chatColorGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:9px;border:1px solid rgba(201,162,87,.3);background:#120d09}
      .chatColorSwatch{position:relative;aspect-ratio:1;width:100%;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:var(--swatch-color);box-shadow:inset 0 -7px 10px rgba(0,0,0,.22);transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}
      .chatColorSwatch:hover,.chatColorSwatch:focus-visible{transform:translateY(-2px);border-color:#f1d28e;outline:0}
      .chatColorSwatch.is-selected{border-color:#f6e0ad;box-shadow:0 0 0 2px #120d09,0 0 0 4px #d2ac5d,inset 0 -9px 12px rgba(0,0,0,.16);z-index:1}
      .chatColorModal .modalActions{justify-content:space-between;margin-top:14px}
      @media(max-width:420px){.chatColorGrid{gap:7px;padding:9px}.chatColorSwatch{border-radius:6px}}
    </style>`);
    buildColorModal();
  });
})();
