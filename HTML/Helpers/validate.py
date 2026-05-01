#!/usr/bin/env python3
"""
validate.py — two-layer validation of stitched Office Day Tracker output.

Two independent layers:

  Layer 1 — Health check
    Runs stitch.py --theme Default --data {View} for each full-data view and
    scans the output for [missing: data.X] placeholders. Any placeholder means
    a data tag path in a component is unresolved (mis-typed or missing from
    TestData). Fatal and Unauth are skipped — their TestData is intentionally
    minimal and the unused cards are expected to produce placeholders.

  Layer 2 — Structural spot checks
    Asserts that specific TestData values appear inside the correct HTML
    elements in the stitch output. Catches the "right field, wrong slot" class
    of bug that Layer 1 cannot see. One or two checks per card — enough to
    verify structural intent without becoming a maintenance burden.

Pipeline:
  stitch.py  →  assembles HTML, resolves tags, writes _preview_*.html
  validate.py →  calls stitch, reads output, runs both layers

Usage:
  python validate.py                    run all views, both layers
  python validate.py --view Office      run only the Office view
  python validate.py --layer 1          run only Layer 1 (health checks)
  python validate.py --layer 2          run only Layer 2 (spot checks)
  python validate.py --verbose          show unresolved tag details and
                                        failing spot-check patterns
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

HERE       = Path(__file__).parent
OUTPUT_DIR = HERE.parent / 'HTML_StitchOutput'
STITCH     = HERE / 'stitch.py'

# Views with full TestData — Layer 1 expects zero [missing:] placeholders.
FULL_VIEWS    = ['Office', 'Home', 'Weekend', 'Logged']
# Minimal TestData — [missing:] placeholders are expected for unused cards.
MINIMAL_VIEWS = ['Fatal', 'Unauth']
ALL_VIEWS     = FULL_VIEWS + MINIMAL_VIEWS


# ---------------------------------------------------------------------------
# Layer 2 spot checks
# Each entry: (label, view, regex_pattern)
# Pattern verifies a TestData value appears inside the correct HTML element.
# re.DOTALL is used so patterns can span tag boundaries on the same logical line.
# ---------------------------------------------------------------------------
SPOT_CHECKS = [
    # TitleCard — status class matches value, statusLabel in badge, weekNumber in header
    ('TitleCard  status-badge class + label (Office)', 'Office', r'status-badge office">Office Day<'),
    ('TitleCard  status-badge class + label (Home)',   'Home',   r'status-badge home">Home Day<'),
    ('TitleCard  weekNumber in header-ww',             'Office', r'header-ww">WW16<'),

    # RingsCard — avg values inside the correct ring-center slots
    ('RingsCard  weekAvg in ring1 center',    'Office', r'color:var\(--ring1\)">2\.4<'),
    ('RingsCard  monthAvg in ring2 center',   'Office', r'color:var\(--ring2\)">2\.8<'),
    ('RingsCard  yearAvg in ring3 center',    'Office', r'color:var\(--ring3\)">2\.1<'),
    ('RingsCard  rawAverage in absence-stat', 'Office', r'absence-stat[^<]*<strong>2\.1<'),
    ('RingsCard  projection: avg + days',     'Office', r'2\.4 days/week.{0,60}15/22'),

    # DaysCard — pill counts differ between Office (thisWeek=1) and Home (thisWeek=0)
    ('DaysCard   thisWeek in pill (Office)',  'Office', r'day-pill-count">1<'),
    ('DaysCard   thisWeek in pill (Home)',    'Home',   r'day-pill-count">0<'),
    ('DaysCard   current WW pill label',     'Office', r'day-pill-ww">WW 16<'),
    ('DaysCard   next WW pill label',        'Office', r'day-pill-ww">WW 17<'),
    ('DaysCard   projection sentence',       'Office', r'3\.3 days/week.{0,40}2 months.{0,40}3-day/week'),

    # CalendarCard — monthLabel inside cal-title
    ('CalendarCard  monthLabel (Office)', 'Office', r'cal-title">April 2026<'),
    ('CalendarCard  monthLabel (Home)',   'Home',   r'cal-title">April 2026<'),

    # ChartsBestWorst — labels and values inside correct bw-pair elements
    ('ChartsBestWorst  best weekday label',  'Office', r'month-stat">Wednesday<'),
    ('ChartsBestWorst  best weekday value',  'Office', r'color:var\(--accent\)">31<'),
    ('ChartsBestWorst  worst weekday label', 'Office', r'month-stat">Tuesday<'),
    ('ChartsBestWorst  best week label',     'Office', r'month-stat">WW5 \(2/Feb\)<'),
    ('ChartsBestWorst  worst week label',    'Office', r'month-stat">WW51 \(15/Dec/25\)<'),
    ('ChartsBestWorst  best month label',    'Office', r'month-stat">Mar<'),
    ('ChartsBestWorst  worst month label',   'Office', r'month-stat">Dec/25<'),

    # FatalErrorCard — errorMessage resolved from TestDataFatal
    ('FatalErrorCard  errorMessage resolved', 'Fatal', r'error-msg[^>]*>[^<]*Could not load spreadsheet'),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_stitch(view):
    """Run stitch for one view. Returns (html_text, stderr_text, exit_ok)."""
    result = subprocess.run(
        [sys.executable, str(STITCH), '--theme', 'Default', '--data', view],
        capture_output=True, text=True,
    )
    path = OUTPUT_DIR / f'_preview_default_{view.lower()}.html'
    if not path.exists():
        return None, result.stderr, False
    return path.read_text(encoding='utf-8'), result.stderr, result.returncode == 0


def _build_cache(views):
    """Run stitch for each view once, return {view: html}."""
    cache = {}
    for view in views:
        html, stderr, ok = _run_stitch(view)
        cache[view] = html or ''
        if not ok and html is None:
            print(f'  ERROR  stitch failed for {view}:\n{stderr[:300]}', file=sys.stderr)
    return cache


# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------

def run_layer1(views, cache, verbose=False):
    """Health check — no [missing: data.X] in full-data view output."""
    all_ok = True
    for view in views:
        if view in MINIMAL_VIEWS:
            print(f'  SKIP   L1  [{view}] minimal TestData')
            continue
        html = cache.get(view, '')
        if not html:
            print(f'  FAIL   L1  [{view}] no stitch output')
            all_ok = False
            continue
        missing = re.findall(r'\[missing: ([^\]]+)\]', html)
        if missing:
            print(f'  FAIL   L1  [{view}] {len(missing)} unresolved tag(s):')
            for m in sorted(set(missing)):
                print(f'               data.{m}')
            all_ok = False
        else:
            print(f'  OK     L1  [{view}] no unresolved tags')
    return all_ok


# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------

def run_layer2(views, cache, verbose=False):
    """Structural spot checks — values inside correct HTML elements."""
    all_ok = True
    for label, view, pattern in SPOT_CHECKS:
        if view not in views:
            continue
        html = cache.get(view, '')
        ok = bool(re.search(pattern, html, re.DOTALL))
        tag = 'OK  ' if ok else 'FAIL'
        print(f'  {tag}   L2  [{view}] {label}')
        if not ok:
            all_ok = False
            if verbose:
                print(f'               pattern: {pattern}')
    return all_ok


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog='validate.py',
        description=(
            'Two-layer validation of stitched Office Day Tracker output.\n\n'
            'Layer 1 — Health:    no [missing: data.X] placeholders in output.\n'
            'Layer 2 — Structure: key TestData values land in correct HTML slots.'
        ),
        epilog=(
            'Views:   Office, Home, Weekend, Logged (full data)\n'
            '         Fatal, Unauth (minimal data - Layer 1 skipped)\n\n'
            'Exit:    0 = all checks passed   1 = one or more checks failed\n\n'
            'Tip: run stitch.py --data Office first to regenerate previews,\n'
            '     then validate.py to check them - or just run validate.py\n'
            '     and it calls stitch automatically.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--view',
        choices=ALL_VIEWS,
        metavar='VIEW',
        help=f'Validate only one view. Choices: {", ".join(ALL_VIEWS)}.',
    )
    parser.add_argument(
        '--layer',
        choices=['1', '2'],
        metavar='N',
        help='Run only layer 1 (health) or layer 2 (spot checks). Default: both.',
    )
    parser.add_argument(
        '--verbose', action='store_true',
        help='On failure show unresolved tag names and failing regex patterns.',
    )
    args = parser.parse_args()

    views = [args.view] if args.view else ALL_VIEWS
    run_l1 = args.layer in (None, '1')
    run_l2 = args.layer in (None, '2')

    print(f'Running stitch for: {", ".join(views)} ...')
    cache = _build_cache(views)
    print()

    all_ok = True

    if run_l1:
        print('--- Layer 1: health checks ---')
        all_ok = run_layer1(views, cache, verbose=args.verbose) and all_ok
        print()

    if run_l2:
        print('--- Layer 2: structural spot checks ---')
        all_ok = run_layer2(views, cache, verbose=args.verbose) and all_ok
        print()

    print('All checks passed.' if all_ok else 'Checks failed — review above.')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
