# Company Documents Module

## Overview

The **Company Documents Module** provides secure document storage using **IndexedDB** for binary file management. Documents are organized by entity and category.

**Render Function**: `render_company_docs()` (Line ~608)

---

## Sub-Tabs

| Tab     | Title                | Purpose                                    |
|---------|----------------------|--------------------------------------------|
| `docs`  | 📁 Company Documents | Upload, view, and manage files             |
| `forms` | 📝 Legal Forms       | Entity-specific legal form templates       |

---

## Document Categories (`COMPANY_DOC_CATS`)

| ID              | Label              | Icon | Color     | Background |
|-----------------|---------------------|------|-----------|------------|
| `agreements`    | Agreements          | 🤝   | `#0369A1` | `#E0F2FE`  |
| `hr_manual`     | HR Manual           | 📘   | `#7C3AED` | `#EDE9FE`  |
| `sales_policy`  | Sales Policies      | 📊   | `#059669` | `#DCFCE7`  |
| `trade_license` | Trade License       | 🏛️   | `#D97706` | `#FEF3C7`  |
| `broker_cards`  | Broker Cards        | 🪪   | `#1D3557` | `#E1EFFE`  |
| `orn`           | ORN Documents       | 🔢   | `#BE185D` | `#FCE7F3`  |
| `official`      | Official Documents  | 📋   | `#374151` | `#F1F5F9`  |

---

## Legal Forms (`LEGAL_FORMS`)

### IST Real Estate

| Form ID      | Label        | Icon |
|-------------|--------------|------|
| `leasing`    | Leasing Form | 🏠   |
| `a2a`        | A2A Form     | 🔄   |
| `loi`        | LOI          | 📝   |
| `contract_a` | Contract A   | 📄   |
| `contract_b` | Contract B   | 📄   |
| `contract_f` | Contract F   | 📄   |

### IST Markets

| Form ID             | Label               | Icon |
|--------------------|----------------------|------|
| `client_agreement`  | Client Agreement     | 🤝   |
| `ib_agreement`      | IB Agreement         | 🏦   |
| `pam_agreement`     | PAM Agreement        | 📈   |
| `risk_disclosure`   | Risk Disclosure      | ⚠️   |

---

## Storage Architecture

Documents are stored in **IndexedDB** (not localStorage), allowing:
- Binary file storage (PDF, DOCX, images, etc.)
- No size limitations of localStorage (~5MB)
- Asynchronous read/write operations

### IndexedDB Schema

**Database**: `ist_company_docs` (version 1)

| Store | Key    | Indexes                                    |
|-------|--------|--------------------------------------------|
| `docs`| `id`   | `entity` (non-unique), `category` (non-unique) |

### Document Record

```javascript
{
  id: 1,                           // Auto-incremented
  entity: "RE",
  category: "agreements",
  fileName: "Employment_Contract.pdf",
  fileType: "application/pdf",
  fileSize: 245760,
  uploadedAt: "2026-04-15T10:30:00.000Z",
  data: ArrayBuffer                // Raw binary content
}
```

---

## UI Components

### Document Category Grid

Each category is displayed as a card with:
- Category icon and label
- Upload button (file picker)
- List of uploaded files with:
  - File name
  - File size (formatted)
  - Upload date
  - View button (opens in new tab)
  - Delete button

### Upload Flow

```
1. Click "Upload" on category card
2. File picker opens (accepts all file types)
3. File selected → saveCompanyDoc(entity, category, file)
4. Binary data stored in IndexedDB
5. UI refreshes to show new file in list
```

### View Flow

```
1. Click "View" on file row
2. openCompanyDocFile(id) retrieves from IndexedDB
3. Creates Blob from ArrayBuffer
4. Opens object URL in new browser tab
```

---

## Key Functions

| Function                          | Purpose                                    |
|-----------------------------------|--------------------------------------------|
| `render_company_docs()`           | Renders the documents/forms UI             |
| `openCompanyDocsDB()`             | Opens/creates IndexedDB database           |
| `saveCompanyDoc(entity, cat, file)`| Stores a file in IndexedDB                |
| `getCompanyDocs(entity, cat)`     | Retrieves documents by entity/category     |
| `deleteCompanyDoc(id)`            | Removes a document from IndexedDB          |
| `openCompanyDocFile(id)`          | Opens a document in a new browser tab      |
