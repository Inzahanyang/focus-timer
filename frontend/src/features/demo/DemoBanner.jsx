import { useEffect, useState } from 'react';
import { isDemoLoaded, removeDemoAtlas } from './demoApi';

/** Quiet banner: sample data is always clearly labeled as sample data. */
export default function DemoBanner() {
  const [loaded, setLoaded] = useState(isDemoLoaded);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onChange = () => setLoaded(isDemoLoaded());
    window.addEventListener('focus-atlas:demo-changed', onChange);
    return () =>
      window.removeEventListener('focus-atlas:demo-changed', onChange);
  }, []);

  if (!loaded) return null;

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removeDemoAtlas();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-banner" role="status">
      <span>Sample atlas data is loaded.</span>
      <button
        type="button"
        className="btn btn-quiet demo-banner-btn"
        onClick={remove}
        disabled={busy}
      >
        {busy ? 'Removing…' : 'Remove demo data'}
      </button>
    </div>
  );
}
