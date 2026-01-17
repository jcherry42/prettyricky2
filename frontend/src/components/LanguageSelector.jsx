import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../utils/translationService';

export const LanguageSelector = ({ 
  selectedLanguage, 
  onLanguageChange, 
  label = "Translate to",
  showAuto = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (langCode) => {
    onLanguageChange(langCode);
    setIsOpen(false);
  };

  const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage) || SUPPORTED_LANGUAGES[1];

  return (
    <div className="language-selector">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="language-selector-btn"
        type="button"
      >
        <Globe className="w-4 h-4" />
        <span className="language-selector-label">
          {label}: <strong>{currentLang.flag} {currentLang.native}</strong>
        </span>
      </button>

      {isOpen && (
        <>
          <div 
            className="language-selector-overlay" 
            onClick={() => setIsOpen(false)}
          />
          <div className="language-selector-dropdown">
            <div className="language-selector-header">
              <Globe className="w-4 h-4" />
              <span>Select Language</span>
            </div>
            
            {showAuto && (
              <button
                onClick={() => handleSelect('auto')}
                className={`language-option ${selectedLanguage === 'auto' ? 'active' : ''}`}
              >
                <span className="language-flag">🌐</span>
                <span className="language-names">
                  <span className="language-native">Auto Detect</span>
                  <span className="language-english">Automatic</span>
                </span>
                {selectedLanguage === 'auto' && <Check className="w-4 h-4 ml-auto" />}
              </button>
            )}
            
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`language-option ${selectedLanguage === lang.code ? 'active' : ''}`}
              >
                <span className="language-flag">{lang.flag}</span>
                <span className="language-names">
                  <span className="language-native">{lang.native}</span>
                  <span className="language-english">{lang.name}</span>
                </span>
                {selectedLanguage === lang.code && <Check className="w-4 h-4 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
