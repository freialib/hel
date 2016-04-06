var Promise = require('lie');
var gutil = require('gulp-util');
var l = require('lodash');
var glob = require('glob');
var fs = require('fs');
// ----------------------------------------------------------------------------

var replaceInFile = require('./replaceInFile');

var debugWebpackMapFile = function (file, cleanupRules) {
	return new Promise(function (resolve, reject) {
		var match = /\/([^\/]+).js.map$/.exec(file);
		if (match != null) {
			var filename = match[1];
			console.log("\n  " + filename + "\n  =======================\n");
			var mapjson = JSON.parse(fs.readFileSync(file));

			var dependencies = [];
			var sourcefiles = [];

			l.each(mapjson.sources, function (srcfile) {
				srcfile = srcfile.replace('webpack://source.maps', '', srcfile);
				var match = /^\/node_modules\/([^\/]+)/.exec(srcfile);
				if (match == null) {
					match = /^(\/src\/.*\.js)(\?.*)?/.exec(srcfile);
					if (match != null) {
						// project source file
						srcfile = match[1];
						l.each(cleanupRules, function (to, from) {
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
			l.each(sourcefiles, function (srcfile) {
				console.log("  " + srcfile);
			});

			if (dependencies.length > 0) {

				console.log("\n  ---- 3rd Party ------------------\n");

				dependencies.sort();
				l.each(dependencies, function (pkg) {
					console.log("  " + pkg);
				});
			}
		}

		console.log("\n\n");

		resolve();
	}).then(null, console.log.bind(console));
}

module.exports = function (conf, resolve, cleanupRules) {
	var promises = [];
	glob(conf.output.path + '/*.map', {}, function (er, files) {
		l.each(files, function (file) {
			promises.push(debugWebpackMapFile(file, cleanupRules));
		});
	});

	Promise.all(promises)
		.then(function () {
			resolve()
		}, console.log.bind(console));
};
