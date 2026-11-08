// Tests the matcher inside .github/workflows/cla.yml. It reads the block between the
// matcher:start and matcher:end comments straight from the workflow, so there is only one
// copy of the code. Run with `node --test scripts/*.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/cla.yml", import.meta.url), "utf8");
const block = workflow.match(/\/\/ matcher:start\n([\s\S]*?)\/\/ matcher:end/)[1];
const { decideStatus, evaluate, commentFor, hasAgreeCommand, isAgreement, findAgreement, isExempt, parseIds, parseRecord, buildEntry, isSigned, recordSignature, askBody, agreedBody } = new Function(
  `${block}\nreturn { decideStatus, evaluate, commentFor, hasAgreeCommand, isAgreement, findAgreement, isExempt, parseIds, parseRecord, buildEntry, isSigned, recordSignature, askBody, agreedBody };`,
)();

const T = "2026-11-08T10:00:00Z";
const pull = (id = 1, login = "newcomer", association = "NONE", type = "User") => ({ user: { id, login, type }, author_association: association });
const comment = (body, { id = 1, type = "User", created = T, updated = T } = {}) => ({
  body, user: { id, type }, created_at: created, updated_at: updated, html_url: "https://example.test/c/1",
});

test("the command counts in its accepted spellings", () => {
  for (const body of ["/orbynAgree", "/orbyn agree", "/ORBYNAGREE", "/Orbyn Agree", "  /orbynAgree  ", "/orbynAgree\r\n", "Hello\n\n/orbynAgree\n\nThanks"]) {
    assert.equal(hasAgreeCommand(body), true, JSON.stringify(body));
  }
});

test("quoted, fenced, indented, inline and mid-sentence copies do not count", () => {
  const no = [
    "> /orbynAgree",
    ">/orbynAgree",
    "```\n/orbynAgree\n```",
    "~~~\n/orbynAgree\n~~~",
    "```\n/orbynAgree",
    "````\n```\n/orbynAgree\n```\n````",
    "    /orbynAgree",
    "\t/orbynAgree",
    "`/orbynAgree`",
    "I will /orbynAgree later",
    "/orbynAgree please",
    "do /orbyn agree",
    "/orbynAgreed",
    "/orbyn  not agree",
    "<!-- /orbynAgree -->",
    "<!--\n/orbynAgree\n-->",
    "<!-- hidden\n/orbynAgree",
    "I agree",
    "",
  ];
  for (const body of no) assert.equal(hasAgreeCommand(body), false, JSON.stringify(body));
  assert.equal(hasAgreeCommand(undefined), false);
  assert.equal(hasAgreeCommand(null), false);
});

test("a command after a closed fence still counts", () => {
  assert.equal(hasAgreeCommand("```\nexample\n```\n/orbynAgree"), true);
  assert.equal(hasAgreeCommand("> quoted\n/orbynAgree"), true);
});

test("only the pull request's author counts, by account id", () => {
  assert.equal(isAgreement(comment("/orbynAgree", { id: 1 }), pull(1)), true);
  assert.equal(isAgreement(comment("/orbynAgree", { id: 2 }), pull(1)), false);
});

test("bot comments and edited comments do not count", () => {
  assert.equal(isAgreement(comment("/orbynAgree", { id: 1, type: "Bot" }), pull(1)), false);
  assert.equal(isAgreement(comment("/orbynAgree", { updated: "2026-11-08T11:00:00Z" }), pull(1)), false);
  assert.equal(isAgreement(undefined, pull(1)), false);
});

test("findAgreement picks the author's valid comment among others", () => {
  const good = comment("/orbynAgree", { id: 1 });
  const list = [comment("/orbynAgree", { id: 2 }), comment("> /orbynAgree", { id: 1 }), good];
  assert.equal(findAgreement(list, pull(1)), good);
  assert.equal(findAgreement(list.slice(0, 2), pull(1)), undefined);
});

test("organisation members, owners and listed account ids are exempt", () => {
  const allowed = parseIds("63905487, 49699333,41898282");
  assert.deepEqual(allowed, [63905487, 49699333, 41898282]);
  assert.equal(isExempt(pull(1, "a", "MEMBER"), allowed), true);
  assert.equal(isExempt(pull(1, "a", "OWNER"), allowed), true);
  assert.equal(isExempt(pull(63905487, "renamed-anh", "CONTRIBUTOR"), allowed), true);
  assert.equal(isExempt(pull(49699333, "dependabot[bot]", "NONE", "Bot"), allowed), true);
});

test("a login is not trusted: same name with another id, or an unlisted bot, is not exempt", () => {
  const allowed = parseIds("63905487,49699333");
  assert.equal(isExempt(pull(5, "kinqsradio", "CONTRIBUTOR"), allowed), false);
  assert.equal(isExempt(pull(5, "dependabot[bot]", "NONE", "Bot"), allowed), false);
  assert.equal(isExempt(pull(6, "some-app[bot]", "NONE", "Bot"), allowed), false);
});

test("collaborators, first-time contributors and private members (CONTRIBUTOR) are not exempt", () => {
  for (const association of ["COLLABORATOR", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]) {
    assert.equal(isExempt(pull(1, "luannn010", association), [63905487]), false, association);
  }
});

test("parseIds ignores anything that is not a number", () => {
  assert.deepEqual(parseIds("kinqsradio,123,,abc,45x, 7"), [123, 7]);
  assert.deepEqual(parseIds(undefined), []);
});

test("a signature is found by account id, not login", () => {
  const list = [{ github_id: 42, login: "old-name" }];
  assert.equal(isSigned(list, 42), true);
  assert.equal(isSigned(list, "42"), true);
  assert.equal(isSigned(list, 43), false);
  assert.equal(isSigned([], 42), false);
});

test("the bot comments say how to agree and, once agreed, that it covers every repository", () => {
  assert.match(askBody("newcomer"), /`\/orbynAgree`/);
  assert.match(askBody("newcomer"), /<!-- orbyn-cla -->/);
  assert.match(agreedBody("newcomer", undefined), /all Orbyn repositories/);
  assert.match(agreedBody("newcomer", undefined), /<!-- orbyn-cla -->/);
});

const conflict = (status = 409) => Object.assign(new Error("conflict"), { status });
const noSleep = () => Promise.resolve();

function fakeStore(initial = [], failures = [], sha = "s0") {
  const state = { list: initial, sha: sha ?? undefined, writes: 0, reads: 0, queue: [...failures], concurrent: [] };
  return {
    state,
    read: async () => {
      state.reads++;
      return { list: state.list, sha: state.sha };
    },
    write: async (list, sha) => {
      state.writes++;
      const failure = state.queue.shift();
      if (failure) {
        // Someone else wrote first: the file now holds their entry and a new sha.
        state.list = [...state.list, ...state.concurrent.splice(0)];
        state.sha = `s${state.writes}`;
        throw failure;
      }
      assert.equal(sha, state.sha, "write used a stale sha");
      state.list = list;
      state.sha = `s${state.writes}`;
    },
  };
}

test("recordSignature adds an entry once and skips an existing one", async () => {
  const store = fakeStore([{ github_id: 7 }]);
  assert.deepEqual(await recordSignature({ ...store, entry: { github_id: 7 }, sleep: noSleep }), { added: false, attempts: 1 });
  assert.equal(store.state.writes, 0);
  const result = await recordSignature({ ...store, entry: { github_id: 8 }, sleep: noSleep });
  assert.equal(result.added, true);
  assert.deepEqual(store.state.list.map((entry) => entry.github_id), [7, 8]);
});

test("recordSignature retries on 409 and keeps the concurrent signature", async () => {
  const store = fakeStore([], [conflict(409)]);
  store.state.concurrent.push({ github_id: 99 });
  const result = await recordSignature({ ...store, entry: { github_id: 8 }, sleep: noSleep });
  assert.deepEqual(result, { added: true, attempts: 2 });
  assert.deepEqual(store.state.list.map((entry) => entry.github_id), [99, 8]);
});

test("parseRecord reads a large record (over 1 MB) and an empty one", () => {
  const list = Array.from({ length: 12000 }, (_, i) => ({ github_id: i, login: `user-${i}`, comment_sha256: "0".repeat(64), head_sha: "f".repeat(40) }));
  const text = JSON.stringify(list, null, 2) + "\n";
  assert.ok(text.length > 1024 * 1024);
  // The git blobs API returns base64 with line breaks.
  const base64 = Buffer.from(text).toString("base64").replace(/(.{60})/g, "$1\n");
  const parsed = parseRecord(base64);
  assert.equal(parsed.length, 12000);
  assert.equal(isSigned(parsed, 11999), true);
  assert.deepEqual(parseRecord(""), []);
  assert.deepEqual(parseRecord(undefined), []);
});

test("buildEntry keeps what proves the agreement and no name, email or comment body", () => {
  const entry = buildEntry({
    pull: { user: { id: 9, login: "newcomer" }, html_url: "https://example.test/pull/1" },
    comment: { created_at: T, html_url: "https://example.test/c/1", body: "/orbynAgree" },
    repository: "orbyn-dev/orbyn-engine", version: "0.1", headSha: "a".repeat(40),
    bodySha256: "b".repeat(64), claBlobSha: "c".repeat(40), recordedAt: "2026-11-08T10:00:05Z",
  });
  assert.deepEqual(Object.keys(entry).sort(), [
    "agreement_version", "cla_blob_sha", "comment_sha256", "comment_url", "github_id", "head_sha",
    "login", "pull_request", "recorded_at", "repository", "signed_at",
  ]);
  assert.equal(entry.signed_at, T);
  assert.ok(!JSON.stringify(entry).includes("/orbynAgree"));
});

test("recordSignature retries on a 422 only for a create race, and stops when the other run signed the same person", async () => {
  const store = fakeStore([], [conflict(422)], null);
  store.state.concurrent.push({ github_id: 8 });
  const result = await recordSignature({ ...store, entry: { github_id: 8 }, sleep: noSleep });
  assert.deepEqual(result, { added: false, attempts: 2 });
  assert.equal(store.state.list.length, 1);
});

test("a 422 on an update (sha supplied) is a real error and is not retried", async () => {
  const store = fakeStore([{ github_id: 1 }], [conflict(422)], "s0");
  await assert.rejects(recordSignature({ ...store, entry: { github_id: 8 }, sleep: noSleep }), { status: 422 });
  assert.equal(store.state.writes, 1);
});

test("recordSignature gives up after the attempt limit and rethrows other errors at once", async () => {
  const stuck = fakeStore([], [conflict(), conflict(), conflict()]);
  await assert.rejects(recordSignature({ ...stuck, entry: { github_id: 8 }, attempts: 3, sleep: noSleep }), { status: 409 });
  assert.equal(stuck.state.writes, 3);
  const broken = fakeStore([], [Object.assign(new Error("boom"), { status: 500 })]);
  await assert.rejects(recordSignature({ ...broken, entry: { github_id: 8 }, sleep: noSleep }), { status: 500 });
  assert.equal(broken.state.writes, 1);
});

// ---- the status decision: success only after the record holds the person ----

const WRITE_FAILED = "Could not record your agreement. Comment /orbynAgree again to try again.";
const ASK = "Comment /orbynAgree once to agree to the Orbyn contributor agreement.";

test("decideStatus: exempt, already signed, unsigned", () => {
  assert.deepEqual(decideStatus({ exempt: true }), { state: "success", description: "No agreement needed", comment: "none", throws: false });
  const signed = decideStatus({ signed: true });
  assert.equal(signed.state, "success");
  assert.equal(signed.throws, false);
  assert.deepEqual(decideStatus({}), { state: "failure", description: ASK, comment: "ask", throws: false });
});

test("decideStatus: a read error is an error status and fails the run", () => {
  assert.deepEqual(decideStatus({ readError: new Error("x") }), {
    state: "error", description: "Could not check the agreement record.", comment: "none", throws: true,
  });
});

test("decideStatus: a failed write is a failure with the exact line, and the run fails", () => {
  const decision = decideStatus({ agreementFound: true, writeError: new Error("x") });
  assert.deepEqual(decision, { state: "failure", description: WRITE_FAILED, comment: "write-failed", throws: true });
  assert.ok(decision.description.length <= 140);
});

test("decideStatus: success is never returned unless exempt, signed, or the write succeeded", () => {
  const flags = [true, false];
  for (const exempt of flags) for (const readError of [undefined, new Error("r")]) for (const signed of flags)
    for (const agreementFound of flags) for (const writeOk of flags) for (const writeError of [undefined, new Error("w")]) {
      const decision = decideStatus({ exempt, readError, signed, agreementFound, writeOk, writeError });
      if (decision.state !== "success") continue;
      const allowed = exempt || (!readError && signed) || (!readError && agreementFound && writeOk && !writeError);
      assert.ok(allowed, JSON.stringify({ exempt, readError: !!readError, signed, agreementFound, writeOk, writeError: !!writeError }));
    }
  // A write that was attempted and rejected, with or without writeOk, is never success.
  assert.notEqual(decideStatus({ agreementFound: true, writeOk: true, writeError: new Error("w") }).state, "success");
  assert.notEqual(decideStatus({ agreementFound: true }).state, "success");
});

// ---- evaluate: drives read, find and record the way the workflow does ----

const status = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
const agreementComment = comment("/orbynAgree", { id: 1 });

function harness({ initial = [], failures = [], sha = "s0", entry = { github_id: 1 } } = {}) {
  const store = fakeStore(initial, failures, sha);
  return {
    store,
    run: (overrides = {}) => evaluate({
      exempt: false,
      userId: 1,
      read: store.read,
      findAgreementNow: () => agreementComment,
      record: () => recordSignature({ ...store, entry, attempts: 3, sleep: noSleep }),
      ...overrides,
    }),
  };
}

test("evaluate: exempt never touches the record", async () => {
  const result = await evaluate({ exempt: true, userId: 1, read: () => assert.fail("read"), findAgreementNow: () => assert.fail("find"), record: () => assert.fail("record") });
  assert.equal(result.state, "success");
  assert.equal(result.description, "No agreement needed");
});

test("evaluate: already in the record is success without writing", async () => {
  const { store, run } = harness({ initial: [{ github_id: 1 }] });
  const result = await run();
  assert.equal(result.state, "success");
  assert.equal(store.state.writes, 0);
});

test("evaluate: no agreement comment stays failing with the /orbynAgree line", async () => {
  const { run } = harness();
  const result = await run({ findAgreementNow: () => undefined });
  assert.deepEqual([result.state, result.description, result.comment], ["failure", ASK, "ask"]);
});

test("evaluate: success only after the write has resolved", async () => {
  const { store, run } = harness();
  let writtenWhenDecided;
  const result = await run({
    record: async (agreement) => {
      await recordSignature({ ...store, entry: { github_id: 1 }, sleep: noSleep });
      writtenWhenDecided = store.state.list.some((e) => e.github_id === 1);
    },
  });
  assert.equal(result.state, "success");
  assert.equal(result.comment, "agreed");
  assert.equal(writtenWhenDecided, true);
  assert.equal(result.agreement, agreementComment);
});

test("evaluate: a write that rejects is never success (409 exhausted, 500, 403 token)", async () => {
  for (const failures of [[status(409), status(409), status(409)], [status(500)], [status(403)]]) {
    const { store, run } = harness({ failures });
    const result = await run();
    assert.notEqual(result.state, "success", failures[0].message);
    assert.equal(result.state, "failure");
    assert.equal(result.description, WRITE_FAILED);
    assert.equal(result.comment, "write-failed");
    assert.equal(result.throws, true);
    assert.equal(result.error.status, failures[0].status);
    assert.equal(store.state.list.some((e) => e.github_id === 1), false);
  }
});

test("evaluate: a failure inside record before the write (such as reading CLA.md) is a write failure", async () => {
  const { run } = harness();
  const result = await run({ record: async () => { throw status(404); } });
  assert.deepEqual([result.state, result.description, result.throws], ["failure", WRITE_FAILED, true]);
});

test("evaluate: a read error is an error status, never success", async () => {
  const { run } = harness();
  const result = await run({ read: async () => { throw status(500); } });
  assert.deepEqual([result.state, result.description, result.throws], ["error", "Could not check the agreement record.", true]);
  assert.equal(result.error.status, 500);
});

test("evaluate: the retry after a failed write records normally", async () => {
  const { store, run } = harness({ failures: [status(500)] });
  const first = await run();
  assert.equal(first.state, "failure");
  const second = await run();
  assert.equal(second.state, "success");
  assert.equal(second.comment, "agreed");
  assert.equal(store.state.list.filter((e) => e.github_id === 1).length, 1);
  // A third run (the next push) finds the person in the record and writes nothing more.
  const writes = store.state.writes;
  assert.equal((await run()).state, "success");
  assert.equal(store.state.writes, writes);
});

test("commentFor: the write-failure comment carries the marker and the retry line", () => {
  const body = commentFor("write-failed", { login: "newcomer" });
  assert.match(body, /<!-- orbyn-cla -->/);
  assert.match(body, /Comment `\/orbynAgree` again to try again/);
  assert.equal(commentFor("none", { login: "x" }), null);
  assert.equal(commentFor("agreed-if-present", { login: "x", hasOurs: false }), null);
  assert.match(commentFor("agreed-if-present", { login: "x", hasOurs: true }), /all Orbyn repositories/);
  assert.match(commentFor("ask", { login: "x" }), /`\/orbynAgree`/);
});
