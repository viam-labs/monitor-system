import React, { useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import MicButton from '../../components/MicButton';
import './Cameras.css';

function CameraTile({ camera, stream }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return undefined;
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => {});
    return undefined;
  }, [stream]);

  const cls = 'cam-tile' + (stream ? '' : ' cam-tile--bad');
  return (
    <div className={cls}>
      <video ref={videoRef} autoPlay playsInline muted />
      <span className="cam-tile__tag">{camera.name}</span>
    </div>
  );
}

export default function Cameras() {
  const ctx = useOutletContext();
  const { cameras = [], streams = {}, audioName, client } = ctx;

  useEffect(() => {
    const kick = () => {
      document.querySelectorAll('video').forEach((v) => {
        v.muted = true;
        v.play().catch(() => {});
      });
    };
    document.addEventListener('click', kick, { once: true });
    document.addEventListener('touchstart', kick, { once: true, passive: true });
    return () => {
      document.removeEventListener('click', kick);
      document.removeEventListener('touchstart', kick);
    };
  }, []);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  const offlineCount = cameras.filter((c) => !streams[c.name]).length;
  const countLabel = `${cameras.length} camera${cameras.length === 1 ? '' : 's'}`;
  const lede = offlineCount > 0
    ? `${countLabel} · ${offlineCount} offline`
    : countLabel;

  return (
    <div className="cameras">
      <TopNav availability={availability} />
      <div className="cameras__body">
        <div className="cameras__wide">
          <h1 className="cameras__title">Cameras</h1>
          <p className="cameras__lede">{cameras.length === 0 ? 'No cameras' : lede}</p>
          {cameras.length > 0 && (
            <div className="cameras__grid">
              {cameras.map((c) => (
                <CameraTile key={c.id} camera={c} stream={streams[c.name]} />
              ))}
            </div>
          )}
        </div>
      </div>
      {audioName && client && <MicButton client={client} audioName={audioName} />}
      <BottomTabBar />
    </div>
  );
}
