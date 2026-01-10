"""
Google Sheets Parser
Fetches and parses public Google Sheets as CSV
"""

import re
from typing import Tuple, Optional
import httpx

from .base import BaseParser, ParseResult
from .csv_parser import CSVParser


class GoogleSheetsParser(BaseParser):
    """
    Parses public Google Sheets by:
    1. Converting sharing URL to CSV export URL
    2. Fetching the CSV content
    3. Parsing with CSV parser
    """
    
    # Pattern to extract sheet ID
    SHEET_ID_PATTERN = re.compile(r'/d/([a-zA-Z0-9-_]+)')
    GID_PATTERN = re.compile(r'gid=(\d+)')
    
    def __init__(self):
        self.csv_parser = CSVParser()
    
    async def parse(self, content: str) -> ParseResult:
        """
        Parse content as Google Sheets URL
        
        Note: 'content' here is actually the URL
        """
        url = content.strip()
        
        try:
            # Convert URL to CSV export format
            csv_url = self._convert_to_csv_url(url)
            
            if not csv_url:
                return ParseResult(
                    success=False,
                    headers=[],
                    rows=[],
                    total_rows=0,
                    errors=["Could not parse Google Sheets URL"],
                    warnings=[]
                )
            
            # Fetch CSV content
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(csv_url)
                response.raise_for_status()
                csv_content = response.text
            
            # Parse with CSV parser
            result = await self.csv_parser.parse(csv_content)
            
            # Add source info
            if result.success:
                result.warnings.insert(0, f"Fetched from Google Sheets")
            
            return result
            
        except httpx.HTTPStatusError as e:
            error_msg = "Google Sheets access denied"
            if e.response.status_code == 404:
                error_msg = "Google Sheet not found or not public"
            elif e.response.status_code == 403:
                error_msg = "Google Sheet is not shared publicly"
            
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                errors=[error_msg],
                warnings=[]
            )
        except httpx.RequestError as e:
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                errors=[f"Failed to connect to Google Sheets: {str(e)}"],
                warnings=[]
            )
        except Exception as e:
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                errors=[f"Error fetching Google Sheet: {str(e)}"],
                warnings=[]
            )
    
    def can_parse(self, content: str) -> Tuple[bool, float]:
        """Check if content is a Google Sheets URL"""
        url = content.strip().lower()
        
        if 'docs.google.com/spreadsheets' in url:
            # Verify we can extract sheet ID
            if self.SHEET_ID_PATTERN.search(content):
                return True, 0.95
            return True, 0.7
        
        return False, 0.0
    
    def _convert_to_csv_url(self, url: str) -> Optional[str]:
        """Convert Google Sheets URL to CSV export URL"""
        
        # Extract sheet ID
        match = self.SHEET_ID_PATTERN.search(url)
        if not match:
            return None
        
        sheet_id = match.group(1)
        
        # Extract specific sheet (gid) if present
        gid_match = self.GID_PATTERN.search(url)
        gid = gid_match.group(1) if gid_match else '0'
        
        # Build CSV export URL
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    
    @staticmethod
    def is_google_sheets_url(url: str) -> bool:
        """Quick check if URL is a Google Sheets URL"""
        return 'docs.google.com/spreadsheets' in url.lower()
