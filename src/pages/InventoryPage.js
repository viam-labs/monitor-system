import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';

function ItemForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
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

function CountEditor({ quantity, busy, onCommit, name }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(quantity));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(String(quantity));
  }, [quantity, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const q = Number(draft);
    if (Number.isInteger(q) && q >= 0 && q !== quantity) onCommit(q);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(quantity));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        className="inventory-row__count inventory-row__count--input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        disabled={busy}
        aria-label={`Set count for ${name}`}
      />
    );
  }

  return (
    <button
      type="button"
      className="inventory-row__count inventory-row__count--button"
      onClick={() => setEditing(true)}
      disabled={busy}
      aria-label={`Edit count for ${name} (currently ${quantity})`}
      title="Edit count"
    >
      {quantity}
    </button>
  );
}

function ItemRow({ item, busy, onIncrement, onDecrement, onSetQuantity, onSave, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="automation-card">
      <div className="automation-card__header">
        <button
          type="button"
          className="automation-card__disclose"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
          <span className="automation-card__name">{item.name}</span>
        </button>
        <div className="inventory-row__qty">
          <button
            type="button"
            className="feeder-icon-button"
            onClick={() => onDecrement(item.id)}
            disabled={busy || item.quantity === 0}
            aria-label={`Decrement ${item.name}`}
            title="−1"
          >
            −
          </button>
          <CountEditor
            quantity={item.quantity}
            busy={busy}
            onCommit={(q) => onSetQuantity(item.id, q)}
            name={item.name}
          />
          <button
            type="button"
            className="feeder-icon-button"
            onClick={() => onIncrement(item.id)}
            disabled={busy}
            aria-label={`Increment ${item.name}`}
            title="+1"
          >
            +
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <ItemForm
            initial={item}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div className="automation-card__actions">
            <span className="automation-card__spacer" />
            <button
              type="button"
              className="feeder-icon-button feeder-icon-button--danger"
              onClick={() => onDelete(item.id, item.name)}
              disabled={busy}
              aria-label={`Delete ${item.name}`}
              title="Delete"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const {
    inventoryName,
    inventoryStateSensorName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
    inventory: inv,
  } = useOutletContext();
  const stillProbing =
    !inventoryName && pendingProbes && pendingProbes.generic > 0;
  const { items, loading, error, busy } = inv;
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState({});
  const [scanOpen, setScanOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  if (connectionLoading || detectingFeatures || stillProbing) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!inventoryName || !inventoryStateSensorName) {
    return (
      <div className="stub-page">
        <h1>Inventory</h1>
        <p>
          No inventory tracker configured on this machine. Add a{' '}
          <code>joseph:inventory:tracker</code> generic component paired with a{' '}
          <code>viam:event-queue:sensor</code> (queue_capacity: 1) named as the
          tracker's <code>state_sensor</code>.
        </p>
      </div>
    );
  }

  const handleAdd = async (payload) => {
    try {
      await inv.addItem(payload);
      setAddOpen(false);
      setAddInitial({});
    } catch {
      // stay open
    }
  };

  const handleScan = async (barcode) => {
    setScanOpen(false);
    try {
      const resp = await inv.scanBarcode(barcode);
      if (resp?.matched) {
        setToast({
          kind: 'success',
          text: `Added ${resp.added} to ${resp.item?.name} · now ${resp.item?.quantity}`,
        });
      } else {
        const prefill = resp?.prefill || {};
        setAddInitial({
          name: prefill.name || '',
          barcode: resp?.barcode || barcode,
        });
        setAddOpen(true);
        setToast({ kind: 'info', text: 'New barcode — fill in the details' });
      }
    } catch (e) {
      setToast({ kind: 'error', text: e?.message || 'Scan failed' });
    }
  };

  const handleSave = async (payload) => {
    try { await inv.editItem(payload); } catch { /* surfaced */ }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try { await inv.deleteItem(id); } catch { /* surfaced */ }
  };

  const sortedItems = [...items].sort((a, b) =>
    (a.name || '').localeCompare(b.name || ''),
  );

  return (
    <div className="feeder-page">
      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      {toast && (
        <p className={'feeder-error feeder-error--banner feeder-toast--' + toast.kind}>
          {toast.text}
        </p>
      )}

      <BarcodeScanner
        open={scanOpen}
        onScan={handleScan}
        onClose={() => setScanOpen(false)}
      />

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Items ({sortedItems.length})</h2>
          <div className="inventory-header-actions">
            <button
              type="button"
              className="feeder-secondary-button feeder-secondary-button--sm"
              onClick={() => setScanOpen(true)}
              disabled={busy}
            >
              Scan
            </button>
            <button
              type="button"
              className="feeder-icon-button"
              onClick={inv.refresh}
              disabled={loading || busy}
              aria-label="Refresh"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        {sortedItems.length === 0 && !addOpen && (
          <p className="feeder-meta">No items yet.</p>
        )}

        {sortedItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            busy={busy}
            onIncrement={inv.increment}
            onDecrement={inv.decrement}
            onSetQuantity={inv.setQuantity}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}

        {addOpen ? (
          <div className="automation-card automation-card--add">
            <ItemForm
              initial={addInitial}
              busy={busy}
              submitLabel="Add"
              onSubmit={handleAdd}
              onCancel={() => { setAddOpen(false); setAddInitial({}); }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="feeder-secondary-button feeder-secondary-button--full"
            onClick={() => { setAddInitial({}); setAddOpen(true); }}
            disabled={busy}
          >
            + Add item
          </button>
        )}
      </section>
    </div>
  );
}
