import React, { useState, useEffect } from 'react';
import { Copy, Check, MessageSquare, ChevronDown, ChevronUp, Languages, Flame, Loader2, Pencil, X, Volume2, VolumeX, Plus, Save } from 'lucide-react';
import { translateText } from '../utils/translationService';
import { speakText, stopSpeech } from '../utils/ttsService';
import { useSales } from '../context/SalesContext';
import haptics from '../utils/haptics';
import { announceToScreenReader } from '../utils/accessibility';

// Language config - Spanish, French, Korean only
const LANG_CONFIG = {
  es: { name: 'Spanish', flag: '🇪🇸', code: 'es', speechCode: 'es-US' },
  fr: { name: 'French', flag: '🇫🇷', code: 'fr', speechCode: 'fr-FR' },
  ko: { name: 'Korean', flag: '🇰🇷', code: 'ko', speechCode: 'ko-KR' },
};

// Get target language from user settings
const getTargetLanguage = () => {
  const stored = localStorage.getItem('defaultTargetLanguage');
  return stored && LANG_CONFIG[stored] ? stored : 'es';
};

// Single Response Card Component
const ResponseCard = ({ 
  response, 
  index,
  isSelected, 
  onSelect, 
  onCopy, 
  onSend, 
  supercharged,
  isCustom = false,
  onCustomTextChange,
  customText = ''
}) => {
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [translation, setTranslation] = useState('');
  const [followUpTranslation, setFollowUpTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [isEditing, setIsEditing] = useState(isCustom && !response.text);
  const [editText, setEditText] = useState(customText || response.text || '');
  
  const targetLang = getTargetLanguage();
  const targetConfig = LANG_CONFIG[targetLang] || LANG_CONFIG.es;

  const translateContent = async () => {
    if (!response.text && !editText) return;
    
    setIsTranslating(true);
    try {
      const textToTranslate = editText || response.text;
      const result = await translateText(textToTranslate, 'en', targetLang);
      if (result?.success) {
        setTranslation(result.translatedText);
      }
      
      // Translate follow-up if exists
      if (response.followUpText) {
        const followResult = await translateText(response.followUpText, 'en', targetLang);
        if (followResult?.success) {
          setFollowUpTranslation(followResult.translatedText);
        }
      }
    } catch {
      // Translation error - silent
    }
    setIsTranslating(false);
  };

  // Translate when supercharged mode is active - fixed to avoid cascading renders
  useEffect(() => {
    if (supercharged && response.text && !translation) {
      // Use setTimeout to defer state update
      const timer = setTimeout(() => translateContent(), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supercharged, response.text, targetLang]);

  // Clear translation when supercharged is turned off - fixed to avoid cascading renders
  useEffect(() => {
    if (!supercharged && showTranslated) {
      // Use setTimeout to defer state update
      const timer = setTimeout(() => setShowTranslated(false), 0);
      return () => clearTimeout(timer);
    }
  }, [supercharged, showTranslated]);

  const handleSpeak = async (text, isTranslated = false) => {
    const id = isTranslated ? 'translated' : 'original';
    if (speakingId === id) {
      stopSpeech();
      setSpeakingId(null);
      return;
    }
    
    stopSpeech();
    setSpeakingId(id);
    
    try {
      await speakText(text, isTranslated ? targetLang : 'en', {
        useHD: true,
        onEnd: () => setSpeakingId(null),
        onError: () => setSpeakingId(null)
      });
    } catch {
      setSpeakingId(null);
    }
  };

  const getDisplayText = () => {
    if (isCustom) {
      if (supercharged && showTranslated && translation) return translation;
      return editText;
    }
    if (supercharged && showTranslated && translation) return translation;
    return response.text;
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    haptics.tap();
    const text = getDisplayText();
    
    try {
      await navigator.clipboard.writeText(text);
      haptics.success();
      setCopiedMain(true);
      announceToScreenReader('Copied to clipboard');
      setTimeout(() => setCopiedMain(false), 2000);
    } catch {
      // Fallback handled by parent
    }
  };

  const handleCopyFollowUp = async (e) => {
    e.stopPropagation();
    haptics.tap();
    const text = supercharged && showTranslated && followUpTranslation 
      ? followUpTranslation 
      : response.followUpText;
    
    try {
      await navigator.clipboard.writeText(text);
      haptics.success();
      setCopiedFollowUp(true);
      setTimeout(() => setCopiedFollowUp(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSend = (e) => {
    e.stopPropagation();
    haptics.button();
    const text = getDisplayText();
    onSend(text);
  };

  const toggleTranslation = (e) => {
    e.stopPropagation();
    haptics.select();
    setShowTranslated(!showTranslated);
  };

  const saveCustomText = () => {
    if (onCustomTextChange) {
      onCustomTextChange(editText);
    }
    setIsEditing(false);
    // Trigger translation of custom text
    if (supercharged && editText) {
      translateContent();
    }
  };

  // For custom cards that are empty
  if (isCustom && !editText && !isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)}
        className={`response-card cursor-pointer opacity-70 hover:opacity-100 transition-opacity`}
      >
        <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground min-h-[120px]">
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Write your own response</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => !isEditing && onSelect()}
      className={`response-card cursor-pointer transition-all ${isSelected ? 'selected ring-2 ring-primary' : ''}`}
      data-testid={`response-card-${index}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">
            {isCustom ? 'CUSTOM' : `OPTION ${index + 1}`}
          </span>
          {supercharged && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-orange-500">
              <Flame className="w-3 h-3" />
              SPORT
            </span>
          )}
        </div>
        
        {/* Translate Button - Only in Sport mode */}
        {supercharged && !isEditing && (
          <button
            onClick={toggleTranslation}
            disabled={isTranslating}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              showTranslated 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
            aria-label={showTranslated ? 'Show original text' : `Translate to ${targetConfig.name}`}
            data-testid={`translate-btn-${index}`}
          >
            {isTranslating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Languages className="w-3 h-3" />
                <span>{showTranslated ? targetConfig.flag : '🇺🇸'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Write your response here..."
              className="w-full min-h-[100px] p-3 bg-muted/30 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); saveCustomText(); }}
                className="flex-1 ios-btn-primary py-2 text-xs gap-1"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditText(customText || response.text || ''); }}
                className="ios-btn-secondary py-2 px-3 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="response-text-large text-foreground leading-relaxed whitespace-pre-wrap">
              {getDisplayText()}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleCopy}
                className="ios-btn flex-1 py-2 text-xs gap-1.5"
              >
                {copiedMain ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedMain ? 'Copied' : 'Copy'}
              </button>
              
              <button
                onClick={handleSend}
                className="ios-btn-primary flex-1 py-2 text-xs gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send
              </button>
              
              {/* TTS Button - Only for custom/editable cards */}
              {isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSpeak(getDisplayText(), showTranslated); }}
                  className={`ios-btn w-9 h-9 ${speakingId ? 'text-primary' : ''}`}
                >
                  {speakingId ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              {isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  className="ios-btn w-9 h-9"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Follow-up Section */}
      {response.followUpText && !isEditing && (
        <div className="border-t border-border/30">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFollowUp(!showFollowUp); }}
            className="w-full flex items-center justify-between p-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-medium">Follow-up suggestion</span>
            {showFollowUp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showFollowUp && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {supercharged && showTranslated && followUpTranslation 
                  ? followUpTranslation 
                  : response.followUpText}
              </p>
              <button
                onClick={handleCopyFollowUp}
                className="ios-btn py-1.5 px-3 text-[10px] gap-1"
              >
                {copiedFollowUp ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copiedFollowUp ? 'Copied' : 'Copy follow-up'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ResponseCards = () => {
  const { 
    currentResponses, 
    selectedResponse, 
    selectResponse,
    selectedCustomer,
    shareToMessages,
    supercharged,
  } = useSales();
  
  const [customTexts, setCustomTexts] = useState({});

  // Show nothing if no customer selected or no responses
  if (!selectedCustomer || currentResponses.length === 0) {
    return null;
  }

  // Get first 2 responses + create a custom slot
  const displayResponses = currentResponses.slice(0, 2);
  const customResponse = { 
    id: 'custom', 
    text: customTexts['custom'] || '', 
    followUpText: null 
  };

  const handleSend = (text) => {
    shareToMessages(text);
    announceToScreenReader('Opening iMessage');
  };

  const handleCustomTextChange = (text) => {
    setCustomTexts(prev => ({ ...prev, custom: text }));
  };

  return (
    <div className="space-y-4 pb-32" data-testid="response-cards">
      {/* Pre-generated Responses */}
      {displayResponses.map((response, index) => (
        <ResponseCard
          key={response.id}
          response={response}
          index={index}
          isSelected={selectedResponse?.id === response.id}
          onSelect={() => selectResponse(response)}
          onCopy={() => {}}
          onSend={handleSend}
          supercharged={supercharged}
        />
      ))}
      
      {/* Custom Editable Response */}
      <ResponseCard
        key="custom"
        response={customResponse}
        index={2}
        isSelected={selectedResponse?.id === 'custom'}
        onSelect={() => selectResponse(customResponse)}
        onCopy={() => {}}
        onSend={handleSend}
        supercharged={supercharged}
        isCustom={true}
        customText={customTexts['custom']}
        onCustomTextChange={handleCustomTextChange}
      />
    </div>
  );
};

export default ResponseCards;
