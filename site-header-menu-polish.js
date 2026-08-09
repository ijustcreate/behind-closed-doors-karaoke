(function () {
  'use strict';

  const guestIdentity = {
    compact: 'B C D',
    full: 'Behind Closed Doors',
    tagline: 'Speakeasy · After Hours · Hidden Stage'
  };
  const memberIdentity = {
    compact: 'B C D K C',
    full: 'Behind Closed Doors Karaoke Club',
    tagline: 'Speakeasy · Karaoke · Magic'
  };

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
    intro.innerHTML = '<div class="drinkHeaderCopy"><div class="eyebrow">Behind the Bar</div><h2>Specialty Drink Menu</h2><p>Tap the menu. When you’re ready, let Sara and Orlando enchant you with an expertly prepared spirit.</p></div>';
  }

  function install() {
    document.head.insertAdjacentHTML('beforeend', '<style>.brandrow::after{content:none!important;display:none!important}#brandName .brandCompact{letter-spacing:.19em}#brandName .brandExpanded{letter-spacing:.035em}.brand small{white-space:nowrap}.drinkPanel .menuIntro{max-width:920px;margin:0 auto 18px;text-align:left}.drinkHeaderCopy{padding:18px 20px;border:1px solid rgba(201,162,87,.27);background:linear-gradient(90deg,rgba(39,25,16,.76),rgba(18,12,9,.42))}.drinkHeaderCopy .eyebrow{margin:0 0 4px}.drinkHeaderCopy h2{margin:0 0 7px;color:#e9cc90;font:500 clamp(25px,4vw,40px)/1.05 Georgia,serif}.drinkHeaderCopy p{max-width:650px;margin:0;color:#c9b99d;font-size:12px;line-height:1.55}@media(max-width:620px){#brandName .brandCompact{letter-spacing:.12em}#brandName.isExpanded{font-size:16px!important}#brandName.isExpanded .brandExpanded{max-width:250px}.brand small{font-size:7.5px!important;letter-spacing:.1em!important}.drinkPanel .menuIntro{margin-bottom:12px}.drinkHeaderCopy{padding:15px 14px}.drinkHeaderCopy h2{font-size:28px}.drinkHeaderCopy p{font-size:11px}}</style>');
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
