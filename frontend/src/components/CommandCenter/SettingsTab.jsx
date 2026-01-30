import React, { useState, memo } from 'react';
import { Building2, User, Save, Volume2, ToggleRight, ToggleLeft, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useSales } from '../../context/SalesContext';
import { 
  getSoundPreferences, 
  setSoundPreferences,
  playNotificationSound
} from '../../utils/notificationSound';
import LanguageSelector from '../LanguageSelector';

// Ambient Lighting Section Component
const AmbientLightingSection = memo(() => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('ambientLightingEnabled') === 'true';
  });
  const [intensity, setIntensity] = useState(() => {
    return localStorage.getItem('ambientLightingIntensity') || 'medium';
  });

  const updateLighting = (newEnabled, newIntensity) => {
    const html = document.documentElement;
    html.classList.remove('ambient-lighting-enabled', 'ambient-lighting-low', 'ambient-lighting-high');
    
    if (newEnabled) {
      html.classList.add('ambient-lighting-enabled');
      if (newIntensity === 'low') html.classList.add('ambient-lighting-low');
      if (newIntensity === 'high') html.classList.add('ambient-lighting-high');
    }
    
    localStorage.setItem('ambientLightingEnabled', newEnabled);
    localStorage.setItem('ambientLightingIntensity', newIntensity);
  };

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    updateLighting(newEnabled, intensity);
  };

  const handleIntensity = (newIntensity) => {
    setIntensity(newIntensity);
    updateLighting(enabled, newIntensity);
  };

  return (
    <div className="settings-section ambient-section">
      <div className="section-header">
        <Zap className="w-5 h-5" style={{ color: '#FFBF00' }} />
        <h4>64-Color Ambient Lighting</h4>
      </div>
      
      <div className="ambient-settings">
        <div className="ambient-toggle">
          <span>Ambient Effects</span>
          <button 
            className={`toggle-btn ${enabled ? 'on' : 'off'}`}
            onClick={handleToggle}
          >
            {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {enabled ? 'On' : 'Off'}
          </button>
        </div>
        
        {enabled && (
          <div className="intensity-control">
            <label>Intensity</label>
            <div className="intensity-buttons">
              {['low', 'medium', 'high'].map(level => (
                <button 
                  key={level}
                  className={`intensity-btn ${intensity === level ? 'active' : ''}`}
                  onClick={() => handleIntensity(level)}
                >
                  {level === 'low' ? 'Subtle' : level === 'medium' ? 'Medium' : 'Vivid'}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <p className="ambient-desc">
          Mercedes-Benz inspired 64-color ambient lighting cycles through the full spectrum.
        </p>
      </div>
    </div>
  );
});

AmbientLightingSection.displayName = 'AmbientLightingSection';

// Settings Tab Component
const SettingsTab = memo(({ defaultTargetLanguage, onLanguageChange }) => {
  const { 
    dealership, 
    salesperson, 
    setDealership, 
    setSalesperson 
  } = useSales();
  
  const [dealershipForm, setDealershipForm] = useState({
    name: dealership?.name || '',
    brand: dealership?.brand || '',
    location: dealership?.location || '',
  });
  
  const [salespersonForm, setSalespersonForm] = useState({
    name: salesperson?.name || '',
    preferredPhrase: salesperson?.preferredPhrase || 'Good to hear from you',
  });
  
  const [soundPrefs, setSoundPrefsState] = useState(getSoundPreferences);
  
  const handleSaveProfile = () => {
    setDealership(dealershipForm);
    setSalesperson(salespersonForm);
    toast.success('Profile settings saved!');
  };
  
  const handleSoundToggle = () => {
    const newPrefs = { ...soundPrefs, enabled: !soundPrefs.enabled };
    setSoundPrefsState(newPrefs);
    setSoundPreferences(newPrefs);
    if (newPrefs.enabled) playNotificationSound();
  };

  const handleSoundProfile = (code) => {
    const map = { es: 'merica', fr: 'euro', ko: 'jdm' };
    const profileId = map[code] || 'merica';
    const newPrefs = { ...soundPrefs, profile: profileId };
    setSoundPrefsState(newPrefs);
    setSoundPreferences(newPrefs);
  };
  
  return (
    <div className="settings-tab">
      {/* Profile Section */}
      <div className="settings-section">
        <div className="section-header">
          <Building2 className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Dealership Profile</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Dealership Name</label>
            <input 
              type="text"
              placeholder="Premier Motors"
              value={dealershipForm.name}
              onChange={e => setDealershipForm(prev => ({...prev, name: e.target.value}))}
            />
          </div>
          <div className="s-field">
            <label>Brand / Makes</label>
            <input 
              type="text"
              placeholder="Toyota, Honda, etc."
              value={dealershipForm.brand}
              onChange={e => setDealershipForm(prev => ({...prev, brand: e.target.value}))}
            />
          </div>
          <div className="s-field">
            <label>Location</label>
            <input 
              type="text"
              placeholder="Los Angeles, CA"
              value={dealershipForm.location}
              onChange={e => setDealershipForm(prev => ({...prev, location: e.target.value}))}
            />
          </div>
        </div>
      </div>
      
      {/* Salesperson Section */}
      <div className="settings-section">
        <div className="section-header">
          <User className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Your Profile</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Your Name</label>
            <input 
              type="text"
              placeholder="Alex Johnson"
              value={salespersonForm.name}
              onChange={e => setSalespersonForm(prev => ({...prev, name: e.target.value}))}
            />
          </div>
        </div>
        <button className="save-settings-btn gold-btn" onClick={handleSaveProfile}>
          <Save className="w-4 h-4" /> Save Profile
        </button>
      </div>
      
      {/* Translation Settings */}
      <div className="settings-section">
        <div className="section-header">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#FFBF00' }}>
            <path d="M5 8h14M5 16h6m-6-4h10" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="16" r="4"/>
            <path d="M16 14v4M14 16h4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h4>Translation</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Default Translation Language</label>
            <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '12px' }}>
              Choose which language AI responses will be translated to in Sport Mode
            </p>
            <LanguageSelector
              selectedLanguage={defaultTargetLanguage}
              onLanguageChange={onLanguageChange}
              label="Translate to"
              showAuto={false}
            />
          </div>
        </div>
      </div>
      
      {/* Engine Sound Profile */}
      <div className="settings-section engine-sound-profile">
        <div className="section-header">
          <Volume2 className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Engine Sound Profile</h4>
        </div>
        
        <div className="sound-settings">
          <div className="sound-toggle">
            <span>Sound Effects</span>
            <button 
              className={`toggle-btn ${soundPrefs.enabled ? 'on' : 'off'}`}
              onClick={handleSoundToggle}
            >
              {soundPrefs.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {soundPrefs.enabled ? 'On' : 'Off'}
            </button>
          </div>
          
          <div className="sound-profiles">
            <label>Engine Sound Profile</label>
            <div className="profile-grid">
              <LanguageSelector
                value={soundPrefs.profile}
                onChange={handleSoundProfile}
                label={null}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Ambient Lighting */}
      <AmbientLightingSection />
    </div>
  );
});

SettingsTab.displayName = 'SettingsTab';

export default SettingsTab;
