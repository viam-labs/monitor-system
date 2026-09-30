import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemRow from './ItemRow';

export default function SortableItemRow({ item, ...rowProps }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const dragHandle = (
    <button
      type="button"
      className="inventory-grid__drag"
      aria-label={`Reorder ${item.name}`}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ⋮⋮
    </button>
  );
  return (
    <ItemRow
      item={item}
      dragHandle={dragHandle}
      wrapperRef={setNodeRef}
      wrapperStyle={style}
      {...rowProps}
    />
  );
}
