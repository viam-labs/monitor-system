import React from 'react';
import CameraViewer from '../components/CameraViewer';

// Hostnames look like <machine-name>-main.<org-shortcode>.viam.cloud.
// Machine name is the slug before "-main.". Falls back to the raw host
// if the format doesn't match.
function machineNameFromHost(host) {
  const match = host.match(/^(.+)-main\..+\.viam\.cloud$/);
  return match ? match[1] : host;
}

function MachinePage() {
  const host = window.location.pathname.split('/')[2];
  const machineName = machineNameFromHost(host);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(12px, 3vw, 24px)',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ margin: '0 0 16px', textTransform: 'capitalize' }}>{machineName}</h1>
      <CameraViewer machineId={host} />
    </div>
  );
}

export default MachinePage;
