# Multi Vault — Personal Knowledge Workspace

**Version:** 1.0  
**Design Aesthetic:** Obsidian Vault (Dark Charcoal `#0D0B12`, Deep Surfaces `#121019`, Violet Accent `#8B5CF6`)  
**Frontends:** React (complete & verified), Angular (Phase 5), Vue.js (Phase 6)  
**Backend:** Node.js + Express REST API with MongoDB / Mongoose & local embedded fallback  

---

## 🏛️ Project Overview

**Multi Vault** is a calm, polished, privacy-first personal knowledge workspace built from scratch. It features:
- **Authentication:** Registration, login, logout, secure bcrypt password hashing, and user data isolation.
- **Dashboard:** Real, non-fictional metrics (total notes, active tags, journal count, today's journal status) and recent note shortcuts.
- **Notes CRUD:** Full markdown/text note creation, editing, tagging, linking to other notes, sorting, and unsaved changes protection.
- **Tags Management:** Normalized tag taxonomy (`#tag`), counts, and instant filter navigation.
- **Daily Journal:** Strict 1-entry-per-user-per-day enforcement via unique database compound indexes, date stepping, and history navigation.
- **Knowledge Graph:** Interactive SVG network showing explicit note connections and shared tag relationships, with an accessible list view alternative.
- **Settings:** Working preferences for themes (Obsidian, Classic Dark, Violet Night), default sort orders, and session management.

---

## 📁 Repository Structure

```text
Multi Vault New Version/
├── backend/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── config/           # Database configuration (MongoDB & embedded fallback)
│   │   ├── models/           # Mongoose models (User, Note, JournalEntry)
│   │   ├── middleware/       # Auth (JWT) & Error handling
│   │   ├── routes/           # REST endpoints (/api/health, /auth, /notes, /tags, etc.)
│   │   └── server.js         # Express app initialization
│   ├── test/                 # Automated test suite (15/15 tests passing)
│   └── package.json
├── frontend-react/           # React + Vite Single-Page Application
│   ├── src/
│   │   ├── components/       # Reusable UI (Sidebar, Header, ConfirmModal, Icons)
│   │   ├── context/          # AuthContext for session & theme management
│   │   ├── pages/            # Dashboard, Notes, Editor, Journal, Graph, Tags, Settings
│   │   ├── services/         # Centralized API service
│   │   ├── App.jsx           # App shell and routing
│   │   └── index.css         # Obsidian Vault design system tokens & styles
│   └── package.json
├── docs/                     # Project Specifications & Tracking
│   ├── PRD.md                # Product Requirements Document
│   ├── TRD.md                # Technical Requirements Document
│   ├── DESIGN_SPEC.md        # Obsidian Vault Design Tokens & Layout Spec
│   ├── IMPLEMENTATION_PROMPT.md
│   └── learning-log.md       # Incremental phase log and verification records
├── .gitignore                # Protects secrets, node_modules, and build outputs
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on `v24.22.1`)
- **npm**: v9+ (tested on `11.19.1`)

### 2. Start the Backend API
```powershell
cd "c:\Users\Vijaykumar\OneDrive\Desktop\Multi Vault New Version\backend"
npm install
npm start
```
The REST API runs at `http://localhost:5000`.  
Check health status at: `http://localhost:5000/api/health`

### 3. Start the React Frontend
```powershell
cd "c:\Users\Vijaykumar\OneDrive\Desktop\Multi Vault New Version\frontend-react"
npm install
npm run dev
```
Open your browser and navigate to: `http://localhost:5173`

---

## 🧪 Automated Testing

Multi Vault includes a 15-point automated regression test suite covering:
- Health check endpoint
- User registration and login
- Prevention of duplicate email accounts (HTTP 409)
- Unauthenticated route rejection (HTTP 401)
- User-to-user data isolation
- Note creation, searching, tag filtering, updates, and deletion
- Tag aggregation and metrics
- Unique Daily Journal upsert constraint (`{ userId, entryDate }`)
- Real dashboard calculations
- Knowledge graph edge computation (explicit links & shared tags)
- Settings updates and retrieval

To execute the test suite:
```powershell
cd "c:\Users\Vijaykumar\OneDrive\Desktop\Multi Vault New Version\backend"
npm test
```
*Result: 15 / 15 tests passed.*

---

## 🎨 Design Tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0D0B12` | Obsidian Main Background |
| `--color-sidebar` | `#121019` | Left Navigation Sidebar (240px) |
| `--color-surface` | `#191622` | Cards & Editor Background |
| `--color-surface-raised` | `#211D2C` | Modals, Dropdowns & Menus |
| `--color-border` | `#342D43` | Borders & Dividers |
| `--color-primary` | `#8B5CF6` | Primary Violet Accent |
| `--color-primary-hover` | `#A78BFA` | Interactive Violet Hover |
| `--color-primary-soft` | `#2A2040` | Selected Item Highlights |
| `--color-text` | `#F5F3FA` | Primary Readable Typography |
| `--color-text-secondary` | `#B7B0C6` | Supporting Descriptions |
| `--color-text-muted` | `#898196` | Metadata & Timestamps |
| `--color-success` | `#4ADE80` | Save confirmation & active states |
| `--color-danger` | `#F87171` | Delete & destructive actions |

---

## 📚 Documentation
- [PRD.md](file:///c:/Users/Vijaykumar/OneDrive/Desktop/Multi%20Vault%20New%20Version/docs/PRD.md)
- [TRD.md](file:///c:/Users/Vijaykumar/OneDrive/Desktop/Multi%20Vault%20New%20Version/docs/TRD.md)
- [DESIGN_SPEC.md](file:///c:/Users/Vijaykumar/OneDrive/Desktop/Multi%20Vault%20New%20Version/docs/DESIGN_SPEC.md)
- [Learning Log](file:///c:/Users/Vijaykumar/OneDrive/Desktop/Multi%20Vault%20New%20Version/docs/learning-log.md)
