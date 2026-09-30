import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';

function CameraVideo({ stream, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return undefined;
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => {});
    return undefined;
  }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted />;
}

export default function CameraHero({ cameras, streams, audioName }) {
  const navigate = useNavigate();

  if (!cameras || cameras.length === 0) return null;

  const featured = cameras[0];
  const thumbs = cameras.slice(1);
  const go = () => navigate('/cameras');

  return (
    <div className="camera-hero">
      <div
        className="camera-hero__main"
        onClick={go}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
        aria-label="Open cameras"
      >
        <CameraVideo stream={streams[featured.name]} className="camera-hero__video" />
        <span className="camera-hero__tag">{featured.name}</span>
        {audioName && (
          <span className="camera-hero__mic" aria-hidden="true">
            <Mic size={18} strokeWidth={1.7} />
          </span>
        )}
      </div>
      {thumbs.length > 0 && (
        <div className="camera-hero__strip">
          {thumbs.map((c) => {
            const s = streams[c.name];
            return (
              <button
                key={c.id}
                type="button"
                className={'camera-hero__thumb' + (s ? '' : ' camera-hero__thumb--bad')}
                onClick={go}
                aria-label={`Open cameras`}
              >
                <CameraVideo stream={s} className="camera-hero__thumb-video" />
                <span className="camera-hero__tag camera-hero__tag--sm">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="camera-hero__foot">
        <button type="button" className="camera-hero__all" onClick={go}>
          View all cameras ›
        </button>
      </div>
    </div>
  );
}
