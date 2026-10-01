import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatRelative } from '../../lib/format';
import ItemRow from './ItemRow';
import SortableItemRow from './SortableItemRow';
import NewItemSheet from './ItemForm';
import './Inventory.css';

const DEFAULT_GROUP = 'kitchen';

export default function InventoryPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    inventoryName, inventoryStateSensorName,
    loading: connectionLoading, detectingFeatures, pendingProbes,
    inventory: inv,
  } = ctx;
  const stillProbing = !inventoryName && pendingProbes && pendingProbes.generic > 0;
  const { items, busy, error } = inv;
  const [addGroupHint, setAddGroupHint] = useState(DEFAULT_GROUP);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [buttonPage, setButtonPage] = useState(0);
  const BUTTON_PAGE_SIZE = 5;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Fast refresh while this page is open — picks up out-of-band changes
  // (zigbee button presses, streamdeck taps, me editing from a script)
  // quickly instead of waiting for the hook's 60s baseline. Pauses when
  // the tab goes to the background. Tears down on unmount, so navigating
  // to another page drops back to 60s automatically.
  useEffect(() => {
    if (!inv?.refresh) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') inv.refresh();
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [inv]);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  const { groups, outCount, lowCount } = useMemo(() => {
    const byGroup = new Map();
    const unassigned = [];
    let out = 0;
    let low = 0;
    for (const it of items) {
      if (it.quantity === 0) out += 1;
      else if (it.threshold != null && it.quantity <= it.threshold) low += 1;
      const g = it.button?.device;
      if (!g) unassigned.push(it);
      else {
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(it);
      }
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => (a.button?.slot ?? 0) - (b.button?.slot ?? 0));
    }
    unassigned.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const result = [...byGroup.entries()].map(([name, list]) => ({ name, list }));
    if (unassigned.length) result.push({ name: 'unassigned', list: unassigned });
    return { groups: result, outCount: out, lowCount: low };
  }, [items]);

  const existingGroups = useMemo(
    () => groups.map((g) => g.name).filter((n) => n !== 'unassigned'),
    [groups],
  );

  if (connectionLoading || detectingFeatures || stillProbing) {
    return (
      <div className="inventory-page">
        <TopNav availability={availability} />
        <div className="inventory-page__body">
          <div className="inventory-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!inventoryName || !inventoryStateSensorName) {
    return (
      <div className="inventory-page">
        <TopNav availability={availability} />
        <div className="inventory-page__body">
          <div className="inventory-stub">
            <h1 className="inventory-page__title">Inventory</h1>
            <p>No inventory tracker configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const handleAdd = async (payload) => {
    try {
      await inv.addItem(payload);
      setAddOpen(false);
      setToast({ kind: 'success', text: `Added ${payload.name}` });
    } catch {
      // stay open — error is surfaced via inv.error
    }
  };

  const openAdd = (groupHint) => {
    setAddGroupHint(groupHint || DEFAULT_GROUP);
    setAddOpen(true);
  };

  const handleSetThreshold = async (id, value) => {
    try { await inv.editItem({ id, threshold: value }); } catch { /* surfaced */ }
  };

  const handleSetName = async (id, name) => {
    try { await inv.editItem({ id, name }); } catch { /* surfaced */ }
  };

  const handleSetSlot = async (id, slot) => {
    const item = items.find((i) => i.id === id);
    const device = item?.button?.device ?? DEFAULT_GROUP;
    try {
      await inv.editItem({ id, button: slot === null ? null : { device, slot } });
    } catch { /* surfaced */ }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try { await inv.deleteItem(id); } catch { /* surfaced */ }
  };

  const handleDragEnd = (group) => async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const g = groups.find((x) => x.name === group);
    if (!g) return;
    const oldIndex = g.list.findIndex((i) => i.id === active.id);
    const newIndex = g.list.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(g.list, oldIndex, newIndex).map((i) => i.id);
    try { await inv.reorderDeck(nextOrder, group); } catch { /* surfaced */ }
  };

  const lede = `${items.length} item${items.length === 1 ? '' : 's'}`
    + (outCount > 0 ? ` · ${outCount} out` : '')
    + (lowCount > 0 ? ` · ${lowCount} low` : '')
    + ' · order sets Stream Deck slots';

  const left = groups.length > 0 ? [groups[0]] : [];
  const right = groups.slice(1);

  const renderGroup = (group) => (
    <div key={group.name} className="inv-group">
      <p className="inv-sect">{group.name}</p>
      {group.name === 'unassigned' ? (
        group.list.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            busy={busy}
            onIncrement={inv.increment}
            onDecrement={inv.decrement}
            onSetQuantity={inv.setQuantity}
            onSetName={handleSetName}
            onSetThreshold={handleSetThreshold}
            onSetSlot={handleSetSlot}
            onDelete={handleDelete}
          />
        ))
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd(group.name)}
        >
          <SortableContext
            items={group.list.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {group.list.map((item) => (
              <SortableItemRow
                key={item.id}
                item={item}
                busy={busy}
                onIncrement={inv.increment}
                onDecrement={inv.decrement}
                onSetQuantity={inv.setQuantity}
                onSetName={handleSetName}
                onSetThreshold={handleSetThreshold}
                onSetSlot={handleSetSlot}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button
        type="button"
        className="inv-add"
        onClick={() => openAdd(group.name === 'unassigned' ? DEFAULT_GROUP : group.name)}
        disabled={busy}
      >
        + Add item
      </button>
    </div>
  );

  return (
    <div className="inventory-page">
      <TopNav availability={availability} />
      <div className="inventory-page__body">
        <div className="inventory-page__wide">
          {mobile && (
            <button
              type="button"
              className="inventory-page__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="inventory-page__title">Inventory</h1>
          <p className="inventory-page__lede">{lede}</p>

          {error && <div className="inv-toast inv-toast--error">{error}</div>}
          {toast && <div className={`inv-toast inv-toast--${toast.kind}`}>{toast.text}</div>}

          {groups.length === 0 ? (
            <div>
              <p className="inv-empty">No items yet.</p>
              <button
                type="button"
                className="inv-add"
                onClick={() => openAdd(DEFAULT_GROUP)}
                disabled={busy}
              >
                + Add item
              </button>
            </div>
          ) : mobile || groups.length < 2 ? (
            <div className="inventory-page__col">
              {groups.map(renderGroup)}
            </div>
          ) : (
            <div className="inventory-page__cols">
              <div className="inventory-page__col">{left.map(renderGroup)}</div>
              <div className="inventory-page__col">{right.map(renderGroup)}</div>
            </div>
          )}

          {inv.buttonHistory && inv.buttonHistory.length > 0 && (() => {
            const total = inv.buttonHistory.length;
            const totalPages = Math.max(1, Math.ceil(total / BUTTON_PAGE_SIZE));
            const safePage = Math.min(buttonPage, totalPages - 1);
            const start = safePage * BUTTON_PAGE_SIZE;
            const page = inv.buttonHistory.slice(start, start + BUTTON_PAGE_SIZE);
            const first = total === 0 ? 0 : start + 1;
            const last = Math.min(total, start + BUTTON_PAGE_SIZE);
            return (
              <div className="inv-activity">
                <p className="inv-sect">Recent button presses</p>
                {page.map((e, i) => (
                  <div key={`${e.at}-${i}`} className="inv-row">
                    <div className="inv-nm">
                      {e.source || 'button'}
                      {e.action && e.action !== 'single' && (
                        <span className="inv-activity__action"> · {e.action}</span>
                      )}
                    </div>
                    <span className="inv-activity__when">{formatRelative(e.at) || ''}</span>
                  </div>
                ))}
                {total > BUTTON_PAGE_SIZE && (
                  <div className="inv-pager">
                    <button
                      type="button"
                      onClick={() => setButtonPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                    >
                      ← Newer
                    </button>
                    <span className="inv-pager__status">
                      {first}–{last} of {total}
                    </span>
                    <button
                      type="button"
                      onClick={() => setButtonPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                    >
                      Older →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
      <BottomTabBar />
      <NewItemSheet
        open={addOpen}
        initialGroup={addGroupHint}
        existingGroups={existingGroups}
        busy={busy}
        onSubmit={handleAdd}
        onCancel={() => setAddOpen(false)}
      />
    </div>
  );
}
