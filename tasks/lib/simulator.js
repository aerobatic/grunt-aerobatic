var _ = require('lodash'),
  request = require('request'),
  open = require('open'),
  colors = require('colors'),
  express = require('express'),
  fs = require('fs'),
  path = require('path'),
  cors = require('cors'),
  http = require('http'),
  https = require('https'),
  minimatch = require('minimatch'),
  watch = require('watch'),
  api = require('./api');

module.exports = function(grunt) {

  // Upload the indexx.html file to the server.
  function uploadIndexDocuments(pages, config, options, callback) {
    var requestOptions = {
      url: options.airport + '/dev/' + config.appId + '/index',
      form: {}
    };

    pages.forEach(function(page) {
      requestOptions.form[path.basename(page, path.extname(page)) + 'Document'] = grunt.file.read(page);
    });

    api(config, requestOptions, callback);
  }

  function watchIndexDocuments(config, options) {
    [options.index, options.login].forEach(function(page) {
      fs.watchFile(path.join(process.cwd(), page), function (curr, prev) {
        grunt.log.writeln("Uploading changes to " + page + " document to the simulator");

        uploadIndexDocuments([page], config, options, function(err, app) {
          if (err)
            grunt.fail.fatal('Error uploading modified version of ' + page + ' to simulator: ' + err.message);

          grunt.log.debug('Done uploading ' + page + ' to simulator');
        });
      });
    });
  }

  function startLocalServer(options, developmentUrl) {
    var simulator = express();

    simulator.get('/', function(req, res) {
      res.redirect(developmentUrl);
    });

    simulator.get('/' + options.index, function(req, res) {
      res.redirect(developmentUrl);
    });

    simulator.get('/' + options.login, function(req, res) {
      res.redirect(developmentUrl);
    });

    simulator.use(cors());
    simulator.use(express.static(process.cwd(), {
      index: false
    }));

    simulator.use(function(req, res, next) {
      grunt.log.debug("Serving asset " + req.url);
      next();
    });

    simulator.use(function(err, req, res, next) {
      if (err)
        grunt.log.error(err);

      next();
    });

    // Anything not served by the static middleware is a 404
    simulator.get('/*', function(req, res) {
      res.status(404);
      res.send("Page not found");
    });

    if (options.protocol == 'https') {
      var credentials = {
        key: options.key || grunt.file.read(path.join(__dirname, '../certs', 'server.key')).toString(),
        cert: options.cert || grunt.file.read(path.join(__dirname, '../certs', 'server.crt')).toString(),
        ca: options.ca || grunt.file.read(path.join(__dirname, '../certs', 'ca.crt')).toString(),
        passphrase: options.passphrase || 'grunt',
        rejectUnauthorized: false
      };
      grunt.log.writeln("Starting https simulator server on port " + options.port);
      https.createServer(credentials, simulator).listen(options.port);
    }
    else {
      grunt.log.writeln(('Express http server listening on port ' + options.port).green);
      http.createServer(simulator).listen(options.port);
    }
  }

  return function(config, options) {
    _.defaults(options, {
      index: 'index.html',
      login: 'login.html',
      protocol: 'http',
      port: 3000
    });

    // Override the watch livereload settings with the built in SSL cert
    if (grunt.config('watch.options.livereload') === true) {
      options.livereload = true;

      if (options.protocol === 'https') {
        grunt.log.debug("Overriding livereload SSL settings");
        grunt.config('watch.options.livereload', {
          key: options.key || grunt.file.read(path.join(__dirname, '../certs', 'server.key')).toString(),
          cert: options.cert || grunt.file.read(path.join(__dirname, '../certs', 'server.crt')).toString()
        });
      }
    }

    if (!grunt.file.exists(options.index)) {
      grunt.log.error('The index document ' + options.index + ' does not exist');
      return false;
    }

    var done = null;
    var args = grunt.task.current.args;
    async = !_.contains(grunt.task.current.args, 'sync');

    if (async === true)
      done = grunt.task.current.async();

    var pages = [options.index];
    if (grunt.file.exists(options.login))
      pages.push(options.login);

    uploadIndexDocuments(pages, config, options, function(err, app) {
      if (err)
        return grunt.fail.fatal(err);

      var developmentUrl = app.url + '?sim=1&user=' + config.userId + '&port=' + options.port;
      if (options.livereload === true)
        developmentUrl += '&reload=1';
      if (grunt.option('release') === true)
        developmentUrl += '&release=1';

      startLocalServer(options, developmentUrl);

      // Watch for changes to the index file
      watchIndexDocuments(config, options);

      if (grunt.option('open')) {
        grunt.log.writeln("Launching browser to " + developmentUrl.underline.cyan);
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
