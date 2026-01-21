import { useState, ReactNode } from "react";
import FsLightbox from "fslightbox-react";

interface GalleryWrapperProps {
  images: string[];
  children: (openGallery: (index: number) => void) => ReactNode;
  initialIndex?: number;
}

export function GalleryWrapper({
  images,
  children,
  initialIndex = 0,
}: GalleryWrapperProps) {
  const [lightboxController, setLightboxController] = useState({
    toggler: false,
    slide: initialIndex + 1,
  });

  const openGallery = (imageIndex: number) => {
    setLightboxController({
      toggler: !lightboxController.toggler,
      slide: imageIndex + 1,
    });
  };

  return (
    <>
      {children(openGallery)}

      <FsLightbox
        toggler={lightboxController.toggler}
        sources={images}
        slide={lightboxController.slide}
        type="image"
        slideChangeAnimation="fade"
        exitFullscreenOnClose={false}
        loadOnlyCurrentSource={false}
      />
    </>
  );
}
