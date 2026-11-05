"""Export a compact classification snapshot without changing selection decisions.

Extracted from Issue24's historical reproduction snippet. Input ordering, path
spelling and raw source bytes remain part of its byte-for-byte output contract.
"""
import argparse
import json, hashlib
from pathlib import Path

def export(source, decisions):
    report = json.loads(source.read_text())
    selection = json.loads(decisions.read_text())
    decision_rows = selection['rows']
    selected = {row['facilityId']: row for row in decision_rows}
    facilities = report['facilities']
    ids = [row['facilityId'] for row in facilities]
    if (len(set(ids)) != len(ids) or len(selected) != len(decision_rows)
            or set(ids) != set(selected)):
        raise ValueError('classification and selection IDs must match exactly without duplicates')
    rows = []
    for rank, facility in enumerate(facilities, 1):
        investigation = facility['investigation']
        hold = facility['hold']
        decision = selected[facility['facilityId']]
        rows.append(dict(
            facilityId=facility['facilityId'], automaticRank=rank,
            priority=facility['priority'], distribution=facility['distribution'],
            firstPinCardIds=facility['firstPinCardIds'],
            originalRef=facility['provenance'].get('original', {}).get('ref'),
            reviewRefs=[row['ref'] for row in investigation['reviews']],
            blockers=investigation['blockers'], normalizedStage=investigation['stage'],
            currentStage=facility['currentInvestigationStage'],
            holdRef=hold['outcomeRef'] if hold else None,
            stopCondition=hold['stopCondition'] if hold else investigation['stopCondition'],
            resumeCondition=hold['resumeCondition'] if hold else investigation['resumeCondition'],
            sharedGroupIds=facility['sharedGroupIds'], selection=decision['selection'],
            selectionReason=decision['reason'], reevaluateWhen=decision['reevaluateWhen']))
    return dict(schema=1, asOf=report['dates']['asOf'], source=str(source),
                sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
                definitions=report['definitions'], summary=report['summary'],
                inputSHA256=report['inputSHA256'],
                sharedInvestigationCandidates=report['sharedInvestigationCandidates'], rows=rows)



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--decisions', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = export(args.source, args.decisions)
        with args.out.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f'Priority snapshot export failed: {error}\n')


if __name__ == '__main__':
    main()
