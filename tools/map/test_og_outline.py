import unittest

from og_outline import loops, ring


class OutlineTest(unittest.TestCase):
    def test_ring_snaps_to_the_grid_and_drops_repeats(self):
        self.assertEqual(
            ring([[0.001, 0.0], [0.004, 0.003], [0.02, 0.0], [0.02, 0.02], [0.0, 0.0]]),
            [(0, 0), (1, 0), (1, 1)],
        )

    def test_edges_join_into_closed_loops(self):
        square = [((0, 0), (1, 0)), ((1, 0), (1, 1)), ((0, 1), (1, 1)), ((0, 0), (0, 1))]
        far = [((5, 5), (6, 5)), ((6, 5), (6, 6)), ((5, 5), (6, 6))]
        found = sorted(loops(square + far), key=len)
        self.assertEqual([len(loop) for loop in found], [3, 4])
        self.assertEqual(set(found[1]), {(0, 0), (1, 0), (1, 1), (0, 1)})


if __name__ == "__main__":
    unittest.main()
