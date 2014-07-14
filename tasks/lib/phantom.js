var system = require("system"), proces;

var options = {
  url: system.args[1],
  timeout: parseInt(system.args[2])
};

var page = require("webpage").create();

// https://github.com/ariya/phantomjs/issues/10930
page.customHeaders = {
  "Accept-Encoding": "identity"
};

page.open(options.url, function (status) {
  if (status !== "success")
    return phantom.exit(2);

  // phantomJS loaded the page, so wait for the prescribed amount of time for
  // it to finish loading.
  setTimeout(function() {
    var content = page.content;
    // Pipe the HTML content of the page to stdout
    console.log(content);

    phantom.exit(0);
  }, options.timeout);
});
