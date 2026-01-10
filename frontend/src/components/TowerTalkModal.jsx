import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Sparkles, Copy, Check, MessageSquare, Heart, Flame, Languages, Mic, MicOff, Square } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Translation helper
const translateText = async (text, sourceLang = 'auto', targetLang = 'es') => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.translated_text;
  } catch (err) {
    console.error('Translation error:', err);
    return null;
  }
};

// Check if browser supports speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

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
    supercharged,
  } = useSales();
  
  const [situation, setSituation] = useState('');
  const [response, setResponse] = useState('');
  const [translatedResponse, setTranslatedResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported || !showTowerTalk) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Support both English and Spanish for Supercharg'd mode
    recognition.lang = supercharged ? 'es-US' : 'en-US';
    
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      if (final) {
        setSituation(prev => prev + (prev ? ' ' : '') + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied', {
          description: 'Please enable microphone permissions'
        });
      } else if (event.error !== 'aborted') {
        toast.error('Voice input error', {
          description: 'Please try again'
        });
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [showTowerTalk, supercharged, isListening]);

  // Update language when supercharged mode changes
  useEffect(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.lang = supercharged ? 'es-US' : 'en-US';
    }
  }, [supercharged, isListening]);

  const toggleVoiceInput = useCallback(() => {
    if (!isSpeechSupported) {
      toast.error('Voice input not supported', {
        description: 'Your browser does not support speech recognition'
      });
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setInterimTranscript('');
    } else {
      // Start listening
      if (recognitionRef.current) {
        try {
          // Update language before starting
          recognitionRef.current.lang = supercharged ? 'es-US' : 'en-US';
          recognitionRef.current.start();
          setIsListening(true);
          toast.success('Listening...', {
            description: supercharged ? 'Speak in English or Spanish' : 'Speak now'
          });
        } catch (e) {
          console.error('Failed to start recognition:', e);
          toast.error('Could not start voice input');
        }
      }
    }
  }, [isListening, supercharged]);

  // Cleanup on modal close
  useEffect(() => {
    if (!showTowerTalk && recognitionRef.current) {
      recognitionRef.current.abort();
      setIsListening(false);
      setInterimTranscript('');
    }
  }, [showTowerTalk]);

  if (!showTowerTalk) return null;

  const handleGenerate = async () => {
    if (!situation.trim()) return;
    
    // Stop voice input if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    }
    
    setIsLoading(true);
    setError('');
    setResponse('');
    setTranslatedResponse('');
    setShowTranslated(false);

    try {
      let situationToSend = situation;
      
      // If Supercharg'd mode is active, translate Spanish input to English for the AI
      if (supercharged) {
        setIsTranslating(true);
        const translated = await translateText(situation, 'auto', 'en');
        if (translated) {
          situationToSend = translated;
        }
        setIsTranslating(false);
      }

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
        body: JSON.stringify({ situation: situationToSend, context }),
      });

      if (!res.ok) throw new Error('Failed to generate response');

      const data = await res.json();
      setResponse(data.response);

      // If Supercharg'd mode is active, also translate the response to Spanish
      if (supercharged) {
        setIsTranslating(true);
        const translatedResp = await translateText(data.response, 'en', 'es');
        if (translatedResp) {
          setTranslatedResponse(translatedResp);
          setShowTranslated(true);
        }
        setIsTranslating(false);
      }
    } catch (err) {
      setError('Unable to connect. Try again or check your connection.');
      console.error('Tower Talk error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = showTranslated && translatedResponse ? translatedResponse : response;
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = () => {
    const textToSend = showTranslated && translatedResponse ? translatedResponse : response;
    shareToMessages(textToSend);
  };

  const handleSaveToFavorites = () => {
    const customerName = selectedCustomer?.firstName || selectedCustomer?.name?.split(' ')[0] || null;
    const vehicle = selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : null;
    const textToSave = showTranslated && translatedResponse ? translatedResponse : response;
    
    addFavorite({ response: textToSave, situation, customerName, vehicle });
    
    setIsSaved(true);
    toast.success('Saved to Favorites!');
  };

  const handleClose = () => {
    // Stop voice input
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
    setInterimTranscript('');
    
    toggleTowerTalk(false);
    setSituation('');
    setResponse('');
    setTranslatedResponse('');
    setError('');
    setIsSaved(false);
    setShowTranslated(false);
  };

  const toggleLanguage = () => {
    setShowTranslated(!showTranslated);
  };

  const displayedResponse = showTranslated && translatedResponse ? translatedResponse : response;

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
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-foreground">Tower Talk</h2>
                {supercharged && (
                  <span className="supercharged-badge">
                    <Flame className="w-3 h-3" />
                    ES/EN
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {supercharged ? 'Bilingual AI response' : 'AI-powered response'}
              </p>
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

          {/* Supercharg'd mode hint */}
          {supercharged && (
            <div 
              className="p-3 rounded-xl text-xs flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, hsla(25, 100%, 30%, 0.15) 0%, hsla(35, 100%, 25%, 0.1) 100%)',
                border: '1px solid hsla(30, 100%, 50%, 0.25)'
              }}
            >
              <Flame className="w-4 h-4" style={{ color: 'hsla(30, 100%, 55%, 1)' }} />
              <span style={{ color: 'hsla(35, 100%, 65%, 1)' }}>
                Supercharg&apos;d: Type or speak in English or Spanish
              </span>
            </div>
          )}

          {/* Situation input with voice */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">
                Describe the situation {supercharged && <span className="text-muted-foreground font-normal">(EN/ES)</span>}
              </label>
              
              {/* Voice Input Button */}
              {isSpeechSupported && (
                <button
                  onClick={toggleVoiceInput}
                  className={`voice-input-btn ${isListening ? 'active' : ''}`}
                  data-testid="voice-input-btn"
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? (
                    <>
                      <div className="voice-pulse" />
                      <MicOff className="w-4 h-4 relative z-10" />
                    </>
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                  <span className="text-[10px] font-medium ml-1">
                    {isListening ? 'Stop' : 'Voice'}
                  </span>
                </button>
              )}
            </div>
            
            <div className="relative">
              <textarea
                value={situation + (interimTranscript ? (situation ? ' ' : '') + interimTranscript : '')}
                onChange={(e) => {
                  // Only update if not currently receiving voice input
                  if (!interimTranscript) {
                    setSituation(e.target.value);
                  }
                }}
                placeholder={supercharged 
                  ? "e.g., El cliente mencionó que acaba de tener un bebé... / Customer mentioned they just had a baby..."
                  : "e.g., Customer mentioned they just had a baby and need more space..."
                }
                className={`input-luxury min-h-[120px] resize-none ${isListening ? 'voice-active' : ''}`}
                rows={4}
                data-testid="tower-talk-input"
              />
              
              {/* Voice listening indicator */}
              {isListening && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <div className="voice-indicator">
                    <span className="voice-dot" />
                    <span className="voice-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="voice-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Listening...</span>
                </div>
              )}
            </div>
            
            {/* Interim transcript preview */}
            {interimTranscript && (
              <p className="text-xs text-muted-foreground italic px-1">
                Hearing: &ldquo;{interimTranscript}&rdquo;
              </p>
            )}
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
                {isTranslating ? 'Translating...' : 'Generating...'}
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
                {/* Language toggle for Supercharg'd mode */}
                {supercharged && translatedResponse && (
                  <button
                    onClick={toggleLanguage}
                    className="absolute top-3 right-12 btn-icon w-9 h-9"
                    style={{
                      background: showTranslated 
                        ? 'hsla(25, 100%, 50%, 0.2)' 
                        : 'hsla(220, 10%, 15%, 0.8)',
                      borderColor: showTranslated 
                        ? 'hsla(25, 100%, 50%, 0.3)' 
                        : 'hsla(220, 8%, 25%, 0.5)',
                    }}
                    data-testid="toggle-language-btn"
                    title={showTranslated ? 'Show English' : 'Show Spanish'}
                  >
                    <Languages 
                      className="w-4 h-4" 
                      style={{ color: showTranslated ? 'hsla(30, 100%, 60%, 1)' : 'hsla(220, 10%, 50%, 1)' }}
                    />
                  </button>
                )}

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
                
                {/* Language indicator */}
                {supercharged && translatedResponse && (
                  <div className="mb-2">
                    <span 
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        background: showTranslated ? 'hsla(25, 100%, 50%, 0.2)' : 'hsla(210, 80%, 50%, 0.2)',
                        color: showTranslated ? 'hsla(30, 100%, 60%, 1)' : 'hsla(210, 100%, 70%, 1)',
                      }}
                    >
                      {showTranslated ? 'Español' : 'English'}
                    </span>
                  </div>
                )}
                
                <p className="text-[15px] text-foreground leading-relaxed pr-20 whitespace-pre-wrap">
                  {displayedResponse}
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
