const config = require('./config');

const TASK_META = {
  say: {
    label: '帮我说',
    fallbackType: 'chat'
  },
  edit: {
    label: '帮我改',
    fallbackType: 'chat'
  },
  space: {
    label: '润色一下',
    fallbackType: 'space'
  }
};

async function generateAssist(input) {
  const task = String(input.task || '').trim();
  if (!TASK_META[task]) {
    throw createError(400, '不支持的生成任务。');
  }

  const brief = buildAssistBrief(task, input);

  if (!config.apiKey) {
    return {
      items: buildAssistFallbacks(brief),
      source: 'fallback'
    };
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        temperature: getAssistTemperature(task),
        max_tokens: 720,
        messages: buildAssistMessages(brief)
      })
    });

    const rawText = await response.text();
    const payload = tryParseJson(rawText);
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message
        ? payload.error.message
        : `DeepSeek 接口请求失败（HTTP ${response.status}）。`;
      throw createError(response.status, message);
    }

    const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? String(payload.choices[0].message.content || '').trim()
      : '';

    const parsedItems = parseAssistItems(content);
    const items = filterAssistItems(parsedItems, brief);
    if (items.length < 3) {
      return {
        items: buildAssistFallbacks(brief),
        source: 'fallback'
      };
    }

    return {
      items,
      source: 'model'
    };
  } catch (error) {
    console.error('assist generation failed, fallback applied:', task, error.message || error);
    return {
      items: buildAssistFallbacks(brief),
      source: 'fallback'
    };
  }
}

function buildAssistBrief(task, input) {
  const personaKey = String(input.personaKey || 'warm').trim() || 'warm';
  const personaLabel = String(input.personaLabel || '').trim() || getPersonaLabel(personaKey);
  const personaDesc = String(input.personaDesc || '').trim() || getPersonaDesc(personaKey);
  const readSummary = String(input.readSummary || '').trim();
  const threadTitle = String(input.threadTitle || '').trim();
  const conversation = normalizeConversation(input.conversation);
  const likeMe = Boolean(input.likeMe);
  const rerollIndex = Number.isFinite(Number(input.rerollIndex)) ? Number(input.rerollIndex) : 0;

  const common = {
    task,
    personaKey,
    personaLabel,
    personaDesc,
    readSummary,
    threadTitle,
    conversation,
    likeMe,
    rerollIndex,
    toneList: normalizeArray(input.tone),
    styleList: normalizeArray(input.styles),
    lengthText: String(input.length || '').trim(),
    target: String(input.target || '').trim(),
    purpose: String(input.purpose || '').trim(),
    text: String(input.text || '').trim(),
    draft: String(input.draft || '').trim()
  };

  if (task === 'say') {
    return {
      ...common,
      taskLabel: TASK_META[task].label,
      goal: inferSayGoal(common),
      subject: `${common.target || '聊天对象'} / ${common.purpose || '未填写目的'}`,
      instructionText: [
        `对象：${common.target || '未指定'}`,
        `目的：${common.purpose || '未指定'}`,
        `语气 chips：${common.toneList.join('、') || '无'}`,
        `长度：${common.lengthText || '适中'}`,
        `像我说：${common.likeMe ? '是' : '否'}`
      ].join('\n')
    };
  }

  if (task === 'edit') {
    const risky = Boolean(input.risky);
    return {
      ...common,
      risky,
      taskLabel: TASK_META[task].label,
      goal: risky ? '把原句降风险、变自然' : '保留原意，把原句改得更自然更贴场景',
      subject: common.text || '未填写原句',
      instructionText: [
        `原句：${common.text || '无'}`,
        `修改风格：${common.styleList.join('、') || '未指定'}`,
        `像我说：${common.likeMe ? '是' : '否'}`,
        `风险提示：${risky ? '这句话可能显得有压迫感或像质问' : '无明显风险提示'}`
      ].join('\n')
    };
  }

  return {
    ...common,
    taskLabel: TASK_META[task].label,
    goal: inferSpaceGoal(common),
    subject: common.draft || '未填写草稿',
    instructionText: [
      `草稿：${common.draft || '无'}`,
      `风格：${common.styleList.join('、') || '自然日常版'}`,
      `更像我说：${common.likeMe ? '是' : '否'}`
    ].join('\n')
  };
}

function buildAssistMessages(brief) {
  const conversationText = brief.conversation.length
    ? brief.conversation.map((item) => `${item.role === 'me' ? '我' : '对方'}：${item.text}`).join('\n')
    : '无';
  const readStyleText = brief.readSummary || `当前默认人格是「${brief.personaLabel}」：${brief.personaDesc}`;
  const taskRules = getTaskRules(brief);
  const angleText = getTaskAngles(brief).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const bannedText = getAssistBannedPhrases(brief).join('、');

  return [
    {
      role: 'system',
      content: [
        '你是「会说 AI」演示版的文案生成引擎。',
        '你的输出必须像真实中文聊天或真实社交文案，而不是模板、客服、汇报口吻。',
        '你需要稳定体现预设人格风格，不能只会说“收到、明白、我先看看”。',
        '请严格返回 JSON 对象，格式为 {"items":[{"angle":"...","text":"..."},{"angle":"...","text":"..."},{"angle":"...","text":"..."}]}。',
        '只返回 JSON，不要解释，不要 markdown。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `任务：${brief.taskLabel}`,
        `目标：${brief.goal}`,
        `当前人格：${brief.personaLabel}`,
        `人格描述：${brief.personaDesc}`,
        `聊天或内容主题：${brief.subject}`,
        `线程标题：${brief.threadTitle || '无'}`,
        `最近聊天上下文：\n${conversationText}`,
        `最近风格画像：${readStyleText}`,
        `用户输入：\n${brief.instructionText}`,
        `本轮是第 ${brief.rerollIndex + 1} 次生成，如与之前相似请主动换表达方式。`,
        '任务细则：',
        taskRules.join('\n'),
        `必须避免的弱表达：${bannedText}`,
        '请按下面 3 个角度各写 1 条：',
        angleText
      ].join('\n')
    }
  ];
}

function getTaskRules(brief) {
  if (brief.task === 'say') {
    return [
      '1. 输出的是可以直接发给对方的话。',
      '2. 要先完成目的，不要只顾礼貌。',
      '3. 如果对象是老师，要得体清楚；如果是小组成员或朋友，要更像真实 QQ 聊天。',
      `4. 字数控制：${brief.lengthText || '适中'}。`,
      `5. tone chips：${brief.toneList.join('、') || '无'}。`
    ];
  }

  if (brief.task === 'edit') {
    return [
      '1. 保留原句核心意思，但改得更自然、更贴场景。',
      '2. 不要输出“我帮你改成”这种解释句，直接给改好的版本。',
      '3. 如果原句偏冲，要显著降风险。',
      `4. 修改风格：${brief.styleList.join('、') || '无特别要求'}。`,
      `5. 像我说：${brief.likeMe ? '是，需要更口语、更像本人' : '否，保持通用自然' }。`
    ];
  }

  return [
    '1. 输出的是可以直接发在 QQ 空间/说说里的文案。',
    '2. 要有一句成文的感觉，但不能太像朋友圈鸡汤。',
    '3. 三条要明显不同：可以一条更自然，一条更有梗，一条更有情绪或更高级。',
    `4. 当前风格：${brief.styleList.join('、') || '自然日常版'}。`,
    `5. 更像我说：${brief.likeMe ? '是，允许更明显的个人习惯和口癖' : '否'}。`
  ];
}

function getTaskAngles(brief) {
  if (brief.task === 'say') {
    if (/老师/.test(brief.target)) return ['稳妥得体', '清楚说明安排', '更像本人'];
    if (/小组|成员|同学/.test(brief.target)) return ['自然推进', '更有边界', '更像本人'];
    return ['顺着说', '更自然', '更像本人'];
  }
  if (brief.task === 'edit') {
    return ['更自然', '更贴合要求', '更像本人'];
  }
  if (brief.styleList.includes('抽象有梗版')) {
    return ['更自然', '更有梗', '更像本人'];
  }
  if (brief.styleList.includes('高情商版')) {
    return ['更顺', '更有分寸', '更像本人'];
  }
  return ['自然日常', '更有画面', '更像本人'];
}

function getAssistTemperature(task) {
  if (task === 'space') return 1;
  if (task === 'edit') return 0.65;
  return 0.8;
}

function parseAssistItems(content) {
  const direct = tryParseAssistJson(content);
  if (direct.length) return direct;

  const matched = content.match(/\{[\s\S]*\}/);
  if (matched) return tryParseAssistJson(matched[0]);

  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\-\d.\s]+/, '').trim())
    .filter(Boolean)
    .map((text, index) => ({ angle: `候选${index + 1}`, text }));
}

function tryParseAssistJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.items)) return [];
    return parsed.items
      .map((item, index) => {
        if (typeof item === 'string') return { angle: `候选${index + 1}`, text: item };
        if (item && typeof item.text === 'string') {
          return { angle: String(item.angle || `候选${index + 1}`), text: item.text };
        }
        return null;
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function filterAssistItems(items, brief) {
  const result = [];

  for (const item of items || []) {
    const text = cleanAssistText(item.text);
    if (!text) continue;
    if (isWeakAssistText(text, brief)) continue;
    if (result.some((existing) => normalizeCompare(existing) === normalizeCompare(text))) continue;
    result.push(text);
    if (result.length === 3) break;
  }

  return result;
}

function cleanAssistText(text) {
  return String(text || '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^[1-9][\d]*[.)、]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakAssistText(text, brief) {
  if (!text || text.length < 4) return true;
  if (getAssistBannedPhrases(brief).some((phrase) => text.includes(phrase))) return true;

  if (brief.task === 'say') {
    if (/老师/.test(brief.target) && (/哈哈|救命|笑死|～|~|呀|😂|🥲/.test(text) || !/(老师|您)/.test(text))) {
      return true;
    }
    if (brief.toneList.includes('高冷') && text.length > 30) return true;
  }

  if (brief.task === 'edit' && /^我帮你|可以改成|建议改成/.test(text)) {
    return true;
  }

  if (brief.task === 'space' && /收到|我这边|发你|确认/.test(text)) {
    return true;
  }

  return false;
}

function getAssistBannedPhrases(brief) {
  const base = ['收到', '明白', '我先看看', '我先确认一下', '已知悉'];
  if (brief.task === 'space') {
    return [...base, '我这边', '稍后回复你', '第一时间告诉你'];
  }
  return base;
}

function buildAssistFallbacks(brief) {
  if (brief.task === 'say') {
    return buildSayFallbacks(brief);
  }
  if (brief.task === 'edit') {
    return buildEditFallbacks(brief);
  }
  return buildSpaceFallbacks(brief);
}

function buildSayFallbacks(brief) {
  const purpose = brief.purpose;
  const target = brief.target;
  const tones = brief.toneList.join('');
  const like = brief.likeMe;

  if (/催|作业|进度|DDL/i.test(purpose)) {
    if (target === '小组成员') {
      return like
        ? [
            '我准备开始整合啦，大家各自的部分大概什么时候能发我呀~',
            'DDL 有点近了，大家方便这周五前把各自的部分发我吗？我好先合进去。',
            '我们先把进度往前推一点点，大家这周五前把各自部分发我可以吗？'
          ]
        : [
            '我准备开始整合了，想确认一下大家各自的部分这周五前是否方便发我。',
            'DDL 有点近了，麻烦大家这周五前先发一版各自负责的内容，我这边好先合进去。',
            '我这边需要预留整合时间，所以想请大家尽量在这周五前把各自部分发我。'
          ];
    }
    return like
      ? [
          '我准备开始整合啦，你那部分大概什么时候能发我呀~',
          'DDL 有点近了，你方便今晚先发个初版吗？我这边先合进去。',
          '怕后面整合来不及，想跟你确认一下今晚能不能先给初版。'
        ]
      : [
          '我准备开始整合啦，你那部分大概什么时候能发我呀？',
          'DDL 有点近了，你方便今晚先发一个初版吗？我这边好先合进去。',
          '我这边需要预留整合时间，所以想确认一下你那部分今天能不能发我。'
        ];
  }

  if (/请假|延期|老师/.test(purpose) || target === '老师') {
    return [
      '老师您好，我想和您说明一下情况，今天因为临时原因可能无法按时到场，想请问是否可以请假？',
      '老师您好，打扰您了。我这边有一点特殊情况，想申请请假一次，后续内容我会及时补上。',
      '老师您好，请问这次任务是否可以稍微延期提交？我会尽快完成并补交给您。'
    ];
  }

  if (/拒绝|不想|不方便/.test(purpose)) {
    return [
      '谢谢你想到我，不过我这边最近确实不太方便，可能没法答应这次。',
      '我理解你的需求，但我这边时间不太允许，这次可能需要先拒绝一下。',
      '这次我先不参与了，避免后面临时掉链子影响你。'
    ];
  }

  if (/安慰|难过|朋友/.test(purpose)) {
    return [
      '我在的，你不用马上变好，先慢慢说，我听着。',
      '这件事确实挺难受的，不是你太敏感。先别一个人憋着。',
      '别一个人扛着，我在这里。'
    ];
  }

  if (/抽象|发疯/.test(tones)) {
    return [
      '这事儿确实有点抽象，但我懂你的意思。',
      '我懂了，这句话需要一点发疯但不能真的发疯。',
      '让我把精神状态折叠成一句能发出去的话。'
    ];
  }

  return [
    '我明白你的意思，我这边会尽快确认一下。',
    '好的，我先了解一下具体情况，再给你一个明确回复。',
    '我知道啦，我这边先看一下怎么安排比较合适。'
  ];
}

function buildEditFallbacks(brief) {
  const text = brief.text;
  const styleText = brief.styleList.join('');
  const risky = brief.risky;
  const like = brief.likeMe;

  if (/作业|交|进度|DDL/.test(text) || risky) {
    return like
      ? [
          '我准备开始整合啦，你那部分大概什么时候能发我呀~',
          'DDL 有点近了，你方便今晚先发个初版吗？',
          '救命，我们不能被 DDL 带走哈哈，你那部分今晚能先给我吗？'
        ]
      : [
          '我准备开始整合啦，你那部分大概什么时候能发我？',
          'DDL 有点近了，你方便今晚先发一个初版吗？我这边好先合进去。',
          '我这边需要预留整合时间，所以想确认一下你那部分今天能不能发我。'
        ];
  }

  if (/不去|不想|拒绝/.test(text) || /更委婉|更礼貌/.test(styleText)) {
    return [
      '谢谢你邀请我，不过我这次可能不太方便参加。',
      '我这边安排有点冲突，这次可能去不了啦。',
      '这次我先不参加了，你们玩得开心一点。'
    ];
  }

  return [
    `我帮你把这句话改得更自然一点：${text}`,
    `更委婉一点可以说：${text.replace(/！/g, '。')}`,
    '如果想更高情商一点，可以先说明原因，再表达自己的想法。'
  ];
}

function buildSpaceFallbacks(brief) {
  const draft = brief.draft || '复习好累';
  const styles = brief.styleList.join('');

  if (brief.likeMe) {
    return [
      '本人已进入 PPT 淹没模式，勿扰，除非你会划重点🥲',
      '复习进度：打开了。精神状态：关闭了。',
      '不是我不想学，是这门课先对我动手的。'
    ];
  }

  if (/复习|期末|好累|PPT|学习/.test(draft) || /抽象|有梗/.test(styles)) {
    return /高情商/.test(styles)
      ? [
          '在混乱里慢慢往前挪，也算是一种认真。',
          '今天也在努力靠近那个“不慌”的自己。',
          '复习很累，但每看完一点都算数。'
        ]
      : [
          '本人已进入 PPT 淹没模式，勿扰，除非你会划重点🥲',
          '复习进度：打开了。精神状态：关闭了。',
          '不是我不想学，是这门课先对我动手的。'
        ];
  }

  if (/生日|纪念日/.test(draft)) {
    return [
      '又认真生活了一年，继续保持可爱和清醒。',
      '今天值得被记住，也值得被好好庆祝。',
      '愿望不多，先祝自己一直有好运气。'
    ];
  }

  if (/旅游|美食|日常|照片/.test(draft)) {
    return [
      '把今天存档，快乐有图有真相。',
      '普通日子里的小确幸，已成功捕获。',
      '今天的快乐浓度刚刚好。'
    ];
  }

  return [
    '今天也算认真生活了一下。',
    '一些新鲜事，发出来证明我来过。',
    '把这一刻放进空间里，过几天再回来看看。'
  ];
}

function inferSayGoal(brief) {
  if (/催|作业|进度|DDL/.test(brief.purpose)) return '把事情往下推进，同时保留分寸感';
  if (/请假|延期|老师/.test(brief.purpose) || /老师/.test(brief.target)) return '得体说明情况，并给出明确沟通目标';
  if (/拒绝|不想|不方便/.test(brief.purpose)) return '委婉拒绝，但要把边界说清楚';
  if (/安慰|难过|朋友/.test(brief.purpose)) return '先接住情绪，再给陪伴感';
  return '根据对象和目的，生成能直接发出去的话';
}

function inferSpaceGoal(brief) {
  if (/抽象有梗/.test(brief.styleList.join(''))) return '生成更有网感、更适合社交平台的说说文案';
  if (/高情商/.test(brief.styleList.join(''))) return '让说说更有分寸感和完成度';
  return '让草稿更像能直接发出去的一条说说';
}

function getPersonaLabel(key) {
  return {
    warm: '温和边界鹅',
    eq: '高情商鹅',
    meme: '抽象有梗鹅',
    cool: '清冷极简鹅',
    loose: '松弛摆烂鹅'
  }[key] || '温和边界鹅';
}

function getPersonaDesc(key) {
  return {
    warm: '礼貌、有边界，适合稳妥表达',
    eq: '清晰、得体、适合学业与正式沟通',
    meme: '幽默、随性、适合轻松场景和 QQ 空间',
    cool: '短句、克制、减少情绪噪音',
    loose: '轻松、不紧绷，适合熟人聊天'
  }[key] || '礼貌、有边界，适合稳妥表达';
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .map((item) => ({
      role: item && item.role === 'me' ? 'me' : 'other',
      text: String(item && item.text ? item.text : '').trim()
    }))
    .filter((item) => item.text)
    .slice(-8);
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  if (!text) return [];
  return text.split(/[、,\s]+/).map((item) => item.trim()).filter(Boolean);
}

function tryParseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function normalizeCompare(text) {
  return String(text).replace(/[，。！？!?,~～\s]/g, '').trim();
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  generateAssist
};
