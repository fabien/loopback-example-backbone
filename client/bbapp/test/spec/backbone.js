'use strict';

describe('Backbone', function() {
  
  // TODO: PATCH SUPPORT
  
  var Todo = client.backbone.LocalTodo;
  
  Todo.Collection.prototype.comparator = 'created';
  
  Todo.loopback.on('changed', function(inst) {
    changes.push(inst.id);
  });
  
  Todo.loopback.on('deleted', function(id) {
    changes.push(id);
  });
  
  var todo;
  var ids = {};
  var changes = [];
  
  before(function reset(done) {
    localStorage.clear();
    client.models.LocalTodo.destroyAll(function() {
      client.models.LocalUser.destroyAll(done);
    });
  });
  
  it('should setup models and collections', function() {
    Todo.prototype.should.be.instanceof(Backbone.Model);
    Todo.Collection.prototype.should.be.instanceof(Backbone.Collection);
    
    client.backbone.LocalTodo.loopback.should.equal(client.models.LocalTodo);
    client.models.LocalTodo.backbone.should.equal(client.backbone.LocalTodo);
  });
  
  it('should test with empty localStorage', function(done) {
    Todo.find().done(function(todos) {
      todos.length.should.equal(0);
      done();
    });
  });
  
  it('should create a new Backbone.Model instance', function() {
    todo = new Todo({ title: 'Todo 1', created: '1234' });
    todo.dao.should.be.instanceof(client.models.Todo);
    should.not.exist(todo.validate());
    todo.get('title').should.equal('Todo 1');
    todo.get('created').should.equal(1234); // cast
    todo.get('completed').should.equal(false); // default
    todo.toJSON().should.eql({
      id: undefined, userId: undefined,
      title: 'Todo 1', created: 1234, completed: false
    });
  });
  
  it('should delegate validation to dao', function() {
    var todo = new Todo();
    var errors = todo.validate();
    errors.should.eql({title: 'can\'t be blank'});
    todo.save().should.equal(false);
  });
  
  it('should create a Backbone.Model instance - callback', function(done) {
    todo = new Todo({ title: 'Todo 1' });
    var promise = todo.save({}, { success: function(todo) {
      ids.todoA = todo.id;
      todo.should.be.instanceof(Todo);
      todo.isNew().should.be.false;
      todo.id.should.match(/^t-(\d+)$/);
      String(todo.get('created')).should.match(/^\d{13,}$/);
      done();
    } });
    promise.should.be.an.object;
    promise.promise.should.be.a.function;
  });
  
  it('should update a Backbone.Model instance - promise', function(done) {
    todo.set('title', 'Todo A');
    todo.dao.title.should.equal('Todo A');
    
    var promise = todo.save({ completed: true });
    promise.should.be.an.object;
    promise.promise.should.be.a.function;
    promise.done(function(resp) {
      resp.should.be.instanceof(Todo);
      todo.dao.completed.should.be.true;
      done();
    });
  });
  
  it('should fetch a Backbone.Model - callback', function(done) {
    new Todo({ id: ids.todoA }).fetch({ success: function(todo) {
      todo.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    } });
  });
  
  it('should fetch a Backbone.Model - promise', function(done) {
    todo = new Todo({ id: ids.todoA });
    todo.fetch().done(function(resp) {
      resp.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement findById - callback', function(done) {
    Todo.findById(ids.todoA, function(err, todo) {
      should.not.exist(err);
      todo.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement findById - promise', function(done) {
    Todo.findById(ids.todoA).done(function(todo) {
      todo.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement findOne - callback', function(done) {
    Todo.findOne({ where: { title: 'Todo A' } }, function(err, todo) {
      should.not.exist(err);
      todo.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement findOne - promise', function(done) {
    Todo.findOne({ where: { title: 'Todo A' } }).done(function(todo) {
      todo.should.be.instanceof(Todo);
      todo.id.should.equal(ids.todoA);
      todo.get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement find and return a collection - callback', function(done) {
    Todo.find(function(err, todos) {
      should.not.exist(err);
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(1);
      todos.at(0).id.should.equal(ids.todoA);
      todos.at(0).get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should implement find and return a collection - promise', function(done) {
    Todo.find().done(function(todos) {
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(1);
      todos.at(0).id.should.equal(ids.todoA);
      todos.at(0).get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should create a new Backbone.Model and save it', function(done) {
    todo = new Todo({ title: 'Todo B' });
    todo.save().done(function(resp) {
      ids.todoB = todo.id;
      todo.id.should.match(/^t-(\d+)$/);
      todo.get('title').should.equal('Todo B');
      String(todo.get('created')).should.match(/^\d{13,}$/);
      done();
    });
  });
  
  it('should create a new instance on a collection - callback', function(done) {
    Todo.find().done(function(todos) {
      todos.length.should.equal(2);
      todos.create({ title: 'Todo C' }, { success: function(todo) {
        ids.todoC = todo.id;
        todo.should.be.instanceof(Todo);
        todo.get('title').should.equal('Todo C');
        todos.include(todo).should.be.true;
        todos.length.should.equal(3);
        todos.comparator.should.equal('created');
        todos.at(0).get('title').should.equal('Todo A');
        todos.at(1).get('title').should.equal('Todo B');
        todos.at(2).get('title').should.equal('Todo C');
        done();
      } });
    });
  });
  
  it('should find using query (where) and return a collection - promise', function(done) {
    Todo.find({ where: { completed: true } }).done(function(todos) {
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(1);
      todos.at(0).id.should.equal(ids.todoA);
      todos.at(0).get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should find using query (where) and return a collection - callback', function(done) {
    Todo.find({ where: { completed: false } }, function(err, todos) {
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(2);
      todos.at(0).get('title').should.equal('Todo B');
      todos.at(1).get('title').should.equal('Todo C');
      done();
    });
  });
  
  it('should find using query (order) and return a collection - promise', function(done) {
    Todo.find({ order: 'title DESC' }).done(function(todos) {
      todos.should.be.instanceof(Todo.Collection);
      should.not.exist(todos.comparator);
      todos.length.should.equal(3);
      todos.at(0).get('title').should.equal('Todo C');
      todos.at(1).get('title').should.equal('Todo B');
      todos.at(2).get('title').should.equal('Todo A');
      done();
    });
  });
  
  it('should have handled loopback native `changed` events', function() {
    changes.should.eql([ids.todoA, ids.todoA, ids.todoB, ids.todoC]);
  });
  
  it('should destroy a Backbone.Model instance - callback', function(done) {
    Todo.findById(ids.todoB).done(function(todo) {
      todo.should.be.instanceof(Todo);
      var promise = todo.destroy({ success: function(deleted) {
        deleted.should.be.instanceof(Todo);
        deleted.id.should.equal(ids.todoB);
        done();
      } });
      promise.should.be.an.object;
      promise.promise.should.be.a.function;
    });
  });
  
  it('should fetch a collection with query (order) - promise', function(done) {
    var todos = new Todo.Collection();
    todos.fetch({ order: 'title DESC' }).done(function(resp) {
      resp.should.be.an.array;
      resp.should.have.length(2);
      should.not.exist(todos.comparator);
      todos.length.should.equal(2);
      todos.at(0).get('title').should.equal('Todo C');
      todos.at(1).get('title').should.equal('Todo A');
      done();
    });
  });

});