export default function HistoryPage() {
  // Skeleton route — the session list arrives with the sessions API.
  return (
    <div>
      <h1 className="page-title">Focus history</h1>
      <p className="page-sub">A record of where your attention has been.</p>
      <div className="empty-state">
        <strong>No sessions yet</strong>
        Complete a focus session and it will appear here.
      </div>
    </div>
  );
}
