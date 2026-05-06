const config = require('./config');
const {
  buildReplyBrief,
  buildFallbackReplies,
  finalizeReplies
} = require('./reply-seeds');

async function fetchReplySuggestions(input) {
  const brief = buildReplyBrief(input);
  const fallbackReplies = buildFallbackReplies(brief);

  if (!config.apiKey) {
    return {
      replies: fallbackReplies,
      source: 'fallback'
    };
  }

  try {
    const messages = buildReplyMessages(brief);
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
        temperature: 0.85,
        max_tokens: 640,
        messages
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

    const parsedReplies = parseReplies(content);
    const replies = finalizeReplies(parsedReplies, brief);
    if (replies.length < 3) {
      return {
        replies: fallbackReplies,
        source: 'fallback'
      };
    }

    return {
      replies,
      source: 'model'
    };
  } catch (error) {
    console.error('deepseek reply generation failed, fallback applied:', error.message || error);
    return {
      replies: fallbackReplies,
      source: 'fallback'
    };
  }
}

function buildReplyMessages(brief) {
  const personaDirectives = brief.persona.directives.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const toneDirectives = brief.toneGuides.length
    ? brief.toneGuides.map((item, index) => `${index + 1}. ${item.summary} ${item.directives.join(' ')}`.trim()).join('\n')
    : '1. 没有额外 tone chips，按人格主风格执行。';
  const bannedText = brief.bannedPhrases.join('、');
  const mustMentionText = brief.mustMention.length ? brief.mustMention.join('、') : '无硬性关键词，但要贴合消息。';
  const anglesText = brief.outputAngles.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    {
      role: 'system',
      content: [
        '你是「会说 AI」演示版的核心回复引擎。',
        '你的任务是生成可以直接发送的中文聊天回复，让人一眼看出你真的理解了语境，而且有明确人设风格。',
        '优先级：预设人格风格 > 当前场景目标 > tone chips > 字面礼貌。',
        '绝对不能写成客服、秘书、公文，不能只会说套话。',
        '你输出的是“我”要发给对方的话，不能替对方说话，不能改写成旁白解释。',
        '请严格返回 JSON 对象，格式为 {"replies":[{"angle":"...","text":"..."},{"angle":"...","text":"..."},{"angle":"...","text":"..."}]}。',
        '不要输出 markdown，不要解释，不要道歉。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        '你现在要帮我回复一条消息。',
        `聊天标题：${brief.threadTitle || '未命名聊天'}`,
        `对方身份：${brief.relationship}${brief.sourceName ? `（对方名称：${brief.sourceName}）` : ''}`,
        `当前场景：${brief.scene.label}`,
        `场景目标：${brief.scene.goal}`,
        `场景说明：${brief.scene.summary}`,
        `预设人格：${brief.personaLabel}`,
        `人格描述：${brief.personaDesc}`,
        '人格执行规则：',
        personaDirectives,
        `人格常见口吻参考：${brief.persona.habitWords.join('、')}`,
        'tone chips 叠加要求：',
        toneDirectives,
        `最近风格画像：${brief.readStyleText}`,
        '最近聊天上下文：',
        brief.contextDigest,
        `对方刚发来的消息：${brief.original}`,
        `我额外补充的回复要求：${brief.need || '无'}`,
        `本轮是第 ${brief.rerollIndex + 1} 次生成，如与之前相似请主动换表达方式。`,
        `必须避免的弱表达：${bannedText}`,
        `本次最好体现的关键词或动作：${mustMentionText}`,
        `单条建议长度：${brief.lengthHint}`,
        '请按下面 3 个角度各生成 1 条：',
        anglesText,
        '补充约束：',
        '1. 三条都要能直接发出去，且开头不要一样。',
        '2. 要像真人聊天，不能像在汇报工作。',
        '3. 如果是推进事项，就要把事情推进到位，不要只会礼貌接住。',
        '4. 如果是老师场景，要得体、清晰，但也别太假。',
        '5. 如果是幽默/抽象风格，梗只能轻轻带一下，不能盖过本意。'
      ].join('\n')
    }
  ];
}

function parseReplies(content) {
  const direct = tryParseReplyJson(content);
  if (direct.length) {
    return direct;
  }

  const matched = content.match(/\{[\s\S]*\}/);
  if (matched) {
    return tryParseReplyJson(matched[0]);
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\-\d.\s]+/, '').trim())
    .filter(Boolean)
    .map((line, index) => ({ angle: `候选${index + 1}`, text: line }));
}

function tryParseReplyJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.replies)) {
      return [];
    }

    return parsed.replies
      .map((item, index) => {
        if (typeof item === 'string') {
          return { angle: `候选${index + 1}`, text: item };
        }
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

function tryParseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  fetchReplySuggestions,
  createError
};
