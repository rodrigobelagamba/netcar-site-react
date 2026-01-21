/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_THEME: "light" | "dark";
  // Adicione outros envs aqui depois
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "fslightbox-react" {
  import { ReactNode } from "react";

  interface FsLightboxProps {
    toggler: boolean | number;
    sources: string[];
    slide?: number;
    type?: "image" | "video" | "youtube" | "vimeo" | "custom";
    maxYoutubeVideoDimensions?: { width: number; height: number };
    loadOnlyCurrentSource?: boolean;
    slideChangeAnimation?: "fade" | "slide";
    exitFullscreenOnClose?: boolean;
    openOnMount?: boolean;
    disableLocalStorage?: boolean;
    sourcesLightboxVersion?: number;
    onOpen?: () => void;
    onClose?: () => void;
    onSlideChange?: (index: number) => void;
    customSources?: ReactNode[];
    maxYoutubeVideoQuality?: string;
    videoPlaceholder?: string;
    videoSources?: Array<{
      source: string;
      type: string;
    }>;
    thumbs?: string[];
    key?: string | number;
  }

  export default function FsLightbox(
    props: FsLightboxProps
  ): JSX.Element | null;
}
