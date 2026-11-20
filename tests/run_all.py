"""Alle Tests nacheinander. Exit-Code 1, wenn einer fehlschlägt."""
import glob, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
skip = set(sys.argv[1:])  # z. B. test_csp_echt.py überspringen
bad = []
for f in sorted(glob.glob(os.path.join(here, 'test_*.py'))):
    n = os.path.basename(f)
    if n in skip:
        continue
    r = subprocess.run([sys.executable, f], capture_output=True, text=True)
    last = (r.stdout.strip().splitlines() or ['(keine Ausgabe)'])[-1]
    print(('OK      ' if r.returncode == 0 else 'FEHLER  ') + n + '  ' + last)
    if r.returncode != 0:
        bad.append(n)
        print(r.stdout[-2000:], r.stderr[-2000:])
sys.exit(1 if bad else 0)
