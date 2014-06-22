var os = require('os'),
  archiver = require('archiver'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  _ = require('lodash'),
  zlib = require('zlib'),
  open = require('open'),
  colors = require('colors');

module.exports = function(grunt) {

  function deploySrcArchive(config, options, archivePath, callback) {
    var headers = {
      'User-Agent': 'aerobatic-yoke',
      'Secret-Key': config.secretKey,
      'UserId': config.userId
    };

    var uploadUrl = options.airport + '/dev/' + config.appId + '/deploy';
    grunt.log.writeln('Deploying src archive to  ' + uploadUrl);

    var requestOptions = {
      method: 'post',
      headers: headers,
      url: uploadUrl
    }

    var postRequest = request(requestOptions, function(err, resp, body) {
      if (err)
        return callback(new Error("Error uploading index document: " + err.message));

      if (resp.statusCode == 401)
        return callback(new Error("Unauthorized upload. Check your deploy key."));
      else if (resp.statusCode !== 200)
        return callback(new Error(resp.statusCode + ": " + body));

      var version = JSON.parse(body);
      grunt.log.debug(JSON.stringify(version));

      grunt.log.debug("callback is function: " + _.isFunction(callback));
      callback(null, version);
    });

    var form = postRequest.form();
    form.append('srcArchive', fs.createReadStream(archivePath));
  }

  return function(config, options) {
    // if (options.files.length == 0)
    //   return grunt.fail.fatal("No files to push were specified");
    grunt.log.writeln('Executing the push task');
    var done = grunt.task.current.async();

    // var tempArchivePath = path.join(os.tmpdir(), "aerobatic-push-" + new Date().getTime() + ".zip");
    var tempArchivePath = path.join(process.cwd(), "aerobatic-push-" + new Date().getTime() + ".zip");

    grunt.log.debug("Creating zip archive of files to push at " + tempArchivePath);
    archive = archiver('zip');

    archive.on('error', function(err) {
      grunt.fail.fatal('Error generating the version zip: ' + err.message);
    });

    var zipStream = fs.createWriteStream(tempArchivePath);
    zipStream.on('close', function() {
      grunt.log.writeln("Deployment archive created");
      deploySrcArchive(config, options, tempArchivePath, function(err, version) {
        grunt.log.debug('Deleting archive ' + tempArchivePath);
        fs.unlink(tempArchivePath);

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

    archive.pipe(zipStream);

    options.files[0].src.forEach(function(file) {
      grunt.log.debug("appending " + file + " to archive");
      var fullPath = path.join(process.cwd(), file);

      archive.file(fullPath, {name: file});
    });
    archive.finalize();
  }
}
