import type { BadgeConfig } from '../types.js';

/**
 * Serialises a BadgeConfig to a YAML badge block (indented 4 spaces).
 * Used by the badge designer to write back into the event YAML.
 */
export function badgeConfigToYaml(config: BadgeConfig): string {
  const lines: string[] = ['badge:'];
  lines.push(`  colour: ${config.colour}`);
  lines.push(`  primary_text: "${config.primary_text.replace(/"/g, '\\"')}"`);
  if (config.secondary_text) {
    lines.push(`  secondary_text: "${config.secondary_text.replace(/"/g, '\\"')}"`);
  }
  if (config.shape) {
    lines.push(`  shape: ${config.shape}`);
  }
  if (config.size && config.size !== 'regular') {
    lines.push(`  size: ${config.size}`);
  }
  if (config.icon) {
    lines.push(`  icon: ${config.icon}`);
  }
  return lines.join('\n');
}
