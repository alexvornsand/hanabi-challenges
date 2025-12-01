import type { ReactElement, ReactNode } from 'react';
import './CardSections.css';

type SectionProps = { children: ReactNode; className?: string };

export function CardHeader({ children, className }: SectionProps): ReactElement {
  return <div className={['ds-card__header', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function CardBody({ children, className }: SectionProps): ReactElement {
  return <div className={['ds-card__body', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function CardFooter({ children, className }: SectionProps): ReactElement {
  return <div className={['ds-card__footer', className].filter(Boolean).join(' ')}>{children}</div>;
}
