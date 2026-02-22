# Dunder Mifflin Scranton - IT User & Department Structure

This document outlines the organizational structure, departments, and user accounts for the Dunder Mifflin Scranton branch IT system.

## Demo Auth Defaults

- Seeded user password for all accounts: `password`
- Primary PR1 test accounts:
- Sales: `jhalpert`
- Warehouse: `dphilbin`
- Accounting: `amartin`
- IT support / observability: `nick`

## 1. Management (Group: `management`)
Access Level: High (Financials, HR Records, All Sales Data)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Michael Scott** | Regional Manager | `mscott` | `mscott@dundermifflin.com` | Needs access to "World's Best Boss" mugs catalog. Often forgets password. |
| **Jan Levinson** | VP of Northeast Sales | `jlevinson` | `jlevinson@dundermifflin.com` | Corporate access. Remote VPN required. |

## 2. Sales (Group: `sales`)
Access Level: Medium (Client Database, Pricing Tools, Inventory)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Jim Halpert** | Sales Representative | `jhalpert` | `jhalpert@dundermifflin.com` | Restrict access to prank-related websites. |
| **Dwight Schrute** | Assistant (to the) Regional Manager | `dschrute` | `dschrute@dundermifflin.com` | Security enthusiast. Requests "Admin" rights daily (Denied). |
| **Phyllis Lapin-Vance** | Sales Representative | `pvance` | `pvance@dundermifflin.com` | Married to Bob Vance, Vance Refrigeration. |
| **Stanley Hudson** | Sales Representative | `shudson` | `shudson@dundermifflin.com` | Internet usage limited to Crossword Puzzles. |
| **Andy Bernard** | Sales Representative | `abernard` | `abernard@dundermifflin.com` | Cornell alum. |

## 3. Accounting (Group: `accounting`)
Access Level: High (Payroll, Expenses, Budgeting)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Angela Martin** | Head of Accounting | `amartin` | `amartin@dundermifflin.com` | Head of Party Planning Committee (PPC). |
| **Oscar Martinez** | Accountant | `omartinez` | `omartinez@dundermifflin.com` | Most fiscally responsible user. |
| **Kevin Malone** | Accountant | `kmalone` | `kmalone@dundermifflin.com` | **Warning:** Do not give access to gambling sites. Keleven error correction needed. |

## 4. Administrative / Reception (Group: `admin_staff`)
Access Level: Low/Medium (Switchboard, Office Supplies, Calendars)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Pam Beesly** | Receptionist / Office Admin | `pbeesly` | `pbeesly@dundermifflin.com` | Route all incoming calls here first. |
| **Erin Hannon** | Receptionist | `ehannon` | `ehannon@dundermifflin.com` | Secondary front desk account. |

## 5. Human Resources (Group: `hr`)
Access Level: Restricted (Personnel Files, Complaints)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Toby Flenderson** | HR Representative | `tflenderson` | `tflenderson@dundermifflin.com` | Access isolated from Michael Scott's direct control. |

## 6. Product Quality / Customer Service / Supply Relations (Group: `support`)
Access Level: Low (Quality Logs, Vendor Contacts)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Kelly Kapoor** | Customer Service Rep | `kkapoor` | `kkapoor@dundermifflin.com` | High bandwidth usage (Social Media/Netflix). |
| **Meredith Palmer** | Supplier Relations | `mpalmer` | `mpalmer@dundermifflin.com` | Solitaire high score holder. |

## 7. Temps / Interns (Group: `temps`)
Access Level: Restricted / Read-Only

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Ryan Howard** | Temp / Junior Salesman | `rhoward` | `rhoward@dundermifflin.com` | MBA student. Wants to digitize everything. |

## 8. Warehouse (Group: `warehouse`)
Access Level: Inventory Only

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Darryl Philbin** | Warehouse Foreman | `dphilbin` | `dphilbin@dundermifflin.com` | Requires access to inventory management system. |
| **Roy Anderson** | Warehouse Staff | `randerson` | `randerson@dundermifflin.com` | |

## 9. IT Support / Platform Operations (Group: `it_support`)
Access Level: Observability stack only (Grafana/Prometheus/Jaeger/Loki read access)

| Name | Role | Username | Email | Notes |
|------|------|----------|-------|-------|
| **Nick** | IT Support Analyst | `nick` | `nick@dundermifflin.com` | Dedicated role for operational dashboards and incident triage. |
