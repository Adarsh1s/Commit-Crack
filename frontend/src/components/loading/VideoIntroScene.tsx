// src/components/loading/VideoIntroScene.tsx
// Plays intro.mp4 accelerated (2.5x) for under 4s.
// Smoothly cross-fades into the launch panel background.

import React, { useEffect, useRef } from 'react';

interface Props {
  isFading: boolean;
  onFadeStart: () => void;
  onComplete: () => void;
}

export function VideoIntroScene({ isFading, onFadeStart, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Start cross-fade at 3.1 seconds, finish at 3.9 seconds (< 4s total)
    fadeTimerRef.current = setTimeout(() => {
      onFadeStart();
    }, 3100);

    endTimerRef.current = setTimeout(() => {
      onComplete();
    }, 3900);

    const handleEnded = () => {
      onFadeStart();
      setTimeout(onComplete, 500);
    };

    video.playbackRate = 2.5;
    video.play().catch(() => {
      // Autoplay fallback
      onFadeStart();
      setTimeout(onComplete, 600);
    });

    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('ended', handleEnded);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, [onFadeStart, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        overflow: 'hidden',
        pointerEvents: isFading ? 'none' : 'auto',
        opacity: isFading ? 0 : 1,
        background: 'radial-gradient(ellipse at 50% 30%, #d5e5f8 0%, #bbd4f0 48%, #a7c4e5 100%)',
      }}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Soft vignette to blend with background image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(1,7,16,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
