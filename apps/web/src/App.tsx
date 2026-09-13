import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BACKEND_URL } from './config';
import Player from './player';
import Host from './host';
import Presentation from './presentation';
import Studio from './studio';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Player />} />
        <Route path="/player" element={<Player />} />
        <Route path="/host" element={<Host />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/present/:pin" element={<Presentation />} />
      </Routes>
    </BrowserRouter>
  );
}