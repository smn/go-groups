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
  matches = this.groups_store.filter(function(group) {
    return group.name == cmd.name;
  });
  if(matches.length === 0) {
    api._reply_fail(cmd, reply, 'Group not found');
  } else if (matches.length > 1) {
    api._reply_fail(cmd, reply, 'More than one group returned');
  } else {
    api._reply_success(cmd, reply, {group: matches[0]});
  }
};

api._handle_groups_get_or_create_by_name = function(cmd, reply) {
  matches = this.groups_store.filter(function(group) {
    return group.name == cmd.name;
  });
  if(matches.length === 0) {
    api._reply_success(cmd, reply, {
      group: api.add_group({key: this.generate_key(), name: cmd.name})
    });
  } else if (matches.length > 1) {
    api._reply_fail(cmd, reply, 'More than one group returned');
  } else {
    api._reply_success(cmd, reply, {group: matches[0]});
  }
};

api._handle_groups_update = function(cmd, reply) {
  group = this.groups_store[cmd.key];
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
    var is_smart_group = (cmd.query ? true : false);
    var member_count;
    if(is_smart_group) {
      // TODO:  not sure what to do about this one as I don't feel like
      //        implementing the Lucene query syntax.
      member_count = 42;
    } else {
      var contacts = this.contact_store.filter(function(contact) {
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
      async: true
    });

    // prime groups
    api.add_group({ key: 'group-1', name: 'Group 1'});
    api.add_group({ key: 'group-2', name: 'Group 2'});
    api.add_group({ key: 'group-3', name: 'Group 3'});
    api.set_group_search_results('Group 1 and Group 2',
                                  ['group-1', 'group-2']);
    api.set_group_search_results('Group 3 or Group 4',
                                  ['group-3']);
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
            '- Group 1[^]' +
            '- Group 2[^]' +
            '- Group 3$'),
        continue_session: false
    }).then(done, done);
  });
});