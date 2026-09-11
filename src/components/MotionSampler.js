import React, { useEffect, useRef } from 'react';

// Sampling constants live here so they're colocated with the code that
// uses them; CameraViewer's decision loop uses its own threshold.
const SAMPLE_INTERVAL_MS = 500;
const PIXEL_DIFF_THRESHOLD = 100; // brightness delta per pixel (0-765)

// Hidden video element that streams the same MediaStream as its visible
// tile, purely for motion detection. Always mounted in auto mode so we
// can detect activity on cameras that aren't currently in the grid.
// Off-screen via absolute positioning (display: none pauses decoding
// in some browsers).
export default function MotionSampler({ name, stream, motionRef }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    // WebRTC frames delivered to a MediaStreamTrack seem to only reach
    // one <video> element at a time — the visible tile got frames, the
    // sampler bound to the same stream got only the initial keyframe
    // and then getImageData saw the same frame forever. Cloning the
    // track gives the sampler its own independent frame delivery.
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
      return;
    }
    let clonedTrack;
    try {
      clonedTrack = videoTrack.clone();
    } catch (_) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
      return;
    }
    const clonedStream = new MediaStream([clonedTrack]);
    videoRef.current.srcObject = clonedStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch(() => {});
    return () => {
      clonedTrack.stop();
    };
  }, [stream]);

  useEffect(() => {
    const motion = motionRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let prev = null;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      try {
        ctx.drawImage(video, 0, 0, 160, 90);
        const cur = ctx.getImageData(0, 0, 160, 90);
        if (prev) {
          let diff = 0;
          const data = cur.data;
          const pdata = prev.data;
          for (let i = 0; i < data.length; i += 4) {
            const c = data[i] + data[i + 1] + data[i + 2];
            const p = pdata[i] + pdata[i + 1] + pdata[i + 2];
            if (Math.abs(c - p) > PIXEL_DIFF_THRESHOLD) diff++;
          }
          const level = diff / (canvas.width * canvas.height);
          const previous = motion[name] || 0;
          motion[name] = previous * 0.6 + level * 0.4;
        }
        prev = cur;
      } catch (_) {
        // Canvas taint or video not ready; ignore.
      }
    };

    const id = setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      delete motion[name];
    };
  }, [name, motionRef]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '160px',
        height: '90px',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
