import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { getRTSPCameraStream } from "@/lib/api"


interface CameraStreamProps {
  streamUrl: string;
}

export const CameraStream: React.FC<CameraStreamProps> = ({ streamUrl }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        abortControllerRef.current = new AbortController();

        const stream = await getRTSPCameraStream(streamUrl);

        const reader = stream.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\r\n\r\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.startsWith('--frame')) {
              const imageStart = part.indexOf('\r\n\r\n') + 4;
              const imageData = part.slice(imageStart);
              const blob = new Blob([imageData], { type: 'image/webp' });
              const url = URL.createObjectURL(blob);
              setImageUrl((prevUrl) => {
                if (prevUrl) URL.revokeObjectURL(prevUrl);
                return url;
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching stream:', error);
      }
    };

    fetchStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [streamUrl]);

  if (!imageUrl) {
    return <div className="aspect-video bg-zinc-700 flex items-center justify-center text-zinc-400">Loading stream...</div>;
  }

  return (
    <div className="aspect-video relative">
      <Image
        src={imageUrl}
        alt="Camera stream"
        layout="fill"
        objectFit="cover"
      />
    </div>
  );
};


