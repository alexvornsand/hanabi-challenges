import type { ReactElement, ReactNode } from 'react';
import './FormContainer.css';

type FormContainerProps = {
  children: ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * FormContainer
 * Establishes consistent spacing between form sections, labels, help text, and actions.
 */
export function FormContainer({
  children,
  gap = 'md',
  className,
}: FormContainerProps): ReactElement {
  return (
    <div className={['ds-form', `ds-form--gap-${gap}`, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
