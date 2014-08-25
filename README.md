# LoopBack Backbone SDK W.I.P.

This project integrates LoopBack and Backbone, by leveraging the LoopBack client models.

For now, the core functionality is at `/client/lblclient/boot/backbone.js` (to be refactored).

There's a fairly complete test-suite (Mocha/Chai-based) at `/client/bbapp/test` available as well.

The implementation tries to follow Backbone conventions as closely as possible, providing $.Deferred promises where appropriate.

However, a few convenience methods have been added, that mimic LoopBack methods, while returning Backbone Model or Collection objects:

Some examples:

``` javascript
var todo = new Todo();
var errors = todo.validate();
console.log(errors); // { title: "can't be blank" }

Todo.findById(1).done(function(todo) {
  console.log(todo instanceof Todo); // true
  console.log(todo.get('title')); // Todo 1
});

Todo.find({ where: { completed: true } }).done(function(todos) {
  console.log(todos instanceof Todo.Collection); // true
  console.log(todos.at(0).get('title')); // Todo 1
});

User.findById(3).done(function(user) {
  // relation accessors return collections
  user.todos({ where: { completed: true } }).done(function(todos) {
    console.log(todos instanceof Todo.Collection); // true
    console.log(todos.at(0).get('title')); // Todo 1
    console.log(user.toJSON({ include: true })); // { ..., todos: [...] }
  });
});

User.findById(3, { include: 'todos' }).done(function(user) {
  console.log(user.toJSON({ include: true })); // { ..., todos: [...] }
});

```

Note that the plain BackBone approach still works, and this is preferable whenever a light-weight client is required:

``` javascript
var Todo = Backbone.Model.extend({});

TodoCollection = Backbone.Collection.extend({
  url: '/api/todos',
  model: Todo
});

var collection = new TodoCollection();
collection.fetch().done(function() {
  console.log('Collection items:', collection.pluck('id'))
});
```

### Getting started

Run `npm install` and `bower install`. Then try `npm test`.

### TODO

- proper documentation
- bring the project up to par with loopback-example-full-stack
- complete this project into a proper TodoMVC-type Backbone app
- only relations of type 'multiple' are handled at the moment
- properly handle the restApiUrl for the test environment
- refactor mixinLoopback into seperate Model and Collection mixins
- export mixinLoopback as a helper method



