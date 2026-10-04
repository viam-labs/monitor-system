import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useMachineInfo } from '../../hooks/useMachineInfo';
import { formatRelative } from '../../lib/format';
import './System.css';

function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  const rMin = min % 60;
  if (hr < 24) return rMin ? `${hr} hr ${rMin} min` : `${hr} hr`;
  const d = Math.floor(hr / 24);
  const rHr = hr % 24;
  return rHr ? `${d} d ${rHr} hr` : `${d} d`;
}

function statusLine(part) {
  if (part.status === 'offline') {
    return `offline for ${fmtDuration(part.offlineForMs)}`;
  }
  if (part.status === 'awaiting_setup') {
    return 'awaiting setup';
  }
  const rel = formatRelative(part.lastAccessAt);
  return rel ? `last reported ${rel}` : 'online';
}

export default function SystemPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const { parts, offlineCount } = useMachineInfo();

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/music': !!ctx.musicName,
    '/door': !!ctx.doorUnlockName,
  };

  const totalParts = parts.length;
  const totalComponents = parts.reduce((n, p) => n + (p.components?.length || 0), 0);
  const partsFragment = totalParts === 1 ? '1 part' : `${totalParts} parts`;
  const offlineFragment = offlineCount > 0 ? ` · ${offlineCount} offline` : '';
  const componentsFragment = !mobile && totalComponents > 0
    ? ` · ${totalComponents} components`
    : '';
  const lede = totalParts
    ? `${partsFragment}${offlineFragment}${componentsFragment}`
    : 'loading…';

  return (
    <div className="system">
      <TopNav availability={availability} />
      <div className="system__body">
        <div className="system__wide">
          {mobile && (
            <button
              type="button"
              className="system__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="system__title">System</h1>
          <p className="system__lede">{lede}</p>

          <p className="system__sect">Parts</p>
          {parts.map((p) => (
            <div
              key={p.id}
              className={'system-part system-part--' + p.status}
            >
              <div className="system-part__nm">{p.name}</div>
              <div className="system-part__sb">{statusLine(p)}</div>
              {!mobile && p.components?.length > 0 && (
                <div className="system-part__cmp">{p.components.join(' · ')}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
