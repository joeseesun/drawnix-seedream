import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImageProps } from '@plait/common';
import { CoreTransforms, getSelectedElements } from '@plait/core';
import classNames from 'classnames';
import { Play, Sparkles, Video, Wand2 } from 'lucide-react';
import { downloadUrl, getProxyUrl } from '../../utils/download';

export const Image: React.FC<ImageProps> = (props: ImageProps) => {
  const videoUrl = (props.element as any)?.videoUrl as string | undefined;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const imgProps = {
    src: props.imageItem.url,
    draggable: false,
    width: '100%',
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleMouseDown = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  return (
    <div
      className={classNames('image-origin-wrapper', {
        'image-origin-wrapper--video': Boolean(videoUrl),
      })}
      ref={wrapperRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const width = 180;
        const height = videoUrl ? 130 : 92;
        const x = Math.max(8, Math.min(e.clientX, window.innerWidth - width - 8));
        const y = Math.max(8, Math.min(e.clientY, window.innerHeight - height - 8));
        setContextMenu({ x, y });
      }}
    >
      <img
        {...imgProps}
        onClick={() => {
          if (!videoUrl || !props.isFocus) return;
          window.dispatchEvent(
            new CustomEvent('videoPreviewRequested', {
              detail: { videoUrl, posterUrl: props.imageItem.url },
            })
          );
        }}
        className={classNames('image-origin', {
          'image-origin--focus': props.isFocus,
        })}
      />
      {props.isFocus && isHovered && (
        <div className="image-ai-actions">
          <button
            type="button"
            className="image-ai-actions__button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = wrapperRef.current?.getBoundingClientRect();
              const position = rect
                ? { x: rect.left, y: rect.bottom + 12 }
                : { x: 0, y: 0 };
              window.dispatchEvent(
                new CustomEvent('imageToImageDialogRequested', {
                  detail: { mode: 'append', position, element: props.element },
                })
              );
            }}
          >
            <Sparkles size={14} />
            继续生成
          </button>
          <button
            type="button"
            className="image-ai-actions__button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = wrapperRef.current?.getBoundingClientRect();
              const position = rect
                ? { x: rect.left, y: rect.bottom + 12 }
                : { x: 0, y: 0 };
              window.dispatchEvent(
                new CustomEvent('imageToImageDialogRequested', {
                  detail: { mode: 'replace', position, element: props.element },
                })
              );
            }}
          >
            <Wand2 size={14} />
            修改图片
          </button>
          <button
            type="button"
            className="image-ai-actions__button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = wrapperRef.current?.getBoundingClientRect();
              const position = rect
                ? { x: rect.left, y: rect.bottom + 12 }
                : { x: 0, y: 0 };
              window.dispatchEvent(
                new CustomEvent('videoFromImageDialogRequested', {
                  detail: { position, element: props.element },
                })
              );
            }}
          >
            <Video size={14} />
            生成视频
          </button>
        </div>
      )}
      {contextMenu &&
        createPortal(
          <div
            className="drawnix-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              className="drawnix-context-menu__item"
              onClick={async () => {
                setContextMenu(null);
                try {
                  const url = getProxyUrl('image', props.imageItem.url);
                  await downloadUrl({ url, filename: 'image' });
                } catch (e) {
                  alert(e instanceof Error ? e.message : '保存图片失败');
                }
              }}
            >
              保存图片
            </button>
            {videoUrl && (
              <button
                type="button"
                className="drawnix-context-menu__item"
                onClick={async () => {
                  setContextMenu(null);
                  try {
                    const url = getProxyUrl('video', videoUrl);
                    await downloadUrl({ url, filename: 'video' });
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '保存视频失败');
                  }
              }}
            >
              保存视频
            </button>
          )}
          <div className="drawnix-context-menu__divider" />
          <button
            type="button"
            className="drawnix-context-menu__item drawnix-context-menu__item--danger"
            onClick={() => {
              setContextMenu(null);
              const selectedElements = getSelectedElements(props.board);
              // 如果当前点击的元素不在选中列表中，则只删除当前元素
              const elementsToRemove = selectedElements.includes(props.element)
                ? selectedElements
                : [props.element];
              CoreTransforms.removeElements(props.board, elementsToRemove);
            }}
          >
            删除
          </button>
        </div>,
          document.body
        )}
      {videoUrl && (
        <>
          <div className="image-video-badge" aria-hidden="true">
            <Play size={14} />
            <span className="image-video-badge__text">视频</span>
          </div>
          <div className="image-video-center" aria-hidden="true">
            <span className="image-video-center__icon">
              <Play size={22} />
            </span>
          </div>
        </>
      )}
    </div>
  );
};
