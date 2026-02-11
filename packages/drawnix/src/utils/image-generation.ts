export type ModelProvider = 'volcengine' | 'modelscope';

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  type: 'image' | 'video';
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'doubao-seedream-4-5-251128', name: '豆包·Dream (图片)', provider: 'volcengine', type: 'image' },
  { id: 'doubao-seedance-1-5-pro-251215', name: '豆包·Seedance Pro (视频)', provider: 'volcengine', type: 'video' },
  { id: 'Tongyi-MAI/Z-Image-Turbo', name: '通义·Turbo (ModelScope)', provider: 'modelscope', type: 'image' },
];

export interface ConfiguredModel {
  provider: ModelProvider;
  type: 'image' | 'video';
  displayName: string;
  apiModel: string;
}

export const DEFAULT_CONFIGURED_MODELS: ConfiguredModel[] = AVAILABLE_MODELS.map(model => ({
  provider: model.provider,
  type: model.type,
  displayName: model.name,
  apiModel: model.id,
}));

export const getDefaultModelByProvider = (): Record<ModelProvider, string> => {
  const volcengineDefault = DEFAULT_CONFIGURED_MODELS.find(m => m.provider === 'volcengine')?.apiModel || '';
  const modelscopeDefault = DEFAULT_CONFIGURED_MODELS.find(m => m.provider === 'modelscope')?.apiModel || '';
  return { volcengine: volcengineDefault, modelscope: modelscopeDefault };
};

export interface ImageGenerationConfig {
  apiKey: string;
  modelScopeApiKey?: string;
  endpoint?: string;
  model?: string;
  provider?: ModelProvider;
}

export interface ImageGenerationRequest {
  prompt: string;
  image?: string[];
  maxImages?: number;
  size?: string;
  watermark?: boolean;
  provider?: ModelProvider;
  model?: string;
}

export interface ImageGenerationResult {
  index: number;
  url: string;
  size: string;
}

export interface ImageGenerationResponse {
  images: ImageGenerationResult[];
  completed: boolean;
  error?: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  provider?: ModelProvider;
  model?: string;
}

export interface VideoGenerationResult {
  taskId?: string;
  status?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  raw?: any;
  error?: string;
}

// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3000/generate-image' : '/generate-image';
  }
  return '/generate-image';
};

const getDefaultVideoEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3000/generate-video' : '/generate-video';
  }
  return '/generate-video';
};

const DEFAULT_CONFIG: Partial<ImageGenerationConfig> = {
  endpoint: getDefaultEndpoint(),
  model: 'doubao-seedream-4-5-251128',
  provider: 'volcengine',
};

const normalizeConfiguredModels = (raw: unknown): ConfiguredModel[] => {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_CONFIGURED_MODELS];
  }
  const cleaned = raw
    .map((item: any) => ({
      provider: item?.provider,
      type: item?.type,
      displayName: typeof item?.displayName === 'string' ? item.displayName : '',
      apiModel: typeof item?.apiModel === 'string' ? item.apiModel : '',
    }))
    .filter((m: any) => (m.provider === 'volcengine' || m.provider === 'modelscope') && (m.type === 'image' || m.type === 'video') && m.apiModel.trim().length > 0);

  return cleaned.length > 0 ? cleaned : [...DEFAULT_CONFIGURED_MODELS];
};

const normalizeDefaultModelByProvider = (
  raw: unknown,
  models: ConfiguredModel[]
): Record<ModelProvider, string> => {
  const defaults = getDefaultModelByProvider();
  const record = (raw && typeof raw === 'object') ? (raw as any) : {};
  const volcengineCandidate = typeof record.volcengine === 'string' ? record.volcengine : defaults.volcengine;
  const modelscopeCandidate = typeof record.modelscope === 'string' ? record.modelscope : defaults.modelscope;

  const hasVolcengine = models.some(m => m.provider === 'volcengine' && m.apiModel === volcengineCandidate);
  const hasModelscope = models.some(m => m.provider === 'modelscope' && m.apiModel === modelscopeCandidate);

  return {
    volcengine: hasVolcengine ? volcengineCandidate : (models.find(m => m.provider === 'volcengine')?.apiModel || defaults.volcengine),
    modelscope: hasModelscope ? modelscopeCandidate : (models.find(m => m.provider === 'modelscope')?.apiModel || defaults.modelscope),
  };
};

export const loadModelSettings = () => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    const models = normalizeConfiguredModels(parsed.models);
    const defaultModelByProvider = normalizeDefaultModelByProvider(parsed.defaultModelByProvider, models);
    const selectedModel = typeof parsed.selectedModel === 'string' ? parsed.selectedModel : (typeof parsed.defaultModel === 'string' ? parsed.defaultModel : '');
    return { models, defaultModelByProvider, selectedModel };
  } catch {
    const models = [...DEFAULT_CONFIGURED_MODELS];
    return { models, defaultModelByProvider: getDefaultModelByProvider(), selectedModel: '' };
  }
};

export type ImageResolution = '1K' | '2K' | '4K';

export const loadImageResolution = (): ImageResolution => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    const raw = parsed.imageResolution;
    if (raw === '1K' || raw === '2K' || raw === '4K') return raw;
    return '2K';
  } catch {
    return '2K';
  }
};

export const persistImageResolution = (imageResolution: ImageResolution) => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    localStorage.setItem('drawnix-settings', JSON.stringify({ ...parsed, imageResolution }));
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...parsed, imageResolution } }));
  } catch {
    return;
  }
};

export const loadVideoRatio = (): string => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.videoRatio || 'adaptive';
    }
  } catch {}
  return 'adaptive';
};

export const persistVideoRatio = (ratio: string) => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    localStorage.setItem('drawnix-settings', JSON.stringify({ ...parsed, videoRatio: ratio }));
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...parsed, videoRatio: ratio } }));
  } catch {}
};

export const loadVideoDuration = (): number => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.videoDuration || 5;
    }
  } catch {}
  return 5;
};

export const persistVideoDuration = (duration: number) => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    localStorage.setItem('drawnix-settings', JSON.stringify({ ...parsed, videoDuration: duration }));
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...parsed, videoDuration: duration } }));
  } catch {}
};

export const loadVideoGenerateAudio = (): boolean => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.videoGenerateAudio !== undefined ? parsed.videoGenerateAudio : true;
    }
  } catch {}
  return true;
};

export const persistVideoGenerateAudio = (generateAudio: boolean) => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    localStorage.setItem('drawnix-settings', JSON.stringify({ ...parsed, videoGenerateAudio: generateAudio }));
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...parsed, videoGenerateAudio: generateAudio } }));
  } catch {}
};

export const persistSelectedModel = (apiModel: string) => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    localStorage.setItem('drawnix-settings', JSON.stringify({ ...parsed, selectedModel: apiModel }));
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...parsed, selectedModel: apiModel } }));
  } catch {
    return;
  }
};

export class ImageGenerationAPI {
  private config: ImageGenerationConfig;

  constructor(config: ImageGenerationConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateImages(
    request: ImageGenerationRequest,
    onProgress?: (result: ImageGenerationResult) => void
  ): Promise<ImageGenerationResponse> {
    const { prompt, image, maxImages = 3, size, watermark = true, provider, model } = request;

    const requestBody = {
      prompt,
      ...(image && { image }),
      maxImages,
      size: size || '2K', // 使用传入的size，如果没有则默认为2K
      watermark,
      apiKey: this.config.apiKey, // 从配置中包含API密钥
      modelScopeApiKey: this.config.modelScopeApiKey,
      model: model || this.config.model, // 优先使用请求中的模型
      provider: provider || this.config.provider || 'volcengine',
    };

    console.log('Sending image generation request with size:', size, 'requestBody:', requestBody);

    try {
      const response = await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        if (response.status === 401) {
          errorMessage = 'API密钥无效或已过期，请检查设置中的API密钥配置';
        } else if (response.status === 403) {
          errorMessage = 'API访问被拒绝，请检查API密钥权限';
        } else if (response.status === 429) {
          errorMessage = 'API请求频率过高，请稍后重试';
        } else if (response.status >= 500) {
          errorMessage = 'API服务暂时不可用，请稍后重试';
        }
        
        throw new Error(errorMessage);
      }

      const images: ImageGenerationResult[] = [];
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: image_generation.partial_succeeded')) {
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            
            if (dataStr === '[DONE]') {
              return { images, completed: true };
            }

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'image_generation.partial_succeeded') {
                const result: ImageGenerationResult = {
                  index: data.image_index,
                  url: data.url,
                  size: data.size,
                };
                
                images.push(result);
                
                if (onProgress) {
                  onProgress(result);
                }
              } else if (data.type === 'image_generation.completed') {
                return { images, completed: true };
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', dataStr);
            }
          }
        }
      }

      return { images, completed: true };
    } catch (error) {
      console.error('Image generation error:', error);
      return {
        images: [],
        completed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const {
      prompt,
      imageUrl,
      ratio = 'adaptive',
      duration = 5,
      generateAudio = true,
      watermark = true,
      provider,
      model,
    } = request;

    const requestBody = {
      prompt,
      image_url: imageUrl,
      ratio,
      duration,
      generate_audio: generateAudio,
      watermark,
      apiKey: this.config.apiKey,
      model: model || this.config.model,
      provider: provider || this.config.provider || 'volcengine',
    };

    try {
      const response = await fetch(getDefaultVideoEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (json && (json.error?.message || json.error)) ||
          `HTTP error! status: ${response.status}`;
        return { error: message, raw: json };
      }

      const taskId = json?.id || json?.task_id || json?.data?.id;
      if (!taskId) {
        return { error: 'Video task id missing in response', raw: json };
      }

      const pollIntervalMs = 2000;
      const maxAttempts = 180;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        const statusResp = await fetch(`${getDefaultVideoEndpoint()}/${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-ark-api-key': this.config.apiKey,
          },
        });

        const statusJson = await statusResp.json().catch(() => null);
        if (!statusResp.ok) {
          const msg =
            (statusJson && (statusJson.error?.message || statusJson.error)) ||
            `HTTP error! status: ${statusResp.status}`;
          return { taskId, error: msg, raw: statusJson };
        }

        const status = statusJson?.status;
        if (status === 'succeeded') {
          return {
            taskId,
            status,
            videoUrl: statusJson?.content?.video_url,
            lastFrameUrl: statusJson?.content?.last_frame_url,
            raw: statusJson,
          };
        }

        if (status === 'failed' || status === 'expired' || status === 'cancelled') {
          const msg = statusJson?.error?.message || `Video task ${status}`;
          return { taskId, status, error: msg, raw: statusJson };
        }
      }

      return { taskId, status: 'timeout', error: 'Video task polling timeout', raw: json };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// 创建获取当前设置的函数
const getCurrentSettings = () => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const models = normalizeConfiguredModels(parsed.models);
      const defaultModelByProvider = normalizeDefaultModelByProvider(parsed.defaultModelByProvider, models);
      const selectedModel = typeof parsed.selectedModel === 'string'
        ? parsed.selectedModel
        : (typeof parsed.defaultModel === 'string' ? parsed.defaultModel : '');
      const selectedEntry =
        models.find(m => m.apiModel === selectedModel) ||
        models.find(m => m.apiModel === defaultModelByProvider.volcengine) ||
        models[0];
      return {
        apiKey: parsed.apiKey || '',
        modelScopeApiKey: parsed.modelScopeApiKey || '',
        endpoint: parsed.apiEndpoint || getDefaultEndpoint(),
        model: selectedEntry?.apiModel || 'doubao-seedream-4-5-251128',
        provider: (selectedEntry?.provider || 'volcengine') as ModelProvider,
      };
    }
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
  return {
    apiKey: '',
    modelScopeApiKey: '',
    endpoint: getDefaultEndpoint(),
    model: 'doubao-seedream-4-5-251128',
    provider: 'volcengine' as ModelProvider,
  };
};

// 创建动态API实例
export const createImageGenerationAPI = (overrides?: Partial<ImageGenerationConfig>): ImageGenerationAPI => {
  const settings = getCurrentSettings();
  return new ImageGenerationAPI({
    apiKey: settings.apiKey,
    modelScopeApiKey: settings.modelScopeApiKey,
    endpoint: settings.endpoint,
    model: settings.model,
    provider: settings.provider,
    ...overrides,
  });
};

// 默认实例（为了向后兼容）
export const imageGenerationAPI = createImageGenerationAPI();
