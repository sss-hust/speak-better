function buildSeedReplies(original, tone, need = '') {
  const combined = `${original} ${need}`;

  if (/催|进度|作业|初版|DDL/i.test(combined)) {
    return tone.includes('幽默') || tone.includes('抽象')
      ? [
          '可以可以，但 DDL 已经在门口探头了🥲 你今晚先发初版就行。',
          '行，先救一个初版也算功德无量，你大概几点能发我？',
          '没问题，我们先把它从危险区拖回来，你今晚先给我一版。'
        ]
      : [
          '可以的，那你今晚方便先发一个初版吗？我这边先合进去。',
          '没问题，你大概几点能发我？我好安排整合时间。',
          '可以，但我们时间有点紧，麻烦你尽量今晚发我一下。'
        ];
  }

  if (/幽默|有梗/.test(need)) {
    return [
      '收到，我先确认一下，争取不让事情变成连续剧。',
      '可以，我这边先看一下情况，有结果立刻汇报。',
      '明白，我去处理一下，尽量让它优雅落地。'
    ];
  }

  if (/请假|报名表|老师|问题/.test(original)) {
    return [
      '老师收到，我会尽快整理好发给您。',
      '老师您好，我这边确认一下信息，整理好后及时发您。',
      '好的老师，如果有不清楚的地方我会及时和您沟通。'
    ];
  }

  if (/付款码|钱|转账|收款/.test(original)) {
    return [
      '收到，我确认一下金额后转你。',
      '好滴，我等下转过去，转完跟你说。',
      '可以，你把金额也发我一下，我一起核对。'
    ];
  }

  if (/晚点|可以吗|还差/.test(original)) {
    return tone.includes('幽默') || tone.includes('抽象')
      ? [
          '可以，但 DDL 已经在门口敲门了🥲 你今晚先发初版就行。',
          '行，先救一个初版也算功德无量。',
          '可以可以，我们先把 PPT 从危险区拖回来。'
        ]
      : [
          '可以的，那你今晚方便先发一个初版吗？我这边先合进去。',
          '没问题，你大概几点能发我？我好安排整合时间。',
          '可以，但我们时间有点紧，麻烦你尽量今晚发我一下。'
        ];
  }

  if (tone.includes('拒绝')) {
    return [
      '谢谢你想到我，不过这次我可能不太方便。',
      '我理解你的意思，但这件事我这边暂时做不了。',
      '这次我可能没法答应，怕耽误你所以先说清楚。'
    ];
  }

  return [
    '收到，我看一下再回复你。',
    '可以的，我这边先确认一下。',
    '明白，我等下处理完跟你说。'
  ];
}

function buildIntentHint(original, need, toneText) {
  const combined = `${original} ${need} ${toneText}`;

  if (/拒绝|不方便|先不了|不想/.test(combined)) {
    return '核心意图是委婉拒绝，既要表达边界，也尽量保持礼貌。';
  }

  if (/谢谢|感谢/.test(combined)) {
    return '核心意图是礼貌回应并表达感谢。';
  }

  if (
    (/还差一点|还没|还在做|快了|收尾|马上好/.test(original) && /初版|今晚|发我|进度|催/.test(need)) ||
    (/初版|DDL|作业|进度/.test(combined) && /催|今晚|发我/.test(combined))
  ) {
    return '理解对方还没做完，但要礼貌地提醒对方今晚先发一个初版或当前版本给我，方便我继续整合。';
  }

  if (/能把.+发我吗|今晚能.+吗|方便.+发我|可以发我吗|能发我吗/.test(original)) {
    return '核心意图是正面答复对方的请求，直接说明可以，并补充大概时间或安排。';
  }

  if (/请假|老师|报名表|提交|材料/.test(original)) {
    return '核心意图是礼貌确认并给出后续处理安排，语气稍正式。';
  }

  if (/付款码|转账|收款|金额/.test(original)) {
    return '核心意图是确认转账或金额，回复要简短直接。';
  }

  return '直接回应对方这条消息，给出清晰、自然、可直接发送的回复。';
}

function shouldUseSeedReplies(original, need, replies) {
  const combined = `${original} ${need}`;
  const merged = replies.join(' ');
  const genericPatterns = [
    /收到，我先看/i,
    /我这边先确认一下/i,
    /处理完.*(跟你说|告诉你)/i,
    /等下回你/i,
    /先看看/i
  ];

  const genericCount = replies.filter((text) => genericPatterns.some((pattern) => pattern.test(text))).length;
  if (
    genericCount >= 2 &&
    /初版|DDL|进度|发我|今晚|老师|付款码|转账|拒绝|不方便|感谢/.test(combined)
  ) {
    return true;
  }

  if (/初版|DDL|进度|发我|今晚/.test(combined) && !/(初版|今晚|发|几点|整合)/.test(merged)) {
    return true;
  }

  if (/能把.+发我吗|今晚能.+吗|方便.+发我|可以发我吗|能发我吗/.test(original) && !/(可以|行|没问题|今晚|发)/.test(merged)) {
    return true;
  }

  if (/老师/.test(original) && !/老师/.test(merged)) {
    return true;
  }

  if (/付款码|转账|收款|金额/.test(original) && !/(转|金额|核对)/.test(merged)) {
    return true;
  }

  if (/拒绝|不方便/.test(combined) && !/(不太方便|做不了|没法|先不了)/.test(merged)) {
    return true;
  }

  return false;
}

module.exports = {
  buildSeedReplies,
  buildIntentHint,
  shouldUseSeedReplies
};
