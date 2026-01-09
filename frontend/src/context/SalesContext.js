import React, { createContext, useContext, useReducer, useEffect } from 'react';
import {
  defaultObjectionTypes,
  defaultResponses,
  defaultVehicles,
  defaultProspects,
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
} from '../data/salesData';

// Initial state
const initialState = {
  objectionTypes: defaultObjectionTypes,
  responses: defaultResponses,
  vehicles: defaultVehicles,
  prospects: defaultProspects,
  selectedProspect: null,
  selectedObjection: null,
  selectedResponse: null,
  searchQuery: '',
  isOffline: !navigator.onLine,
  settings: {
    dealershipName: 'AutoMax Dealership',
    repName: 'Sales Rep',
    defaultTerm: 60,
    defaultDownPayment: 10,
  },
};

// Action types
const ACTIONS = {
  SET_PROSPECT: 'SET_PROSPECT',
  SET_OBJECTION: 'SET_OBJECTION',
  SET_RESPONSE: 'SET_RESPONSE',
  SET_SEARCH: 'SET_SEARCH',
  UPDATE_PROSPECT: 'UPDATE_PROSPECT',
  ADD_PROSPECT: 'ADD_PROSPECT',
  SET_OFFLINE: 'SET_OFFLINE',
  LOAD_CUSTOM_DATA: 'LOAD_CUSTOM_DATA',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  IMPORT_RESPONSES: 'IMPORT_RESPONSES',
  IMPORT_VEHICLES: 'IMPORT_VEHICLES',
};

// Reducer
function salesReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_PROSPECT:
      return { ...state, selectedProspect: action.payload, selectedObjection: null, selectedResponse: null };
    case ACTIONS.SET_OBJECTION:
      return { ...state, selectedObjection: action.payload, selectedResponse: null };
    case ACTIONS.SET_RESPONSE:
      return { ...state, selectedResponse: action.payload };
    case ACTIONS.SET_SEARCH:
      return { ...state, searchQuery: action.payload };
    case ACTIONS.UPDATE_PROSPECT:
      const updatedProspects = state.prospects.map(p =>
        p.id === action.payload.id ? { ...p, ...action.payload } : p
      );
      saveToStorage(STORAGE_KEYS.PROSPECTS, updatedProspects);
      return { ...state, prospects: updatedProspects };
    case ACTIONS.ADD_PROSPECT:
      const newProspects = [...state.prospects, action.payload];
      saveToStorage(STORAGE_KEYS.PROSPECTS, newProspects);
      return { ...state, prospects: newProspects };
    case ACTIONS.SET_OFFLINE:
      return { ...state, isOffline: action.payload };
    case ACTIONS.LOAD_CUSTOM_DATA:
      return { ...state, ...action.payload };
    case ACTIONS.UPDATE_SETTINGS:
      const newSettings = { ...state.settings, ...action.payload };
      saveToStorage(STORAGE_KEYS.SETTINGS, newSettings);
      return { ...state, settings: newSettings };
    case ACTIONS.IMPORT_RESPONSES:
      const mergedResponses = { ...state.responses, ...action.payload };
      saveToStorage(STORAGE_KEYS.CUSTOM_RESPONSES, mergedResponses);
      return { ...state, responses: mergedResponses };
    case ACTIONS.IMPORT_VEHICLES:
      saveToStorage(STORAGE_KEYS.CUSTOM_VEHICLES, action.payload);
      return { ...state, vehicles: action.payload };
    default:
      return state;
  }
}

// Context
const SalesContext = createContext(null);

// Provider component
export function SalesProvider({ children }) {
  const [state, dispatch] = useReducer(salesReducer, initialState);

  // Load custom data from storage on mount
  useEffect(() => {
    const customResponses = loadFromStorage(STORAGE_KEYS.CUSTOM_RESPONSES);
    const customVehicles = loadFromStorage(STORAGE_KEYS.CUSTOM_VEHICLES);
    const savedProspects = loadFromStorage(STORAGE_KEYS.PROSPECTS);
    const savedSettings = loadFromStorage(STORAGE_KEYS.SETTINGS);

    const loadedData = {};
    if (customResponses) loadedData.responses = { ...defaultResponses, ...customResponses };
    if (customVehicles) loadedData.vehicles = customVehicles;
    if (savedProspects) loadedData.prospects = savedProspects;
    if (savedSettings) loadedData.settings = { ...initialState.settings, ...savedSettings };

    if (Object.keys(loadedData).length > 0) {
      dispatch({ type: ACTIONS.LOAD_CUSTOM_DATA, payload: loadedData });
    }
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

  // Actions
  const selectProspect = (prospect) => {
    dispatch({ type: ACTIONS.SET_PROSPECT, payload: prospect });
  };

  const selectObjection = (objection) => {
    dispatch({ type: ACTIONS.SET_OBJECTION, payload: objection });
  };

  const selectResponse = (response) => {
    dispatch({ type: ACTIONS.SET_RESPONSE, payload: response });
  };

  const setSearch = (query) => {
    dispatch({ type: ACTIONS.SET_SEARCH, payload: query });
  };

  const updateProspect = (prospectData) => {
    dispatch({ type: ACTIONS.UPDATE_PROSPECT, payload: prospectData });
  };

  const addProspect = (prospect) => {
    const newProspect = {
      ...prospect,
      id: `p${Date.now()}`,
      lastContact: 'Just now',
      objections: [],
    };
    dispatch({ type: ACTIONS.ADD_PROSPECT, payload: newProspect });
    return newProspect;
  };

  const updateSettings = (settings) => {
    dispatch({ type: ACTIONS.UPDATE_SETTINGS, payload: settings });
  };

  const importResponses = (responses) => {
    dispatch({ type: ACTIONS.IMPORT_RESPONSES, payload: responses });
  };

  const importVehicles = (vehicles) => {
    dispatch({ type: ACTIONS.IMPORT_VEHICLES, payload: vehicles });
  };

  const getVehicleById = (vehicleId) => {
    return state.vehicles.find(v => v.id === vehicleId);
  };

  const getResponsesForObjection = (objectionId) => {
    return state.responses[objectionId] || [];
  };

  const value = {
    ...state,
    selectProspect,
    selectObjection,
    selectResponse,
    setSearch,
    updateProspect,
    addProspect,
    updateSettings,
    importResponses,
    importVehicles,
    getVehicleById,
    getResponsesForObjection,
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
