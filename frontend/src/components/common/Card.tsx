import React from 'react';
import './Card.css';

type CardProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
};

export function Card({ header, footer, children, maxWidth, className }: CardProps) {
  return (
    <div
      className={['ui-card', className].filter(Boolean).join(' ')}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {header ? <div className="ui-card__header">{header}</div> : null}
      <div className="ui-card__body">{children}</div>
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </div>
  );
}
