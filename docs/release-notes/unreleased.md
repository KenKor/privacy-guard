# Release notes: unreleased

Changes since the request-tracking baseline, in the order they landed.

## Due dates: the one-month rule is settled (#9)

privacy-guard now knows how to work out a broker's deadline: one calendar month after the day you sent
the request, on the same day of the month. When the next month has no such day, the deadline is that
month's last day, never a day in the month after. So a request sent on 31 January is due on 28 February
(29 in a leap year), and one sent on 31 March is due on 30 April. Your computer's time zone makes no
difference.

You won't see this yet. No command records a due date for you: the due date is still whatever you wrote
in `ledger.json`, and a request without one is never due. The coming `send` and receipt commands will
use this rule to fill it in.

**Your ledger:** nothing to change.

## New `report` command; overdue is no longer a state you store (#8)

`privacy-guard report` lists every broker that has missed its deadline, in ledger order:

```
broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue
```

A request counts as overdue when it is `sent`, has a due date, and that date has passed. On the due date
itself it is not overdue yet; the day after, it is 1 day overdue. Requests that are drafted,
acknowledged or escalated are never listed.

`report` also warns about a sent request that has no due date, because it can never become overdue:

```
broker-x: sent 2026-09-01, no due date recorded
```

When there is nothing to list it prints `nothing is overdue`. It exits with code 1 when it printed any
line and 0 otherwise, so a scheduled job can tell when something needs your attention. `report` only
reads your ledger: it changes nothing and sends nothing.

For now `report` says nothing about escalated requests; that comes with the `escalate` command. The `due`
command works as before.

**Your ledger:** this one can break an existing ledger. `overdue` is no longer an allowed state. The
allowed states are now `drafted`, `sent`, `acknowledged` and `escalated`. If you wrote `"state":
"overdue"` into `ledger.json` by hand, every command now stops with an error such as
`ledger.json: entry 0: state "overdue" is not one of drafted, sent, acknowledged, escalated`. Change that
entry to the state it is really in, normally `sent`. `report` will then work out from its due date
whether it is overdue. privacy-guard itself never wrote `overdue`, so a ledger you haven't edited by
hand is not affected.
