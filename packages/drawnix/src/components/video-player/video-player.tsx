import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { Play } from 'lucide-react';
import './video-player.scss';
import { downloadUrl, getProxyUrl } from '../../utils/download';

export type VideoPlayerProps = {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  videoClassName?: string;
  videoStyle?: React.CSSProperties;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  playsInline?: boolean;
  muted?: boolean;
  loop?: boolean;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className,
  style,
  videoClassName,
  videoStyle,
  controls = true,
  preload = 'metadata',
  playsInline = true,
  muted = false,
  loop = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasUserInitiatedPlay, setHasUserInitiatedPlay] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setHasError(false);
    setIsPlaying(false);
    setHasUserInitiatedPlay(false);
    try {
      video.pause();
      video.currentTime = 0;
    } catch {
    }
  }, [src]);

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

  const canToggle = useMemo(() => Boolean(src) && !hasError, [src, hasError]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !canToggle) return;
    try {
      setHasUserInitiatedPlay(true);
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch {
      setHasError(true);
    }
  }, [canToggle]);

  return (
    <div
      className={classNames('video-player', className)}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        const width = 180;
        const height = poster ? 92 : 54;
        const x = Math.max(8, Math.min(e.clientX, window.innerWidth - width - 8));
        const y = Math.max(8, Math.min(e.clientY, window.innerHeight - height - 8));
        setContextMenu({ x, y });
      }}
    >
      <video
        ref={videoRef}
        className={classNames('video-player__video', videoClassName)}
        style={videoStyle}
        src={src}
        poster={poster}
        controls={controls && hasUserInitiatedPlay}
        preload={preload}
        playsInline={playsInline}
        muted={muted}
        loop={loop}
        onPointerDown={() => setHasUserInitiatedPlay(true)}
        onPlay={() => {
          if (!hasUserInitiatedPlay) {
            try {
              videoRef.current?.pause();
            } catch {
            }
            setIsPlaying(false);
            return;
          }
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setHasUserInitiatedPlay(false);
          try {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }
          } catch {
          }
        }}
        onError={() => setHasError(true)}
      />
      {!isPlaying && !hasError && (
        <button
          type="button"
          className="video-player__overlay"
          onClick={togglePlay}
          aria-label="播放视频"
        >
          <span className="video-player__play">
            <Play size={28} />
          </span>
        </button>
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
                  const url = getProxyUrl('video', src);
                  await downloadUrl({ url, filename: 'video' });
                } catch (e) {
                  alert(e instanceof Error ? e.message : '保存视频失败');
                }
              }}
            >
              保存视频
            </button>
            {poster && (
              <button
                type="button"
                className="drawnix-context-menu__item"
                onClick={async () => {
                  setContextMenu(null);
                  try {
                    const url = getProxyUrl('image', poster);
                    await downloadUrl({ url, filename: 'poster' });
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '保存封面失败');
                  }
                }}
              >
                保存封面
              </button>
            )}
          </div>,
          document.body
        )}
      {hasError && (
        <div className="video-player__error" role="alert">
          视频加载失败
        </div>
      )}
    </div>
  );
};
