import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Check, MessageSquare, Clock, ChevronDown, ChevronUp, Languages, Flame, Loader2, Pencil, X, Volume2, VolumeX } from 'lucide-react';
import { translateText, SUPPORTED_LANGUAGES, getLanguageByCode } from '../utils/translationService';
import { useSales } from '../context/SalesContext';
import { FOLLOW_UP_RULES } from '../data/salesData';
import { SkeletonCard } from './ui/LoadingStates';
import { NoResponses } from './ui/EmptyStates';
import haptics from '../utils/haptics';
import { announceToScreenReader } from '../utils/accessibility';

// Check if browser supports speech synthesis
const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Language config - matches VoiceTranslator
const LANG_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', code: 'en', speechCode: 'en-US' },
  es: { name: 'Spanish', flag: '🇪🇸', code: 'es', speechCode: 'es-US' },
  fr: { name: 'French', flag: '🇫🇷', code: 'fr', speechCode: 'fr-FR' },
  ja: { name: 'Japanese', flag: '🇯🇵', code: 'ja', speechCode: 'ja-JP' },
  ko: { name: 'Korean', flag: '🇰🇷', code: 'ko', speechCode: 'ko-KR' },
};

// Get target language from user settings
const getTargetLanguage = () => {
  const stored = localStorage.getItem('defaultTargetLanguage');
  return stored && LANG_CONFIG[stored] ? stored : 'es';
};

export const ResponseCards = () => {
  const { 
    currentResponses, 
    selectedResponse, 
    selectResponse,
    selectedCustomer,
    copyToClipboard,
    shareToMessages,
    supercharged,
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);
  const [expandedFollowUp, setExpandedFollowUp] = useState(null);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});
  const [showTranslated, setShowTranslated] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editedTexts, setEditedTexts] = useState({});
  const [editedTranslations, setEditedTranslations] = useState({});
  const [translatingEdited, setTranslatingEdited] = useState({});
  const [speakingId, setSpeakingId] = useState(null);
  const [targetLang, setTargetLang] = useState(getTargetLanguage);

  // Update target language when it changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setTargetLang(getTargetLanguage());
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check on focus in case user changed it in another component
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  const targetConfig = LANG_CONFIG[targetLang] || LANG_CONFIG.es;

  // FIX: Translate responses when supercharged mode is active - use selected language
  const translateResponse = useCallback(async (responseId, text, isFollowUp = false) => {
    const key = isFollowUp ? `${responseId}-followup` : responseId;
    const currentTargetLang = getTargetLanguage();
    
    if (translations[key]) {
      return; // Already translated
    }
    
    console.log(`[Sport Mode] Translating ${key} to ${currentTargetLang}:`, text.substring(0, 50));
    setTranslating(prev => ({ ...prev, [key]: true }));
    
    try {
      const result = await translateText(text, 'en', currentTargetLang);
      if (result && result.success && result.translatedText) {
        console.log(`[Sport Mode] ✅ Translated ${key} to ${currentTargetLang}`);
        setTranslations(prev => ({ ...prev, [key]: result.translatedText }));
      } else {
        console.error(`[Sport Mode] Translation failed for ${key}:`, result?.error);
      }
    } catch (err) {
      console.error(`[Sport Mode] Translation error for ${key}:`, err);
    }
    
    setTranslating(prev => ({ ...prev, [key]: false }));
  }, []); // No dependencies - function only uses setters which are stable

  // Track which responses have been queued for translation
  const translationQueuedRef = useRef(new Set());

  // FIX: Auto-translate when supercharged and responses change - with proper debouncing
  useEffect(() => {
    if (!supercharged || currentResponses.length === 0) {
      translationQueuedRef.current.clear();
      return;
    }
    
    // Only translate responses that haven't been queued yet
    const responsesToTranslate = currentResponses.filter(response => {
      const key = response.id;
      if (translationQueuedRef.current.has(key)) return false;
      translationQueuedRef.current.add(key);
      return true;
    });

    if (responsesToTranslate.length > 0) {
      console.log(`[Sport Mode] 🔥 Translating ${responsesToTranslate.length} responses to ${targetLang}`);
      responsesToTranslate.forEach(response => {
        translateResponse(response.id, response.text);
        if (response.followUpText) {
          translateResponse(response.id, response.followUpText, true);
        }
      });
    }
  }, [supercharged, currentResponses, targetLang]);

  // Reset translations when supercharged mode is turned off or language changes
  useEffect(() => {
    if (!supercharged) {
      console.log('[Sport Mode] Mode disabled - clearing translations');
      translationQueuedRef.current.clear();
      setTimeout(() => {
        setTranslations({});
        setShowTranslated({});
      }, 0);
    }
  }, [supercharged]);

  // Text-to-speech function - uses correct language
  const speakText = useCallback((responseId, text, isTranslated = false) => {
    if (!isSpeechSupported) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // If already speaking this response, just stop
    if (speakingId === responseId) {
      setSpeakingId(null);
      return;
    }
    
    // For translated text: Add natural pauses
    let processedText = text;
    if (isTranslated) {
      // Add micro-pauses at punctuation for more natural rhythm
      processedText = text
        .replace(/\./g, '... ')      // Longer pause at periods
        .replace(/,/g, ', ')         // Slight pause at commas
        .replace(/!/g, '! ')         // Pause after exclamation
        .replace(/\?/g, '? ');       // Pause after question
    }
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    const currentTargetLang = getTargetLanguage();
    const langConfig = LANG_CONFIG[currentTargetLang] || LANG_CONFIG.es;
    
    // Voice optimization based on target language
    if (isTranslated) {
      utterance.lang = langConfig.speechCode;
      utterance.rate = 0.85;         // Slower for natural conversation
      utterance.pitch = 1.1;         // Slightly higher for warmth
      utterance.volume = 0.95;
    } else {
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 1;
      utterance.volume = 1;
    }
    
    // Find the best voice available for the target language
    const voices = window.speechSynthesis.getVoices();
    
    if (isTranslated) {
      // Find voice for target language
      const targetVoice = 
        // Premium/natural voices first
        voices.find(v => v.lang.startsWith(currentTargetLang) && /natural|enhanced|premium|neural|wavenet/i.test(v.name)) ||
        // Local service voices (usually better quality)
        voices.find(v => v.lang.startsWith(currentTargetLang) && v.localService) ||
        // Any voice for the language
        voices.find(v => v.lang.startsWith(currentTargetLang));
      
      if (targetVoice) {
        utterance.voice = targetVoice;
        // Adjust rate based on voice type
        if (targetVoice.name.includes('Google') || targetVoice.name.includes('wavenet')) {
          utterance.rate = 0.9;
        }
      }
    } else {
      // English voice
      const englishVoice = 
        voices.find(v => v.name === 'Samantha') ||
        voices.find(v => v.name === 'Alex') ||
        voices.find(v => v.lang.startsWith('en') && /natural|enhanced|premium/i.test(v.name)) ||
        voices.find(v => v.lang === 'en-US' && v.localService) ||
        voices.find(v => v.lang.startsWith('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }
    
    utterance.onstart = () => setSpeakingId(responseId);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  // Get display text helper
  const getDisplayText = useCallback((response) => {
    const key = response.id;
    if (editedTexts[key] && editedTranslations[key] && showTranslated[key]) {
      return editedTranslations[key];
    }
    if (editedTexts[key]) {
      return editedTexts[key];
    }
    if (supercharged && showTranslated[key] && translations[key]) {
      return translations[key];
    }
    return response.text;
  }, [editedTexts, editedTranslations, showTranslated, supercharged, translations]);

  // Show empty state if no customer selected
  if (!selectedCustomer) {
    return null;
  }

  // Show empty state when no responses yet
  if (currentResponses.length === 0) {
    return null;
  }

  const handleCopy = async (response, e) => {
    e.stopPropagation();
    haptics.tap();
    const textToCopy = getDisplayText(response);
    
    const success = await copyToClipboard(textToCopy);
    if (success) {
      haptics.success();
      setCopiedId(response.id);
      setEditingId(null);
      announceToScreenReader('Response copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendMessage = (response, e) => {
    e.stopPropagation();
    haptics.button();
    const textToSend = getDisplayText(response);
    
    setEditingId(null);
    shareToMessages(textToSend);
    announceToScreenReader('Opening iMessage');
  };

  const handleCopyFollowUp = async (response, e) => {
    e.stopPropagation();
    haptics.tap();
    const key = `${response.id}-followup`;
    const textToCopy = supercharged && showTranslated[key] && translations[key] 
      ? translations[key] 
      : response.followUpText;
    
    const success = await copyToClipboard(textToCopy);
    if (success) {
      haptics.success();
      setCopiedId(key);
      announceToScreenReader('Follow-up copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleLanguage = (key, e) => {
    e.stopPropagation();
    haptics.select();
    setShowTranslated(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditing = (responseId, text, e) => {
    e.stopPropagation();
    setEditingId(responseId);
    if (!editedTexts[responseId]) {
      setEditedTexts(prev => ({ ...prev, [responseId]: text }));
    }
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleTextChange = (responseId, newText) => {
    setEditedTexts(prev => ({ ...prev, [responseId]: newText }));
    // Clear any existing translation when text changes
    setEditedTranslations(prev => {
      const updated = { ...prev };
      delete updated[responseId];
      return updated;
    });
  };

  const translateEditedText = async (responseId, e) => {
    e.stopPropagation();
    const textToTranslate = editedTexts[responseId];
    
    console.log('[Translation] Translating edited text for response:', responseId);
    console.log('[Translation] Text to translate:', textToTranslate);
    
    if (!textToTranslate) {
      console.log('[Translation] No text to translate');
      return;
    }
    
    setTranslatingEdited(prev => ({ ...prev, [responseId]: true }));
    
    try {
      const result = await translateText(textToTranslate, 'en', 'es');
      console.log('[Translation] Translation result:', result);
      
      if (result.success && result.translatedText) {
        setEditedTranslations(prev => ({ ...prev, [responseId]: result.translatedText }));
        // Automatically show translated text after translating
        setShowTranslated(prev => ({ ...prev, [responseId]: true }));
        console.log('[Translation] Translation saved and translated view enabled');
        console.log('[Translation] Confidence:', result.confidence, 'Cached:', result.cached);
      } else {
        console.error('[Translation] Translation failed:', result.error);
      }
    } catch (err) {
      console.error('[Translation] Translation error:', err);
    } finally {
      setTranslatingEdited(prev => ({ ...prev, [responseId]: false }));
    }
  };

  const handleSpeak = (response, e) => {
    e.stopPropagation();
    const key = response.id;
    const text = getDisplayText(response);
    const isTranslated = (editedTranslations[key] && showTranslated[key]) || 
                      (supercharged && showTranslated[key] && translations[key]);
    speakText(key, text, isTranslated);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h2 
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ 
            color: 'rgba(255, 200, 150, 0.6)', 
            fontFamily: "'Bebas Neue', sans-serif", 
            letterSpacing: '0.12em' 
          }}
        >
          GENERATED RESPONSES
        </h2>
        {supercharged && (
          <span 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.2) 0%, rgba(255, 100, 0, 0.15) 100%)',
              border: '1px solid rgba(255, 100, 0, 0.3)',
              color: '#ff6b6b',
              fontFamily: "'Bebas Neue', sans-serif",
              boxShadow: '0 0 12px rgba(255, 68, 68, 0.2)'
            }}
          >
            <Flame className="w-3 h-3" />
            SPORT MODE
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {currentResponses.map((response, index) => {
          const isSelected = selectedResponse?.id === response.id;
          const isCopied = copiedId === response.id;
          const isFollowUpCopied = copiedId === `${response.id}-followup`;
          const isFollowUpExpanded = expandedFollowUp === response.id;
          const followUpRule = FOLLOW_UP_RULES.find(r => r.id === response.followUp);
          
          const mainKey = response.id;
          const followUpKey = `${response.id}-followup`;
          const isMainTranslating = translating[mainKey];
          const isFollowUpTranslating = translating[followUpKey];
          const mainTranslation = translations[mainKey];
          const followUpTranslation = translations[followUpKey];
          const showMainTranslated = showTranslated[mainKey];
          const showFollowUpTranslated = showTranslated[followUpKey];
          
          const displayedText = getDisplayText(response);
          const isEditing = editingId === response.id;
          
          const displayedFollowUp = supercharged && showFollowUpTranslated && followUpTranslation 
            ? followUpTranslation 
            : response.followUpText;
          
          return (
            <div
              key={response.id}
              onClick={() => !isEditing && selectResponse(response)}
              className="infotainment-panel p-5 cursor-pointer luxury-transition"
              data-testid={`response-card-${index}`}
            >
              {/* Response header - gauge cluster style */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ 
                      color: '#FF9F43',
                      fontFamily: "'Bebas Neue', sans-serif",
                      letterSpacing: '0.1em',
                      textShadow: '0 0 8px rgba(255, 159, 67, 0.4)'
                    }}
                  >
                    RESPONSE {index + 1}
                  </span>
                  {supercharged && mainTranslation && !isEditing && (
                    <button
                      onClick={(e) => toggleLanguage(mainKey, e)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all uppercase"
                      style={{
                        background: showMainTranslated ? 'rgba(255, 100, 0, 0.2)' : 'rgba(34, 211, 238, 0.15)',
                        color: showMainTranslated ? '#ff8c00' : '#22d3ee',
                        border: `1px solid ${showMainTranslated ? 'rgba(255, 100, 0, 0.35)' : 'rgba(34, 211, 238, 0.3)'}`,
                        fontFamily: "'Bebas Neue', sans-serif",
                      }}
                      data-testid={`toggle-lang-${index}`}
                    >
                      <Languages className="w-3 h-3" />
                      {showMainTranslated ? targetConfig.code.toUpperCase() : 'EN'}
                    </button>
                  )}
                  {supercharged && isMainTranslating && (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'hsla(30, 100%, 55%, 1)' }} />
                  )}
                  {isEditing && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Editing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {followUpRule && !isEditing && (
                    <span 
                      className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: 'hsla(220, 10%, 15%, 0.8)',
                        color: 'hsla(220, 10%, 60%, 1)',
                        border: '1px solid hsla(220, 8%, 25%, 0.5)'
                      }}
                    >
                      <Clock className="w-3 h-3" />
                      {followUpRule.label}
                    </span>
                  )}
                  {isEditing ? (
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => startEditing(response.id, displayedText, e)}
                      className="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 transition-colors"
                      title="Edit before sending"
                      data-testid={`edit-response-${index}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Response text - editable or display */}
              {isEditing ? (
                <div className="mb-5">
                  <textarea
                    value={editedTexts[response.id] || displayedText}
                    onChange={(e) => handleTextChange(response.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="edit-response-textarea w-full p-3 rounded-lg text-[15px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    autoFocus
                    data-testid={`edit-textarea-${index}`}
                  />
                  {/* Translate edited text button */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => translateEditedText(response.id, e)}
                      disabled={translatingEdited[response.id] || !editedTexts[response.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(180deg, hsla(25, 100%, 50%, 0.2) 0%, hsla(25, 100%, 40%, 0.15) 100%)',
                        border: '1px solid hsla(25, 100%, 50%, 0.3)',
                        color: 'hsla(30, 100%, 60%, 1)',
                      }}
                      data-testid={`translate-edited-${index}`}
                    >
                      {translatingEdited[response.id] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Translating...
                        </>
                      ) : (
                        <>
                          <Languages className="w-3.5 h-3.5" />
                          Translate to {targetConfig.name}
                        </>
                      )}
                    </button>
                    {editedTranslations[response.id] && (
                      <button
                        onClick={(e) => toggleLanguage(mainKey, e)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: showTranslated[mainKey] ? 'hsla(25, 100%, 50%, 0.25)' : 'hsla(210, 80%, 50%, 0.2)',
                          color: showTranslated[mainKey] ? 'hsla(30, 100%, 60%, 1)' : 'hsla(210, 100%, 70%, 1)',
                          border: `1px solid ${showTranslated[mainKey] ? 'hsla(25, 100%, 50%, 0.4)' : 'hsla(210, 80%, 50%, 0.3)'}`,
                        }}
                      >
                        {showTranslated[mainKey] ? `${targetConfig.flag} ${targetConfig.name}` : '🇺🇸 English'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[15px] text-foreground leading-relaxed mb-5">
                  {displayedText}
                </p>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2">
                {/* Sport Mode Translate Button - Always visible when supercharged */}
                {supercharged && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.tap();
                      if (mainTranslation) {
                        // Toggle between languages
                        toggleLanguage(mainKey, e);
                      } else {
                        // Trigger translation
                        translateResponse(response.id, response.text, false);
                      }
                    }}
                    disabled={isMainTranslating}
                    className="sport-translate-btn flex items-center justify-center gap-1.5"
                    style={{
                      background: showMainTranslated 
                        ? 'linear-gradient(180deg, hsla(25, 100%, 50%, 0.25) 0%, hsla(25, 100%, 40%, 0.2) 100%)'
                        : 'linear-gradient(180deg, hsla(280, 70%, 50%, 0.2) 0%, hsla(280, 70%, 40%, 0.15) 100%)',
                      border: `1px solid ${showMainTranslated ? 'hsla(25, 100%, 50%, 0.4)' : 'hsla(280, 70%, 50%, 0.35)'}`,
                      color: showMainTranslated ? 'hsla(30, 100%, 60%, 1)' : 'hsla(280, 80%, 70%, 1)',
                      minWidth: '90px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                    data-testid={`sport-translate-${index}`}
                    title={mainTranslation ? (showMainTranslated ? 'Show English' : `Show ${targetConfig.name}`) : `Translate to ${targetConfig.name}`}
                  >
                    {isMainTranslating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Languages className="w-4 h-4" />
                        {mainTranslation ? (showMainTranslated ? targetConfig.flag : '🇺🇸') : targetConfig.flag}
                      </>
                    )}
                  </button>
                )}
                {isSpeechSupported && (
                  <button
                    onClick={(e) => handleSpeak(response, e)}
                    className="btn-steel flex items-center justify-center w-10"
                    style={speakingId === response.id ? {
                      background: 'linear-gradient(180deg, hsla(200, 70%, 45%, 0.3) 0%, hsla(200, 70%, 35%, 0.25) 100%)',
                      borderColor: 'hsla(200, 80%, 55%, 0.5)',
                      color: 'hsla(200, 90%, 65%, 1)',
                    } : {}}
                    data-testid={`speak-response-${index}`}
                    title={speakingId === response.id ? "Stop speaking" : "Read aloud"}
                  >
                    {speakingId === response.id ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => handleCopy(response, e)}
                  className="btn-steel flex-1 flex items-center justify-center gap-2"
                  style={isCopied ? {
                    background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.3) 0%, hsla(145, 50%, 25%, 0.25) 100%)',
                    borderColor: 'hsla(145, 60%, 45%, 0.4)',
                    color: 'hsla(145, 70%, 60%, 1)',
                  } : {}}
                  data-testid={`copy-response-${index}`}
                >
                  {isCopied ? (
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
                  onClick={(e) => handleSendMessage(response, e)}
                  className="btn-luxury flex-1 flex items-center justify-center gap-2"
                  data-testid={`send-response-${index}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  iMessage
                </button>
              </div>
              
              {/* Follow-up section */}
              {response.followUpText && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid hsla(30, 15%, 18%, 0.5)' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFollowUp(isFollowUpExpanded ? null : response.id);
                    }}
                    className="flex items-center justify-between w-full text-left py-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                        Follow-up ({followUpRule?.label})
                      </span>
                      {supercharged && isFollowUpTranslating && (
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'hsla(30, 100%, 55%, 1)' }} />
                      )}
                    </div>
                    {isFollowUpExpanded ? (
                      <ChevronUp className="w-4 h-4" style={{ color: 'hsla(40, 70%, 55%, 1)' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                  
                  {isFollowUpExpanded && (
                    <div 
                      className="mt-3 p-4 rounded-xl animate-fade-in"
                      style={{
                        background: 'linear-gradient(135deg, hsla(35, 40%, 20%, 0.2) 0%, hsla(25, 30%, 15%, 0.15) 100%)',
                        border: '1px solid hsla(40, 40%, 30%, 0.25)'
                      }}
                    >
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {displayedFollowUp}
                      </p>
                      
                      {/* Follow-up action buttons */}
                      <div className="flex gap-2">
                        {/* Sport Mode Translate Button for Follow-up */}
                        {supercharged && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              haptics.tap();
                              if (followUpTranslation) {
                                toggleLanguage(followUpKey, e);
                              } else {
                                translateResponse(response.id, response.followUpText, true);
                              }
                            }}
                            disabled={isFollowUpTranslating}
                            className="flex items-center justify-center gap-1.5"
                            style={{
                              background: showFollowUpTranslated 
                                ? 'linear-gradient(180deg, hsla(25, 100%, 50%, 0.25) 0%, hsla(25, 100%, 40%, 0.2) 100%)'
                                : 'linear-gradient(180deg, hsla(280, 70%, 50%, 0.2) 0%, hsla(280, 70%, 40%, 0.15) 100%)',
                              border: `1px solid ${showFollowUpTranslated ? 'hsla(25, 100%, 50%, 0.4)' : 'hsla(280, 70%, 50%, 0.35)'}`,
                              color: showFollowUpTranslated ? 'hsla(30, 100%, 60%, 1)' : 'hsla(280, 80%, 70%, 1)',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              minWidth: '70px',
                            }}
                            data-testid={`sport-translate-followup-${index}`}
                          >
                            {isFollowUpTranslating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Languages className="w-3.5 h-3.5" />
                                {followUpTranslation ? (showFollowUpTranslated ? targetConfig.flag : '🇺🇸') : targetConfig.flag}
                              </>
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => handleCopyFollowUp(response, e)}
                          className="btn-steel flex-1 py-2 text-xs flex items-center justify-center gap-1.5"
                          style={isFollowUpCopied ? {
                            background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.3) 0%, hsla(145, 50%, 25%, 0.25) 100%)',
                            borderColor: 'hsla(145, 60%, 45%, 0.4)',
                            color: 'hsla(145, 70%, 60%, 1)',
                          } : {}}
                        >
                          {isFollowUpCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Follow-up
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResponseCards;
