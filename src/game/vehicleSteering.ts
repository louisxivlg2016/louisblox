import { create } from 'zustand';

export const useVehicleSteeringStore = create<{ angle: number }>(() => ({ angle: 0 }));
