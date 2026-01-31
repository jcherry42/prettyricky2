import React from 'react';

/**
 * LanguageSelector - Just Flags (Engine Sound Profiles)
 * Simplified to show only flag emojis
 */
const LANGUAGES = [
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'ko', flag: '🇰🇷', name: 'Korean' }
];

const LanguageSelector = ({ value, onChange, selectedLanguage, onLanguageChange, label = "Translation" }) => {
  const currentValue = value ?? selectedLanguage;
  const handleChange = onChange ?? onLanguageChange;
  return (
    <div className="language-selector">
      {label && (
        <div className="lang-label">{label}</div>
      )}
      <div className="lang-flags">
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => handleChange?.(lang.code)}
            className={`flag-btn ${currentValue === lang.code ? 'active' : ''}`}
            aria-label={`Select ${lang.name}`}
            title={lang.name}
          >
            <span className="flag-emoji">{lang.flag}</span>
          </button>
        ))}
      </div>

      <style>{`
        .language-selector {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lang-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        html:not(.dark) .lang-label {
          color: #5C3A1E;
        }

        .lang-flags {
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }

        /* Match Engine Sound button sizing */
        .flag-btn {
          flex: 1;
          width: auto;
          height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        html:not(.dark) .flag-btn {
          background: linear-gradient(135deg, rgba(184, 134, 11, 0.10) 0%, rgba(160, 120, 60, 0.08) 100%);
          border: 2px solid rgba(180, 140, 80, 0.22);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .flag-emoji {
          font-size: 40px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        .flag-btn:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
          border-color: rgba(0, 217, 255, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 217, 255, 0.2);
        }

        html:not(.dark) .flag-btn:hover {
          background: linear-gradient(135deg, rgba(184, 134, 11, 0.16) 0%, rgba(160, 120, 60, 0.12) 100%);
          border-color: rgba(180, 140, 80, 0.35);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.08);
        }

        .flag-btn.active {
          background: linear-gradient(135deg, rgba(255,191,0,0.45) 0%, rgba(255,140,0,0.32) 100%);
          border-color: rgba(255,191,0,0.55);
          box-shadow: 
            0 10px 22px rgba(0, 0, 0, 0.12),
            0 0 18px rgba(255, 140, 0, 0.18);
          transform: scale(1.04);
        }

        .flag-btn.active .flag-emoji {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
        }

        .flag-btn:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>
    </div>
  );
};

export default LanguageSelector;
