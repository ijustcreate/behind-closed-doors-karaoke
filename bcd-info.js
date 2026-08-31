(function () {
  'use strict';

  const address = '2041 Pacific Ave, Stockton, CA 95204';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  let previouslyFocused;

  function closeAboutBCD() {
    const modal = document.getElementById('bcdInfoModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus?.();
  }

  function onKeydown(event) { if (event.key === 'Escape') closeAboutBCD(); }

  function openAboutBCD() {
    const modal = document.getElementById('bcdInfoModal');
    if (!modal) return;
    previouslyFocused = document.activeElement;
    modal.classList.add('open');
    document.addEventListener('keydown', onKeydown);
    modal.querySelector('.bcdInfoClose')?.focus();
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(address); }
    catch {
      const field = Object.assign(document.createElement('textarea'), { value: address });
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field); field.select(); document.execCommand('copy'); field.remove();
    }
    window.toast?.('Address copied to your pocket');
  }

  function install() {
    document.head.insertAdjacentHTML('beforeend', `<style id="bcd-info-styles">
      .headerActions{display:flex!important;align-items:center;gap:7px}.headerActions #userBtn,#settingsBtn{display:none!important}
      .aboutVenueButton{width:42px;height:36px;padding:0;display:grid;place-items:center;border:0;border-radius:3px;background:#000 url('assets/bcd-question-logo.jpg') center/contain no-repeat;color:transparent;font-size:0;line-height:0;transition:filter .18s,transform .18s}.aboutVenueButton:hover,.aboutVenueButton:focus-visible{filter:brightness(1.2) drop-shadow(0 0 7px rgba(240,200,114,.45));transform:translateY(-1px);outline:1px solid #f0c872;outline-offset:2px}
      .bcdInfoModal{z-index:1000;padding:clamp(14px,4vw,46px);background:rgba(0,0,0,.83);backdrop-filter:blur(11px)}
      .bcdInfoModal .modal{position:relative;width:min(1000px,100%);max-height:calc(100dvh - 28px);padding:0;overflow:auto;border:1px solid #ca994a;border-radius:18px;background:#0d0a09;color:#f2e5cb;box-shadow:0 32px 120px rgba(0,0,0,.9),0 0 45px rgba(151,78,29,.22)}
      .bcdInfoModal .modal:before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.12;background:url('assets/damask.jpg') center/520px;mix-blend-mode:screen}.bcdInfoFeature,.bcdInfoDetails{position:relative;z-index:1}
      .bcdInfoFeature{display:grid;grid-template-columns:1.12fr .88fr;min-height:285px;background:linear-gradient(115deg,#2b1210 0%,#180e0d 53%,#090807 100%)}
      .bcdInfoCopy{padding:24px 31px;padding-right:28px;align-self:center}.bcdInfoMark{display:block;width:43px;height:41px;margin:0 0 8px;background:#000 url('assets/bcd-key-logo.jpg') center/contain no-repeat;transform:rotate(180deg)}.bcdInfoCopy h3{margin:0;color:#f4d183;font:500 clamp(38px,4.4vw,52px)/.93 Georgia,serif;letter-spacing:-.045em}.bcdInfoKicker{max-width:440px;margin:11px 0 0;color:#e2b669;font:600 11px/1.45 ui-sans-serif,system-ui;letter-spacing:.18em;text-transform:uppercase}.bcdInfoRule{display:flex;align-items:center;gap:9px;max-width:420px;margin:12px 0 15px;color:#d19e49}.bcdInfoRule:before,.bcdInfoRule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,#ba7e32)}.bcdInfoRule:after{background:linear-gradient(90deg,#ba7e32,transparent)}.bcdInfoStory{max-width:515px;margin:11px 0 0;color:#e2b669;font:600 11px/1.45 ui-sans-serif,system-ui;letter-spacing:.18em;text-transform:uppercase}.bcdInfoRule{display:flex;align-items:center;gap:9px;max-width:420px;margin:12px 0 15px;color:#d19e49}.bcdInfoRule:before,.bcdInfoRule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,#ba7e32)}.bcdInfoRule:after{background:linear-gradient(90deg,#ba7e32,transparent)}.bcdInfoStory{max-width:515px;margin:0;color:#f0e2ca;font:400 14px/1.4 Georgia,serif}.bcdInfoStory strong{color:#f8d88f;font-weight:600}.bcdInfoStory br{display:block;content:'';margin-top:7px}
      .bcdInfoScene{position:relative;min-height:100%;overflow:hidden;background:linear-gradient(90deg,#160d0b 0%,rgba(14,8,7,.78) 18%,transparent 49%),linear-gradient(180deg,rgba(5,3,3,.6),rgba(5,3,3,.22) 40%,rgba(5,3,3,.8)),url('assets/bcd-speakeasy-door.png') 54% center/cover}.bcdInfoScene:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,7,6,.52),transparent 34%)}
      .bcdInfoDetails{padding:14px 24px 18px;background:linear-gradient(145deg,rgba(20,11,8,.95),rgba(7,6,5,.97))}.bcdInfoAddress{position:relative;display:flex;align-items:center;gap:13px;padding:12px 18px;border:1px solid rgba(220,169,76,.9);outline:1px solid rgba(220,169,76,.27);outline-offset:4px;background:linear-gradient(100deg,rgba(41,20,13,.76),rgba(13,10,8,.7)),url('assets/damask.jpg') center/380px;color:#f3d291;font:500 19px/1.15 Georgia,serif}.bcdInfoAddress:before,.bcdInfoAddress:after{content:'';position:absolute;width:14px;height:14px;border-color:#efc366;border-style:solid}.bcdInfoAddress:before{left:-1px;top:-1px;border-width:2px 0 0 2px}.bcdInfoAddress:after{right:-1px;bottom:-1px;border-width:0 2px 2px 0}.bcdInfoAddressIcon{display:grid;place-items:center;width:36px;height:36px;flex:none;border:1px solid #d2a24e;border-radius:50%;font:19px/1 Georgia,serif}.bcdInfoAddress address{font-style:normal}
      .bcdInfoHours{margin-top:14px;padding:15px 20px 17px;border:1px solid rgba(209,157,67,.48);background:rgba(255,255,255,.018)}.bcdInfoHours h4{display:flex;align-items:center;justify-content:center;gap:15px;margin:0 0 10px;color:#e5b967;font:600 11px/1 ui-sans-serif,system-ui;letter-spacing:.28em;text-transform:uppercase}.bcdInfoHours h4:before,.bcdInfoHours h4:after{content:'◆';font-size:8px}.bcdInfoHourGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 25px}.bcdInfoHourList{display:grid;grid-template-columns:auto 1fr;column-gap:11px;margin:0}.bcdInfoHourList+.bcdInfoHourList{padding-left:25px;border-left:1px solid rgba(209,157,67,.4)}.bcdInfoHourList dt,.bcdInfoHourList dd{padding:4px 0;border-bottom:1px solid rgba(209,157,67,.13);font:600 11px/1.15 ui-sans-serif,system-ui}.bcdInfoHourList dt{color:#f2d6a0;letter-spacing:.09em;text-transform:uppercase}.bcdInfoHourList dd{margin:0;color:#efe1c8;text-align:right}.bcdInfoHourList .closed{color:#ad9a7d}
      .bcdInfoNight{display:table;margin:-1px auto 0;padding:10px 22px;border:1px solid rgba(224,168,67,.77);border-radius:0 0 8px 8px;background:linear-gradient(100deg,#4b1318,#260b0e);color:#f2ca76;font:600 10px/1 ui-sans-serif,system-ui;letter-spacing:.17em;text-transform:uppercase}.bcdInfoNight:before{content:'♬';margin-right:10px;font-size:15px;vertical-align:-1px}.bcdInfoActions{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}.bcdInfoActions .btn{min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:5px;text-decoration:none;text-transform:uppercase;letter-spacing:.13em;font-size:10px}.bcdInfoActions .gold{border:1px solid #f1cf82;background:linear-gradient(135deg,#e5b858,#a46e23);box-shadow:inset 0 0 0 2px rgba(255,231,171,.2),0 4px 15px rgba(0,0,0,.36);color:#180e07;font-weight:800}.bcdInfoActions .ghost{border:1px solid rgba(219,165,71,.68);background:rgba(18,12,9,.76);color:#efd6a0}.bcdInfoClose{position:absolute;z-index:3;right:14px;top:14px;width:43px;height:43px;padding:0;border:1px solid rgba(235,187,96,.74);border-radius:50%;background:rgba(10,8,6,.66);color:#f4d49a;font:300 31px/1 ui-sans-serif,system-ui;box-shadow:0 7px 23px rgba(0,0,0,.5)}.bcdInfoClose:hover,.bcdInfoClose:focus-visible{background:#34190e;border-color:#f5d28a;outline:none}
      @media(max-width:700px){.bcdInfoModal{padding:8px}.bcdInfoModal .modal{border-radius:11px}.bcdInfoFeature{min-height:225px}.bcdInfoCopy{padding:15px 17px}.bcdInfoMark{width:28px;height:27px;margin-bottom:5px}.bcdInfoCopy h3{font-size:31px}.bcdInfoKicker{margin-top:7px;font-size:8px;line-height:1.35;letter-spacing:.13em}.bcdInfoRule{margin:9px 0 10px}.bcdInfoStory{font-size:10.5px;line-height:1.32}.bcdInfoStory br{margin-top:4px}.bcdInfoScene{min-height:225px;background-position:center 47%}.bcdInfoDetails{padding:11px 13px 13px}.bcdInfoAddress{gap:9px;padding:10px;font-size:13px}.bcdInfoAddressIcon{width:30px;height:30px;font-size:16px}.bcdInfoHours{margin-top:12px;padding:12px 10px}.bcdInfoHours h4{margin-bottom:8px;font-size:9px}.bcdInfoHourGrid{gap:0 10px}.bcdInfoHourList+.bcdInfoHourList{padding-left:10px}.bcdInfoHourList dt,.bcdInfoHourList dd{padding:3px 0;font-size:9px}.bcdInfoNight{padding:8px 10px;font-size:8px;letter-spacing:.1em}.bcdInfoActions{gap:9px;margin-top:14px}.bcdInfoActions .btn{min-height:40px;font-size:8px}.bcdInfoClose{right:10px;top:10px;width:38px;height:38px;font-size:28px}}@media(max-width:420px){.bcdInfoFeature{grid-template-columns:1fr}.bcdInfoScene{min-height:195px}.bcdInfoActions{grid-template-columns:1fr}.bcdInfoHourList dt,.bcdInfoHourList dd{font-size:9px}}
    </style>`);
    document.head.insertAdjacentHTML('beforeend', `<style id="bcd-info-refinements">
      .bcdInfoFeature{grid-template-columns:1.12fr .88fr;overflow:hidden}.bcdInfoMark{transform:none}
      .bcdInfoCopy{position:relative;z-index:2;isolation:isolate;box-shadow:30px 0 44px rgba(17,8,7,.62)}
      .bcdInfoKicker span,.bcdInfoStory .bcdInfoLine{display:block;white-space:nowrap}
      .bcdInfoAddress{justify-content:center}.bcdInfoAddressIcon{position:absolute;left:18px}.bcdInfoAddress address{text-align:center}
      .bcdInfoScene{margin-left:-118px;background-position:25% center;mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.42) 12%,#000 29%,#000 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.42) 12%,#000 29%,#000 100%)}
      .bcdInfoScene{z-index:1}.bcdInfoScene:after{background:linear-gradient(90deg,rgba(19,9,8,.76),rgba(12,7,6,.2) 43%,transparent)}
      .bcdInfoNight{margin:14px auto 0;border-radius:8px}
      @media(max-width:700px){.bcdInfoFeature{grid-template-columns:1.24fr .76fr}.bcdInfoScene{margin-left:-86px;background-position:20% center}.bcdInfoKicker{font-size:7.5px;letter-spacing:.115em}.bcdInfoStory{font-size:9.4px;line-height:1.42}.bcdInfoAddressIcon{left:10px}.bcdInfoNight{margin-top:11px}}
      @media(max-width:520px){.bcdInfoFeature{display:block;min-height:0}.bcdInfoCopy{padding:17px 18px 19px;box-shadow:none}.bcdInfoScene{display:none}.bcdInfoCopy h3{padding-right:44px}.bcdInfoKicker span{white-space:normal}.bcdInfoStory{font-size:12px;line-height:1.48;letter-spacing:.045em;overflow-wrap:anywhere}.bcdInfoStory .bcdInfoLine{display:inline;white-space:normal}.bcdInfoStory .bcdInfoLine:not(:last-child):after{content:' '}.bcdInfoStory strong.bcdInfoLine{display:block;margin-bottom:3px}.bcdInfoStory strong.bcdInfoLine:after{content:''}.bcdInfoActions{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.bcdInfoFeature{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;min-height:300px}.bcdInfoCopy{padding:16px 14px!important;box-shadow:none}.bcdInfoScene{display:block!important;min-height:0!important;margin-left:0!important;background-position:center!important;mask-image:none!important;-webkit-mask-image:none!important}.bcdInfoCopy h3{padding-right:0;font-size:26px}.bcdInfoKicker{font-size:7px!important;line-height:1.35!important}.bcdInfoStory{font-size:9px!important;line-height:1.36!important;letter-spacing:0!important}.bcdInfoStory .bcdInfoLine{display:block!important;white-space:normal!important}.bcdInfoStory .bcdInfoLine:not(:last-child):after{content:''!important}.bcdInfoActions{grid-template-columns:1fr 1fr}}@media(max-width:350px){.bcdInfoActions{grid-template-columns:1fr}}
    </style>`);
    document.head.insertAdjacentHTML('beforeend', '<style id="bcd-info-mobile-blend">@media(max-width:520px){.bcdInfoFeature{overflow:hidden;min-height:345px!important}.bcdInfoCopy{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;padding:8px 10px!important;text-align:center;background:linear-gradient(90deg,#2b1210 0%,#25100f 72%,rgba(37,16,15,.1) 100%)}.bcdInfoMark{margin:0 auto!important}.bcdInfoRule{width:100%;margin:6px 0!important}.bcdInfoScene{position:relative;z-index:1;margin-left:-42px!important;padding-left:42px;background-position:center!important;mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.48) 40%,#000 100%)!important;-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.48) 40%,#000 100%)!important}.bcdInfoCopy h3{font:500 38px/1.02 Georgia,"Times New Roman",serif}.bcdInfoKicker{font:600 10.5px/1.38 ui-sans-serif,system-ui!important}.bcdInfoStory{align-self:center;max-width:96%;font:400 13.2px/1.4 Georgia,"Times New Roman",serif!important;letter-spacing:0!important;text-align:left;text-transform:none!important}.bcdInfoStory .bcdInfoLine,.bcdInfoStory strong{font-family:Georgia,"Times New Roman",serif!important;text-transform:none!important}.bcdInfoStory .bcdInfoLine:nth-child(3){font-size:.86em;white-space:nowrap!important}.bcdInfoStory strong{font-weight:600!important}}</style>');

    document.head.insertAdjacentHTML('beforeend', '<style id="bcd-info-copy-scale">.bcdInfoMark,.bcdInfoAddressIcon{display:none!important}@media(max-width:520px){.bcdInfoFeature{grid-template-columns:minmax(0,2fr) minmax(0,1fr)!important;min-height:315px!important}.bcdInfoCopy{align-self:center!important;justify-content:center!important;gap:8px;padding:18px!important}.bcdInfoCopy h3{font:500 38px/1.02 Georgia,"Times New Roman",serif!important}.bcdInfoKicker{font:600 10.5px/1.38 ui-sans-serif,system-ui!important;letter-spacing:.13em!important}.bcdInfoRule{margin:2px 0!important}.bcdInfoStory{max-width:100%!important;font:400 13.2px/1.4 Georgia,"Times New Roman",serif!important;text-align:left}.bcdInfoStory strong{font-size:1.06em}.bcdInfoScene{margin-left:-92px!important;padding-left:92px!important;background-position:27% center!important;mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.38) 33%,#000 69%)!important;-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.38) 33%,#000 69%)!important}.bcdInfoAddress{padding:11px 15px!important}}</style>');
    document.querySelector('.bcdInfoMark')?.remove();
    document.querySelector('.bcdInfoAddressIcon')?.remove();

    const actions = document.querySelector('.headerActions');
    if (actions && !document.getElementById('aboutVenueButton')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="aboutVenueButton" class="aboutVenueButton" type="button" aria-label="What is Behind Closed Doors?" title="What is BCD?">?</button>');
      document.getElementById('aboutVenueButton').addEventListener('click', openAboutBCD);
    }

    if (!document.getElementById('bcdInfoModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="bcdInfoModal" class="modalWrap bcdInfoModal" role="dialog" aria-modal="true" aria-labelledby="bcdInfoTitle"><section class="modal"><button class="bcdInfoClose" type="button" aria-label="Close venue information">×</button><div class="bcdInfoFeature"><div class="bcdInfoCopy"><span class="bcdInfoMark" aria-hidden="true"></span><h3 id="bcdInfoTitle">What is BCD?</h3><p class="bcdInfoKicker">An upscale speakeasy in the heart of the Miracle Mile</p><div class="bcdInfoRule" aria-hidden="true">◆</div><p class="bcdInfoStory"><strong>Behind Closed Doors</strong> is a speakeasy tucked behind Seoul Soon Dubu Korean BBQ.<br>An after-hours mixologist cocktail bar known for delicious drinks, close conversations, and songs that deserve the mic.</p></div><div class="bcdInfoScene" aria-hidden="true"></div></div><div class="bcdInfoDetails"><div class="bcdInfoAddress"><span class="bcdInfoAddressIcon" aria-hidden="true">⌖</span><address>${address}</address></div><section class="bcdInfoHours" aria-labelledby="bcdHoursTitle"><h4 id="bcdHoursTitle">Bar Hours</h4><div class="bcdInfoHourGrid"><dl class="bcdInfoHourList"><dt>Sun</dt><dd class="closed">Closed</dd><dt>Mon</dt><dd class="closed">Closed</dd><dt>Tue</dt><dd class="closed">Closed</dd><dt>Wed</dt><dd class="closed">Closed</dd></dl><dl class="bcdInfoHourList"><dt>Thu</dt><dd>7:00 PM – 2:00 AM</dd><dt>Fri</dt><dd>7:00 PM – 2:00 AM</dd><dt>Sat</dt><dd>7:00 PM – 2:00 AM</dd></dl></div></section><div class="bcdInfoNight">Karaoke every Thursday night</div><div class="bcdInfoActions"><a class="btn gold" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">⌖&nbsp; Open in Maps&nbsp; ↗</a><button class="btn ghost" id="copyVenueAddress" type="button">▣&nbsp; Copy Address</button></div></div></section></div>`);
      document.querySelector('.bcdInfoClose').addEventListener('click', closeAboutBCD);
      document.getElementById('copyVenueAddress').addEventListener('click', copyAddress);
      document.getElementById('bcdInfoModal').addEventListener('click', event => { if (event.target.id === 'bcdInfoModal') closeAboutBCD(); });
    }
    const kicker = document.querySelector('.bcdInfoKicker');
    if (kicker) kicker.innerHTML = '<span>AN UPSCALE SPEAKEASY</span><span>IN THE HEART OF</span><span>THE MIRACLE MILE</span>';
    const story = document.querySelector('.bcdInfoStory');
    if (story) story.innerHTML = '<strong class="bcdInfoLine">Behind Closed Doors</strong><span class="bcdInfoLine">is a speakeasy tucked behind</span><span class="bcdInfoLine">Seoul Soon Dubu Korean BBQ.</span><span class="bcdInfoLine">An after-hours cocktail bar</span><span class="bcdInfoLine">known for delicious drinks,</span><span class="bcdInfoLine">close conversations, and songs that deserve the mic.</span>';

    window.openAboutBCD = openAboutBCD;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
