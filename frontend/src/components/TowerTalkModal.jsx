import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Sparkles, Copy, Check, MessageSquare, Heart, Flame, Languages, Mic, MicOff, Volume2, VolumeX, Zap } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';
import { translateText } from '../utils/translationService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Quick Response Shortcuts - Common objections and situations
const QUICK_SHORTCUTS = [
  { id: 'price_high', label: 'Price Too High', icon: '💰', situation: 'Customer says the price is too high and wants a better deal' },
  { id: 'need_think', label: 'Need to Think', icon: '🤔', situation: 'Customer says they need to think about it and will come back later' },
  { id: 'trade_in', label: 'Trade-In Value', icon: '🔄', situation: 'Customer is unhappy with the trade-in value offered for their current vehicle' },
  { id: 'competitor', label: 'Better Deal Elsewhere', icon: '🏷️', situation: 'Customer says they found a better deal at another dealership' },
  { id: 'payment', label: 'Payment Too High', icon: '📊', situation: 'Customer says the monthly payment is more than they can afford' },
  { id: 'spouse', label: 'Check with Spouse', icon: '💑', situation: 'Customer says they need to check with their spouse before making a decision' },
  { id: 'features', label: 'Missing Features', icon: '⚙️', situation: 'Customer is interested but the vehicle is missing some features they wanted' },
  { id: 'timing', label: 'Not Ready Yet', icon: '⏰', situation: 'Customer says they are just looking and not ready to buy right now' },
];

// Check if browser supports speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// Check if browser supports speech synthesis
const isSpeechSynthesisSupported = 'speechSynthesis' in window;

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
  const [showShortcuts, setShowShortcuts] = useState(true);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);
  
  // Voice output state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported || !showTowerTalk) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setInterimTranscript('');
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = supercharged ? 'es-US' : 'en-US';
          recognitionRef.current.start();
          setIsListening(true);
          toast.success('Listening...', {
            description: supercharged ? 'Speak in Spanish, French, or Korean' : 'Speak now'
          });
        } catch (e) {
          console.error('Failed to start recognition:', e);
          toast.error('Could not start voice input');
        }
      }
    }
  }, [isListening, supercharged]);

  // Voice output functions
  const speakText = useCallback((text, lang = 'en-US') => {
    if (!isSpeechSynthesisSupported) {
      toast.error('Text-to-speech not supported', {
        description: 'Your browser does not support speech synthesis'
      });
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = lang.split('-')[0];
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(langPrefix) && (v.name.includes('Enhanced') || v.name.includes('Premium') || v.localService)
    ) || voices.find(v => v.lang.startsWith(langPrefix));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      if (event.error !== 'canceled') {
        toast.error('Could not read aloud');
      }
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToSpeak = showTranslated && translatedResponse ? translatedResponse : response;
      const lang = showTranslated ? 'es-ES' : 'en-US';
      speakText(textToSpeak, lang);
      toast.success('Reading aloud...', {
        description: showTranslated ? 'En español' : 'En español'
      });
    }
  }, [isSpeaking, showTranslated, translatedResponse, response, speakText]);

  // Cleanup on modal close
  useEffect(() => {
    if (!showTowerTalk) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      setIsListening(false);
      setIsSpeaking(false);
      setInterimTranscript('');
    }
  }, [showTowerTalk]);

  useEffect(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [showTranslated, isSpeaking]);

  useEffect(() => {
    if (isSpeechSynthesisSupported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Hide shortcuts when user starts typing
  useEffect(() => {
    if (situation.trim()) {
      setShowShortcuts(false);
    }
  }, [situation]);

  if (!showTowerTalk) return null;

  const handleGenerate = async (customSituation = null) => {
    const situationText = customSituation || situation;
    if (!situationText.trim()) return;
    
    // Stop voice input if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    }
    
    // Stop any speech
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    
    // Update situation if using shortcut
    if (customSituation) {
      setSituation(customSituation);
    }
    
    setIsLoading(true);
    setError('');
    setResponse('');
    setTranslatedResponse('');
    setShowTranslated(false);
    setShowShortcuts(false);

    try {
      let situationToSend = situationText;
      
      if (supercharged) {
        setIsTranslating(true);
        const result = await translateText(situationText, 'auto', 'en');
        if (result?.success && result.translatedText) {
          situationToSend = result.translatedText;
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to generate response');
      }

      const data = await res.json();
      
      if (!data.response || data.response.trim().length === 0) {
        throw new Error('Received empty response from server');
      }
      
      setResponse(data.response);

      if (supercharged) {
        setIsTranslating(true);
        const result = await translateText(data.response, 'en', 'es');
        if (result?.success && result.translatedText) {
          setTranslatedResponse(result.translatedText);
          setShowTranslated(true);
        }
        setIsTranslating(false);
      }
    } catch (err) {
      console.error('[Tower Talk] Exception:', err);
      setError('Unable to connect. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShortcutClick = (shortcut) => {
    // Instant generation with the shortcut
    handleGenerate(shortcut.situation);
    toast.success(`Quick: ${shortcut.label}`, {
      description: 'Generating response...'
    });
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
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    window.speechSynthesis.cancel();
    
    setIsListening(false);
    setIsSpeaking(false);
    setInterimTranscript('');
    
    toggleTowerTalk(false);
    setSituation('');
    setResponse('');
    setTranslatedResponse('');
    setError('');
    setIsSaved(false);
    setShowTranslated(false);
    setShowShortcuts(true);
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

          {/* Quick Response Shortcuts */}
          {showShortcuts && !isLoading && !response && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 px-1">
                <Zap className="w-3.5 h-3.5" style={{ color: 'hsla(45, 100%, 55%, 1)' }} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Responses
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut.id}
                    onClick={() => handleShortcutClick(shortcut)}
                    className="quick-shortcut-btn"
                    data-testid={`shortcut-${shortcut.id}`}
                  >
                    <span className="shortcut-icon">{shortcut.icon}</span>
                    <span className="shortcut-label">{shortcut.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Tap for instant AI response • Or type below for custom situations
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
                Supercharg&apos;d: Type or speak in Spanish, French, or Korean
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
                  if (!interimTranscript) {
                    setSituation(e.target.value);
                  }
                }}
                placeholder={supercharged 
                  ? "e.g., El cliente mencionó que acaba de tener un bebé... / Customer mentioned they just had a baby..."
                  : "e.g., Customer mentioned they just had a baby and need more space..."
                }
                className={`input-luxury min-h-[100px] resize-none ${isListening ? 'voice-active' : ''}`}
                rows={3}
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
            onClick={() => handleGenerate()}
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
                {/* Top action buttons row */}
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {/* Read Aloud Button */}
                  {isSpeechSynthesisSupported && (
                    <button
                      onClick={toggleSpeech}
                      className={`btn-icon w-9 h-9 ${isSpeaking ? 'speaking-active' : ''}`}
                      style={isSpeaking ? {
                        background: 'hsla(145, 60%, 40%, 0.25)',
                        borderColor: 'hsla(145, 70%, 50%, 0.4)',
                      } : {}}
                      data-testid="read-aloud-btn"
                      title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-4 h-4" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                      ) : (
                        <Volume2 className="w-4 h-4" style={{ color: 'hsla(220, 10%, 50%, 1)' }} />
                      )}
                    </button>
                  )}
                  
                  {/* Language toggle for Supercharg'd mode */}
                  {supercharged && translatedResponse && (
                    <button
                      onClick={toggleLanguage}
                      className="btn-icon w-9 h-9"
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
                    className="btn-icon w-9 h-9"
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
                </div>
                
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
                
                {/* Speaking indicator */}
                {isSpeaking && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="speaking-indicator">
                      <span className="speaking-bar" />
                      <span className="speaking-bar" style={{ animationDelay: '0.1s' }} />
                      <span className="speaking-bar" style={{ animationDelay: '0.2s' }} />
                      <span className="speaking-bar" style={{ animationDelay: '0.3s' }} />
                      <span className="speaking-bar" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: 'hsla(145, 70%, 55%, 1)' }}>
                      Reading aloud...
                    </span>
                  </div>
                )}
                
                <p className="text-[15px] text-foreground leading-relaxed pr-28 whitespace-pre-wrap">
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
              
              {/* New Response button */}
              <button
                onClick={() => {
                  setResponse('');
                  setTranslatedResponse('');
                  setSituation('');
                  setIsSaved(false);
                  setShowShortcuts(true);
                }}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="new-response-btn"
              >
                ← New Response
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TowerTalkModal;
