import React from 'react';
import './Pill.css';

type PillSize = 'sm' | 'md' | 'lg';
type PillVariant = 'default' | 'accent';

type PillProps = {
  children: React.ReactNode;
  size?: PillSize;
  variant?: PillVariant;
  className?: string;
  interactive?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export function Pill({
  children,
  size = 'md',
  variant = 'default',
  className,
  interactive = false,
  ...rest
}: PillProps) {
  const classes = [
    'ui-pill',
    `ui-pill--${size}`,
    `ui-pill--${variant}`,
    interactive ? 'ui-pill--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
