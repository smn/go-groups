var vumigo = require("vumigo_v01");

if (typeof api === "undefined") {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var Choice = vumigo.states.Choice,
    ChoiceState = vumigo.states.ChoiceState,
    EndState = vumigo.states.EndState;


var InteractionMachine = vumigo.state_machine.InteractionMachine,
    StateCreator = vumigo.state_machine.StateCreator;


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

  self.add_creator('list', function(state_name, im) {
    var p = im.api_request('groups.list', {});
    p.add_callback(function(result) {
        var groups = result.groups;
        return new EndState(
            state_name,
            ('Hi, you have the following groups:\n' +
                result.groups.map(function(group) {
                    return '- ' + group.name;
                }).join('\n')),
            'initial_state'
        );
    });
    return p;
  });
}

// launch app
var states = new GoGroups();
var im = new InteractionMachine(api, states);
im.attach();
