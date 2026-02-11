import { PlaitElement } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';

export interface ImageToImageRequest {
  prompt: string;
  images: string[]; // 图片URL数组
  size?: string;
  watermark?: boolean;
  apiKey: string;
  model?: string;
  provider?: 'volcengine' | 'modelscope';
  modelScopeApiKey?: string;
  // 组图生成参数
  sequential_image_generation?: 'auto' | 'disabled';
  max_images?: number; // 最大生成图片数量
}

export interface ImageToImageResponse {
  index: number;
  url: string;
  size: string;
  totalImages?: number; // 总图片数量，用于多图生成时提前创建占位符
}

/**
 * 获取图片元素的URL
 */
export function getImageUrl(imageElement: PlaitElement): string | null {
  console.log('🔍 检查图片元素:', imageElement);
  console.log('🔍 元素类型:', (imageElement as any).type);
  console.log('🔍 是否为图片:', PlaitDrawElement.isImage(imageElement));

  // 检查是否为占位符（SVG base64）
  const directUrl = (imageElement as any).url;
  if (directUrl && directUrl.startsWith('data:image/svg+xml;base64')) {
    console.log('🔍 跳过占位符（SVG base64）:', directUrl.substring(0, 50) + '...');
    return null;
  }

  // 优先检查imageItem.url（真实图片）
  const imageItem = (imageElement as any).imageItem;
  console.log('🔍 imageItem:', imageItem);

  if (imageItem?.url) {
    let url = imageItem.url;
    console.log('🔍 找到图片URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''));

    // 如果是base64图片，直接返回
    if (url.startsWith('data:image/') && url.includes('base64,')) {
      console.log('🔍 imageItem中的base64图片');
      return url;
    }

    // 如果是代理URL，提取原始URL
    if (url.includes('image-proxy?url=')) {
      try {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const originalUrl = urlParams.get('url');
        if (originalUrl) {
          url = decodeURIComponent(originalUrl);
          console.log('🔍 提取原始URL:', url);
        }
      } catch (error) {
        console.log('🔍 提取原始URL失败:', error);
      }
    }

    return url;
  }

  // 备用检查：直接检查url属性
  if (directUrl) {
    // 支持HTTP/HTTPS URL
    if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
      console.log('🔍 找到HTTP/HTTPS URL:', directUrl);

      // 如果是代理URL，提取原始URL
      if (directUrl.includes('image-proxy?url=')) {
        try {
          const urlParams = new URLSearchParams(directUrl.split('?')[1]);
          const originalUrl = urlParams.get('url');
          if (originalUrl) {
            const decodedUrl = decodeURIComponent(originalUrl);
            console.log('🔍 提取原始URL:', decodedUrl);
            return decodedUrl;
          }
        } catch (error) {
          console.log('🔍 提取原始URL失败:', error);
        }
      }

      return directUrl;
    }

    // 支持base64图片（粘贴的图片）
    if (directUrl.startsWith('data:image/') && directUrl.includes('base64,')) {
      console.log('🔍 找到base64图片:', directUrl.substring(0, 50) + '...');
      return directUrl;
    }
  }

  console.log('🔍 未找到有效的图片URL');
  return null;
}

/**
 * 获取图片元素的尺寸
 */
export function getImageSize(imageElement: PlaitElement): { width: number; height: number } | null {
  if (!PlaitDrawElement.isImage(imageElement)) {
    return null;
  }

  const imageItem = (imageElement as any).imageItem;
  const width = imageItem?.width || 1024; // 默认1024，确保满足最小像素要求
  const height = imageItem?.height || 1024;

  console.log('🎨 获取图片尺寸:', { imageItem, width, height, pixels: width * height });

  return { width, height };
}

/**
 * 计算图片的宽高比
 */
export function getImageAspectRatio(imageElement: PlaitElement): string {
  const size = getImageSize(imageElement);
  if (!size) return '1:1';
  
  const { width, height } = size;
  const ratio = width / height;
  
  // 常见比例判断
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
  if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
  
  // 默认返回计算的比例
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * 根据宽高比计算像素尺寸
 */
export function calculateSizeFromAspectRatio(
  aspectRatio: string,
  referenceSize?: { width: number; height: number }
): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  
  if (referenceSize) {
    // 基于参考尺寸计算
    const referenceRatio = referenceSize.width / referenceSize.height;
    const targetRatio = widthRatio / heightRatio;
    
    if (Math.abs(referenceRatio - targetRatio) < 0.1) {
      // 比例相近，直接使用参考尺寸
      return referenceSize;
    }
    
    // 保持参考图片的面积，调整比例
    const area = referenceSize.width * referenceSize.height;
    const width = Math.sqrt(area * targetRatio);
    const height = width / targetRatio;
    
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }
  
  // 默认尺寸计算
  const baseSize = 2240;
  const ratio = widthRatio / heightRatio;
  
  if (ratio > 1) {
    // 横向
    return {
      width: Math.round(baseSize * ratio),
      height: baseSize
    };
  } else {
    // 纵向或正方形
    return {
      width: baseSize,
      height: Math.round(baseSize / ratio)
    };
  }
}

/**
 * 转换尺寸为API格式
 */
export function formatSizeForAPI(size: { width: number; height: number }): string {
  // 确保尺寸是整数，豆包API不接受小数
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  return `${width}x${height}`;
}

/**
 * 分析提示词，判断是否需要生成多张图片
 */
export function analyzePromptForMultipleImages(prompt: string): { shouldGenerateMultiple: boolean; maxImages: number } {
  const lowerPrompt = prompt.toLowerCase();

  // 检查明确的数量词
  const numberMatches = prompt.match(/(\d+)张|(\d+)个|(\d+)种|(\d+)幅/g);
  if (numberMatches) {
    const numbers = numberMatches.map(match => {
      const num = match.match(/\d+/);
      return num ? parseInt(num[0]) : 1;
    });
    const maxNum = Math.max(...numbers);
    if (maxNum > 1 && maxNum <= 10) { // 限制最大10张
      return { shouldGenerateMultiple: true, maxImages: maxNum };
    }
  }

  // 检查风格词汇
  const styleKeywords = [
    '风格', '样式', '版本', '变体', '变化', '不同',
    '玻璃', '素描', '塑料', '金属', '木质', '石材',
    '卡通', '写实', '抽象', '油画', '水彩', '素描',
    '早晨', '中午', '晚上', '春夏秋冬', '四季',
    '红色', '蓝色', '绿色', '黄色', '紫色', '橙色'
  ];

  let styleCount = 0;
  for (const keyword of styleKeywords) {
    if (lowerPrompt.includes(keyword)) {
      styleCount++;
    }
  }

  // 如果包含多个风格关键词，建议生成多张
  if (styleCount >= 2) {
    return { shouldGenerateMultiple: true, maxImages: Math.min(styleCount, 5) };
  }

  // 检查列举词汇（用逗号、顿号分隔）
  const listItems = prompt.split(/[，,、]/);
  if (listItems.length >= 3) {
    return { shouldGenerateMultiple: true, maxImages: Math.min(listItems.length, 6) };
  }

  return { shouldGenerateMultiple: false, maxImages: 1 };
}

/**
 * 调用图生图API
 */
export async function generateImageToImage(
  request: ImageToImageRequest,
  onProgress?: (response: ImageToImageResponse) => void
): Promise<ImageToImageResponse[]> {
  // 根据环境选择API端点
  const getApiEndpoint = () => {
    if (typeof window !== 'undefined') {
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      return isLocalDev ? 'http://localhost:3000/generate-image' : '/generate-image';
    }
    return '/generate-image';
  };
  const apiEndpoint = getApiEndpoint();

  // 根据豆包Seedream API文档格式化请求
  const requestBody: any = {
    model: request.model || "doubao-seedream-4-5-251128",
    prompt: request.prompt,
    // 豆包API：单图用字符串，多图用数组
    image: request.images.length === 1 ? request.images[0] : request.images,
    size: request.size || "2K", // 使用传入的尺寸参数，如果没有则默认2K
    response_format: "url",
    watermark: request.watermark || false,
    stream: true,
    apiKey: request.apiKey,
    provider: request.provider || 'volcengine',
    ...(request.modelScopeApiKey ? { modelScopeApiKey: request.modelScopeApiKey } : {})
  };

  // 添加组图生成参数（让豆包API自己判断）
  if (request.sequential_image_generation === 'auto') {
    requestBody.sequential_image_generation = 'auto';
    if (request.max_images && request.max_images > 1) {
      requestBody.sequential_image_generation_options = {
        max_images: request.max_images
      };
    }
  }

  console.log('🎨 发送图生图请求:', requestBody);
  console.log('🎨 请求体JSON:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    // 尝试读取错误响应内容
    let errorText = '';
    try {
      errorText = await response.text();
      console.error('🔥 API错误响应:', errorText);
    } catch (e) {
      console.error('🔥 无法读取错误响应');
    }
    
    let errorMessage = `图生图API请求失败: ${response.status} ${response.statusText}`;
    
    if (response.status === 401) {
      errorMessage = 'API密钥无效或已过期，请检查设置中的API密钥配置';
    } else if (response.status === 403) {
      errorMessage = 'API访问被拒绝，请检查API密钥权限';
    } else if (response.status === 429) {
      errorMessage = 'API请求频率过高，请稍后重试';
    } else if (response.status >= 500) {
      errorMessage = 'API服务暂时不可用，请稍后重试';
    } else {
      errorMessage += `. 响应: ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const results: ImageToImageResponse[] = [];
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('🎨 图生图生成完成');
            return results;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'image_generation.partial_succeeded') {
              const result: ImageToImageResponse = {
                index: parsed.image_index || 0,
                url: parsed.url,
                size: parsed.size || '1024x1024'
              };

              console.log('🎨 收到图生图结果:', result);
              results.push(result);

              if (onProgress) {
                onProgress(result);
              }
            } else if (parsed.type === 'image_generation.completed') {
              // 从completed事件中获取总图片数量
              const totalImages = parsed.usage?.generated_images;
              if (totalImages && totalImages > 1) {
                console.log(`🎨 图生图完成，总共生成${totalImages}张图片`);

                // 为已生成的图片添加totalImages信息
                results.forEach(result => {
                  result.totalImages = totalImages;
                });

                // 如果有进度回调，发送一个特殊的事件来通知总数
                if (onProgress && totalImages > results.length) {
                  onProgress({
                    index: -1, // 特殊索引表示这是总数通知
                    url: '',
                    size: '',
                    totalImages: totalImages
                  });
                }
              }
            }
          } catch (e) {
            console.warn('解析图生图响应失败:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return results;
}
