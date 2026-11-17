import { usePoliceTitleStore } from '../game/policeTitle';
import { VehicleTitle } from './PlaneTitle';

export function PoliceTitle() {
  const title = usePoliceTitleStore((state) => state.title);
  return <VehicleTitle title={title} width={2.8} height={0.7} position={[0.92, 0.8, 0]} name="police-gold-title" />;
}
