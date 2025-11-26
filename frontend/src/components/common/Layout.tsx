import React from 'react';
import './Layout.css';

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
};

export function Container({ children, className, maxWidth }: ContainerProps) {
  return (
    <div
      className={['ui-container', className].filter(Boolean).join(' ')}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {children}
    </div>
  );
}

type StackProps = {
  children: React.ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const gapMap: Record<NonNullable<StackProps['gap']>, string> = {
  xs: 'var(--space-xs)',
  sm: 'var(--space-sm)',
  md: 'var(--space-md)',
  lg: 'var(--space-lg)',
};

export function Stack({ children, gap = 'sm', className }: StackProps) {
  const style = { gap: gapMap[gap] };
  return (
    <div className={['ui-stack', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
