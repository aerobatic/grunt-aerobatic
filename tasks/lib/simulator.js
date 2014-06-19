var _ = require('lodash'),
  request = require('request'),
  open = require('open'),
  colors = require('colors');

module.exports = function(grunt) {

  // Upload the indexx.html file to the server.
  function uploadIndexDocument(config, options, callback) {
    var headers = {
      'User-Agent': 'aerobatic-yoke',
      'Deploy-Key': config.deployKey,
      'UserId': config.userId
    };

    var uploadUrl = options.airport + '/yoke/' + config.appId + '/index';
    grunt.log.writeln('Uploading ' + options.index + ' to ' + uploadUrl);

    var requestOptions = {
      method: 'post',
      headers: headers,
      url: uploadUrl,
      form: {
        indexDocument: grunt.file.read(options.index)
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

  return function(config, options) {
    _.defaults(options, { index: 'index.html'});

    if (!grunt.file.exists(options.index)) {
      grunt.log.error('The index document ' + options.index + ' does not exist');
      return false;
    }

    var done = grunt.task.current.async();
    uploadIndexDocument(config, options, function(err, app) {
      if (err) return done(err);

      var simulatorUrl = app.url + '?sim=1&user=' + config.userId;

      if (grunt.option('open')) {
        grunt.log.writeln("Launching browser to " + simulatorUrl);
        open(simulatorUrl);
      }
      else {
        grunt.log.writeln("Simulator is running at " + simulatorUrl.underline.cyan);
      }

      done(null);
    });

    return done;
  }
}
