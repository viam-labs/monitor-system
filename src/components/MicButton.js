import React, { useState, useRef, useEffect } from 'react';
import { AudioInClient, AudioCodec } from '@viamrobotics/sdk';

// Pull ~100ms chunks from the audio_input resource, decode PCM16 into
// Float32 samples, and schedule each chunk on the Web Audio timeline so
// they play back-to-back. Small lead so the first chunks land before
// the audio clock catches up (avoids initial underruns).
async function streamAudio(audioIn, audioCtx, signal) {
  const props = await audioIn.getProperties();
  const numChannels = props.numChannels;
  const sampleRate = props.sampleRateHz;

  const iter = audioIn.getAudio(AudioCodec.PCM16, 0.1);
  let nextStartTime = audioCtx.currentTime + 0.15;

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
  }
}

export default function MicButton({ client, audioName }) {
  const [listening, setListening] = useState(false);
  const audioCtxRef = useRef(null);
  const abortRef = useRef(null);

  const toggle = async () => {
    if (listening) {
      abortRef.current?.abort();
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      abortRef.current = null;
      setListening(false);
      return;
    }

    try {
      const audioIn = new AudioInClient(client, audioName);
      const props = await audioIn.getProperties();
      // Match ctx sample rate to mic so we don't resample.
      audioCtxRef.current = new AudioContext({ sampleRate: props.sampleRateHz });
      abortRef.current = new AbortController();
      setListening(true);
      streamAudio(audioIn, audioCtxRef.current, abortRef.current.signal)
        .catch(e => console.error('Audio stream error:', e))
        .finally(() => setListening(false));
    } catch (e) {
      console.error('Failed to start audio:', e);
      setListening(false);
    }
  };

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
      onClick={toggle}
      aria-label={listening ? 'Stop listening' : 'Listen to microphone'}
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
