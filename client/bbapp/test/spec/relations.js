'use strict';

describe('Relations', function() {
  
  var Todo = client.backbone.LocalTodo;
  var User = client.backbone.LocalUser;
  
  Todo.Collection.prototype.comparator = 'created';
  
  var user, collection;
  var ids = {};
  var json;
  
  before(function reset(done) {
    localStorage.clear();
    client.models.LocalTodo.destroyAll(function() {
      client.models.LocalUser.destroyAll(done);
    });
  });
  
  it('should save Backbone.Model instance - user', function(done) {
    user = new User({ id: 1, name: 'fred' });
    user.todos.should.be.instanceof(Todo.Collection);
    user.save().done(function() {
      user.toJSON().should.eql({name: 'fred', id: 1});
      done();
    });
  });
  
  it('should save Backbone.Model instance - orphan todo', function(done) {
    var todo = new Todo({ title: 'Orphan' }); // for verification
    todo.save().done(function() { done(); });
  });
  
  describe('multiple', function() {
  
    it('should return a new collection for a relation', function() {
      var todos = user.todos;
      todos.should.be.instanceof(Todo.Collection);
      todos.length.should.equal(0);
      todos.model.should.equal(Todo);
      todos.instance.should.equal(user);
      todos.relation.name.should.equal('todos');
      todos.rel.should.be.a.function;
      todos.resolved.should.be.false;
      collection = todos;
    });
  
    it('should resolve a collection for a relation - callback', function(done) {
      user.todos.resolve(function(err, todos) {
        should.not.exist(err);
        todos.should.equal(collection); // cached
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(0);
        done();
      });
    });
  
    it('should resolve a collection for a relation - promise', function(done) {
      user.todos.reset();
      user.todos.resolved.should.be.false;
      user.todos.resolve().done(function(todos) {
        todos.should.equal(collection); // cached
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(0);
        todos.resolved.should.be.true;
        done();
      });
    });
  
    it('should resolve a collection for a relation - fetch', function(done) {
      user.todos.fetch().done(function(todos) { // fetch === resolve
        todos.should.equal(collection); // cached
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(0);
        todos.resolved.should.be.true;
        done();
      });
    });
  
    it('should implement `build` on a relation collection', function() {
      var todos = user.todos;
      todos.should.equal(collection); // cached
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
      todos.resolved.should.be.true; // not added
    });
  
    it('should implement `create` on a relation collection - wait/promise', function(done) {
      user.todos.create({ title: 'Todo 1' }, { wait: true }).done(function(todo) {
        ids.todo1 = todo.id;
        todo.should.be.instanceof(Todo);
        todo.isNew().should.be.false;
        todo.id.should.match(/^t-(\d+)$/);
        todo.get('userId').should.equal(user.id);
        todo.get('title').should.equal('Todo 1');
        todo.get('completed').should.equal(false);
        String(todo.get('created')).should.match(/^\d{13,}$/);
        user.todos.length.should.equal(1);
        user.todos.contains(todo).should.be.true;
        user.todos.resolved.should.be.false;
        done();
      });
    });
  
    it('should implement `create` on a relation collection - callback', function(done) {
      user.todos.create({ title: 'Todo 2' }, { success: function(todo) {
        todo.should.be.instanceof(Todo);
        todo.isNew().should.be.false;
        todo.id.should.match(/^t-(\d+)$/);
        todo.get('userId').should.equal(user.id);
        todo.get('title').should.equal('Todo 2');
        todo.get('completed').should.equal(false);
        String(todo.get('created')).should.match(/^\d{13,}$/);
        user.todos.length.should.equal(2);
        user.todos.contains(todo).should.be.true;
        user.todos.resolved.should.be.false;
        done();
      } });
    });
  
    it('should fetch a relation collection - promise', function(done) {
      User.findById(user.id).done(function(u) {
        user = u;
        user.todos.fetch().done(function(todos) {
          collection = todos;
          todos.should.be.instanceof(Todo.Collection);
          todos.model.should.equal(Todo);
          todos.length.should.equal(2);
          todos.at(0).get('title').should.equal('Todo 1');
          todos.at(1).get('title').should.equal('Todo 2');
          todos.resolved.should.be.true;
          done();
        });
      });
    });
  
    it('should include relations in toJSON - include: true', function() {
      json = user.toJSON({ include: true });
      json.name.should.equal('fred');
      json.todos.should.be.an.array;
      json.todos.should.have.length(2);
      json.todos[0].title.should.equal('Todo 1');
      json.todos[1].title.should.equal('Todo 2');
    });
  
    it('should populate relations - round-trip', function() {
      var fred = new User(json);
      fred.toJSON({ include: true }).should.eql(json);
    });
  
    it('should update a related item', function(done) {
      var todo = user.todos.at(1);
      todo.get('title').should.equal('Todo 2');
      todo.save({ completed: true }).done(function(resp) {
        todo.get('completed').should.be.true;
        todo.dao.completed.should.be.true;
        done();
      });
    });
  
    it('should query a relation collection - promise', function(done) {
      user.todos.query({ where: { completed: true } }).done(function(todos) {
        todos.should.not.equal(collection); // new, independent collection
        todos.should.not.equal(user.todos);
        todos.instance.should.equal(user);
        todos.relation.name.should.equal('todos');
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(1);
        todos.at(0).get('title').should.equal('Todo 2');
        done();
      });
    });
  
    it('should reset and fetch relation collection - promise', function(done) {
      user.todos.fetch().done(function(todos) {
        todos.should.equal(collection); // still cached
        todos.should.equal(user.todos);
        todos.should.be.instanceof(Todo.Collection);
        todos.model.should.equal(Todo);
        todos.length.should.equal(2);
        todos.at(0).get('title').should.equal('Todo 1');
        todos.at(1).get('title').should.equal('Todo 2');
        done();
      });
    });
  
    it('should fetch and order relation collection - callback', function(done) {
      user.todos.query({ order: 'title DESC' }).done(function(todos) {
        todos.should.not.equal(collection); // new, independent collection
        todos.should.not.equal(user.todos);
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
        user.todos.at(0).get('title').should.equal('Todo 1');
        user.todos.at(1).get('title').should.equal('Todo 2');
        done();
      });
    });
  
  });
  
  describe('singular', function() {
    
    var todo, cached;
    
    it('should return a proxy for a relation - promise', function(done) {
      Todo.findById(ids.todo1, function(err, t) {
        todo = t;
        todo.user.model.should.equal(User);
        todo.user.instance.should.equal(todo);
        todo.user.relation.name.should.equal('user');
        todo.user.rel.should.be.a.function;
        todo.user.resolved.should.be.false;
        done();
      });
    });
    
    it('should resolve a relation - promise', function(done) {
      todo.user.fetch().done(function(user) { // fetch === resolve
        cached = user;
        user.should.be.instanceof(User);
        user.get('name').should.equal('fred');
        done();
      });
    });
    
    it('should resolve a relation from cache - callback cached', function(done) {
      todo.user.resolve(function(err, user) {
        user.should.equal(cached); // cached
        should.not.exist(err);
        user.should.be.instanceof(User);
        user.get('name').should.equal('fred');
        done();
      });
    });
    
    it('should resolve a relation - reset', function(done) {
      todo.user.resolve({ reset: true }).done(function(user) {
        user.should.not.equal(cached); // not cached
        user.should.be.instanceof(User);
        user.get('name').should.equal('fred');
        done();
      });
    });
    
    it('should implement `build` on a relation collection', function() {
      var user = new Todo().user.build({ name: 'Wilma' });
      user.isNew().should.be.true;
      user.should.be.instanceof(User);
    });
    
    it('should implement `create` on a relation - wait/promise', function(done) {
      todo = new Todo({ title: 'Some errand' });
      todo.save().done(function(todo) {
        todo.isNew().should.be.false;
        
        todo.user.create({ name: 'Wilma' }, { wait: true }).done(function(user) {
          user.isNew().should.be.false;
          user.should.be.instanceof(User);
          user.id.should.not.be.empty;
          user.get('name').should.equal('Wilma');
          
          ids.user = user.id;
          
          done();
        });
      });
    });
    
    it('should have created a related entry - verify', function(done) {
      User.findById(ids.user, function(err, user) {
        user.should.be.instanceof(User);
        user.get('name').should.equal('Wilma');
        
        user.todos.fetch().done(function(todos) {
          todos.should.be.instanceof(Todo.Collection);
          todos.length.should.equal(1);
          todos.pluck('id').should.eql([todo.id]);
          done();
        });
      });
    });
    
  });
  
});