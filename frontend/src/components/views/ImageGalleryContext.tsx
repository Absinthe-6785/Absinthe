import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Block } from './blockUtils';
import { collectConsecutiveImageGallery, type GalleryImage } from './imageGallery';
import { ImageGalleryViewer } from './ImageGalleryViewer';

export interface ImageGalleryContextValue {
  openGallery: (blockId: string) => void;
}

const ImageGalleryCtx = createContext<ImageGalleryContextValue | null>(null);

export function useImageGallery(): ImageGalleryContextValue | null {
  return useContext(ImageGalleryCtx);
}

export interface ImageGalleryProviderProps {
  getRootBlocks: () => Block[];
  children: React.ReactNode;
}

export function ImageGalleryProvider({ getRootBlocks, children }: ImageGalleryProviderProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [index, setIndex] = useState(0);

  const openGallery = useCallback((blockId: string) => {
    const { images: gallery, index: i } = collectConsecutiveImageGallery(getRootBlocks(), blockId);
    if (!gallery.length) return;
    setImages(gallery);
    setIndex(i);
    setOpen(true);
  }, [getRootBlocks]);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openGallery }), [openGallery]);

  return (
    <ImageGalleryCtx.Provider value={value}>
      {children}
      {open && images.length > 0 ? (
        <ImageGalleryViewer
          images={images}
          index={index}
          onIndexChange={setIndex}
          onClose={close}
        />
      ) : null}
    </ImageGalleryCtx.Provider>
  );
}
