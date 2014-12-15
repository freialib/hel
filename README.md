The [Hel](http://en.wikipedia.org/wiki/Hel_%28being%29) library allows
bypassing technical complications in common patterns.

The motivation behind the library is to abstract away lot of the boilerplate
by packaging patterns into easy to use functions.

```sh
npm install hel
```

For `package.json` projects install with `npm i -D hel` and uninstall
with `npm rm -D hel`

## Gulp Task Patterns

Tools like `gulp` are simple. Streams transforms are (usually) simple. But the
combination of all the transforms, different incompatible streams involved,
"vinyl" filesystem, is complicated to stitch togheter to do what is,
conceptually, a "simple" objective.

It's even harder to get an optimal solution, especially when most of the
technology involved will probably be of little use to you for anything else
you're probably doing beyond creating this one task you need.

If you have a very specialized case then we recomend you read up on the tools
involved and cook up your own poison. But if your needs fall in one of these
patterns it's probably easier to use `hel` to do the heavy lifting for you.

For all examples we'll include full reproduction code. The only thing we don't
include is the part where you create a project directory and `cd` into it. We
assume at the start of every example the current working directory is the
project root.

Lastly, also use the shorthand sytnax where we can, it's easier to read:

 - `npm i -S` is equivalent to `npm install --save`
 - `npm i -D` is equivalent to `npm install --save-dev`

### Pattern: Single entry point, with transforms

In `hel` this is referred to as the `mainjs` pattern and available
though `hel.tasks.mainjs`

The target scenario is that you have a single entry point (we'll use `main.js`
in our examples) for all your scripts and just wish to compile from a source
`main.js` file to a publicly consumable `main.js` file; potentially applying
some transforms along the way and potentially building libraries to a seperate
file to your main source tree.

***Forking The Task***

You can find the source for this task pattern in `node_modules/hel/gulp/mainjs.js`.

If you need something just a bit more complicated then what we provide feel
free to use it as a boilerplate. We recomend placing complicated tasks such as
this in a specialized `tasks/` directory rather then having a
monolithic `gulpfile.js`.

```sh
mkdir tasks
cp node_modules/hel/gulp/mainjs.js tasks/mainjs.js
```


#### Simple Usage Example

Everything from the source `main.js` and it's dependency graph goes into the
destination `main.js`.

Libraries are bundled with your `main.js` destination file in this example.

Files are cached during compilation so when you change one file only that
file is re-recompiled, not the entire dependency graph.

```sh
mkdir -p src/client/node_modules
touch src/client/node_modules/main.js
echo "{}" > package.json
npm i -D gulp@3.8
npm i -D hel@1.0
edit gulpfile.js
```
```js
var gulp = require('gulp');
var hel  = require('hel/gulp');
// ----------------------------------------------------------------------------

hel.tasks.mainjs({
    main : './src/client/node_modules/main.js',  // entry point
    dest : './public/web/main.js',               // consumer file
});

// Control Tasks
// -------------

gulp.task('build', [
    'build:libraryjs',
    'build:mainjs'
]);

gulp.task('default', [ 'build' ], function () {
    gulp.watch('src/**/*.js', [ 'watch:mainjs' ]);
});

```

#### Complex Usage Example

Like above with the difference that,

- libraries you specify in `require` will be bundled in a seperate
  file. You still use them as you normally would (eg. `require('lodash')`) but
  the code for them exists in a seperate file. Easier for debugging purposes
  since only your source tree is compiled to the destination `main.js` file;
  browsers like IE8 will therefore have a easier time parsing in debug mode

- transforms are applied to the bundle pipeline; in our example ES6 features
  and JSX syntax (ie. React syntax) are enabled, but you can add whatever
  transforms suit your needs


```sh
mkdir -p src/client/node_modules
touch src/client/node_modules/main.js
echo "{}" > package.json
npm i -D gulp@3.8
npm i -D hel@1.0
npm i -D es6ify@1.6
npm i -D reactify@0.17
npm i -S lodash
npm i -S react
edit gulpfile.js
```
```js
var gulp = require('gulp');
var hel  = require('hel/gulp');
// ----------------------------------------------------------------------------

var reactify = require('reactify');
var es6ify   = require('es6ify');

hel.tasks.mainjs({

    main : './src/client/node_modules/main.js',  // entry point
    dest : './public/web/main.js',               // consumer file
    libs : './public/web/library.js',            // 3rd-party bundle

    require: [
    	'lodash',
		'react'
	],

    transforms: function (bundler) {
		bundler.add(es6ify.runtime);
		bundler.transform(reactify);
		bundler.transform(es6ify);
	},

});

// Control Tasks
// -------------

gulp.task('build', [
    'build:libraryjs',
    'build:mainjs'
]);

gulp.task('default', [ 'build' ], function () {
    gulp.watch('src/**/*.js', [ 'watch:mainjs' ]);
});

```

Don't want to bother updating the `require` array above every time you add a
new depdendency?

There is a simple solution, just read your dependencies from your
`package.json` then your build process will be in sync with it so long as you
add all dependencies to it via `npm install --save` or the shorthand
`npm i -S`. Note that while `require('./package.json').dependencies` also
works it potentially has some caching issues, the following `fs` method will
always work as expected on the other hand.

```js
var gulp = require('gulp');
var hel = require('hel/gulp');
var fs = require('fs');
// ----------------------------------------------------------------------------

var reactify = require('reactify');
var es6ify   = require('es6ify');

var pkg = JSON.parse(fs.readFileSync('./package.json'));

hel.tasks.mainjs({

	main : './src/client/node_modules/main.js',  // entry point
	dest : './public/web/main.js',               // consumer file
	libs : './public/web/library.js',            // 3rd-party bundle

	require: Object.keys(pkg.dependencies),

    transforms: function (bundler) {
		bundler.add(es6ify.runtime);
		bundler.transform(reactify);
		bundler.transform(es6ify);
	}

});

// Control Tasks
// -------------

gulp.task('build', [
	'build:libraryjs',
	'build:mainjs'
]);

gulp.task('default', [ 'build' ], function () {
	gulp.watch('src/**/*.js', [ 'watch:mainjs' ]);
});

```
Given the above, to create production code,
```sh
gulp build
```
When doing development code (source maps, etc),
```sh
NODE_ENV=development gulp build
```

Or, to avoid setting `NODE_ENV` every run,
```sh
export NODE_ENV=development
gulp build
```

*Due to current limitations polyfills won't be applied to development code. So
if you need to test on browsers like IE8 you'll need to use the production
version.*

#### Advance Usage Example

Almost everything you can customize.

```sh
mkdir -p src/client/node_modules
touch src/client/node_modules/main.js
echo "{}" > package.json
npm i -D gulp@3.8
npm i -D hel@1.0
npm i -D es6ify@1.6
npm i -D reactify@0.17
npm i -D vinyl-source-stream
npm i -D vinyl-transform
npm i -D browserify
npm i -D watchify
npm i -D uglify-js
npm i -D exorcist
npm i -S lodash
npm i -S react
edit gulpfile.js
```

```js
var gulp = require('gulp');
var hel  = require('hel/gulp');
var fs   = require('fs');
var _    = require('lodash');
// ----------------------------------------------------------------------------

var pkg = JSON.parse(fs.readFileSync('./package.json'));

var reactify = require('reactify');
var es6ify   = require('es6ify');

hel.tasks.mainjs({

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

	require: _.merge(Object.keys(pkg.dependencies), {
		'react/addons' // required for require('react/addons')
	}),

	// Autopolyfiller
	// --------------

	polyfills: {
		// empty
	},

	// Transforms (Optional)
	// ---------------------

	transforms: function (bundler) {
		bundler.add(es6ify.runtime);
		bundler.transform(reactify);
		bundler.transform(es6ify);
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
		'gulp-autopolyfiller': require('gulp-autopolyfiller'),
		'vinyl-source-stream': require('vinyl-source-stream'),
        'vinyl-transform': require('vinyl-transform'),
		'browserify': require('browserify'),
		'watchify': require('watchify'),
		'uglify-js': require('uglify-js'),
        'exorcist': require('exorcist')
	},

	// Feature Switches
	// ----------------

	// Use these switches to enable features that are supported but disabled
	// due to bugs or inconsistent behavior; if you find a fork/patched version
	// of a dependency that will work for you stick it in [use] and enable it.

	// If a fork/patched version of another dependency causes conflicts you can
	// selectively disable certain features to avoid inter-tool compatibility,
	// if one cog in the process is more important then the other

	features: {

		// always use browserify directly
		watchify: false,

	}

});

// Control Tasks
// -------------

gulp.task('build', [
	'build:libraryjs',
	'build:mainjs'
]);

gulp.task('default', [ 'build' ], function () {
	gulp.watch('src/**/*.js', [ 'watch:mainjs' ]);
});

```