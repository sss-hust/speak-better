const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const config = require('./config');
const { fetchReplySuggestions, createError } = require('./deepseek');

function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      writeApiHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        configured: Boolean(config.apiKey),
        model: config.model
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/reply-suggestions') {
      return handleReplySuggestions(req, res);
    }

    if (req.method === 'GET') {
      return servePublicFile(url.pathname, res);
    }

    sendText(res, 404, 'Not Found');
  });

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`会说 AI 本地服务已启动: http://127.0.0.1:${config.port}`);
    console.log(`DeepSeek 模型: ${config.model}`);
    if (!config.apiKey) {
      console.warn('未检测到 DEEPSEEK_API_KEY，回复建议接口暂时不可用。');
    }
  });

  return server;
}

async function handleReplySuggestions(req, res) {
  try {
    const body = await readJsonBody(req);
    const original = String(body.original || '').trim();
    const need = String(body.need || '').trim();
    const tone = normalizeTone(body.tone);
    const conversation = normalizeConversation(body.conversation);
    const threadTitle = String(body.threadTitle || '').trim();
    const sourceName = String(body.sourceName || '').trim();
    const personaKey = String(body.personaKey || '').trim() || 'warm';
    const personaLabel = String(body.personaLabel || '').trim();
    const personaDesc = String(body.personaDesc || '').trim();
    const readSummary = String(body.readSummary || '').trim();

    if (!original) {
      sendJson(res, 400, { error: '缺少原消息内容。' });
      return;
    }

    const result = await fetchReplySuggestions({
      original,
      need,
      tone,
      conversation,
      threadTitle,
      sourceName,
      personaKey,
      personaLabel,
      personaDesc,
      readSummary
    });
    sendJson(res, 200, result);
  } catch (error) {
    console.error('reply-suggestions error:', error);
    sendJson(res, error.statusCode || 500, {
      error: error.message || '生成回复建议失败。'
    });
  }
}

function servePublicFile(requestPath, res) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const targetPath = path.normalize(path.join(config.publicDir, normalizedPath));

  if (!targetPath.startsWith(config.publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(targetPath, (error, buffer) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendText(res, 404, 'Not Found');
        return;
      }
      sendText(res, 500, '读取静态文件失败');
      return;
    }

    res.writeHead(200, { 'Content-Type': getMimeType(targetPath) });
    res.end(buffer);
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

function writeApiHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  writeApiHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(createError(413, '请求体过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(createError(400, '请求体不是合法 JSON。'));
      }
    });

    req.on('error', () => {
      reject(createError(400, '读取请求体失败。'));
    });
  });
}

function normalizeTone(tone) {
  if (Array.isArray(tone)) {
    return tone.map((item) => String(item).trim()).filter(Boolean).slice(0, 6);
  }

  const text = String(tone || '').trim();
  return text
    ? text.split(/[、,\s]+/).map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .map((item) => ({
      role: item && item.role === 'me' ? 'me' : 'other',
      text: String(item && item.text ? item.text : '').trim()
    }))
    .filter((item) => item.text)
    .slice(-8);
}

module.exports = {
  startServer
};
