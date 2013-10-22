'use strict';
/*globals describe: true, beforeEach: true, it: true, should: true, passErrorToCallback: true */
describe('Router', function () {

    var request = require('supertest'),
        connect = require('connect'),
        router  = require('../'),
        view = {},
        app;

    beforeEach(function () {

        app = connect();
        process.env.NODE_ENV = 'test';
    });

    it('is passed through to app.use, with config argument', function () {

        app.use(router({ }));

    });

    it('exposes a `.route` property through exports, so it can be required in', function () {

        app.use(router({ }));

        router.route
            .should.be.a('function');

        router.resource
            .should.be.a('function');

    });

    it('has an alias for `.route` as `.route.route`', function () {

        app.use(router({ app: app }));

        router.route
            .should.be.a('function');

        router.route.route
            .should.equal(router.route);

    });

    describe('public helpers', function () {

        describe('.getAllowedMethods', function () {
            beforeEach(function () {
                app.use(router({ app: app }));

                view.show = function (req, res) {
                    res.statusCode = 200;
                    res.setHeader('x-foo', 2);
                    res.end('bar');
                };

                router.route('/x/y/z', view, 'show', 'get');
            });

            it('returns an array of methods that have an explictly defined route', function () {

                router.getAllowedMethods('/x/y/z')
                    .should.deep.equal(['GET', 'HEAD']);

            });

            it('is calculated imperatively, allowing for additional routes at runtime', function () {

                router.route('/x/y/z', view, 'destroy', 'DELETE');

                router.getAllowedMethods('/x/y/z')
                    .should.deep.equal(['GET', 'HEAD', 'DELETE']);

            });

            it('can be passed a RegExp route', function () {

                router.getAllowedMethods(/^\/x\/y\/z\/?$/)
                    .should.deep.equal(['GET', 'HEAD']);

            });

            it('can be passed a request object route', function () {

                var req = {
                    route: {
                        regexp: /^\/x\/y\/z\/?$/
                    }
                };

                router.getAllowedMethods(req)
                    .should.deep.equal(['GET', 'HEAD']);

            });

        });

        describe('.urlFor', function () {
            beforeEach(function () {
                app.use(router({ app: app }));

                view = {
                    name: 'myview',
                    show: function () {},
                    foo: function () {},
                    bar: function () {},
                    baz: function () {},
                    bing: function () {}
                };

                router.route('/x/y/z', view, 'show', 'GET');
                router.route('/x/y/:name/:age', view, 'foo', 'GET');
                router.route('/a/b/:name/:other?', view, 'bing', 'GET');
                router.route('/x/y/z/*', view, 'bar', 'GET');
                router.route(/^\/(\w)\/(\w)\/(\w)\/?$/, view, 'baz', 'GET');
            });

            it('returns a string url pointing to the controller method', function () {

                router.urlFor(view, 'show')
                    .should.equal('/x/y/z');

            });

            it('returns a string url pointing to the controller method where first arg is view name', function () {

                router.urlFor('myview', 'show')
                    .should.equal('/x/y/z');

            });

            it('returns a string url that includes named arguments or parameters', function () {

                router.urlFor(view, 'foo')
                    .should.equal('/x/y/:name/:age');

                router.urlFor(view, 'bar')
                    .should.equal('/x/y/z/*');

            });

            it('returns a RegExp route as an interpolated string url', function () {

                router.urlFor(view, 'baz')
                    .should.equal('/:0/:1/:2/');

            });

            describe('with parameters', function () {

                it('interpolates named parameters against the url', function () {

                    router.urlFor(view, 'foo', { name: 'bob', age: '21' })
                        .should.equal('/x/y/bob/21');

                });

                it('combines additional arguments to use in the url', function () {

                    router.urlFor(view, 'foo', { name: 'bob' }, { age: '21' })
                        .should.equal('/x/y/bob/21');

                });

                it('appends additional arguments to the wildcard', function () {

                    router.urlFor(view, 'bar', 'foobarbaz', 'bing', 'bop')
                        .should.equal('/x/y/z/foobarbaz/bing/bop');

                });

                it('appends a named wildcard element to the wildcard, overriding additional arguments', function () {

                    router.urlFor(view, 'bar', 'foobarbaz', { '*': 'bob' })
                        .should.equal('/x/y/z/bob');

                });

                it('interpolates RegExp urls to strings including argument combinations', function () {

                    router.urlFor(view, 'baz', 'a', 'b', 'c')
                        .should.equal('/a/b/c/');

                    router.urlFor(view, 'baz', ['a', 'b'], 'c')
                        .should.equal('/a/b/c/');

                    router.urlFor(view, 'baz', 'a', ['b', 'c'])
                        .should.equal('/a/b/c/');

                });

            });

        });




    });

    describe('.route', function () {

        beforeEach(function () {
            app.use(router({ app: app }));

            view.respond = function (req, res) {
                res.statusCode = 200;
                res.setHeader('x-foo', 1);
                res.end('foo');
            };

            view.show = function (req, res) {
                res.statusCode = 200;
                res.setHeader('x-foo', 2);
                res.end('bar');
            };
        });

        describe('basic routing', function () {

            it('allows binding of routes', function (next) {

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/y/z')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('allows lower case HTTP verbs', function (next) {

                router.route('/x/y/z', view, 'respond', 'get');

                request(app).get('/x/y/z')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('only matches the path', function (next) {

                router.route('/x/y/z', view, 'respond', 'get');

                request(app).get('/x/y/z?v=1&x=2')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('will throw an error when using an invalid HTTP verb', function () {
                var fn;

                (fn = function () { router.route('/x/y/z', view, 'respond', 'FOO'); })
                    .should.throw('Invalid HTTP method: FOO');

            });

            it('accepts regular expressions as the route', function (next) {

                router.route(/^\/x\/y\/z$/i, view, 'respond', 'GET');

                request(app).get('/x/y/z')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('passes req, res and next functions to the method', function (next) {

                router.route('/x/y/z', view, 'respond', 'GET');

                view.respond = function (request, response, next) {

                    request
                        .should.be.an('object');

                    response
                        .should.be.an('object');

                    next
                        .should.be.a('function');

                    next();
                };

                request(app).get('/x/y/z')
                    .expect(404)
                    .end(next);

            });

            it('will default the HTTP verb to GET, if omitted', function (next) {

                router.route('/x/y/z', view, 'respond');

                request(app).get('/x/y/z')
                    .expect(200)
                    .end(next);

            });

            it('will default the HTTP verb to GET, and the action to `show` if both are omitted', function (next) {

                router.route('/x/y/z', view);

                request(app).get('/x/y/z')
                    .expect(200)
                    .expect('x-foo', '2')
                    .expect('bar')
                    .end(next);

            });

            it('is only bound to that exact route', function (next) {

                app.use(connect.errorHandler());

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/y/z/a')
                    .expect(404)
                    .end(next);

            });

            it('will 405 if given a different HTTP verb', function (next) {

                router.route('/x/y/z', view, 'respond', 'PUT');
                app.use(connect.errorHandler());

                request(app).get('/x/y/z').expect(405).expect('Allow', 'PUT').end(next);

            });

            it('can be bound to multiple verbs, and only one verb\'s method will fire', function (next) {

                router.route('/x/y/z', view, 'respondPut', 'PUT');
                router.route('/x/y/z', view, 'respondGet', 'GET');
                app.use(connect.errorHandler());

                view.respondPut = function (req, res) {
                    res.statusCode = 200;
                    res.end('Put');
                };

                view.respondGet = function (req, res) {
                    res.statusCode = 200;
                    res.end('Get');
                };

                request(app).get('/x/y/z').expect(200).expect('Get').end(function () {
                    request(app).put('/x/y/z').expect(200).expect('Put').end(next);
                });

            });

            it('can be bound to multiple verb, and requests to other verbs will 405 with correct Allow header', function (next) {

                router.route('/x/y/z', view, 'respondPut', 'PUT');
                router.route('/x/y/z', view, 'respondGet', 'GET');
                app.use(connect.errorHandler());

                view.respondPut = function (req, res) {
                    res.statusCode = 200;
                    res.end('Put');
                };

                view.respondGet = function (req, res) {
                    res.statusCode = 200;
                    res.end('Get');
                };

                request(app).post('/x/y/z').expect(405).expect('Allow', 'GET, PUT').end(next);

            });

        });

        describe('case sensitivity', function () {

            it('will be insensitive by default', function (next) {

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/Y/z')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('will be sensitive when configured with urlsCaseSensitive: true', function (next) {

                app.use(router({ urlsCaseSensitive: true }));

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/Y/z')
                    .expect(404)
                    .end(next);

            });

        });

        describe('trailing slashes', function () {

            it('will be be allowed and matched by default', function (next) {

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/y/z/')
                    .expect(200)
                    .expect('x-foo', '1')
                    .expect('foo')
                    .end(next);

            });

            it('will not be matched with when configured with urlsAllowTrailingSlashes: true is passed', function (next) {

                app.use(router({ urlsAllowTrailingSlashes: true }));

                router.route('/x/y/z', view, 'respond', 'GET');

                request(app).get('/x/y/z/')
                    .expect(404)
                    .end(next);

            });

        });

        describe('with parameters', function () {

            it('injects named parameters into req.params', function (next) {

                router.route('/x/y/:name/:age', view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {
                    req.params
                        .should.be.an('array');

                    req.params.name
                        .should.equal('foo');

                    req.params.age
                        .should.equal('21');

                    res.end('');

                });

                request(app).get('/x/y/foo/21').end(next);

            });

            it('does not match URLs with incomplete parameter sets', function (next) {

                router.route('/x/y/:name/:age', view, 'respond', 'GET');

                request(app).get('/x/y/foo').expect(404).end(next);

            });

            it('decodes URI encoded parameters', function (next) {

                router.route('/x/y/:name', view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {
                    req.params
                        .should.be.an('array');

                    req.params.name
                        .should.equal('hey,foo=:D');

                    res.end('');

                });

                request(app).get('/x/y/hey%2Cfoo%3D%3AD').end(next);

            });

            it('injects non-named parameters into req.params as array values', function (next) {

                router.route('/x/y/*', view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {

                    req.params
                        .should.be.an('array');

                    req.params
                        .should.deep.equal(['foo/bar/baz/']);

                    res.end('');

                });

                request(app).get('/x/y/foo/bar/baz/').end(next);

            });

            it('injects regex match groups into req.params with indexes', function (next) {

                router.route(/^\/(\w)\/(\w)\/(\w)\/?$/, view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {

                    req.params
                        .should.be.an('array');

                    req.params
                        .should.deep.equal(['foo', 'bar', 'baz']);

                    res.end('');

                });

                request(app).get('/foo/bar/baz/').end(next);

            });

        });

        describe('with optional parameters', function () {

            it('will route to urls with optional parameters being supplied', function (next) {

                router.route('/x/y/:name/:other?', view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {

                    req.params
                        .should.be.an('array');

                    req.params.name
                        .should.equal('foo');

                    req.params.other
                        .should.equal('bar');

                    res.end('');

                });

                request(app).get('/x/y/foo/bar').end(next);

            });

            it('will route to urls without the optional parameters being supplied', function (next) {

                router.route('/x/y/:name/:other?', view, 'respond', 'GET');

                view.respond = passErrorToCallback(next, function (req, res) {

                    req.params
                        .should.be.an('array');

                    req.params.name
                        .should.equal('foo');

                    should.not.exist(req.params.other);

                    res.end('');

                });

                request(app).get('/x/y/foo').end(next);

            });

        });

        describe('special cases', function () {

            describe('if request method is HEAD', function () {

                it('will call the GET route', function (next) {

                    router.route('/x/y/z', view, 'respond', 'GET');

                    request(app).head('/x/y/z')
                        .expect(200)
                        .expect('x-foo', '1')
                        .expect('')
                        .end(next);

                });

                it('can be overriden', function (next) {

                    view.getHead = function (req, res) {
                        res.setHeader('x-foo', 'foo');
                        res.setHeader('x-head-request', 'true');
                        res.end('');
                    };

                    router.route('/x/y/z', view, 'respond', 'GET');
                    router.route('/x/y/z', view, 'getHead', 'HEAD');

                    request(app).head('/x/y/z')
                        .expect(200)
                        .expect('x-foo', 'foo')
                        .expect('x-head-request', 'true')
                        .end(next);

                });

            });

        });

    });

    describe('.resouces', function () {

        beforeEach(function () {
            app.use(router({ app: app }));
            view = {
                list: function (req, res) { res.end('list'); },
                new: function (req, res) { res.end('new'); },
                create: function (req, res) { res.end('create'); },
                show: function (req, res) { res.end('show:' + req.params.id); },
                edit: function (req, res) { res.end('edit:' + req.params.id); },
                update: function (req, res) { res.end('update:' + req.params.id); },
                destroy: function (req, res) { res.end('destroy:' + req.params.id); }
            };
            router.route.resources('/x/y/z', view);
            app.use(connect.errorHandler());
        });

        it('binds a route of the URL as a GET to controller#list', function (next) {

            request(app).get('/x/y/z').expect(200).expect('list').end(next);

        });

        it('binds a route of the URL + "/new" as a GET to controller#new', function (next) {

            request(app).get('/x/y/z/new').expect(200).expect('new').end(next);

        });

        it('binds a route of the URL as a POST to controller#create', function (next) {

            request(app).post('/x/y/z').expect(200).expect('create').end(next);

        });

        it('binds a route of the URL + an ID as a GET to controller#show', function (next) {

            request(app).get('/x/y/z/foo').expect(200).expect('show:foo').end(next);

        });

        it('binds a route of the URL + an ID + "/edit" as a GET to controller#edit', function (next) {

            request(app).get('/x/y/z/foo/edit').expect(200).expect('edit:foo').end(next);

        });

        it('binds a route of the URL + an ID as a PUT to controller#update', function (next) {

            request(app).put('/x/y/z/foo').expect(200).expect('update:foo').end(next);

        });

        it('binds a route of the URL + an ID as a PATCH to controller#update', function (next) {

            request(app).patch('/x/y/z/foo').expect(200).expect('update:foo').end(next);

        });

        it('binds a route of the URL + an ID as a DELETE to controller#destroy', function (next) {

            request(app).del('/x/y/z/foo').expect(200).expect('destroy:foo').end(next);

        });

        it('returns a 405 for POSTing to the URL + "/new"', function (next) {

            request(app).post('/x/y/z/new').expect(405).end(next);

        });

        it('returns a 405 for DELETEing to the URL + "/new"', function (next) {

            request(app).post('/x/y/z/new').expect(405).end(next);

        });

        it('returns a 405 for PUTing to the URL ', function (next) {

            request(app).put('/x/y/z').expect(405).end(next);

        });

        it('returns a 405 for DELETEing to the URL ', function (next) {

            request(app).del('/x/y/z').expect(405).end(next);

        });

        it('returns a 405 for POSTing to the URL + ID', function (next) {

            request(app).post('/x/y/z/foo').expect(405).end(next);

        });

        it('only binds routes if the function is present', function (next) {

            delete view.destroy;
            router(); // Reconfigure and empty existing routes
            router.route.resources('/x/y/z', view);

            request(app).del('/x/y/z/foo').expect(405).end(next);

        });

        it('only binds routes if the function is present', function (next) {

            delete view.edit;
            router(); // Reconfigure and empty existing routes
            router.route.resources('/x/y/z', view);

            request(app).del('/x/y/z/bar/edit/').expect(404).end(next);

        });

    });

    describe('.resouce', function () {

        beforeEach(function () {
            app.use(router({ app: app }));
            view = {
                new: function (req, res) { res.end('new'); },
                create: function (req, res) { res.end('create'); },
                show: function (req, res) { res.end('show'); },
                edit: function (req, res) { res.end('edit'); },
                update: function (req, res) { res.end('update'); },
                destroy: function (req, res) { res.end('destroy'); }
            };
            router.route.resource('/x/y/z', view);
            app.use(connect.errorHandler());
        });

        it('binds a route of the URL as a GET to controller#show', function (next) {

            request(app).get('/x/y/z').expect(200).expect('show').end(next);

        });

        it('binds a route of the URL + "/new" as a GET to controller#new', function (next) {

            request(app).get('/x/y/z/new').expect(200).expect('new').end(next);

        });

        it('binds a route of the URL as a POST to controller#create', function (next) {

            request(app).post('/x/y/z').expect(200).expect('create').end(next);

        });

        it('binds a route of the URL + "/edit" as a GET to controller#edit', function (next) {

            request(app).get('/x/y/z/edit').expect(200).expect('edit').end(next);

        });

        it('binds a route of the URL as a PUT to controller#update', function (next) {

            request(app).put('/x/y/z').expect(200).expect('update').end(next);

        });

        it('binds a route of the URL as a DELETE to controller#destroy', function (next) {

            request(app).del('/x/y/z').expect(200).expect('destroy').end(next);

        });

        it('returns a 404 for GETing to the URL + ID', function (next) {

            request(app).get('/x/y/z/foo').expect(404).end(next);

        });

        it('returns a 404 for POSTing to the URL + ID', function (next) {

            request(app).post('/x/y/z/foo').expect(404).end(next);

        });

        it('returns a 404 for PUTing to the URL + ID', function (next) {

            request(app).put('/x/y/z/foo').expect(404).end(next);

        });

        it('returns a 404 for PATCHing to the URL + ID', function (next) {

            request(app).patch('/x/y/z/foo').expect(404).end(next);

        });

        it('returns a 404 for DELETEing to the URL + ID', function (next) {

            request(app).del('/x/y/z/foo').expect(404).end(next);

        });

        it('returns a 405 for POSTing to the URL + "/new"', function (next) {

            request(app).post('/x/y/z/new').expect(405).end(next);

        });

        it('returns a 405 for DELETEing to the URL + "/new"', function (next) {

            request(app).post('/x/y/z/new').expect(405).end(next);

        });

    });

});
