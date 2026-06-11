# Trakvora — Platform TODO
*Last verified: 2026-06-08 | Completion: ~80% web MVP | Payment model: direct carrier payments + Trakvora commission*

---

## ✅ Completed (Phase 1 MVP)
- [x] Multi-role auth — email / OTP / Google OAuth (shipper, owner, driver, admin)
- [x] Load marketplace — post, filter, proximity search, bid, accept, compare bids
- [x] Fleet management — trucks (NTSA verification), drivers, assignments, team management
- [x] Full shipment lifecycle — booked → pickup → transit → delivered → commission invoice
- [x] Real-time GPS tracking — mobile + IoT device, WebSocket broadcast, geofence arrival + deviation
- [x] IoT device management — provisioning, alerts, battery/signal monitoring, fleet health dashboard
- [x] Vehicle inspection & compliance pipeline — field ops → inspector → compliance officer
- [x] Full admin panel — 7 sub-roles, 932-line super admin dashboard with fraud detection + geo intelligence
- [x] Finance admin dashboard — commission invoice mgmt, eTIMS, employee payroll (PAYE/SHIF/NSSF)
- [x] Commission system — tiered rates (12%/7%/6%/5%), 10-factor multiplier breakdown, auto-blocking, extensions
- [x] KRA eTIMS tax invoice generation (PDF + QR code)
- [x] Notifications — in-app, push (FCM), SMS (AfricasTalking), email (Resend)
- [x] Public marketing pages — landing, HowItWorks, ForShippers, ForFleetOwners, ForDrivers
- [x] Proof of delivery — photos, digital signature, GPS stamp, delivery code
- [x] Driver job flow — Google Maps navigation, status updates, unattended delivery (geofence 150m)
- [x] Report exports — CSV, PDF, XLSX for shipments + fleet + invoices; scheduled report subscriptions
- [x] KYC workflow — national ID + selfie upload + admin review + approval/rejection
- [x] KRA PIN + national ID at owner registration with format validation
- [x] Direct offer blast — owner receives direct load offers from shippers
- [x] Activity audit log — all user actions with IP and entity tracking

---

## ✅ Completed (Phase 2)
- [x] Dynamic pricing service — pricing_service.py (corridor × distance × cargo × demand × fuel index)
- [x] Smart matching service — matching_service.py (5-dimension carrier scoring)
- [x] Multi-modal support — Parcel, Mover, Airfreight (full booking flows: forms + backend CRUD)
- [x] Provider side — AvailableBookingsPage (parcel/mover/airfreight providers accept jobs)
- [x] Company accounts — CompanySettingsPage, TeamManagementPage, member invite/remove
- [x] CommissionsDashboard — outstanding invoices, history, rate breakdown modal, monthly chart
- [x] IoT dashboard suite — DeviceInventoryPage, IoTAlertsPage, FieldOpsTasksPage — complete
- [x] Admin KYC page — selfie lightbox review, approval/rejection workflow
- [x] Geofencing utilities — arrival detection, route deviation, ETA computation
- [x] PlatformConfig model — commission + VAT per country+service (KE/UG/TZ seeded)
- [x] GitHub Actions CI/CD — lint, test, security audit pipeline
- [x] 3-VPS production deployment — nginx, SSL, Grafana monitoring, backup scripts

---

## 🔧 In Progress / Wiring Gaps

- [ ] **Pricing wiring** — `pricing_service.estimate_price()` exists, not called from PostLoadPage (S1-A)
- [ ] **Matching wiring** — `matching_service.rank_carriers()` exists, not surfaced to shippers in UI (S1-B)
- [ ] **CSV export wiring** — ShipmentHistoryPage button exists, not wired to `GET /reports/shipments.csv` (S1-C)
- [ ] **Commission payment webhook** — no server-side handler for payment confirmation on commission invoices (S1-D)
- [ ] **Smile Identity KYC** — config key present, `kyc_service.verify_id()` call not confirmed in router (S5-A)
- [ ] **ownerApi.js** — owner pages use raw apiClient calls, no centralised API file (S6-B)
- [ ] **paymentsApi.js** — commission/payment pages use raw apiClient calls (S6-B)

---

## 🏗️ Missing — Revenue

- [ ] **Partner onboarding fee** — truck registration is free; PRD requires KES 500–5,000/vehicle type (S2-A)
- [ ] **Commission reconciliation report** — total invoiced vs. collected vs. outstanding per partner/period (S2-B)

---

## 🏗️ Missing — Marketplace & Trust

- [ ] **Verified Partner Tier badges** — only binary badge exists; no Standard/Verified/Premium tiers in marketplace (S3-A)
- [ ] **Mode 3: Preferred Partner Network** — no preferred carrier whitelist per company account (S3-B)
- [ ] **Marketplace sorting** — no sort by price/date/distance/urgency on LoadMarketplacePage (S3-C)

---

## 🏗️ Missing — Dashboards & UX

- [ ] **Persistent support tickets** — email-only; no DB model, no user history, no admin queue (S4-A)
- [ ] **Driver Performance Dashboard** — no per-driver stats page or `GET /drivers/{id}/stats` endpoint (S4-B)
- [ ] **Notification preferences** — no per-channel/event toggles in settings pages (S4-C)
- [ ] **Business Analytics Page** — company analytics page `BusinessAnalyticsPage.jsx` not built (S4-D)
- [ ] **Backhaul / ReturnWindowPage** — empty-leg posting UI not built; `ReturnWindow` model exists (S4-E)

---

## 🏗️ Missing — Infrastructure

- [ ] **AWS S3 upload migration** — currently saves to local `/static/uploads`; lost on container restart (S6-A)
- [ ] **Geofence circles on tracking maps** — 500m zones run server-side, not visualised on map (S6-C)
- [ ] **Partner approval gate audit** — confirm all bid/marketplace endpoints enforce `is_verified` status (S5-B)

---

## 🌍 Phase 2 / 3 Roadmap (Post-MVP — do not start until Sprints 1–6 complete)

- [ ] **Mobile App — React Native** (customer + partner + driver) — largest single PRD gap
- [ ] Route Optimization (Google Routes API)
- [ ] AI/ML matching engine (upgrade from rule-based `matching_service`)
- [ ] Predictive pricing (ML model trained on `price_intelligence` data)
- [ ] Fleet maintenance calendar & alerts
- [ ] Freight exchange (public load board without account required)
- [ ] Cross-border / AfCFTA logistics (customs fields, corridor documentation)
- [ ] Enterprise Control Tower
- [ ] Public API (OAuth 2.0 client credentials + rate limiting)
- [ ] Cold chain IoT (temperature sensor integration)
- [ ] Analytics warehouse (read replica / OLAP)

---

## 🐛 Known Technical Debt

- [ ] `kyc_service.verify_id()` call not confirmed in KYC router — may be saving selfie only
- [ ] `ownerApi.js` / `paymentsApi.js` missing — raw `apiClient` calls scattered in components
- [ ] Commission invoice payment confirmation requires manual admin action — webhook not implemented
- [ ] Support tickets are email-only — no DB persistence, no user ticket history
