import Loader from './Loader';
import Pagination from './Pagination';

/**
 * Reusable table with an optional toolbar (search + filters) and pagination.
 *
 * columns: [{ key, label, render?(row), align?, width?, className? }]
 */
export default function DataTable({
  columns,
  rows = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyIcon = '📋',
  rowKey = (row, i) => row.id ?? i,
  onRowClick,
  toolbar,
  pagination,
  onPageChange,
}) {
  return (
    <div className="card">
      {toolbar && <div className="table-toolbar">{toolbar}</div>}

      {loading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <span className="table-empty-icon" aria-hidden="true">{emptyIcon}</span>
          {emptyMessage}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.className}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.total > 0 && (
        <Pagination {...pagination} onPageChange={onPageChange} />
      )}
    </div>
  );
}
