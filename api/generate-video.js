const https = require('https');

const VOLCENGINE_VIDEO_API = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

// 从环境变量获取默认API密钥（可选，用于部署端配置）
const DEFAULT_VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ark-api-key',
  'Access-Control-Allow-Credentials': true
};

function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.end();
    return;
  }

  if (req.method === 'GET') {
    handleVideoTaskGet(req, res);
    return;
  }

  if (req.method === 'POST') {
    handleVideoTaskCreate(req, res);
    return;
  }

  res.status(404);
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  res.json({ error: 'Not Found' });
}

const handleVideoTaskGet = (req, res) => {
  let responseHandled = false;

  const sendResponse = (statusCode, data) => {
    if (responseHandled) return;
    responseHandled = true;
    if (!res.headersSent) {
      res.status(statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      if (typeof data === 'object') {
        res.json(data);
      } else {
        res.end(data);
      }
    }
  };

  try {
    const apiKey = req.headers['x-ark-api-key'] || req.query?.apiKey || DEFAULT_VOLCENGINE_API_KEY;
    if (!apiKey) {
      sendResponse(400, { error: 'API密钥未提供，请在设置中配置API密钥或联系管理员配置环境变量' });
      return;
    }

    const id = req.params?.id || req.query?.id;
    if (!id) {
      sendResponse(400, { error: 'Missing task id' });
      return;
    }

    const url = `${VOLCENGINE_VIDEO_API}/${encodeURIComponent(id)}`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    };

    const proxyReq = https.request(url, options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      let data = '';
      proxyRes.on('data', chunk => { data += chunk.toString(); });
      proxyRes.on('end', () => {
        res.end(data);
      });
    });

    proxyReq.on('error', (error) => {
      if (proxyReq.destroyed && error.code === 'ECONNRESET') return;
      sendResponse(500, { error: 'Proxy request failed', details: error.message });
    });

    proxyReq.setTimeout(60000, () => {
      proxyReq.destroy();
      sendResponse(504, { error: 'Request timeout (gateway)' });
    });

    proxyReq.end();
  } catch (err) {
    sendResponse(500, { error: 'Internal server error', details: err.message });
  }
};

const handleVideoTaskCreate = (req, res) => {
  let responseHandled = false;

  const sendResponse = (statusCode, data) => {
    if (responseHandled) return;
    responseHandled = true;
    if (!res.headersSent) {
      res.status(statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      if (typeof data === 'object') {
        res.json(data);
      } else {
        res.end(data);
      }
    }
  };

  try {
    const body = req.body || {};
    const provider = body.provider || 'volcengine';
    if (provider !== 'volcengine') {
      sendResponse(400, { error: 'Unsupported provider for video generation' });
      return;
    }

    const apiKey = body.apiKey || DEFAULT_VOLCENGINE_API_KEY;
    if (!apiKey) {
      sendResponse(400, { error: 'API密钥未提供，请在设置中配置API密钥或联系管理员配置环境变量' });
      return;
    }

    const content = [];
    if (typeof body.prompt === 'string' && body.prompt.trim().length > 0) {
      content.push({ type: 'text', text: body.prompt });
    }
    const images = Array.isArray(body.image_url)
      ? body.image_url
      : (typeof body.image_url === 'string' ? [body.image_url] : []);
    const cleanImages = images
      .filter(u => typeof u === 'string' && u.trim().length > 0)
      .map(u => u.trim());
    if (cleanImages.length === 1) {
      content.push({ type: 'image_url', role: 'first_frame', image_url: { url: cleanImages[0] } });
    } else if (cleanImages.length >= 2) {
      content.push({ type: 'image_url', role: 'first_frame', image_url: { url: cleanImages[0] } });
      content.push({ type: 'image_url', role: 'last_frame', image_url: { url: cleanImages[1] } });
    }

    const payload = {
      model: body.model,
      content,
      generate_audio: !!body.generate_audio,
      ratio: body.ratio || 'adaptive',
      duration: typeof body.duration === 'number' ? body.duration : 5,
      watermark: body.watermark !== false,
      return_last_frame: true
    };

    const postData = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const proxyReq = https.request(VOLCENGINE_VIDEO_API, options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      let data = '';
      proxyRes.on('data', chunk => { data += chunk.toString(); });
      proxyRes.on('end', () => {
        res.end(data);
      });
    });

    proxyReq.on('error', (error) => {
      if (proxyReq.destroyed && error.code === 'ECONNRESET') return;
      sendResponse(500, { error: 'Proxy request failed', details: error.message });
    });

    proxyReq.setTimeout(180000, () => {
      proxyReq.destroy();
      sendResponse(504, { error: 'Request timeout (gateway)' });
    });

    proxyReq.write(postData);
    proxyReq.end();
  } catch (err) {
    sendResponse(500, { error: 'Internal server error', details: err.message });
  }
};

module.exports = handler;
