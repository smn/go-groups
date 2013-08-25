var fs = require("fs");
var assert = require("assert");
var vumigo = require("vumigo_v01");
var app = require("../lib/go-groups");

describe('Go Contacts', function () {

  var tester;
  var api = app.api;

  beforeEach(function () {

    tester = new vumigo.test_utils.ImTester(api, {
      async: true
    });


    api._handle_groups_list = function(cmd, reply) {
      reply(api._populate_reply(cmd, {
        groups: [{
          key: 'group-1',
          name: 'Group 1'
        }, {
          key: 'group-2',
          name: 'Group 2'
        }, {
          key: 'group-3',
          name: 'Group 3'
        }]
      }));
    };
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