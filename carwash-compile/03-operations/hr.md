# HR & Payroll

*Part of the Operations cluster. Compiled from `bir.json`.*

A real staff roster for a 6-bay site: bay-attendants, wash-technicians, detail-technicians,
cashiers, a site-manager, and a part-time fleet-account-manager.

---

## Employee lifecycle

`Applicant -> Hired -> Onboarding -> Active -> On Leave -> Offboarded`. `Employee` is distinct
from the RBAC `role` a person logs in as - the `Employee` record holds hire date,
compensation, and emergency contact; the `role` field/RBAC entry determines what they can do
in the system (see `01-foundation/security.md`).

## Scheduling

`schedulingEntity: Shift` (`employeeId` x time window x optional `bayId`). Feeds the
`staffing-capacity-simulator` (`02-intelligence/simulation.md`) and
`shift-no-show-alert` (`03-operations/automations.md`) directly. Weekend/high-demand-window
staffing is tied to the demand forecast, not scheduled blind - Saturday 10am-2pm consistently
needs the fuller crew the capacity simulator's worked example calls for.

## Compensation & payroll

| Role | Model | Basis |
|---|---|---|
| bay-attendant, wash-technician, cashier | hourly wage | `Shift` hours |
| detail-technician | hourly wage + commission | 10% commission on `PackagePricing.price` for completed detail-bay `WashOrder`s they're assigned to |
| site-manager | salary | — |
| fleet-account-manager | hourly + small bonus | per newly signed fleet `Customer.isFleetAccount` |

`payrollCadence: biweekly`. Pipeline: sum `Shift` hours + detail-technician commission from
`WashOrder.assignedTechnicianId` for the period -> apply state withholding rules
(`05-finance/accounting.md`'s tax section) -> generate pay records -> post to `5000 Payroll
Expense` (`accounting.payrollLinked: true`) -> disburse via the Stripe payments integration ->
generate pay-stub documents (`06-platform/knowledge-base.md`).

**Commission tie-back**: the detail-technician commission basis is the exact same
`WashOrder.price`/`PackagePricing.price` field the analytics cube's `technician-throughput`
report and the P&L's revenue figure use - not a separately-tracked number, so a commission
dashboard and the sales/revenue dashboard can never quietly disagree.

## Leave management

10 PTO days/year, accrued monthly, for staff averaging 30+ scheduled hours/week. A leave
request is a small workflow: request -> site-manager approval -> calendar block via the
`google-calendar` integration, so `Shift` scheduling automatically respects it rather than a
manager needing to remember.

## Performance

Quarterly informal check-in, formal annual review - single-location, ~15-20-person staff
doesn't warrant more formal cadence than that. Where a formal review happens, a
performance-summary generator agent would draft a factual summary (shifts covered,
technician-throughput, customer feedback tied to that employee via `Ticket`/review mentions)
for the site-manager to review and add judgment to - not compiled as a standing agent here
given the review cadence is only annual and the roster is already at 12 agents; the
site-manager pulls the same `technician-throughput` report manually instead. Revisit if the
business scales past this location.
