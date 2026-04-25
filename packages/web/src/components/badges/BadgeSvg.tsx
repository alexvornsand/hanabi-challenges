import React from 'react';
import type { BadgeConfig } from '@hanabi/dsl';
import { buildBadgeSvg } from './badgeSvgEngine';

const SIZE_PX: Record<NonNullable<BadgeConfig['size']>, number> = {
  regular: 48,
  large: 96,
};

interface BadgeSvgProps {
  config: BadgeConfig;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a badge as an inline SVG, sized per `config.size`.
 * The engine (`badgeSvgEngine.ts`) generates the SVG from BadgeConfig fields —
 * no external CDN or fonts required.
 */
export function BadgeSvg({ config, className, style }: BadgeSvgProps) {
  const svgString = buildBadgeSvg(config);
  const sizePx = SIZE_PX[config.size ?? 'regular'];

  return (
    <span
      className={className}
      style={{ display: 'inline-block', width: sizePx, height: sizePx, ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgString }}
      aria-hidden="true"
    />
  );
}
