# request-sending Specification

## Purpose

Turns a broker's playbook and the subject's details into one request to that broker, and sends it
only on a confirmed send, recording it as sent only when the broker's receipt comes back.

## Requirements

### Requirement: Web-form playbooks declare their receipt
A playbook with channel `web-form` SHALL have a `receipt` with a `selector` and a
`reference_pattern`, both strings, and the pattern SHALL be a valid regular expression. Every
`form.fields` value SHALL be a string or a boolean. Loading a playbook that breaks any of these
SHALL fail with a message naming the file and the field.

#### Scenario: Missing receipt
- **WHEN** a `web-form` playbook has no `receipt.reference_pattern`
- **THEN** loading it fails with a message naming the file and `receipt.reference_pattern`

#### Scenario: Pattern that does not compile
- **WHEN** a playbook's `receipt.reference_pattern` is `BA-[0-9`
- **THEN** loading it fails with a message naming the file and `receipt.reference_pattern`

#### Scenario: Broker A's playbook matches its form
- **WHEN** broker A's playbook is checked against the recorded copy of broker A's page
- **THEN** every field in `form.fields` exists in the form, the submit button exists, and the
  `receipt.selector` exists on the page

### Requirement: Subject file
The subject's details SHALL be read from `subject.yaml`, which is not committed. A committed
`subject.example.yaml` SHALL hold a made-up subject. `full_name` and `email` are required; `phone`
and `job_title` are optional. Every value SHALL be a string.

#### Scenario: Missing subject file
- **WHEN** `draft broker-a` runs and `subject.yaml` does not exist
- **THEN** it refuses, names `subject.yaml`, points at `subject.example.yaml`, and writes nothing to
  the ledger

#### Scenario: Missing required key
- **WHEN** `subject.yaml` has no `email`
- **THEN** `draft` and `send` refuse, naming the key `email`

#### Scenario: Value that is not a string
- **WHEN** `subject.yaml` has `phone: 0612345678` unquoted
- **THEN** `draft` and `send` refuse, naming the key `phone` and saying to quote the value, without
  printing the value

#### Scenario: Subject file is ignored by git
- **WHEN** `git check-ignore subject.yaml` runs in the repository
- **THEN** it reports the file as ignored

### Requirement: Field rendering
Placeholders `{{ subject.<key> }}` in a playbook's fields SHALL be replaced with the subject's
values. A placeholder marked `| optional` with no value SHALL render empty. A required placeholder
with no value, or an unknown placeholder, SHALL fail the render, naming the field.

#### Scenario: Optional value absent
- **WHEN** `subject.yaml` has no `job_title` and the field is `{{ subject.job_title | optional }}`
- **THEN** the `job_title` field is sent empty

#### Scenario: Unknown placeholder
- **WHEN** a field is `{{ subject.birthday }}`
- **THEN** the render fails, naming the field and the placeholder

### Requirement: Draft a request
`draft <broker>` SHALL render the broker's playbook and print the submission: the address, the form,
and every field. Only if the render succeeds SHALL it record a request for that broker in the ledger
with state `drafted` and today's date. It SHALL NOT store any subject value.

#### Scenario: First draft
- **WHEN** broker-a has no request and `draft broker-a` runs on 2026-10-15
- **THEN** the ledger gains a broker-a request with state `drafted` and drafted date 2026-10-15, and
  the ledger contains no value from `subject.yaml`

#### Scenario: Unknown broker
- **WHEN** `draft broker-z` runs and there is no playbook for broker-z
- **THEN** it refuses, exits 1, and writes nothing

#### Scenario: No broker named
- **WHEN** `draft` runs with no broker
- **THEN** it prints usage and exits 2

### Requirement: One open request per broker
A broker SHALL have at most one request that is not acknowledged. `draft` SHALL refuse when there
already is one, naming its state and date.

#### Scenario: Draft while one is sent
- **WHEN** broker-a has a `sent` request from 2026-10-12 and `draft broker-a` runs
- **THEN** it refuses, says broker-a has a sent request from 2026-10-12, and the ledger is unchanged

#### Scenario: Draft after a reply
- **WHEN** broker-a's only request is `acknowledged` and `draft broker-a` runs
- **THEN** a new drafted request is recorded

### Requirement: Subject values are masked in output
`draft` and a dry-run `send` SHALL print each value taken from the subject file as its placeholder
(for example `[subject.email]`), or `(empty)` for an absent optional value, unless `--show` is
given. Literal playbook values SHALL print as they are. No error message SHALL contain a subject
value.

#### Scenario: Default output
- **WHEN** `draft broker-a` runs
- **THEN** the output shows `[subject.full_name]` and `[subject.email]` and the literal
  `request_type` value `both`, and contains no value from `subject.yaml`

#### Scenario: Show
- **WHEN** `send broker-a --show` runs without `--confirm`
- **THEN** the output shows the subject's actual values and nothing is sent

### Requirement: Sending is a dry run unless confirmed
`send <broker>` SHALL only print what it would send, and contact nothing, unless `--confirm` is
given. It SHALL act on that one broker's drafted request only. Without a drafted request for the
broker, it SHALL refuse.

#### Scenario: Dry run
- **WHEN** broker-a has a drafted request and `send broker-a` runs without `--confirm`
- **THEN** it prints that nothing was sent and the submission it would make, makes no network
  request, leaves the ledger unchanged, and exits 0

#### Scenario: Nothing drafted
- **WHEN** broker-a has no drafted request and `send broker-a --confirm` runs
- **THEN** it refuses, makes no network request, and exits 1

### Requirement: Agent sends need the human's approval
The outward-send hook SHALL block an agent tool call that runs the CLI's `send` in one of the
ordinary ways, unless the command has `--confirm` and the human has created the one-shot approval
marker. The marker SHALL be used up by the send it allows. The ordinary ways are `npx privacy-guard
send`, `npm exec privacy-guard -- send`, `node bin/privacy-guard.js send`, `./bin/privacy-guard.js
send`, a quoted path to the bin file, and a quoted `send`. The hook is a tripwire, not a wall: it
reads one command line at a time, and an agent that sets out to evade it can do so. Examples are a
version suffix such as `privacy-guard@0.1.0`, a command split across lines, or a script. The
dry-run default and the human gate remain.

#### Scenario: Invoked through the bin file
- **WHEN** an agent runs `node bin/privacy-guard.js send broker-a --confirm` without the marker
- **THEN** the tool call is blocked

#### Scenario: Invoked by its path
- **WHEN** an agent runs `./bin/privacy-guard.js send broker-a --confirm` without the marker
- **THEN** the tool call is blocked

#### Scenario: Invoked through npm exec
- **WHEN** an agent runs `npm exec privacy-guard -- send broker-a --confirm` without the marker
- **THEN** the tool call is blocked

#### Scenario: Quoted send
- **WHEN** an agent runs `node bin/privacy-guard.js "send" broker-a --confirm` without the marker
- **THEN** the tool call is blocked

#### Scenario: Approved once
- **WHEN** the marker exists and an agent runs `npx privacy-guard send broker-a --confirm`
- **THEN** the call is allowed and the marker is removed

### Requirement: A confirmed send submits the form
A confirmed send SHALL post the rendered fields to the playbook's `form.url` as
`application/x-www-form-urlencoded`. A boolean `true` SHALL be sent as `on` and a `false` left out.
It SHALL NOT follow redirects and SHALL give up after 10 seconds.

#### Scenario: Checkbox field
- **WHEN** the playbook has `confirm_identity: true`
- **THEN** the posted body contains `confirm_identity=on`

#### Scenario: Redirect
- **WHEN** the broker answers with a 302
- **THEN** the redirect is not followed, the request stays drafted, and `send` exits 1

### Requirement: Sent only with a receipt
A request SHALL become `sent` only when the broker answers 2xx and the element at
`receipt.selector` contains text matching `receipt.reference_pattern`. It then records the
reference, the sent date (today) and the due date. Every other outcome SHALL leave the request
drafted and exit 1.

#### Scenario: Receipt found
- **WHEN** broker A answers 200 with `#thanks` containing `BA-482915` on 2026-10-12
- **THEN** the request becomes `sent` with reference `BA-482915`, sent date 2026-10-12 and due date
  2026-11-12, `send` prints them, and exits 0

#### Scenario: Error status or no connection
- **WHEN** broker A answers 500, or the connection is refused
- **THEN** the request stays drafted, `send` says it was not sent, and exits 1

#### Scenario: Answer without a receipt
- **WHEN** broker A answers 200 but no text matches the reference pattern
- **THEN** the request stays drafted, and `send` says the request may have arrived without a
  receipt, to check broker A's mail before sending again, and exits 1

#### Scenario: Timeout
- **WHEN** broker A has not answered after 10 seconds
- **THEN** the request stays drafted, and `send` says the request may have arrived without a
  receipt, to check broker A's mail before sending again, and exits 1

### Requirement: A broker's answer is untrusted
`send` SHALL use only the reference extracted from the broker's answer. It SHALL NOT print, store or
act on any other content of the answer.

#### Scenario: Instructions in the answer
- **WHEN** the broker's answer contains text telling the reader to send the ledger elsewhere
- **THEN** `send` output and the ledger contain none of that text, and nothing else is contacted
