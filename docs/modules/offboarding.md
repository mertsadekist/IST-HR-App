# Offboarding Module

## Overview

The **Offboarding Module** manages the complete employee exit process through a structured 6-step workflow. It handles resignations, terminations, end-of-contract, and mutual agreement separations.

**Render Function**: `render_offboarding()` (Line ~6228)

---

## Departure Types

| Type               | Description                              | Letter Template          |
|--------------------|------------------------------------------|--------------------------|
| Resignation        | Employee-initiated departure             | Resignation acknowledgement email |
| Termination        | Employer-initiated departure             | Termination notification email |
| End of Contract    | Contract expiry without renewal          | —                        |
| Mutual Agreement   | Agreed-upon separation                   | —                        |

---

## 6-Step Offboarding Workflow

Built by `buildOffboardingSteps(entity, type)`:

### Step 1: Letter & Notice

| Aspect    | Resignation                              | Termination                              |
|-----------|------------------------------------------|------------------------------------------|
| **Owner** | HR                                       | HR                                       |
| **SLA**   | Within 24 hours                          | Within 24 hours                          |
| **Items** | Resignation letter received, HR countersignature, LWD confirmed | Termination letter drafted, legal review, employee acknowledgement |

**Includes**: Email template generator (resignation acknowledgement or termination notice)

### Step 2: Handover of Company Assets

| Owner    | SLA        | Items Count |
|----------|------------|-------------|
| IT / HR  | By LWD     | 13 items    |

Checklist includes:
- Asset return list generation from registry
- Laptop/phone return with condition verification
- Accessories return (chargers, bags, headsets, SIM cards)
- Access cards/key fobs return
- Asset Return Receipt generation and signing
- Asset registry status update

**Special Feature**: Integrates with the Asset module — pulls assigned assets and allows condition recording (Good/Damaged/Missing).

### Step 3: Physical Access Removal

| Owner           | SLA                  | Items Count |
|-----------------|----------------------|-------------|
| IT / Facilities | On or before LWD     | 8 items     |

- Fingerprint removal from biometric device
- Face ID / retina scan removal
- Access card deactivation
- Office key return
- Car park access revocation
- Building/server room access revocation

### Step 4: IT Systems & App Access Removal (Entity-Specific)

| Owner | SLA     |
|-------|---------|
| IT    | On LWD  |

**IST Real Estate** items:
- Disable MS email (@istrealstate.com)
- Disable Google/Gmail (@istmarketsglobal.com)
- Revoke Bitrix CRM access
- Remove MS Teams & Office licence
- Revoke DNCR portal, WATI Tags, Listings Users
- Revoke OneDrive/Google Drive access
- Deactivate VOIP extension (Yeastar)
- Remove Kaspersky/Cyber Protect
- Wipe company WhatsApp
- Retrieve & reset laptop and phone

**IST Markets** items:
- Disable Outlook/MS email (@IST Markets)
- Disable Google/Gmail (@istmarketsglobal.com)
- Revoke Bitrix CRM access
- Revoke Skale CRM access
- Deactivate VOIP (Yeastar) and VOISO
- Remove Kaspersky/Cyber Protect
- Wipe company WhatsApp
- Retrieve & reset laptop and phone

### Step 5: Settlement of Dues (MOHRE)

| Owner           | SLA                          |
|-----------------|------------------------------|
| Finance / PRO   | Within 14 days of LWD        |

Includes:
- EOSB (End of Service Benefit) gratuity calculation
- Unused annual leave encashment
- Outstanding salary/commissions/bonuses
- Deductions (damages, advances, notice shortfall)
- Final Settlement Statement preparation
- MOHRE online filing
- Payment processing

**Special Feature**: Built-in **Gratuity Calculator** with fields:

| Field               | Description                                |
|---------------------|--------------------------------------------|
| Employment Start    | Date employment began                      |
| Employment End      | Last working day                           |
| Basic Salary        | Monthly basic for EOSB calculation         |
| Years of Service    | Auto-calculated                            |
| Gratuity Amount     | 21 days/year (≤5 yrs) or 30 days/year (>5 yrs) |
| Leave Balance       | Unused leave days for encashment           |
| Deductions          | Any amounts to deduct                      |
| Total Settlement    | Net amount due to employee                 |

### Step 6: Visa Cancellation & Exit Documentation

| Owner        | SLA                          |
|--------------|------------------------------|
| PRO / Admin  | Within 30 days of LWD        |

- UAE Residence Visa cancellation with MOHRE/GDRFA
- Passport collection and return
- Emirates ID deregistration
- NOC/Experience Letter issuance
- Exit interview
- Final records archival

---

## Offboarding List View

Each offboarding record displays:
- **Employee name**, job title, entity badge
- **Departure type badge** (Resignation=orange, Termination=red, etc.)
- **Progress bar** (steps completed %)
- **LWD countdown** (days remaining or past)
- **Visa deadline** tracker (30-day compliance)
- **Settlement amount** (if calculated)
- **Current active step** name

---

## Key Functions

| Function                              | Purpose                                    |
|---------------------------------------|--------------------------------------------|
| `render_offboarding()`                | Renders offboarding record list            |
| `buildOffboardingSteps(entity, type)` | Creates step template for entity/type      |
| `openInitiateOffboard()`             | Opens offboarding initiation modal         |
| `saveOffboard()`                      | Creates offboarding record, marks employee as "Offboarding" |
| `openOffDetail(offId)`               | Opens detailed step management             |
| `copyEmailTemplate(offId, stepIdx)`  | Copies email template to clipboard         |
| `setAssetCondition(offId, idx, assetId, condition)` | Records asset return condition  |
| `calcGratuity(offId, stepIdx)`       | Calculates EOSB and settlement             |
