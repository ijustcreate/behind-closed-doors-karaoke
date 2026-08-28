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
      .headerActions{display:flex!important;align-items:center;gap:7px}.headerActions #userBtn{display:none!important}
      .aboutVenueButton{width:42px;height:36px;padding:0;display:grid;place-items:center;border:1px solid rgba(211,171,86,.58);border-radius:3px;background:linear-gradient(145deg,#342619,#18120d);color:#f1d182;font:600 20px/1 Georgia,serif;transition:.18s}.aboutVenueButton:hover,.aboutVenueButton:focus-visible{background:#432516;border-color:#f0c872;color:#fff0c8;outline:none}
      .bcdInfoModal{z-index:1000;padding:clamp(14px,4vw,46px);background:rgba(0,0,0,.83);backdrop-filter:blur(11px)}
      .bcdInfoModal .modal{position:relative;width:min(1000px,100%);max-height:calc(100dvh - 28px);padding:0;overflow:auto;border:1px solid #ca994a;border-radius:18px;background:#0d0a09;color:#f2e5cb;box-shadow:0 32px 120px rgba(0,0,0,.9),0 0 45px rgba(151,78,29,.22)}
      .bcdInfoModal .modal:before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.12;background:url('assets/damask.jpg') center/520px;mix-blend-mode:screen}.bcdInfoFeature,.bcdInfoDetails{position:relative;z-index:1}
      .bcdInfoFeature{display:grid;grid-template-columns:1.12fr .88fr;min-height:530px;background:linear-gradient(115deg,#2b1210 0%,#180e0d 53%,#090807 100%)}
      .bcdInfoCopy{padding:clamp(37px,5vw,58px);padding-right:clamp(28px,4vw,49px);align-self:center}.bcdInfoMark{display:block;width:69px;height:65px;margin:0 0 19px;background:url('assets/bcd-key-mark.svg') center/contain no-repeat}.bcdInfoCopy h3{margin:0;color:#f4d183;font:500 clamp(46px,6vw,77px)/.93 Georgia,serif;letter-spacing:-.045em}.bcdInfoKicker{max-width:440px;margin:23px 0 0;color:#e2b669;font:600 clamp(11px,1.65vw,16px)/1.65 ui-sans-serif,system-ui;letter-spacing:.23em;text-transform:uppercase}.bcdInfoRule{display:flex;align-items:center;gap:9px;max-width:420px;margin:25px 0 30px;color:#d19e49}.bcdInfoRule:before,.bcdInfoRule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,#ba7e32)}.bcdInfoRule:after{background:linear-gradient(90deg,#ba7e32,transparent)}.bcdInfoStory{max-width:515px;margin:0;color:#f0e2ca;font:400 clamp(18px,2vw,23px)/1.55 Georgia,serif}.bcdInfoStory strong{color:#f8d88f;font-weight:600}.bcdInfoStory br{display:block;content:'';margin-top:15px}
      .bcdInfoScene{position:relative;min-height:100%;overflow:hidden;background:linear-gradient(90deg,#160d0b 0%,transparent 32%),linear-gradient(0deg,rgba(0,0,0,.5),transparent 46%),url('assets/bcd-speakeasy-door.png') 54% center/cover}.bcdInfoScene:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,7,6,.48),transparent 34%)}
      .bcdInfoDetails{padding:clamp(27px,4.5vw,45px);background:linear-gradient(145deg,rgba(20,11,8,.95),rgba(7,6,5,.97))}.bcdInfoAddress{display:flex;align-items:center;gap:20px;padding:21px 27px;border:1px solid rgba(220,169,76,.85);background:linear-gradient(100deg,rgba(41,20,13,.76),rgba(13,10,8,.7)),url('assets/damask.jpg') center/380px;color:#f3d291;font:500 clamp(20px,2.4vw,29px)/1.2 Georgia,serif}.bcdInfoAddressIcon{display:grid;place-items:center;width:47px;height:47px;flex:none;border:1px solid #d2a24e;border-radius:50%;font:26px/1 Georgia,serif}.bcdInfoAddress address{font-style:normal}
      .bcdInfoHours{margin-top:25px;padding:28px 30px 30px;border:1px solid rgba(209,157,67,.48);background:rgba(255,255,255,.018)}.bcdInfoHours h4{display:flex;align-items:center;justify-content:center;gap:15px;margin:0 0 22px;color:#e5b967;font:600 14px/1 ui-sans-serif,system-ui;letter-spacing:.28em;text-transform:uppercase}.bcdInfoHours h4:before,.bcdInfoHours h4:after{content:'◆';font-size:8px}.bcdInfoHourGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 38px}.bcdInfoHourList{display:grid;grid-template-columns:auto 1fr;column-gap:15px;margin:0}.bcdInfoHourList+.bcdInfoHourList{padding-left:38px;border-left:1px solid rgba(209,157,67,.4)}.bcdInfoHourList dt,.bcdInfoHourList dd{padding:9px 0;border-bottom:1px solid rgba(209,157,67,.13);font:600 14px/1.25 ui-sans-serif,system-ui}.bcdInfoHourList dt{color:#f2d6a0;letter-spacing:.09em;text-transform:uppercase}.bcdInfoHourList dd{margin:0;color:#efe1c8;text-align:right}.bcdInfoHourList .closed{color:#ad9a7d}
      .bcdInfoNight{display:table;margin:-1px auto 0;padding:14px 29px;border:1px solid rgba(224,168,67,.77);background:linear-gradient(100deg,#4b1318,#260b0e);color:#f2ca76;font:600 13px/1 ui-sans-serif,system-ui;letter-spacing:.18em;text-transform:uppercase}.bcdInfoActions{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin-top:32px}.bcdInfoActions .btn{min-height:70px;display:flex;align-items:center;justify-content:center;border-radius:5px;text-decoration:none;text-transform:uppercase;letter-spacing:.13em}.bcdInfoActions .gold{border:1px solid #f1cf82;background:linear-gradient(135deg,#e5b858,#a46e23);box-shadow:inset 0 0 0 2px rgba(255,231,171,.2),0 4px 15px rgba(0,0,0,.36);color:#180e07;font-weight:800}.bcdInfoActions .ghost{border:1px solid rgba(219,165,71,.68);background:rgba(18,12,9,.76);color:#efd6a0}.bcdInfoClose{position:absolute;z-index:3;right:20px;top:20px;width:58px;height:58px;padding:0;border:1px solid rgba(235,187,96,.74);border-radius:50%;background:rgba(10,8,6,.66);color:#f4d49a;font:300 43px/1 ui-sans-serif,system-ui;box-shadow:0 7px 23px rgba(0,0,0,.5)}.bcdInfoClose:hover,.bcdInfoClose:focus-visible{background:#34190e;border-color:#f5d28a;outline:none}
      @media(max-width:700px){.bcdInfoModal{padding:10px}.bcdInfoModal .modal{border-radius:11px}.bcdInfoFeature{grid-template-columns:1fr;min-height:0}.bcdInfoCopy{padding:35px 25px 32px}.bcdInfoCopy h3{font-size:49px}.bcdInfoKicker{font-size:11px;letter-spacing:.16em}.bcdInfoRule{margin:22px 0 25px}.bcdInfoStory{font-size:17px}.bcdInfoScene{min-height:292px;background-position:center 47%}.bcdInfoDetails{padding:23px 17px}.bcdInfoAddress{gap:13px;padding:16px;font-size:18px}.bcdInfoAddressIcon{width:39px;height:39px;font-size:21px}.bcdInfoHours{margin-top:18px;padding:22px 14px}.bcdInfoHourGrid{gap:0 15px}.bcdInfoHourList+.bcdInfoHourList{padding-left:15px}.bcdInfoHourList dt,.bcdInfoHourList dd{font-size:11px}.bcdInfoNight{padding:11px 14px;font-size:10px;letter-spacing:.11em}.bcdInfoActions{grid-template-columns:1fr;gap:9px;margin-top:24px}.bcdInfoActions .btn{min-height:55px;font-size:11px}.bcdInfoClose{right:12px;top:12px;width:45px;height:45px;font-size:33px}}
    </style>`);

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
    window.openAboutBCD = openAboutBCD;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
