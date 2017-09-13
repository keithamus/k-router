K-Router
----------

<a target='_blank' rel='nofollow' href='https://app.codesponsor.io/link/ygkcNhfZ9nTDeVM6P8LSGn1C/keithamus/k-router'>  <img alt='Sponsor' width='888' height='68' src='https://app.codesponsor.io/embed/ygkcNhfZ9nTDeVM6P8LSGn1C/keithamus/k-router.svg' /></a>

K-Router is a simple Class based router Connect middleware. In other words, it
ehances the default Connect router (`app.use('/url', fn)`) to do more advanced
routing to methods on instance object by
`router.route('/url', controller, 'action', 'GET')`. The URLs work mostly like
Expresses routing engine, it supports named and optional parameters, regex urls
and can be bound to one HTTP verb at a time. It goes further than Expresses
router in the following ways though:

 - You always pass an instance object, followed by a function name - which
   allows for late binding to the functions. By converse, Express has no kind of
   class binding, meaning you need to manually do this.
 - By specifying a URL route attached to a HTTP verb (e.g GET) all other verbs
   (e.g PUT POST DELETE) return 405 errors. This is how your website **should**
   behave. Also, all 405s will send a proper `Allow` header, saying what verbs
   are available. By converse, Express does nothing with other verbs, and so
   they 404.
 - It captures the 90% usecase by specifying `.router.resources('/url',
   controller)` and `.router.resource('/url', controller)` which automatically
   binds REST pattern routes, very similar to Rail's `Routing::Mapper::
   Resources`. By converse, Express does not offer this and so you have to do
   these manually.

Usage
-----

As it is a Middleware, you need to plug it into Connect or Express like so:

```javascript
var connect = require('connect'),
    router  = require('k-router');

// All configuration options are completely optional and have defaults.
var app = connect()
    .use(router({
        strict: false // Allows URLs to have trailing / in URLs. Default: false,
        sensitive: false // Makes URLs case sensitive. Default: false,
        errorHandlers: { // Default set of error handlers (come provided)
            405: <function>
        },
        resourceActions: { // Default set of resource action names (see resources)
            ...
        }
    }));
```

### Declaring routes

Normal routes mostly offer the same functionality you get from Express routes:

```javascript
// Require a "Controller" (MVC) or "View" (MVT) that is a proper class we will
// use for routing:
var ViewClass = require('./users.view.js'),
    router    = require('k-router');

router.route('/users/:id', ViewClass, 'showUser', 'GET')
      .route('/users/:id', ViewClass, 'editUser', 'PUT');
```

The above example will send GET requests to "/users/:id" to `ViewClass.showUser`
and PUT requests to that same url to `ViewClass.editUser`. For all other
requests to that URL (HEAD, POST, PUT, DELETE, TRACE, OPTIONS, CONNECT & PATCH)
it will respond with "405 - Method Not Allowed" with an `Allowed` header of
`GET, PUT`, [just like RFC2616 says][rfc2616].

### Declaring resources

Resources are a shortcut to declaring many routes. They follow the
[CRUD](http://en.wikipedia.org/wiki/Crud) pattern, and are similar to how Rail's resources work.
Resources come in two flavours, `.resource()` and `.resources()`. The plural `.resources()` binds
the list, create, new, show, update, destroy, edit actions, while the singular `.resource()`
binds the show, create, update, destroy, new, edit actions. If one of those actions doesn't exist
on the controller, then the route isn't bound. See the handy table below for how these get mapped
to different urls:

#### Resources (Plural, `.resources()`)
| Verb   | Url           | Controller Action  | Description                               |
|:------:|:--------------|:------------------:|:------------------------------------------|
| GET    | /url          | Controller#list    | Display a list of all items in a resource |
| POST   | /url          | Controller#create  | Create a new item                         |
| GET    | /url/new      | Controller#new     | HTML form for creating new items          |
| GET    | /url/:id      | Controller#show    | Display a specific item                   |
| PUT    | /url/:id      | Controller#update  | Update a specific item                    |
| PATCH  | /url/:id      | Controller#update  | Update a specific item                    |
| DELETE | /url/:id      | Controller#destroy | Delete a specific item                    |
| GET    | /url/:id/edit | Controller#edit    | HTML form for editing an item             |

#### Resource (Singular, `.resource()`)
| Verb   | Url       | Controller Action  | Description                               |
|:------:|:----------|:------------------:|:------------------------------------------|
| GET    | /url      | Controller#show    | Display the singular resource             |
| POST   | /url      | Controller#create  | Create a new resource like this           |
| PUT    | /url      | Controller#update  | Update a specific item                    |
| PATCH  | /url      | Controller#update  | Update a specific item                    |
| DELETE | /url      | Controller#destroy | Delete a specific item                    |
| GET    | /url/new  | Controller#new     | HTML form for creating new items          |
| GET    | /url/edit | Controller#edit    | HTML form for editing an item             |

Notes:

- The New and Edit urls are used for presenting the user an HTML form, while the others are used
  as HTML and API (e.g JSON or XML) responses.
- The difference between PUT and PATCH (according to the RFC) is that PUT should take an entire
  resource's data (i.e the whole record) while PATCH can update some or all parameters (i.e some
  of the record). In reality this makes little difference, so both are routed to the same action.
- If you don't like any of the action names, you can remap them using the configuration option
  `resourceActions`. E.g:
  ```javascript
  app.use(router({ resouceActions: {
    show: 'index', create: 'makenew', 'update': 'put'
  }}))
 ```


```javascript
// Require a "Controller" (MVC) or "View" (MVT) that is a proper class we will
// use for routing:
var UsersViewClass = require('./users.view.js'),
    PublicThingsViewClass = require('./public.view.js')
    router    = require('k-router');

router.resources('/users', UsersViewClass)
      .resource('/public', PublicThingsViewClass);
```

### Looking up routes with urlFor

As a helper to allow you to decouple URLs from your app, the urlFor method
exists, which takes a controller object and method name, and will return the
route you assigned to that controller/method combination. It can also be passed
arguments which will override the parameters from that url. For example:

```javascript
var UsersViewClass = require('./users.view.js'),
    router    = require('k-router');

router.route('/users', UsersViewClass, 'list', 'GET');
router.route('/users/:id', UsersViewClass, 'show', 'GET');
router.route('/users/by/:name/:age', UsersViewClass, 'findByNameAge', 'GET');

router.urlFor(UsersViewClass, 'list') //=> '/users'
router.urlFor(UsersViewClass, 'show') //=> '/users/:id'
router.urlFor(UsersViewClass, 'show', { id: '12' }) //=> '/users/12'
router.urlFor(UsersViewClass, 'findByNameAge') //=> '/users/:name/:age'
router.urlFor(UsersViewClass, 'findByNameAge', { name: 'bob', age: 21 }) //=> '/users/bob/21'
```

You can also search for the view/controller class by name, if the view or
controller class has a `name` propery in its object:

```javascript
var UsersViewClass = require('./users.view.js');

UsersViewClass.name = 'Users';

router.route('/users', UsersViewClass, 'list', 'GET');

router.urlFor('Users', 'list') //=> '/users'
```

### Getting allowed methods for a route with getAllowedMethods

Sometimes (typically in response to an OPTIONS request, or if returning a `405
method not allowed`) you want to get a list of allowed methods on a particular
route. You can do this with `router.getAllowedMethods(route)` where `route` is
the String or RegExp you originally specified when creating the route, e.g:

```javascript
var UsersViewClass = require('./users.view.js'),
    router    = require('k-router');

router.route('/users', UsersViewClass, 'list', 'GET');

// HEAD is transparently created as a route to the GET method, as per spec
router.getAllowedMethods('/users') //=> ['GET', 'HEAD']

router.route('/users', UsersViewClass, 'new', 'POST');

router.getAllowedMethods('/users') //=> ['GET', 'HEAD', 'POST']
```

LICENSE
-------

MIT

[rfc2616]: https://tools.ietf.org/html/rfc2616#page-66
[CRUD]: http://en.wikipedia.org/wiki/Crud
