var gulp = require('gulp');
var del = require('del');
var fs = require('fs');
var _ = require('lodash');
// ----------------------------------------------------------------------------

var errorNotice = require('hel/lib/errorNotice');
var pathSplit = require('hel/lib/pathSplit');

// ============================================================================

var defaults = {

	srcmaps: false,

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

	// Optimization
	// ------------

	// These options will be passed to uglifyjs [output] parameter.
	// See: http://lisperator.net/uglifyjs/compress

	optimization: {
		// empty
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
		'vinyl-source-stream': null,
		'vinyl-transform': null,
		'browserify': null,
		'watchify': null,
		'uglify-js': null,
		'exorcist': null
	}
};

var Task = function (conf) {

	conf = _.merge({}, defaults, conf)

	var source     = require('vinyl-source-stream');
	var transform  = require('vinyl-transform');
	var browserify = require('browserify');
	var watchify   = require('watchify');
	var uglifyjs   = require('uglify-js');
	var exorcist   = require('exorcist');

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

	var mainjs = function (opts) {

		var args = {
			entries: [ conf.main ],
			debug: conf.srcmaps
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

		var filepath = conf.dest;
		var dest = pathSplit(filepath);

		var bundle = function () {

			// [!!] the combination of source map + uglify is not working
			// entirely as expected; current implementation here is temporarily
			// crippled to do only one or the other. Hopefully find a solution

			var extractmap = transform(function () {
				return exorcist(filepath + '.map');
			});

			var minify = function () {
				var min = uglifyjs.minify(filepath, {
					output: conf.optimization
				});

				fs.writeFileSync(filepath, min.code);
			};

			var b = bundler.bundle()
			b.on('error', errorNotice);

			var pipe = b.pipe(source(dest.name))
				.pipe(extractmap)
				.pipe(gulp.dest(dest.path));

			if ( ! conf.srcmaps) {
				pipe = pipe.on('end', minify);
			}

			return pipe;
		};

		if (opts.watcher) {
			bundler = watchify(bundler);
			bundler.on('update', bundle);
		}

		return bundle();
	};

	var libraryjs = function (opts) {

		var bundler = browserify({ debug: conf.srcmaps });

		// Library Exports
		// ---------------

		_.each(conf.require, function (library) {
			bundler.require(library);
		});

		// Bundling Logic
		// --------------

		var filepath = conf.libs;
		var dest = pathSplit(filepath);

		var bundle = function () {

			// [!!] the combination of source map + uglify is not working
			// entirely as expected; current implementation here is temporarily
			// crippled to do only one or the other. Hopefully find a solution

			var extractmap = transform(function () {
				return exorcist(filepath + '.map')
			});

			var minify = function () {
				var min = uglifyjs.minify(filepath, {
					output: conf.optimization
				});

				fs.writeFileSync(filepath, min.code);
			};

			var b = bundler.bundle()
			b.on('error', errorNotice);
			return b.pipe(source(dest.name))
				// .pipe(extractmap)
				.pipe(gulp.dest(dest.path))
				.on('end', minify);
		};

		return bundle();
	};

	// Define Tasks
	// ------------

	var tasks = conf.tasknames;

	gulp.task(tasks.clean_libs, function (cb) {
		del([ conf.libs, conf.libs + '.map' ], cb);
	});

	gulp.task(tasks.build_libs, [ tasks.clean_libs ], function () {
		if ( ! _.isEmpty(conf.require)) {
			return libraryjs();
		}
	});

	gulp.task(tasks.clean_main, function (cb) {
		del([ conf.dest, conf.dest + '.map' ], cb);
	});

	gulp.task(tasks.build_main, [ tasks.clean_main ], function () {
		return mainjs({
			watcher: false,
			libs: false
		});
	});

	gulp.task(conf.tasknames.watch_main, function () {
		return mainjs({
			watcher: true,
			libs: false
		});
	});

};

module.exports = Task;
