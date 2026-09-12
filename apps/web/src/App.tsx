import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Player from './player';
import Host from './Host';
import Presentation from './Presentation';
import Studio from './Studio';

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