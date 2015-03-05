var env = require('./test-environment');

describe('PathParser middleware', function() {
    'use strict';

    it('should not parse path params if the metadata middleware is not used',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.parseRequest(express));

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: '12345'   // <--- Note that this is a string, not a number
                });
            }));
        }
    );

    it('should parse path params',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express, {}));

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
            }));
        }
    );

    it('should parse path params using the Express app of the Middleware class',
        function(done) {
            var express = env.express();
            var middleware = env.swagger(env.parsed.petStore, express);  // <--- The Express app is passed to the Middleware class
            express.use(middleware.metadata());                             // <--- The Express app is NOT passed to the Metadata class
            express.use(middleware.parseRequest({}));                       // <--- The Express app is NOT passed to the PathParser class

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
            }));
        }
    );

    it('should parse path params that are overridden by an operation',
        function(done) {
            var api = _.cloneDeep(env.parsed.petStore);
            api.paths['/pets/{PetName}/photos/{ID}'].get.parameters = [{
                name: 'PetName',
                in: 'path',
                required: true,
                type: 'boolean'
            }];

            var middleware = env.swagger(api);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express, {}));

            env.supertest(express)
                .get('/api/pets/true/photos/12345')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: true,
                    ID: 12345
                });
            }));
        }
    );

    it('should decode encoded path params',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express, {}));

            env.supertest(express)
                .get('/api/pets/Fido%20the%20%22wonder%22%20dog/photos/12345')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                // The path itself is not decoded
                expect(req.path).to.equal('/api/pets/Fido%20the%20%22wonder%22%20dog/photos/12345');

                // But the path params ARE decoded
                expect(req.params).to.deep.equal({
                    PetName: 'Fido the "wonder" dog',
                    ID: 12345
                });
            }));
        }
    );

    it('should parse path params as the proper data type',
        function(done) {
            // Create a dummy path with different types of parameters
            var api = _.cloneDeep(env.parsed.petStore);
            api.paths['/{intParam}/{floatParam}/{byteParam}/{dateParam}/{timeParam}/{boolParam}'] = {
                parameters: [
                    {in: 'path', required: true, name: 'intParam', type: 'integer', format: 'int32'},
                    {in: 'path', required: true, name: 'floatParam', type: 'number', format: 'float'},
                    {in: 'path', required: true, name: 'byteParam', type: 'string', format: 'byte'},
                    {in: 'path', required: true, name: 'dateParam', type: 'string', format: 'date'},
                    {in: 'path', required: true, name: 'timeParam', type: 'string', format: 'date-time'},
                    {in: 'path', required: true, name: 'boolParam', type: 'boolean'}
                ],
                get: {
                    responses: {
                        default: {
                            description: 'testing path param types'
                        }
                    }
                }
            };

            var middleware = env.swagger(api);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));

            env.supertest(express)
                .get('/api/-951/1576.179145671859/+255/2010-11-04/1900-08-14T02:04:55.987-03:00/true')
                .end(env.checkSpyResults(done));

            express.get('/api/:intParam/:floatParam/:byteParam/:dateParam/:timeParam/:boolParam', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    intParam: -951,
                    floatParam: 1576.179145671859,
                    byteParam: 255,
                    dateParam: new Date('2010-11-04'),
                    timeParam: new Date('1900-08-14T02:04:55.987-03:00'),
                    boolParam: true
                });
            }));
        }
    );

    it('should parse path params of nested Routers that use the `parseRequest` middleware',
        function(done) {
            var express = env.express();
            var middleware = env.swagger(env.parsed.petStore, express);  // <--- The Express app is passed to the Middleware class
            var router1 = env.router();
            var router2 = env.router();
            var router3 = env.router();

            // The metadata middleware only needs to be loaded once
            express.use(middleware.metadata());                             // <--- The Express app is NOT passed to the Metadata class

            // The parseRequest middleware needs to be loaded per-router.
            express.use(middleware.parseRequest());                         // <--- The Express app is NOT passed to the PathParser class
            router2.use(middleware.parseRequest(router2));                  // <--- The Express router is passed to the PathParser class
            router3.use(middleware.parseRequest(router3));                  // <--- The Express router is passed to the PathParser class

            express.use(router1);
            express.use(router3);
            router1.use(router2);

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            // The path params ARE parsed for Router2, because it IS using the `parseRequest` middleware,
            // even though Router2 is nested inside Router1, which is NOT using the `parseRequest` middleware
            router2.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
                next();
            }));

            // The path params ARE NOT parsed for Router1, because it's NOT using the `parseRequest` middleware
            router1.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: '12345'
                });
                next();
            }));

            // The path params ARE parsed for Router3, because it IS using the `parseRequest` middleware
            router3.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
                next();
            }));

            // The path params ARE parsed for the Express app
            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
            }));
        }
    );

    it('should not set req.params properties if the path is not parameterized',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));

            // This is NOT a parameterized path
            env.supertest(express)
                .get('/api/pets')
                .end(env.checkSpyResults(done));

            express.get('/api/pets', env.spy(function(req, res, next) {
                expect(req.params).to.be.empty;
            }));
        }
    );

    it('should not parse path params if the middleware is not parameterized',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));

            // This IS a parameterized path
            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            // This middleware is NOT parameterized, so `req.params` will NOT be set
            express.get('/api/pets/Fido/photos/12345', env.spy(function(req, res, next) {
                expect(req.params).to.be.empty;
            }));
        }
    );

    it('should not parse path params if param names don\'t match',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .end(env.checkSpyResults(done));

            // This parameter names should be ":PetName" and ":ID", not ":param1" and ":param2"
            express.get('/api/pets/:param1/photos/:param2', env.spy(function(req, res, next) {
                // `req.params` properties are still set by Express, but they're all strings.
                expect(req.params).to.deep.equal({
                    param1: 'Fido',
                    param2: '12345'
                });
            }));
        }
    );

    it('should not parse non-path params',
        function(done) {
            var api = _.cloneDeep(env.parsed.petStore);
            api.paths['/pets/{PetName}/photos/{ID}'].parameters.push({
                name: 'test',
                in: 'header',
                type: 'string'
            });

            var middleware = env.swagger(api);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express, {}));

            env.supertest(express)
                .get('/api/pets/Fido/photos/12345')
                .set('test', 'hello world')
                .end(env.checkSpyResults(done));

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                expect(req.headers.test).to.equal('hello world');
                expect(req.params).to.deep.equal({
                    PetName: 'Fido',
                    ID: 12345
                });
            }));
        }
    );

    it('should throw an error if path params are invalid',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));

            env.supertest(express)
                .get('/api/pets/Fido/photos/52.5')  // NOTE: 52.5 is invalid, because the param is an integer
                .end(env.checkSpyResults(done));

            // This is success middleware, so it doesn't get called
            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                assert(false, 'This middleware should NOT get called');
            }));

            // This is error-handler middleware, but it doesn't get called because the path can't be parsed
            express.use('/api/pets/:PetName/photos/:ID', env.spy(function(err, req, res, next) {
                assert(false, 'This middleware should NOT get called');
            }));

            // This is catch-all error-handler middleware, so it catches the error
            express.use(env.spy(function(err, req, res, next) {
                expect(err).to.be.an.instanceOf(Error);
                expect(err.message).to.contain('"52.5" is not a properly-formatted whole number');
            }));
        }
    );

    it('should detect new path params when the API changes',
        function(done) {
            var express = env.express();
            var supertest = env.supertest(express);
            var middleware = env.swagger(env.parsed.blank, express);  // <--- Invalid API
            express.use(middleware.metadata());
            express.use(middleware.parseRequest());
            var counter = 0;

            supertest.get('/api/pets/Fido/photos/12345')
                .end(function(err) {
                    if (err) return done(err);

                    middleware.init(env.parsed.petStore);  // <---- Valid API

                    supertest.get('/api/pets/Fido/photos/12345')
                        .end(env.checkSpyResults(done));
                });

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                if (++counter === 1) {
                    // Path params DON'T get parsed on the first request, because the API is invalid
                    expect(req.params).to.deep.equal({
                        PetName: 'Fido',
                        ID: '12345'
                    });
                    next();
                }
                else {
                    // Path params DO get parsed on the second request, because the API is now valid
                    expect(req.params).to.deep.equal({
                        PetName: 'Fido',
                        ID: 12345
                    });
                }
            }));
        }
    );

    it('should detect changes to existing path params when the API changes',
        function(done) {
            var express = env.express();
            var supertest = env.supertest(express);
            var middleware = env.swagger(env.parsed.petStore, express);
            express.use(middleware.metadata());
            express.use(middleware.parseRequest());
            var counter = 0;

            supertest.get('/api/pets/98.765/photos/12345')
                .end(function(err) {
                    if (err) return done(err);

                    // Change the definition of the "name" parameter to a number
                    var api = _.cloneDeep(env.parsed.petStore);
                    _.find(api.paths['/pets/{PetName}/photos/{ID}'].parameters, {name: 'PetName'}).type = 'number';
                    middleware.init(api);

                    supertest.get('/api/pets/98.765/photos/12345')
                        .end(env.checkSpyResults(done));
                });

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                if (++counter === 1) {
                    // The "name" parameter is defined as a string on the first request
                    expect(req.params).to.deep.equal({
                        PetName: '98.765',
                        ID: 12345
                    });
                    next();
                }
                else {
                    // The "name" parameter is defined as a number on the second request
                    expect(req.params).to.deep.equal({
                        PetName: 98.765,
                        ID: 12345
                    });
                }
            }));
        }
    );

    it('should stop parsing path params that no longer exist after the API changes',
        function(done) {
            var middleware = env.swagger(env.parsed.petStore);
            var express = env.express();
            express.use(middleware.metadata(express));
            express.use(middleware.parseRequest(express));
            var supertest = env.supertest(express);
            var counter = 0;

            supertest.get('/api/pets/Fido/photos/12345')
                .end(function(err) {
                    if (err) return done(err);

                    // Replace the parameterized path with a non-parameterized one
                    var api = _.cloneDeep(env.parsed.petStore);
                    delete api.paths['/pets/{PetName}/photos/{ID}'];
                    api.paths['/pets/Fido/photos/12345'] = {
                        get: {
                            responses: {
                                default: {
                                    description: 'dummy'
                                }
                            }
                        }
                    };
                    middleware.init(api);

                    supertest.get('/api/pets/Fido/photos/12345')
                        .end(env.checkSpyResults(done));
                });

            express.get('/api/pets/:PetName/photos/:ID', env.spy(function(req, res, next) {
                if (++counter === 1) {
                    // The parameters are parsed as normal on the first request
                    expect(req.params).to.deep.equal({
                        PetName: 'Fido',
                        ID: 12345
                    });
                    next();
                }
                else {
                    // The parameters no longer exist on the second request, so they're not parsed
                    expect(req.params).to.deep.equal({
                        PetName: 'Fido',
                        ID: '12345'
                    });
                }
            }));
        }
    );

});