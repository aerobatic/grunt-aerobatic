var request = require('request'),
  _ = require('lodash'),
  manifest = require('./package.json');

module.exports = function(config, options, callback) {
  _.defaults(options, {
    method: 'post',
    headers: {},
    strictSSL: false
  });

  _.extend(options.headers, {
    'User-Agent': 'grunt-aerobatic',
    'Access-Key': config.accessKey,
    'UserId': config.userId,
    'Agent-Version': manifest.version
  });

  return request(options, function(err, resp, body) {
    if (err)
      return callback(err);

    if (resp.statusCode == 401)
      return callback(new Error("Unauthorized upload. Check your access key."));
    else if (resp.statusCode > 203)
      return callback(new Error(resp.statusCode + ": " + body));

    callback(null, JSON.parse(body));
  });
}
