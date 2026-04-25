/**
 * Badge SVG Engine
 *
 * Rebuilt from apps/web/src/pages/admin/badgeSvgRenderer.ts (no D3 dependency).
 * Accepts BadgeConfig from @hanabi/dsl and produces an SVG string.
 *
 * Shape mapping (DSL schema → rendering geometry):
 *   circle   → circle
 *   shield   → rounded-square
 *   hex      → rounded-hexagon
 *   ribbon   → diamond-facet
 *   star     → rosette
 */
import type { BadgeConfig } from '@hanabi/dsl';
import { COLOUR_HEX } from '../../lib/colourTokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 160;
const H = 160;
const CX = 80;
const CY = 80;
const ROUNDED_SQUARE_X = 20;
const ROUNDED_SQUARE_Y = 8;
const ROUNDED_SQUARE_W = 120;
const ROUNDED_SQUARE_H = 144;
const ROUNDED_SQUARE_RADIUS = 24;

type RenderShape = 'circle' | 'rounded-square' | 'rounded-hexagon' | 'diamond-facet' | 'rosette';

// ---------------------------------------------------------------------------
// Schema → render shape mapping
// ---------------------------------------------------------------------------

function toRenderShape(shape: BadgeConfig['shape']): RenderShape {
  switch (shape) {
    case 'shield': return 'rounded-square';
    case 'hex':    return 'rounded-hexagon';
    case 'ribbon': return 'diamond-facet';
    case 'star':   return 'rosette';
    default:       return 'circle';
  }
}

// ---------------------------------------------------------------------------
// Path builders (D3-free)
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type Point = { x: number; y: number };

/**
 * Rounded polygon path using SVG Q (quadratic bezier) commands.
 * Matches the visual output of the original roundedPolygonPath(d3) implementation.
 */
function roundedPolygonPath(points: Array<[number, number]>, radius: number): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[(i - 1 + n) % n];
    const [bx, by] = points[i];
    const [cx, cy] = points[(i + 1) % n];

    const v1x = ax - bx; const v1y = ay - by;
    const v2x = cx - bx; const v2y = cy - by;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const u1x = v1x / l1; const u1y = v1y / l1;
    const u2x = v2x / l2; const u2y = v2y / l2;

    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const angle = Math.acos(dot);
    const offset = Math.min(radius / Math.tan(angle / 2 || 1), l1 / 2, l2 / 2);

    const s1x = bx + u1x * offset; const s1y = by + u1y * offset;
    const s2x = bx + u2x * offset; const s2y = by + u2y * offset;

    if (i === 0) d += `M ${s1x.toFixed(2)},${s1y.toFixed(2)}`;
    else d += ` L ${s1x.toFixed(2)},${s1y.toFixed(2)}`;
    d += ` Q ${bx.toFixed(2)},${by.toFixed(2)} ${s2x.toFixed(2)},${s2y.toFixed(2)}`;
  }
  return d + ' Z';
}

function buildCirclePath(cx: number, cy: number, r: number): string {
  // Two half-arcs (SVG arc flag workaround for full circles)
  return `M ${cx - r},${cy} A ${r},${r} 0 1,0 ${cx + r},${cy} A ${r},${r} 0 1,0 ${cx - r},${cy} Z`;
}

function buildRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M ${x + r},${y}`,
    `L ${x + w - r},${y}`,
    `Q ${x + w},${y} ${x + w},${y + r}`,
    `L ${x + w},${y + h - r}`,
    `Q ${x + w},${y + h} ${x + w - r},${y + h}`,
    `L ${x + r},${y + h}`,
    `Q ${x},${y + h} ${x},${y + h - r}`,
    `L ${x},${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
    'Z',
  ].join(' ');
}

function buildShapePath(shape: RenderShape): string {
  if (shape === 'circle') return buildCirclePath(CX, CY, 78);
  if (shape === 'rounded-square') {
    return buildRoundedRectPath(
      ROUNDED_SQUARE_X, ROUNDED_SQUARE_Y,
      ROUNDED_SQUARE_W, ROUNDED_SQUARE_H,
      ROUNDED_SQUARE_RADIUS,
    );
  }
  if (shape === 'rounded-hexagon') {
    return roundedPolygonPath([
      [80, 8], [138, 36], [138, 124], [80, 152], [22, 124], [22, 36],
    ], 14);
  }
  if (shape === 'diamond-facet') {
    return roundedPolygonPath([
      [32, 18], [128, 18], [150, 50], [80, 152], [10, 50],
    ], 6);
  }
  // rosette
  return roundedPolygonPath(
    Array.from({ length: 24 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
      const r = i % 2 === 0 ? 74 : 64;
      return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as [number, number];
    }),
    8,
  );
}

// ---------------------------------------------------------------------------
// Text fitting
// ---------------------------------------------------------------------------

function fitMainText(text: string, boxWidth: number, boxHeight: number) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const effectiveLines = Math.max(lines.length, 1);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const lineHeight = 1.02;
  const charWidthFactor = 0.57;
  const trackingPerChar = 0.045;
  const byChars = boxWidth / (longest * (charWidthFactor + trackingPerChar));
  const byHeight = boxHeight / (effectiveLines * lineHeight);
  const dynamicMax = Math.max(16, Math.floor(Math.min(boxHeight * 0.7, W * 0.2)));
  const fontSize = Math.max(11, Math.min(dynamicMax, Math.floor(Math.min(byChars, byHeight))));
  return { fontSize, lineHeight, lines };
}

function fitSecondaryText(text: string, maxWidth: number, ribbonHeight: number): number {
  const len = Math.max(text.trim().length, 1);
  const charWidthEm = 0.56;
  const letterSpacingEm = 0.15;
  const horizontalPadding = 2;
  const verticalPadding = 1;
  const availableWidth = Math.max(10, maxWidth - horizontalPadding * 2);
  const availableHeight = Math.max(8, ribbonHeight - verticalPadding * 2);
  const widthUnits = len * charWidthEm + Math.max(0, len - 1) * letterSpacingEm;
  const byChars = availableWidth / Math.max(widthUnits, 0.1);
  const byHeight = availableHeight;
  const dynamicMax = Math.max(12, Math.floor(Math.min(ribbonHeight * 0.9, H * 0.12)));
  return Math.max(8, Math.min(dynamicMax, Math.floor(Math.min(byChars, byHeight))));
}

function textAsTspans(lines: string[]): string {
  if (lines.length <= 1) return `<tspan x="${CX}" dy="0">${escapeXml(lines[0] ?? '')}</tspan>`;
  const startDy = -((lines.length - 1) / 2);
  return lines
    .map((line, i) => {
      const dy = i === 0 ? `${startDy}em` : '1.02em';
      return `<tspan x="${CX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Icon symbol → SVG path (from original renderer, ported verbatim)
// ---------------------------------------------------------------------------

function symbolTokenToPath(token: string): string {
  const key = token.trim().toLowerCase();
  if (key === 'military_tech')
    return 'M7 2h10v7.85q0 .575-.25 1.025t-.7.725l-3.55 2.1l.7 2.3H17l-3.1 2.2l1.2 3.8l-3.1-2.35L8.9 22l1.2-3.8L7 16h3.8l.7-2.3l-3.55-2.1q-.45-.275-.7-.725T7 9.85zm4 2v7.05l1 .6l1-.6V4z';
  if (key === 'workspace_premium')
    return 'm9.675 13.7l.875-2.85L8.25 9h2.85l.9-2.8l.9 2.8h2.85l-2.325 1.85l.875 2.85l-2.3-1.775zM6 23v-7.725q-.95-1.05-1.475-2.4T4 10q0-3.35 2.325-5.675T12 2t5.675 2.325T20 10q0 1.525-.525 2.875T18 15.275V23l-6-2zm10.25-8.75Q18 12.5 18 10t-1.75-4.25T12 4T7.75 5.75T6 10t1.75 4.25T12 16t4.25-1.75';
  if (key === 'emoji_events')
    return 'M7 21v-2h4v-3.1q-1.225-.275-2.187-1.037T7.4 12.95q-1.875-.225-3.137-1.637T3 8V7q0-.825.588-1.412T5 5h2V3h10v2h2q.825 0 1.413.588T21 7v1q0 1.9-1.263 3.313T16.6 12.95q-.45 1.15-1.412 1.913T13 15.9V19h4v2zm0-10.2V7H5v1q0 .95.55 1.713T7 10.8m10 0q.9-.325 1.45-1.088T19 8V7h-2z';
  if (key === 'verified')
    return 'm8.6 22.5l-1.9-3.2l-3.6-.8l.35-3.7L1 12l2.45-2.8l-.35-3.7l3.6-.8l1.9-3.2L12 2.95l3.4-1.45l1.9 3.2l3.6.8l-.35 3.7L23 12l-2.45 2.8l.35 3.7l-3.6.8l-1.9 3.2l-3.4-1.45zm2.35-6.95L16.6 9.9l-1.4-1.45l-4.25 4.25l-2.15-2.1L7.4 12z';
  if (key === 'diamond')
    return 'M9.2 8.25L11.85 3h.3l2.65 5.25zm2.05 11.85L2.625 9.75h8.625zm1.5 0V9.75h8.625zm3.7-11.85L13.85 3H19l2.625 5.25zm-14.075 0L5 3h5.15l-2.6 5.25z';
  // default: star
  return 'm5.825 21l1.625-7.025L2 9.25l7.2-.625L12 2l2.8 6.625l7.2.625l-5.45 4.725L18.175 21L12 17.275z';
}

// ---------------------------------------------------------------------------
// Composition helpers (shape-specific text/icon positioning)
// ---------------------------------------------------------------------------

interface ShapeComposition {
  mainTextBox: { x: number; y: number; width: number; height: number };
  iconTopPx: number;
}

function compositionForShape(shape: RenderShape): ShapeComposition {
  if (shape === 'circle')
    return { mainTextBox: { x: 20, y: 50, width: 120, height: 58 }, iconTopPx: 24 };
  if (shape === 'rounded-square')
    return { mainTextBox: { x: 19, y: 50, width: 122, height: 58 }, iconTopPx: 24 };
  if (shape === 'rounded-hexagon')
    return { mainTextBox: { x: 26, y: 53, width: 108, height: 50 }, iconTopPx: 25 };
  if (shape === 'diamond-facet')
    return { mainTextBox: { x: 30, y: 32, width: 100, height: 44 }, iconTopPx: 106 };
  return { mainTextBox: { x: 27, y: 54, width: 106, height: 48 }, iconTopPx: 26 };
}

function polygonExtentAtY(polygon: Point[], y: number, halfW: number, h: number): number {
  let maxX = Number.NEGATIVE_INFINITY;
  const yNorm = y / h;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    if (yNorm < yMin || yNorm > yMax) continue;
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-9) {
      maxX = Math.max(maxX, (a.x - 0.5) * 2 * halfW, (b.x - 0.5) * 2 * halfW);
      continue;
    }
    const t = (yNorm - a.y) / dy;
    const xNorm = a.x + (b.x - a.x) * t;
    maxX = Math.max(maxX, (xNorm - 0.5) * 2 * halfW);
  }
  return Number.isFinite(maxX) ? Math.max(0, maxX) : 0;
}

const HEX_POLY: Point[] = [
  { x: 0.5, y: 0.05 }, { x: 0.86, y: 0.22 }, { x: 0.86, y: 0.78 },
  { x: 0.5, y: 0.95 }, { x: 0.14, y: 0.78 }, { x: 0.14, y: 0.22 },
];
const DIAMOND_POLY: Point[] = [
  { x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.94, y: 0.3 },
  { x: 0.5, y: 0.96 }, { x: 0.06, y: 0.3 },
];

function extentAtY(shape: RenderShape, y: number, halfW: number, h: number): number {
  if (shape === 'circle') {
    const cy = h / 2;
    const dy = y - cy;
    return Math.max(0, Math.sqrt(Math.max(0, halfW * halfW - dy * dy)));
  }
  if (shape === 'rounded-square') {
    const r = ROUNDED_SQUARE_RADIUS;
    const localHalfW = ROUNDED_SQUARE_W / 2;
    const topArcCenterY = ROUNDED_SQUARE_Y + r;
    const bottomArcCenterY = ROUNDED_SQUARE_Y + ROUNDED_SQUARE_H - r;
    if (y < topArcCenterY) {
      const dy = topArcCenterY - y;
      return localHalfW - r + Math.sqrt(Math.max(0, r * r - dy * dy));
    }
    if (y > bottomArcCenterY) {
      const dy = y - bottomArcCenterY;
      return localHalfW - r + Math.sqrt(Math.max(0, r * r - dy * dy));
    }
    return localHalfW;
  }
  if (shape === 'rounded-hexagon') return polygonExtentAtY(HEX_POLY, y, halfW, h);
  if (shape === 'diamond-facet') return polygonExtentAtY(DIAMOND_POLY, y, halfW, h);
  return polygonExtentAtY(HEX_POLY, y, halfW, h); // rosette approximation
}

function maxExtentInBand(shape: RenderShape, yStart: number, yEnd: number, halfW: number, h: number): number {
  let max = 0;
  const samples = 48;
  for (let i = 0; i <= samples; i++) {
    const y = yStart + ((yEnd - yStart) * i) / samples;
    max = Math.max(max, extentAtY(shape, y, halfW, h));
  }
  return max;
}

function mirrorAroundCenter(x: number): number {
  return CX - (x - CX);
}

// ---------------------------------------------------------------------------
// Main export: buildBadgeSvg
// ---------------------------------------------------------------------------

export function buildBadgeSvg(config: BadgeConfig): string {
  const shape = toRenderShape(config.shape);
  const fill = COLOUR_HEX[config.colour]?.light ?? '#808080';
  const main = config.primary_text;
  const secondary = config.secondary_text ?? '';
  const iconToken = config.icon ?? 'star';

  const s = shape === 'diamond-facet' ? 86 : 112;
  const eta = shape === 'diamond-facet' ? 18 : 20;
  const gamma = 10;
  const lambda = 25;
  const delta = 10;
  const mDepth = eta;
  const halfW = 80;

  const r = Math.round(maxExtentInBand(shape, s, s + eta, halfW, H));
  const composition = compositionForShape(shape);
  const mainTextBox = composition.mainTextBox;
  const mainTextInsetFromShape = 10;
  const shapeHalfWidthAtMainText = maxExtentInBand(shape, mainTextBox.y, mainTextBox.y + mainTextBox.height, halfW, H);
  const shapeBoundMainTextWidth = Math.max(20, (shapeHalfWidthAtMainText - mainTextInsetFromShape) * 2);

  const xLeft = CX - (r + gamma);
  const xRight = CX + (r + gamma);
  const sashHorizontalBuffer = shape === 'diamond-facet' ? 6 : 8;
  const sashTextWidth = Math.max(24, xRight - xLeft - sashHorizontalBuffer * 2);
  const mainFitWidth = Math.max(20, Math.min(mainTextBox.width - 16, shapeBoundMainTextWidth));
  const mainFitHeight = Math.max(20, mainTextBox.height - 7);

  const { fontSize, lines } = fitMainText(main, mainFitWidth, mainFitHeight);
  const secondaryTextSizePx = secondary ? fitSecondaryText(secondary, sashTextWidth, eta) : 0;
  const iconSizePx = Math.max(16, Math.round(mainTextBox.height * 0.5));

  const zInnerRight = CX + (r - gamma);
  const zOuterRight = zInnerRight + lambda + gamma;
  const zTop = s + delta;
  const zBottom = zTop + eta;
  const zMid = zTop + eta / 2;
  const mInset = Math.min(lambda + gamma - 2, mDepth);

  const zRight = `M ${zInnerRight} ${zTop} L ${zOuterRight} ${zTop} L ${zOuterRight - mInset} ${zMid} L ${zOuterRight} ${zBottom} L ${zInnerRight} ${zBottom} Z`;
  const zLeft = `M ${mirrorAroundCenter(zInnerRight)} ${zTop} L ${mirrorAroundCenter(zOuterRight)} ${zTop} L ${mirrorAroundCenter(zOuterRight - mInset)} ${zMid} L ${mirrorAroundCenter(zOuterRight)} ${zBottom} L ${mirrorAroundCenter(zInnerRight)} ${zBottom} Z`;

  const yRightTopStartX = xRight;
  const yRightBottomStartX = xRight;
  const yRightTopEndX = zInnerRight;
  const yRightBottomEndX = zInnerRight;
  const yTop = s;
  const yBottom = s + eta;
  const yEndTop = yTop + delta;
  const yEndBottom = yBottom + delta;
  const yRight = `M ${yRightTopStartX} ${yTop} L ${yRightBottomStartX} ${yBottom} L ${yRightBottomEndX} ${yEndBottom} L ${yRightTopEndX} ${yEndTop} Z`;
  const yLeft = `M ${mirrorAroundCenter(yRightTopStartX)} ${yTop} L ${mirrorAroundCenter(yRightBottomStartX)} ${yBottom} L ${mirrorAroundCenter(yRightBottomEndX)} ${yEndBottom} L ${mirrorAroundCenter(yRightTopEndX)} ${yEndTop} Z`;

  const xFront = `M ${xLeft} ${s} L ${xRight} ${s} L ${xRight} ${s + eta} L ${xLeft} ${s + eta} Z`;
  const shapePath = buildShapePath(shape);

  const mainY = mainTextBox.y + mainTextBox.height / 2;
  const iconScale = iconSizePx / 24;
  const iconPath = symbolTokenToPath(iconToken);
  const iconTranslateX = CX - 12 * iconScale;
  const iconTranslateY = composition.iconTopPx;
  const secondaryY = s + eta / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
  <defs>
    <linearGradient id="sashBackGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ece9e1" />
      <stop offset="100%" stop-color="#ddd7c9" />
    </linearGradient>
    <linearGradient id="sashZigGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4ccbd" />
      <stop offset="100%" stop-color="#c4baa9" />
    </linearGradient>
    <linearGradient id="sashFrontGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3efe6" />
      <stop offset="54%" stop-color="#e5ddcf" />
      <stop offset="100%" stop-color="#d4cbbb" />
    </linearGradient>
  </defs>
  <path d="${zLeft}" fill="url(#sashBackGrad)" />
  <path d="${zRight}" fill="url(#sashBackGrad)" />
  <path d="${yLeft}" fill="url(#sashZigGrad)" />
  <path d="${yRight}" fill="url(#sashZigGrad)" />
  <path d="${shapePath}" fill="${fill}" stroke="rgba(240,244,250,0.95)" stroke-width="8" paint-order="stroke fill" />
  <path d="${shapePath}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
  <path d="${xFront}" fill="url(#sashFrontGrad)" stroke="rgba(0,0,0,0.14)" stroke-width="0.7" />
  <text
    x="${CX}" y="${mainY}"
    text-anchor="middle" dominant-baseline="middle"
    font-size="${fontSize}" font-weight="700" fill="#f8fbff"
    style="letter-spacing:0.07em;font-family:ui-sans-serif,system-ui,sans-serif"
  >${textAsTspans(lines)}</text>
  ${secondary ? `<text
    x="${CX}" y="${secondaryY}"
    text-anchor="middle" dominant-baseline="middle"
    font-size="${secondaryTextSizePx}" font-weight="800" fill="#463d31"
    style="letter-spacing:0.15em;font-family:ui-sans-serif,system-ui,sans-serif"
  >${escapeXml(secondary)}</text>` : ''}
  <g transform="translate(${iconTranslateX} ${iconTranslateY}) scale(${iconScale})">
    <path d="${iconPath}" fill="#f8fbff" />
  </g>
</svg>`.trim();
}
