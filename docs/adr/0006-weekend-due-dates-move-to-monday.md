# A due date on a weekend moves to Monday; public holidays do not count

From D-17 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

`dueDate` adds one calendar month to the sent date, clamped to the last day of the target month (D-6
in the same PRD). It then moves a Saturday or Sunday result to the following Monday. Regulation (EEC,
Euratom) No 1182/71, Article 3(4), which governs time limits in EU law, ends a period that would end
on a Saturday, Sunday or public holiday at the end of the next working day. A request flagged as
overdue on a Sunday would invite a complaint the broker could rightly reject. Monday is still "never
later than the law allows".

## Considered Options

- **Public holidays too.** They differ by country, and the subject's country isn't recorded. Without
  them, a due date on a holiday is flagged a day early, never late.
- **No weekend rule.** That flags requests a day or two early.

## Consequences

Due dates are stored in the ledger when the request is sent, so changing this rule won't correct
existing entries. Adding holidays needs a recorded country first.
