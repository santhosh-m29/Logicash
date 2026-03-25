from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import math
from datetime import datetime, timedelta

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
    return {"status": "ok", "engine": "Logicash Decision Engine v1.0"}


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


@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):
    """Process an uploaded bill via OCR. Returns structured JSON."""
    # Read file content
    content = await file.read()
    filename = file.filename or ""
    
    extracted = {
        "vendor": "",
        "amount": None,
        "due_date": "",
        "category": "other",
        "raw_text": "",
    }
    
    try:
        if filename.lower().endswith(".pdf"):
            # Try PyMuPDF
            try:
                import fitz
                doc = fitz.open(stream=content, filetype="pdf")
                text = ""
                for page in doc:
                    text += page.get_text()
                extracted["raw_text"] = text
            except ImportError:
                extracted["raw_text"] = "[PyMuPDF not installed]"
        else:
            # Try Tesseract OCR for images
            try:
                from PIL import Image
                import pytesseract
                import io
                img = Image.open(io.BytesIO(content))
                text = pytesseract.image_to_string(img)
                extracted["raw_text"] = text
            except ImportError:
                extracted["raw_text"] = "[Tesseract/PIL not installed]"
        
        # Try Gemini API for structured extraction
        try:
            import google.generativeai as genai
            import os
            api_key = os.environ.get("GEMINI_API_KEY", "")
            if api_key:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-pro")
                prompt = f"""Extract from this bill/invoice text the following fields as JSON:
- vendor: the company/vendor name
- amount: the total amount (number only)
- due_date: the due date in YYYY-MM-DD format
- category: one of [salary, rent, tax, loan_emi, utility, subscription, vendor, other]

Text: {extracted['raw_text'][:2000]}

Reply with ONLY valid JSON, no markdown."""
                response = model.generate_content(prompt)
                result = json.loads(response.text.strip())
                extracted.update(result)
        except Exception:
            pass  # Fallback to raw text + manual entry
        
        # Set default due date if missing
        if not extracted["due_date"]:
            default_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            extracted["due_date"] = default_date
    
    except Exception as e:
        extracted["error"] = str(e)
    
    return extracted


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
