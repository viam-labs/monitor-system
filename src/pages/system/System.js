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

export default function SystemPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const { parts, offlineCount, loading, error, refresh } = useMachineInfo();

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
  const lede = totalParts
    ? `${totalParts} part${totalParts === 1 ? '' : 's'}`
      + (offlineCount > 0 ? ` · ${offlineCount} offline` : ' · all online')
    : 'loading…';

  const firstOffline = parts.find((p) => p.status === 'offline');
  const mainOffline = parts.find((p) => p.mainPart && p.status === 'offline');

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

          {error && (
            <div className="system__err">Couldn't reach Viam cloud: {error}</div>
          )}

          {firstOffline && (
            <div className="system__alert">
              <div className="system__alert__nm">{firstOffline.name} offline</div>
              <div className="system__alert__sb">
                last seen {formatRelative(firstOffline.lastAccessAt) || 'never'}
                {firstOffline.offlineForMs
                  ? ` · ${fmtDuration(firstOffline.offlineForMs)}`
                  : ''}
              </div>
              {mainOffline && (
                <p className="system__alert__body">
                  The main part isn't reporting. The webapp can't reach anything
                  on this part until it comes back — pages that depend on it
                  will show stale or empty data.
                </p>
              )}
            </div>
          )}

          <p className="system__sect">Parts</p>
          {loading && parts.length === 0 ? (
            <p className="system__empty">loading…</p>
          ) : (
            parts.map((p) => (
              <div key={p.id} className="system-row">
                <div className="system-row__tx">
                  <div className="system-row__nm">
                    {p.name}
                    {p.mainPart && <span className="system-row__badge">main</span>}
                  </div>
                  <div className="system-row__sb">
                    {p.status === 'online' && (
                      <>online · last check-in {formatRelative(p.lastAccessAt) || '—'}</>
                    )}
                    {p.status === 'offline' && (
                      <>offline for {fmtDuration(p.offlineForMs)} · last {formatRelative(p.lastAccessAt) || '—'}</>
                    )}
                    {p.status === 'awaiting_setup' && (
                      <>awaiting setup · never connected</>
                    )}
                  </div>
                </div>
                <span className={`system-row__amt system-row__amt--${p.status}`}>
                  {p.status === 'online' ? 'ok' : p.status === 'offline' ? 'offline' : 'setup'}
                </span>
              </div>
            ))
          )}

          <button
            type="button"
            className="system__refresh"
            onClick={refresh}
            disabled={loading}
          >
            ↻ refresh
          </button>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
