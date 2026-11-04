/** @jest-environment jsdom */
const fs = require('fs');
const vm = require('vm');

test('browser initialization keeps the legacy initializer distinct and does not recurse', () => {
  const context = {
    document, console: { error() {}, warn() {}, info() {} },
    localStorage, sessionStorage, setTimeout, clearTimeout,
    requestAnimationFrame: callback => callback()
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'), 'utf8'), context);
  expect(context.initSpeedrunKit).not.toBe(context.initAgenticCompanyRequest);
  expect(() => context.initAgenticCompanyRequest()).not.toThrow();
});
