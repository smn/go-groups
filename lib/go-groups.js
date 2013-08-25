var vumigo = require("vumigo_v01");

if (typeof api === "undefined") {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var Choice = vumigo.states.Choice,
    ChoiceState = vumigo.states.ChoiceState;

var InteractionMachine = vumigo.state_machine.InteractionMachine,
    StateCreator = vumigo.state_machine.StateCreator;


function GoGroups() {
  var self = this;

  // The first state to enter
  StateCreator.call(self, 'initial_state');

  self.add_creator('initial_state', function(state_name, im) {
    var p = im.api_request('groups.list', {});
    p.add_callback(function(result) {
        return new ChoiceState(
            state_name,
            state_name,
            'Hi, you have the following groups:',
            result.groups.map(function(group) {
                return new Choice(group.key, group.name);
            })
        );
    });
    return p;
  });
}

// launch app
var states = new GoGroups();
var im = new InteractionMachine(api, states);
im.attach();
