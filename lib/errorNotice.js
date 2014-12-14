var notify = require('gulp-notify');

var errorNotice = function () {
	var args = Array.prototype.slice.call(arguments);
	notify.onError({
		title: "Compile Error",
		message: "<%= error.message %>"
	}).apply(this, args);
	this.emit('end');
};

module.exports = errorNotice;
