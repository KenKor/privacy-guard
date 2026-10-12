# privacy-guard

Asks data brokers to stop selling one person's data (GDPR Articles 17 and 21) and holds each broker
to the one-month deadline for its reply.

## Language

### Parties

**Subject**:
The person whose data a request is about, and on whose behalf it is sent.
_Avoid_: user, customer, data subject (outside legal quotes)

**Broker**:
A company that collects and sells personal data, and to which requests are sent.
_Avoid_: vendor, site, target

**Playbook**:
The data that says how to ask one broker to stop: its channel, its address and what the request must contain.
_Avoid_: config, broker profile, recipe

**Channel**:
The way a broker accepts requests, such as a web form.
_Avoid_: method, transport

### Requests

**Request**:
One ask to one broker, on behalf of the subject, to erase their data and stop selling it.
_Avoid_: opt-out (as a noun), ticket, case, entry

**Open request**:
A request with no reply yet: drafted, sent or escalated. A broker has at most one open request.
_Avoid_: active, pending

**Ledger**:
The local record of every request and where it stands. It holds no personal data.
_Avoid_: database, log, history

**Confirmed send**:
A send the human explicitly approved. Without that approval, privacy-guard only shows what it would send (a dry run).
_Avoid_: real send, live send

**Sent**:
A request is sent once a confirmed send has gone out to the broker. The sent date starts the deadline.

**Receipt**:
The broker's confirmation that it got a request, usually with a reference. A receipt is not a reply.
_Avoid_: acknowledgement, confirmation

**Reply**:
The broker's answer to a request: it erased the data, refused, or asked for more. A request with a reply is acknowledged.
_Avoid_: response, receipt

### Deadlines

**Due date**:
One calendar month after the sent date (GDPR Article 12(3)). When that month has no matching day, it is the last day of the month.
_Avoid_: deadline date, 30 days

**Overdue**:
A sent request with no reply after its due date has passed.
_Avoid_: late, expired

**Escalated**:
An overdue request the subject has taken to a supervisory authority (GDPR Article 77) and recorded as such. It stays open until the broker replies. privacy-guard files nothing itself.
_Avoid_: reported, complained
