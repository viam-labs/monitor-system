import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MachinePage from './pages/MachinePage';
import CamerasPage from './pages/CamerasPage';
import FeederPage from './pages/FeederPage';

function App() {
  return (
    <Router basename="/machine">
      <Routes>
        <Route path="/:machineId" element={<MachinePage />}>
          <Route index element={<CamerasPage />} />
          <Route path="feeder" element={<FeederPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
