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
  watch = require('watch');

module.exports = function(grunt) {

  // Upload the indexx.html file to the server.
  function uploadIndexDocuments(pages, config, options, callback) {
    var headers = {
      'User-Agent': 'aerobatic-yoke',
      'Secret-Key': config.secretKey,
      'UserId': config.userId
    };

    var uploadUrl = options.airport + '/dev/' + config.appId + '/index';
    grunt.log.debug('Uploading ' + JSON.stringify(pages) + ' to ' + uploadUrl);

    var requestOptions = {
      method: 'post',
      headers: headers,
      url: uploadUrl,
      strictSSL: false,
      form: {}
    };

    pages.forEach(function(page) {
      requestOptions.form[path.basename(page, path.extname(page)) + 'Document'] = grunt.file.read(page);
    });

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

    simulator.use(function(req, res, next) {
      grunt.log.debug("Serving asset " + req.url);
      next();
    });

    simulator.use(function(err, req, res, next) {
      if (err)
        grunt.log.error(err);

      next();
    });

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
    simulator.use(express.static(process.cwd()));

    // Anything not served by the static middleware is a 404
    simulator.get('/*', function(req, res) {
      res.status(404);
      res.send("Page not found", 404);
    });

    var useSsl = /^https:\/\//.test(developmentUrl);
    if (useSsl) {
      if (!options.ssl)
        return grunt.fail.fatal(' but no ssl options specified for sim task.');

      var credentials = {
        key: fs.readFileSync(path.join(process.cwd(), options.ssl.key)),
        cert: fs.readFileSync(path.join(process.cwd(), options.ssl.cert)),
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
