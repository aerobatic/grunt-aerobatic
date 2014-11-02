# grunt-aerobatic

> Grunt tasks for building apps with the [Aerobatic](http://www.aerobatic.com) - single page app hosting, built for front-end developers.

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-aerobatic --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-aerobatic');
```

## The "aerobatic" task

### Overview
In your project's Gruntfile, add a section named `aerobatic` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  aerobatic: {
    options: {
      base: {
        debug: '/src' // Optional, defaults to '/'
        release: '/build' // Defaults to '/'
      },
      pages: {
        index: 'index.html' // Optional
        login: 'login.html' // Optional
      }
    },
    deploy: {
      cowboy: true,
      src: ['build/**/*.*'],
    },
    sim: {
      port: 3000,
      livereload: true
    }
  }
});
```

By default the `index.html` page is assume to reside at the root of the repo
and assets are built to a top-level directory such as `build` or `dist`.
The directory structure would be structured along these lines:

```bash
.
├── Gruntfile.js
│   index.html
├── css
│   └── styles.css
├── js
│   └── app.js
├── images
├── build
│   └── styles.min.css
│   └── app.min.css
```

URL paths would then look like so:

```html
<link data-aero-build="debug" href="/css/styles.css">
<link data-aero-build="debug" href="/build/styles.min.css">

<script data-aero-build="debug" src="/js/app.js"></script>
<script data-aero-build="release" src="/build/app.min.js"></script>
```

### Options

####base
Type: `Object`
Default value: `null`

Allows you to override the base directory for URLs served in both debug and release builds.
For example a common convention is for the `index.html` page all css, js, etc. to live
beneath a `src` directory at the root of the repo. Built assets may be written to a
build directory.

```bash
.
├── Gruntfile.js
├── src
│   └── index.html
│   ├── css
│   │   └── styles.css
│   ├── js
│   │   └── app.js
│   ├── images
├── build
│   └── styles.min.css
│   └── app.min.css
```

The corresponding `aerobatic` options for this structure would be this:

```js
options: {
  base: {
    debug: '/src',
    release: '/build'
  }
}
```

In your `index.html` file, the assets URLs would omit the leading `/src` and `/build` paths since
they are implicitly treated as the root.

```html
<link data-aero-build="debug" href="/css/styles.css">
<link data-aero-build="debug" href="/styles.min.css">

<script data-aero-build="debug" src="/js/app.js"></script>
<script data-aero-build="release" src="/app.min.js"></script>
```
####pages
Type: `Object` Default value: `{index: 'index.html'}`

Allows you to override the names of the host pages for your app. For basic apps
only an `index` page is required which serves as the entry point for your single
page application. For apps with OAuth an additional `login` page
should be specified. Read more in the [OAuth documentation](http://www.aerobatic.com/docs/authentication).

### The "deploy" target
The `deploy` target deploys the current local sources as a new version. By default this new version will only be
staged in production, but not yet receiving live traffic. To direct live traffic to the new version you log into
your Aerobatic app dashboard and configure the traffic control rules to specify this version should receive
some or all of the traffic. The grunt log output will include a preview URL that will force the new version to be used
so you can immediately see your changes live in production without impacting real users.

If you just want to push your changes to the live site and bypass traffic control
configuration, you can specify the `--cowboy` flag.

#### src
Type: `Array`
Specifies the files that should be deployed. Typically you will use the output of other grunt tasks that have built the assets for the production environment, i.e. [grunt-contrib-uglify](https://github.com/gruntjs/grunt-contrib-uglify), [grunt-contrib-sass](https://github.com/gruntjs/grunt-contrib-sass), etc.

####cowboy
Type: `boolean`
Default value: `false`

When deploying, force the new version to take 100% of live traffic immediately. Useful when you are just getting started and the risks of bypassing the staging process is low or you if that's just the way you roll.

####Command Options
**--cowboy** - Override the default setting specified in the Gruntfile.

**--name** - The name of the new version. Defaults to an auto-generated timestamp.

**--message** - Optional short message describing the version.

**--open** - Launch a browser to the version preview URL upon successful deploy.

It is suggested that you configure a grunt alias task called `deploy` that builds
your deployment assets then invokes `aerobatic:deploy`.
```js
grunt.registerTask('deploy', ['build', 'aerobatic:deploy']);
```

**Sample Call**
```bash
grunt deploy --cowboy --name '1.2.10' --message 'New messaging feature'
```

### The "sim" target
The `sim` target is used to run a local simulator [expressjs](http://expressjs.com/) server which allows
development of front end assets locally while the main app entry page is
hosted in the cloud. By working in a fully integrated mode you are much more
likely to uncover integration issues while you build your app rather than
post-deployment. Generally you will keep the simulator running the whole time
you work so your browser always reflects your latest changes.

In simulator mode you would work off a URL in the format: `http://<your_app_name>.aerobaticapp.com?sim=1&user=<your_user_id>&reload=1`

The aerobatic platform detects the `sim=1` and automatically repoints your scripts, stylesheets, templates, images, etc. to `http://localhost:3000`.

#### port
Type: `Number`
Default value: `3000`

The port number to run the simulator on.

#### livereload
Type: `Boolean`
Default value: `false`


Automatically adds the livereload script in the HTML source of the
development URL. Designed to be used in conjunction with the
[grunt-contrib-watch](https://github.com/gruntjs/grunt-contrib-watch)
task.

```html
<script src="//localhost:35729/livereload.js"></script>
```

####Command Options
**--open** - Launch a browser to the simulator URL. Useful the first time you run `grunt sim`, after that you may choose to simply refresh the

**--release** - Run the simulator in release mode to test the built minified assets locally before deploying.


#### Watch and Reload
One of the powerful workflows grunt enables is watching your filesystem for
changes, performing any necessary pre-processing, and automatically
refreshing your browser. The aerobatic sim task can work in parallel with the
[livereload](https://github.com/gruntjs/grunt-contrib-watch/blob/master/docs/watch-examples.md#live-reloading)
capabilities of the `watch` task.

To enable `aerobatic:sim` and `watch` to work in tandem, the suggested configuration is
to define an alias task called `sim` which runs both tasks with an extra `sync`
option specified on `sim`. The `sync` option prevents `sim` from blocking grunt
from running the subsequent watch task. When grunt is killed, both the watch and
the express simulator server are terminated together.

```js
grunt.registerTask('sim', ['aerobatic:sim:sync', 'watch']);
```

**Sample Call**
```bash
grunt sim --open
```
