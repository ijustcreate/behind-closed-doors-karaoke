(function () {
  const DISMISSAL_KEY = 'bcdkc.break-the-ice.dismissed-on';
  const prompts = [
    { icon: '♫', label: 'What are you singing?' },
    { icon: '⌕', label: 'Need a duet?' },
    { icon: '🥂', label: 'Any song requests?' }
  ];

  function localDay() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function wasDismissedToday() {
    try { return localStorage.getItem(DISMISSAL_KEY) === localDay(); }
    catch (_) { return false; }
  }

  function showTray() {
    const tray = document.getElementById('breakTheIceTray');
    if (tray) tray.hidden = wasDismissedToday();
  }

  window.dismissBreakTheIce = function () {
    try { localStorage.setItem(DISMISSAL_KEY, localDay()); } catch (_) { /* Keep the close button useful when storage is unavailable. */ }
    document.getElementById('breakTheIceTray')?.setAttribute('hidden', '');
  };

  window.useBreakTheIcePrompt = function (prompt) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.value = prompt;
    window.sendChat?.({ preventDefault() {} });
  };

  function installTray() {
    const panel = document.querySelector('.chatPanel');
    const composer = panel?.querySelector('.chatComposer');
    if (!panel || !composer || document.getElementById('breakTheIceTray')) return;

    const tray = document.createElement('section');
    tray.id = 'breakTheIceTray';
    tray.className = 'breakTheIceTray';
    tray.setAttribute('aria-label', 'Break the ice');
    tray.innerHTML = `
      <div class="breakTheIceHead"><span>Break the ice</span><button type="button" class="breakTheIceClose" aria-label="Hide break the ice prompts for today" title="Hide for today" onclick="dismissBreakTheIce()">×</button></div>
      <div class="breakTheIcePrompts">${prompts.map(({ icon, label }) => `<button type="button" class="breakTheIcePrompt" data-ice-prompt="${label}"><span aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</div>`;
    tray.querySelectorAll('[data-ice-prompt]').forEach(button => {
      button.addEventListener('click', () => useBreakTheIcePrompt(button.dataset.icePrompt));
    });
    composer.insertAdjacentElement('beforebegin', tray);
    showTray();
  }

  function showTrayWhenChatOpens() {
    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab !== 'function' || originalSwitchTab.breakTheIceConnected) return;
    function switchTabWithBreakTheIce(tab) {
      const result = originalSwitchTab.apply(this, arguments);
      if (tab === 'chat') showTray();
      return result;
    }
    switchTabWithBreakTheIce.breakTheIceConnected = true;
    window.switchTab = switchTabWithBreakTheIce;
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .chatPanel .breakTheIceTray{grid-column:1;margin-top:9px;padding:12px;border:1px solid rgba(201,162,87,.32);background:linear-gradient(135deg,rgba(48,9,14,.92),rgba(25,13,9,.94));box-shadow:inset 0 1px rgba(255,237,190,.06)}
    .breakTheIceHead{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px 2px;color:#e5c17a;font:600 11px/1 ui-sans-serif,system-ui;letter-spacing:.17em;text-transform:uppercase}
    .breakTheIceClose{display:grid;place-items:center;width:23px;height:23px;margin:-5px -5px -5px 0;padding:0;border:1px solid transparent;background:transparent;color:#bca787;font:300 23px/1 ui-sans-serif,system-ui;cursor:pointer}
    .breakTheIceClose:hover,.breakTheIceClose:focus-visible{border-color:rgba(227,191,112,.62);background:rgba(255,255,255,.06);color:#f6dfab;outline:0}
    .breakTheIcePrompts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .breakTheIcePrompt{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:8px;border:1px solid rgba(217,160,94,.52);border-radius:9px;background:linear-gradient(135deg,rgba(91,13,20,.84),rgba(45,10,14,.92));color:#f0ddba;font:600 12px/1.25 ui-sans-serif,system-ui;text-align:left;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
    .breakTheIcePrompt>span:first-child{flex:0 0 auto;color:#e2b85e;font:27px/1 Georgia,serif}
    .breakTheIcePrompt:hover,.breakTheIcePrompt:focus-visible{transform:translateY(-1px);border-color:#edca81;background:linear-gradient(135deg,rgba(118,21,31,.92),rgba(65,15,18,.95));outline:0}
    .chatPanel .whoHere{grid-row:1/4}
    @media(max-width:760px){.chatPanel .breakTheIceTray{margin:7px 0;padding:9px}.chatPanel .whoHere{grid-row:auto}.breakTheIceHead{margin-bottom:7px}.breakTheIcePrompts{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.breakTheIcePrompt{flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0;min-height:58px;padding:6px 3px;font-size:9px;line-height:1.15;text-align:center}.breakTheIcePrompt>span:first-child{font-size:20px}.breakTheIcePrompt>span:last-child{max-width:100%;overflow-wrap:anywhere}}
    @media(max-width:360px){.breakTheIcePrompt{font-size:8px}.breakTheIcePrompt>span:first-child{font-size:18px}}
  </style>`);

  function initialize() {
    installTray();
    showTrayWhenChatOpens();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
