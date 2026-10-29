import { selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { ITEM_META } from '../game/items';

export function ItemIcon({ kind }: { kind: SelectedKind }) {
  const info = selectionInfo(kind);
  if (typeof kind === 'number') return <span className="block-swatch" style={{ backgroundColor: info.color }} />;
  const category = ITEM_META[kind].category;
  return (
    <span className={`item-icon item-${category}`} style={{ '--item-color': info.color } as React.CSSProperties} aria-hidden="true">
      <i /><b /><em />
    </span>
  );
}
