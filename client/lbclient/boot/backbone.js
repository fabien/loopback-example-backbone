module.exports = function(client) {

  var models = client.backbone = {};
  
  // TODO: MERGE model.settings.backbone.model backbone.collection
  // to extend with

  _.each(client.models(), function(model) {
    var name = model.modelName;
    models[name] = Backbone.Model.extend({}, { modelName: name });
    mixinLoopback(client, models[name]);
  });
  
};

var mixinLoopback = function(client, model, settings) {
  settings || (settings = {});
  var LoopbackModel = client.models[model.modelName];
  if (!LoopbackModel || model.loopback) return;

  Object.defineProperty(LoopbackModel, 'backbone', {
    value: model,
    writable: false
  });

  Object.defineProperty(model, 'loopback', {
    value: LoopbackModel,
    writable: false
  });

  var returnPromise = function(work, cb, context) {
    var dfd = $.Deferred();
    if (_.isFunction(work)) {
      work.call(context || null, function(err, resp) {
        if (err) {
          dfd.reject(err);
        } else {
          dfd.resolve(resp);
        }
        if (_.isFunction(cb)) cb(err, resp);
      });
    } else {
      dfd.reject();
      if (_.isFunction(cb)) cb(null, null);
    }
    return dfd.promise();
  };

  model.find = function(query, cb) {
    return this.Collection.find.apply(this.Collection, arguments);
  };

  model.findById = function(id, options, cb) {
    if (_.isFunction(options)) cb = options, options = {};
    options = options ? _.clone(options) : {};
    var backboneModel = this;
    return returnPromise(function(done) {
      this.loopback.findById(id, function(err, inst) {
        var m = inst ? new backboneModel(inst.toObject()) : null;
        if (_.isString(options.include) 
          || _.isArray(options.include) 
          || _.isObject(options.include)) {
          m.__cachedRelations = m.__cachedRelations || {};
          backboneModel.loopback.include([m.dao], options.include, function(err) {
            done(err, m);
          });
        } else {
          done(err, m);
        }
      });
    }, cb, this);
  };

  model.prototype.idAttribute = LoopbackModel.definition.idName() || 'id';
  
  var proxyForRelation = function(backboneModel, relationName) {
    var relations = backboneModel.constructor.loopback.relations || {};
    var rel = relations[relationName];
    if (!rel) return;
    
    var relatedModel = rel.modelTo;
    if (relatedModel && relatedModel.backbone) {
      var relCollection = relatedModel.backbone.Collection;
      var relModel = relatedModel.backbone;
    } else {
      var relCollection = Backbone.Collection;
      var relModel = Backbone.Model;
    }
    
    if (rel.multiple) {
      return relCollection.extend({
        rel: backboneModel.dao[rel.name],
        instance: backboneModel,
        model: relModel,
        relation: rel,
        
        filter: function(query, cb) {
          if (_.isFunction(query)) cb = query, query = {};
          query = _.isObject(query) ? query : {};
          var collection = this;
          // reset comparator if explicit order is given
          if (!_.isEmpty(query.order)) this.comparator = null;
          return returnPromise(function(done) {
            collection.rel(query, function(err, instances) {
              collection.reset(instances || []);
              done(err, collection);
            });
          }, cb);
        },
        
        build: function(attrs, options) {
          var sample = this.rel.build({}).toObject();
          return new this.model(_.extend({}, sample, attrs), options);
        },
        
        create: function(model, options) {
          options = options ? _.clone(options) : {};
          if (!(model = this._prepareModel(model, options))) return false;
          if (!options.wait) this.add(model, options);
          var collection = this;
          var success = options.success;
          options.success = function(model, resp) {
            if (options.wait) collection.add(model, options);
            if (success) success(model, resp, options);
          };
          var dfd = options.wait ? $.Deferred() : null;
          this.rel.create(model.toJSON(), function(err, inst) {
            if (err) {
              if (options.error) options.error(err);
              if (dfd) dfd.reject(err);
            } else {
              var attrs = inst.toObject();
              model.set(attrs);
              if (options.success) options.success(model, attrs);
              if (dfd) dfd.resolve(model);
            }
          });
          return dfd ? dfd.promise() : model;
        },
        
        // TODO move this to a base collection class
        _prepareModel: function(attrs, options) {
          attrs = attrs.toObject ? attrs.toObject() : attrs;
          return relCollection.prototype._prepareModel.call(this, attrs, options);
        }
      });
    } else {
      // TODO
    }
  };
  
  _.each(LoopbackModel.relations, function(rel, name) {
    if (rel.multiple) {
      model.prototype[rel.name] = (function(rel) {
        return function(query, cb) {
          if (_.isFunction(query)) cb = query, query = {};
          var reset = query === true;
          query = _.isObject(query) ? query : {};
          
          var Collection = new proxyForRelation(this, rel.name);
          
          this.__cachedRelations = this.__cachedRelations || {};

          var collection = this.__cachedRelations[rel.name];

          if (reset === true && collection instanceof Collection) {
            collection.reset();
          } else if (_.isEmpty(query) && collection instanceof Collection) {
            return done(null, collection);
          }

          collection = collection || new Collection();
          this.__cachedRelations[rel.name] = collection;
          
          return returnPromise(function(done) {
            // pre-cached values on dao - from inclusion
            if (_.isEmpty(query) && this.dao.__cachedRelations
              && _.isArray(this.dao.__cachedRelations[name])) {
                collection.comparator = null; // reset
                var instances = this.dao.__cachedRelations[name];
                collection.reset(instances);
                return done(null, collection);
            }
            collection.filter(query, done);
          }, cb, this);
        };
      }(rel));
    } else {
      // TODO
    }
  });

  Object.defineProperty(model.prototype, 'dao', {
    get: function() {
      this.__dao = this.__dao || new LoopbackModel();
      return this.__dao;
    },
    set: function(attrs) {
      if (!_.isObject(attrs)) attrs = {};
      this.__dao = new LoopbackModel(attrs);
    }
  });

  Object.defineProperty(model.prototype, 'attributes', {
    get: function() { return this.dao; },
    set: function(attrs) { this.dao = attrs; }
  });

  var originalValidate = model.prototype.validate;
  model.prototype.validate = function(attrs, options) {
    // return key/value pairs, like Backbone.Validation
    // and Backbone.Forms, and of course, Loopback
    var errors = {};
    if (originalValidate) { // perform custom validation
      var err = originalValidate.apply(this, arguments);
      if (err && !_.isObject(err)) { // model level
        _.extend(errors, { model: err });
      } else if (_.isObject(err)) {
        _.extend(errors, err);
      }
    }
    if (!this.dao.isValid()) {
      var daoErrors = this.dao.errors;
      Object.getOwnPropertyNames(daoErrors)
        .filter(function(propertyName) {
          return Array.isArray(daoErrors[propertyName]);
        })
        .map(function(propertyName) {
        errors[propertyName] = daoErrors[propertyName][0];
      });
    }
    if (!_.isEmpty(errors)) return errors;
  };

  model.prototype.clone = function() {
    return new this.constructor(this.attributes.toObject());
  };

  model.prototype.toJSON = function(options) {
    options || (options = {});
    var json = this.attributes.toJSON(options);

    if (options.include) {
      var self = this;
      var cached = this.__cachedRelations || {};
      var daoCached = this.dao.__cachedRelations || {};
      var modelRelations = this.constructor.loopback.relations;

      var relations = _.pluck(modelRelations, 'name');
      if (_.isArray(options.include)) {
        relations = _.intersection(options.include, relations);
      }

      _.each(relations, function(name) {
        var related = cached[name] || daoCached[name];
        if (_.isFunction(related.toJSON)) {
          json[name] = related.toJSON();
        } else if (_.isArray(related)) {
          json[name] = _.map(related, function(r) {
            return r.toJSON ? r.toJSON() : r;
          });
        }
      });
    }
    return json;
  };

  model.prototype.sync = function(method, model, options) {
    options || (options = {});

    var Model = model.constructor.loopback;
    var dfd = $.Deferred();

    var handleResponse = function(err, resp) {
      if (err) {
        if (options.error) options.error(err);
        dfd.reject(err);
      } else {
        if (options.success) options.success(resp);
        dfd.resolve(model, resp);
      }
    };

    switch (method) {
      case 'read':
        Model.findById(model.id, function(err, inst) {
          handleResponse(err, err ? {} : inst.toObject());
        });
        break;
      case 'create':
      case 'update':
        model.dao.save(function(err, inst) {
          handleResponse(err, err ? {} : inst.toObject());
        });
        break;
      case 'delete':
        Model.deleteById(model.id, function(err, inst) {
          handleResponse(err, err ? null : model);
        });
        break;
    }

    var promise = dfd.promise();
    model.trigger('request', model, promise, options);
    return promise;
  };

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];
  _.each(modelMethods, function(method) {
    model.prototype[method] = function() {
      var args = _.toArray(arguments);
      args.unshift(this.attributes.toObject());
      return _[method].apply(_, args);
    };
  });

  model.Collection = model.Collection || Backbone.Collection.extend({ model: model });

  model.Collection.find = function(query, cb) {
    if (arguments.length === 1 && _.isFunction(query)) {
      cb = query, query = {};
    }
    query = query ? _.clone(query) : {};
    return returnPromise(function(done) {
      var collection = new this();
      collection.fetch(query).done(function() {
        done(null, collection);
      }).fail(function(err) {
        done(err, collection);
      });
    }, cb, this);
  };

  model.Collection.prototype.sync = function(method, collection, options) {
    options || (options = {});

    var params = ['where', 'order', 'include', 'collect', 'limit', 'skip', 'offset', 'fields'];
    var Model = collection.model.loopback; // TODO check this
    var dfd = $.Deferred();

    var handleResponse = function(err, resp) {
      if (err) {
        if (options.error) options.error(err);
        dfd.reject(err);
      } else {
        if (options.success) options.success(resp);
        dfd.resolve(collection, resp);
      }
    };

    switch (method) {
      case 'read':
        // reset comparator if explicit order is given
        if (!_.isEmpty(options.order)) collection.comparator = null;
        Model.find(_.pick(options, params), function(err, instances) {
          if (err || _.isEmpty(instances)) return handleResponse(err, []);
          handleResponse(null, instances.map(function(inst) {
            return inst.toObject ? inst.toObject() : inst;
          }));
        });
        break;
      case 'create': // not implemented in backbone collection
      case 'update': // not implemented in backbone collection
      case 'delete': // not implemented in backbone collection
        break;
    }

    var promise = dfd.promise();
    collection.trigger('request', collection, promise, options);
    return promise;
  };

};