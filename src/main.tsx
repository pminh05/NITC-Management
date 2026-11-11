import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Bỏ chế độ tối, khóa giao diện ở chế độ sáng chuẩn của NITC Command Center
try {
  localStorage.removeItem('nitc_theme');
  document.documentElement.classList.remove('dark');
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
