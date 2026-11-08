# orbyn-dev/.github

> **DRAFT, not in force, pending legal review.**
> Nothing in this repository applies to any Orbyn project yet. No repository uses its workflows, and no contribution is accepted or refused because of it.

This repository will hold organisation-wide files for Orbyn projects, starting with a contributor licence agreement. The draft is under review in a pull request.

Contact: hello@orbyn.dev

## Licence grant check (in force)

`.github/workflows/licence-grant.yml` is an interim check for pull requests from outside the organisation, until the contributor licence agreement is approved. The author posts one licence-grant sentence on their pull request, and the "Licence grant" status turns green. Organisation members and bots pass at once.

Product repositories call it from `examples/licence-grant-caller.yml`.

## Contributor agreement check (draft, not in force)

`.github/workflows/cla.yml` is a reusable check for the draft [contributor agreement](CLA.md). A contributor comments `/orbynAgree` once on their own pull request; that covers every covered Orbyn repository. Organisation members and bots pass at once. The skills library (`orbyn-fullstack-skills`) stays MIT with a DCO and is not covered.

### Turning it on for a repository

1. Copy [`examples/cla-caller.yml`](examples/cla-caller.yml) to `.github/workflows/cla.yml`, or run `scripts/enable-cla.sh <repo>`, which opens a pull request doing exactly that (it does not touch branch protection or secrets).
2. Make sure the organisation secret `CLA_SIGNATURES_TOKEN` is available to the repository.
3. Require the status check `CLA` on the default branch.

See [REVIEW.md](REVIEW.md) for the records, the security notes and the exact manual steps.
