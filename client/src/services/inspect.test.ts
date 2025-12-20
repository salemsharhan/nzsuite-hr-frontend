import { describe, it } from 'vitest';
import { inspectSchema } from './inspectSchema';

describe('Schema Inspection', () => {
  it('should log the table structure', async () => {
    await inspectSchema();
  });
});
