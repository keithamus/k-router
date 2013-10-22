//# K-Router

// > © Keith Cirkel
//
// > K-Router may be freely distributed under the MIT license.
//
// > For all details and documentation:
// > http://github.com/keithamus/k-router

// K-Router is a simple Class based router Connect middleware. In other words, it ehances the
// default Connect router (`app.use('/url', fn)`) to do more advanced routing to methods on instance
// object by `router.route('/url', controller, 'action', 'GET')`. The URLs work mostly like
// Expresses routing engine, it supports named and optional parameters, regex urls and can be bound
// to one HTTP verb at a time. It goes further than Expresses router in the following ways though:

//  - You always pass an instance object, followed by a function name - which allows for late
//    binding to the functions. By converse, Express has no kind of class binding, meaning you need
//    to manually do this.
//  - By specifying a URL route attached to a HTTP verb (e.g GET) all other verbs (e.g PUT POST
//    DELETE) return 405 errors. This is how your website **should** behave. Also, all 405s will
//    send a proper `Allow` header, saying what verbs are available. By converse, Express does
//    nothing with other verbs, and so they 404.
//  - It captures the 90% usecase by specifying `.router.resources('/url', controller)` and
//    `.router.resource('/url', controller)` which automatically binds REST pattern routes, very
//    similar to Rail's `Routing::Mapper::Resources`. By converse, Express does not offer this and
//    so you have to do these manually.

// Below is the heavily commented codebase for K-Router, which you can use for documentation.
// Failing that, you can also have a look at the [test generated documentation](test.html)

// K-Router is a singleton, and has a global config. The config comes with a complete set of
// sensible defaults, so no configuration needs to be used.
var parseUrl = require('url').parse,
    namedArgRegExp = /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g,
    config = {
        resourceActions: {
            list: 'list',
            new: 'new',
            create: 'create',
            show: 'show',
            edit: 'edit',
            update: 'update',
            destroy: 'destroy',
        },
        methods: {
            GET: true,
            HEAD: true,
            POST: true,
            PUT: true,
            DELETE: true,
            TRACE: true,
            OPTIONS: true,
            CONNECT: true,
            PATCH: true,
        },
        // errorHandlers
        errorHandler: function (req, res, next) {
            var verb = req.method,
                err = new Error('Method ' + verb + ' not defined on route');
            err.allow = getAllowedMethods(req);
            res.setHeader('Allow', err.allow.join(', '));
            res.statusCode = err.status = 405;
            return next(err);
        }
    };

// Helpers
// -------

// pathRegExp is a way to convert string paths (first argument of route/resource) into RegExps. It
// is totally stolen from Express to remain compatible with Expresses matchers.
function pathRegExp(path, keys) {
    if (path instanceof RegExp) return path;
    // Multiple string paths can be expressed as arrays
    if (Array.isArray(path)) path = '(' + path.join('|') + ')';
    path = path
        // If "strict" is false (default) then allow for trailing /
        .concat(config.strict ? '' : '/?')
        // So that match groups aren't messed up, turn any `/(` into `(?:/`
        .replace(/\/\(/g, '(?:/')
        // This is the core of named groups, fragments like `/:name` get converted to `/([^/]+?)`
        // and the key of "name" is recorded into `keys` so it can be loaded. It also has special
        // cases for extensions in urls (i.e "/whatever.:format") and wildcards like "/whatever/*"
        .replace(namedArgRegExp, function (_, slash, format, key, capture, optional, star) {
            keys.push({ name: key, optional: !! optional });
            slash = slash || '';
            return '' +
                (optional ? '' : slash) +
                '(?:' +
                (optional ? slash : '') +
                (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')' +
                (optional || '') +
                (star ? '(/*)?' : '');
        })
        // Escape all /s and .s as RegExp literal /s and .s
        .replace(/([\/.])/g, '\\$1')
        // Convert any wildcards to RegExp wildcards
        .replace(/\*/g, '(.*)');
    // If "sensitive" is false then make the RegExp case insensitive (//i)
    return new RegExp('^' + path + '$', config.sensitive ? '' : 'i');
}

// getAllowedMethods is a way to get a list of methods for an allowed route, useful for setting the
// `Allow` http header. The route (first argument) can be a String, RegExp or request object.
function getAllowedMethods(path) {
    // path is a RegExp
    if (path instanceof RegExp) {
        path = path.source;
    // path is a request object (aka `req`)
    } else if (path && path.route && path.route.regexp instanceof RegExp) {
        path = path.route.regexp.source;
    } else {
        path = pathRegExp(path).source;
    }
    var allow = [];
    for (var httpVerb in config.methods) {
        if (route.routes[httpVerb][path] && route.routes[httpVerb][path].controller !== config) {
            allow.push(httpVerb);
        }
    }
    return allow;
}

// urlFor is a way to get pass in a controller and action name (and optional set of params) and get
// a URL that will find its way to that controller's action. In essence, it's a route reverse lookup
function urlFor(controller, action) {
    var routeObj;
    if (!controller || !action) throw new Error('Expects controller and action');

    for (method in config.methods) {
        for (routeObj in route.routes[method]) {
            routeObj = route.routes[method][routeObj];
            if ((routeObj.controller === controller || routeObj.controller.name === controller) && routeObj.action === action) {
                return interpolateUrl(routeObj.path, Array.prototype.slice.call(arguments, 2));
            }
        }
    }

    return '';
}

function interpolateUrl(url, args) {
    args = flattenArguments(args);
    if (url instanceof RegExp) {
        i = 0;
        return url.source.replace(/^\^|\??\$$|(\\\/)|(\([^)]+\))/g, function (_, slash, group) {
            var ret = '';
            if (slash) {
                ret = '/';
            } else if (group) {
                ret = args[i] ? args[i] : ':' + i;
                i++;
            }
            return ret;
        });
    } else {
        return url.replace(namedArgRegExp, function (part, slash, format, key, capture, optional, star) {
            if (args[key]) {
                return '/' + args[key];
            }
            if (!args[key] && optional) {
                return '/';
            }
            return part;
        }).replace(/\/\*/g, function () {
            return '/' + (args['*'] ? args['*'] : (args.join('/') || '*'));
        });
    }
}

function flattenArguments(args) {
    if (!args.length) return [];
    args = args.reduce(function (sum, value, i) {
        if (!(value instanceof Array) && value === Object(value)) {
            for (name in value) {
                sum[name] = value[name];
            }
        } else {
            sum = sum.concat(value);
        }
        return sum;
    }, []);
    return args;
}

// Routing
// -------

// ### Route
// Route allows you to bind a `path` to an `controller.action` against an HTTP `verb`, for example
// `route('/user/:name', userController, 'show', 'GET');`
function route(path, controller, action, verb) {
    if (!action && !verb) {
        action = 'show';
        verb = 'GET';
    }
    // Clean up the verb name. Throw if it doesn't exist
    verb = verb ? verb.toUpperCase() : 'GET';
    if (!config.methods[verb]) throw new Error('Invalid HTTP method: ' + verb);

    // Build up the RegExp pathname (see above)
    var keys = [];
    var regexp = pathRegExp(path, keys);

    // Bind all routes to each of the HTTP verbs, attaching 405s to the other verbs not specified in
    // the params if they don't exist.
    for (var httpverb in config.methods) {
        // If a method is already attached (and its not the one we're explicitly trying to set),
        // then don't add one, otherwise just go ahead and add one in.
        if (httpverb !== verb && (route.routes[httpverb] || {})[regexp.source]) continue;
        if (httpverb === 'HEAD' && verb === 'GET') {
            route(path, controller, action, 'HEAD');
        } else {
            var routeObj = (route.routes[httpverb] || (route.routes[httpverb] = {}))[regexp.source] = {
                path: path,
                regexp: regexp,
                keys: keys
            };
            // Attach the controller & action to the HTTP verb supplied, but attach a 405 handler for
            // any other verb.
            routeObj.controller = httpverb === verb ? controller : config;
            routeObj.action = httpverb === verb ? action : 'errorHandler';
        }
    }
    // Return the function so multiple routes can be chained like:
    // `route(/*...*/)(/*...*/)(/*...*/)(/*...*/)
    return route;
}
// This allows users to use the syntax "route(/*...*/).route(/*...*/).route(/*...*/).route(/*...*/)"
// for people not adventurous to use the paren only syntax ( (/*...*/)(/*...*/) )
route.route = route;

// ### Resources

// Resources are a shortcut to declaring many routes. They follow the
// [CRUD](http://en.wikipedia.org/wiki/Crud) pattern, and are similar to how Rail's resources work.
// Resources come in two flavours, `.resource()` and `.resources()`. The plural `.resources()` binds
// the list, create, new, show, update, destroy, edit actions, while the singular `.resource()`
// binds the show, create, update, destroy, new, edit actions. If one of those actions doesn't exist
// on the controller, then the route isn't bound. See the handy table below for how these get mapped
// to different urls:

// #### Resources (Plural, `.resources()`)
// | Verb   | Url           | Controller Action  | Description                               |
// |:------:|:--------------|:------------------:|:------------------------------------------|
// | GET    | /url          | Controller#list    | Display a list of all items in a resource |
// | POST   | /url          | Controller#create  | Create a new item                         |
// | GET    | /url/new      | Controller#new     | HTML form for creating new items          |
// | GET    | /url/:id      | Controller#show    | Display a specific item                   |
// | PUT    | /url/:id      | Controller#update  | Update a specific item                    |
// | PATCH  | /url/:id      | Controller#update  | Update a specific item                    |
// | DELETE | /url/:id      | Controller#destroy | Delete a specific item                    |
// | GET    | /url/:id/edit | Controller#edit    | HTML form for editing an item             |
route.resources = function resource(url, controller, id) {
    id = id || ':id';
    var urlid = url + '/' + id, actions = config.resourceActions;
    if (controller[actions.list])    route(url, controller, actions.list, 'GET');
    if (controller[actions.create])  route(url, controller, actions.create, 'POST');
    if (controller[actions.new])     route(url + '/new', controller, actions.new, 'GET');
    if (controller[actions.show])    route(urlid, controller, actions.show, 'GET');
    if (controller[actions.update])  route(urlid, controller, actions.update, 'PUT');
    if (controller[actions.update])  route(urlid, controller, actions.update, 'PATCH');
    if (controller[actions.destroy]) route(urlid, controller, actions.destroy, 'DELETE');
    if (controller[actions.edit])    route(urlid + '/edit', controller, actions.edit, 'GET');
    return route;
};

// #### Resource (Singular, `.resource()`)
// | Verb   | Url       | Controller Action  | Description                               |
// |:------:|:----------|:------------------:|:------------------------------------------|
// | GET    | /url      | Controller#show    | Display the singular resource             |
// | POST   | /url      | Controller#create  | Create a new resource like this           |
// | PUT    | /url      | Controller#update  | Update a specific item                    |
// | PATCH  | /url      | Controller#update  | Update a specific item                    |
// | DELETE | /url      | Controller#destroy | Delete a specific item                    |
// | GET    | /url/new  | Controller#new     | HTML form for creating new items          |
// | GET    | /url/edit | Controller#edit    | HTML form for editing an item             |
route.resource = function resource(url, controller, id) {
    id = id || ':id';
    var actions = config.resourceActions;
    if (controller[actions.show])    route(url, controller, actions.show, 'GET');
    if (controller[actions.create])  route(url, controller, actions.create, 'POST');
    if (controller[actions.update])  route(url, controller, actions.update, 'PUT');
    if (controller[actions.update])  route(url, controller, actions.update, 'PATCH');
    if (controller[actions.destroy]) route(url, controller, actions.destroy, 'DELETE');
    if (controller[actions.new])     route(url + '/new', controller, actions.new, 'GET');
    if (controller[actions.edit])    route(url + '/edit', controller, actions.edit, 'GET');
    return route;
};

// Notes:

// - The New and Edit urls are used for presenting the user an HTML form, while the others are used
//   as HTML and API (e.g JSON or XML) responses.
// - The difference between PUT and PATCH (according to the RFC) is that PUT should take an entire
//   resource's data (i.e the whole record) while PATCH can update some or all parameters (i.e some
//   of the record). In reality this makes little difference, so both are routed to the same action.
// - If you don't like any of the action names, you can remap them using the configuration option
//   `resourceActions`. E.g:
//   ```javascript
//   app.use(router({ resouceActions: {
//     show: 'index', create: 'makenew', 'update': 'put'
//   }}))
//  ```

// MiddleWare
// ----------

// The dispatcher is the main component exposed in the middleware for Connect. It sits (ideally at
// the top) in middleware stack and waits for incomming requests, where it tries to match them up
// to a route. Failing that it hands of to the `next()` middleware.
function dispatcher(req, res, next) {
    var verb = req.method,
        url = parseUrl(req.url).pathname;

    // Because all of the routes are bound to the HTTP verb first, the array of acceptable routes
    // can be shrunk down significantly by using the HTTP verb.

    for (var name in route.routes[verb]) {
        var arg = route.routes[verb][name].regexp.exec(url);
        // Arg is either `null` (no match) or an `array` of atleast 1 (match)
        if (arg) {
            // The params get injected into the `route` object, which gets injected into the `req`
            // object, just like Express (so `req.route.params` works as well as `req.params`)
            req.route = route.routes[verb][name];
            req.params = req.route.params = [];
            // Build up the params list out from the RegExp and the keys of named parameters.
            for (var key, value, i = 1, l = arg.length; i < l; ++i) {
                // The match of arg[i] will either be a string or `undefined`. If it is a string,
                // decode it so rather than "foo%20bar" its "foo bar".
                value = arg[i] === undefined ? arg[i] : decodeURIComponent(arg[i]);
                // If it is a named parameter, add it to the array with its name, so it can be
                // used as `req.params.name`. If not, then push so it is `req.params[0]`
                if (key = req.route.keys[i - 1]) {
                    req.params[key.name] = value;
                } else {
                    req.params.push(value);
                }
            }
            // Dispatch the route, passing on all params.
            return req.route.controller[req.route.action](req, res, next);
        }
    }

    next();
}

// setupRoute organises the initial configuration and returns the dispatcher, exposing the
// dispatcher to the app using the typical paradigm `app.use(setupRoute({ /*config*/ }));`
// If the user attempts to reconfigure the router by running setupRoute again, it will flush any
// existing routes.
module.exports = function setupRoute(options) {
    options = options || {};
    config.sensitive = Boolean(options.urlsCaseSensitive);
    config.strict = Boolean(options.urlsAllowTrailingSlashes);
    config.errorHandler = options.urlMethodNotAllowedErrorHandler || config.errorHandler;
    for (var key in options.urlResourceActions || {}) {
        config.resourceActions[key] = options.urlResourceActions[key] || config.resourceActions[key];
    }
    route.routes = {};
    return dispatcher;
};

// Expose the routing functions to the user.
module.exports.route = route;
module.exports.resource = route.resource;
module.exports.resources = route.resources;
module.exports.getAllowedMethods = getAllowedMethods;
module.exports.urlFor = urlFor;
