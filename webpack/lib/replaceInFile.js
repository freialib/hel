var l = require('lodash');
var gutil = require('gulp-util');
var Promise = require('lie');
var fs = require('fs');

module.exports = function (file, toReplace) {
	return new Promise(function (resolve, reject) {
		fs.readFile(file, 'utf8', function (err, data, cb) {

			if (err) {
				gutil.log(err);
				reject();
				return;
			}

			l.each(toReplace, function (logic) {
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
