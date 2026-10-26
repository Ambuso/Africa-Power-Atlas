const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers.cjs');

test('bubble size updates plant paint without rebuilding the style; theme changes still rebuild it', () => {
  let cursor = 0;
  const slots = [];
  let effects = [];
  const changed = (before, after) => !before || before.length !== after.length || after.some((v, i) => v !== before[i]);
  const hooks = {
    useRef(value) {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useState(value) { cursor++; return [value, () => {}]; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) {
        const old = slots[index];
        effects.push(() => {
          old?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
      }
    },
  };
  let styleChanges = 0;
  const paints = [];
  const events = new Map();
  const map = {
    on(event, ...args) { if (args.length === 1) events.set(event, args[0]); },
    once(event, fn) { fn(); },
    addControl() {}, setProjection() {},
    hasImage: () => true, getLayer: () => ({}), getSource: () => undefined,
    setPaintProperty(...args) { paints.push(args); },
    setStyle() { styleChanges++; },
    getCenter: () => ({ lng: 20, lat: 3 }), getZoom: () => 3,
    getPitch: () => 0, getBearing: () => 0, jumpTo() {}, remove() {},
  };
  const mockMapLibre = {
    Map: function () { return map; },
    NavigationControl: function () {}, AttributionControl: function () {}, ScaleControl: function () {},
  };
  const themes = Object.fromEntries(['dark', 'light'].map((key) => [key, { style: { version: 8, sources: {}, layers: [] } }]));
  const styles = loadTypeScript('components/map/mapStyles.ts');
  const jsx = (type, props) => {
    if (props?.ref && props.ref.current === null) props.ref.current = {};
    return { type, props };
  };
  const { default: MapCanvas } = loadTypeScript('components/map/MapCanvas.tsx', {
    setTimeout: (fn) => { fn(); return 0; },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  }, {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'maplibre-gl': mockMapLibre,
    './mapThemes': { MAP_THEMES: themes, isLightTheme: (theme) => theme === 'light' },
    './mapStyles': {
      ...styles, installMapDataLayers() {}, updateSourceData() {},
      applyLayerVisibility() {}, maybeApplyAtmosphere() {},
    },
    'lucide-react': {},
  });
  const props = { theme: 'dark', visibleLayers: {}, viewMode: 'points', bubbleScale: 1 };
  function render(next) {
    cursor = 0;
    effects = [];
    MapCanvas(next);
    effects.forEach((effect) => effect());
  }
  render(props);
  events.get('load')();
  const before = paints.filter(([, property]) => property === 'circle-radius').at(-1)[2];
  render({ ...props, bubbleScale: 2 });
  assert.equal(styleChanges, 0);
  const after = paints.filter(([, property]) => property === 'circle-radius').at(-1)[2];
  assert.notDeepEqual(after, before);
  render({ ...props, bubbleScale: 2, theme: 'light' });
  assert.equal(styleChanges, 1);
});
