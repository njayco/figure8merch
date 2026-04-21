import { runMigrations } from 'stripe-replit-sync';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('Running Stripe migrations...');
runMigrations({ databaseUrl, schema: 'stripe', logger: console })
  .then(() => {
    console.log('Stripe migrations complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err.message);
    process.exit(1);
  });
