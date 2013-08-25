var fs = require("fs");
var assert = require("assert");
var vumigo = require("vumigo_v01");
var app = require("../lib/go-groups");

var api = app.api;

api.groups_store = {};
api.add_group = function(group) {
  this.groups_store[group.key] = group;
  return group;
};

api._handle_groups_list = function(cmd, reply) {
  var groups_store = this.groups_store;
  reply(api._populate_reply(cmd, {
    groups: Object.keys(groups_store).map(function(key) {
      return groups_store[key];
    })
  }));
};

describe('Go Contacts', function () {

  var tester;

  beforeEach(function () {
    tester = new vumigo.test_utils.ImTester(app.api, {
      async: true
    });

    api.add_group({ key: 'group-1', name: 'Group 1'});
    api.add_group({ key: 'group-2', name: 'Group 2'});
    api.add_group({ key: 'group-3', name: 'Group 3'});
  });

  it('should list known groups', function(done) {
    var p = tester.check_state({
        user: null,
        content: null,
        next_state: 'initial_state',
        response: (
            'Hi, you have the following groups:[^]' +
            '1. Group 1[^]' +
            '2. Group 2[^]' +
            '3. Group 3$')
    }).then(done, done);
  });
});