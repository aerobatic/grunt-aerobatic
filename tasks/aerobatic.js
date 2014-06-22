/*
 * grunt-aerobatic
 * https://github.com/aerobatic/grunt-aerobatic
 *
 * Copyright (c) 2014 David Von Lehman
 * Licensed under the MIT license.
 */
var _ = require('lodash');

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  var simulator = require('./lib/simulator')(grunt),
    deploy = require('./lib/deploy')(grunt);

  function readDotFileConfig() {
    if (!grunt.file.exists('.aerobatic')) {
      grunt.fail.fatal("The required .aerobatic file is missing. Login to your app dashboard to re-create it.");
      return null;
    }

    // Check if there is a .aerobatic file in this directory
    var config = grunt.file.readJSON('.aerobatic');

    if (!config.appId || !config.secretKey) {
      grunt.fail.fatal(".aerobatic file is corrupt. Login to your app dashboard to rec-create it.");
      return null;
    }

    return config;
  }

  function validateUuid(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid);
  }

  // function writeInitDotFile( ) {
  //   var config = {
  //     appId: grunt.option('id'),
  //     userId: grunt.option('user'),
  //     deployKey: grunt.option('key')
  //   };
  //
  //   if (!validateUuid(config.appId))
  //     return grunt.log.error("The --id arg is not valid");
  //
  //   if (!validateUuid(config.userId))
  //     return grunt.log.error("The --user arg is not valid");
  //
  //   if (!/^[0-9a-f]{30,50}$/.test(config.deployKey))
  //     return grunt.log.error("The --key arg is not valid");
  //
  //   // Write an init file
  //   grunt.file.write('.aerobatic', JSON.stringify(config));
  //   grunt.log.writeln(("Application " + config.appId + " initialized").green);
  // }

  grunt.registerMultiTask('aerobatic', 'Grunt tasks for building apps with the Aerobatic HTML5 cloud platform', function() {
    var config = readDotFileConfig();
    if (!config)
      return;

    if (_.isEmpty(this.target)) {
      grunt.log.error("No valid target specified, i.e. 'grunt aerobatic:deploy'");
      return;
    }

    var options = this.data;
    _.extend(options, {
      files: this.files,
      airport: grunt.option('airport') || 'https://aerobaticapp.com'
    });

    if (this.target == 'deploy') {
      grunt.log.writeln("Deploy new version of app to cloud");
      deploy(config, options);
    }
    else if (this.target == 'sim') {
      grunt.log.writeln("Run the aerobatic simulator for a fully integrated development environment");
      simulator(config, options);
    }
    else
      grunt.log.error("Invalid target " + target);
  });
}
