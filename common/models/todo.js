module.exports = function(Todo) {

  Todo.definition.properties.created.default = Date.now;

  Todo.beforeSave = function(next, model) {
    if (!this.id) { // semi-stable sorting ids:
      var prefix = Number(Date.now()).toString().slice(-4);
      var suffix = Math.floor(Math.random() * 10000).toString().slice(4);
      this.id = 't-' + prefix + suffix;
    }
    next();
  };

  // Todo.stats = function(filter, cb) {
  //   var stats = {};
  //   cb = arguments[arguments.length - 1];
  //   var Todo = this;
  // 
  //   async.parallel([
  //     countComplete,
  //     count
  //   ], function(err) {
  //     if (err) return cb(err);
  //     stats.remaining = stats.total - stats.completed;
  //     cb(null, stats);
  //   });
  // 
  //   function countComplete(cb) {
  //     Todo.count({completed: true}, function(err, count) {
  //       stats.completed = count;
  //       cb(err);
  //     });
  //   }
  // 
  //   function count(cb) {
  //     Todo.count(function(err, count) {
  //       stats.total = count;
  //       cb(err);
  //     });
  //   }
  // };
  // 
  // Todo.remoteMethod('stats', {
  //   accepts: {arg: 'filter', type: 'object'},
  //   returns: {arg: 'stats', type: 'object'},
  //   http: { path: '/stats' }
  // }, Todo.stats);
};
