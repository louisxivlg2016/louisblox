import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { initInput } from './game/input';
import { initPersistence } from './game/save';
import { world } from './game/world';

initInput();
initPersistence(world);
createRoot(document.getElementById('root')!).render(<App />);
