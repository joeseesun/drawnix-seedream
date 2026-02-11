import { PlaitBoard, Point, PlaitElement, Transforms } from '@plait/core';
import { DrawTransforms, BasicShapes } from '@plait/draw';
import { loadHTMLImageElement, buildImage } from '../data/image';
import { ImageGenerationResult } from './image-generation';
import { setFillColor, setStrokeColor } from '../transforms/property';

// 存储动画定时器的Map，避免直接修改不可扩展的PlaitBoard元素
const animationTimers = new Map<string, NodeJS.Timeout>();

export interface AddGeneratedImageOptions {
  position?: Point;
  maxWidth?: number;
  spacing?: number;
  aspectRatio?: string;
  customWidth?: number;
  customHeight?: number;
  selectedImageWidth?: number;
  selectedImageHeight?: number;
  extraNodeProps?: Record<string, unknown>;
}

// 根据环境决定图片代理端点
const getImageProxyUrl = (imageUrl: string) => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const proxyBase = isLocalDev ? 'http://localhost:3000/image-proxy' : '/image-proxy';
    return `${proxyBase}?url=${encodeURIComponent(imageUrl)}`;
  }
  return `/image-proxy?url=${encodeURIComponent(imageUrl)}`;
};

/**
 * 加载图片并获取尺寸信息
 */
export const loadImageInfo = async (url: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve({ width: image.width, height: image.height });
    };
    image.onerror = () => {
      // 如果跨域失败，使用默认尺寸
      resolve({ width: 400, height: 300 });
    };
    // 使用代理URL来避免CORS问题
    const proxyUrl = getImageProxyUrl(url);
    image.src = proxyUrl;
  });
};

/**
 * 计算基于宽高比的尺寸
 */
const calculateDimensionsFromAspectRatio = (aspectRatio: string, maxWidth: number, customWidth?: number, customHeight?: number): {width: number, height: number} => {
  if (aspectRatio === 'auto') {
    return { width: maxWidth, height: maxWidth * 0.75 }; // 默认4:3比例
  }
  
  if (aspectRatio === 'custom' && customWidth && customHeight) {
    // 使用自定义尺寸，按比例缩放到合适的预览大小
    const scale = Math.min(maxWidth / customWidth, maxWidth / customHeight);
    return {
      width: Math.round(customWidth * scale),
      height: Math.round(customHeight * scale)
    };
  }
  
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  if (!widthRatio || !heightRatio) {
    return { width: maxWidth, height: maxWidth * 0.75 };
  }
  
  const ratio = heightRatio / widthRatio;
  return {
    width: maxWidth,
    height: maxWidth * ratio
  };
};

/**
 * 在画布上添加单张生成的图片
 */
export const addGeneratedImageToBoard = async (
  board: PlaitBoard,
  result: ImageGenerationResult,
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  const { position, maxWidth = 400 } = options;
  
  try {
    // 直接使用URL作为图片数据源
    const imageInfo = await loadImageInfo(result.url);
    
    // 计算缩放后的尺寸
    const width = imageInfo.width > maxWidth ? maxWidth : imageInfo.width;
    const height = (width / imageInfo.width) * imageInfo.height;
    
    // 构建图片数据 - 使用代理URL避免CORS问题
    const proxyUrl = getImageProxyUrl(result.url);
    const imageItem = {
      url: proxyUrl,
      width,
      height,
    };
    
    // 插入到画布
    DrawTransforms.insertImage(board, imageItem, position);
    console.log('Successfully added image to board:', result.url);
  } catch (error) {
    console.error('Failed to add generated image to board:', error);
    throw error;
  }
};

/**
 * 创建图片占位符
 */
// 创建占位图片的base64数据
const createPlaceholderImageData = (width: number, height: number, text: string = 'Loading...'): string => {
  // 使用英文文本避免编码问题，创建一个简单的SVG占位图
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dots" patternUnits="userSpaceOnUse" width="20" height="20">
          <circle cx="10" cy="10" r="2" fill="#9ca3af" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2" stroke-dasharray="10,5"/>
      <rect width="100%" height="100%" fill="url(#dots)" opacity="0.3"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial, sans-serif" font-size="16" fill="#6b7280">${text}</text>
      <circle cx="50%" cy="65%" r="8" fill="#3b82f6" opacity="0.7">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;

  // 转换为base64
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const createImagePlaceholders = async (
  board: PlaitBoard,
  options: AddGeneratedImageOptions & { count?: number } = {}
): Promise<PlaitElement[]> => {
  console.log('🚀 创建图片占位符');

  if (!board) {
    throw new Error('Board is null or undefined');
  }

  const {
    position = [400, 300],
    spacing = 320,
    maxWidth = 300,
    aspectRatio = '3:4',
    customWidth,
    customHeight,
    selectedImageWidth,
    selectedImageHeight,
    count = 1
  } = options;
  const placeholders: PlaitElement[] = [];

  // 占位符始终使用用户选择的宽高比，不使用选中图片尺寸
  const dimensions = calculateDimensionsFromAspectRatio(aspectRatio, maxWidth, customWidth, customHeight);
  console.log('📐 占位符使用宽高比尺寸:', dimensions, '宽高比:', aspectRatio);

  // 选中图片尺寸仅用于生成真实图片时参考
  if (selectedImageWidth && selectedImageHeight) {
    console.log('🖼️ 检测到选中图片尺寸（将用于生成图片）:', selectedImageWidth, 'x', selectedImageHeight);
  }

  for (let i = 0; i < count; i++) {
    // 计算每张图片的位置（水平排列）
    const imagePosition: Point = [
      position[0] + i * (maxWidth + spacing),
      position[1]
    ];

    // 创建占位图片数据
    const placeholderImageData = createPlaceholderImageData(
      dimensions.width,
      dimensions.height,
      `Generating...`
    );

    // 创建图片项
    const imageItem = {
      url: placeholderImageData,
      width: dimensions.width,
      height: dimensions.height,
    };

    // 记录插入前的元素数量
    const beforeCount = board.children.length;

    // 插入占位图片（添加小延迟避免框架冲突）
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        DrawTransforms.insertImage(board, imageItem, imagePosition);
        resolve();
      }, 5); // 5ms延迟
    });
    console.log(`🔍 [DEBUG] 插入前元素数量: ${beforeCount}, 插入后元素数量: ${board.children.length}`);

    // 检查是否有新元素被添加
    if (board.children.length > beforeCount) {
      // 获取最新添加的元素（通常是最后一个）
      const placeholder = board.children[board.children.length - 1];
      console.log(`🔍 [DEBUG] 找到新插入的元素:`, placeholder);

      // 标记这是一个占位符，方便后续识别和替换
      const elementPath = board.children.length - 1;
      try {
        // 添加延迟避免框架状态冲突
        setTimeout(() => {
          try {
            Transforms.setNode(board, {
              isPlaceholder: true,  // 标记为占位符
              placeholderIndex: i   // 记录占位符索引
            } as any, [elementPath]);
          } catch (error) {
            console.error(`❌ 标记占位符 ${i + 1} 失败:`, error);
          }
        }, 15); // 15ms延迟，在插入后执行
      } catch (error) {
        console.error(`❌ 标记占位符 ${i + 1} 失败:`, error);
        // 继续执行，不中断流程
      }

      placeholders.push(placeholder);
      console.log(`🎨 成功创建占位图片 ${i + 1}/${count}`);
    } else {
      console.warn(`⚠️ 占位图片 ${i + 1} 插入失败，元素数量未增加`);
    }
  }

  return placeholders;
};



/**
 * 替换占位符为真实图片
 */
export const replacePlaceholderWithImage = async (
  board: PlaitBoard,
  placeholder: PlaitElement,
  result: ImageGenerationResult,
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  console.log('🔄 开始替换占位图片为真实图片');
  console.log('🔄 占位符:', placeholder);
  console.log('🔄 图片结果:', result);

  const { maxWidth = 300, extraNodeProps } = options;

  try {
    // 找到占位符在board中的索引
    const placeholderIndex = board.children.findIndex(child => child.id === placeholder.id);
    if (placeholderIndex < 0) {
      console.warn('⚠️ 未找到占位符，无法替换');
      return;
    }

    // 验证占位符仍然存在且有效
    const currentPlaceholder = board.children[placeholderIndex];
    if (!currentPlaceholder || currentPlaceholder.id !== placeholder.id) {
      console.warn('⚠️ 占位符已被修改或删除，无法替换');
      return;
    }

    // 加载图片信息
    const imageInfo = await loadImageInfo(result.url);

    // 计算缩放后的尺寸，保持占位符的宽高比
    const currentImageItem = (placeholder as any).imageItem;
    let width = currentImageItem?.width || maxWidth;
    let height = currentImageItem?.height || (width * 3 / 4); // 默认3:4比例

    // 如果新图片太大，按比例缩放
    if (imageInfo.width > width) {
      const scale = width / imageInfo.width;
      height = imageInfo.height * scale;
    }

    // 使用代理URL避免CORS问题
    const proxyUrl = getImageProxyUrl(result.url);

    // 安全地更新占位符的图片URL和尺寸，保持位置不变
    try {
      // 使用setTimeout来延迟执行，避免框架状态冲突
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            Transforms.setNode(board, {
              url: proxyUrl,  // 更新元素的url属性
              imageItem: {
                url: proxyUrl,
                width,
                height,
              },
              isPlaceholder: false,  // 移除占位符标记
              placeholderIndex: undefined,  // 清除占位符索引
              ...(extraNodeProps || {})
            } as any, [placeholderIndex]);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 10); // 10ms延迟
      });
    } catch (error) {
      console.error('❌ 更新占位符时发生错误:', error);
      console.error('占位符索引:', placeholderIndex);
      console.error('Board children 数量:', board.children.length);
      throw error;
    }

    console.log('✅ 成功替换占位图片为真实图片');
    console.log('Successfully replaced placeholder with image:', result.url);
  } catch (error) {
    console.error('Failed to replace placeholder with image:', error);
    throw error;
  }
};

export const replaceImageElementWithImage = async (
  board: PlaitBoard,
  imageElement: PlaitElement,
  result: ImageGenerationResult,
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  const { extraNodeProps } = options;
  const targetIndex = board.children.findIndex(child => child.id === imageElement.id);
  if (targetIndex < 0) {
    return;
  }

  const currentImageItem = (board.children[targetIndex] as any)?.imageItem;
  const width = currentImageItem?.width || 300;
  const height = currentImageItem?.height || 225;
  const proxyUrl = getImageProxyUrl(result.url);

  Transforms.setNode(
    board,
    {
      url: proxyUrl,
      imageItem: {
        url: proxyUrl,
        width,
        height,
      },
      ...(extraNodeProps || {}),
    } as any,
    [targetIndex]
  );
};

/**
 * 在画布上添加多张生成的图片（带占位符）
 */
export const addGeneratedImagesToBoard = async (
  board: PlaitBoard,
  results: ImageGenerationResult[],
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    // 计算每张图片的位置（水平排列）
    const imagePosition: Point = [
      (options.position?.[0] || 400) + i * ((options.maxWidth || 300) + (options.spacing || 320)),
      options.position?.[1] || 300
    ];
    
    try {
      await addGeneratedImageToBoard(board, result, {
        ...options,
        position: imagePosition
      });
    } catch (error) {
      console.error(`Failed to add image ${i}:`, error);
      // 继续添加其他图片
    }
  }
};
