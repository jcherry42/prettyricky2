"""
Vision Extraction Service - Enterprise-Grade
Powered by GPT-5.1 (Elite Vision Model)
Extracts customer data from screenshots and images
"""

import os
import base64
import json
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from ai_gateway import gateway as ai_gateway

load_dotenv()

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY', '')

# System prompt for elite data extraction
EXTRACTION_SYSTEM_PROMPT = """You are an elite data extraction specialist for an automotive sales application.

Your task is to analyze images (screenshots, photos, scanned documents) and extract customer information with perfect accuracy.

Extract these fields when present:
- firstName: First name
- lastName: Last name  
- email: Email address
- phone: Phone number (format: XXX-XXX-XXXX if possible)
- address: Full address
- vehicleOfInterest: Any vehicle mentioned (make, model, year)
- policyNumber: Insurance policy number
- tradeVin: Trade-in vehicle VIN
- tradeMileage: Trade-in vehicle mileage
- leadSource: Where the lead came from
- leadStatus: Status (new, contacted, qualified, etc.)
- notes: Any additional relevant information

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no extra text
2. Use null for missing fields, never omit them
3. Normalize phone numbers to XXX-XXX-XXXX format
4. Extract vehicle info even if partial (e.g., "interested in Corvette" → vehicleOfInterest: "Corvette")
5. If the image contains no customer data, return all fields as null
6. Be intelligent about context (e.g., "John Smith, 555-1234" → firstName: "John", lastName: "Smith", phone: "555-1234")

Return format:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "address": "string or null",
  "vehicleOfInterest": "string or null",
  "policyNumber": "string or null",
  "tradeVin": "string or null",
  "tradeMileage": "string or null",
  "leadSource": "string or null",
  "leadStatus": "string or null",
  "notes": "string or null"
}
"""


class VisionExtractionService:
    """Enterprise-grade vision extraction using GPT-5.1"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or EMERGENT_LLM_KEY
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
    
    async def extract_customer_data(
        self, 
        image_base64: str, 
        additional_context: str = None
    ) -> Dict[str, Any]:
        """
        Extract customer data from base64 encoded image
        
        Args:
            image_base64: Base64 encoded image (PNG, JPEG, WEBP)
            additional_context: Optional context to help extraction
            
        Returns:
            Dict with extracted customer fields
        """
        try:
            # Build extraction prompt
            prompt = "Extract all customer information from this image."
            if additional_context:
                prompt += f"\n\nAdditional context: {additional_context}"

            logger.info("Sending image to AI Gateway [extraction] for data extraction...")
            response = await ai_gateway.chat(
                feature='extraction',
                prompt=prompt,
                system_message=EXTRACTION_SYSTEM_PROMPT,
                images=[image_base64],
            )

            logger.info(f"Extraction response: {response}")
            
            # Parse JSON response
            try:
                # Try to extract JSON from response
                response_text = response.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1])
                
                extracted_data = json.loads(response_text)
                
                # Validate structure
                required_fields = [
                    'firstName', 'lastName', 'email', 'phone', 'address',
                    'vehicleOfInterest', 'policyNumber', 'tradeVin', 
                    'tradeMileage', 'leadSource', 'leadStatus', 'notes'
                ]
                
                for field in required_fields:
                    if field not in extracted_data:
                        extracted_data[field] = None
                
                return {
                    "success": True,
                    "data": extracted_data,
                    "confidence": "high"
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from vision model: {e}")
                logger.error(f"Raw response: {response}")
                return {
                    "success": False,
                    "error": "Failed to parse extracted data",
                    "raw_response": response
                }
                
        except Exception as e:
            logger.error(f"Vision extraction error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def validate_image_format(self, image_base64: str) -> bool:
        """
        Validate image is in acceptable format (PNG, JPEG, WEBP)
        """
        try:
            # Decode base64 to check format
            image_data = base64.b64decode(image_base64)
            
            # Check magic bytes for format
            if image_data.startswith(b'\x89PNG'):
                return True  # PNG
            elif image_data.startswith(b'\xff\xd8\xff'):
                return True  # JPEG
            elif image_data.startswith(b'RIFF') and b'WEBP' in image_data[:12]:
                return True  # WEBP
            
            return False
            
        except Exception:
            return False


# Singleton instance
_vision_service = None

def get_vision_service() -> VisionExtractionService:
    """Get or create vision service instance"""
    global _vision_service
    if _vision_service is None:
        _vision_service = VisionExtractionService()
    return _vision_service
