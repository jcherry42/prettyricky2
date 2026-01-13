import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Check for speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

/**
 * Voice Translator - Push to Start Button
 * Records Spanish voice input and translates to English text
 */
export const VoiceTranslator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [spanishText, setSpanishText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  
  const recognitionRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'es-US'; // Spanish (US)
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setSpanishText(transcript);
      setShowResults(true);
      
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Translate when speech ends
      if (spanishText) {
        translateToEnglish(spanishText);
      }
    };
    
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error !== 'no-speech') {
        setError(`Error: ${event.error}`);
        setShowResults(true);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [spanishText]);

  // Translate Spanish to English
  const translateToEnglish = useCallback(async (text) => {
    if (!text.trim()) return;
    
    setIsTranslating(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          source_lang: 'es',
          target_lang: 'en'
        })
      });
      
      if (!response.ok) throw new Error('Translation failed');
      
      const data = await response.json();
      setEnglishText(data.translated_text || data.translation || text);
      
      // Auto-hide after 8 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setShowResults(false);
      }, 8000);
      
    } catch (err) {
      setError('Translation unavailable');
      setEnglishText('');
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // Toggle listening
  const toggleListening = () => {
    if (!isSpeechSupported) {
      setError('Speech recognition not supported');
      setShowResults(true);
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Reset state
      setSpanishText('');
      setEnglishText('');
      setError('');
      setShowResults(true);
      
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        setError('Could not start microphone');
      }
    }
  };

  // Hide results manually
  const hideResults = () => {
    setShowResults(false);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  return (
    <div 
      className="voice-translator-panel"
      style={{ position: 'fixed', right: '20px', left: 'auto', top: '50%', transform: 'translateY(-50%)', zIndex: 50 }}
    >
      {/* Push to Start Button */}
      <button
        onClick={toggleListening}
        className={`push-to-start-btn ${isListening ? 'active' : ''} ${isTranslating ? 'translating' : ''}`}
        disabled={isTranslating}
        title={isListening ? 'Stop listening' : 'Push to speak Spanish'}
        data-testid="voice-translator-btn"
      >
        <div className="pts-outer-ring">
          <div className="pts-inner-ring">
            <div className="pts-button-face">
              <div className="pts-icon">
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </div>
              <div className="pts-label">
                {isTranslating ? 'WAIT' : isListening ? 'STOP' : 'PUSH'}
              </div>
            </div>
          </div>
        </div>
        {/* Engine glow effect */}
        <div className={`pts-glow ${isListening ? 'active' : ''}`}></div>
      </button>
      
      {/* Auto-hiding text results */}
      <div className={`voice-results ${showResults ? 'visible' : 'hidden'}`}>
        {error ? (
          <div className="voice-result-box error">
            <span className="result-label">ERROR</span>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {spanishText && (
              <div className="voice-result-box spanish">
                <span className="result-label">🇪🇸 ESPAÑOL</span>
                <p>{spanishText}</p>
              </div>
            )}
            {englishText && (
              <div className="voice-result-box english">
                <span className="result-label">🇺🇸 ENGLISH</span>
                <p>{englishText}</p>
              </div>
            )}
            {isListening && !spanishText && (
              <div className="voice-result-box listening">
                <span className="result-label">LISTENING...</span>
                <p className="listening-dots">
                  <span>●</span><span>●</span><span>●</span>
                </p>
              </div>
            )}
            {isTranslating && (
              <div className="voice-result-box translating">
                <span className="result-label">TRANSLATING...</span>
              </div>
            )}
          </>
        )}
        
        {showResults && (spanishText || englishText || error) && (
          <button onClick={hideResults} className="hide-results-btn">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceTranslator;
