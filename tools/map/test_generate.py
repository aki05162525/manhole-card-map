import unittest
from generate import include_polygon, merge_bounds

class GenerationTest(unittest.TestCase):
    def test_remote_islands(self):
        self.assertFalse(include_polygon("13", [[142, 27], [143, 28]]))
        self.assertTrue(include_polygon("13", [[139, 35], [140, 36]]))
        self.assertFalse(include_polygon("46", [[129, 28], [130, 29]]))
    def test_union(self):
        self.assertEqual(merge_bounds([[[1,2],[3,4]], [[0,3],[5,6]]]), [[0,2],[5,6]])

if __name__ == "__main__":
    unittest.main()
