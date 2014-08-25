'use strict';

describe('Relations', function() {
  
  var Todo = client.backbone.LocalTodo;
  var User = client.backbone.LocalUser;
  
  Todo.Collection.prototype.comparator = 'created';
  
  var user, collection;
  var ids = {};
  
  before(function reset(done) {
    localStorage.clear();
    client.models.LocalTodo.destroyAll(function() {
      client.models.LocalUser.destroyAll(done);
    });
  });
  
  it('should save Backbone.Model instance', function(done) {
    user = new User({ id: 1, name: 'fred' });
    user.todos.should.be.a.function;
    user.save().done(function() {
      user.toJSON().should.eql({name: 'fred', id: 1});
      done();
    });
  });
  
  it('should return a collection for a relation', function(done) {
    user.todos(function(err, todos) {
      collection = todos;
      should.not.exist(err);
      todos.should.be.instanceof(Todo.Collection);
      todos.model.should.equal(Todo);
      todos.length.should.equal(0);
      done();
    });
  });
  
  it('should implement `build` on a relation collection', function(done) {
    user.todos().done(function(todos) {
      collection.should.equal(todos); // cached
      todos.should.be.instanceof(Todo.Collection);
      todos.build.should.be.a.function;
      var todo = todos.build({ title: 'Todo 1' });
      todo.should.be.instanceof(Todo);
      should.not.exist(todo.id);
      todo.get('userId').should.equal(user.id);
      todo.get('title').should.equal('Todo 1');
      todo.get('completed').should.equal(false);
      String(todo.get('created')).should.match(/^\d{13,}$/);
      todos.length.should.equal(0); // not inserted (yet)
      done();
    });
  });
  
  it('should implement `create` on a relation collection - wait/promise', function(done) {
    user.todos().done(function(todos) {
      todos.create({ title: 'Todo 1' }, { wait: true }).done(function(todo) {
        todo.should.be.instanceof(Todo);
        todo.isNew().should.be.false;
        todo.id.should.match(/^t-(\d+)$/);
        todo.get('userId').should.equal(user.id);
        todo.get('title').should.equal('Todo 1');
        todo.get('completed').should.equal(false);
        String(todo.get('created')).should.match(/^\d{13,}$/);
        todos.length.should.equal(1);
        todos.contains(todo).should.be.true;
        done();
      });
    });
  });
  
  it('should implement `create` on a relation collection - callback', function(done) {
    user.todos().done(function(todos) {
      todos.create({ title: 'Todo 2' }, { success: function(todo) {
        todo.should.be.instanceof(Todo);
        todo.isNew().should.be.false;
        todo.id.should.match(/^t-(\d+)$/);
        todo.get('userId').should.equal(user.id);
        todo.get('title').should.equal('Todo 2');
        todo.get('completed').should.equal(false);
        String(todo.get('created')).should.match(/^\d{13,}$/);
        todos.length.should.equal(2);
        todos.contains(todo).should.be.true;
        done();
      } });
    });
  });
  
  it('should fetch a relation collection - promise', function(done) {
    User.findById(user.id).done(function(u) {
      user = u;
      user.todos().done(function(todos) {
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(2);
        todos.at(0).get('title').should.equal('Todo 1');
        todos.at(1).get('title').should.equal('Todo 2');
        done();
      });
    });
  });
  
  it('should include relations in toJSON - include: true', function() {
    var json = user.toJSON({ include: true });
    json.name.should.equal('fred');
    json.todos.should.be.an.array;
    json.todos.should.have.length(2);
    json.todos[0].title.should.equal('Todo 1');
    json.todos[1].title.should.equal('Todo 2');
  });
  
  it('should update a related item', function(done) {
    user.todos().done(function(todos) {
      collection = todos;
      var todo = todos.at(1);
      todo.get('title').should.equal('Todo 2');
      todo.save({ completed: true }).done(function(resp) {
        todo.get('completed').should.be.true;
        todo.dao.completed.should.be.true;
        done();
      });
    });
  });
  
  it('should fetch and filter relation collection - promise', function(done) {
    user.todos({ where: { completed: true } }).done(function(todos) {
      collection.should.equal(todos); // cached
      todos.should.be.instanceof(Todo.Collection);
      todos.model.should.equal(Todo);
      todos.length.should.equal(1);
      todos.at(0).get('title').should.equal('Todo 2');
      done();
    });
  });
  
  it('should reset and fetch relation collection - promise', function(done) {
    user.todos(true).done(function(todos) {
      collection.should.equal(todos); // cached
      todos.should.be.instanceof(Todo.Collection);
      todos.model.should.equal(Todo);
      todos.length.should.equal(2);
      todos.at(0).get('title').should.equal('Todo 1');
      todos.at(1).get('title').should.equal('Todo 2');
      done();
    });
  });
  
  it('should fetch and order relation collection - callback', function(done) {
    user.todos({ order: 'title DESC' }).done(function(todos) {
      collection.should.equal(todos); // cached
      todos.should.be.instanceof(Todo.Collection);
      todos.model.should.equal(Todo);
      todos.length.should.equal(2);
      should.not.exist(todos.comparator);
      todos.at(0).get('title').should.equal('Todo 2');
      todos.at(1).get('title').should.equal('Todo 1');
      done();
    });
  });
  
  it('should allow findById to include related items', function(done) {
    User.findById(user.id, { include: 'todos' }).done(function(user) {
      var json = user.toJSON({ include: true });
      json.name.should.equal('fred');
      json.todos.should.be.an.array;
      json.todos.should.have.length(2);
      json.todos[0].title.should.equal('Todo 1');
      json.todos[1].title.should.equal('Todo 2');
      user.todos().done(function(todos) {
        todos.at(0).get('title').should.equal('Todo 1');
        todos.at(1).get('title').should.equal('Todo 2');
        done();
      });
    });
  });
  
});