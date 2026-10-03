/** Dashboard summary tile. */
export default function StatCard({ label, value, hint, icon, tone = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`} aria-hidden="true">{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}
