const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run each test with isolated module caches and supplied browser/network dependencies.
function loadTypeScript(entry, globals = {}, mocks = {}) {
  const root = path.resolve(__dirname, '..');
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    });
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.endsWith('.css')) return {};
      if (name.startsWith('.') || name.startsWith('@/')) {
        const target = name.startsWith('@/')
          ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        return load(fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx');
      }
      return require(name);
    };
    vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire, console, ...globals }, { filename });
    return module.exports;
  }
  return load(path.resolve(root, entry));
}

module.exports = { loadTypeScript };
