import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Áp dụng giao diện sáng/tối đã lưu (mặc định: tối)
const savedTheme = localStorage.getItem('nitc_theme') || 'dark';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
