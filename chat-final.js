(function () {
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  let draftImages = [];
  let longPressTimer = null;
  let longPressOrigin = null;

  const chatApi = async body => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/karaoke-chat`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Chat could not be updated');
    return result;
  };

  function reactionsFor(message) {
    const grouped = {};
    Object.values(message.reactions || {}).forEach(emoji => {
      if (REACTIONS.includes(emoji)) grouped[emoji] = (grouped[emoji] || 0) + 1;
    });
    return Object.entries(grouped).map(([emoji, count]) => `<span class="chatReactionCount">${emoji}<small>${count}</small></span>`).join('');
  }

  function messageImages(message) {
    const images = Array.isArray(message.images) ? message.images : [];
    if (!images.length) return '';
    return `<div class="chatMessageImages ${images.length > 1 ? 'multiple' : ''}">${images.map((src, index) => `<button type="button" class="chatImageThumb" data-image-index="${index}" aria-label="Open attached picture ${index + 1}"><img src="${esc(src)}" alt="Attached picture ${index + 1}"></button>`).join('')}</div>`;
  }

  window.renderChat = function () {
    const list = document.getElementById('chatList'), user = currentUser();
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    const color = /^#[0-9a-f]{6}$/i.test(user?.chatColor || '') ? user.chatColor : '';
    list.innerHTML = chatMessages.map(message => {
      const mine = message.profileId === user?.id;
      const ownStyle = mine && color ? ` style="--own-chat-color:${color}"` : '';
      if (chatEditingId === message.id) return `<article class="chatMessage own chatEditing" data-chat-id="${esc(message.id)}"${ownStyle}><textarea id="editChatText" class="control" maxlength="1000">${esc(message.message || '')}</textarea><div class="editActions"><button class="btn gold small" type="button" onclick="saveChatEdit('${message.id}')">Save</button><button class="btn ghost small" type="button" onclick="cancelChatEdit()">Cancel</button></div></article>`;
      const reactions = reactionsFor(message);
      return `<article class="chatMessage ${mine ? 'own' : 'other'}" data-chat-id="${esc(message.id)}"${ownStyle}><div class="chatMessageHead"><strong>${esc(message.singerName)}</strong><time>${fmtTime(message.createdAt)}${message.editedAt ? ' · edited' : ''}</time></div>${message.message ? `<div class="chatMessageBody">${esc(message.message).replace(/\n/g, '<br>')}</div>` : ''}${messageImages(message)}${reactions ? `<div class="chatReactionEdge">${reactions}</div>` : ''}</article>`;
    }).join('') || '<div class="chatEmpty"><strong>The booth is open.</strong>Be the first to say hello tonight.</div>';
    if (nearBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  };

  window.syncChat = async function () {
    if (chatSyncing) return;
    chatSyncing = true;
    try {
      const since = encodeURIComponent(new Date(Date.now() - CHAT_WINDOW_MS).toISOString());
      const rows = await sharedFetch(`karaoke_chat_messages?created_at=gte.${since}&select=id,profile_id,singer_name,message,created_at,edited_at,image_urls,reactions&order=created_at.asc&limit=80`, { headers: { Prefer: 'return=representation' } });
      chatMessages = rows.map(row => ({
        id: row.id,
        profileId: row.profile_id,
        singerName: row.singer_name,
        message: row.message || '',
        images: Array.isArray(row.image_urls) ? row.image_urls : [],
        reactions: row.reactions && typeof row.reactions === 'object' ? row.reactions : {},
        createdAt: new Date(row.created_at).getTime(),
        editedAt: row.edited_at ? new Date(row.edited_at).getTime() : null,
      }));
      if (activeTab === 'chat' && !chatEditingId) renderChat();
      updateChatUnread();
    } catch (error) {
      console.warn('Karaoke Chat unavailable', error);
    } finally {
      chatSyncing = false;
    }
  };

  function closeChatMenu() { document.getElementById('chatActions')?.remove(); }
  function positionMenu(menu, point) {
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(point.y, innerHeight - rect.height - 8))}px`;
  }
  function openOwnActions(id, point) {
    closeChatMenu();
    const menu = document.createElement('div');
    menu.id = 'chatActions';
    menu.className = 'chatActions ownActions';
    menu.dataset.chatId = id;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button type="button" data-action="color">Change my message color</button><button type="button" data-action="edit">Edit this message</button>';
    positionMenu(menu, point);
    menu.querySelector('[data-action="color"]').addEventListener('click', event => { event.stopPropagation(); closeChatMenu(); openChatColorPicker(); });
    menu.querySelector('[data-action="edit"]').addEventListener('click', event => { event.stopPropagation(); closeChatMenu(); openChatEdit(id); });
  }
  function openReactionActions(id, point) {
    closeChatMenu();
    const menu = document.createElement('div');
    menu.id = 'chatActions';
    menu.className = 'chatActions reactionActions';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'React to message');
    menu.innerHTML = REACTIONS.map(emoji => `<button type="button" data-reaction="${emoji}" aria-label="React ${emoji}">${emoji}</button>`).join('');
    positionMenu(menu, point);
    menu.querySelectorAll('[data-reaction]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const reaction = button.dataset.reaction;
      closeChatMenu();
      reactToChatMessage(id, reaction);
    }));
  }
  function openMessageMenu(message, point) {
    if (!message) return;
    if (message.classList.contains('own')) openOwnActions(message.dataset.chatId, point);
    else openReactionActions(message.dataset.chatId, point);
  }

  window.reactToChatMessage = async function (messageId, reaction) {
    const user = currentUser();
    if (!user) return ensureUser('Sign in to react in Karaoke Chat');
    const message = chatMessages.find(item => item.id === messageId);
    if (!message || message.profileId === user.id) return;
    const previous = { ...(message.reactions || {}) };
    message.reactions = { ...previous };
    if (message.reactions[user.id] === reaction) delete message.reactions[user.id];
    else message.reactions[user.id] = reaction;
    renderChat();
    try {
      const result = await chatApi({ action: 'react', messageId, profileId: user.id, reaction });
      message.reactions = result.message.reactions || {};
      renderChat();
    } catch (error) {
      message.reactions = previous;
      renderChat();
      toast(error.message);
    }
  };

  window.openChatEdit = function (id) {
    closeChatMenu();
    chatEditingId = id;
    renderChat();
    setTimeout(() => {
      const field = document.getElementById('editChatText');
      if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
    }, 0);
  };
  window.cancelChatEdit = function () { chatEditingId = null; renderChat(); };
  window.saveChatEdit = async function (id) {
    const field = document.getElementById('editChatText'), user = currentUser(), message = chatMessages.find(item => item.id === id), text = field?.value.trim() || '';
    if (!user || !message) return;
    if (!text && !(message.images || []).length) return toast('A message cannot be empty');
    try {
      const result = await chatApi({ action: 'edit', messageId: id, profileId: user.id, message: text });
      message.message = result.message.message;
      message.editedAt = new Date(result.message.edited_at).getTime();
      chatEditingId = null;
      renderChat();
    } catch (error) { toast(error.message); }
  };

  function updateDraftPreviews() {
    const holder = document.getElementById('chatDraftPreviews');
    if (!holder) return;
    holder.hidden = !draftImages.length;
    holder.innerHTML = draftImages.map((src, index) => `<div class="chatDraftThumb"><img src="${src}" alt="Picture ${index + 1} ready to send"><button type="button" onclick="removeChatDraftImage(${index})" aria-label="Remove picture ${index + 1}">×</button></div>`).join('');
  }
  window.removeChatDraftImage = index => { draftImages.splice(index, 1); updateDraftPreviews(); };

  async function compressImage(file) {
    let objectUrl = '';
    try {
      const source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        objectUrl = URL.createObjectURL(file);
        image.src = objectUrl;
      });
      let scale = Math.min(1, 900 / Math.max(source.width, source.height));
      let quality = .82, encoded = '';
      for (let pass = 0; pass < 7; pass++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#080604'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        encoded = canvas.toDataURL('image/jpeg', quality);
        if (encoded.length <= 350000) break;
        if (quality > .58) quality -= .1; else scale *= .78;
      }
      return encoded;
    } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }

  window.sendChat = async function (event) {
    event?.preventDefault?.();
    if (!ensureUser('Sign in to join Karaoke Chat')) return;
    const input = document.getElementById('chatInput'), text = input.value.trim(), user = currentUser();
    if (!text && !draftImages.length) return;
    const row = { id: uid('chat'), profileId: user.id, singerName: user.name, message: text.slice(0, 1000), createdAt: Date.now(), images: draftImages.slice(), reactions: {} };
    chatMessages.push(row);
    input.value = '';
    draftImages = [];
    updateDraftPreviews();
    updateComposer();
    renderChat();
    try {
      await sharedFetch('karaoke_chat_messages', { method: 'POST', body: JSON.stringify({ id: row.id, profile_id: row.profileId, singer_name: row.singerName, message: row.message, night_key: nightKey(), image_urls: row.images, reactions: {} }) });
      state.chatMessageCounts = { ...(state.chatMessageCounts || {}), [user.id]: (state.chatMessageCounts?.[user.id] || 0) + 1 };
      saveState();
      awardAchievement('chat_first');
      if (state.chatMessageCounts[user.id] >= 20) awardAchievement('chat_20');
      await syncChat();
    } catch (error) {
      chatMessages = chatMessages.filter(item => item.id !== row.id);
      renderChat();
      toast('Chat could not send. Please try again.');
    }
  };

  window.openChatImage = function (src) {
    const modal = document.getElementById('chatImageModal');
    if (!modal) return;
    modal.querySelector('img').src = src;
    modal.querySelector('a').href = src;
    modal.classList.add('open');
  };
  window.closeChatImage = () => document.getElementById('chatImageModal')?.classList.remove('open');

  function updateComposer() {
    const input = document.getElementById('chatInput'), count = document.getElementById('chatTokenCount');
    if (!input || !count) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(Math.max(48, input.scrollHeight), 150)}px`;
    count.textContent = `${input.value.length}/1000`;
    count.classList.toggle('atMax', input.value.length >= 1000);
  }

  function buildComposer() {
    const form = document.querySelector('.chatComposer'), input = document.getElementById('chatInput');
    if (!form || !input) return;
    input.maxLength = 1000;
    input.removeAttribute('style');
    input.className = 'control';
    form.innerHTML = '<div id="chatDraftPreviews" class="chatAttachments" hidden></div><div class="chatComposeGrid"><div class="chatTextWrap"><div id="chatTokenCount" class="chatTokenCount" aria-live="polite">0/1000</div></div><div class="chatComposeActions"><button class="btn gold chatSend" type="submit">Send</button><button class="btn ghost chatPlus" type="button" aria-label="Add pictures">+</button></div></div><p class="chatRetentionNote">Sent messages and pictures stay in the chat room for one hour, then disappear.</p>';
    form.querySelector('.chatTextWrap').append(input);
    input.placeholder = 'Say something to the room…';
    input.addEventListener('input', updateComposer);
    input.addEventListener('beforeinput', event => {
      if (input.value.length >= 1000 && !event.inputType.startsWith('delete')) {
        event.preventDefault();
        input.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.012)' }, { transform: 'scale(1)' }], 180);
      }
    });
    form.querySelector('.chatPlus').addEventListener('click', () => document.getElementById('chatImageInput').click());
    form.addEventListener('keydown', event => {
      if (event.target !== input || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendChat(event);
    }, true);
    updateComposer();
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('#chatActions.ownActions [data-action]');
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const menu = action.closest('#chatActions');
    const id = menu?.dataset.chatId;
    const name = action.dataset.action;
    closeChatMenu();
    if (name === 'color') window.openChatColorPicker?.();
    if (name === 'edit' && id) window.openChatEdit(id);
  }, true);

  document.addEventListener('contextmenu', event => {
    const message = event.target.closest('.chatMessage[data-chat-id]');
    if (!message) return;
    event.preventDefault();
    openMessageMenu(message, { x: event.clientX, y: event.clientY });
  }, true);
  document.addEventListener('pointerdown', event => {
    const message = event.target.closest('.chatMessage[data-chat-id]');
    if (!message || event.target.closest('button,a,textarea')) return;
    closeChatMenu();
    longPressOrigin = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => openMessageMenu(message, longPressOrigin), 520);
  }, true);
  document.addEventListener('pointermove', event => {
    if (longPressOrigin && Math.hypot(event.clientX - longPressOrigin.x, event.clientY - longPressOrigin.y) > 12) {
      clearTimeout(longPressTimer); longPressOrigin = null;
    }
  }, true);
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => { clearTimeout(longPressTimer); longPressOrigin = null; }, true));
  document.addEventListener('pointerdown', event => { if (!event.target.closest('#chatActions')) closeChatMenu(); });

  window.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', `<style>
      .chatPanel{display:block!important}.chatList{height:min(55vh,560px)!important;min-height:330px!important}.chatComposer{display:block!important;margin-top:8px!important}
      .chatComposeGrid{display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:7px;align-items:stretch}.chatTextWrap{position:relative;min-width:0;border:1px solid rgba(201,162,87,.34);border-radius:3px;background:rgba(10,7,5,.84);overflow:hidden}
      .chatTextWrap #chatInput{display:block;width:100%!important;min-height:92px!important;max-height:150px!important;margin:0!important;padding:10px 11px 25px!important;border:0!important;background:transparent!important;box-sizing:border-box!important;resize:none!important;overflow-y:auto!important}
      .chatComposeActions{display:grid;grid-template-rows:minmax(43px,1fr) 43px;gap:7px}.chatSend,.chatPlus{width:64px!important;min-width:0!important;margin:0!important;padding:0 5px!important}.chatSend{height:100%!important;font-size:11px!important}.chatPlus{height:43px!important;font-size:28px!important;line-height:1!important;color:#e4bf69!important}.chatTokenCount{position:absolute!important;right:8px!important;bottom:5px!important;z-index:2!important;display:block!important;border:0!important;background:transparent!important;color:#756f68!important;font:500 10px/1 ui-sans-serif,system-ui!important;pointer-events:none}.chatTokenCount.atMax{color:#e0a13c!important;animation:chatCountGlow .8s ease-in-out infinite alternate}
      @keyframes chatCountGlow{to{color:#f2bd58;text-shadow:0 0 8px rgba(224,161,60,.35)}}
      .chatRetentionNote{margin:7px 2px 0;color:#776e62;font:500 9px/1.35 ui-sans-serif,system-ui;text-align:center}.chatAttachments{display:flex!important;gap:6px;min-height:0;margin:0 0 7px!important;padding:0!important;overflow-x:auto}.chatAttachments[hidden]{display:none!important}.chatDraftThumb{position:relative;flex:0 0 46px;width:46px;height:46px;border:1px solid rgba(201,162,87,.38);border-radius:5px;background:#100b08}.chatDraftThumb img{display:block;width:100%;height:100%;object-fit:cover;border-radius:4px}.chatDraftThumb button{position:absolute;right:-5px;top:-6px;display:grid;place-items:center;width:17px;height:17px;padding:0;border:1px solid #c9a257;border-radius:50%;background:#24120f;color:#f5dfb8;font:700 13px/1 ui-sans-serif;cursor:pointer}
      .chatMessage{position:relative}.chatMessage:has(.chatReactionEdge){margin-bottom:12px}.chatMessageImages{display:grid;grid-template-columns:repeat(2,72px);gap:5px;margin-top:7px}.chatMessageImages:not(.multiple){grid-template-columns:112px}.chatImageThumb{display:block;width:72px;height:72px;padding:0;border:1px solid rgba(201,162,87,.32);border-radius:6px;overflow:hidden;background:#0b0806;cursor:pointer}.chatMessageImages:not(.multiple) .chatImageThumb{width:112px;height:96px}.chatImageThumb img{display:block;width:100%;height:100%;object-fit:cover}.chatReactionEdge{position:absolute;right:8px;bottom:-13px;display:flex;gap:3px;z-index:2}.chatMessage.other .chatReactionEdge{right:auto;left:8px}.chatReactionCount{display:flex;align-items:center;gap:2px;height:24px;padding:2px 6px;border:1px solid rgba(201,162,87,.38);border-radius:999px;background:#160f0b;color:#ead7b3;font-size:13px;box-shadow:0 3px 8px rgba(0,0,0,.45)}.chatReactionCount small{font-size:9px;color:#a9997d}
      .chatActions{position:fixed!important;z-index:1100!important}.chatActions.ownActions{display:grid!important;min-width:220px!important;padding:5px!important;border:1px solid rgba(201,162,87,.72)!important;border-radius:6px!important;background:linear-gradient(145deg,#2b1a11,#100b08)!important;box-shadow:0 16px 42px rgba(0,0,0,.68)!important}.chatActions.ownActions button{padding:11px 12px!important;border:0!important;background:transparent!important;color:#efdbaf!important;text-align:left!important;font:600 12px ui-sans-serif,system-ui!important}.chatActions.ownActions button:hover{background:rgba(201,162,87,.14)!important}.chatActions.reactionActions{display:flex!important;gap:2px!important;padding:6px!important;border:1px solid rgba(201,162,87,.65)!important;border-radius:999px!important;background:#17100c!important;box-shadow:0 14px 36px rgba(0,0,0,.66)!important}.chatActions.reactionActions button{display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:50%;background:transparent;font-size:22px;cursor:pointer;transition:transform .12s,background .12s}.chatActions.reactionActions button:hover,.chatActions.reactionActions button:focus{transform:scale(1.16);background:rgba(201,162,87,.14);outline:0}
      .chatEditing{width:min(78%,620px);box-sizing:border-box}.chatEditing textarea{min-height:78px!important;max-height:180px!important;resize:vertical!important}.chatImageModal .modal{display:flex;flex-direction:column;align-items:center;width:min(92vw,760px);max-width:760px}.chatImageModal img{display:block;max-width:100%;max-height:72vh;object-fit:contain;border:1px solid rgba(201,162,87,.4);background:#080604}.chatImageDownload{display:grid!important;place-items:center;width:42px!important;height:42px!important;margin-top:12px!important;padding:0!important}.chatImageDownload svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
      @media(max-width:620px){.chatComposeGrid{grid-template-columns:minmax(0,1fr) 56px}.chatSend,.chatPlus{width:56px!important}.chatRetentionNote{font-size:8.5px}.chatMessageImages{grid-template-columns:repeat(2,64px)}.chatImageThumb{width:64px;height:64px}.chatMessageImages:not(.multiple){grid-template-columns:96px}.chatMessageImages:not(.multiple) .chatImageThumb{width:96px;height:84px}.chatActions.reactionActions button{width:34px;height:34px;font-size:20px}}
    </style>`);
    document.getElementById('chatActions')?.remove();
    document.getElementById('chatContext')?.remove();
    if (!document.getElementById('chatImageInput')) document.body.insertAdjacentHTML('beforeend', '<input id="chatImageInput" type="file" accept="image/*" multiple hidden>');
    if (!document.getElementById('chatImageModal')) document.body.insertAdjacentHTML('beforeend', '<div id="chatImageModal" class="modalWrap chatImageModal" onclick="if(event.target===this)closeChatImage()"><div class="modal"><button class="modalClose" aria-label="Close picture" onclick="closeChatImage()">×</button><img alt="Chat picture"><a class="btn gold chatImageDownload" download="karaoke-chat-picture.jpg" aria-label="Download picture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg></a></div></div>');
    const fileInput = document.getElementById('chatImageInput');
    fileInput.onchange = async event => {
      const files = Array.from(event.target.files || []).slice(0, 4 - draftImages.length);
      for (const file of files) {
        try { draftImages.push(await compressImage(file)); updateDraftPreviews(); }
        catch { toast('That picture could not be added'); }
      }
      event.target.value = '';
    };
    buildComposer();
    renderChat();
    syncChat();
  });

  document.addEventListener('click', event => {
    const thumb = event.target.closest('.chatImageThumb');
    if (!thumb) return;
    const article = thumb.closest('[data-chat-id]');
    const message = chatMessages.find(item => item.id === article?.dataset.chatId);
    const src = message?.images?.[Number(thumb.dataset.imageIndex)];
    if (src) openChatImage(src);
  });
})();
