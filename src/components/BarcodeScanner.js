import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const VIEWPORT_ID = 'inventory-barcode-viewport';

const FOOD_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
];

export default function BarcodeScanner({ open, onScan, onClose }) {
  const scannerRef = useRef(null);
  const handlerRef = useRef(onScan);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    handlerRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return undefined;
    setStatus('starting');
    setError(null);
    const scanner = new Html5Qrcode(VIEWPORT_ID, {
      verbose: false,
      formatsToSupport: FOOD_BARCODE_FORMATS,
    });
    scannerRef.current = scanner;

    let stopped = false;
    const stopScanner = async () => {
      if (stopped) return;
      stopped = true;
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch { /* ignored — already stopping */ }
      try { scanner.clear(); } catch { /* ignored */ }
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => {
          if (stopped) return;
          stopScanner().then(() => handlerRef.current?.(decoded));
        },
        () => { /* per-frame scan failure, ignore */ },
      )
      .then(() => setStatus('scanning'))
      .catch((err) => {
        setStatus('error');
        setError(err?.message || String(err));
      });

    return () => { stopScanner(); };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="barcode-scanner"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
    >
      <div className="barcode-scanner__bar">
        <button
          type="button"
          className="feeder-secondary-button"
          onClick={onClose}
        >
          Cancel
        </button>
        <span className="barcode-scanner__hint">
          {status === 'starting' && 'Starting camera…'}
          {status === 'scanning' && 'Point the camera at a barcode'}
          {status === 'error' && (error || 'Camera unavailable')}
        </span>
      </div>
      <div id={VIEWPORT_ID} className="barcode-scanner__viewport" />
    </div>
  );
}
