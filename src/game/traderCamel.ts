import type { World } from 'koota';
import { requestPlay } from './input';
import { translate } from './language';
import { CamelLeash } from './traits';
import { useTradeStore } from './trading';
import { mountEntity } from './vehicles';

export function mountTraderCamel(world: World) {
  const traderId = useTradeStore.getState().traderId;
  if (!traderId) return false;
  const camels = world.query(CamelLeash).filter((entity) => entity.get(CamelLeash)?.trader === traderId).sort((a, b) => a.get(CamelLeash)!.order - b.get(CamelLeash)!.order);
  for (const camel of camels) {
    if (!mountEntity(world, camel, 'camel')) continue;
    useTradeStore.getState().setOpen(false);
    void requestPlay();
    return true;
  }
  useTradeStore.getState().setMessage(translate('Aucun chameau libre pour le moment.', 'No camel is available right now.'));
  return false;
}
