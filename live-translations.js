(function () {
  const copy = {
    en:{locale:'en-US',account:'My Account',tag:'Speakeasy · Karaoke · After Hours',title:'Title A–Z',artist:'Artist A–Z',sort:'Sort',list:'List',request:'Request',sang:'I sang this',didnt:'I didn’t sing this',song:'song',songs:'songs'},
    es:{locale:'es-ES',account:'Mi cuenta',tag:'Bar clandestino · Karaoke · Después de hora',title:'Título A–Z',artist:'Artista A–Z',sort:'Ordenar',list:'Lista',request:'Solicitar',sang:'La canté',didnt:'No la canté',song:'canción',songs:'canciones'},
    ko:{locale:'ko-KR',account:'내 계정',tag:'스피크이지 · 노래방 · 심야',title:'제목 가나다순',artist:'가수 가나다순',sort:'정렬',list:'목록',request:'요청',sang:'내가 불렀어요',didnt:'부르지 않았어요',song:'곡',songs:'곡'},
    zh:{locale:'zh-CN',account:'我的账户',tag:'地下酒吧 · 卡拉 OK · 深夜',title:'歌名 A–Z',artist:'歌手 A–Z',sort:'排序',list:'列表',request:'点歌',sang:'我唱了这首',didnt:'我没唱这首',song:'首歌',songs:'首歌'},
    ja:{locale:'ja-JP',account:'マイアカウント',tag:'隠れ家バー · カラオケ · 深夜',title:'曲名 A–Z',artist:'歌手 A–Z',sort:'並び替え',list:'一覧',request:'リクエスト',sang:'歌いました',didnt:'歌いませんでした',song:'曲',songs:'曲'},
    fr:{locale:'fr-FR',account:'Mon compte',tag:'Bar clandestin · Karaoké · Après les heures',title:'Titre A–Z',artist:'Artiste A–Z',sort:'Trier',list:'Liste',request:'Demander',sang:'Je l’ai chantée',didnt:'Je ne l’ai pas chantée',song:'chanson',songs:'chansons'},
    it:{locale:'it-IT',account:'Il mio account',tag:'Speakeasy · Karaoke · Dopo le ore',title:'Titolo A–Z',artist:'Artista A–Z',sort:'Ordina',list:'Elenco',request:'Richiedi',sang:'L’ho cantata',didnt:'Non l’ho cantata',song:'canzone',songs:'canzoni'},
    ru:{locale:'ru-RU',account:'Мой аккаунт',tag:'Спикизи · Караоке · После полуночи',title:'Название А–Я',artist:'Исполнитель А–Я',sort:'Сортировать',list:'Список',request:'Запросить',sang:'Я спел(а)',didnt:'Я не пел(а)',song:'песня',songs:'песен'},
    tl:{locale:'fil-PH',account:'Aking account',tag:'Speakeasy · Karaoke · Pagkatapos ng oras',title:'Pamagat A–Z',artist:'Artist A–Z',sort:'Ayusin',list:'Listahan',request:'Humiling',sang:'Kinanta ko ito',didnt:'Hindi ko ito kinanta',song:'kanta',songs:'mga kanta'}
  };
  let translating = false;
  const language = () => currentUser()?.language || 'en';
  const setText = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
  function translateSongButtons(t) {
    document.querySelectorAll('#songResults .songActions .btn:not(.favoriteBtn),#songResults button[onclick^="requestSong"]').forEach(button => setText(button, t.request));
    const result = document.getElementById('resultCount'); if (result) { const match = result.textContent.match(/[\d,.]+/); if (match) setText(result, `${match[0]} ${t.songs}`); }
  }
  function translateHistory(t) {
    const items = state.history.filter(item => item.userId === currentUser()?.id), dates = [];
    items.forEach(item => { const value = new Date(item.requestedAt || item.completedAt || Date.now()); const key = value.toDateString(); if (!dates.some(entry => entry.key === key)) dates.push({ key, value }); });
    document.querySelectorAll('#profileView .historyNight summary').forEach((summary, index) => { const date = dates[index]?.value; if (date) { const label = new Intl.DateTimeFormat(t.locale,{weekday:'long',month:'short',day:'numeric'}).format(date), count = summary.querySelector('span'), amount = Number(count?.textContent.match(/\d+/)?.[0] || 0), textNodes = [...summary.childNodes].filter(node => node.nodeType === Node.TEXT_NODE); if (!textNodes.some(node => node.nodeValue.trim() === label)) { textNodes.forEach(node => node.remove()); summary.insertBefore(document.createTextNode(`${label} `), summary.firstChild); } if (count) setText(count, `${amount} ${amount === 1 ? t.song : t.songs}`); } });
    document.querySelectorAll('#profileView .historyMini').forEach(button => setText(button, button.classList.contains('gold') ? t.sang : t.didnt));
  }
  function translateAccount(t) {
    setText(document.getElementById('profileTab'), t.account); setText(document.querySelector('#profileView .viewHero h2'), t.account);
    const sortLabel = document.querySelector('#profileView .favoriteSort'); if (sortLabel) { const textNode = [...sortLabel.childNodes].find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.nodeValue = `${t.sort} `; const title = sortLabel.querySelector('option[value="title"]'), artist = sortLabel.querySelector('option[value="artist"]'); setText(title,t.title); setText(artist,t.artist); }
    setText(document.getElementById('achievementListButton'), t.list);
    document.querySelectorAll('#profileView button[onclick^="requestSong"]').forEach(button => setText(button,t.request));
    translateHistory(t);
  }
  function translateLive() {
    if (translating) return; translating = true;
    const t = copy[language()] || copy.en;
    setText(document.querySelector('.brand small'), 'Behind Closed Doors Karaoke Club'); translateSongButtons(t); translateAccount(t);
    translating = false;
  }
  window.applyLiveTranslations = translateLive;
  window.addEventListener('DOMContentLoaded', () => {
    translateLive();
    const songResults = document.getElementById('songResults'), profile = document.getElementById('profileView');
    if (songResults) new MutationObserver(translateLive).observe(songResults,{childList:true,subtree:true});
    if (profile) new MutationObserver(translateLive).observe(profile,{childList:true,subtree:true});
  });
})();
