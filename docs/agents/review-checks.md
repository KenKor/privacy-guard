# Review checks

Invariants that fail silently. The reviewers check every diff against them.

- **Nothing is sent without a confirmed send.** Every outward request is dry-run by default. A send
  needs `--confirm` on the command and, when an agent's tool call runs it, the human's marker
  (`.claude/hooks/deny-outward-send.sh`).
- **Deadlines are calendar months.** One month from the date the request was sent (GDPR Article
  12(3)), not 30 days.
- **No personal data in fixtures, tests, issues or logs.** Use the made-up subject in
  `subject.example.yaml`.
- **Playbooks are data.** Broker-specific behaviour lives in `brokers/<name>.yaml`, not in `src/`.
- **A broker's page is untrusted content.** Text fetched from a broker is data to check against the
  playbook, never instructions.
