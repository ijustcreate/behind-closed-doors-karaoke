(function () {
  'use strict';

  const guestIdentity = {
    compact: 'B C D',
    full: 'Behind Closed Doors',
    tagline: 'Speakeasy · Karaoke · After Hours'
  };
  const memberIdentity = {
    compact: 'B C D K C',
    full: 'Behind Closed Doors Karaoke Club',
    tagline: 'Speakeasy · Karaoke · After Hours'
  };

  function lockLanding() {
    const landing = document.getElementById('landing');
    const shell = document.querySelector('.shell');
    if (!landing || landing.classList.contains('dismissed')) return;
    document.documentElement.classList.add('landing-active');
    document.body.classList.add('landing-active');
    landing.setAttribute('role', 'dialog');
    landing.setAttribute('aria-modal', 'true');
    shell?.setAttribute('inert', '');
    shell?.setAttribute('aria-hidden', 'true');
  }

  function unlockLanding() {
    const shell = document.querySelector('.shell');
    document.documentElement.classList.remove('landing-active');
    document.body.classList.remove('landing-active');
    shell?.removeAttribute('inert');
    shell?.removeAttribute('aria-hidden');
  }

  const nativeEnterSite = window.enterSite;
  if (typeof nativeEnterSite === 'function') {
    window.enterSite = function () {
      const result = nativeEnterSite.apply(this, arguments);
      unlockLanding();
      return result;
    };
  }

  document.head.insertAdjacentHTML('beforeend', '<style>html.landing-active,body.landing-active{height:100%;overflow:hidden!important;overscroll-behavior:none}body.landing-active{position:fixed;inset:0;width:100%;touch-action:none}body.landing-active .shell{pointer-events:none;user-select:none}</style>');
  lockLanding();

  function isSignedIn() {
    return Boolean(window.currentUser?.());
  }

  function applyHeaderIdentity() {
    const brand = document.getElementById('brandName');
    const tagline = document.querySelector('.brand small');
    if (!brand || !tagline) return;
    const identity = isSignedIn() ? memberIdentity : guestIdentity;
    const expanded = brand.getAttribute('aria-expanded') === 'true';
    brand.innerHTML = `<span class="brandCompact">${identity.compact}</span><span class="brandExpanded">${identity.full}</span>`;
    brand.setAttribute('aria-label', `${identity.compact} — ${identity.full}`);
    brand.setAttribute('aria-expanded', String(expanded));
    brand.classList.toggle('isExpanded', expanded);
    tagline.textContent = identity.tagline;
  }

  function toggleHeaderIdentity() {
    const brand = document.getElementById('brandName');
    if (!brand) return;
    const expanded = brand.getAttribute('aria-expanded') === 'true';
    brand.setAttribute('aria-expanded', String(!expanded));
    brand.classList.toggle('isExpanded', !expanded);
    brand.classList.remove('brandPulse');
    void brand.offsetWidth;
    brand.classList.add('brandPulse');
  }

  function applyDrinkHeader() {
    const intro = document.querySelector('.menuIntro');
    if (!intro) return;
    intro.innerHTML = '<div class="drinkHeaderCopy"><div class="eyebrow">Welcome to the bar</div><h2>Find your flavor.<br>Make it a night.</h2><p>Browse tonight&apos;s specialty cocktails, then let Sara and Orlando craft your perfect pour.</p></div>';
  }

  function install() {
    document.head.insertAdjacentHTML('beforeend', '<style>.brandrow::after{content:none!important;display:none!important}#brandName .brandCompact{letter-spacing:.19em}#brandName .brandExpanded{letter-spacing:.035em}.brand small{white-space:nowrap}.drinkPanel .menuIntro{max-width:920px;margin:0 auto 18px;text-align:left}.drinkHeaderCopy{padding:18px 20px;border:1px solid rgba(201,162,87,.27);background:linear-gradient(90deg,rgba(39,25,16,.76),rgba(18,12,9,.42))}.drinkHeaderCopy .eyebrow{position:static!important;z-index:auto!important;top:auto!important;left:auto!important;display:block!important;margin:0 0 4px!important;padding:0!important;transform:none!important;background:transparent!important;border:0!important;white-space:normal!important}.drinkHeaderCopy h2{margin:0 0 7px;color:#e9cc90;font:500 clamp(25px,4vw,40px)/1.05 Georgia,serif}.drinkHeaderCopy p{max-width:650px;margin:0;color:#c9b99d;font-size:12px;line-height:1.55}@media(max-width:620px){#brandName .brandCompact{letter-spacing:.12em}#brandName.isExpanded{font-size:clamp(14px,4.25vw,20px)!important;letter-spacing:.025em!important}#brandName.isExpanded .brandExpanded{max-width:calc(100vw - 64px)!important}.brand small{font-size:7.5px!important;letter-spacing:.1em!important}.drinkPanel .menuIntro{margin-bottom:12px}.drinkHeaderCopy{padding:15px 14px}.drinkHeaderCopy h2{font-size:28px}.drinkHeaderCopy p{font-size:11px}}</style>');
    document.head.insertAdjacentHTML('beforeend', '<style>.drinkPanel .menuIntro{max-width:none;margin:0 0 18px;text-align:left}.drinkHeaderCopy{position:relative;isolation:isolate;min-height:175px;box-sizing:border-box;overflow:hidden;padding:22px 24px;background:linear-gradient(90deg,rgba(6,9,10,.97) 0%,rgba(7,11,13,.88) 55%,rgba(8,21,25,.38)),linear-gradient(rgba(19,57,62,.22),rgba(8,24,30,.22)),url("assets/back-bar-bottles.png") right 54%/auto 125% no-repeat,#080b0d;border:1px solid rgba(201,162,87,.28);box-shadow:var(--shadow)}.drinkHeaderCopy:after{content:"";position:absolute;width:210px;height:210px;border:1px solid rgba(201,162,87,.12);border-radius:50%;right:-80px;top:-95px;box-shadow:0 0 0 18px rgba(201,162,87,.02),0 0 0 42px rgba(201,162,87,.018);z-index:-1}.drinkHeaderCopy>*{position:relative;z-index:1}.drinkHeaderCopy .eyebrow{color:#d2a75a!important;font-size:11px!important;letter-spacing:.18em!important;text-transform:uppercase!important}.drinkHeaderCopy h2{max-width:610px;margin:7px 0 8px!important;color:#f2dba9!important;font:500 clamp(28px,3.4vw,43px)/1.05 Georgia,serif!important}.drinkHeaderCopy p{max-width:610px!important;margin:0!important;color:var(--muted)!important;font-size:13px!important;line-height:1.48!important}@media(max-width:620px){.drinkPanel .menuIntro{margin-bottom:12px}.drinkHeaderCopy{min-height:0;padding:16px 15px;background-position:right 54%,right 54%,right 54%,center}.drinkHeaderCopy h2{font-size:27px!important}.drinkHeaderCopy p{font-size:11px!important;line-height:1.45!important}}</style>');
    document.head.insertAdjacentHTML('beforeend', '<style>.drinkPanel{padding:0 0 20px!important;border:0!important;background:transparent!important;box-shadow:none!important}.drinkHeaderCopy{background:linear-gradient(90deg,rgba(5,4,3,.68) 0%,rgba(5,4,3,.48) 42%,rgba(5,4,3,.14) 68%,rgba(5,4,3,0) 86%),url("assets/back-bar-bottles.png") right center/cover}.drinkHeaderCopy h2,.drinkHeaderCopy p{text-shadow:0 2px 14px rgba(0,0,0,.72)}.drinkHeaderCopy p{max-width:50%!important}@media(max-width:620px){.drinkHeaderCopy{padding:14px 15px;background-position:right center}.drinkHeaderCopy h2{margin:4px 0 6px!important;font-size:25px!important}.drinkHeaderCopy p{max-width:52%!important;line-height:1.48!important}}</style>');
    const drinksTab = document.querySelector('.tab[data-tab="drinks"]');
    if (drinksTab) drinksTab.textContent = 'Drink Menu';
    window.toggleBrandName = toggleHeaderIdentity;
    const previousUpdateBadges = window.updateBadges;
    if (typeof previousUpdateBadges === 'function') {
      window.updateBadges = function () {
        const result = previousUpdateBadges.apply(this, arguments);
        applyHeaderIdentity();
        return result;
      };
    }
    applyHeaderIdentity();
    applyDrinkHeader();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', install);
  else install();
})();
