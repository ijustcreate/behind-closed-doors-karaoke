(function () {
  'use strict';

  const fullName = 'Behind Closed Doors';
  const animationLength = 860;

  function installBrandMotion() {
    if (document.getElementById('brand-motion-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'brand-motion-styles';
    styles.textContent = `
      #brandName.isAnimating {
        pointer-events: none;
      }

      #brandName.isAnimating .brandCompact,
      #brandName.isAnimating .brandExpanded {
        transition-duration: .76s !important;
        transition-timing-function: cubic-bezier(.22,.82,.22,1) !important;
        will-change: transform, opacity, letter-spacing, text-shadow;
      }

      #brandName.isOpening .brandCompact {
        animation: bcdCompactOpening .76s cubic-bezier(.25,.82,.22,1) both;
      }

      #brandName.isOpening .brandExpanded {
        animation: bcdTitleOpening .86s cubic-bezier(.25,.82,.22,1) both;
      }

      #brandName.isClosing .brandExpanded {
        animation: bcdTitleClosing .66s cubic-bezier(.3,.04,.2,1) both;
      }

      #brandName.isClosing .brandCompact {
        animation: bcdCompactClosing .82s cubic-bezier(.25,.82,.22,1) both;
      }

      @keyframes bcdCompactOpening {
        0% { opacity: 1; transform: translateX(0) scaleX(1) scaleY(1); letter-spacing: inherit; }
        18% { opacity: 1; transform: translateX(0) scaleX(.58) scaleY(1.16); letter-spacing: .015em; }
        44% { opacity: .92; transform: translateX(0) scaleX(1.04) scaleY(.94); letter-spacing: .5em; }
        66% { opacity: .45; transform: translateX(7px) scaleX(1.08); letter-spacing: .62em; }
        100% { opacity: 0; transform: translateX(14px) scaleX(.82); letter-spacing: .12em; }
      }

      @keyframes bcdTitleOpening {
        0%, 34% { opacity: 0; transform: translateX(-13px) scaleX(.74) scaleY(1.05); letter-spacing: .13em; text-shadow: none; }
        58% { opacity: 1; transform: translateX(0) scaleX(1.035) scaleY(.97); letter-spacing: .055em; text-shadow: none; }
        72% { opacity: 1; transform: translateX(0) scaleX(.82) scaleY(1.12); letter-spacing: .035em; text-shadow: 0 0 8px rgba(230,196,125,.48); }
        85% { opacity: 1; transform: translateX(0) scaleX(1.045) scaleY(.96); letter-spacing: .055em; text-shadow: 0 0 24px rgba(230,196,125,.8), 0 0 44px rgba(201,162,87,.36); }
        100% { opacity: 1; transform: translateX(0) scaleX(1) scaleY(1); letter-spacing: .045em; text-shadow: 0 0 10px rgba(230,196,125,.18); }
      }

      @keyframes bcdTitleClosing {
        0% { opacity: 1; transform: translateX(0) scaleX(1) scaleY(1); letter-spacing: .045em; text-shadow: 0 0 10px rgba(230,196,125,.18); }
        27% { opacity: 1; transform: translateX(0) scaleX(1.13) scaleY(.94); letter-spacing: .065em; text-shadow: 0 0 20px rgba(230,196,125,.52); }
        62% { opacity: .42; transform: translateX(3px) scaleX(.24) scaleY(1.2); letter-spacing: .01em; text-shadow: 0 0 6px rgba(230,196,125,.24); }
        100% { opacity: 0; transform: translateX(12px) scaleX(.72); letter-spacing: .02em; text-shadow: none; }
      }

      @keyframes bcdCompactClosing {
        0%, 47% { opacity: 0; transform: translateX(-9px) scaleX(.42) scaleY(1.1); letter-spacing: .35em; }
        64% { opacity: 1; transform: translateX(0) scaleX(1.18) scaleY(.9); letter-spacing: .5em; }
        80% { opacity: 1; transform: translateX(0) scaleX(.89) scaleY(1.08); letter-spacing: .03em; }
        100% { opacity: 1; transform: translateX(0) scaleX(1) scaleY(1); letter-spacing: inherit; }
      }

      @media (prefers-reduced-motion: reduce) {
        #brandName.isAnimating .brandCompact,
        #brandName.isAnimating .brandExpanded {
          animation: none !important;
          transition-duration: .01ms !important;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  function applyBrandTitle() {
    document.title = `BCD | ${fullName} Karaoke Club`;

    const brand = document.getElementById('brandName');
    if (brand) {
      brand.innerHTML = `<span class="brandCompact">BCD</span><span class="brandExpanded">${fullName}</span>`;
      brand.setAttribute('aria-label', `BCD — ${fullName} Karaoke Club`);
      brand.setAttribute('aria-expanded', 'false');
      brand.classList.remove('isExpanded', 'isAnimating', 'isOpening', 'isClosing', 'brandPulse');
    }

    const subtitle = document.querySelector('.brand small');
    if (subtitle) subtitle.textContent = 'Speakeasy · Karaoke · After Hours';
  }

  function toggleBrandName() {
    const brand = document.getElementById('brandName');
    if (!brand || brand.classList.contains('isAnimating')) return;

    const opening = brand.getAttribute('aria-expanded') !== 'true';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    brand.setAttribute('aria-expanded', String(opening));
    brand.classList.toggle('isExpanded', opening);
    brand.classList.add('isAnimating', opening ? 'isOpening' : 'isClosing');

    window.setTimeout(() => {
      brand.classList.remove('isAnimating', 'isOpening', 'isClosing');
    }, reducedMotion ? 20 : animationLength);
  }

  function bindBrandInteraction() {
    const brand = document.getElementById('brandName');
    if (!brand || brand.dataset.brandMotionBound === 'true') return;

    // A later header-polish script replaces the global click function. Binding
    // directly keeps this motion attached while allowing it to update the text.
    brand.removeAttribute('onclick');
    brand.removeAttribute('onkeydown');
    brand.addEventListener('click', toggleBrandName);
    brand.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleBrandName();
    });
    brand.dataset.brandMotionBound = 'true';
  }

  installBrandMotion();
  window.toggleBrandName = toggleBrandName;

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      applyBrandTitle();
      window.setTimeout(bindBrandInteraction, 0);
    });
  } else {
    applyBrandTitle();
    bindBrandInteraction();
  }
})();
