// Core data structures for Closr - iOS-optimized sales weapon
// All responses engineered using psychological persuasion principles:
// - Reciprocity, Social Proof, Authority, Liking, Scarcity, Commitment/Consistency
// - Loss Aversion, Anchoring, Framing, Emotional Triggers

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

// Default response templates - Psychology-driven responses
// Principles used: Reciprocity, Social Proof, Scarcity, Authority, Liking, Commitment, Loss Aversion
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

  // QUADRUPLED OBJECTION RESPONSES - Based on real purchasing data & psychology
  // Top objections: Price, Need to think, Spouse approval, Trade value, Payment, Rate, Shopping around, Not ready, Credit concerns, Feature missing, Trust/fees, Timing
  objection: {
    fast_direct: [
      // Price/Budget Objections (Anchoring + Value Reframe)
      {
        id: 'obj_direct_price_1',
        template: "{name}, I hear you on price. Let me show you exactly what's included - most people find the value makes sense when they see the full picture. 5 minutes? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_price_2',
        template: "{name}, fair point. But consider this - the {vehicle} holds its value better than most. In 3 years, you'll be glad you made this choice. Let's talk numbers. - {salesperson}",
        followUp: '2_hours',
      },
      // Need to Think (Commitment + Loss Aversion)
      {
        id: 'obj_direct_think_1',
        template: "{name}, totally get it. What specifically do you want to think through? I can probably answer that right now and save you some time. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_think_2',
        template: "{name}, makes sense. Just so you know - this {vehicle} has had a lot of interest. I can't hold it, but I can put you first in line. Want me to? - {salesperson}",
        followUp: '2_hours',
      },
      // Spouse/Partner Approval (Social Proof + Inclusion)
      {
        id: 'obj_direct_spouse_1',
        template: "{name}, smart to include them. Most couples decide together. When can you both come in? I'll make sure we have time to answer all their questions too. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_spouse_2',
        template: "{name}, completely understand. What do you think they'll want to know? I can put together the key info so you're ready for that conversation. - {salesperson}",
        followUp: '2_hours',
      },
      // Payment Too High (Reframe + Options)
      {
        id: 'obj_direct_payment_1',
        template: "{name}, let's fix that. What payment works for your budget? I'll find a way to get there. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_payment_2',
        template: "{name}, I can adjust the term or look at different options to hit your number. What's your target? - {salesperson}",
        followUp: '2_hours',
      },
      // Shopping Around (Scarcity + Authority)
      {
        id: 'obj_direct_shopping_1',
        template: "{name}, shop smart - I respect that. But I'll tell you now, we're priced to compete. Bring me any deal and I'll beat it or match it. Fair? - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_shopping_2',
        template: "{name}, go ahead and look. I'm confident you'll be back. Just don't wait too long - this {vehicle} won't last. - {salesperson}",
        followUp: '2_hours',
      },
      // Not Ready Today (Commitment Ladder)
      {
        id: 'obj_direct_notready_1',
        template: "{name}, no problem. But let's at least lock in today's pricing so you don't lose out. No commitment to buy - just holds the numbers. - {salesperson}",
        followUp: '2_hours',
      },
      {
        id: 'obj_direct_notready_2',
        template: "{name}, understood. What would need to happen for you to be ready? Let me see if I can help make that happen. - {salesperson}",
        followUp: '2_hours',
      },
    ],
    balanced: [
      // Price/Budget (Reciprocity + Value)
      {
        id: 'obj_balanced_price_1',
        template: "I totally understand, {name}. Price matters. Let me show you everything that's included and see if we can find some creative solutions together. What's most important to you in terms of value? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_price_2',
        template: "Hey {name}, I hear you. Let me ask - is it the total price or the monthly payment that's the concern? Sometimes there's flexibility we haven't explored yet. - {salesperson}",
        followUp: 'same_day',
      },
      // Need to Think (Liking + Understanding)
      {
        id: 'obj_balanced_think_1',
        template: "Absolutely {name}, big decisions deserve thought. I'm curious though - what's the main thing you're weighing? I might be able to help you think through it. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_think_2',
        template: "I appreciate that, {name}. Most of my happiest customers took time to decide. What information would help you feel more confident? - {salesperson}",
        followUp: 'same_day',
      },
      // Spouse/Partner (Inclusion + Social Proof)
      {
        id: 'obj_balanced_spouse_1',
        template: "That's great, {name} - it's a big decision for both of you. A lot of couples come in together for the test drive so everyone can get a feel for it. Would that work? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_spouse_2',
        template: "Makes total sense, {name}. What do you think their main questions will be? I can help you have all the answers ready for that conversation. - {salesperson}",
        followUp: 'same_day',
      },
      // Payment (Problem Solving)
      {
        id: 'obj_balanced_payment_1',
        template: "I get it, {name} - the payment has to work for your life. Let's back into a number that makes sense for you. What range are you comfortable with? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_payment_2',
        template: "Understood, {name}. There are usually a few ways to get to a better payment - term, down payment, different trim. Let's explore what works best for you. - {salesperson}",
        followUp: 'same_day',
      },
      // Shopping Around (Confidence + Differentiation)
      {
        id: 'obj_balanced_shopping_1',
        template: "I think that's smart, {name}. I'm confident in what we offer - both the vehicle and the experience. When you're done looking around, I'd love to earn your business. What matters most to you? - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_shopping_2',
        template: "No problem, {name}. Comparison shopping is wise. Just remember - it's not just about price. The experience and support after the sale matter too. I'm here when you're ready. - {salesperson}",
        followUp: 'same_day',
      },
      // Not Ready (Understanding + Commitment)
      {
        id: 'obj_balanced_notready_1',
        template: "Totally understand, {name}. Is there anything holding you back that I could help address? Sometimes just talking it through helps clarify things. - {salesperson}",
        followUp: 'same_day',
      },
      {
        id: 'obj_balanced_notready_2',
        template: "No rush at all, {name}. I just want to make sure you have everything you need to make a decision when the time is right. What would be helpful for you to know? - {salesperson}",
        followUp: 'same_day',
      },
    ],
    soft_touch: [
      // Price/Budget (Empathy + No Pressure)
      {
        id: 'obj_soft_price_1',
        template: "Hi {name}, I completely understand - budget is such an important factor. I'm here to help you find the best value, whatever that looks like for you. No pressure to decide anything right now. Would it help to talk through some options? - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_price_2',
        template: "I hear you, {name}. Finding the right car at the right price takes time, and that's okay. Whenever you're ready to explore some possibilities, I'm here - no obligation at all. - {salesperson}",
        followUp: 'next_day',
      },
      // Need to Think (Respect + Support)
      {
        id: 'obj_soft_think_1',
        template: "Hi {name}, I really appreciate you being thoughtful about this decision. Take all the time you need - there's no rush. If any questions come up while you're thinking, I'm just a message away. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_think_2',
        template: "Absolutely, {name}. Big decisions deserve time and thought. I'm here whenever you're ready to chat more - no pressure at all. Trust your instincts. - {salesperson}",
        followUp: 'next_day',
      },
      // Spouse/Partner (Understanding + Inclusion)
      {
        id: 'obj_soft_spouse_1',
        template: "Hi {name}, that makes perfect sense - it's wonderful that you make these decisions together. Whenever you'd both like to come in, I'd love to meet them and answer any questions. No rush at all! - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_spouse_2',
        template: "I completely understand, {name}. Involving your partner in a big decision like this is so important. Let me know if there's any information I can provide to help with that conversation. - {salesperson}",
        followUp: 'next_day',
      },
      // Payment (Gentle + Helpful)
      {
        id: 'obj_soft_payment_1',
        template: "Hi {name}, I understand the payment needs to feel comfortable for you. There's no pressure here - I'm happy to explore different options whenever you're ready to see what might work. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_payment_2',
        template: "I hear you, {name}. Finding a payment that fits your life is important. When you're ready, I'd love to help you look at some possibilities - no commitment required. - {salesperson}",
        followUp: 'next_day',
      },
      // Shopping Around (Encouraging + Confident)
      {
        id: 'obj_soft_shopping_1',
        template: "Hi {name}, I think that's a really smart approach. Do your research and find what feels right for you. I'm here if you have questions along the way, and I'd love to earn your business when you're ready. - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_shopping_2',
        template: "Absolutely, {name}. You should feel confident in your choice. Take your time, and know that I'm here whenever you want to talk - no pressure at all. - {salesperson}",
        followUp: 'next_day',
      },
      // Not Ready (Patient + Supportive)
      {
        id: 'obj_soft_notready_1',
        template: "Hi {name}, I completely respect that. There's no timeline here - buying a car should feel right, not rushed. I'm here whenever the time is right for you. Take care! - {salesperson}",
        followUp: 'next_day',
      },
      {
        id: 'obj_soft_notready_2',
        template: "No problem at all, {name}. The right car will still be the right car whenever you're ready. I'm here to help whenever that time comes - no pressure. Have a wonderful day! - {salesperson}",
        followUp: 'next_day',
      },
    ],
  },
};

// QUADRUPLED FOLLOW-UP TEMPLATES - Psychology-driven timing and messaging
export const FOLLOW_UP_TEMPLATES = {
  '2_hours': {
    fast_direct: [
      "{name}, just following up - the {vehicle} is still here. Let me know! - {salesperson}",
      "{name}, quick check-in on the {vehicle}. What questions can I answer? - {salesperson}",
      "Hey {name}, circling back. The {vehicle} had some interest today. Still on your radar? - {salesperson}",
      "{name}, wanted to catch you before end of day. {vehicle} update - it's still available. - {salesperson}",
    ],
    balanced: [
      "Hey {name}! Just wanted to make sure you got my message about the {vehicle}. Any questions I can answer? - {salesperson}",
      "Hi {name}, hope your day is going well! Just checking in on the {vehicle} - anything I can help with? - {salesperson}",
      "Hey {name}, thinking about our chat earlier. The {vehicle} really would be perfect for you. What's holding you back? - {salesperson}",
      "{name}, just a quick follow-up! I found some additional info on the {vehicle} I thought you might like. Want me to send it over? - {salesperson}",
    ],
    soft_touch: [
      "Hi {name}! I hope I'm not bothering you - just wanted to make sure you have everything you need. I'm here if you'd like to chat! - {salesperson}",
      "Hello {name}, just a gentle check-in. No pressure at all - I just want to be helpful if there's anything you're wondering about. - {salesperson}",
      "Hi {name}, I hope you're having a great day! Just wanted you to know I'm here if any questions come up about the {vehicle}. - {salesperson}",
      "{name}, just reaching out to say I'm thinking of you and hope your car search is going well. I'm here if you need anything! - {salesperson}",
    ],
  },
  'same_day': {
    fast_direct: [
      "{name}, checking in before end of day on the {vehicle}. Ready when you are. - {salesperson}",
      "{name}, last call for today - the {vehicle} is still here. Tomorrow isn't guaranteed. - {salesperson}",
      "Hey {name}, day's almost over. Any decision on the {vehicle}? I can make something happen tonight. - {salesperson}",
      "{name}, wrapping up for the day. Let's get you into that {vehicle} - what do you need from me? - {salesperson}",
    ],
    balanced: [
      "Hi {name}! As the day wraps up, I wanted to check if you had any thoughts on the {vehicle}. Would love to help! - {salesperson}",
      "Hey {name}, hope you had a great day! Just wanted to touch base before tonight. The {vehicle} is still on my mind for you. - {salesperson}",
      "Hi {name}! Before I head out, I wanted to make sure you have everything you need. Any questions about the {vehicle}? - {salesperson}",
      "{name}, just wanted to say thanks for considering us today. I'm here tomorrow if you want to continue our conversation about the {vehicle}. - {salesperson}",
    ],
    soft_touch: [
      "Good evening {name}! Just a gentle reminder that I'm here whenever you're ready to discuss the {vehicle}. Have a wonderful night! - {salesperson}",
      "Hi {name}, I hope you're having a relaxing evening. Just wanted to let you know - no pressure, but I'm here if anything comes to mind about the {vehicle}. - {salesperson}",
      "Hello {name}! As the day winds down, I just wanted to wish you a great evening. I'm here whenever feels right to continue our chat. - {salesperson}",
      "{name}, hope you're enjoying your evening! Just a friendly note to say I'm here if you need anything. No rush at all! - {salesperson}",
    ],
  },
  'next_day': {
    fast_direct: [
      "{name}, the {vehicle} made it through the night - still here for you. - {salesperson}",
      "Morning {name}, {vehicle} update: still available. Let's do this today. - {salesperson}",
      "{name}, new day, same opportunity. The {vehicle} is waiting. When can you come in? - {salesperson}",
      "Hey {name}, slept on it? The {vehicle} is ready when you are. - {salesperson}",
    ],
    balanced: [
      "Good morning {name}! Hope you had a great night. Wanted to touch base about the {vehicle}. What's on your mind? - {salesperson}",
      "Hey {name}, hope you're having a good start to your day! I was thinking about what you said yesterday - any new thoughts on the {vehicle}? - {salesperson}",
      "Hi {name}! New day, fresh perspective. How are you feeling about the {vehicle}? I'm here to help! - {salesperson}",
      "Good morning {name}! Just wanted to check in and see if you had any questions after sleeping on it. The {vehicle} is still available! - {salesperson}",
    ],
    soft_touch: [
      "Good morning {name}! I hope you're having a great day so far. Just wanted to check in and see if there's anything I can help with. No rush at all! - {salesperson}",
      "Hi {name}, hope you slept well! Just a gentle note to say I'm here whenever you're ready. Take your time with the decision! - {salesperson}",
      "Hello {name}! I hope your morning is going beautifully. I'm here if you'd like to chat about the {vehicle} - no pressure whatsoever. - {salesperson}",
      "Good morning {name}! Just wanted to wish you a wonderful day. I'm here whenever feels right for you. - {salesperson}",
    ],
  },
  '3_days': {
    fast_direct: [
      "{name}, the {vehicle} is going to move soon. Just giving you a heads up. - {salesperson}",
      "{name}, 3 days in - the {vehicle} has had more looks. Still interested? - {salesperson}",
      "Hey {name}, wanted to be upfront - the {vehicle} won't last forever. What's it going to take? - {salesperson}",
      "{name}, checking in one more time. The {vehicle} opportunity is still here. Ball's in your court. - {salesperson}",
    ],
    balanced: [
      "Hey {name}! It's been a few days - wanted to see how you're doing and if you're still thinking about the {vehicle}. I'm here to help! - {salesperson}",
      "Hi {name}, hope your week is going well! Just touching base on the {vehicle}. Anything I can help you work through? - {salesperson}",
      "Hey {name}! Haven't heard from you in a bit - just wanted to make sure everything's okay and see if you have any questions. - {salesperson}",
      "Hi {name}! I've been thinking about our conversation. Is there anything holding you back on the {vehicle} that I could help address? - {salesperson}",
    ],
    soft_touch: [
      "Hi {name}! I hope your week is going well. Just wanted to gently follow up and see if there's anything I can help you with. As always, no pressure! - {salesperson}",
      "Hello {name}, I hope this finds you well! Just checking in to see how you're doing. The {vehicle} is here whenever you're ready. - {salesperson}",
      "Hi {name}! I know it's been a few days, and I just wanted you to know I'm still here if you need anything. Take all the time you need! - {salesperson}",
      "{name}, just a friendly check-in! I hope everything is going great. No rush on anything - I'm here whenever feels right. - {salesperson}",
    ],
  },
  '1_week': {
    fast_direct: [
      "{name}, week later - {vehicle} update: it's here or it's gone. Want to check? - {salesperson}",
      "{name}, one week check-in. The {vehicle} situation has changed. Call me. - {salesperson}",
      "Hey {name}, a week's gone by. Are we doing this or not? The {vehicle} needs an answer. - {salesperson}",
      "{name}, final follow-up on the {vehicle}. I've got other interested buyers. Where are you at? - {salesperson}",
    ],
    balanced: [
      "Hi {name}! It's been about a week - just wanted to check in and see how things are going. If the {vehicle} is still on your radar, I'd love to chat! - {salesperson}",
      "Hey {name}, hope you're having a great week! Just wanted to reconnect and see if there's anything I can help with regarding the {vehicle}. - {salesperson}",
      "Hi {name}! A week has flown by! Just wanted to see how you're feeling about everything. I'm here if you want to talk through anything. - {salesperson}",
      "Hey {name}, it's been a little while! Just checking in to see if your situation has changed at all. The {vehicle} is still a great fit for you. - {salesperson}",
    ],
    soft_touch: [
      "Hello {name}! I hope everything is going wonderfully for you. I just wanted to reach out and let you know I'm still here if you ever want to revisit our conversation about the {vehicle}. Take care! - {salesperson}",
      "Hi {name}, I hope you're doing great! Just a gentle note to say I'm thinking of you and I'm here whenever the time feels right. No rush at all! - {salesperson}",
      "Hello {name}! I hope life is treating you well. Just wanted to check in and let you know the door is always open whenever you're ready. Have a beautiful day! - {salesperson}",
      "Hi {name}, it's been a week and I just wanted to say I hope you're well! I'm here whenever you need me - no timeline, no pressure. Wishing you all the best! - {salesperson}",
    ],
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
