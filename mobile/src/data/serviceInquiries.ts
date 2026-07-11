/**
 * Service Advisor Emergency Inquiries — 10 real-world situations a service
 * advisor faces daily. Each has 3 AI-crafted responses tailored to a
 * high-empathy, technically-accurate, upsell-appropriate tone.
 *
 * Categories match the sales flow shape (id, icon, label, color, responses)
 * so the EmergencyInquiryModal can render them without special-casing.
 */

export const SERVICE_INQUIRY_TYPES = [
  {
    id: 'waiter_status',
    icon: 'timer-outline',
    label: 'WAITER — STATUS',
    color: '#00CCFF',
    responses: [
      "You're at the top of my list. The tech is finishing the multi-point inspection right now — I'll have your vehicle back in the bay for the actual work in about 15 minutes. Coffee, water, or WiFi password? I got you covered while you wait.",
      "Quick update — tech pulled a code that's tied to your check engine light. It's the exact issue we suspected, not something new. Repair time is unchanged. I'll bring you a walkaround estimate before we lay a wrench on it, and you decide.",
      "Your vehicle is on the alignment rack right now. Everything else on the RO is complete. About 25 minutes and I'll be handing you the keys. Any changes to how you want to pay or your contact info while we finish up?",
    ],
  },
  {
    id: 'estimate_upsell',
    icon: 'clipboard-outline',
    label: 'PRESENT ESTIMATE',
    color: '#D6B25E',
    responses: [
      "The tech found three items during the inspection — one is safety-critical and I'd want it done today, one is a wear item due in the next 3,000 miles, and one is a maintenance recommendation we can schedule. Want me to walk you through each with photos so you decide what makes sense today?",
      "Here's the deal — the noise you brought it in for is the outer tie rod, and the tech spotted the inner is starting to fail too. Doing both together saves you a second labor charge later. I can bundle it right now and honor the same shop rate. Sound fair?",
      "Straight talk — the brakes are at 3mm, which is legal but past the point I'd let my own family drive. I've got the pads and rotors in stock, and I can add it to today's ticket without extending your wait. Do you want the good, better, or OEM option? I'll show you all three.",
    ],
  },
  {
    id: 'comeback',
    icon: 'refresh-circle-outline',
    label: 'COMEBACK',
    color: '#FF4B4B',
    responses: [
      "First — I hear you and I own this. That should not have happened after we had it. Bring it back today, I'll get you a loaner if we need it, and the master tech will personally look at it. Whatever it takes to make it right is on us.",
      "I'm sorry you're driving back in. Send me a photo or short video of what you're seeing and I'll have the tech ready the moment you pull in. No wait, no line, no charge to re-diagnose. Let's fix this today for good.",
      "That's not the experience I want you to have with our shop. Skip the service drive — pull straight into the shop entrance and ask for me by name. I'll grab the RO from last visit, we'll re-inspect on our dime, and we'll go from there. On my way to meet you.",
    ],
  },
  {
    id: 'warranty_claim',
    icon: 'shield-checkmark-outline',
    label: 'WARRANTY',
    color: '#34C759',
    responses: [
      "Good news — that repair falls squarely inside your factory powertrain warranty. Zero cost to you for parts and labor. I'll submit the claim, get the part released, and we'll be done in one visit. Bring it by tomorrow morning and I'll book a loaner just in case.",
      "Let me check the coverage in real time — VIN's up on my screen. Yes, the transmission is covered under your CPO warranty for another 14 months / 18k miles. I'll open the claim, order the fluid and gaskets, and we'll get you scheduled within the week.",
      "Here's where we stand: the noise you're describing is a known TSB (technical service bulletin) for your model year. Manufacturer covers it 100% out to 100,000 miles. I'll pull the bulletin, verify the fix, and get you an appointment — likely a one-day turnaround.",
    ],
  },
  {
    id: 'parts_hold',
    icon: 'construct-outline',
    label: 'PARTS ORDER',
    color: '#FF9500',
    responses: [
      "The part shipped this morning from the regional warehouse. It'll be here tomorrow before 10 AM. I'll call you the moment it lands and hold a same-day appointment — most likely early afternoon. Your vehicle will be safe to drive until then; keep an eye on that noise and pull over if it worsens.",
      "Bad news, then good news — the OEM part is on backorder 5-7 days. The good news: I found the exact part in stock at a certified aftermarket supplier, same manufacturer, factory-warrantied. Want me to source that so we can knock this out this week? Your call.",
      "Part came in today. It's on my desk, tagged with your name and RO number. Give me your best window in the next 48 hours and I'll have it installed and you back on the road in under 2 hours.",
    ],
  },
  {
    id: 'tech_consult',
    icon: 'people-outline',
    label: 'TECH CONSULT',
    color: '#AF52DE',
    responses: [
      "I want you to hear it directly from the master tech, not just me relaying it. Pat is finishing another job — give me 10 minutes and I'll bring him over so he can show you exactly what he found under the hood. That way you make the call with full information.",
      "This is a good question and I don't want to guess. Let me grab the shop foreman, get his read on it, and I'll call you back within 15 minutes with a concrete answer. I'd rather be right than fast on something like this.",
      "The tech thinks it might be either A or B and doesn't want to guess. Best move is a diagnostic — 45 minutes on the scanner, gets us a real answer, and if we do the repair the diag is applied to the labor. Say the word and we'll get started.",
    ],
  },
  {
    id: 'loaner_request',
    icon: 'car-sport-outline',
    label: 'LOANER',
    color: '#5CC8FF',
    responses: [
      "Loaner is your call and I've got you covered. I have a courtesy vehicle available today — insurance and license take about 5 minutes to process. It comes with a full tank, and you return it with the same. Want me to hold it?",
      "Since the repair is warranty-covered and takes more than a day, you qualify for a manufacturer-provided loaner at no cost. I'll set it up right now. Any preference — SUV or sedan?",
      "Loaners are tight today, but the shuttle runs on the hour and Uber credits are on the house up to $25 each way. Which is easier for you? I'll book whatever works best.",
    ],
  },
  {
    id: 'declined_service',
    icon: 'close-circle-outline',
    label: 'DECLINED SERVICE',
    color: '#FF2D55',
    responses: [
      "Totally your call — no pressure from me. I'll note it as declined on the RO, and next visit we'll re-inspect at no charge to see how it's progressing. If it gets worse before then, call me directly and I'll get you back in quickly.",
      "I respect that. I'll document that you were informed and chose to defer. Please keep an eye on the symptoms I mentioned — if it starts pulling, vibrating, or the light comes back on, get it back to me immediately. Safety first.",
      "Understood. I'll defer that item but I want you to know exactly what to watch for so you can catch it before it becomes expensive. I'll write it down on your copy of the RO for your records. Any questions before you leave?",
    ],
  },
  {
    id: 'pickup_ready',
    icon: 'checkmark-done-outline',
    label: 'READY FOR PICKUP',
    color: '#3DDB7C',
    responses: [
      "Your vehicle is done, road-tested, and washed. Total came in $40 UNDER estimate because the second gasket wasn't needed. I'll be here until 6 PM — come grab it whenever works. Payment options: card, tap, or finance through the service credit line.",
      "All wrapped up ahead of schedule. Test drive is clean, no leaks, all warning lights out. When you arrive, ask for me — I'll walk you through what we did, show you the old parts, and hand you a paid RO with the warranty on this repair (12 months / 12k miles).",
      "Vehicle's ready. Everything on the RO checked off, tech signed off, and it's parked in the customer pickup line. Total is $X. Want to swing by at close so we can chat briefly about the two items I recommended you defer? I want you to have all the info.",
    ],
  },
  {
    id: 'schedule_appointment',
    icon: 'calendar-outline',
    label: 'SCHEDULE APPT',
    color: '#32ADE6',
    responses: [
      "I've got Tuesday at 8:00 AM or Thursday at 10:30 available. I'll pre-order the parts based on your description so we don't lose time. Bring it in with at least a quarter tank so the tech can road-test. Which works better?",
      "For a full-service inspection plus the noise you're describing, block out 3 hours. I've got a same-day drop-off available Wednesday, and we'll shuttle you to work if needed. Want to lock it in now?",
      "Since this could be a couple different things, I'd want the vehicle here first thing so we have the full day if we need it. Can you drop it Friday 7:30 AM? I'll bump you to the front of the diagnostic queue.",
    ],
  },
];
