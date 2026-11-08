# Review notes for counsel

**DRAFT, not in force. Not legal advice.** These notes explain the draft in [CLA.md](CLA.md) and list what needs a decision before version 1.0.

## Why a CLA, and why this base

- **Licences.** Orbyn's apps (orbyn-planner, orbyn-engineering) and orbyn.dev are under PolyForm Strict 1.0.0, which lets no one modify or share the code. The engine (orbyn-engine) is moving to MIT OR Apache-2.0. Taking outside contributions across both needs a grant broad enough for Us to license them under any of these, and commercially.
- **Base text:** the Harmony Individual Contributor License Agreement 1.0. Its own text says it is licensed under CC BY 3.0, so it can be adapted with credit.
- **Apache ICLA, not used:** the Apache Individual CLA (https://www.apache.org/licenses/icla.pdf) was considered and not used. The document carries no licence or reuse grant of its own; the Apache-2.0 notice on apache.org is the website footer and covers the ASF's software. No Apache text is copied here.
- **Outbound option:** Option Five ("any licence") was chosen so that one agreement covers PolyForm Strict, the engine's MIT OR Apache-2.0 and any future commercial licence. The engine keeps the CLA even though it is permissive, so one rule applies to every covered project and a commercial licence stays possible.

## Decisions for counsel and Anh

1. **Who "We" is.** The draft names Anh Dang, matching the PolyForm notice ("Copyright (c) 2026 Anh Dang"). If a company will hold the rights, it should be named here, together with what happens to existing grants if the rights move to that company. Section 6.3 covers assignment in general terms.
2. **Licence or assignment.** The draft keeps copyright with the contributor and takes a broad licence. Harmony also has an assignment version. Is a licence with Option Five enough for later relicensing and enforcement, or is an assignment needed?
3. **Section 2.7, the licence to prepare contributions.** It isn't in Harmony; it was added because PolyForm Strict forbids modification, so contributors would otherwise have no right to edit a local copy. Please check its scope: development and submission only, no distribution, and it lasts as long as the Agreement.
4. **Acceptance by comment.** Contributors accept once by commenting `/orbynAgree` on their own pull request; the comment is recorded with their GitHub account number and covers every covered Orbyn repository. Is that sufficient evidence of agreement in the relevant jurisdictions, or is a signed form needed?
5. **Governing law** (`[JURISDICTION]`).
6. **Minors.** 3(c) keeps Harmony's line that a parent or guardian should accept for anyone under eighteen. With acceptance by comment there is no way to verify this. Should the age line change, or should minors be refused?
7. **Entity version.** The draft is the individual version only. Contributors whose employer owns their work need an entity agreement (Harmony has one, also CC BY 3.0). Should it be added now or on request?
8. **Contributions made before this Agreement.** Drafted so that one acceptance covers everything the person has already Submitted, including work that is already merged, plus later contributions (see "How to accept"). This lets an existing contributor, such as Luan, sign once when the Agreement is in force. Please confirm that a later acceptance can validly cover earlier submissions in the relevant jurisdictions, whether the agreement should say the earlier work was contributed on the same terms from the date of each submission, and whether a short confirmation from existing contributors is needed in addition to the comment.
9. **Which projects (decided).** The Agreement covers orbyn-engine, orbyn-planner, orbyn-engineering and orbyn.dev.
   - orbyn-designs is private. If outsiders ever get access, they would also need a confidentiality agreement, which this Agreement does not provide.
10. **The MIT skills library (decided).** orbyn-fullstack-skills stays MIT for good. It doesn't use this Agreement: inbound equals outbound, with a Developer Certificate of Origin sign-off (`git commit -s`) on every commit.

## Records

- Acceptances go to one private repository, `orbyn-dev/cla-signatures`, one file per agreement version (`signatures/icla-<version>.json`). Every covered repository reads that same file, so a person who accepts in one repository is covered in all of them.
- Each entry holds only the GitHub account number, login, agreement version, the comment's creation time, the repository and pull request where they accepted, the comment link, the SHA-256 of the exact comment text (not the text), the pull request's head commit, and the git blob sha of `CLA.md` at that time. That proves what was agreed even if the comment is later edited or deleted. No names, emails or addresses are stored in any public place.
- The file is read through the git blobs API, so it keeps working past the 1 MB limit of the contents API.
- The check in `.github/workflows/cla.yml` reads and writes that file with a token limited to that one repository. Concurrent signatures are handled with the contents API `sha` and a retry on conflict.

## Technical notes (not for counsel)

- **Base check.** The check is our own short script on `actions/github-script` v9.0.0 (MIT), pinned by commit. The common tool for this, CLA Assistant Lite (`contributor-assistant/github-action`, Apache-2.0), was archived in March 2026, so it isn't used. None of its code is copied.
- **Who is checked.** Only the pull request's author. Co-authors listed in commits aren't checked yet. Organisation members and owners, and the account ids in `allowed`, need nothing (status `CLA` = success, "No agreement needed"). `allowed` holds numeric account ids, not logins (a login can be renamed and reused); the default is Anh (63905487), `dependabot[bot]` (49699333) and `github-actions[bot]` (41898282), all checked with the GitHub API. There is no blanket bot exemption: list any other bot by id. GitHub reports a private organisation member as `CONTRIBUTOR`, not `MEMBER`, so such a person should make their membership public or be listed by id.
- **The `CLA` status.** The workflow sets a commit status named `CLA` on the pull request's head commit, from `pull_request_target` and from `issue_comment` (created). The run triggered by `/orbynAgree` records the signature and turns the status green, so there is no stale red check and no re-push or re-run. A repository requires the status context `CLA`.
- **Security.** It runs on `pull_request_target` and `issue_comment`, and never checks out, builds or runs anything from the pull request. It reads event metadata, the author's account id, the head sha and comment bodies, and passes untrusted text only through the matcher functions, never a shell. Only a comment by the pull request's author (compared by account id), not by a bot, never edited, with the command alone on a line, counts.
- **Covered repositories.** `orbyn-engine`, `orbyn-planner`, `orbyn-engineering` and `orbyn.dev` (decision 9). A caller passes the required `agreement-version` input; there is no default, so a repository that forgets it fails instead of recording agreement to the wrong version.
- **Not covered.** `orbyn-fullstack-skills` stays MIT with a DCO and has no CLA check.
- **Not verified without a real run.** Setting a commit status from an `issue_comment` run and from a called workflow, and the contents API conflict codes, are written to GitHub's documented behaviour but have not been run against GitHub.

## Known limits and follow-ups

- **A required status can be faked.** A workflow in a fork PR can contain a job that posts a status named `CLA` (or whose check has the same name). Interim mitigation: in each covered repository set Settings, Actions, General, "Fork pull request workflows from outside collaborators" to "Require approval for all outside collaborators", and reviewers look at any change under `.github/workflows` before approving a run. The stronger fix is a dedicated GitHub App that posts the status, with that app set as the required source of `CLA`; this is a follow-up. The older "Licence grant" check has the same exposure.
- **Existing contributors without an open PR** (for example Luan) can agree by commenting `/orbynAgree` on any old pull request of theirs: the check also runs on comments, so this records the signature for every covered repository.
- **The token expires.** A fine-grained personal access token expires, and then every check ends in an error until it is renewed. A GitHub App installation token is the better long-term option. Limit the org secret `CLA_SIGNATURES_TOKEN` to the covered repositories.

## Running it

Nothing runs until these steps are done, and the only manual ones are:

1. Anh creates a fine-grained token with contents read and write on `orbyn-dev/cla-signatures` only, and saves it as the organisation secret `CLA_SIGNATURES_TOKEN`, limited to the covered repositories.
2. Anh runs `scripts/enable-cla.sh <repo>` for `orbyn-engine`, `orbyn-planner`, `orbyn-engineering` and `orbyn.dev`, and merges the pull request each opens.
3. Anh requires the status check `CLA` on each repository's default branch, and sets "Require approval for all outside collaborators" for fork pull request workflows.

The older "Licence grant" check (`licence-grant.yml`) stays in force until Anh switches over.
