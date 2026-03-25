from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import math
from datetime import datetime, timedelta
import re
import cv2
import numpy as np
import pytesseract


app = FastAPI(title="Logicash Engine", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────
class Obligation(BaseModel):
    id: Optional[str] = None
    vendor: str
    amount: float
    due_date: str
    category: Optional[str] = "other"
    penalty: Optional[int] = 0
    flexibility: Optional[int] = 1
    is_paid: Optional[bool] = False
    is_critical: Optional[bool] = False


class ScenarioRequest(BaseModel):
    obligations: List[Obligation]
    balance: float


class EmailRequest(BaseModel):
    obligation: Obligation
    tone: str = "professional"
    user_name: str = "Business Owner"


# ─── Decision Engine (100% Deterministic Python) ─────────

def calculate_runway(balance: float, obligations: List[Obligation]) -> dict:
    """Step 1: Runway Calculation - days_to_zero = balance / avg_daily_outflow"""
    total_obligations = sum(o.amount for o in obligations if not o.is_paid)
    
    # Calculate avg daily outflow based on obligation due dates
    today = datetime.now()
    dates = [datetime.strptime(o.due_date, "%Y-%m-%d") for o in obligations if not o.is_paid]
    
    if not dates:
        return {"days_to_zero": float("inf"), "avg_daily_outflow": 0, "total_obligations": 0}
    
    max_date = max(dates)
    days_span = max((max_date - today).days, 30)
    avg_daily_outflow = total_obligations / days_span if days_span > 0 else total_obligations
    
    days_to_zero = balance / avg_daily_outflow if avg_daily_outflow > 0 else float("inf")
    
    return {
        "days_to_zero": round(days_to_zero, 1),
        "avg_daily_outflow": round(avg_daily_outflow, 2),
        "total_obligations": total_obligations,
    }


def priority_score(obligation: Obligation, weights: dict) -> float:
    """Step 2: Priority Scoring - deterministic multi-factor score"""
    today = datetime.now()
    due = datetime.strptime(obligation.due_date, "%Y-%m-%d")
    days_left = max((due - today).days, 1)
    
    # Urgency score (inverse of days left)
    urgency = (1 / days_left) * weights.get("urgency_mult", 3)
    
    # Penalty weight
    penalty_w = weights.get("penalty", 3) if obligation.penalty else 0
    
    # Flexibility weight (not flexible = higher priority)
    flex_w = weights.get("flexibility", 2) if not obligation.flexibility else 0
    
    # Category weight
    high_priority_cats = ["salary", "tax", "rent", "loan_emi"]
    med_priority_cats = ["vendor", "utility"]
    if obligation.category in high_priority_cats:
        cat_w = weights.get("category_high", 4)
    elif obligation.category in med_priority_cats:
        cat_w = weights.get("category_med", 2)
    else:
        cat_w = 0
    
    # Small bill bonus
    small_bonus = weights.get("small_bonus", 1) if obligation.amount < 5000 else 0
    
    # Critical override
    critical = 999 if obligation.is_critical else 0
    
    score = critical + penalty_w + urgency + flex_w + cat_w + small_bonus
    return round(score, 4)


def generate_payment_plan(sorted_obligations: List[dict], balance: float) -> List[dict]:
    """Step 3: Build payment plan from sorted obligations"""
    remaining = balance
    plan = []
    for obl in sorted_obligations:
        can_pay = remaining >= obl["amount"]
        if can_pay:
            remaining -= obl["amount"]
        plan.append({
            **obl,
            "action": "PAY" if can_pay else "DEFER",
            "remaining_after": round(remaining, 2),
        })
    return plan


def detect_conflicts(balance: float, total_obligations: float) -> dict:
    """Step 4: Conflict Detection"""
    has_conflict = total_obligations > balance
    deficit = total_obligations - balance if has_conflict else 0
    return {
        "has_conflict": has_conflict,
        "deficit": round(deficit, 2),
        "coverage_pct": round((balance / total_obligations * 100), 1) if total_obligations > 0 else 100,
    }


# ─── Scenario Weights ───────────────────────────────────
SCENARIO_WEIGHTS = {
    "penalty_minimization": {
        "penalty": 5, "urgency_mult": 3, "flexibility": 2,
        "category_high": 3, "category_med": 1, "small_bonus": 1,
    },
    "relationship_preservation": {
        "penalty": 2, "urgency_mult": 2, "flexibility": 3,
        "category_high": 2, "category_med": 4, "small_bonus": 2,
    },
    "runway_maximization": {
        "penalty": 1, "urgency_mult": 1, "flexibility": 1,
        "category_high": 4, "category_med": 1, "small_bonus": 4,
    },
}

SCENARIO_META = {
    "penalty_minimization": {
        "name": "Penalty Minimization",
        "description": "Prioritizes bills with late penalties to avoid extra costs",
        "icon": "🛡️",
    },
    "relationship_preservation": {
        "name": "Relationship Preservation",
        "description": "Keeps vendor relationships strong by paying key partners first",
        "icon": "🤝",
    },
    "runway_maximization": {
        "name": "Runway Maximization",
        "description": "Extends your cash runway by paying only critical obligations",
        "icon": "🛫",
    },
}


# ─── API Routes ──────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "engine": "Logicash Decision Engine v2.0 (Tesseract-First)"}


@app.post("/api/scenarios")
def run_scenarios(req: ScenarioRequest):
    """Run all 3 payment scenarios using the deterministic decision engine."""
    unpaid = [o for o in req.obligations if not o.is_paid]
    
    # Runway calculation
    runway = calculate_runway(req.balance, unpaid)
    
    # Conflict detection
    conflict = detect_conflicts(req.balance, runway["total_obligations"])
    
    scenarios = {}
    best_scenario = None
    best_score = -1
    
    for key, weights in SCENARIO_WEIGHTS.items():
        # Score each obligation
        scored = []
        today = datetime.now()
        for obl in unpaid:
            score = priority_score(obl, weights)
            due = datetime.strptime(obl.due_date, "%Y-%m-%d")
            days_left = max((due - today).days, 0)
            scored.append({
                **obl.dict(),
                "score": score,
                "daysLeft": days_left,
            })
        
        # Sort by score descending
        scored.sort(key=lambda x: x["score"], reverse=True)
        
        # Build payment plan
        plan = generate_payment_plan(scored, req.balance)
        
        pay_count = len([p for p in plan if p["action"] == "PAY"])
        pay_total = sum(p["amount"] for p in plan if p["action"] == "PAY")
        
        scenarios[key] = {
            **SCENARIO_META[key],
            "plan": plan,
            "pay_count": pay_count,
            "pay_total": pay_total,
        }
        
        # Auto-select best (most bills paid, then highest coverage)
        scenario_score = pay_count * 100 + pay_total
        if scenario_score > best_score:
            best_score = scenario_score
            best_scenario = key
    
    return {
        "scenarios": scenarios,
        "recommended": best_scenario,
        "runway": runway,
        "conflict": conflict,
        "explanation": f"Based on your balance of ₹{req.balance:,.0f} and {len(unpaid)} unpaid obligations totaling ₹{runway['total_obligations']:,.0f}, "
                      f"your estimated runway is {runway['days_to_zero']} days. "
                      f"{'⚠️ Conflict detected: obligations exceed balance.' if conflict['has_conflict'] else '✅ You can cover all obligations.'} "
                      f"The recommended strategy is '{SCENARIO_META[best_scenario]['name']}' which allows you to pay {scenarios[best_scenario]['pay_count']} of {len(unpaid)} obligations.",
    }


@app.post("/api/email-draft")
def draft_email(req: EmailRequest):
    """Generate a vendor negotiation email based on tone and obligation context."""
    obl = req.obligation
    today = datetime.now()
    due = datetime.strptime(obl.due_date, "%Y-%m-%d")
    days_left = (due - today).days
    overdue = days_left < 0
    
    templates = {
        "professional": f"""Subject: Regarding Payment for Invoice — {obl.vendor}

Dear {obl.vendor} Team,

I hope this message finds you well. I am writing to discuss the outstanding payment of ₹{obl.amount:,.0f} {'which was due on' if overdue else 'scheduled for'} {obl.due_date}.

Due to current cash flow management priorities, I would like to {'request a brief extension' if overdue else 'discuss a possible adjusted timeline'} for this payment. We remain fully committed to fulfilling this obligation and value our ongoing business relationship.

Could we arrange a brief call to discuss a mutually agreeable payment schedule? We anticipate being able to complete this payment within the next 15 business days.

Thank you for your understanding and continued partnership.

Best regards,
{req.user_name}""",

        "empathetic": f"""Subject: Payment Discussion — {obl.vendor}

Dear {obl.vendor} Team,

I want to be transparent with you about our current situation regarding the payment of ₹{obl.amount:,.0f} {'(past due)' if overdue else f'due on {obl.due_date}'}.

We're currently navigating some cash flow challenges, and while we take our commitments to your organization very seriously, we need a bit more time to process this payment. Your business has been incredibly important to us, and we want to maintain that trust.

I'd love to work together on a comfortable resolution — perhaps a phased payment plan or a brief extension. What would work best for your team?

Warm regards,
{req.user_name}""",

        "firm": f"""Subject: Payment Update — {obl.vendor}

Dear {obl.vendor},

This is regarding the payment of ₹{obl.amount:,.0f} {'originally due' if overdue else 'due on'} {obl.due_date}.

After reviewing our current financial obligations and cash flow position, we are requesting a {'revised timeline' if overdue else 'brief adjustment'} for this payment. We have prioritized our obligations using a systematic approach and will process your payment as soon as our schedule permits.

We expect to complete this within 10-15 business days. Please confirm receipt of this communication.

Regards,
{req.user_name}""",
    }
    
    return {"email": templates.get(req.tone, templates["professional"])}

def is_low_quality(text: str) -> bool:
    """Check if text is empty or lacks critical invoice markers."""
    if not text:
        return True
    if len(text.strip()) < 30:
        return True
    # Check for "Total" or currency symbols
    if "total" not in text.lower() and "$" not in text and "₹" not in text:
        return True
    return False


def pdf_to_image(content: bytes):
    """Convert first page of PDF to a high-DPI image for OCR."""
    import fitz
    import numpy as np
    import cv2
    
    doc = fitz.open(stream=content, filetype="pdf")
    page = doc.load_page(0)
    
    pix = page.get_pixmap(dpi=300)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    
    return img


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Standardize image for better OCR accuracy."""
    import cv2
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Increase contrast
    gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
    # Fixed thresholding
    thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)[1]
    
    return thresh


def run_tesseract_pipeline(content: bytes, is_pdf: bool = True):
    """Orchestrate conversion, preprocessing, and OCR."""
    import pytesseract
    import io
    from PIL import Image
    import numpy as np
    
    if is_pdf:
        img = pdf_to_image(content)
    else:
        # Load image from bytes
        pil_img = Image.open(io.BytesIO(content))
        img = np.array(pil_img.convert('RGB'))[:, :, ::-1].copy() # RGB to BGR for CV2
        
    processed = preprocess_image(img)
    config = r'--oem 3 --psm 6'
    text = pytesseract.image_to_string(processed, config=config)
    
    return text


def extract_structured_fields(text):
    import re
    
    # --- VENDOR EXTRACTION (FINAL FIX) ---
    vendor_match = re.search(r'VENDOR\s*NAME\s*:\s*(.+)', text, re.IGNORECASE)
    vendor = vendor_match.group(1).strip() if vendor_match else ""
    vendor = re.sub(r'\b(?:BILL|AMOUNT|TOTAL|DATE|:).*', '', vendor, flags=re.IGNORECASE)
    vendor = re.sub(r'\d+', '', vendor).strip()

    # --- AMOUNT EXTRACTION (HARDENED) ---
    amount = ""
    # Look for labels like BILL AMOUNT, TOTAL, etc.
    amount_match = re.search(r'(?:BILL|TOTAL|AMOUNT)\s*(?:AMOUNT)?\s*[:=-]?\s*([0-9]+(?:\.[0-9]{2})?)', text, re.IGNORECASE)
    if amount_match:
        amount = amount_match.group(1)
    else:
        # Avoid taking '2024' or dates as amounts. Look for numbers that look like prices.
        prices = re.findall(r'\b[0-9]{1,5}(?:\.[0-9]{2})?\b', text)
        # Filter out common year strings
        prices = [p for p in prices if p not in ["2024", "2025", "2023"]]
        if prices:
            amount = max(prices, key=lambda x: float(x))

    # --- DUE DATE EXTRACTION (HIGH PERMISSIVENESS) ---
    due_date = ""
    # Enhanced regex for varied delimiters and spacing: DD-MM-YYYY, DD/MM/YYYY, etc.
    date_label_match = re.search(r'(?:DUE|BILL|INVOICE|PAYMENT)\s*DATE\s*[:=-]?\s*(\d{1,4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})', text, re.IGNORECASE)
    
    if not date_label_match:
        # Last resort: find any date match in the whole text if label-based fails
        date_label_match = re.search(r'(\d{1,4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})', text)

    if date_label_match:
        g1, g2, g3 = date_label_match.groups()
        # Handle DD-MM-YYYY
        if len(g1) <= 2 and len(g3) == 4: # Standard DD-MM-YYYY
            due_date = f"{g3}-{g2.zfill(2)}-{g1.zfill(2)}"
        elif len(g1) == 4: # YYYY-MM-DD
            due_date = f"{g1}-{g2.zfill(2)}-{g3.zfill(2)}"
        elif len(g1) <= 2 and len(g3) == 2: # DD-MM-YY -> 20YY
            due_date = f"20{g3}-{g2.zfill(2)}-{g1.zfill(2)}"

    return vendor, amount, due_date


def extract_with_pymupdf(content: bytes) -> str:
    """Attempt direct text extraction from PDF."""
    import fitz
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        return text
    except:
        return ""


@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):
    """Hybrid OCR pipeline (PyMuPDF -> Tesseract fallback -> Gemini)."""
    import os
    import json
    import re
    import google.generativeai as genai
    
    content = await file.read()
    filename = file.filename or ""
    is_pdf = filename.lower().endswith(".pdf")
    
    # Fix Tesseract path for Windows
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    
    # ─── PHASE 1: TEXT EXTRACTION ───────────────
    text = ""
    if is_pdf:
        text = extract_with_pymupdf(content)
        if is_low_quality(text):
            text = run_tesseract_pipeline(content, is_pdf=True)
    else:
        # Direct OCR for images
        text = run_tesseract_pipeline(content, is_pdf=False)
        
    extracted_text = text


    # --- RULE BASED EXTRACTION ---
    # Moved text cleaning here since extract_structured_fields no longer does it
    text = text.replace("%", " ")
    text = re.sub(r'\s+', ' ', text)
    vendor, amount, due_date = extract_structured_fields(text)

    if vendor and amount:
        return {
            "vendor": vendor,
            "amount": float(amount),
            "due_date": due_date,
            "category": "vendor",
            "raw_text": text
        }

    print("==== RAW OCR TEXT ====")
    print(text[:1000] + ("..." if len(text) > 1000 else ""))
    print("======================")

    # ─── PHASE 2: AI STRUCTURED DATA (Fallback) ─────
    extracted = {"vendor": "", "amount": "", "due_date": "", "category": "other"}
    
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key and text:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro")
            
            prompt = f"""
You are a financial document parser.

Extract structured data from the invoice text below.

STRICT RULES:
1. Identify FINAL payable amount:
   * Prefer labels: "Total", "Total (USD)", "Amount Due"
   * Ignore: Subtotal, Tax, Discounts
2. If multiple amounts exist:
   → ALWAYS select the LARGEST value as final payable amount
3. Extract:
   * vendor: JUST the company name. DO NOT include "VENDOR NAME :" or any labels.
   * amount: numeric only
   * due_date: YYYY-MM-DD
   * category: one of [vendor, utility, rent, salary, other]
4. Dates:
   * Prefer "Due date"
   * If not found, return ""
5. DO NOT GUESS VALUES
   * If amount not found → return ""
   * If vendor unclear → return ""
6. Return ONLY valid JSON:
{{
"vendor": "",
"amount": "",
"due_date": "",
"category": ""
}}
Invoice text:
{text[:4000]}
"""
            response = model.generate_content(prompt)
            raw_response = response.text.strip()
            
            # Robust JSON extract
            match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            parsed_data = json.loads(match.group() if match else raw_response)
            
            # Final verification of amount
            if parsed_data.get("amount"):
                try:
                    # Clean the string to ensure it's a valid float
                    val = str(parsed_data["amount"]).replace(",", "").replace("$", "").replace("₹", "").strip()
                    parsed_data["amount"] = float(val) if val else ""
                except:
                    parsed_data["amount"] = ""

            # ─── PHASE 3: REGEX FALLBACK FOR AMOUNT ───
            if not parsed_data.get("amount"):
                matches = re.findall(r'(\d+[\.,]\d{2})', text)
                if matches:
                    clean_matches = [float(m.replace(",", "")) for m in matches]
                    parsed_data["amount"] = max(clean_matches)
            
            extracted.update(parsed_data)
            
        except Exception as e:
            print(f"Extraction Pipeline Failure: {e}")
            extracted["error"] = str(e)

    print(f"========== FINAL RESULT ==========")
    print(f"Vendor: {extracted.get('vendor')}")
    print(f"Amount: {extracted.get('amount')}")
    print(f"Date:   {extracted.get('due_date')}")
    print("==================================")
    
    return extracted

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
