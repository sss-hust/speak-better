    // =========================
    // 基础状态与工具函数
    // =========================
    const chatList = document.getElementById('chatList');
    const chatInput = document.getElementById('chatInput');
    const shade = document.getElementById('shade');
    const sayGenerateButton = document.getElementById('generateSay');
    const sayStyleButton = document.getElementById('styleSay');
    const sayRerollButton = document.getElementById('rerollSay');
    const editGenerateButton = document.getElementById('generateEdit');
    const editStyleButton = document.getElementById('styleEdit');
    const spaceGenerateButton = document.getElementById('generateSpace');
    const spaceLikeMeButton = document.getElementById('spaceLikeMe');
    const replyGenerateButton = document.getElementById('generateReply');
    let selectedOriginalMsg = '';
    let selectedReplySource = null;
    let sayLikeMe = false;
    let editLikeMe = false;
    let spaceLikeMe = false;
    let sayBatch = 0;
    let currentChatId = 'pcg';

    const sampleMessages = [
      { me:false, avatar:'', avatarClass:'avatar-a', name:'DING', time:'21:25', text:'搞成积分吧，使用功能扣积分（（' },
      { me:false, avatar:'', avatarClass:'avatar-b', name:'怀冬', time:'21:31', text:'我现在立马打通 q 币支付' },
      { me:false, avatar:'', avatarClass:'avatar-c', name:'脸红的泡泡玛特', time:'21:34', text:'大佬们这个数据或者案例有什么要求吗🥺' },
      { me:true, avatar:'', avatarClass:'avatar-me', name:'刘青诺', time:'21:36', text:'老师您好，我是用 google ai studio 做的，可以导出一个网站，请问可以直接提交网站的链接吗🥺' }
    ];
    const chatThreads = {
      pcg: {
        title: '2026PCG校园AI产品创意大赛官方…（1082）',
        timeLabel: '今天 14:20',
        messages: sampleMessages
      },
      homework: {
        title: '小组作业群（5）',
        timeLabel: '星期二 20:10',
        messages: [
          { me:false, avatar:'', avatarClass:'avatar-a', name:'DING', time:'20:03', text:'我把分工表发群里了，大家看一下，有问题今晚前说。' },
          { me:false, avatar:'', avatarClass:'avatar-b', name:'怀冬', time:'20:05', text:'我负责案例和竞品分析，数据那块谁来补？' },
          { me:false, avatar:'', avatarClass:'avatar-c', name:'脸红的泡泡玛特', time:'20:08', text:'我可以整理问卷结果，但是结论部分还需要一起对一下。' },
          { me:true, avatar:'', avatarClass:'avatar-me', name:'我', time:'20:10', text:'好的，那我好好做 PPT，请大家尽量在这周五之前把各自的部分发我哦~' }
        ]
      },
      mentor: {
        title: '李老师',
        timeLabel: '星期一 16:00',
        messages: [
          { me:true, avatar:'', avatarClass:'avatar-me', name:'我', time:'16:00', text:'李老师，最近有空帮我看看论文嘛？' },
          { me:false, avatar:'李', avatarClass:'avatar-a', name:'李老师', time:'16:02', text:'最近忙，过段时间来。' },
          { me:true, avatar:'', avatarClass:'avatar-me', name:'我', time:'16:03', text:'好的好的。' }
        ]
      }
    };

    function addMessage(msg) {
      const wrap = document.createElement('div');
      wrap.className = `msg ${msg.me ? 'me' : ''}`;
      wrap.innerHTML = `
        <div class="avatar ${msg.avatarClass || ''}"><span>${msg.avatar || ''}</span></div>
        <div class="msg-body">
          <div class="meta">${msg.name}</div>
          <div class="bubble">${escapeHtml(msg.text)}</div>
        </div>
      `;
      if (!msg.me) {
        wrap.addEventListener('contextmenu', (e) => openContextMenu(e, msg));
        wrap.addEventListener('touchstart', (e) => {
          wrap._pressTimer = setTimeout(() => openContextMenu(e.touches[0], msg), 550);
        });
        wrap.addEventListener('touchend', () => clearTimeout(wrap._pressTimer));
      }
      chatList.appendChild(wrap);
      chatList.scrollTop = chatList.scrollHeight;
    }

    function renderChatThread(chatId) {
      const thread = chatThreads[chatId] || chatThreads.pcg;
      currentChatId = chatId in chatThreads ? chatId : 'pcg';
      document.getElementById('chatTitle').textContent = thread.title;
      chatList.innerHTML = `<div class="time">${thread.timeLabel}</div>`;
      thread.messages.forEach(addMessage);
      chatInput.value = '';
      closePlusDrawer();
      closeAllFloating();
    }

    function openChatThread(chatId) {
      renderChatThread(chatId);
      switchView('chat');
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function nowTime() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function showShade() { shade.classList.add('show'); }
    function hideShade() { shade.classList.remove('show'); }

    const aiFeatureMeta = [
      ['say', '帮我说', '帮你想上下文，生成更合适的表达', '...'],
      ['rewrite', '帮我改', '优化措辞、润色和表达方式', '✎'],
      ['reply', '帮我回', '结合语境智能生成回复建议', '↩'],
      ['polish', '润色一下', '让表达更自然、更顺、更有温度', '✦'],
      ['likeMe', '像我说', '参考你的表达习惯，让回复更像你本人', '人'],
      ['risk', '语气风险提醒', '识别太冲、太冷、敏感词的说法', '!']
    ];
    const aiPersonaMeta = [
      ['warm', '温和边界鹅', '礼貌、有边界，适合稳妥表达'],
      ['eq', '高情商鹅', '清晰、得体、适合学业与正式沟通'],
      ['meme', '抽象有梗鹅', '幽默、随性、适合轻松场景和 QQ 空间'],
      ['cool', '清冷极简鹅', '短句、克制、减少情绪噪音'],
      ['loose', '松弛摆烂鹅', '轻松、不紧绷，适合熟人聊天']
    ];
    const aiScopeMeta = [
      ['private', '私聊'],
      ['group', '群聊'],
      ['qzone', 'QQ 空间']
    ];
    const aiSettings = {
      floating: false,
      features: { say: true, rewrite: true, reply: true, polish: true, likeMe: false, risk: true },
      persona: 'warm',
      scopes: ['private', 'group', 'qzone'],
      readTarget: 'current',
      hasReadStyle: false,
      readSummary: ''
    };
    const chatReadTargets = {
      current: {
        label: '当前群聊',
        persona: 'warm',
        summary: count => `已读取「当前群聊」${count} 条聊天记录。你的表达偏礼貌、会补上下文，疑问句较多；推荐继续使用「温和边界鹅」，正式场景可切到「高情商鹅」。`
      },
      teacher: {
        label: '老师私聊',
        persona: 'eq',
        messages: ['老师您好，请问这个材料最晚什么时候提交？', '我这边会先整理一版发您。', '谢谢老师，我明白了。'],
        summary: count => `已读取「老师私聊」${count} 条聊天记录。你的表达更偏清晰和正式，已推荐「高情商鹅」，适合学业沟通和提交说明。`
      },
      friend: {
        label: '朋友私聊',
        persona: 'meme',
        messages: ['我现在有点被 DDL 追着跑。', '先救一下这个版本吧哈哈。', '等我把 PPT 从危险区拖回来。'],
        summary: count => `已读取「朋友私聊」${count} 条聊天记录。你的表达更轻松、带一点幽默感，已推荐「抽象有梗鹅」，适合熟人聊天。`
      }
    };
    const currentChatReadProfiles = {
      pcg: {
        persona: 'warm',
        summary: count => `已读取「PCG 大赛沟通群」${count} 条聊天记录。你的表达偏礼貌、会补上下文，疑问句较多；推荐继续使用「温和边界鹅」。`
      },
      homework: {
        persona: 'warm',
        summary: count => `已读取「小组作业群」${count} 条聊天记录。当前语境偏协作推进，推荐使用「温和边界鹅」，能把催进度说得更自然、有边界。`
      },
      mentor: {
        persona: 'eq',
        summary: count => `已读取「李老师」${count} 条聊天记录。当前语境偏正式沟通，已推荐「高情商鹅」，适合向老师说明进度和确认修改方向。`
      }
    };
    let aiMenuSource = null;

    function closeAllFloating() {
      document.querySelectorAll('.drawer,.assistant,.reply-modal,.space-panel,.ai-entry-menu').forEach(el => el.classList.remove('show'));
      document.getElementById('ctxMenu').classList.remove('show');
      document.getElementById('plusBtn').classList.remove('close-plus');
      document.getElementById('app').classList.remove('plus-mode');
      hideShade();
    }

    function closePlusDrawer() {
      document.getElementById('plusDrawer').classList.remove('show');
      document.getElementById('aiEntryMenu').classList.remove('show');
      document.getElementById('plusBtn').classList.remove('close-plus');
      document.getElementById('app').classList.remove('plus-mode');
    }

    function showDetailScreen(screenName) {
      document.querySelectorAll('[data-native-detail]').forEach(screen => {
        screen.classList.toggle('active', screen.dataset.nativeDetail === screenName);
      });
    }

    function openAiDetail(screenName = 'overview') {
      showDetailScreen(screenName);
      switchView('aiDetail');
    }

    function closeAiDetail() {
      showDetailScreen('overview');
      switchView('chat');
    }

    function setAssistantFloating(enabled) {
      aiSettings.floating = enabled;
      document.getElementById('assistantFloat').classList.toggle('show', enabled);
      document.getElementById('aiMenuFloat').textContent = enabled ? '关闭浮窗' : '浮窗形式';
      renderAiDetail();
    }

    function showAiEntryMenu(event, sourceEl) {
      event.preventDefault();
      aiMenuSource = sourceEl;
      const appRect = document.getElementById('app').getBoundingClientRect();
      const sourceRect = sourceEl.getBoundingClientRect();
      const menu = document.getElementById('aiEntryMenu');
      const left = Math.max(12, Math.min(210, sourceRect.left - appRect.left - 18));
      const top = Math.max(76, sourceRect.top - appRect.top - 104);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      document.getElementById('aiMenuFloat').textContent = aiSettings.floating ? '关闭浮窗' : '浮窗形式';
      menu.classList.add('show');
    }

    function closeAiEntryMenu() {
      document.getElementById('aiEntryMenu').classList.remove('show');
    }

    function bindAssistantEntry(el, clickHandler) {
      let timer = null;
      let suppressClick = false;
      const clear = () => {
        clearTimeout(timer);
        timer = null;
        el.classList.remove('is-armed');
      };
      const fireMenu = (event) => {
        suppressClick = true;
        el.classList.add('is-armed');
        showAiEntryMenu(event, el);
        setTimeout(() => {
          suppressClick = false;
          el.classList.remove('is-armed');
        }, 700);
      };
      el.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        clear();
        timer = setTimeout(() => fireMenu(e), 620);
      });
      el.addEventListener('pointerup', clear);
      el.addEventListener('pointerleave', clear);
      el.addEventListener('pointercancel', clear);
      el.addEventListener('contextmenu', (e) => {
        fireMenu(e);
      });
      el.addEventListener('click', (e) => {
        if (suppressClick) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        clickHandler(e);
      });
    }

    function getEnabledFeatureCount() {
      return Object.values(aiSettings.features).filter(Boolean).length;
    }

    function currentPersona() {
      return aiPersonaMeta.find(item => item[0] === aiSettings.persona) || aiPersonaMeta[0];
    }

    function renderFeatureCard([key, title, desc, symbol]) {
      const card = document.createElement('button');
      card.className = `ai-feature-card ${aiSettings.features[key] ? '' : 'off'}`;
      card.type = 'button';
      card.dataset.featureKey = key;
      card.innerHTML = `<div class="feature-symbol symbol-${key}">${symbol}</div><b>${title}</b><p>${desc}</p>`;
      card.addEventListener('click', openAssistantPanel);
      return card;
    }

    function renderFeatureRow([key, title, desc, symbol]) {
      const row = document.createElement('div');
      row.className = `feature-row ${aiSettings.features[key] ? '' : 'off'}`;
      row.innerHTML = `
        <div class="feature-symbol symbol-${key}">${symbol}</div>
        <div class="feature-copy"><b>${title}${key === 'risk' ? ' <span style="color:#ff4f65;font-size:12px;">推荐</span>' : ''}</b><span>${desc}</span></div>
        <button class="switch ${aiSettings.features[key] ? 'on' : ''}" data-feature-toggle="${key}" aria-label="切换${title}"></button>
      `;
      row.querySelector('.switch').addEventListener('click', () => {
        aiSettings.features[key] = !aiSettings.features[key];
        renderAiDetail();
      });
      return row;
    }

    function renderPersonaRow([key, title, desc], compact = false) {
      const row = document.createElement('button');
      row.className = `persona-row ${compact ? 'compact' : ''} ${aiSettings.persona === key ? 'active' : ''}`;
      row.type = 'button';
      row.dataset.personaKey = key;
      row.innerHTML = `
        <div class="persona-avatar"></div>
        <div class="persona-copy"><b>${title}</b><span>${desc}</span></div>
        <div class="persona-check">${aiSettings.persona === key ? '✓' : compact ? '›' : '设为默认'}</div>
      `;
      row.addEventListener('click', () => {
        aiSettings.persona = key;
        renderAiDetail();
        if (compact) showDetailScreen('personas');
      });
      return row;
    }

    function renderAiDetail() {
      const enabled = getEnabledFeatureCount();
      const persona = currentPersona();
      document.getElementById('enabledFeatureCount').textContent = enabled;
      document.getElementById('featureEnabledStat').textContent = enabled;
      document.getElementById('personaCount').textContent = aiPersonaMeta.length;
      document.getElementById('entryVisibleStat').textContent = aiSettings.floating ? '浮窗' : '已显示';

      const overviewGrid = document.getElementById('overviewFeatureGrid');
      overviewGrid.innerHTML = '';
      aiFeatureMeta.forEach(item => overviewGrid.appendChild(renderFeatureCard(item)));

      const featureList = document.getElementById('featureToggleList');
      featureList.innerHTML = '';
      aiFeatureMeta.forEach(item => featureList.appendChild(renderFeatureRow(item)));

      const overviewPersonaList = document.getElementById('overviewPersonaList');
      overviewPersonaList.innerHTML = '';
      aiPersonaMeta.slice(0, 3).forEach(item => overviewPersonaList.appendChild(renderPersonaRow(item, true)));

      const currentCard = document.getElementById('currentPersonaCard');
      currentCard.innerHTML = `
        <div class="persona-row active current-persona" data-persona-key="${persona[0]}" style="border:0;padding:0;">
          <div class="persona-avatar"></div>
          <div class="persona-copy"><span>当前默认人格</span><b>${persona[1]}</b><span>${persona[2]}</span></div>
          <div class="persona-check">✓</div>
        </div>
      `;

      const personaList = document.getElementById('personaOptionList');
      personaList.innerHTML = '';
      aiPersonaMeta.forEach(item => personaList.appendChild(renderPersonaRow(item)));

      const scopeGrid = document.getElementById('scopeGrid');
      scopeGrid.innerHTML = '';
      aiScopeMeta.forEach(([key, title]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `scope-chip ${aiSettings.scopes.includes(key) ? 'active' : ''}`;
        chip.textContent = title;
        chip.addEventListener('click', () => {
          if (aiSettings.scopes.includes(key)) {
            if (aiSettings.scopes.length === 1) return;
            aiSettings.scopes = aiSettings.scopes.filter(item => item !== key);
          } else {
            aiSettings.scopes.push(key);
          }
          renderAiDetail();
        });
        scopeGrid.appendChild(chip);
      });

      document.querySelectorAll('.chat-source').forEach(button => {
        button.classList.toggle('active', button.dataset.chatSource === aiSettings.readTarget);
      });
      const analysisNote = document.getElementById('chatAnalysisNote');
      if (analysisNote) {
        analysisNote.textContent = aiSettings.hasReadStyle
          ? aiSettings.readSummary
          : '点击后读取当前聊天里的最近 30 条消息。仅用于本次分析，不上传云端。';
      }
    }

    function simulatePreviewVoice(inputId, statusId) {
      const input = document.getElementById(inputId);
      const status = document.getElementById(statusId);
      status.textContent = '正在听你说...';
      setTimeout(() => {
        input.value = '帮我把这句话说得更礼貌一点';
        status.textContent = '已识别语音内容，可以继续编辑或点「会说」。';
      }, 520);
    }

    function usePreviewInput(inputId, statusId) {
      const input = document.getElementById(inputId);
      const status = document.getElementById(statusId);
      if (!input.value.trim()) {
        input.value = '帮我委婉催一下小组作业';
      }
      status.textContent = '已把预览内容带入聊天输入框。';
      chatInput.value = input.value.trim();
      openAssistantPanel();
    }

    function getReadableChatMessages() {
      const target = chatReadTargets[aiSettings.readTarget] || chatReadTargets.current;
      if (target.messages) return target.messages.slice(-30);
      const texts = Array.from(document.querySelectorAll('#chatList .bubble'))
        .map(el => el.textContent.trim())
        .filter(Boolean);
      const fallback = sampleMessages.map(msg => msg.text);
      return (texts.length ? texts : fallback).slice(-30);
    }

    function readVisibleChatHistory() {
      const target = chatReadTargets[aiSettings.readTarget] || chatReadTargets.current;
      const recent = getReadableChatMessages();
      const currentProfile = aiSettings.readTarget === 'current'
        ? (currentChatReadProfiles[currentChatId] || currentChatReadProfiles.pcg)
        : target;
      aiSettings.persona = currentProfile.persona;
      aiSettings.hasReadStyle = true;
      aiSettings.readSummary = currentProfile.summary(recent.length);
      renderAiDetail();
    }

    function renderResults(container, texts, closeTarget, options = {}) {
      const { append = false } = options;
      if (!append) container.innerHTML = '';
      texts.forEach((text, index) => {
        const emoji = getEmojiForText(text);
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
          <p>${escapeHtml(text)}</p>
          <div class="card-actions">
            <span class="emoji-tip" data-emoji="${emoji}">推荐表情 ${emoji} · 可点击添加</span>
            <button class="use">使用</button>
          </div>
        `;
        card.querySelector('.emoji-tip').addEventListener('click', () => {
          const p = card.querySelector('p');
          if (!p.textContent.includes(emoji)) p.textContent = p.textContent + emoji;
        });
        card.querySelector('.use').addEventListener('click', () => {
          const finalText = card.querySelector('p').textContent;
          if (closeTarget === 'space') {
            document.getElementById('spaceText').value = finalText;
          } else {
            chatInput.value = finalText;
          }
          closeAllFloating();
        });
        container.appendChild(card);
      });
    }

    function getReplyApiUrl() {
      return window.location.protocol === 'file:'
        ? 'http://127.0.0.1:3000/api/reply-suggestions'
        : '/api/reply-suggestions';
    }

    function getReplyContextMessages() {
      const thread = chatThreads[currentChatId] || chatThreads.pcg;
      return (thread.messages || []).slice(-8).map(msg => ({
        role: msg.me ? 'me' : 'other',
        text: msg.text
      }));
    }

    function getAiGenerationContext(options = {}) {
      const thread = chatThreads[currentChatId] || chatThreads.pcg;
      const persona = currentPersona();
      const profile = currentChatReadProfiles[currentChatId] || currentChatReadProfiles.pcg;
      const readSummary = aiSettings.hasReadStyle
        ? aiSettings.readSummary
        : (profile ? profile.summary((thread.messages || []).length) : '');

      return {
        threadTitle: thread.title,
        sourceName: options.sourceName || '',
        personaKey: persona[0],
        personaLabel: persona[1],
        personaDesc: persona[2],
        readSummary,
        conversation: options.includeConversation === false ? [] : getReplyContextMessages()
      };
    }

    function getReplyRequestContext() {
      return getAiGenerationContext({
        sourceName: selectedReplySource && selectedReplySource.name ? selectedReplySource.name : ''
      });
    }

    function getAssistApiUrl() {
      return window.location.protocol === 'file:'
        ? 'http://127.0.0.1:3000/api/assist-generate'
        : '/api/assist-generate';
    }

    function setReplyLoading(loading) {
      replyGenerateButton.disabled = loading;
      replyGenerateButton.textContent = loading ? '生成中...' : '生成回复建议';
    }

    function setButtonLoading(button, loading, loadingText) {
      if (!button) return;
      if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
      button.disabled = loading;
      button.textContent = loading ? loadingText : button.dataset.defaultText;
    }

    function setSayLoading(loading, reroll = false) {
      setButtonLoading(sayGenerateButton, loading, reroll ? '换一批中...' : '生成中...');
      setButtonLoading(sayRerollButton, loading, '换一批中...');
      sayStyleButton.disabled = loading;
    }

    function setEditLoading(loading) {
      setButtonLoading(editGenerateButton, loading, '修改中...');
      editStyleButton.disabled = loading;
    }

    function setSpaceLoading(loading) {
      setButtonLoading(spaceGenerateButton, loading, '生成中...');
      spaceLikeMeButton.disabled = loading;
    }

    function renderReplyNotice(message) {
      document.getElementById('replyResults').innerHTML = `<div class="warn show">${escapeHtml(message)}</div>`;
    }

    function renderResultNotice(containerId, message) {
      document.getElementById(containerId).innerHTML = `<div class="warn show">${escapeHtml(message)}</div>`;
    }

    async function requestReplySuggestions(original, tone, need) {
      const extraContext = getReplyRequestContext();
      const response = await fetch(getReplyApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original,
          tone,
          need,
          conversation: getReplyContextMessages(),
          ...extraContext
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '回复建议生成失败。');
      }
      if (!Array.isArray(data.replies) || !data.replies.length) {
        throw new Error('接口没有返回可用的回复建议。');
      }
      return data.replies;
    }

    async function requestAssistItems(task, payload) {
      const response = await fetch(getAssistApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          ...payload
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '生成内容失败。');
      }
      if (!Array.isArray(data.items) || !data.items.length) {
        throw new Error('接口没有返回可用内容。');
      }
      return data.items;
    }

    function getEmojiForText(text) {
      if (/老师|请假|正式|麻烦/.test(text)) return '🙏';
      if (/DDL|救命|PPT|复习|淹没/.test(text)) return '🥲';
      if (/哈哈|抽象|动手/.test(text)) return '😂';
      return indexEmoji();
    }

    function indexEmoji() {
      return ['🥲','😂','🙏','✨'][Math.floor(Math.random()*4)];
    }

    // =========================
    // 页面切换与发送消息
    // =========================
    renderChatThread(currentChatId);

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view === 'dynamic' ? 'dynamic' : 'messages';
        switchView(view);
      });
    });
    document.querySelectorAll('.chat-entry').forEach(entry => {
      entry.addEventListener('click', () => openChatThread(entry.dataset.chatId || 'pcg'));
    });
    document.getElementById('backToMessages').addEventListener('click', () => switchView('messages'));
    document.getElementById('jumpSpace').addEventListener('click', () => switchView('dynamic'));
    document.getElementById('openSpaceFromDynamic').addEventListener('click', () => switchView('qzone'));
    document.getElementById('openSpaceWrite').addEventListener('click', () => switchView('qzoneTalk'));
    document.getElementById('backQzoneToDynamic').addEventListener('click', () => switchView('dynamic'));
    document.getElementById('openQzoneTalk').addEventListener('click', () => switchView('qzoneTalk'));
    document.getElementById('openQzoneTalkFromShare').addEventListener('click', () => switchView('qzoneTalk'));
    document.getElementById('backTalkToQzone').addEventListener('click', () => switchView('qzone'));
    document.getElementById('openComposeFromTalk').addEventListener('click', () => switchView('space'));

    function switchView(view) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const map = {
        messages: 'messageView',
        chat: 'chatView',
        qzone: 'qzoneView',
        qzoneTalk: 'qzoneTalkView',
        space: 'spaceView',
        aiDetail: 'aiDetailView',
        dynamic: 'dynamicView'
      };
      document.getElementById(map[view]).classList.add('active');
      document.getElementById('app').classList.toggle('compose-mode', view === 'space');
      const statusByView = {
        messages: ['10:38', '82'],
        chat: ['10:38', '82'],
        qzone: ['11:37', '77'],
        qzoneTalk: ['11:37', '77'],
        space: ['10:38', '82'],
        aiDetail: ['9:41', '82'],
        dynamic: ['10:38', '82']
      };
      document.getElementById('statusTime').textContent = statusByView[view][0];
      document.getElementById('statusBattery').textContent = statusByView[view][1];
      document.getElementById('qqTabs').classList.toggle('hidden', view === 'chat' || view === 'space' || view === 'qzone' || view === 'qzoneTalk' || view === 'aiDetail');
      document.querySelectorAll('.tab').forEach(t => {
        const active = (view === 'messages' && t.dataset.view === 'messages') || (view === 'dynamic' && t.dataset.view === 'dynamic');
        t.classList.toggle('active', active);
      });
      closeAllFloating();
    }
    document.getElementById('cancelSpace').addEventListener('click', () => switchView('qzoneTalk'));

    document.getElementById('sendBtn').addEventListener('click', () => {
      const text = chatInput.value.trim();
      if (!text) return;
      const msg = { me:true, avatar:'', avatarClass:'avatar-me', name:'我', time:nowTime(), text };
      (chatThreads[currentChatId] || chatThreads.pcg).messages.push(msg);
      addMessage(msg);
      chatInput.value = '';
    });

    // =========================
    // 加号面板与会说 AI
    // =========================
    document.getElementById('plusBtn').addEventListener('click', () => {
      const drawer = document.getElementById('plusDrawer');
      closeAiEntryMenu();
      drawer.classList.toggle('show');
      document.getElementById('plusBtn').classList.toggle('close-plus', drawer.classList.contains('show'));
      document.getElementById('app').classList.toggle('plus-mode', drawer.classList.contains('show'));
      if (drawer.classList.contains('show')) chatList.scrollTop = chatList.scrollHeight;
      hideShade();
    });

    function openAssistantPanel() {
      closePlusDrawer();
      document.getElementById('editResults').innerHTML = '';
      document.getElementById('riskWarn').classList.remove('show');
      document.getElementById('assistant').classList.add('show');
      showShade();
    }

    bindAssistantEntry(document.getElementById('openAssistant'), openAssistantPanel);
    bindAssistantEntry(document.getElementById('assistantFloat'), openAssistantPanel);

    document.getElementById('aiMenuFloat').addEventListener('click', () => {
      setAssistantFloating(!aiSettings.floating);
      closeAiEntryMenu();
      closePlusDrawer();
    });
    document.getElementById('aiMenuDetail').addEventListener('click', () => {
      closeAiEntryMenu();
      openAiDetail('overview');
    });
    document.getElementById('backAiDetail').addEventListener('click', closeAiDetail);
    document.getElementById('goFeatureManager').addEventListener('click', () => showDetailScreen('features'));
    document.getElementById('goPersonaManager').addEventListener('click', () => showDetailScreen('personas'));
    document.querySelectorAll('[data-native-goto]').forEach(btn => {
      btn.addEventListener('click', () => showDetailScreen(btn.dataset.nativeGoto));
    });
    document.getElementById('aiPreviewVoice').addEventListener('click', () => simulatePreviewVoice('aiPreviewInput', 'aiPreviewStatus'));
    document.getElementById('featurePreviewVoice').addEventListener('click', () => simulatePreviewVoice('featurePreviewInput', 'featurePreviewStatus'));
    document.getElementById('aiPreviewSay').addEventListener('click', () => usePreviewInput('aiPreviewInput', 'aiPreviewStatus'));
    document.getElementById('featurePreviewSay').addEventListener('click', () => usePreviewInput('featurePreviewInput', 'featurePreviewStatus'));
    document.getElementById('aiPreviewPlus').addEventListener('click', () => switchView('chat'));
    document.getElementById('startAiExperience').addEventListener('click', () => {
      switchView('chat');
      openAssistantPanel();
    });
    document.getElementById('tryRiskFeature').addEventListener('click', () => {
      document.getElementById('featurePreviewInput').value = '你到底什么时候交作业？';
      document.getElementById('featurePreviewStatus').textContent = aiSettings.features.risk ? '已识别：这句话可能偏冲，建议点「会说」改得更稳。' : '语气风险提醒当前关闭，可以先打开再体验。';
    });
    document.getElementById('saveFeatureSettings').addEventListener('click', () => {
      document.getElementById('featureSaveState').textContent = `已保存：${getEnabledFeatureCount()} 个功能开启。`;
      renderAiDetail();
    });
    document.querySelectorAll('.chat-source').forEach(button => {
      button.addEventListener('click', () => {
        aiSettings.readTarget = button.dataset.chatSource || 'current';
        aiSettings.hasReadStyle = false;
        aiSettings.readSummary = '';
        renderAiDetail();
      });
    });
    document.getElementById('readChatHistory').addEventListener('click', readVisibleChatHistory);
    document.getElementById('savePersonaSettings').addEventListener('click', () => {
      const persona = currentPersona();
      const scopes = aiScopeMeta.filter(([key]) => aiSettings.scopes.includes(key)).map(([, title]) => title).join('、');
      document.getElementById('personaSaveState').textContent = `已保存：${persona[1]}，应用于${scopes}。`;
      renderAiDetail();
    });
    renderAiDetail();

    shade.addEventListener('click', closeAllFloating);
    document.querySelectorAll('.close').forEach(btn => {
      btn.addEventListener('click', () => closeAllFloating());
    });

    document.getElementById('sayTab').addEventListener('click', () => {
      document.getElementById('sayPane').style.display = '';
      document.getElementById('editPane').style.display = 'none';
      document.getElementById('sayTab').classList.add('active');
      document.getElementById('editTab').classList.remove('active');
    });
    document.getElementById('editTab').addEventListener('click', () => {
      document.getElementById('sayPane').style.display = 'none';
      document.getElementById('editPane').style.display = '';
      document.getElementById('editTab').classList.add('active');
      document.getElementById('sayTab').classList.remove('active');
      document.getElementById('editResults').innerHTML = '';
      document.getElementById('riskWarn').classList.remove('show');
    });

    document.querySelectorAll('.chips').forEach(group => {
      group.addEventListener('click', (e) => {
        if (!e.target.classList.contains('chip')) return;
        const multi = ['toneChips','editStyleChips','spaceStyleChips'].includes(group.id);
        if (!multi) group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.toggle('active');
      });
    });

    function activeTexts(id) {
      return Array.from(document.getElementById(id).querySelectorAll('.active')).map(x => x.textContent);
    }

    document.getElementById('voiceSay').addEventListener('click', () => {
      startSpeechToText({
        buttonId: 'voiceSay',
        inputId: 'voiceIntent',
        statusId: 'voiceStatus',
        idleText: '已识别语音需求，并自动填入下面的选项。',
        onFinal: parseVoiceIntent
      });
    });
    document.getElementById('voiceEdit').addEventListener('click', () => {
      startSpeechToText({
        buttonId: 'voiceEdit',
        inputId: 'editVoiceIntent',
        statusId: 'voiceEditStatus',
        idleText: '已识别语音内容，可以继续微调后填入。',
        onFinal: parseEditVoice
      });
    });
    document.getElementById('voiceSpace').addEventListener('click', () => {
      startSpeechToText({
        buttonId: 'voiceSpace',
        inputId: 'spaceVoiceIntent',
        statusId: 'voiceSpaceStatus',
        idleText: '已识别语音内容，可以继续微调后填入。',
        onFinal: parseSpaceVoice
      });
    });
    document.getElementById('voiceReply').addEventListener('click', () => {
      startSpeechToText({
        buttonId: 'voiceReply',
        inputId: 'replyVoiceIntent',
        statusId: 'voiceReplyStatus',
        idleText: '已识别回复要求，可以继续微调后生成。',
        onFinal: parseReplyVoice
      });
    });
    document.getElementById('parseVoice').addEventListener('click', () => {
      parseVoiceIntent(document.getElementById('voiceIntent').value.trim());
    });
    document.getElementById('parseEditVoice').addEventListener('click', () => {
      parseEditVoice(document.getElementById('editVoiceIntent').value.trim());
    });
    document.getElementById('parseSpaceVoice').addEventListener('click', () => {
      parseSpaceVoice(document.getElementById('spaceVoiceIntent').value.trim());
    });
    document.getElementById('parseReplyVoice').addEventListener('click', () => {
      parseReplyVoice(document.getElementById('replyVoiceIntent').value.trim());
    });
    document.getElementById('generateSay').addEventListener('click', async () => {
      await renderSaySuggestions(false);
    });
    document.getElementById('rerollSay').addEventListener('click', async () => {
      await renderSaySuggestions(true);
    });
    document.getElementById('styleSay').addEventListener('click', async () => {
      sayLikeMe = true;
      document.getElementById('styleNoteSay').style.display = 'block';
      await renderSaySuggestions(false);
    });

    async function renderSaySuggestions(nextBatch) {
      sayBatch = nextBatch ? sayBatch + 1 : 0;
      setSayLoading(true, nextBatch);
      renderResultNotice('sayResults', '正在调用 DeepSeek 生成表达建议...');
      try {
        const items = await requestAssistItems('say', {
          target: document.getElementById('target').value,
          purpose: document.getElementById('purpose').value.trim(),
          tone: activeTexts('toneChips'),
          length: activeTexts('lengthChips').join(''),
          likeMe: sayLikeMe,
          rerollIndex: sayBatch,
          ...getAiGenerationContext()
        });
        renderResults(document.getElementById('sayResults'), items, 'chat');
      } catch (error) {
        renderResultNotice('sayResults', `调用真实接口失败：${error.message}。下面先给你本地兜底建议。`);
        renderResults(document.getElementById('sayResults'), generateSay(), 'chat', { append: true });
      } finally {
        document.getElementById('rerollSay').style.display = 'inline-flex';
        setSayLoading(false, nextBatch);
      }
    }

    function setVoiceStatus(status, text, type = '') {
      status.textContent = text;
      status.classList.toggle('error', type === 'error');
      status.classList.toggle('ok', type === 'ok');
    }

    function startSpeechToText({ buttonId, inputId, statusId, idleText, onFinal }) {
      const status = document.getElementById(statusId);
      const input = document.getElementById(inputId);
      const btn = document.getElementById(buttonId);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceStatus(status, '当前电脑浏览器没有开放真实语音识别接口，请用 Chrome/Edge 打开页面并允许麦克风，或直接在下方输入。', 'error');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.continuous = false;
      btn.classList.add('listening');
      setVoiceStatus(status, '正在听你说话...如果浏览器弹出麦克风权限，请选择允许。');
      recognition.onresult = (event) => {
        const text = Array.from(event.results).map(result => result[0].transcript).join('');
        input.value = text;
        if (event.results[event.results.length - 1].isFinal) onFinal(text);
      };
      recognition.onerror = (event) => {
        const tips = {
          'not-allowed': '麦克风权限被浏览器拦截了。请在地址栏权限里允许麦克风后再试。',
          'audio-capture': '没有检测到可用麦克风，请检查电脑麦克风输入。',
          'no-speech': '没有听到语音，可以靠近麦克风再点一次。',
          'network': '语音识别服务连接失败，电脑端浏览器可能暂时不可用。可以先手动输入这句话。'
        };
        setVoiceStatus(status, tips[event.error] || '没有识别成功，可以再点一次，或直接输入这句话。', 'error');
      };
      recognition.onend = () => {
        btn.classList.remove('listening');
        if (input.value.trim()) setVoiceStatus(status, idleText, 'ok');
      };
      try {
        recognition.start();
      } catch (error) {
        btn.classList.remove('listening');
        setVoiceStatus(status, '语音识别没有启动成功，请稍等一秒再点，或直接在下方输入。', 'error');
      }
    }

    function parseVoiceIntent(text) {
      const status = document.getElementById('voiceStatus');
      if (!text) {
        setVoiceStatus(status, '先说一句或输入一句需求，AI 才能帮你拆成对象、目的、语气和长度。', 'error');
        return;
      }
      const target = document.getElementById('target');
      if (/老师|导师|辅导员/.test(text)) target.value = '老师';
      else if (/同学/.test(text)) target.value = '同学';
      else if (/朋友|闺蜜|兄弟/.test(text)) target.value = '朋友';
      else if (/暧昧|喜欢的人|crush/i.test(text)) target.value = '暧昧对象';
      else if (/小组|组员|成员|队友/.test(text)) target.value = '小组成员';

      const purpose = document.getElementById('purpose');
      if (/催|作业|初稿|进度|DDL/i.test(text)) purpose.value = '催交作业';
      else if (/请假|缺席|不到场/.test(text)) purpose.value = '请假说明';
      else if (/拒绝|不方便|不想去/.test(text)) purpose.value = '委婉拒绝';
      else if (/安慰|难过|崩溃|哭/.test(text)) purpose.value = '安慰朋友';
      else if (/道歉|不好意思|抱歉/.test(text)) purpose.value = '表达歉意';
      else purpose.value = text.replace(/^帮我|生成|写一段|发一段/g, '').slice(0, 28);

      setChipState('toneChips', [
        [/礼貌|客气|正式/.test(text), '礼貌'],
        [/委婉|温柔|别太硬/.test(text), '委婉'],
        [/边界|坚定|不卑不亢/.test(text), '有边界'],
        [/高情商|会说话/.test(text), '高情商'],
        [/抽象|有梗/.test(text), '抽象'],
        [/发疯|癫/.test(text), '发疯']
      ]);
      setSingleChip('lengthChips', /详细|长一点/.test(text) ? '详细' : (/适中|正常/.test(text) ? '适中' : '简短'));
      setVoiceStatus(status, '已把这句语音拆成可编辑选项，可以直接生成建议。', 'ok');
    }

    function parseEditVoice(text) {
      const status = document.getElementById('voiceEditStatus');
      if (!text) {
        setVoiceStatus(status, '先说一句要修改的话，或者把语音内容打在这里。', 'error');
        return;
      }
      const quoteMatch = text.match(/[“"']([^“”"']+)[”"']/);
      const raw = quoteMatch ? quoteMatch[1] : text.replace(/^(帮我|把|将|请把)/, '').replace(/(改得|改成|润色成|变得|语气).*$/, '').trim();
      document.getElementById('editText').value = raw || text;
      setChipState('editStyleChips', [
        [/礼貌|客气/.test(text), '更礼貌'],
        [/委婉|温柔|别太硬|不像质问/.test(text), '更委婉'],
        [/正式|老师|邮件/.test(text), '更正式'],
        [/有梗|幽默|好玩/.test(text), '更有梗'],
        [/抽象|发疯/.test(text), '更抽象']
      ], false);
      document.getElementById('editResults').innerHTML = '';
      document.getElementById('riskWarn').classList.remove('show');
      setVoiceStatus(status, '已填入原句和修改风格，点击“修改”后再生成参考。', 'ok');
    }

    function parseSpaceVoice(text) {
      const status = document.getElementById('voiceSpaceStatus');
      if (!text) {
        setVoiceStatus(status, '先说一句想发的内容，或者把语音内容打在这里。', 'error');
        return;
      }
      const draft = text
        .replace(/帮我|润色一下|润色|发一条|发一个|写一条|写一个|说说|空间/g, '')
        .replace(/(成|为)?(自然日常|抽象有梗|情绪氛围|高情商).*/, '')
        .trim() || text;
      document.getElementById('spaceText').value = draft.slice(0, 80);
      setSingleChip('spaceStyleChips', /抽象|有梗|发疯/.test(text) ? '抽象有梗版' : (/情绪|氛围|emo/.test(text) ? '情绪氛围版' : (/高情商|温柔/.test(text) ? '高情商版' : '自然日常版')));
      document.getElementById('spaceResults').innerHTML = '';
      setVoiceStatus(status, '已把语音内容填入说说草稿，点击“生成”后再给出润色参考。', 'ok');
    }

    function parseReplyVoice(text) {
      const status = document.getElementById('voiceReplyStatus');
      if (!text) {
        setVoiceStatus(status, '先说一句你想怎么回复，或者把要求打在这里。', 'error');
        return;
      }
      document.getElementById('replyNeed').value = text.replace(/^帮我|回复|生成/g, '').trim() || text;
      setChipState('replyToneChips', [
        [/友好|温和|正常/.test(text), '友好'],
        [/幽默|好笑|有梗/.test(text), '幽默'],
        [/感谢|谢谢/.test(text), '感谢'],
        [/拒绝|不方便|不想/.test(text), '拒绝'],
        [/高冷|冷淡|简短/.test(text), '高冷'],
        [/抽象|发疯/.test(text), '抽象']
      ]);
      document.getElementById('replyResults').innerHTML = '';
      setVoiceStatus(status, '已填入回复要求和语气，点击“生成回复建议”后再出现参考。', 'ok');
    }

    function setChipState(id, rules, useFallback = true) {
      const group = document.getElementById(id);
      const matched = rules.filter(rule => rule[0]).map(rule => rule[1]);
      group.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('active', matched.includes(chip.textContent)));
      if (!matched.length && useFallback) {
        const fallback = group.querySelector('.chip');
        if (fallback) fallback.classList.add('active');
      }
    }

    function setSingleChip(id, text) {
      const group = document.getElementById(id);
      group.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('active', chip.textContent === text));
    }

    function generateSay() {
      const target = document.getElementById('target').value;
      const purpose = document.getElementById('purpose').value.trim();
      const tones = activeTexts('toneChips').join('');
      const like = sayLikeMe;

      if (/催|作业|进度|DDL/i.test(purpose)) {
        if (target === '小组成员') {
          return pickBatch(like
            ? [
                ['我准备开始整合啦，大家各自的部分大概什么时候能发我呀~', 'DDL 有点近了🥲 大家方便这周五前把各自的部分发我吗？我好先合进去。', '救命，DDL 在追我们了哈哈，大家这周五前能不能先把各自部分救一下？'],
                ['我这边准备把大家的内容合一下啦，麻烦大家这周五前先发我一版嘛~', '我们离 DDL 有点近了🥲 大家方便先把初稿发我，我后面统一顺一下。', '先交一个能活的版本也行哈哈，大家这周五前把各自那块发我一下可以嘛？'],
                ['我开始收材料啦，大家各自的部分如果方便的话这周五前发我一下呀。', '怕后面整合来不及，想跟大家确认一下这周五前能不能先给一版。', '我们先把进度往前推一点点，大家这周五前把各自部分发我可以吗？']
              ]
            : [
                ['我准备开始整合了，想确认一下大家各自的部分这周五前是否方便发我。', 'DDL 有点近了，麻烦大家这周五前先发一版各自负责的内容，我这边好先合进去。', '我这边需要预留整合时间，所以想请大家尽量在这周五前把各自部分发我。'],
                ['我准备汇总大家的内容，想确认一下各位这周五前是否方便发我。', '后面还需要留一点整合时间，麻烦大家先把目前完成的部分发我。', '为了不影响整体提交，想请大家这周五前把各自负责的内容发我。'],
                ['我开始整理最终版本了，大家如果还没完全做完，也可以先发当前版本给我。', '时间有点紧，我想先把框架合起来，麻烦大家这周五前把各自部分发我。', '想跟大家对一下进度，各自负责的部分大概什么时候可以给到我？']
              ]);
        }
        return pickBatch(like
          ? [
              ['我准备开始整合啦，你那部分大概什么时候能发我呀~', 'DDL 有点近了🥲 你方便今晚先发个初版吗？我这边先合进去。', '救命，DDL 在追我们了哈哈，你那块今晚能不能先救一下？'],
              ['我这边准备把大家的内容合一下啦，你那部分今晚能先给我一版嘛~', '我们离 DDL 有点近了🥲 你方便先发初稿，我后面再帮你一起顺。', '先交一个能活的版本也行哈哈，你今晚能不能先把你那块发我？'],
              ['我开始收材料啦，你那部分如果方便的话今晚发我一下呀。', '怕后面整合来不及，想跟你确认一下今晚能不能先给初版。', '我们先把进度往前推一点点，你那块今晚救一下可以吗？']
            ]
          : [
              ['我准备开始整合啦，你那部分大概什么时候能发我呀？', 'DDL 有点近了🥲 你方便今晚先发一个初版吗？我这边好先合进去。', '我这边需要预留整合时间，所以想确认一下你那部分今天能不能发我。'],
              ['我这边准备汇总大家的内容，想确认一下你那部分今晚是否方便发我。', '我们后面还需要留一点整合时间，你方便先给我一个初版吗？', '为了不影响整体提交，想麻烦你今天先把目前完成的部分发我。'],
              ['我开始整理最终版本了，你那部分如果还没完全做完，也可以先发当前版本给我。', '时间有点紧，我想先把框架合起来，你方便今晚发我一下吗？', '想跟你对一下进度，你那部分大概几点可以给到我？']
            ]);
      }
      if (/请假|延期|老师/.test(purpose) || target === '老师') {
        return pickBatch([
          ['老师您好，我想和您说明一下情况，今天因为临时原因可能无法按时到场，想请问是否可以请假？', '老师您好，打扰您了。我这边有一点特殊情况，想申请请假一次，后续内容我会及时补上。', '老师您好，请问这次任务是否可以稍微延期提交？我会尽快完成并补交给您。'],
          ['老师您好，今天临时有些情况需要处理，想向您请假一次，请问可以吗？', '老师您好，不好意思打扰您。我今天可能无法按时参加，想跟您说明并申请请假。', '老师您好，这次提交我这边可能需要多一点时间，请问是否可以延期到今晚补交？'],
          ['老师您好，我这边遇到一点临时情况，想提前跟您说明并请假，后续安排我会及时补上。', '老师您好，抱歉临时打扰。今天我可能不能正常到场，想请问是否可以请假一次。', '老师您好，我想申请稍微延后提交，完成后会第一时间发给您。']
        ]);
      }
      if (/拒绝|不想|不方便/.test(purpose)) {
        return pickBatch([
          ['谢谢你想到我，不过我这边最近确实不太方便，可能没法答应这次。', '这件事我可能帮不上太多，怕答应了反而耽误你，所以先跟你说清楚。', '我理解你的需求，但我这边时间不太允许，这次可能需要先拒绝一下。'],
          ['这次我可能不太方便参与，但还是谢谢你来问我。', '我怕自己时间排不开，答应了反而影响你，所以这次先不接啦。', '这件事我这边确实不太合适，可能需要先婉拒一下。'],
          ['谢谢邀请，不过我最近安排有点满，这次可能没办法啦。', '我想了一下，这次可能帮不上你，提前跟你说清楚比较好。', '这次我先不参与了，避免后面临时掉链子影响你。']
        ]);
      }
      if (/安慰|难过|朋友/.test(purpose)) {
        return pickBatch([
          ['我在的，你不用马上变好，先慢慢说，我听着。', '这件事确实挺难受的，不是你太敏感。先别一个人憋着。', '抱抱你，今天已经很不容易了，我们先把情绪放一放也没关系。'],
          ['你现在难受很正常，先别急着怪自己。', '我陪你缓一会儿，想说就说，不想说也没关系。', '今天已经够辛苦了，先允许自己低落一下。'],
          ['别一个人扛着，我在这里。', '这件事换谁都会不好受，你的感受是合理的。', '先深呼吸一下，我们一点点来，不用马上解决所有事。']
        ]);
      }
      if (/抽象|发疯/.test(tones)) {
        return pickBatch([
          ['收到，精神状态已接入，先让我组织一下语言。', '这事儿确实有点抽象，但我懂你的意思。', '别急，我先用人类能懂的方式回一下。'],
          ['我懂了，这句话需要一点发疯但不能真的发疯。', '已加载抽象表达包，但会保持基本礼貌。', '先稳住，我们用一种看似正常的方式把话说完。'],
          ['翻译成人话就是：我懂，但我需要一点空间。', '这个局面很离谱，但我会尽量回得体面。', '让我把精神状态折叠成一句能发出去的话。']
        ]);
      }
      return pickBatch([
        ['我明白你的意思，我这边会尽快确认一下。', '可以的，我先看一下情况，稍后回复你。', '收到，我这边先处理一下，有进展再跟你说。'],
        ['好的，我先了解一下具体情况，再给你一个明确回复。', '收到，我这边确认完之后马上跟你说。', '可以，我先处理手头这部分，晚点给你反馈。'],
        ['我知道啦，我这边先看一下怎么安排比较合适。', '没问题，我先整理一下，等下回复你。', '收到，我会尽快处理，有结果第一时间告诉你。']
      ]);
    }

    function pickBatch(banks) {
      return banks[sayBatch % banks.length];
    }

    document.getElementById('generateEdit').addEventListener('click', async () => {
      await renderEdit();
    });
    document.getElementById('styleEdit').addEventListener('click', async () => {
      editLikeMe = true;
      document.getElementById('styleNoteEdit').style.display = 'block';
      await renderEdit();
    });

    async function renderEdit() {
      const text = document.getElementById('editText').value.trim();
      if (!text) {
        document.getElementById('riskWarn').classList.remove('show');
        document.getElementById('editResults').innerHTML = '<div class="warn show">先输入一句想修改的话，或者用上面的语音入口填入。</div>';
        return;
      }
      const risky = /到底|怎么还|为什么不|赶紧|快点/.test(text);
      document.getElementById('riskWarn').classList.toggle('show', risky);
      setEditLoading(true);
      renderResultNotice('editResults', '正在调用 DeepSeek 修改表达...');
      try {
        const items = await requestAssistItems('edit', {
          text,
          styles: activeTexts('editStyleChips'),
          likeMe: editLikeMe,
          risky,
          ...getAiGenerationContext()
        });
        renderResults(document.getElementById('editResults'), items, 'chat');
      } catch (error) {
        renderResultNotice('editResults', `调用真实接口失败：${error.message}。下面先给你本地兜底建议。`);
        renderResults(document.getElementById('editResults'), generateEdit(text, risky), 'chat', { append: true });
      } finally {
        setEditLoading(false);
      }
    }

    function generateEdit(text, risky) {
      if (/作业|交|进度|DDL/.test(text) || risky) {
        return editLikeMe
          ? ['我准备开始整合啦，你那部分大概什么时候能发我呀~', 'DDL 有点近了🥲 你方便今晚先发个初版吗？', '救命，我们不能被 DDL 带走哈哈，你那部分今晚能先给我吗？']
          : ['我准备开始整合啦，你那部分大概什么时候能发我？', 'DDL 有点近了，你方便今晚先发一个初版吗？我这边好先合进去。', '我这边需要预留整合时间，所以想确认一下你那部分今天能不能发我。'];
      }
      if (/不去|不想|拒绝/.test(text)) {
        return ['谢谢你邀请我，不过我这次可能不太方便参加。', '我这边安排有点冲突，这次可能去不了啦。', '这次我先不参加了，你们玩得开心一点。'];
      }
      return ['我帮你把这句话改得更自然一点：' + text, '更委婉一点可以说：' + text.replace(/！/g,'。'), '如果想更高情商一点，可以先说明原因，再表达自己的想法。'];
    }

    // =========================
    // 长按消息菜单与帮我回
    // =========================
    function openContextMenu(e, msg) {
      e.preventDefault && e.preventDefault();
      selectedReplySource = msg || null;
      selectedOriginalMsg = msg && msg.text ? msg.text : '';
      const menu = document.getElementById('ctxMenu');
      const rect = document.getElementById('app').getBoundingClientRect();
      const x = Math.min((e.clientX || 80) - rect.left, 150);
      const y = Math.min((e.clientY || 200) - rect.top, 540);
      menu.style.left = Math.max(10, x) + 'px';
      menu.style.top = Math.max(60, y) + 'px';
      menu.classList.add('show');
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ctxMenu') && !e.target.closest('.msg')) {
        document.getElementById('ctxMenu').classList.remove('show');
      }
      if (!e.target.closest('#aiEntryMenu') && !e.target.closest('#openAssistant') && !e.target.closest('#assistantFloat')) {
        closeAiEntryMenu();
      }
    });

    document.getElementById('helpReply').addEventListener('click', () => {
      document.getElementById('ctxMenu').classList.remove('show');
      document.getElementById('quotedMsg').textContent = selectedOriginalMsg;
      document.getElementById('replyResults').innerHTML = '';
      document.getElementById('replyVoiceIntent').value = '';
      document.getElementById('replyNeed').value = '';
      document.getElementById('replyModal').classList.add('show');
      showShade();
    });

    replyGenerateButton.addEventListener('click', async () => {
      const tone = activeTexts('replyToneChips');
      const toneText = tone.join('、');
      const need = document.getElementById('replyNeed').value.trim();
      if (!selectedOriginalMsg) {
        renderReplyNotice('请先选择一条原消息，再生成回复建议。');
        return;
      }

      setReplyLoading(true);
      renderReplyNotice('正在调用 DeepSeek 生成回复建议...');

      try {
        const replies = await requestReplySuggestions(selectedOriginalMsg, tone, need);
        renderResults(document.getElementById('replyResults'), replies, 'chat');
      } catch (error) {
        renderReplyNotice(`调用真实接口失败：${error.message}。下面先给你本地兜底建议。`);
        renderResults(document.getElementById('replyResults'), generateReplyFallback(selectedOriginalMsg, toneText, need), 'chat', { append: true });
      } finally {
        setReplyLoading(false);
      }
    });

    function generateReplyFallback(original, tone, need = '') {
      const combined = original + ' ' + need;
      if (/催|进度|作业|初版|DDL/i.test(combined)) {
        return tone.includes('幽默') || tone.includes('抽象')
          ? ['可以可以，但 DDL 已经在门口探头了🥲 你今晚先发初版就行。', '行，先救一个初版也算功德无量，你大概几点能发我？', '没问题，我们先把它从危险区拖回来，你今晚先给我一版。']
          : ['可以的，那你今晚方便先发一个初版吗？我这边先合进去。', '没问题，你大概几点能发我？我好安排整合时间。', '可以，但我们时间有点紧，麻烦你尽量今晚发我一下。'];
      }
      if (/幽默|有梗/.test(need)) {
        return ['收到，我先确认一下，争取不让事情变成连续剧。', '可以，我这边先看一下情况，有结果立刻汇报。', '明白，我去处理一下，尽量让它优雅落地。'];
      }
      if (/请假|报名表|老师|问题/.test(original)) {
        return ['老师收到，我会尽快整理好发给您。', '老师您好，我这边确认一下信息，整理好后及时发您。', '好的老师，如果有不清楚的地方我会及时和您沟通。'];
      }
      if (/付款码|钱|转账|收款/.test(original)) {
        return ['收到，我确认一下金额后转你。', '好滴，我等下转过去，转完跟你说。', '可以，你把金额也发我一下，我一起核对。'];
      }
      if (/晚点|可以吗|还差/.test(original)) {
        return tone.includes('幽默') || tone.includes('抽象')
          ? ['可以，但 DDL 已经在门口敲门了🥲 你今晚先发初版就行。', '行，先救一个初版也算功德无量。', '可以可以，我们先把 PPT 从危险区拖回来。']
          : ['可以的，那你今晚方便先发一个初版吗？我这边先合进去。', '没问题，你大概几点能发我？我好安排整合时间。', '可以，但我们时间有点紧，麻烦你尽量今晚发我一下。'];
      }
      if (tone.includes('拒绝')) {
        return ['谢谢你想到我，不过这次我可能不太方便。', '我理解你的意思，但这件事我这边暂时做不了。', '这次我可能没法答应，怕耽误你所以先说清楚。'];
      }
      return ['收到，我看一下再回复你。', '可以的，我这边先确认一下。', '明白，我等下处理完跟你说。'];
    }

    // =========================
    // QQ 空间润色
    // =========================
    function openSpacePolishPanel() {
      document.getElementById('spaceResults').innerHTML = '';
      document.getElementById('spacePanel').classList.add('show');
      showShade();
    }

    document.getElementById('openPolish').addEventListener('click', openSpacePolishPanel);
    document.getElementById('inlinePolish').addEventListener('click', openSpacePolishPanel);

    document.getElementById('spaceLikeMe').addEventListener('click', async () => {
      spaceLikeMe = true;
      document.getElementById('spaceStyleNote').style.display = 'block';
      await renderSpaceSuggestions();
    });

    document.getElementById('generateSpace').addEventListener('click', async () => {
      await renderSpaceSuggestions();
    });

    async function renderSpaceSuggestions() {
      const draft = document.getElementById('spaceText').value.trim() || '复习好累';
      setSpaceLoading(true);
      renderResultNotice('spaceResults', '正在调用 DeepSeek 生成说说文案...');
      try {
        const items = await requestAssistItems('space', {
          draft,
          styles: activeTexts('spaceStyleChips'),
          likeMe: spaceLikeMe,
          ...getAiGenerationContext({ includeConversation: false })
        });
        renderResults(document.getElementById('spaceResults'), items, 'space');
      } catch (error) {
        renderResultNotice('spaceResults', `调用真实接口失败：${error.message}。下面先给你本地兜底建议。`);
        renderResults(document.getElementById('spaceResults'), generateSpaceCopy(), 'space', { append: true });
      } finally {
        setSpaceLoading(false);
      }
    }

    function generateSpaceCopy() {
      const draft = document.getElementById('spaceText').value.trim() || '复习好累';
      const styles = activeTexts('spaceStyleChips').join('');
      if (spaceLikeMe) {
        return ['本人已进入 PPT 淹没模式，勿扰，除非你会划重点🥲', '复习进度：打开了。精神状态：关闭了。', '不是我不想学，是这门课先对我动手的。'];
      }
      if (/复习|期末|好累|PPT|学习/.test(draft) || /抽象|有梗/.test(styles)) {
        return /高情商/.test(styles)
          ? ['在混乱里慢慢往前挪，也算是一种认真。', '今天也在努力靠近那个“不慌”的自己。', '复习很累，但每看完一点都算数。']
          : ['本人已进入 PPT 淹没模式，勿扰，除非你会划重点🥲', '复习进度：打开了。精神状态：关闭了。', '不是我不想学，是这门课先对我动手的。'];
      }
      if (/生日|纪念日/.test(draft)) {
        return ['又认真生活了一年，继续保持可爱和清醒。', '今天值得被记住，也值得被好好庆祝。', '愿望不多，先祝自己一直有好运气。'];
      }
      if (/旅游|美食|日常|照片/.test(draft)) {
        return ['把今天存档，快乐有图有真相。', '普通日子里的小确幸，已成功捕获。', '今天的快乐浓度刚刚好。'];
      }
      return ['今天也算认真生活了一下。', '一些新鲜事，发出来证明我来过。', '把这一刻放进空间里，过几天再回来看看。'];
    }

    document.getElementById('publishBtn').addEventListener('click', () => {
      const text = document.getElementById('spaceText').value.trim();
      alert(text ? '说说已模拟发表：\n' + text : '先写点内容或点击“润色一下”生成文案吧。');
    });
  
