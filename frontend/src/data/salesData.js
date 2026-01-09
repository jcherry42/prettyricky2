// Default automotive sales data - can be overridden by user uploads
export const defaultObjectionTypes = [
  { id: 'price', label: 'Price', icon: 'dollar-sign', color: 'accent' },
  { id: 'payment', label: 'Payment', icon: 'credit-card', color: 'warning' },
  { id: 'trade', label: 'Trade-In', icon: 'repeat', color: 'primary' },
  { id: 'rate', label: 'Interest Rate', icon: 'percent', color: 'success' },
  { id: 'timing', label: 'Timing', icon: 'clock', color: 'muted' },
  { id: 'competitor', label: 'Competitor', icon: 'users', color: 'secondary' },
  { id: 'features', label: 'Features', icon: 'list', color: 'primary' },
  { id: 'warranty', label: 'Warranty', icon: 'shield', color: 'success' },
];

export const defaultResponses = {
  price: [
    {
      id: 'price-1',
      tone: 'value',
      title: 'Value-Focused',
      response: "I totally understand wanting to get the best deal, {name}. Let me show you what makes this {vehicle} such incredible value - when you factor in the {feature1}, {feature2}, and our industry-leading warranty, you're actually looking at a lower cost of ownership than comparable vehicles. Plus, I can check if we have any current incentives that might work for you.",
      winRate: 78,
      tags: ['new', 'luxury', 'family'],
    },
    {
      id: 'price-2',
      tone: 'empathy',
      title: 'Budget-Understanding',
      response: "That's a really fair point, {name}. Sticking to a budget is smart - I respect that. What if we looked at this a different way? Sometimes adjusting the term length or putting down a bit more can make a big difference in where we land monthly. Would you be open to running a few scenarios together?",
      winRate: 72,
      tags: ['used', 'first-time', 'budget'],
    },
    {
      id: 'price-3',
      tone: 'urgency',
      title: 'Incentive-Driven',
      response: "I hear you on the price, {name}. Here's the thing though - we've got some manufacturer incentives ending this {timeframe} that are pretty significant. I'd hate for you to miss out on {savings} in savings just because of timing. Can we at least lock in these numbers so you have the option?",
      winRate: 65,
      tags: ['new', 'seasonal', 'incentive'],
    },
  ],
  payment: [
    {
      id: 'payment-1',
      tone: 'solution',
      title: 'Payment Restructure',
      response: "I get it, {name} - the monthly payment is what really matters at the end of the day. Good news is we have some flexibility here. If we adjust the term to {term} months, we can get you down to around {payment}/month. That work better for your budget?",
      winRate: 81,
      tags: ['all', 'payment-shopper'],
    },
    {
      id: 'payment-2',
      tone: 'value',
      title: 'Total Cost Focus',
      response: "That's smart to watch the monthly, {name}. But let me share something - when you look at total cost of ownership including fuel efficiency and maintenance, this {vehicle} actually costs less over {years} years than you might think. Would you like me to break down those numbers?",
      winRate: 68,
      tags: ['new', 'fuel-efficient', 'hybrid'],
    },
  ],
  trade: [
    {
      id: 'trade-1',
      tone: 'transparency',
      title: 'Market-Based Value',
      response: "I appreciate you bringing your {tradeVehicle}, {name}. Let me explain how we arrived at that number - we use real-time market data from thousands of recent sales. Your vehicle's condition is {condition}, which is great. The market for {tradeYear} {tradeMake} is {marketTrend} right now. What were you hoping to see?",
      winRate: 74,
      tags: ['trade', 'all'],
    },
    {
      id: 'trade-2',
      tone: 'empathy',
      title: 'Bridge the Gap',
      response: "I understand that's not quite what you were expecting for your {tradeVehicle}, {name}. Here's what I can do - let me talk to my manager about getting you a bit more on the trade if we can finalize today. What number would make this work for you?",
      winRate: 69,
      tags: ['trade', 'closing'],
    },
  ],
  rate: [
    {
      id: 'rate-1',
      tone: 'competitive',
      title: 'Rate Comparison',
      response: "Rates are definitely something to watch, {name}. At {rate}%, we're actually {comparison} compared to the national average right now. Plus, if your credit improves over the next year or two, refinancing is always an option. The important thing is getting you into this {vehicle} now while it's available.",
      winRate: 71,
      tags: ['financing', 'credit'],
    },
    {
      id: 'rate-2',
      tone: 'solution',
      title: 'Alternative Options',
      response: "I hear you on the rate, {name}. Let me check a few things - we work with multiple lenders, and sometimes a different one can offer better terms. Also, if you have a co-signer option or can put a bit more down, that often improves the rate. Want me to run those scenarios?",
      winRate: 66,
      tags: ['subprime', 'first-time'],
    },
  ],
  timing: [
    {
      id: 'timing-1',
      tone: 'understanding',
      title: 'Respectful Follow-up',
      response: "Absolutely, {name} - I never want you to feel rushed. When you say {timeframe}, is there something specific happening then, like a bonus or tax return? I ask because sometimes we can structure things to work with your timing while locking in today's pricing.",
      winRate: 58,
      tags: ['all', 'long-cycle'],
    },
    {
      id: 'timing-2',
      tone: 'urgency',
      title: 'Availability Alert',
      response: "I totally respect that you want to think it over, {name}. Just wanted to let you know - this specific {vehicle} in {color} with {features} is one of only {count} we have. I can't hold it, but I can put you first in line if someone else shows interest. Fair?",
      winRate: 62,
      tags: ['low-inventory', 'popular-model'],
    },
  ],
  competitor: [
    {
      id: 'competitor-1',
      tone: 'confident',
      title: 'Feature Comparison',
      response: "The {competitor} is definitely a solid choice - I can see why you're considering it. But let me show you something: when you compare {feature1}, {feature2}, and {feature3} side by side, our {vehicle} actually comes out ahead. Plus, our resale value after 5 years is typically {percentage}% higher.",
      winRate: 70,
      tags: ['cross-shop', 'all'],
    },
    {
      id: 'competitor-2',
      tone: 'service',
      title: 'Dealership Experience',
      response: "I appreciate you being upfront about looking at {competitor}, {name}. Here's what I'd ask you to consider - beyond the vehicle itself, think about the buying experience and after-sale support. We've been here {years} years, and {percentage}% of our customers are repeat buyers. That says something.",
      winRate: 64,
      tags: ['loyalty', 'service'],
    },
  ],
  features: [
    {
      id: 'features-1',
      tone: 'solution',
      title: 'Trim Level Options',
      response: "I understand wanting that {feature}, {name}. Let me check our inventory - we might have a {higherTrim} that includes it, or sometimes there's an accessory package we can add. What's driving your interest in that particular feature?",
      winRate: 73,
      tags: ['upsell', 'features'],
    },
    {
      id: 'features-2',
      tone: 'alternative',
      title: 'Feature Workaround',
      response: "So you're really wanting {feature} - I get it, that's a great feature. While this trim doesn't include it factory, here's an option: we can add {aftermarketOption} for about {cost}, which gives you the same functionality. Would that work for you?",
      winRate: 61,
      tags: ['accessories', 'customization'],
    },
  ],
  warranty: [
    {
      id: 'warranty-1',
      tone: 'assurance',
      title: 'Coverage Breakdown',
      response: "Great question about the warranty, {name}. You get {bumperYears} years bumper-to-bumper, {powertrainYears} years powertrain, plus {additionalCoverage}. That's actually {comparison} than most competitors. And if you want even more peace of mind, we have extended coverage options that go up to {extendedYears} years.",
      winRate: 77,
      tags: ['new', 'certified'],
    },
    {
      id: 'warranty-2',
      tone: 'value',
      title: 'Total Protection Value',
      response: "I love that you're thinking about long-term protection, {name}. Beyond the factory warranty, when you factor in our complimentary maintenance for {maintenanceYears} years and roadside assistance, you're looking at thousands in included value. Would you like me to show you the full breakdown?",
      winRate: 72,
      tags: ['new', 'value-conscious'],
    },
  ],
};

export const defaultVehicles = [
  { id: 'v1', year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', price: 32490, status: 'available' },
  { id: 'v2', year: 2024, make: 'Toyota', model: 'Camry', trim: 'XLE', price: 35070, status: 'available' },
  { id: 'v3', year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', price: 49995, status: 'available' },
  { id: 'v4', year: 2024, make: 'Chevrolet', model: 'Equinox', trim: 'LT', price: 33100, status: 'available' },
  { id: 'v5', year: 2024, make: 'BMW', model: 'X3', trim: 'xDrive30i', price: 48900, status: 'available' },
  { id: 'v6', year: 2023, make: 'Hyundai', model: 'Tucson', trim: 'SEL', price: 31850, status: 'available' },
];

export const defaultProspects = [
  {
    id: 'p1',
    name: 'Alex Martinez',
    email: 'alex.m@email.com',
    phone: '(555) 123-4567',
    status: 'hot',
    vehicle: 'v5',
    tradeVehicle: { year: 2019, make: 'BMW', model: 'X1', value: 18500 },
    lastContact: '2 hours ago',
    nextFollowUp: 'Today 4:00 PM',
    notes: 'Very interested, comparing with Audi Q5. Needs decision by weekend.',
    objections: ['price', 'competitor'],
  },
  {
    id: 'p2',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '(555) 234-5678',
    status: 'warm',
    vehicle: 'v1',
    tradeVehicle: null,
    lastContact: 'Yesterday',
    nextFollowUp: 'Tomorrow 10:00 AM',
    notes: 'First-time buyer, concerned about monthly payments.',
    objections: ['payment', 'rate'],
  },
  {
    id: 'p3',
    name: 'Michael Chen',
    email: 'mchen@email.com',
    phone: '(555) 345-6789',
    status: 'warm',
    vehicle: 'v3',
    tradeVehicle: { year: 2018, make: 'Ford', model: 'F-150', value: 24000 },
    lastContact: '3 days ago',
    nextFollowUp: 'Friday 2:00 PM',
    notes: 'Wants to wait for tax return. Loyal Ford customer.',
    objections: ['timing', 'trade'],
  },
  {
    id: 'p4',
    name: 'Emily Davis',
    email: 'emily.d@email.com',
    phone: '(555) 456-7890',
    status: 'hot',
    vehicle: 'v2',
    tradeVehicle: { year: 2020, make: 'Honda', model: 'Civic', value: 16800 },
    lastContact: '30 minutes ago',
    nextFollowUp: null,
    notes: 'Ready to buy today if we can match competitor price.',
    objections: ['price', 'competitor'],
  },
];

// Helper to personalize responses
export const personalizeResponse = (template, context) => {
  let result = template;
  
  // Replace all placeholders
  Object.entries(context).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  });
  
  return result;
};

// Local storage keys
export const STORAGE_KEYS = {
  CUSTOM_RESPONSES: 'closr_custom_responses',
  CUSTOM_VEHICLES: 'closr_custom_vehicles',
  PROSPECTS: 'closr_prospects',
  SETTINGS: 'closr_settings',
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
