var webpack  = require('webpack');
// ----------------------------------------------------------------------------

var env = process.env.NODE_ENV != null ? process.env.NODE_ENV : 'production';

var logger = require('./lib/logger');
var listMap = require('./lib/listMap');
var l = require('lodash');

// ============================================================================

var plugin = {
	Define   : webpack.DefinePlugin,
	UglifyJs : webpack.optimize.UglifyJsPlugin,
	Dedupe   : webpack.optimize.DedupePlugin,
	Commons  : webpack.optimize.CommonsChunkPlugin
};

var WebpackHelInstance = function (conf) {

	this.conf = l.merge({

		context: process.cwd(),

		entry: {
			// empty
		},

		output: {
			filename: '[name].js',
			path: 'public/web',  // where to place files
			publicPath: '/web/', // url prefix when loading
			chunkFilename: 'pagejs.[id].[chunkhash].js',
			sourceMapFilename: '[file].map',
			devtoolModuleFilenameTemplate: 'webpack://source.maps/[resource-path]',
			devtoolFallbackModuleFilenameTemplate: 'webpack://source.maps/[resource-path]?[hash]'
		},

		resolve: {
			extensions: [ '', '.js', '.jsx' ]
		},

		module: {
			loaders: [
				{
					loader: 'babel-loader',
					test: /\.jsx?$/,
					query: {
						presets: [ 'es2015', 'react' ]
					}
				},
				{
					loader: 'json-loader',
					test: /\.json$/
				}
			]
		},

		plugins: [
			
		]

	}, conf);

	this.conf.plugins.push(new plugin.Commons('libs.js', l.keys(conf.entry)))

	if (env == 'production') {
		this.conf.devtool = 'source-map';

		this.conf.plugins.push (
			new plugin.Define({
				'process.env': {
					NODE_ENV: '"production"'
				}
			})
		);

		this.conf.plugins.push (
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
		this.conf.devtool = 'eval';
		this.conf.output.pathinfo = true;
	}
};

WebpackHelInstance.prototype = {

	build: function (resolve) {
		this.conf.watch = false;
		webpack(this.conf, logger(this.conf, resolve));
	},

	watch: function (resolve) {
		this.conf.watch = true;
		this.conf.cache = true;
		webpack(this.conf, logger(this.conf, resolve));
	},

	debug: function (resolve, cleanupRules) {
		listMap(this.conf, resolve, cleanupRules)
	}

};

module.exports = {
	instance: function (conf) {
		return new WebpackHelInstance(conf);
	}
};
