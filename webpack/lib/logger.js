var Promise = require('lie');
var gutil = require('gulp-util');
var l = require('lodash');
var glob = require('glob');
// ----------------------------------------------------------------------------

var replaceInFile = require('./replaceInFile');

var normalizeMaps = function (conf, resolve) {
	glob(conf.output.path + '/*.map', {}, function (er, files) {
		var Contracts = [];
		l.each(files, function (file) {
			Contracts.push(replaceInFile(file, [
				[ /\/~/g, '/node_modules' ],
				[ /\.\//g, ''],
				[ /source-code\/\(webpack\)/g, 'source.maps/webpack/internal' ]
			]));
		});

		Promise.all(Contracts)
			.then(function () {
				resolve()
			}, console.log.bind(console));
	});
};

module.exports = function (conf, resolve) {
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
