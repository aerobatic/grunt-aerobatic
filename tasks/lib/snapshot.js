var os = require('os'),
  path = require('path'),
  fs = require('fs'),
  _ = require('lodash'),
  spawn = require("child_process").spawn,
  parse = require('url').parse,
  cheerio = require('cheerio'),
  api = require('./api'),
  open = require('open');

module.exports = function(grunt) {
  function modifyHtml(html, url) {
    // Load the snapshot html into cheerio
    var $;
    try {
      $ = cheerio.load(html, {recognizeSelfClosing: true});
    }
    catch (err) {
      return grunt.fail.fatal("Could not load the html snapshot into cheerio: " + err);
    }

    // Strip out all script blocks
    $('script').remove();

    // Turn relative URLs into absolute ones
    $('a[href]').each(function() {
      var href = $(this).attr('href');
      if (_.startsWith(href, '#!/'))
        $(this).attr('href', url.protocol + '//' + url.hostname + '/' + href);
    });

    return $.root().html();
  }

  // Determine what to name the snapshot file by analyzing the url.
  function determineSnapshotPath(snapshotUrl) {
    var snapshotPath;

    if (snapshotUrl.path && snapshotUrl.path.length > 1)
      snapshotPath = snapshotUrl.path.slice(1);
    else if (snapshotUrl.hash) {
      // Detect hash bang urls
      if (_.startsWith(snapshotUrl.hash, '#!/'))
        snapshotPath = _.strRight(snapshotUrl.hash, '#!/');
    }
    if (!snapshotPath || snapshotPath.length == 0)
      snapshotPath = 'index';

    // Give all snapshot paths a .html extension
    snapshotPath += '.html';
    grunt.log.debug("Snapshot path: " + snapshotPath);
    return snapshotPath;
  }

  return function(config, options) {
    // TODO: Detect if phantomjs is installed

    if (!grunt.option('url'))
      return grunt.fail.fatal("No --url option found");

    var url = parse(grunt.option('url'));
    if (!url.protocol)
      return grunt.fail.fatal("The --url option is invalid");

    grunt.log.writeln('Snapshot url ' + url.href);

    _.defaults(options, {
      timeout: 3000, // Default timeout of 3 seconds
      output: './snapshots',
      phantomjs: 'phantomjs', // Default to assuming phantomjs is in the system PATH
      loadImages: false // By default don't download images
    });

    var done = grunt.task.current.async();

    var snapshotPath = determineSnapshotPath(url);
    var execScript = path.join(__dirname, 'phantom.js');

    grunt.log.debug("Executing phantom script " + execScript);

    var phantomArgs = [
      '--load-images=' + options.loadImages.toString(),
      execScript,
      url.href,
      options.timeout
    ];

    var phantomProcess = spawn(options.phantomjs, phantomArgs, {
      cwd: process.cwd(),
      detached: true
    });

    phantomProcess.on('error', function(err) {
      grunt.log.error("PhantomJS error: " + err);
      phantomProcess.kill('SIGHUP');
      done(err);
    });

    // Read in the html from the phantomjs stdout
    var html = '';
    phantomProcess.stdout.on('data', function (data) {
      html += data;
    });

    phantomProcess.stderr.on('data', function (data) {
      grunt.log.error(data);
    });

    phantomProcess.on('close', function() {
      grunt.log.debug("Phantom process closed");

      html = modifyHtml(html, url);

      // Upload the snapshot to Aerobatic
      var uploadOptions = {
        url: options.airport + '/dev/' + config.appId + '/snapshot/' + snapshotPath,
        method: 'POST',
        form: {snapshot: html}
      };

      api(config, uploadOptions, function(err, res) {
        if (err)
          return done(new Error("Error uploading snapshot " + snapshotPath + ": " + err));

        grunt.log.writeln("Done uploading snapshot " + snapshotPath);
        grunt.log.writeln("View page as googlebot at: " + res.snapshotUrl);
        if (grunt.option('open')) {
          open(res.snapshotUrl);
        }

        done();
      });
    });
  };
};
