# The deadline starts at the first submission, even after a re-send

From D-16 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

Suppose an earlier attempt got no receipt ([ADR-0004](0004-send-without-receipt-stays-visible.md))
and a later send does get one. `dates.sent` is then the first attempt's `dates.submitted`, not the
re-send's day, and `dates.due` is computed from that date. `receipt` does the same. So the sent date
may name a day on which the broker got nothing. The receipt in hand proves only that the re-send
arrived, but if the first attempt arrived too, the broker's month (GDPR Article 12(3)) started then.
The user's reason: an early flag they can check beats a late one they never see.

## Considered Options

- **From the re-send's day.** If the first attempt did arrive, `report` flags the request up to a
  month later than the law allows, and nobody notices.
- **Two dates: sent is today, due counts from the first attempt.** That gives the same flag day, but
  the due date would no longer be one month after the sent date, which `dueDate`, its tests and
  readers all assume.

## Consequences

If the first attempt never arrived, `report` may call the request overdue up to a month early. A
human reviews any overdue request before complaining
([ADR-0001](0001-human-files-the-complaint.md)), which is what makes this cost acceptable. Due dates
are stored in the ledger, so changing this rule won't correct existing entries.
