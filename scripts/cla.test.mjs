// Tests the matcher inside .github/workflows/cla.yml. It reads the block between the
// matcher:start and matcher:end comments straight from the workflow, so there is only one
// copy of the code. Run with `node --test scripts/*.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/cla.yml", import.meta.url), "utf8");
const block = workflow.match(/\/\/ matcher:start\n([\s\S]*?)\/\/ matcher:end/)[1];
const { hasAgreeCommand, isAgreement, findAgreement, isExempt, parseIds, parseRecord, buildEntry, isSigned, recordSignature, askBody, agreedBody } = new Function(
  `${block}\nreturn { hasAgreeCommand, isAgreement, findAgreement, isExempt, parseIds, parseRecord, buildEntry, isSigned, recordSignature, askBody, agreedBody };`,
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
