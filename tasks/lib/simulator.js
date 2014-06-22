var _ = require('lodash'),
  request = require('request'),
  open = require('open'),
  colors = require('colors'),
  express = require('express'),
  fs = require('fs'),
  path = require('path'),
  http = require('http');

module.exports = function(grunt) {

  // Upload the indexx.html file to the server.
  function uploadIndexDocument(config, options, callback) {
    var headers = {
      'User-Agent': 'aerobatic-yoke',
      'Secret-Key': config.secretKey,
      'UserId': config.userId
    };

    var uploadUrl = options.airport + '/dev/' + config.appId + '/index';
    grunt.log.writeln('Uploading ' + options.index + ' to ' + uploadUrl);

    var requestOptions = {
      method: 'post',
      headers: headers,
      url: uploadUrl,
      form: {
        indexDocument: grunt.file.read(options.index),
        port: options.port
      }
    }

    var postRequest = request(requestOptions, function(err, resp, body) {
      if (err)
        return callback(new Error("Error uploading index document: " + err.message));

      if (resp.statusCode == 401)
        return callback(new Error("Unauthorized upload. Check your deploy key."));
      else if (resp.statusCode !== 200)
        return callback(new Error(resp.statusCode + ": " + body));

      callback(null, JSON.parse(body));
    });
  }

  function watchIndexDocument(config, options) {
    fs.watchFile(path.join(process.cwd(), options.index), function (curr, prev) {
      grunt.log.writeln("Uploading changes to " + options.index + " document to the simulator");

      uploadIndexDocument(config, options, function(err) {
        grunt.log.debug('Done uploading ' + options.index);

        // TODO: Send a socket.io message to the browser to refresh the page
      });
    });
  }

  function startLocalServer(options, simulatorUrl) {
    grunt.log.writeln("Starting simulator server on port " + options.port);
    var simulator = express();

    simulator.get('/', function(req, res) {
      res.redirect(simulatorUrl);
    });

    simulator.get('/' + options.index, function(req, res) {
      res.redirect(simulatorUrl);
    });

    simulator.use(express.static(process.cwd()));

    // Anything not served by the static middleware is a 404
    simulator.get('/*', function(req, res) {
      res.status(404);
      res.send("Page not found", 404);
    });

    http.createServer(simulator).listen(options.port, function(){
      grunt.log.writeln(('Express server listening on port ' + options.port).green);
    });
  }

  return function(config, options) {
    _.defaults(options, {
      index: 'index.html',
      port: 3000
    });

    if (!grunt.file.exists(options.index)) {
      grunt.log.error('The index document ' + options.index + ' does not exist');
      return false;
    }

    var done = grunt.task.current.async();
    uploadIndexDocument(config, options, function(err, app) {
      if (err) return done(err);

      var simulatorUrl = app.url + '?sim=1&user=' + config.userId;

      startLocalServer(options, simulatorUrl);

      // Watch for changes to the index file
      watchIndexDocument(config, options);

      if (grunt.option('open')) {
        grunt.log.writeln("Launching browser to " + simulatorUrl);
        open(simulatorUrl);
      }
      else {
        grunt.log.writeln("Simulator is running at " + simulatorUrl.underline.cyan);
      }

      // We don't want to call done since that will kill our express server
      // done(null);
    });

    return done;
  }
}
