// Node.js API handler for image generation
const https = require('https');

const VOLCENGINE_API = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODELSCOPE_API_BASE = 'https://api-inference.modelscope.cn/v1';

// 从环境变量获取默认API密钥（可选，用于部署端配置）
const DEFAULT_VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY;
const DEFAULT_MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true
};

// Main handler function
function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.end();
    return;
  }

  // Handle POST requests for image generation
  if (req.method === 'POST') {
    handleImageGeneration(req, res);
    return;
  }

  res.status(404);
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  res.json({ error: 'Not Found' });
}

const handleImageGeneration = async (req, res) => {
  let responseHandled = false;
  
  const sendResponse = (statusCode, data) => {
    if (responseHandled) {
      console.warn('⚠️ 尝试重复发送响应，已忽略');
      return;
    }
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
    const requestData = req.body || {};
    const provider = requestData.provider || 'volcengine';

    console.log(`🚀 收到生成请求，提供商: ${provider}`);

    if (provider === 'modelscope') {
      await handleModelScopeGeneration(req, res, requestData, sendResponse);
    } else {
      await handleVolcengineGeneration(req, res, requestData, sendResponse);
    }

  } catch (error) {
    console.error('🚨 处理请求时发生错误:', error);
    sendResponse(500, { error: 'Internal server error', details: error.message });
  }
};

// --- Volcengine Handler ---

const handleVolcengineGeneration = (req, res, requestData, sendResponse) => {
    // 优先使用请求中的apiKey，其次使用环境变量中的DEFAULT_VOLCENGINE_API_KEY
    const apiKey = requestData.apiKey || DEFAULT_VOLCENGINE_API_KEY;
    if (!apiKey) {
      sendResponse(400, { error: 'API密钥未提供，请在设置中配置API密钥或联系管理员配置环境变量' });
      return;
    }

    // Prepare request to Volcengine API
    const maxImages = requestData.maxImages || 1;
    const volcengineRequestData = {
      model: requestData.model || 'doubao-seedream-4-5-251128',
      prompt: requestData.prompt,
      response_format: 'url',
      size: requestData.size || '2K',
      stream: true,
      watermark: requestData.watermark !== false
    };

    if (requestData.image) {
      volcengineRequestData.image = requestData.image;
    }

    if (maxImages > 1) {
      volcengineRequestData.sequential_image_generation = 'auto';
      volcengineRequestData.sequential_image_generation_options = {
        max_images: maxImages
      };
    } else {
      volcengineRequestData.sequential_image_generation = 'disabled';
    }

    const postData = JSON.stringify(volcengineRequestData);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🚀 发送请求到豆包API:', VOLCENGINE_API);

    const proxyReq = https.request(VOLCENGINE_API, options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (proxyRes.statusCode !== 200) {
        let errorData = '';
        proxyRes.on('data', chunk => { errorData += chunk.toString(); });
        proxyRes.on('end', () => {
          console.error('🚨 豆包API错误响应:', errorData);
          res.write(errorData);
          res.end();
        });
        return;
      }

      proxyRes.on('data', chunk => { res.write(chunk); });
      proxyRes.on('end', () => { res.end(); });
    });

    proxyReq.on('error', (error) => {
      // 如果是因为超时导致的销毁，忽略此错误（已在setTimeout处理）
      if (proxyReq.destroyed && error.code === 'ECONNRESET') {
        return;
      }
      sendResponse(500, { error: 'Proxy request failed', details: error.message });
    });

    // 增加超时时间到 180 秒
    proxyReq.setTimeout(180000, () => {
      console.error('🚨 请求超时，已销毁连接');
      proxyReq.destroy();
      sendResponse(504, { error: 'Request timeout (gateway)' });
    });

    proxyReq.write(postData);
    proxyReq.end();
};

// --- ModelScope Handler ---

const handleModelScopeGeneration = async (req, res, requestData, sendResponse) => {
    // 优先使用请求中的apiKey，其次使用环境变量中的DEFAULT_MODELSCOPE_API_KEY
    const apiKey = requestData.modelScopeApiKey || DEFAULT_MODELSCOPE_API_KEY;
    if (!apiKey) {
        sendResponse(400, { error: 'ModelScope API密钥未提供，请在设置中配置或联系管理员配置环境变量' });
        return;
    }

    const prompt = requestData.prompt;
    const model = requestData.model || 'Tongyi-MAI/Z-Image-Turbo';
    
    // 1. Submit Task
    const submitPayload = {
        model: model,
        input: {
            prompt: prompt
        },
        parameters: {
             // specific parameters if needed
        }
    };
    
    // Some models use different payload structure. 
    // Reference script uses: { model: model, prompt: prompt, loras: ... }
    // Let's stick to the reference script structure which seems to be for ModelScope Inference API
    const refPayload = {
        model: model,
        prompt: prompt
    };

    console.log('🚀 发送任务到 ModelScope:', refPayload);

    try {
        const taskData = await makeHttpRequest(
            `${MODELSCOPE_API_BASE}/images/generations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'X-ModelScope-Async-Mode': 'true'
                },
                body: JSON.stringify(refPayload)
            }
        );

        const taskId = taskData.task_id;
        if (!taskId) {
            throw new Error('No task_id returned from ModelScope');
        }
        console.log('🚀 ModelScope 任务ID:', taskId);

        // Send headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
        });

        // 2. Poll Status
        let attempts = 0;
        const maxAttempts = 60; // 2 minutes (2s interval)
        
        const poll = async () => {
            if (attempts >= maxAttempts) {
                res.write(`data: ${JSON.stringify({ error: 'Timeout waiting for generation' })}\n\n`);
                res.end();
                return;
            }

            try {
                const result = await makeHttpRequest(
                    `${MODELSCOPE_API_BASE}/tasks/${taskId}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'X-ModelScope-Task-Type': 'image_generation'
                        }
                    }
                );

                const status = result.task_status;
                console.log(`🚀 ModelScope 任务状态: ${status}`);

                if (status === 'SUCCEED') {
                    if (result.output_images && result.output_images.length > 0) {
                        const imageUrl = result.output_images[0];
                        // Simulate SSE event
                        const eventData = {
                            type: 'image_generation.partial_succeeded',
                            image_index: 0,
                            url: imageUrl,
                            size: '1024x1024' // ModelScope doesn't always return size, assume standard or parse if available
                        };
                        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                    } else {
                         res.write(`data: ${JSON.stringify({ error: 'No output images' })}\n\n`);
                         res.end();
                    }
                } else if (status === 'FAILED') {
                    res.write(`data: ${JSON.stringify({ error: 'Generation failed', details: result })}\n\n`);
                    res.end();
                } else {
                    // PENDING or RUNNING
                    attempts++;
                    setTimeout(poll, 2000);
                }
            } catch (err) {
                console.error('Polling error:', err);
                res.write(`data: ${JSON.stringify({ error: 'Polling error' })}\n\n`);
                res.end();
            }
        };

        poll();

    } catch (error) {
        console.error('ModelScope request failed:', error);
        // If headers not sent, send JSON error
        if (!res.headersSent) {
             sendResponse(500, { error: 'ModelScope request failed', details: error.message });
        } else {
             res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
             res.end();
        }
    }
};

// Helper for HTTPS requests
function makeHttpRequest(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

module.exports = handler;
