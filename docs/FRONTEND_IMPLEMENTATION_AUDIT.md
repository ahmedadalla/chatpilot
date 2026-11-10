# ChatPilot — Frontend Implementation Audit

**Date:** 2026-11-08  
**Auditor:** Senior Next.js Architect & Professional SaaS UI/UX Designer  
**Scope:** `apps/web`, `packages/ui`

---

## 1. Executive Summary

A comprehensive audit of `apps/web` revealed that the frontend exists only as an early static prototype consisting of a handful of mock HTML pages. It lacks a production-quality styling pipeline, an enterprise component architecture, secure Backend-for-Frontend (BFF) authentication, dynamic RTL/LTR localization, and integration with the backend API.

The entire frontend must be replaced with a professional, production-quality SaaS application designed specifically for restaurant operations, supporting all six roles (`SUPER_ADMIN`, `COMPANY_ADMIN`, `BRANCH_MANAGER`, `KITCHEN`, `DELIVERY`, `STAFF`).

---

## 2. Detailed Technical Audit Findings

### 2.1 Dependencies & Package Setup (`apps/web/package.json`)

- **Present dependencies**: `next@14.2.5`, `react@18.3.1`, `react-dom@18.3.1`, `next-intl@3.17.2`, `@chatpilot/config`, `@chatpilot/contracts`, `@chatpilot/ui`.
- **Missing critical libraries**:
  - `@tanstack/react-query`: Missing. All pages currently render hardcoded static tables with no data-fetching layer, caching, or invalidation.
  - `@tanstack/react-table`: Missing. Needed for enterprise tables with sorting, pagination, and filtering.
  - `recharts`: Missing. Needed for real analytics charts.
  - `socket.io-client`: Missing. Realtime operational boards for kitchen and delivery have no live socket connection.
  - `lucide-react`: Missing. No icon system exists; pages use raw unicode characters or emojis.
  - `clsx` & `tailwind-merge`: Missing. Needed for dynamic Tailwind class composition.
  - `date-fns`: Missing. Needed for localized date/time formatting.

### 2.2 Styling & Design Infrastructure

- **Tailwind Configuration**: Missing. No `tailwind.config.ts` or `tailwind.config.js` exists in `apps/web`.
- **PostCSS Configuration**: Missing. No `postcss.config.js` exists.
- **Global Stylesheet**: Missing. No `globals.css` exists in `apps/web/src/`.
- **CSS Ingestion**: `apps/web/src/app/layout.tsx` references Tailwind utility classes (`min-h-screen bg-slate-50 text-slate-900`), but without `globals.css` containing `@tailwind base; @tailwind components; @tailwind utilities;`, utility classes do not compile or render in the browser.
- **Color Tokens & Design System**: Completely absent. No CSS custom properties for light/dark modes, border radii, semantic status indicators, or elevation shadows.

### 2.3 Localization & RTL Setup

- `apps/web/src/app/layout.tsx` hardcodes `<html lang="ar" dir="rtl">`.
- There is no mechanism to toggle between Arabic (`ar-EG`, RTL) and English (`en-US`, LTR).
- `messages/ar.json` and `messages/en.json` contain only 10 basic keys (`Common`, `Auth`, `WhatsApp`). Entire modules (menu, branches, orders, staff, analytics, kitchen, delivery, settings, errors) have zero translations.
- No logical CSS property discipline (`ms-*`, `me-*`, `start-*`, `end-*`) was implemented in the mock pages.

### 2.4 Authentication & BFF Architecture

- **BFF Route Handlers**: Zero route handlers exist in `apps/web/src/app/api/`.
- **Token Security**: No mechanism exists to store JWTs in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Public Auth Pages**:
  - `/login`: Missing.
  - `/reset-password`: Missing.
  - `/invitations/[token]`: Missing.
  - `/mfa`: Missing.
  - `/access-denied`: Missing.
- The home page (`apps/web/src/app/page.tsx`) is a static landing card with badge links that navigate nowhere.

### 2.5 Role Portals & Application Pages

The existing pages under `apps/web/src/app/` are static mockups with hardcoded dummy rows:

- `admin/companies/page.tsx`: Static table with 1 fake company (`bistro-cairo`). No create dialog, no status toggling, no pagination.
- `company/branches/page.tsx`: Static table with 1 fake branch (`CAI-01`). No create dialog, no edit form.
- `company/settings/page.tsx`: Static inputs with hardcoded values. Save button does nothing.
- `company/staff/page.tsx`: Static table with 1 fake user. No invite dialog, no deactivation.
- `company/menu/page.tsx`: Static list of 2 items. No categories tab, no branch override matrix, no image upload.
- `company/knowledge/page.tsx`: Static table. No document upload, no semantic search tester.
- `company/analytics/page.tsx`: 4 static text cards with hardcoded numbers.
- `branch/settings/page.tsx`: Static inputs.
- `branch/menu/page.tsx`: Static toggle.
- `branch/analytics/page.tsx`: Static text cards.
- `kitchen/page.tsx`: Static order card. Transition buttons have no event handlers or API connection.
- `delivery/page.tsx`: Static delivery card. Transition buttons have no event handlers or API connection.

### 2.6 Shared UI Primitives (`packages/ui`)

- `packages/ui/src/index.ts` contains only 2 utility lines (`RTL_LOCALES` and `isRtlLocale`).
- No shared components (buttons, dialogs, badges, inputs, skeletons, error boundaries) exist.

---

## 3. Required Frontend Architecture & Roadmap

1. **Foundation (`apps/web`)**:
   - Install required dependencies: `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, `lucide-react`, `socket.io-client`, `clsx`, `tailwind-merge`, `date-fns`.
   - Setup `tailwind.config.ts`, `postcss.config.js`, and `apps/web/src/styles/globals.css` with semantic color tokens.
   - Configure dynamic RTL/LTR support in `layout.tsx` with Google fonts `Cairo` and `Inter`.
   - Greatly expand `messages/ar.json` and `messages/en.json`.
2. **Component Library (`apps/web/src/components/ui/`)**:
   - Button, Input, Select, Switch, Badge, StatusBadge, Dialog, FormDialog, ConfirmDialog, Card, DashboardCard, DataTable, LoadingSkeleton, EmptyState, ErrorState, PermissionDenied, Toast.
3. **BFF Layer (`apps/web/src/app/api/`)**:
   - `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/mfa/setup`, `/api/auth/mfa/verify`, `/api/auth/invitations/accept`, `/api/socket/token`.
   - Universal authenticated reverse-proxy `/api/[...proxy]` with automatic token refresh on 401.
4. **Application Shell & Realtime**:
   - `AppShell` with responsive collapsible sidebar, role-driven navigation, breadcrumbs, header with language/branch switchers, and Socket.IO status indicator.
5. **Full Role Portals**:
   - Super Admin: Dashboard, Companies, Audited Support View, Plans & Subscriptions, Audit Logs, Platform Analytics.
   - Company Admin: Dashboard, Branches, Menu (Categories, Items, Overrides), Staff, Orders, WhatsApp Integration Cards, Knowledge Base & Search Tester, AI Settings, Analytics, Settings, Usage.
   - Branch Manager: Branch Dashboard, Orders, Read-Only Kitchen/Delivery Monitors, Branch Staff, Branch Menu Availability, Branch Analytics, Branch Settings.
   - Kitchen: Touch-optimized Kanban swimlanes with audio/visual realtime alerts and order transitions.
   - Staff: Intake board with accept/reject transitions.
   - Delivery: Touch-optimized Delivery Kanban (Ready, Out for Delivery) with delivery failure modal and mark delivered action.
