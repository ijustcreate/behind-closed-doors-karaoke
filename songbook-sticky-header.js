/* Keep every Songbook filter visible below the installed app's frozen header. */
(function () {
  'use strict';

  function syncOffsets() {
    if (!window.matchMedia('(max-width: 620px)').matches) return;
    const header = document.querySelector('.topbar');
    const toolbar = document.querySelector('[data-view="songbook"] .toolbar');
    if (!header || !toolbar) return;

    // The standalone iOS header is taller than the browser header. Its live
    // height is the only safe sticky offset: a fixed value clips the search row.
    document.documentElement.style.setProperty(
      '--songbook-sticky-header-bottom',
      `${Math.max(0, Math.round(header.getBoundingClientRect().bottom))}px`
    );
    document.documentElement.style.setProperty(
      '--songbook-sticky-toolbar-height',
      `${Math.ceil(toolbar.getBoundingClientRect().height)}px`
    );
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', `<style>
      @media(max-width:620px){
        [data-view="songbook"] .toolbar{top:var(--songbook-sticky-header-bottom,0px)!important}
        [data-view="songbook"] .alphaRail{top:calc(var(--songbook-sticky-header-bottom,0px) + var(--songbook-sticky-toolbar-height,0px))!important}
      }
    </style>`);

    let frame = 0;
    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncOffsets);
    };
    syncOffsets();
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('orientationchange', scheduleSync, { passive: true });
    window.addEventListener('scroll', scheduleSync, { passive: true });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(scheduleSync);
      observer.observe(document.querySelector('.topbar'));
      observer.observe(document.querySelector('[data-view="songbook"] .toolbar'));
    }
  });
})();
