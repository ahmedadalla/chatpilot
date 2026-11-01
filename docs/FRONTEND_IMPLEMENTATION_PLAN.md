# ChatPilot frontend implementation plan

## Outcome

Replace the current raw/static presentation with a consistent, responsive RTL/LTR operations workspace that exposes real loading, empty, error, and success states while keeping the existing API contracts and permission model.

## Completed foundation

- Add the missing Tailwind and PostCSS pipeline.
- Add global base styles, focus states, responsive defaults, and shared design tokens.
- Import the global stylesheet from the root layout.
- Replace the empty landing page with a responsive product entry point and dashboard preview.

## Delivery phases

1. **Stabilize the shell**
   - Keep role-based navigation driven by the existing authenticated user.
   - Add active section grouping, mobile drawer behavior, breadcrumbs, notifications, and a consistent user menu.
   - Standardize page headers, cards, tables, dialogs, badges, skeletons, and error alerts.
2. **Make the operational flows first-class**
   - Orders: filters, search, pagination, detail drawer, status transitions, optimistic feedback, and live refresh.
   - Kitchen and delivery: dense board layout, elapsed-time indicators, sound/visual alerts, branch switching, and clear action confirmations.
   - WhatsApp: connection status, QR/setup states, routing controls, and recoverable provider errors.
3. **Complete company administration**
   - Branches, staff, menu, knowledge base, settings, billing, and analytics pages should use real API data with create/edit/delete flows.
   - Add form validation, destructive-action confirmation, upload progress, and permission-aware empty states.
4. **Platform administration**
   - Add company search, health/subscription status, support actions, and platform analytics visualizations.
   - Ensure super-admin-only surfaces fail closed and explain access errors.
5. **Quality and release**
   - Add route smoke tests, component tests for forms and status transitions, and Playwright coverage for login-to-operations.
   - Validate Arabic RTL and English LTR at mobile, tablet, and desktop breakpoints.
   - Run typecheck, lint, unit, build, and the existing integration/e2e suites before release.

## Acceptance criteria

- No route renders browser-default white pages or unstyled controls.
- Every data-backed page has loading, empty, error, and retry states.
- Keyboard focus, labels, dialog semantics, and responsive navigation work in both locales.
- API failures are visible to the user; no success-shaped fallback masks an error.
- The visual system is shared instead of duplicated across route pages.
