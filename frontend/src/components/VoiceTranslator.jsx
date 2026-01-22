import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Languages } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Check for speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * Voice Translator - Mobile-First Floating Modal
 * Records voice input and translates between Spanish/English
 */
export const VoiceTranslator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState('');
  const [direction, setDirection] = useState('es-en'); // 'es-en' or 'en-es'
  
  const recognitionRef = useRef(null);
  const latestTextRef = useRef('');

  const sourceLang = direction === 'es-en' ? 'es' : 'en';
  const targetLang = direction === 'es-en' ? 'en' : 'es';
  const sourceLabel = direction === 'es-en' ? '🇪🇸 Spanish' : '🇺🇸 English';
  const targetLabel = direction === 'es-en' ? '🇺🇸 English' : '🇪🇸 Spanish';

  // Translate text
  const translateText = useCallback(async (text) => {
    if (!text.trim()) return;
    
    setIsTranslating(true);
    setError('');
    
    try {
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
      setTranslatedText(data.translated_text || data.translation || text);
    } catch (err) {
      setError('Translation unavailable');
      setTranslatedText('');
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = !isSafari;
    recognition.lang = sourceLang === 'es' ? 'es-US' : 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSourceText(transcript);
      latestTextRef.current = transcript;
      
      if (isSafari && event.results[event.results.length - 1].isFinal) {
        translateText(transcript);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      if (!isSafari && latestTextRef.current) {
        translateText(latestTextRef.current);
      }
    };
    
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied');
      } else if (event.error === 'no-speech') {
        setError('No speech detected');
      } else if (event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      try { recognitionRef.current?.abort(); } catch (e) { /* ignore */ }
    };
  }, [translateText, sourceLang]);

  // Update recognition language when direction changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = sourceLang === 'es' ? 'es-US' : 'en-US';
    }
  }, [sourceLang]);

  // Toggle listening
  const toggleListening = async () => {
    if (!isSpeechSupported) {
      setError('Speech recognition not supported');
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setSourceText('');
      setTranslatedText('');
      setError('');
      latestTextRef.current = '';
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        setError('Microphone access denied');
        return;
      }
      
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        setError('Could not start microphone');
      }
    }
  };

  // Toggle language direction
  const toggleDirection = () => {
    setDirection(d => d === 'es-en' ? 'en-es' : 'es-en');
    setSourceText('');
    setTranslatedText('');
    setError('');
  };

  // Open modal
  const openModal = () => {
    setIsOpen(true);
    setSourceText('');
    setTranslatedText('');
    setError('');
  };

  // Close modal
  const closeModal = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Push to Start Button - Fixed Position */}
      <button
        onClick={openModal}
        onTouchStart={(e) => {
          e.stopPropagation();
          openModal();
        }}
        className="push-to-start-trigger"
        data-testid="voice-translator-btn"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="trigger-inner">
          <div className="trigger-content">
            <Mic className="w-5 h-5" />
            <span>PUSH</span>
          </div>
        </div>
      </button>

      {/* Floating Modal */}
      {isOpen && (
        <div className="voice-modal-overlay" onClick={closeModal}>
          <div className="voice-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="voice-modal-header">
              <h3>Voice Translator</h3>
              <button onClick={closeModal} className="voice-modal-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Language Toggle */}
            <button onClick={toggleDirection} className="language-toggle">
              <span className={direction === 'es-en' ? 'active' : ''}>🇪🇸 ES</span>
              <Languages className="w-4 h-4" />
              <span className={direction === 'en-es' ? 'active' : ''}>🇺🇸 EN</span>
            </button>

            {/* Mic Button */}
            <button
              onClick={toggleListening}
              disabled={isTranslating}
              className={`voice-mic-btn ${isListening ? 'listening' : ''} ${isTranslating ? 'translating' : ''}`}
            >
              <div className="mic-btn-inner">
                {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </div>
              <span className="mic-btn-label">
                {isTranslating ? 'Translating...' : isListening ? 'Tap to Stop' : 'Tap to Speak'}
              </span>
              {isListening && <div className="mic-pulse" />}
            </button>

            {/* Results */}
            <div className="voice-results-container">
              {error && (
                <div className="voice-result error">
                  <span className="result-label">Error</span>
                  <p>{error}</p>
                </div>
              )}

              {isListening && !sourceText && (
                <div className="voice-result listening">
                  <span className="result-label">Listening...</span>
                  <div className="listening-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}

              {sourceText && (
                <div className="voice-result source">
                  <span className="result-label">{sourceLabel}</span>
                  <p>{sourceText}</p>
                </div>
              )}

              {translatedText && (
                <div className="voice-result translated">
                  <span className="result-label">{targetLabel}</span>
                  <p>{translatedText}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .push-to-start-trigger {
          position: fixed;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 40;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(145deg, #2a2a35 0%, #1a1a22 50%, #0f0f14 100%);
          border: none;
          cursor: pointer;
          padding: 3px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          -webkit-user-select: none;
        }

        .push-to-start-trigger:active {
          transform: translateY(-50%) scale(0.95);
          box-shadow: 0 2px 10px rgba(0,0,0,0.6);
        }

        .trigger-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(180deg, #1c1c24 0%, #12121a 100%);
          border: 2px solid #333340;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .trigger-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          color: #666;
        }

        .trigger-content span {
          font-family: 'Russo One', sans-serif;
          font-size: 7px;
          font-weight: bold;
          letter-spacing: 0.1em;
        }

        .voice-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .voice-modal {
          width: 100%;
          max-width: 340px;
          background: linear-gradient(180deg, rgba(30,32,40,0.98) 0%, rgba(20,22,28,0.98) 100%);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .voice-modal-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .voice-modal-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .voice-modal-close {
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

        .language-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          color: #888;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .language-toggle span.active {
          color: #22d3ee;
        }

        .voice-mic-btn {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(180deg, #1e2028 0%, #14161c 100%);
          border: 3px solid #333;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin: 8px 0;
        }

        .voice-mic-btn .mic-btn-inner {
          color: #666;
          transition: color 0.2s;
        }

        .voice-mic-btn.listening {
          border-color: #ef4444;
        }

        .voice-mic-btn.listening .mic-btn-inner {
          color: #ef4444;
        }

        .voice-mic-btn.translating {
          opacity: 0.7;
        }

        .mic-btn-label {
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }

        .voice-mic-btn.listening .mic-btn-label {
          color: #ef4444;
        }

        .mic-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: pulse-ring 1.5s ease-out infinite;
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }

        .voice-results-container {
          width: 100%;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .voice-result {
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .voice-result .result-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          color: #666;
        }

        .voice-result p {
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
          color: #fff;
        }

        .voice-result.error {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.2);
        }

        .voice-result.error .result-label {
          color: #ef4444;
        }

        .voice-result.error p {
          color: #fca5a5;
        }

        .voice-result.source .result-label {
          color: #f59e0b;
        }

        .voice-result.translated {
          background: rgba(34,211,238,0.1);
          border-color: rgba(34,211,238,0.2);
        }

        .voice-result.translated .result-label {
          color: #22d3ee;
        }

        .listening-indicator {
          display: flex;
          gap: 4px;
          justify-content: center;
        }

        .listening-indicator span {
          width: 8px;
          height: 8px;
          background: #22d3ee;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .listening-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .listening-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
