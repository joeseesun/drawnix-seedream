import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import type { PlaitBoard, PlaitElement } from '@plait/core';
import type { ConfiguredModel } from '../../utils/image-generation';
import { loadModelSettings, persistSelectedModel } from '../../utils/image-generation';
import './video-from-image-dialog.scss';

export interface VideoFromImageDialogProps {
  board: PlaitBoard;
  targetImage: PlaitElement;
  position: { x: number; y: number };
  onClose: () => void;
  onSubmit: (params: {
    prompt: string;
    ratio: string;
    duration: number;
    generateAudio: boolean;
    model: ConfiguredModel | null;
  }) => Promise<void>;
}

export const VideoFromImageDialog: React.FC<VideoFromImageDialogProps> = ({
  board,
  targetImage,
  position,
  onClose,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [videoModels, setVideoModels] = useState<ConfiguredModel[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadModelSettings().models.filter(m => m.type === 'video');
  });

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const { models, selectedModel } = loadModelSettings();
    const video = models.filter(m => m.type === 'video');
    if (video.some(m => m.apiModel === selectedModel)) return selectedModel;
    return video[0]?.apiModel || '';
  });

  const selectedModel = useMemo(
    () => videoModels.find(m => m.apiModel === selectedModelId) || null,
    [videoModels, selectedModelId]
  );

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const { models, selectedModel } = loadModelSettings();
      const video = models.filter(m => m.type === 'video');
      setVideoModels(video);
      setSelectedModelId(prev => {
        if (prev && video.some(m => m.apiModel === prev)) return prev;
        if (selectedModel && video.some(m => m.apiModel === selectedModel)) return selectedModel;
        return video[0]?.apiModel || '';
      });
    };
    window.addEventListener('settingsUpdated', handler as any);
    return () => window.removeEventListener('settingsUpdated', handler as any);
  }, []);

  const [ratio, setRatio] = useState('adaptive');
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);

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
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [prompt, ratio, duration, generateAudio, selectedModelId, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dialogElement = document.querySelector('.video-from-image-dialog');
      if (dialogElement && !dialogElement.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await onSubmit({
        prompt: prompt.trim(),
        ratio,
        duration,
        generateAudio,
        model: selectedModel,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="video-from-image-dialog"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <button
        className="video-from-image-dialog__close"
        onClick={onClose}
        disabled={isLoading}
        aria-label="关闭"
      >
        <X size={14} />
      </button>

      <div className="video-from-image-dialog__meta" aria-hidden="true">
        基于图片生成视频
      </div>

      <div className="video-from-image-dialog__row">
        <select
          className="video-from-image-dialog__select"
          value={selectedModelId}
          disabled={isLoading}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedModelId(next);
            persistSelectedModel(next);
          }}
        >
          {videoModels.map(model => (
            <option key={`${model.provider}:${model.apiModel}`} value={model.apiModel}>
              {model.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="video-from-image-dialog__row video-from-image-dialog__row--split">
        <label className="video-from-image-dialog__label">
          <span className="video-from-image-dialog__label-text">比例</span>
          <select
            className="video-from-image-dialog__select"
            value={ratio}
            disabled={isLoading}
            onChange={(e) => setRatio(e.target.value)}
          >
            <option value="adaptive">智能</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>
        </label>
        <label className="video-from-image-dialog__label">
          <span className="video-from-image-dialog__label-text">时长</span>
          <select
            className="video-from-image-dialog__select"
            value={duration}
            disabled={isLoading}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
          </select>
        </label>
      </div>

      <div className="video-from-image-dialog__row">
        <label className="video-from-image-dialog__checkbox">
          <input
            type="checkbox"
            checked={generateAudio}
            disabled={isLoading}
            onChange={(e) => setGenerateAudio(e.target.checked)}
          />
          生成音频
        </label>
      </div>

      <div className="video-from-image-dialog__input-group">
        <input
          ref={inputRef}
          type="text"
          className="video-from-image-dialog__input"
          placeholder="描述你想生成的视频效果"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        <button
          className="video-from-image-dialog__submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? (
            <div className="video-from-image-dialog__loading">
              <div className="video-from-image-dialog__spinner" />
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

