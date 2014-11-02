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
  function uploadIndexPages(pagePaths, config, options, callback) {
    var requestOptions = {
      method: 'POST',
      url: options.airport + '/dev/' + config.appId + '/simulator',
      form: {}
    };

    // Attach the files as multi-part
    var request = api(config, requestOptions, callback);
    var form = request.form();

    pagePaths.forEach(function(pagePath) {
      grunt.log.debug("Uploading " + pagePath);
      form.append(path.basename(pagePath, '.html'), fs.createReadStream(pagePath));
    });
  }

  function watchIndexPages(config, options) {
    options.pagePaths.forEach(function(pagePath) {
      fs.watchFile(pagePath, function (curr, prev) {
        grunt.log.writeln("Uploading changes to " + path.basename(pagePath) + " document to the simulator");

        uploadIndexPages([pagePath], config, options, function(err, app) {
          if (err)
            grunt.fail.fatal('Error uploading modified version of ' + path.basename(pagePath) + ' to simulator: ' + err.message);

          grunt.log.debug('Done uploading ' + path.basename(pagePath) + ' to simulator');
        });
      });
    });
  }

  function verifyIndexPagesExist(options) {
    options.pagePaths.forEach(function(pagePath) {
      if (!grunt.file.exists(pagePath)) {
        grunt.fail.fatal('The file ' + pagePath + ' does not exist');
        return false;
      }
    });
    return true;
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

    var staticRoot = path.join(process.cwd(), options.base[options.build]);
    grunt.log.debug("Serve static assets from " + staticRoot);
    simulator.use(express.static(staticRoot, {index: false}));

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
      protocol: 'http',
      port: 3000
    });

    // Determine whether debug or release assets should be delivered
    options.build = (grunt.option('release') === true) ? 'release' : 'debug';

    // Get the absolute path of all the pages
    options.pagePaths = _.map(_.keys(options.pages), function(page) {
      return path.join(process.cwd(), options.base[options.build], options.pages[page]);
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

    // Verify the index and login (if applicable) files exist
    grunt.log.debug("Verify index pages exist");
    if (!verifyIndexPagesExist(options))
      return false;

    var done = null;
    var args = grunt.task.current.args;
    async = !_.contains(grunt.task.current.args, 'sync');

    if (async === true)
      done = grunt.task.current.async();

    // Upload all the index pages when the simulator starts up.
    uploadIndexPages(options.pagePaths, config, options, function(err, app) {
      if (err)
        return grunt.fail.fatal(err);

      var developmentUrl = app.url + '?sim=1&user=' + config.userId + '&port=' + options.port;
      if (options.livereload === true)
        developmentUrl += '&reload=1';

      if (options.build === 'release')
        developmentUrl += '&release=1';

      startLocalServer(options, developmentUrl);

      // Watch for changes to the index file
      watchIndexPages(config, options);

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
