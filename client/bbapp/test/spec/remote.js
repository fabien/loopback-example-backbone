'use strict';

describe('Remote DataSource', function() {
  
  var Todo = client.backbone.Todo;
  
  Todo.Collection.prototype.comparator = 'created';
  
  var todo;
  var ids = {};
  
  it('should create a Backbone.Model instance - promise', function(done) {
    todo = new Todo({ title: 'Todo 1' });
    todo.save().done(function(resp) {
      resp.should.equal(todo);
      todo.should.be.instanceof(Todo);
      ids.todo1 = todo.id;
      todo.should.equal(resp);
      todo.should.be.instanceof(Todo);
      todo.isNew().should.be.false;
      todo.id.should.match(/^t-(\d+)$/);
      String(todo.get('created')).should.match(/^\d{13,}$/);
      done();
    });
  });
  
  it('should find a Backbone.Model instance - promise', function(done) {
    Todo.findById(ids.todo1).done(function(todo) {
      todo.should.be.instanceof(Todo);
      todo.isNew().should.be.false;
      todo.id.should.match(/^t-(\d+)$/);
      String(todo.get('created')).should.match(/^\d{13,}$/);
      done();
    });
  });
  
  it('should create a new instance on a collection - callback', function(done) {
    Todo.find().done(function(todos) {
      todos.length.should.equal(1);
      todos.create({ title: 'Todo 2' }, { success: function(todo) {
        ids.todo2 = todo.id;
        todo.should.be.instanceof(Todo);
        todo.get('title').should.equal('Todo 2');
        todos.include(todo).should.be.true;
        todos.length.should.equal(2);
        todos.comparator.should.equal('created');
        todos.at(0).get('title').should.equal('Todo 1');
        todos.at(1).get('title').should.equal('Todo 2');
        done();
      } });
    });
  });
  
  it('should update a Backbone.Model instance - promise', function(done) {
    var promise = todo.save({ completed: true });
    promise.should.be.an.object;
    promise.promise.should.be.a.function;
    promise.done(function(resp) {
      resp.should.be.instanceof(Todo);
      todo.dao.completed.should.be.true;
      done();
    });
  });
  
  it('should find using query (where) and return a collection - promise', function(done) {
    Todo.find({ where: { completed: true } }).done(function(todos) {
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(1);
      todos.at(0).id.should.equal(ids.todo1);
      todos.at(0).get('title').should.equal('Todo 1');
      done();
    });
  });
  
  it('should destroy a Backbone.Model instance - callback', function(done) {
    Todo.findById(ids.todo1).done(function(todo) {
      todo.should.be.instanceof(Todo);
      todo.destroy({ success: function(deleted) {
        deleted.should.be.instanceof(Todo);
        deleted.id.should.equal(ids.todo1);
        done();
      } });
    });
  });
  
  it('should find and return a collection - promise', function(done) {
    Todo.find().done(function(todos) {
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(1);
      todos.at(0).id.should.equal(ids.todo2);
      todos.at(0).get('title').should.equal('Todo 2');
      done();
    });
  });
  
});