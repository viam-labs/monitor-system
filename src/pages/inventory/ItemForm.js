import React, { useEffect, useState } from 'react';

export default function NewItemSheet({
  open, initialGroup, existingGroups, busy, onSubmit, onCancel,
}) {
  const [showing, setShowing] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(initialGroup || 'kitchen');
  const [customGroup, setCustomGroup] = useState('');
  const [startingCount, setStartingCount] = useState('1');
  const [lowAt, setLowAt] = useState('1');

  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setGroup(initialGroup || existingGroups[0] || 'kitchen');
    setCustomGroup('');
    setStartingCount('1');
    setLowAt('1');
    const id = requestAnimationFrame(() => setShowing(true));
    return () => {
      cancelAnimationFrame(id);
      setShowing(false);
    };
  }, [open, initialGroup, existingGroups]);

  const close = () => {
    if (busy) return;
    setShowing(false);
    setTimeout(onCancel, 180);
  };

  const submit = (e) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const qty = Number(startingCount);
    const low = lowAt === '' ? null : Number(lowAt);
    if (!Number.isInteger(qty) || qty < 0) return;
    if (low !== null && (!Number.isInteger(low) || low < 0)) return;
    const finalGroup = group === '__new__'
      ? customGroup.trim() || 'other'
      : group;
    onSubmit({
      name: trimmed,
      package_qty: 1,
      quantity: qty,
      threshold: low,
      button: { device: finalGroup, slot: null },
    });
  };

  if (!open) return null;

  return (
    <>
      <div className={'inv-scrim' + (showing ? ' on' : '')} onClick={close} />
      <form
        className={'inv-sheet' + (showing ? ' on' : '')}
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
      >
        <div className="inv-sheet__grab" aria-hidden="true" />
        <h2 className="inv-sheet__title">New item</h2>

        <div className="inv-field">
          <label htmlFor="ni-name">Name</label>
          <input
            id="ni-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Paper towels"
            disabled={busy}
            autoFocus
            maxLength={60}
          />
        </div>

        <div className="inv-field">
          <label htmlFor="ni-group">Group</label>
          <select
            id="ni-group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            disabled={busy}
          >
            {existingGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="__new__">New group…</option>
          </select>
        </div>

        {group === '__new__' && (
          <div className="inv-field">
            <label htmlFor="ni-custom">New group name</label>
            <input
              id="ni-custom"
              type="text"
              value={customGroup}
              onChange={(e) => setCustomGroup(e.target.value)}
              placeholder="Household"
              disabled={busy}
              maxLength={30}
            />
          </div>
        )}

        <div className="inv-frow">
          <div className="inv-field">
            <label htmlFor="ni-qty">Starting count</label>
            <input
              id="ni-qty"
              type="number"
              min="0"
              value={startingCount}
              onChange={(e) => setStartingCount(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="inv-field">
            <label htmlFor="ni-low">Low at</label>
            <input
              id="ni-low"
              type="number"
              min="0"
              value={lowAt}
              onChange={(e) => setLowAt(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <p className="inv-sheet__hint">
          Added to the end. Drag to set its Stream Deck slot.
        </p>

        <div className="inv-sheet__actions">
          <button
            type="button"
            className="inv-sheet__cancel"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inv-sheet__confirm"
            disabled={busy || !name.trim()}
          >
            {busy ? 'Adding…' : 'Add item'}
          </button>
        </div>
      </form>
    </>
  );
}
