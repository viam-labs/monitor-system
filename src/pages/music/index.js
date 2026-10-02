import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, Play, Pause } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Music.css';

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
  const deviceActive = !!status?.device_active;
  const deviceName = status?.device_name || 'Speaker';
  const volume = typeof status?.volume === 'number' ? status.volume : null;
  const artists = (track?.artists || []).filter(Boolean).join(', ');

  const nowLine1 = track?.name || 'Nothing playing';
  const nowLine2 = track?.name
    ? (artists || null)
    : (deviceFound ? 'pick a playlist to start' : 'speaker is off');

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

          <div className="music__nowplaying">
            <div className="music__nowplaying-tx">
              <div className={'music__track' + (track ? '' : ' music__track--empty')}>
                {nowLine1}
              </div>
              {nowLine2 && <div className="music__artists">{nowLine2}</div>}
            </div>
            {track && (
              <button
                type="button"
                className="music__inline-toggle"
                disabled={m.busy || !deviceFound}
                onClick={() => m.toggle().catch(() => {})}
                aria-label={playing ? 'Pause' : 'Resume'}
                title={playing ? 'Pause' : 'Resume'}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
          </div>

          <div className="music__volume">
            <span className="music__volume-label">Volume</span>
            <button
              type="button"
              className="music__volstep"
              disabled={m.busy || !deviceFound || (volume ?? 0) <= 0}
              onClick={() => m.volumeDown().catch(() => {})}
              aria-label="Volume down"
            >−</button>
            <span className="music__volume-val">{volume ?? '—'}</span>
            <button
              type="button"
              className="music__volstep"
              disabled={m.busy || !deviceFound || (volume ?? 100) >= 100}
              onClick={() => m.volumeUp().catch(() => {})}
              aria-label="Volume up"
            >+</button>
          </div>

          <p className="music__sect">Start playing</p>
          {m.playlistsLoading && !m.playlists && (
            <p className="music__dim">Loading playlists…</p>
          )}
          {m.playlists && m.playlists.length === 0 && (
            <p className="music__dim">No playlists on your Spotify account.</p>
          )}
          {m.playlists && m.playlists.map((p) => (
            <div key={p.uri} className="music-pl">
              <div className="music-pl__tx">
                <div className="music-pl__nm">{p.name}</div>
                {typeof p.track_count === 'number' && (
                  <div className="music-pl__sb">{p.track_count} tracks</div>
                )}
              </div>
              <button
                type="button"
                className="music-pl__play"
                disabled={m.busy || !deviceFound}
                onClick={() => m.start(p.uri).catch(() => {})}
              >
                Play
              </button>
            </div>
          ))}

          <p className="music__sect">Speaker</p>
          <div className="music-row">
            <div className="music-row__tx">
              <div className="music-row__nm">{deviceName}</div>
              <div className="music-row__sb">
                {deviceFound
                  ? (deviceActive ? 'connected · bluetooth' : 'available · bluetooth')
                  : 'off · turn it on by hand'}
              </div>
            </div>
          </div>
          {!deviceFound && (
            <p className="music__hint">
              Bluetooth can't wake the speaker from off. A finger bot on the
              power button will handle this once wired up.
            </p>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
