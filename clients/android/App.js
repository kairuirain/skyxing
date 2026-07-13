import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SettingsProvider>
    </AuthProvider>
  );
}
