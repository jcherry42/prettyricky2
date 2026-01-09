import React from 'react';
import { 
  DollarSign, 
  CreditCard, 
  Repeat, 
  Percent, 
  Clock, 
  Users, 
  List, 
  Shield 
} from 'lucide-react';
import { useSales } from '../context/SalesContext';

const iconMap = {
  'dollar-sign': DollarSign,
  'credit-card': CreditCard,
  'repeat': Repeat,
  'percent': Percent,
  'clock': Clock,
  'users': Users,
  'list': List,
  'shield': Shield,
};

export const ObjectionChips = () => {
  const { objectionTypes, selectedObjection, selectObjection, selectedProspect, getResponsesForObjection } = useSales();

  if (!selectedProspect) {
    return null;
  }

  // Sort objections - prospect's objections first
  const sortedObjections = [...objectionTypes].sort((a, b) => {
    const aIsProspect = selectedProspect.objections.includes(a.id);
    const bIsProspect = selectedProspect.objections.includes(b.id);
    if (aIsProspect && !bIsProspect) return -1;
    if (!aIsProspect && bIsProspect) return 1;
    return 0;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Quick Objection Handler
        </h3>
        <span className="text-xs text-muted-foreground">
          Select an objection type
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {sortedObjections.map((objection) => {
          const Icon = iconMap[objection.icon] || List;
          const isActive = selectedObjection?.id === objection.id;
          const isProspectObjection = selectedProspect.objections.includes(objection.id);
          const responseCount = getResponsesForObjection(objection.id).length;
          
          return (
            <button
              key={objection.id}
              onClick={() => selectObjection(objection)}
              className={`
                chip group relative
                ${isActive ? 'active' : ''}
                ${isProspectObjection && !isActive ? 'ring-1 ring-accent/50 bg-accent/5' : ''}
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{objection.label}</span>
              {responseCount > 0 && (
                <span className={`
                  text-[10px] font-semibold ml-0.5
                  ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}
                `}>
                  {responseCount}
                </span>
              )}
              
              {/* Indicator for prospect's known objections */}
              {isProspectObjection && !isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
      
      {selectedProspect.objections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1.5 align-middle" />
          Indicates known objections for this prospect
        </p>
      )}
    </div>
  );
};

export default ObjectionChips;
