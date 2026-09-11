import React, { useState, useEffect } from 'react';
import { createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import CameraViewer from '../components/CameraViewer';

function MachinePage() {
  const machineId = window.location.pathname.split('/')[2];
  const [machineName, setMachineName] = useState('');

  useEffect(() => {
    async function fetchName() {
      try {
        const cookie = Cookies.get(machineId);
        if (!cookie) throw new Error('No auth cookie for machine');
        const { apiKey: { id: apiKeyId, key: apiKeySecret } } = JSON.parse(cookie);

        const viamClient = await createViamClient({
          serviceHost: 'https://app.viam.com',
          credentials: {
            type: 'api-key',
            authEntity: apiKeyId,
            payload: apiKeySecret,
          },
        });

        const robot = await viamClient.appClient.getRobot(machineId);
        setMachineName(robot?.name || machineId);
      } catch (e) {
        console.error('Failed to fetch machine name:', e);
        setMachineName(machineId);
      }
    }
    fetchName();
  }, [machineId]);

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
      {/* nbsp reserves height so the page doesn't jump when the name loads */}
      <h1 style={{ margin: '0 0 16px' }}>{machineName || ' '}</h1>
      <CameraViewer machineId={machineId} />
    </div>
  );
}

export default MachinePage;
