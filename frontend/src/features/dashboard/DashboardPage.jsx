export default function DashboardPage() {
  // Skeleton route — stats, terrain, and charts arrive with GET /stats.
  return (
    <div>
      <h1 className="page-title">Your focus landscape</h1>
      <div className="empty-state">
        <strong>Your map is still forming.</strong>
        Complete three sessions to reveal your first pattern.
      </div>
    </div>
  );
}
