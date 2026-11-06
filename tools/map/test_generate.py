import unittest
from generate import include_polygon, merge_bounds

class GenerationTest(unittest.TestCase):
    def test_remote_islands(self):
        self.assertFalse(include_polygon("13", [[142, 27], [143, 28]]))
        self.assertTrue(include_polygon("13", [[139, 35], [140, 36]]))
        self.assertFalse(include_polygon("46", [[129, 28], [130, 29]]))
    def test_union(self):
        self.assertEqual(merge_bounds([[[1,2],[3,4]], [[0,3],[5,6]]]), [[0,2],[5,6]])


class BorderTest(unittest.TestCase):
    def test_shared_segments_exclude_coast_and_municipal_edges(self):
        from generate import shared_border_lines
        a = [[139,35],[140,35],[140,35.5],[140,36],[139,36],[139,35]]
        b = [[140,35],[141,35],[141,36],[140,36],[140,35.5],[140,35]]
        lines = shared_border_lines([('08',[a]),('09',[b])], 750)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]['properties'], {'p':['08','09']})
        self.assertEqual(lines[0]['geometry']['coordinates'], [[140,35],[140,36]])
        self.assertEqual(shared_border_lines([('08',[a]),('08',[b])],750), [])

    def test_simplification_keeps_shared_endpoints_and_pair(self):
        from generate import shared_border_lines, area_for_code
        a = [[139,35],[140,35],[140.001,35.5],[140,36],[139,36],[139,35]]
        b = [[140,35],[141,35],[141,36],[140,36],[140.001,35.5],[140,35]]
        lines = shared_border_lines([('09',[b]),('08',[a])],750)
        self.assertEqual(lines[0]['properties']['p'], ['08','09'])
        self.assertEqual(lines[0]['geometry']['coordinates'], [[140,35],[140,36]])
        self.assertEqual(area_for_code('08'), area_for_code('09'))
        self.assertNotEqual(area_for_code('07'), area_for_code('08'))

    def test_hole_and_closed_enclave_are_not_lost(self):
        from generate import shared_border_lines
        hole = [[139,35],[139.001,35],[139.001,35.001],[139,35.001],[139,35]]
        outside = [[138,34],[140,34],[140,36],[138,36],[138,34]]
        lines = shared_border_lines([('08',[outside,hole]),('09',[hole[::-1]])],750)
        self.assertEqual(len(lines),1)
        self.assertEqual(len(lines[0]['geometry']['coordinates']),5)
        self.assertEqual(lines[0]['properties']['p'],['08','09'])


class BorderPrecisionTest(unittest.TestCase):
    def test_binary_float_noise_does_not_split_a_shared_border(self):
        from generate import shared_border_lines
        a = [[139,35],[140,35],[140,36],[139,36],[139,35]]
        b = [[140.00000000000003,35],[141,35],[141,36],[140.00000000000003,36],[140.00000000000003,35]]
        lines = shared_border_lines([('08',[a]),('09',[b])],750)
        self.assertEqual(len(lines),1)

    def test_real_separation_is_not_treated_as_shared(self):
        from generate import shared_border_lines
        a = [[139,35],[140,35],[140,36],[139,36],[139,35]]
        b = [[140.00001,35],[141,35],[141,36],[140.00001,36],[140.00001,35]]
        self.assertEqual(shared_border_lines([('08',[a]),('09',[b])],750), [])

if __name__ == "__main__":
    unittest.main()
