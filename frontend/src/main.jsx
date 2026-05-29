import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ModeSachaProvider } from './context/ModeSachaContext';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <ModeSachaProvider>
          <App />
        </ModeSachaProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
