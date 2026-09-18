import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Player from './player';
import Host from './host';
import Presentation from './presentation';
import Studio from './studio';

// Drošs un vizuāli pievilcīgs aizsardzības komponents
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('isAdminAuthorized') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const savedKey = localStorage.getItem('admin_api_key') || 'izskaties_dzirdets_super_secret_key_2026';
    
    // Pārbauda ievadīto paroli vai atslēgu
    if (passwordInput === 'admin123' || passwordInput === savedKey) {
      localStorage.setItem('isAdminAuthorized', 'true');
      setIsAdmin(true);
    } else {
      setErrorMsg(true);
    }
  };

  if (!isAdmin) {
    return (
      <div style={lockScreenStyle}>
        <div style={lockCardStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔒</div>
          <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>ADMINISTRATORA PIEKĻUVE</h2>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
            Šī sadaļa ir paredzēta tikai pasākuma vadītājam un organizatoriem.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Ievadiet paroli..."
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setErrorMsg(false);
              }}
              style={lockInputStyle}
              autoFocus
            />

            {errorMsg && (
              <span style={{ color: '#ff4d4d', fontSize: '0.85rem', fontWeight: 'bold' }}>
                ❌ Nepareiza parole!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => window.location.href = '/'}
                style={{ ...lockBtnStyle, background: '#444' }}
              >
                Atpakaļ
              </button>
              <button type="submit" style={{ ...lockBtnStyle, background: '#007bff', flex: 1 }}>
                Ienākt 🚀
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publiskie maršruti */}
        <Route path="/" element={<Player />} />
        <Route path="/player" element={<Player />} />
        <Route path="/present/:pin" element={<Presentation />} />

        {/* Aizsargātie administrācijas maršruti */}
        <Route
          path="/host"
          element={
            <ProtectedRoute>
              <Host />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <Studio />
            </ProtectedRoute>
          }
        />

        {/* 404 novirzīšana (novērš balto ekrānu pie nepareiza URL) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Stili aizsardzības logam
const lockScreenStyle: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  background: '#0e0e0e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'Segoe UI, Arial, sans-serif'
};

const lockCardStyle: React.CSSProperties = {
  background: '#1c1c1c',
  border: '1px solid #333',
  padding: '30px',
  borderRadius: '16px',
  width: '90%',
  maxWidth: '380px',
  textAlign: 'center',
  boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
};

const lockInputStyle: React.CSSProperties = {
  padding: '12px',
  background: '#000',
  border: '1px solid #555',
  color: '#fff',
  borderRadius: '8px',
  fontSize: '1.1rem',
  textAlign: 'center',
  outline: 'none'
};

const lockBtnStyle: React.CSSProperties = {
  padding: '12px',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '1rem'
};