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

  function makeFilter(patterns) {
    return function(filePath, fstat) {
      var relativePath = path.relative(process.cwd(), filePath);

      if (relativePath == 'node_modules')
        return false;

      if (fstat.isDirectory())
        return true;

      return _.any(patterns, function(p) {
        return minimatch(relativePath, p);
      });
    }
  }

  function watchForChanges(config, options) {
    if (!options.watch)
      return;

    var watchTargets = _.keys(options.watch);
    findTargetMatch = function(filePath, fstat) {
      if (fstat.isFile() !== true)
        return null;

      var relativePath = path.relative(process.cwd(), filePath);
      for (var i=0; i<watchTargets.length; i++) {
        if (_.any(options.watch[watchTargets[i]].files, function(pattern) {
          return minimatch(relativePath, pattern);
        })) return watchTargets[i];
      }

      return null;
    }

    respondToChange = function(f, stat) {
      var target = findTargetMatch(f, stat);
      if (!target)
        return;

      var tasks = options.watch[target].tasks;
      grunt.log.debug("Files matching target " + target + " detected");
      grunt.log.debug("Executing tasks " + JSON.stringify(tasks));

      // We need to spawn grunt in another process since the current
      // process is busy running our express server
      grunt.util.spawn({
        grunt: true,
        opts: {
          cwd: process.cwd(),
          stdio: 'inherit',
        },
        // Run grunt this process uses, append the task to be run and any cli options
        args: tasks //.concat(self.options.cliArgs || []),
      }, function(err, res, code) {
        if (err)
          return grunt.fail.fatal(err);

        grunt.log.debug("Done executing spawned tasks");
      });
    }

    var monitorOptions = {
      ignoreDotFiles: true,
      filter: function(f, fstat) {
        return !(fstat.isDirectory() && path.basename(f) == 'node_modules');
      }
    };

    watch.createMonitor(process.cwd(), monitorOptions, function(monitor) {
      monitor.on("created", respondToChange);
      monitor.on("changed", function (f, curr, prev) {
        respondToChange(f, monitor.files[f]);
      });
      monitor.on("removed", respondToChange);
    });
  }

  function watchIndexDocument(config, options) {
    fs.watchFile(path.join(process.cwd(), options.index), function (curr, prev) {
      grunt.log.writeln("Uploading changes to " + options.index + " document to the simulator");

      uploadIndexDocument(config, options, function(err, app) {
        if (err)
          grunt.fail.fatal('Error uploading modified version of ' + options.index + ' to simulator: ' + err.message);

        grunt.log.debug('Done uploading ' + options.index + ' to simulator');

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

    var done = grunt.task.current.async();
    uploadIndexDocument(config, options, function(err, app) {
      if (err) return done(err);

      var simulatorUrl = app.url + '?sim=1&user=' + config.userId + '&port=' + options.port;

      startLocalServer(options, simulatorUrl);

      // Watch for changes to the index file
      watchIndexDocument(config, options);
      watchForChanges(config, options);

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
