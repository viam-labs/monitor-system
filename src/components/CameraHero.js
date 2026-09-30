import React, { useEffect, useRef, useState } from 'react';

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

export default function CameraHero({ cameras, streams }) {
  const [featuredName, setFeaturedName] = useState('');

  useEffect(() => {
    if (!featuredName && cameras.length > 0) setFeaturedName(cameras[0].name);
  }, [cameras, featuredName]);

  if (!cameras || cameras.length === 0) return null;

  const featured = cameras.find((c) => c.name === featuredName) || cameras[0];
  const thumbs = cameras.filter((c) => c.name !== featured.name);

  return (
    <div className="camera-hero">
      <div className="camera-hero__main">
        <CameraVideo stream={streams[featured.name]} className="camera-hero__video" />
        <span className="camera-hero__label">{featured.name}</span>
      </div>
      {thumbs.length > 0 && (
        <div className="camera-hero__strip">
          {thumbs.map((c) => (
            <button
              key={c.id}
              type="button"
              className="camera-hero__thumb"
              onClick={() => setFeaturedName(c.name)}
              aria-label={`Show ${c.name}`}
            >
              <CameraVideo stream={streams[c.name]} className="camera-hero__thumb-video" />
              <span className="camera-hero__thumb-label">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
