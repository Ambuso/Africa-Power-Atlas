import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('pipeline', Path(__file__).resolve().parents[1] / 'scripts/prepare_transition_data.py')
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


class TransitionPipelineTests(unittest.TestCase):
    def test_status_preserves_announcements_and_suspensions(self):
        for source, expected in [('pre-construction', 'planned'), ('Feasibility study', 'planned'), ('Concept', 'planned'), ('FID/Construction', 'construction'), ('Suspended', 'paused'), ('cancelled - inferred 4 y', 'cancelled'), ('operating', 'operating')]:
            self.assertEqual(pipeline.status(source), expected)

    def test_missing_capacity_and_coordinates_are_not_imputed(self):
        for value in ['', '--', 'unknown', None, '10-20']:
            self.assertIsNone(pipeline.number(value))
        self.assertEqual(pipeline.number(0), 0)
        self.assertIsNone(pipeline.geometry(None, 10))
        self.assertIsNone(pipeline.geometry(0, 0))
        self.assertIsNone(pipeline.geometry(181, 10))
        self.assertEqual(pipeline.geometry(36.8, -1.3)['coordinates'], [36.8, -1.3])

    def test_crosswalk_is_african_and_resolves_source_names(self):
        countries = pipeline.country_index()
        self.assertEqual(countries[pipeline.norm('Kenya')][0], 'KEN')
        self.assertEqual(countries[pipeline.norm('Democratic Republic of the Congo')][0], 'COD')
        self.assertNotIn(pipeline.norm('Germany'), countries)

    def test_duplicate_or_negative_snapshots_cannot_publish(self):
        record = pipeline.make_record('hydrogen', '1', 'A source project', ('KEN', 'Kenya'), 'Concept', capacity=10, unit='kt H2/year')
        pipeline.validate([record], 'hydrogen')
        with self.assertRaises(ValueError): pipeline.validate([record, record], 'hydrogen')
        record['properties']['capacity_value'] = -1
        with self.assertRaises(ValueError): pipeline.validate([record], 'hydrogen')
        with self.assertRaises(ValueError): pipeline.validate([], 'hydrogen')


if __name__ == '__main__':
    unittest.main()
