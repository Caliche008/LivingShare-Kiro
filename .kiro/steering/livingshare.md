# LivingShare project steering

## Project context

LivingShare is a web application for shared-living management. It helps users complete a lifestyle questionnaire, find compatible rooms or roommates, manage properties and rooms, split household bills, and make payments.

The application uses Next.js with the App Router and TypeScript for the frontend. Firebase provides Authentication, Firestore, Storage, Cloud Functions, App Check, and optionally Hosting. Stripe is the initial payment provider and must be accessed only through secure backend code.

## Required architecture

- Keep presentation, domain logic, and data access separate.
- Use Server Components for read-only views when interactivity is not needed.
- Use Client Components only for interactive forms, filters, calculators, and session-dependent UI.
- Keep shared domain types in `src/types` and domain rules in `src/lib/domain`.
- Keep Firebase client configuration in `src/lib/firebase`.
- Use Firebase Admin SDK only in Cloud Functions or protected server-side code.
- Put sensitive operations, payment creation, payment webhooks, matching calculations, bill splits, role changes, and audit writes in Cloud Functions.
- Do not expose secrets, private questionnaire answers, payment card data, or trusted amounts to the browser.

## TypeScript and validation

- Use strict TypeScript and avoid `any` unless there is a documented technical reason.
- Validate external input at application boundaries with Zod or the repository's equivalent validation library.
- Reuse schemas between forms, server actions, API routes, and Cloud Functions where practical.
- Model roles, publication states, payment states, and bill-split rules as explicit union types or enums.
- Return typed success and error states from asynchronous operations.

## Firebase and security

- Enforce authorization in both the UI and Firebase Security Rules; UI checks are never sufficient.
- A user may access their own questionnaire only. Property owners and assigned managers may manage their properties.
- Bills and bill shares are visible only to authorized residents and property managers.
- Validate ownership, membership, resource relationships, file type, file size, and storage path on the backend and in security rules where applicable.
- Use separate Firebase projects or configurations for development, test, and production.
- Read secrets from environment variables or Secret Manager. Never commit credentials.
- Record important mutations in `auditLogs` without storing private questionnaire answers or sensitive payment data.

## Domain rules

- Matching must be deterministic, versioned, unit-tested, and explainable through aggregated factors only.
- Missing answers do not reduce a compatibility score, but insufficient answer coverage must be reported.
- Apply mandatory incompatibility rules before calculating the weighted compatibility score.
- Store money as integer minor units such as cents. Never use floating-point arithmetic for monetary calculations.
- Bill shares must sum exactly to the invoice total after deterministic rounding.
- A confirmed bill split must not be overwritten. Use a new version or adjustment operation and preserve an audit trail.
- Payment state changes must be driven by verified backend events, especially Stripe webhooks.
- Payment webhooks must verify signatures and be idempotent.
- Published room states are `draft`, `published`, `paused`, `reserved`, and `withdrawn`.

## UI and user experience

- Build responsive interfaces for mobile and desktop.
- Every relevant operation must provide loading, error, empty, and success states.
- Use clear validation messages and consistent currency and date formatting.
- Do not expose private questionnaire responses from other users; show only understandable aggregate compatibility factors.
- Preserve the existing design system when one is present. Keep forms accessible with labels, keyboard navigation, and visible focus states.

## Testing and delivery

- Add focused unit tests for matching, normalization, mandatory exclusions, bill-split rules, integer rounding, and payment state transitions.
- Add integration tests for Firebase Security Rules, authentication flows, Cloud Functions, and payment webhooks.
- Add end-to-end tests for the main user journeys: questionnaire to match, property to published room, and invoice to confirmed payment.
- Before considering a change complete, run the narrowest relevant test first, then lint and build when applicable.
- Do not mark a task complete without handling authorization, validation, error states, and audit requirements relevant to that task.

## Implementation style

- Prefer small, focused modules and existing repository patterns over new abstractions.
- Keep public APIs and data contracts stable unless the task requires a deliberate change.
- Avoid unrelated refactors and avoid adding dependencies when the existing stack solves the problem.
- Use concise comments only for non-obvious domain decisions.
- When requirements are ambiguous, preserve data, privacy, authorization, and idempotency first, and document the assumption.
