import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const HLSPlayer = ({ src }: {src: string}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const { current: video } = videoRef;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) { // Safari
      video.src = src;
    } else if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        xhrSetup: (xhr, url) => {
          xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        }
      });

      hlsRef.current.loadSource(src);
      hlsRef.current.attachMedia(video);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, function() {
        video.play();
      });
    }

    // Prevent pause/play via keyboard or mouse
    const preventPause = (e: Event) => {
      e.preventDefault();
      video.play(); // Always try to play
    };

    video.addEventListener('pause', preventPause);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('pause', preventPause);
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="noplaybackrate nofullscreen nodownload"
      disablePictureInPicture
      className="max-w-full max-h-[70vh] [&::-webkit-media-controls-timeline]:hidden [&::-webkit-media-controls-current-time-display]:hidden [&::-webkit-media-controls-time-remaining-display]:hidden [&::-webkit-media-controls-play-button]:hidden"
    />
  );
};

export default HLSPlayer;

