(function () {
  const labels = {
    en:{language:'Language',color:'Chat color',password:'Add password',request:'Request'}, es:{language:'Idioma',color:'Color del chat',password:'Agregar contraseña',request:'Solicitar'},
    ko:{language:'언어',color:'채팅 색상',password:'비밀번호 추가',request:'요청'}, zh:{language:'语言',color:'聊天颜色',password:'添加密码',request:'点歌'},
    ja:{language:'言語',color:'チャット色',password:'パスワードを追加',request:'リクエスト'}, fr:{language:'Langue',color:'Couleur du chat',password:'Ajouter un mot de passe',request:'Demander'},
    it:{language:'Lingua',color:'Colore chat',password:'Aggiungi password',request:'Richiedi'}, ru:{language:'Язык',color:'Цвет чата',password:'Добавить пароль',request:'Запросить'},
    tl:{language:'Wika',color:'Kulay ng chat',password:'Magdagdag ng password',request:'Humiling'}
  };
  const logoutLabels={en:'Log out',es:'Cerrar sesión',ko:'로그아웃',zh:'退出登录',ja:'ログアウト',fr:'Se déconnecter',it:'Esci',ru:'Выйти',tl:'Mag-log out'};
  const profileIdentityLabels={
    en:{display:'Display name',account:'Account name',unlocked:'Unlocked',missing:'Song not recorded'},es:{display:'Nombre visible',account:'Nombre de cuenta',unlocked:'Desbloqueado',missing:'Canción no registrada'},
    ko:{display:'표시 이름',account:'계정 이름',unlocked:'획득일',missing:'노래 기록 없음'},zh:{display:'显示名称',account:'账户名',unlocked:'解锁于',missing:'未记录歌曲'},
    ja:{display:'表示名',account:'アカウント名',unlocked:'獲得日',missing:'曲の記録なし'},fr:{display:'Nom affiché',account:'Nom du compte',unlocked:'Débloqué',missing:'Chanson non enregistrée'},
    it:{display:'Nome visualizzato',account:'Nome account',unlocked:'Sbloccato',missing:'Brano non registrato'},ru:{display:'Отображаемое имя',account:'Имя аккаунта',unlocked:'Получено',missing:'Песня не записана'},
    tl:{display:'Display name',account:'Account name',unlocked:'Nakuha',missing:'Walang naitalang kanta'}
  };
  const achievementLocales={en:'en-US',es:'es-ES',ko:'ko-KR',zh:'zh-CN',ja:'ja-JP',fr:'fr-FR',it:'it-IT',ru:'ru-RU',tl:'fil-PH'};
  const achievementTranslations = {
    en:{night_owl:['Night Owl','Sing a song after midnight.'],closing_time:['Closing Time','Sing “Closing Time” after 1:30 a.m.'],early_bird:['Early Bird','Sing a song between 7 and 8 p.m.']},
    es:{night_owl:['Ave nocturna','Canta una canción después de medianoche.'],closing_time:['Hora de cerrar','Canta “Closing Time” después de la 1:30 a. m.'],early_bird:['Madrugador','Canta una canción entre las 7 y las 8 p. m.']},
    ko:{night_owl:['올빼미','자정 이후에 노래를 부르세요.'],closing_time:['마감 시간','오전 1시 30분 이후에 “Closing Time”을 부르세요.'],early_bird:['일찍 온 새','오후 7시부터 8시 사이에 노래를 부르세요.']},
    zh:{night_owl:['夜猫子','午夜后唱一首歌。'],closing_time:['打烊时间','凌晨 1:30 后演唱《Closing Time》。'],early_bird:['早到鸟','晚上 7 点到 8 点之间唱一首歌。']},
    ja:{night_owl:['夜ふかし','午前0時以降に歌いましょう。'],closing_time:['閉店時間','午前1時30分以降に「Closing Time」を歌いましょう。'],early_bird:['早起き鳥','午後7時から8時の間に歌いましょう。']},
    fr:{night_owl:['Oiseau de nuit','Chantez une chanson après minuit.'],closing_time:['Heure de fermeture','Chantez « Closing Time » après 1 h 30.'],early_bird:['Lève-tôt','Chantez entre 19 h et 20 h.']},
    it:{night_owl:['Gufo notturno','Canta una canzone dopo mezzanotte.'],closing_time:['Ora di chiusura','Canta “Closing Time” dopo l’1:30.'],early_bird:['Mattiniero','Canta una canzone tra le 19 e le 20.']},
    ru:{night_owl:['Ночная сова','Спойте песню после полуночи.'],closing_time:['Время закрытия','Спойте «Closing Time» после 1:30 ночи.'],early_bird:['Ранняя пташка','Спойте песню с 19:00 до 20:00.']},
    tl:{night_owl:['Puyat na kuwago','Kumanta pagkatapos ng hatinggabi.'],closing_time:['Oras ng pagsasara','Kantahin ang “Closing Time” pagkalipas ng 1:30 a.m.'],early_bird:['Maagang ibon','Kumanta sa pagitan ng 7 at 8 p.m.']}
  };

  Object.assign(ACHIEVEMENTS, {
    night_owl:{title:'Night Owl',copy:'Sing a song after midnight.'},
    closing_time:{title:'Closing Time',copy:'Sing “Closing Time” after 1:30 a.m.'},
    early_bird:{title:'Early Bird',copy:'Sing a song between 7 and 8 p.m.'}
  });
  Object.entries(achievementTranslations).forEach(([language,items]) => {
    if (language==='en') return; ACHIEVEMENT_I18N[language] ||= {};
    Object.keys(items).forEach(key => { ACHIEVEMENT_I18N[language][achievementTranslations.en[key][0]]=items[key]; });
  });

  function language() { return currentUser()?.language || 'en'; }
  function polishProfileIdentity(){
    const user=currentUser(),bar=document.querySelector('#profileView .profileBar'),name=bar?.querySelector('.profileBarName');if(!user||user.guest||!bar||!name)return;
    const text=profileIdentityLabels[language()]||profileIdentityLabels.en,html=`<span class="profileIdentityLabel">${esc(text.display)}</span><strong>${esc(user.name)}</strong><span class="profileAccountName">${esc(text.account)}: ${esc(user.username||user.name)}</span>`;
    if(name.innerHTML!==html)name.innerHTML=html;
    const eyebrow=bar.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent=PROFILE_LANGUAGES[language()]?.profile||'Singer profile';
  }
  function ensureProfileControls() {
    const user=currentUser(), actions=document.querySelector('#profileView .profileActions'),bar=actions?.closest('.profileBar'); if(!user||user.guest||!actions||!bar)return;
    const text=labels[language()]||labels.en;
    let password=document.getElementById('profilePasswordButton')||actions.querySelector('button[onclick="changePassword()"]');
    if(!password){password=document.createElement('button');password.id='profilePasswordButton';password.type='button';password.className='btn small';password.onclick=changePassword;actions.append(password)}
    password.id='profilePasswordButton';
    actions.querySelectorAll('button[onclick*="changePassword"]').forEach(button=>{if(button!==password)button.remove()});
    password.textContent=user.passwordHash?(PROFILE_LANGUAGES[language()]?.changePassword||'Change password'):text.password;
    actions.querySelectorAll('button').forEach(button=>{if(button!==password&&button.textContent.trim()===password.textContent.trim())button.remove()});
    let color=document.getElementById('profileChatColorButton');
    if(!color){color=document.createElement('button');color.id='profileChatColorButton';color.type='button';color.className='btn small';color.onclick=openChatColorPicker;actions.append(color)}
    color.textContent=text.color;
    let picker=document.getElementById('profileLanguage');
    if(!picker){picker=document.createElement('select');picker.id='profileLanguage';picker.className='control profileLanguage';picker.onchange=event=>setProfileLanguage(event.target.value);actions.append(picker)}
    picker.setAttribute('aria-label',text.language);
    const options=Object.entries(PROFILE_LANGUAGES).map(([code,value])=>`<option value="${code}" ${code===language()?'selected':''}>${esc(value.name)}</option>`).join('');
    if(picker.innerHTML!==options)picker.innerHTML=options;
    let logoutButton=document.getElementById('profileLogoutButton')||actions.querySelector('button[onclick="logout()"]');
    if(!logoutButton){logoutButton=document.createElement('button');logoutButton.type='button';logoutButton.className='btn ghost small';logoutButton.onclick=logout}
    logoutButton.id='profileLogoutButton';logoutButton.textContent=logoutLabels[language()]||logoutLabels.en;
    if(logoutButton.parentElement!==bar)bar.append(logoutButton);
    actions.querySelectorAll('button[onclick="openLogin()"]').forEach(button=>button.remove());
    polishProfileIdentity();
  }

  function polishHistoryActions() {
    const user=currentUser(),sections=document.querySelectorAll('#profileView .accountSection');if(!user||user.guest||!sections[1])return;
    const history=state.history.filter(item=>item.userId===user.id),text=labels[language()]||labels.en,requestsEnabled=hostModeEnabled();
    sections[1].querySelectorAll('.accountSongRow').forEach((row,index)=>{
      const item=history[index],song=songById(item?.songId),actions=row.lastElementChild;if(!item||!song||!actions)return;
      actions.querySelector('.historyRequest')?.remove();
      if(requestsEnabled)actions.insertAdjacentHTML('beforeend',`<button class="btn small historyRequest" onclick="requestSong('${song.id}')">${esc(text.request)}</button>`);
      const favorite=state.favorites.some(entry=>entry.userId===user.id&&entry.songId===song.id);let star=actions.querySelector('.historyFavorite');
      if(!star){star=document.createElement('button');star.type='button';star.className='btn ghost historyFavorite';star.onclick=()=>toggleFavorite(song.id);actions.append(star)}
      star.textContent=favorite?'★':'☆';star.classList.toggle('active',favorite);star.setAttribute('aria-label',favorite?'Remove from favorites':'Add to favorites');
    });
    if(!requestsEnabled)document.querySelectorAll('#profileView button[onclick^="requestSong"]').forEach(button=>button.remove());
  }
  function polishAccount(){ensureProfileControls();polishHistoryActions()}
  async function updateSharedDisplayName(user,displayName,passwordHash){
    const response=await fetch(`${SUPABASE_URL}/functions/v1/karaoke-profile`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({action:'update_display_name',profileId:user.id,displayName,passwordHash})}),result=await response.json();
    if(!response.ok)throw new Error(result.error||'Display name could not be updated');return result.profile;
  }
  window.renameProfile=async()=>{
    const user=currentUser();if(!user||user.guest)return;const name=prompt('Display name',user.name);if(name===null||!name.trim())return;const displayName=name.trim();
    try{if(user.remoteProfile){let passwordHash=null;if(user.passwordHash==='REMOTE'){const password=prompt('Current password');if(password===null)return;passwordHash=await hashPassword(password)}const profile=await updateSharedDisplayName(user,displayName,passwordHash);user.name=profile.name;user.username=profile.username}else user.name=displayName;saveState();renderProfile();toast('Display name updated')}catch(error){toast(error.message||'Display name could not be updated')}
  };
  function polishChatComposer(){
    const form=document.querySelector('.chatComposer'),input=document.getElementById('chatInput'),send=form?.querySelector('button[type="submit"]'),count=document.getElementById('chatTokenCount'),plus=form?.querySelector('.chatPlus');
    if(!form||!input||!send||!count||!plus||form.querySelector('.chatEntryMain'))return;
    const main=document.createElement('div'),actions=document.createElement('div');main.className='chatEntryMain';actions.className='chatEntryActions';
    form.insertBefore(main,form.firstChild);main.append(input);form.insertBefore(actions,form.querySelector('.chatFinePrint'));actions.append(send,count,plus);
  }
  const nativeRenderProfile=window.renderProfile;
  window.renderProfile=()=>{nativeRenderProfile();enforceMenuAccess();requestAnimationFrame(polishAccount);setTimeout(polishAccount,30)};
  const nativeSetHostMode=window.setHostMode;
  window.setHostMode=enabled=>{const result=nativeSetHostMode(enabled);requestAnimationFrame(polishAccount);return result};

  function achievementSongId(key){
    const user=currentUser();if(!user)return null;
    if(key==='favorite_five')return state.favorites.filter(item=>item.userId===user.id).at(-1)?.songId||null;
    const history=state.history.filter(item=>item.userId===user.id);
    if(key==='first_request'||key==='request_ten')return history[0]?.songId||null;
    if(/^(first_song|perfect_score|duet_debut|genre_|all_genres|two_week_streak|three_week_streak|four_week_streak|thursday_regular|night_owl|early_bird|closing_time)/.test(key))return history.filter(item=>item.status==='sung').sort((a,b)=>(b.completedAt||b.requestedAt||0)-(a.completedAt||a.requestedAt||0))[0]?.songId||null;
    return null;
  }
  window.awardAchievement=async(key,songId=achievementSongId(key))=>{try{const result=await achievementAction('award',{achievementKey:key,...(songId?{songId}:{})});if(result?.newAchievement)toast(`Achievement unlocked: ${ACHIEVEMENTS[key]?.title||key}`)}catch(error){console.warn('Achievement unavailable',error)}};

  const nativeSendChat=window.sendChat;
  window.sendChat=event=>{
    const hasMessage=!!document.getElementById('chatInput')?.value.trim(),user=currentUser(),result=nativeSendChat(event);
    if(hasMessage&&user){state.chatMessageCounts={...(state.chatMessageCounts||{}),[user.id]:(state.chatMessageCounts?.[user.id]||0)+1};saveState();awardAchievement('chat_first');if(state.chatMessageCounts[user.id]>=20)awardAchievement('chat_20')}
    return result;
  };

  const nativeSubmitScore=window.submitScore;
  window.submitScore=()=>{
    const user=currentUser(),item=state.history.find(entry=>entry.id===pendingScoreHistoryId&&entry.userId===user?.id),song=songById(item?.songId);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,+part.value]));
    const minutes=(parts.hour||0)*60+(parts.minute||0),result=nativeSubmitScore();
    if(item?.status==='sung'){if(minutes<7*60)awardAchievement('night_owl');if(minutes>=19*60&&minutes<20*60)awardAchievement('early_bird');if(norm(song?.title||'')==='closing time'&&minutes>=90&&minutes<7*60)awardAchievement('closing_time')}
    return result;
  };

  async function menuSettingAction(action,menu){
    if(action==='set_active_menu')return adminProfileAction(action,{menu});
    const response=await fetch(`${SUPABASE_URL}/functions/v1/karaoke-profile`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({action})}),result=await response.json();
    if(!response.ok)throw new Error(result.error||'Menu service unavailable');return result;
  }
  function ensurePersistentMenuPicker(){
    const select=document.getElementById('savedMenuSelect'),controls=select?.closest('.menuTopControls');if(!select||!controls)return;
    select.hidden=true;
    const admin=!!currentUser()?.isAdmin;
    let button=document.getElementById('menuPickerButton');
    if(!admin){button?.remove();return}
    if(!button){
      button=document.createElement('button');button.id='menuPickerButton';button.type='button';button.className='menuPickerButton';
      const label=document.createElement('span'),arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';button.append(label,arrow);
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openThemedMenuPicker()});controls.insertBefore(button,select);
    }
    const label=button.querySelector('span:first-child'),name=select.selectedOptions?.[0]?.textContent||state.activeDrinkMenu||'Saved menus';
    if(label&&label.textContent!==name)label.textContent=name;
    button.setAttribute('aria-label',select.getAttribute('aria-label')||'Saved menus');button.hidden=false;
  }
  let sharedMenuStamp='';
  window.syncSharedDrinkMenu=async()=>{
    if(menuEditing)return;
    try{const result=await menuSettingAction('get_active_menu'),menu=result.menu;if(!menu?.name||!Array.isArray(menu.drinks)||result.updatedAt===sharedMenuStamp){ensurePersistentMenuPicker();return}sharedMenuStamp=result.updatedAt||JSON.stringify(menu);state.drinkMenus||={};state.drinkMenus[menu.name]=menu;state.activeDrinkMenu=menu.name;saveState();renderDrinkMenu();renderMenuLibrary();ensurePersistentMenuPicker()}catch(error){console.warn('Live drink menu unavailable',error)}
  };
  const nativeSelectDrinkMenu=window.selectDrinkMenu;
  window.selectDrinkMenu=async name=>{
    if(!currentUser()?.isAdmin)return;if(menuEditing&&menuDirty)return openMenuSaveDialog();const menu=state.drinkMenus?.[name];if(!menu)return;
    try{await menuSettingAction('set_active_menu',menu);sharedMenuStamp='';nativeSelectDrinkMenu(name);ensurePersistentMenuPicker();await syncSharedDrinkMenu()}catch(error){toast(error.message||'The live menu could not be changed')}finally{ensurePersistentMenuPicker()}
  };
  const persistentRenderDrinkMenu=window.renderDrinkMenu;
  window.renderDrinkMenu=()=>{const result=persistentRenderDrinkMenu();ensurePersistentMenuPicker();requestAnimationFrame(ensurePersistentMenuPicker);return result};
  const persistentRenderMenuLibrary=window.renderMenuLibrary;
  window.renderMenuLibrary=()=>{const result=persistentRenderMenuLibrary();ensurePersistentMenuPicker();requestAnimationFrame(ensurePersistentMenuPicker);return result};
  const nativeOpenPicker=window.openThemedMenuPicker;
  window.openThemedMenuPicker=()=>{if(currentUser()?.isAdmin)nativeOpenPicker()};
  function enforceMenuAccess(){const admin=!!currentUser()?.isAdmin;document.body.classList.toggle('menu-admin',admin);ensurePersistentMenuPicker();if(!admin)closeThemedMenuPicker?.()}

  const nativeShowAchievementList=window.showAchievementList;
  window.showAchievementList=()=>{nativeShowAchievementList();setTimeout(()=>{const keys=Object.keys(ACHIEVEMENTS);document.querySelectorAll('#achievementListModal li').forEach((item,index)=>{const meta=achievementTranslations[language()]?.[keys[index]];if(!meta)return;const title=item.querySelector('strong'),copy=item.querySelector('small');if(title)title.textContent=meta[0];if(copy)copy.textContent=meta[1]})},0)};
  function localizeTimedAchievementShelf(){document.querySelectorAll('#achievementShelf [data-achievement]').forEach(item=>{const meta=achievementTranslations[language()]?.[item.dataset.achievement];if(!meta)return;const title=item.querySelector('strong'),copy=item.querySelector('span');if(title)title.textContent=meta[0];if(copy)copy.textContent=meta[1]})}
  function polishAchievementShelf(){
    let shelf=document.getElementById('achievementShelf');if(!shelf)return;
    const wasOpen=shelf.matches('details')?shelf.open:(shelf.querySelector('details')?.open??true),rendered=new Map([...shelf.querySelectorAll('[data-achievement]')].map(row=>[row.dataset.achievement,{title:row.querySelector('strong')?.textContent,copy:row.querySelector('span')?.textContent}])),text=profileIdentityLabels[language()]||profileIdentityLabels.en,locale=achievementLocales[language()]||achievementLocales.en;
    if(!shelf.matches('details')){const details=document.createElement('details');details.id='achievementShelf';details.className='profileBox profileSection accountSection achievements';shelf.replaceWith(details);shelf=details}
    shelf.open=wasOpen;shelf.className='profileBox profileSection accountSection achievements';
    const rows=(achievementItems||[]).map(item=>{const localized=rendered.get(item.achievement_key),fallback=localizedAchievementMeta(item.achievement_key),timed=achievementTranslations[language()]?.[item.achievement_key],title=timed?.[0]||localized?.title||fallback.title,copy=timed?.[1]||localized?.copy||fallback.copy,date=item.created_at?new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(item.created_at)):'',song=songById(item.trigger_song_id),trigger=song?`${song.title} · ${song.artist}`:text.missing;return `<div class="achievement" data-achievement="${esc(item.achievement_key)}"><strong>${esc(title)}</strong><span>${esc(copy)}</span><small class="achievementCollected">${esc([date?`${text.unlocked} ${date}`:'',trigger].filter(Boolean).join(' · '))}</small></div>`}).join('');
    shelf.innerHTML=`<summary class="sectionHead"><div><h2>Achievements</h2><p>Small proofs of a very good night.</p></div><button id="achievementListButton" class="btn small achievementListButton" type="button" onclick="event.preventDefault();event.stopPropagation();showAchievementList()">List</button></summary>${rows||emptyHtml('No achievements yet','Come back after a song or two to build your collection.')}`;
    applyLiveTranslations?.();
  }
  const nativeLoadAchievements=window.loadAchievements;
  window.loadAchievements=async()=>{await nativeLoadAchievements();localizeTimedAchievementShelf();polishAchievementShelf()};

  window.addEventListener('DOMContentLoaded',()=>{
    document.head.insertAdjacentHTML('beforeend',`<style>body:not(.menu-admin) #menuPickerButton{display:none!important}.brandrow{position:relative!important}.brandrow>.brand{min-height:43px!important}.brandrow>.brand>div:last-child{position:absolute!important;left:50%!important;top:50%!important;width:max-content;max-width:calc(100% - 96px);transform:translate(-50%,-50%)!important;text-align:center!important}.menuIntro .backBarShelf img{object-position:center 38%!important}.barMenu [data-admin-editable][contenteditable="true"]{outline:none!important}.profileActions{flex-wrap:wrap!important;overflow:visible!important}.profileActions .profileLanguage{width:auto!important;min-width:112px!important;padding:6px 24px 6px 8px!important}.historyRequest{padding:5px 7px!important;font-size:9px!important}.historyFavorite{display:grid!important;place-items:center;width:28px!important;height:28px!important;padding:0!important;font-size:17px!important}.historyFavorite.active{color:#f0c866!important}.accountSongRow>div:last-child{flex-wrap:wrap;justify-content:flex-end}.chatComposer{display:block!important}.chatEntryMain{width:100%}.chatEntryMain #chatInput{display:block;width:100%!important;min-height:44px!important;max-height:180px!important;box-sizing:border-box!important;resize:none!important;overflow-y:auto}.chatAttachments{display:flex;gap:5px;margin-bottom:6px}.chatEntryActions{display:grid;grid-template-columns:minmax(0,1fr) minmax(82px,.55fr) 58px;gap:7px;margin-top:7px}.chatEntryActions .btn{width:100%!important;min-width:0!important;height:42px!important;margin:0!important}.chatEntryActions .chatTokenCount{display:flex;align-items:center;padding:0 10px;box-sizing:border-box;border:1px solid rgba(201,162,87,.28);border-radius:3px;background:rgba(12,8,6,.72);color:#97866b;font:600 12px ui-sans-serif,system-ui;white-space:nowrap}.chatEntryActions .chatTokenCount.atMax{border-color:#d69b3c;color:#e5a83e}.chatEntryActions .chatPlus{font-size:24px!important;line-height:1!important;color:#e5c06d!important}@media(max-width:620px){.brand{width:100%!important;padding-left:0!important;padding-right:0!important}.chatEntryActions{grid-template-columns:minmax(0,1fr) minmax(76px,.52fr) 54px;gap:6px}.chatEntryActions .chatTokenCount{padding:0 8px;font-size:11px}.profileActions{width:100%;gap:5px!important}.profileActions .btn{font-size:9px!important;padding:6px 7px!important}.profileActions .profileLanguage{font-size:10px!important;max-width:125px}.historyRequest{font-size:8px!important;padding:4px 5px!important}.historyFavorite{width:25px!important;height:25px!important}}</style>`);
    document.head.insertAdjacentHTML('beforeend',`<style>.profileBar{position:relative!important;display:block!important;padding:12px 92px 12px 14px!important}.profileBarName{display:grid!important;gap:1px!important;font-family:ui-sans-serif,system-ui!important}.profileBarName strong{color:#e7c985;font:500 19px/1.2 Georgia,serif}.profileIdentityLabel{color:#9c8a6c;font-size:9px;letter-spacing:.12em;text-transform:uppercase}.profileAccountName{margin-top:3px;color:#b6a483;font-size:10px;letter-spacing:.025em}.profileActions{margin-top:10px!important}.profileLanguage{-webkit-appearance:none!important;appearance:none!important;padding-right:28px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%23d8b76e' stroke-width='2'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 8px center!important;background-size:10px 7px!important}#profileLogoutButton{position:absolute!important;right:10px!important;top:10px!important;margin:0!important}.achievements.accountSection{padding:0!important}.achievements>summary{min-height:55px!important;box-sizing:border-box!important}.achievements>summary .achievementListButton{margin-left:auto!important;margin-right:8px!important}.achievement strong{font-size:13px!important;line-height:1.2!important}.achievementCollected{grid-column:2!important;display:block;margin-top:3px;color:#8f8067;font:500 9px/1.35 ui-sans-serif,system-ui;letter-spacing:.015em}@media(max-width:620px){.profileBar{padding:10px 78px 10px 10px!important}.profileBarName strong{font-size:17px!important}#profileLogoutButton{right:8px!important;top:8px!important}.achievements>summary{min-height:52px!important}.achievement strong{font-size:12px!important}.achievementCollected{font-size:8.5px!important}}</style>`);
    const loginName=document.querySelector('label[for="nameInput"]'),loginInput=document.getElementById('nameInput');if(loginName)loginName.textContent='Account name (or guest display name)';if(loginInput)loginInput.placeholder='Enter your account name';
    enforceMenuAccess();polishAccount();polishChatComposer();syncSharedDrinkMenu();setInterval(syncSharedDrinkMenu,15000);
    const profile=document.getElementById('profileView');if(profile)new MutationObserver(()=>requestAnimationFrame(polishAccount)).observe(profile,{childList:true,subtree:true});
    const menuPage=document.querySelector('.menuPage');if(menuPage)new MutationObserver(()=>requestAnimationFrame(ensurePersistentMenuPicker)).observe(menuPage,{childList:true,subtree:true});
  });
})();
