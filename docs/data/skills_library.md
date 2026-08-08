# Skills Library (SKILLS_LIBRARY)

## Overview

The `SKILLS_LIBRARY` is a categorized collection of professional skills used in the **Candidate Profile** and **CV Scorer** modules. Skills are organized into groups and can be selected via an interactive panel with search and bulk toggle functionality.

---

## Skills Panel UI

The skills panel (`.sp-wrap`) features:

| Component     | Purpose                                    |
|---------------|--------------------------------------------|
| Search input  | Filter skills across all groups            |
| Selected count| Badge showing number of selected skills    |
| Clear button  | Remove all selected skills                 |
| Selected tags | Visual chips for each selected skill       |
| Group sections| Collapsible groups with Select All/None    |

### Interactions
- **Search**: Real-time filtering across all groups
- **Click skill**: Toggle selection on/off
- **Select All**: Select all skills in a group
- **Select None**: Deselect all skills in a group
- **Remove tag**: Click × on a tag to deselect

---

## Skill Categories

### Sales & Business Development
- Lead Generation, Cold Calling, Client Relationship Management
- Negotiation, Closing Deals, Account Management
- CRM Management, Sales Pipeline Management
- Upselling, Cross-selling, Territory Management

### Real Estate Specific
- Property Valuation, Market Analysis
- Off-Plan Sales, Secondary Market
- RERA Knowledge, DLD Procedures
- Trakheesi System, Property Listing Management

### Forex / Financial Markets
- MetaTrader 4/5, Forex Trading Knowledge
- IB Management, Client Onboarding
- Risk Management, Compliance (AML/KYC)
- Market Analysis (Technical/Fundamental)

### Marketing & Digital
- Social Media Management, Content Creation
- SEO/SEM, Google Analytics
- Email Marketing, Campaign Management
- Graphic Design, Video Production

### IT & Technical
- Network Administration, System Administration
- Cybersecurity, Cloud Computing
- Database Management, Software Development
- Help Desk / IT Support

### Languages
- English, Arabic, Hindi, Urdu
- Tagalog, French, Russian
- Spanish, Mandarin, Portuguese

### Soft Skills
- Communication, Leadership, Teamwork
- Problem Solving, Time Management
- Adaptability, Critical Thinking
- Presentation Skills, Conflict Resolution

---

## Data Structure

```javascript
SKILLS_LIBRARY = [
  {
    group: "Sales & Business Development",
    skills: [
      "Lead Generation",
      "Cold Calling",
      "Client Relationship Management",
      // ...
    ]
  },
  {
    group: "Real Estate Specific",
    skills: [ ... ]
  },
  // ...
];
```

---

## Usage

The Skills Library is used in:

1. **Candidate Profile** — Selecting skills during candidate creation/editing
2. **CV Scorer** — Matching parsed CV skills against required skills
3. **CV Auto-Parse** — Identifying skills found in uploaded CVs
4. **Vacancy Profile** — Defining must-have and nice-to-have skills
