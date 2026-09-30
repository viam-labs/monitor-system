import React, { useState } from 'react';

export default function ItemForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || '');
  const [packageQty, setPackageQty] = useState(
    initial.package_qty != null ? String(initial.package_qty) : '1',
  );
  const [deckSlot, setDeckSlot] = useState(
    initial.deck_slot != null ? String(initial.deck_slot) : '',
  );
  const [barcode, setBarcode] = useState(initial.barcode || '');

  const submit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedBarcode = barcode.trim();
    if (!trimmedName) return;
    const pkg = Number(packageQty);
    if (!Number.isInteger(pkg) || pkg <= 0) return;
    const payload = {
      name: trimmedName,
      package_qty: pkg,
      barcode: trimmedBarcode || null,
    };
    if (deckSlot !== '') {
      const s = Number(deckSlot);
      if (!Number.isInteger(s) || s < 0) return;
      payload.deck_page = 0;
      payload.deck_slot = s;
    } else {
      payload.deck_page = null;
      payload.deck_slot = null;
    }
    if (initial.id) payload.id = initial.id;
    onSubmit(payload);
  };

  return (
    <form className="automation-card__form" onSubmit={submit}>
      <label className="automation-form__field">
        <span className="automation-form__label">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={busy}
          maxLength={60}
          required
        />
      </label>

      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Add per scan</span>
          <input
            type="number"
            min="1"
            step="1"
            value={packageQty}
            onChange={e => setPackageQty(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Deck slot</span>
          <input
            type="number"
            min="0"
            step="1"
            value={deckSlot}
            onChange={e => setDeckSlot(e.target.value)}
            disabled={busy}
            placeholder="—"
          />
        </label>
      </div>

      <label className="automation-form__field">
        <span className="automation-form__label">Barcode</span>
        <input
          type="text"
          value={barcode}
          onChange={e => setBarcode(e.target.value)}
          disabled={busy}
          maxLength={32}
          placeholder="—"
        />
      </label>

      <div className="automation-card__actions">
        {onCancel && (
          <button
            type="button"
            className="feeder-secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
        <span className="automation-card__spacer" />
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={busy}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
