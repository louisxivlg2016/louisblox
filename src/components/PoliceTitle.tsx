import { usePoliceTitleStore } from '../game/policeTitle';
import { VehicleTitle } from './PlaneTitle';

export function PoliceTitle() {
  const title = usePoliceTitleStore((state) => state.title);
  return <VehicleTitle title={title} width={3.1} height={0.78} position={[0.92, 0.8, 0]} slide={0.1} name="police-gold-title" />;
}
