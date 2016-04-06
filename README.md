The [Hel](http://en.wikipedia.org/wiki/Hel_%28being%29) library allows
bypassing technical complications in common patterns.

The motivation behind the library is to abstract away lot of the boilerplate
by packaging patterns into easy to use functions.

```sh
npm install hel
```

For `package.json` projects install with `npm i -D hel` and uninstall
with `npm rm -D hel`

#### Simplefied Webpack

The following helper functions will help you configure the boilerplate with
minimal effort. Note that the tasks are biased towards `gulp`

```js
var gulp = require('gulp');
// ----------------------------------------------------------------------------

// Javascript
// ==========

var hel = {
	webpack: require('hel/webpack')
};

var entryPath = './src/client/node_modules/Client/frontend';

var webpackConf = {
	
	entry: {
		home: entryPath + '/home.js',
	},

	output: {
		path: 'public/web',  // where to place files
		publicPath: '/web/', // url prefix when loading
	}

};

gulp.task('js', function (resolve) {
	hel.webpack
		.instance(webpackConf)
		.build(resolve);
});

gulp.task('watch:js', function (resolve) {
	hel.webpack
		.instance(webpackConf)
		.watch(resolve);
});

gulp.task('debug:js', function (resolve) {
	hel.webpack
		.instance(webpackConf)
		.debug(resolve, {
			'/src/client/node_modules/': ''
		});
});
```

`js` and `watch:js` do exactly what you would think. If you execute in a
development environment (ie. `NODE_ENV=development gulp`) optimizations will
happen so you get the fastest re-compilation possible. If no `NODE_ENV` is 
provided "production" will be assumed.

`debug:js` requires you to first build in production so as to generate source 
maps. Once you have them it will analyse them and tell you what each module 
uses, with your modules split from your 3rd party modules.

If you're interested in more analysis you may wish to check out,
http://webpack.github.io/analyse/ and 
https://www.npmjs.com/package/stats-webpack-plugin
