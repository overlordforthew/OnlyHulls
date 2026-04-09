"use client";

import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { Camera, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { getExternalVideoMeta, isLocalMediaUrl, type ListingMediaType } from "@/lib/media";

interface MediaItem {
  id: string;
  type?: ListingMediaType;
  url: string;
  thumbnailUrl?: string | null;
  caption: string | null;
}

export function ImageGallery({
  media,
  alt,
}: {
  media: MediaItem[];
  alt: string;
}) {
  const [current, setCurrent] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thumbnail strip to keep active thumb visible
  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const thumb = container.children[current] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [current]);

  if (media.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-elevated">
        <span className="text-6xl opacity-20">&#9973;</span>
      </div>
    );
  }

  const prev = () => setCurrent((i) => (i > 0 ? i - 1 : media.length - 1));
  const next = () => setCurrent((i) => (i < media.length - 1 ? i + 1 : 0));
  const currentItem = media[current];
  const currentVideo = currentItem.type === "video" ? getExternalVideoMeta(currentItem.url) : null;
  const currentImageIsLocal = isLocalMediaUrl(currentItem.url);

  return (
    <div className="space-y-2">
      {/* Hero image */}
      <div className="group relative overflow-hidden rounded-xl">
        {currentVideo ? (
          <iframe
            src={currentVideo.embedUrl}
            title={currentItem.caption || `${alt} video`}
            className="aspect-[16/9] w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={currentItem.url}
              alt={currentItem.caption || alt}
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized={!currentImageIsLocal}
              quality={currentImageIsLocal ? 90 : undefined}
            />
          </div>
        )}

        {/* Nav arrows */}
        {media.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Photo count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Camera className="h-3.5 w-3.5" />
          {current + 1} / {media.length}
        </div>
      </div>

      {/* Thumbnail strip */}
        {media.length > 1 && (
          <div ref={thumbsRef} className="flex gap-2 overflow-x-auto">
            {media.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setCurrent(i)}
                className={`relative h-24 w-36 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-44 ${
                  i === current
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                {m.type === "video" ? (
                  <div className="flex h-full w-full items-center justify-center bg-surface-elevated text-text-secondary">
                    <div className="flex flex-col items-center gap-1">
                      <PlayCircle className="h-8 w-8" />
                      <span className="text-xs font-medium">Video</span>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={m.url}
                    alt={m.caption || alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 9rem, 11rem"
                    unoptimized={!isLocalMediaUrl(m.url)}
                    quality={isLocalMediaUrl(m.url) ? 80 : undefined}
                  />
                )}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
