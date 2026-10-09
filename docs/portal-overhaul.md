# CuraLink interface and portal data overhaul

The landing page, authentication, patient dashboard, doctor workspace, Admin registry, appointment booking, and consultation views now share a responsive white/slate/teal interface with readable typography, explicit loading/empty/error states, keyboard focus, mobile navigation, and accessible dialogs.

## Protected code

Firebase configuration and initialization, the medical uploader's Base64 conversion and writes, and Web Serial/hardware acquisition code were preserved. `node scripts/verify-guardrails.cjs` compares the protected source/configuration files and discovered serial-access sources against Git HEAD without printing their contents.

## Data behavior

- Appointments subscribe by the authenticated patient's `patientId` or verified doctor's `doctorId`. Signed-out accounts and unverified doctors do not subscribe to care data.
- The doctor directory includes patients assigned by `assignedDoctorId` and patients from the doctor's non-cancelled bookings. Completed encounters retain the care relationship; a cancelled booking alone grants no directory relationship.
- Records, vitals, and messages subscribe to those patient/appointment IDs. Legacy record collections remain readable. Each source replaces its snapshot, so deletions propagate. Attachment mirrors are collapsed across collections while repeated records within a source remain distinct.
- Notes and prescriptions write to canonical `medical_records` once. Transactions reread verification and assigned/booked relationships before writing. Mutations await persistence and surface failures.
- The protected document uploader already saves its records. Its callback no longer creates an additional copy.
- Booking uses a stable document ID for retry. It rereads the selected doctor's verification and does not report a failed save as success.
- The saved profile is live, and Google sign-in preserves existing roles and verification. New clinician profiles collect a supplied license and specialty.
- The workspace remounts on changes to UID, role, or verification. Old records, dialog drafts, and telemetry/history do not carry across accounts.
- Patient and doctor routes use the same deterministic consultation room name. Meeting embeds require an active video appointment and the correct participant through the app. This client gate does not configure access controls on the external Jitsi service.

## Honest payment and emergency feedback

Simulated card/UPI/bank success, synthetic payment orders, embedded provider credentials, and simulated emergency dispatch were removed. The order endpoint requires a Firebase session and configured provider credentials. Checkout responses remain `Pending` until a server signature/webhook confirmation flow is implemented. An emergency dialog offers the saved contact and directs the user to local emergency services; it does not claim that anyone was notified or dispatched.

## Repeatable verification

Run from the repository root:

```text
node scripts/verify-guardrails.cjs
node scripts/verify-data.cjs
node scripts/verify-payment.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

The data/auth tests mock all external modules and calls and cover account scopes, source replacement/deletions, stale callbacks, booking failures/idempotency, verification/relationship checks, and duplicate upload prevention. Payment tests cover authentication and provider success/failure contracts with mock credentials. Browser checks used a fresh signed-out session with Firebase requests blocked and checked desktop/mobile layouts, clinician registration fields, password reveal, modal dismissal, and guest meeting access. No patient records, real bookings, payments, or emergency messages were used for testing.

## Live rollout requirements

- Existing Firestore rules are broadly permissive for authenticated users and allow self-editing role/verification fields. They were left unchanged as protected Firebase configuration. Client scoping improves normal app behavior and does not enforce backend authorization against direct SDK requests.
- Firebase CLI credentials were unavailable, so database edition and authenticated live flows were not verified. The existing SDK and database configuration were retained.
- Rotate the previously committed Razorpay secret. Removing it from the current source does not remove it from Git history.
- Server payment confirmation and production video-service access/privacy configuration require separate work before making production security or payment-verification claims.
- No changes were pushed, Firebase configuration deployed, Vercel deployment promoted, or live records seeded.
