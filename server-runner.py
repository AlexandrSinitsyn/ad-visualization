#Use to create local host
import http.server
import socketserver

PORT = 9000

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
      ".js": "application/javascript",
})

print('=' * 32)
print('Running on http://localhost:9000')
print('=' * 32)
print('This server is going to be just a proxy to your local files. Ex.: a request to "./ad/algo.js"', \
    'will be interpreted as "localhost:9000/ad/algo.js"')

httpd = socketserver.TCPServer(("", PORT), Handler)
httpd.serve_forever()
