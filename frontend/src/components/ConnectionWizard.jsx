import React, { useState, useEffect } from 'react';
import { 
  X, ChevronRight, ChevronLeft, Check, AlertCircle, Loader2, 
  Plug, Database, Settings, Zap, Upload, Download, Copy, 
  ArrowRight, CheckCircle, XCircle, HelpCircle, Wand2,
  FileJson, Link2, GripVertical, Sparkles, Eye, Code, 
  Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Available transform types for UI
const TRANSFORM_OPTIONS = {
  string: [
    { type: 'uppercase', label: 'UPPERCASE', icon: 'Aa' },
    { type: 'lowercase', label: 'lowercase', icon: 'aa' },
    { type: 'titlecase', label: 'Title Case', icon: 'Aa' },
    { type: 'trim', label: 'Trim whitespace', icon: '✂️' },
  ],
  phone: [
    { type: 'phone_normalize', label: 'Normalize (+1...)', icon: '📱' },
    { type: 'phone_format_us', label: 'Format US ((XXX)...)', icon: '📞' },
    { type: 'phone_digits_only', label: 'Digits only', icon: '#' },
  ],
  price: [
    { type: 'price_normalize', label: 'Remove $ and commas', icon: '💰' },
    { type: 'round_price', label: 'Round to dollar', icon: '🔢' },
  ],
  name: [
    { type: 'name_combine', label: 'Combine first + last', icon: '👤' },
  ],
  date: [
    { type: 'date_normalize', label: 'Normalize to ISO', icon: '📅' },
  ],
  status: [
    { type: 'status_normalize', label: 'Normalize status', icon: '🏷️' },
  ],
};

/**
 * Connection Wizard - Step-by-step CRM setup with advanced features
 * 
 * Steps:
 * 1. Choose connection method (Quick Connect / Custom API / Import OpenAPI / Import Profile)
 * 2. Enter connection details (URL, auth) or parse OpenAPI spec
 * 3. Discover & map fields with Smart Suggest and Transforms
 * 4. Test & save
 */
export const ConnectionWizard = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Connection method
  const [connectionMethod, setConnectionMethod] = useState(null);
  const [selectedAdapter, setSelectedAdapter] = useState(null);
  const [availableAdapters, setAvailableAdapters] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // OpenAPI import
  const [showOpenAPIImport, setShowOpenAPIImport] = useState(false);
  const [openAPISpec, setOpenAPISpec] = useState('');
  const [openAPIUrl, setOpenAPIUrl] = useState('');
  const [parsedOpenAPI, setParsedOpenAPI] = useState(null);
  
  // Step 2: Connection details
  const [connectionConfig, setConnectionConfig] = useState({
    name: '',
    base_url: '',
    auth_method: 'api_key',
    api_key: '',
    customers_endpoint: '/customers',
    vehicles_endpoint: '/vehicles',
    data_type: 'customers',
  });
  
  // Step 3: Field mapping
  const [discoveredFields, setDiscoveredFields] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});
  const [advancedMappings, setAdvancedMappings] = useState({});
  const [targetSchema, setTargetSchema] = useState({});
  const [sampleRecord, setSampleRecord] = useState(null);
  const [unmappedRequired, setUnmappedRequired] = useState([]);
  const [discoveryMethod, setDiscoveryMethod] = useState('auto');
  const [manualSample, setManualSample] = useState('');
  const [smartSuggestLoading, setSmartSuggestLoading] = useState(false);
  const [expandedField, setExpandedField] = useState(null);
  const [transformPreview, setTransformPreview] = useState({});
  
  // Step 4: Review
  const [testResult, setTestResult] = useState(null);
  const [mockMode, setMockMode] = useState(true);
  const [saveAsProfile, setSaveAsProfile] = useState(false);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    loadAdaptersAndProfiles();
  }, []);

  const loadAdaptersAndProfiles = async () => {
    try {
      const [adaptersRes, profilesRes] = await Promise.all([
        fetch(`${API_URL}/api/integrations/adapters`),
        fetch(`${API_URL}/api/integration-profiles`)
      ]);
      
      const adaptersData = await adaptersRes.json();
      const profilesData = await profilesRes.json();
      
      setAvailableAdapters(adaptersData.adapters || []);
      setProfiles(profilesData.profiles || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const loadTargetSchema = async (dataType) => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/schema/${dataType}`);
      const data = await res.json();
      setTargetSchema(data.schema || {});
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // ========== STEP 1: Connection Method ==========
  
  const handleMethodSelect = (method) => {
    setConnectionMethod(method);
    if (method === 'custom') {
      setSelectedAdapter({ type: 'generic_rest', name: 'Custom REST API' });
      nextStep();
    } else if (method === 'openapi') {
      setShowOpenAPIImport(true);
    }
  };

  const handleAdapterSelect = (adapter) => {
    setSelectedAdapter(adapter);
    setConnectionConfig(prev => ({
      ...prev,
      name: `My ${adapter.name}`,
      base_url: adapter.type === 'generic_rest' ? '' : `https://api.${adapter.type}.com`,
    }));
    nextStep();
  };

  const handleProfileSelect = async (profile) => {
    setSelectedProfile(profile);
    
    try {
      const res = await fetch(`${API_URL}/api/integration-profiles/${profile.id}`);
      const fullProfile = await res.json();
      
      setConnectionConfig({
        name: `${fullProfile.name} (Copy)`,
        base_url: fullProfile.base_url || '',
        auth_method: fullProfile.auth_method || 'api_key',
        api_key: '',
        customers_endpoint: fullProfile.customers_endpoint || '/customers',
        vehicles_endpoint: fullProfile.vehicles_endpoint || '/vehicles',
        data_type: 'customers',
      });
      
      setFieldMappings(fullProfile.customer_mappings || {});
      nextStep();
    } catch (err) {
      toast.error('Failed to load profile');
    }
  };

  // ========== OpenAPI Import ==========
  
  const handleParseOpenAPI = async () => {
    if (!openAPISpec.trim() && !openAPIUrl.trim()) {
      toast.error('Please provide an OpenAPI spec or URL');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/parse-openapi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec_content: openAPISpec.trim() || undefined,
          spec_url: openAPIUrl.trim() || undefined,
        }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        setParsedOpenAPI(result);
        
        // Pre-fill connection config from parsed spec
        setConnectionConfig(prev => ({
          ...prev,
          name: result.api_info?.title || 'Imported API',
          base_url: result.base_url || '',
          customers_endpoint: result.customers_endpoint?.path || '/customers',
          vehicles_endpoint: result.vehicles_endpoint?.path || '/vehicles',
          auth_method: result.auth_methods?.[0]?.method || 'api_key',
        }));
        
        // Pre-fill field mappings if available
        if (result.suggested_config?.customer_mappings) {
          setFieldMappings(result.suggested_config.customer_mappings);
        }
        
        setSelectedAdapter({ type: 'generic_rest', name: result.api_info?.title || 'OpenAPI Import' });
        setShowOpenAPIImport(false);
        toast.success(`Parsed ${result.spec_version} spec with ${result.endpoints?.length || 0} endpoints`);
        nextStep();
      } else {
        toast.error(result.errors?.[0] || 'Failed to parse OpenAPI spec');
      }
    } catch (err) {
      toast.error('Failed to parse OpenAPI spec');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== STEP 2: Connection Details ==========
  
  const handleConnectionNext = async () => {
    if (!connectionConfig.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!connectionConfig.base_url.trim() && !mockMode) {
      toast.error('Please enter a base URL');
      return;
    }
    
    await loadTargetSchema(connectionConfig.data_type);
    nextStep();
  };

  // ========== STEP 3: Field Mapping ==========
  
  const handleDiscoverFields = async () => {
    setIsLoading(true);
    
    try {
      let result;
      
      if (discoveryMethod === 'auto') {
        const endpoint = connectionConfig.data_type === 'customers' 
          ? connectionConfig.customers_endpoint 
          : connectionConfig.vehicles_endpoint;
        
        const res = await fetch(`${API_URL}/api/integrations/discover-fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_url: connectionConfig.base_url,
            endpoint: endpoint,
            auth_config: {
              method: connectionConfig.auth_method,
              api_key: connectionConfig.api_key,
            },
            data_type: connectionConfig.data_type,
          }),
        });
        result = await res.json();
      } else {
        const res = await fetch(`${API_URL}/api/integrations/discover-fields/sample`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sample_json: manualSample,
            data_type: connectionConfig.data_type,
          }),
        });
        result = await res.json();
      }
      
      if (result.success) {
        setDiscoveredFields(result.discovered_fields);
        setSampleRecord(result.sample_record);
        setUnmappedRequired(result.unmapped_required || []);
        
        // Auto-apply suggested mappings
        const autoMappings = {};
        result.discovered_fields.forEach(field => {
          if (field.suggested_mapping && field.confidence >= 0.5) {
            autoMappings[field.source_name] = field.suggested_mapping;
          }
        });
        setFieldMappings(autoMappings);
        
        if (result.warnings?.length > 0) {
          toast.warning(result.warnings[0]);
        } else {
          toast.success(`Discovered ${result.discovered_fields.length} fields`);
        }
      } else {
        toast.error(result.errors?.[0] || 'Discovery failed');
      }
    } catch (err) {
      toast.error('Failed to discover fields');
    } finally {
      setIsLoading(false);
    }
  };

  // Smart Suggest for unmapped fields
  const handleSmartSuggest = async () => {
    const unmapped = discoveredFields.filter(f => !fieldMappings[f.source_name]);
    if (unmapped.length === 0) {
      toast.info('All fields are already mapped');
      return;
    }
    
    setSmartSuggestLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/smart-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unmapped_fields: unmapped.map(f => ({
            source_name: f.source_name,
            sample_value: f.sample_value,
          })),
          data_type: connectionConfig.data_type,
          use_ai: true,
        }),
      });
      
      const result = await res.json();
      
      if (result.success && result.suggestions?.length > 0) {
        const newMappings = { ...fieldMappings };
        result.suggestions.forEach(s => {
          if (s.confidence >= 0.6) {
            newMappings[s.source_field] = s.suggested_target;
          }
        });
        setFieldMappings(newMappings);
        toast.success(`AI suggested ${result.suggestions.length} mappings`);
      } else {
        toast.info('No additional suggestions found');
      }
    } catch (err) {
      toast.error('Smart suggest failed');
    } finally {
      setSmartSuggestLoading(false);
    }
  };

  // Transform preview
  const handlePreviewTransform = async (sourceField, transformType, value) => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/transforms/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: value,
          transform_type: transformType,
          params: {},
        }),
      });
      
      const result = await res.json();
      if (result.success) {
        setTransformPreview(prev => ({
          ...prev,
          [sourceField]: result.output,
        }));
      }
    } catch (err) {
      console.error('Preview failed:', err);
    }
  };

  const handleMappingChange = (sourceField, targetField) => {
    setFieldMappings(prev => {
      const updated = { ...prev };
      if (targetField) {
        updated[sourceField] = targetField;
      } else {
        delete updated[sourceField];
      }
      return updated;
    });
  };

  // Advanced mapping: add transform
  const handleAddTransform = (sourceField, transformType) => {
    setAdvancedMappings(prev => {
      const existing = prev[sourceField] || { transforms: [] };
      return {
        ...prev,
        [sourceField]: {
          ...existing,
          transforms: [...existing.transforms, { type: transformType, params: {} }],
        },
      };
    });
    
    // Preview the transform
    const field = discoveredFields.find(f => f.source_name === sourceField);
    if (field) {
      handlePreviewTransform(sourceField, transformType, field.sample_value);
    }
  };

  const handleRemoveTransform = (sourceField, index) => {
    setAdvancedMappings(prev => {
      const existing = prev[sourceField] || { transforms: [] };
      const newTransforms = existing.transforms.filter((_, i) => i !== index);
      if (newTransforms.length === 0) {
        const { [sourceField]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [sourceField]: { ...existing, transforms: newTransforms },
      };
    });
    setTransformPreview(prev => {
      const { [sourceField]: _, ...rest } = prev;
      return rest;
    });
  };

  // Set default value
  const handleSetDefault = (sourceField, defaultValue) => {
    setAdvancedMappings(prev => ({
      ...prev,
      [sourceField]: {
        ...(prev[sourceField] || {}),
        default_value: defaultValue,
      },
    }));
  };

  // ========== STEP 4: Test & Save ==========
  
  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const createRes = await fetch(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `TEST_${connectionConfig.name}`,
          adapter_type: selectedAdapter?.type || 'generic_rest',
          base_url: connectionConfig.base_url || 'https://mock.api',
          auth_config: {
            method: connectionConfig.auth_method,
            api_key: connectionConfig.api_key,
          },
          data_type: connectionConfig.data_type,
          field_mappings: fieldMappings,
          mock_mode: mockMode,
        }),
      });
      
      const createData = await createRes.json();
      
      if (createData.success) {
        const testRes = await fetch(`${API_URL}/api/integrations/${createData.integration_id}/test`, {
          method: 'POST',
        });
        const testData = await testRes.json();
        
        setTestResult({
          success: testData.success,
          message: testData.message,
          integrationId: createData.integration_id,
        });
        
        if (testData.success) {
          toast.success('Connection test passed!');
        } else {
          toast.error(testData.message || 'Connection test failed');
          await fetch(`${API_URL}/api/integrations/${createData.integration_id}`, { method: 'DELETE' });
        }
      } else {
        toast.error('Failed to create test integration');
      }
    } catch (err) {
      toast.error('Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!testResult?.success) {
      toast.error('Please test the connection first');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await fetch(`${API_URL}/api/integrations/${testResult.integrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: connectionConfig.name,
        }),
      });
      
      if (saveAsProfile && profileName.trim()) {
        await fetch(`${API_URL}/api/integration-profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: profileName,
            description: `Profile for ${connectionConfig.name}`,
            adapter_type: selectedAdapter?.type || 'generic_rest',
            base_url: connectionConfig.base_url,
            auth_method: connectionConfig.auth_method,
            customers_endpoint: connectionConfig.customers_endpoint,
            vehicles_endpoint: connectionConfig.vehicles_endpoint,
            customer_mappings: connectionConfig.data_type === 'customers' ? fieldMappings : {},
            vehicle_mappings: connectionConfig.data_type === 'vehicles' ? fieldMappings : {},
            is_public: true,
          }),
        });
        toast.success('Profile saved for future use!');
      }
      
      toast.success(`Integration "${connectionConfig.name}" created!`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error('Failed to finish setup');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityFields = () => {
    return Object.entries(targetSchema)
      .sort((a, b) => (a[1].priority || 99) - (b[1].priority || 99))
      .map(([key, value]) => ({ key, ...value }));
  };

  const getMappedTargets = () => new Set(Object.values(fieldMappings));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Connection Wizard</h2>
              <p className="text-xs text-muted-foreground">Step {step} of 4</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="wizard-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-muted/20">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <div 
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span className={step >= 1 ? 'text-primary' : ''}>Choose Method</span>
            <span className={step >= 2 ? 'text-primary' : ''}>Connection</span>
            <span className={step >= 3 ? 'text-primary' : ''}>Map Fields</span>
            <span className={step >= 4 ? 'text-primary' : ''}>Test & Save</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Choose Method */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">How would you like to connect?</h3>
              
              {/* Quick Connect */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Quick Connect</h4>
                <div className="grid grid-cols-3 gap-2">
                  {availableAdapters.filter(a => a.type !== 'generic_rest').slice(0, 6).map(adapter => (
                    <button
                      key={adapter.type}
                      onClick={() => handleAdapterSelect(adapter)}
                      className="p-3 rounded-xl border border-border hover:border-primary bg-card hover:bg-primary/5 text-left transition-all group"
                      data-testid={`adapter-${adapter.type}`}
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                        <span className="text-sm font-medium truncate">{adapter.name.split(' ')[0]}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{adapter.vendor}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom API */}
              <button
                onClick={() => handleMethodSelect('custom')}
                className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary bg-card hover:bg-primary/5 text-left transition-all flex items-center gap-4"
                data-testid="custom-api-btn"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Custom REST API</h4>
                  <p className="text-xs text-muted-foreground">Connect to any API with custom configuration</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </button>

              {/* Import OpenAPI Spec */}
              <button
                onClick={() => handleMethodSelect('openapi')}
                className="w-full p-4 rounded-xl border-2 border-dashed border-purple-500/30 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 text-left transition-all flex items-center gap-4"
                data-testid="openapi-import-btn"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Code className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Import OpenAPI/Swagger</h4>
                  <p className="text-xs text-muted-foreground">Auto-configure from API specification</p>
                </div>
                <Sparkles className="w-5 h-5 text-purple-400 ml-auto" />
              </button>

              {/* Saved Profiles */}
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Or use a saved profile</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {profiles.map(profile => (
                      <button
                        key={profile.id}
                        onClick={() => handleProfileSelect(profile)}
                        className="w-full p-3 rounded-lg border border-border hover:border-primary bg-card hover:bg-primary/5 text-left transition-all flex items-center gap-3"
                        data-testid={`profile-${profile.id}`}
                      >
                        <FileJson className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{profile.name}</p>
                          <p className="text-[10px] text-muted-foreground">{profile.adapter_type} • Used {profile.use_count}x</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* OpenAPI Import Modal */}
              {showOpenAPIImport && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-purple-500/30 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-purple-500/5">
                      <div className="flex items-center gap-3">
                        <Code className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-foreground">Import OpenAPI Spec</h3>
                      </div>
                      <button onClick={() => setShowOpenAPIImport(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Spec URL (optional)</label>
                        <input
                          type="text"
                          value={openAPIUrl}
                          onChange={e => setOpenAPIUrl(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                          placeholder="https://api.example.com/openapi.json"
                          data-testid="openapi-url-input"
                        />
                      </div>
                      
                      <div className="text-center text-xs text-muted-foreground">— or —</div>
                      
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Paste Spec (JSON/YAML)</label>
                        <textarea
                          value={openAPISpec}
                          onChange={e => setOpenAPISpec(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm font-mono h-40"
                          placeholder='openapi: "3.0.0"&#10;info:&#10;  title: My API&#10;  version: "1.0"'
                          data-testid="openapi-spec-input"
                        />
                      </div>
                      
                      <button
                        onClick={handleParseOpenAPI}
                        disabled={isLoading || (!openAPISpec.trim() && !openAPIUrl.trim())}
                        className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        data-testid="parse-openapi-btn"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Parse & Import
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Connection Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Connection Details</h3>
              
              {/* Show parsed OpenAPI info if available */}
              {parsedOpenAPI && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-4">
                  <p className="text-xs text-purple-400 font-medium">Imported from {parsedOpenAPI.spec_version}</p>
                  <p className="text-sm text-foreground">{parsedOpenAPI.api_info?.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {parsedOpenAPI.endpoints?.length || 0} endpoints found • 
                    Customers: {parsedOpenAPI.customers_endpoint?.path || 'Not detected'} • 
                    Vehicles: {parsedOpenAPI.vehicles_endpoint?.path || 'Not detected'}
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Integration Name *</label>
                  <input
                    type="text"
                    value={connectionConfig.name}
                    onChange={e => setConnectionConfig(p => ({ ...p, name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                    placeholder="My CRM Connection"
                    data-testid="integration-name-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                  <input
                    type="text"
                    value={connectionConfig.base_url}
                    onChange={e => setConnectionConfig(p => ({ ...p, base_url: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                    placeholder="https://api.yourcrm.com/v1"
                    data-testid="base-url-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Auth Method</label>
                    <select
                      value={connectionConfig.auth_method}
                      onChange={e => setConnectionConfig(p => ({ ...p, auth_method: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                      data-testid="auth-method-select"
                    >
                      <option value="api_key">API Key</option>
                      <option value="bearer_token">Bearer Token</option>
                      <option value="basic_auth">Basic Auth</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">API Key / Token</label>
                    <input
                      type="password"
                      value={connectionConfig.api_key}
                      onChange={e => setConnectionConfig(p => ({ ...p, api_key: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                      placeholder="Enter your API key"
                      data-testid="api-key-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Customers Endpoint</label>
                    <input
                      type="text"
                      value={connectionConfig.customers_endpoint}
                      onChange={e => setConnectionConfig(p => ({ ...p, customers_endpoint: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                      placeholder="/customers"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Vehicles Endpoint</label>
                    <input
                      type="text"
                      value={connectionConfig.vehicles_endpoint}
                      onChange={e => setConnectionConfig(p => ({ ...p, vehicles_endpoint: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                      placeholder="/vehicles"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data Type to Configure</label>
                  <div className="flex gap-2 mt-1">
                    {['customers', 'vehicles'].map(type => (
                      <button
                        key={type}
                        onClick={() => setConnectionConfig(p => ({ ...p, data_type: type }))}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                          connectionConfig.data_type === type
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid={`data-type-${type}`}
                      >
                        {type === 'customers' ? 'Customers' : 'Vehicles'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Map Fields</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscoveryMethod('auto')}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      discoveryMethod === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Auto-Fetch
                  </button>
                  <button
                    onClick={() => setDiscoveryMethod('manual')}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      discoveryMethod === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Paste Sample
                  </button>
                </div>
              </div>

              {discoveryMethod === 'manual' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Paste a sample JSON record</label>
                  <textarea
                    value={manualSample}
                    onChange={e => setManualSample(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm font-mono h-32"
                    placeholder='{"first_name": "John", "last_name": "Doe", "email": "john@example.com"}'
                    data-testid="manual-sample-input"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleDiscoverFields}
                  disabled={isLoading || (discoveryMethod === 'manual' && !manualSample.trim())}
                  className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="discover-fields-btn"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {discoveryMethod === 'auto' ? 'Discover Fields from API' : 'Analyze Sample'}
                </button>
                
                {discoveredFields.length > 0 && (
                  <button
                    onClick={handleSmartSuggest}
                    disabled={smartSuggestLoading}
                    className="px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    data-testid="smart-suggest-btn"
                  >
                    {smartSuggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    AI Suggest
                  </button>
                )}
              </div>

              {/* Field Mapping Table */}
              {discoveredFields.length > 0 && (
                <div className="space-y-3">
                  {unmappedRequired.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-500">Required fields not mapped</p>
                        <p className="text-xs text-amber-500/70">{unmappedRequired.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 p-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                      <div className="col-span-3">Source Field</div>
                      <div className="col-span-3">Sample Value</div>
                      <div className="col-span-3">Maps To</div>
                      <div className="col-span-3">Transforms</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {discoveredFields.map(field => {
                        const isExpanded = expandedField === field.source_name;
                        const fieldAdvanced = advancedMappings[field.source_name] || {};
                        
                        return (
                          <div key={field.source_name} className="border-t border-border/50">
                            <div className="grid grid-cols-12 gap-2 p-2 items-center text-sm">
                              <div className="col-span-3 font-mono text-xs truncate" title={field.source_path}>
                                {field.source_name}
                              </div>
                              <div className="col-span-3 text-muted-foreground text-xs truncate" title={String(field.sample_value)}>
                                {transformPreview[field.source_name] ? (
                                  <span className="text-green-400">{String(transformPreview[field.source_name])}</span>
                                ) : (
                                  String(field.sample_value)?.substring(0, 30)
                                )}
                              </div>
                              <div className="col-span-3">
                                <select
                                  value={fieldMappings[field.source_name] || ''}
                                  onChange={e => handleMappingChange(field.source_name, e.target.value)}
                                  className={`w-full px-2 py-1 bg-muted/30 border rounded text-xs ${
                                    fieldMappings[field.source_name] 
                                      ? 'border-green-500/50 bg-green-500/10' 
                                      : 'border-border'
                                  }`}
                                  data-testid={`mapping-${field.source_name}`}
                                >
                                  <option value="">-- Skip --</option>
                                  {getPriorityFields().map(target => (
                                    <option 
                                      key={target.key} 
                                      value={target.key}
                                      disabled={getMappedTargets().has(target.key) && fieldMappings[field.source_name] !== target.key}
                                    >
                                      {target.key} {target.required ? '*' : ''} {field.suggested_mapping === target.key ? '✓' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-3 flex items-center gap-1">
                                {fieldAdvanced.transforms?.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">
                                    {fieldAdvanced.transforms.length} transform{fieldAdvanced.transforms.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                <button
                                  onClick={() => setExpandedField(isExpanded ? null : field.source_name)}
                                  className="ml-auto p-1 text-muted-foreground hover:text-foreground"
                                  data-testid={`expand-${field.source_name}`}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            
                            {/* Expanded: Transform options */}
                            {isExpanded && (
                              <div className="px-3 pb-3 bg-muted/10 border-t border-border/30">
                                <div className="pt-3 space-y-3">
                                  {/* Current transforms */}
                                  {fieldAdvanced.transforms?.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-muted-foreground font-medium">Applied Transforms</p>
                                      <div className="flex flex-wrap gap-1">
                                        {fieldAdvanced.transforms.map((t, idx) => (
                                          <span 
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded"
                                          >
                                            {t.type}
                                            <button 
                                              onClick={() => handleRemoveTransform(field.source_name, idx)}
                                              className="hover:text-red-400"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Add transform */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground font-medium">Add Transform</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(TRANSFORM_OPTIONS).map(([category, transforms]) => (
                                        transforms.slice(0, 2).map(t => (
                                          <button
                                            key={t.type}
                                            onClick={() => handleAddTransform(field.source_name, t.type)}
                                            className="px-2 py-1 bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                                            data-testid={`add-transform-${t.type}`}
                                          >
                                            {t.icon} {t.label}
                                          </button>
                                        ))
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Default value */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground font-medium">Default Value (if empty)</p>
                                    <input
                                      type="text"
                                      value={fieldAdvanced.default_value || ''}
                                      onChange={e => handleSetDefault(field.source_name, e.target.value)}
                                      className="w-full px-2 py-1 bg-muted/30 border border-border rounded text-xs"
                                      placeholder="Enter default value..."
                                      data-testid={`default-${field.source_name}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {Object.keys(fieldMappings).length} of {discoveredFields.length} fields mapped
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Test & Save */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Test & Save</h3>

              <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{connectionConfig.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{selectedAdapter?.name || 'Custom'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium capitalize">{connectionConfig.data_type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fields Mapped:</span>
                  <span className="font-medium">{Object.keys(fieldMappings).length}</span>
                </div>
                {Object.keys(advancedMappings).length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">With Transforms:</span>
                    <span className="font-medium text-purple-400">{Object.keys(advancedMappings).length} fields</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div>
                  <p className="text-sm font-medium text-amber-400">Mock Mode</p>
                  <p className="text-[10px] text-amber-400/70">Test with generated data (no real API needed)</p>
                </div>
                <button
                  onClick={() => setMockMode(!mockMode)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    mockMode ? 'bg-amber-500' : 'bg-muted'
                  }`}
                  data-testid="mock-mode-toggle"
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    mockMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2"
                data-testid="test-connection-btn"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Test Connection
              </button>

              {testResult && (
                <div className={`p-4 rounded-xl flex items-start gap-3 ${
                  testResult.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className={`font-medium ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                      {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                    </p>
                    <p className={`text-xs ${testResult.success ? 'text-green-500/70' : 'text-red-500/70'}`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}

              {testResult?.success && (
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveAsProfile}
                      onChange={e => setSaveAsProfile(e.target.checked)}
                      className="rounded"
                      data-testid="save-profile-checkbox"
                    />
                    <span className="text-sm">Save as reusable profile</span>
                  </label>
                  {saveAsProfile && (
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm"
                      placeholder="Profile name (e.g., 'VinSolutions Standard')"
                      data-testid="profile-name-input"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
          <button
            onClick={step === 1 ? onClose : prevStep}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            data-testid="wizard-back-btn"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button
              onClick={step === 2 ? handleConnectionNext : nextStep}
              disabled={step === 3 && unmappedRequired.length > 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              data-testid="wizard-next-btn"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!testResult?.success || isLoading}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              data-testid="wizard-finish-btn"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create Integration
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionWizard;
