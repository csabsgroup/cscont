import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationWithPageSizeProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function PaginationWithPageSize({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'itens',
}: PaginationWithPageSizeProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Mostrando {start}–{end} de {totalItems} {itemLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Page size pills */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Por página:</span>
          {pageSizeOptions.map(size => (
            <button
              key={size}
              onClick={() => {
                onPageSizeChange(size);
                onPageChange(1);
              }}
              className={`h-7 min-w-[2rem] px-2 rounded-full text-xs font-medium transition-colors ${
                pageSize === size
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
            {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próximo
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
