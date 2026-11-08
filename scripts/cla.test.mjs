// Tests the matcher inside .github/workflows/cla.yml. It reads the block between the
// matcher:start and matcher:end comments straight from the workflow, so there is only one
// copy of the code. Run with `node --test scripts/*.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/cla.yml", import.meta.url), "utf8");
const block = workflow.match(/\/\/ matcher:start\n([\s\S]*?)\/\/ matcher:end/)[1];
const { hasAgreeCommand, isAgreement, findAgreement, isExempt, isSigned, recordSignature, askBody, agreedBody } = new Function(
  `${block}\nreturn { hasAgreeCommand, isAgreement, findAgreement, isExempt, isSigned, recordSignature, askBody, agreedBody };`,
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

test("organisation members, owners, bots and listed logins are exempt", () => {
  const allowed = ["kinqsradio", "dependabot[bot]"];
  assert.equal(isExempt(pull(1, "a", "MEMBER"), allowed), true);
  assert.equal(isExempt(pull(1, "a", "OWNER"), allowed), true);
  assert.equal(isExempt(pull(1, "some-app[bot]", "NONE", "Bot"), allowed), true);
  assert.equal(isExempt(pull(1, "KinqsRadio", "CONTRIBUTOR"), allowed), true);
  assert.equal(isExempt(pull(1, "dependabot[bot]", "NONE"), allowed), true);
});

test("collaborators and first-time contributors are not exempt", () => {
  const allowed = ["kinqsradio"];
  for (const association of ["COLLABORATOR", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]) {
    assert.equal(isExempt(pull(1, "luannn010", association), allowed), false, association);
  }
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

function fakeStore(initial = [], failures = []) {
  const state = { list: initial, sha: "s0", writes: 0, reads: 0, queue: [...failures], concurrent: [] };
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

test("recordSignature retries on a 422 create race, and stops when the other run signed the same person", async () => {
  const store = fakeStore([], [conflict(422)]);
  store.state.concurrent.push({ github_id: 8 });
  const result = await recordSignature({ ...store, entry: { github_id: 8 }, sleep: noSleep });
  assert.deepEqual(result, { added: false, attempts: 2 });
  assert.equal(store.state.list.length, 1);
});

test("recordSignature gives up after the attempt limit and rethrows other errors at once", async () => {
  const stuck = fakeStore([], [conflict(), conflict(), conflict()]);
  await assert.rejects(recordSignature({ ...stuck, entry: { github_id: 8 }, attempts: 3, sleep: noSleep }), { status: 409 });
  assert.equal(stuck.state.writes, 3);
  const broken = fakeStore([], [Object.assign(new Error("boom"), { status: 500 })]);
  await assert.rejects(recordSignature({ ...broken, entry: { github_id: 8 }, sleep: noSleep }), { status: 500 });
  assert.equal(broken.state.writes, 1);
});
