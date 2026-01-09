import React from 'react';
import { Sparkles } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const TowerTalkButton = () => {
  const { toggleTowerTalk, selectedCustomer, isOffline } = useSales();

  // Only show when customer is selected and online
  if (!selectedCustomer) return null;

  return (
    <button
      onClick={() => toggleTowerTalk(true)}
      disabled={isOffline}
      className="ios-btn-tower w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Sparkles className="w-4 h-4" />
      Tower Talk
      {isOffline && <span className="text-xs opacity-75 ml-1">(Online only)</span>}
    </button>
  );
};

export default TowerTalkButton;
