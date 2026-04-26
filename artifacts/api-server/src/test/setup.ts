// The real @workspace/db module throws at import time if DATABASE_URL is unset.
// Tests mock @workspace/db at the boundary, but the schema constants are still
// re-exported from the real module — so we need a dummy URL good enough for the
// pg Pool constructor (which lazy-connects) to load without error.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
