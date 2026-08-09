(function () {
  const FACE_GAP_VARIABLE = '--menu-face-offset';
  let flipFrame = 0;

  function visibleMenuFace(stage) {
    const book = stage.querySelector('.menuBook');
    return book?.classList.contains('is-open')
      ? stage.querySelector('.menuPage')
      : stage.querySelector('.menuCover');
  }

  function alignBarMenu() {
    const stage = document.getElementById('menuStage');
    const barMenu = document.getElementById('barMenu');
    const face = stage && visibleMenuFace(stage);
    if (!stage || !barMenu || !face) return;

    const stageBounds = stage.getBoundingClientRect();
    const faceBounds = face.getBoundingClientRect();
    if (!stageBounds.height || !faceBounds.height) return;

    // The 3D perspective makes the exposed menu face shorter than its layout
    // container. Pull the bar panel up by exactly that visual difference.
    const visualOffset = Math.min(0, faceBounds.bottom - stageBounds.bottom);
    barMenu.style.setProperty(FACE_GAP_VARIABLE, `${visualOffset.toFixed(2)}px`);
  }

  function followFlip() {
    cancelAnimationFrame(flipFrame);
    const startedAt = performance.now();
    const update = () => {
      alignBarMenu();
      if (performance.now() - startedAt < 900) flipFrame = requestAnimationFrame(update);
    };
    update();
  }

  function install() {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<style>#barMenu{margin-top:var(--menu-face-offset,0px)!important}</style>'
    );

    const stage = document.getElementById('menuStage');
    const book = document.getElementById('menuBook');
    if (!stage || !book) return;

    const observer = new ResizeObserver(alignBarMenu);
    observer.observe(stage);
    const page = stage.querySelector('.menuPage');
    const cover = stage.querySelector('.menuCover');
    if (page) observer.observe(page);
    if (cover) observer.observe(cover);

    new MutationObserver(followFlip).observe(book, {
      attributes: true,
      attributeFilter: ['class']
    });
    book.addEventListener('transitionrun', followFlip);
    window.addEventListener('resize', alignBarMenu);
    window.addEventListener('pageshow', alignBarMenu);

    requestAnimationFrame(alignBarMenu);
    setTimeout(alignBarMenu, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
