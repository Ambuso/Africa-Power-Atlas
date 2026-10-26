import importlib.util
import math
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('site_index', Path(__file__).resolve().parents[1] / 'scripts/build_site_check_index.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class IndexTests(unittest.TestCase):
    def test_route_cap_covers_segment_interiors(self):
        geometry = {'type': 'LineString', 'coordinates': [[-10, 65], [10, 65], [20, 20]]}
        cap = module.cap(geometry)
        centre = module.vector(cap['centre'])
        for a, b in zip(geometry['coordinates'], geometry['coordinates'][1:]):
            av, bv = module.vector(a), module.vector(b)
            for step in range(101):
                t = step / 100
                v = [(1-t)*x+t*y for x, y in zip(av,bv)]
                length = math.sqrt(sum(x*x for x in v))
                point = [x/length for x in v]
                self.assertLessEqual(module.angular(centre, point)*module.R, cap['radiusKm'])
    def test_invalid_capacity_remains_unknown(self):
        self.assertIsNone(module.numeric(None))
        self.assertIsNone(module.numeric(''))
        self.assertIsNone(module.numeric('nan'))
        self.assertEqual(module.numeric(0),0)
    def test_antipodal_route_is_rejected(self):
        with self.assertRaises(ValueError): module.cap({'type':'LineString','coordinates':[[0,0],[180,0]]})

if __name__ == '__main__': unittest.main()
