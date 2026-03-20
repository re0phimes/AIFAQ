"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { FAQImage } from "@/src/types/faq";
import { t } from "@/lib/i18n";

interface ImageLightboxProps {
  isOpen: boolean;
  images: FAQImage[];
  initialIndex: number;
  lang: "zh" | "en";
  onClose: () => void;
}

const SWIPE_THRESHOLD = 40;
const HAPTIC_COOLDOWN_MS = 220;

export default function ImageLightbox({
  isOpen,
  images,
  initialIndex,
  lang,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)))
  );
  const [shakeClass, setShakeClass] = useState<"" | "lightbox-shake-left" | "lightbox-shake-right">("");
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);
  const lastHapticAtRef = useRef(0);
  const shakeTimeoutRef = useRef<number | null>(null);

  const sourceLabel = useMemo(() => ({ blog: t("blog", lang), paper: t("paper", lang) }), [lang]);

  const triggerBoundaryHaptic = useCallback(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    const now = Date.now();
    if (now - lastHapticAtRef.current < HAPTIC_COOLDOWN_MS) return;
    lastHapticAtRef.current = now;
    navigator.vibrate(45);
  }, []);

  const triggerBoundaryShake = useCallback((direction: "left" | "right") => {
    setShakeClass(direction === "left" ? "lightbox-shake-left" : "lightbox-shake-right");
    if (typeof window === "undefined") return;
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = window.setTimeout(() => {
      setShakeClass("");
    }, 180);
  }, []);

  const goToIndex = useCallback((nextIndex: number) => {
    if (nextIndex < 0) {
      triggerBoundaryHaptic();
      triggerBoundaryShake("left");
      return;
    }
    if (nextIndex >= images.length) {
      triggerBoundaryHaptic();
      triggerBoundaryShake("right");
      return;
    }
    setCurrentIndex(nextIndex);
  }, [images.length, triggerBoundaryHaptic, triggerBoundaryShake]);

  const goPrev = useCallback(() => {
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  const goNext = useCallback(() => {
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchDeltaXRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = event.touches[0].clientX - touchStartXRef.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = touchDeltaXRef.current;
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;

    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) {
      goPrev();
      return;
    }
    goNext();
  }, [goNext, goPrev]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen || images.length === 0) return null;

  const boundedCurrentIndex = Math.max(0, Math.min(currentIndex, images.length - 1));
  const image = images[boundedCurrentIndex];
  const thumbnails = images;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-3 md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />

      <div className="relative flex h-[92vh] min-w-0 w-full max-w-6xl max-w-full flex-col overflow-hidden rounded-xl border-[0.5px] border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 md:px-4">
          <p className="text-sm text-subtext">
            {boundedCurrentIndex + 1} / {images.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-subtext transition-colors hover:bg-surface hover:text-text"
            aria-label={t("closeLightbox", lang)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-2 py-3 md:px-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-[0.5px] border-border bg-panel/90 px-3 py-2 text-text shadow-sm"
            aria-label={t("prevImage", lang)}
          >
            ‹
          </button>

          <figure className={`max-h-full min-w-0 w-full overflow-hidden rounded-lg border-[0.5px] border-border bg-bg ${shakeClass}`}>
            <Image
              src={image.url}
              alt={image.caption}
              width={1800}
              height={1200}
              className="h-[62vh] w-full object-contain md:h-[68vh]"
              unoptimized
              priority
            />
            <figcaption className="border-t border-border/60 bg-surface/60 px-3 py-2 text-xs text-subtext md:text-sm">
              {image.caption}
              <span className="ml-2 text-[10px] text-subtext/70">[{sourceLabel[image.source]}]</span>
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-[0.5px] border-border bg-panel/90 px-3 py-2 text-text shadow-sm"
            aria-label={t("nextImage", lang)}
          >
            ›
          </button>
        </div>

        <div className="border-t border-border/60 px-3 py-2 md:px-4">
          <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]" aria-label={t("imageGallery", lang)}>
            {thumbnails.map((thumb, index) => (
              <button
                key={`${thumb.url}-${index}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`shrink-0 overflow-hidden rounded-md border-[0.5px] ${
                  boundedCurrentIndex === index ? "border-primary" : "border-border"
                }`}
                aria-label={`${t("imageThumbnail", lang)} ${index + 1}`}
                aria-current={boundedCurrentIndex === index ? "true" : undefined}
              >
                <Image
                  src={thumb.url}
                  alt={thumb.caption}
                  width={180}
                  height={100}
                  className="h-14 w-24 object-cover md:h-16 md:w-28"
                  unoptimized
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
