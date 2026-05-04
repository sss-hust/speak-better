const config = require('./config');
const {
  buildSeedReplies,
  buildIntentHint,
  shouldUseSeedReplies
} = require('./reply-seeds');

async function fetchReplySuggestions({ original, need, tone, conversation }) {
  const toneText = Array.isArray(tone) ? tone.join('、') : String(tone || '');
  const seedReplies = buildSeedReplies(original, toneText, need);
  const messages = buildReplyMessages({
    original,
    need,
    toneText,
    conversation,
    seedReplies
  });

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
      temperature: 0.3,
      max_tokens: 320,
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

  const replies = parseReplies(content);
  if (replies.length < 3) {
    return seedReplies;
  }

  if (shouldUseSeedReplies(original, need, replies)) {
    return seedReplies;
  }

  return replies.slice(0, 3);
}

function buildReplyMessages({ original, need, toneText, conversation, seedReplies }) {
  const needText = need || '没有额外要求';
  const contextText = Array.isArray(conversation) && conversation.length
    ? conversation.map((item) => `${item.role === 'me' ? '我' : '对方'}：${item.text}`).join('\n')
    : '无';
  const intentHint = buildIntentHint(original, needText, toneText);
  const seedText = seedReplies.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    {
      role: 'system',
      content: [
        '你是一个中文聊天回复润色助手。',
        '你会收到 3 条已经方向正确的候选回复，你的任务是在不改变说话人立场和核心意思的前提下，把它们润色得更自然、更像真人聊天。',
        '这些候选回复都是“我”发给“对方”的话，你绝不能反转人物关系，绝不能替对方说话。',
        '不要把候选回复改成旁白、吐槽、分析或追问，除非原候选本身就是那个意思。',
        '请严格返回 JSON 对象，格式为 {"replies":["...","...","..."]}。',
        '只返回 3 条回复建议，不要附加解释、标题、序号、markdown。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        '请基于下面 3 条候选回复做润色。',
        `对方发来的消息：${original}`,
        `我的要求：${needText}`,
        `语气：${toneText || '友好自然'}`,
        `意图提示：${intentHint}`,
        `参考前文：${contextText}`,
        '候选回复：',
        seedText,
        '补充要求：',
        '1. 只输出润色后的 3 条回复，不要分析，不要解释。',
        '2. 保持每条回复的基本意思和人物关系，不要把“我”改成“对方”。',
        '3. 如果候选已经自然，可以只做轻微润色，但仍然输出 3 条。',
        '4. 每条都要适合 QQ/微信直接发送。',
        '5. 默认使用简体中文。'
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
    .slice(0, 3);
}

function tryParseReplyJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.replies)) {
      return [];
    }

    return parsed.replies
      .map((item) => String(item).trim())
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
