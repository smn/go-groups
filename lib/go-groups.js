var vumigo = require("vumigo_v01");

if (typeof api === "undefined") {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var Choice = vumigo.states.Choice,
    ChoiceState = vumigo.states.ChoiceState,
    EndState = vumigo.states.EndState,
    FreeText = vumigo.states.FreeText
    ;


var InteractionMachine = vumigo.state_machine.InteractionMachine,
    StateCreator = vumigo.state_machine.StateCreator,
    Promise = vumigo.promise.Promise;


function GoGroups() {
  var self = this;

  // The first state to enter
  StateCreator.call(self, 'initial_state');

  self.add_creator('initial_state', function(state_name, im) {
    var p = im.api_request('groups.list', {});
    p.add_callback(function(result) {
      var groups = result.groups;
      return new ChoiceState(
        state_name,
        function(choice) {
          return choice.value;
        },
        ('Hi, you have ' + groups.length + ' Groups. ' +
         'What do you want to do?'),
        [
          new Choice('list', 'List them'),
          new Choice('search', 'Search them'),
          new Choice('get_by_name', 'Get one by name'),
          new Choice('get_or_create_by_name', 'Get or create one by name')
        ]
      );
    });
    return p;
  });

  self.cleanup = function(result) {
    im.set_user_answer('list', null);
    im.set_user_answer('search_results', null);
    im.set_user_answer('get_by_name_results', null);
    im.set_user_answer('get_or_create_by_name_results', null);
    return result;
  };

  self.add_creator('list', function(state_name, im) {
    var p = im.api_request('groups.list', {});
    p.add_callback(function(result) {
      var groups = result.groups;
      return new ChoiceState(
        state_name,
        'get',
        'Hi, you have the following groups:',
        groups.map(function(group) {
            return new Choice(group.key, group.name);
        })
      );
    });
    return p;
  });

  self.get_current_group_key = function() {
    return (im.get_user_answer('list')  ||
            im.get_user_answer('search_results') ||
            im.get_user_answer('get_by_name_results') ||
            im.get_user_answer('get_or_create_by_name_results'));
  };

  self.add_creator('get', function(state_name, im) {
    var p = im.api_request('groups.get', {
      key: self.get_current_group_key()
    });
    p.add_callback(function(result) {
      var group = result.group;
      return new ChoiceState(
        state_name,
        function(choice) {
          return choice.value;
        },
        group.name + ':',
        [
          new Choice('count_members', 'Count members'),
          new Choice('prompt_name', 'Change name')
        ]
      );
    });
    return p;
  });

  self.add_creator('count_members', function(state_name, im) {
    var p = im.api_request('groups.count_members', {
      key: self.get_current_group_key()
    });
    p.add_callback(function(result) {
      var group = result.group;
      var count = result.count;
      return new EndState(
        state_name,
        group.name + ' has ' + count + ' member(s).',
        'initial_state');
    });
    p.add_callback(self.cleanup);
    return p;
  });

  self.add_state(new FreeText(
    'prompt_name',
    'update',
    'Please provide a new name:'
  ));

  self.add_creator('update', function(state_name, im) {
    var group_key = im.get_user_answer('list');
    var p = im.api_request('groups.get', {key: group_key});
    p.add_callback(function(result) {
      var group = result.group;
      return new EndState(
        state_name,
        'Saving group as ' + im.get_user_answer('prompt_name') + '.',
        'initial_state',
        {
          on_enter: function() {
            return im.api_request('groups.update', {
              key: group_key,
              name: im.get_user_answer('prompt_name')
            });
          }
        }
      );
    });
    p.add_callback(self.cleanup);
    return p;
  });

  self.add_state(new FreeText(
    'search',
    'search_results',
    'Search:'));

  self.add_creator('search_results', function(state_name, im) {
    var p = im.api_request('groups.search', {
      query: im.get_user_answer('search')
    });
    p.add_callback(function(results) {
      if(results.groups.length > 0) {
        return new ChoiceState(
          state_name,
          'get',
          'We found the following groups:',
          results.groups.map(function(group) {
            return new Choice(group.key, group.name);
          })
        );
      } else {
        return self.end_with_group_not_found(state_name);
      }
    });
    return p;
  });

  self.add_state(new FreeText(
    'get_by_name',
    'get_by_name_results',
    'Name:'));

  self.add_creator('get_by_name_results', function(state_name, im) {
    var p = im.api_request('groups.get_by_name', {
      name: im.get_user_answer('get_by_name')
    });
    p.add_callback(function(results) {
      if(results.success) {
        return new ChoiceState(
          state_name,
          'get',
          'Found the following group:',
          [
            new Choice(results.group.key, results.group.name)
          ]
        );
      } else {
        return self.end_with_group_not_found(state_name);
      }
    });
    return p;
  });

  self.add_state(new FreeText(
    'get_or_create_by_name',
    'get_or_create_by_name_results',
    'Name:'));

  self.add_creator('get_or_create_by_name_results', function(state_name, im) {
    var p = im.api_request('groups.get_or_create_by_name', {
      name: im.get_user_answer('get_or_create_by_name')
    });
    p.add_callback(function(results) {
      return new ChoiceState(
        state_name,
        'get',
        (results.created ?
          'New Group created:' :
          'Group found:'),
        [
          new Choice(results.group.key, results.group.name)
        ]
      );
    });
    return p;
  });

  self.end_with_group_not_found = function(state_name) {
    var p = new Promise();
    p.add_callback(function() {
      return new EndState(
        state_name,
        'Sorry, not matching groups found',
        'initial_state');
    });
    p.add_callback(self.cleanup);
    p.callback();
    return ep;
  };
}

// launch app
var states = new GoGroups();
var im = new InteractionMachine(api, states);
im.attach();
