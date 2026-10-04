import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import '@fontsource/special-elite/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/screens.css';
import './styles/stage.css';
import { App } from './App';
import { useRoomStore } from './state/roomStore';
import { initInstall } from './lib/install';

initInstall();

// test builds only: lets e2e tests read the shared room state directly
if (import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'mock-real') {
  (window as unknown as { __jam: typeof useRoomStore }).__jam = useRoomStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
