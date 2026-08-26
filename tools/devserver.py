#!/usr/bin/env python3
"""Static dev server that refuses to let the browser cache anything.

Plain `http.server` serves 304s from the browser cache, which silently
hides edits to js/*.js during development.
"""
import base64
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, keyword, value):
        # drop the validators the browser would use to revalidate
        if keyword.lower() in ("last-modified", "etag"):
            return
        super().send_header(keyword, value)

    def do_POST(self):
        """POST /__shot/<name>.png with a data: URL body -> writes build/shots/.

        Lets the agent capture the real canvas without shuttling a
        200KB data URL back through the tool channel.
        """
        if not self.path.startswith("/__shot/"):
            self.send_error(404)
            return
        name = os.path.basename(self.path[len("/__shot/"):]) or "shot.png"
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n).decode("utf-8", "replace")
        if "," in body:
            body = body.split(",", 1)[1]
        os.makedirs("build/shots", exist_ok=True)
        with open(os.path.join("build/shots", name), "wb") as f:
            f.write(base64.b64decode(body))
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
