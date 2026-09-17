import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MachinePage from './pages/MachinePage';
import CamerasPage from './pages/CamerasPage';
import FeederPage from './pages/FeederPage';

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
          <Route index element={<CamerasPage />} />
          <Route path="feeder" element={<FeederPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
