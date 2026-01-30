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

const LanguageSelector = ({ value, onChange, label = "Translation" }) => {
  return (
    <div className="language-selector">
      {label && (
        <div className="lang-label">{label}</div>
      )}
      <div className="lang-flags">
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className={`flag-btn ${value === lang.code ? 'active' : ''}`}
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
          gap: 8px;
        }

        .flag-btn {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
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
          font-size: 28px;
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
          background: linear-gradient(135deg, #00D9FF 0%, #0080FF 100%);
          border-color: transparent;
          box-shadow: 
            0 4px 16px rgba(0, 217, 255, 0.5),
            0 0 30px rgba(0, 150, 255, 0.3);
          transform: scale(1.05);
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
