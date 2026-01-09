import React, { useState, useCallback } from 'react';
import { Copy, Check, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useSales } from '../context/SalesContext';
import { personalizeResponse } from '../data/salesData';

const toneColors = {
  value: 'bg-success/10 text-success border-success/20',
  empathy: 'bg-primary/10 text-primary border-primary/20',
  urgency: 'bg-accent/10 text-accent border-accent/20',
  solution: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  transparency: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  competitive: 'bg-secondary/50 text-secondary-foreground border-secondary',
  service: 'bg-primary/10 text-primary border-primary/20',
  understanding: 'bg-muted text-muted-foreground border-border',
  confident: 'bg-success/10 text-success border-success/20',
  assurance: 'bg-primary/10 text-primary border-primary/20',
  alternative: 'bg-warning/10 text-warning border-warning/20',
};

export const ResponseCards = () => {
  const { 
    selectedObjection, 
    selectedProspect, 
    selectedResponse,
    selectResponse,
    getResponsesForObjection,
    getVehicleById 
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);

  const responses = selectedObjection ? getResponsesForObjection(selectedObjection.id) : [];

  // Build context for personalization
  const getContext = useCallback(() => {
    if (!selectedProspect) return {};
    
    const vehicle = getVehicleById(selectedProspect.vehicle);
    const trade = selectedProspect.tradeVehicle;
    
    return {
      name: selectedProspect.name.split(' ')[0], // First name only
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

  const handleCopy = async (response) => {
    const personalizedText = personalizeResponse(response.response, getContext());
    
    try {
      await navigator.clipboard.writeText(personalizedText);
      setCopiedId(response.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!selectedObjection) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          Select an Objection
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choose an objection type above to see instant, human-sounding responses tailored to your prospect.
        </p>
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          No Responses Yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Import custom responses or add them via the settings to handle &ldquo;{selectedObjection.label}&rdquo; objections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Suggested Responses
        </h3>
        <span className="text-xs text-muted-foreground">
          {responses.length} response{responses.length > 1 ? 's' : ''} available
        </span>
      </div>

      <div className="space-y-3">
        {responses.map((response, index) => {
          const isSelected = selectedResponse?.id === response.id;
          const personalizedText = personalizeResponse(response.response, getContext());
          const isCopied = copiedId === response.id;
          
          return (
            <div
              key={response.id}
              onClick={() => selectResponse(response)}
              className={`
                response-card cursor-pointer transition-all duration-200
                ${isSelected ? 'ring-2 ring-primary shadow-glow' : 'hover:shadow-lg'}
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className={`${toneColors[response.tone] || toneColors.value} border`}
                  >
                    {response.title}
                  </Badge>
                  
                  {response.winRate && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <TrendingUp className="w-3 h-3" />
                      {response.winRate}% win rate
                    </span>
                  )}
                </div>
                
                <Button
                  variant={isCopied ? "success" : "soft"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(response);
                  }}
                  className="flex-shrink-0"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Response Text */}
              <p className="text-sm text-foreground leading-relaxed">
                {personalizedText}
              </p>

              {/* Tags */}
              {response.tags && response.tags.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Best for:</span>
                  <div className="flex flex-wrap gap-1">
                    {response.tags.map((tag) => (
                      <span 
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
        <span>Press</span>
        <kbd className="kbd">C</kbd>
        <span>to copy selected response</span>
      </div>
    </div>
  );
};

export default ResponseCards;
