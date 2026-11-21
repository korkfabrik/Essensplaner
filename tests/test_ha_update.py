"""Update-Skript für Home Assistant (ha/essensplaner_update.sh) ohne Netz: GitHub wird durch ein lokales
tar.gz ersetzt (curl kann file://). Prüft Erstinstallation, Update mit Sicherung und Abbruch bei
unterschiedlichen Versionen, bei dem die installierte App unangetastet bleibt."""
import io, os, subprocess, sys, tarfile, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..'))
SCRIPT = os.path.join(REPO, 'ha', 'essensplaner_update.sh')
APP = os.path.join(REPO, 'www', 'essensplaner')
results = []
ok = lambda name, cond, info='': results.append((name, bool(cond), info))


def make_tarball(path, sw_version=None):
    """Wie der GitHub-Tarball: ein Ordner oben, darin das Repository."""
    top = 'korkfabrik-Essensplaner-abc1234'
    with tarfile.open(path, 'w:gz') as tf:
        for name in sorted(os.listdir(APP)):
            full = os.path.join(APP, name)
            arc = top + '/www/essensplaner/' + name
            if name == 'sw.js' and sw_version:
                data = open(full, encoding='utf-8').read()
                data = data.replace("const CACHE_VERSION = '", "const CACHE_VERSION = '" + sw_version + "-x", 1)
                raw = data.encode('utf-8')
                info = tarfile.TarInfo(arc); info.size = len(raw)
                tf.addfile(info, io.BytesIO(raw))
            else:
                tf.add(full, arcname=arc)
        readme = b'nur zum Test'
        info = tarfile.TarInfo(top + '/README.md'); info.size = len(readme)
        tf.addfile(info, io.BytesIO(readme))


def run(tmp, tarball):
    env = dict(os.environ,
               EP_URL='file://' + tarball,
               EP_TARGET=os.path.join(tmp, 'config', 'www', 'essensplaner'),
               EP_BACKUP=os.path.join(tmp, 'config', 'essensplaner_backup'),
               EP_WORK=os.path.join(tmp, 'work'),
               EP_TOKEN_FILE=os.path.join(tmp, 'kein_token'))
    return subprocess.run(['sh', SCRIPT], env=env, capture_output=True, text=True)


version = open(os.path.join(APP, 'version.js'), encoding='utf-8').read().split("'")[1]
with tempfile.TemporaryDirectory() as tmp:
    target = os.path.join(tmp, 'config', 'www', 'essensplaner')
    backup = os.path.join(tmp, 'config', 'essensplaner_backup')
    good = os.path.join(tmp, 'gut.tar.gz')
    bad = os.path.join(tmp, 'schlecht.tar.gz')
    make_tarball(good)
    make_tarball(bad, sw_version='9')

    r = run(tmp, good)
    ok('Erstinstallation läuft durch', r.returncode == 0, r.stdout + r.stderr)
    ok('Meldet installierte Version', r.stdout.strip() == 'Essensplaner %s installiert' % version, r.stdout)
    ok('Alle App-Dateien da', sorted(os.listdir(target)) == sorted(os.listdir(APP)), os.listdir(target) if os.path.isdir(target) else None)
    ok('Nur der App-Ordner, nichts aus dem Repo-Rest', not any(os.path.exists(os.path.join(target, x)) for x in ('www', 'tests', 'scripts', 'ha')))
    ok('Arbeitsordner aufgeräumt', not os.path.exists(os.path.join(tmp, 'work')))
    ok('Noch keine Sicherung', not os.path.exists(backup))

    open(os.path.join(target, 'alt.txt'), 'w').write('vorige Version')
    r = run(tmp, good)
    ok('Update läuft durch', r.returncode == 0, r.stdout + r.stderr)
    ok('Vorige Version als Sicherung', os.path.exists(os.path.join(backup, 'alt.txt')))
    ok('Neue Version ohne Altlasten', not os.path.exists(os.path.join(target, 'alt.txt')))

    open(os.path.join(target, 'marker.txt'), 'w').write('installiert')
    r = run(tmp, bad)
    ok('Versionen ungleich: Abbruch mit Fehlercode', r.returncode == 1, r.stdout + r.stderr)
    ok('Versionen ungleich: verständliche Meldung', 'Version passt nicht' in r.stdout and 'Nichts geändert' in r.stdout, r.stdout)
    ok('Versionen ungleich: installierte App unverändert', os.path.exists(os.path.join(target, 'marker.txt')))
    ok('Versionen ungleich: Sicherung unverändert', os.path.exists(os.path.join(backup, 'alt.txt')))

    r = run(tmp, os.path.join(tmp, 'gibtsnicht.tar.gz'))
    ok('Download scheitert: Fehlercode', r.returncode != 0, r.stdout + r.stderr)
    ok('Download scheitert: App unverändert', os.path.exists(os.path.join(target, 'marker.txt')))

fails = [x for x in results if not x[1]]
for n, c, i in results:
    print(('OK      ' if c else 'FEHLER  ') + n, '' if c else i)
print('%d von %d OK' % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
