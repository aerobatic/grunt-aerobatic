var os = require('os'),
  path = require('path'),
  _ = require('lodash'),
  api = require('./api');

module.exports = function(grunt) {

  return function(config, options) {
    grunt.log.debug(JSON.stringify(_.last(grunt.task.current.args)));

    var done = grunt.task.current.async();
    switch(_.last(grunt.task.current.args)) {
      case 'keys':
        // List the cache keys
        grunt.log.writeln("Listing cache keys");
        api(config, {url: options.airport + '/dev/' + config.appId + '/cache', method: 'GET'}, function(err, keys) {
          if (err) return done(err);

          _.each(keys, function(key, i) {
            grunt.log.writeln((i+1) + ') ' + key);
            done();
          });
        });
        break;
      case 'view':
        var key = grunt.option(key);
        if (_.isEmpty(key))
          return grunt.fail.fatal("You must specify a key to view, i.e. 'grunt aerobatic:cache:view --key=keyname'");

        grunt.log.writeln("Retrieving key " + key);
        api(config, {url: options.airport + '/dev/' + config.appId + '/cache/' + encodeURIComponent(key)}, function(err, contents) {
          if (err) return done(err);
          grunt.log.writeln(contents);
        });
      case 'del':
        var key = grunt.option(key);
        if (_.isEmpty(key))
          return grunt.fail.fatal("You must specify a key to delete, i.e. 'grunt aerobatic:cache:del --key=keyname'");

        grunt.log.writeln("Deleting cache entry with key " + key);
        api(config, {url: options.airport + '/dev/' + config.appId + '/cache/' + encodeURIComponent(key), method: 'DELETE'}, function(err) {
          if (err) return done(err);
          grunt.log.writeln("Key deleted");
        });
    }
  };
};
