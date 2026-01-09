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

// Default response templates - 3 responses per inquiry type per tone
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
      {
        id: 'new_lead_direct_3',
        template: "{name} - {vehicle}, {price}, available now. I'm free today if you want to see it. - {salesperson}",
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
      {
        id: 'new_lead_balanced_3',
        template: "Hi {name}! Great taste - the {vehicle} is a fantastic choice. I've helped a lot of people find their perfect fit with this one. Would love to chat more about what you're looking for. Any time work for you this week? - {salesperson}",
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
      {
        id: 'new_lead_soft_3',
        template: "Hi {name}, thanks for considering {dealership} for your car search! The {vehicle} is a wonderful option. I'm here if you have any questions at all - no obligation, just happy to help. Take your time and reach out whenever feels right. - {salesperson}",
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
      {
        id: 'price_direct_2',
        template: "{name} - {price} for the {vehicle}. That's our best price. I can also look at payment options if that helps. Let me know. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'price_direct_3',
        template: "The {vehicle} is {price}. Happy to break down the numbers or get you pre-qualified in 5 minutes. Which works better, {name}? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'price_balanced_1',
        template: "Hi {name}! The {vehicle} is listed at {price}, but let's talk - I want to make sure we get you into the right vehicle at the right price. We've got some great options. Can you {appointment_phrase}? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'price_balanced_2',
        template: "Hey {name}, great question! The {vehicle} comes in at {price}. There might be some incentives we can apply too. Would you like to go over everything together? I'm here to help find what works best for your budget. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'price_balanced_3',
        template: "Hi {name}! So the {vehicle} is {price}, but pricing is just one piece of the puzzle. Let me show you the full picture - value, features, and how we can make it work for you. When's a good time to chat? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'price_soft_1',
        template: "Hi {name}, great question about pricing! The {vehicle} is currently {price}. I know budget is important, and I'm here to help you find the best value. Would you like to discuss some options? No obligation at all. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'price_soft_2',
        template: "Hello {name}! Thanks for asking about the {vehicle}. It's priced at {price} right now. I'd be happy to walk you through everything included and explore what options might work for your situation. No pressure - just here to help! - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'price_soft_3',
        template: "Hi {name}, the {vehicle} is {price}. I know that's a big decision, and I want to make sure you feel completely comfortable. Happy to answer any questions or just chat about what you're looking for. Whenever you're ready! - {salesperson}",
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
      {
        id: 'avail_direct_2',
        template: "{name}, it's available. I'm looking at it right now. This one won't last - when can you get here? - {salesperson}",
        followUp: 'immediate',
      },
      {
        id: 'avail_direct_3',
        template: "Good news {name} - the {vehicle} is here and ready. I can have it cleaned and gassed up whenever you want to see it. Today work? - {salesperson}",
        followUp: 'immediate',
      },
    ],
    balanced: [
      {
        id: 'avail_balanced_1',
        template: "Good news {name}! The {vehicle} is available and looking great. I just checked it out myself. Would you like to {appointment_phrase} and take it for a spin? - {salesperson} at {dealership}",
        followUp: '2_hours',
      },
      {
        id: 'avail_balanced_2',
        template: "Hey {name}, yes the {vehicle} is still here! It's been getting some attention though. I'd love to show it to you in person - when works for you? We're open {dealership_hours}. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'avail_balanced_3',
        template: "Hi {name}! Great timing - the {vehicle} is definitely available. I think you'll love it in person. Can I set up a time for you to come check it out? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    soft_touch: [
      {
        id: 'avail_soft_1',
        template: "Hi {name}! I'm happy to confirm the {vehicle} is available for you to see. It's a popular one, but no pressure - just wanted to let you know it's here whenever you're ready. Feel free to reach out with any questions! - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'avail_soft_2',
        template: "Hello {name}! Yes, the {vehicle} is available. I know timing is everything, so just wanted to let you know it's here if and when you'd like to see it. No rush at all - I'm here whenever you're ready. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'avail_soft_3',
        template: "Hi {name}, good news - the {vehicle} is still available! Just wanted to give you a heads up in case you were thinking about it. Take your time, and let me know if you'd like to know anything more about it. - {salesperson}",
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
      {
        id: 'trade_direct_2',
        template: "{name}, let's get your {trade_vehicle} appraised. Bring it by or text me photos - I'll have a number for you same day. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'trade_direct_3',
        template: "I can value your {trade_vehicle} today, {name}. Quick and easy - no obligation. When works for you? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'trade_balanced_1',
        template: "Hi {name}! I'd be happy to look at your {trade_vehicle} for trade. The market's been good for those lately. Can you {appointment_phrase}? I'll give you a fair, no-obligation number. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'trade_balanced_2',
        template: "Hey {name}, great idea to trade in your {trade_vehicle}! I can get you a competitive offer. Want to bring it by so I can take a look? Or send me some details and I'll give you a ballpark. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'trade_balanced_3',
        template: "Hi {name}! Your {trade_vehicle} could definitely help get you into the {vehicle}. I'd love to take a look and see what we can do. When's a good time for you to stop by? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'trade_soft_1',
        template: "Hi {name}, trading in your {trade_vehicle} is a great way to get into something new. I'd love to help you understand your options - no commitment needed. Would you like to chat about it? - {salesperson} at {dealership}",
        followUp: 'next_day',
      },
      {
        id: 'trade_soft_2',
        template: "Hello {name}! I'd be happy to give you an honest assessment of your {trade_vehicle} whenever you're ready. No pressure to do anything - just here to help you explore your options. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'trade_soft_3',
        template: "Hi {name}, curious about what your {trade_vehicle} might be worth? I'm happy to help you figure that out with no strings attached. Just let me know when you'd like to chat! - {salesperson}",
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
      {
        id: 'finance_direct_2',
        template: "{name}, I can get you financing numbers in minutes. Quick app, no commitment. Want me to send you the link? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'finance_direct_3',
        template: "Let's figure out your payment, {name}. I work with multiple lenders - we'll find you the best rate. 5 minutes is all I need. - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'finance_balanced_1',
        template: "Hi {name}! Great thinking on financing. We work with multiple lenders to find the best rates. I can get you some numbers on the {vehicle} if you'd like - no obligation. What works for you? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'finance_balanced_2',
        template: "Hey {name}, financing is where we can really make things work. I've got relationships with a lot of lenders - let's see what we can do for you. Can we chat about your situation? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'finance_balanced_3',
        template: "Hi {name}! Let's talk numbers on the {vehicle}. I want to make sure we find a payment that fits your budget comfortably. When's a good time to go over some options? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'finance_soft_1',
        template: "Hi {name}, financing is one of the most important parts of the process, and I'm here to help make it easy. Whenever you're ready, I'd be happy to go over your options together. No pressure at all. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'finance_soft_2',
        template: "Hello {name}! I know financing can feel overwhelming, but it doesn't have to be. I'm here to help you understand your options and find something that works for you - no commitment required. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'finance_soft_3',
        template: "Hi {name}, whenever you're ready to explore financing, I'm here to help. We'll take it at your pace and make sure you feel good about everything before moving forward. - {salesperson}",
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
      {
        id: 'test_direct_2',
        template: "{name}, let's get you behind the wheel. The {vehicle} drives amazing. When can you come in? - {salesperson}",
        followUp: 'immediate',
      },
      {
        id: 'test_direct_3',
        template: "Ready to drive the {vehicle}, {name}? I can have it waiting for you. Just need a time. - {salesperson}",
        followUp: 'immediate',
      },
    ],
    balanced: [
      {
        id: 'test_balanced_1',
        template: "Hey {name}! You're going to love driving the {vehicle}. There's nothing like getting behind the wheel. I'm available today - would you like to {appointment_phrase}? - {salesperson} at {dealership}",
        followUp: '2_hours',
      },
      {
        id: 'test_balanced_2',
        template: "Hi {name}! A test drive is the best way to know if the {vehicle} is right for you. I'd love to set that up - when works best for your schedule? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'test_balanced_3',
        template: "Hey {name}, nothing beats the feeling of driving the {vehicle} yourself! Let's get you set up for a test drive. I'm flexible - what time is good for you? - {salesperson}",
        followUp: '2_hours',
      },
    ],
    soft_touch: [
      {
        id: 'test_soft_1',
        template: "Hi {name}! A test drive is always a great idea - it really helps you feel if the {vehicle} is right for you. Whenever you're ready, just let me know and I'll have everything prepared. No rush! - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'test_soft_2',
        template: "Hello {name}! I'd love to get you behind the wheel of the {vehicle} when the time is right. No pressure - just let me know when you'd like to come in and experience it for yourself. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'test_soft_3',
        template: "Hi {name}, whenever you're ready to take the {vehicle} for a spin, I'm here. A test drive is the best way to see if it's the right fit. Take your time and reach out when you're ready! - {salesperson}",
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
      {
        id: 'followup_direct_2',
        template: "{name}, the {vehicle} is still here. Let's make this happen. What do you need from me? - {salesperson}",
        followUp: '3_days',
      },
      {
        id: 'followup_direct_3',
        template: "Hey {name}, just checking in. The {vehicle} is waiting. Let me know what questions I can answer. - {salesperson}",
        followUp: '3_days',
      },
    ],
    balanced: [
      {
        id: 'followup_balanced_1',
        template: "Hi {name}! Just wanted to follow up on our conversation about the {vehicle}. Have you had any more thoughts? I'm here if you have questions! - {salesperson}",
        followUp: '3_days',
      },
      {
        id: 'followup_balanced_2',
        template: "Hey {name}, hope you're doing well! I've been thinking about our chat about the {vehicle}. Anything I can help clear up for you? - {salesperson}",
        followUp: '3_days',
      },
      {
        id: 'followup_balanced_3',
        template: "Hi {name}! Just touching base on the {vehicle}. I know you've got a lot going on - just wanted to let you know I'm still here if you need anything! - {salesperson}",
        followUp: '3_days',
      },
    ],
    soft_touch: [
      {
        id: 'followup_soft_1',
        template: "Hi {name}, I hope you're doing well! Just reaching out to see if there's anything I can help with regarding the {vehicle}. No pressure - I just wanted to make sure you have everything you need. Have a great day! - {salesperson}",
        followUp: '1_week',
      },
      {
        id: 'followup_soft_2',
        template: "Hello {name}! I hope this finds you well. Just wanted to check in and see if you have any questions about the {vehicle}. I'm here whenever you're ready - no rush at all! - {salesperson}",
        followUp: '1_week',
      },
      {
        id: 'followup_soft_3',
        template: "Hi {name}, just a friendly check-in! I know life gets busy, and I want you to know there's no pressure. If the {vehicle} is still on your mind, I'm happy to help whenever the time is right. - {salesperson}",
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
      {
        id: 'obj_direct_2',
        template: "{name}, that's fair. Tell me what you need and I'll see what I can do. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_3',
        template: "Got it, {name}. Let me work on that and get back to you with a solution. - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      {
        id: 'obj_balanced_1',
        template: "I totally understand, {name}. That's a fair point. Let me see what I can do to address that for you. Can we chat for a few minutes? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_2',
        template: "Hey {name}, I appreciate you being honest with me. Let's figure this out together - I want to make sure this works for you. What's the main concern? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_3',
        template: "I hear you, {name}. That makes total sense. Let me see what options we have to make this work better for you. When can we talk? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      {
        id: 'obj_soft_1',
        template: "Hi {name}, I completely understand your concerns - they're totally valid. I want you to feel 100% comfortable with any decision. Would it help to talk through some options? No pressure at all. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_2',
        template: "Hello {name}, thank you for sharing that with me. Your concerns are completely understandable, and I want to help however I can. Let me know if you'd like to explore some alternatives. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_3',
        template: "Hi {name}, I really appreciate you being upfront with me. I never want you to feel rushed or pressured. Take your time, and if there's anything I can help clarify, I'm here. - {salesperson}",
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
