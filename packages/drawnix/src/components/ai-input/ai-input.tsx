import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Island } from '../island';
import classNames from 'classnames';
import { useI18n } from '../../i18n';
import { ToolButton } from '../tool-button';
// import { SendIcon } from '../icons'; // 使用 lucide-react 的 Send 图标
import { Paperclip, Send, X, Image, Sparkles, ChevronDown, BookOpen, Plus, Trash2, Box } from 'lucide-react';
import { useBoard } from '@plait-board/react-board';
import { PlaitElement, getSelectedElements, toHostPoint, toViewBoxPoint } from '@plait/core';
import { ConfiguredModel, createImageGenerationAPI, ImageGenerationResult, loadImageResolution, loadModelSettings, persistImageResolution, persistSelectedModel, loadVideoRatio, persistVideoRatio, loadVideoDuration, persistVideoDuration, loadVideoGenerateAudio, persistVideoGenerateAudio } from '../../utils/image-generation';
import { createImagePlaceholders, replacePlaceholderWithImage } from '../../utils/add-generated-image';
import { VideoPlayer } from '../video-player';
import './ai-input.scss';

export interface AIInputProps {
  className?: string;
  placeholder?: string;
  maxRows?: number;
  onSubmit?: (message: string) => void;
  apiEndpoint?: string;
}

export const AIInput: React.FC<AIInputProps> = ({
  className,
  placeholder = "输入图片描述来生成...",
  maxRows = 4,
  onSubmit,
  apiEndpoint = '/api/ai-chat',
}) => {
  const { t } = useI18n();
  const board = useBoard();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratioButtonRef = useRef<HTMLButtonElement>(null);
  const resolutionButtonRef = useRef<HTMLButtonElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 改名为isSubmitting，表示提交状态
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [selectedRatio, setSelectedRatio] = useState<string>('3:4');
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [resolutionDropdownPosition, setResolutionDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [modelDropdownPosition, setModelDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showCustomDimensionsModal, setShowCustomDimensionsModal] = useState(false);
  const [customWidth, setCustomWidth] = useState<number>(1024);
  const [customHeight, setCustomHeight] = useState<number>(1024);
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>(() => {
    if (typeof window === 'undefined') return '2K';
    return loadImageResolution();
  });

  const [videoRatio, setVideoRatio] = useState<string>(() => {
    if (typeof window === 'undefined') return 'adaptive';
    return loadVideoRatio();
  });
  const [videoDuration, setVideoDuration] = useState<number>(() => {
    if (typeof window === 'undefined') return 5;
    return loadVideoDuration();
  });
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return loadVideoGenerateAudio();
  });
  const [showVideoRatioDropdown, setShowVideoRatioDropdown] = useState(false);
  const [showVideoDurationDropdown, setShowVideoDurationDropdown] = useState(false);
  const [videoRatioDropdownPosition, setVideoRatioDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [videoDurationDropdownPosition, setVideoDurationDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const calcDropdownPosition = (
    anchorRect: DOMRect,
    menuWidth: number,
    menuHeight: number
  ) => {
    const margin = 8;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

    const width = Math.max(menuWidth, 160);
    const left = Math.min(Math.max(anchorRect.left, margin), Math.max(margin, viewportWidth - width - margin));

    const openDownTop = anchorRect.bottom + margin;
    const openUpTop = anchorRect.top - menuHeight - margin;
    const top =
      openDownTop + menuHeight <= viewportHeight - margin
        ? openDownTop
        : Math.max(margin, openUpTop);

    return { top, left, width };
  };

  const [modelOptions, setModelOptions] = useState<ConfiguredModel[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadModelSettings().models;
  });
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const { models, defaultModelByProvider, selectedModel } = loadModelSettings();
    return selectedModel || defaultModelByProvider.volcengine || models[0]?.apiModel || '';
  });

  useEffect(() => {
    const handler = () => {
      const { models, defaultModelByProvider, selectedModel } = loadModelSettings();
      setModelOptions(models);
      setSelectedModelId(prev => prev || selectedModel || defaultModelByProvider.volcengine || models[0]?.apiModel || '');
      setSelectedResolution(loadImageResolution());
      setVideoRatio(loadVideoRatio());
      setVideoDuration(loadVideoDuration());
      setVideoGenerateAudio(loadVideoGenerateAudio());
    };
    window.addEventListener('settingsUpdated', handler as any);
    return () => window.removeEventListener('settingsUpdated', handler as any);
  }, []);
  
  // Prompt模板相关状态
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [customTemplates, setCustomTemplates] = useState<Array<{id: string, name: string, content: string}>>([]);
  const [showVideoPreviewModal, setShowVideoPreviewModal] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoPreviewOriginalUrl, setVideoPreviewOriginalUrl] = useState('');
  const [videoPreviewPosterUrl, setVideoPreviewPosterUrl] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ videoUrl?: string; posterUrl?: string }>;
      const originalVideoUrl = customEvent.detail?.videoUrl;
      if (!originalVideoUrl) return;

      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const videoProxyBase = isLocalDev ? 'http://localhost:3000/video-proxy' : '/video-proxy';

      setVideoPreviewOriginalUrl(originalVideoUrl);
      setVideoPreviewUrl(`${videoProxyBase}?url=${encodeURIComponent(originalVideoUrl)}`);
      setVideoPreviewPosterUrl(customEvent.detail?.posterUrl || '');
      setShowVideoPreviewModal(true);
    };

    window.addEventListener('videoPreviewRequested', handler as any);
    return () => window.removeEventListener('videoPreviewRequested', handler as any);
  }, []);
  
  // 预设模板数据
  const presetTemplates = [
    { id: 'realistic-portrait', name: '写实人像', content: '高质量写实人像摄影，专业打光，细节丰富' },
    { id: 'cartoon-style', name: '卡通风格', content: '可爱卡通风格插画，色彩鲜艳，简洁线条' },
    { id: 'landscape-photo', name: '风景摄影', content: '壮丽自然风景，广角镜头，黄金时刻光线' },
    { id: 'abstract-art', name: '抽象艺术', content: '现代抽象艺术作品，几何图形，渐变色彩' },
    { id: 'tarot-card', name: '塔罗牌设计', content: '设计一张塔罗牌，用神秘学的象征手法来诠释[集体潜意识]。卡牌需要有经典的装饰性边框，中心是象征性的核心图像，底部有卡牌名称的罗马数字和标题以及中文描述。整体采用神秘、复古的版画风格，色彩象征意义丰富。' },
    { id: 'rpg-skill-card', name: 'RPG技能卡片', content: '设计一张幻想RPG游戏中的技能卡片，用文字和图像来解释经济学概念\'期货\'。有游戏化的技能名称，卡片上有酷炫的图标、技能描述（用游戏化的语言解释概念）、消耗的\'精力值\'和冷却时间。整体是暗黑奇幻风格，带有发光的魔法符文边框。' },
    { id: 'xianxia-guide', name: '仙侠古籍图鉴', content: '生成一张仙侠古籍图鉴风格的卡片，向宗门弟子介绍[电脑]。卡牌应采用水墨国风与工笔画相结合的画风，仙气缥缈，色彩淡雅。布局上，中心是主体的精细插图，旁边配有竖排的相对详细的楷体注释。卡牌四周应有祥云或卷草纹的古典边框，背景素净，有大量留白，整体质感如同一本传世秘籍中的一页。' },
    { id: 'modern-infographic', name: '现代信息图', content: '创作一张现代极简信息图（Infographic），向都市白领解释[番茄工作法]。图片应使用明亮、和谐的色块和简洁的扁平化图标，信息布局要遵循视觉引导，使用无衬线字体标注关键步骤或元素，有相对详细的文字介绍，整体风格要干净、有条理，类似于一个高端商业分析报告中的图表。' }
  ];

  // 加载自定义模板
  useEffect(() => {
    try {
      const saved = localStorage.getItem('drawnix-prompt-templates');
      if (saved) {
        const templates = JSON.parse(saved);
        setCustomTemplates(templates);
      }
    } catch (error) {
      console.warn('Failed to load custom templates:', error);
    }
  }, []);
  
  // 保存自定义模板到localStorage
  const saveCustomTemplates = (templates: Array<{id: string, name: string, content: string}>) => {
    try {
      localStorage.setItem('drawnix-prompt-templates', JSON.stringify(templates));
      setCustomTemplates(templates);
    } catch (error) {
      console.warn('Failed to save custom templates:', error);
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, with min and max constraints
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 120);
      textarea.style.height = `${newHeight}px`;
      // Show scrollbar if content exceeds max height
      textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showRatioDropdown && !(event.target as Element).closest('.ai-ratio-selector') && !(event.target as Element).closest('.ai-ratio-menu')) {
        setShowRatioDropdown(false);
      }
      if (showResolutionDropdown && !(event.target as Element).closest('.ai-resolution-selector') && !(event.target as Element).closest('.ai-resolution-menu')) {
        setShowResolutionDropdown(false);
      }
      if (showModelDropdown && !(event.target as Element).closest('.ai-model-selector') && !(event.target as Element).closest('.ai-model-menu')) {
        setShowModelDropdown(false);
      }
      if (showVideoRatioDropdown && !(event.target as Element).closest('.ai-video-ratio-selector') && !(event.target as Element).closest('.ai-video-ratio-menu')) {
        setShowVideoRatioDropdown(false);
      }
      if (showVideoDurationDropdown && !(event.target as Element).closest('.ai-video-duration-selector') && !(event.target as Element).closest('.ai-video-duration-menu')) {
        setShowVideoDurationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRatioDropdown, showResolutionDropdown, showModelDropdown, showVideoRatioDropdown, showVideoDurationDropdown]);

  // Close modals with Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAddTemplateModal) {
          setShowAddTemplateModal(false);
        } else if (showTemplateModal) {
          setShowTemplateModal(false);
        } else if (showCustomDimensionsModal) {
          setShowCustomDimensionsModal(false);
        } else if (showRatioDropdown) {
          setShowRatioDropdown(false);
        } else if (showResolutionDropdown) {
          setShowResolutionDropdown(false);
        } else if (showModelDropdown) {
          setShowModelDropdown(false);
        } else if (showVideoRatioDropdown) {
          setShowVideoRatioDropdown(false);
        } else if (showVideoDurationDropdown) {
          setShowVideoDurationDropdown(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCustomDimensionsModal, showRatioDropdown, showResolutionDropdown, showModelDropdown, showVideoRatioDropdown, showVideoDurationDropdown, showTemplateModal, showAddTemplateModal, showVideoPreviewModal]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('🚨 Enter键按下，inputValue:', inputValue, 'isSubmitting:', isSubmitting);
      e.preventDefault();
      if (inputValue.trim() && !isSubmitting) {
        console.log('🚨 调用handleFormSubmit...');
        handleFormSubmit(e as any);
      } else {
        console.log('🚨 不满足条件，不调用handleFormSubmit');
      }
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    console.warn('🚨 handleFormSubmit 被调用了！inputValue:', inputValue, 'isSubmitting:', isSubmitting);

    e.preventDefault();
    if (inputValue.trim() && !isSubmitting) {
      console.log('🚨 开始生成流程...');
      setIsSubmitting(true);

      const currentPrompt = inputValue.trim();
      setInputValue(''); // 立即清空输入框，允许输入下一个提示词
      
      // 检查是否有选中的图片元素（用于生成图片时参考尺寸）
      const selectedElements = getSelectedElements(board);
      const selectedImage = selectedElements.find(element =>
        (element as any).type === 'image' || (element as any).imageItem
      );

      let selectedImageWidth, selectedImageHeight;
      if (selectedImage) {
        const imageItem = (selectedImage as any).imageItem;
        if (imageItem) {
          selectedImageWidth = imageItem.width;
          selectedImageHeight = imageItem.height;
          console.log('🖼️ 检测到选中图片尺寸:', selectedImageWidth, 'x', selectedImageHeight);
        }
      }

      const options = {
        position: (typeof window !== 'undefined'
          ? toViewBoxPoint(board, toHostPoint(board, window.innerWidth / 2, window.innerHeight / 2))
          : ([400, 300] as [number, number])) as [number, number],
        spacing: 320,
        maxWidth: 300, // 占位符使用固定的最大宽度
        aspectRatio: selectedRatio, // 占位符使用用户选择的宽高比
        selectedImageWidth, // 传递选中图片尺寸供生成图片时参考
        selectedImageHeight,
        ...(selectedRatio === 'custom' && { customWidth, customHeight })
      };
      
      // 立即重置提交状态，允许下一次提交
      setIsSubmitting(false);

      // 异步执行图片生成，不阻塞UI
      (async () => {
        // 获取当前设置中的水印配置
        const getCurrentWatermarkSetting = () => {
          try {
            const saved = localStorage.getItem('drawnix-settings');
            if (saved) {
              const parsed = JSON.parse(saved);
              return parsed.watermarkEnabled !== undefined ? parsed.watermarkEnabled : true;
            }
          } catch (error) {
            console.warn('Failed to load watermark setting:', error);
          }
          return true; // 默认启用水印
        };

        const selectedModelConfig = modelOptions.find(m => m.apiModel === selectedModelId);
        if (selectedModelConfig?.type === 'video') {
          try {
            let placeholders: PlaitElement[] = [];
            try {
              placeholders = await createImagePlaceholders(board, { ...options, count: 1 });
            } catch (error) {
              console.error('🚀 [DEBUG] createImagePlaceholders(video) 抛出错误:', error);
              return;
            }

            const imageUrls: string[] = [];
            for (const file of uploadedImages) {
              const dataUrl = await convertFileToDataURL(file);
              imageUrls.push(dataUrl);
            }

            const api = createImageGenerationAPI({
              provider: selectedModelConfig.provider,
              model: selectedModelConfig.apiModel,
            });

            const videoResult = await api.generateVideo({
              prompt: currentPrompt,
              imageUrl: imageUrls[0],
              ratio: videoRatio,
              duration: videoDuration,
              generateAudio: videoGenerateAudio,
              watermark: getCurrentWatermarkSetting(),
              provider: selectedModelConfig.provider,
              model: selectedModelConfig.apiModel,
            });

            if (videoResult.error) {
              throw new Error(videoResult.error);
            }

            if (placeholders[0] && videoResult.lastFrameUrl) {
              await replacePlaceholderWithImage(
                board,
                placeholders[0],
                { index: 0, url: videoResult.lastFrameUrl, size: 'unknown' } as any,
                { ...options, extraNodeProps: { videoUrl: videoResult.videoUrl || '' } }
              );
            }

            if (videoResult.videoUrl) {
              const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              const videoProxyBase = isLocalDev ? 'http://localhost:3000/video-proxy' : '/video-proxy';
              const imageProxyBase = isLocalDev ? 'http://localhost:3000/image-proxy' : '/image-proxy';
              setVideoPreviewOriginalUrl(videoResult.videoUrl);
              setVideoPreviewUrl(`${videoProxyBase}?url=${encodeURIComponent(videoResult.videoUrl)}`);
              setVideoPreviewPosterUrl(
                videoResult.lastFrameUrl
                  ? `${imageProxyBase}?url=${encodeURIComponent(videoResult.lastFrameUrl)}`
                  : ''
              );
              setShowVideoPreviewModal(true);
            } else {
              alert(`视频任务完成${videoResult.taskId ? `：${videoResult.taskId}` : ''}`);
            }

            if (onSubmit) {
              onSubmit(currentPrompt);
            }
          } catch (error) {
            console.error('Video generation error:', error);
            alert(`视频生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
          }
          return;
        }

        console.error('🚀 [DEBUG] 准备调用 createImagePlaceholders, board:', board, 'options:', options);
        console.error('🚀 [DEBUG] board类型:', typeof board, 'board是否null:', board === null);

        let placeholders: PlaitElement[] = [];
        try {
          placeholders = await createImagePlaceholders(board, { ...options, count: 1 });
          console.error('🚀 [DEBUG] createImagePlaceholders 返回了:', placeholders);
        } catch (error) {
          console.error('🚀 [DEBUG] createImagePlaceholders 抛出错误:', error);
          return; // 如果创建占位符失败，直接返回
        }

        try {
          // 转换上传的图片为 data URLs
          const imageUrls: string[] = [];
          for (const file of uploadedImages) {
            const dataUrl = await convertFileToDataURL(file);
            imageUrls.push(dataUrl);
          }

        // Call image generation API  
        const pixelSize = convertAspectRatioToPixelSize(selectedRatio, selectedResolution);
        console.log('Selected ratio:', selectedRatio, 'Converted to pixel size:', pixelSize);

        const api = createImageGenerationAPI({
           provider: selectedModelConfig?.provider,
           model: selectedModelConfig?.apiModel
        });
        
        const result = await api.generateImages(
          {
            prompt: currentPrompt,
            maxImages: 1,
            size: pixelSize,
            watermark: getCurrentWatermarkSetting(),
            ...(imageUrls.length > 0 && { image: imageUrls }),
            provider: selectedModelConfig?.provider,
            model: selectedModelConfig?.apiModel
          },
          // 进度回调：每生成一张图片就替换对应的占位符
          (imageResult) => {
            console.log('🔄 收到图片生成结果:', imageResult);
            console.log('🔄 当前占位符数组:', placeholders);
            
            if (placeholders[imageResult.index]) {
              console.log('🔄 开始替换占位符', imageResult.index);
              replacePlaceholderWithImage(
                board, 
                placeholders[imageResult.index], 
                imageResult, 
                options
              ).catch(error => {
                console.error(`❌ 替换占位符 ${imageResult.index} 失败:`, error);
              });
            } else {
              console.error('❌ 占位符索引', imageResult.index, '不存在！');
            }
          }
        );
        
        if (result.error) {
          throw new Error(result.error);
        }

          if (onSubmit) {
            onSubmit(currentPrompt);
          }

        } catch (error) {
          console.error('Image generation error:', error);
          alert(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`);

          // 清理占位符
          try {
            const { CoreTransforms } = await import('@plait/core');
            CoreTransforms.removeElements(board, placeholders);
          } catch (cleanupError) {
            console.error('Failed to cleanup placeholders:', cleanupError);
          }
        }
      })(); // 立即执行异步函数
    }
  };

  const handleInputChangeLocal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    // 限制最多10张图片
    const limitedFiles = validFiles.slice(0, 10 - uploadedImages.length);
    setUploadedImages(prev => [...prev, ...limitedFiles].slice(0, 10));
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const convertFileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };
  
  // 模板相关处理函数
  const handleTemplateSelect = (template: {id: string, name: string, content: string}) => {
    setInputValue(template.content);
    setShowTemplateModal(false);
  };
  
  const handleAddTemplate = () => {
    if (newTemplateName.trim() && newTemplateContent.trim()) {
      const newTemplate = {
        id: Date.now().toString(),
        name: newTemplateName.trim(),
        content: newTemplateContent.trim()
      };
      const updatedTemplates = [...customTemplates, newTemplate];
      saveCustomTemplates(updatedTemplates);
      setNewTemplateName('');
      setNewTemplateContent('');
      setShowAddTemplateModal(false);
    }
  };
  
  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
    saveCustomTemplates(updatedTemplates);
  };

  // 将宽高比转换为2K分辨率的具体像素尺寸
  const convertAspectRatioToPixelSize = (aspectRatio: string, resolution: '1K' | '2K' | '4K'): string => {
    if (aspectRatio === 'auto') {
      return resolution; // 让AI自动决定
    }
    
    if (aspectRatio === 'custom') {
      // 使用自定义尺寸，确保是8的倍数
      let width = Math.round(customWidth / 8) * 8;
      let height = Math.round(customHeight / 8) * 8;
      
      // 检查最小像素要求 (3,686,400)
      const minPixels = 3686400;
      const currentPixels = width * height;
      if (currentPixels < minPixels) {
        const scale = Math.sqrt(minPixels / currentPixels);
        width = Math.round(width * scale * 1.01);
        height = Math.round(height * scale * 1.01);
        
        // 再次确保是8的倍数
        width = Math.round(width / 8) * 8;
        height = Math.round(height / 8) * 8;
      }
      
      return `${width}x${height}`;
    }
    
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
    if (!widthRatio || !heightRatio) {
      return '2K';
    }
    
    const baseResolution = resolution === '4K' ? 4096 : resolution === '1K' ? 1280 : 2240;
    let width: number, height: number;
    
    if (widthRatio >= heightRatio) {
      // 横版或正方形：长边为 baseResolution
      width = baseResolution;
      height = Math.round((heightRatio / widthRatio) * baseResolution);
    } else {
      // 竖版：短边基于长边计算
      // 修正逻辑：确保长边为 baseResolution
      height = baseResolution;
      width = Math.round((widthRatio / heightRatio) * baseResolution);
    }
    
    const minPixels = 3686400;
    const currentPixels = width * height;
    if (currentPixels < minPixels) {
      const selectedModelConfig = modelOptions.find(m => m.apiModel === selectedModelId);
      const requiresMinPixels = selectedModelConfig?.apiModel === 'doubao-seedream-4-5-251128';
      if (!requiresMinPixels) {
        width = Math.round(width / 8) * 8;
        height = Math.round(height / 8) * 8;
        return `${width}x${height}`;
      }
      const scale = Math.sqrt(minPixels / currentPixels);
      // 稍微多一点余量，避免四舍五入导致刚好小于
      width = Math.round(width * scale * 1.01);
      height = Math.round(height * scale * 1.01);
    }
    
    // 确保像素值是8的倍数（AI生成图片的常见要求）
    width = Math.round(width / 8) * 8;
    height = Math.round(height / 8) * 8;
    
    return `${width}x${height}`;
  };

  const aspectRatios = [
    { label: '智能', value: 'auto' },
    { label: '21:9', value: '21:9' },
    { label: '16:9', value: '16:9' },
    { label: '3:2', value: '3:2' },
    { label: '4:3', value: '4:3' },
    { label: '1:1', value: '1:1' },
    { label: '3:4', value: '3:4' },
    { label: '2:3', value: '2:3' },
    { label: '9:16', value: '9:16' },
    { label: '自定义', value: 'custom' },
  ];

  const selectedModelConfig = modelOptions.find(m => m.apiModel === selectedModelId);
  const isVideoModel = selectedModelConfig?.type === 'video';

  const resolutionOptions = [
    { label: '1K', value: '1K' as const, disabled: selectedModelConfig?.apiModel === 'doubao-seedream-4-5-251128' },
    { label: '2K', value: '2K' as const, disabled: false },
    { label: '4K', value: '4K' as const, disabled: false },
  ];

  const videoRatioOptions = [
    { label: '智能', value: 'adaptive' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '1:1', value: '1:1' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
  ];

  const videoDurationOptions = [
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
  ];

  return (
    <div className={classNames('ai-input-container', className)}>
      <div className="ai-input-card">
        <form onSubmit={handleFormSubmit} className="ai-input-form">
          {/* 1. 图片预览区域 (如果有) */}
          {uploadedImages.length > 0 && (
            <div className="ai-images-preview">
              <div className="ai-images-grid">
                {uploadedImages.map((file, index) => (
                  <div key={index} className="ai-image-item">
                    <div className="ai-image-wrapper">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={`参考图片 ${index + 1}`}
                        className="ai-image"
                      />
                      <button
                        type="button"
                        className="ai-image-remove"
                        onClick={() => removeImage(index)}
                        aria-label="删除图片"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 文本输入区域 */}
          <div className="ai-input-body">
            <textarea
              ref={textareaRef}
              className={classNames('ai-input-field', {
                'ai-input-field--focused': isExpanded
              })}
              value={inputValue}
              onChange={handleInputChangeLocal}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsExpanded(true)}
              placeholder="描述你想要生成的图片..."
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '200px',
                height: 'auto'
              }}
              aria-label={placeholder}
            />
          </div>

          {/* 3. 底部工具栏 */}
          <div className="ai-input-footer">
            <div className="ai-input-tools-left">
              {/* 图片上传 */}
              <div className="ai-upload-section">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="ai-file-input"
                  disabled={uploadedImages.length >= 10}
                  id="ai-file-upload"
                  style={{ display: 'none' }}
                />
                <button 
                  type="button"
                  className={classNames('ai-tool-btn', {
                    'ai-tool-btn--active': uploadedImages.length > 0,
                    'ai-tool-btn--disabled': uploadedImages.length >= 10
                  })}
                  onClick={() => document.getElementById('ai-file-upload')?.click()}
                  disabled={uploadedImages.length >= 10}
                  title={uploadedImages.length >= 10 ? "已达图片上传上限" : "上传参考图片"}
                >
                  <Image size={18} strokeWidth={1.5} />
                  {uploadedImages.length > 0 && (
                    <span className="ai-upload-badge">{uploadedImages.length}</span>
                  )}
                </button>
              </div>

              {/* 模型选择 */}
              <div className="ai-model-selector">
                <button
                  type="button"
                  className={classNames('ai-tool-btn ai-model-btn', {
                    'ai-tool-btn--open': showModelDropdown
                  })}
                  onClick={(e) => {
                    if (!showModelDropdown) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const itemHeight = 44;
                      const maxHeight = 300;
                      const estimatedHeight = Math.min(
                        maxHeight,
                        modelOptions.length * itemHeight + 12
                      );
                      setModelDropdownPosition(
                        calcDropdownPosition(rect, Math.max(rect.width, 160), estimatedHeight)
                      );
                    }
                    setShowModelDropdown(!showModelDropdown);
                  }}
                  title="选择模型"
                >
                  <Box size={18} strokeWidth={1.5} className="ai-btn-icon" />
                  <span className="ai-btn-text">
                    {modelOptions.find(m => m.apiModel === selectedModelId)?.displayName || '模型'}
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    className="ai-chevron-icon"
                  />
                </button>
              </div>

              {/* 比例选择 - 仅图片模型显示 */}
              {!isVideoModel && (
                <div className="ai-ratio-selector">
                  <button 
                    ref={ratioButtonRef}
                    type="button"
                    className={classNames('ai-tool-btn ai-ratio-btn', {
                      'ai-tool-btn--open': showRatioDropdown
                    })}
                    onClick={() => {
                      if (!showRatioDropdown && ratioButtonRef.current) {
                        const rect = ratioButtonRef.current.getBoundingClientRect();
                        const itemHeight = 40;
                        const maxHeight = 300;
                        const estimatedHeight = Math.min(
                          maxHeight,
                          aspectRatios.length * itemHeight + 12
                        );
                        setDropdownPosition(calcDropdownPosition(rect, rect.width, estimatedHeight));
                      }
                      setShowRatioDropdown(!showRatioDropdown);
                    }}
                    title="选择图片比例"
                  >
                    <span className="ai-btn-text">
                      {selectedRatio === 'custom' 
                        ? `${customWidth}×${customHeight}`
                        : aspectRatios.find(r => r.value === selectedRatio)?.label || '3:4'
                      }
                    </span>
                    <ChevronDown 
                      size={14} 
                      strokeWidth={1.5}
                      className="ai-chevron-icon"
                    />
                  </button>
                </div>
              )}

              {/* 分辨率选择 - 仅图片模型显示 */}
              {!isVideoModel && (
                <div className="ai-resolution-selector">
                  <button
                    ref={resolutionButtonRef}
                    type="button"
                    className={classNames('ai-tool-btn ai-ratio-btn', {
                      'ai-tool-btn--open': showResolutionDropdown
                    })}
                    onClick={() => {
                      if (!showResolutionDropdown && resolutionButtonRef.current) {
                        const rect = resolutionButtonRef.current.getBoundingClientRect();
                        const itemHeight = 40;
                        const maxHeight = 220;
                        const estimatedHeight = Math.min(
                          maxHeight,
                          resolutionOptions.length * itemHeight + 12
                        );
                        setResolutionDropdownPosition(calcDropdownPosition(rect, rect.width, estimatedHeight));
                      }
                      setShowResolutionDropdown(!showResolutionDropdown);
                    }}
                    title="选择分辨率"
                  >
                    <span className="ai-btn-text">{selectedResolution}</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className="ai-chevron-icon"
                    />
                  </button>
                </div>
              )}

              {/* 视频比例选择 - 仅视频模型显示 */}
              {isVideoModel && (
                <div className="ai-video-ratio-selector">
                  <button
                    type="button"
                    className={classNames('ai-tool-btn ai-ratio-btn', {
                      'ai-tool-btn--open': showVideoRatioDropdown
                    })}
                    onClick={(e) => {
                      if (!showVideoRatioDropdown) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const itemHeight = 40;
                        const maxHeight = 300;
                        const estimatedHeight = Math.min(
                          maxHeight,
                          videoRatioOptions.length * itemHeight + 12
                        );
                        setVideoRatioDropdownPosition(calcDropdownPosition(rect, rect.width, estimatedHeight));
                      }
                      setShowVideoRatioDropdown(!showVideoRatioDropdown);
                    }}
                    title="选择视频比例"
                  >
                    <span className="ai-btn-text">
                      {videoRatioOptions.find(r => r.value === videoRatio)?.label || '智能'}
                    </span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className="ai-chevron-icon"
                    />
                  </button>
                </div>
              )}

              {/* 视频时长选择 - 仅视频模型显示 */}
              {isVideoModel && (
                <div className="ai-video-duration-selector">
                  <button
                    type="button"
                    className={classNames('ai-tool-btn ai-ratio-btn', {
                      'ai-tool-btn--open': showVideoDurationDropdown
                    })}
                    onClick={(e) => {
                      if (!showVideoDurationDropdown) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const itemHeight = 40;
                        const maxHeight = 220;
                        const estimatedHeight = Math.min(
                          maxHeight,
                          videoDurationOptions.length * itemHeight + 12
                        );
                        setVideoDurationDropdownPosition(calcDropdownPosition(rect, rect.width, estimatedHeight));
                      }
                      setShowVideoDurationDropdown(!showVideoDurationDropdown);
                    }}
                    title="选择视频时长"
                  >
                    <span className="ai-btn-text">{videoDuration}s</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className="ai-chevron-icon"
                    />
                  </button>
                </div>
              )}

              {/* 生成音频开关 - 仅视频模型显示 */}
              {isVideoModel && (
                <button
                  type="button"
                  className={classNames('ai-tool-btn', {
                    'ai-tool-btn--active': videoGenerateAudio
                  })}
                  onClick={() => {
                    const newValue = !videoGenerateAudio;
                    setVideoGenerateAudio(newValue);
                    persistVideoGenerateAudio(newValue);
                  }}
                  title={videoGenerateAudio ? "已启用音频生成" : "启用音频生成"}
                >
                  <span className="ai-btn-text">音频</span>
                </button>
              )}

              {/* Prompt模板按钮 */}
              <button
                type="button"
                className="ai-tool-btn"
                onClick={() => setShowTemplateModal(true)}
                title="选择Prompt模板"
              >
                <BookOpen size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="ai-input-tools-right">
              {/* 生成按钮 */}
              <button
                type="submit"
                className={classNames('ai-send-btn', { 
                  'ai-send-btn--disabled': !inputValue.trim()
                })}
                disabled={!inputValue.trim()}
                title="开始创作 (⏎)"
              >
                <Send className="ai-send-icon" size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
        </form>
      </div>
      {showRatioDropdown && createPortal(
        <div 
          className="ai-ratio-menu"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              className={classNames('ai-ratio-item', {
                'ai-ratio-item--selected': ratio.value === selectedRatio
              })}
              onClick={() => {
                if (ratio.value === 'custom') {
                  setShowCustomDimensionsModal(true);
                } else {
                  setSelectedRatio(ratio.value);
                }
                setShowRatioDropdown(false);
              }}
            >
              {ratio.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {showResolutionDropdown && createPortal(
        <div
          className="ai-ratio-menu ai-resolution-menu"
          style={{
            position: 'fixed',
            top: resolutionDropdownPosition.top,
            left: resolutionDropdownPosition.left,
            width: resolutionDropdownPosition.width,
            zIndex: 9999,
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {resolutionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames('ai-ratio-item', {
                'ai-ratio-item--selected': option.value === selectedResolution
              })}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return;
                setSelectedResolution(option.value);
                persistImageResolution(option.value);
                setShowResolutionDropdown(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {showModelDropdown && createPortal(
         <div
           className="ai-ratio-menu ai-model-menu"
           style={{
             position: 'fixed',
             top: modelDropdownPosition.top,
             left: modelDropdownPosition.left,
             width: modelDropdownPosition.width,
             zIndex: 9999,
             maxHeight: '300px',
             overflowY: 'auto'
           }}
         >
           {modelOptions.map((model) => (
             <button
               key={`${model.provider}-${model.apiModel}`}
               type="button"
               className={classNames('ai-ratio-item', {
                 'ai-ratio-item--selected': model.apiModel === selectedModelId
               })}
               onClick={() => {
                 setSelectedModelId(model.apiModel);
                 persistSelectedModel(model.apiModel);
                 setShowModelDropdown(false);
               }}
             >
               <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                 <span style={{ fontSize: '13px', fontWeight: 500 }}>{model.displayName || model.apiModel}</span>
                 <span style={{ fontSize: '11px', opacity: 0.7 }}>{model.apiModel}</span>
               </div>
             </button>
           ))}
         </div>,
         document.body
       )}
      {showVideoRatioDropdown && createPortal(
        <div
          className="ai-ratio-menu ai-video-ratio-menu"
          style={{
            position: 'fixed',
            top: videoRatioDropdownPosition.top,
            left: videoRatioDropdownPosition.left,
            width: videoRatioDropdownPosition.width,
            zIndex: 9999,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {videoRatioOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames('ai-ratio-item', {
                'ai-ratio-item--selected': option.value === videoRatio
              })}
              onClick={() => {
                setVideoRatio(option.value);
                persistVideoRatio(option.value);
                setShowVideoRatioDropdown(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {showVideoDurationDropdown && createPortal(
        <div
          className="ai-ratio-menu ai-video-duration-menu"
          style={{
            position: 'fixed',
            top: videoDurationDropdownPosition.top,
            left: videoDurationDropdownPosition.left,
            width: videoDurationDropdownPosition.width,
            zIndex: 9999,
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {videoDurationOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames('ai-ratio-item', {
                'ai-ratio-item--selected': option.value === videoDuration
              })}
              onClick={() => {
                setVideoDuration(option.value);
                persistVideoDuration(option.value);
                setShowVideoDurationDropdown(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {showCustomDimensionsModal && createPortal(
        <div className="ai-custom-dimensions-overlay">
          <div className="ai-custom-dimensions-modal">
            <div className="ai-custom-dimensions-header">
              <h3>输入自定义尺寸</h3>
              <button
                type="button"
                className="ai-custom-dimensions-close"
                onClick={() => setShowCustomDimensionsModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="ai-custom-dimensions-content">
              {/* 尺寸输入区域 */}
              <div className="ai-dimensions-wrapper">
                <div className="ai-dimensions-header">
                  <span className="ai-dimensions-title">图片尺寸</span>
                  <button 
                    type="button" 
                    className="ai-swap-dimensions"
                    onClick={() => {
                      const temp = customWidth;
                      setCustomWidth(customHeight);
                      setCustomHeight(temp);
                    }}
                    title="交换宽高"
                  >
                    ↔
                  </button>
                </div>
                
                <div className="ai-dimensions-inputs">
                  <div className="ai-dimension-field">
                    <label htmlFor="customWidth">宽度</label>
                    <div className="ai-input-with-unit">
                      <input
                        id="customWidth"
                        type="number"
                        min="64"
                        max="4096"
                        value={customWidth || ''}
                        onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value) || 64;
                          const clampedValue = Math.max(64, Math.min(4096, value));
                          const adjustedValue = Math.round(clampedValue / 8) * 8;
                          setCustomWidth(adjustedValue);
                        }}
                        className="ai-dimension-input"
                        placeholder="宽度"
                      />
                      <span className="ai-input-unit">px</span>
                    </div>
                  </div>
                  
                  <div className="ai-dimensions-separator">×</div>
                  
                  <div className="ai-dimension-field">
                    <label htmlFor="customHeight">高度</label>
                    <div className="ai-input-with-unit">
                      <input
                        id="customHeight"
                        type="number"
                        min="64"
                        max="4096"
                        value={customHeight || ''}
                        onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value) || 64;
                          const clampedValue = Math.max(64, Math.min(4096, value));
                          const adjustedValue = Math.round(clampedValue / 8) * 8;
                          setCustomHeight(adjustedValue);
                        }}
                        className="ai-dimension-input"
                        placeholder="高度"
                      />
                      <span className="ai-input-unit">px</span>
                    </div>
                  </div>
                </div>
                
                {/* 比例显示 */}
                <div className="ai-ratio-display">
                  <span className="ai-ratio-text">
                    比例: {customWidth && customHeight ? 
                      (() => {
                        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                        const divisor = gcd(customWidth, customHeight);
                        return `${customWidth / divisor}:${customHeight / divisor}`;
                      })()
                      : '--:--'
                    }
                  </span>
                </div>
              </div>
              
            </div>
            
            <div className="ai-custom-dimensions-actions">
              <button
                type="button"
                className="ai-custom-dimensions-cancel"
                onClick={() => setShowCustomDimensionsModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="ai-custom-dimensions-confirm"
                onClick={() => {
                  setSelectedRatio('custom');
                  setShowCustomDimensionsModal(false);
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Prompt模板弹窗 */}
      {showTemplateModal && createPortal(
        <div className="ai-template-overlay">
          <div className="ai-template-modal">
            <div className="ai-template-header">
              <h3>选择Prompt模板</h3>
              <button
                type="button"
                className="ai-template-close"
                onClick={() => setShowTemplateModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="ai-template-content">
              {/* 预设模板 */}
              <div className="ai-template-section">
                <h4>预设模板</h4>
                <div className="ai-template-list">
                  {presetTemplates.map((template, index) => (
                    <div key={index} className="ai-template-item">
                      <button
                        type="button"
                        className="ai-template-btn-item"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <div className="ai-template-name">{template.name}</div>
                        <div className="ai-template-preview">{template.content}</div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 自定义模板 */}
              <div className="ai-template-section">
                <div className="ai-template-section-header">
                  <h4>自定义模板</h4>
                  <button
                    type="button"
                    className="ai-template-add-btn"
                    onClick={() => setShowAddTemplateModal(true)}
                    title="新增模板"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="ai-template-list">
                  {customTemplates.map((template, index) => (
                    <div key={index} className="ai-template-item">
                      <button
                        type="button"
                        className="ai-template-btn-item"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <div className="ai-template-name">{template.name}</div>
                        <div className="ai-template-preview">{template.content}</div>
                      </button>
                      <button
                        type="button"
                        className="ai-template-delete-btn"
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="删除模板"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {customTemplates.length === 0 && (
                    <div className="ai-template-empty">
                      暂无自定义模板，点击右上角 + 号添加
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* 新增模板弹窗 */}
      {showAddTemplateModal && createPortal(
        <div className="ai-add-template-overlay">
          <div className="ai-add-template-modal">
            <div className="ai-add-template-header">
              <h3>新增Prompt模板</h3>
              <button
                type="button"
                className="ai-add-template-close"
                onClick={() => {
                  setShowAddTemplateModal(false);
                  setNewTemplateName('');
                  setNewTemplateContent('');
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="ai-add-template-content">
              <div className="ai-add-template-field">
                <label htmlFor="templateName">模板名称</label>
                <input
                  id="templateName"
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="请输入模板名称"
                  className="ai-add-template-input"
                  maxLength={50}
                />
              </div>
              
              <div className="ai-add-template-field">
                <label htmlFor="templateContent">模板内容</label>
                <textarea
                  id="templateContent"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder="请输入Prompt模板内容"
                  className="ai-add-template-textarea"
                  rows={6}
                  maxLength={500}
                />
                <div className="ai-add-template-counter">
                  {newTemplateContent.length}/500
                </div>
              </div>
            </div>
            
            <div className="ai-add-template-actions">
              <button
                type="button"
                className="ai-add-template-cancel"
                onClick={() => {
                  setShowAddTemplateModal(false);
                  setNewTemplateName('');
                  setNewTemplateContent('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="ai-add-template-confirm"
                onClick={handleAddTemplate}
                disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showVideoPreviewModal && createPortal(
        <div className="ai-video-preview-overlay">
          <div className="ai-video-preview-modal">
            <div className="ai-video-preview-header">
              <h3>视频预览</h3>
              <button
                type="button"
                className="ai-video-preview-close"
                onClick={() => {
                  setShowVideoPreviewModal(false);
                  setVideoPreviewUrl('');
                  setVideoPreviewOriginalUrl('');
                  setVideoPreviewPosterUrl('');
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="ai-video-preview-content">
              <VideoPlayer
                src={videoPreviewUrl}
                poster={videoPreviewPosterUrl || undefined}
                videoStyle={{ maxHeight: '70vh' }}
              />
              <div className="ai-video-preview-actions">
                <a
                  href={videoPreviewOriginalUrl || videoPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ai-video-preview-link"
                >
                  在新窗口打开
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AIInput;
