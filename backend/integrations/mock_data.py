"""
Mock Data Generator for CRM Integration Testing
Provides realistic automotive dealership data for testing without real CRM credentials
"""

import random
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import uuid


# Sample data pools
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Andrew", "Emily", "Joshua", "Donna", "Kenneth", "Michelle",
    "Kevin", "Carol", "Brian", "Amanda", "George", "Dorothy", "Timothy", "Melissa"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
]

CITIES = [
    ("Los Angeles", "CA", "90001"), ("Houston", "TX", "77001"), ("Phoenix", "AZ", "85001"),
    ("San Antonio", "TX", "78201"), ("San Diego", "CA", "92101"), ("Dallas", "TX", "75201"),
    ("San Jose", "CA", "95101"), ("Austin", "TX", "78701"), ("Jacksonville", "FL", "32099"),
    ("Fort Worth", "TX", "76101"), ("Columbus", "OH", "43085"), ("Charlotte", "NC", "28201"),
    ("Seattle", "WA", "98101"), ("Denver", "CO", "80201"), ("Portland", "OR", "97201"),
    ("Oklahoma City", "OK", "73101"), ("Las Vegas", "NV", "89101"), ("Miami", "FL", "33101"),
    ("Atlanta", "GA", "30301"), ("Tampa", "FL", "33601"), ("Nashville", "TN", "37201")
]

STREET_NAMES = [
    "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine St", "Elm St", "Washington Blvd",
    "Lincoln Ave", "Park Dr", "Lake Rd", "River Rd", "Mountain View Dr", "Sunset Blvd",
    "Highland Ave", "Valley Rd", "Ridge Rd", "Forest Dr", "Meadow Ln", "Spring St"
]

LEAD_SOURCES = [
    "Website", "Walk-In", "Phone", "Referral", "AutoTrader", "Cars.com", "CarGurus",
    "Facebook", "Google Ads", "Email Campaign", "Service Department", "Previous Customer",
    "TrueCar", "Edmunds", "Trade-In Lead", "Lease Return", "Finance Application"
]

LEAD_STATUSES = ["new", "hot", "warm", "cold", "sold", "lost"]

# Vehicle data
MAKES_MODELS = {
    "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "4Runner", "Tundra", "Sienna", "Prius"],
    "Honda": ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "HR-V", "Ridgeline", "Passport"],
    "Ford": ["F-150", "Escape", "Explorer", "Mustang", "Bronco", "Edge", "Expedition", "Ranger"],
    "Chevrolet": ["Silverado", "Equinox", "Traverse", "Tahoe", "Suburban", "Malibu", "Camaro", "Colorado"],
    "Nissan": ["Altima", "Rogue", "Sentra", "Pathfinder", "Murano", "Titan", "Frontier", "Kicks"],
    "Hyundai": ["Tucson", "Santa Fe", "Elantra", "Sonata", "Palisade", "Kona", "Ioniq"],
    "Kia": ["Sorento", "Sportage", "Telluride", "K5", "Forte", "Seltos", "Carnival"],
    "Subaru": ["Outback", "Forester", "Crosstrek", "Ascent", "Impreza", "Legacy", "WRX"],
    "Mazda": ["CX-5", "CX-9", "Mazda3", "CX-30", "MX-5 Miata", "CX-50"],
    "Volkswagen": ["Jetta", "Tiguan", "Atlas", "ID.4", "Taos", "Golf GTI"],
    "BMW": ["3 Series", "5 Series", "X3", "X5", "X1", "4 Series", "7 Series"],
    "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "A-Class", "S-Class"],
    "Audi": ["A4", "A6", "Q5", "Q7", "Q3", "e-tron", "A3"],
    "Lexus": ["RX", "NX", "ES", "IS", "GX", "UX", "LS"],
    "Jeep": ["Grand Cherokee", "Wrangler", "Cherokee", "Compass", "Gladiator", "Renegade"],
    "Ram": ["1500", "2500", "3500", "ProMaster"],
    "GMC": ["Sierra", "Terrain", "Acadia", "Yukon", "Canyon"],
    "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"]
}

TRIMS = ["Base", "LE", "SE", "XLE", "Limited", "Sport", "Premium", "Platinum", "Touring", "GT", "RS"]

EXTERIOR_COLORS = [
    "Crystal White", "Midnight Black", "Silver Metallic", "Lunar Gray", "Supersonic Red",
    "Deep Blue Pearl", "Magnetic Gray", "Wind Chill Pearl", "Celestial Silver", "Blueprint",
    "Ice Edge", "Ruby Flare Pearl", "Galactic Aqua", "Army Green", "Sunset Bronze"
]

INTERIOR_COLORS = ["Black", "Gray", "Tan", "Beige", "Brown", "Red", "White", "Cream", "Charcoal"]

TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual-Clutch", "8-Speed Auto", "10-Speed Auto"]

ENGINES = [
    "2.5L 4-Cylinder", "3.5L V6", "2.0L Turbo 4-Cylinder", "5.7L V8", "2.4L Hybrid",
    "3.0L Twin-Turbo V6", "5.0L V8", "Electric Motor", "2.5L Hybrid", "3.6L V6"
]

FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Plug-In Hybrid", "Electric", "Flex Fuel"]

DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"]


class MockDataGenerator:
    """
    Generates realistic mock data for automotive CRM testing
    
    Usage:
        generator = MockDataGenerator(seed=42)  # Optional seed for reproducibility
        customers = generator.generate_customers(count=50)
        vehicles = generator.generate_vehicles(count=100)
    """
    
    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            random.seed(seed)
    
    def generate_customer(self) -> Dict[str, Any]:
        """Generate a single customer/lead record"""
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        city, state, zip_base = random.choice(CITIES)
        
        # Generate vehicle of interest
        make = random.choice(list(MAKES_MODELS.keys()))
        model = random.choice(MAKES_MODELS[make])
        year = random.randint(2022, 2025)
        
        # Random creation date within last 90 days
        days_ago = random.randint(0, 90)
        created_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
        
        return {
            "source_row_id": str(uuid.uuid4()),
            "first_name": first_name,
            "last_name": last_name,
            "full_name": f"{first_name} {last_name}",
            "email": f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}@example.com",
            "phone": self._generate_phone(),
            "address": f"{random.randint(100, 9999)} {random.choice(STREET_NAMES)}",
            "city": city,
            "state": state,
            "zip": f"{zip_base[:3]}{random.randint(10, 99)}",
            "vehicle_of_interest": f"{year} {make} {model}",
            "lead_status": random.choice(LEAD_STATUSES),
            "source": random.choice(LEAD_SOURCES),
            "current_vehicle": self._generate_trade_in() if random.random() > 0.5 else None,
            "trade_in_info": self._generate_trade_value() if random.random() > 0.6 else None,
            "notes": self._generate_notes() if random.random() > 0.3 else None,
            "created_at": created_at.isoformat(),
            "updated_at": created_at.isoformat(),
        }
    
    def generate_customers(self, count: int = 50) -> List[Dict[str, Any]]:
        """Generate multiple customer records"""
        return [self.generate_customer() for _ in range(count)]
    
    def generate_vehicle(self, is_new: Optional[bool] = None) -> Dict[str, Any]:
        """Generate a single vehicle inventory record"""
        make = random.choice(list(MAKES_MODELS.keys()))
        model = random.choice(MAKES_MODELS[make])
        
        if is_new is None:
            is_new = random.random() > 0.4  # 60% new
        
        year = random.randint(2024, 2025) if is_new else random.randint(2018, 2024)
        
        # Pricing
        base_price = self._get_base_price(make)
        if is_new:
            msrp = base_price + random.randint(0, 15000)
            price = msrp - random.randint(0, 3000)  # Slight discount
            mileage = random.randint(0, 50)  # Demo miles
        else:
            msrp = base_price + random.randint(-5000, 10000)
            price = msrp - random.randint(5000, 20000)
            mileage = random.randint(15000, 90000)
        
        return {
            "source_row_id": str(uuid.uuid4()),
            "vin": self._generate_vin(),
            "stock_number": f"{'N' if is_new else 'U'}{random.randint(10000, 99999)}",
            "year": year,
            "make": make,
            "model": model,
            "trim": random.choice(TRIMS),
            "body_style": self._get_body_style(model),
            "price": round(price, 2),
            "msrp": round(msrp, 2) if is_new else None,
            "mileage": mileage,
            "exterior_color": random.choice(EXTERIOR_COLORS),
            "interior_color": random.choice(INTERIOR_COLORS),
            "transmission": random.choice(TRANSMISSIONS),
            "engine": random.choice(ENGINES),
            "fuel_type": random.choice(FUEL_TYPES),
            "drivetrain": random.choice(DRIVETRAINS),
            "status": "available",
            "is_new": is_new,
            "image_url": f"https://example.com/images/vehicles/{uuid.uuid4()}.jpg",
            "days_in_inventory": random.randint(1, 90),
        }
    
    def generate_vehicles(self, count: int = 100, new_ratio: float = 0.6) -> List[Dict[str, Any]]:
        """Generate multiple vehicle records"""
        vehicles = []
        for _ in range(count):
            is_new = random.random() < new_ratio
            vehicles.append(self.generate_vehicle(is_new))
        return vehicles
    
    def _generate_phone(self) -> str:
        """Generate a realistic US phone number"""
        area = random.randint(200, 999)
        prefix = random.randint(200, 999)
        line = random.randint(1000, 9999)
        return f"+1{area}{prefix}{line}"
    
    def _generate_vin(self) -> str:
        """Generate a realistic-looking VIN (not valid, but proper format)"""
        chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
        # WMI (3) + VDS (6) + VIS (8) = 17 characters
        return ''.join(random.choice(chars) for _ in range(17))
    
    def _generate_trade_in(self) -> str:
        """Generate a trade-in vehicle description"""
        make = random.choice(list(MAKES_MODELS.keys()))
        model = random.choice(MAKES_MODELS[make])
        year = random.randint(2015, 2022)
        return f"{year} {make} {model}"
    
    def _generate_trade_value(self) -> str:
        """Generate trade-in value estimate"""
        value = random.randint(5000, 35000)
        return f"Est. ${value:,}"
    
    def _generate_notes(self) -> str:
        """Generate sample notes"""
        notes = [
            "Customer interested in financing options. Needs low monthly payment.",
            "Trade-in needs appraisal. Customer wants top dollar.",
            "Returning customer - previously purchased a Civic in 2019.",
            "Wants to test drive this weekend. Has pre-approval from credit union.",
            "First-time buyer. Needs guidance on the process.",
            "Shopping for daughter going to college.",
            "Business owner looking for fleet vehicles.",
            "Lease is ending next month. Wants to compare purchase options.",
            "Very price sensitive. Has competing quote from another dealer.",
            "Relocating to area. Needs vehicle ASAP.",
            "Looking for a reliable daily driver.",
            "Interested in towing package for boat.",
            "Upgrading from sedan to SUV for growing family.",
        ]
        return random.choice(notes)
    
    def _get_base_price(self, make: str) -> int:
        """Get base price range by make"""
        luxury = {"BMW", "Mercedes-Benz", "Audi", "Lexus", "Tesla"}
        mid_range = {"Toyota", "Honda", "Subaru", "Mazda", "Volkswagen"}
        
        if make in luxury:
            return random.randint(45000, 80000)
        elif make in mid_range:
            return random.randint(28000, 50000)
        else:
            return random.randint(25000, 55000)
    
    def _get_body_style(self, model: str) -> str:
        """Determine body style from model name"""
        suv_keywords = ["RAV4", "CR-V", "Escape", "Explorer", "Rogue", "Tucson", "Sorento", "Outback", "CX-5", "Tiguan", "X3", "X5", "Q5", "RX", "Cherokee", "Terrain"]
        truck_keywords = ["F-150", "Silverado", "Tacoma", "Tundra", "Titan", "Ranger", "Colorado", "Sierra", "1500", "2500", "Ridgeline", "Frontier", "Gladiator", "Canyon"]
        sedan_keywords = ["Camry", "Accord", "Civic", "Corolla", "Altima", "Sentra", "Jetta", "Malibu", "Sonata", "3 Series", "C-Class", "A4", "ES"]
        
        model_upper = model.upper()
        for kw in suv_keywords:
            if kw.upper() in model_upper:
                return "SUV"
        for kw in truck_keywords:
            if kw.upper() in model_upper:
                return "Truck"
        for kw in sedan_keywords:
            if kw.upper() in model_upper:
                return "Sedan"
        
        return random.choice(["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Van"])


# Singleton instance for easy access
_generator = MockDataGenerator()

def get_mock_customers(count: int = 50, seed: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get mock customer data"""
    gen = MockDataGenerator(seed) if seed else _generator
    return gen.generate_customers(count)

def get_mock_vehicles(count: int = 100, seed: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get mock vehicle data"""
    gen = MockDataGenerator(seed) if seed else _generator
    return gen.generate_vehicles(count)
