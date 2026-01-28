// Core data structures for Supercharg'd - iOS-optimized sales weapon
// TRUSTED AUTHORITY APPROACH: Direct, calm, controlled, focused on digital-to-in-person conversion

// Inquiry types for context-based responses
export const INQUIRY_TYPES = [
  { id: 'new_lead', label: 'New Lead', icon: 'star' },
  { id: 'price_question', label: 'Price Question', icon: 'dollar-sign' },
  { id: 'availability', label: 'Availability', icon: 'calendar' },
  { id: 'trade_in', label: 'Trade-In', icon: 'repeat' },
  { id: 'financing', label: 'Financing', icon: 'credit-card' },
  { id: 'test_drive', label: 'Test Drive', icon: 'car' },
  { id: 'follow_up', label: 'Follow Up', icon: 'clock' },
  { id: 'objection', label: 'Objection', icon: 'message-circle' },
];

// Appointment phrasing options
export const APPOINTMENT_PHRASES = [
  { id: 'come_in', label: 'come in', full: 'come in and see it in person' },
  { id: 'stop_by', label: 'stop by', full: 'stop by whenever works for you' },
  { id: 'set_time', label: "let's set a time", full: "let's set a time that works best for you" },
];

// Salesperson style options (kept for backward compatibility, but not used in UI)
export const SALESPERSON_STYLES = [
  { id: 'authority', label: 'Authority', description: 'Trusted expert, direct and calm' },
];

// Response tones - kept for backward compatibility
export const RESPONSE_TONES = [
  { 
    id: 'authority', 
    label: 'Authority', 
    shortLabel: 'Authority',
    description: 'Direct, calm, controlled - drives to in-person',
    color: 'primary',
    icon: 'shield'
  },
];

// Follow-up timing rules
export const FOLLOW_UP_RULES = [
  { id: 'immediate', label: 'Immediate', delay: '0', description: 'Send right away' },
  { id: '2_hours', label: '2 Hours', delay: '2h', description: 'Quick follow-up' },
  { id: 'same_day', label: 'Same Day', delay: '6h', description: 'End of day touch' },
  { id: 'next_day', label: 'Next Day', delay: '24h', description: 'Morning follow-up' },
  { id: '3_days', label: '3 Days', delay: '72h', description: 'Gentle reminder' },
  { id: '1_week', label: '1 Week', delay: '168h', description: 'Check back in' },
];

// Template tokens available for replacement
export const TEMPLATE_TOKENS = {
  '{name}': 'Customer first name',
  '{full_name}': 'Customer full name',
  '{vehicle}': 'Vehicle (Year Make Model)',
  '{year}': 'Vehicle year',
  '{make}': 'Vehicle make',
  '{model}': 'Vehicle model',
  '{trim}': 'Vehicle trim',
  '{price}': 'Vehicle price (formatted)',
  '{stock}': 'Stock number',
  '{trade_vehicle}': 'Trade-in vehicle',
  '{trade_value}': 'Trade-in value',
  '{payment}': 'Monthly payment estimate',
  '{down_payment}': 'Down payment amount',
  '{dealership}': 'Dealership name',
  '{dealership_address}': 'Dealership address',
  '{dealership_hours}': 'Dealership hours',
  '{appointment_phrase}': 'Appointment phrasing',
  '{salesperson}': 'Salesperson name',
  '{salesperson_title}': 'Salesperson title',
  '{sign_off}': 'Sign-off phrase',
};

// Default response templates - TRUSTED AUTHORITY APPROACH
// Direct, calm, controlled. Every response drives toward in-person meeting.
// 2 responses per inquiry type.
export const DEFAULT_TEMPLATES = {
  new_lead: {
    authority: [
      {
        id: 'new_lead_auth_1',
        template: "{name}, I have the {vehicle} here and it's a solid choice. I've seen a lot of these go to happy owners. When can you come take a look? I'm here until 7. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'new_lead_auth_2',
        template: "Hi {name}. The {vehicle} you inquired about is available. It's one of the better examples we've had on the lot. Worth seeing in person - numbers always make more sense when you're here. When works for you? - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },
  
  price_question: {
    authority: [
      {
        id: 'price_auth_1',
        template: "{name}, the {vehicle} is {price}. Happy to walk you through everything that includes when you come in. Seeing it in person is really the best way to understand the value. When's good? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'price_auth_2',
        template: "{name} - it's {price} for the {vehicle}. Price is one part of the equation. I can show you exactly what you're getting when you're here. We usually find a way to make things work. What's your schedule like? - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },

  availability: {
    authority: [
      {
        id: 'avail_auth_1',
        template: "{name}, yes - the {vehicle} is here and available. I'd grab it soon if you're serious. These don't sit long. Can you come by today or tomorrow? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'avail_auth_2',
        template: "The {vehicle} is on the lot, {name}. I've got it cleaned up and ready. Worth the trip to see it in person - photos don't do it justice. I'm here until 8 tonight. - {salesperson}",
        followUp: '2_hours',
      },
    ],
  },

  trade_in: {
    authority: [
      {
        id: 'trade_auth_1',
        template: "{name}, I can give you a solid number on the {trade_vehicle} when you bring it in. I've seen the market on these and I'll be straight with you. When can you come by? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'trade_auth_2',
        template: "Absolutely can work with your trade, {name}. The {trade_vehicle} holds good value in this market. Let's get eyes on it and get you real numbers. When are you free? - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },

  financing: {
    authority: [
      {
        id: 'finance_auth_1',
        template: "{name}, we work with over a dozen lenders and I've gotten approvals for all kinds of situations. Let's get you in here and find the right option. Takes about 15 minutes. When works? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'finance_auth_2',
        template: "{name} - financing is the easy part. I've got options from 0% to flexible terms depending on what makes sense for you. Come in and we'll lay it all out. What's good for your schedule? - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },

  test_drive: {
    authority: [
      {
        id: 'test_auth_1',
        template: "{name}, absolutely - that's the only way to know if it's right for you. I'll have the {vehicle} pulled up and ready. What time works? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'test_auth_2',
        template: "Let's do it, {name}. The {vehicle} drives as good as it looks. I'll have it warmed up for you. Can you make it in today? - {salesperson}",
        followUp: '2_hours',
      },
    ],
  },

  follow_up: {
    authority: [
      {
        id: 'follow_auth_1',
        template: "{name}, just checking in on the {vehicle}. It's still available but I wanted to make sure you're not missing out. Let me know if you have questions - or better yet, come see it. - {salesperson}",
        followUp: '3_days',
      },
      {
        id: 'follow_auth_2',
        template: "Hi {name} - circling back on the {vehicle}. Still thinking about it? I'm here when you're ready. Sometimes it helps to just come in and see it again. No pressure. - {salesperson}",
        followUp: '3_days',
      },
    ],
  },

  objection: {
    authority: [
      {
        id: 'objection_auth_1',
        template: "{name}, I hear you. Let's talk it through when you come in - I've helped a lot of people work through the same concerns. Usually there's a path forward. When can you stop by? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'objection_auth_2',
        template: "Totally understand, {name}. Look - I'm not going to push. But let me show you a few things in person that might change how you're thinking about it. Worth 20 minutes of your time. When's good? - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },
};

// Follow-up message templates (authority approach)
export const FOLLOW_UP_TEMPLATES = {
  '2_hours': {
    authority: [
      "Just following up, {name}. The {vehicle} is still here. Let me know when you can come take a look. - {salesperson}",
      "Hey {name} - wanted to make sure you got my message about the {vehicle}. I'm here if you have questions. - {salesperson}",
    ],
  },
  'same_day': {
    authority: [
      "Hi {name}, ending the day and wanted to check in. The {vehicle} is ready whenever you are. Tomorrow work? - {salesperson}",
      "{name} - quick follow up. Still interested in the {vehicle}? I can set aside time for you tomorrow. - {salesperson}",
    ],
  },
  'next_day': {
    authority: [
      "Morning {name}. The {vehicle} is still available. Let me know if today works to come see it. - {salesperson}",
      "Hi {name}, checking in on the {vehicle}. What's your schedule looking like this week? - {salesperson}",
    ],
  },
  '3_days': {
    authority: [
      "{name}, the {vehicle} is still here. Just wanted to make sure it's on your radar before someone else grabs it. - {salesperson}",
      "Hey {name} - few days have passed. Still thinking about the {vehicle}? I can answer any questions. - {salesperson}",
    ],
  },
  '1_week': {
    authority: [
      "{name}, it's been a week. The {vehicle} is still available if you're still interested. No pressure - just keeping you posted. - {salesperson}",
      "Hi {name}, circling back. The {vehicle} is here when you're ready. Let me know if anything's changed. - {salesperson}",
    ],
  },
};

// Storage keys
export const STORAGE_KEYS = {
  DEALERSHIP_SETUP: 'closr_dealership',
  SALESPERSON_SETUP: 'closr_salesperson',
  USER_PREFERENCES: 'closr_preferences',
  VEHICLES: 'closr_vehicles',
  CUSTOMERS: 'closr_customers',
  CUSTOM_TEMPLATES: 'closr_templates',
  FAVORITES: 'closr_favorites',
};

// Save to local storage
export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save to storage:', e);
    return false;
  }
};

// Load from local storage
export const loadFromStorage = (key, defaultValue = null) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error('Failed to load from storage:', e);
    return defaultValue;
  }
};

// Template engine - replace tokens with actual values
export const processTemplate = (template, context) => {
  let result = template;
  
  Object.entries(context).forEach(([key, value]) => {
    const token = key.startsWith('{') ? key : `{${key}}`;
    const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, value || '');
  });
  
  result = result.replace(/\{[^}]+\}/g, '');
  
  return result.trim();
};

// Build context object from current state
export const buildContext = (customer, vehicle, dealership, salesperson, preferences) => {
  return {
    name: customer?.firstName || customer?.name?.split(' ')[0] || '',
    full_name: customer?.name || '',
    vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
    year: vehicle?.year || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    trim: vehicle?.trim || '',
    price: vehicle?.price ? `$${vehicle.price.toLocaleString()}` : '',
    stock: vehicle?.stock || '',
    trade_vehicle: customer?.tradeVehicle ? 
      `${customer.tradeVehicle.year} ${customer.tradeVehicle.make} ${customer.tradeVehicle.model}` : '',
    trade_value: customer?.tradeVehicle?.value ? 
      `$${customer.tradeVehicle.value.toLocaleString()}` : '',
    dealership: dealership?.name || '',
    dealership_address: dealership?.address || '',
    dealership_hours: dealership?.hours || '',
    appointment_phrase: APPOINTMENT_PHRASES.find(p => p.id === dealership?.appointmentPhrase)?.full || 'come in',
    salesperson: salesperson?.name || '',
    salesperson_title: salesperson?.title || '',
    sign_off: preferences?.signOff || salesperson?.name || '',
  };
};

// Get responses for a given inquiry type - always returns authority templates
export const getResponses = (inquiryType, tone, customTemplates = {}) => {
  // Always use 'authority' templates regardless of tone passed
  const templates = customTemplates[inquiryType]?.authority || DEFAULT_TEMPLATES[inquiryType]?.authority || [];
  return templates;
};

// Default sample data
export const DEFAULT_VEHICLES = [
  { id: 'v1', year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', price: 32490, stock: 'H1234' },
  { id: 'v2', year: 2024, make: 'Toyota', model: 'Camry', trim: 'XLE', price: 35070, stock: 'T5678' },
  { id: 'v3', year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', price: 49995, stock: 'F9012' },
  { id: 'v4', year: 2024, make: 'Chevrolet', model: 'Equinox', trim: 'LT', price: 33100, stock: 'C3456' },
  { id: 'v5', year: 2024, make: 'BMW', model: 'X3', trim: 'xDrive30i', price: 48900, stock: 'B7890' },
];

export const DEFAULT_CUSTOMERS = [
  {
    id: 'c1',
    name: 'Alex Martinez',
    firstName: 'Alex',
    phone: '(555) 123-4567',
    email: 'alex.m@email.com',
    vehicleInterest: 'v5',
    tradeVehicle: { year: 2019, make: 'BMW', model: 'X1', value: 18500 },
    lastContact: '2 hours ago',
    status: 'hot',
  },
  {
    id: 'c2',
    name: 'Sarah Johnson',
    firstName: 'Sarah',
    phone: '(555) 234-5678',
    email: 'sarah.j@email.com',
    vehicleInterest: 'v1',
    tradeVehicle: null,
    lastContact: 'Yesterday',
    status: 'warm',
  },
  {
    id: 'c3',
    name: 'Michael Chen',
    firstName: 'Michael',
    phone: '(555) 345-6789',
    email: 'mchen@email.com',
    vehicleInterest: 'v3',
    tradeVehicle: { year: 2018, make: 'Ford', model: 'F-150', value: 24000 },
    lastContact: '3 days ago',
    status: 'warm',
  },
];

export const DEFAULT_DEALERSHIP = {
  name: 'AutoMax Dealership',
  address: '1234 Auto Drive, City, ST 12345',
  hours: 'Mon-Sat 9AM-8PM, Sun 11AM-6PM',
  appointmentPhrase: 'come_in',
};

export const DEFAULT_SALESPERSON = {
  name: 'Sales Rep',
  title: '',
  style: 'authority',
};

export const DEFAULT_PREFERENCES = {
  defaultTone: 'authority',
  signOff: '',
};
