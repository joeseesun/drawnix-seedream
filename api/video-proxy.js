const http = require('http');
const https = require('https');
const { URL } = require('url');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Method Not Allowed' });
    return;
  }

  const rawUrl = req.query?.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Missing url' });
    return;
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Invalid url' });
    return;
  }

  const client = target.protocol === 'https:' ? https : http;
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const upstreamReq = client.request(target, { method: req.method, headers }, upstreamRes => {
    res.status(upstreamRes.statusCode || 200);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    Object.entries(upstreamRes.headers || {}).forEach(([key, value]) => {
      if (!value) return;
      res.setHeader(key, value);
    });
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', err => {
    if (res.headersSent) return;
    res.status(502);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Upstream request failed', details: err.message });
  });

  upstreamReq.end();
}

module.exports = handler;
