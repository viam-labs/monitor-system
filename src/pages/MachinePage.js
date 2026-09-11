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
      <circle cx="25" cy="38" r="9" />
      <circle cx="42" cy="22" r="9" />
      <circle cx="58" cy="22" r="9" />
      <circle cx="75" cy="38" r="9" />
      <path d="M50 52 C 28 52, 22 68, 28 84 C 33 93, 42 96, 50 96 C 58 96, 67 93, 72 84 C 78 68, 72 52, 50 52 Z" />
    </svg>
  );
}

function MachinePage() {
  const host = window.location.pathname.split('/')[2];
  const machineName = machineNameFromHost(host);

  useEffect(() => {
    document.title = machineName.charAt(0).toUpperCase() + machineName.slice(1);
  }, [machineName]);

  return (
    <>
      <Paw className="paw--tl" />
      <Paw className="paw--tr" />
      <Paw className="paw--bl" />
      <Paw className="paw--br" />
      <div className="page">
        <CameraViewer />
      </div>
    </>
  );
}

export default MachinePage;
