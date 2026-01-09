import React, { useState } from 'react';
import { X, Loader2, Sparkles, Copy, Check, MessageSquare } from 'lucide-react';
import { useSales } from '../context/SalesContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const TowerTalkModal = () => {
  const { 
    showTowerTalk, 
    toggleTowerTalk,
    selectedCustomer,
    selectedVehicle,
    dealership,
    salesperson,
    copyToClipboard,
    shareToMessages,
  } = useSales();
  
  const [situation, setSituation] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!showTowerTalk) return null;

  const handleGenerate = async () => {
    if (!situation.trim()) return;
    
    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const context = {
        customerName: selectedCustomer?.firstName || selectedCustomer?.name?.split(' ')[0] || 'the customer',
        vehicle: selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : 'the vehicle',
        vehiclePrice: selectedVehicle?.price ? `$${selectedVehicle.price.toLocaleString()}` : '',
        tradeIn: selectedCustomer?.tradeVehicle ? 
          `${selectedCustomer.tradeVehicle.year} ${selectedCustomer.tradeVehicle.make} ${selectedCustomer.tradeVehicle.model}` : null,
        dealershipName: dealership.name,
        salespersonName: salesperson.name,
        salespersonStyle: salesperson.style,
      };

      const res = await fetch(`${BACKEND_URL}/api/tower-talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, context }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate response');
      }

      const data = await res.json();
      setResponse(data.response);
    } catch (err) {
      setError('Unable to connect. Try again or check your connection.');
      console.error('Tower Talk error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(response);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = () => {
    shareToMessages(response);
  };

  const handleClose = () => {
    toggleTowerTalk(false);
    setSituation('');
    setResponse('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="bottom-sheet w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl icon-bg-tower flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Tower Talk</h2>
              <p className="text-xs text-muted-foreground">AI-powered personalized response</p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="ios-btn w-9 h-9 bg-muted/50 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] hide-scrollbar">
          {/* Context summary */}
          {selectedCustomer && (
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 text-sm">
              <p className="text-muted-foreground">
                Generating for <span className="text-primary font-semibold">{selectedCustomer.name}</span>
                {selectedVehicle && (
                  <> interested in <span className="text-primary font-semibold">
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </span></>
                )}
              </p>
            </div>
          )}

          {/* Situation input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Describe the situation
            </label>
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="e.g., Customer mentioned they just had a baby and need more space. They're comparing to a Honda Pilot at another dealer..."
              className="ios-input min-h-[120px] resize-none"
              rows={4}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!situation.trim() || isLoading}
            className="ios-btn-tower w-full disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Response
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm border border-destructive/20">
              {error}
            </div>
          )}

          {/* Generated response */}
          {response && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 bg-gradient-to-br from-tower/10 to-tower/5 border border-tower/20 rounded-xl">
                <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {response}
                </p>
              </div>
              
              <div className="flex gap-2.5">
                <button
                  onClick={handleCopy}
                  className={`
                    ios-btn flex-1 text-sm gap-2 font-semibold
                    ${copied 
                      ? 'ios-btn-success' 
                      : 'ios-btn-secondary'
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleSend}
                  className="ios-btn-primary flex-1 text-sm gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  iMessage
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TowerTalkModal;
