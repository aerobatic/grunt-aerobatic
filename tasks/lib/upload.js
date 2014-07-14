var request = require('request'),
  _ = require('lodash');

module.exports = function(config, options, callback) {
  _.defaults(options, {
    method: 'post',
    headers: {},
    strictSSL: false
  });

  _.extend(options.headers, {
    'User-Agent': 'grunt-aerobatic',
    'Secret-Key': config.secretKey,
    'UserId': config.userId
  });

  return request(options, function(err, resp, body) {
    if (err)
      return callback(err);

    if (resp.statusCode == 401)
      return callback(new Error("Unauthorized upload. Check your deploy key."));
    else if (resp.statusCode !== 200)
      return callback(new Error(resp.statusCode + ": " + body));

    callback(null, JSON.parse(body));
  });
}
