import React from 'react';
import HysteresisCard from './HysteresisCard';
import ScheduledCard from './ScheduledCard';

export default function AutomationCard(props) {
  if (props.automation?.kind === 'scheduled') return <ScheduledCard {...props} />;
  return <HysteresisCard {...props} />;
}
