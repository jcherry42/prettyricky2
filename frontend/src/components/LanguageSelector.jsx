import React from 'react';

/**
 * LanguageSelector - Just Flags (Engine Sound Profiles)
 * Simplified to show only flag emojis
 */
const LANGUAGES = [
  { code: 'es', flag: '🇲🇽', name: 'Spanish' },
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
          background:
            radial-gradient(ellipse 120% 90% at 30% 30%, rgba(255, 240, 200, 0.10) 0%, transparent 60%),
            linear-gradient(135deg, rgba(255,191,0,0.20) 0%, rgba(255,140,0,0.14) 100%);
          border: 2px solid rgba(255,191,0,0.12);
          border-radius: 18px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
          padding: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }


        .flag-emoji {
          font-size: 40px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        .flag-btn:hover {
          background:
            radial-gradient(ellipse 120% 90% at 30% 30%, rgba(255, 240, 200, 0.12) 0%, transparent 60%),
            linear-gradient(135deg, rgba(255,191,0,0.24) 0%, rgba(255,140,0,0.18) 100%);
          border-color: rgba(255,191,0,0.18);
          transform: translateY(-2px);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.06);
        }


        .flag-btn.active {
          background:
            radial-gradient(ellipse 120% 90% at 30% 30%, rgba(255, 240, 200, 0.14) 0%, transparent 60%),
            linear-gradient(135deg, rgba(255,191,0,0.26) 0%, rgba(255,140,0,0.20) 100%);
          border-color: rgba(255,191,0,0.22);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.06);
          transform: translateY(-1px);
        }

        .flag-btn.active .flag-emoji {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
        }

        .flag-btn:active {
          transform: translateY(0) scale(0.985);
        }
      `}</style>
    </div>
  );
};

export default LanguageSelector;
