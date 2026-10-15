# The human files the complaint; privacy-guard only records it

From D-1 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

Once a request is overdue, privacy-guard files nothing and sends nothing. The human decides what to
do and does it outside the tool: wait for an extension the broker claimed, contact the broker, or
complain to a supervisory authority. `escalate <broker> [YYYY-MM-DD]` records that they complained.
It only accepts an overdue sent request and sets `escalated`. `report` lists an escalated request and
exits 1 every day until `reply` records an answer. Nothing can snooze it. The reason: a complaint
can't be withdrawn once filed, and only the human can see an Article 12(3) extension in the broker's
mail. The ledger holds no such extension, so to privacy-guard a request with a valid extension looks
just like a late one.

## Considered Options

- **privacy-guard files the complaint**, as a confirmed send. It would file early during a valid
  extension and could not tell, and the complaint could not be withdrawn. It would also need a
  playbook, fixture and contract test for each authority, plus a new subject field for which
  authority to use. A draft helper could be added on top of `escalate` later without changing the
  states.
- **Ask the broker again before escalating.** Broker A's form can't mark a submission as a reminder,
  so broker A would see a new request that might restart its month. It would also need a grace
  period the GDPR doesn't define.
- **Let an escalated request leave `report`**, either dropped entirely or only listed by `due`. A
  stalled escalation would then show nowhere a scheduled job looks.

## Consequences

`report` can stay red for months: the broker may claim a two-month extension, and authorities are
slow. The user accepted that fatigue. Anything that adds a snooze or a quiet state reopens this
decision.
