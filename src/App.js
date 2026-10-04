import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MachinePage from './pages/MachinePage';
import Home from './pages/home/Home';
import More from './pages/more/More';
import CamerasPage from './pages/cameras/Cameras';
import FeederPage from './pages/feeder';
import ThermostatPage from './pages/thermostat';
import CurtainPage from './pages/curtain/Curtain';
import DoorUnlockPage from './pages/door/Door';
import WatererPage from './pages/waterer/Waterer';
import InventoryPage from './pages/inventory';
import BarkPage from './pages/sounds/Sounds';
import AirPage from './pages/air/Air';
import MusicPage from './pages/music';
import SystemPage from './pages/system/System';

// HashRouter (not BrowserRouter) because Viam Applications' static
// hosting does not rewrite unknown paths back to index.html — a
// refresh on /machine/<host>/feeder 404s against the storage bucket.
// The hash never hits the server, so refresh always works. See the
// PR description for the platform-gap details.
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MachinePage />}>
          <Route index element={<Home />} />
          <Route path="more" element={<More />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="feeder" element={<FeederPage />} />
          <Route path="thermostat" element={<ThermostatPage />} />
          <Route path="curtain" element={<CurtainPage />} />
          <Route path="door" element={<DoorUnlockPage />} />
          <Route path="waterer" element={<WatererPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="bark" element={<BarkPage />} />
          <Route path="air" element={<AirPage />} />
          <Route path="music" element={<MusicPage />} />
          <Route path="system" element={<SystemPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
