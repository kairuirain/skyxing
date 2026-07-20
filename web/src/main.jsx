import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TransitionProvider } from './context/TransitionContext';
import { I18nProvider } from './context/I18nContext';
import { AnimationProvider } from './context/AnimationContext';
import { SyncProvider } from './context/SyncContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <AnimationProvider>
              <SyncProvider>
                <TransitionProvider>
                  <App />
                </TransitionProvider>
              </SyncProvider>
            </AnimationProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
