const PERSONA_PRESETS = {
  warm: {
    label: '温和边界鹅',
    summary: '礼貌、自然、会补一句上下文，但不卑微。',
    directives: [
      '先接住对方，再给安排或边界',
      '像大学生在 QQ 里聊天，不像客服',
      '适合群聊协作、稳妥推进、普通私聊'
    ],
    habitWords: ['那', '我这边', '方便的话', '先'],
    bannedPhrases: ['收到', '明白', '我先确认一下', '我先看看']
  },
  eq: {
    label: '高情商鹅',
    summary: '清晰、得体、偏正式，适合老师和比赛沟通。',
    directives: [
      '表达清楚，不拖泥带水',
      '礼貌但不空泛，要把后续安排说出来',
      '适合老师、导师、提交说明、正式场合'
    ],
    habitWords: ['好的', '老师您好', '我这边', '第一时间'],
    bannedPhrases: ['收到', '明白', '已知悉']
  },
  meme: {
    label: '抽象有梗鹅',
    summary: '有网感、有一点梗，但不能发疯到看不懂。',
    directives: [
      '轻微幽默，允许一点画面感',
      '梗要服务于回复目的，不能只剩吐槽',
      '适合熟人、朋友、小组群里的轻松推进'
    ],
    habitWords: ['哈哈', '救命', '别慌', '先拖回来'],
    bannedPhrases: ['收到', '已知悉', '请您放心']
  },
  cool: {
    label: '清冷极简鹅',
    summary: '短句、克制、少废话，但仍要把事说清楚。',
    directives: [
      '优先短句',
      '少解释，少情绪词',
      '适合高冷、边界感强的表达'
    ],
    habitWords: ['行', '可以', '晚点', '先这样'],
    bannedPhrases: ['收到', '哈哈', '辛苦了哈']
  },
  loose: {
    label: '松弛摆烂鹅',
    summary: '熟人口语、松弛自然，不端着。',
    directives: [
      '像熟人真实聊天，不要太认真',
      '可以轻一点、懒一点，但别敷衍',
      '适合朋友、同学、轻松场景'
    ],
    habitWords: ['行', '我晚点', '先这样', '给我丢过来'],
    bannedPhrases: ['收到', '已安排', '请您放心']
  }
};

const TONE_PRESETS = {
  友好: {
    summary: '语气柔和，别呛人。',
    directives: ['可以留一点缓冲词，让人更好接。']
  },
  幽默: {
    summary: '轻松一点，可以带轻微梗。',
    directives: ['幽默必须轻，不油腻，不要尬笑。']
  },
  感谢: {
    summary: '要自然表达感谢。',
    directives: ['把谢意说出来，但别太重。']
  },
  拒绝: {
    summary: '明确拒绝，但留体面。',
    directives: ['不能模糊拖延，要让对方听懂这次不行。']
  },
  高冷: {
    summary: '更短、更克制。',
    directives: ['减少解释，控制字数。']
  },
  抽象: {
    summary: '允许轻微抽象和画面感。',
    directives: ['要有网感，但不能看不懂。']
  }
};

function buildReplyBrief({
  original,
  need = '',
  tone = [],
  conversation = [],
  threadTitle = '',
  sourceName = '',
  personaKey = 'warm',
  personaLabel = '',
  personaDesc = '',
  readSummary = ''
}) {
  const toneList = Array.isArray(tone)
    ? tone.map((item) => String(item).trim()).filter(Boolean)
    : String(tone || '').split(/[、,\s]+/).map((item) => item.trim()).filter(Boolean);
  const combined = [threadTitle, sourceName, original, need, toneList.join(' ')].filter(Boolean).join(' ');
  const persona = PERSONA_PRESETS[personaKey] || PERSONA_PRESETS.warm;
  const scene = inferScene({ combined, original, need, threadTitle, sourceName, toneList });
  const relationship = inferRelationship({ threadTitle, sourceName, combined });
  const contextDigest = buildContextDigest(conversation);
  const readStyleText = readSummary || inferReadSummary(personaKey, relationship, threadTitle);
  const bannedPhrases = uniqueStrings([
    '收到',
    '明白',
    '我先看看',
    '我先确认一下',
    '我处理完跟你说',
    '已知悉',
    '好的收到',
    ...persona.bannedPhrases
  ]);

  return {
    original,
    need,
    toneList,
    threadTitle,
    sourceName,
    personaKey,
    personaLabel: personaLabel || persona.label,
    personaDesc: personaDesc || persona.summary,
    persona,
    scene,
    relationship,
    conversation,
    contextDigest,
    readStyleText,
    bannedPhrases,
    lengthHint: getLengthHint(scene.key, toneList, personaKey),
    mustMention: getMustMention(scene.key, original, need),
    toneGuides: toneList.map((item) => TONE_PRESETS[item]).filter(Boolean),
    outputAngles: getOutputAngles(scene.key, personaKey)
  };
}

function inferScene({ combined, original, need, threadTitle, sourceName, toneList }) {
  if (/老师|导师|辅导员|李老师|报名表|提交|材料|论文|作业说明|发您|您/.test(combined)) {
    return {
      key: 'teacher_formal',
      label: '老师或正式沟通',
      goal: '得体回应并把后续安排说明白',
      summary: '这是偏正式的沟通场景，需要像学生对老师说话。'
    };
  }

  if (/付款码|转账|收款|金额|报销|A一下|aa/.test(combined)) {
    return {
      key: 'money_transfer',
      label: '金额确认或转账',
      goal: '简短确认金额和后续动作',
      summary: '这是金额或转账场景，回复应该短平快。'
    };
  }

  if (/能把.+发我吗|今晚能.+吗|方便.+发我|可以发我吗|能发我吗|要不要我.+发你|你能.+吗/.test(original)) {
    return {
      key: 'direct_answer',
      label: '直接答复',
      goal: '正面回答对方的问题，不绕',
      summary: '这是对方在直接向你发请求或确认安排，应该直接答复。'
    };
  }

  if (/难过|崩溃|哭|emo|委屈|烦死|受不了|撑不住/.test(combined)) {
    return {
      key: 'comfort',
      label: '安慰接情绪',
      goal: '先接住情绪，再给陪伴感',
      summary: '这是情绪场景，不要讲大道理，要先接住人。'
    };
  }

  if (/拒绝|不方便|不想|先不了|没空|算了/.test(combined) || (toneList.includes('拒绝') && !/谢谢/.test(combined))) {
    return {
      key: 'decline',
      label: '委婉拒绝',
      goal: '把拒绝说清楚，但留住体面',
      summary: '这是要拒绝的场景，不能暧昧拖着。'
    };
  }

  if (
    /DDL|进度|初版|作业|版本|PPT|材料|结论|整合|几点能发|今晚能发|今晚方便|还差一点|还没做完|收尾|先发一版/.test(combined) ||
    (/群/.test(threadTitle) && /催|推进|发我|版本/.test(need))
  ) {
    return {
      key: 'push_progress',
      label: '推进进度',
      goal: '既接住对方，又把时间、版本或安排推进清楚',
      summary: '这是协作推进场景，回复不能只礼貌，要把事情往下推。'
    };
  }

  if (/可以吗|能不能|方便吗|行吗|要不要|去不去|在吗|这周能|今晚能/.test(original)) {
    return {
      key: 'direct_answer',
      label: '直接答复',
      goal: '正面回答对方的问题，不绕',
      summary: '这是对方在问你问题，应该直接给答复。'
    };
  }

  if (/谢谢|辛苦了|麻烦你了/.test(original)) {
    return {
      key: 'thanks_response',
      label: '回应感谢',
      goal: '自然接住对方的谢意',
      summary: '这是对方在表达感谢，回复要轻松自然。'
    };
  }

  return {
    key: 'natural_followup',
    label: '自然接话',
    goal: '像真实聊天一样接住对方并往下说',
    summary: '这是普通聊天回复场景，要自然，不要客服腔。'
  };
}

function inferRelationship({ threadTitle, sourceName, combined }) {
  if (/老师|导师|辅导员/.test(`${threadTitle} ${sourceName} ${combined}`)) {
    return '老师';
  }
  if (/群|小组|官方|大赛|组员|队友/.test(threadTitle)) {
    return '同学或组员';
  }
  if (/朋友|闺蜜|兄弟|crush|暧昧/.test(combined)) {
    return '熟人或朋友';
  }
  return '聊天对象';
}

function buildContextDigest(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) {
    return '无明确上下文，只能根据当前消息和设定生成。';
  }

  const recent = conversation.slice(-6).map((item) => `${item.role === 'me' ? '我' : '对方'}：${item.text}`);
  return recent.join('\n');
}

function inferReadSummary(personaKey, relationship, threadTitle) {
  const persona = PERSONA_PRESETS[personaKey] || PERSONA_PRESETS.warm;
  return `当前聊天是「${threadTitle || relationship}」，优先按「${persona.label}」执行：${persona.summary}`;
}

function getLengthHint(sceneKey, toneList, personaKey) {
  if (sceneKey === 'teacher_formal') return '18-42字';
  if (toneList.includes('高冷') || personaKey === 'cool') return '8-22字';
  if (sceneKey === 'comfort') return '14-32字';
  return '12-34字';
}

function getMustMention(sceneKey, original, need) {
  const combined = `${original} ${need}`;

  if (sceneKey === 'push_progress') {
    return ['发', /(今晚|晚点)/.test(combined) ? '今晚' : '', /(初版|版本|一版)/.test(combined) ? '初版/版本' : ''].filter(Boolean);
  }

  if (sceneKey === 'teacher_formal') {
    return ['老师/您', '后续安排'];
  }

  if (sceneKey === 'money_transfer') {
    return ['金额/转', '后续动作'];
  }

  if (sceneKey === 'decline') {
    return ['明确不方便或做不到'];
  }

  if (sceneKey === 'thanks_response') {
    return ['自然接住谢意'];
  }

  return [];
}

function getOutputAngles(sceneKey, personaKey) {
  if (sceneKey === 'teacher_formal') {
    return ['稳妥回应', '说明安排', '更像本人'];
  }
  if (sceneKey === 'decline') {
    return ['柔和一点', '边界更清楚', '更像本人'];
  }
  if (sceneKey === 'push_progress') {
    return ['先接住对方', '把事情往下推进', '更像本人'];
  }
  if (personaKey === 'meme') {
    return ['正常接住', '轻微带梗', '更像本人'];
  }
  return ['顺着接住', '给出安排', '更像本人'];
}

function buildFallbackReplies(brief) {
  const sceneTemplates = getSceneTemplates(brief);
  const personaTemplates = sceneTemplates[brief.personaKey] || sceneTemplates.default || [];
  const replies = finalizeReplies(personaTemplates, brief);
  return replies.length ? replies : [
    '行，那你方便的时候把现在这版先发我，我这边接着往下弄。',
    '可以，我先接住这边，晚点你把版本丢我就行。',
    '好，那我们先把下一步定下来，你那边弄好就发我。'
  ];
}

function getSceneTemplates(brief) {
  const original = brief.original;
  const threadTitle = brief.threadTitle;

  if (brief.scene.key === 'push_progress') {
    return {
      default: [
        '好，那你今晚方便的话先发我个初版，我这边先往下合。',
        '可以，你先继续收尾，晚点把当前版本丢我，我先接着整。',
        '没事，你先弄，今晚尽量给我一版，我这边好继续往下推。'
      ],
      warm: [
        '好，那你今晚方便的话先发我个初版，我这边先往下合。',
        '可以，你先继续弄，晚点把现在这版给我，我先接着整。',
        '没事，你先收尾，方便的话今晚先发我一版，我这边好继续往下推。'
      ],
      eq: [
        '好的，那你今晚方便的话先发我一个初版，我这边先继续整合。',
        '可以，你先完成手头这部分，晚点把当前版本发我，我这边接着往下走。',
        '没问题，辛苦你先收尾，今晚给我一版就行，我这边好同步推进。'
      ],
      meme: [
        '行，那我们先把这个版本从危险区拖回来，今晚先给我一版就行。',
        '可以可以，你先收尾，晚点把现有版本丢我，我先接着救。',
        '别慌，你先弄，今晚先发我个初版，我们先把 DDL 顶住。'
      ],
      cool: [
        '行，今晚先发我一版。',
        '你先收尾，晚点把版本给我。',
        '先给我当前这版，我接着往下做。'
      ],
      loose: [
        '行，你先弄，晚点把现在这版给我，我先接着往下顺。',
        '可以，今晚先丢我个初版就行，我这边先合着。',
        '你先收尾，弄得差不多了直接发我，我继续往下接。'
      ]
    };
  }

  if (brief.scene.key === 'teacher_formal') {
    return {
      default: [
        '好的老师，我今晚整理好后第一时间发您。',
        '老师您好，我这边再核对一下内容，整理好后尽快发您。',
        '好的老师，我先把这一版补齐，完成后马上发您。'
      ],
      warm: [
        '好的老师，我今晚整理好后第一时间发您。',
        '老师您好，我这边再核对一下内容，整理好后尽快发您。',
        '好的老师，我先把这一版补齐，完成后马上发您。'
      ],
      eq: [
        '好的老师，我今晚会先补齐这一版，整理好后第一时间发您。',
        '老师您好，我这边再核对一下细节，确认无误后尽快发您。',
        '明白老师，我先完善这部分内容，整理完成后马上发您。'
      ],
      cool: [
        '好的老师，我整理好就发您。',
        '老师您好，我核对完后发您。',
        '好，我补齐后马上发您。'
      ]
    };
  }

  if (brief.scene.key === 'money_transfer') {
    return {
      default: [
        '可以，你把金额发我一下，我一起核一下，等会儿转你。',
        '行，你把数发我，我确认完就转。',
        '没问题，把金额丢我一下，我这边马上处理。'
      ],
      meme: [
        '行，把金额甩我一下，我别一会儿转错哈哈。',
        '可以，你先把数丢我，我核一下就转。',
        '没问题，金额给我，我这边火速处理。'
      ],
      cool: [
        '行，金额发我。',
        '把数给我，我马上转。',
        '可以，金额发来。'
      ]
    };
  }

  if (brief.scene.key === 'decline') {
    return {
      default: [
        '这次我可能确实不太方便，怕答应了反而耽误你，所以先跟你说一声。',
        '我这边这次可能接不了，就不先占着你的安排了。',
        '这次我先不了，主要是我这边确实顾不过来，提前跟你说清楚。'
      ],
      eq: [
        '这次我可能确实不太方便参与，怕影响你的安排，所以先和你说明一下。',
        '不好意思，这件事我这边这次可能接不了，就先不耽误你了。',
        '这次我先不过去了，主要是时间上确实安排不开，提前和你说一声。'
      ],
      cool: [
        '这次我不太方便，就先不了。',
        '我这边接不了，你先别等我。',
        '这次不行，我先提前说。'
      ],
      loose: [
        '这次我可能真接不了，怕后面卡你，所以先跟你说清楚。',
        '我这边这次先不了，不然答应了也容易掉链子。',
        '这次我就不跟了，主要是我这边真顾不过来。'
      ]
    };
  }

  if (brief.scene.key === 'comfort') {
    return {
      default: [
        '我在呢，你先别一个人扛着，想说就慢慢说。',
        '这事换谁都会难受，你现在这样很正常，我陪你缓一会儿。',
        '先别急着逼自己马上好起来，我先陪你把这口气顺过去。'
      ],
      meme: [
        '我在我在，先别一个人硬扛，来，我陪你缓一会儿。',
        '这事确实挺伤的，先别急着装没事，我听你说。',
        '先把情绪放这里，我帮你一起扛一会儿。'
      ],
      cool: [
        '我在，你先说。',
        '先别一个人扛着，我听着。',
        '难受很正常，我陪你缓一下。'
      ]
    };
  }

  if (brief.scene.key === 'direct_answer') {
    return {
      default: [
        '可以，我今晚整理完先发你一版。',
        '行，我这边弄好就给你，可能会稍微晚一点。',
        '没问题，我这边处理完就发你。'
      ],
      meme: [
        '可以，今晚先给你一版，别让它继续悬着了。',
        '行，我弄完就发你，今晚把这事了了。',
        '没问题，我这边收尾完就给你。'
      ],
      cool: [
        '可以，我晚点发你。',
        '行，弄好给你。',
        '没问题，我处理完发你。'
      ]
    };
  }

  if (brief.scene.key === 'thanks_response') {
    return {
      default: [
        '没事没事，这点小事，不用这么客气。',
        '没关系，顺手的事，你先忙你的。',
        '不用谢，能帮上就行。'
      ],
      eq: [
        '没关系，这都是我应该做的，你先忙你的就好。',
        '不用这么客气，能帮上忙就行。',
        '没事，这边处理好就好。'
      ],
      cool: [
        '没事，不用谢。',
        '行，小事。',
        '没关系。'
      ]
    };
  }

  return {
    default: [
      `好，我大概懂你意思了，那我这边就按这个方向回。`,
      `可以，这样回会更顺一点，我给你接住它。`,
      `行，我帮你把这句回得更自然一点。`
    ],
    warm: [
      '好，我大概懂你意思了，那我这边就顺着接一下。',
      '可以，这样回会更自然一点，我帮你把语气放稳。',
      '行，我按这个方向给你回，会更像正常聊天一点。'
    ],
    eq: [
      '好的，我明白你的诉求了，我这边会把表达整理得更清楚一些。',
      '可以，我会按这个方向回应，让语气更得体一点。',
      '行，我帮你把这句回得更清晰、更顺。'
    ],
    meme: [
      '行，我懂你这个意思了，我给你回得像人一点。',
      '可以，我帮你把这句从客服区拉回聊天区。',
      '懂了，我给你整一个既自然又不尴尬的版本。'
    ],
    cool: [
      '行，我按这个回。',
      '可以，这样更顺。',
      '懂了，我给你压一下语气。'
    ],
    loose: [
      '行，我懂你意思了，我给你回得自然点。',
      '可以，我帮你把这句顺一下，会像正常聊天一点。',
      '懂了，我给你整成能直接发的。'
    ]
  };
}

function finalizeReplies(replies, brief) {
  const result = [];

  for (const reply of replies || []) {
    const text = cleanReplyText(reply);
    if (!text) continue;
    if (isWeakReply(text, brief)) continue;
    if (isDuplicate(text, result)) continue;
    result.push(text);
    if (result.length === 3) break;
  }

  return result;
}

function cleanReplyText(reply) {
  const text = extractReplyText(reply)
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^[1-9][\d]*[.)、]\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([。！？!?~～])\1+/g, '$1')
    .trim();

  return text;
}

function extractReplyText(reply) {
  if (typeof reply === 'string') return reply;
  if (reply && typeof reply.text === 'string') return reply.text;
  if (reply && typeof reply.reply === 'string') return reply.reply;
  return '';
}

function isWeakReply(text, brief) {
  if (!text) return true;
  if (text.length < 6) return true;
  if (brief.bannedPhrases.some((phrase) => text.includes(phrase))) return true;

  if (brief.scene.key === 'push_progress' && !/(发|版本|初版|晚点|今晚|给我|丢我|一版)/.test(text)) {
    return true;
  }

  if (
    brief.scene.key === 'teacher_formal' &&
    (
      /哈哈|救命|笑死|🥲|😂|呀|就成|～|~/.test(text) ||
      !/(老师|您)/.test(text)
    )
  ) {
    return true;
  }

  if (brief.scene.key === 'money_transfer' && !/(金额|转|核|数)/.test(text)) {
    return true;
  }

  if (brief.scene.key === 'decline' && !/(不太方便|先不了|接不了|顾不过来|不行|不过去|做不了)/.test(text)) {
    return true;
  }

  if (brief.scene.key === 'direct_answer' && !/(可以|行|没问题|能|发|给你|晚点)/.test(text)) {
    return true;
  }

  if (brief.personaKey === 'cool' && text.length > 28) {
    return true;
  }

  if ((brief.personaKey === 'warm' || brief.personaKey === 'eq') && /[😂🥲🤣😅呀～~]|嗯嗯/.test(text)) {
    return true;
  }

  if (brief.toneList.includes('感谢') && !/(谢|辛苦|麻烦)/.test(text)) {
    return true;
  }

  return false;
}

function isDuplicate(text, existing) {
  const normalized = normalizeForCompare(text);
  return existing.some((item) => normalizeForCompare(item) === normalized);
}

function normalizeForCompare(text) {
  return String(text)
    .replace(/[，。！？!?,~～\s]/g, '')
    .replace(/哈哈+/g, '哈')
    .replace(/老师您好/g, '老师')
    .trim();
}

function uniqueStrings(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

module.exports = {
  PERSONA_PRESETS,
  TONE_PRESETS,
  buildReplyBrief,
  buildFallbackReplies,
  finalizeReplies
};
