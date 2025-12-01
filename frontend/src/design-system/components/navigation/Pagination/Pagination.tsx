import type { ReactElement } from 'react';
import { Button } from '../../inputs/Button/Button';
import './Pagination.css';

type PaginationProps = {
  totalItems: number;
  pageSize?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({
  totalItems,
  pageSize = 10,
  currentPage,
  onPageChange,
  className,
}: PaginationProps): ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const goTo = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), totalPages);
    if (clamped !== currentPage) onPageChange(clamped);
  };

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <div className={['ds-pagination', className].filter(Boolean).join(' ')}>
      <div className="ds-pagination__controls">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => goTo(1)}
          disabled={isFirst}
          aria-label="First page"
        >
          «
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => goTo(currentPage - 1)}
          disabled={isFirst}
          aria-label="Previous page"
        >
          ‹
        </Button>
        <span className="ds-pagination__status">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => goTo(currentPage + 1)}
          disabled={isLast}
          aria-label="Next page"
        >
          ›
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => goTo(totalPages)}
          disabled={isLast}
          aria-label="Last page"
        >
          »
        </Button>
      </div>
    </div>
  );
}
