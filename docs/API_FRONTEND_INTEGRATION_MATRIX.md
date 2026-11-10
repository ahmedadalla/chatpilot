# ChatPilot — API & Frontend Integration Matrix

**Date:** 2026-11-08  
**Scope:** Integration mapping between frontend role portals/screens and backend API endpoints.

---

## 1. Authentication & Common Endpoints

| Feature / Screen                                         | Backend Endpoint                | Method | Required Capability           | Status                | Required Work                                                                                       |
| -------------------------------------------------------- | ------------------------------- | ------ | ----------------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| User Identity & Permissions (`AppShell`, `AuthProvider`) | `/auth/me`                      | GET    | `staff:self:read`             | MISSING               | Implement `GET /auth/me` in `AuthController`. Create BFF route `/api/auth/me`.                      |
| Login (`/login`)                                         | `/auth/login`                   | POST   | None (Public)                 | IMPLEMENTED           | Wire through BFF route `/api/auth/login`. Sets `cp_at` and `cp_rft` HttpOnly cookies.               |
| Logout (User Menu)                                       | `/auth/logout`                  | POST   | Authenticated                 | PARTIALLY_IMPLEMENTED | Fix backend to call `sessionService.revokeSession(sessionId)`. Wire through BFF `/api/auth/logout`. |
| Session Refresh                                          | `/auth/refresh`                 | POST   | None (Public / Cookie)        | IMPLEMENTED           | Wire into BFF `/api/auth/refresh` and transparent proxy retry logic.                                |
| Password Reset Request (`/reset-password`)               | `/auth/password-reset/request`  | POST   | None (Public)                 | IMPLEMENTED           | Connect via BFF `/api/auth/password-reset/request`.                                                 |
| Password Reset Complete (`/reset-password`)              | `/auth/password-reset/complete` | POST   | None (Public)                 | IMPLEMENTED           | Connect via BFF `/api/auth/password-reset/complete`.                                                |
| Accept Invitation (`/invitations/[token]`)               | `/auth/invitations/accept`      | POST   | None (Public)                 | IMPLEMENTED           | Connect via BFF `/api/auth/invitations/accept`.                                                     |
| Super Admin MFA Setup (`/mfa`)                           | `/auth/mfa/setup`               | POST   | Authenticated (`SUPER_ADMIN`) | IMPLEMENTED           | Connect via BFF `/api/auth/mfa/setup`.                                                              |
| Super Admin MFA Verify (`/mfa`)                          | `/auth/mfa/verify`              | POST   | Authenticated (`SUPER_ADMIN`) | MISSING               | Add `POST /auth/mfa/verify` in `AuthController`. Connect via BFF.                                   |
| Socket Handshake Ticket                                  | `/socket/ticket`                | POST   | Authenticated                 | MISSING               | Add `POST /socket/ticket` in backend. Connect via BFF `/api/socket/token`.                          |

---

## 2. Super Admin Portal (`/admin/`)

| Feature / Screen                                       | Backend Endpoint                | Method | Required Capability        | Status      | Required Work                                                                            |
| ------------------------------------------------------ | ------------------------------- | ------ | -------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Platform Dashboard KPIs                                | `/analytics/platform`           | GET    | `analytics:platform`       | IMPLEMENTED | Render Recharts & KPI cards. Compute SaaS MRR dynamically from subscriptions.            |
| List Companies (`/admin/companies`)                    | `/platform/companies`           | GET    | `company:read`             | IMPLEMENTED | Render DataTable with search, status filters, and pagination.                            |
| Create Company Modal                                   | `/companies`                    | POST   | `company:create`           | IMPLEMENTED | Form dialog: name, slug, admin email, Egypt defaults. Returns generated invitation link. |
| Suspend Company Action                                 | `/companies/:id/suspend`        | PATCH  | `company:suspend/activate` | IMPLEMENTED | Confirm dialog with mandatory reason input. Cascades session revocation.                 |
| Activate Company Action                                | `/companies/:id/activate`       | PATCH  | `company:suspend/activate` | IMPLEMENTED | Action button with confirmation.                                                         |
| Audited Company Support View (`/admin/companies/[id]`) | `/platform/companies/:id`       | GET    | `company:read`             | IMPLEMENTED | Prompt for mandatory `reason` query param before requesting backend.                     |
| List Plans (`/admin/plans`)                            | `/billing/plans`                | GET    | None (Authenticated)       | IMPLEMENTED | Plans grid with subscriber count and limits.                                             |
| Create Plan Modal                                      | `/billing/plans`                | POST   | `company:create`           | IMPLEMENTED | Dialog configuring code, name, and limits JSON.                                          |
| Assign Subscription Modal                              | `/billing/subscriptions/assign` | POST   | `company:subscribe:assign` | IMPLEMENTED | Modal to select company and plan, activating 30-day period.                              |
| Platform Audit Logs (`/admin/audit-logs`)              | `/platform/audit-logs`          | GET    | `audit:read`               | MISSING     | Add `GET /platform/audit-logs` endpoint. Render audit trail table with detail modal.     |

---

## 3. Company Admin Portal (`/company/`)

| Feature / Screen                                | Backend Endpoint                        | Method     | Required Capability              | Status      | Required Work                                                                          |
| ----------------------------------------------- | --------------------------------------- | ---------- | -------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| Company Dashboard KPIs                          | `/analytics/company/:id`                | GET        | `analytics:company`              | IMPLEMENTED | Render KPI cards (Active, Prep, Ready, Delivered, Cancelled). Replace hardcoded stats. |
| List Branches (`/company/branches`)             | `/branches`                             | GET        | `company:read`                   | IMPLEMENTED | Render DataTable with code, name, status, delivery fee, timezone.                      |
| Create Branch Modal                             | `/branches`                             | POST       | `branch:create/deactivate`       | IMPLEMENTED | Form dialog: code, name, address, timezone, deliveryFee, minOrder.                     |
| Deactivate Branch Action                        | `/branches/:id`                         | DELETE     | `branch:create/deactivate`       | IMPLEMENTED | Confirm dialog.                                                                        |
| Update Branch Settings                          | `/branches/:id/settings`                | PATCH      | `branch:settings:write`          | IMPLEMENTED | Edit dialog for delivery fees, min order, operating hours.                             |
| Correct Branch Timezone                         | `/branches/:id/timezone`                | PATCH      | `branch:settings:write`          | IMPLEMENTED | Audited timezone correction dialog.                                                    |
| List Menu Categories (`/company/menu`)          | `/menu/categories`                      | GET        | `menu:read`                      | IMPLEMENTED | Categories list with item counts.                                                      |
| Create/Edit Category                            | `/menu/categories` / `:id`              | POST/PATCH | `menu:write`                     | IMPLEMENTED | Category form dialog.                                                                  |
| Archive Category                                | `/menu/categories/:id`                  | DELETE     | `menu:write`                     | IMPLEMENTED | Soft archive confirmation dialog.                                                      |
| List Menu Items                                 | `/menu/items`                           | GET        | `menu:read`                      | IMPLEMENTED | Items table filtered by category.                                                      |
| Create/Edit Menu Item                           | `/menu/items` / `:id`                   | POST/PATCH | `menu:write`                     | IMPLEMENTED | Item form with image upload (`/files/upload`).                                         |
| Branch Availability Matrix                      | `/menu/branches/:branchId/availability` | GET / PUT  | `menu:branch-availability:write` | IMPLEMENTED | Interactive matrix toggling availability and price overrides.                          |
| Staff Directory (`/company/staff`)              | `/staff`                                | GET        | `company:read`                   | MISSING     | Add `GET /staff` in `StaffController`. Render directory table.                         |
| Invite Staff Modal                              | `/staff/invite`                         | POST       | `staff:invite`                   | IMPLEMENTED | Invite dialog: email, role, optional branch assignment.                                |
| Deactivate Staff Action                         | `/staff/:id`                            | DELETE     | `staff:deactivate`               | IMPLEMENTED | Deactivate action. Last-admin rule enforced by backend.                                |
| Change Staff Role                               | `/staff/:id/role`                       | PATCH      | `staff:invite`                   | IMPLEMENTED | Role change dialog.                                                                    |
| List Company Orders (`/company/orders`)         | `/orders`                               | GET        | `orders:read`                    | IMPLEMENTED | Orders table with branch and status filters.                                           |
| Order Detail Dialog                             | `/orders/:id`                           | GET        | `orders:read`                    | MISSING     | Add `GET /orders/:id`. Display items snapshot and status history timeline.             |
| Admin Cancel Order                              | `/orders/:id/cancel`                    | POST       | `orders:transition:cancel`       | IMPLEMENTED | Cancellation dialog with reason selection (`CUSTOMER_REQUEST`, `OUT_OF_STOCK`, etc.).  |
| WhatsApp Connections (`/company/whatsapp`)      | `/whatsapp/connections`                 | GET        | `whatsapp:config:write`          | MISSING     | Add `GET /whatsapp/connections`. Render Meta Cloud, Coexistence, and QR cards.         |
| Setup WhatsApp Connection                       | `/whatsapp/connections`                 | POST       | `whatsapp:config:write`          | IMPLEMENTED | Onboarding flow with mandatory risk disclaimer for QR pairing.                         |
| Disconnect WhatsApp Connection                  | `/whatsapp/connections/:id`             | DELETE     | `whatsapp:config:write`          | MISSING     | Add `DELETE /whatsapp/connections/:id`.                                                |
| List Knowledge Base Docs (`/company/knowledge`) | `/kb/documents`                         | GET        | `kb:write/read`                  | IMPLEMENTED | Document repository table with branch/company scope indicator.                         |
| Upload KB Document                              | `/kb/documents`                         | POST       | `kb:write/read`                  | IMPLEMENTED | File upload and title form.                                                            |
| Delete KB Document                              | `/kb/documents/:id`                     | DELETE     | `kb:write/read`                  | IMPLEMENTED | Delete action.                                                                         |
| Reprocess KB Document                           | `/kb/documents/:id/reprocess`           | POST       | `kb:write/read`                  | IMPLEMENTED | Re-extract and chunk document.                                                         |
| Semantic Search Tester                          | `/kb/search`                            | POST       | `kb:write/read`                  | IMPLEMENTED | Search box returning matched chunks with similarity scores.                            |
| Get AI Configuration (`/company/ai-settings`)   | `/ai/config`                            | GET        | `ai:config:read`                 | MISSING     | Add `GET /ai/config`. Display provider, model, prompt, and key status.                 |
| Update AI Configuration                         | `/ai/config`                            | PATCH      | `ai:config:write`                | MISSING     | Add `PATCH /ai/config`. Form updating provider, model, prompt, encrypted key.          |
| Company Analytics (`/company/analytics`)        | `/analytics/company/:id`                | GET        | `analytics:company`              | IMPLEMENTED | Operational and financial charts (Recharts).                                           |
| Company Settings (`/company/settings`)          | `/companies/:id` / `settings`           | GET/PATCH  | `company:settings:write`         | IMPLEMENTED | Edit company profile, currency, timezone, locale.                                      |
| Usage & Subscription (`/company/usage`)         | `/billing/usage/:companyId`             | GET        | `company:usage:read`             | IMPLEMENTED | Progress meters for orders, messages, and KB documents against plan limits.            |

---

## 4. Branch Manager Portal (`/branch/`)

| Feature / Screen                              | Backend Endpoint                      | Method | Required Capability               | Status      | Required Work                                                                |
| --------------------------------------------- | ------------------------------------- | ------ | --------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| Branch Dashboard KPIs                         | `/analytics/branch/:id/operational`   | GET    | `analytics:operational:read`      | IMPLEMENTED | Operational KPI cards for assigned branch.                                   |
| Branch Orders (`/branch/orders`)              | `/orders?branchId=:id`                | GET    | `orders:read`                     | IMPLEMENTED | Branch order table. Operational transition buttons hidden!                   |
| Cancel Branch Order                           | `/orders/:id/cancel`                  | POST   | `orders:transition:cancel`        | IMPLEMENTED | Branch cancellation modal with reason.                                       |
| Report Delivery Failure                       | `/orders/:id/report-failure`          | POST   | `orders:transition:fail-delivery` | IMPLEMENTED | Modal with failure reason (`CUSTOMER_UNREACHABLE`, `WRONG_ADDRESS`, etc.).   |
| Kitchen Monitor (`/branch/kitchen-monitor`)   | `/orders/kitchen/board?branchId=:id`  | GET    | `kitchen:board`                   | IMPLEMENTED | Read-only live display of kitchen intake and preparation boards.             |
| Delivery Monitor (`/branch/delivery-monitor`) | `/orders/delivery/board?branchId=:id` | GET    | `delivery:board`                  | IMPLEMENTED | Read-only live display of delivery board.                                    |
| Branch Staff Directory (`/branch/staff`)      | `/staff?branchId=:id`                 | GET    | `company:read`                    | MISSING     | Add `GET /staff` supporting branch filter.                                   |
| Invite Branch Staff                           | `/staff/invite`                       | POST   | `staff:invite`                    | IMPLEMENTED | Branch staff invite dialog (role limited to `KITCHEN`, `DELIVERY`, `STAFF`). |
| Branch Menu Availability (`/branch/menu`)     | `/menu/branches/:id/resolved`         | GET    | `menu:read`                       | IMPLEMENTED | Display menu with branch-level toggle and price override.                    |
| Branch Analytics (`/branch/analytics`)        | `/analytics/branch/:id/financial`     | GET    | `analytics:financial:read`        | IMPLEMENTED | Financial analytics restricted to authorized branch manager.                 |
| Branch Settings (`/branch/settings`)          | `/branches/:id/settings`              | PATCH  | `branch:settings:write`           | IMPLEMENTED | Edit branch operational parameters.                                          |

---

## 5. Kitchen, Staff & Delivery Operational Boards

| Feature / Screen               | Backend Endpoint             | Method | Required Capability                | Status      | Required Work                                                                       |
| ------------------------------ | ---------------------------- | ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Kitchen Board (`/kitchen/`)    | `/orders/kitchen/board`      | GET    | `kitchen:board`                    | IMPLEMENTED | Touch-optimized Kanban swimlanes (`Pending`, `In Preparation`). Realtime Socket.IO. |
| Kitchen Accept Order           | `/orders/:id/accept`         | POST   | `orders:transition:accept`         | IMPLEMENTED | Action button on pending order card.                                                |
| Kitchen Reject Pending         | `/orders/:id/reject-pending` | POST   | `orders:transition:cancel`         | IMPLEMENTED | Rejection modal requiring reason.                                                   |
| Kitchen Start Preparation      | `/orders/:id/start-prep`     | POST   | `orders:transition:start-prep`     | IMPLEMENTED | Action button moving order to `IN_PREPARATION`.                                     |
| Kitchen Mark Ready             | `/orders/:id/mark-ready`     | POST   | `orders:transition:ready`          | IMPLEMENTED | Action button moving order to `READY_FOR_DELIVERY`.                                 |
| Staff Intake Board (`/staff/`) | `/orders/kitchen/board`      | GET    | `kitchen:board`                    | IMPLEMENTED | Simplified intake queue. Shows only Pending orders with Accept/Reject actions.      |
| Delivery Board (`/delivery/`)  | `/orders/delivery/board`     | GET    | `delivery:board`                   | IMPLEMENTED | Touch-optimized Kanban swimlanes (`Ready for Delivery`, `Out for Delivery`).        |
| Delivery Start Delivery        | `/orders/:id/start-delivery` | POST   | `orders:transition:start-delivery` | IMPLEMENTED | Action button moving order to `OUT_FOR_DELIVERY`.                                   |
| Delivery Mark Delivered        | `/orders/:id/mark-delivered` | POST   | `orders:transition:complete`       | IMPLEMENTED | Action button moving order to `DELIVERED`.                                          |
| Delivery Report Failure        | `/orders/:id/report-failure` | POST   | `orders:transition:fail-delivery`  | IMPLEMENTED | Modal with mandatory reason.                                                        |
