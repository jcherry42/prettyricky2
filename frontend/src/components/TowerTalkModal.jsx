import React, { useState } from 'react';
import { X, Loader2, Sparkles, Copy, Check, MessageSquare, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

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
    addFavorite,
  } = useSales();
  
  const [situation, setSituation] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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

      if (!res.ok) throw new Error('Failed to generate response');

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

  const handleSaveToFavorites = () => {
    const customerName = selectedCustomer?.firstName || selectedCustomer?.name?.split(' ')[0] || null;
    const vehicle = selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : null;
    
    addFavorite({ response, situation, customerName, vehicle });
    
    setIsSaved(true);
    toast.success('Saved to Favorites!');
  };

  const handleClose = () => {
    toggleTowerTalk(false);
    setSituation('');
    setResponse('');
    setError('');
    setIsSaved(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'hsla(0, 0%, 0%, 0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-luxury w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="modal-handle" />
        </div>
        
        {/* Header with red ambient */}
        <div className="flex items-center justify-between px-5 pb-4" style={{ borderBottom: '1px solid hsla(0, 50%, 30%, 0.3)' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center ambient-red"
              style={{ background: 'linear-gradient(135deg, hsla(0, 70%, 45%, 1) 0%, hsla(0, 80%, 35%, 1) 100%)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">Tower Talk</h2>
              <p className="text-xs text-muted-foreground">AI-powered response</p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="btn-icon"
            data-testid="close-tower-talk"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] hide-scrollbar">
          {/* Context summary */}
          {selectedCustomer && (
            <div 
              className="p-4 rounded-xl text-sm"
              style={{
                background: 'linear-gradient(135deg, hsla(0, 40%, 25%, 0.15) 0%, hsla(0, 30%, 20%, 0.1) 100%)',
                border: '1px solid hsla(0, 50%, 40%, 0.2)'
              }}
            >
              <p className="text-muted-foreground">
                Generating for{' '}
                <span style={{ color: 'hsla(0, 70%, 65%, 1)' }} className="font-semibold">
                  {selectedCustomer.name || `${selectedCustomer.firstName} ${selectedCustomer.lastName || ''}`.trim()}
                </span>
                {selectedVehicle && (
                  <>
                    {' '}interested in{' '}
                    <span style={{ color: 'hsla(0, 70%, 65%, 1)' }} className="font-semibold">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </span>
                  </>
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
              placeholder="e.g., Customer mentioned they just had a baby and need more space..."
              className="input-luxury min-h-[120px] resize-none"
              rows={4}
              data-testid="tower-talk-input"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!situation.trim() || isLoading}
            className="btn-tower w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="generate-response-btn"
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
            <div 
              className="p-4 rounded-xl text-sm"
              style={{
                background: 'hsla(0, 70%, 40%, 0.15)',
                border: '1px solid hsla(0, 70%, 50%, 0.3)',
                color: 'hsla(0, 80%, 70%, 1)'
              }}
            >
              {error}
            </div>
          )}

          {/* Generated response */}
          {response && (
            <div className="space-y-4 animate-fade-in">
              <div 
                className="p-5 rounded-xl relative"
                style={{
                  background: 'linear-gradient(135deg, hsla(0, 30%, 18%, 0.3) 0%, hsla(0, 25%, 12%, 0.25) 100%)',
                  border: '1px solid hsla(0, 40%, 35%, 0.3)'
                }}
              >
                {/* Save to favorites button */}
                <button
                  onClick={handleSaveToFavorites}
                  disabled={isSaved}
                  className="absolute top-3 right-3 btn-icon w-9 h-9"
                  style={isSaved ? {
                    background: 'hsla(0, 70%, 50%, 0.2)',
                    borderColor: 'hsla(0, 70%, 50%, 0.3)',
                  } : {}}
                  data-testid="save-to-favorites-btn"
                >
                  <Heart 
                    className="w-4 h-4" 
                    style={{ color: isSaved ? 'hsla(0, 70%, 60%, 1)' : 'hsla(220, 10%, 50%, 1)' }}
                    fill={isSaved ? 'hsla(0, 70%, 60%, 1)' : 'none'}
                  />
                </button>
                
                <p className="text-[15px] text-foreground leading-relaxed pr-10 whitespace-pre-wrap">
                  {response}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-steel flex-1 flex items-center justify-center gap-2"
                  style={copied ? {
                    background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.3) 0%, hsla(145, 50%, 25%, 0.25) 100%)',
                    borderColor: 'hsla(145, 60%, 45%, 0.4)',
                    color: 'hsla(145, 70%, 60%, 1)',
                  } : {}}
                  data-testid="copy-tower-talk-response"
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
                  className="btn-luxury flex-1 flex items-center justify-center gap-2"
                  data-testid="send-tower-talk-response"
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
