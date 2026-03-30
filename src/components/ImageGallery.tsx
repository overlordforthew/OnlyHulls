"use client";

import { useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
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

  if (media.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-elevated">
        <span className="text-6xl opacity-20">&#9973;</span>
      </div>
    );
  }

  const prev = () => setCurrent((i) => (i > 0 ? i - 1 : media.length - 1));
  const next = () => setCurrent((i) => (i < media.length - 1 ? i + 1 : 0));

  return (
    <div className="space-y-2">
      {/* Hero image */}
      <div className="group relative overflow-hidden rounded-xl">
        <img
          src={media[current].url}
          alt={media[current].caption || alt}
          className="aspect-[16/9] w-full object-cover"
        />

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
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {media.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setCurrent(i)}
              className={`h-24 w-36 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-44 ${
                i === current
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <img
                src={m.url}
                alt={m.caption || alt}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
