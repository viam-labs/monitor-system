import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AudioInClient, AudioCodec } from '@viamrobotics/sdk';

// getAudio(codec, durationSeconds) returns a stream that ends after
// durationSeconds of audio. Loop it, passing the last chunk's end
// timestamp so we don't miss or duplicate audio between calls.
// 3s per call keeps latency low and reconnects are frequent enough that
// a dead peer surfaces quickly.
async function streamAudio(audioIn, audioCtx, signal) {
  const props = await audioIn.getProperties();
  const numChannels = props.numChannels;
  const sampleRate = props.sampleRateHz;

  let nextStartTime = audioCtx.currentTime + 0.15;
  let previousTimestamp = 0n;

  while (!signal.aborted) {
    const iter = audioIn.getAudio(AudioCodec.PCM16, 3, previousTimestamp);
    for await (const chunk of iter) {
      if (signal.aborted) break;

      const bytes = chunk.audioData;
      const numSamples = bytes.length / (2 * numChannels);
      const buffer = audioCtx.createBuffer(numChannels, numSamples, sampleRate);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < numSamples; i++) {
          const sample = view.getInt16((i * numChannels + ch) * 2, true);
          channelData[i] = sample / 32768;
        }
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      const when = Math.max(audioCtx.currentTime, nextStartTime);
      source.start(when);
      nextStartTime = when + buffer.duration;
      previousTimestamp = chunk.endTimeNs;
    }
  }
}

export default function MicButton({ client, audioName }) {
  const [listening, setListening] = useState(false);
  const audioCtxRef = useRef(null);
  const abortRef = useRef(null);

  const start = useCallback(async () => {
    if (audioCtxRef.current) return; // already running
    try {
      const audioIn = new AudioInClient(client, audioName);
      const props = await audioIn.getProperties();
      // Match ctx sample rate to mic so we don't resample.
      audioCtxRef.current = new AudioContext({ sampleRate: props.sampleRateHz });
      abortRef.current = new AbortController();
      setListening(true);
      streamAudio(audioIn, audioCtxRef.current, abortRef.current.signal)
        .catch(e => console.error('Audio stream error:', e))
        .finally(() => {
          audioCtxRef.current?.close();
          audioCtxRef.current = null;
          abortRef.current = null;
          setListening(false);
        });
    } catch (e) {
      console.error('Failed to start audio:', e);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setListening(false);
    }
  }, [client, audioName]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    abortRef.current = null;
    setListening(false);
  }, []);

  // Default the mic on: browsers require a user gesture before audio
  // can play, so we hook the first click / touch anywhere on the page
  // and use that gesture to unlock the AudioContext.
  useEffect(() => {
    if (!client || !audioName) return;
    const kick = () => start();
    document.addEventListener('click', kick, { once: true });
    document.addEventListener('touchstart', kick, { once: true, passive: true });
    return () => {
      document.removeEventListener('click', kick);
      document.removeEventListener('touchstart', kick);
    };
  }, [client, audioName, start]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      audioCtxRef.current?.close();
    };
  }, []);

  return (
    <button
      type="button"
      className={`mic-button${listening ? ' mic-button--on' : ''}`}
      onClick={listening ? stop : start}
      aria-label={listening ? 'Mute microphone' : 'Listen to microphone'}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path
          d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
