import './uuidPolyfill';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { initInput } from './game/input';
import { initPersistence, readWorldSave } from './game/save';
import { useGameStore } from './game/store';
import { world } from './game/world';
import { watchBuildVersion } from './game/version';

initInput();
initPersistence(world);
if (readWorldSave(useGameStore.getState().worldId)) useGameStore.getState().setMode('pause');
createRoot(document.getElementById('root')!).render(<App />);
watchBuildVersion();
