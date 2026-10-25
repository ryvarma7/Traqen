const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const migrations = fs.readFileSync(
  path.join(root, "supabase/schema-migrations.sql"),
  "utf8"
);

for (const file of [schema, migrations]) {
  test(`database security contract is present in ${file === schema ? "schema" : "migrations"}`, () => {
    for (const functionName of [
      "create_learning_track",
      "reschedule_learning_track",
      "set_track_item_status",
      "reorder_track_items",
      "move_track_item_to_phase",
    ]) {
      assert.match(file, new RegExp(`create or replace function public\\.${functionName}\\b`));
    }

    assert.match(file, /grant execute on function public\.create_learning_track/);
    assert.match(file, /revoke all on function public\.create_learning_track\([^;]+\) from public, anon;/s);
    assert.match(file, /track_phases.*track_id.*user_id/s);
    assert.match(file, /track_items.*phase_id.*track_id.*user_id/s);
  });
}
