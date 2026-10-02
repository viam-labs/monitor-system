import React, { useCallback, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Play, Pause, SkipBack, SkipForward, Volume2,
} from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Music.css';

const SCRUB_DEBOUNCE_MS = 150;

export default function MusicPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    musicName,
    loading: connectionLoading,
    detectingFeatures,
    music: m,
  } = ctx;

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

  const scrubTimer = useRef(null);
  const onVolClick = useCallback((e) => {
    if (!m?.setVolume) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const clamped = Math.max(0, Math.min(100, pct));
    if (scrubTimer.current) clearTimeout(scrubTimer.current);
    scrubTimer.current = setTimeout(() => m.setVolume(clamped).catch(() => {}), SCRUB_DEBOUNCE_MS);
  }, [m]);

  if (connectionLoading || detectingFeatures) {
    return (
      <div className="music">
        <TopNav availability={availability} />
        <div className="music__body"><div className="music-loader">🐾 🐾 🐾</div></div>
        <BottomTabBar />
      </div>
    );
  }

  if (!musicName) {
    return (
      <div className="music">
        <TopNav availability={availability} />
        <div className="music__body">
          <div className="music-stub">
            <h1 className="music__title">Music</h1>
            <p>Needs a <code>joseph:spotify:controller</code> component on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const status = m?.status;
  const track = status?.track;
  const playing = !!status?.is_playing;
  const deviceFound = !!status?.device_found;
  const deviceName = status?.device_name || 'Speaker';
  const volume = typeof status?.volume === 'number' ? status.volume : 0;
  const artists = (track?.artists || []).filter(Boolean).join(', ');

  const nowTitle = track?.name || 'Nothing playing';
  const nowSub = track?.name ? (artists || null) : (deviceFound ? 'pick a playlist below' : 'speaker is off');

  const PlayPauseIcon = playing ? Pause : Play;

  return (
    <div className="music">
      <TopNav availability={availability} />
      <div className="music__body">
        <div className="music__narrow">
          {mobile && (
            <button
              type="button"
              className="music__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="music__title">Music</h1>
          <p className="music__lede">{deviceName} · Spotify</p>

          {m.error && <div className="music__banner">{m.error}</div>}

          <div className="music__np">
            <div className="music__art" aria-hidden="true" />
            <div className="music__np-tx">
              <div className={'music__nptitle' + (track ? '' : ' music__nptitle--empty')}>{nowTitle}</div>
              {nowSub && <div className="music__sb">{nowSub}</div>}
            </div>
          </div>

          <div className="music__transport">
            <button
              type="button"
              className="music__tbtn"
              disabled={m.busy || !deviceFound}
              onClick={() => m.previous().catch(() => {})}
              aria-label="Previous"
            ><SkipBack size={18} /></button>
            <button
              type="button"
              className="music__tbtn music__tbtn--big"
              disabled={m.busy || !deviceFound}
              onClick={() => m.toggle().catch(() => {})}
              aria-label={playing ? 'Pause' : 'Play'}
            ><PlayPauseIcon size={23} /></button>
            <button
              type="button"
              className="music__tbtn"
              disabled={m.busy || !deviceFound}
              onClick={() => m.next().catch(() => {})}
              aria-label="Next"
            ><SkipForward size={18} /></button>
          </div>

          <div className="music__vol">
            <Volume2 size={19} className="music__vol-ic" />
            <div
              className="music__vol-track"
              role="slider"
              aria-label="Volume"
              aria-valuenow={volume}
              aria-valuemin={0}
              aria-valuemax={100}
              onClick={onVolClick}
            >
              <div className="music__vol-fill" style={{ width: `${volume}%` }} />
            </div>
          </div>

          <div className={'music__row' + (deviceFound ? '' : ' music__row--dead')}>
            <div className="music__tx">
              <div className="music__nm">{deviceName}</div>
              <div className="music__sb">
                {deviceFound ? 'connected · bluetooth' : 'off · turn it on by hand'}
              </div>
            </div>
          </div>

          <p className="music__sect">Start playing</p>
          {m.playlistsLoading && !m.playlists && (
            <div className="music__row"><div className="music__tx"><div className="music__sb">Loading playlists…</div></div></div>
          )}
          {m.playlists && m.playlists.length === 0 && (
            <div className="music__row"><div className="music__tx"><div className="music__sb">No playlists on your Spotify account.</div></div></div>
          )}
          {m.playlists && m.playlists.map((p) => (
            <div key={p.uri} className="music__row">
              <div className="music__tx">
                <div className="music__nm">{p.name}</div>
                {typeof p.track_count === 'number' && (
                  <div className="music__sb">{p.track_count} tracks</div>
                )}
              </div>
              <button
                type="button"
                className="music__act"
                disabled={m.busy || !deviceFound}
                onClick={() => m.start(p.uri).catch(() => {})}
              >Play</button>
            </div>
          ))}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
