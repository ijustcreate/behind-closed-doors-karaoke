(function () {
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  let draftImages = [];
  let longPressTimer = null;
  let longPressOrigin = null;
  const EDIT_WINDOW_MS = 5 * 60 * 1000;
  // This stays in the sender's browser only. It is never stored with the chat message.
  const pendingBcdReplies = new Map();

  function summonsBcd(text) {
    return /(?:^|\s)@bcd\b/i.test(text) || /(?:^|\s)hey\s+bcd\b/i.test(text);
  }
  async function bcdReplyIdFor(sourceId) {
    const bytes = new TextEncoder().encode(String(sourceId));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return `bcd-guide-${hash.slice(0, 24)}`;
  }
  function pendingDots() {
    return '<article class="chatMessage bot chatPending" aria-label="BCD is preparing a reply"><span class="chatPendingDots" aria-hidden="true"><i></i><i></i><i></i></span></article>';
  }

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
    const messages = chatMessages.map(message => {
      const mine = message.profileId === user?.id;
      const isBot = message.profileId === 'bcd-house-guide';
      const ownStyle = mine && color ? ` style="--own-chat-color:${color}"` : '';
      if (chatEditingId === message.id) return `<article class="chatMessage own chatEditing" data-chat-id="${esc(message.id)}"${ownStyle}><textarea id="editChatText" class="control" maxlength="1000">${esc(message.message || '')}</textarea><div class="editActions"><button class="btn gold small" type="button" onclick="saveChatEdit('${message.id}')">Save</button><button class="btn ghost small" type="button" onclick="cancelChatEdit()">Cancel</button></div></article>`;
      const reactions = reactionsFor(message);
      const name = isBot ? 'BCD Host' : message.singerName;
      return `<article class="chatMessage ${mine ? 'own' : isBot ? 'bot' : 'other'}" data-chat-id="${esc(message.id)}"${ownStyle}><div class="chatMessageHead"><strong>${esc(name)}</strong><time>${fmtTime(message.createdAt)}${message.editedAt ? ' · edited' : ''}</time></div>${message.message ? `<div class="chatMessageBody">${esc(message.message).replace(/\n/g, '<br>')}</div>` : ''}${messageImages(message)}${reactions ? `<div class="chatReactionEdge">${reactions}</div>` : ''}</article>`;
    }).join('');
    list.innerHTML = messages || '<div class="chatEmpty"><strong>The booth is open.</strong>Be the first to say hello tonight.</div>';
    if (pendingBcdReplies.size) list.insertAdjacentHTML('beforeend', pendingDots());
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
      const receivedIds = new Set(chatMessages.map(message => message.id));
      for (const [sourceId, replyId] of pendingBcdReplies) {
        if (receivedIds.has(replyId)) pendingBcdReplies.delete(sourceId);
      }
      if (activeTab === 'chat' && !chatEditingId) renderChat();
      updateChatUnread();
    } catch (error) {
      console.warn('Karaoke Chat unavailable', error);
    } finally {
      chatSyncing = false;
    }
  };

  function closeChatMenu() { document.getElementById('chatActions')?.remove(); }
  function editTimeLeft(message) {
    return Math.max(0, EDIT_WINDOW_MS - (Date.now() - message.createdAt));
  }
  function formatEditTimeLeft(milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function positionMenu(menu, point) {
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(point.y, innerHeight - rect.height - 8))}px`;
  }
  function openOwnActions(id, point) {
    closeChatMenu();
    const message = chatMessages.find(item => item.id === id);
    if (!message) return;
    const menu = document.createElement('div');
    menu.id = 'chatActions';
    menu.className = 'chatActions ownActions';
    menu.dataset.chatId = id;
    menu.setAttribute('role', 'menu');
    const renderActions = () => {
      const remaining = editTimeLeft(message);
      menu.innerHTML = '<button type="button" data-action="color">Change my color</button>' +
        (remaining > 0 ? `<button type="button" data-action="edit">Edit message (${formatEditTimeLeft(remaining)} left)</button>` : '');
    };
    renderActions();
    positionMenu(menu, point);
    const countdown = setInterval(() => {
      if (!menu.isConnected) return clearInterval(countdown);
      renderActions();
    }, 1000);
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
    const message = chatMessages.find(item => item.id === id);
    if (!message || message.profileId !== currentUser()?.id || editTimeLeft(message) <= 0) {
      return toast('This message can no longer be edited');
    }
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
    if (message.profileId !== user.id || editTimeLeft(message) <= 0) {
      chatEditingId = null;
      renderChat();
      return toast('This message can no longer be edited');
    }
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
      if (summonsBcd(row.message)) {
        bcdReplyIdFor(row.id).then(replyId => {
          pendingBcdReplies.set(row.id, replyId);
          if (activeTab === 'chat') renderChat();
          setTimeout(() => {
            if (pendingBcdReplies.delete(row.id) && activeTab === 'chat') renderChat();
          }, 180000);
        }).catch(() => {});
      }
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

  let openChatPicture = { src: '', caption: '' };

  function loadCanvasImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      // Chat uploads are data URLs today. Enable CORS only for a remote image host so
      // direct file:// use and same-origin deployments keep working too.
      const sourceUrl = new URL(src, window.location.href);
      if (sourceUrl.protocol.startsWith('http') && sourceUrl.origin !== window.location.origin) image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The picture could not be prepared for download'));
      image.src = src;
    });
  }

  function wrapCanvasText(context, text, maxWidth) {
    const lines = [];
    String(text).trim().split(/\n+/).forEach(paragraph => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      let line = '';
      words.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else line = next;
      });
      if (line) lines.push(line);
    });
    return lines;
  }

  function fittedCaption(context, caption, maxWidth, maxHeight, width) {
    const clean = String(caption || '').trim();
    if (!clean) return null;
    for (let size = Math.min(42, Math.max(18, Math.round(width * .047))); size >= 16; size -= 2) {
      context.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
      const lineHeight = Math.round(size * 1.32);
      const lines = wrapCanvasText(context, clean, maxWidth);
      if (lines.length * lineHeight <= maxHeight) return { lines, size, lineHeight };
    }
    context.font = '600 16px ui-sans-serif, system-ui, sans-serif';
    const lines = wrapCanvasText(context, clean, maxWidth);
    const lineHeight = 22;
    const limit = Math.max(1, Math.floor(maxHeight / lineHeight));
    if (lines.length > limit) {
      lines.length = limit;
      let finalLine = lines[limit - 1];
      while (finalLine.length && context.measureText(`${finalLine}…`).width > maxWidth) finalLine = finalLine.slice(0, -1).trimEnd();
      lines[limit - 1] = `${finalLine}…`;
    }
    return { lines, size: 16, lineHeight };
  }

  function drawCornerTrim(context, x, y, horizontal, vertical, length) {
    const short = length * .42;
    context.beginPath();
    context.moveTo(x, y + vertical * short);
    context.lineTo(x, y);
    context.lineTo(x + horizontal * short, y);
    context.moveTo(x + horizontal * length, y);
    context.lineTo(x + horizontal * length, y + vertical * length * .24);
    context.moveTo(x, y + vertical * length);
    context.lineTo(x + horizontal * length * .24, y + vertical * length);
    context.stroke();
  }

  async function createBrandedChatImage(src, caption) {
    const [photo, mark] = await Promise.all([
      loadCanvasImage(src),
      loadCanvasImage('assets/bcd-karaoke-logo.jpg'),
    ]);
    const width = photo.naturalWidth || photo.width;
    const height = photo.naturalHeight || photo.height;
    if (!width || !height) throw new Error('The picture has no usable dimensions');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    const trim = Math.max(8, Math.min(24, Math.round(width * .024)));
    const photoX = trim, photoY = trim, photoWidth = width - trim * 2, photoHeight = height - trim * 2;
    const padding = Math.max(16, Math.min(42, Math.round(width * .048)));

    context.fillStyle = '#120d09';
    context.fillRect(0, 0, width, height);
    context.drawImage(photo, photoX, photoY, photoWidth, photoHeight);

    // A restrained espresso-and-brass trim keeps the shared image visibly part of BCDKC.
    context.strokeStyle = 'rgba(224, 183, 82, .92)';
    context.lineWidth = Math.max(1, Math.round(width * .002));
    context.strokeRect(trim * .55, trim * .55, width - trim * 1.1, height - trim * 1.1);
    context.strokeStyle = 'rgba(255, 226, 154, .44)';
    context.lineWidth = 1;
    context.strokeRect(trim + 2, trim + 2, photoWidth - 4, photoHeight - 4);
    context.strokeStyle = 'rgba(224, 183, 82, .84)';
    context.lineWidth = Math.max(1, Math.round(width * .0018));
    const corner = Math.max(20, Math.min(56, Math.round(width * .075)));
    drawCornerTrim(context, trim + 7, trim + 7, 1, 1, corner);
    drawCornerTrim(context, width - trim - 7, trim + 7, -1, 1, corner);
    drawCornerTrim(context, trim + 7, height - trim - 7, 1, -1, corner);
    drawCornerTrim(context, width - trim - 7, height - trim - 7, -1, -1, corner);

    const captionLayout = fittedCaption(context, caption, photoWidth - padding * 2, Math.min(photoHeight * .28, 190), width);
    if (captionLayout) {
      const captionHeight = captionLayout.lines.length * captionLayout.lineHeight + padding * 1.5;
      const captionFade = context.createLinearGradient(0, photoY, 0, photoY + captionHeight + padding);
      captionFade.addColorStop(0, 'rgba(7, 5, 4, .78)');
      captionFade.addColorStop(.74, 'rgba(7, 5, 4, .42)');
      captionFade.addColorStop(1, 'rgba(7, 5, 4, 0)');
      context.fillStyle = captionFade;
      context.fillRect(photoX, photoY, photoWidth, captionHeight + padding);
      context.font = `600 ${captionLayout.size}px ui-sans-serif, system-ui, sans-serif`;
      context.fillStyle = '#fffdf8';
      context.textBaseline = 'top';
      context.shadowColor = 'rgba(0, 0, 0, .82)';
      context.shadowBlur = Math.max(3, Math.round(width * .008));
      context.shadowOffsetY = 2;
      captionLayout.lines.forEach((line, index) => context.fillText(line, photoX + padding, photoY + padding + index * captionLayout.lineHeight, photoWidth - padding * 2));
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
    }

    const markHeight = Math.max(42, Math.min(96, Math.round(width * .125)));
    const markWidth = markHeight * (120 / 110);
    const footerHeight = Math.max(markHeight + padding * 1.2, Math.min(photoHeight * .24, 160));
    const footerFade = context.createLinearGradient(0, height - trim - footerHeight - padding, 0, height - trim);
    footerFade.addColorStop(0, 'rgba(7, 5, 4, 0)');
    footerFade.addColorStop(.36, 'rgba(7, 5, 4, .45)');
    footerFade.addColorStop(1, 'rgba(7, 5, 4, .86)');
    context.fillStyle = footerFade;
    context.fillRect(photoX, height - trim - footerHeight - padding, photoWidth, footerHeight + padding);
    const markX = photoX + padding;
    const markY = height - trim - padding - markHeight;
    context.drawImage(mark, markX, markY, markWidth, markHeight);

    const brandX = markX + markWidth + Math.max(10, Math.round(width * .018));
    const brandSize = Math.max(21, Math.min(46, Math.round(width * .054)));
    context.fillStyle = '#f3d997';
    context.font = `700 ${brandSize}px Georgia, serif`;
    context.textBaseline = 'alphabetic';
    context.shadowColor = 'rgba(0, 0, 0, .8)';
    context.shadowBlur = 5;
    context.fillText('BCDKC', brandX, markY + markHeight * .55);
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.fillStyle = '#f8f2df';
    context.font = `600 ${Math.max(9, Math.round(brandSize * .28))}px ui-sans-serif, system-ui, sans-serif`;
    context.fillText('BEHIND CLOSED DOORS · KARAOKE CLUB', brandX, markY + markHeight * .78);

    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The branded image could not be created')), 'image/jpeg', .92));
  }

  window.openChatImage = function (src, caption = '') {
    const modal = document.getElementById('chatImageModal');
    if (!modal) return;
    openChatPicture = { src, caption: String(caption || '').trim() };
    modal.querySelector('img').src = src;
    modal.classList.add('open');
  };
  window.closeChatImage = () => document.getElementById('chatImageModal')?.classList.remove('open');
  window.downloadBrandedChatImage = async function () {
    const button = document.querySelector('#chatImageModal .chatImageDownload');
    if (!openChatPicture.src || !button) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', 'Preparing BCDKC-branded picture');
    try {
      const blob = await createBrandedChatImage(openChatPicture.src, openChatPicture.caption);
      const href = URL.createObjectURL(blob);
      const download = document.createElement('a');
      download.href = href;
      download.download = `bcdkc-chat-${new Date().toISOString().slice(0, 10)}.jpg`;
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) {
      console.warn('Branded chat download failed', error);
      toast('This picture could not be prepared for download');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-label', 'Download BCDKC-branded picture');
    }
  };

  function updateComposer() {
    const input = document.getElementById('chatInput'), count = document.getElementById('chatTokenCount');
    if (!input || !count) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(Math.max(48, input.scrollHeight), 150)}px`;
    count.textContent = `${input.value.length}/1000`;
    count.classList.toggle('atMax', input.value.length >= 1000);
  }

  function updateChatViewport() {
    const view = document.querySelector('[data-view="chat"]');
    const topbar = document.querySelector('.topbar');
    if (!view || !topbar) return;
    view.style.setProperty('--chat-topbar-height', `${Math.ceil(topbar.getBoundingClientRect().height)}px`);
  }

  function buildComposer() {
    const form = document.querySelector('.chatComposer'), input = document.getElementById('chatInput');
    if (!form || !input) return;
    input.maxLength = 1000;
    input.removeAttribute('style');
    input.className = 'control';
    form.innerHTML = '<div id="chatDraftPreviews" class="chatAttachments" hidden></div><div class="chatComposeGrid"><div class="chatTextWrap"><div id="chatTokenCount" class="chatTokenCount" aria-live="polite">0/1000</div></div><div class="chatComposeActions"><button class="btn gold chatSend" type="submit">Send</button><button class="btn ghost chatPlus" type="button" aria-label="Add pictures">+</button></div></div><p class="chatRetentionNote">Sent messages and pictures stay in the chat room for one hour, then disappear.</p>';
    form.querySelector('.chatTextWrap').append(input);
    input.placeholder = 'Message the room…';
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
      [data-view="chat"]:not([hidden]){display:grid!important;grid-template-rows:auto minmax(0,1fr);height:calc(100dvh - var(--chat-topbar-height,128px) - 46px);min-height:520px;overflow:hidden}
      [data-view="chat"]>.viewHero{margin-bottom:8px!important}
      [data-view="chat"]>.chatPanel{display:flex!important;flex-direction:column;width:100%;height:100%;min-height:0;margin:0 auto!important;overflow:hidden;box-sizing:border-box}
      .chatList{flex:1 1 auto;height:auto!important;min-height:120px!important;overscroll-behavior:contain}.chatComposer{display:block!important;flex:0 0 auto;margin-top:8px!important}
      .chatComposeGrid{display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:7px;align-items:stretch}.chatTextWrap{position:relative;min-width:0;border:1px solid rgba(201,162,87,.34);border-radius:3px;background:rgba(10,7,5,.84);overflow:hidden}
      .chatTextWrap #chatInput{display:block;width:100%!important;min-height:92px!important;max-height:150px!important;margin:0!important;padding:10px 11px 25px!important;border:0!important;background:transparent!important;box-sizing:border-box!important;resize:none!important;overflow-y:auto!important}
      .chatComposeActions{display:grid;grid-template-rows:minmax(43px,1fr) 43px;gap:7px}.chatSend,.chatPlus{width:64px!important;min-width:0!important;margin:0!important;padding:0 5px!important}.chatSend{height:100%!important;font-size:11px!important}.chatPlus{height:43px!important;font-size:28px!important;line-height:1!important;color:#e4bf69!important}.chatTokenCount{position:absolute!important;right:8px!important;bottom:5px!important;z-index:2!important;display:block!important;border:0!important;background:transparent!important;color:#756f68!important;font:500 10px/1 ui-sans-serif,system-ui!important;pointer-events:none}.chatTokenCount.atMax{color:#e0a13c!important;animation:chatCountGlow .8s ease-in-out infinite alternate}
      @keyframes chatCountGlow{to{color:#f2bd58;text-shadow:0 0 8px rgba(224,161,60,.35)}}
      .chatRetentionNote{margin:7px 2px 0;color:#776e62;font:500 9px/1.35 ui-sans-serif,system-ui;text-align:center}.chatAttachments{display:flex!important;gap:6px;min-height:0;margin:0 0 7px!important;padding:0!important;overflow-x:auto}.chatAttachments[hidden]{display:none!important}.chatDraftThumb{position:relative;flex:0 0 46px;width:46px;height:46px;border:1px solid rgba(201,162,87,.38);border-radius:5px;background:#100b08}.chatDraftThumb img{display:block;width:100%;height:100%;object-fit:cover;border-radius:4px}.chatDraftThumb button{position:absolute;right:-5px;top:-6px;display:grid;place-items:center;width:17px;height:17px;padding:0;border:1px solid #c9a257;border-radius:50%;background:#24120f;color:#f5dfb8;font:700 13px/1 ui-sans-serif;cursor:pointer}
      .chatMessage.bot{align-self:center!important;max-width:min(88%,680px)!important;border-color:rgba(224,183,82,.7)!important;background:linear-gradient(145deg,#2b2115,#14100b)!important;box-shadow:0 8px 24px rgba(0,0,0,.38),0 0 18px rgba(201,162,87,.08)!important}.chatPending{display:flex!important;align-items:center!important;min-width:48px!important;min-height:30px!important;padding:6px 12px!important;opacity:.86}.chatPendingDots{display:flex;align-items:center;gap:4px;height:14px}.chatPendingDots i{display:block;width:5px;height:5px;border-radius:50%;background:#ead29a;animation:bcdPendingDot 1.1s ease-in-out infinite}.chatPendingDots i:nth-child(2){animation-delay:.16s}.chatPendingDots i:nth-child(3){animation-delay:.32s}@keyframes bcdPendingDot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
      .chatMessage{position:relative}.chatMessage:has(.chatReactionEdge){margin-bottom:12px}.chatMessageImages{display:grid;grid-template-columns:repeat(2,72px);gap:5px;margin-top:7px}.chatMessageImages:not(.multiple){grid-template-columns:112px}.chatImageThumb{display:block;width:72px;height:72px;padding:0;border:1px solid rgba(201,162,87,.32);border-radius:6px;overflow:hidden;background:#0b0806;cursor:pointer}.chatMessageImages:not(.multiple) .chatImageThumb{width:112px;height:96px}.chatImageThumb img{display:block;width:100%;height:100%;object-fit:cover}.chatReactionEdge{position:absolute;right:8px;bottom:-13px;display:flex;gap:3px;z-index:2}.chatMessage.other .chatReactionEdge{right:auto;left:8px}.chatReactionCount{display:flex;align-items:center;gap:2px;height:24px;padding:2px 6px;border:1px solid rgba(201,162,87,.38);border-radius:999px;background:#160f0b;color:#ead7b3;font-size:13px;box-shadow:0 3px 8px rgba(0,0,0,.45)}.chatReactionCount small{font-size:9px;color:#a9997d}
      .chatActions{position:fixed!important;z-index:1100!important}.chatActions.ownActions{display:grid!important;min-width:220px!important;padding:5px!important;border:1px solid rgba(201,162,87,.72)!important;border-radius:6px!important;background:linear-gradient(145deg,#2b1a11,#100b08)!important;box-shadow:0 16px 42px rgba(0,0,0,.68)!important}.chatActions.ownActions button{padding:11px 12px!important;border:0!important;background:transparent!important;color:#efdbaf!important;text-align:left!important;font:600 12px ui-sans-serif,system-ui!important}.chatActions.ownActions button:hover{background:rgba(201,162,87,.14)!important}.chatActions.reactionActions{display:flex!important;gap:2px!important;padding:6px!important;border:1px solid rgba(201,162,87,.65)!important;border-radius:999px!important;background:#17100c!important;box-shadow:0 14px 36px rgba(0,0,0,.66)!important}.chatActions.reactionActions button{display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:50%;background:transparent;font-size:22px;cursor:pointer;transition:transform .12s,background .12s}.chatActions.reactionActions button:hover,.chatActions.reactionActions button:focus{transform:scale(1.16);background:rgba(201,162,87,.14);outline:0}
      .chatEditing{width:min(78%,620px);box-sizing:border-box}.chatEditing textarea{min-height:78px!important;max-height:180px!important;resize:vertical!important}.chatImageModal .modal{display:flex;flex-direction:column;align-items:center;width:min(92vw,760px);max-width:760px}.chatImageStage{position:relative;max-width:100%;padding:7px;background:linear-gradient(145deg,#2d1d12,#080604);border:1px solid rgba(224,183,82,.75);box-shadow:0 0 0 1px rgba(255,226,154,.16) inset,0 18px 42px rgba(0,0,0,.52)}.chatImageStage:before,.chatImageStage:after{content:'';position:absolute;width:24px;height:24px;pointer-events:none}.chatImageStage:before{left:3px;top:3px;border-left:1px solid rgba(255,226,154,.78);border-top:1px solid rgba(255,226,154,.78)}.chatImageStage:after{right:3px;bottom:3px;border-right:1px solid rgba(255,226,154,.78);border-bottom:1px solid rgba(255,226,154,.78)}.chatImageModal img{display:block;max-width:100%;max-height:72vh;object-fit:contain;border:1px solid rgba(201,162,87,.4);background:#080604}.chatImageDownload{display:grid!important;place-items:center;width:42px!important;height:42px!important;margin-top:12px!important;padding:0!important}.chatImageDownload:disabled{cursor:wait!important;opacity:.65}.chatImageDownload svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
      @media(max-width:620px){[data-view="chat"]:not([hidden]){height:calc(100dvh - var(--chat-topbar-height,128px) - 18px);min-height:0}[data-view="chat"]>.viewHero{padding:12px 14px!important}.chatComposeGrid{grid-template-columns:minmax(0,1fr) 56px}.chatTextWrap #chatInput{min-height:74px!important}.chatSend,.chatPlus{width:56px!important}.chatMessageImages{grid-template-columns:repeat(2,64px)}.chatImageThumb{width:64px;height:64px}.chatMessageImages:not(.multiple){grid-template-columns:96px}.chatMessageImages:not(.multiple) .chatImageThumb{width:96px;height:84px}.chatActions.reactionActions button{width:34px;height:34px;font-size:20px}}
    </style>`);
    document.getElementById('houseGuideCall')?.remove();
    document.getElementById('chatActions')?.remove();
    document.getElementById('chatContext')?.remove();
    if (!document.getElementById('chatImageInput')) document.body.insertAdjacentHTML('beforeend', '<input id="chatImageInput" type="file" accept="image/*" multiple hidden>');
    if (!document.getElementById('chatImageModal')) document.body.insertAdjacentHTML('beforeend', '<div id="chatImageModal" class="modalWrap chatImageModal" onclick="if(event.target===this)closeChatImage()"><div class="modal"><button class="modalClose" aria-label="Close picture" onclick="closeChatImage()">×</button><img alt="Chat picture"><a class="btn gold chatImageDownload" download="karaoke-chat-picture.jpg" aria-label="Download picture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg></a></div></div>');
    const chatImageModal = document.getElementById('chatImageModal');
    const modalImage = chatImageModal?.querySelector('img');
    if (modalImage && !modalImage.parentElement.classList.contains('chatImageStage')) {
      const stage = document.createElement('div');
      stage.className = 'chatImageStage';
      modalImage.replaceWith(stage);
      stage.append(modalImage);
    }
    const oldDownload = chatImageModal?.querySelector('.chatImageDownload');
    if (oldDownload?.tagName === 'A') {
      const downloadButton = document.createElement('button');
      downloadButton.type = 'button';
      downloadButton.className = oldDownload.className;
      downloadButton.setAttribute('aria-label', 'Download BCDKC-branded picture');
      downloadButton.title = 'Download BCDKC-branded picture';
      downloadButton.innerHTML = oldDownload.innerHTML;
      downloadButton.addEventListener('click', window.downloadBrandedChatImage);
      oldDownload.replaceWith(downloadButton);
    }
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
    updateChatViewport();
    window.addEventListener('resize', updateChatViewport, { passive: true });
    renderChat();
    syncChat();
  });

  document.addEventListener('click', event => {
    const thumb = event.target.closest('.chatImageThumb');
    if (!thumb) return;
    const article = thumb.closest('[data-chat-id]');
    const message = chatMessages.find(item => item.id === article?.dataset.chatId);
    const src = message?.images?.[Number(thumb.dataset.imageIndex)];
    if (src) openChatImage(src, message.message);
  });
})();
