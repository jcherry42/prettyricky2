import React, { useEffect, useCallback } from 'react';
import { useSales } from '../context/SalesContext';
import { personalizeResponse } from '../data/salesData';

export const KeyboardShortcuts = ({ onSettingsOpen, onImportOpen }) => {
  const { 
    selectedResponse, 
    selectedProspect, 
    selectedObjection,
    objectionTypes,
    selectObjection,
    getVehicleById,
    getResponsesForObjection 
  } = useSales();

  const getContext = useCallback(() => {
    if (!selectedProspect) return {};
    
    const vehicle = getVehicleById(selectedProspect.vehicle);
    const trade = selectedProspect.tradeVehicle;
    
    return {
      name: selectedProspect.name.split(' ')[0],
      vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'vehicle',
      price: vehicle ? `$${vehicle.price.toLocaleString()}` : '',
      feature1: 'advanced safety suite',
      feature2: 'premium sound system',
      feature3: 'adaptive cruise control',
      tradeVehicle: trade ? `${trade.year} ${trade.make} ${trade.model}` : 'trade-in',
      tradeYear: trade?.year || '',
      tradeMake: trade?.make || '',
      condition: 'above average',
      marketTrend: 'stable',
      term: '72',
      payment: '$399',
      years: '5',
      rate: '5.9',
      comparison: 'very competitive',
      timeframe: 'month',
      savings: '$2,500',
      competitor: 'the competition',
      percentage: '15',
      feature: 'panoramic sunroof',
      higherTrim: 'Premium trim',
      aftermarketOption: 'a dealer-installed sunroof package',
      cost: '$1,200',
      bumperYears: '3',
      powertrainYears: '5',
      additionalCoverage: 'corrosion perforation warranty',
      extendedYears: '10',
      maintenanceYears: '2',
      count: '3',
      color: 'this color',
      features: 'these options',
    };
  }, [selectedProspect, getVehicleById]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Copy response: C
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && selectedResponse) {
        e.preventDefault();
        const personalizedText = personalizeResponse(selectedResponse.response, getContext());
        navigator.clipboard.writeText(personalizedText);
      }

      // Settings: S
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSettingsOpen?.();
      }

      // Import: I
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onImportOpen?.();
      }

      // Number keys 1-8 for objection types
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8 && objectionTypes[num - 1] && selectedProspect) {
        e.preventDefault();
        selectObjection(objectionTypes[num - 1]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedResponse, selectedProspect, objectionTypes, selectObjection, getContext, onSettingsOpen, onImportOpen]);

  return null;
};

export default KeyboardShortcuts;
