type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (total <= 10 && pageSize === 10) return null;

  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const visible =
    pages.length <= 5
      ? pages
      : [...new Set([
          1,
          ...pages.filter((p) => Math.abs(p - page) <= 1),
          totalPages,
        ])].sort((a, b) => a - b);

  return (
    <div className="listPagination">
      <span className="paginationSummary">
        Exibindo <b>{start}–{end}</b> de <b>{total}</b> registros
      </span>

      <div className="paginationControls">
        <label className="paginationSize">
          Por página
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>

        <button
          type="button"
          className="paginationButton"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>

        {visible.map((p, index) => (
          <span key={p} style={{ display: "contents" }}>
            {index > 0 && p - visible[index - 1] > 1 && (
              <span className="paginationDots">…</span>
            )}

            <button
              type="button"
              className={`paginationButton paginationNumber ${
                page === p ? "active" : ""
              }`}
              aria-current={page === p ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </span>
        ))}

        <button
          type="button"
          className="paginationButton"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
