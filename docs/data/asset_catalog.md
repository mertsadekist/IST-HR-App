# Asset Catalog (PLATFORM_CATALOG & ASSET_CATEGORIES)

## Overview

The Asset Catalog defines all platforms, tools, and hardware that can be assigned to employees. It is organized into categories and filtered by entity.

---

## Asset Categories (`ASSET_CATEGORIES`)

| ID              | Label              | Icon  | Color     |
|-----------------|--------------------|-------|-----------|
| `email`         | Email & Calendar   | 📧    | `#0369A1` |
| `crm`           | CRM & Sales        | 🎯    | `#7C3AED` |
| `communication` | Communication      | 📞    | `#059669` |
| `productivity`  | Productivity       | 📊    | `#D97706` |
| `security`      | Security           | 🛡️    | `#DC2626` |
| `marketing`     | Marketing          | 📣    | `#EA580C` |
| `hardware`      | Hardware           | 💻    | `#374151` |
| `access`        | Physical Access    | 🔑    | `#1D3557` |

---

## Platform Catalog (`PLATFORM_CATALOG`)

### Email & Calendar

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Microsoft Outlook     | BOTH   | Primary email client                 |
| Google Workspace      | BOTH   | Secondary email/docs                 |
| Microsoft Exchange    | BOTH   | Email server access                  |

### CRM & Sales

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Bitrix24              | BOTH   | Primary CRM for both entities        |
| Skale CRM             | MKT    | Secondary CRM for Markets            |
| DNCR Portal           | RE     | Do Not Call Registry portal          |
| WATI                  | RE     | WhatsApp Business CRM integration    |
| Listings Users        | RE     | Property listing management          |

### Communication

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Microsoft Teams       | BOTH   | Internal communication               |
| Yeastar VOIP          | BOTH   | Office phone system                  |
| VOISO                 | MKT    | Cloud contact center                 |
| WhatsApp Business     | BOTH   | Client communication                 |

### Productivity

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Microsoft Office 365  | BOTH   | Office suite                         |
| OneDrive              | BOTH   | Cloud file storage                   |
| Google Drive          | BOTH   | Shared document storage              |

### Security

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Kaspersky Antivirus   | BOTH   | Endpoint security                    |
| Cyber Protect         | BOTH   | Backup and security                  |

### Hardware

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Company Laptop        | BOTH   | Standard-issue work laptop           |
| Company Phone         | BOTH   | Work mobile device                   |
| Headset               | BOTH   | Audio equipment                      |
| SIM Card              | BOTH   | Company mobile SIM                   |

### Physical Access

| Platform              | Entity | Notes                               |
|-----------------------|--------|--------------------------------------|
| Access Card / Key Fob | BOTH   | Building entry                       |
| Office Keys           | BOTH   | Office/drawer keys                   |
| Biometric Registration| BOTH   | Fingerprint/face for attendance      |

---

## Asset Types

Each asset can be classified as:

| Type       | Badge Color | Description                         |
|------------|-------------|--------------------------------------|
| Hardware   | Blue        | Physical devices and equipment       |
| Account    | Purple      | Software accounts and licenses       |
| Software   | Teal        | Installed software                   |

---

## Asset Statuses

| Status       | Badge Color | Description                         |
|--------------|-------------|--------------------------------------|
| Active       | Green       | Currently in use by employee         |
| Returned     | Orange      | Returned by employee (offboarding)   |
| Deactivated  | Red         | Account revoked or access removed    |
| Missing      | Red         | Lost or unaccounted for              |

---

## Inventory Tracking

Each platform has an **inventory total** stored in localStorage (`ist_inv_totals`):

```javascript
{
  "Company Laptop": 25,
  "Company Phone": 15,
  "Microsoft Office 365": 50,
  // ...
}
```

Available stock is calculated as:
```
Available = Total Inventory - Active Assignments
```

The inventory auto-updates when assets are assigned (onboarding) or returned (offboarding).
