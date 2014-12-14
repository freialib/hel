var pathSplit = function (filepath) {
	var slash = filepath.lastIndexOf('/');
	var path  = filepath.slice(0, slash + 1);
	var name  = filepath.slice(slash + 1);

	return {
		path: path,
		name: name
	};
}

module.exports = pathSplit;
