# privacy-guard

Asks data brokers, on one person's behalf, to erase their data and stop selling it (GDPR Articles 17
and 21), and tracks each broker against the one-month deadline for its reply.

## Language

### Parties

**Subject**:
The person a request is about and on whose behalf it is made.
_Avoid_: user, customer, data subject (outside legal quotes)

**Broker**:
A company that collects and sells personal data, and that receives requests.
_Avoid_: vendor, site, target

**Playbook**:
The data that says how to ask one broker: its channel, where to send, and what the request contains.
_Avoid_: config, broker profile, recipe

### Requests

**Request**:
One ask to one broker, on the subject's behalf, to erase their data and to stop selling it.
_Avoid_: opt-out (as a noun), ticket, case

**Ledger**:
The local record of every request and where it stands. It holds no personal data.
_Avoid_: database, log, history

**Confirmed send**:
A send the human explicitly approved, once, for one request. Without that approval, privacy-guard only shows what it would send (a dry run).
_Avoid_: real send, live send

**Receipt**:
The broker's confirmation that it got a request, usually carrying a reference. A receipt is not a reply and does not stop the clock.
_Avoid_: acknowledgement, confirmation

**Reply**:
The broker's actual answer to a request. A reply stops the clock.
_Avoid_: response, receipt

**Acknowledged**:
A request whose reply has been recorded.
_Avoid_: answered, closed, done

### Deadlines

**Sent**:
A request is sent once a confirmed send brings back the broker's receipt. A send without a receipt leaves the request drafted, even if it may have arrived.
_Avoid_: submitted, delivered

**Sent date**:
The date of the send that brought back the receipt; for a web form this is also the date the broker received it, and it starts the clock.

**Due date**:
One calendar month after the sent date (GDPR Article 12(3)), or the last day of that month when it has no such day. Weekends and public holidays do not move it.
_Avoid_: deadline date, 30 days

**Overdue**:
A sent request with no reply whose due date has passed.
_Avoid_: late, expired
