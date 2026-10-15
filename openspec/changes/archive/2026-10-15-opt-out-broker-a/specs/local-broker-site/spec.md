# Spec Delta

## Purpose

A local stand-in for broker A's opt-out page that accepts a form submission and answers with a
receipt, so a confirmed send can be tried end to end without contacting a real broker.

## ADDED Requirements

### Requirement: Serve broker A's page
`npm run site` SHALL serve broker A's page, unchanged, at `http://localhost:8080/`, listening on
localhost only.

#### Scenario: Page
- **WHEN** the site is running and `GET /` is requested
- **THEN** it answers 200 with broker A's page, byte for byte as committed

### Requirement: Answer the form submission with a receipt
A form POST to `/` SHALL be answered 200 with a thank-you page whose `#thanks` element holds a new
reference matching `BA-[0-9]{6}`. The site SHALL NOT store or log the submitted values.

#### Scenario: Submission
- **WHEN** the site is running and a form POST to `/` arrives
- **THEN** it answers 200 with `#thanks` containing a reference such as `BA-482915`

#### Scenario: Send end to end
- **WHEN** the site is running, broker-a has a drafted request, and `send broker-a --confirm` runs
- **THEN** the request becomes `sent` with the reference from the thank-you page

#### Scenario: Nothing kept
- **WHEN** a form POST to `/` arrives
- **THEN** none of the submitted values is written to disk or to the site's output
