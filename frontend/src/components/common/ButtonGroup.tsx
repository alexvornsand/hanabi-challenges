import React from 'react';
import './ButtonGroup.css';

type Align = 'left' | 'center' | 'right' | 'split';
type Direction = 'row' | 'column';

type ButtonGroupProps = {
  align?: Align;
  direction?: Direction;
  children: React.ReactNode;
  className?: string;
};

export function ButtonGroup({
  align = 'right',
  direction = 'row',
  children,
  className,
}: ButtonGroupProps) {
  const alignMap: Record<Align, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    split: 'space-between',
  };

  const classes = ['ui-btn-group', direction === 'column' ? 'ui-btn-group--col' : 'ui-btn-group--row', className]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties =
    direction === 'row'
      ? { justifyContent: alignMap[align] }
      : { alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' };

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
