import os
import re
import csv
import json
from pathlib import Path
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

SOURCE_CSV = Path(r"C:\Users\mursa\gym_leads_scraper\karachi_gyms_100_leads.csv")
OUTPUT_DIR = Path(r"D:\GymFlow-Gym-Management-SaaS-Platform\leads")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_XLSX = OUTPUT_DIR / "GymFlow_Karachi_Leads_Outreach_Tracker.xlsx"
OUTPUT_CSV = OUTPUT_DIR / "GymFlow_Karachi_Leads_Outreach_Tracker.csv"
DOWNLOADS_XLSX = Path(r"C:\Users\mursa\Downloads\GymFlow_Karachi_Leads_Outreach_Tracker.xlsx")
DOWNLOADS_CSV = Path(r"C:\Users\mursa\Downloads\GymFlow_Karachi_Leads_Outreach_Tracker.csv")

def clean_phone(phone_raw):
    # normalize phone to 923...
    digits = re.sub(r"\D", "", phone_raw)
    if digits.startswith("03"):
        digits = "92" + digits[1:]
    elif digits.startswith("3") and len(digits) == 10:
        digits = "92" + digits
    elif digits.startswith("92"):
        pass
    elif digits.startswith("21") or digits.startswith("021"): # landline
        if digits.startswith("021"):
            digits = "9221" + digits[3:]
        else:
            digits = "92" + digits
    return digits

def get_tier_and_strategy(area, rating_val, gym_name):
    lower_name = gym_name.lower()
    
    # Premium Tiers
    if area in ["DHA", "Clifton"] or "studio" in lower_name or "crossfit" in lower_name or "club" in lower_name or "trifit" in lower_name or "core" in lower_name:
        tier = "Tier 1 (Premium / Boutique)"
        pitch = "Automated WhatsApp Fee Receipts + Raast QR Instant Verification + Member Retention Dashboard"
        plan = "Pro / Enterprise (Rs 7,500 - 15,000/mo)"
        est_members = "250 - 600 members"
        analysis = "High fee structure (Rs 8k - 25k/mo). Owners care about brand prestige, zero counter friction, and automated payment receipts."
    elif area in ["PECHS", "Bahadurabad", "Gulshan-e-Iqbal", "Tariq Road", "North Nazimabad"]:
        tier = "Tier 2 (High-Volume Mid-Market)"
        pitch = "Eliminate Unpaid Member Dues with 3-Day Automated WhatsApp Payment Reminders"
        plan = "Starter / Pro (Rs 3,500 - 7,500/mo)"
        est_members = "150 - 350 members"
        analysis = "High member turnover & unpaid fee leakage (15-25% dues delay). Pitch automated WhatsApp reminders and daily cash ledger."
    else:
        tier = "Tier 3 (Local Community Gym)"
        pitch = "Replace Paper Register with 1-Click Mobile Member Entry & Due Date SMS/WhatsApp"
        plan = "Starter (Rs 2,500 - 3,500/mo)"
        est_members = "80 - 180 members"
        analysis = "Still using notebook/Excel register. Low tech barrier needed. Emphasize mobile-friendly Urdu/English interface and Rs 100/day cost."
        
    return tier, pitch, plan, est_members, analysis

def build_workbook():
    with open(SOURCE_CSV, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        raw_rows = list(reader)

    wb = openpyxl.Workbook()
    
    # ==========================================
    # SHEET 1: CRM & OUTREACH TRACKER
    # ==========================================
    ws = wb.active
    ws.title = "GymFlow Leads & Outreach CRM"
    ws.views.sheetView[0].showGridLines = True
    
    headers = [
        "Lead ID",
        "Gym Name",
        "Area / Zone",
        "Phone Number",
        "WhatsApp Link",
        "Rating",
        "ICP Tier",
        "Outreach Status",
        "Mursaleen User Action & Notes",
        "PM & Sales Team Analysis",
        "Target Pain Point Pitch Hook",
        "Recommended Plan",
        "Est. Members",
        "Address",
        "Google Maps URL"
    ]
    
    # Styles
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid") # Slate 900
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    link_font = Font(name="Segoe UI", size=10, color="2563EB", underline="single")
    bold_data_font = Font(name="Segoe UI", size=10, bold=True)
    
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )
    
    # Write Title block
    ws.merge_cells("A1:O1")
    title_cell = ws["A1"]
    title_cell.value = "🏋️ GYMFLOW B2B OUTREACH & CLIENT ACQUISITION TRACKER (KARACHI PILOT)"
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 40
    
    # Write Subtitle
    ws.merge_cells("A2:O2")
    sub_cell = ws["A2"]
    sub_cell.value = "Active Pipeline: 105 Karachi Gyms | Target: 10 Paid Beta Gyms | Shared Workspace for Mursaleen & PM/Sales Agent Team"
    sub_cell.font = Font(name="Segoe UI", size=10, italic=True, color="94A3B8")
    sub_cell.fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 24

    # Write Headers on row 3
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[3].height = 32

    # Status fills
    status_fill_default = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid") # Gray

    # Write Rows
    csv_rows = []
    csv_headers = headers.copy()
    
    for idx, r in enumerate(raw_rows, 1):
        row_num = idx + 3
        gym_name = r["gym_name"]
        phone_raw = r["phone"]
        clean_p = clean_phone(phone_raw)
        area = r["area"]
        rating = r["rating"]
        address = r["address"]
        maps_url = r["google_maps_url"]
        
        tier, pitch, plan, est_members, analysis = get_tier_and_strategy(area, rating, gym_name)
        
        wa_link = f"https://wa.me/{clean_p}" if clean_p.startswith("923") else "Landline / Call"
        status_val = "1. Not Contacted"
        
        row_data = [
            f"GF-KHI-{idx:03d}",
            gym_name,
            area,
            phone_raw,
            f'=HYPERLINK("{wa_link}", "💬 Open WhatsApp")' if wa_link.startswith("http") else wa_link,
            float(rating) if rating != "N/A" else "N/A",
            tier,
            status_val,
            "", # User action notes
            analysis, # PM & Sales analysis
            pitch,
            plan,
            est_members,
            address,
            f'=HYPERLINK("{maps_url}", "📍 View Map")'
        ]
        
        for col_num, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col_num, value=val)
            cell.font = data_font
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            
            # Formatting specifics
            if col_num in [1, 3, 6, 8]: # ID, Area, Rating, Status
                cell.alignment = Alignment(horizontal="center", vertical="center")
            if col_num == 2: # Gym name
                cell.font = bold_data_font
            if col_num in [5, 15] and str(val).startswith("="):
                cell.font = link_font
                cell.alignment = Alignment(horizontal="center", vertical="center")
            if col_num == 8:
                cell.fill = status_fill_default
                
        ws.row_dimensions[row_num].height = 28
        
        # Prepare CSV data
        csv_rows.append([
            f"GF-KHI-{idx:03d}",
            gym_name,
            area,
            phone_raw,
            wa_link,
            rating,
            tier,
            status_val,
            "",
            analysis,
            pitch,
            plan,
            est_members,
            address,
            maps_url
        ])

    # Auto-adjust column widths
    col_widths = {
        1: 14,  # Lead ID
        2: 32,  # Gym Name
        3: 18,  # Area
        4: 20,  # Phone
        5: 18,  # WhatsApp Link
        6: 10,  # Rating
        7: 28,  # Tier
        8: 20,  # Outreach Status
        9: 35,  # User Action Notes
        10: 45, # PM Analysis
        11: 45, # Target Pitch
        12: 26, # Plan
        13: 18, # Members
        14: 35, # Address
        15: 16  # Maps
    }
    for col_idx, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    # ==========================================
    # SHEET 2: AREA & STRATEGY DASHBOARD
    # ==========================================
    ws2 = wb.create_sheet(title="Area & Strategic Analysis")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:F1")
    t2 = ws2["A1"]
    t2.value = "🎯 KARACHI MARKET SEGMENTATION & STRATEGY DASHBOARD"
    t2.font = Font(name="Segoe UI", size=13, bold=True, color="FFFFFF")
    t2.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    t2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 36

    h2 = ["Area / Zone", "Total Gyms", "Primary Persona / ICP", "Recommended SaaS Pitch Angle", "Avg. Target Fee", "Priority Rank"]
    for col_num, h in enumerate(h2, 1):
        c = ws2.cell(row=3, column=col_num, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin_border
    ws2.row_dimensions[3].height = 28

    area_strategies = [
        ("DHA & Clifton", 22, "Premium Boutiques & High-End Clubs", "Modern Member Experience, Instant WhatsApp QR Receipts, Branded Member Portal", "Rs 10,000 - 15,000/mo", "⭐⭐⭐⭐⭐ Priority 1"),
        ("PECHS, Bahadurabad & Tariq Rd", 31, "High-Density Commercial Hubs", "Automated Dues Recovery via WhatsApp, Staff Cash Embezzlement Prevention", "Rs 5,000 - 7,500/mo", "⭐⭐⭐⭐⭐ Priority 1"),
        ("Gulshan-e-Iqbal & Johar", 27, "High-Volume Community & Commercial Gyms", "Stop Manual Register Bookings, 3-Day Automated Dues Reminders, Raast QR", "Rs 3,500 - 5,000/mo", "⭐⭐⭐⭐ Priority 2"),
        ("North Nazimabad & Nazimabad", 8, "Established Neighborhood Fitness Centers", "Low-Cost Mobile-First Management, WhatsApp Due Alerts, Expense Tracker", "Rs 3,500/mo", "⭐⭐⭐ Priority 3"),
        ("Malir & Malir Cantt", 9, "Residential & Cantt Fitness Centers", "Simplified Member Signups, WhatsApp Broadcasts, Fast Cash Management", "Rs 3,500/mo", "⭐⭐⭐ Priority 3"),
        ("Federal B Area & Sh-e-Faisal", 8, "Mixed Commercial Centers", "Paperless Gym Operations, 1-Click WhatsApp Member Notification", "Rs 3,500/mo", "⭐⭐⭐ Priority 3")
    ]

    for idx, strat in enumerate(area_strategies, 4):
        for col_num, val in enumerate(strat, 1):
            c = ws2.cell(row=idx, column=col_num, value=val)
            c.font = data_font
            c.border = thin_border
            c.alignment = Alignment(vertical="center")
            if col_num in [1, 2, 5, 6]:
                c.alignment = Alignment(horizontal="center", vertical="center")
            if col_num == 1:
                c.font = bold_data_font
            if "Priority 1" in str(val):
                c.font = Font(name="Segoe UI", size=10, bold=True, color="16A34A")
        ws2.row_dimensions[idx].height = 26

    for col_idx, width in enumerate([24, 14, 34, 45, 22, 20], 1):
        ws2.column_dimensions[get_column_letter(col_idx)].width = width

    # ==========================================
    # SHEET 3: WHATSAPP OUTREACH SCRIPTS
    # ==========================================
    ws3 = wb.create_sheet(title="WhatsApp Outreach Scripts")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.merge_cells("A1:C1")
    t3 = ws3["A1"]
    t3.value = "📲 HIGH-CONVERTING WHATSAPP OUTREACH PLAYBOOK"
    t3.font = Font(name="Segoe UI", size=13, bold=True, color="FFFFFF")
    t3.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    t3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 36

    scripts = [
        ("Template 1: Unpaid Fees & Dues Recovery (Best for PECHS / Gulshan / Johar)", 
         "Assalam-o-Alaikum [Gym Owner Name / Manager] bhai! 👋\n\nMain Mursaleen baat kar raha hoon Karachi se. Ek brief observation yeh hai ke aksar gym owners ka har mahine 15-20% fee collection members ki late payments ki wajah se delay hota hai ya manage karna mushkil hota hai.\n\nHumne Karachi gyms ke liye ek dedicated software **GymFlow** develop kiya hai jo:\n✅ Har member ko due date se 3 din pehle WhatsApp par automatic fee reminder bhejta hai (with your Gym logo & Raast QR code).\n✅ Jaise hi payment aati hai, automatic WhatsApp digital receipt generate ho jati hai.\n✅ Counter par register ya diary maintain karne ki zaroorat khatam.\n\nKya main aapko 2-minute ka quick video demo ya 7 days ka free trial share karoon?",
         "Goal: Pain-point hit karna (Cashflow leakage) aur low-friction demo offer karna."),

        ("Template 2: Premium Gym Member Experience (Best for DHA / Clifton / Studios)",
         "Assalam-o-Alaikum Team [Gym Name]! 🏋️♂️\n\nHope you are doing great.\n\nAapke gym ki premium facilities and member reviews dekh kar reach out kar raha hoon. Top gyms mein members paper receipts ya manual follow-ups ki jagah digital experience pasand karte hain.\n\n**GymFlow** aapke gym ko provide karta hai:\n🔹 Branded WhatsApp digital receipts & membership expiry alerts.\n🔹 Instant Raast QR integration for contactless fee collection.\n🔹 Daily collection and active members insights direct on your mobile.\n\nKoi hardware setup ki zaroorat nahi hai. Would you be open to a 3-minute quick walkthrough this week?",
         "Goal: Prestige and seamless member experience sell karna."),

        ("Template 3: Quick Direct Pitch (Follow-up / Direct Call to Action)",
         "Assalam-o-Alaikum! Kya gym management aur member fees track karne ke liye aap koi software use kar rahe hain ya abhi register/Excel chal raha hai?\n\nHum Karachi ke select gyms ko 1-Month FREE access de rahe hain to automate fee reminders and member check-ins.\n\nIf interested, main aapka gym account 5 minutes mein setup karwa sakta hoon.",
         "Goal: High response rate on busy owners.")
    ]

    for idx, (title_s, script_body, goal) in enumerate(scripts, 3):
        row_start = 3 + (idx - 3) * 5
        ws3.merge_cells(f"A{row_start}:C{row_start}")
        c_title = ws3[f"A{row_start}"]
        c_title.value = f"📌 {title_s}"
        c_title.font = Font(name="Segoe UI", size=11, bold=True, color="0F172A")
        c_title.fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
        ws3.row_dimensions[row_start].height = 24

        ws3.merge_cells(f"A{row_start+1}:C{row_start+3}")
        c_body = ws3[f"A{row_start+1}"]
        c_body.value = script_body
        c_body.font = Font(name="Segoe UI", size=10)
        c_body.alignment = Alignment(vertical="top", wrap_text=True)
        ws3.row_dimensions[row_start+1].height = 30
        ws3.row_dimensions[row_start+2].height = 30
        ws3.row_dimensions[row_start+3].height = 30

        ws3.merge_cells(f"A{row_start+4}:C{row_start+4}")
        c_goal = ws3[f"A{row_start+4}"]
        c_goal.value = f"💡 Strategy: {goal}"
        c_goal.font = Font(name="Segoe UI", size=9, italic=True, color="475569")
        ws3.row_dimensions[row_start+4].height = 20

    ws3.column_dimensions["A"].width = 30
    ws3.column_dimensions["B"].width = 45
    ws3.column_dimensions["C"].width = 35

    # Save Excel
    wb.save(OUTPUT_XLSX)
    wb.save(DOWNLOADS_XLSX)
    print(f"✅ Excel workbook saved at:\n  - {OUTPUT_XLSX}\n  - {DOWNLOADS_XLSX}")

    # Save CSV
    with open(OUTPUT_CSV, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        writer.writerows(csv_rows)

    with open(DOWNLOADS_CSV, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        writer.writerows(csv_rows)
        
    print(f"✅ CSV tracker saved at:\n  - {OUTPUT_CSV}\n  - {DOWNLOADS_CSV}")

if __name__ == "__main__":
    build_workbook()
