import React, { useState } from 'react';

export default function ItemForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const initialHasSupply = initial.package_qty != null;
  const initialHasRoutine = !!initial.routine;

  const [name, setName] = useState(initial.name || '');
  const [supplyOn, setSupplyOn] = useState(initialHasSupply || !initialHasRoutine);
  const [routineOn, setRoutineOn] = useState(initialHasRoutine);
  const [packageQty, setPackageQty] = useState(
    initial.package_qty != null ? String(initial.package_qty) : '1',
  );
  const [intervalDays, setIntervalDays] = useState(
    initial.routine?.interval_days != null ? String(initial.routine.interval_days) : '1',
  );
  const [deckSlot, setDeckSlot] = useState(
    initial.button?.slot != null ? String(initial.button.slot) : '',
  );
  const [barcode, setBarcode] = useState(initial.barcode || '');

  const submit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!supplyOn && !routineOn) return;
    const payload = {
      name: trimmedName,
      barcode: barcode.trim() || null,
    };
    if (supplyOn) {
      const pkg = Number(packageQty);
      if (!Number.isInteger(pkg) || pkg <= 0) return;
      payload.package_qty = pkg;
    } else {
      payload.package_qty = null;
    }
    if (routineOn) {
      const days = Number(intervalDays);
      if (!Number.isInteger(days) || days <= 0) return;
      payload.routine = {
        interval_days: days,
        last_done_at: initial.routine?.last_done_at ?? null,
      };
    } else {
      payload.routine = null;
    }
    if (deckSlot !== '') {
      const s = Number(deckSlot);
      if (!Number.isInteger(s) || s < 0) return;
      payload.button = { device: 'kitchen', slot: s };
    } else {
      payload.button = null;
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

      <label className="item-form__capability">
        <input
          type="checkbox"
          checked={supplyOn}
          onChange={e => setSupplyOn(e.target.checked)}
          disabled={busy}
        />
        <span>Track supply (count)</span>
      </label>
      {supplyOn && (
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
      )}

      <label className="item-form__capability">
        <input
          type="checkbox"
          checked={routineOn}
          onChange={e => setRoutineOn(e.target.checked)}
          disabled={busy}
        />
        <span>Track routine (schedule)</span>
      </label>
      {routineOn && (
        <label className="automation-form__field">
          <span className="automation-form__label">Every N days</span>
          <input
            type="number"
            min="1"
            step="1"
            value={intervalDays}
            onChange={e => setIntervalDays(e.target.value)}
            disabled={busy}
          />
        </label>
      )}

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
          disabled={busy || (!supplyOn && !routineOn)}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
