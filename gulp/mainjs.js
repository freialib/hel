var gulp = require('gulp');
var log = require('gulp-util/lib/log');
var del = require('del');
var fs = require('fs');
var _ = require('lodash');
// ----------------------------------------------------------------------------

var buffer  = require('vinyl-buffer')
var concat  = require('gulp-concat');
var order   = require('gulp-order');
var merge   = require('event-stream').merge;

var errorNotice = require('hel/lib/errorNotice');
var pathSplit = require('hel/lib/pathSplit');

// ============================================================================

var defaults = {

	env: process.env.NODE_ENV != null ? process.env.NODE_ENV : 'production',

	main : './src/client/node_modules/main.js',  // entry point
	dest : './public/web/main.js',               // consumer file
	libs : './public/web/library.js',            // 3rd-party bundle

	// Libraries (Optional)
	// --------------------

	// If you specify libraries they'll be bundled in a seperate file on
	// compilation. This file won't be recompiled on watch, since it's just
	// libraries (presumably 3rd-party ones). This keeps your main.js small
	// and therefore easier to deal with (particularly in things like IE8).

	// Library bundling can help when you have different pages using the same
	// libraries. By bundling in one file you avoid re-downloading for every
	// single page.

	// If you don't specify any libraries the library task will still be
	// created but will do nothing.

	require: [
		// empty
	],

	// Transforms (Optional)
	// ---------------------

	transforms: function (bundler) {
		// empty
	},

	// Autopolyfiller
	// --------------

	polyfills: {
		// empty
	},

	// Optimization
	// ------------

	// These options will be passed to uglifyjs
	// See: http://lisperator.net/uglifyjs/codegen
	// See: http://lisperator.net/uglifyjs/compress

	uglify: {
		mangle: true,
		output: {},
		compress: {}
	},

	// Names For Tasks (Optional)
	// --------------------------

	tasknames: {
		clean_libs : 'clean:libraryjs',
		build_libs : 'build:libraryjs',
		clean_main : 'clean:mainjs',
		build_main : 'build:mainjs',
		watch_main : 'watch:mainjs'
	},

	// Dependency Injection (Optional)
	// -------------------------------

	// Just in case you need to use a fork, or just slightly more advance
	// version of the dependencies of this library in the generated task.
	// Simply install the version you want to use and specify it here.

	use: {
		'gulp-autopolyfiller': null,
		'vinyl-source-stream': null,
		'vinyl-transform': null,
		'browserify': null,
		'watchify': null,
		'uglify-js': null,
		'exorcist': null
	},

	// Feature Switches
	// ----------------

	// Use these switches to enable features that are supported but disabled
	// due to bugs or inconsistent behavior; if you find a fork/patched version
	// of a dependency that will work for you stick it in [use] and enable it.

	// If a fork/patched version of another dependency causes conflicts you can
	// selectively disable certain features to avoid inter-tool compatibility.

	features: {

		// current versions problematic with "directory/index.js" resolution;
		// will be re-enabled once fixed by project maintainers
		watchify: false,

		// switch for uglify
		uglifyjs: true,

		// switch for autopolyfiller
		polyfill: true,

		// switch for source maps; note that source map generation depends
		// a variaty of factors not just this switch; but if this switch is OFF
		// it will never get generated
		srcmaps: true,

		// force deletion; enable to allow deletion outside of cwd
		forcedel: false

	}
};

var Recipe = function (conf) {

	conf = _.merge({}, defaults, conf)

	log('Defining hel.mainjs --', conf.env, ':', conf.main);

	var source     = require('vinyl-source-stream');
	var transform  = require('vinyl-transform');
	var browserify = require('browserify');
	var watchify   = require('watchify');
	var uglifyjs   = require('uglify-js');
	var exorcist   = require('exorcist');
	var polyfill   = require('gulp-autopolyfiller');

	// Dependency Injection
	// --------------------

	if (conf.use != null) {

		if (conf.use['vinyl-source-stream']) {
			source = conf.use['vinyl-source-stream'];
		}

		if (conf.use['vinyl-transform']) {
			transform = conf.use['vinyl-transform'];
		}

		if (conf.use['browserify']) {
			browserify = conf.use['browserify'];
		}

		if (conf.use['watchify']) {
			watchify = conf.use['watchify'];
		}

		if (conf.use['uglify-js']) {
			uglifyjs = conf.use['uglify-js'];
		}

		if (conf.use['exorcist']) {
			exorcist = conf.use['exorcist'];
		}

		if (conf.use['gulp-autopolyfiller']) {
			polyfill = conf.use['gulp-autopolyfiller'];
		}
	}

	//
	// The task intentionally DOES NOT support more then 1 entry point; the
	// reason for this is because once you start thinking of more then 1 you
	// start thinking of loading strategies for more then 1 and then you start
	// thinking of resource management for more then 1, and dependency
	// management and so on...
	//
	// This tasks is only meant to accomodate a very simple browserify scenario
	// if you need multi entry applications with dynamic loading you may wish
	// to look into http://webpack.github.io/
	//

	var makebundle = function (bundler, filepath) {
		var dest = pathSplit(filepath);

		return function () {

			// [!!] the combination of source map + polyfills + uglify is not
			// working ideally; current implementation is temporarily crippled
			// to do only one or the other.

			var extractmap = transform(function () {
				return exorcist(filepath + '.map');
			});

			var minify = function () {
				if (conf.features.uglifyjs) {
					var args = _.merge({}, conf.uglify);
					var min = uglifyjs.minify(filepath, args);
					fs.writeFileSync(filepath, min.code);
				}
			};

			var b = bundler.bundle()
			b.on('error', errorNotice);

			var channel = b.pipe(source(dest.name))
				.pipe(extractmap)
				.pipe(buffer())
				.pipe(concat(dest.name));

			if (conf.env == 'production') {
				if (conf.features.polyfill) {
					var polyfills = channel
						.pipe(polyfill('polyfills.js', conf.polyfills));

					merge(polyfills, channel)
						.pipe(order(['polyfills.js', dest.name]))
						.pipe(buffer())
						.pipe(concat(dest.name))
						.pipe(gulp.dest(dest.path))
						.on('end', minify);
				}
				else { // no polyfilling
					channel.pipe(gulp.dest(dest.path)).on('end', minify)
				}
			}
			else { // development
				channel = channel.pipe(gulp.dest(dest.path))
			}

			return channel;
		};
	};

	var mainjs = function (opts) {

		var args = {
			entries: [ conf.main ],
			debug: conf.env == 'development' && conf.features.srcmaps
		};

		if (opts.watcher) {
			args = _.merge({}, args, watchify.args);
		}

		var bundler = browserify(args);

		// Library Imports
		// ---------------

		_.each(conf.require, function (library) {
			bundler.external(library);
		});

		// Transforms
		// ----------

		if (conf.transforms != null) {
			conf.transforms(bundler);
		}

		// Bundling Logic
		// --------------

		var bundle = makebundle(bundler, conf.dest);

		if (opts.watcher) {
			bundler = watchify(bundler);
			bundler.on('update', bundle);
		}

		return bundle();
	};

	var libraryjs = function (opts) {

		var bundler = browserify({ debug: conf.env == 'development' });

		// Library Exports
		// ---------------

		_.each(conf.require, function (library) {
			bundler.require(library);
		});

		// Bundling Logic
		// --------------

		var bundle = makebundle(bundler, conf.libs);

		return bundle();
	};

	// Define Tasks
	// ------------

	var tasks = conf.tasknames;

	gulp.task(tasks.clean_libs, function (cb) {
		del([ conf.libs, conf.libs + '.map' ], { force: conf.features.forcedel }, cb);
	});

	gulp.task(tasks.build_libs, [ tasks.clean_libs ], function () {
		if ( ! _.isEmpty(conf.require)) {
			return libraryjs();
		}
	});

	gulp.task(tasks.clean_main, function (cb) {
		del([ conf.dest, conf.dest + '.map' ], { force: conf.features.forcedel }, cb);
	});

	gulp.task(tasks.build_main, [ tasks.clean_main ], function () {
		return mainjs({
			watcher: false,
			libs: false
		});
	});

	gulp.task(conf.tasknames.watch_main, function () {
		return mainjs({
			watcher: conf.features.watchify,
			libs: false
		});
	});

};

module.exports = Recipe;
