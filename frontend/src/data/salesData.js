// Core data structures for Closr - iOS-optimized sales weapon

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

// Response tones - the 3 categories
export const RESPONSE_TONES = [
  { 
    id: 'fast_direct', 
    label: 'Fast & Direct', 
    shortLabel: 'Direct',
    description: 'Quick, to-the-point responses',
    color: 'accent',
    icon: 'zap'
  },
  { 
    id: 'balanced', 
    label: 'Balanced', 
    shortLabel: 'Balanced',
    description: 'Conversational, relationship-building',
    color: 'primary',
    icon: 'users'
  },
  { 
    id: 'soft_touch', 
    label: 'Soft Touch', 
    shortLabel: 'Soft',
    description: 'Gentle, appointment-focused',
    color: 'success',
    icon: 'heart'
  },
];

// Appointment phrasing options
export const APPOINTMENT_PHRASES = [
  { id: 'come_in', label: 'come in', full: 'come in and see it in person' },
  { id: 'stop_by', label: 'stop by', full: 'stop by whenever works for you' },
  { id: 'set_time', label: "let's set a time", full: "let's set a time that works best for you" },
];

// Salesperson style options
export const SALESPERSON_STYLES = [
  { id: 'straight_shooter', label: 'Straight Shooter', description: 'Direct and honest' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and personable' },
  { id: 'professional', label: 'Professional', description: 'Polished and formal' },
];

// Follow-up timing rules (static)
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
  // Customer tokens
  '{name}': 'Customer first name',
  '{full_name}': 'Customer full name',
  
  // Vehicle tokens
  '{vehicle}': 'Vehicle (Year Make Model)',
  '{year}': 'Vehicle year',
  '{make}': 'Vehicle make',
  '{model}': 'Vehicle model',
  '{trim}': 'Vehicle trim',
  '{price}': 'Vehicle price (formatted)',
  '{stock}': 'Stock number',
  
  // Deal tokens
  '{trade_vehicle}': 'Trade-in vehicle',
  '{trade_value}': 'Trade-in value',
  '{payment}': 'Monthly payment estimate',
  '{down_payment}': 'Down payment amount',
  
  // Dealership tokens
  '{dealership}': 'Dealership name',
  '{dealership_address}': 'Dealership address',
  '{dealership_hours}': 'Dealership hours',
  '{appointment_phrase}': 'Appointment phrasing',
  
  // Salesperson tokens
  '{salesperson}': 'Salesperson name',
  '{salesperson_title}': 'Salesperson title',
  '{sign_off}': 'Sign-off phrase',
};

// Default response templates organized by inquiry type and tone
export const DEFAULT_TEMPLATES = {
  new_lead: {
    fast_direct: [
      {
        id: 'new_lead_direct_1',
        template: "Hi {name}, the {vehicle} is available at {price}. Ready to see it? I can have it pulled up front. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'new_lead_direct_2', 
        template: "{name}, got your inquiry on the {vehicle}. It's here and priced right at {price}. When works for you? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'new_lead_balanced_1',
        template: "Hi {name}! Thanks for reaching out about the {vehicle}. Great choice - it's one of our most popular models. I'd love to tell you more about it. Would you like to {appointment_phrase}? We're open {dealership_hours}. - {salesperson}, {dealership}",
        followUp: 'same_day',
      },
      {
        id: 'new_lead_balanced_2',
        template: "Hey {name}, I saw you were checking out the {vehicle}! I think you'll really like it in person. I'm here at {dealership} and happy to answer any questions. What's your schedule looking like? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'new_lead_soft_1',
        template: "Hi {name}, thank you for your interest in the {vehicle}. I'd love to help you find the perfect fit for your needs. No pressure at all - whenever you're ready, I'm here to help. Feel free to reach out anytime! - {salesperson} at {dealership}",
        followUp: 'next_day',
      },
      {
        id: 'new_lead_soft_2',
        template: "Hello {name}! I noticed you were looking at the {vehicle}. Beautiful choice. I'm {salesperson} and I'd be happy to help whenever the time is right for you. No rush - just wanted to introduce myself and let you know I'm here. Have a great day!",
        followUp: 'next_day',
      },
    ],
  },
  
  price_question: {
    fast_direct: [
      {
        id: 'price_direct_1',
        template: "{name}, the {vehicle} is {price} out the door. That includes everything. Want me to run numbers on a payment? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'price_balanced_1',
        template: "Hi {name}! The {vehicle} is listed at {price}, but let's talk - I want to make sure we get you into the right vehicle at the right price. We've got some great options. Can you {appointment_phrase}? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'price_soft_1',
        template: "Hi {name}, great question about pricing! The {vehicle} is currently {price}. I know budget is important, and I'm here to help you find the best value. Would you like to discuss some options? No obligation at all. - {salesperson}",
        followUp: 'next_day',
      },
    ],
  },

  availability: {
    fast_direct: [
      {
        id: 'avail_direct_1',
        template: "{name}, yes - the {vehicle} is here on the lot right now. I can hold it for you today. When can you come see it? - {salesperson}",
        followUp: 'immediate',
      },
    ],
    balanced: [
      {
        id: 'avail_balanced_1',
        template: "Good news {name}! The {vehicle} is available and looking great. I just checked it out myself. Would you like to {appointment_phrase} and take it for a spin? - {salesperson} at {dealership}",
        followUp: '2_hours',
      },
    ],
    soft_touch: [
      {
        id: 'avail_soft_1',
        template: "Hi {name}! I'm happy to confirm the {vehicle} is available for you to see. It's a popular one, but no pressure - just wanted to let you know it's here whenever you're ready. Feel free to reach out with any questions! - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },

  trade_in: {
    fast_direct: [
      {
        id: 'trade_direct_1',
        template: "{name}, I can get you a trade value on your {trade_vehicle} in 10 minutes. Swing by or send me some pics and I'll get you a number. - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'trade_balanced_1',
        template: "Hi {name}! I'd be happy to look at your {trade_vehicle} for trade. The market's been good for those lately. Can you {appointment_phrase}? I'll give you a fair, no-obligation number. - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'trade_soft_1',
        template: "Hi {name}, trading in your {trade_vehicle} is a great way to get into something new. I'd love to help you understand your options - no commitment needed. Would you like to chat about it? - {salesperson} at {dealership}",
        followUp: 'next_day',
      },
    ],
  },

  financing: {
    fast_direct: [
      {
        id: 'finance_direct_1',
        template: "{name}, let's get you pre-approved. Takes 5 minutes and doesn't affect your credit. Then we'll know exactly what you're working with. Ready? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'finance_balanced_1',
        template: "Hi {name}! Great thinking on financing. We work with multiple lenders to find the best rates. I can get you some numbers on the {vehicle} if you'd like - no obligation. What works for you? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'finance_soft_1',
        template: "Hi {name}, financing is one of the most important parts of the process, and I'm here to help make it easy. Whenever you're ready, I'd be happy to go over your options together. No pressure at all. - {salesperson}",
        followUp: 'next_day',
      },
    ],
  },

  test_drive: {
    fast_direct: [
      {
        id: 'test_direct_1',
        template: "{name}, the {vehicle} is gassed up and ready. I'll have it pulled around for you. What time works? - {salesperson}",
        followUp: 'immediate',
      },
    ],
    balanced: [
      {
        id: 'test_balanced_1',
        template: "Hey {name}! You're going to love driving the {vehicle}. There's nothing like getting behind the wheel. I'm available today - would you like to {appointment_phrase}? - {salesperson} at {dealership}",
        followUp: '2_hours',
      },
    ],
    soft_touch: [
      {
        id: 'test_soft_1',
        template: "Hi {name}! A test drive is always a great idea - it really helps you feel if the {vehicle} is right for you. Whenever you're ready, just let me know and I'll have everything prepared. No rush! - {salesperson}",
        followUp: 'same_day',
      },
    ],
  },

  follow_up: {
    fast_direct: [
      {
        id: 'followup_direct_1',
        template: "{name}, checking in on the {vehicle}. Still available - ready when you are. - {salesperson}",
        followUp: '3_days',
      },
    ],
    balanced: [
      {
        id: 'followup_balanced_1',
        template: "Hi {name}! Just wanted to follow up on our conversation about the {vehicle}. Have you had any more thoughts? I'm here if you have questions! - {salesperson}",
        followUp: '3_days',
      },
    ],
    soft_touch: [
      {
        id: 'followup_soft_1',
        template: "Hi {name}, I hope you're doing well! Just reaching out to see if there's anything I can help with regarding the {vehicle}. No pressure - I just wanted to make sure you have everything you need. Have a great day! - {salesperson}",
        followUp: '1_week',
      },
    ],
  },

  objection: {
    fast_direct: [
      {
        id: 'obj_direct_1',
        template: "{name}, I hear you. Let's fix that. What would make this work for you? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'obj_balanced_1',
        template: "I totally understand, {name}. That's a fair point. Let me see what I can do to address that for you. Can we chat for a few minutes? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'obj_soft_1',
        template: "Hi {name}, I completely understand your concerns - they're totally valid. I want you to feel 100% comfortable with any decision. Would it help to talk through some options? No pressure at all. - {salesperson}",
        followUp: 'next_day',
      },
    ],
  },
};

// Default follow-up templates
export const FOLLOW_UP_TEMPLATES = {
  '2_hours': {
    fast_direct: "{name}, just following up - the {vehicle} is still here. Let me know! - {salesperson}",
    balanced: "Hey {name}! Just wanted to make sure you got my message about the {vehicle}. Any questions I can answer? - {salesperson}",
    soft_touch: "Hi {name}! I hope I'm not bothering you - just wanted to make sure you have everything you need. I'm here if you'd like to chat! - {salesperson}",
  },
  'same_day': {
    fast_direct: "{name}, checking in before end of day on the {vehicle}. Ready when you are. - {salesperson}",
    balanced: "Hi {name}! As the day wraps up, I wanted to check if you had any thoughts on the {vehicle}. Would love to help! - {salesperson}",
    soft_touch: "Good evening {name}! Just a gentle reminder that I'm here whenever you're ready to discuss the {vehicle}. Have a wonderful night! - {salesperson}",
  },
  'next_day': {
    fast_direct: "{name}, the {vehicle} made it through the night - still here for you. - {salesperson}",
    balanced: "Good morning {name}! Hope you had a great night. Wanted to touch base about the {vehicle}. What's on your mind? - {salesperson}",
    soft_touch: "Good morning {name}! I hope you're having a great day so far. Just wanted to check in and see if there's anything I can help with. No rush at all! - {salesperson}",
  },
  '3_days': {
    fast_direct: "{name}, the {vehicle} is going to move soon. Just giving you a heads up. - {salesperson}",
    balanced: "Hey {name}! It's been a few days - wanted to see how you're doing and if you're still thinking about the {vehicle}. I'm here to help! - {salesperson}",
    soft_touch: "Hi {name}! I hope your week is going well. Just wanted to gently follow up and see if there's anything I can help you with. As always, no pressure! - {salesperson}",
  },
  '1_week': {
    fast_direct: "{name}, week later - {vehicle} update: it's here or it's gone. Want to check? - {salesperson}",
    balanced: "Hi {name}! It's been about a week - just wanted to check in and see how things are going. If the {vehicle} is still on your radar, I'd love to chat! - {salesperson}",
    soft_touch: "Hello {name}! I hope everything is going wonderfully for you. I just wanted to reach out and let you know I'm still here if you ever want to revisit our conversation about the {vehicle}. Take care! - {salesperson}",
  },
};

// Local storage keys
export const STORAGE_KEYS = {
  DEALERSHIP_SETUP: 'closr_dealership',
  SALESPERSON_SETUP: 'closr_salesperson',
  USER_PREFERENCES: 'closr_preferences',
  CUSTOM_TEMPLATES: 'closr_templates',
  VEHICLES: 'closr_vehicles',
  CUSTOMERS: 'closr_customers',
  CONVERSATION_HISTORY: 'closr_history',
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
  
  // Replace all tokens
  Object.entries(context).forEach(([key, value]) => {
    const token = key.startsWith('{') ? key : `{${key}}`;
    const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, value || '');
  });
  
  // Clean up any unreplaced tokens
  result = result.replace(/\{[^}]+\}/g, '');
  
  return result.trim();
};

// Build context object from current state
export const buildContext = (customer, vehicle, dealership, salesperson, preferences) => {
  return {
    // Customer
    name: customer?.firstName || customer?.name?.split(' ')[0] || '',
    full_name: customer?.name || '',
    
    // Vehicle
    vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
    year: vehicle?.year || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    trim: vehicle?.trim || '',
    price: vehicle?.price ? `$${vehicle.price.toLocaleString()}` : '',
    stock: vehicle?.stock || '',
    
    // Trade
    trade_vehicle: customer?.tradeVehicle ? 
      `${customer.tradeVehicle.year} ${customer.tradeVehicle.make} ${customer.tradeVehicle.model}` : '',
    trade_value: customer?.tradeVehicle?.value ? 
      `$${customer.tradeVehicle.value.toLocaleString()}` : '',
    
    // Dealership
    dealership: dealership?.name || '',
    dealership_address: dealership?.address || '',
    dealership_hours: dealership?.hours || '',
    appointment_phrase: APPOINTMENT_PHRASES.find(p => p.id === dealership?.appointmentPhrase)?.full || 'come in',
    
    // Salesperson
    salesperson: salesperson?.name || '',
    salesperson_title: salesperson?.title || '',
    sign_off: preferences?.signOff || salesperson?.name || '',
  };
};

// Get responses for a given inquiry type and tone
export const getResponses = (inquiryType, tone, customTemplates = {}) => {
  const templates = customTemplates[inquiryType]?.[tone] || DEFAULT_TEMPLATES[inquiryType]?.[tone] || [];
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
  style: 'friendly',
};

export const DEFAULT_PREFERENCES = {
  defaultTone: 'balanced',
  signOff: '',
};
