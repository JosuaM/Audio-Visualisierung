"""Lokaler Server für das Projekt (wird von Start-Mac.command / Start-Windows.bat gestartet).

Liefert die Seiten aus wie `python -m http.server` und kann zusätzlich die Likes der
Animationsideen direkt in seiten/animationen/animationen.html schreiben – in jedem Browser.
"""
import http.server
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8781
ANIM_HTML = os.path.join(ROOT, 'seiten', 'animationen', 'animationen.html')
LIKES_RE = re.compile(r'<script id="likes-data">window\.ANIM_LIKES=([\s\S]*?);</script>')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split('?')[0] != '/__save/likes':
            return self._json(404, {'ok': False, 'error': 'unbekannt'})
        # nur Anfragen von dieser Seite selbst annehmen (nicht von fremden Webseiten)
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + (self.headers.get('Host') or ''):
            return self._json(403, {'ok': False, 'error': 'fremde Herkunft'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(min(n, 1_000_000)).decode('utf-8'))
            likes = data.get('likes')
            if not isinstance(likes, dict) or not all(isinstance(k, str) and isinstance(v, (int, float)) for k, v in likes.items()):
                raise ValueError('ungültige Likes')
            clean = {'t': int(data.get('t') or 0), 'likes': likes}
            with open(ANIM_HTML, encoding='utf-8', newline='') as f:
                txt = f.read()
            if not LIKES_RE.search(txt):
                raise ValueError('Datenblock likes-data nicht gefunden')
            block = '<script id="likes-data">window.ANIM_LIKES=' + json.dumps(clean, ensure_ascii=False).replace('<', '\\u003c') + ';</script>'
            txt = LIKES_RE.sub(lambda m: block, txt, count=1)
            with open(ANIM_HTML, 'w', encoding='utf-8', newline='') as f:
                f.write(txt)
            return self._json(200, {'ok': True})
        except Exception as e:  # noqa: BLE001 – Fehler an die Seite melden
            return self._json(400, {'ok': False, 'error': str(e)})


if __name__ == '__main__':
    print(f'Server laeuft auf http://localhost:{PORT} - dieses Fenster zum Beenden schliessen (oder Strg+C).')
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
