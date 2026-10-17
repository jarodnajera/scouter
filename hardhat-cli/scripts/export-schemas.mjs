import { writeFile } from 'node:fs/promises';
import { evidenceSchema, exceptionsSchema, reportSchema, inspectionSchema, errorSchema } from '../schemas/v1.mjs';
import { preflightSchema } from '../schemas/preflight.mjs';
import { metadataSchema } from '../schemas/metadata.mjs';
import { graphSchema } from '../schemas/graph.mjs';
for (const [name, schema] of Object.entries({ evidence: evidenceSchema, exceptions: exceptionsSchema,
  report: reportSchema, inspection: inspectionSchema, error: errorSchema, preflight: preflightSchema, metadata: metadataSchema, graph: graphSchema })) {
  await writeFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), `${JSON.stringify(schema, null, 2)}\n`);
}
