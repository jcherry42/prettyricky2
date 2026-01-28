import React, { useState, useEffect } from 'react';
import { X, Check, Building2, User, Sliders, ChevronRight, Sparkles } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { APPOINTMENT_PHRASES, SALESPERSON_STYLES } from '../data/salesData';
import { toast } from 'sonner';

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
  
  // Initialize form data from context values
  const getInitialFormData = () => ({
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
  
  const [formData, setFormData] = useState(getInitialFormData);

  // Only sync when modal opens (not on every render)
  useEffect(() => {
    if (showSetup) {
      setFormData(getInitialFormData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSetup]);

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
    toast.success('Settings saved successfully!');
  };

  const canProceed = () => {
    if (step === 1) return formData.dealershipName.trim() && formData.dealershipHours.trim();
    if (step === 2) return formData.salespersonName.trim();
    return true;
  };

  const steps = [
    { num: 1, label: 'Dealership', icon: Building2 },
    { num: 2, label: 'Profile', icon: User },
    { num: 3, label: 'Preferences', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center mclaren-glass-overlay p-4">
      <div className="mclaren-setup-modal w-full max-w-md max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Premium Header */}
        <div className="mclaren-setup-header px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="mclaren-setup-icon">
                {step === 1 && <Building2 className="w-5 h-5" />}
                {step === 2 && <User className="w-5 h-5" />}
                {step === 3 && <Sliders className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">
                  {step === 1 && 'Dealership Setup'}
                  {step === 2 && 'Your Profile'}
                  {step === 3 && 'Preferences'}
                </h2>
                <p className="text-xs text-muted-foreground">Step {step} of 3</p>
              </div>
            </div>
            
            <button
              onClick={() => toggleSetup(false)}
              className="mclaren-close-btn"
              data-testid="close-setup-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mclaren-progress-container px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <React.Fragment key={s.num}>
                  <div 
                    className={`mclaren-step-indicator ${
                      s.num === step ? 'active' : s.num < step ? 'completed' : ''
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`mclaren-step-line ${s.num < step ? 'completed' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            {steps.map(s => (
              <span key={s.num} className={s.num === step ? 'text-primary font-medium' : ''}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5 overflow-y-auto max-h-[50vh] hide-scrollbar">
          {/* Step 1: Dealership */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="mclaren-form-group">
                <label className="mclaren-label">
                  Dealership Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formData.dealershipName}
                  onChange={(e) => handleChange('dealershipName', e.target.value)}
                  placeholder="AutoMax Motors"
                  className="mclaren-input"
                  data-testid="dealership-name-input"
                />
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">Address</label>
                <input
                  type="text"
                  value={formData.dealershipAddress}
                  onChange={(e) => handleChange('dealershipAddress', e.target.value)}
                  placeholder="1234 Auto Drive, City, ST 12345"
                  className="mclaren-input"
                />
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">
                  Hours <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formData.dealershipHours}
                  onChange={(e) => handleChange('dealershipHours', e.target.value)}
                  placeholder="Mon-Sat 9AM-8PM, Sun 11AM-6PM"
                  className="mclaren-input"
                />
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">Appointment Phrasing</label>
                <div className="space-y-2">
                  {APPOINTMENT_PHRASES.map((phrase) => (
                    <button
                      key={phrase.id}
                      onClick={() => handleChange('appointmentPhrase', phrase.id)}
                      className={`mclaren-option-btn ${
                        formData.appointmentPhrase === phrase.id ? 'selected' : ''
                      }`}
                    >
                      <span className="flex-1 text-left text-sm">&ldquo;{phrase.full}&rdquo;</span>
                      {formData.appointmentPhrase === phrase.id && (
                        <div className="mclaren-check-icon">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Salesperson */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="mclaren-form-group">
                <label className="mclaren-label">
                  Your Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formData.salespersonName}
                  onChange={(e) => handleChange('salespersonName', e.target.value)}
                  placeholder="John Smith"
                  className="mclaren-input"
                  data-testid="salesperson-name-input"
                />
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">Title</label>
                <input
                  type="text"
                  value={formData.salespersonTitle}
                  onChange={(e) => handleChange('salespersonTitle', e.target.value)}
                  placeholder="Sales Consultant"
                  className="mclaren-input"
                />
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">Your Sales Style</label>
                <div className="grid grid-cols-1 gap-2">
                  {SALESPERSON_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => handleChange('salespersonStyle', style.id)}
                      className={`mclaren-style-card ${
                        formData.salespersonStyle === style.id ? 'selected' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{style.emoji}</span>
                        <div className="text-left flex-1">
                          <p className="font-medium text-sm">{style.label}</p>
                          <p className="text-xs text-muted-foreground">{style.description}</p>
                        </div>
                        {formData.salespersonStyle === style.id && (
                          <div className="mclaren-check-icon">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="mclaren-form-group">
                <label className="mclaren-label">Default Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {RESPONSE_TONES.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => handleChange('defaultTone', tone.id)}
                      className={`mclaren-tone-btn ${
                        formData.defaultTone === tone.id ? 'selected' : ''
                      }`}
                    >
                      <span className="text-lg mb-1">{tone.emoji}</span>
                      <span className="text-xs font-medium">{tone.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mclaren-form-group">
                <label className="mclaren-label">Sign-off Name</label>
                <input
                  type="text"
                  value={formData.signOff}
                  onChange={(e) => handleChange('signOff', e.target.value)}
                  placeholder={formData.salespersonName || 'Your name'}
                  className="mclaren-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This will appear at the end of your messages
                </p>
              </div>

              {/* Preview */}
              <div className="mclaren-preview-card">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Preview</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  &ldquo;Thanks for reaching out! I&apos;d love to help you find the perfect vehicle. 
                  {formData.dealershipName && ` ${formData.dealershipName} is`}
                  {formData.dealershipHours && ` open ${formData.dealershipHours}.`}
                  &rdquo;
                </p>
                <p className="text-sm text-primary font-medium mt-2">
                  — {formData.signOff || formData.salespersonName || 'Your Name'}
                  {formData.salespersonTitle && `, ${formData.salespersonTitle}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mclaren-setup-footer px-6 py-4">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="mclaren-btn-secondary flex-1"
              >
                Back
              </button>
            )}
            
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="mclaren-btn-primary flex-1 gap-2"
                data-testid="setup-next-btn"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="mclaren-btn-primary flex-1 gap-2"
                data-testid="setup-save-btn"
              >
                <Check className="w-4 h-4" />
                Save Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
