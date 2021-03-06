var http = require('http'),
    events = require('events'),
    path = require('path'),
    ws = require('../vendor/ws'),
    paperboy = require('../vendor/paperboy'),
    dsession = require('./session');
    
var WEBROOT = path.join(path.dirname(__filename), '../front-end');
function staticFile(req, res) {
  paperboy
    .deliver(WEBROOT, req, res)
    .error(function (statCode, msg) {
      res.writeHead(statCode, {'Content-Type': 'text/plain'});
      res.end("Error: " + statCode);
    })
    .otherwise(function (err) {
      var statCode = 404;
      res.writeHead(statCode, {'Content-Type': 'text/plain'});
      res.end();
    });
}

function override(options, defaults) {
  var result = {};
  Object.keys(defaults).forEach(function (key) {
    result[key] = options[key] || defaults[key];
  });
  return result;
}

exports.createServer = function(options) {
  var defaults = { webPort: 8080 },
      settings = override(options || {}, defaults),
      httpServer = http.createServer(staticFile),
      wsServer = ws.createServer({server: httpServer}),
      sessions = {};

  wsServer.on('connection', function (conn) {
    var url = conn._req.url,
        session = sessions[url];
    if (!session) {
      session = dsession.createSession();
      session.on('close', function() {
        delete sessions[url];
      });
      sessions[url] = session;
    }
    conn.on('message', function (data) {
      session.handleRequest(conn, data);
    });
    conn.on('close', function () {
      session.removeClient(conn);
    });
  });

  wsServer.listen(settings.webPort);

  srv = Object.create(events.EventEmitter.prototype, {
    close: {
      value: function ()
      {
        if (wsServer) {
          wsServer.close();
        }
        srv.emit('close');
      }
    },
    webPort: {
      get: function () { return settings.webPort; }
    }
  });

  return srv;
};
