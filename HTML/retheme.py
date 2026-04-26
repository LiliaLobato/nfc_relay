#!/usr/bin/env python3
"""
retheme.py — generate 4 themed variants of ui_preview.html

Strategy (middle-ground):
  - ui_preview.html (master) stays as-is with Default colors and is directly openable.
  - This script generates all 4 output files by splicing theme blocks into the master.
    Default: master's own <style id="theme"> block (just retitled).
    Others: :root + body.dark read from canonical source files in HTML_V1/,
            merged over master's supplementary vars (ring, chart, ytd), then rebuilt.

Sources (read-only):  HTML_V1/ui_preview*.html  (master + original palettes)
Outputs (overwrite):  HTML/ui_preview_*.html    (same directory as this script)

Usage:
  python retheme.py
"""
import argparse
import re
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────
HERE     = Path(__file__).parent          # nfc_relay/HTML/
PALETTES = HERE / "HTML_V1"              # read-only palette sources
MASTER   = PALETTES / "ui_preview.html"

# Sources are read from PALETTES (never overwritten); outputs go to HERE
VARIANTS = {
    "default":     (MASTER,                                    "Office Day Tracker — Default"),
    "soft_purple": (PALETTES / "ui_preview_soft_purple.html", "Office Day Tracker — Soft Purple"),
    "matcha":      (PALETTES / "ui_preview_matcha.html",      "Office Day Tracker — Matcha"),
    "gummy":       (PALETTES / "ui_preview_gummy.html",       "Office Day Tracker — Gummy"),
}
OUTPUT = {k: HERE / f"ui_preview_{k}.html" for k in VARIANTS}

# ── CSS helpers ────────────────────────────────────────────────────────────
def extract_block_inner(css, selector):
    """Return inner content of the first `selector { ... }` in css, or ''."""
    pat = re.compile(re.escape(selector) + r'\s*\{([^}]*)\}', re.DOTALL)
    m = pat.search(css)
    return m.group(1) if m else ''


def parse_vars(inner):
    """Parse CSS custom property declarations → {name: value} (values pre-stripped)."""
    return {k: v.strip() for k, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', inner)}


def rebuild_inner(master_inner, overrides):
    """Rebuild a CSS block inner string using master formatting but variant values.

    For each --prop in master_inner, replaces its value with overrides[prop] if present,
    otherwise keeps the master value. Preserves the original colon-gap for alignment.
    Any props in overrides not in master are appended at the end under a comment.
    """
    def sub(m):
        prop, gap, val = m.group(1), m.group(2), m.group(3)
        # Preserve the original spacing between prop: and value for alignment
        return f'{prop}{gap}{overrides.get(prop, val.strip())};'
    result = re.sub(r'(--[\w-]+)(\s*:\s*)([^;]+);', sub, master_inner)
    # Append vars present in variant but absent from master
    master_vars = parse_vars(master_inner)
    extras = [f'      {p}: {v};' for p, v in overrides.items() if p not in master_vars]
    if extras:
        result = result.rstrip() + '\n      /* theme extras */\n' + '\n'.join(extras)
    return result


def hex_to_rgba(hex_str, alpha=0.9):
    """Convert CSS hex colour to rgba(R,G,B,alpha). Handles #RGB, #RGBA, #RRGGBB, #RRGGBBAA."""
    h = hex_str.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)           # #RGB  → #RRGGBB
    elif len(h) == 4:
        h = ''.join(c * 2 for c in h[:3])        # #RGBA → use RGB, drop A
    elif len(h) == 8:
        h = h[:6]                                  # #RRGGBBAA → use RRGGBB, drop AA
    elif len(h) != 6:
        raise ValueError(f'Unrecognised hex colour: {hex_str!r}')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f'rgba({r},{g},{b},{alpha})'


def extract_stripe(css, day_type):
    """Parse body.dark .cal-day.{day_type} → (c1, c2, text_color) or None."""
    inner = extract_block_inner(css, f'body.dark .cal-day.{day_type}')
    if not inner:
        return None
    grad = re.search(
        r'(#[0-9a-fA-F]{3,8})\s+0px.*?(#[0-9a-fA-F]{3,8})\s+4px,\s*\2\s+8px',
        inner, re.DOTALL
    )
    txt = re.search(r'color:\s*(#[0-9a-fA-F]{3,8})', inner)
    if not grad:
        return None
    return grad.group(1), grad.group(2), (txt.group(1) if txt else '#ffffff')


def derive_ytd_vars(root_vars, dark_vars, stripes):
    """Derive --ytd-* and --ytd-dark-* CSS vars from a variant's palette.

    Light ytd colors: converts each --*-bg hex to rgba at 0.9 opacity.
    Dark ytd solids:  takes --office-bg / --home-bg from dark_vars directly.
    Dark ytd stripes: reads c1/c2 from the pre-cached stripes dict (same stops as cal-day).
    Returns a dict ready to be merged into variant_root_vars before rebuild_inner.
    """
    ytd = {}
    # Light ytd: variant's status bg at 0.9 opacity
    for key, bg_var in (('office', '--office-bg'), ('home', '--home-bg'),
                        ('vacation', '--vacation-bg'), ('holiday', '--holiday-bg'),
                        ('oncall', '--oncall-bg')):
        val = root_vars.get(bg_var, '')
        if val.startswith('#'):
            ytd[f'--ytd-{key}'] = hex_to_rgba(val)
    # Dark ytd solid fills
    for key, bg_var in (('office', '--office-bg'), ('home', '--home-bg')):
        val = dark_vars.get(bg_var, '')
        if val.startswith('#'):
            ytd[f'--ytd-dark-{key}'] = val
    # Dark ytd stripe stop colours (same stops as cal-day stripes)
    for dtype, ytd_key in (('vacation', 'vacation'), ('holiday', 'holiday'), ('oncalloff', 'oncall')):
        s = stripes.get(dtype)
        if s:
            c1, c2, _ = s
            ytd[f'--ytd-dark-{ytd_key}-1'] = c1
            ytd[f'--ytd-dark-{ytd_key}-2'] = c2
    return ytd


def build_stripe_rules(stripes):
    """Build all body.dark stripe CSS rules for vacation/holiday/oncalloff.

    Each day type produces 4 rules (cal-day, legend-dot, ytd-item, hm-cell) sharing
    the same repeating-linear-gradient. Skips silently if a stripe entry is None.
    Returns a single string of CSS rules ready to splice into the theme block.
    """
    specs = [
        ('vacation',  'd-vacation', 'vacation-ytd'),
        ('holiday',   'd-holiday',  'holiday-ytd'),
        ('oncalloff', 'd-oncall',   'oncall-ytd'),
    ]
    lines = []
    for dtype, dot_cls, ytd_cls in specs:
        s = stripes.get(dtype)
        if not s:
            continue
        c1, c2, txt = s
        grad = f'repeating-linear-gradient(45deg, {c1} 0px, {c1} 4px, {c2} 4px, {c2} 8px)'
        lines.append(f'    body.dark .cal-day.{dtype:<9} {{ background: {grad}; color: {txt}; }}')
        lines.append(f'    body.dark .legend-dot.{dot_cls:<11} {{ background: {grad} !important; }}')
        lines.append(f'    body.dark .ytd-item.{ytd_cls:<12} {{ background: {grad} !important; }}')
        lines.append(f'    body.dark .hm-cell.{dtype:<9} {{ background: {grad}; }}')
    return '\n'.join(lines)


def extract_theme_extras(css):
    """Extract body.dark .selector rules not handled elsewhere (e.g. ring-center overrides)."""
    skip_pats = [
        r'\.cal-day\.', r'\.legend-dot\.', r'\.ytd-item\.',
        r'\.hm-cell\.', r'\.card\b', r'\.error-card\b',
    ]
    rules = re.findall(r'(body\.dark\s+\.[^{]+\{[^}]*\})', css, re.DOTALL)
    extras = []
    for rule in rules:
        if not any(re.search(p, rule) for p in skip_pats):
            extras.append('    ' + re.sub(r'\s+', ' ', rule.strip()))
    return '\n'.join(extras)


def extract_master_static(theme_inner):
    """Extract theme-invariant rules (.recommendation, .error-title, .cal-day.today.*)."""
    m = re.search(r'(\s+\.recommendation\b.*)', theme_inner, re.DOTALL)
    return m.group(1).rstrip() if m else ''


def get_master_theme_inner(master_html):
    """Extract content between <style id="theme"> and </style>."""
    m = re.search(r'<style id="theme">(.*?)</style>', master_html, re.DOTALL)
    return m.group(1) if m else ''


# ── Theme block builder ────────────────────────────────────────────────────
def build_variant_theme(key, variant_css, master_root_inner, master_dark_inner, master_static):
    """Assemble a full <style id="theme"> inner block for a variant.

    Merges variant palette vars over master's :root and body.dark (preserving master's
    supplementary vars: ring, chart, ytd). Derives ytd chart colors from the palette.
    Appends stripe rules, card/error-msg overrides, theme-specific extras, and the
    master's static (theme-invariant) rules.

    Returns (theme_inner: str, n_stripes: int, n_extras: int).
    Prints WARN lines to stdout if key blocks or stripe rules are missing.
    """
    variant_root_inner = extract_block_inner(variant_css, ':root')
    variant_root_vars  = parse_vars(variant_root_inner)
    variant_dark_inner = extract_block_inner(variant_css, 'body.dark')
    variant_dark_vars  = parse_vars(variant_dark_inner)

    # Warn on missing blocks — variant will silently inherit Default colors otherwise
    if not variant_root_inner.strip():
        print(f'  WARN  [{key}] :root block not found — will use Default colors')
    if not variant_dark_inner.strip():
        print(f'  WARN  [{key}] body.dark block not found — dark mode will use Default colors')

    # Extract stripes once; share between derive_ytd_vars and build_stripe_rules
    stripes = {dt: extract_stripe(variant_css, dt) for dt in ('vacation', 'holiday', 'oncalloff')}
    missing_stripes = [dt for dt, s in stripes.items() if s is None]
    if missing_stripes:
        print(f'  WARN  [{key}] stripe rules missing for: {", ".join(missing_stripes)}')

    ytd_vars = derive_ytd_vars(variant_root_vars, variant_dark_vars, stripes)
    variant_root_vars.update(ytd_vars)

    new_root_inner = rebuild_inner(master_root_inner, variant_root_vars)
    new_dark_inner = rebuild_inner(master_dark_inner, variant_dark_vars)
    stripe_block   = build_stripe_rules(stripes)

    # .card border — prefer explicit rule, fall back to --separator value
    card_inner = extract_block_inner(variant_css, 'body.dark .card')
    card_line = (f'    body.dark .card {{ {card_inner.strip()} }}'
                 if card_inner.strip()
                 else f'    body.dark .card {{ border: 1px solid {variant_dark_vars.get("--separator", "#2d2d40")}; }}')

    # .error-card .error-msg color
    err_inner = extract_block_inner(variant_css, 'body.dark .error-card .error-msg')
    err_line = (f'    body.dark .error-card .error-msg {{ {err_inner.strip()} }}'
                if err_inner.strip()
                else f'    body.dark .error-card .error-msg {{ color: {variant_dark_vars.get("--muted", "#6b7280")}; }}')

    extras = extract_theme_extras(variant_css)
    n_extras = len(extras.splitlines()) if extras else 0

    parts = [
        f'    :root {{\n{new_root_inner}\n    }}',
        f'    body.dark {{\n{new_dark_inner}\n    }}',
        stripe_block,
        card_line,
        err_line,
    ]
    if extras:
        parts.append(extras)
    parts.append(master_static)

    n_stripes = sum(1 for s in stripes.values() if s)
    return '\n'.join(p for p in parts if p.strip()), n_stripes, n_extras


# ── Splice helpers ─────────────────────────────────────────────────────────
def splice_theme(master_html, new_theme_inner, title):
    """Replace <style id="theme">…</style> and <title> in master HTML with variant content.

    Uses a lambda replacement to avoid regex backreference interpretation of CSS content.
    Returns the full HTML string with the new theme block and title spliced in.
    """
    # Use lambda to avoid regex backreference interpretation of the replacement string
    replacement = f'<style id="theme">\n{new_theme_inner}\n  </style>'
    result = re.sub(
        r'<style id="theme">.*?</style>',
        lambda _: replacement,
        master_html,
        flags=re.DOTALL,
    )
    result = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', result)
    return result


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    """Parse CLI args, load master, and generate requested theme variant outputs.

    Flags:
      --dry-run     Print what would be written without touching any files.
      --variant KEY Generate only the specified variant (default: all).
                    Valid keys: default, soft_purple, matcha, gummy.
    """
    parser = argparse.ArgumentParser(
        prog='retheme.py',
        description=(
            'Generate themed HTML variants of ui_preview.html.\n'
            'Reads palette sources from nfc_relay/HTML/, splices them into the master,\n'
            'and writes outputs to Downloads/.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Show what would be generated without writing any files.',
    )
    parser.add_argument(
        '--variant', choices=list(VARIANTS), metavar='KEY',
        help=f'Generate only one variant. Choices: {", ".join(VARIANTS)}.',
    )
    args = parser.parse_args()

    targets = {args.variant: VARIANTS[args.variant]} if args.variant else VARIANTS

    master_html        = MASTER.read_text(encoding='utf-8')
    master_theme_inner = get_master_theme_inner(master_html)
    master_root_inner  = extract_block_inner(master_theme_inner, ':root')
    master_dark_inner  = extract_block_inner(master_theme_inner, 'body.dark')
    master_static      = extract_master_static(master_theme_inner)

    if args.dry_run:
        print('Dry run - no files will be written.')

    for key, (src_path, title) in targets.items():
        out_path = OUTPUT[key]

        if key == 'default':
            html = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', master_html)
            tag  = '[master, no extraction]'
        else:
            src_html = src_path.read_text(encoding='utf-8')
            # Palette source files have a single <style> block (no id="theme")
            m = re.search(r'<style>(.*?)</style>', src_html, re.DOTALL)
            variant_css = m.group(1) if m else src_html
            new_theme_inner, n_stripes, n_extras = build_variant_theme(
                key, variant_css, master_root_inner, master_dark_inner, master_static
            )
            html = splice_theme(master_html, new_theme_inner, title)
            tag  = f'[{n_stripes} stripe types | {n_extras} extras]'

        if args.dry_run:
            print(f'  --  {out_path.name}  {tag}  (not written)')
        else:
            out_path.write_text(html, encoding='utf-8')
            print(f'  OK  {out_path.name}  {tag}')

    print('Done.')


if __name__ == '__main__':
    main()
