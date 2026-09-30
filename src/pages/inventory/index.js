import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import BarcodeScanner from '../../components/BarcodeScanner';
import ItemForm from './ItemForm';
import ItemRow from './ItemRow';
import SortableItemRow from './SortableItemRow';

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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

  const handleSetThreshold = async (id, value) => {
    try { await inv.editItem({ id, threshold: value }); } catch { /* surfaced */ }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try { await inv.deleteItem(id); } catch { /* surfaced */ }
  };

  const groupsByDevice = new Map();
  const unassigned = [];
  for (const it of items) {
    const dev = it.button?.device;
    if (!dev) unassigned.push(it);
    else {
      if (!groupsByDevice.has(dev)) groupsByDevice.set(dev, []);
      groupsByDevice.get(dev).push(it);
    }
  }
  for (const list of groupsByDevice.values()) {
    list.sort((a, b) => (a.button?.slot ?? 0) - (b.button?.slot ?? 0));
  }
  unassigned.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const handleDragEnd = (device) => async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = groupsByDevice.get(device) || [];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(list, oldIndex, newIndex).map((i) => i.id);
    try { await inv.reorderDeck(nextOrder, device); } catch { /* surfaced */ }
  };

  const handleMarkDone = async (id) => {
    try { await inv.markRoutineDone(id); } catch { /* surfaced */ }
  };

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

        {items.length === 0 && !addOpen && (
          <p className="feeder-meta">No items yet.</p>
        )}

        {[...groupsByDevice.entries()].map(([device, list]) => (
          <div key={device}>
            <h3 className="inventory-section__title">{device}</h3>
            <div className="inventory-grid inventory-grid--with-drag">
              <span className="inventory-grid__head" aria-hidden="true" />
              <span className="inventory-grid__head">Item</span>
              <span className="inventory-grid__head">Count</span>
              <span className="inventory-grid__head">Threshold / Due</span>
              <div className="inventory-grid__hr" />
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd(device)}
              >
                <SortableContext
                  items={list.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {list.map((item) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      busy={busy}
                      onIncrement={inv.increment}
                      onDecrement={inv.decrement}
                      onSetQuantity={inv.setQuantity}
                      onSetThreshold={handleSetThreshold}
                      onSave={handleSave}
                      onDelete={handleDelete}
                      onMarkRoutineDone={handleMarkDone}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div>
            <h3 className="inventory-section__title">Unassigned</h3>
            <div className="inventory-grid">
              <span className="inventory-grid__head">Item</span>
              <span className="inventory-grid__head">Count</span>
              <span className="inventory-grid__head">Threshold / Due</span>
              <div className="inventory-grid__hr" />
              {unassigned.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  onIncrement={inv.increment}
                  onDecrement={inv.decrement}
                  onSetQuantity={inv.setQuantity}
                  onSetThreshold={handleSetThreshold}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onMarkRoutineDone={handleMarkDone}
                />
              ))}
            </div>
          </div>
        )}

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
