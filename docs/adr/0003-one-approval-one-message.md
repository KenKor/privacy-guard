# One approval sends one message to one broker

From D-13 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

`send` requires a broker (`send <broker> [--confirm]`) and sends only that broker's single `drafted`
request. If the ledger holds two drafted entries for the broker, it refuses and sends nothing. The
hook [deny-outward-send.sh](../../.claude/hooks/deny-outward-send.sh) applies the same limit to
agents. The human's marker is used up once per tool call, so the hook denies a tool call in which a
send is chained, piped, substituted or repeated (`xargs`, `watch`, `parallel`), even when the marker
is present. The reason: what one approval reaches must be exactly what the human looked at when they
gave it, not whatever the ledger holds at that moment.

## Considered Options

- **`send` with no broker, sending every drafted entry** (the skeleton's behaviour). One approval
  would reach every broker with a draft.
- **`send` with no broker, refusing when more than one entry is drafted.** What one approval reaches
  would still depend on ledger contents the human never checked. With a second broker it would
  refuse anyway, until each was sent separately.

## Consequences

A batch send, for example for `cadence` re-requests, has to fit inside this rule, as one approval
per broker. Otherwise it reopens this decision. The hook is a tripwire, not a wall: brace expansion
in a single command can still get past it.
