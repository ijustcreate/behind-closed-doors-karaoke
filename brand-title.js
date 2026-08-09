(function () {
  'use strict';

  const fullName = 'Behind Closed Doors Karaoke Club';

  function applyBrandTitle() {
    document.title = `BCDKC | ${fullName}`;

    const brand = document.getElementById('brandName');
    if (brand) {
      brand.innerHTML = `<span class="brandCompact">BCDKC</span><span class="brandExpanded">${fullName}</span>`;
      brand.setAttribute('aria-label', `BCDKC — ${fullName}`);
      brand.setAttribute('aria-expanded', 'false');
      brand.classList.remove('isExpanded');
    }

    const subtitle = document.querySelector('.brand small');
    if (subtitle) subtitle.textContent = fullName;
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', applyBrandTitle);
  } else {
    applyBrandTitle();
  }
})();
