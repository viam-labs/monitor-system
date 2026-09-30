import React, { useEffect, useRef, useState } from 'react';
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
  const [featuredName, setFeaturedName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!featuredName && cameras.length > 0) setFeaturedName(cameras[0].name);
  }, [cameras, featuredName]);

  if (!cameras || cameras.length === 0) return null;

  const featured = cameras.find((c) => c.name === featuredName) || cameras[0];
  const thumbs = cameras.filter((c) => c.name !== featured.name);
  const featuredStream = streams[featured.name];

  return (
    <div className="camera-hero">
      <div
        className="camera-hero__main"
        onClick={() => navigate('/cameras')}
        role="button"
        tabIndex={0}
        aria-label="Open cameras"
      >
        <CameraVideo stream={featuredStream} className="camera-hero__video" />
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
                onClick={() => setFeaturedName(c.name)}
                aria-label={`Show ${c.name}`}
              >
                <CameraVideo stream={s} className="camera-hero__thumb-video" />
                <span className="camera-hero__tag camera-hero__tag--sm">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="camera-hero__foot">
        <button
          type="button"
          className="camera-hero__all"
          onClick={() => navigate('/cameras')}
        >
          View all cameras ›
        </button>
      </div>
    </div>
  );
}
