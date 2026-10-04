import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { useRoomStore } from './state/roomStore';

// test builds only: lets e2e tests read the shared room state directly
if (import.meta.env.MODE === 'mock') (window as unknown as { __jam: typeof useRoomStore }).__jam = useRoomStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
