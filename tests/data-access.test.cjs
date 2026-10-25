const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoader } = require("./helpers/load-ts.cjs");

const loadTs = createLoader();
const { DataAccessError, requireQueryData } = loadTs("lib/supabase/query.ts");

test("requireQueryData returns successful query data", () => {
  assert.deepEqual(
    requireQueryData({ data: { ok: true }, error: null }, "dashboard"),
    { ok: true }
  );
});

test("requireQueryData throws a generic error and does not expose provider details", () => {
  assert.throws(
    () =>
      requireQueryData(
        {
          data: null,
          error: { code: "42501", message: "profiles_internal_email leaked" },
        },
        "profile"
      ),
    (error) => {
      assert.ok(error instanceof DataAccessError);
      assert.equal(error.message, "Unable to load this page.");
      assert.doesNotMatch(error.message, /profiles_internal_email/);
      return true;
    }
  );
});
