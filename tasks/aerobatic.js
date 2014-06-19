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

  var simulator = require('./lib/simulator')(grunt);

  function readDotFileConfig() {
    // Check if there is a .aerobatic file in this directory
    var config = grunt.file.readJSON('.aerobatic');

    if (!config.appId || !config.deployKey) {
      grunt.log.error(".aerobatic file is corrupt");
      return null;
    }

    return config;
  }

  grunt.registerMultiTask('aerobatic', 'Grunt tasks for building apps with the Aerobatic HTML5 cloud platform', function() {

    // grunt.log.writeln("Running aerobatic task " + this.target + " with options: " + JSON.stringify(this.data));
    var config = readDotFileConfig();
    if (!config)
      return;

    if (_.isEmpty(this.target)) {
      grunt.log.error("No valid target specified, i.e. 'grunt aerobatic:push'");
      return;
    }

    var options = this.data;
    _.extend(options, {
      airport: grunt.option('airport') || 'https://aerobaticapp.com'
    });

    if (this.target == 'push')
      grunt.log.writeln("Push new version of app to cloud");
    else if (this.target == 'sim') {
      grunt.log.writeln("Run the aerobatic simulator for a fully integrated development environment");
      simulator(config, options);
    }
    else
      grunt.log.error("Invalid target " + target);

    // // Iterate over all specified file groups.
    // this.files.forEach(function(f) {
    //   // Concat specified files.
    //   var src = f.src.filter(function(filepath) {
    //     // Warn on and remove invalid source files (if nonull was set).
    //     if (!grunt.file.exists(filepath)) {
    //       grunt.log.warn('Source file "' + filepath + '" not found.');
    //       return false;
    //     } else {
    //       return true;
    //     }
    //   }).map(function(filepath) {
    //     // Read file source.
    //     return grunt.file.read(filepath);
    //   }).join(grunt.util.normalizelf(options.separator));
    //
    //   // Handle options.
    //   src += options.punctuation;
    //
    //   // Write the destination file.
    //   grunt.file.write(f.dest, src);
    //
    //   // Print a success message.
    //   grunt.log.writeln('File "' + f.dest + '" created.');
    // });
  });
};
