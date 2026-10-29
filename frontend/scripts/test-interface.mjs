import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function loadTypeScript(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { navigationForRole, navigationActive } = await loadTypeScript('../src/components/layout/navigation.ts');
const { canVisit, dashboardPath } = await loadTypeScript('../src/services/access.ts');
const { queryString } = await loadTypeScript('../src/services/query.ts');
const query = new URLSearchParams(queryString({ search: 'தமிழ் اردو & institution', bureau: undefined, institutionId: null, hasOverlap: false, page: 0, status: '' }));
assert.equal(query.has('bureau'), false, 'An unselected Bureau must not become a literal undefined filter');
assert.equal(query.has('institutionId'), false);
assert.equal(query.get('hasOverlap'), 'false', 'Explicit negative filters remain meaningful');
assert.equal(query.get('page'), '0');
assert.equal(query.get('status'), '');
assert.equal(query.get('search'), 'தமிழ் اردو & institution', 'Unicode and reserved characters round-trip');
const roles = ['SYSTEM_ADMIN', 'COMPETENT_AUTHORITY', 'BUREAU_HEAD', 'CASE_OFFICER', 'Institutional User'];
for (const role of roles) {
  const items = navigationForRole(role);
  assert.ok(items.length, `${role} retains its navigation`);
  assert.equal(new Set(items.map(item => item.to)).size, items.length, 'No duplicate destinations');
  for (const item of items) assert.equal(canVisit(role, new URL(item.to, 'http://test.local').pathname), true, `${role} can visit ${item.to}`);
  for (const destination of items) { const url = new URL(destination.to, 'http://test.local'); assert.equal(items.filter(item => navigationActive(item,url.pathname,url.search,url.hash)).length, 1, `${role}: exactly one active sidebar item at ${destination.to}`); }
  if (role !== 'Institutional User') assert.equal(items.find(item => item.key === 'dashboard').to, dashboardPath(role));
  assert.ok(items.some(item => item.key === 'institutions'), 'Universal institution view remains reachable');
  assert.ok(items.some(item => item.key === 'notifications'), 'Notification center remains reachable');
}
assert.deepEqual(navigationForRole('unknown'), [], 'Unknown roles remain denied by default');
assert.ok(!navigationForRole('SYSTEM_ADMIN').some(item => ['cases', 'coordination', 'overlaps'].includes(item.key)));
assert.ok(!navigationForRole('CASE_OFFICER').some(item => ['register', 'assignment', 'permissions'].includes(item.key)));
assert.ok(navigationForRole('BUREAU_HEAD').some(item => item.key === 'assignment'));
const head = navigationForRole('BUREAU_HEAD'), admin = navigationForRole('SYSTEM_ADMIN');
assert.equal(navigationActive(head.find(item => item.key === 'assignment'), '/bureau/dashboard', '?view=unassigned'), true);
assert.equal(navigationActive(head.find(item => item.key === 'dashboard'), '/bureau/dashboard', '?view=unassigned'), false);
assert.equal(navigationActive(admin.find(item => item.key === 'permissions'), '/admin/dashboard', '', '#permissions'), true);
assert.equal(navigationActive(admin.find(item => item.key === 'dashboard'), '/admin/dashboard', '', '#permissions'), false);
assert.equal(navigationActive(admin.find(item => item.key === 'dashboard'), '/admin/dashboard', '', '#main-content'), true, 'Skip link does not lose the dashboard highlight');
assert.equal(navigationActive(head.find(item => item.key === 'cases'), '/cases/authorized-id'), true);
assert.equal(navigationActive(head.find(item => item.key === 'institutions'), '/institutions/authorized-id'), true);
assert.equal(navigationActive(head.find(item => item.key === 'coordination'), '/coordination/authorized-id'), true);
assert.equal(navigationActive(head.find(item => item.key === 'cases'), '/cases-unrelated'), false);
console.log('PASS Interface navigation: all four official roles and institution users, deny-by-default, authorized destinations, assignment query, admin hash sections and nested-page highlights.');
console.log('PASS Complaint query serialization: omitted filters, explicit false/zero, empty values and Unicode search.');
