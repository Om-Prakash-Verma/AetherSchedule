import 'dotenv/config';
import { seedDatabaseIfEmpty } from '../api/server';
// FIX: Explicitly import `exit` from the 'process' module to resolve TypeScript errors
// where the global `process` object type is not recognized.
import { exit } from 'process';

const runSeed = async () => {
    console.log('[seed] Starting database seed process...');
    try {
        await seedDatabaseIfEmpty();
        console.log('[seed] Seed script finished successfully.');
        exit(0); // Explicitly exit with a success code
    } catch (error) {
        // The error is already logged by the seedDatabaseIfEmpty function.
        // We just need to ensure the process exits with a failure code.
        console.error('[seed] Seed script failed.');
        exit(1); // Explicitly exit with a failure code
    }
};

runSeed();
