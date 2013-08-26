var fs = require("fs");
var assert = require("assert");
var vumigo = require("vumigo_v01");
var app = require("../lib/go-groups");

var api = app.api;

api.groups_store = {};
api.groups_search_store = {};

api.add_group = function(group) {
  this.groups_store[group.key] = group;
  return group;
};

api.set_group_search_results = function(query, group_keys) {
  this.groups_search_store[query.toLowerCase()] = group_keys;
};

api._handle_groups_list = function(cmd, reply) {
  var groups_store = this.groups_store;
  api._reply_success(cmd, reply, {
    groups: Object.keys(groups_store).map(function(key) {
      return groups_store[key];
    })
  });
};

api._handle_groups_search = function(cmd, reply) {
  var groups_store = this.groups_store;
  var matched_keys = api.groups_search_store[cmd.query.toLowerCase()] || [];
  api._reply_success(cmd, reply, {
    groups: matched_keys.map(function (key) {
      return groups_store[key];
    })
  });
};

api._handle_groups_get = function(cmd, reply) {
  var group = this.groups_store[cmd.key];
  if(group) {
    api._reply_success(cmd, reply, {
      group: group
    });
  } else {
    api._reply_fail(cmd, reply, 'Group not found');
  }
};

api._handle_groups_get_by_name = function(cmd, reply) {
  var group_keys = Object.keys(this.groups_store);
  var matches = group_keys.filter(function(group_key) {
    var group = api.groups_store[group_key];
    return group.name == cmd.name;
  });
  if(matches.length === 0) {
    api._reply_fail(cmd, reply, 'Group not found');
  } else if (matches.length > 1) {
    api._reply_fail(cmd, reply, 'More than one group returned');
  } else {
    var group = api.groups_store[matches[0]];
    api._reply_success(cmd, reply, {group: group});
  }
};

api._handle_groups_get_or_create_by_name = function(cmd, reply) {
  var group_keys = Object.keys(this.groups_store);
  var matches = group_keys.filter(function(group_key) {
    var group = api.groups_store[group_key];
    return group.name == cmd.name;
  });
  if(matches.length === 0) {
    api._reply_success(cmd, reply, {
      created: true,
      group: api.add_group({key: this._generate_key(), name: cmd.name})
    });
  } else if (matches.length > 1) {
    api._reply_fail(cmd, reply, 'More than one group returned');
  } else {
    var group = api.groups_store[matches[0]];
    api._reply_success(cmd, reply, {
      created: false,
      group: group
    });
  }
};

api._handle_groups_update = function(cmd, reply) {
  var group = this.groups_store[cmd.key];
  if(!group) {
    api._reply_fail(cmd, reply, 'Group not found');
  } else {
    api._reply_success(cmd, reply, {
      group: this.add_group({
        key: group.key,
        name: cmd.name,
        query: cmd.query
      })
    });
  }
};

api._handle_groups_count_members = function(cmd, reply) {
  var group = api.groups_store[cmd.key];
  if(!group) {
    api._reply_fail(cmd, reply, 'Group not found');
  } else {
    var is_smart_group = (group.query ? true : false);
    var member_count;
    if(is_smart_group) {
      // TODO:  not sure what to do about this one as I don't feel like
      //        implementing the Lucene query syntax.
      member_count = 42;
    } else {
      var contact_store = this.contact_store;
      var contacts = Object.keys(contact_store).filter(function(contact_key) {
        var contact = contact_store[contact_key];
        return contact.groups.indexOf(group.key) > -1;
      });
      member_count = contacts.length;
    }
    api._reply_success(cmd, reply, {
      group: group,
      count: member_count
    });
  }
};


describe('Go Contacts', function () {

  var tester;

  beforeEach(function () {
    tester = new vumigo.test_utils.ImTester(app.api, {
      custom_setup: function(api) {
        // prime groups
        api.add_group({ key: 'group-1', name: 'Group 1'});
        api.add_group({ key: 'group-2', name: 'Group 2'});
        api.add_group({ key: 'group-3', name: 'Group 3'});
        api.set_group_search_results('Group 1 and Group 2',
                                      ['group-1', 'group-2']);
        api.set_group_search_results('Group 3 or Group 4',
                                      ['group-3']);
        // add a contact in group 1
        api.add_contact({groups: ['group-1']});
      },
      async: true
    });
  });

  it('should give an option menu', function(done) {
    var p = tester.check_state({
      user: null,
      content: null,
      next_state: 'initial_state',
      response: (
        'Hi, you have 3 Groups. What do you want to do\\?[^]' +
        '1. List them[^]' +
        '2. Search them[^]' +
        '3. Get one by name[^]' +
        '4. Get or create one by name$'
      )
    }).then(done, done);
  });

  it('should use groups.list', function(done) {
    var p = tester.check_state({
        user: null,
        content: '1',
        next_state: 'list',
        response: (
            'Hi, you have the following groups:[^]' +
            '1. Group 1[^]' +
            '2. Group 2[^]' +
            '3. Group 3$'),
    }).then(done, done);
  });

  it('should use groups.get', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'list'
      },
      content: '1',
      next_state: 'get',
      response: (
        'Group 1:[^]' +
        '1. Count members[^]' +
        '2. Change name$')
    }).then(done, done);
  });

  it('should use groups.count_members', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'get',
        answers: {
          'list': 'group-1'
        }
      },
      content: '1',
      next_state: 'count_members',
      response: 'Group 1 has 1 member\\(s\\).',
      continue_session: false
    }).then(done, done);
  });

  it('should prompt for a new group name', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'get',
        answers: {
          'list': 'group-1'
        }
      },
      content: '2',
      next_state: 'prompt_name',
      response: 'Please provide a new name:'
    }).then(done, done);
  });

  it('should use groups.update to update the name', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'prompt_name',
        answers: {
          'list': 'group-1'
        }
      },
      content: 'Group Foo',
      next_state: 'update',
      response: 'Saving group as Group Foo.',
      continue_session: false
    }).then(function() {
      var updated_group = api.groups_store['group-1'];
      assert.equal(updated_group.name, 'Group Foo');
    }).then(done, done);
  });

  it('should ask for a search query', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'initial_state'
      },
      content: '2',
      next_state: 'search',
      response: 'Search:',
    }).then(done, done);
  });

  it('should use groups.search', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'search'
      },
      content: 'Group 1 and Group 2',
      next_state: 'search_results',
      response: (
        'We found the following groups:[^]' +
        '1. Group 1[^]' +
        '2. Group 2$')
    }).then(done, done);
  });

  it('should ask for a name', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'initial_state'
      },
      content: '3',
      next_state: 'get_by_name',
      response: 'Name:'
    }).then(done, done);
  });

  it('should use groups.get_by_name', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'get_by_name'
      },
      content: 'Group 1',
      next_state: 'get_by_name_results',
      response: (
        'Found the following group:[^]' +
        '1. Group 1$')
    }).then(done, done);
  });

  it('should ask for a name when get_or_creating', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'initial_state'
      },
      content: '4',
      next_state: 'get_or_create_by_name',
      response: 'Name:'
    }).then(done, done);
  });

  it('should use groups.get_or_create_by_name and create', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'get_or_create_by_name'
      },
      content: 'A New Group!',
      next_state: 'get_or_create_by_name_results',
      response: (
        'New Group created:[^]' +
        '1. A New Group!$')
    }).then(function() {
      var group_keys = Object.keys(api.groups_store);
      var matching = group_keys.filter(function(key) {
        var group = api.groups_store[key];
        return group.name == 'A New Group!';
      });
      assert.equal(matching.length, 1);
      var matching_group = api.groups_store[matching[0]];
      assert.equal(matching_group.name, 'A New Group!');
    }).then(done, done);
  });

  it('should use groups.get_or_create_by_name and get', function(done) {
    var p = tester.check_state({
      user: {
        current_state: 'get_or_create_by_name'
      },
      content: 'Group 1',
      next_state: 'get_or_create_by_name_results',
      response: (
        'Group found:[^]' +
        '1. Group 1$')
    }).then(done, done);
  });

});
