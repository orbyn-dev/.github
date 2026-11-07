# Review notes for counsel

**DRAFT, not in force. Not legal advice.** These notes explain the draft in [CLA.md](CLA.md) and list what needs a decision before version 1.0.

## Why a CLA, and why this base

- Orbyn's apps are licensed under PolyForm Strict 1.0.0, which lets no one modify or share the code. The engine is planned to be dual-licensed. Taking outside contributions therefore needs a grant broad enough for Us to keep relicensing them.
- **Base text:** the Harmony Individual Contributor License Agreement 1.0. Its own text says it is licensed under CC BY 3.0, so it can be adapted with credit.
- **Apache ICLA, not used:** the Apache Individual CLA (https://www.apache.org/licenses/icla.pdf) was considered and not used. The document carries no licence or reuse grant of its own; the Apache-2.0 notice on apache.org is the website footer and covers the ASF's software. No Apache text is copied here.
- **Outbound option:** Option Five ("any licence") was chosen so that one agreement covers PolyForm Strict, the dual-licensed engine and any future commercial licence.

## Decisions for counsel and Anh

1. **Who "We" is.** The draft names Anh Dang, matching the PolyForm notice ("Copyright (c) 2026 Anh Dang"). If a company will hold the rights, it should be named here, together with what happens to existing grants if the rights move to that company. Section 6.3 covers assignment in general terms.
2. **Licence or assignment.** The draft keeps copyright with the contributor and takes a broad licence. Harmony also has an assignment version. Is a licence with Option Five enough for later relicensing and enforcement, or is an assignment needed?
3. **Section 2.7, the licence to prepare contributions.** It isn't in Harmony; it was added because PolyForm Strict forbids modification, so contributors would otherwise have no right to edit a local copy. Please check its scope: development and submission only, no distribution, and it lasts as long as the Agreement.
4. **Acceptance by comment.** Contributors accept by posting a fixed sentence on their pull request, which is recorded with their GitHub account number. Is that sufficient evidence of agreement in the relevant jurisdictions, or is a signed form needed?
5. **Governing law** (`[JURISDICTION]`).
6. **Minors.** 3(c) keeps Harmony's line that a parent or guardian should accept for anyone under eighteen. With acceptance by comment there is no way to verify this. Should the age line change, or should minors be refused?
7. **Entity version.** The draft is the individual version only. Contributors whose employer owns their work need an entity agreement (Harmony has one, also CC BY 3.0). Should it be added now or on request?
8. **Contributions made before this Agreement.** Open pull requests from outside contributors exist today. Should their authors accept this Agreement before merge, with the acceptance stated to cover their earlier submissions?
9. **Which projects.** The Agreement covers every Orbyn project whose repository links to it.
   - Proposed: orbyn-engine, orbyn-planner, orbyn-engineering and orbyn.dev.
   - orbyn-designs is private. If outsiders ever get access, they would also need a confidentiality agreement, which this Agreement does not provide.
10. **The MIT skills library** (orbyn-fullstack-skills). Under MIT, inbound equals outbound, and a Developer Certificate of Origin sign-off (`git commit -s`) is usually enough. A CLA is only needed if Anh might ever relicense the library away from MIT. **Question for Anh: might the skills library ever leave MIT?**

## Records

- Acceptances go to a private repository, `orbyn-dev/cla-signatures`, one file per agreement version.
- Each entry holds only the GitHub account number, login, date, pull request and comment link. No names, emails or addresses are stored in any public place.
- The check in `.github/workflows/cla.yml` reads and writes that file with a token limited to that one repository. Anh creates the token when he approves the Agreement. No repository runs the check until then.

## Technical notes (not for counsel)

- **Base check.** The check is our own short script on `actions/github-script` v9.0.0 (MIT), pinned by commit. The common tool for this, CLA Assistant Lite (`contributor-assistant/github-action`, Apache-2.0), was archived in March 2026, so it isn't used. None of its code is copied.
- **Who is checked.** Only the pull request's author. Co-authors listed in commits aren't checked yet.
- **Re-running after acceptance.** Accepting by comment records the signature in its own run. The earlier failed check on the pull request stays red until the author pushes again or a maintainer re-runs it. This should be fixed before version 1.0.
- **Running it.** The workflow runs only through `workflow_call`, and no repository calls it. Turning it on takes three steps: Anh creates the `CLA_SIGNATURES_TOKEN` org secret (a fine-grained token limited to `orbyn-dev/cla-signatures`), then each owner copies `examples/cla-caller.yml` into their own repository and adds the snippets.
