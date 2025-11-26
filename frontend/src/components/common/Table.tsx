import React from 'react';
import './Table.css';

type TableProps = {
  children: React.ReactNode;
  density?: 'relaxed' | 'tight';
  className?: string;
};

export function Table({ children, density = 'relaxed', className }: TableProps) {
  const densityClass = density === 'tight' ? 'ui-table--tight' : 'ui-table--relaxed';
  return <table className={['ui-table', densityClass, className].filter(Boolean).join(' ')}>{children}</table>;
}
