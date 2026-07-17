"""\
Printer Routes v3 — Professional Print Engine

Generates dealership-branded PDFs and optionally submits them via IPP.
Every print endpoint returns the PDF as base64 so the mobile client
can display a preview or share via the OS share sheet.

Endpoints:
  POST /printer/test           — Test IPP connectivity
  POST /print/customer         — Customer profile PDF
  POST /print/license          — Driver's license image PDF
  POST /print/vehicle          — VIN-decoded vehicle spec sheet
  POST /print/preview          — Generic preview (returns PDF base64 only, no print)
  POST /printer/print          — Legacy compat endpoint
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from reportlab.lib.utils import simpleSplit  # imported once at module level

router = APIRouter()
logger = logging.getLogger("printer_v3")

_db = None


def init_printer_routes(db):
    global _db
    _db = db


# ─── Request Models ──────────────────────────────────────────────────────────

class PrinterTestRequest(BaseModel):
    ip: str = Field(..., description="Printer IP address")

class PrintJobRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image data")
    printer_ip: str = Field(..., description="Printer IP address")

class CustomerPrintRequest(BaseModel):
    customer_id: str = Field(..., description="Customer ID to print")
    printer_ip: Optional[str] = Field("", description="Printer IP address (optional — omit to generate PDF only)")

class VehiclePrintRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any] = {}
    category: str = "active_inventory"
    printer_ip: str = ""

class PreviewRequest(BaseModel):
    type: str = Field(..., description="'customer' | 'license' | 'vehicle'")
    customer_id: Optional[str] = None
    image_data: Optional[str] = None
    vin: Optional[str] = None
    vehicle_data: Optional[Dict[str, Any]] = None

class PrinterGenericPrintRequest(BaseModel):
    type: str
    printer_ip: str
    vehicle: Optional[Dict[str, Any]] = None


# ─── PDF Generation Helpers ──────────────────────────────────────────────────

def _brand_colors():
    """Dealership brand palette."""
    return {
        "bg_dark": (10, 12, 18),
        "gold": (214, 178, 94),
        "gold_dim": (171, 142, 75),
        "text": (40, 40, 40),
        "text_dim": (120, 120, 120),
        "white": (255, 255, 255),
        "border": (200, 200, 200),
    }


def _hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))


def _draw_header(c, page_width, page_height, title, dealership_name="", dealership_address="", sales_rep=""):
    """Draw a premium branded header bar."""
    from reportlab.lib.units import inch

    brand = _brand_colors()

    # Gold accent bar at top
    c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.rect(0, page_height - 0.08*inch, page_width, 0.08*inch, fill=1, stroke=0)

    # Dark header band
    c.setFillColorRGB(brand["bg_dark"][0]/255, brand["bg_dark"][1]/255, brand["bg_dark"][2]/255)
    c.rect(0, page_height - 1.0*inch, page_width, 0.92*inch, fill=1, stroke=0)

    # Title text
    c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(0.75*inch, page_height - 0.55*inch, title.upper())

    # Dealership info (right-aligned)
    if dealership_name:
        c.setFillColorRGB(brand["white"][0]/255, brand["white"][1]/255, brand["white"][2]/255)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(page_width - 0.75*inch, page_height - 0.42*inch, dealership_name)
    if dealership_address:
        c.setFillColorRGB(0.75, 0.75, 0.75)  # dimmed white — ReportLab ignores alpha in setFillColorRGB
        c.setFont("Helvetica", 8)
        c.drawRightString(page_width - 0.75*inch, page_height - 0.58*inch, dealership_address)
    if sales_rep:
        c.setFont("Helvetica", 8)
        c.drawRightString(page_width - 0.75*inch, page_height - 0.72*inch, f"Rep: {sales_rep}")

    return page_height - 1.2*inch  # Return Y cursor after header


def _draw_footer(c, page_width):
    """Draw timestamp footer."""
    from reportlab.lib.units import inch
    brand = _brand_colors()

    c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.rect(0, 0, page_width, 0.04*inch, fill=1, stroke=0)

    timestamp = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    c.setFillColorRGB(brand["text_dim"][0]/255, brand["text_dim"][1]/255, brand["text_dim"][2]/255)
    c.setFont("Helvetica", 8)
    c.drawCentredString(page_width / 2, 0.25*inch, f"Generated {timestamp}")


def _draw_section(c, y, page_width, title):
    """Draw a section divider with title."""
    from reportlab.lib.units import inch
    brand = _brand_colors()

    y -= 0.15*inch

    # Gold accent line
    c.setStrokeColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.setLineWidth(1.5)
    c.line(0.75*inch, y, page_width - 0.75*inch, y)

    y -= 0.22*inch
    c.setFillColorRGB(brand["gold_dim"][0]/255, brand["gold_dim"][1]/255, brand["gold_dim"][2]/255)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(0.75*inch, y, title.upper())

    return y - 0.22*inch


def _draw_field(c, y, label, value, page_width, bold_value=False):
    """Draw a label: value row."""
    from reportlab.lib.units import inch
    brand = _brand_colors()

    c.setFillColorRGB(brand["text_dim"][0]/255, brand["text_dim"][1]/255, brand["text_dim"][2]/255)
    c.setFont("Helvetica", 9)
    c.drawString(0.85*inch, y, label)

    c.setFillColorRGB(brand["text"][0]/255, brand["text"][1]/255, brand["text"][2]/255)
    font = "Helvetica-Bold" if bold_value else "Helvetica"
    c.setFont(font, 10)
    c.drawString(2.75*inch, y, str(value) if value else "—")

    return y - 0.28*inch


def _check_page_overflow(c, y, page_width, page_height, margin=1.0):
    """
    If y has gone below the bottom margin, save the current page and start a new one.
    Returns the new y cursor positioned at the top of the fresh page.
    ReportLab does not do this automatically — omitting this causes content to render off-page.
    """
    from reportlab.lib.units import inch
    if y < margin * inch:
        c.showPage()
        # Re-draw the footer's gold bar on every page
        from reportlab.lib.units import inch as _inch
        brand = _brand_colors()
        c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
        c.rect(0, 0, page_width, 0.04*_inch, fill=1, stroke=0)
        return page_height - 0.75 * inch  # reset y to top of new page
    return y


async def _get_dealership_settings():
    """Retrieve dealership personalize settings from DB or return defaults."""
    if _db is None:
        return "", "", ""
    try:
        settings = await _db.app_settings.find_one({"key": "personalize"})
        if settings:
            return (
                settings.get("dealership_name", ""),
                settings.get("dealership_address", ""),
                settings.get("sales_rep_name", ""),
            )
    except Exception:
        pass
    return "", "", ""


# ─── PDF Builders ────────────────────────────────────────────────────────────

async def _build_customer_pdf(customer: dict) -> bytes:
    """Build a professional customer profile PDF."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch

    dealership_name, dealership_address, sales_rep = await _get_dealership_settings()

    first = (customer.get("first_name") or "").strip()
    last = (customer.get("last_name") or "").strip()
    name = f"{first} {last}".strip() or customer.get("name") or "N/A"

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    page_width, page_height = letter

    y = _draw_header(c, page_width, page_height, "Customer Profile",
                     dealership_name, dealership_address, sales_rep)

    # Customer name (large)
    brand = _brand_colors()
    c.setFillColorRGB(brand["text"][0]/255, brand["text"][1]/255, brand["text"][2]/255)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(0.75*inch, y, name)
    y -= 0.20*inch

    lead_status = customer.get("lead_status", "").replace("_", " ").title()
    if lead_status:
        c.setFillColorRGB(brand["gold_dim"][0]/255, brand["gold_dim"][1]/255, brand["gold_dim"][2]/255)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.75*inch, y, f"Status: {lead_status}")
    y -= 0.35*inch

    # Contact section
    y = _draw_section(c, y, page_width, "Contact Information")
    y = _check_page_overflow(c, y, page_width, page_height)
    y = _draw_field(c, y, "Email", customer.get("email"), page_width)
    y = _draw_field(c, y, "Phone", customer.get("phone"), page_width)
    y = _draw_field(c, y, "Address", customer.get("address"), page_width)

    # Vehicle Interest
    vehicle_interest = customer.get("vehicle_of_interest") or customer.get("vehicleInterest")
    if vehicle_interest:
        y = _check_page_overflow(c, y, page_width, page_height)
        y = _draw_section(c, y, page_width, "Vehicle Interest")
        if isinstance(vehicle_interest, dict):
            for k, v in vehicle_interest.items():
                y = _check_page_overflow(c, y, page_width, page_height)
                y = _draw_field(c, y, k.replace("_", " ").title(), v, page_width)
        else:
            y = _draw_field(c, y, "Vehicle", str(vehicle_interest), page_width)

    # Notes
    notes = customer.get("notes")
    if notes:
        y = _check_page_overflow(c, y, page_width, page_height)
        y = _draw_section(c, y, page_width, "Notes")
        c.setFillColorRGB(brand["text"][0]/255, brand["text"][1]/255, brand["text"][2]/255)
        c.setFont("Helvetica", 10)
        # Wrap notes text
        lines = simpleSplit(str(notes), "Helvetica", 10, page_width - 1.5*inch)
        for line in lines[:12]:
            y = _check_page_overflow(c, y, page_width, page_height)
            c.drawString(0.85*inch, y, line)
            y -= 0.18*inch

    # Interactions summary
    interactions = customer.get("interactions") or []
    if interactions:
        y = _check_page_overflow(c, y, page_width, page_height)
        y = _draw_section(c, y, page_width, f"Recent Interactions ({len(interactions)})")
        for ix in interactions[:5]:
            ts = ix.get("timestamp", "")
            msg = ix.get("message", ix.get("note", ""))
            if ts:
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%m/%d/%y")
                except Exception:
                    pass
            line = f"{ts}  —  {msg}" if ts else str(msg)
            c.setFont("Helvetica", 9)
            c.setFillColorRGB(brand["text_dim"][0]/255, brand["text_dim"][1]/255, brand["text_dim"][2]/255)
            wrapped = simpleSplit(line, "Helvetica", 9, page_width - 1.5*inch)
            for wl in wrapped[:2]:
                y = _check_page_overflow(c, y, page_width, page_height)
                c.drawString(0.85*inch, y, wl)
                y -= 0.16*inch
            y -= 0.06*inch

    _draw_footer(c, page_width)
    c.save()
    return pdf_buffer.getvalue()


async def _build_license_pdf(image_data: str) -> bytes:
    """Build a professional driver's license scan PDF.
    Runs the CPU-intensive PIL + ReportLab work in a thread pool
    so it doesn't block the async event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _build_license_pdf_sync, image_data)


def _build_license_pdf_sync(image_data: str) -> bytes:
    """Synchronous inner implementation — called from thread executor."""
    from PIL import Image
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.utils import ImageReader as RLImageReader

    if "base64," in image_data:
        image_data = image_data.split("base64,", 1)[1]

    image_bytes = base64.b64decode(image_data)
    img = Image.open(io.BytesIO(image_bytes))

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    page_width, page_height = letter

    brand = _brand_colors()

    # Header
    c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.rect(0, page_height - 0.08*inch, page_width, 0.08*inch, fill=1, stroke=0)

    c.setFillColorRGB(brand["bg_dark"][0]/255, brand["bg_dark"][1]/255, brand["bg_dark"][2]/255)
    c.rect(0, page_height - 0.85*inch, page_width, 0.77*inch, fill=1, stroke=0)

    c.setFillColorRGB(brand["gold"][0]/255, brand["gold"][1]/255, brand["gold"][2]/255)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(0.75*inch, page_height - 0.52*inch, "DRIVER'S LICENSE SCAN")

    # Image — centered with border
    img_width, img_height = img.size
    max_w = 6.0 * inch
    max_h = 4.0 * inch
    scale = min(max_w / img_width, max_h / img_height)
    new_w = img_width * scale
    new_h = img_height * scale
    x = (page_width - new_w) / 2
    y = page_height - new_h - 1.5*inch

    # Shadow
    c.setFillColorRGB(0.85, 0.85, 0.85)
    c.roundRect(x + 3, y - 3, new_w, new_h, 4, fill=1, stroke=0)

    # Border
    c.setStrokeColorRGB(brand["border"][0]/255, brand["border"][1]/255, brand["border"][2]/255)
    c.setLineWidth(1)
    c.roundRect(x, y, new_w, new_h, 4, fill=0, stroke=1)

    temp_img = io.BytesIO()
    img.save(temp_img, format="PNG")
    temp_img.seek(0)
    c.drawImage(RLImageReader(temp_img), x + 1, y + 1, width=new_w - 2, height=new_h - 2)

    # Metadata below image
    meta_y = y - 0.4*inch
    c.setFillColorRGB(brand["text_dim"][0]/255, brand["text_dim"][1]/255, brand["text_dim"][2]/255)
    c.setFont("Helvetica", 9)
    c.drawCentredString(page_width / 2, meta_y, f"Resolution: {img.size[0]}×{img.size[1]}px")

    _draw_footer(c, page_width)
    c.save()
    return pdf_buffer.getvalue()


async def _build_vehicle_pdf(vin: str, vehicle_data: dict, category: str = "") -> bytes:
    """Build a professional vehicle spec sheet PDF."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch

    dealership_name, dealership_address, sales_rep = await _get_dealership_settings()

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    page_width, page_height = letter
    brand = _brand_colors()

    y = _draw_header(c, page_width, page_height, "Vehicle Spec Sheet",
                     dealership_name, dealership_address, sales_rep)

    # VIN display (mono, large)
    c.setFillColorRGB(brand["text"][0]/255, brand["text"][1]/255, brand["text"][2]/255)
    c.setFont("Courier-Bold", 20)
    c.drawString(0.75*inch, y, vin.upper())
    y -= 0.22*inch

    if category:
        cat_label = category.replace("_", " ").title()
        c.setFillColorRGB(brand["gold_dim"][0]/255, brand["gold_dim"][1]/255, brand["gold_dim"][2]/255)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.75*inch, y, cat_label)
    y -= 0.35*inch

    # Vehicle info
    year = vehicle_data.get("year") or vehicle_data.get("ModelYear", "")
    make = vehicle_data.get("make") or vehicle_data.get("Make", "")
    model = vehicle_data.get("model") or vehicle_data.get("Model", "")
    trim_val = vehicle_data.get("trim") or vehicle_data.get("Trim", "")

    ymmt = f"{year} {make} {model} {trim_val}".strip()
    if ymmt:
        c.setFillColorRGB(brand["text"][0]/255, brand["text"][1]/255, brand["text"][2]/255)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(0.75*inch, y, ymmt)
        y -= 0.40*inch

    # Specs section
    y = _draw_section(c, y, page_width, "Specifications")

    spec_fields = [
        ("Year", year),
        ("Make", make),
        ("Model", model),
        ("Trim", trim_val),
        ("Body Style", vehicle_data.get("body_class") or vehicle_data.get("BodyClass", "")),
        ("Doors", vehicle_data.get("doors") or vehicle_data.get("Doors", "")),
        ("Drive Type", vehicle_data.get("drive_type") or vehicle_data.get("DriveType", "")),
    ]
    for label, val in spec_fields:
        if val:
            y = _draw_field(c, y, label, val, page_width)

    # Powertrain
    engine = vehicle_data.get("engine_display") or vehicle_data.get("DisplacementL", "")
    fuel = vehicle_data.get("fuel_type") or vehicle_data.get("FuelTypePrimary", "")
    transmission = vehicle_data.get("transmission") or vehicle_data.get("TransmissionStyle", "")
    electrification = vehicle_data.get("electrification") or vehicle_data.get("ElectrificationLevel", "")

    if any([engine, fuel, transmission, electrification]):
        y = _draw_section(c, y, page_width, "Powertrain")
        if engine:
            y = _draw_field(c, y, "Engine", engine, page_width)
        if fuel:
            y = _draw_field(c, y, "Fuel Type", fuel, page_width)
        if transmission:
            y = _draw_field(c, y, "Transmission", transmission, page_width)
        if electrification:
            y = _draw_field(c, y, "Electrification", electrification, page_width)

    # Safety
    safety_fields = [
        ("TPMS", vehicle_data.get("TPMS", "")),
        ("ABS", vehicle_data.get("ABS", "")),
        ("ESC", vehicle_data.get("ESC", "")),
    ]
    has_safety = any(v for _, v in safety_fields)
    if has_safety:
        y = _draw_section(c, y, page_width, "Safety")
        for label, val in safety_fields:
            if val:
                y = _draw_field(c, y, label, val, page_width)

    _draw_footer(c, page_width)
    c.save()
    return pdf_buffer.getvalue()


# ─── IPP Print Submission ────────────────────────────────────────────────────

async def _submit_to_printer(pdf_bytes: bytes, printer_ip: str, job_name: str = "Print Job") -> dict:
    """Submit PDF to an IPP printer. Returns status dict."""
    if not printer_ip or not printer_ip.strip():
        return {"sent": False, "reason": "No printer IP"}

    try:
        import pyipp
        from pyipp.enums import IppStatus

        ipp_url = f"ipp://{printer_ip.strip()}:631/ipp/print"
        ipp = pyipp.IPP(ipp_url, timeout=10)

        response = await ipp.execute(
            pyipp.IppRequest.PRINT_JOB,
            {
                "operation-attributes-tag": {
                    "requesting-user-name": "Superchargd",
                    "job-name": job_name,
                    "document-format": "application/pdf",
                },
                "data": pdf_bytes,
            },
        )

        if response.status == IppStatus.SUCCESSFUL_OK:
            return {"sent": True, "job_id": str(response.data.get("job-id", ""))}
        else:
            return {"sent": False, "reason": f"Printer status: {response.status}"}

    except Exception as e:
        logger.warning(f"IPP submission failed: {e}")
        return {"sent": False, "reason": str(e)}


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/printer/test")
async def test_printer_connection(req: PrinterTestRequest):
    """Test connection to a network printer via IPP."""
    try:
        import pyipp
        from pyipp.enums import IppStatus

        ip = req.ip.strip()
        if not ip:
            raise HTTPException(status_code=400, detail="IP address required")

        ipp_url = f"ipp://{ip}:631/ipp/print"

        try:
            ipp = pyipp.IPP(ipp_url, timeout=5)
            response = await ipp.execute(pyipp.IppRequest.GET_PRINTER_ATTRIBUTES)

            if response.status == IppStatus.SUCCESSFUL_OK:
                printer_info = response.data.get("printer-attributes-tag", {})
                return {
                    "success": True,
                    "printer_name": printer_info.get("printer-name", "Unknown"),
                    "printer_state": printer_info.get("printer-state", "unknown"),
                }
            return {"success": False, "error": f"Status: {response.status}"}

        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Cannot reach printer at {ip}.") from e

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {e}") from e


@router.post("/print/customer")
async def print_customer_profile(req: CustomerPrintRequest):
    """Print branded customer profile PDF."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Printer routes not initialized")

    customer = await _db.customers.find_one({"id": req.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    first = (customer.get("first_name") or "").strip()
    last = (customer.get("last_name") or "").strip()
    name = f"{first} {last}".strip() or customer.get("name") or "Customer"

    try:
        pdf_bytes = await _build_customer_pdf(customer)
        ipp_result = await _submit_to_printer(pdf_bytes, req.printer_ip, f"Customer — {name}")

        return {
            "success": True,
            "message": "Print job sent" if ipp_result.get("sent") else "PDF generated (printer unreachable)",
            "customer": name,
            "bytes": len(pdf_bytes),
            "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            "printer": ipp_result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print failed: {e}") from e


@router.post("/print/license")
async def print_license_image(req: PrintJobRequest):
    """Print branded driver's license scan PDF."""
    try:
        pdf_bytes = await _build_license_pdf(req.image_data)
        ipp_result = await _submit_to_printer(pdf_bytes, req.printer_ip or "", "Driver's License Scan")

        return {
            "success": True,
            "message": "Print job sent" if ipp_result.get("sent") else "PDF generated (printer unreachable)",
            "bytes": len(pdf_bytes),
            "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            "printer": ipp_result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print failed: {e}") from e


@router.post("/print/vehicle")
async def print_vehicle_spec(req: VehiclePrintRequest):
    """Print branded vehicle spec sheet PDF."""
    try:
        pdf_bytes = await _build_vehicle_pdf(req.vin, req.vehicle_data, req.category)
        ipp_result = await _submit_to_printer(pdf_bytes, req.printer_ip, f"Vehicle — {req.vin}")

        return {
            "success": True,
            "message": "Print job sent" if ipp_result.get("sent") else "PDF generated (printer unreachable)",
            "vin": req.vin,
            "bytes": len(pdf_bytes),
            "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            "printer": ipp_result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print failed: {e}") from e


@router.post("/print/preview")
async def print_preview(req: PreviewRequest):
    """Generate PDF preview without printing. Returns base64 PDF."""
    try:
        if req.type == "customer":
            if not req.customer_id:
                raise HTTPException(status_code=400, detail="customer_id required")
            if _db is None:
                raise HTTPException(status_code=500, detail="DB not initialized")
            customer = await _db.customers.find_one({"id": req.customer_id}, {"_id": 0})
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            pdf_bytes = await _build_customer_pdf(customer)

        elif req.type == "license":
            if not req.image_data:
                raise HTTPException(status_code=400, detail="image_data required")
            pdf_bytes = await _build_license_pdf(req.image_data)

        elif req.type == "vehicle":
            if not req.vin:
                raise HTTPException(status_code=400, detail="vin required")
            pdf_bytes = await _build_vehicle_pdf(req.vin, req.vehicle_data or {})

        else:
            raise HTTPException(status_code=400, detail=f"Unknown type: {req.type}")

        return {
            "success": True,
            "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            "bytes": len(pdf_bytes),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {e}") from e


@router.post("/printer/print")
async def generic_print(req: PrinterGenericPrintRequest):
    """Legacy compat endpoint."""
    if not req.printer_ip.strip():
        raise HTTPException(status_code=400, detail="printer_ip is required")

    # If vehicle data provided, generate actual vehicle PDF
    if req.type == "vehicle_profile" and req.vehicle:
        vin = req.vehicle.get("vin", "UNKNOWN")
        try:
            pdf_bytes = await _build_vehicle_pdf(vin, req.vehicle)
            ipp_result = await _submit_to_printer(pdf_bytes, req.printer_ip, f"Vehicle — {vin}")
            return {
                "success": True,
                "message": "Print job sent" if ipp_result.get("sent") else "PDF generated",
                "type": req.type,
                "bytes": len(pdf_bytes),
                "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            }
        except Exception:
            pass

    return {"success": True, "message": "Print job sent", "type": req.type}
