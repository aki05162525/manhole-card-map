import unittest

from national_outline import NORTH, WEST, path, project


class NationalOutlineTest(unittest.TestCase):
    def test_projects_from_the_corner_with_mercator_stretching_the_north(self):
        self.assertEqual(project(WEST, NORTH), (0, 0))
        self.assertEqual(project(WEST + 1, NORTH)[0], 100)
        high = project(WEST, 45)[1] - project(WEST, 46)[1]
        low = project(WEST, 26)[1] - project(WEST, 27)[1]
        self.assertGreater(high, low)
        self.assertGreater(low, 100)

    def test_writes_each_loop_as_relative_steps_and_drops_collapsed_ones(self):
        square = [(WEST + 1, NORTH), (WEST + 2, NORTH), (WEST + 2, NORTH), (WEST + 1, NORTH - 1), (WEST + 1, NORTH)]
        speck = [(WEST, NORTH), (WEST + 0.001, NORTH), (WEST, NORTH - 0.001)]
        down = project(WEST, NORTH - 1)[1]
        self.assertEqual(path([square, speck]), f"M100 0l100 0l-100 {down}z")


if __name__ == "__main__":
    unittest.main()
