import React from 'react';
import { Sparkles } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const TowerTalkButton = () => {
  const { toggleTowerTalk, selectedCustomer, isOffline } = useSales();

  // Only show when customer is selected
  if (!selectedCustomer) return null;

  return (
    <button
      onClick={() => toggleTowerTalk(true)}
      disabled={isOffline}
      className="btn-tower w-full py-4 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
      data-testid="tower-talk-btn"
    >
      <Sparkles className="w-5 h-5" />
      Tower Talk
      {isOffline && <span className="text-xs opacity-75 ml-1 normal-case">(Online only)</span>}
    </button>
  );
};

export default TowerTalkButton;
