import React from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';
import { useSales } from '../context/SalesContext';

/**
 * Data Health Indicator
 * - Green check: Fully functional lead data (customers with complete info)
 * - Yellow caution: Partial lead data (some customers missing fields)
 * - Red X: No lead data found
 */
export const DataHealthIndicator = () => {
  const { customers } = useSales();
  
  // Calculate data health
  const getHealthStatus = () => {
    if (!customers || customers.length === 0) {
      return { status: 'none', label: 'No Leads', color: 'red' };
    }
    
    // Check completeness of customer data
    const requiredFields = ['name', 'phone', 'vehicleInterest'];
    let completeCount = 0;
    let partialCount = 0;
    
    customers.forEach(customer => {
      const filledFields = requiredFields.filter(field => customer[field]);
      if (filledFields.length === requiredFields.length) {
        completeCount++;
      } else if (filledFields.length > 0) {
        partialCount++;
      }
    });
    
    if (completeCount === customers.length) {
      return { status: 'healthy', label: `${customers.length} Leads`, color: 'green' };
    } else if (completeCount > 0 || partialCount > 0) {
      return { status: 'partial', label: `${completeCount}/${customers.length} Complete`, color: 'yellow' };
    } else {
      return { status: 'none', label: 'No Valid Leads', color: 'red' };
    }
  };
  
  const health = getHealthStatus();
  
  const getIcon = () => {
    switch (health.status) {
      case 'healthy':
        return <Check className="w-3.5 h-3.5" />;
      case 'partial':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      default:
        return <X className="w-3.5 h-3.5" />;
    }
  };
  
  const getStyles = () => {
    switch (health.color) {
      case 'green':
        return {
          background: 'hsla(145, 60%, 40%, 0.15)',
          border: '1px solid hsla(145, 60%, 45%, 0.3)',
          color: 'hsla(145, 70%, 55%, 1)',
        };
      case 'yellow':
        return {
          background: 'hsla(45, 90%, 45%, 0.15)',
          border: '1px solid hsla(45, 90%, 50%, 0.3)',
          color: 'hsla(45, 100%, 55%, 1)',
        };
      default:
        return {
          background: 'hsla(0, 70%, 45%, 0.15)',
          border: '1px solid hsla(0, 70%, 50%, 0.3)',
          color: 'hsla(0, 80%, 60%, 1)',
        };
    }
  };
  
  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
      style={getStyles()}
      title={`Lead Data: ${health.label}`}
      data-testid="data-health-indicator"
    >
      {getIcon()}
      <span className="hidden sm:inline">{health.label}</span>
    </div>
  );
};

export default DataHealthIndicator;
