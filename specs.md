# GymFlow — Product Requirements Document (PRD)

## 1. Overview & Goal
GymFlow is a multi-tenant B2B Gym Management SaaS designed to replace messy manual paper notebooks and unorganized WhatsApp chats with an automated, high-performance operational hub for gym owners and fitness centers.

### Primary Value Proposition
- **Zero Revenue Leakage:** Track exactly who paid, who owes fees, and who is expiring in real time.
- **Automated WhatsApp Follow-ups:** Automated fee reminders, welcome messages, and expiry warnings sent via Meta WhatsApp Cloud API.
- **Rapid Multi-Mode Check-in:** 1-tap QR / Member ID attendance tracking preventing duplicate check-ins.
- **Pakistan & Regional Payment Hub:** Instant payment collection via Raast QR, JazzCash, EasyPaisa, and Bank Transfer with CNIC formatting.

---

## 2. Target Audience & Personas
- **Primary Persona: The Gym Owner ("Ustaad / Gym Master / Club Owner")**
  - Pain: Loses 15–25% of monthly recurring fee collection to forgotten dues, unrecorded cash, and manual follow-ups.
  - Need: 1-click mobile dashboard showing today's collection, dues list, and automated WhatsApp payment links.
- **Secondary Persona: Front-Desk Staff & Trainers**
  - Pain: Manual entry delays at peak gym workout hours (6 PM – 10 PM).
  - Need: 1-tap rapid check-in and member lookup.

---

## 3. Core Functional Modules & Specifications

### A. Onboarding Wizard
- 6-step setup saving gym info, membership packages, operational timing, and payment QR credentials.
- Auto-saves state to `localStorage` and commits atomic transaction via Supabase RLS.

### B. Member Management & Pakistani CNIC Support
- Full Member CRUD with auto-generated ID (`GF0001`).
- Auto-formatted Pakistani CNIC (`XXXXX-XXXXXXX-X`) with graceful schema fallbacks.
- Plan selection with automatic fee computation and expiry date mapping.

### C. Dues & Automated WhatsApp Engine
- Automated payment reminder queue via Meta WhatsApp Cloud API.
- Interactive WhatsApp template messages with dynamic parameter injection (Member Name, Plan, Due Amount, Payment Link).
- Webhook receiver with HMAC-SHA256 signature verification and resilient delivery tracking.

### D. Multi-Region Payment Engine
- Pakistan Localization: JazzCash, EasyPaisa, Raast EMVCo QR code generation.
- Dynamic QR modal rendering for frictionless counter payments.

### E. Attendance & Access Control
- 1-tap rapid attendance logging.
- Database unique constraint on `(member_id, date)` preventing duplicate daily entries.

### F. Reports & Financial Insights
- 6-month revenue trends, membership retention, age/gender demographics, and daily attendance heatmaps.
- 1-click PDF Daily Collection Report and Excel data export.

---

## 4. Technical Architecture & Non-Functional Requirements
- **Next.js 15 App Router & React Server Components (RSC):** Fast server-side data hydration with Redis caching.
- **Supabase Multi-Tenancy:** Row Level Security (RLS) enforcing strict tenant isolation across all tables.
- **Upstash Redis:** Caching heavy aggregated queries (reports, active status, unread counts).
- **Target Performance:** Page transitions < 1.0s, save operations < 500ms, test suite passing at 100%.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Automated WhatsApp Fee Reminder
```gherkin
Given a gym member "Ali" has a membership expiring in 3 days
When the daily dues cron trigger executes
Then an automated WhatsApp reminder is queued with template "payment_reminder_v1"
And the message payload contains the gym's payment details and Raast QR link
And the send queue status is marked as "sent" upon webhook delivery confirmation.
```

### Scenario 2: Pakistan Payment QR Generation
```gherkin
Given a gym owner configures JazzCash or Raast payment credentials in account settings
When a member arrives at front desk to pay monthly fee
Then the staff clicks "Pay Online"
And an EMVCo compliant Raast / JazzCash QR code is rendered instantly on screen
And upon receiving payment, marking paid updates the member's expiry date atomically.
```
