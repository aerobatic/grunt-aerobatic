var os = require('os'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  _ = require('lodash'),
  open = require('open'),
  uuid = require('node-uuid'),
  async = require('async'),
  crypto = require('crypto'),
  colors = require('colors'),
  api = require('./api');

module.exports = function(grunt) {
  function uploadFile(config, filePath, url, callback) {

    var requestOptions = {
      url: url,
      method: 'POST',
      headers: {
        'file-size': fs.statSync(filePath).size
      }
    };

    var request = api(config, requestOptions, callback);
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
      name: grunt.option('name'),
      message: grunt.option('message')
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

      if (grunt.option('cowboy') === true) {
        versionData.forceAllTrafficToNewVersion = '1';
        grunt.log.writeln('Cowboy mode - forcing all traffic to the new version. Yippee-ki-yay!'.yellow);
      }

      api(config, {url: url, form: versionData}, function(err, version) {
        if (err)
          return grunt.fail.fatal(err);

        grunt.log.writeln("New version successfully deployed".green);

        if (grunt.option('open') === true) {
          grunt.log.writeln("Launching browser to " + version.previewUrl);
          open(version.previewUrl);
        }
        else {
          if (grunt.option('cowboy') === true)
            grunt.log.ok("New version is live at " + version.previewUrl.cyan.underline);
          else
            grunt.log.ok("Preview at: " + version.previewUrl.cyan.underline);
        }

        done();
      });
    });
  }
};
