// Adapted from tester-army/e2e examples/with-expo (Apache-2.0), see ../UPSTREAM.md.
// Changes: web target, agent model and AI Gateway removed (the tests here have no AI steps).
import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';

// The bundle id and package name from app.json. The CI jobs build and install
// the app first; the tests open whatever is installed under this id.
const app = { bundleId: 'dev.e2e.examples.expo' };

export default {
  targets: [
    { name: 'ios', engine: mobile({ platform: 'ios' }), app },
    { name: 'android', engine: mobile({ platform: 'android' }), app },
  ],
  workers: 1,
} satisfies E2EConfig;
