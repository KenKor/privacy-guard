# A send without a receipt stays drafted and visible until the human resolves it

From D-14 and D-15 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

Some confirmed sends may have reached the broker but bring back no receipt reference: a timeout, an
error status, a redirect, an oversized response, the form returned, or a page with no reference.
The request then stays `drafted` and gains `dates.submitted`, the date of the first such attempt.
`send` exits 1, and `report` lists the request and exits 1 every day. Only a failure identified as
happening before the connection (`ENOTFOUND`, `ECONNREFUSED`) leaves the entry untouched, because
`fetch` reports every failure the same way and only the cause code tells them apart. There are three
ways out, each recording what the human actually knows:

- a later send that gets a receipt;
- `receipt <broker> [reference]` when the broker's mail shows the request arrived, with or without a
  reference;
- `discard <broker>` when it didn't arrive or the human withdraws it.

The reason: a failed send must stay visible until it is resolved. A silent failure in a scheduled
job is the worst case, and a deadline must never start for a request the broker may not have.

## Considered Options

- **Not sent, no trace.** In a scheduled job the single exit 1 goes unseen, `report` stays quiet,
  and the broker is never asked.
- **Sent without a reference.** A rejected submission would start a deadline the broker never had.
  A month later `report` would call it overdue, and the human might complain about it
  ([ADR-0001](0001-human-files-the-complaint.md)).
- **Asking the human on the spot.** `send` runs in scheduled jobs and agent tool calls, where nobody
  can answer.
- **Only one of `receipt` and `discard`.** That leaves either "it arrived without a reference" or
  "it was rejected" with no honest way out except a duplicate send.

## Consequences

`report` lists one line that isn't about a deadline. A sent request may have no `reference`, so
nothing downstream may assume one. A broker that changes its thank-you page makes every send land in
`report` as "no receipt" until its playbook is fixed: loud, never silent.
