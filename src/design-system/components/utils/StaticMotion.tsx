import { createElement, forwardRef, Fragment, type ComponentType, type ReactNode } from "react";

const animationProps = new Set([
  "animate",
  "custom",
  "drag",
  "dragConstraints",
  "dragElastic",
  "exit",
  "initial",
  "layout",
  "layoutId",
  "onAnimationComplete",
  "onDragEnd",
  "onHoverEnd",
  "onHoverStart",
  "transition",
  "variants",
  "viewport",
  "whileFocus",
  "whileHover",
  "whileInView",
  "whileTap",
]);

const cache = new Map<string, ComponentType<any>>();

function staticElement(tag: string): ComponentType<any> {
  const cached = cache.get(tag);
  if (cached) return cached;
  const Component = forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
    const domProps: Record<string, unknown> = { ref };
    for (const [key, value] of Object.entries(props)) {
      if (!animationProps.has(key)) domProps[key] = value;
    }
    return createElement(tag, domProps);
  });
  Component.displayName = `StaticMotion.${tag}`;
  cache.set(tag, Component);
  return Component;
}

export const motion = new Proxy({} as Record<string, ComponentType<any>>, {
  get(_target, tag: string) {
    return staticElement(tag);
  },
});

export function AnimatePresence({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}
