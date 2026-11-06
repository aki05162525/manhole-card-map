"""Explicit Issue76 review gate; never infer approval from a proposed selection.

Hashes bind the review to assessment content, not to irrelevant later prose edits.
They do not establish that the reviewer or underlying evidence is trustworthy;
that remains the independent review required by REVIEW.md.
"""
from location_lifecycle import digest


def approved_ids(outcomes, common, review):
    """Return only the IDs explicitly approved for these exact inputs."""
    if (review.get('status') != 'approved' or
            not isinstance(review.get('reviewer'), str) or not review['reviewer'].strip() or
            not isinstance(review.get('evidence'), list) or not review['evidence'] or
            any(not isinstance(ref, str) or not ref.strip() for ref in review['evidence'])):
        raise ValueError('completed independent review required')
    if (review.get('assessmentSHA256') != digest(outcomes) or
            review.get('commonSHA256') != digest(common)):
        raise ValueError('review inputs changed')
    rows = {row['facilityId']: row for row in outcomes}
    if len(rows) != len(outcomes):
        raise ValueError('duplicate assessed facility')
    selected = review.get('approvedIds')
    if (not isinstance(selected, list) or any(not isinstance(fid, str) for fid in selected) or
            len(set(selected)) != len(selected)):
        raise ValueError('explicit unique approved IDs required')
    for fid in selected:
        row = rows.get(fid)
        if (not row or row['recommendation'] != 'propose' or
                row['positionSuitability']['status'] != 'acceptable'):
            raise ValueError('approval includes an unassessed or held facility: ' + fid)
    return set(selected)
