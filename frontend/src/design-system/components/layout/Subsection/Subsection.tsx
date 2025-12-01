import type { ReactElement, ReactNode } from 'react';
import './Subsection.css';

type SubsectionProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Hierarchical spacing variant of Section for nested content blocks.
 */
export function Subsection({ children, className }: SubsectionProps): ReactElement {
  return <div className={['ds-subsection', className].filter(Boolean).join(' ')}>{children}</div>;
}
