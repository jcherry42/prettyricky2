import React, { createContext, useContext, useReducer, useEffect } from 'react';
import {
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
  DEFAULT_TEMPLATES,
  DEFAULT_VEHICLES,
  DEFAULT_CUSTOMERS,
  DEFAULT_DEALERSHIP,
  DEFAULT_SALESPERSON,
  DEFAULT_PREFERENCES,
  processTemplate,
  buildContext,
  getResponses,
  FOLLOW_UP_TEMPLATES,
} from '../data/salesData';
import {
  shareMessage,
  openMessages,
  copyToClipboard as copyUtil,
  isOnline,
  cacheForOffline,
} from '../utils/messaging';

// Initial state
const initialState = {
  // Setup
  dealership: DEFAULT_DEALERSHIP,
  salesperson: DEFAULT_SALESPERSON,
  preferences: DEFAULT_PREFERENCES,
  isSetupComplete: false,
  
  // Data
  vehicles: DEFAULT_VEHICLES,
  customers: DEFAULT_CUSTOMERS,
  customTemplates: {},
  favorites: [],
  
  // Current selection
  selectedCustomer: null,
  selectedVehicle: null,
  selectedInquiryType: null,
  selectedTone: 'balanced',
  
  // Generated responses
  currentResponses: [],
  selectedResponse: null,
  
  // UI state
  showSetup: false,
  showImport: false,
  showTowerTalk: false,
  showFavorites: false,
  showVS: false,  // VS Battle Card mode
  showAnalytics: false,  // Analytics Dashboard
  showAdminSettings: false,  // Admin Settings Panel
  isOffline: !navigator.onLine,
  
  // Theme & Modes
  theme: 'dark',  // 'light' or 'dark'
  supercharged: false,  // Supercharg'd translation mode
};

// Action types
const ACTIONS = {
  SET_DEALERSHIP: 'SET_DEALERSHIP',
  SET_SALESPERSON: 'SET_SALESPERSON',
  SET_PREFERENCES: 'SET_PREFERENCES',
  SET_SETUP_COMPLETE: 'SET_SETUP_COMPLETE',
  SET_VEHICLES: 'SET_VEHICLES',
  SET_CUSTOMERS: 'SET_CUSTOMERS',
  SET_CUSTOM_TEMPLATES: 'SET_CUSTOM_TEMPLATES',
  SELECT_CUSTOMER: 'SELECT_CUSTOMER',
  SELECT_VEHICLE: 'SELECT_VEHICLE',
  SELECT_INQUIRY_TYPE: 'SELECT_INQUIRY_TYPE',
  SELECT_TONE: 'SELECT_TONE',
  SET_RESPONSES: 'SET_RESPONSES',
  SELECT_RESPONSE: 'SELECT_RESPONSE',
  TOGGLE_SETUP: 'TOGGLE_SETUP',
  TOGGLE_IMPORT: 'TOGGLE_IMPORT',
  TOGGLE_TOWER_TALK: 'TOGGLE_TOWER_TALK',
  TOGGLE_FAVORITES: 'TOGGLE_FAVORITES',
  TOGGLE_VS: 'TOGGLE_VS',
  TOGGLE_ANALYTICS: 'TOGGLE_ANALYTICS',
  TOGGLE_ADMIN_SETTINGS: 'TOGGLE_ADMIN_SETTINGS',
  ADD_FAVORITE: 'ADD_FAVORITE',
  REMOVE_FAVORITE: 'REMOVE_FAVORITE',
  UPDATE_FAVORITE_CATEGORY: 'UPDATE_FAVORITE_CATEGORY',
  SET_FAVORITES: 'SET_FAVORITES',
  SET_OFFLINE: 'SET_OFFLINE',
  LOAD_SAVED_DATA: 'LOAD_SAVED_DATA',
  SET_THEME: 'SET_THEME',
  SET_SUPERCHARGED: 'SET_SUPERCHARGED',
};

// Reducer
function salesReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_DEALERSHIP:
      saveToStorage(STORAGE_KEYS.DEALERSHIP_SETUP, action.payload);
      return { ...state, dealership: action.payload };
      
    case ACTIONS.SET_SALESPERSON:
      saveToStorage(STORAGE_KEYS.SALESPERSON_SETUP, action.payload);
      return { ...state, salesperson: action.payload };
      
    case ACTIONS.SET_PREFERENCES:
      saveToStorage(STORAGE_KEYS.USER_PREFERENCES, action.payload);
      return { ...state, preferences: action.payload };
      
    case ACTIONS.SET_SETUP_COMPLETE:
      return { ...state, isSetupComplete: action.payload };
      
    case ACTIONS.SET_VEHICLES:
      saveToStorage(STORAGE_KEYS.VEHICLES, action.payload);
      return { ...state, vehicles: action.payload };
      
    case ACTIONS.SET_CUSTOMERS:
      saveToStorage(STORAGE_KEYS.CUSTOMERS, action.payload);
      return { ...state, customers: action.payload };
      
    case ACTIONS.SET_CUSTOM_TEMPLATES:
      saveToStorage(STORAGE_KEYS.CUSTOM_TEMPLATES, action.payload);
      return { ...state, customTemplates: action.payload };
      
    case ACTIONS.SELECT_CUSTOMER:
      const customer = action.payload;
      const vehicle = customer?.vehicleInterest ? 
        state.vehicles.find(v => v.id === customer.vehicleInterest) : null;
      return { 
        ...state, 
        selectedCustomer: customer,
        selectedVehicle: vehicle,
        selectedInquiryType: null,
        currentResponses: [],
        selectedResponse: null,
      };
      
    case ACTIONS.SELECT_VEHICLE:
      return { ...state, selectedVehicle: action.payload };
      
    case ACTIONS.SELECT_INQUIRY_TYPE:
      return { 
        ...state, 
        selectedInquiryType: action.payload,
        selectedResponse: null,
      };
      
    case ACTIONS.SELECT_TONE:
      return { 
        ...state, 
        selectedTone: action.payload,
        selectedResponse: null,
      };
      
    case ACTIONS.SET_RESPONSES:
      return { ...state, currentResponses: action.payload };
      
    case ACTIONS.SELECT_RESPONSE:
      return { ...state, selectedResponse: action.payload };
      
    case ACTIONS.TOGGLE_SETUP:
      return { ...state, showSetup: action.payload ?? !state.showSetup };
      
    case ACTIONS.TOGGLE_IMPORT:
      return { ...state, showImport: action.payload ?? !state.showImport };
      
    case ACTIONS.TOGGLE_TOWER_TALK:
      return { ...state, showTowerTalk: action.payload ?? !state.showTowerTalk };
    
    case ACTIONS.TOGGLE_FAVORITES:
      return { ...state, showFavorites: action.payload ?? !state.showFavorites };
    
    case ACTIONS.TOGGLE_VS:
      return { ...state, showVS: action.payload ?? !state.showVS };
    
    case ACTIONS.TOGGLE_ANALYTICS:
      return { ...state, showAnalytics: action.payload ?? !state.showAnalytics };
    
    case ACTIONS.TOGGLE_ADMIN_SETTINGS:
      return { ...state, showAdminSettings: action.payload ?? !state.showAdminSettings };
    
    case ACTIONS.ADD_FAVORITE:
      const newFavorites = [...state.favorites, action.payload];
      saveToStorage(STORAGE_KEYS.FAVORITES, newFavorites);
      return { ...state, favorites: newFavorites };
    
    case ACTIONS.REMOVE_FAVORITE:
      const filteredFavorites = state.favorites.filter(f => f.id !== action.payload);
      saveToStorage(STORAGE_KEYS.FAVORITES, filteredFavorites);
      return { ...state, favorites: filteredFavorites };
    
    case ACTIONS.UPDATE_FAVORITE_CATEGORY:
      const updatedFavorites = state.favorites.map(f => 
        f.id === action.payload.id 
          ? { ...f, category: action.payload.category }
          : f
      );
      saveToStorage(STORAGE_KEYS.FAVORITES, updatedFavorites);
      return { ...state, favorites: updatedFavorites };
    
    case ACTIONS.SET_FAVORITES:
      saveToStorage(STORAGE_KEYS.FAVORITES, action.payload);
      return { ...state, favorites: action.payload };
      
    case ACTIONS.SET_OFFLINE:
      return { ...state, isOffline: action.payload };
    
    case ACTIONS.SET_THEME:
      localStorage.setItem('closr_theme', action.payload);
      // Apply theme to document
      if (action.payload === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { ...state, theme: action.payload };
    
    case ACTIONS.SET_SUPERCHARGED:
      localStorage.setItem('closr_supercharged', action.payload ? 'true' : 'false');
      return { ...state, supercharged: action.payload };
      
    case ACTIONS.LOAD_SAVED_DATA:
      return { ...state, ...action.payload };
      
    default:
      return state;
  }
}

// Context
const SalesContext = createContext(null);

// Provider component
export function SalesProvider({ children }) {
  const [state, dispatch] = useReducer(salesReducer, initialState);

  // Load saved data on mount
  useEffect(() => {
    const dealership = loadFromStorage(STORAGE_KEYS.DEALERSHIP_SETUP, DEFAULT_DEALERSHIP);
    const salesperson = loadFromStorage(STORAGE_KEYS.SALESPERSON_SETUP, DEFAULT_SALESPERSON);
    const preferences = loadFromStorage(STORAGE_KEYS.USER_PREFERENCES, DEFAULT_PREFERENCES);
    const vehicles = loadFromStorage(STORAGE_KEYS.VEHICLES, DEFAULT_VEHICLES);
    const customers = loadFromStorage(STORAGE_KEYS.CUSTOMERS, DEFAULT_CUSTOMERS);
    const customTemplates = loadFromStorage(STORAGE_KEYS.CUSTOM_TEMPLATES, {});
    const favorites = loadFromStorage(STORAGE_KEYS.FAVORITES, []);
    
    // Load theme preference
    const savedTheme = localStorage.getItem('closr_theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Load supercharged mode
    const savedSupercharged = localStorage.getItem('closr_supercharged') === 'true';
    
    const isSetupComplete = dealership.name !== DEFAULT_DEALERSHIP.name || 
                            salesperson.name !== DEFAULT_SALESPERSON.name;
    
    dispatch({
      type: ACTIONS.LOAD_SAVED_DATA,
      payload: {
        dealership,
        salesperson,
        preferences,
        vehicles,
        customers,
        customTemplates,
        favorites,
        isSetupComplete,
        selectedTone: preferences.defaultTone || 'balanced',
        theme: savedTheme,
        supercharged: savedSupercharged,
      },
    });
  }, []);

  // Listen for online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: ACTIONS.SET_OFFLINE, payload: false });
    const handleOffline = () => dispatch({ type: ACTIONS.SET_OFFLINE, payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Generate responses when inquiry type or tone changes
  useEffect(() => {
    if (state.selectedInquiryType && state.selectedCustomer) {
      const templates = getResponses(state.selectedInquiryType, state.selectedTone, state.customTemplates);
      const context = buildContext(
        state.selectedCustomer,
        state.selectedVehicle,
        state.dealership,
        state.salesperson,
        state.preferences
      );
      
      const processed = templates.map((t, index) => {
        // Get follow-up templates for this timing
        const followUpTemplates = t.followUp ? FOLLOW_UP_TEMPLATES[t.followUp]?.[state.selectedTone] : null;
        // Pick a follow-up based on the response index (cycles through available follow-ups)
        const followUpTemplate = Array.isArray(followUpTemplates) 
          ? followUpTemplates[index % followUpTemplates.length]
          : followUpTemplates;
        
        return {
          ...t,
          text: processTemplate(t.template, context),
          followUpText: followUpTemplate ? processTemplate(followUpTemplate, context) : null,
        };
      });
      
      dispatch({ type: ACTIONS.SET_RESPONSES, payload: processed });
    }
  }, [state.selectedInquiryType, state.selectedTone, state.selectedCustomer, state.selectedVehicle, state.dealership, state.salesperson, state.preferences, state.customTemplates]);

  // Actions
  const setDealership = (data) => dispatch({ type: ACTIONS.SET_DEALERSHIP, payload: data });
  const setSalesperson = (data) => dispatch({ type: ACTIONS.SET_SALESPERSON, payload: data });
  const setPreferences = (data) => dispatch({ type: ACTIONS.SET_PREFERENCES, payload: data });
  const setSetupComplete = (value) => dispatch({ type: ACTIONS.SET_SETUP_COMPLETE, payload: value });
  const setVehicles = (data) => dispatch({ type: ACTIONS.SET_VEHICLES, payload: data });
  const setCustomers = (data) => dispatch({ type: ACTIONS.SET_CUSTOMERS, payload: data });
  const setCustomTemplates = (data) => dispatch({ type: ACTIONS.SET_CUSTOM_TEMPLATES, payload: data });
  
  const selectCustomer = (customer) => dispatch({ type: ACTIONS.SELECT_CUSTOMER, payload: customer });
  const selectVehicle = (vehicle) => dispatch({ type: ACTIONS.SELECT_VEHICLE, payload: vehicle });
  const selectInquiryType = (type) => dispatch({ type: ACTIONS.SELECT_INQUIRY_TYPE, payload: type });
  const selectTone = (tone) => dispatch({ type: ACTIONS.SELECT_TONE, payload: tone });
  const selectResponse = (response) => dispatch({ type: ACTIONS.SELECT_RESPONSE, payload: response });
  
  const toggleSetup = (value) => dispatch({ type: ACTIONS.TOGGLE_SETUP, payload: value });
  const toggleImport = (value) => dispatch({ type: ACTIONS.TOGGLE_IMPORT, payload: value });
  const toggleTowerTalk = (value) => dispatch({ type: ACTIONS.TOGGLE_TOWER_TALK, payload: value });
  const toggleFavorites = (value) => dispatch({ type: ACTIONS.TOGGLE_FAVORITES, payload: value });
  const toggleVS = (value) => dispatch({ type: ACTIONS.TOGGLE_VS, payload: value });
  const toggleAnalytics = (value) => dispatch({ type: ACTIONS.TOGGLE_ANALYTICS, payload: value });
  const toggleAdminSettings = (value) => dispatch({ type: ACTIONS.TOGGLE_ADMIN_SETTINGS, payload: value });
  
  // Favorites actions
  const addFavorite = (favorite) => {
    const newFavorite = {
      id: Date.now().toString(),
      ...favorite,
      savedAt: new Date().toISOString(),
    };
    dispatch({ type: ACTIONS.ADD_FAVORITE, payload: newFavorite });
    return newFavorite;
  };
  
  const removeFavorite = (id) => dispatch({ type: ACTIONS.REMOVE_FAVORITE, payload: id });
  
  const updateFavoriteCategory = (id, category) => dispatch({ 
    type: ACTIONS.UPDATE_FAVORITE_CATEGORY, 
    payload: { id, category } 
  });

  // Theme & Supercharg'd actions
  const toggleTheme = () => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: ACTIONS.SET_THEME, payload: newTheme });
  };

  const toggleSuperchargedMode = () => {
    dispatch({ type: ACTIONS.SET_SUPERCHARGED, payload: !state.supercharged });
  };

  // Copy to clipboard with enhanced fallback
  const copyToClipboard = async (text) => {
    const result = await copyUtil(text);
    return result.success;
  };

  // Share via Messages with Web Share API fallback
  const shareToMessages = async (text) => {
    const customerPhone = state.selectedCustomer?.phone;
    const customerName = state.selectedCustomer?.name || state.selectedCustomer?.firstName;
    
    const result = await shareMessage(text, customerPhone, customerName);
    return result.success;
  };

  // Direct open Messages app
  const sendToMessages = (text, phone = null) => {
    const targetPhone = phone || state.selectedCustomer?.phone;
    return openMessages(text, targetPhone);
  };

  // Get vehicle by ID
  const getVehicleById = (id) => state.vehicles.find(v => v.id === id);

  const value = {
    ...state,
    setDealership,
    setSalesperson,
    setPreferences,
    setSetupComplete,
    setVehicles,
    setCustomers,
    setCustomTemplates,
    selectCustomer,
    selectVehicle,
    selectInquiryType,
    selectTone,
    selectResponse,
    toggleSetup,
    toggleImport,
    toggleTowerTalk,
    toggleFavorites,
    toggleVS,
    toggleAnalytics,
    toggleAdminSettings,
    addFavorite,
    removeFavorite,
    updateFavoriteCategory,
    copyToClipboard,
    shareToMessages,
    sendToMessages,
    getVehicleById,
    toggleTheme,
    toggleSuperchargedMode,
  };

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
}

// Hook to use the context
export function useSales() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}

export { ACTIONS };
