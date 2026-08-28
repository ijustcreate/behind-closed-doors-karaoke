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
    } catch {
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
      .headerActions{display:flex!important;align-items:center;gap:7px}.headerActions #userBtn{display:none!important}
      .aboutVenueButton{width:42px;height:36px;padding:0;display:grid;place-items:center;border:1px solid rgba(199,164,91,.55);border-radius:3px;background:linear-gradient(#2c2117,#19130e);color:#e6c47d;font:600 20px/1 Georgia,serif;transition:border-color .18s ease,color .18s ease,background .18s ease}.aboutVenueButton:hover,.aboutVenueButton:focus-visible{border-color:var(--brass);color:#f4e9d6;background:linear-gradient(#342619,#1b140e);outline:none}
      .bcdInfoModal{z-index:1000;padding:clamp(14px,4vw,46px);background:rgba(2,2,2,.82);backdrop-filter:blur(10px)}
      .bcdInfoModal .modal{position:relative;width:min(970px,100%);max-height:calc(100dvh - 28px);padding:0;overflow:auto;border:1px solid #c89a4d;border-radius:17px;background:#100b09;color:#eee0c8;box-shadow:0 34px 115px rgba(0,0,0,.82),0 0 48px rgba(108,49,17,.22)}
      .bcdInfoModal .modal:before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:repeating-linear-gradient(115deg,rgba(255,255,255,.016) 0 1px,transparent 1px 7px),url('assets/damask.jpg') center/510px;opacity:.14;mix-blend-mode:screen}
      .bcdInfoHero,.bcdInfoBody{position:relative;z-index:1}.bcdInfoHero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(270px,.92fr);min-height:318px;border-bottom:1px solid rgba(207,164,82,.38);background:linear-gradient(110deg,#2b1210 0%,#150e0c 57%,#090807 100%)}
      .bcdInfoIntro{padding:clamp(30px,5vw,56px);padding-right:clamp(24px,4vw,44px);align-self:center}.bcdInfoMark{display:block;width:67px;height:62px;margin:0 0 17px;background:url('assets/bcd-key-mark.svg') center/contain no-repeat}.bcdInfoIntro h3{margin:0;color:#f2cd7e;font:500 clamp(43px,7vw,76px)/.96 Georgia,serif;letter-spacing:-.035em}.bcdInfoSubtitle{max-width:430px;margin:22px 0 0;color:#e1b868;font:600 clamp(11px,1.9vw,16px)/1.62 ui-sans-serif,system-ui;letter-spacing:.22em;text-transform:uppercase}.bcdInfoRule{display:flex;align-items:center;gap:9px;max-width:420px;margin-top:24px;color:#cf9d46}.bcdInfoRule:before,.bcdInfoRule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(207,157,70,.82))}.bcdInfoRule:after{background:linear-gradient(90deg,rgba(207,157,70,.82),transparent)}
      .bcdInfoHeroVisual{position:relative;overflow:hidden;background:linear-gradient(90deg,#150e0c 0%,transparent 28%),linear-gradient(180deg,rgba(5,4,3,.05),rgba(5,4,3,.58)),url('assets/back-bar-bottles.png') 54% center/cover}.bcdInfoHeroVisual:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,8,6,.82),transparent 45%),linear-gradient(0deg,rgba(4,3,2,.66),transparent 45%)}.bcdDoorPlaque{position:absolute;z-index:1;right:9%;top:50%;width:155px;min-height:187px;transform:translateY(-50%);display:grid;place-items:center;padding:20px;border:1px solid #c7933d;outline:1px solid rgba(229,184,92,.3);outline-offset:7px;background:rgba(14,9,6,.78);box-shadow:0 0 0 10px rgba(0,0,0,.22),0 18px 38px rgba(0,0,0,.62);color:#dbab59;text-align:center;font:500 20px/1.15 Georgia,serif;text-transform:uppercase}.bcdDoorPlaque small{display:block;margin-top:14px;color:#e7c274;font-size:25px}
      .bcdInfoBody{padding:clamp(25px,4vw,44px);background:linear-gradient(145deg,rgba(16,10,8,.82),rgba(6,5,4,.91))}.bcdInfoLead{max-width:590px;margin:0;color:#f0e0c4;font:400 clamp(17px,2vw,22px)/1.58 Georgia,serif}.bcdInfoLead strong{color:#f6d38a;font-weight:600}.bcdInfoLead br{display:block;content:'';margin-top:14px}
      .bcdInfoDetail{display:flex;align-items:center;gap:17px;margin:31px 0 22px;padding:19px 22px;border:1px solid rgba(207,157,70,.78);background:linear-gradient(100deg,rgba(33,16,11,.9),rgba(10,8,7,.72)),url('assets/damask.jpg') center/370px;color:#f2d28f;font:500 clamp(18px,2.3vw,27px)/1.25 Georgia,serif}.bcdInfoDetail span{display:grid;place-items:center;width:42px;height:42px;flex:0 0 auto;border:1px solid #d4a34d;border-radius:50%;color:#efc46f;font:22px/1 Georgia,serif}.bcdInfoDetail address{font-style:normal}
      .bcdHours{margin:0;padding:25px 24px 28px;border:1px solid rgba(207,157,70,.48);background:rgba(255,255,255,.018)}.bcdHoursTitle{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:21px;color:#e2b666;font:600 14px/1 ui-sans-serif,system-ui;letter-spacing:.26em;text-transform:uppercase}.bcdHoursTitle:before,.bcdHoursTitle:after{content:'◆';font-size:8px;color:#c7963d}.bcdHoursGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 35px}.bcdHoursColumn{display:grid;grid-template-columns:auto 1fr;gap:0 14px;margin:0}.bcdHoursColumn+.bcdHoursColumn{padding-left:35px;border-left:1px solid rgba(207,157,70,.36)}.bcdHoursGrid dt,.bcdHoursGrid dd{padding:8px 0;border-bottom:1px solid rgba(207,157,70,.13);font:600 14px/1.25 ui-sans-serif,system-ui}.bcdHoursGrid dt{color:#f0d6a3;letter-spacing:.08em;text-transform:uppercase}.bcdHoursGrid dd{margin:0;color:#e5d3b6;text-align:right}.bcdHoursGrid .closed{color:#a89880}
      .bcdInfoNight{display:table;margin:-1px auto 0;padding:13px 24px;border:1px solid rgba(220,170,75,.72);background:linear-gradient(110deg,#3f1115,#260b0e);color:#f0c771;font:600 13px/1 ui-sans-serif,system-ui;letter-spacing:.17em;text-align:center;text-transform:uppercase}.bcdInfoActions{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:31px}.bcdInfoActions .btn{min-height:64px;display:flex;align-items:center;justify-content:center;border-radius:4px;text-decoration:none;text-transform:uppercase;letter-spacing:.12em}.bcdInfoActions .btn.gold{background:linear-gradient(135deg,#e3b85f,#9b6b26);color:#130d08;border-color:#f3d483;font-weight:800}.bcdInfoActions .btn.ghost{border-color:rgba(217,170,83,.63);background:rgba(21,14,10,.68);color:#ead2a1}.bcdInfoClose{position:absolute;z-index:3;right:20px;top:20px;display:grid;place-items:center;width:56px;height:56px;padding:0;border:1px solid rgba(231,186,97,.72);border-radius:50%;background:rgba(11,8,6,.68);color:#f3d39a;font:300 42px/1 ui-sans-serif,system-ui;box-shadow:0 6px 22px rgba(0,0,0,.45)}.bcdInfoClose:hover,.bcdInfoClose:focus-visible{background:#32170e;border-color:#f1cf88;outline:none}
      @media(max-width:680px){.bcdInfoModal{padding:10px}.bcdInfoModal .modal{border-radius:10px}.bcdInfoHero{grid-template-columns:1fr;min-height:0}.bcdInfoIntro{padding:35px 25px 31px}.bcdInfoIntro h3{font-size:48px}.bcdInfoSubtitle{font-size:11px;letter-spacing:.16em}.bcdInfoHeroVisual{min-height:172px;background-position:center}.bcdDoorPlaque{right:13%;width:121px;min-height:138px;padding:14px;font-size:16px}.bcdInfoBody{padding:24px 18px}.bcdInfoLead{font-size:17px}.bcdInfoDetail{margin-top:24px;padding:15px;font-size:18px}.bcdHours{padding:21px 14px}.bcdHoursGrid{gap:0 15px}.bcdHoursColumn+.bcdHoursColumn{padding-left:15px}.bcdHoursGrid dt,.bcdHoursGrid dd{font-size:11px}.bcdInfoNight{padding:11px 14px;font-size:10px;letter-spacing:.11em}.bcdInfoActions{grid-template-columns:1fr;gap:9px;margin-top:23px}.bcdInfoActions .btn{min-height:54px;font-size:11px}.bcdInfoClose{right:12px;top:12px;width:45px;height:45px;font-size:33px}}
      @media(prefers-reduced-motion:reduce){.aboutVenueButton{transition:none}}
    </style>`);

    const actions = document.querySelector('.headerActions');
    if (actions && !document.getElementById('aboutVenueButton')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="aboutVenueButton" class="aboutVenueButton" type="button" aria-label="What is Behind Closed Doors?" title="What is BCD?">?</button>');
      document.getElementById('aboutVenueButton').addEventListener('click', openAboutBCD);
    }

    if (!document.getElementById('bcdInfoModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="bcdInfoModal" class="modalWrap bcdInfoModal" role="dialog" aria-modal="true" aria-labelledby="bcdInfoTitle"><section class="modal"><button type="button" class="bcdInfoClose" aria-label="Close venue information">×</button><div class="bcdInfoHero"><div class="bcdInfoIntro"><span class="bcdInfoMark" aria-hidden="true"></span><h3 id="bcdInfoTitle">What is BCD?</h3><p class="bcdInfoSubtitle">An upscale speakeasy in the heart of the Miracle Mile</p><div class="bcdInfoRule" aria-hidden="true">◆</div></div><div class="bcdInfoHeroVisual" aria-hidden="true"><div class="bcdDoorPlaque">Behind<br>Closed<br>Doors<small>⌘</small></div></div></div><div class="bcdInfoBody"><p class="bcdInfoLead"><strong>Behind Closed Doors</strong> is a speakeasy tucked behind Seoul Soon Dubu Korean BBQ.<br>An after-hours mixologist cocktail bar known for delicious drinks, close conversations, and songs that deserve the mic.</p><div class="bcdInfoDetail"><span>⌖</span><address>${address}</address></div><section class="bcdHours" aria-labelledby="bcdHoursTitle"><div id="bcdHoursTitle" class="bcdHoursTitle">Bar hours</div><div class="bcdHoursGrid"><dl class="bcdHoursColumn"><dt>Sun</dt><dd class="closed">Closed</dd><dt>Mon</dt><dd class="closed">Closed</dd><dt>Tue</dt><dd class="closed">Closed</dd><dt>Wed</dt><dd class="closed">Closed</dd></dl><dl class="bcdHoursColumn"><dt>Thu</dt><dd>7:00 PM – 2:00 AM</dd><dt>Fri</dt><dd>7:00 PM – 2:00 AM</dd><dt>Sat</dt><dd>7:00 PM – 2:00 AM</dd></dl></div></section><div class="bcdInfoNight">Karaoke every Thursday night</div><div class="bcdInfoActions"><a class="btn gold" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Open in Maps ↗</a><button type="button" class="btn ghost" id="copyVenueAddress">Copy address</button></div></div></section></div>`);
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
