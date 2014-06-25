var _ = require('lodash'),
  request = require('request'),
  open = require('open'),
  colors = require('colors'),
  express = require('express'),
  fs = require('fs'),
  path = require('path'),
  cors = require('cors'),
  http = require('http'),
  minimatch = require('minimatch'),
  watch = require('watch');

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

      var app = JSON.parse(body);
      callback(null, app);
    });
  }

  function watchIndexDocument(config, options) {
    fs.watchFile(path.join(process.cwd(), options.index), function (curr, prev) {
      grunt.log.writeln("Uploading changes to " + options.index + " document to the simulator");

      uploadIndexDocument(config, options, function(err, app) {
        if (err)
          grunt.fail.fatal('Error uploading modified version of ' + options.index + ' to simulator: ' + err.message);

        grunt.log.debug('Done uploading ' + options.index + ' to simulator');
      });
    });
  }

  function startLocalServer(options, developmentUrl) {
    grunt.log.writeln("Starting simulator server on port " + options.port);
    var simulator = express();

    simulator.get('/', function(req, res) {
      res.redirect(developmentUrl);
    });

    simulator.get('/' + options.index, function(req, res) {
      res.redirect(developmentUrl);
    });

    simulator.use(cors());
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

    var done = null;
    var args = grunt.task.current.args;
    async = !_.contains(grunt.task.current.args, 'sync');

    if (async === true)
      done = grunt.task.current.async();

    uploadIndexDocument(config, options, function(err, app) {
      if (err)
        return grunt.fail.fatal(err);

      var developmentUrl = app.url + '?sim=1&user=' + config.userId + '&port=' + options.port;
      if (grunt.option('livereload'))
        developmentUrl += '&reload=1';

      startLocalServer(options, developmentUrl);

      // Watch for changes to the index file
      watchIndexDocument(config, options);

      if (grunt.option('open')) {
        grunt.log.writeln("Launching browser to " + developmentUrl);
        open(developmentUrl);
      }
      else {
        grunt.log.writeln("Simulator is running at " + developmentUrl.underline.cyan);
      }

      // We don't want to call done since that will kill our express server
      // done(null);
    });
  }
}
