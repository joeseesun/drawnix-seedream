import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { PlaitElement, PlaitBoard } from '@plait/core';
import './image-to-image-dialog.scss';
import { ConfiguredModel, loadImageResolution, loadModelSettings, persistImageResolution, persistSelectedModel } from '../../utils/image-generation';

export interface ImageToImageDialogProps {
  board: PlaitBoard;
  selectedImages: PlaitElement[];
  position: { x: number; y: number };
  mode?: 'append' | 'replace';
  onClose: () => void;
  onSubmit: (
    prompt: string,
    images: PlaitElement[],
    mode: 'append' | 'replace'
  ) => Promise<void>;
}

export const ImageToImageDialog: React.FC<ImageToImageDialogProps> = ({
  board,
  selectedImages,
  position,
  mode = 'append',
  onClose,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelOptions, setModelOptions] = useState<ConfiguredModel[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadModelSettings().models.filter(m => m.type === 'image');
  });
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const { models, defaultModelByProvider, selectedModel } = loadModelSettings();
    const imageModels = models.filter(m => m.type === 'image');
    return selectedModel || defaultModelByProvider.volcengine || imageModels[0]?.apiModel || '';
  });
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>(() => {
    if (typeof window === 'undefined') return '2K';
    return loadImageResolution();
  });

  useEffect(() => {
    const handler = () => {
      const { models, defaultModelByProvider, selectedModel } = loadModelSettings();
      const imageModels = models.filter(m => m.type === 'image');
      setModelOptions(imageModels);
      setSelectedModelId(prev => prev || selectedModel || defaultModelByProvider.volcengine || imageModels[0]?.apiModel || '');
      setSelectedResolution(loadImageResolution());
    };
    window.addEventListener('settingsUpdated', handler as any);
    return () => window.removeEventListener('settingsUpdated', handler as any);
  }, []);

  // 自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [prompt, onClose]);

  // 处理点击外部区域关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dialogElement = document.querySelector('.image-to-image-dialog');
      if (dialogElement && !dialogElement.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await onSubmit(prompt.trim(), selectedImages, mode);
    } catch (error) {
      console.error('图生图提交失败:', error);
    } finally {
      // 重置loading状态，以便下次使用
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  return createPortal(
    <div
      className="image-to-image-dialog"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <button
        className="image-to-image-dialog__close"
        onClick={onClose}
        disabled={isLoading}
        aria-label="关闭"
      >
        <X size={14} />
      </button>

      <div className="image-to-image-dialog__meta" aria-hidden="true">
        {mode === 'replace' ? '修改选中图片' : '基于选中图片继续生成'}
      </div>

      <div className="image-to-image-dialog__row">
        <select
          className="image-to-image-dialog__select"
          value={selectedModelId}
          disabled={isLoading}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedModelId(next);
            persistSelectedModel(next);
          }}
        >
          {modelOptions.map(model => (
            <option key={`${model.provider}:${model.apiModel}`} value={model.apiModel}>
              {model.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="image-to-image-dialog__row">
        <select
          className="image-to-image-dialog__select"
          value={selectedResolution}
          disabled={isLoading}
          onChange={(e) => {
            const next = e.target.value as any;
            setSelectedResolution(next);
            persistImageResolution(next);
          }}
        >
          <option value="1K" disabled={selectedModelId === 'doubao-seedream-4-5-251128'}>1K</option>
          <option value="2K">2K</option>
          <option value="4K">4K</option>
        </select>
      </div>

      <div className="image-to-image-dialog__input-group">
        <input
          ref={inputRef}
          type="text"
          className="image-to-image-dialog__input"
          placeholder={mode === 'replace' ? '描述你想怎么改这张图' : '输入你的提示词'}
          value={prompt}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          className="image-to-image-dialog__submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? (
            <div className="image-to-image-dialog__loading">
              <div className="image-to-image-dialog__spinner" />
            </div>
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>,
    document.body
  );
};
