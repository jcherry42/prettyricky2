"""
JSON Parser
Handles various JSON structures with automatic data extraction
"""

import json
from typing import List, Dict, Any, Tuple, Optional
from .base import BaseParser, ParseResult


class JSONParser(BaseParser):
    """
    Robust JSON parser that handles:
    - Arrays of objects
    - Nested data structures
    - Single objects
    - Common wrapper patterns
    """
    
    # Common wrapper keys to look for data arrays
    WRAPPER_KEYS = [
        'data', 'records', 'results', 'items', 'rows',
        'customers', 'leads', 'contacts', 'prospects',
        'vehicles', 'inventory', 'units', 'cars',
        'entries', 'list', 'content', 'response'
    ]
    
    async def parse(self, content: str) -> ParseResult:
        """Parse JSON content"""
        errors = []
        warnings = []
        rows = []
        headers = []
        
        try:
            # Parse JSON
            data = json.loads(content)
            
            # Extract array of records
            records = self._extract_records(data, warnings)
            
            if not records:
                return ParseResult(
                    success=False,
                    headers=[],
                    rows=[],
                    total_rows=0,
                    errors=["No data records found in JSON"],
                    warnings=warnings
                )
            
            # Flatten nested objects if needed
            flattened = []
            for i, record in enumerate(records):
                if i >= self.MAX_ROWS:
                    warnings.append(f"Stopped at row {self.MAX_ROWS} (limit reached)")
                    break
                    
                if isinstance(record, dict):
                    flat_record = self._flatten_dict(record)
                    flattened.append(flat_record)
                else:
                    if len(errors) < self.MAX_ERRORS:
                        errors.append(f"Row {i}: Expected object, got {type(record).__name__}")
            
            # Extract headers from all records (union of keys)
            all_keys = set()
            for record in flattened:
                all_keys.update(record.keys())
            headers = sorted(list(all_keys))
            
            # Clean values
            for record in flattened:
                cleaned = {}
                for key in headers:
                    value = record.get(key, "")
                    cleaned[key] = self.clean_value(value)
                rows.append(cleaned)
            
            return ParseResult(
                success=True,
                headers=headers,
                rows=rows,
                total_rows=len(rows),
                errors=errors,
                warnings=warnings
            )
            
        except json.JSONDecodeError as e:
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                errors=[f"Invalid JSON: {str(e)}"],
                warnings=warnings
            )
        except Exception as e:
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                errors=[f"Unexpected error: {str(e)}"],
                warnings=warnings
            )
    
    def can_parse(self, content: str) -> Tuple[bool, float]:
        """Check if content is valid JSON"""
        if not content or not content.strip():
            return False, 0.0
        
        stripped = content.strip()
        
        # Quick check for JSON indicators
        if not stripped.startswith(('{', '[')):
            return False, 0.0
        
        try:
            json.loads(content)
            return True, 0.95
        except json.JSONDecodeError:
            return False, 0.0
    
    def _extract_records(self, data: Any, warnings: List[str]) -> List[Dict]:
        """Extract array of records from various JSON structures"""
        
        # Already an array
        if isinstance(data, list):
            return data
        
        # Object - look for common wrapper keys
        if isinstance(data, dict):
            # Check wrapper keys
            for key in self.WRAPPER_KEYS:
                if key in data and isinstance(data[key], list):
                    warnings.append(f"Extracted data from '{key}' field")
                    return data[key]
            
            # Check for any list value
            for key, value in data.items():
                if isinstance(value, list) and len(value) > 0:
                    if isinstance(value[0], dict):
                        warnings.append(f"Extracted data from '{key}' field")
                        return value
            
            # Single record
            return [data]
        
        return []
    
    def _flatten_dict(self, d: Dict, parent_key: str = '', sep: str = '_') -> Dict:
        """Flatten nested dictionaries"""
        items = []
        
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            
            if isinstance(v, dict):
                # Don't over-flatten - only go one level deep
                for sub_k, sub_v in v.items():
                    items.append((f"{new_key}{sep}{sub_k}", sub_v))
            elif isinstance(v, list):
                # Convert lists to string representation
                if all(isinstance(x, (str, int, float, bool, type(None))) for x in v):
                    items.append((new_key, ', '.join(str(x) for x in v)))
                else:
                    items.append((new_key, json.dumps(v)))
            else:
                items.append((new_key, v))
        
        return dict(items)
