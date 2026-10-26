/**
 * PREPMATE — TEST B: SESSION ISOLATION & SNAPSHOT RESTORATION
 * Tests Step B requirements:
 *  - Strict session isolation: Session B cannot access Session A's snapshots
 *  - Turn 0 and Turn 1 snapshots never swap or misalign
 *  - Session cleanup deletes only targeted session snapshots
 *  - Unspecified / missing session IDs handled safely
 *  - Corrupted snapshot records do not cause errors
 */

const assert = require("assert");
const snapshotStore = require("../../FE/features/interview/interview-visual-snapshots.js");

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

async function runStepBTests() {
  console.log("===============================================================");
  console.log("   STEP B: SESSION ISOLATION & SNAPSHOT RESTORATION TESTS      ");
  console.log("===============================================================\n");

  await snapshotStore.clearAllSnapshots();

  const sessionA = "session_AAA_111";
  const sessionB = "session_BBB_222";

  const blobA0 = { size: 1000, type: "image/webp", name: "blobA0" };
  const blobA1 = { size: 2000, type: "image/webp", name: "blobA1" };
  const blobB0 = { size: 3000, type: "image/webp", name: "blobB0" };

  // 1. Save snapshots for Session A (turn 0, turn 1) and Session B (turn 0)
  await snapshotStore.saveSnapshot({
    sessionId: sessionA,
    turnIndex: 0,
    width: 320,
    height: 240,
    imageBlob: blobA0,
    metrics: { lightingLevel: "OPTIMAL" },
  });

  await snapshotStore.saveSnapshot({
    sessionId: sessionA,
    turnIndex: 1,
    width: 320,
    height: 240,
    imageBlob: blobA1,
    metrics: { lightingLevel: "UNDEREXPOSED" },
  });

  await snapshotStore.saveSnapshot({
    sessionId: sessionB,
    turnIndex: 0,
    width: 320,
    height: 240,
    imageBlob: blobB0,
    metrics: { lightingLevel: "OVEREXPOSED" },
  });

  // Test 1: Session isolation - Session B cannot see Session A's snapshots
  const snapshotsForB = await snapshotStore.getSnapshotsForSession(sessionB);
  assert.strictEqual(snapshotsForB.length, 1);
  assert.strictEqual(snapshotsForB[0].sessionId, sessionB);
  assert.strictEqual(snapshotsForB[0].imageBlob.name, "blobB0");

  const bLookAtA0 = await snapshotStore.getSnapshot(sessionB, 1);
  assert.strictEqual(bLookAtA0, null, "Session B must not see Turn 1 from Session A");
  pass("1. Session A and Session B snapshots strictly isolated");

  // Test 2: Turn 0 and Turn 1 do not swap
  const snapshotsForA = await snapshotStore.getSnapshotsForSession(sessionA);
  assert.strictEqual(snapshotsForA.length, 2);
  assert.strictEqual(snapshotsForA[0].turnIndex, 0);
  assert.strictEqual(snapshotsForA[0].imageBlob.name, "blobA0");
  assert.strictEqual(snapshotsForA[1].turnIndex, 1);
  assert.strictEqual(snapshotsForA[1].imageBlob.name, "blobA1");
  pass("2. Turn 0 and Turn 1 maintain strict chronological ordering");

  // Test 3: Session deletion removes only targeted session
  await snapshotStore.deleteSnapshotsForSession(sessionA);
  const remainingA = await snapshotStore.getSnapshotsForSession(sessionA);
  const remainingB = await snapshotStore.getSnapshotsForSession(sessionB);
  assert.strictEqual(remainingA.length, 0, "Session A snapshots must be deleted");
  assert.strictEqual(remainingB.length, 1, "Session B snapshots must remain completely intact");
  assert.strictEqual(remainingB[0].sessionId, sessionB);
  pass("3. Session cleanup deletes only targeted session data");

  // Test 4: Missing or invalid session IDs handled defensively
  const nullSessSnapshots = await snapshotStore.getSnapshotsForSession(null);
  assert.deepStrictEqual(nullSessSnapshots, []);
  const saveInvalid = await snapshotStore.saveSnapshot({ sessionId: "", turnIndex: 0 });
  assert.strictEqual(saveInvalid, false, "Saving with empty sessionId must safely return false");
  pass("4. Missing or invalid session IDs handled safely without exceptions");

  // Test 5: Corrupted snapshot record recovery
  await snapshotStore.saveSnapshot({
    sessionId: "corrupted_sess",
    turnIndex: 0,
    width: 320,
    height: 240,
    imageBlob: null, // Corrupted / missing blob
    metrics: {},
  });
  const corruptRecord = await snapshotStore.getSnapshot("corrupted_sess", 0);
  assert.ok(corruptRecord, "Corrupted record retrieved safely");
  assert.strictEqual(corruptRecord.imageBlob, null);
  pass("5. Corrupted snapshot record handled without breaking retrieval");

  console.log("\nALL STEP B TESTS PASSED SUCCESSFULLY.\n");
}

if (require.main === module) {
  runStepBTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}
