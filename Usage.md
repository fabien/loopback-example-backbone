# Browser examples

``` javascript

var Todo = client.backbone.Todo;

var todo = new Todo({ title: 'Todo 1', created: '1234', userId: 1 });

todo.on('invalid', function(model, errors) {
  console.log('INVALID:', errors);
});

todo.save().done(function() {
  console.log('CREATED:', todo.id, todo.toJSON());
}).then(function() {
  todo.set('title', 'Todo A');
  todo.set({ completed: true });
  return todo.save().done(function() {
    console.log('UPDATED:', todo.toJSON());
  });
}).then(function() {
  todo = new Todo({ id: todo.id });
  return todo.fetch().done(function() {
    console.log('FETCH:', todo.toJSON());
  });
}).then(function() {
  return Todo.Collection.find({ where: { completed: true } }).done(function(collection) {
    console.log('FIND COLLECTION', collection.pluck('id'));
  });
}).then(function() {
  return Todo.find(function(err, todos) {
    console.log('FIND:', todos.pluck('id'));
  });
}).then(function() {
  return Todo.find().done(function(todos) {
    console.log('IS COLLECTION', todos instanceof Todo.Collection);
    console.log('FIND (PROMISE):', todos.pluck('id'));
  });
}).then(function() {
  return Todo.findById(todo.id, function(err, todo) {
    console.log('FIND BY ID:', todo.toJSON());
  });
}).then(function() {
  return Todo.findById(todo.id).done(function(todo) {
    console.log('FIND BY ID (PROMISE):', todo.toJSON());
    // console.log('DESTROY:', todo.id);
    // return todo.destroy();
  });
}).then(function() {
  return Todo.findById(todo.id).done(function(todo) {
    console.log('FIND BY ID (DESTROYED):', todo);
  }).fail(function(err) {
    console.log('ERROR:', err.message);
  });
}).then(function() {
  var Model = Backbone.Model.extend({});
  Model.Collection = Backbone.Collection.extend({
    url: '/api/todos',
    model: Model
  });
  var collection = new Model.Collection();
  collection.fetch().done(function() {
    console.log('COLLECTION:', collection.pluck('id'))
  });
});

setTimeout(function() {

var User = models.User;

var user = new User({ id: 1, name: 'fred' });

user.todos.query({ limit: 5 }).done(function(todos) {
  console.log('IS COLLECTION:', todos instanceof Todo.Collection);
  console.log("USER TODOS COLLECTION:", todos.pluck('id'));
  console.log('INCLUDE IN JSON:', user.toJSON({ include: true }))
  
  var todo = todos.build({ title: 'User Todo' });
  console.log('BUILT TODO:', todo.get('userId') === user.id, todo.toJSON());
  
  todos.create({ title: 'New Todo' }, { wait: true }).done(function(todo) {
    console.log('CREATED TODO:', todo.get('userId') === user.id, todo.toJSON());
    console.log('IN COLLECTION', todos.indexOf(todo) > -1 ? 'Y' : 'N');
    console.log("USER TODOS COLLECTION:", todos.pluck('id'));
  });
});

}, 2000);

user.save().done(function() {
  console.log('USER:', user.toJSON());
  user.dao.todos.create({ title: 'User Todo' }, function(err, todo) {
    console.log(err, todo.toJSON());
  });
});

var collection = new Todo.Collection();
collection.fetch({ limit: 4 }).done(function() {
  console.log('COLLECTION', collection.pluck('id'));
}).then(function() {
  collection.create({ title: 'Todo B' }, { success: function() {
    console.log("CREATE ON COLLECTION", collection.pluck('id'))
  }});
});

```
