import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Languages, Loader2, Volume2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Check for speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

/**
 * Voice Translator - TRUE Push-to-Talk
 * First press: Start listening
 * Second press: Stop listening and translate
 */
export const VoiceTranslator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState('');
  const [sourceLang, setSourceLang] = useState('es');
  const [targetLang, setTargetLang] = useState('en');
  const [showResult, setShowResult] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(null); // 'source' | 'target' | null
  
  const recognitionRef = useRef(null);
  const latestTextRef = useRef('');
  const isListeningRef = useRef(false);

  // Language configuration
  const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸', speechCode: 'en-US' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', speechCode: 'es-US' },
    { code: 'fr', name: 'French', flag: '🇫🇷', speechCode: 'fr-FR' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', speechCode: 'ja-JP' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷', speechCode: 'ko-KR' },
  ];

  const getLanguage = (code) => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
  const sourceLanguage = getLanguage(sourceLang);
  const targetLanguage = getLanguage(targetLang);

  // Translate text
  const translateText = useCallback(async (text) => {
    if (!text.trim()) {
      setError('No speech detected');
      return;
    }
    
    setIsTranslating(true);
    setError('');
    
    try {
      console.log('[Voice Translator] Translating:', text);
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          source_lang: sourceLang,
          target_lang: targetLang
        })
      });
      
      if (!response.ok) throw new Error('Translation failed');
      
      const data = await response.json();
      console.log('[Voice Translator] Translation result:', data);
      setTranslatedText(data.translated_text || '');
      setShowResult(true);
    } catch (err) {
      console.error('[Voice Translator] Error:', err);
      setError('Translation failed. Check connection.');
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sourceLanguage.speechCode;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSourceText(transcript);
      latestTextRef.current = transcript;
    };
    
    recognition.onend = () => {
      console.log('[Voice Translator] Recognition ended, wasListening:', isListeningRef.current);
      // Only auto-translate if we have text and were listening
      if (isListeningRef.current && latestTextRef.current) {
        isListeningRef.current = false;
        setIsListening(false);
        translateText(latestTextRef.current);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('[Voice Translator] Error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      try { recognitionRef.current?.abort(); } catch (e) { /* ignore */ }
    };
  }, [sourceLang, sourceLanguage.speechCode, translateText]);

  // Update recognition language when source changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = sourceLanguage.speechCode;
    }
  }, [sourceLanguage.speechCode]);

  // PUSH TO TALK: Toggle listening on button press
  const handlePushToTalk = async () => {
    if (!isSpeechSupported) {
      setError('Speech recognition not supported');
      return;
    }
    
    if (isListening) {
      // SECOND PRESS: Stop listening and translate
      console.log('[Voice Translator] Stopping...');
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      
      if (latestTextRef.current) {
        translateText(latestTextRef.current);
      } else {
        setError('No speech detected');
      }
    } else {
      // FIRST PRESS: Start listening
      console.log('[Voice Translator] Starting...');
      setSourceText('');
      setTranslatedText('');
      setError('');
      setShowResult(false);
      latestTextRef.current = '';
      
      // Request mic permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        setError('Microphone access denied');
        return;
      }
      
      try {
        isListeningRef.current = true;
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        if (err.name === 'InvalidStateError') {
          // Already started, try stopping and restarting
          recognitionRef.current?.stop();
          setTimeout(() => {
            isListeningRef.current = true;
            recognitionRef.current?.start();
            setIsListening(true);
          }, 100);
        } else {
          setError('Could not start microphone');
          isListeningRef.current = false;
        }
      }
    }
  };

  // Swap source and target languages
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText('');
    setTranslatedText('');
    setError('');
    setShowResult(false);
  };

  // Select a language
  const selectLanguage = (code, type) => {
    if (type === 'source') {
      if (code === targetLang) {
        // Swap if selecting same as target
        setTargetLang(sourceLang);
      }
      setSourceLang(code);
    } else {
      if (code === sourceLang) {
        // Swap if selecting same as source
        setSourceLang(targetLang);
      }
      setTargetLang(code);
    }
    setShowLangPicker(null);
    setSourceText('');
    setTranslatedText('');
    setError('');
    setShowResult(false);
  };

  // Close result panel
  const closeResult = () => {
    setShowResult(false);
    setSourceText('');
    setTranslatedText('');
    setError('');
  };

  // Speak the translation
  const speakTranslation = () => {
    if (!translatedText || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = targetLanguage.speechCode;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      {/* PUSH TO TALK BUTTON - Fixed on right side */}
      <button
        onClick={handlePushToTalk}
        disabled={isTranslating}
        className={`push-to-talk-btn ${isListening ? 'listening' : ''} ${isTranslating ? 'translating' : ''}`}
        data-testid="push-to-talk-btn"
      >
        <div className="ptt-inner">
          {isTranslating ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </div>
        <span className="ptt-label">
          {isTranslating ? 'WAIT' : isListening ? 'STOP' : 'PUSH'}
        </span>
        {isListening && <div className="ptt-pulse" />}
      </button>

      {/* Language Selector - Above main button */}
      <div className="lang-selector-group">
        {/* Source Language */}
        <button
          onClick={() => setShowLangPicker(showLangPicker === 'source' ? null : 'source')}
          className="lang-pill"
          data-testid="source-lang-btn"
        >
          <span>{sourceLanguage.flag}</span>
        </button>
        
        {/* Swap Button */}
        <button onClick={swapLanguages} className="lang-swap-btn" data-testid="swap-lang-btn">
          <Languages className="w-3 h-3" />
        </button>
        
        {/* Target Language */}
        <button
          onClick={() => setShowLangPicker(showLangPicker === 'target' ? null : 'target')}
          className="lang-pill"
          data-testid="target-lang-btn"
        >
          <span>{targetLanguage.flag}</span>
        </button>
      </div>

      {/* Language Picker Dropdown */}
      {showLangPicker && (
        <div className="lang-picker-dropdown">
          <div className="lang-picker-header">
            {showLangPicker === 'source' ? 'Speak in:' : 'Translate to:'}
          </div>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code, showLangPicker)}
              className={`lang-picker-option ${
                (showLangPicker === 'source' ? sourceLang : targetLang) === lang.code ? 'active' : ''
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live transcript while listening */}
      {isListening && sourceText && (
        <div className="live-transcript">
          <div className="transcript-label">{sourceLanguage.flag} {sourceLanguage.name}</div>
          <div className="transcript-text">{sourceText}</div>
        </div>
      )}

      {/* Result Panel - Shows after translation */}
      {showResult && (translatedText || error) && (
        <div className="result-panel" onClick={closeResult}>
          <div className="result-content" onClick={e => e.stopPropagation()}>
            <button onClick={closeResult} className="result-close">
              <X className="w-5 h-5" />
            </button>
            
            {error ? (
              <div className="result-error">
                <p>{error}</p>
              </div>
            ) : (
              <>
                {sourceText && (
                  <div className="result-source">
                    <span className="result-label">{sourceLanguage.flag} {sourceLanguage.name}</span>
                    <p>{sourceText}</p>
                  </div>
                )}
                
                {translatedText && (
                  <div className="result-translated">
                    <span className="result-label">{targetLanguage.flag} {targetLanguage.name}</span>
                    <p>{translatedText}</p>
                    <button onClick={speakTranslation} className="speak-btn">
                      <Volume2 className="w-4 h-4" />
                      Speak
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .push-to-talk-btn {
          position: fixed;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 45;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(145deg, #2a2a35 0%, #1a1a22 50%, #0f0f14 100%);
          border: 3px solid #333;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          transition: all 0.15s ease;
        }

        .push-to-talk-btn:active {
          transform: translateY(-50%) scale(0.95);
        }

        .push-to-talk-btn.listening {
          border-color: #ef4444;
          box-shadow: 0 0 30px rgba(239,68,68,0.4);
        }

        .push-to-talk-btn.translating {
          border-color: #22d3ee;
          opacity: 0.8;
        }

        .ptt-inner {
          color: #666;
          transition: color 0.2s;
        }

        .push-to-talk-btn.listening .ptt-inner {
          color: #ef4444;
        }

        .push-to-talk-btn.translating .ptt-inner {
          color: #22d3ee;
        }

        .ptt-label {
          font-family: 'Russo One', sans-serif;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 0.1em;
          color: #666;
        }

        .push-to-talk-btn.listening .ptt-label {
          color: #ef4444;
        }

        .ptt-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: ptt-ring 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes ptt-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .lang-toggle-btn {
          position: fixed;
          right: 24px;
          top: calc(50% - 60px);
          z-index: 44;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(30,32,40,0.95);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          color: #888;
          font-size: 12px;
          cursor: pointer;
        }

        .lang-toggle-btn span.active {
          opacity: 1;
        }

        .lang-toggle-btn span:not(.active) {
          opacity: 0.4;
        }

        .live-transcript {
          position: fixed;
          bottom: 100px;
          left: 20px;
          right: 100px;
          padding: 16px;
          background: rgba(0,0,0,0.9);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 16px;
          z-index: 44;
        }

        .transcript-label {
          font-size: 10px;
          font-weight: 600;
          color: #ef4444;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .transcript-text {
          font-size: 16px;
          color: #fff;
          line-height: 1.4;
        }

        .result-panel {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .result-content {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, rgba(25,28,35,0.98) 0%, rgba(15,18,22,0.98) 100%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 20px;
          position: relative;
        }

        .result-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .result-error {
          padding: 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
          text-align: center;
        }

        .result-error p {
          color: #fca5a5;
          margin: 0;
        }

        .result-source, .result-translated {
          padding: 14px;
          border-radius: 12px;
          margin-bottom: 12px;
        }

        .result-source {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .result-translated {
          background: rgba(34,211,238,0.1);
          border: 1px solid rgba(34,211,238,0.2);
        }

        .result-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 8px;
          color: #666;
        }

        .result-translated .result-label {
          color: #22d3ee;
        }

        .result-source p, .result-translated p {
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
          color: #fff;
        }

        .speak-btn {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: rgba(34,211,238,0.2);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 8px;
          color: #22d3ee;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
