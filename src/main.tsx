import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Smoothly scroll active input into viewport when virtual keyboard appears
if (typeof window !== 'undefined') {
  let activeInputElement: HTMLElement | null = null;

  window.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      activeInputElement = target;
      setTimeout(() => {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch {
          target.scrollIntoView(false);
        }
      }, 300);
    }
  });

  window.addEventListener('focusout', () => {
    activeInputElement = null;
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (activeInputElement) {
        setTimeout(() => {
          try {
            activeInputElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          } catch {
            activeInputElement?.scrollIntoView(false);
          }
        }, 100);
      }
    });
  }
}
