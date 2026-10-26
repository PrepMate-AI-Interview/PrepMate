/**
 * PREPMATE — VISUAL SNAPSHOTS PERSISTENCE MODULE (WI-COACH-VIDEO-02)
 *
 * Manages client-side storage for interview webcam snapshots per turn.
 * Uses dedicated IndexedDB ("prepmate_visual_snapshots_db") with Blobs.
 * Never uploads images to backend or cloud; fully client-local.
 * Includes in-memory fallback for environments without IndexedDB.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PrepMateVisualSnapshotStore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DB_NAME = "prepmate_visual_snapshots_db";
  const DB_VERSION = 1;
  const STORE_NAME = "turn_snapshots";

  // In-memory fallback if IndexedDB is unavailable
  const _memoryStore = new Map();

  function openDatabase() {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        return resolve(null); // Fallback to memory store
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("sessionId", "sessionId", { unique: false });
            store.createIndex("turnIndex", "turnIndex", { unique: false });
            store.createIndex("capturedAt", "capturedAt", { unique: false });
          }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => {
          console.warn("[VISUAL SNAPSHOTS] IndexedDB open error:", event.target && event.target.error);
          resolve(null);
        };
        request.onblocked = () => {
          console.warn("[VISUAL SNAPSHOTS] IndexedDB blocked");
          resolve(null);
        };
      } catch (err) {
        console.warn("[VISUAL SNAPSHOTS] openDatabase exception:", err);
        resolve(null);
      }
    });
  }

  function makeCompoundKey(sessionId, turnIndex) {
    const sId = String(sessionId || "unknown_session").trim();
    const tIdx = Number.isInteger(Number(turnIndex)) ? Number(turnIndex) : 0;
    return `${sId}_turn_${tIdx}`;
  }

  /**
   * Saves a turn snapshot record.
   * Record schema:
   * {
   *   id: string, // `${sessionId}_turn_${turnIndex}`
   *   sessionId: string,
   *   turnIndex: number,
   *   capturedAt: number,
   *   mimeType: string,
   *   width: number,
   *   height: number,
   *   imageBlob: Blob,
   *   metrics: object
   * }
   */
  async function saveSnapshot(record) {
    if (!record || typeof record !== "object") return false;

    const sessionId = String(record.sessionId || "").trim();
    if (!sessionId) {
      console.warn("[VISUAL SNAPSHOTS] Cannot save snapshot without valid sessionId");
      return false;
    }

    const turnIndex = Number.isInteger(Number(record.turnIndex)) ? Number(record.turnIndex) : 0;
    const compoundId = record.id || makeCompoundKey(sessionId, turnIndex);

    const snapshotDoc = {
      id: compoundId,
      sessionId,
      turnIndex,
      capturedAt: record.capturedAt || Date.now(),
      mimeType: record.mimeType || "image/webp",
      width: Number(record.width) || 0,
      height: Number(record.height) || 0,
      imageBlob: record.imageBlob || null,
      metrics: record.metrics || {}
    };

    try {
      const db = await openDatabase();
      if (!db) {
        _memoryStore.set(compoundId, snapshotDoc);
        return true;
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(snapshotDoc);

          req.onsuccess = () => resolve(true);
          req.onerror = (e) => {
            console.warn("[VISUAL SNAPSHOTS] Put error:", e.target && e.target.error);
            _memoryStore.set(compoundId, snapshotDoc);
            resolve(true); // Soft fallback
          };
          tx.onabort = () => {
            _memoryStore.set(compoundId, snapshotDoc);
            resolve(true);
          };
        } catch (txErr) {
          console.warn("[VISUAL SNAPSHOTS] Transaction error:", txErr);
          _memoryStore.set(compoundId, snapshotDoc);
          resolve(true);
        }
      });
    } catch (err) {
      console.warn("[VISUAL SNAPSHOTS] saveSnapshot error:", err);
      _memoryStore.set(compoundId, snapshotDoc);
      return true;
    }
  }

  /**
   * Retrieves a snapshot for a specific session and turn.
   */
  async function getSnapshot(sessionId, turnIndex) {
    if (!sessionId) return null;
    const compoundId = makeCompoundKey(sessionId, turnIndex);

    try {
      const db = await openDatabase();
      if (!db) {
        return _memoryStore.get(compoundId) || null;
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(compoundId);

          req.onsuccess = () => {
            if (req.result) {
              resolve(req.result);
            } else {
              resolve(_memoryStore.get(compoundId) || null);
            }
          };
          req.onerror = () => resolve(_memoryStore.get(compoundId) || null);
        } catch (e) {
          resolve(_memoryStore.get(compoundId) || null);
        }
      });
    } catch (err) {
      return _memoryStore.get(compoundId) || null;
    }
  }

  /**
   * Retrieves all snapshots belonging to a session, sorted by turnIndex ascending.
   */
  async function getSnapshotsForSession(sessionId) {
    if (!sessionId) return [];
    const sId = String(sessionId).trim();

    try {
      const db = await openDatabase();
      if (!db) {
        const memResults = [];
        for (const [key, val] of _memoryStore.entries()) {
          if (val.sessionId === sId) {
            memResults.push(val);
          }
        }
        return memResults.sort((a, b) => a.turnIndex - b.turnIndex);
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readonly");
          const store = tx.objectStore(STORE_NAME);
          const index = store.index("sessionId");
          const req = index.getAll(IDBKeyRange.only(sId));

          req.onsuccess = () => {
            const results = req.result || [];
            // Merge with any memory entries for this session
            const seenKeys = new Set(results.map((r) => r.id));
            for (const [k, v] of _memoryStore.entries()) {
              if (v.sessionId === sId && !seenKeys.has(k)) {
                results.push(v);
              }
            }
            results.sort((a, b) => a.turnIndex - b.turnIndex);
            resolve(results);
          };

          req.onerror = () => {
            const memFallback = [];
            for (const [key, val] of _memoryStore.entries()) {
              if (val.sessionId === sId) memFallback.push(val);
            }
            resolve(memFallback.sort((a, b) => a.turnIndex - b.turnIndex));
          };
        } catch (e) {
          const memFallback = [];
          for (const [key, val] of _memoryStore.entries()) {
            if (val.sessionId === sId) memFallback.push(val);
          }
          resolve(memFallback.sort((a, b) => a.turnIndex - b.turnIndex));
        }
      });
    } catch (err) {
      const memFallback = [];
      for (const [key, val] of _memoryStore.entries()) {
        if (val.sessionId === sId) memFallback.push(val);
      }
      return memFallback.sort((a, b) => a.turnIndex - b.turnIndex);
    }
  }

  /**
   * Deletes all snapshots for a given session.
   */
  async function deleteSnapshotsForSession(sessionId) {
    if (!sessionId) return 0;
    const sId = String(sessionId).trim();

    // Clean memory store
    for (const [k, v] of _memoryStore.entries()) {
      if (v.sessionId === sId) {
        _memoryStore.delete(k);
      }
    }

    try {
      const db = await openDatabase();
      if (!db) return 0;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const index = store.index("sessionId");
          const req = index.openCursor(IDBKeyRange.only(sId));
          let count = 0;

          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              count++;
              cursor.continue();
            } else {
              resolve(count);
            }
          };
          req.onerror = () => resolve(count);
        } catch (e) {
          resolve(0);
        }
      });
    } catch (err) {
      return 0;
    }
  }

  /**
   * Clears all snapshot records across all sessions (for tests/reset).
   */
  async function clearAllSnapshots() {
    _memoryStore.clear();

    try {
      const db = await openDatabase();
      if (!db) return;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch (e) {
          resolve();
        }
      });
    } catch (err) {}
  }

  /**
   * Helper to capture a thumbnail Blob from a source canvas or video element.
   * Scales proportionally to fit within maxWidth x maxHeight without distortion.
   * Attempts "image/webp" with fallback to "image/jpeg".
   */
  function createThumbnailBlob(sourceCanvas, maxWidth = 320, maxHeight = 240, quality = 0.8) {
    return new Promise((resolve) => {
      if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
        return resolve(null);
      }

      const origW = sourceCanvas.width;
      const origH = sourceCanvas.height;
      const ratio = Math.min(maxWidth / origW, maxHeight / origH, 1.0);
      const targetW = Math.max(1, Math.round(origW * ratio));
      const targetH = Math.max(1, Math.round(origH * ratio));

      const doc = typeof document !== "undefined" ? document : null;
      if (!doc) return resolve(null);

      const thumbCanvas = doc.createElement("canvas");
      thumbCanvas.width = targetW;
      thumbCanvas.height = targetH;
      const ctx = thumbCanvas.getContext("2d");
      if (!ctx) return resolve(null);

      ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);

      // Try image/webp first
      if (typeof thumbCanvas.toBlob === "function") {
        thumbCanvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve({
                blob,
                mimeType: blob.type || "image/webp",
                width: targetW,
                height: targetH,
              });
            } else {
              // Fallback to JPEG
              thumbCanvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob && jpegBlob.size > 0) {
                    resolve({
                      blob: jpegBlob,
                      mimeType: "image/jpeg",
                      width: targetW,
                      height: targetH,
                    });
                  } else {
                    resolve(null);
                  }
                },
                "image/jpeg",
                quality
              );
            }
          },
          "image/webp",
          quality
        );
      } else {
        // In environments without toBlob (some headless node environments)
        resolve(null);
      }
    });
  }

  return {
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    makeCompoundKey,
    openDatabase,
    saveSnapshot,
    getSnapshot,
    getSnapshotsForSession,
    deleteSnapshotsForSession,
    clearAllSnapshots,
    createThumbnailBlob,
    _getMemoryStore: () => _memoryStore,
  };
});
