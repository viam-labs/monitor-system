import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Music.css';

const VOLUME_DEBOUNCE_MS = 250;

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

  const status = m?.status;
  const serverVolume = typeof status?.volume === 'number' ? status.volume : null;
  const [sliderValue, setSliderValue] = useState(serverVolume ?? 60);
  const [sliderDirty, setSliderDirty] = useState(false);
  const debounceRef = useRef(null);

  // Keep the slider in sync with the server while the user isn't dragging —
  // otherwise an in-flight poll would snap the thumb away mid-drag.
  useEffect(() => {
    if (!sliderDirty && serverVolume != null) {
      setSliderValue(serverVolume);
    }
  }, [serverVolume, sliderDirty]);

  const commitVolume = useCallback(
    async (v) => {
      try {
        await m.setVolume(v);
      } catch {
        /* surfaced in m.error */
      } finally {
        setSliderDirty(false);
      }
    },
    [m]
  );

  const onSliderChange = (e) => {
    const v = Number(e.target.value);
    setSliderValue(v);
    setSliderDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitVolume(v), VOLUME_DEBOUNCE_MS);
  };

  if (connectionLoading || detectingFeatures) {
    return (
      <div className="music">
        <TopNav availability={availability} />
        <div className="music__body">
          <div className="music-loader">🐾 🐾 🐾</div>
        </div>
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

  const track = status?.track;
  const playing = !!status?.is_playing;
  const deviceFound = !!status?.device_found;
  const deviceActive = !!status?.device_active;
  const artists = (track?.artists || []).filter(Boolean).join(', ');

  let lede;
  if (!deviceFound) {
    lede = `${status?.device_name || 'speaker'} · off`;
  } else if (playing) {
    lede = `${status?.device_name || 'speaker'} · playing`;
  } else {
    lede = `${status?.device_name || 'speaker'} · paused`;
  }

  const bigLabel = playing ? 'Stop' : 'Play';
  const BigIcon = playing ? Pause : Play;

  return (
    <div className="music">
      <TopNav availability={availability} />
      <div className="music__body">
        <div className="music__wide">
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
          <p className="music__lede">{lede}</p>

          {m.error && <div className="music__banner">{m.error}</div>}

          <div className="music__cols">
            <div className="music__col">
              <div className="music__block music__nowplaying">
                {track ? (
                  <>
                    <div className="music__track">{track.name}</div>
                    {artists && <div className="music__artists">{artists}</div>}
                  </>
                ) : (
                  <div className="music__track music__track--empty">Nothing playing</div>
                )}
              </div>

              <div className="music__block music__controls">
                <button
                  type="button"
                  className="music__ctrl music__ctrl--sm"
                  disabled={m.busy || !deviceActive}
                  onClick={() => m.previous().catch(() => {})}
                  aria-label="Previous track"
                >
                  <SkipBack size={20} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={'music__ctrl music__ctrl--big' + (playing ? ' music__ctrl--playing' : '')}
                  disabled={m.busy || !deviceFound}
                  onClick={() => m.toggle().catch(() => {})}
                  aria-label={bigLabel}
                >
                  <BigIcon size={32} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="music__ctrl music__ctrl--sm"
                  disabled={m.busy || !deviceActive}
                  onClick={() => m.next().catch(() => {})}
                  aria-label="Next track"
                >
                  <SkipForward size={20} strokeWidth={2} />
                </button>
              </div>

              <div className="music__block">
                <p className="music__sect">Volume</p>
                <div className="music__volume">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={sliderValue}
                    disabled={!deviceFound}
                    onChange={onSliderChange}
                    aria-label="Volume"
                  />
                  <span className="music__volume-val">{sliderValue}</span>
                </div>
              </div>
            </div>

            <div className="music__col">
              <div className="music__block">
                <p className="music__sect">Playlists</p>
                {m.playlistsLoading && !m.playlists && (
                  <p className="music__dim">Loading playlists…</p>
                )}
                {m.playlists && m.playlists.length === 0 && (
                  <p className="music__dim">No playlists found on your Spotify account.</p>
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
              </div>

              <div className="music__block">
                <p className="music__sect">Speaker</p>
                <div className="music-row">
                  <div className="music-row__tx">
                    <div className="music-row__nm">{status?.device_name || 'Speaker'}</div>
                    <div className="music-row__sb">
                      {deviceFound
                        ? (deviceActive ? 'connected' : 'available')
                        : 'off · turn it on by hand'}
                    </div>
                  </div>
                </div>
                {!deviceFound && (
                  <p className="music__hint">
                    Bluetooth can't wake the speaker from off. A finger bot on
                    the power button will handle this once wired up.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
