import { usePoliceTitleStore } from '../game/policeTitle';
import { VehicleTitle } from './PlaneTitle';

export function PoliceTitle() {
  const title = usePoliceTitleStore((state) => state.title);
  return <VehicleTitle title={title} width={2.2} height={0.55} position={[1.06, 1.45, 0]} name="police-gold-title" />;
}
