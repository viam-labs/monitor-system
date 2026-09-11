import React, { useEffect } from 'react';
import CameraViewer from '../components/CameraViewer';

// Two hostname shapes seen in the wild:
//   <name>-main.<org>.viam.cloud   (machine + main-part slug)
//   <name>.<org>.viam.cloud        (short form)
// Take the leading label, then trim an optional -main suffix.
function machineNameFromHost(host) {
  const first = host.split('.')[0];
  return first.replace(/-main$/, '');
}

function Paw({ className }) {
  return (
    <svg
      className={`paw ${className}`}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="25" cy="35" rx="9" ry="12" />
      <ellipse cx="42" cy="22" rx="9" ry="12" />
      <ellipse cx="58" cy="22" rx="9" ry="12" />
      <ellipse cx="75" cy="35" rx="9" ry="12" />
      <path d="M50 45 Q 25 50 30 80 Q 40 95 50 95 Q 60 95 70 80 Q 75 50 50 45 Z" />
    </svg>
  );
}

function MachinePage() {
  const host = window.location.pathname.split('/')[2];
  const machineName = machineNameFromHost(host);

  useEffect(() => {
    const title = machineName.charAt(0).toUpperCase() + machineName.slice(1);
    document.title = `${title} — monitor-system`;
  }, [machineName]);

  return (
    <>
      <Paw className="paw--tl" />
      <Paw className="paw--tr" />
      <Paw className="paw--bl" />
      <Paw className="paw--br" />
      <div className="page">
        <h1 style={{ textTransform: 'capitalize' }}>{machineName}</h1>
        <CameraViewer />
      </div>
    </>
  );
}

export default MachinePage;
