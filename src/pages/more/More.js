import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Utensils, Droplet, DoorClosed, Thermometer, Blinds, Activity, Wind, ChevronRight,
} from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import './More.css';

const ITEMS = [
  { key: 'feeder', label: 'Feeder', to: '/feeder', icon: Utensils, gate: (c) => !!c.feederName },
  { key: 'waterer', label: 'Waterer', to: '/waterer', icon: Droplet, gate: (c) => !!c.watererName },
  { key: 'thermostat', label: 'Thermostat', to: '/thermostat', icon: Thermometer, gate: (c) => !!(c.acBotName && c.roomMeterName) },
  { key: 'curtain', label: 'Curtains', to: '/curtain', icon: Blinds, gate: (c) => !!c.curtainName },
  { key: 'bark', label: 'Sounds', to: '/bark', icon: Activity, gate: (c) => !!c.barkName },
  { key: 'air', label: 'Air', to: '/air', icon: Wind, gate: (c) => !!c.airName },
  { key: 'door', label: 'Building door', to: '/door', icon: DoorClosed, gate: (c) => !!c.doorUnlockName },
];

export default function More() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const items = ITEMS.filter((i) => i.gate(ctx));

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  return (
    <div className="more">
      <TopNav availability={availability} />
      <div className="more__body">
        <h1 className="more__title">More</h1>
        <div className="more__list">
          {items.map((i) => {
            const Icon = i.icon;
            return (
              <button
                key={i.key}
                type="button"
                className="more__row"
                onClick={() => navigate(i.to)}
              >
                <span className="more__ic"><Icon size={19} strokeWidth={1.6} /></span>
                <span className="more__nm">{i.label}</span>
                <ChevronRight className="more__chev" size={15} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
