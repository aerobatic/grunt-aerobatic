var os = require('os'),
  path = require('path'),
  request = require('request'),
  Stream = require('stream'),
  fs = require('fs'),
  _ = require('lodash'),
  zlib = require('zlib'),
  shortid = require('shortid'),
  open = require('open'),
  uuid = require('node-uuid'),
  async = require('async'),
  crypto = require('crypto'),
  colors = require('colors'),
  api = require('./api');

var compressExtensions = ['.html', '.css', '.js', '.json', '.txt'];

module.exports = function(grunt) {
  function uploadFile(config, filePath, url, compress, callback) {
    grunt.log.debug("Start upload of " + filePath);

    var requestOptions = {
      url: url,
      headers: {},
      method: 'POST'
    };

    function upload(file) {
      grunt.log.debug('Uploading file ' + file);
      fs.stat(file, function(err, stat) {
        requestOptions.headers['Content-Length'] = stat.size;
        return fs.createReadStream(file)
          .pipe(api(config, requestOptions, callback));
      });
    }

    if (compress === true) {
      grunt.log.debug('Compressing file ' + filePath);
      requestOptions.headers['Content-Type'] = 'application/gzip';

      // Use a random file name to avoid chance of collisions
      var gzipFile = path.join(os.tmpdir(), shortid.generate() + path.extname(filePath) + '.gz');

      grunt.log.debug("Writing to gzipFile " + gzipFile);
      fs.createReadStream(filePath)
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(gzipFile))
        .on('error', function(err) {
          grunt.log.error("Error in pipe: " + err);
          return callback(err);
        })
        .on('finish', function() {
          return upload(gzipFile);
        });
    }
    else {
      upload(filePath);
    }
  }

  return function(config, options) {
    // if (options.files.length == 0)
    //   return grunt.fail.fatal("No files to push were specified");
    grunt.log.writeln('Executing the deploy task');
    var done = grunt.task.current.async();

    _.defaults(options, {
      cowboy: false
    });

    // Allow overriding the cowboy mode from the command line.
    if (grunt.option('cowboy') === true)
      options.cowboy = true;

    // Create a new version object
    var versionId = shortid.generate();
    var versionData= {
      versionId: versionId,
      appId: config.appId,
      userId: config.userId,
      storageKey: versionId, //crypto.createHash('md5').update(versionId).digest('hex').substring(0, 9),
      name: grunt.option('name'),
      message: grunt.option('message')
    };

    // PUT each file individually
    var uploadCount = 0;

    if (options.files[0].src.length === 0)
      return grunt.fail.fatal("No files found to deploy");

    async.each(options.files[0].src, function(filePath, cb) {
      // Ensure the slashes are forward in the relative path
      var relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

      // Correct the index documents to always be at the root.
      var baseName = path.basename(relativePath);
      if (baseName == options.index || baseName == options.login) {
        relativePath = baseName;
      }

      var uploadUrl = options.airport + '/dev/' + config.appId + '/deploy/' + versionData.storageKey + '/' + relativePath;
      grunt.log.debug('Deploying file ' + relativePath);
      uploadCount++;

      var compress = shouldCompress(filePath, options);
      uploadFile(config, filePath, uploadUrl, compress, cb);
    }, function(err) {
      if (err)
        return grunt.fail.fatal("Error deploying source files: " + err);

      grunt.log.debug('Done uploading ' + uploadCount + ' files');

      // Create the new version
      var url = options.airport + '/dev/' + config.appId + '/version';
      grunt.log.debug('Creating new version');

      if (options.cowboy === true) {
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
          if (options.cowboy === true)
            grunt.log.ok("New version is live at " + version.previewUrl.cyan.underline);
          else
            grunt.log.ok("Preview at: " + version.previewUrl.cyan.underline);
        }

        done();
      });
    });
  }

  function shouldCompress(filePath, options) {
    // Don't compress the index or login page
    if (_.contains([options.login, options.index], path.basename(filePath)))
      return false;

    if (_.contains(compressExtensions, path.extname(filePath)))
      return true;

    return false;
  }
};
