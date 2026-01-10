import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, Copy, Check, Swords, Trophy, Target, Zap, Shield, DollarSign, Star, Gauge } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Popular vehicle matchups by segment
const VS_MATCHUPS = {
  compact_suv: {
    name: 'Compact SUV',
    matchups: [
      { our: 'Honda CR-V', vs: 'Toyota RAV4' },
      { our: 'Honda CR-V', vs: 'Mazda CX-5' },
      { our: 'Toyota RAV4', vs: 'Nissan Rogue' },
      { our: 'Ford Escape', vs: 'Chevrolet Equinox' },
    ]
  },
  midsize_sedan: {
    name: 'Midsize Sedan',
    matchups: [
      { our: 'Honda Accord', vs: 'Toyota Camry' },
      { our: 'Honda Accord', vs: 'Nissan Altima' },
      { our: 'Toyota Camry', vs: 'Hyundai Sonata' },
      { our: 'Mazda6', vs: 'Kia K5' },
    ]
  },
  luxury_suv: {
    name: 'Luxury SUV',
    matchups: [
      { our: 'BMW X3', vs: 'Audi Q5' },
      { our: 'BMW X3', vs: 'Mercedes GLC' },
      { our: 'Lexus RX', vs: 'Acura MDX' },
      { our: 'Audi Q5', vs: 'Volvo XC60' },
    ]
  },
  truck: {
    name: 'Full-Size Truck',
    matchups: [
      { our: 'Ford F-150', vs: 'Chevrolet Silverado' },
      { our: 'Ford F-150', vs: 'RAM 1500' },
      { our: 'Toyota Tundra', vs: 'Nissan Titan' },
      { our: 'GMC Sierra', vs: 'Ford F-150' },
    ]
  },
  electric: {
    name: 'Electric',
    matchups: [
      { our: 'Tesla Model 3', vs: 'BMW i4' },
      { our: 'Tesla Model Y', vs: 'Ford Mustang Mach-E' },
      { our: 'Hyundai Ioniq 5', vs: 'Kia EV6' },
      { our: 'Rivian R1S', vs: 'Tesla Model X' },
    ]
  },
};

// Comparison categories
const COMPARISON_CATEGORIES = [
  { id: 'value', label: 'Value', icon: DollarSign },
  { id: 'reliability', label: 'Reliability', icon: Shield },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'features', label: 'Features', icon: Star },
  { id: 'resale', label: 'Resale', icon: Trophy },
];

export const VSModal = () => {
  const { 
    showVS, 
    toggleVS,
    selectedVehicle,
    copyToClipboard,
    dealership,
  } = useSales();
  
  const [selectedSegment, setSelectedSegment] = useState('compact_suv');
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0);
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [customOur, setCustomOur] = useState('');
  const [customVs, setCustomVs] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const currentSegment = VS_MATCHUPS[selectedSegment];
  const currentMatchup = currentSegment?.matchups[currentMatchupIndex];

  // Auto-select segment based on selected vehicle
  useEffect(() => {
    if (selectedVehicle) {
      const vehicleName = `${selectedVehicle.make} ${selectedVehicle.model}`.toLowerCase();
      // Try to find matching segment
      for (const [segmentId, segment] of Object.entries(VS_MATCHUPS)) {
        for (const matchup of segment.matchups) {
          if (matchup.our.toLowerCase().includes(vehicleName) || 
              vehicleName.includes(matchup.our.toLowerCase().split(' ')[0])) {
            setSelectedSegment(segmentId);
            return;
          }
        }
      }
    }
  }, [selectedVehicle]);

  const generateComparison = useCallback(async (ourVehicle, vsVehicle) => {
    setIsLoading(true);
    setComparison(null);

    try {
      const prompt = `You are a knowledgeable automotive sales consultant. Create a brief, punchy comparison between ${ourVehicle} and ${vsVehicle} that helps a salesperson highlight advantages.

Format your response EXACTLY as JSON with these fields:
{
  "ourVehicle": "${ourVehicle}",
  "vsVehicle": "${vsVehicle}",
  "headline": "One compelling 5-7 word headline why our vehicle wins",
  "quickWin": "One sentence knockout punch for quick conversations",
  "advantages": [
    {"category": "value", "point": "Specific advantage in 10 words or less"},
    {"category": "reliability", "point": "Specific advantage in 10 words or less"},
    {"category": "performance", "point": "Specific advantage in 10 words or less"},
    {"category": "features", "point": "Specific advantage in 10 words or less"},
    {"category": "resale", "point": "Specific advantage in 10 words or less"}
  ],
  "objectionCrushers": [
    "Response when customer says '${vsVehicle} has better X'",
    "Response when customer says '${vsVehicle} is cheaper'",
    "Response when customer says 'My friend loves their ${vsVehicle}'"
  ],
  "closingLine": "Natural transition to test drive or next step"
}

Be specific with real specs/features. Be confident but not arrogant. Output ONLY valid JSON.`;

      const res = await fetch(`${BACKEND_URL}/api/tower-talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          situation: prompt,
          context: {
            dealershipName: dealership.name,
            salespersonName: 'the salesperson',
            salespersonStyle: 'professional',
          }
        }),
      });

      if (!res.ok) throw new Error('Failed to generate comparison');

      const data = await res.json();
      
      // Parse the JSON response
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setComparison(parsed);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);
        // Fallback: create a basic comparison
        setComparison({
          ourVehicle,
          vsVehicle,
          headline: `${ourVehicle} Delivers More Value`,
          quickWin: `The ${ourVehicle} offers better overall value with superior reliability and features.`,
          advantages: COMPARISON_CATEGORIES.map(cat => ({
            category: cat.id,
            point: `Strong ${cat.label.toLowerCase()} advantage`
          })),
          objectionCrushers: [
            `I understand the appeal, but let me show you why the ${ourVehicle} actually outperforms in that area.`,
            `When you factor in total cost of ownership, the ${ourVehicle} actually saves you money long-term.`,
            `That's great! Many of our happiest customers switched from ${vsVehicle} and never looked back.`
          ],
          closingLine: `Let's take it for a spin so you can feel the difference yourself.`
        });
      }
    } catch (err) {
      console.error('VS comparison error:', err);
      toast.error('Could not generate comparison');
    } finally {
      setIsLoading(false);
    }
  }, [dealership.name]);

  // Generate comparison when matchup changes
  useEffect(() => {
    if (showVS && currentMatchup && !showCustom) {
      generateComparison(currentMatchup.our, currentMatchup.vs);
    }
  }, [showVS, currentMatchup, showCustom, generateComparison]);

  if (!showVS) return null;

  const handlePrevious = () => {
    const newIndex = currentMatchupIndex === 0 
      ? currentSegment.matchups.length - 1 
      : currentMatchupIndex - 1;
    setCurrentMatchupIndex(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentMatchupIndex === currentSegment.matchups.length - 1 
      ? 0 
      : currentMatchupIndex + 1;
    setCurrentMatchupIndex(newIndex);
  };

  const handleCustomCompare = () => {
    if (customOur.trim() && customVs.trim()) {
      generateComparison(customOur.trim(), customVs.trim());
      setShowCustom(false);
    }
  };

  const handleCopy = async (text, id) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleClose = () => {
    toggleVS(false);
    setComparison(null);
    setShowCustom(false);
    setCustomOur('');
    setCustomVs('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'hsla(0, 0%, 0%, 0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-luxury w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="modal-handle" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4" style={{ borderBottom: '1px solid hsla(280, 50%, 30%, 0.3)' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, hsla(280, 70%, 45%, 1) 0%, hsla(320, 80%, 40%, 1) 100%)',
                boxShadow: '0 0 20px hsla(300, 100%, 50%, 0.3)'
              }}
            >
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground tracking-wider">-VS-</h2>
              <p className="text-xs text-muted-foreground">Battle Cards</p>
            </div>
          </div>
          
          <button onClick={handleClose} className="btn-icon" data-testid="close-vs-modal">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] hide-scrollbar">
          {/* Segment Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {Object.entries(VS_MATCHUPS).map(([id, segment]) => (
              <button
                key={id}
                onClick={() => {
                  setSelectedSegment(id);
                  setCurrentMatchupIndex(0);
                  setShowCustom(false);
                }}
                className={`vs-segment-btn ${selectedSegment === id && !showCustom ? 'active' : ''}`}
                data-testid={`segment-${id}`}
              >
                {segment.name}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className={`vs-segment-btn ${showCustom ? 'active' : ''}`}
              data-testid="segment-custom"
            >
              Custom
            </button>
          </div>

          {/* Custom Matchup Input */}
          {showCustom && (
            <div className="vs-card p-4 space-y-3 animate-fade-in">
              <p className="text-xs text-muted-foreground text-center">Enter any two vehicles to compare</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customOur}
                  onChange={(e) => setCustomOur(e.target.value)}
                  placeholder="Our vehicle (e.g., Honda Accord)"
                  className="input-luxury flex-1 text-sm py-2"
                  data-testid="custom-our-input"
                />
                <span className="vs-badge">VS</span>
                <input
                  type="text"
                  value={customVs}
                  onChange={(e) => setCustomVs(e.target.value)}
                  placeholder="Competitor (e.g., Toyota Camry)"
                  className="input-luxury flex-1 text-sm py-2"
                  data-testid="custom-vs-input"
                />
              </div>
              <button
                onClick={handleCustomCompare}
                disabled={!customOur.trim() || !customVs.trim() || isLoading}
                className="btn-vs w-full py-2.5 disabled:opacity-50"
                data-testid="generate-custom-btn"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Battle Card'}
              </button>
            </div>
          )}

          {/* Matchup Navigation */}
          {!showCustom && (
            <div className="flex items-center justify-between">
              <button onClick={handlePrevious} className="btn-icon w-10 h-10" data-testid="prev-matchup">
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <div className="vs-matchup-display">
                <span className="vs-vehicle-name our">{currentMatchup?.our}</span>
                <span className="vs-badge">VS</span>
                <span className="vs-vehicle-name their">{currentMatchup?.vs}</span>
              </div>
              
              <button onClick={handleNext} className="btn-icon w-10 h-10" data-testid="next-matchup">
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="vs-card p-8 flex flex-col items-center justify-center gap-3 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsla(280, 70%, 60%, 1)' }} />
              <p className="text-sm text-muted-foreground">Generating battle card...</p>
            </div>
          )}

          {/* Comparison Card */}
          {comparison && !isLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Headline */}
              <div className="vs-card vs-headline p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4" style={{ color: 'hsla(45, 100%, 55%, 1)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Winning Point</span>
                </div>
                <p className="text-lg font-bold" style={{ color: 'hsla(45, 100%, 65%, 1)' }}>
                  {comparison.headline}
                </p>
              </div>

              {/* Quick Win */}
              <div className="vs-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: 'hsla(280, 70%, 60%, 1)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Win</span>
                  </div>
                  <button
                    onClick={() => handleCopy(comparison.quickWin, 'quickwin')}
                    className="btn-icon w-7 h-7"
                    data-testid="copy-quickwin"
                  >
                    {copied === 'quickwin' ? (
                      <Check className="w-3.5 h-3.5" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{comparison.quickWin}</p>
              </div>

              {/* Advantages Grid */}
              <div className="vs-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Key Advantages</span>
                </div>
                <div className="space-y-2">
                  {comparison.advantages?.map((adv, i) => {
                    const category = COMPARISON_CATEGORIES.find(c => c.id === adv.category);
                    const Icon = category?.icon || Star;
                    return (
                      <div key={i} className="vs-advantage-row">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: 'hsla(280, 60%, 60%, 1)' }} />
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground w-20">
                            {category?.label || adv.category}
                          </span>
                        </div>
                        <span className="text-xs text-foreground flex-1">{adv.point}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Objection Crushers */}
              <div className="vs-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" style={{ color: 'hsla(0, 70%, 55%, 1)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Objection Crushers</span>
                </div>
                <div className="space-y-2">
                  {comparison.objectionCrushers?.map((crusher, i) => (
                    <div key={i} className="vs-crusher-row group">
                      <p className="text-xs text-foreground leading-relaxed flex-1">{crusher}</p>
                      <button
                        onClick={() => handleCopy(crusher, `crusher-${i}`)}
                        className="btn-icon w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copied === `crusher-${i}` ? (
                          <Check className="w-3.5 h-3.5" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Closing Line */}
              <div className="vs-card vs-closing p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🎯 Close It</span>
                  <button
                    onClick={() => handleCopy(comparison.closingLine, 'closing')}
                    className="btn-icon w-7 h-7"
                    data-testid="copy-closing"
                  >
                    {copied === 'closing' ? (
                      <Check className="w-3.5 h-3.5" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-foreground font-medium">{comparison.closingLine}</p>
              </div>
            </div>
          )}

          {/* Matchup Counter */}
          {!showCustom && currentSegment && (
            <div className="flex justify-center gap-1.5 pt-2">
              {currentSegment.matchups.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentMatchupIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentMatchupIndex 
                      ? 'bg-purple-500 w-4' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`matchup-dot-${i}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VSModal;
