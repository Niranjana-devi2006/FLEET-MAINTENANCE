/** Page control that shows a sliding window of up to five page numbers. */
export default function Pagination({ page = 1, pages = 1, total = 0, limit = 50, onPageChange }) {
  if (pages <= 1) {
    return (
      <div className="pagination">
        <span className="pagination-info">{total} record{total === 1 ? '' : 's'}</span>
      </div>
    );
  }

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const numbers = [];
  for (let i = start; i <= end; i += 1) numbers.push(i);

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {from}–{to} of {total}
      </span>
      <button
        type="button" className="page-btn"
        disabled={page <= 1} onClick={() => onPageChange(page - 1)}
      >
        ‹
      </button>
      {start > 1 && (
        <>
          <button type="button" className="page-btn" onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className="muted small">…</span>}
        </>
      )}
      {numbers.map((n) => (
        <button
          key={n} type="button"
          className={`page-btn ${n === page ? 'active' : ''}`}
          onClick={() => onPageChange(n)}
        >
          {n}
        </button>
      ))}
      {end < pages && (
        <>
          {end < pages - 1 && <span className="muted small">…</span>}
          <button type="button" className="page-btn" onClick={() => onPageChange(pages)}>{pages}</button>
        </>
      )}
      <button
        type="button" className="page-btn"
        disabled={page >= pages} onClick={() => onPageChange(page + 1)}
      >
        ›
      </button>
    </div>
  );
}
