import React, { useEffect, useRef } from 'react';

// Renders a single camera stream as a 16:9 card, matching other
// .feeder-card elements on a page. Nothing renders if the named
// camera isn't among the machine's discovered cameras or if its
// stream hasn't opened yet.
export default function PageCamera({ cameras, streams, cameraName }) {
  const videoRef = useRef(null);
  const hasCamera = (cameras || []).some(c => c.name === cameraName);
  const stream = streams ? streams[cameraName] : null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  if (!hasCamera) return null;

  return (
    <section className="feeder-card page-camera">
      <video ref={videoRef} autoPlay playsInline muted />
    </section>
  );
}
