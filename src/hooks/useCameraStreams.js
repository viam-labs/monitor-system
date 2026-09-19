import { useEffect, useState } from 'react';
import { StreamClient } from '@viamrobotics/sdk';

// Starts WebRTC video streams on mount and stops them on unmount.
// Keeping streams alive across the whole MachinePage cost iPhone
// Safari real CPU + bandwidth even when the user was on /feeder or
// /door with no video showing. Scoping stream lifetime to the page
// that actually renders them keeps other pages cheap.
export function useCameraStreams(client, cameras) {
  const [streams, setStreams] = useState({});

  useEffect(() => {
    if (!client || !cameras || cameras.length === 0) return undefined;
    let cancelled = false;
    const started = {};
    const streamClient = new StreamClient(client);

    cameras.forEach((cam) => {
      streamClient
        .getStream(cam.name)
        .then((stream) => {
          if (cancelled) {
            stream?.getTracks().forEach((t) => t.stop());
            return;
          }
          started[cam.name] = stream;
          setStreams((prev) => ({ ...prev, [cam.name]: stream }));
        })
        .catch((e) => {
          console.error(`Failed to start stream for ${cam.name}:`, e);
        });
    });

    return () => {
      cancelled = true;
      Object.values(started).forEach((s) =>
        s?.getTracks().forEach((t) => t.stop()),
      );
      setStreams({});
    };
  }, [client, cameras]);

  return streams;
}
