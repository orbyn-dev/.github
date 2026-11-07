// Tests the matcher inside .github/workflows/licence-grant.yml. It reads the block between
// the matcher:start and matcher:end comments straight from the workflow, so there is only
// one copy of the code. Run with `node --test scripts/*.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/licence-grant.yml", import.meta.url), "utf8");
const block = workflow.match(/\/\/ matcher:start\n([\s\S]*?)\/\/ matcher:end/)[1];
const { SENTENCE, grants, isExempt } = new Function(`${block}\nreturn { SENTENCE, grants, isExempt };`)();

const pull = (login, association, type = "User") => ({ user: { login, type }, author_association: association });

test("the exact sentence counts", () => {
  assert.equal(grants(SENTENCE), true);
});

test("a quoted, code-fenced or reflowed copy still counts", () => {
  assert.equal(grants(`> ${SENTENCE}`), true);
  assert.equal(grants("```\n" + SENTENCE + "\n```"), true);
  assert.equal(grants(SENTENCE.replace("worldwide licence", "worldwide\nlicence")), true);
  assert.equal(grants(`Sure!\n\n"${SENTENCE}"`), true);
});

test("a changed or partial sentence does not count", () => {
  assert.equal(grants(SENTENCE.replace("irrevocable", "revocable")), false);
  assert.equal(grants(SENTENCE.slice(0, 60)), false);
  assert.equal(grants(SENTENCE.replace("Anh Dang", "someone")), false);
  assert.equal(grants(""), false);
  assert.equal(grants(undefined), false);
});

test("organisation members, listed logins and bots are exempt", () => {
  assert.equal(isExempt(pull("someone", "MEMBER"), []), true);
  assert.equal(isExempt(pull("someone", "OWNER"), []), true);
  assert.equal(isExempt(pull("dependabot[bot]", "NONE", "Bot"), []), true);
  assert.equal(isExempt(pull("KinqsRadio", "CONTRIBUTOR"), ["kinqsradio"]), true);
});

test("outside collaborators and first-time contributors are not exempt", () => {
  assert.equal(isExempt(pull("luannn010", "COLLABORATOR"), ["kinqsradio"]), false);
  assert.equal(isExempt(pull("newcomer", "FIRST_TIME_CONTRIBUTOR"), ["kinqsradio"]), false);
  assert.equal(isExempt(pull("someone", "NONE"), ["kinqsradio"]), false);
});
