"""
Sales Knowledge Base — Supercharg'd
═══════════════════════════════════════════════════════════════════
Elite automotive sales knowledge seeded into the vector DB.
This is the brain behind Tower Talk's contextual intelligence.

Categories:
  • objection_handling  — Crushing every objection with confidence
  • appointment_setting — Getting them in the door
  • closing_techniques  — Sealing the deal
  • follow_up           — Never losing a lead
  • trade_in            — Maximizing trade value perception
  • financing           — Making payments comfortable
  • urgency_creation    — Ethical urgency that moves deals
  • rapport_building    — Building instant trust
  • competitor_defense  — Winning against the competition
  • value_framing       — Reframing price as investment
"""

from __future__ import annotations

import logging
from typing import List, Dict

logger = logging.getLogger("sales_knowledge")

# ═══════════════════════════════════════════════════════════════════
# ELITE AUTOMOTIVE SALES KNOWLEDGE
# ═══════════════════════════════════════════════════════════════════

SALES_KNOWLEDGE: List[Dict[str, str]] = [
    # ── OBJECTION HANDLING ──────────────────────────────────────────
    {
        "category": "objection_handling",
        "text": "When a customer says 'I need to think about it', they're really saying they need more information or reassurance. Respond: 'I completely understand. What specifically are you weighing? Let me make sure you have everything you need to make the best decision.' Then address each concern directly. Never let them leave without identifying the real objection.",
    },
    {
        "category": "objection_handling",
        "text": "When a customer says 'The price is too high', never defend the price — reframe the value. Say: 'I hear you. Let me ask you this — if the price were right, is this the vehicle you'd want to drive home today?' If yes, you've isolated the objection. Now work the numbers. If no, you have the wrong vehicle.",
    },
    {
        "category": "objection_handling",
        "text": "When a customer says 'I need to talk to my spouse', respond: 'Absolutely. In fact, why don't we get them on a quick video call right now so they can see the vehicle and I can answer any questions they have? That way you're both on the same page.' This eliminates the stall.",
    },
    {
        "category": "objection_handling",
        "text": "When a customer says 'I'm just looking', respond: 'Perfect, that's exactly why I'm here — to make sure when you stop looking, you stop looking at the right one. What brought you in today?' This converts browsers into buyers by engaging their actual motivation.",
    },
    {
        "category": "objection_handling",
        "text": "When a customer says 'I can get a better deal somewhere else', respond: 'I'd expect nothing less from a smart buyer. But let me ask — are you comparing the same vehicle, same condition, same warranty, same service commitment? Because I can show you exactly why this deal stands on its own.' Never badmouth competition.",
    },
    {
        "category": "objection_handling",
        "text": "The 'Feel, Felt, Found' technique adapted for automotive: 'I understand how you feel about the monthly payment. Many of my best customers felt the same way. What they found is that when we factored in the fuel savings, lower insurance, and zero maintenance costs for the first 3 years, it actually saved them money.' Always specific, never generic.",
    },

    # ── APPOINTMENT SETTING ────────────────────────────────────────
    {
        "category": "appointment_setting",
        "text": "The Assumptive Close for appointments: Never ask 'Would you like to come in?' Instead: 'I've got the vehicle pulled aside for you. I have a 2:00 and a 4:30 open today — which works better for your schedule?' Give two choices, both result in an appointment. This closes at 3x the rate of open-ended questions.",
    },
    {
        "category": "appointment_setting",
        "text": "The Scarcity Appointment: 'I want to be transparent — I've had three inquiries on this exact vehicle in the last 48 hours. I can hold it for you until tomorrow at noon if you want to lock in a time to see it. Does morning or afternoon work better?' Real scarcity, not manufactured.",
    },
    {
        "category": "appointment_setting",
        "text": "The Value-Add Appointment: 'When you come in, I'll have the vehicle detailed and staged just for you. I'll also have a complimentary appraisal ready for your trade-in so you'll know exactly where you stand before we talk numbers. I'm thinking Thursday or Friday — what's better for you?' Make the visit feel exclusive.",
    },
    {
        "category": "appointment_setting",
        "text": "The Low-Pressure Appointment: 'No commitment, no pressure — I just want you to experience this vehicle in person because photos don't capture it. Give me 20 minutes of your time and I promise you'll know if it's right for you. I've got a slot at 10 AM tomorrow. Sound good?' Make it feel easy.",
    },
    {
        "category": "appointment_setting",
        "text": "The Urgency Appointment for internet leads: 'I saw your inquiry come through and I wanted to reach out personally before this vehicle gets flagged for our weekend event pricing. I can carve out time for you today between 3 and 5 — even a 15-minute visit would be worth it.' Speed-to-lead wins.",
    },

    # ── CLOSING TECHNIQUES ────────────────────────────────────────
    {
        "category": "closing_techniques",
        "text": "The Assumptive Close: Stop asking 'Do you want to buy this car?' Start saying 'So we're going with the midnight blue with the premium package — let me get the paperwork started while you finish your coffee.' Act as if the decision is already made. Confidence is contagious.",
    },
    {
        "category": "closing_techniques",
        "text": "The Summary Close: 'Let me make sure I have everything right — you love the way it drives, the color is exactly what you wanted, the payment fits your budget, and we're giving you top dollar on your trade. The only thing left is your signature. Shall we make it official?'",
    },
    {
        "category": "closing_techniques",
        "text": "The Now-or-Never Close (ethical version): 'I have to be straight with you — this incentive package expires at end of business today and I can't guarantee it'll come back. If this is the vehicle you want, right now is genuinely the best time to move. What do you say?' Only use when the urgency is real.",
    },
    {
        "category": "closing_techniques",
        "text": "The Puppy Dog Close for test drives: 'Tell you what — take it home for the night. Park it in your driveway, let your family see it, drive it to work tomorrow. If you don't love it, bring it back. No questions asked.' Once they picture ownership, they rarely come back.",
    },
    {
        "category": "closing_techniques",
        "text": "The Takeaway Close: When a customer is hesitating, gently take the option away. 'You know what, this might not be the right time for you, and that's completely fine. I just want to let you know that I have someone coming in at 3 to look at this same vehicle. If they don't take it, I'll reach back out.' Scarcity + respect = urgency.",
    },

    # ── FOLLOW-UP MASTERY ─────────────────────────────────────────
    {
        "category": "follow_up",
        "text": "The Day-After Follow-Up (Tomorrow): 'Hey [name], I've been thinking about our conversation. I found a couple more options that match what you described, and one of them just hit the lot this morning. Worth a quick look — when can you swing by?' Always lead with new value, never 'just checking in.'",
    },
    {
        "category": "follow_up",
        "text": "The One-Week Follow-Up: 'Hi [name], quick update — the vehicle you were looking at is still available, but I noticed we just got a new incentive from the manufacturer that drops the payment by about $40/month. I wanted you to know before I open it up to the floor. Can we connect this week?' Lead with a reason to act.",
    },
    {
        "category": "follow_up",
        "text": "The One-Month Follow-Up: 'Hey [name], it's been a few weeks and I wanted to circle back. Market conditions have shifted and I'm seeing better trade-in values and lower rates than when we last spoke. If the timing wasn't right before, it might be now. Want me to run fresh numbers for you?' Reopen with changed circumstances.",
    },
    {
        "category": "follow_up",
        "text": "Follow-up golden rule: Every follow-up must contain NEW information — a price change, a new vehicle, a new incentive, a market shift. Never say 'just checking in' or 'following up.' That's lazy and it gets ignored. Be the salesperson who always brings value.",
    },

    # ── TRADE-IN MASTERY ──────────────────────────────────────────
    {
        "category": "trade_in",
        "text": "Trade-in psychology: Always appraise the trade BEFORE discussing the new vehicle price. When the customer knows their trade value, they mentally deduct it from the price, making the new vehicle feel more affordable. Say: 'Let's start with your trade — I want to make sure you're getting every dollar it's worth.'",
    },
    {
        "category": "trade_in",
        "text": "When a customer thinks their trade is worth more than your appraisal: 'I totally understand where you're coming from. Let me show you the exact market data — here are the last 10 comparable vehicles that sold in your area, and here's where yours sits. I want to be fair AND transparent.' Data beats opinion every time.",
    },

    # ── FINANCING CONFIDENCE ──────────────────────────────────────
    {
        "category": "financing",
        "text": "Payment objection reframe: When a customer says 'That monthly payment is too high', respond: 'I hear you. Let me ask — is it the total price or the monthly payment that concerns you? Because there are 4 or 5 different ways I can structure this to get you closer to where you need to be.' Always offer paths, not dead ends.",
    },
    {
        "category": "financing",
        "text": "Credit concern handling: 'I work with over 30 lending partners and I've put together deals for every credit situation you can imagine. Don't let a credit score stop you from driving the right vehicle. Let me run a soft pull — it won't affect your score — and I'll tell you exactly what we're working with.'",
    },

    # ── URGENCY CREATION ──────────────────────────────────────────
    {
        "category": "urgency_creation",
        "text": "Ethical urgency creation: Only use real urgency — ending incentives, actual competing buyers, allocation limits, rising rates. Say: 'I'm not trying to create pressure, but I'd be doing you a disservice if I didn't tell you that this manufacturer incentive ends Friday and there's no guarantee it's coming back.' Honesty builds trust AND urgency.",
    },
    {
        "category": "urgency_creation",
        "text": "The 'What's Stopping You' urgency: 'If I could get you the exact payment you're comfortable with, on this exact vehicle, today — would there be any reason we couldn't make this happen?' This isolates the final objection and creates a natural close.",
    },

    # ── RAPPORT BUILDING ──────────────────────────────────────────
    {
        "category": "rapport_building",
        "text": "The 'Trusted Advisor' frame: Position yourself as a consultant, not a salesperson. 'My job isn't to sell you a car — my job is to make sure you drive the right vehicle for your life. If this isn't it, I'll tell you. I'd rather earn your trust than a commission.' This disarms skepticism and builds long-term loyalty.",
    },
    {
        "category": "rapport_building",
        "text": "Mirroring technique for automotive: When a customer describes what they want, repeat it back with enthusiasm: 'So you need something that's safe for the family, has great fuel economy, but still feels fun to drive? Let me show you exactly why I had this vehicle in mind for you.' Validation + enthusiasm = trust.",
    },

    # ── COMPETITOR DEFENSE ────────────────────────────────────────
    {
        "category": "competitor_defense",
        "text": "Never badmouth the competition. Instead, use the 'Spotlight Technique': 'That's a great vehicle, and I can see why you'd consider it. Let me show you three things about ours that most people don't discover until they've owned both. After that, the decision will be crystal clear.' Elevate, don't tear down.",
    },
    {
        "category": "competitor_defense",
        "text": "Total cost of ownership comparison: 'The sticker price is just one piece of the puzzle. Let me pull up the 5-year cost comparison — insurance, maintenance, fuel, depreciation, and resale value. When you see the full picture, the real value becomes obvious.' This wins over analytical buyers every time.",
    },

    # ── VALUE FRAMING ────────────────────────────────────────────
    {
        "category": "value_framing",
        "text": "The Daily Cost Reframe: 'I know $45,000 sounds like a lot. But let me break it down — over a 60-month term, that's $750 a month, which is about $25 a day. That's less than your daily Starbucks run for a vehicle that keeps your family safe and puts a smile on your face every time you drive it.' Make big numbers small.",
    },
    {
        "category": "value_framing",
        "text": "The Investment Frame: 'You're not spending money — you're putting it into an asset that gives you transportation, safety, comfort, and resale value. In 3 years, this vehicle will still be worth 65% of what you paid. That's better than most investments. Let me show you the depreciation curve.' Position the car as smart money.",
    },
]


# ═══════════════════════════════════════════════════════════════════
# SEED FUNCTION
# ═══════════════════════════════════════════════════════════════════

async def seed_knowledge_base(vector_service) -> int:
    """Seed the knowledge base with elite automotive sales content.
    Returns the number of new entries added."""
    added = 0
    for entry in SALES_KNOWLEDGE:
        try:
            await vector_service.add_knowledge(
                text=entry["text"],
                category=entry["category"],
                metadata={"source": "sales_playbook_v1"},
            )
            added += 1
        except Exception as e:
            # Duplicate entries are expected on re-seed
            logger.debug(f"Knowledge seed skip: {e}")
    
    # Rebuild IDF weights after seeding
    await vector_service._rebuild_idf()
    logger.info(f"Sales knowledge base seeded: {added} entries, IDF rebuilt")
    return added
