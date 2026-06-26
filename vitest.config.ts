import { defineConfig } from 'vitest/config'

// Tests drive the real pipeline against draco/meshopt fixtures, whose decode is slow — under the
// concurrent runner on CI the 5s default times out. One global ceiling beats scattering per-test overrides.
export default defineConfig({
  test: {
    testTimeout: 20000,
  },
})
