var utils = require('loopback-datasource-juggler/lib/utils');

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
  
  var originalInitialize = model.prototype.initialize;
  model.prototype.initialize = function(attributes, options) {
    this.__relations = this.__relations || {};
    originalInitialize.apply(this, arguments);
  };

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
        
        query: function(query, cb) {
          if (_.isFunction(query)) cb = query, query = {};
          query = _.isObject(query) ? query : {};
          var collection = new this.constructor();
          // reset comparator if explicit order is given
          if (!_.isEmpty(query.order)) collection.comparator = null;
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
      console.log('Relation type not implemented: ' + rel.type);
    }
  };
  
  _.each(LoopbackModel.relations, function(rel, name) {
    var getterFn = function(rel) {
      return function() {
        this.__relations = this.__relations || {};
        var relation = this.__relations[rel.name];
        if (!relation) {
          var cached = this.dao.__cachedRelations || {};
          var attrs = rel.embed ? this.get(rel.name) : cached[rel.name];
          attrs = attrs || (rel.multiple ? [] : {});
          var Proxy = proxyForRelation(this, rel.name);
          relation = new Proxy(attrs);
          if (rel.embed) relation.resolved = true;
          this.__relations[rel.name] = relation;
        }
        return relation;
      };
    };
    
    Object.defineProperty(model.prototype, rel.name, {
      enumerable: true,
      configurable: true,
      get: getterFn(rel)
    });
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
  
  var originalSet = model.prototype.set;
  model.prototype.set = function(key, val, options) {
    if (key == null) return this;
    
    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }
    
    options || (options = {});
    
    var self = this;
    var relations = this.constructor.loopback.relations || {};
    
    var relNames = [];
    _.each(relations, function(rel) {
      if (!rel.embed) relNames.push(rel.name);
    });
    
    _.each(_.intersection(relNames, _.keys(attrs)), function(name) {
      var multiple = relations[name].multiple;
      val = attrs[name];
      if (val.toJSON) val = val.toJSON();
      if (multiple && !_.isArray(val)) {
        val = [];
      } else if (!_.isObject(val)) {
        val = {};
      }
      utils.defineCachedRelations(self.dao);
      self.dao.__cachedRelations[name] = val;
    });
    
    return originalSet.call(this, _.omit(attrs, relNames), options);
  };

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
      var modelRelations = this.constructor.loopback.relations;
      var relations = _.pluck(modelRelations, 'name');
      if (_.isArray(options.include)) {
        relations = _.intersection(options.include, relations);
      }
      _.each(relations, function(name) {
        var related = self[name];
        if (_.isFunction(related.toJSON)) {
          json[name] = related.toJSON();
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
  
  var originalInitialize = model.Collection.prototype.initialize;
  model.Collection.prototype.initialize = function(attributes, options) {
    var collection = this;
    this.resolved = false;
    this.on('add remove change reset', function() {
      collection.resolved = false;
    });
    this.on('sync', function() {
      collection.resolved = true;
    });
    originalInitialize.apply(this, arguments);
  };

  model.Collection.find = function(query, cb) {
    var collection = new this();
    return collection.resolve.apply(collection, arguments);
  };
  
  model.Collection.prototype.resolve = function(query, cb) {
    if (arguments.length === 1 && _.isFunction(query)) {
      cb = query, query = {};
    }
    query = query ? _.clone(query) : {};
    var collection = this;
    return returnPromise(function(done) {
      collection.fetch(query).done(function() {
        done(null, collection);
      }).fail(function(err) {
        done(err, collection);
      });
    }, cb);
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
        var finder;
        if (collection.relation) {
          var name = collection.relation.name;
          finder = collection.rel;
          if (!finder) throw new Error('Invalid relation: ' + rel.name);
        } else {
          finder = Model.find.bind(Model);
        }
        finder(_.pick(options, params), function(err, instances) {
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