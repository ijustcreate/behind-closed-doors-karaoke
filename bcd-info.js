(function () {
  'use strict';

  const address = '2041 Pacific Ave, Stockton, CA 95204';
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  let previouslyFocused;

  function closeAboutBCD() {
    const modal = document.getElementById('bcdInfoModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.removeEventListener('keydown', handleKeydown);
    previouslyFocused?.focus?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') closeAboutBCD();
  }

  function openAboutBCD() {
    const modal = document.getElementById('bcdInfoModal');
    if (!modal) return;
    previouslyFocused = document.activeElement;
    modal.classList.add('open');
    document.addEventListener('keydown', handleKeydown);
    modal.querySelector('.bcdInfoClose')?.focus();
  }

  async function copyVenueAddress() {
    try {
      await navigator.clipboard.writeText(address);
    } catch (error) {
      const field = document.createElement('textarea');
      field.value = address;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    window.toast?.('Address copied to your pocket');
  }

  function install() {
    document.head.insertAdjacentHTML('beforeend', `<style id="bcd-info-styles">
      .headerActions{display:flex!important;align-items:center;gap:7px}
      .aboutVenueButton{width:42px;height:36px;padding:0;display:grid;place-items:center;border:1px solid rgba(199,164,91,.55);border-radius:3px;background:linear-gradient(#2c2117,#19130e);color:#e6c47d;font:600 20px/1 Georgia,serif;box-shadow:none;transition:border-color .18s ease,color .18s ease,background .18s ease}
      .aboutVenueButton:hover,.aboutVenueButton:focus-visible{border-color:var(--brass);color:#f4e9d6;background:linear-gradient(#342619,#1b140e);box-shadow:none;outline:none}
      .bcdInfoModal{background:rgba(4,3,3,.8)}
      .bcdInfoModal .modal{position:relative;width:min(550px,100%);padding:0;overflow:hidden;background:linear-gradient(145deg,#21130f,#100b09 62%,#160d0a);border-color:rgba(214,177,96,.56);box-shadow:0 34px 120px rgba(0,0,0,.72),0 0 48px rgba(111,35,37,.16)}
      .bcdInfoModal .modal:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(201,162,87,.08),transparent 40%),url('assets/damask.jpg') center/420px;opacity:.18;mix-blend-mode:screen}
      .bcdInfoTop,.bcdInfoBody{position:relative}.bcdInfoTop{padding:27px 28px 22px;border-bottom:1px solid rgba(201,162,87,.2);background:linear-gradient(110deg,rgba(77,12,19,.78),rgba(29,14,10,.94))}.bcdInfoTop h3{margin:0;color:#f1d8a0;font:500 clamp(30px,5vw,40px)/1 Georgia,serif}.bcdInfoSubtitle{margin:11px 0 0;color:#e4c68c;font-size:11px;letter-spacing:.13em;line-height:1.45;text-transform:uppercase}
      .bcdInfoBody{padding:22px 28px 26px}.bcdInfoBody p{max-width:470px;margin:0;color:#d2bea0;font-size:14px;line-height:1.62}.bcdInfoBody strong{color:#f1d8a0;font-weight:600}
      .bcdInfoDetail{display:flex;gap:10px;align-items:flex-start;margin:19px 0 18px;padding:13px 0;border-top:1px solid rgba(201,162,87,.17);border-bottom:1px solid rgba(201,162,87,.17);color:#f0dfbd;font:600 14px/1.45 Georgia,serif}.bcdInfoDetail span{color:#d7a94d;font:18px/1 Georgia,serif}.bcdInfoDetail address{font-style:normal}
      .bcdHours{margin:0 0 15px;padding:14px 0 13px;border-bottom:1px solid rgba(201,162,87,.17)}.bcdHoursTitle{margin-bottom:8px;color:#cfa75e;font-size:10px;letter-spacing:.16em;text-transform:uppercase}.bcdHoursGrid{display:grid;grid-template-columns:1fr auto;gap:4px 18px;color:#cdbb9c;font-size:12px;line-height:1.45}.bcdHoursGrid dt{font-weight:700;color:#f0dfbd}.bcdHoursGrid dd{margin:0;text-align:right}.bcdHoursGrid .closed{color:#927b61}
      .bcdInfoNight{display:inline-block;padding:7px 10px;border:1px solid rgba(201,162,87,.38);background:rgba(91,13,20,.38);color:#edcf8c;font-size:10px;letter-spacing:.14em;text-transform:uppercase}.bcdInfoActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:21px}.bcdInfoActions .btn{min-height:40px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.bcdInfoClose{position:absolute;z-index:2;right:12px;top:10px;width:34px;height:34px;border:0;background:transparent;color:#e9c77b;font-size:27px;line-height:1}.bcdInfoClose:hover,.bcdInfoClose:focus-visible{color:#fff2cc;outline:1px solid rgba(232,199,123,.6)}
      @media(max-width:620px){.headerActions{gap:6px}.aboutVenueButton{width:34px;height:34px;font-size:22px}.bcdInfoTop{padding:23px 20px 19px}.bcdInfoBody{padding:18px 20px 22px}.bcdInfoBody p{font-size:13px}.bcdInfoActions .btn{flex:1;padding:9px 8px;font-size:11px}}@media(prefers-reduced-motion:reduce){.aboutVenueButton{transition:none}}
    </style>`);

    const actions = document.querySelector('.headerActions');
    if (actions && !document.getElementById('aboutVenueButton')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="aboutVenueButton" class="aboutVenueButton" type="button" aria-label="What is Behind Closed Doors?" title="What is BCD?">?</button>');
      document.getElementById('aboutVenueButton').addEventListener('click', openAboutBCD);
    }

    if (!document.getElementById('bcdInfoModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="bcdInfoModal" class="modalWrap bcdInfoModal" role="dialog" aria-modal="true" aria-labelledby="bcdInfoTitle"><section class="modal"><button type="button" class="bcdInfoClose" aria-label="Close venue information">×</button><div class="bcdInfoTop"><h3 id="bcdInfoTitle">What is BCD?</h3><p class="bcdInfoSubtitle">An upscale speakeasy in the heart of the Miracle Mile</p></div><div class="bcdInfoBody"><p><strong>Behind Closed Doors</strong> is a speakeasy tucked behind Seoul Soon Dubu Korean BBQ.<br>An after-hours mixologist cocktail bar known for good pours, close conversations, and songs that deserve the mic.</p><div class="bcdInfoDetail"><span>⌖</span><address>${address}</address></div><section class="bcdHours" aria-labelledby="bcdHoursTitle"><div id="bcdHoursTitle" class="bcdHoursTitle">Bar hours</div><dl class="bcdHoursGrid"><dt>Mon</dt><dd class="closed">Closed</dd><dt>Tue</dt><dd class="closed">Closed</dd><dt>Wed</dt><dd class="closed">Closed</dd><dt>Thu</dt><dd>7:00 PM – 2:00 AM</dd><dt>Fri</dt><dd>7:00 PM – 2:00 AM</dd><dt>Sat</dt><dd>7:00 PM – 2:00 AM</dd><dt>Sun</dt><dd class="closed">Closed</dd></dl></section><div class="bcdInfoNight">Karaoke every Thursday night</div><div class="bcdInfoActions"><a class="btn gold" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Open in Maps ↗</a><button type="button" class="btn ghost" id="copyVenueAddress">Copy address</button></div></div></section></div>`);
      document.querySelector('.bcdInfoClose').addEventListener('click', closeAboutBCD);
      document.getElementById('copyVenueAddress').addEventListener('click', copyVenueAddress);
      document.getElementById('bcdInfoModal').addEventListener('click', event => { if (event.target.id === 'bcdInfoModal') closeAboutBCD(); });
    }

    window.openAboutBCD = openAboutBCD;
    window.closeAboutBCD = closeAboutBCD;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
