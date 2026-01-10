"""
CSV Parser
Handles various CSV formats with encoding detection and error recovery
"""

import csv
import io
from typing import List, Dict, Any, Tuple
from .base import BaseParser, ParseResult


class CSVParser(BaseParser):
    """
    Robust CSV parser with:
    - Automatic delimiter detection
    - Encoding handling
    - Row-level error recovery
    - Malformed data handling
    """
    
    COMMON_DELIMITERS = [',', '\t', ';', '|']
    
    async def parse(self, content: str) -> ParseResult:
        """Parse CSV content"""
        errors = []
        warnings = []
        rows = []
        headers = []
        
        try:
            # Detect delimiter
            delimiter = self._detect_delimiter(content)
            
            # Handle potential BOM
            if content.startswith('\ufeff'):
                content = content[1:]
                warnings.append("Removed UTF-8 BOM from file")
            
            # Parse CSV
            reader = csv.DictReader(
                io.StringIO(content),
                delimiter=delimiter,
                quoting=csv.QUOTE_MINIMAL,
                skipinitialspace=True
            )
            
            # Get headers
            if reader.fieldnames:
                headers = [self.clean_header(h) for h in reader.fieldnames if h]
            
            if not headers:
                return ParseResult(
                    success=False,
                    headers=[],
                    rows=[],
                    total_rows=0,
                    errors=["No headers found in CSV file"],
                    warnings=warnings
                )
            
            # Check for duplicate headers
            seen_headers = set()
            for h in headers:
                if h in seen_headers:
                    warnings.append(f"Duplicate header found: {h}")
                seen_headers.add(h)
            
            # Parse rows with error recovery
            row_num = 0
            for row in reader:
                row_num += 1
                
                if row_num > self.MAX_ROWS:
                    warnings.append(f"Stopped at row {self.MAX_ROWS} (limit reached)")
                    break
                
                try:
                    # Clean row values
                    cleaned_row = {}
                    for key, value in row.items():
                        if key:
                            cleaned_key = self.clean_header(key)
                            cleaned_row[cleaned_key] = self.clean_value(value)
                    
                    # Skip completely empty rows
                    if not any(cleaned_row.values()):
                        continue
                    
                    rows.append(cleaned_row)
                    
                except Exception as e:
                    if len(errors) < self.MAX_ERRORS:
                        errors.append(f"Row {row_num}: {str(e)}")
            
            return ParseResult(
                success=True,
                headers=headers,
                rows=rows,
                total_rows=len(rows),
                errors=errors,
                warnings=warnings
            )
            
        except csv.Error as e:
            return ParseResult(
                success=False,
                headers=headers,
                rows=rows,
                total_rows=len(rows),
                errors=[f"CSV parsing error: {str(e)}"],
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
        """Check if content looks like CSV"""
        if not content or not content.strip():
            return False, 0.0
        
        # Check if it's obviously JSON
        stripped = content.strip()
        if stripped.startswith(('{', '[')):
            return False, 0.0
        
        # Check for common CSV patterns
        lines = content.split('\n')[:5]
        if not lines:
            return False, 0.0
        
        # Try to detect delimiter
        delimiter = self._detect_delimiter(content)
        
        # Count consistency of columns
        first_line_cols = len(lines[0].split(delimiter))
        
        if first_line_cols < 2:
            return False, 0.3
        
        consistent_cols = sum(
            1 for line in lines[1:4]
            if line.strip() and len(line.split(delimiter)) == first_line_cols
        )
        
        confidence = 0.5 + (consistent_cols * 0.15)
        return True, min(confidence, 0.95)
    
    def _detect_delimiter(self, content: str) -> str:
        """Detect the most likely delimiter"""
        first_line = content.split('\n')[0] if content else ""
        
        delimiter_counts = {}
        for delim in self.COMMON_DELIMITERS:
            count = first_line.count(delim)
            delimiter_counts[delim] = count
        
        # Return delimiter with highest count, default to comma
        if delimiter_counts:
            best_delim = max(delimiter_counts, key=delimiter_counts.get)
            if delimiter_counts[best_delim] > 0:
                return best_delim
        
        return ','
