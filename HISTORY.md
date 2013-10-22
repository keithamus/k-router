### v0.2.0

- Ability to omit method name and verb (defaulting to 'show' and 'GET') when
  assigning a route
- Add getAllowedMethods(route) to get an array of assigned HTTP methods for a
  route (e.g `['GET', 'HEAD', 'POST']`). Useful for setting the `Allow` header,
  in `OPTIONS` requests and `405`s
- Add urlFor(controller, method[, arguments]) which will return a String url to
  hit based the controller and method. If supplied additional args, they will be
  injected into the URl as named params or other params

### v0.1.1

- Support HEAD transparently using the GET method without a body
- Improve documentation

### v0.1.0

- Initial Release
