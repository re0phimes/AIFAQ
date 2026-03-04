"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { FAQImage } from "@/src/types/faq";
import { t } from "@/lib/i18n";

interface ImageGalleryProps {
  images: FAQImage[];
  lang: "zh" | "en";
  onOpen: (index: number) => void;
  className?: string;
}

export default function ImageGallery({ images, lang, onOpen, className }: ImageGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < images.length - 1;

  const sourceLabel = useMemo(() => ({ blog: t("blog", lang), paper: t("paper", lang) }), [lang]);

  const scrollToIndex = useCallback((nextIndex: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const children = scroller.children;
    if (nextIndex < 0 || nextIndex >= children.length) return;
    const target = children.item(nextIndex) as HTMLElement | null;
    if (!target) return;
    scroller.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    setActiveIndex(nextIndex);
  }, []);

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const children = Array.from(scroller.children) as HTMLElement[];
    if (children.length === 0) return;
    const left = scroller.scrollLeft;
    let nearest = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    children.forEach((node, index) => {
      const distance = Math.abs(node.offsetLeft - left);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = index;
      }
    });
    setActiveIndex(nearest);
  }, []);

  if (images.length === 0) return null;

  return (
    <section className={`mt-4 ${className ?? ""}`} aria-label={t("imageGallery", lang)}>
      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
        >
          {images.map((img, index) => (
            <button
              key={`${img.url}-${index}`}
              type="button"
              onClick={() => onOpen(index)}
              className="group basis-full shrink-0 snap-start text-left md:basis-1/3"
              aria-label={`${t("openImage", lang)} ${index + 1}`}
            >
              <figure className="overflow-hidden rounded-lg border-[0.5px] border-border bg-panel transition-transform duration-200 hover:scale-[1.01] hover:shadow-lg">
                <Image
                  src={img.url}
                  alt={img.caption}
                  width={1200}
                  height={800}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                  unoptimized
                />
                <figcaption className="bg-surface/60 px-3 py-2 text-xs text-subtext">
                  <span className="line-clamp-2">{img.caption}</span>
                  <span className="ml-2 text-[10px] text-subtext/70">
                    [{sourceLabel[img.source]}]
                  </span>
                </figcaption>
              </figure>
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={!canPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border-[0.5px] border-border bg-panel/90 px-2 py-1 text-xs text-text shadow-sm disabled:opacity-30"
              aria-label={t("prevImage", lang)}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={!canNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border-[0.5px] border-border bg-panel/90 px-2 py-1 text-xs text-text shadow-sm disabled:opacity-30"
              aria-label={t("nextImage", lang)}
            >
              ›
            </button>
          </>
        )}
      </div>
    </section>
  );
}
