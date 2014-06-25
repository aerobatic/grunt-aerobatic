var os = require('os'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  _ = require('lodash'),
  zlib = require('zlib'),
  open = require('open'),
  uuid = require('node-uuid'),
  async = require('async'),
  crypto = require('crypto'),
  colors = require('colors');

module.exports = function(grunt) {

  function createDevApiRequest(config, url, method, form, callback) {
    var headers = {
      'User-Agent': 'aerobatic-yoke',
      'Secret-Key': config.secretKey,
      'UserId': config.userId
    };

    var requestOptions = {
      method: method,
      headers: headers,
      url: url
    };
    if (form)
      requestOptions.form = form;

    return request(requestOptions, function(err, resp, body) {
      if (err)
        return callback(new Error("Error uploading index document: " + err.message));

      if (resp.statusCode == 401)
        return callback(new Error("Unauthorized upload. Check your secret key in the .aerobatic file."));
      else if (resp.statusCode !== 200)
        return callback(new Error(resp.statusCode + ": " + body));

      callback(null, JSON.parse(body));
    });
  }

  function uploadFile(config, filePath, url, callback) {
    var request = createDevApiRequest(config, url, 'PUT', null, function(err, json) {
      callback(err);
    });

    var form = request.form();
    form.append('file', fs.createReadStream(filePath));
  }

  return function(config, options) {
    // if (options.files.length == 0)
    //   return grunt.fail.fatal("No files to push were specified");
    grunt.log.writeln('Executing the deploy task');
    var done = grunt.task.current.async();

    // Create a new version object
    var versionId = uuid.v1().toString();
    var versionData= {
      versionId: versionId,
      appId: config.appId,
      userId: config.userId,
      storageKey: crypto.createHash('md5').update(versionId).digest('hex').substring(0, 9),
      name: options.name,
      message: options.message
    };

    // PUT each file individually
    var uploadCount = 0;
    async.each(options.files[0].src, function(filePath, cb) {
      var relativePath = path.relative(process.cwd(), filePath);

      var uploadUrl = options.airport + '/dev/' + config.appId + '/deploy/' + versionData.storageKey + '/' + relativePath;
      grunt.log.debug('Deploying file ' + filePath);
      uploadCount++;
      uploadFile(config, filePath, uploadUrl, cb);
    }, function(err) {
      if (err)
        return grunt.fail.fatal("Error deploying source files: " + err);

      grunt.log.debug('Done uploading ' + uploadCount + ' files');

      // Create the new version
      var url = options.airport + '/dev/' + config.appId + '/version';
      grunt.log.debug('Creating new version');
      createDevApiRequest(config, url, 'POST', versionData, function(err, version) {
        if (err) return done(err);

        grunt.log.writeln("New version successfully deployed".green);

        if (grunt.option('open')) {
          grunt.log.writeln("Launching browser to " + version.previewUrl);
          open(version.previewUrl);
        }
        else
          grunt.log.ok("Preview at: " + version.previewUrl.cyan.underline);

        done();
      });
    });
  }
};
