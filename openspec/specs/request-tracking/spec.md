# request-tracking Specification

## Purpose

Request tracking keeps a local ledger of every request to a broker and where it stands, answers which
requests are due, and makes sure nothing is sent to a broker without the human's confirmation.

## Requirements

### Requirement: Ledger file
The ledger SHALL be a JSON file named `ledger.json` in the directory privacy-guard runs from. The file is
git-ignored. A ledger file that does not exist yet SHALL be read as an empty ledger, and reading it SHALL
NOT create the file.

#### Scenario: No ledger file yet
- **WHEN** a command reads the ledger and no ledger file exists
- **THEN** the ledger has no entries and no file is created
- **Test**: `test/ledger.test.ts` › ledger › "is empty when the file does not exist yet" (empty ledger; that no file is created is not asserted)

#### Scenario: Default location
- **WHEN** the installed command runs `due` in a directory with no `ledger.json`
- **THEN** it prints `nothing is due`
- **Test**: `test/cli.test.ts` › the privacy-guard bin › "runs from the repo without a build step" (that it reads `ledger.json` from that directory is not asserted; observed by running `due` with one there)

#### Scenario: Ledger file is git-ignored
- **WHEN** a `ledger.json` exists at the repository root
- **THEN** git does not offer it for commit
- **Test**: none (`.gitignore` lists `ledger.json`)

### Requirement: Ledger entry
Loading SHALL accept an entry when it has a valid state and a `dates` object; nothing else about the
entry is checked, and extra fields are kept. Commands read only an entry's `broker`, `state` and `dates`, so
the ledger needs no personal data. Saving a ledger and loading it again SHALL give back the same entries.

#### Scenario: Round trip
- **WHEN** a ledger with an entry for `broker-a` in state `sent` with drafted, sent and due dates is saved and loaded
- **THEN** the loaded ledger equals the saved one
- **Test**: `test/ledger.test.ts` › ledger › "round-trips through the file"

#### Scenario: Broker name is not checked
- **WHEN** the ledger file has an entry with no `broker` field but a valid state and dates
- **THEN** the ledger loads without error, and `due` lists the entry, if due, as `undefined: <state>, due <date>`
- **Test**: none (observed by running `due` on such a file)

#### Scenario: Extra fields are not checked
- **WHEN** an entry has a field other than `broker`, `state` and `dates`
- **THEN** the ledger loads without error and the field is kept
- **Test**: none (observed by running `due` on such a file)

### Requirement: Ledger file must be well formed
Loading SHALL fail with an error that names the ledger file when the file is not valid JSON or does not
hold an `entries` array.

#### Scenario: Not valid JSON
- **WHEN** the ledger file contains `{ entries: `
- **THEN** loading fails with an error starting `<path>: not valid JSON`
- **Test**: `test/ledger.test.ts` › ledger › "names the file when it is not valid JSON" (asserts the message contains the text, not that it starts with it)

#### Scenario: No entries array
- **WHEN** the ledger file contains `null` or `[1]`
- **THEN** loading fails with `<path>: expected an "entries" array`
- **Test**: none

### Requirement: Ledger entries must be valid
Loading SHALL fail on the first invalid entry, with an error naming the file and the entry's index, when
the entry's state is not one of the four states, it has no `dates` object, or any of its dates is not a
string of the form YYYY-MM-DD. A `null` entry also fails, but with a plain TypeError that names neither.

#### Scenario: Unknown state
- **WHEN** an entry has state `lost`
- **THEN** loading fails with an error containing `state "lost" is not one of`
- **Test**: `test/ledger.test.ts` › ledger › "rejects an entry with an unknown state"

#### Scenario: Stored overdue state is rejected
- **WHEN** the first entry has state `overdue`
- **THEN** loading fails with `<path>: entry 0: state "overdue" is not one of drafted, sent, acknowledged, escalated`
- **Test**: `test/ledger.test.ts` › ledger › "rejects a stored overdue state"

#### Scenario: No dates object
- **WHEN** the first entry has no `dates` field
- **THEN** loading fails with `<path>: entry 0: expected a "dates" object`
- **Test**: `test/ledger.test.ts` › ledger › "rejects an entry without dates, naming the file and the entry"

#### Scenario: Date in another format
- **WHEN** the first entry has `dates.due` set to `12/10/2026`
- **THEN** loading fails with `<path>: entry 0: dates.due "12/10/2026" is not a YYYY-MM-DD date`
- **Test**: `test/ledger.test.ts` › ledger › "rejects a date that is not YYYY-MM-DD"

#### Scenario: Date that is not a string
- **WHEN** an entry has `dates.due` set to the number `20261012`
- **THEN** loading fails with an error naming `dates.due`
- **Test**: none

#### Scenario: Null entry
- **WHEN** the ledger file contains `{"entries":[null]}`, or a `null` after a valid entry
- **THEN** loading fails with `TypeError: Cannot read properties of null (reading 'state')`, naming neither the file nor the entry, and `due` exits 1
- **Test**: none (observed by running `due` on such a file)

#### Scenario: Only the form of a date is checked
- **WHEN** an entry has `dates.due` set to `2026-13-45`, or a date under a key such as `foo`
- **THEN** the ledger loads without error
- **Test**: none (observed by running `due` on such a file)

### Requirement: Stored request states
A request SHALL be in exactly one of the stored states `drafted`, `sent`, `acknowledged` and `escalated`.
A state is whatever the ledger file records: no command changes a state. Overdue is not a state; it is
worked out from a `sent` request's dates (see Overdue requests).

#### Scenario: A sent request past its due date stays sent
- **WHEN** an entry in state `sent` has a due date before today
- **THEN** its state is still `sent`, and it is overdue without anything being written
- **Test**: none

#### Scenario: Overdue is not a stored state
- **WHEN** an entry is stored as `overdue`
- **THEN** the ledger does not load (see Ledger entries must be valid)
- **Test**: `test/ledger.test.ts` › ledger › "rejects a stored overdue state"

### Requirement: Overdue requests
A request SHALL be overdue on a given day when its state is `sent`, it has a due date, and that day is
strictly after the due date. Overdue SHALL be worked out from the state and dates every time it is read
and never stored. A request in any other state is never overdue.

#### Scenario: Not overdue on the due date
- **WHEN** an entry in state `sent` is due 2026-11-12 and today is 2026-11-12
- **THEN** it is not overdue
- **Test**: `test/ledger.test.ts` › isOverdue › "is not overdue on its due date, and is the day after"

#### Scenario: Overdue the day after
- **WHEN** an entry in state `sent` is due 2026-11-12 and today is 2026-11-13
- **THEN** it is overdue
- **Test**: `test/ledger.test.ts` › isOverdue › "is not overdue on its due date, and is the day after"

#### Scenario: Only sent requests are overdue
- **WHEN** entries in state `drafted`, `acknowledged` and `escalated` each have a due date before today
- **THEN** none of them is overdue
- **Test**: `test/ledger.test.ts` › isOverdue › "never counts a drafted, acknowledged or escalated entry"

#### Scenario: No due date
- **WHEN** an entry in state `sent` has no due date
- **THEN** it is not overdue
- **Test**: `test/ledger.test.ts` › isOverdue › "does not count a sent entry without a due date"

### Requirement: Days overdue
Days overdue SHALL be the number of calendar days from the due date to today, so a request is 1 day
overdue on the day after its due date. Dates are calendar dates; no time zone or time of day is involved.

#### Scenario: One day
- **WHEN** a `sent` entry is due 2026-11-12 and today is 2026-11-13
- **THEN** it is 1 day overdue
- **Test**: `test/ledger.test.ts` › daysOverdue › "counts calendar days from the due date"

#### Scenario: Across a month end
- **WHEN** a `sent` entry is due 2026-10-30 and today is 2026-11-02
- **THEN** it is 3 days overdue
- **Test**: `test/ledger.test.ts` › daysOverdue › "counts calendar days from the due date"

#### Scenario: Across a daylight-saving change
- **WHEN** a `sent` entry is due 2026-10-24 and today is 2026-10-26
- **THEN** it is 2 days overdue, whatever the machine's time zone
- **Test**: `test/ledger.test.ts` › daysOverdue › "counts calendar days from the due date"

### Requirement: Request dates
Every value in an entry's `dates` SHALL be a string of the form YYYY-MM-DD, under any key name; no date is
required, and whether it is a real calendar date is not checked. Commands read only `dates.due` and, in
`report`, `dates.sent`.
No command records a computed due date yet: the due date is whatever was recorded, and an entry without
one is never due.

#### Scenario: No due date
- **WHEN** an entry in state `drafted` has only a drafted date
- **THEN** it is never listed as due
- **Test**: `test/ledger.test.ts` › dueOn › "returns open entries due on or before today" (the `no-date` entry)

#### Scenario: Sent date does not set a due date
- **WHEN** an entry in state `sent` has a sent date and no due date
- **THEN** no due date is derived from the sent date, the entry is never listed as due, and it is never overdue
- **Test**: none

### Requirement: Which requests are due
A request SHALL be due on a given day when it has a due date on or before that day and its state is not
`acknowledged`. Due dates are compared as YYYY-MM-DD text. Due requests SHALL be listed in ledger order.

#### Scenario: Due today and past due
- **WHEN** the ledger holds, in order, a `sent` entry due 2026-10-12, a `sent` entry due 2026-09-01, a `sent` entry due 2026-11-01, an `acknowledged` entry due 2026-10-01 and a `drafted` entry with no due date, and today is 2026-10-12
- **THEN** the due requests are the first two, in that order
- **Test**: `test/ledger.test.ts` › dueOn › "returns open entries due on or before today"

#### Scenario: Empty ledger
- **WHEN** the ledger has no entries
- **THEN** no request is due
- **Test**: `test/ledger.test.ts` › dueOn › "returns nothing for an empty ledger"

#### Scenario: Any state but acknowledged can be due
- **WHEN** an entry in state `drafted` or `escalated` has a due date before today
- **THEN** it is due
- **Test**: none (observed for `drafted` by running `due`)

### Requirement: The due command
`privacy-guard due` SHALL print one line per due request, `<broker>: <state>, due <due date>`, or
`nothing is due` when none is, and exit 0. Today is the local calendar date of the machine it runs on.

#### Scenario: Nothing due
- **WHEN** `due` runs on an empty ledger
- **THEN** it prints exactly `nothing is due` and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard due › "says nothing is due on an empty ledger"

#### Scenario: Lists only what is due
- **WHEN** `due` runs on 2026-10-12 with `broker-a` due 2026-10-12 and `broker-b` due 2026-11-01
- **THEN** it exits 0, prints a line for `broker-a` and none for `broker-b`
- **Test**: `test/cli.test.ts` › privacy-guard due › "lists the requests due today" (the line format is not asserted)

#### Scenario: Today is the local date
- **WHEN** `due` runs without an injected date
- **THEN** it uses the machine's local calendar date, not the UTC date
- **Test**: none

### Requirement: The report command
`privacy-guard report` SHALL print, in ledger order, one line per overdue request,
`<broker>: sent <sent date>, due <due date>, <n> day(s) overdue` (`day` when n is 1, else `days`), and a
warning line `<broker>: sent <sent date>, no due date recorded` for each `sent` request without a due
date. It SHALL exit 1 when it printed any line, else print `nothing is overdue` and exit 0.

#### Scenario: Nothing overdue on an empty ledger
- **WHEN** `report` runs on an empty ledger
- **THEN** it prints exactly `nothing is overdue` and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard report › "says nothing is overdue on an empty ledger"

#### Scenario: Due today is not yet overdue
- **WHEN** `report` runs on 2026-11-12 with `broker-a` in state `sent`, sent 2026-10-12, due 2026-11-12
- **THEN** it prints exactly `nothing is overdue` and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard report › "is quiet on the due date and flags the day after"

#### Scenario: One overdue request
- **WHEN** `report` runs on 2026-11-13 on the same ledger
- **THEN** it prints exactly `broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue` and exits 1
- **Test**: `test/cli.test.ts` › privacy-guard report › "is quiet on the due date and flags the day after"

#### Scenario: Several days overdue
- **WHEN** `report` runs on 2026-11-15 on a ledger holding that `broker-a` entry
- **THEN** it prints `broker-a: sent 2026-10-12, due 2026-11-12, 3 days overdue` and exits 1
- **Test**: `test/cli.test.ts` › privacy-guard report › "lists every overdue request in ledger order"

#### Scenario: Sent without a due date
- **WHEN** `report` runs with `broker-x` in state `sent`, sent 2026-09-01, with no due date, and nothing else
- **THEN** it prints exactly `broker-x: sent 2026-09-01, no due date recorded` and exits 1
- **Test**: `test/cli.test.ts` › privacy-guard report › "warns about a sent request with no due date"

#### Scenario: Other states are not listed
- **WHEN** `report` runs on a ledger whose only entries are a `drafted` and an `acknowledged` entry, each with a due date before today
- **THEN** it prints exactly `nothing is overdue` and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard report › "never lists drafted or acknowledged requests"

#### Scenario: Ledger order
- **WHEN** `report` runs with, in order, an overdue `broker-b`, a `sent` `broker-x` with no due date and an overdue `broker-a`
- **THEN** it prints three lines in that order and exits 1
- **Test**: `test/cli.test.ts` › privacy-guard report › "lists every overdue request in ledger order"

#### Scenario: No sent date recorded
- **WHEN** an entry to be listed has no sent date
- **THEN** its line omits the date: `<broker>: sent, due <due date>, <n> day(s) overdue`, or `<broker>: sent, no due date recorded`
- **Test**: `test/cli.test.ts` › privacy-guard report › "leaves out a sent date that was not recorded"

#### Scenario: Report changes nothing
- **WHEN** `report` runs on a ledger with an overdue request
- **THEN** the ledger file is unchanged and nothing is sent
- **Test**: `test/cli.test.ts` › privacy-guard report › "is quiet on the due date and flags the day after" (asserts the ledger file is unchanged; that nothing is sent is not asserted, and `report` has no path to the send guard)

### Requirement: Invalid ledger stops a command
A command that reads an invalid ledger SHALL stop with the load error and a non-zero exit code, and SHALL
NOT send or print any request.

#### Scenario: Due on an invalid ledger
- **WHEN** `due` runs and the ledger file holds `null`
- **THEN** the process fails with the `expected an "entries" array` error and exits 1, printing a stack trace
- **Test**: none

#### Scenario: Report on a ledger with a stored overdue state
- **WHEN** `report` runs and the ledger holds an entry in state `overdue`
- **THEN** it fails with the unknown-state error and prints no request line
- **Test**: `test/cli.test.ts` › privacy-guard report › "stops on a ledger that still stores overdue"

### Requirement: Send guard
Every send SHALL be a dry run unless the human confirmed it. An unconfirmed send SHALL NOT reach a channel
and reports that it was a dry run; a confirmed send SHALL hand the request to the channel exactly once.

#### Scenario: Unconfirmed send
- **WHEN** a send to `broker-a` is not confirmed
- **THEN** the channel is not called and the result is not sent, with reason `dry-run`
- **Test**: `test/cli.test.ts` › guardedSend › "does not deliver without confirmation"

#### Scenario: Confirmed send
- **WHEN** a send to `broker-a` is confirmed
- **THEN** the channel is called once and the result is sent
- **Test**: `test/cli.test.ts` › guardedSend › "delivers once when confirmed"

### Requirement: The send command dry run
`privacy-guard send` without `--confirm` SHALL print `dry run: nothing was sent. A real send needs
--confirm.`, then `would send to <broker>` for each entry in state `drafted`, in ledger order, or `no
drafted requests to send.` when there is none, and exit 0. It takes no broker argument.

#### Scenario: Dry run on an empty ledger
- **WHEN** `send` runs on an empty ledger
- **THEN** it says nothing was sent, mentions `--confirm`, and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard send › "without --confirm sends nothing and says so, even on an empty ledger" (the `no drafted requests to send.` line is not asserted)

#### Scenario: Dry run names the drafted requests
- **WHEN** `send` runs with one `drafted` entry for `broker-a`
- **THEN** it says nothing was sent, prints `would send to broker-a`, and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard send › "without --confirm names what it would send"

#### Scenario: Only drafted requests are sent
- **WHEN** `send` runs on a ledger whose entries are all `sent`, `acknowledged` or `escalated`
- **THEN** it names none of them and prints `no drafted requests to send.`
- **Test**: none

### Requirement: The send command when confirmed
`privacy-guard send --confirm` SHALL NOT send anything, because no channel can send yet. With a drafted
request it SHALL print `send is not implemented yet: no channel can send, so nothing was sent to <broker>.`
for the first one and exit 1. `--confirm` counts anywhere after `send`.

#### Scenario: Confirmed send with a drafted request
- **WHEN** `send --confirm` runs with a `drafted` entry for `broker-a`
- **THEN** nothing is sent, it prints the not-implemented message naming `broker-a`, and exits 1
- **Test**: `test/cli.test.ts` › privacy-guard send › "with --confirm still sends nothing: no channel can send yet"

#### Scenario: Stops at the first drafted request
- **WHEN** `send --confirm` runs with two `drafted` entries
- **THEN** it prints the message for the first only and exits 1
- **Test**: none

#### Scenario: Confirmed send with nothing drafted
- **WHEN** `send --confirm` runs on a ledger with no `drafted` entry
- **THEN** it prints `no drafted requests to send.`, without the dry-run line, and exits 0
- **Test**: none

#### Scenario: Flag position
- **WHEN** the command line is `send x --confirm`, or `--confirm send`
- **THEN** the first is a confirmed send (extra words are ignored) and the second prints usage and exits 2
- **Test**: none

### Requirement: No command changes the ledger
No command SHALL write the ledger file. Drafting, sending, and recording a receipt, a reply or an
escalation are not done yet, so every entry is written by hand.

#### Scenario: Send leaves the ledger as it was
- **WHEN** `send` runs with or without `--confirm` on a ledger with a `drafted` entry
- **THEN** the ledger file is unchanged and the entry is still `drafted`
- **Test**: none

### Requirement: Command line surface
The command line SHALL offer `due`, `report`, `draft` and `send`. `draft` SHALL print `draft is not
implemented yet` and exit 0. Any other command, or none, SHALL print the usage line and exit 2.

#### Scenario: Draft is a stub
- **WHEN** `draft` runs
- **THEN** it prints that it is not implemented yet and exits 0
- **Test**: `test/cli.test.ts` › privacy-guard draft › "says it is not implemented yet" (the exit code is not asserted)

#### Scenario: Unknown command
- **WHEN** `frobnicate` runs
- **THEN** it prints `usage: privacy-guard <due | report | draft | send [--confirm]>` and exits 2
- **Test**: `test/cli.test.ts` › privacy-guard with an unknown command › "prints usage and fails" (asserts `usage: privacy-guard`, not the whole line)

#### Scenario: No command
- **WHEN** privacy-guard runs with no arguments
- **THEN** it prints the usage line and exits 2
- **Test**: none

### Requirement: Due date rule
For a sent date, `dueDate` SHALL give the date one calendar month later, on the same day of the month;
when the target month has no such day, the last day of that month, never a day of the month after. It
SHALL work on the YYYY-MM-DD text of a real calendar date, with no time zone, and never count days. No
command uses it yet, so it sets no request's due date.

#### Scenario: Same day next month
- **WHEN** `dueDate` is given 2026-10-12
- **THEN** it gives 2026-11-12
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: Across the year end
- **WHEN** `dueDate` is given 2026-12-15
- **THEN** it gives 2027-01-15
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: End of January in a common year
- **WHEN** `dueDate` is given 2026-01-31
- **THEN** it gives 2026-02-28
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: End of January in a leap year
- **WHEN** `dueDate` is given 2028-01-31
- **THEN** it gives 2028-02-29
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: End of January in a century year that is not a leap year
- **WHEN** `dueDate` is given 2100-01-31
- **THEN** it gives 2100-02-28
- **Test**: `test/ledger.test.ts` › dueDate › "does not make a century year a leap year unless it divides by 400"

#### Scenario: Into a 30-day month
- **WHEN** `dueDate` is given 2026-03-31 or 2026-08-31
- **THEN** it gives 2026-04-30 or 2026-09-30
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: Not the machine's time zone
- **WHEN** `dueDate` is given 2026-10-12 on a machine whose time zone is behind or ahead of UTC
- **THEN** it gives 2026-11-12
- **Test**: `test/ledger.test.ts` › dueDate › "does not depend on the time zone"
