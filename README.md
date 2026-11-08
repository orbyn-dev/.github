# orbyn-dev/.github

> **Version 0.1 of the contributor agreement is in force; legal review is pending.**
> A reviewed version may replace it, and contributors would then be asked to agree again. A repository uses these workflows only after its caller is merged.

This repository holds organisation-wide files for Orbyn projects, starting with the contributor licence agreement.

Contact: hello@orbyn.dev

## Contributor agreement check

`.github/workflows/cla.yml` is a reusable check for the [contributor agreement](CLA.md). A contributor comments `/orbynAgree` once on their own pull request; that covers every covered Orbyn repository. Organisation members and bots pass at once. The skills library (`orbyn-fullstack-skills`) stays MIT with a DCO and is not covered.

### Turning it on for a repository

1. Copy [`examples/cla-caller.yml`](examples/cla-caller.yml) to `.github/workflows/cla.yml`, or run `scripts/enable-cla.sh <repo>`, which opens a pull request doing exactly that (it does not touch branch protection or secrets).
2. Make sure the organisation secret `CLA_SIGNATURES_TOKEN` is available to the repository (limit it to the covered repositories). The caller must pass the `agreement-version` input; it has no default.
3. Require the status check `CLA` on the default branch.
4. Settings, Actions, General: set fork pull request workflows to "Require approval for all outside collaborators", and look at any change under `.github/workflows` before approving. A fork PR workflow can post a status with the same name, so the required check alone is not proof. A dedicated GitHub App that posts the status is the planned stronger fix.

Exemptions are by numeric account id (`allowed` input) and by `MEMBER`/`OWNER` association. A private organisation member reads as `CONTRIBUTOR`, so they should make their membership public or be listed by id.

The `CLA` status turns green only after the agreement is in the record. If the write fails, the status stays failing ("Could not record your agreement. Comment /orbynAgree again to try again."), the one bot comment says so, and commenting `/orbynAgree` again retries.

Existing contributors with no open pull request can agree by commenting `/orbynAgree` on any of their old pull requests.

See [REVIEW.md](REVIEW.md) for the records, the security notes and the exact manual steps.
