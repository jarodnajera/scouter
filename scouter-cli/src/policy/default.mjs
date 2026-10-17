export const DEFAULT_POLICY = Object.freeze({
  revision: 'phase0-policy-1', minimumAgeSeconds: 604800, freshnessSeconds: 3600,
  nodeVersion: '24.22.0', npmVersion: '11.19.1', platform: 'win32', arch: 'x64', lockfileVersion: 3,
  projectCategories: Object.freeze(['context', 'graph', 'protections', 'binding']),
  artifactCategories: Object.freeze(['identity', 'release', 'behavior', 'vulnerabilities', 'malware']),
});
