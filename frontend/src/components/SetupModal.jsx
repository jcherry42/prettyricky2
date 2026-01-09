import React, { useState } from 'react';
import { X, Check, Building2, User, Sliders } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { APPOINTMENT_PHRASES, SALESPERSON_STYLES, RESPONSE_TONES } from '../data/salesData';

export const SetupModal = () => {
  const { 
    showSetup, 
    toggleSetup,
    dealership,
    salesperson,
    preferences,
    setDealership,
    setSalesperson,
    setPreferences,
    setSetupComplete,
  } = useSales();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    dealershipName: dealership.name,
    dealershipAddress: dealership.address,
    dealershipHours: dealership.hours,
    appointmentPhrase: dealership.appointmentPhrase,
    salespersonName: salesperson.name,
    salespersonTitle: salesperson.title,
    salespersonStyle: salesperson.style,
    defaultTone: preferences.defaultTone,
    signOff: preferences.signOff,
  });

  if (!showSetup) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setDealership({
      name: formData.dealershipName,
      address: formData.dealershipAddress,
      hours: formData.dealershipHours,
      appointmentPhrase: formData.appointmentPhrase,
    });
    
    setSalesperson({
      name: formData.salespersonName,
      title: formData.salespersonTitle,
      style: formData.salespersonStyle,
    });
    
    setPreferences({
      defaultTone: formData.defaultTone,
      signOff: formData.signOff || formData.salespersonName,
    });
    
    setSetupComplete(true);
    toggleSetup(false);
  };

  const canProceed = () => {
    if (step === 1) return formData.dealershipName.trim() && formData.dealershipHours.trim();
    if (step === 2) return formData.salespersonName.trim();
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="ios-modal w-full max-w-md max-h-[90vh] overflow-hidden animate-slide-up safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">
            {step === 1 && 'Dealership Setup'}
            {step === 2 && 'Your Profile'}
            {step === 3 && 'Preferences'}
          </h2>
          
          <button
            onClick={() => toggleSetup(false)}
            className="ios-btn w-9 h-9 bg-muted/50 rounded-full text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-4 bg-gradient-to-b from-muted/30 to-transparent">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                s === step 
                  ? 'bg-primary scale-125' 
                  : s < step 
                    ? 'bg-primary/50' 
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[55vh] hide-scrollbar">
          {/* Step 1: Dealership */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                <Building2 className="w-5 h-5 text-primary" />
                <p className="text-sm font-medium text-foreground">Set up your dealership info</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Dealership Name *</label>
                  <input
                    type="text"
                    value={formData.dealershipName}
                    onChange={(e) => handleChange('dealershipName', e.target.value)}
                    placeholder="AutoMax Motors"
                    className="ios-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Address</label>
                  <input
                    type="text"
                    value={formData.dealershipAddress}
                    onChange={(e) => handleChange('dealershipAddress', e.target.value)}
                    placeholder="1234 Auto Drive, City, ST 12345"
                    className="ios-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Hours *</label>
                  <input
                    type="text"
                    value={formData.dealershipHours}
                    onChange={(e) => handleChange('dealershipHours', e.target.value)}
                    placeholder="Mon-Sat 9AM-8PM, Sun 11AM-6PM"
                    className="ios-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Appointment Phrasing</label>
                  <div className="space-y-2">
                    {APPOINTMENT_PHRASES.map((phrase) => (
                      <button
                        key={phrase.id}
                        onClick={() => handleChange('appointmentPhrase', phrase.id)}
                        className={`
                          ios-list-item rounded-xl w-full border transition-all
                          ${formData.appointmentPhrase === phrase.id 
                            ? 'border-primary bg-primary/5 shadow-sm' 
                            : 'border-border/50 bg-card/50'
                          }
                        `}
                      >
                        <span className="flex-1 text-sm text-foreground">&ldquo;{phrase.full}&rdquo;</span>
                        {formData.appointmentPhrase === phrase.id && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Salesperson */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl border border-accent/20">
                <User className="w-5 h-5 text-accent" />
                <p className="text-sm font-medium text-foreground">Tell us about yourself</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Your Name *</label>
                  <input
                    type="text"
                    value={formData.salespersonName}
                    onChange={(e) => handleChange('salespersonName', e.target.value)}
                    placeholder="John Smith"
                    className="ios-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Title (optional)</label>
                  <input
                    type="text"
                    value={formData.salespersonTitle}
                    onChange={(e) => handleChange('salespersonTitle', e.target.value)}
                    placeholder="Sales Consultant"
                    className="ios-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Your Style</label>
                  <div className="space-y-2">
                    {SALESPERSON_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleChange('salespersonStyle', style.id)}
                        className={`
                          ios-list-item rounded-xl w-full border transition-all
                          ${formData.salespersonStyle === style.id 
                            ? 'border-accent bg-accent/5 shadow-sm' 
                            : 'border-border/50 bg-card/50'
                          }
                        `}
                      >
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-foreground">{style.label}</p>
                          <p className="text-xs text-muted-foreground">{style.description}</p>
                        </div>
                        {formData.salespersonStyle === style.id && (
                          <Check className="w-5 h-5 text-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-xl border border-success/20">
                <Sliders className="w-5 h-5 text-success" />
                <p className="text-sm font-medium text-foreground">Set your defaults</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Default Tone</label>
                  <div className="space-y-2">
                    {RESPONSE_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        onClick={() => handleChange('defaultTone', tone.id)}
                        className={`
                          ios-list-item rounded-xl w-full border transition-all
                          ${formData.defaultTone === tone.id 
                            ? 'border-success bg-success/5 shadow-sm' 
                            : 'border-border/50 bg-card/50'
                          }
                        `}
                      >
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-foreground">{tone.label}</p>
                          <p className="text-xs text-muted-foreground">{tone.description}</p>
                        </div>
                        {formData.defaultTone === tone.id && (
                          <Check className="w-5 h-5 text-success" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Sign-off Name</label>
                  <input
                    type="text"
                    value={formData.signOff}
                    onChange={(e) => handleChange('signOff', e.target.value)}
                    placeholder={formData.salespersonName || "Your name"}
                    className="ios-input"
                  />
                  <p className="text-xs text-muted-foreground">How you want to sign your messages</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 p-5 border-t border-border/50 bg-gradient-to-t from-muted/30 to-transparent safe-area-bottom">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="ios-btn-secondary flex-1">
              Back
            </button>
          )}
          
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="ios-btn-primary flex-1 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button onClick={handleSave} className="ios-btn-success flex-1">
              <Check className="w-4 h-4" />
              Save & Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
