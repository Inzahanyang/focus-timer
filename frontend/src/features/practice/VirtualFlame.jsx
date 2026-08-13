import { useEffect, useRef, useState } from 'react';

// One candle floating in wide ink-dark margin (brief §4). The video is
// the ONLY motion on screen: no particles, no pulsing, no extra glow —
// just a faint warm halo and an edge vignette in CSS.
// Fallback chain: WebM -> MP4 -> poster; reduced-motion goes straight
// to the poster. Load failures degrade silently.

const WEBM = new URL(
  '../../assets/steady-gaze/flame-loop.webm',
  import.meta.url
).href;
const MP4 = new URL(
  '../../assets/steady-gaze/flame-loop.mp4',
  import.meta.url
).href;
const POSTER = new URL(
  '../../assets/steady-gaze/flame-poster.webp',
  import.meta.url
).href;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function VirtualFlame({ dimmed = false }) {
  const [failed, setFailed] = useState(false);
  const still = failed || prefersReducedMotion();
  const videoRef = useRef(null);

  // autoplay can be declined even when muted. A hidden tab (practice
  // restored in the background) defers playback rather than failing it,
  // so retry when the tab becomes visible; only a refusal while visible
  // falls back to the poster.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const tryPlay = () => {
      if (!video.paused) return;
      const attempt = video.play();
      if (attempt && attempt.catch) {
        attempt.catch(() => {
          if (video.paused && !document.hidden) setFailed(true);
        });
      }
    };
    tryPlay();
    const onVisible = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [still]);

  return (
    <div
      className={`flame-stage${dimmed ? ' is-dimmed' : ''}`}
      aria-hidden="true"
    >
      <div className="flame-halo" />
      {still ? (
        <img className="flame-media" src={POSTER} alt="" />
      ) : (
        <video
          ref={videoRef}
          className="flame-media"
          muted
          autoPlay
          loop
          playsInline
          poster={POSTER}
          onError={() => setFailed(true)}
          onCanPlay={(event) => {
            // second chance once data is ready — a refusal while the tab
            // is visible falls back to the poster
            const video = event.currentTarget;
            if (video.paused) {
              video.play().catch(() => {
                if (!document.hidden) setFailed(true);
              });
            }
          }}
        >
          <source src={WEBM} type="video/webm" />
          <source src={MP4} type="video/mp4" />
        </video>
      )}
      <div className="flame-vignette" />
    </div>
  );
}
