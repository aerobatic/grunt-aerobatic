/*
 * grunt-aerobatic
 * https://github.com/aerobatic/grunt-aerobatic
 *
 * Copyright (c) 2014 David Von Lehman
 * Licensed under the MIT license.
 */
var _ = require('lodash'),
  execSync = require('exec-sync');

_.mixin(require('underscore.string').exports());

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  var simulator = require('./lib/simulator')(grunt),
    deploy = require('./lib/deploy')(grunt),
    snapshot = require('./lib/snapshot')(grunt),
    cache = require('./lib/cache')(grunt);

  function readDotFileConfig() {
    if (!grunt.file.exists('.aerobatic')) {
      grunt.fail.fatal("The required .aerobatic file is missing. Login to your app dashboard to re-create it.");
      return null;
    }

    // Check if there is a .aerobatic file in this directory
    var config = grunt.file.readJSON('.aerobatic');

    if (!config.appId || !config.secretKey) {
      grunt.fail.fatal(".aerobatic file is corrupt. Login to your app dashboard to recreate it.");
      return null;
    }

    return config;
  }

  function readGitConfig() {
    var config = {
      userId: execSync('git config --get aerobatic.userId'),
      appId: execSync('git config --get aerobatic.appId'),
      accessKey: execSync('git config --get aerobatic.accessKey')
    };

    if (!config.userId && !config.appId && !config.accessKey)
      return null;

    if (!config.appId || !config.accessKey) {
      grunt.fail.fatal("gitconfig requires keys aerobatic.userId, aerobatic.appId, and aerobatic.orgId");
      return null;
    }

    return config;
  }

  function validateUuid(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid);
  }

  grunt.registerMultiTask('aerobatic', 'Grunt tasks for building apps with the Aerobatic HTML5 hosting platform', function() {
    // First try and read the git config before falling back to the legacy .aerobatic file
    var config = readGitConfig() || readDotFileConfig();
    if (!config)
      return;

    if (_.isEmpty(this.target)) {
      grunt.log.error("No valid target specified, i.e. 'grunt aerobatic:deploy'");
      return;
    }

    var options = this.options();
    _.extend(options, this.data);
    options.files = this.files;

    _.defaults(options, {
      root: '',
      index: 'index.html',
      login: 'login.html'
    });

    // Used only for running the airport server locally
    if (grunt.option('dev') === true)
      options.airport = 'https://aerobaticapp.dev:7777';
    else
      options.airport = 'https://aerobaticapp.com';

    switch (this.target) {
      case 'deploy':
        grunt.log.writeln("Deploy new version of app to cloud");
        deploy(config, options);
        break;
      case 'sim':
        grunt.log.writeln("Run the aerobatic simulator for a fully integrated development environment");
        simulator(config, options);
        break;
      case 'snapshot':
        grunt.log.writeln("Snapshot a url and upload it to Aerobatic");
        snapshot(config, options);
        break;
      case 'cache':
        cache(config, options);
        break;
      default:
        grunt.log.error("Invalid target " + target);
    }
  });
}
