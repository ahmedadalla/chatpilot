# ChatPilot — Frontend Architecture & Technical Specification

**Version:** 1.0.0  
**Author:** Principal Full-Stack Engineer & Senior Next.js Architect  
**Platform:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS  
**Target:** Multi-Tenant Restaurant SaaS Platform

---

## 1. Architectural Overview

ChatPilot's frontend is architected as a same-origin Backend-for-Frontend (BFF) running on Next.js 14 App Router. It is designed to serve six distinct operational roles:

1. `SUPER_ADMIN` (Platform operator)
2. `COMPANY_ADMIN` (Restaurant business owner)
3. `BRANCH_MANAGER` (Branch operational supervisor)
4. `KITCHEN` (Kitchen staff / KDS)
5. `DELIVERY` (Delivery driver / dispatcher)
6. `STAFF` (Front-of-house intake operator)

### Core Architectural Invariants:

1. **Zero Access Token Exposure:** Access tokens (`cp_at`) and refresh tokens (`cp_rft`) are stored exclusively in `HttpOnly`, `SameSite=Lax`, `Secure` cookies. Browser JavaScript never accesses raw JWT strings.
2. **Same-Origin BFF Proxy:** The client browser communicates exclusively with `/api/...` route handlers on the same origin. The BFF securely proxies requests to the internal NestJS API (`http://127.0.0.1:4000/api/v1`), attaching the bearer authorization header server-to-server.
3. **Transparent Session Refresh:** When the internal API returns `401 Unauthorized`, the BFF intercepts the response, issues a token refresh request using `cp_rft`, rotates both session cookies, and transparently retries the user request.
4. **Server-Authoritative Scope & Capabilities:** Client state never dictates role, companyId, branchId, or permissions. All navigation, action visibility, and routing originate from the server-verified `GET /auth/me` endpoint.
5. **Arabic-First Dynamic RTL/LTR:** Dynamic document direction (`rtl` / `ltr`) and language switching (`ar-EG` default, `en-US`), using logical CSS properties (`ms-*`, `me-*`, `start-*`, `end-*`, `ps-*`, `pe-*`) and typography (`Cairo` for Arabic, `Inter` for Latin).

---

## 2. Directory & Component Structure

```
apps/web/
├── messages/
│   ├── ar.json                 # Comprehensive Arabic localization dictionary
│   └── en.json                 # Comprehensive English localization dictionary
├── src/
│   ├── app/
│   │   ├── (auth)/             # Public authentication routes
│   │   │   ├── login/
│   │   │   ├── reset-password/
│   │   │   ├── invitations/[token]/
│   │   │   ├── mfa/
│   │   │   └── access-denied/
│   │   ├── (platform)/         # SUPER_ADMIN portal
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── companies/
│   │   │       │   └── [id]/   # Audited support view
│   │   │       ├── plans/
│   │   │       ├── audit-logs/
│   │   │       └── analytics/
│   │   ├── (company)/          # COMPANY_ADMIN portal
│   │   │   └── company/
│   │   │       ├── dashboard/
│   │   │       ├── branches/
│   │   │       ├── menu/
│   │   │       ├── staff/
│   │   │       ├── orders/
│   │   │       ├── whatsapp/
│   │   │       ├── knowledge/
│   │   │       ├── ai-settings/
│   │   │       ├── analytics/
│   │   │       ├── settings/
│   │   │       └── usage/
│   │   ├── (branch)/           # BRANCH_MANAGER portal
│   │   │   └── branch/
│   │   │       ├── dashboard/
│   │   │       ├── orders/
│   │   │       ├── kitchen-monitor/
│   │   │       ├── delivery-monitor/
│   │   │       ├── staff/
│   │   │       ├── menu/
│   │   │       ├── analytics/
│   │   │       └── settings/
│   │   ├── kitchen/            # KITCHEN touch-optimized KDS board
│   │   ├── staff/              # STAFF intake queue
│   │   ├── delivery/           # DELIVERY driver dispatch board
│   │   ├── api/                # Backend-for-Frontend (BFF) route handlers
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   ├── me/
│   │   │   │   ├── refresh/
│   │   │   │   ├── mfa/
│   │   │   │   │   ├── setup/
│   │   │   │   │   └── verify/
│   │   │   │   ├── password-reset/
│   │   │   │   │   ├── request/
│   │   │   │   │   └── complete/
│   │   │   │   └── invitations/accept/
│   │   │   ├── socket/token/   # Handshake ticket generator
│   │   │   └── [...proxy]/     # Universal authenticated API proxy
│   │   ├── layout.tsx          # Root layout with providers
│   │   └── page.tsx            # Dynamic root landing page
│   ├── components/
│   │   ├── layout/
│   │   │   └── app-shell.tsx   # Role-driven sidebar shell & header
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── textarea.tsx
│   │       ├── badge.tsx
│   │       ├── status-badge.tsx
│   │       ├── card.tsx
│   │       ├── dashboard-card.tsx
│   │       ├── dialog.tsx
│   │       ├── form-dialog.tsx
│   │       ├── confirm-dialog.tsx
│   │       ├── data-table.tsx  # TanStack Table integration
│   │       ├── loading-skeleton.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-state.tsx
│   │       ├── permission-denied.tsx
│   │       └── toast.tsx       # Toast context and notifications
│   ├── providers/
│   │   ├── locale-provider.tsx # Dynamic RTL/LTR & i18n
│   │   ├── query-provider.tsx  # TanStack QueryClient
│   │   ├── auth-provider.tsx   # Server session context
│   │   └── socket-provider.tsx # Realtime Socket.IO integration
│   ├── hooks/
│   │   └── use-permissions.ts  # Capability checking hook
│   └── lib/
│       ├── api-client.ts       # Typed API client wrapper
│       ├── bff-cookies.ts      # HttpOnly cookie serializer
│       └── utils.ts            # Formatting & class merging
```

---

## 3. Data Fetching & State Management

- **Server State:** Managed through `@tanstack/react-query`. Caches are invalidated dynamically when state-changing operations succeed and when real-time Socket.IO events arrive.
- **Cache Stale Times:**
  - Active Orders & Boards: 10–30 seconds.
  - User Identity (`/auth/me`): 60 seconds.
  - Configuration & Settings: 5 minutes.
- **Realtime Integration:**
  - WebSocket client connects to `/events` namespace using a short-lived (60s) single-use token obtained via `GET /api/socket/token`.
  - Reconnects automatically with exponential backoff.
  - Listens for `order:new`, `order:status_changed`, `kitchen:order_ready`, `delivery:order_ready`, and `platform:company_suspended`.
  - On events, displays toasts, plays chimes, and triggers targeted query cache invalidations.

---

## 4. Security & Role Matrix Enforcement

| Role             | Permitted Routes | Prohibited Operations                                                                                                             |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`    | `/admin/*`       | Day-to-day restaurant menu or order operations. Audited inspection required to read company details.                              |
| `COMPANY_ADMIN`  | `/company/*`     | Platform settings, cross-company access, direct operational kitchen/delivery status transitions.                                  |
| `BRANCH_MANAGER` | `/branch/*`      | Kitchen cooking transitions (prep/ready), delivery driver transitions (start/delivered). Can only admin-cancel or report failure. |
| `KITCHEN`        | `/kitchen`       | Financial analytics, delivery transitions, company settings.                                                                      |
| `DELIVERY`       | `/delivery`      | Rejection of pending orders, kitchen preparation transitions, financial analytics.                                                |
| `STAFF`          | `/staff`         | Preparation transitions, ready transitions, delivery transitions, financial analytics.                                            |
