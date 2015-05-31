var env = process.env.NODE_ENV != null ? process.env.NODE_ENV : 'production';

var Contract = require('lie');
var webpack  = require('webpack');
var gutil    = require('gulp-util');
var glob     = require('glob');
var fs       = require('fs');

var _ = require('lodash');

var plugin = {
	Define   : webpack.DefinePlugin,
	UglifyJs : webpack.optimize.UglifyJsPlugin,
	Dedupe   : webpack.optimize.DedupePlugin
};

var replaceInFile = function (file, toReplace) {
	return new Contract(function (resolve, reject) {
		fs.readFile(file, 'utf8', function (err, data, cb) {

			if (err) {
				gutil.log(err);
				reject();
				return;
			}

			_.each(toReplace, function (logic) {
				data = data.replace(logic[0], logic[1]);
			});

			fs.writeFile(file, data, 'utf8', function (err) {
				if (err) {
					gutil.log(err);
					reject();
				}
				else { // no errors
					resolve();
				}
			});
		});
	});
};

var debugWebpackMapFile = function (file, cleanupRules) {
	return new Contract(function (resolve, reject) {
		var match = /\/([^\/]+).js.map$/.exec(file);
		if (match != null) {
			var filename = match[1];
			console.log("\n  " + filename + "\n  =======================\n");
			var mapjson = JSON.parse(fs.readFileSync(file));

			var dependencies = [];
			var sourcefiles = [];

			_.each(mapjson.sources, function (srcfile) {
				srcfile = srcfile.replace('webpack://source.maps', '', srcfile);
				var match = /^\/node_modules\/([^\/]+)/.exec(srcfile);
				if (match == null) {
					match = /^(\/src\/.*\.js)(\?.*)?/.exec(srcfile);
					if (match != null) {
						// project source file
						srcfile = match[1];
						_.each(cleanupRules, function (to, from) {
							srcfile = srcfile.replace(from, to);
						});

						// the sources are in random order in the map file,
						// so we'll need to sort before displaying anything
						sourcefiles.push(srcfile);
					}
				}
				else {
					// dependency
					var pkg = match[1];
					if (dependencies.indexOf(pkg) == -1) {
						dependencies.push(pkg);
					}
				}
			});

			sourcefiles.sort();
			_.each(sourcefiles, function (srcfile) {
				console.log("  " + srcfile);
			});

			if (dependencies.length > 0) {

				console.log("\n  ---- 3rd Party ------------------\n");

				dependencies.sort();
				_.each(dependencies, function (pkg) {
					console.log("  " + pkg);
				});
			}
		}

		console.log("\n\n");

		resolve();
	}).then(null, console.log.bind(console));
}

var listmap = function (conf, resolve, cleanupRules) {
	var promises = [];
	glob(conf.output.path + '/*.map', {}, function (er, files) {
		_.each(files, function (file) {
			promises.push(debugWebpackMapFile(file, cleanupRules));
		});
	});

	Promise.all(promises)
		.then(function () {
			resolve()
		}, console.log.bind(console));
};

var normalizeMaps = function (conf, resolve) {
	glob(conf.output.path + '/*.map', {}, function (er, files) {
		var Contracts = [];
		_.each(files, function (file) {
			Contracts.push(replaceInFile(file, [
				[ /\/~/g, '/node_modules' ],
				[ /\.\//g, ''],
				[ /source-code\/\(webpack\)/g, 'source.maps/webpack/internal' ]
			]));
		});

		Contract.all(Contracts)
			.then(function () {
				resolve()
			}, console.log.bind(console));
	});
};

var logger = function (conf, resolve) {
	return function (err, stats) {
		if (err) throw new gutil.PluginError('webpack', err);

		gutil.log('[webpack]', stats.toString({
			chunks: false, // prints every single file built
			colors: true
		}));

		var sourceMapsEnabled = /source-map/;
		if (conf.devtool != null && sourceMapsEnabled.test(conf.devtool)) {
			normalizeMaps(conf, resolve);
		}
		else { // development source maps
			resolve();
		}
	}
};

module.exports = {

	configure: function (conf) {

		if (conf.context == null) {
			conf.context = process.cwd();
		}

		if (conf.plugins == null) {
			conf.plugins = [];
		}

		if (conf.module == null) {
			conf.module = {};
		}

		if (conf.module.loaders == null) {
			conf.module.loaders = [];
		}

		if (conf.resolve == null) {
			conf.resolve = {};
		}

		if (conf.resolve.extensions == null) {
			conf.resolve.extensions = [ '', '.js' ];
		}

		if (conf.output == null) {
			conf.output = {
				path: 'public/web',               // where to place files
				publicPath: '/web/',              // url prefix when loading
				filename: '[name].js',            // how to name entry points
				chunkFilename: 'pagejs.[id].js'   // how to name chunks
			};
		}

		if (conf.output.filename == null) {
			conf.output.filename = '[name].js';
		}

		if (conf.output.chunkFilename == null) {
			conf.output.chunkFilename = 'pagejs.[id].js';
		}

		if (conf.output.sourceMapFilename == null) {
			conf.output.sourceMapFilename = '[file].map';
		}

		if (conf.output.devtoolModuleFilenameTemplate == null) {
			conf.output.devtoolModuleFilenameTemplate = "webpack://source.maps/[resource-path]";
		}

		if (conf.output.devtoolFallbackModuleFilenameTemplate == null) {
			conf.output.devtoolFallbackModuleFilenameTemplate = "webpack://source.maps/[resource-path]?[hash]";
		}

		conf.module.loaders.push({
			test: /\.json$/,
			loader: 'json-loader'
		});

		conf.plugins.push(new plugin.Dedupe);

		if (env == 'production') {
			conf.devtool = 'source-map';

			conf.plugins.push (
				new plugin.Define({
					'process.env': {
						NODE_ENV: '"production"'
					}
				})
			);

			conf.plugins.push (
				new plugin.UglifyJs({
					sourceMap: true,
					mangle: true,
					compress: {
						warnings: false
					},
					output: {
						comments: false
					}
				})
			);
		}
		else { // assume development
			conf.devtool = 'eval';
			conf.output.pathinfo = true;
		}
	},

	reactify: function (conf) {
		conf.module.loaders.push({
			test: /\.jsx$/,
			loader: 'jsx-loader'
		});

		conf.resolve.extensions.push('.jsx');
	},

	build: function (conf, resolve) {
		conf.watch = false;
		webpack(conf, logger(conf, resolve));
	},

	watch: function (conf, resolve) {
		conf.watch = true;
		conf.cache = true;
		webpack(conf, logger(conf, resolve));
	},

	list: listmap
}
