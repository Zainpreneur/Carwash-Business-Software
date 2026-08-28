# Advanced Accounting & Finance

*Part of the Finance cluster. Compiled from `bir.json`.*

A native ledger, sized for a single-location business (21 accounts) but real double-entry
throughout - every dollar in the P&L traces to a `JournalEntry` referencing the `WashOrder`,
`MembershipSubscription`, or `Payment` that generated it.

---

## Chart of accounts

| Code | Name | Type |
|---|---|---|
| 1000 | Cash | asset |
| 1100 | Accounts Receivable - Fleet | asset |
| 1400 | Chemical & Supply Inventory | asset |
| 1500 | Wash Equipment (net of depreciation) | asset |
| 2000 | Supplier Payables | liability |
| 2100 | Sales Tax Payable | liability |
| 2200 | Loyalty Points Payable | liability |
| 2300 | Deferred Membership Revenue | liability |
| 2400 | Equipment Financing Payable | liability |
| 3000 | Owner's Equity | equity |
| 4000 | Pay-Per-Wash Revenue | revenue |
| 4100 | Membership Revenue | revenue |
| 4200 | Fleet/Commercial Revenue | revenue |
| 5000 | Payroll Expense | expense |
| 5100 | Chemical & Supply Expense | expense |
| 5200 | Water & Utilities Expense | expense |
| 5300 | Equipment Maintenance Expense | expense |
| 5400 | Payment Processing Fees | expense |
| 5500 | Marketing Expense | expense |
| 5600 | Loyalty Program Expense | expense |
| 5700 | Inventory Shrinkage Expense | expense |
| 5800 | Rent Expense | expense |

## The ledger

`ledgerEntity: JournalEntry` (with `JournalLine` children holding account/debit/credit). Every
`JournalEntry` carries `sourceEntity`/`sourceId` back to the transaction that created it.

**Example auto-posted entries**:

*A pay-per-wash `WashOrder` marked `Completed` with a card payment ($22.00, including tax):*
```
Debit  1000 Cash                    $22.00
Credit 4000 Pay-Per-Wash Revenue    $20.28
Credit 2100 Sales Tax Payable        $1.72
```

*A membership charge succeeding ($24.99/month, `basic-unlimited`):*
```
Debit  1000 Cash                    $24.99
Credit 4100 Membership Revenue      $24.99
```
(Membership revenue is recognized at charge, not deferred over the month, since the plan is
unlimited-use rather than a fixed-deliverable prepayment - `2300 Deferred Membership Revenue`
exists for the edge case of a prepaid multi-month plan sold at a discount, posted then
released monthly.)

*Loyalty points issued on a pay-per-wash purchase (accrual-at-earn, per the standard
treatment):*
```
Debit  5600 Loyalty Program Expense   $0.40
Credit 2200 Loyalty Points Payable    $0.40
```

**Auto-posting rule**: every workflow step that moves money (`checkout`,
`membership-billing-agent`'s successful charge, a refund, a payroll run, receiving a
`PurchaseOrder`) generates its journal entry automatically via an automation - no manual
bookkeeping for routine transactions.

## Multi-currency

Not applicable - `additionalCurrencies: []`, single US-state, USD-only operation.

## Tax

`sales-tax-local`: applies to taxable `WashOrder` line items per the single jurisdiction this
location operates in (rate set at deployment to the actual local car-wash-service tax rate,
which varies significantly by state/county). Collected tax posts to `2100 Sales Tax Payable`
(a liability), never to revenue.

## Banking & reconciliation

`operating-account` linked to the `stripe` integration. Reconciliation workflow: weekly,
`site-manager` (or an accounting specialist role once the business scales) matches ledger
entries against the Stripe payout feed; unmatched transactions are flagged for investigation
rather than auto-resolved, per `09-integrations-framework.md`'s conflict-resolution default
for financial data.

## Budgets

`chemical-supply-budget`, `marketing-budget`, `payroll-budget` - all monthly, business-wide
scope (single location, no per-branch split needed). Budget-vs-actual variance beyond 10%
feeds `13-analytics-and-reporting.md`'s anomaly rules and shows on the Financial View.

## Period close

1. Reconcile Stripe payout bank feed against `Payment` records.
2. Post accrued supplier invoices for chemicals received but not yet billed.
3. Post the month's depreciation on `Asset` equipment.
4. Review fleet AR aging, flag anything past 45 days for `fleet-account-manager` follow-up.
5. Reconcile `2200 Loyalty Points Payable` against points issued/redeemed this period.
6. Lock the period from further edits.

## Payroll linkage

`payrollLinked: true` - `03-operations/hr.md`'s biweekly payroll run posts wages to `5000
Payroll Expense` and withholdings to the relevant liability accounts directly; the two modules
share the same `Shift`-hours/commission basis so they never silently disagree.

## Loyalty point liability

`marketing.loyalty` is defined (points-per-dollar for pay-per-wash customers), so
`2200 Loyalty Points Payable` and `5600 Loyalty Program Expense` are in the chart of accounts
per the standard accrual-at-earn treatment above: points awarded debit the expense/credit the
liability at issuance; redemption debits the liability and credits the revenue/discount line
the redemption applies against. Outstanding point liability (points outstanding x redemption
value/point) would be a balance-sheet line if one were compiled at this scale - noted here for
when the business grows into needing one.
