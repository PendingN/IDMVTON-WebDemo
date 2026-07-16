import assert from "node:assert/strict";

import {
  computeBoundedExportSize,
  computeContainedImageRect,
} from "./static/js/mask_geometry.mjs";

assert.deepEqual(computeContainedImageRect(600, 600, 3, 4), {
  left: 75,
  top: 0,
  width: 450,
  height: 600,
});
assert.deepEqual(computeContainedImageRect(600, 600, 16, 9), {
  left: 0,
  top: 131.25,
  width: 600,
  height: 337.5,
});
assert.deepEqual(computeContainedImageRect(600, 400, 1, 1), {
  left: 100,
  top: 0,
  width: 400,
  height: 400,
});

assert.deepEqual(computeBoundedExportSize(768, 1024), { width: 768, height: 1024 });
assert.deepEqual(computeBoundedExportSize(1600, 900), { width: 1024, height: 576 });
assert.deepEqual(computeBoundedExportSize(2048, 2048), { width: 1024, height: 1024 });

console.log("mask geometry self-check passed");
