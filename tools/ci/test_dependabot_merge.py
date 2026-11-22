import unittest

from dependabot_merge import eligible_update


def metadata(*rows):
    return 'update\n\n---\nupdated-dependencies:\n' + ''.join(
        f'- dependency-name: lib\n  update-type: version-update:semver-{kind}\n  dependency-group: {group}\n'
        for kind, group in rows) + '...\n\nSigned-off-by: dependabot[bot] <support@github.com>'


class DependabotMergeTest(unittest.TestCase):
    def test_every_dependency_must_be_a_regular_minor_or_patch(self):
        self.assertTrue(eligible_update(metadata(('patch', 'web'), ('minor', 'web'))))
        for other in [('major', 'web'), ('patch', 'go-security'), ('unknown', 'web')]:
            self.assertFalse(eligible_update(metadata(('minor', 'web'), other)))
        self.assertFalse(eligible_update(metadata(('patch', 'go')).replace(
            '  update-type: version-update:semver-patch\n', '')))
